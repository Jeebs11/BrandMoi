import { Router, type IRouter } from "express";
import { eq, and, isNull, desc } from "drizzle-orm";
import { createHmac, createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "crypto";
import { db } from "@workspace/db";
import { linkedinConnectionsTable, draftsTable, performanceSignalsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth.js";
import { computeJaccard } from "../lib/voice-dna.js";

const router: IRouter = Router();

const LINKEDIN_CLIENT_ID = process.env["LINKEDIN_CLIENT_ID"];
const LINKEDIN_CLIENT_SECRET = process.env["LINKEDIN_CLIENT_SECRET"];

const jwtSecret = process.env["JWT_SECRET"];
if (!jwtSecret && process.env["NODE_ENV"] === "production") {
  throw new Error("JWT_SECRET must be set in production — refusing to start with insecure default");
}
const secretBase = (jwtSecret ?? "brand-os-dev-secret-change-in-production").padEnd(32, "!").slice(0, 32);

const STATE_SECRET = Buffer.from(secretBase);
const ENCRYPTION_KEY = Buffer.from(secretBase);

const SCOPES = ["openid", "profile", "email", "w_member_social"].join(" ");

const ALLOWED_HOST_PATTERN = /^(localhost(:\d+)?|127\.0\.0\.1(:\d+)?|[\w-]+\.replit\.dev|[\w-]+\.replit\.app|[\w-]+\.repl\.co)$/;

function getRedirectUri(req: { protocol: string; get: (h: string) => string | undefined }): string {
  const rawHost = req.get("host") ?? "";
  if (!ALLOWED_HOST_PATTERN.test(rawHost)) {
    throw new Error(`Untrusted Host header for redirect URI: ${rawHost}`);
  }
  return `${req.protocol}://${rawHost}/api/linkedin/callback`;
}

function signState(userId: number): string {
  const payload = { userId, ts: Date.now() };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", STATE_SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function verifyState(state: string): number | null {
  const dotIdx = state.lastIndexOf(".");
  if (dotIdx < 0) return null;
  const data = state.slice(0, dotIdx);
  const sig = state.slice(dotIdx + 1);
  const expected = createHmac("sha256", STATE_SECRET).update(data).digest("base64url");
  const expectedBuf = Buffer.from(expected);
  const sigBuf = Buffer.from(sig);
  if (expectedBuf.length !== sigBuf.length) return null;
  if (!timingSafeEqual(expectedBuf, sigBuf)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(data, "base64url").toString()) as { userId: number; ts: number };
    if (Date.now() - parsed.ts > 10 * 60 * 1000) return null;
    return parsed.userId;
  } catch {
    return null;
  }
}

function encryptToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}.${encrypted.toString("hex")}.${tag.toString("hex")}`;
}

function decryptToken(stored: string): string {
  const [ivHex, encHex, tagHex] = stored.split(".");
  if (!ivHex || !encHex || !tagHex) throw new Error("Invalid encrypted token format");
  const iv = Buffer.from(ivHex, "hex");
  const enc = Buffer.from(encHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

router.get("/linkedin/status", requireAuth, async (req, res): Promise<void> => {
  if (!LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET) {
    res.json({ configured: false, connected: false });
    return;
  }

  const [conn] = await db
    .select()
    .from(linkedinConnectionsTable)
    .where(eq(linkedinConnectionsTable.userId, req.user!.userId))
    .limit(1);

  if (!conn) {
    res.json({ configured: true, connected: false });
    return;
  }

  res.json({
    configured: true,
    connected: true,
    displayName: conn.displayName,
    memberUrn: conn.memberUrn,
    lastSyncedAt: conn.lastSyncedAt?.toISOString() ?? null,
  });
});

router.get("/linkedin/auth", requireAuth, (req, res): void => {
  if (!LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET) {
    res.status(503).json({ error: "LinkedIn integration not configured" });
    return;
  }

  const redirectUri = getRedirectUri(req);
  const state = signState(req.user!.userId);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: LINKEDIN_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
  });

  res.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`);
});

