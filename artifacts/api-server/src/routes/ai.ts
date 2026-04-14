import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db } from "@workspace/db";
import { preferencesTable, draftsTable, brandVoiceSignalsTable } from "@workspace/db";
import {
  StructureIdeaBody,
  StrictStructureIdeaResponse,
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
  TEACHER_MODE_INSTRUCTION,
  REFINE_SYSTEM_PROMPT,
} from "../lib/ai-prompts.js";
import { requireAuth } from "../middleware/auth.js";
import { aiRateLimit } from "../middleware/rate-limit.js";
import { buildVoiceDNA, computeJaccard } from "../lib/voice-dna.js";

const router: IRouter = Router();

async function getUserBrandContext(userId: number): Promise<string> {
  const [[prefs], dna] = await Promise.all([
    db.select().from(preferencesTable).where(eq(preferencesTable.userId, userId)).limit(1),
    buildVoiceDNA(userId),
  ]);

  const parts: string[] = [];

  if (prefs) {
    const p = prefs as typeof prefs & { aboutMe?: string };
    const aboutMe = p.aboutMe?.trim() ?? "";
    if (aboutMe) {
      const lines = [`About this creator: ${aboutMe}`];
      if (prefs.brandBelief) lines.push(`Core belief: ${prefs.brandBelief}`);
      parts.push(lines.join("\n"));
    } else {
      const voiceLines: string[] = [];
      if (prefs.brandRole) voiceLines.push(`- Role: ${prefs.brandRole}`);
      if (prefs.brandAudience) voiceLines.push(`- Audience: ${prefs.brandAudience}`);
      if (prefs.brandBelief) voiceLines.push(`- Core belief: ${prefs.brandBelief}`);
      if (voiceLines.length > 0) parts.push("Creator context:\n" + voiceLines.join("\n"));
    }
  }

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
      const bd = draft.structuredBreakdown as {
        hookTypes?: string[];
        hooks?: (string | { text: string; type?: string })[];
      } | null;
      // Legacy format: flat hookTypes array
      if (bd?.hookTypes) {
        for (const ht of bd.hookTypes) {
          hookUsage[ht] = (hookUsage[ht] ?? 0) + 1;
        }
      }
      // New format: hooks[].type
      if (bd?.hooks) {
        for (const h of bd.hooks) {
          if (typeof h === "object" && h.type) {
            hookUsage[h.type] = (hookUsage[h.type] ?? 0) + 1;
          }
        }
      }
    }
  } catch {
    // non-critical — continue without usage data
  }

  // 2. Compute usedBefore for each hook via Jaccard similarity against last 50 selectedHooks
  const recentSelectedHooks: string[] = [];
  try {
    const recentWithHooks = await db
      .select({ selectedHook: draftsTable.selectedHook })
      .from(draftsTable)
      .where(eq(draftsTable.userId, userId))
      .orderBy(desc(draftsTable.createdAt))
      .limit(50);
    for (const d of recentWithHooks) {
      if (d.selectedHook) recentSelectedHooks.push(d.selectedHook);
    }
  } catch {
    // non-critical
  }

  // 3. Web search for trending context — targeted on persona + objective + topic
  let trendingContext = "";
  try {
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const searchQuery = `Recent news, studies, or developments relevant to "${rawInput}" for a ${persona} focused on ${objective}. Extract 1-2 specific headline + brief snippet (date if known).`;
    const searchResponse = await openai.chat.completions.create({
      model: "gpt-4o-search-preview" as Parameters<typeof openai.chat.completions.create>[0]["model"],
      messages: [{ role: "user" as const, content: searchQuery }],
      max_tokens: 300,
    });
    trendingContext = searchResponse.choices[0]?.message?.content ?? "";
  } catch {
    trendingContext = "";
  }

  // 4. Single Claude call — ALWAYS generates both lanes; trending is synthesized if no real news
  const trendingInstruction = trendingContext
    ? `\nRecent context from the web:\n${trendingContext}\n\nGenerate BOTH an "evergreen" breakdown (timeless angle) AND a "trending" breakdown tied to the recent context above. For each trending hook include a "sourceLine" field (≤20 words naming the specific news/study). Trending sourceLine should reference the actual event/study from the web context.`
    : `\nNo real-time news was found. Generate BOTH an "evergreen" breakdown AND a "trending" breakdown based on a plausible emerging discussion or recent development in the user's field (synthesized — not invented facts). For each trending hook, set "sourceLine" to "Based on recent discussions in your field."`;

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
    "hooks": [
      { "text": "how-i hook under 140 chars", "type": "how-i" },
      { "text": "contrarian hook under 140 chars", "type": "contrarian" },
      { "text": "number hook under 140 chars", "type": "number" },
      { "text": "question hook under 140 chars ending with ?", "type": "question" },
      { "text": "scene-setter hook under 140 chars", "type": "scene-setter" },
      { "text": "prediction hook under 140 chars", "type": "prediction" },
      { "text": "analogy hook under 140 chars", "type": "analogy" }
    ],
    "narrativeFlow": ["", "", "", ""]
  },
  "trending": {
    "topic": "",
    "angle": "",
    "coreMessage": "",
    "whyItMatters": "",
    "archetype": "storytelling|lesson-learned|contrarian|data-insight|framework",
    "hooks": [
      { "text": "hook under 140 chars", "type": "how-i", "sourceLine": "One sentence ≤20 words naming the news/discussion." },
      { "text": "hook under 140 chars", "type": "contrarian", "sourceLine": "One sentence ≤20 words naming the news/discussion." }
    ],
    "narrativeFlow": ["", "", "", ""]
  }
}

