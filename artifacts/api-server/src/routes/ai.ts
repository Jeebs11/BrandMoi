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
  InfographicDataSchema,
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
  const userId = req.user!.userId;
  const brandContext = buildBrandContext(objective, persona, tone);
  const voiceContext = await getUserBrandContext(userId);

  // 1. Compute hook usage from last 10 drafts
  const hookUsage: Record<string, number> = {};
  try {
    const recentForHooks = await db
      .select()
      .from(draftsTable)
      .where(eq(draftsTable.userId, userId))
      .orderBy(desc(draftsTable.createdAt))
      .limit(10);
    for (const draft of recentForHooks) {
      const bd = draft.structuredBreakdown as { hookTypes?: string[] } | null;
      if (bd?.hookTypes) {
        for (const ht of bd.hookTypes) {
          hookUsage[ht] = (hookUsage[ht] ?? 0) + 1;
        }
      }
    }
  } catch {
    // non-critical — continue without usage data
  }

  // 2. Web search for trending context (graceful fallback)
  let trendingContext = "";
  try {
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const searchResponse = await openai.chat.completions.create({
      model: "gpt-4o-search-preview",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: [{ role: "user", content: `What are people discussing on LinkedIn right now about: "${rawInput}"? Give me 2-3 concise bullet points about current conversations, news, or trending angles that a LinkedIn creator could reference. Be specific and brief.` }] as any,
      max_tokens: 300,
    });
    trendingContext = searchResponse.choices[0]?.message?.content ?? "";
  } catch {
    trendingContext = "";
  }

  // 3. Single Claude call — generates both evergreen and (if trending context) trending lanes
  const trendingInstruction = trendingContext
    ? `\nTrending context from the web right now:\n${trendingContext}\n\nGenerate BOTH an "evergreen" breakdown (timeless angle) AND a "trending" breakdown (tied to the current conversation above).`
    : `\nGenerate only the "evergreen" breakdown (timeless angle). Set "trending" to null.`;

  const userMessage = `Raw thought: ${rawInput}

${brandContext}
${voiceContext ? `\n${voiceContext}` : ""}
${trendingInstruction}

Return this exact JSON shape (no markdown fences):
{
  "evergreen": {
    "topic": "",
    "angle": "",
    "coreMessage": "",
    "whyItMatters": "",
    "archetype": "storytelling|lesson-learned|contrarian|data-insight|framework",
    "hooks": ["how-i hook under 140 chars", "contrarian hook under 140 chars", "number hook under 140 chars"],
    "hookTypes": ["how-i", "contrarian", "number"],
    "narrativeFlow": ["", "", "", ""]
  },
  "trending": null
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
    const stripped = text.text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    parsed2 = JSON.parse(stripped);
  } catch {
    res.status(500).json({ error: "AI returned invalid JSON" });
    return;
  }

  // Validate the two-lane response
  const laneSchema = StructureIdeaResponse;
  const validated = laneSchema.safeParse({ ...(parsed2 as object), hookUsage: Object.keys(hookUsage).length > 0 ? hookUsage : undefined });
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

  const { rawInput, objective, persona, tone, structure, selectedHook, includeCta } = parsed.data;
  const brandContext = buildBrandContext(objective, persona, tone);
  const voiceContext = await getUserBrandContext(req.user!.userId);

  const ctaInstruction = includeCta
    ? `\nCTA requirement: End the LinkedIn post with a specific, natural call-to-action that fits the topic (e.g. "Follow for more on [topic]", "Save this if you want to remember [key point]", or "Tag someone who needs to hear this"). Avoid generic CTAs like "What do you think?" or "Drop a comment". For the carousel, make the final slide a strong CTA slide that prompts a specific action.`
    : "";

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
${ctaInstruction}
Return this exact JSON shape (no markdown fences):
{
  "post": "",
  "carousel": [{"slide": 1, "title": "", "description": ""}],
  "visual": "",
  "infographic": {
    "headline": "Bold 6-10 word statement capturing the core message",
    "bullets": ["Key insight 1", "Key insight 2", "Key insight 3", "Key insight 4"]
  }
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
    const stripped = text.text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    parsed2 = JSON.parse(stripped);
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

const CarouselSlideSchema = z.array(z.object({
  slide: z.coerce.number(),
  title: z.string(),
  description: z.string(),
}));

router.post("/ai/refine", requireAuth, aiRateLimit, async (req, res): Promise<void> => {
  const parsed = RefineContentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { content, instruction, tab } = parsed.data;

  // Carousel: Claude returns a JSON array of slides, not a plain string.
  // Handle separately so the response shape matches what the frontend expects.
  if (tab === "carousel") {
    const carouselMessage = `You are refining a LinkedIn carousel. Here are the current slides as JSON:

${content}

Instruction: ${instruction}

Return ONLY the updated slides as a JSON array — no markdown fences, no extra text:
[{"slide": 1, "title": "...", "description": "..."}, ...]`;

    const carouselResp = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: "You are a LinkedIn carousel editor. Apply the instruction precisely to the slides. Return only a valid JSON array of slides — no markdown fences, no preamble.",
      messages: [{ role: "user", content: carouselMessage }],
    });

    const carouselText = carouselResp.content[0];
    if (carouselText.type !== "text") {
      res.status(500).json({ error: "Unexpected AI response type" });
      return;
    }

    const rawCarousel = carouselText.text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    let parsedSlides: unknown;
    try {
      parsedSlides = JSON.parse(rawCarousel);
    } catch {
      res.status(500).json({ error: "AI returned invalid JSON for carousel" });
      return;
    }

    const validatedSlides = CarouselSlideSchema.safeParse(parsedSlides);
    if (!validatedSlides.success) {
      res.status(500).json({ error: "AI carousel response did not match expected shape" });
      return;
    }

    // Wrap as a string so the frontend can JSON.parse it from data.content
    res.json({ content: JSON.stringify(validatedSlides.data) });
    return;
  }

  // Infographic: Claude returns { headline, bullets } JSON, not a plain string
  if (tab === "infographic") {
    const infoMessage = `You are refining a LinkedIn infographic card. Current data as JSON:

${content}

Instruction: ${instruction}

Return ONLY the updated infographic as JSON — no markdown fences, no extra text:
{"headline": "...", "bullets": ["...", "...", "..."]}`;

    const infoResp = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: "You are a LinkedIn content editor specialising in infographic cards. Apply the instruction precisely. Return only a valid JSON object with 'headline' (string) and 'bullets' (array of 3-5 strings). No markdown, no preamble.",
      messages: [{ role: "user", content: infoMessage }],
    });

    const infoText = infoResp.content[0];
    if (infoText.type !== "text") {
      res.status(500).json({ error: "Unexpected AI response type" });
      return;
    }

    const rawInfo = infoText.text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    let parsedInfo: unknown;
    try {
      parsedInfo = JSON.parse(rawInfo);
    } catch {
      res.status(500).json({ error: "AI returned invalid JSON for infographic" });
      return;
    }

    const validatedInfo = InfographicDataSchema.safeParse(parsedInfo);
    if (!validatedInfo.success) {
      res.status(500).json({ error: "AI infographic response did not match expected shape" });
      return;
    }

    res.json({ content: JSON.stringify(validatedInfo.data) });
    return;
  }

  // Post and visual: standard string-content refinement
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

  // Strip markdown fences Claude sometimes adds despite being told not to
  const raw = text.text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  let parsed2: unknown;
  try {
    parsed2 = JSON.parse(raw);
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
    .limit(50);

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