router.get("/linkedin/callback", async (req, res): Promise<void> => {
  const { code, state, error } = req.query as Record<string, string>;
  const settingsUrl = "/settings?linkedin=";

  if (error || !code || !state) {
    res.redirect(`${settingsUrl}error`);
    return;
  }

  if (!LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET) {
    res.redirect(`${settingsUrl}error`);
    return;
  }

  const userId = verifyState(state);
  if (!userId) {
    res.redirect(`${settingsUrl}error`);
    return;
  }

  try {
    const redirectUri = getRedirectUri(req);

    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: LINKEDIN_CLIENT_ID,
        client_secret: LINKEDIN_CLIENT_SECRET,
      }).toString(),
    });

    if (!tokenRes.ok) {
      res.redirect(`${settingsUrl}error`);
      return;
    }

    const tokenData = await tokenRes.json() as { access_token: string; expires_in?: number };
    const rawToken = tokenData.access_token;
    const encryptedToken = encryptToken(rawToken);
    const expiresIn = tokenData.expires_in ?? 5183944;
    const tokenExpiry = new Date(Date.now() + expiresIn * 1000);

    const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${rawToken}` },
    });

    let displayName = "LinkedIn Member";
    let memberUrn = `urn:li:person:unknown`;

    if (profileRes.ok) {
      const profile = await profileRes.json() as { name?: string; sub?: string };
      if (profile.name) displayName = profile.name;
      if (profile.sub) memberUrn = `urn:li:person:${profile.sub}`;
    }

    await db
      .insert(linkedinConnectionsTable)
      .values({ userId, accessToken: encryptedToken, tokenExpiry, memberUrn, displayName })
      .onConflictDoUpdate({
        target: linkedinConnectionsTable.userId,
        set: { accessToken: encryptedToken, tokenExpiry, memberUrn, displayName },
      });

    res.redirect(`${settingsUrl}connected`);
  } catch {
    res.redirect(`${settingsUrl}error`);
  }
});

router.delete("/linkedin/disconnect", requireAuth, async (req, res): Promise<void> => {
  await db
    .delete(linkedinConnectionsTable)
    .where(eq(linkedinConnectionsTable.userId, req.user!.userId));

  res.json({ ok: true });
});

router.post("/linkedin/sync", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const [conn] = await db
    .select()
    .from(linkedinConnectionsTable)
    .where(eq(linkedinConnectionsTable.userId, userId))
    .limit(1);

  if (!conn) {
    res.status(400).json({ error: "LinkedIn not connected" });
    return;
  }

  let accessToken: string;
  try {
    accessToken = decryptToken(conn.accessToken);
  } catch {
    res.status(400).json({ error: "Token decryption failed — please reconnect LinkedIn" });
    return;
  }

  type UgcPost = {
    id: string;
    specificContent?: {
      "com.linkedin.ugc.ShareContent"?: {
        shareCommentary?: { text?: string };
        shareMediaCategory?: string;
      };
    };
    resharedPost?: unknown;
    containerEntity?: unknown;
    firstPublishedAt?: number;
    created?: { time?: number };
    lifecycleState?: string;
  };

  function isOriginalPost(post: UgcPost): boolean {
    if (post.lifecycleState && post.lifecycleState !== "PUBLISHED") return false;
    if (post.resharedPost) return false;
    if (post.containerEntity) return false;
    const shareContent = post.specificContent?.["com.linkedin.ugc.ShareContent"];
    if (!shareContent) return false;
    const category = shareContent.shareMediaCategory ?? "NONE";
    if (!["NONE", "ARTICLE", "IMAGE", "VIDEO", "DOCUMENT"].includes(category)) return false;
    return true;
  }

  try {
    const TARGET_ORIGINALS = 20;
    const PAGE_SIZE = 20;
    const originalPosts: UgcPost[] = [];
    let start = 0;
    let exhausted = false;

    while (originalPosts.length < TARGET_ORIGINALS && !exhausted) {
      const ugcRes = await fetch(
        "https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List(" +
          encodeURIComponent(conn.memberUrn) +
          `)&count=${PAGE_SIZE}&start=${start}&sortBy=LAST_MODIFIED`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "X-Restli-Protocol-Version": "2.0.0",
          },
        }
      );

      if (!ugcRes.ok) {
        const errText = await ugcRes.text();
        res.status(502).json({ error: "Failed to fetch LinkedIn posts", detail: errText });
        return;
      }

      const ugcData = await ugcRes.json() as { elements?: UgcPost[]; paging?: { total?: number; count?: number } };
      const elements = ugcData.elements ?? [];

      for (const post of elements) {
        if (!isOriginalPost(post)) continue;
        originalPosts.push(post);
        if (originalPosts.length >= TARGET_ORIGINALS) break;
      }

      if (elements.length < PAGE_SIZE) {
        exhausted = true;
      } else {
        start += PAGE_SIZE;
      }
    }

    let imported = 0;
    let skipped = 0;
    let statsFailures = 0;
    let reconciledCount = 0;

    for (const post of originalPosts) {
      const externalId = post.id;
      const content = post.specificContent?.["com.linkedin.ugc.ShareContent"];
      const postText = content?.shareCommentary?.text ?? "";
      const mediaCategory = content?.shareMediaCategory ?? "NONE";
      const postType = mediaCategory === "ARTICLE" ? "article" : "post";
      const publishedMs = post.firstPublishedAt ?? post.created?.time ?? Date.now();
      const publishedAt = new Date(publishedMs);

      let reactions = 0;
      let comments = 0;
      let reposts = 0;
      let statsOk = true;

      try {
        const encodedId = encodeURIComponent(externalId);
        const [reactRes, commentRes, repostRes] = await Promise.all([
          fetch(
            `https://api.linkedin.com/v2/reactions/(entity:${encodedId})?q=entity&count=0`,
            { headers: { Authorization: `Bearer ${accessToken}`, "X-Restli-Protocol-Version": "2.0.0" } }
          ),
          fetch(
            `https://api.linkedin.com/v2/comments?q=ugcPost&ugcPost=${encodedId}&count=0`,
            { headers: { Authorization: `Bearer ${accessToken}`, "X-Restli-Protocol-Version": "2.0.0" } }
          ),
          fetch(
            `https://api.linkedin.com/v2/socialActions/${encodedId}/reshares?count=0`,
            { headers: { Authorization: `Bearer ${accessToken}`, "X-Restli-Protocol-Version": "2.0.0" } }
          ),
        ]);
        if (reactRes.ok) {
          const rData = await reactRes.json() as { paging?: { total?: number } };
          reactions = rData.paging?.total ?? 0;
        } else {
          statsOk = false;
        }
        if (commentRes.ok) {
          const cData = await commentRes.json() as { paging?: { total?: number } };
          comments = cData.paging?.total ?? 0;
        } else {
          statsOk = false;
        }
        if (repostRes.ok) {
          const rpData = await repostRes.json() as { paging?: { total?: number } };
          reposts = rpData.paging?.total ?? 0;
        } else {
          statsOk = false;
        }
      } catch (err) {
        statsOk = false;
        console.warn(`LinkedIn stats fetch failed for post ${externalId}:`, err);
      }
      if (!statsOk) statsFailures++;

      const existing = await db
        .select({ id: draftsTable.id })
        .from(draftsTable)
        .where(and(eq(draftsTable.userId, userId), eq(draftsTable.externalId, externalId)))
        .limit(1);

      let draftId: number;
      let reconciled = false;

      // No externalId match — check whether this LinkedIn post is actually a
      // draft authored in the app and pasted to LinkedIn. Fuzzy text match
      // marks that draft published and attaches the stats to it, so the
      // learning loop connects what was generated with how it performed.
      if (existing.length === 0 && postText.trim().length > 80) {
        const candidates = await db
          .select({ id: draftsTable.id, postOutput: draftsTable.postOutput })
          .from(draftsTable)
          .where(and(
            eq(draftsTable.userId, userId),
            isNull(draftsTable.externalId),
          ))
          .orderBy(desc(draftsTable.updatedAt))
          .limit(100);

        let bestId: number | null = null;
        let bestSim = 0;
        for (const c of candidates) {
          if (!c.postOutput || c.postOutput.trim().length < 80) continue;
          const sim = computeJaccard(postText, c.postOutput);
          if (sim > bestSim) { bestSim = sim; bestId = c.id; }
        }

        if (bestId !== null && bestSim >= 0.65) {
          await db
            .update(draftsTable)
            .set({ status: "published", externalId, postType, mediaFormat: mediaCategory })
            .where(eq(draftsTable.id, bestId));
          existing.push({ id: bestId });
          reconciled = true;
        }
      }

      if (existing.length > 0) {
        draftId = existing[0].id;
        // If the stats fetch failed, keep previously-synced numbers rather
        // than overwriting them with zeros.
        const updated = statsOk
          ? await db
              .update(performanceSignalsTable)
              .set({ reactions, comments, reposts, loggedAt: new Date() })
              .where(eq(performanceSignalsTable.draftId, draftId))
              .returning({ id: performanceSignalsTable.id })
          : await db
              .select({ id: performanceSignalsTable.id })
              .from(performanceSignalsTable)
              .where(eq(performanceSignalsTable.draftId, draftId));
        if (updated.length === 0) {
          await db
            .insert(performanceSignalsTable)
            .values({ draftId, reactions, comments, reposts, impressions: 0 })
            .onConflictDoNothing();
        }
        if (reconciled) reconciledCount++; else skipped++;
      } else {
        const topic = postText.split("\n")[0]?.slice(0, 80) ?? "LinkedIn Post";
        const [draft] = await db
          .insert(draftsTable)
          .values({
            userId,
            rawInput: postText,
            objective: "Authority",
            persona: "Founder",
            tone: "Direct",
            structuredBreakdown: {
              topic,
              angle: "Original LinkedIn post",
              coreMessage: postText.slice(0, 200),
              whyItMatters: "Imported from LinkedIn",
              hooks: [{ text: topic }],
              narrativeFlow: [],
            },
            postOutput: postText,
            status: "published",
            contentSource: "linkedin",
            externalId,
            postType,
            mediaFormat: mediaCategory,
            createdAt: publishedAt,
          })
          .returning();
        draftId = draft.id;
        await db
          .insert(performanceSignalsTable)
          .values({ draftId, reactions, comments, reposts, impressions: 0 })
          .onConflictDoNothing();
        imported++;
      }
    }

    await db
      .update(linkedinConnectionsTable)
      .set({ lastSyncedAt: new Date() })
      .where(eq(linkedinConnectionsTable.userId, userId));

    res.json({
      imported,
      skipped,
      reconciled: reconciledCount,
      total: originalPosts.length,
      ...(statsFailures > 0
        ? { warning: `Engagement stats could not be fetched for ${statsFailures} post(s); existing numbers were kept.` }
        : {}),
    });
  } catch (err) {
    console.error("LinkedIn sync error:", err);
    res.status(500).json({ error: "Sync failed" });
  }
});

export default router;