IMPORTANT: "trending" must NEVER be null. Always generate the trending lane. If no real news exists, synthesise a plausible emerging discussion and set each trending hook's "sourceLine" to "Based on recent discussions in your field."
Evergreen hooks must NOT have a "sourceLine" field.`;

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

  // Enforce strict two-lane schema. If trending is missing/null, synthesize a fallback lane.
  const rawParsed = parsed2 as Record<string, unknown>;
  if (!rawParsed.trending || typeof rawParsed.trending !== "object") {
    const evergreen = rawParsed.evergreen as Record<string, unknown> | undefined;
    const evergreenHooks = evergreen && Array.isArray((evergreen as Record<string, unknown>).hooks)
      ? (evergreen as Record<string, unknown[]>).hooks as Array<{ text: string; type?: string }>
      : [];
    rawParsed.trending = {
      topic: evergreen?.topic ?? "",
      angle: "Timely perspective tied to recent conversations",
      coreMessage: evergreen?.coreMessage ?? "",
      whyItMatters: evergreen?.whyItMatters ?? "",
      archetype: evergreen?.archetype ?? "lesson-learned",
      hooks: [
        { text: evergreenHooks[0]?.text ?? "What the latest conversations in your field reveal", type: evergreenHooks[0]?.type ?? "how-i", sourceLine: "Based on recent discussions in your field." },
        { text: evergreenHooks[1]?.text ?? "The emerging shift that most professionals are ignoring", type: "contrarian", sourceLine: "Based on recent discussions in your field." },
      ],
      narrativeFlow: evergreen?.narrativeFlow ?? [],
    };
  }
  // Ensure all trending hooks have a sourceLine, and pad to at least 2 hooks
  if (Array.isArray((rawParsed.trending as Record<string, unknown>).hooks)) {
    const trendingHooks = ((rawParsed.trending as Record<string, unknown[]>).hooks as Array<Record<string, unknown>>).map(h => ({
      ...h,
      sourceLine: h.sourceLine && String(h.sourceLine).trim() ? h.sourceLine : "Based on recent discussions in your field.",
    }));
    if (trendingHooks.length < 2) {
      const evergreenHooks = Array.isArray((rawParsed.evergreen as Record<string, unknown[]>)?.hooks)
        ? (rawParsed.evergreen as Record<string, unknown[]>).hooks as Array<Record<string, unknown>>
        : [];
      while (trendingHooks.length < 2) {
        const fallbackIdx = trendingHooks.length;
        trendingHooks.push({
          text: (evergreenHooks[fallbackIdx] as Record<string, unknown>)?.text ?? "The emerging shift most professionals are ignoring",
          type: fallbackIdx === 0 ? "how-i" : "contrarian",
          sourceLine: "Based on recent discussions in your field.",
        });
      }
    }
    (rawParsed.trending as Record<string, unknown[]>).hooks = trendingHooks;
  }
  const payload = { ...rawParsed, hookUsage: Object.keys(hookUsage).length > 0 ? hookUsage : undefined };
  const validated = StrictStructureIdeaResponse.safeParse(payload);
  if (!validated.success) {
    res.status(500).json({ error: "AI response did not match expected shape" });
    return;
  }

  // Inject usedBefore flags via Jaccard similarity against recently selected hook texts
  const JACCARD_THRESHOLD = 0.6;
  const tagUsedBefore = <T extends { text: string; usedBefore?: boolean }>(hooks: T[]): T[] =>
    hooks.map(h => ({
      ...h,
      usedBefore: recentSelectedHooks.some(prev => computeJaccard(h.text, prev) >= JACCARD_THRESHOLD),
    }));

  const result = { ...validated.data };
  result.evergreen = { ...result.evergreen, hooks: tagUsedBefore(result.evergreen.hooks) };
  if (result.trending) {
    result.trending = { ...result.trending, hooks: tagUsedBefore(result.trending.hooks) };
  }

  res.json(result);
});

router.post("/ai/generate", requireAuth, aiRateLimit, async (req, res): Promise<void> => {
  const parsed = GenerateContentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { rawInput, objective, persona, tone, structure, selectedHook, includeCta, postTone } = parsed.data;
  // teacherMode takes precedence; when both arrive, teacher mode wins
  const teacherMode = parsed.data.teacherMode ?? false;
  const storyMode = !teacherMode && (parsed.data.storyMode ?? false);
  const brandContext = buildBrandContext(objective, persona, tone);
  const voiceContext = await getUserBrandContext(req.user!.userId);

  const TONE_INSTRUCTIONS: Record<string, string> = {
    "Direct":     "Write with authority and precision. Short sentences. No hedging. Every word earns its place. No filler phrases or wind-ups.",
    "Story":      "Open with a vivid scene that drops the reader into a specific moment. Build tension before the insight lands. Write like you're talking to one person who needs this.",
    "Contrarian": "Challenge the dominant assumption head-on in the first line. Use 'Everyone says X. Here's what they're missing.' structure. Provide the evidence or argument that flips the conventional take.",
    "Witty":      "Write with dry wit and self-awareness — like someone who's been in the trenches long enough to laugh at the absurdity of it. Clever without being cynical. Warm without being soft.",
    "Vulnerable": "Write like you're sharing something you learned the hard way. Specific, honest, emotionally open. No performance of vulnerability — just the real observation or mistake.",
    "Snappy":     "Write a punchy, tight post under 150 words. 3–5 short lines maximum. Zero buildup or warm-up. Lead with the sharpest possible statement. No filler, no lists, no explanatory padding. Stop when the point is made.",
    "Executive":  "Write with the measured authority of a senior leader addressing a room that already respects them. Precise, considered language — no slang, no shortcuts, no rhetorical tricks. Every sentence feels deliberate. The tone is warm and human, never cold or corporate. Think polished keynote, not press release.",
    "Playful":    "Write with light, warm humour — the kind that makes someone smile and feel like they're talking to a real person. Wordplay is welcome. Gentle self-awareness about industry absurdity is great. Never cringe, never over-explain the joke. Stays clearly professional but lets personality shine through. Think: the smartest person in the room who also happens to be fun at dinner.",
  };
  const toneInstruction = postTone && TONE_INSTRUCTIONS[postTone]
    ? `\n\n## TONE OVERRIDE FOR THIS POST\n${TONE_INSTRUCTIONS[postTone]}`
    : "";

  const ctaInstruction = includeCta
    ? `\nCTA requirement: End the LinkedIn post with a specific, natural call-to-action that fits the topic (e.g. "Follow for more on [topic]", "Save this if you want to remember [key point]", or "Tag someone who needs to hear this"). Avoid generic CTAs like "What do you think?" or "Drop a comment". For the carousel, make the final slide a strong CTA slide that prompts a specific action.`
    : "";

  const storyModeInstruction = storyMode
    ? `\nSTORY MODE IS ACTIVE. Follow the STORY MODE POST RULES and STORY MODE CAROUSEL RULES from the system prompt exactly. The post must use the 5-beat narrative arc (Scene → Tension → Turn → Lesson → CTA). The carousel must use exactly 5 chapter-format slides (Opening scene → Struggle → Turn → Lesson → CTA). Do not use numbered slide titles.`
    : "";

  const userMessage = `Your job is to write LinkedIn content that sounds exactly like the person below — their rhythm, their phrasing, their specific way of seeing the world. Stay as close to their raw thought as possible. Do NOT paraphrase their voice into polished LinkedIn language. Keep it human and specific.

## THE RAW THOUGHT (primary source — write from this):
${rawInput}

${voiceContext ? `## WHO THIS PERSON IS:\n${voiceContext}` : brandContext}

