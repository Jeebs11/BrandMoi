import crypto from "crypto";
import { Router, type IRouter } from "express";
import { db, pool } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/admin.js";
import { eq } from "drizzle-orm";

const DEMO_EMAIL = "demo@brandos.app";
const ADMIN_EMAIL = "odmlawal@gmail.com";

// ── Pending delete tokens (server-side confirmation) ───────────────────────────
const pendingDeletes = new Map<string, { userId: number; expiresAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of pendingDeletes) {
    if (entry.expiresAt < now) pendingDeletes.delete(token);
  }
}, 60_000).unref();

// ── Sort helpers ───────────────────────────────────────────────────────────────
const VALID_SORTS = ["email", "createdAt", "lastActive", "draftCount"] as const;
type SortCol = (typeof VALID_SORTS)[number];
const ORDER_EXPR: Record<SortCol, (dir: "ASC" | "DESC") => string> = {
  email: (d) => `u.email ${d}`,
  createdAt: (d) => `u.created_at ${d}`,
  lastActive: (d) => `"lastActive" ${d} NULLS LAST`,
  draftCount: (d) => `"draftCount" ${d}`,
};

const router: IRouter = Router();
router.use(requireAuth, requireAdmin);

// ── Growth overview ────────────────────────────────────────────────────────────
router.get("/admin/stats", async (_req, res): Promise<void> => {
  try {
    const [totals] = (await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE email NOT IN ($1, $2))::int AS "totalUsers",
        COUNT(*) FILTER (WHERE email NOT IN ($1, $2) AND created_at >= CURRENT_DATE)::int AS "signupsToday",
        COUNT(*) FILTER (WHERE email NOT IN ($1, $2) AND created_at >= NOW() - INTERVAL '7 days')::int AS "signupsWeek",
        COUNT(*) FILTER (WHERE email NOT IN ($1, $2) AND created_at >= NOW() - INTERVAL '30 days')::int AS "signupsMonth"
      FROM users
    `, [DEMO_EMAIL, ADMIN_EMAIL])).rows;

    const [activation] = (await pool.query(`
      SELECT COUNT(*)::int AS activated
      FROM preferences p
      JOIN users u ON u.id = p.user_id
      WHERE u.email NOT IN ($1, $2) AND p.onboarded = true
    `, [DEMO_EMAIL, ADMIN_EMAIL])).rows;

    const activationRate = totals.totalUsers > 0
      ? Math.round((activation.activated / totals.totalUsers) * 100)
      : 0;

    const signupsByDay = (await pool.query(`
      SELECT DATE(created_at AT TIME ZONE 'UTC')::text AS date, COUNT(*)::int AS count
      FROM users
      WHERE email NOT IN ($1, $2) AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at AT TIME ZONE 'UTC')
      ORDER BY date
    `, [DEMO_EMAIL, ADMIN_EMAIL])).rows;

    const dauByDay = (await pool.query(`
      SELECT da.date, COUNT(DISTINCT da.user_id)::int AS count
      FROM daily_activity da
      JOIN users u ON u.id = da.user_id
      WHERE u.email NOT IN ($1, $2) AND da.date >= TO_CHAR(NOW() - INTERVAL '30 days', 'YYYY-MM-DD')
      GROUP BY da.date
      ORDER BY da.date
    `, [DEMO_EMAIL, ADMIN_EMAIL])).rows;

    const demoRow = (await pool.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [DEMO_EMAIL])).rows[0];

    let demoLoginsToday = 0;
    let demoLoginsByDay: unknown[] = [];
    if (demoRow) {
      demoLoginsToday = (await pool.query(
        `SELECT COUNT(*)::int AS c FROM login_events WHERE user_id = $1 AND created_at >= CURRENT_DATE`,
        [demoRow.id]
      )).rows[0].c;
      demoLoginsByDay = (await pool.query(`
        SELECT DATE(created_at AT TIME ZONE 'UTC')::text AS date, COUNT(*)::int AS count
        FROM login_events WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at AT TIME ZONE 'UTC') ORDER BY date
      `, [demoRow.id])).rows;
    }

    res.json({ ...totals, activationRate, signupsByDay, dauByDay, demoLoginsToday, demoLoginsByDay });
  } catch (err) {
    console.error("[admin/stats]", err);
    res.status(500).json({ error: "Failed to load stats" });
  }
});

// ── User list ─────────────────────────────────────────────────────────────────
router.get("/admin/users", async (req, res): Promise<void> => {
  try {
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;

    const rawSort = req.query.sort as string;
    const rawOrder = req.query.order as string;
    const sortCol: SortCol = VALID_SORTS.includes(rawSort as SortCol) ? (rawSort as SortCol) : "createdAt";
    const sortDir: "ASC" | "DESC" = rawOrder === "asc" ? "ASC" : "DESC";
    const orderClause = ORDER_EXPR[sortCol](sortDir);

    const baseExclude = [DEMO_EMAIL, ADMIN_EMAIL];

    const userSelectCols = `
      u.id, u.email, u.display_name AS "displayName", u.created_at AS "createdAt",
      COALESCE(p.onboarded, false) AS onboarded,
      p.tone, p.persona, p.objective,
      p.brand_role AS "brandRole", p.brand_audience AS "brandAudience", p.brand_belief AS "brandBelief",
      p.background_theme AS "backgroundTheme", p.site_theme AS "siteTheme",
      (SELECT MAX(date) FROM daily_activity da WHERE da.user_id = u.id) AS "lastActive",
      (SELECT COUNT(*)::int FROM drafts d WHERE d.user_id = u.id) AS "draftCount",
      (SELECT COUNT(*)::int FROM drafts d WHERE d.user_id = u.id AND d.status = 'published') AS "publishedCount",
      (SELECT COUNT(*)::int FROM drafts d WHERE d.user_id = u.id AND d.carousel_output IS NOT NULL) AS "carouselCount",
      (SELECT COUNT(*)::int FROM drafts d WHERE d.user_id = u.id AND d.visual_output IS NOT NULL) AS "visualCount"
    `;

    let usersQuery: string;
    let countQuery: string;
    let params: unknown[];
    let countParams: unknown[];

    if (search) {
      const like = `%${search}%`;
      usersQuery = `
        SELECT ${userSelectCols}
        FROM users u LEFT JOIN preferences p ON p.user_id = u.id
        WHERE u.email NOT IN ($1, $2) AND (u.email ILIKE $3 OR u.display_name ILIKE $3)
        ORDER BY ${orderClause} LIMIT $4 OFFSET $5`;
      params = [...baseExclude, like, limit, offset];
      countQuery = `SELECT COUNT(*)::int AS total FROM users WHERE email NOT IN ($1, $2) AND (email ILIKE $3 OR display_name ILIKE $3)`;
      countParams = [...baseExclude, like];
    } else {
      usersQuery = `
        SELECT ${userSelectCols}
        FROM users u LEFT JOIN preferences p ON p.user_id = u.id
        WHERE u.email NOT IN ($1, $2)
        ORDER BY ${orderClause} LIMIT $3 OFFSET $4`;
      params = [...baseExclude, limit, offset];
      countQuery = `SELECT COUNT(*)::int AS total FROM users WHERE email NOT IN ($1, $2)`;
      countParams = baseExclude;
    }

    const [users, countResult] = await Promise.all([
      pool.query(usersQuery, params),
      pool.query(countQuery, countParams),
    ]);

    res.json({ users: users.rows, total: countResult.rows[0].total, page, limit });
  } catch (err) {
    console.error("[admin/users]", err);
    res.status(500).json({ error: "Failed to load users" });
  }
});

// ── Single user detail ────────────────────────────────────────────────────────
router.get("/admin/users/:id", async (req, res): Promise<void> => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) { res.status(400).json({ error: "Invalid user id" }); return; }

    const user = (await pool.query(`
      SELECT
        u.id, u.email, u.display_name AS "displayName", u.created_at AS "createdAt",
        COALESCE(p.onboarded, false) AS onboarded,
        p.tone, p.persona, p.objective,
        p.brand_role AS "brandRole", p.brand_audience AS "brandAudience", p.brand_belief AS "brandBelief",
        p.background_theme AS "backgroundTheme", p.site_theme AS "siteTheme",
        (SELECT MAX(date) FROM daily_activity da WHERE da.user_id = u.id) AS "lastActive",
        (SELECT COUNT(*)::int FROM drafts d WHERE d.user_id = u.id) AS "draftCount",
        (SELECT COUNT(*)::int FROM drafts d WHERE d.user_id = u.id AND d.status = 'published') AS "publishedCount",
        (SELECT COUNT(*)::int FROM drafts d WHERE d.user_id = u.id AND d.carousel_output IS NOT NULL) AS "carouselCount",
        (SELECT COUNT(*)::int FROM drafts d WHERE d.user_id = u.id AND d.visual_output IS NOT NULL) AS "visualCount",
        (SELECT COUNT(*)::int FROM login_events le WHERE le.user_id = u.id) AS "totalLogins"
      FROM users u
      LEFT JOIN preferences p ON p.user_id = u.id
      WHERE u.id = $1
    `, [userId])).rows[0];

    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const drafts = (await pool.query(`
      SELECT id, raw_input, status, post_type, created_at FROM drafts
      WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10
    `, [userId])).rows;

    res.json({ user, drafts });
  } catch (err) {
    console.error("[admin/users/:id]", err);
    res.status(500).json({ error: "Failed to load user detail" });
  }
});

// ── Request delete token ──────────────────────────────────────────────────────
router.post("/admin/users/:id/delete-request", async (req, res): Promise<void> => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) { res.status(400).json({ error: "Invalid user id" }); return; }

    const [user] = await db.select({ id: usersTable.id, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, userId)).limit(1);

    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    if (user.email === DEMO_EMAIL) { res.status(400).json({ error: "Cannot delete the demo account" }); return; }
    if (user.email === ADMIN_EMAIL) { res.status(400).json({ error: "Cannot delete the admin account" }); return; }

    // Revoke any existing token for this userId to prevent accumulation
    for (const [tok, entry] of pendingDeletes) {
      if (entry.userId === userId) pendingDeletes.delete(tok);
    }

    const token = crypto.randomUUID();
    const expiresAt = Date.now() + 60_000; // 60 seconds
    pendingDeletes.set(token, { userId, expiresAt });

    res.json({ token, expiresAt: new Date(expiresAt).toISOString() });
  } catch (err) {
    console.error("[admin/delete-request]", err);
    res.status(500).json({ error: "Failed to issue delete token" });
  }
});

// ── Delete user (requires server-issued token) ────────────────────────────────
router.delete("/admin/users/:id", async (req, res): Promise<void> => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) { res.status(400).json({ error: "Invalid user id" }); return; }

    const { token } = req.body as { token?: string };
    if (!token) { res.status(400).json({ error: "Confirmation token required" }); return; }

    const pending = pendingDeletes.get(token);
    if (!pending || pending.userId !== userId) {
      res.status(400).json({ error: "Invalid confirmation token" });
      return;
    }
    if (Date.now() > pending.expiresAt) {
      pendingDeletes.delete(token);
      res.status(400).json({ error: "Confirmation token expired — please try again" });
      return;
    }
    pendingDeletes.delete(token);

    const [user] = await db.select({ id: usersTable.id, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, userId)).limit(1);

    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    if (user.email === DEMO_EMAIL) { res.status(400).json({ error: "Cannot delete the demo account" }); return; }
    if (user.email === ADMIN_EMAIL) { res.status(400).json({ error: "Cannot delete the admin account" }); return; }

    await db.delete(usersTable).where(eq(usersTable.id, userId));
    res.sendStatus(204);
  } catch (err) {
    console.error("[admin/delete-user]", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// ── Funnel & retention ────────────────────────────────────────────────────────
router.get("/admin/funnel", async (_req, res): Promise<void> => {
  try {
    const funnel = (await pool.query(`
      WITH real_users AS (
        SELECT id, created_at FROM users WHERE email NOT IN ($1, $2)
      ),
      onboarded AS (
        SELECT p.user_id FROM preferences p INNER JOIN real_users ru ON ru.id = p.user_id WHERE p.onboarded = true
      ),
      has_draft AS (
        SELECT DISTINCT d.user_id FROM drafts d INNER JOIN real_users ru ON ru.id = d.user_id
      ),
      has_published AS (
        SELECT DISTINCT d.user_id FROM drafts d INNER JOIN real_users ru ON ru.id = d.user_id WHERE d.status = 'published'
      )
      SELECT
        (SELECT COUNT(*)::int FROM real_users) AS "totalSignups",
        (SELECT COUNT(*)::int FROM onboarded) AS "completedOnboarding",
        (SELECT COUNT(*)::int FROM has_draft) AS "createdDraft",
        (SELECT COUNT(*)::int FROM has_published) AS "publishedDraft"
    `, [DEMO_EMAIL, ADMIN_EMAIL])).rows[0];

    const retention = (await pool.query(`
      WITH real_users AS (SELECT id, created_at FROM users WHERE email NOT IN ($1, $2)),
      d1_eligible AS (SELECT id, created_at FROM real_users WHERE created_at <= NOW() - INTERVAL '2 days'),
      d7_eligible AS (SELECT id, created_at FROM real_users WHERE created_at <= NOW() - INTERVAL '8 days'),
      d30_eligible AS (SELECT id, created_at FROM real_users WHERE created_at <= NOW() - INTERVAL '31 days'),
      d1_ret AS (
        SELECT DISTINCT le.user_id FROM login_events le INNER JOIN d1_eligible u ON u.id = le.user_id
        WHERE le.created_at >= u.created_at + INTERVAL '1 day' AND le.created_at < u.created_at + INTERVAL '2 days'
      ),
      d7_ret AS (
        SELECT DISTINCT le.user_id FROM login_events le INNER JOIN d7_eligible u ON u.id = le.user_id
        WHERE le.created_at >= u.created_at + INTERVAL '7 days' AND le.created_at < u.created_at + INTERVAL '8 days'
      ),
      d30_ret AS (
        SELECT DISTINCT le.user_id FROM login_events le INNER JOIN d30_eligible u ON u.id = le.user_id
        WHERE le.created_at >= u.created_at + INTERVAL '30 days' AND le.created_at < u.created_at + INTERVAL '31 days'
      )
      SELECT
        (SELECT COUNT(*)::int FROM d1_eligible) AS "d1Eligible",
        (SELECT COUNT(*)::int FROM d1_ret) AS "d1Returned",
        (SELECT COUNT(*)::int FROM d7_eligible) AS "d7Eligible",
        (SELECT COUNT(*)::int FROM d7_ret) AS "d7Returned",
        (SELECT COUNT(*)::int FROM d30_eligible) AS "d30Eligible",
        (SELECT COUNT(*)::int FROM d30_ret) AS "d30Returned"
    `, [DEMO_EMAIL, ADMIN_EMAIL])).rows[0];

    res.json({
      funnel,
      retention: {
        d1: retention.d1Eligible > 0 ? Math.round((retention.d1Returned / retention.d1Eligible) * 100) : null,
        d7: retention.d7Eligible > 0 ? Math.round((retention.d7Returned / retention.d7Eligible) * 100) : null,
        d30: retention.d30Eligible > 0 ? Math.round((retention.d30Returned / retention.d30Eligible) * 100) : null,
        d1Eligible: retention.d1Eligible,
        d7Eligible: retention.d7Eligible,
        d30Eligible: retention.d30Eligible,
      },
    });
  } catch (err) {
    console.error("[admin/funnel]", err);
    res.status(500).json({ error: "Failed to load funnel" });
  }
});

// ── Content insights ──────────────────────────────────────────────────────────
router.get("/admin/content-insights", async (_req, res): Promise<void> => {
  try {
    const [tones, personas, audiences, formats, topUsers] = await Promise.all([
      pool.query(`
        SELECT p.tone, COUNT(*)::int AS count FROM preferences p
        JOIN users u ON u.id = p.user_id
        WHERE u.email NOT IN ($1, $2) AND p.tone != ''
        GROUP BY p.tone ORDER BY count DESC
      `, [DEMO_EMAIL, ADMIN_EMAIL]),
      pool.query(`
        SELECT p.persona, COUNT(*)::int AS count FROM preferences p
        JOIN users u ON u.id = p.user_id
        WHERE u.email NOT IN ($1, $2) AND p.persona != ''
        GROUP BY p.persona ORDER BY count DESC
      `, [DEMO_EMAIL, ADMIN_EMAIL]),
      pool.query(`
        SELECT p.objective, COUNT(*)::int AS count FROM preferences p
        JOIN users u ON u.id = p.user_id
        WHERE u.email NOT IN ($1, $2) AND p.objective != ''
        GROUP BY p.objective ORDER BY count DESC
      `, [DEMO_EMAIL, ADMIN_EMAIL]),
      pool.query(`
        SELECT
          CASE
            WHEN carousel_output IS NOT NULL THEN 'Carousel'
            WHEN visual_output IS NOT NULL THEN 'Visual'
            ELSE 'Post'
          END AS format,
          COUNT(*)::int AS count
        FROM drafts d JOIN users u ON u.id = d.user_id
        WHERE u.email NOT IN ($1, $2)
        GROUP BY format ORDER BY count DESC
      `, [DEMO_EMAIL, ADMIN_EMAIL]),
      pool.query(`
        SELECT u.email, u.display_name AS "displayName", COUNT(d.id)::int AS "draftCount"
        FROM drafts d JOIN users u ON u.id = d.user_id
        WHERE u.email NOT IN ($1, $2) AND d.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY u.id, u.email, u.display_name
        ORDER BY "draftCount" DESC LIMIT 10
      `, [DEMO_EMAIL, ADMIN_EMAIL]),
    ]);

    res.json({
      tones: tones.rows,
      personas: personas.rows,
      audiences: audiences.rows,
      formats: formats.rows,
      topUsers: topUsers.rows,
    });
  } catch (err) {
    console.error("[admin/content-insights]", err);
    res.status(500).json({ error: "Failed to load insights" });
  }
});

// ── Demo activity ─────────────────────────────────────────────────────────────
router.get("/admin/demo", async (_req, res): Promise<void> => {
  try {
    const demoRow = (await pool.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [DEMO_EMAIL])).rows[0];

    if (!demoRow) {
      res.json({ demoLoginsToday: 0, demoLoginsByDay: [], draftTypes: [], recentDrafts: [] });
      return;
    }

    const [loginsToday, loginsByDay, draftTypes, recentDrafts] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS c FROM login_events WHERE user_id = $1 AND created_at >= CURRENT_DATE`, [demoRow.id]),
      pool.query(`
        SELECT DATE(created_at AT TIME ZONE 'UTC')::text AS date, COUNT(*)::int AS count
        FROM login_events WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at AT TIME ZONE 'UTC') ORDER BY date
      `, [demoRow.id]),
      pool.query(`
        SELECT
          CASE
            WHEN carousel_output IS NOT NULL THEN 'Carousel'
            WHEN visual_output IS NOT NULL THEN 'Visual'
            ELSE 'Post'
          END AS type,
          COUNT(*)::int AS count,
          COUNT(*) FILTER (WHERE status = 'published')::int AS published
        FROM drafts WHERE user_id = $1
        GROUP BY type ORDER BY count DESC
      `, [demoRow.id]),
      pool.query(`
        SELECT raw_input, status, created_at FROM drafts
        WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5
      `, [demoRow.id]),
    ]);

    res.json({
      demoLoginsToday: loginsToday.rows[0].c,
      demoLoginsByDay: loginsByDay.rows,
      draftTypes: draftTypes.rows,
      recentDrafts: recentDrafts.rows,
    });
  } catch (err) {
    console.error("[admin/demo]", err);
    res.status(500).json({ error: "Failed to load demo data" });
  }
});

export default router;
