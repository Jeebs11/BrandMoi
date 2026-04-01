import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db } from "@workspace/db";
import { preferencesTable, draftsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth.js";
import { aiRateLimit } from "../middleware/rate-limit.js";
import { buildVoiceDNA } from "../lib/voice-dna.js";

function parseJson(text: string): unknown {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  return JSON.parse(cleaned);
}

const router: IRouter = Router();

async function getUserAgentContext(userId: number) {
  const [prefs] = await db
    .select()
    .from(preferencesTable)
    .where(eq(preferencesTable.userId, userId))
    .limit(1);

  const recentDrafts = await db
    .select()
    .from(draftsTable)
    .where(eq(draftsTable.userId, userId))
    .orderBy(desc(draftsTable.createdAt))
    .limit(30);

  const dna = await buildVoiceDNA(userId);
  return { prefs, recentDrafts, dna };
}

router.get("/agent/brief", requireAuth, async (req, res): Promise<void> => {
  try {
    const { prefs, recentDrafts, dna } = await getUserAgentContext(req.user!.userId);

    const daysSinceLast = recentDrafts[0]?.createdAt
      ? Math.floor((Date.now() - new Date(recentDrafts[0].createdAt).getTime()) / 86400000)
      : null;

    const recentTopics = recentDrafts
      .slice(0, 10)
      .map((d) => {
        const s = d.structuredBreakdown as { topic?: string; angle?: string } | null;
        return s?.topic ? `"${s.topic}"` : null;
      })
      .filter(Boolean)
      .join(", ");

    const objCounts: Record<string, number> = {};
    for (const d of recentDrafts) {
      if (d.objective) objCounts[d.objective] = (objCounts[d.objective] ?? 0) + 1;
    }
    const underused = ["Clients", "Job", "Authority", "Documenting", "Expert", "Hiring"].filter(
      (o) => (objCounts[o] ?? 0) === 0
    );

    // Web search for current news relevant to the user's role and audience
    let newsContext = "";
    let newsHeadline = "";
    let newsSourceLine = "";
    let newsUrl = "";
    try {
      const { default: OpenAI } = await import("openai");
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const roleContext = [prefs?.brandRole, prefs?.brandAudience].filter(Boolean).join(" working with ");
      const searchQuery = `What is the most relevant recent news, study, or development for a ${roleContext || "LinkedIn professional"}? Give me 1-2 specific headlines with a short summary (include date if known).`;
      const searchResp = await openai.chat.completions.create({
        model: "gpt-4o-search-preview" as Parameters<typeof openai.chat.completions.create>[0]["model"],
        messages: [{ role: "user" as const, content: searchQuery }],
        max_tokens: 250,
      });
      newsContext = searchResp.choices[0]?.message?.content ?? "";
      // Extract the first cited URL from search annotations
      const annotations = (searchResp.choices[0]?.message as Record<string, unknown>)?.annotations;
      if (Array.isArray(annotations)) {
        for (const ann of annotations) {
          const a = ann as Record<string, unknown>;
          if (a.type === "url_citation") {
            const citation = a.url_citation as Record<string, unknown> | undefined;
            const url = citation?.url ?? a.url;
            if (typeof url === "string" && url.startsWith("http")) {
              newsUrl = url;
              break;
            }
          }
        }
      }
    } catch {
      newsContext = "";
    }

    const userMessage = [
      prefs?.brandRole ? `Role: ${prefs.brandRole}` : "",
      prefs?.brandAudience ? `Audience: ${prefs.brandAudience}` : "",
      prefs?.brandBelief ? `Core belief: ${prefs.brandBelief}` : "",
      dna ? `\nWriting DNA:\n${dna}` : "",
      recentTopics ? `\nRecent topics: ${recentTopics}` : "",
      daysSinceLast !== null ? `Days since last draft: ${daysSinceLast}` : "No drafts yet",
      underused.length > 0 ? `Underused objectives: ${underused.join(", ")}` : "",
      `Total drafts: ${recentDrafts.length}`,
      newsContext ? `\nToday's news context (use this to make angles timely):\n${newsContext}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 450,
      system: `You are an AI creative director for a LinkedIn creator. Generate a personalized daily brief — like a smart chief-of-staff, not a motivational poster.

Return JSON only (no markdown):
{
  "headline": "One sharp directive about what to focus on today (max 12 words)",
  "insight": "One specific observation about their content gap or momentum (max 25 words)",
  "angles": ["specific post angle 1 (max 10 words)", "angle 2 (max 10 words)", "angle 3 (max 10 words)"],
  "newsHeadline": "If today's news context was provided, extract the single most relevant news headline verbatim or summarised in max 12 words. Otherwise empty string.",
  "newsSourceLine": "If today's news context was provided, write one sentence max 20 words saying what this news means for their field. Otherwise empty string."
}

Rules:
- headline must be specific to their actual brand or gap, not generic
- insight must reference something concrete from their history or underused objectives
- if news context is available, at least one angle should reference or be inspired by it
- angles are real post ideas they could write today
- tone: direct, peer-level, no fluff, no "great job"
- newsHeadline and newsSourceLine must only be set when real news context was provided — not invented`,
      messages: [{ role: "user", content: userMessage }],
    });

    const block = msg.content[0];
    if (block.type !== "text") { res.status(500).json({ error: "AI error" }); return; }
    try {
      const parsed = parseJson(block.text) as Record<string, unknown>;
      newsHeadline = typeof parsed.newsHeadline === "string" ? parsed.newsHeadline.trim() : "";
      newsSourceLine = typeof parsed.newsSourceLine === "string" ? parsed.newsSourceLine.trim() : "";
      res.json({
        headline: parsed.headline,
        insight: parsed.insight,
        angles: parsed.angles,
        ...(newsHeadline ? { newsHeadline, newsSourceLine, ...(newsUrl ? { newsUrl } : {}) } : {}),
      });
    } catch {
      res.status(500).json({ error: "Invalid AI response" });
    }
  } catch (err) {
    console.error("[agent-brief]", err);
    res.status(500).json({ error: "Failed to generate brief" });
  }
});

const CoachBody = z.object({ postText: z.string().min(20).max(3000) });

router.post("/agent/coach", requireAuth, aiRateLimit, async (req, res): Promise<void> => {
  const parsed = CoachBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Post text required." }); return; }

  try {
    const { prefs, dna } = await getUserAgentContext(req.user!.userId);

    const userMessage = [
      `Draft post:\n${parsed.data.postText}`,
      prefs?.brandBelief ? `\nCore belief: ${prefs.brandBelief}` : "",
      prefs?.brandRole ? `Role: ${prefs.brandRole}` : "",
      dna ? `\nWriting DNA:\n${dna}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      system: `You are a personal writing coach reviewing a LinkedIn draft. Identify the single highest-impact improvement and deliver a smart, creative rewrite of the entire post that applies it.

Rules:
- note: ONE specific coaching observation (max 35 words, direct like a trusted editor — no praise, no hedging)
- type: the category of the fix
- rewrite: a full, complete rewrite of the post applying the coaching note. Match the author's voice and style. Keep roughly the same length. Do NOT add commentary — just the improved post text ready to publish.
- Return JSON only: { "note": "...", "type": "hook|clarity|voice|structure|cta", "rewrite": "..." }`,
      messages: [{ role: "user", content: userMessage }],
    });

    const block = msg.content[0];
    if (block.type !== "text") { res.status(500).json({ error: "AI error" }); return; }
    try {
      res.json(parseJson(block.text));
    } catch {
      res.status(500).json({ error: "Invalid AI response" });
    }
  } catch (err) {
    console.error("[agent-coach]", err);
    res.status(500).json({ error: "Failed to generate coaching note" });
  }
});