## CONTENT STRUCTURE (context to guide the angle — the raw thought is still the primary source):
- Start with this hook: ${selectedHook}
- Topic: ${structure.topic}
- Angle: ${structure.angle}
- Core message: ${structure.coreMessage}
- Why it matters: ${structure.whyItMatters}
- Narrative arc: ${structure.narrativeFlow.join(" → ")}
${ctaInstruction}${storyModeInstruction}
Return this exact JSON shape (no markdown fences):
{
  "post": "",
  "shortPost": "",
  "carousel": [{"slide": 1, "title": "", "description": ""}],
  "visual": "",
  "infographic": {
    "headline": "Bold 6-10 word statement capturing the core message",
    "bullets": ["Key insight 1", "Key insight 2", "Key insight 3", "Key insight 4"]
  }
}`;

  const generateSystemPrompt = [
    GENERATE_SYSTEM_PROMPT,
    toneInstruction || "",
    teacherMode ? TEACHER_MODE_INSTRUCTION : "",
  ].filter(Boolean).join("");

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: generateSystemPrompt,
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

const HOOK_TYPE_DESCRIPTIONS: Record<string, string> = {
  "how-i":        'Personal "How I [achieved X]" opener. Must NOT start with "I".',
  "contrarian":   'Bold claim challenging the obvious take. Must NOT start with "I" or "You".',
  "number":       'Leads with a specific number, stat, or timeframe.',
  "question":     'A specific uncomfortable question. Must end with "?".',
  "scene-setter": 'Drops the reader into a specific micro-moment (time + place + action).',
  "prediction":   'Bold future claim. Must start with a timeframe like "By [year]" or "Within".',
  "analogy":      'A surprising comparison or metaphor reframing the topic.',
};

const GenerateHooksBody = z.object({
  rawInput: z.string().min(1),
  topic: z.string().min(1),
  angle: z.string().min(1),
  hookTypes: z.array(z.string()).min(1).max(7),
});

router.post("/ai/hooks", requireAuth, aiRateLimit, async (req, res) => {
  const parsed = GenerateHooksBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { rawInput, topic, angle, hookTypes } = parsed.data;

  const validTypes = hookTypes.filter(t => HOOK_TYPE_DESCRIPTIONS[t]);
  const hookInstructions = validTypes
    .map((t, i) => `${i + 1}. type="${t}" — ${HOOK_TYPE_DESCRIPTIONS[t]}`)
    .join("\n");

  const userMessage = `Topic: ${topic}
Angle: ${angle}
Raw thought: ${rawInput}

Generate exactly ${validTypes.length} hooks, one per type listed below. Each hook must be under 140 characters and be a strong LinkedIn opener.

${hookInstructions}

Return only valid JSON, no markdown:
{"hooks":[{"text":"...","type":"..."},...]}`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system:
        "You are an expert LinkedIn hook writer. Generate only the opening line for a LinkedIn post — no body, no hashtags. Every hook must be under 140 characters. Return only valid JSON with no markdown fences.",
      messages: [{ role: "user", content: userMessage }],
    });

    const t = message.content[0];
    if (t.type !== "text") {
      res.status(500).json({ error: "Unexpected AI response type" });
      return;
    }

    const cleaned = t.text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const result = JSON.parse(cleaned) as { hooks: Array<{ text: string; type: string }> };
    res.json({ hooks: result.hooks ?? [] });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate hooks" });
  }
});

export default router;
