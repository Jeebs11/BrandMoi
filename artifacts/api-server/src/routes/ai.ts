import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db } from "@workspace/db";
import { preferencesTable, draftsTable, brandVoiceSignalsTable } from "@workspace/db";
import {
  StructureIdeaBody,
  StructureIdeaResponse,
  GenerateContentBody,
  GenerateContentResponse,
  RefineContentBody,
  RefineContentResponse,
} from "@workspace/api-zod";
import {
  buildBrandContext,
  STRUCTURE_SYSTEM_PROMPT,
  GENERATE_SYSTEM_PROMPT,
  REFINE_SYSTEM_PROMPT,
} from "../lib/ai-prompts.js";
import { requireAuth } from "../middleware/auth.js";
import { aiRateLimit } from "../middleware/rate-limit.js";
import { buildVoiceDNA, computeJaccard } from "../lib/voice-dna.js";

const router: IRouter = Router();

async function getUserBrandContext(userId: number): Promise<string> {
  const [prefs] = await db
    .select()
    .from(preferencesTable)
    .where(eq(preferencesTable.userId, userId))
    .limit(1);

  const parts: string[] = [];

  if (prefs) {
    const voiceLines: string[] = [];
    if (prefs.brandRole) voiceLines.push(`- Role: ${prefs.brandRole}`);
    if (prefs.brandAudience) voiceLines.push(`- Audience: ${prefs.brandAudience}`);
    if (prefs.brandBelief) voiceLines.push(`- Belief: ${prefs.brandBelief}`);
    if (voiceLines.length > 0) parts.push("Brand voice:\n" + voiceLines.join("\n"));
  }

  const dna = await buildVoiceDNA(userId);
  if (dna) parts.push(dna);

  return parts.join("\n\n");
}

router.post("/ai/structure", requireAuth, aiRateLimit, async (req, res): Promise<void> => {
  const parsed = StructureIdeaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { rawInput, objective, persona, tone } = parsed.data;
  const brandContext = buildBrandContext(objective, persona, tone);
  const voiceContext = await getUserBrandContext(req.user!.userId);

  const userMessage = `Raw thought: ${rawInput}

${brandContext}
${voiceContext ? `\n${voiceContext}` : ""}

Return this exact JSON shape (no markdown fences):
{
  "topic": "",
  "angle": "",
  "coreMessage": "",
  "whyItMatters": "",
  "hooks": ["", "", ""],
  "narrativeFlow": ["", "", "", ""]
}`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: STRUCTURE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = message.content[0];
  if (text.type !== "text") {
    res.status(500).json({ error: "Unexpected AI response type" });
    return;
  }

  let parsed2: unknown;
  try {
    parsed2 = JSON.parse(text.text);
  } catch {
    res.status(500).json({ error: "AI returned invalid JSON" });
    return;
  }

  const validated = StructureIdeaResponse.safeParse(parsed2);
  if (!validated.success) {
    res.status(500).json({ error: "AI response did not match expected shape" });
    return;
  }

  res.json(validated.data);
});

router.post("/ai/generate", requireAuth, aiRateLimit, async (req, res): Promise<void> => {
  const parsed = GenerateContentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { rawInput, objective, persona, tone, structure, selectedHook } = parsed.data;
  const brandContext = buildBrandContext(objective, persona, tone);
  const voiceContext = await getUserBrandContext(req.user!.userId);

  const userMessage = `Create LinkedIn content based on this structure:

Raw thought: ${rawInput}
${brandContext}
${voiceContext ? `\n${voiceContext}` : ""}

Structure:
- Topic: ${structure.topic}
- Angle: ${structure.angle}
- Core Message: ${structure.coreMessage}
- Why It Matters: ${structure.whyItMatters}
- Selected Hook: ${selectedHook}
- Narrative Flow: ${structure.narrativeFlow.join(" → ")}

Return this exact JSON shape (no markdown fences):
{
  "post": "",
  "carousel": [{"slide": 1, "title": "", "description": ""}],
  "visual": ""
}`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: GENERATE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = message.content[0];
  if (text.type !== "text") {
    res.status(500).json({ error: "Unexpected AI response type" });
    return;
  }

  let parsed2: unknown;
  try {
    parsed2 = JSON.parse(text.text);
  } catch {
    res.status(500).json({ error: "AI returned invalid JSON" });
    return;
  }

  const validated = GenerateContentResponse.safeParse(parsed2);
  if (!validated.success) {
    res.status(500).json({ error: "AI response did not match expected shape" });
    return;
  }

  res.json(validated.data);
});

