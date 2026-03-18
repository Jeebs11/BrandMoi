import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db } from "@workspace/db";
import { preferencesTable, draftsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth.js";
import { aiRateLimit } from "../middleware/rate-limit.js";
import { buildVoiceDNA } from "../lib/voice-dna.js";

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
    const underused = ["Clients", "Job", "Authority", "Documenting"].filter(
      (o) => (objCounts[o] ?? 0) === 0
    );

    const userMessage = [
      prefs?.brandRole ? `Role: ${prefs.brandRole}` : "",
      prefs?.brandAudience ? `Audience: ${prefs.brandAudience}` : "",
      prefs?.brandBelief ? `Core belief: ${prefs.brandBelief}` : "",
      dna ? `\nWriting DNA:\n${dna}` : "",
      recentTopics ? `\nRecent topics: ${recentTopics}` : "",
      daysSinceLast !== null ? `Days since last draft: ${daysSinceLast}` : "No drafts yet",
      underused.length > 0 ? `Underused objectives: ${underused.join(", ")}` : "",
      `Total drafts: ${recentDrafts.length}`,
    ]
      .filter(Boolean)
      .join("\n");

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 350,
      system: `You are an AI creative director for a LinkedIn creator. Generate a personalized daily brief — like a smart chief-of-staff, not a motivational poster.

Return JSON only (no markdown):
{
  "headline": "One sharp directive about what to focus on today (max 12 words)",
  "insight": "One specific observation about their content gap or momentum (max 25 words)",
  "angles": ["specific post angle 1 (max 10 words)", "angle 2 (max 10 words)", "angle 3 (max 10 words)"]
}

Rules:
- headline must be specific to their actual brand or gap, not generic
- insight must reference something concrete from their history or underused objectives
- angles are real post ideas they could write today
- tone: direct, peer-level, no fluff, no "great job"`,
      messages: [{ role: "user", content: userMessage }],
    });

    const block = msg.content[0];
    if (block.type !== "text") { res.status(500).json({ error: "AI error" }); return; }
    try {
      res.json(JSON.parse(block.text));
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
      max_tokens: 150,
      system: `You are a personal writing coach reviewing a LinkedIn draft. Give ONE specific, actionable coaching note.

Rules:
- Reference the actual draft text
- Compare to their Voice DNA if available
- Identify ONE concrete thing that could make it 20% stronger
- Max 35 words
- Tone: direct, like a trusted editor — no praise, no hedging
- Return JSON only: { "note": "...", "type": "hook|clarity|voice|structure|cta" }`,
      messages: [{ role: "user", content: userMessage }],
    });

    const block = msg.content[0];
    if (block.type !== "text") { res.status(500).json({ error: "AI error" }); return; }
    try {
      res.json(JSON.parse(block.text));
    } catch {
      res.status(500).json({ error: "Invalid AI response" });
    }
  } catch (err) {
    console.error("[agent-coach]", err);
    res.status(500).json({ error: "Failed to generate coaching note" });
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
      res.json(JSON.parse(block.text));
    } catch {
      res.status(500).json({ error: "Invalid AI response" });
    }
  } catch (err) {
    console.error("[agent-themes]", err);
    res.status(500).json({ error: "Failed to analyze themes" });
  }
});

export default router;