const NewsAnglesBody = z.object({
  newsHeadline: z.string().min(5).max(300),
  newsSourceLine: z.string().max(300).optional(),
  newsUrl: z.string().url().optional(),
});

router.post("/agent/news-angles", requireAuth, aiRateLimit, async (req, res): Promise<void> => {
  const parsed = NewsAnglesBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "newsHeadline is required." }); return; }

  try {
    const { prefs, dna } = await getUserAgentContext(req.user!.userId);

    const userMessage = [
      `News headline: "${parsed.data.newsHeadline}"`,
      parsed.data.newsSourceLine ? `What it means: "${parsed.data.newsSourceLine}"` : "",
      parsed.data.newsUrl ? `Source: ${parsed.data.newsUrl}` : "",
      prefs?.brandRole ? `\nRole: ${prefs.brandRole}` : "",
      prefs?.brandAudience ? `Audience: ${prefs.brandAudience}` : "",
      prefs?.brandBelief ? `Core belief: ${prefs.brandBelief}` : "",
      dna ? `\nWriting DNA:\n${dna}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 450,
      system: `You are a LinkedIn content strategist. Given a news headline and a creator's brand context, generate exactly 3 post angles.

Each angle must be 1-2 sentences (20–35 words) that:
- Opens with the specific tension, stat, or insight FROM the news headline
- Adds the creator's unique perspective, experience, or contrarian take
- Gives Claude enough context to structure a full post — not just a topic label
- Varies the framing across the 3 angles: one personal story, one contrarian take, one tactical/how-to
- Reads like a strong opening sentence or post premise, not a title

Bad example: "AI adoption is growing fast"
Good example: "AI adoption hit 70% — but structured delivery infrastructure is under 5%. Most teams bought the tool without building the system around it."

Return JSON only (no markdown):
{ "angles": ["angle 1", "angle 2", "angle 3"] }`,
      messages: [{ role: "user", content: userMessage }],
    });

    const block = msg.content[0];
    if (block.type !== "text") { res.status(500).json({ error: "AI error" }); return; }
    try {
      const data = parseJson(block.text) as { angles?: unknown };
      if (!Array.isArray(data.angles)) throw new Error("bad shape");
      res.json({ angles: data.angles.slice(0, 3) });
    } catch {
      res.status(500).json({ error: "Invalid AI response" });
    }
  } catch (err) {
    console.error("[agent-news-angles]", err);
    res.status(500).json({ error: "Failed to generate news angles" });
  }
});

router.get("/agent/themes", requireAuth, async (req, res): Promise<void> => {
  try {
    const recentDrafts = await db
      .select()
      .from(draftsTable)
      .where(eq(draftsTable.userId, req.user!.userId))
      .orderBy(desc(draftsTable.createdAt))
      .limit(20);

    if (recentDrafts.length < 3) { res.json({ themes: [] }); return; }

    const topicsWithAngles = recentDrafts
      .map((d) => {
        const s = d.structuredBreakdown as { topic?: string; angle?: string } | null;
        if (!s?.topic) return null;
        return `- Topic: "${s.topic}"${s.angle ? `, Angle: "${s.angle}"` : ""}`;
      })
      .filter(Boolean)
      .join("\n");

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system: `You are a content strategist analyzing a LinkedIn creator's draft library for recurring themes that could become a series.

Return JSON only:
{
  "themes": [
    {
      "name": "Short theme name (2-4 words)",
      "pattern": "What you noticed across their drafts (max 18 words)",
      "seriesIdea": "A specific 3-post series they could create (max 18 words)",
      "postCount": number
    }
  ]
}

Rules:
- Only surface themes with at least 2 related drafts
- Max 3 themes
- Be specific — not vague ("leadership" is bad, "client onboarding systems" is good)
- If no clear themes emerge, return { "themes": [] }`,
      messages: [{ role: "user", content: `Recent drafts:\n${topicsWithAngles}` }],
    });

    const block = msg.content[0];
    if (block.type !== "text") { res.status(500).json({ error: "AI error" }); return; }
    try {
      res.json(parseJson(block.text));
    } catch {
      res.status(500).json({ error: "Invalid AI response" });
    }
  } catch (err) {
    console.error("[agent-themes]", err);
    res.status(500).json({ error: "Failed to analyze themes" });
  }
});

export default router;