router.post("/ai/refine", requireAuth, aiRateLimit, async (req, res): Promise<void> => {
  const parsed = RefineContentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { content, instruction, tab } = parsed.data;

  const userMessage = `Refine this ${tab} content:

${content}

Instruction: ${instruction}

Return this exact JSON shape (no markdown fences):
{"content": ""}`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: REFINE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = message.content[0];
  if (text.type !== "text") {
    res.status(500).json({ error: "Unexpected AI response type" });
    return;
  }

  let parsed2: unknown;
  try {
    parsed2 = JSON.parse(text.text);
  } catch {
    res.status(500).json({ error: "AI returned invalid JSON" });
    return;
  }

  const validated = RefineContentResponse.safeParse(parsed2);
  if (!validated.success) {
    res.status(500).json({ error: "AI response did not match expected shape" });
    return;
  }

  res.json(validated.data);
});

const CheckAngleBody = z.object({
  topic: z.string().min(1),
  angle: z.string().min(1),
});

router.post("/ai/check-angle", requireAuth, async (req, res): Promise<void> => {
  const parsed = CheckAngleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { topic, angle } = parsed.data;
  const newText = `${topic} ${angle}`;

  const recentDrafts = await db
    .select()
    .from(draftsTable)
    .where(eq(draftsTable.userId, req.user!.userId))
    .orderBy(desc(draftsTable.createdAt))
    .limit(20);

  let mostSimilar: { draftId: number; topic: string; angle: string; score: number } | null = null;

  for (const draft of recentDrafts) {
    const bd = draft.structuredBreakdown as { topic?: string; angle?: string } | null;
    if (!bd?.topic || !bd?.angle) continue;
    const score = computeJaccard(newText, `${bd.topic} ${bd.angle}`);
    if (!mostSimilar || score > mostSimilar.score) {
      mostSimilar = { draftId: draft.id, topic: bd.topic, angle: bd.angle, score };
    }
  }

  const THRESHOLD = 0.15;
  if (!mostSimilar || mostSimilar.score < THRESHOLD) {
    res.json({ similar: false });
    return;
  }

  let freshAngles: string[] = [];
  try {
    const angleMsg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: "You are a content strategist. Suggest 2 fresh alternative angles on the same topic that approach it from a different perspective, audience, or entry point. Return JSON only: { \"freshAngles\": [\"angle 1\", \"angle 2\"] }",
      messages: [{ role: "user", content: `Topic: ${topic}\nCurrent angle: ${angle}\nProvide 2 fresh angles. Return JSON only.` }],
    });
    const t = angleMsg.content[0];
    if (t.type === "text") {
      const p = JSON.parse(t.text) as { freshAngles?: string[] };
      freshAngles = p.freshAngles ?? [];
    }
  } catch {
    freshAngles = [];
  }

  res.json({
    similar: true,
    match: { draftId: mostSimilar.draftId, topic: mostSimilar.topic, angle: mostSimilar.angle },
    score: Math.round(mostSimilar.score * 100),
    freshAngles,
  });
});

export async function extractVoiceDNA(userId: number, draftId: number, postOutput: string): Promise<void> {
  try {
    const existing = await db
      .select({ id: brandVoiceSignalsTable.id })
      .from(brandVoiceSignalsTable)
      .where(and(eq(brandVoiceSignalsTable.draftId, draftId), eq(brandVoiceSignalsTable.userId, userId)))
      .limit(1);

    if (existing.length > 0) return;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: "Extract writing pattern signals from this LinkedIn post. Return JSON only (no markdown): { \"sentenceStyle\": \"short and punchy|medium and structured|long and flowing\", \"punctuationStyle\": \"minimal|standard|expressive\", \"openingStyle\": \"question|statement|story|data point\", \"vocabulary\": [\"word1\",\"word2\",\"word3\",\"word4\",\"word5\"], \"structurePattern\": \"one sentence description\", \"toneMarkers\": [\"marker1\",\"marker2\"] }",
      messages: [{ role: "user", content: postOutput.slice(0, 2000) }],
    });

    const t = message.content[0];
    if (t.type !== "text") return;

    const cleaned = t.text.replace(/```json/g, "").replace(/```/g, "").trim();
    const signals = JSON.parse(cleaned) as object;
    await db.insert(brandVoiceSignalsTable).values({ userId, draftId, signals });
  } catch {
    // Non-critical — fail silently
  }
}

export default router;
