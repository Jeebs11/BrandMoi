import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, draftsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth.js";
import { computeMomentum } from "../lib/momentum.js";

const router: IRouter = Router();

router.get("/momentum", requireAuth, async (req, res): Promise<void> => {
  const data = await computeMomentum(req.user!.userId);
  res.json(data);
});

// Mirrors drafts.ts's local deriveAudience — same fallback rules, kept in
// sync manually since it's a tiny pure mapping used in a couple of places.
function deriveAudience(objective: unknown): string | undefined {
  if (typeof objective !== "string") return undefined;
  const o = objective.toLowerCase();
  if (o.includes("client")) return "Clients";
  if (o === "hiring") return "My audience";
  if (o.includes("job") || o.includes("recruit")) return "Recruiters & Headhunters";
  if (o.includes("invest")) return "Investors";
  if (o.includes("authority") || o.includes("expert") || o.includes("peer")) return "Peers";
  return "My audience";
}

// Audience-mix nudge: looks at the user's last N published posts and flags a
// heavy skew toward one audience, so someone posting almost exclusively to
// Peers (say) notices they're not showing up for Recruiters, or vice versa.
// Pure DB read — no AI call.
const MIX_WINDOW = 10;

router.get("/momentum/audience-mix", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const recent = await db
    .select({ objective: draftsTable.objective, structuredBreakdown: draftsTable.structuredBreakdown })
    .from(draftsTable)
    .where(and(eq(draftsTable.userId, userId), eq(draftsTable.status, "published")))
    .orderBy(desc(draftsTable.updatedAt))
    .limit(MIX_WINDOW);

  if (recent.length < 4) {
    res.json({ ready: false, total: recent.length, counts: {} });
    return;
  }

  const counts: Record<string, number> = {};
  for (const d of recent) {
    const sb = d.structuredBreakdown as { audience?: string } | null;
    const audience = (typeof sb?.audience === "string" && sb.audience) || deriveAudience(d.objective) || "My audience";
    counts[audience] = (counts[audience] ?? 0) + 1;
  }

  const total = recent.length;
  const [topAudience, topCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const topPct = Math.round((topCount / total) * 100);
  // Only surface a nudge when one audience clearly dominates — 70%+ of a
  // window of at least 4 posts is a real skew, not noise from a small sample.
  const skewed = topPct >= 70;

  const missing = ["Clients", "Peers", "Recruiters & Headhunters", "Investors", "My audience"]
    .filter((a) => !counts[a]);

  res.json({ ready: true, total, counts, topAudience, topPct, skewed, missing });
});

export default router;
