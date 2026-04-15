import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { linkedinConnectionsTable, draftsTable, performanceSignalsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth.js";

const router: IRouter = Router();

const LINKEDIN_CLIENT_ID = process.env["LINKEDIN_CLIENT_ID"];
const LINKEDIN_CLIENT_SECRET = process.env["LINKEDIN_CLIENT_SECRET"];
const SCOPES = ["openid", "profile", "w_member_social", "r_basicprofile"].join(" ");

function getRedirectUri(req: { protocol: string; get: (h: string) => string | undefined }): string {
  const host = req.get("host") ?? "localhost";
  const protocol = host.includes("localhost") ? "http" : "https";
  return `${protocol}://${host}/api/linkedin/callback`;
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
  const state = Buffer.from(JSON.stringify({ userId: req.user!.userId })).toString("base64url");

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

  let userId: number;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString()) as { userId: number };
    userId = decoded.userId;
  } catch {
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
    const accessToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in ?? 5183944;
    const tokenExpiry = new Date(Date.now() + expiresIn * 1000);

    const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let displayName = "LinkedIn Member";
    let memberUrn = `urn:li:person:${userId}`;

    if (profileRes.ok) {
      const profile = await profileRes.json() as { name?: string; sub?: string };
      if (profile.name) displayName = profile.name;
      if (profile.sub) memberUrn = `urn:li:person:${profile.sub}`;
    }

    await db
      .insert(linkedinConnectionsTable)
      .values({ userId, accessToken, tokenExpiry, memberUrn, displayName })
      .onConflictDoUpdate({
        target: linkedinConnectionsTable.userId,
        set: { accessToken, tokenExpiry, memberUrn, displayName },
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

  try {
    const ugcRes = await fetch(
      "https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List(" +
        encodeURIComponent(conn.memberUrn) +
        ")&count=20&sortBy=LAST_MODIFIED",
      {
        headers: {
          Authorization: `Bearer ${conn.accessToken}`,
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
      }>;
    };

    const elements = ugcData.elements ?? [];

    const originalPosts = elements.filter((post) => {
      if (post.resharedPost) return false;
      const content = post.specificContent?.["com.linkedin.ugc.ShareContent"];
      if (!content) return false;
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
            { headers: { Authorization: `Bearer ${conn.accessToken}`, "X-Restli-Protocol-Version": "2.0.0" } }
          ),
          fetch(
            `https://api.linkedin.com/v2/comments?q=ugcPost&ugcPost=${encodedId}&count=0`,
            { headers: { Authorization: `Bearer ${conn.accessToken}`, "X-Restli-Protocol-Version": "2.0.0" } }
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
          contentSource: "capture",
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
