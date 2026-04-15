import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { createHmac, createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "crypto";
import { db } from "@workspace/db";
import { linkedinConnectionsTable, draftsTable, performanceSignalsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth.js";

const router: IRouter = Router();

const LINKEDIN_CLIENT_ID = process.env["LINKEDIN_CLIENT_ID"];
const LINKEDIN_CLIENT_SECRET = process.env["LINKEDIN_CLIENT_SECRET"];

const STATE_SECRET = Buffer.from(
  (process.env["JWT_SECRET"] ?? "brand-os-dev-secret-change-in-production").padEnd(32, "!").slice(0, 32),
);
const ENCRYPTION_KEY = Buffer.from(
  (process.env["JWT_SECRET"] ?? "brand-os-dev-secret-change-in-production").padEnd(32, "!").slice(0, 32),
);

const SCOPES = ["openid", "profile", "r_basicprofile"].join(" ");

function getRedirectUri(req: { get: (h: string) => string | undefined }): string {
  const host = req.get("host") ?? "localhost";
  const protocol = host.includes("localhost") ? "http" : "https";
  return `${protocol}://${host}/api/linkedin/callback`;
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
  if (!LINKEDIN_CLIENT_ID) {
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
  if (!LINKEDIN_CLIENT_ID) {
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

  try {
    const ugcRes = await fetch(
      "https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List(" +
        encodeURIComponent(conn.memberUrn) +
        ")&count=20&sortBy=LAST_MODIFIED",
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

    const ugcData = await ugcRes.json() as {
      elements?: Array<{
        id: string;
        specificContent?: {
          "com.linkedin.ugc.ShareContent"?: {
            shareCommentary?: { text?: string };
            shareMediaCategory?: string;
          };
        };
        resharedPost?: unknown;
        firstPublishedAt?: number;
        created?: { time?: number };
        lifecycleState?: string;
      }>;
    };

    const elements = ugcData.elements ?? [];

    const originalPosts = elements.filter((post) => {
      if (post.resharedPost) return false;
      const content = post.specificContent?.["com.linkedin.ugc.ShareContent"];
      if (!content) return false;
      if (post.lifecycleState && post.lifecycleState !== "PUBLISHED") return false;
      return true;
    });

    let imported = 0;
    let skipped = 0;

    for (const post of originalPosts) {
      const externalId = post.id;

      const existing = await db
        .select({ id: draftsTable.id })
        .from(draftsTable)
        .where(and(eq(draftsTable.userId, userId), eq(draftsTable.externalId, externalId)))
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      const content = post.specificContent?.["com.linkedin.ugc.ShareContent"];
      const postText = content?.shareCommentary?.text ?? "";
      const mediaCategory = content?.shareMediaCategory ?? "NONE";
      const postType = mediaCategory === "ARTICLE" ? "article" : "post";

      const publishedMs = post.firstPublishedAt ?? post.created?.time ?? Date.now();
      const publishedAt = new Date(publishedMs);

      let reactions = 0;
      let comments = 0;

      try {
        const encodedId = encodeURIComponent(externalId);
        const [reactRes, commentRes] = await Promise.all([
          fetch(
            `https://api.linkedin.com/v2/reactions/(entity:${encodedId})?q=entity&count=0`,
            { headers: { Authorization: `Bearer ${accessToken}`, "X-Restli-Protocol-Version": "2.0.0" } }
          ),
          fetch(
            `https://api.linkedin.com/v2/comments?q=ugcPost&ugcPost=${encodedId}&count=0`,
            { headers: { Authorization: `Bearer ${accessToken}`, "X-Restli-Protocol-Version": "2.0.0" } }
          ),
        ]);
        if (reactRes.ok) {
          const rData = await reactRes.json() as { paging?: { total?: number } };
          reactions = rData.paging?.total ?? 0;
        }
        if (commentRes.ok) {
          const cData = await commentRes.json() as { paging?: { total?: number } };
          comments = cData.paging?.total ?? 0;
        }
      } catch {
      }

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
          createdAt: publishedAt,
        })
        .returning();

      if (reactions > 0 || comments > 0) {
        await db
          .insert(performanceSignalsTable)
          .values({
            draftId: draft.id,
            reactions,
            comments,
            impressions: 0,
          })
          .onConflictDoNothing();
      }

      imported++;
    }

    await db
      .update(linkedinConnectionsTable)
      .set({ lastSyncedAt: new Date() })
      .where(eq(linkedinConnectionsTable.userId, userId));

    res.json({ imported, skipped, total: originalPosts.length });
  } catch (err) {
    console.error("LinkedIn sync error:", err);
    res.status(500).json({ error: "Sync failed" });
  }
});

export default router;
