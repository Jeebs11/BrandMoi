import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, and, desc, inArray } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db } from "@workspace/db";
import { preferencesTable, draftsTable, brandVoiceSignalsTable, performanceSignalsTable, voiceSuggestionsTable } from "@workspace/db";
import {
  GenerateContentBody,
  GenerateContentResponse,
  RefineContentBody,
  RefineContentResponse,
} from "@workspace/api-zod";
import {
  buildBrandContext,
  GENERATE_SYSTEM_PROMPT,
  AUDIENCE_OVERLAYS,
  FEELING_INSTRUCTIONS,
  REFINE_SYSTEM_PROMPT,
} from "../lib/ai-prompts.js";
import { requireAuth } from "../middleware/auth.js";
import { aiRateLimit } from "../middleware/rate-limit.js";
import { buildVoiceDNA, computeJaccard } from "../lib/voice-dna.js";

const InfographicDataSchema = z.object({
  headline: z.string(),
  bullets: z.array(z.string()),
});

const CarouselSlideSchema = z.array(z.object({
  slide: z.coerce.number(),
  title: z.string(),
  description: z.string(),
}));

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
      if (prefs.objective) voiceLines.push(`- Objective: ${prefs.objective}`);
      if (prefs.persona) voiceLines.push(`- Persona: ${prefs.persona}`);
      if (prefs.brandRole) voiceLines.push(`- Role: ${prefs.brandRole}`);
      if (prefs.brandAudience) voiceLines.push(`- Audience: ${prefs.brandAudience}`);
      if (prefs.brandBelief) voiceLines.push(`- Core belief: ${prefs.brandBelief}`);
      if (voiceLines.length > 0) parts.push("Creator context:\n" + voiceLines.join("\n"));
    }
  }

  if (dna) parts.push(dna);

  return parts.join("\n\n");
}

const NEW_FLOW_AUDIENCES = new Set(["Clients", "Peers", "Recruiters & Headhunters", "Investors", "My audience"]);

async function fetchNewsAnchorForGenerate(rawInput: string, audience: string | undefined): Promise<{ context: string; anchor: { headline: string; url?: string | null; sourceLine?: string | null } | null }> {
  if (!process.env.OPENAI_API_KEY) return { context: "", anchor: null };
  try {
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const audienceLine = audience ? ` relevant to a post aimed at ${audience}` : "";
    const searchQuery = `Find the single most relevant news article published in the last 7 days about: ${rawInput}${audienceLine}. Return the exact headline, the publication name, and a 2-3 sentence summary of the key finding.`;
    const searchResp = await openai.chat.completions.create({
      model: "gpt-4o-search-preview" as Parameters<typeof openai.chat.completions.create>[0]["model"],
      messages: [{ role: "user" as const, content: searchQuery }],
      max_tokens: 320,
    });
    const context = searchResp.choices[0]?.message?.content ?? "";
    let url: string | null = null;
    const annotations = (searchResp.choices[0]?.message as Record<string, unknown>)?.annotations;
    if (Array.isArray(annotations)) {
      for (const ann of annotations) {
        const a = ann as Record<string, unknown>;
        if (a.type === "url_citation") {
          const citation = a.url_citation as Record<string, unknown> | undefined;
          const u = citation?.url ?? a.url;
          if (typeof u === "string" && u.startsWith("http")) { url = u; break; }
        }
      }
    }
    const firstLine = context.split("\n").map(l => l.trim()).find(l => l.length > 10) ?? "";
    const headline = firstLine.replace(/^["\-*\d.)\s]+/, "").slice(0, 160) || "Recent development in your field";
    return { context, anchor: context ? { headline, url, sourceLine: "" } : null };
  } catch {
    return { context: "", anchor: null };
  }
}

router.post("/ai/generate", requireAuth, aiRateLimit, async (req, res): Promise<void> => {
  const parsed = GenerateContentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { rawInput, audience, feeling, tieToNews, objective, persona, tone, structure, selectedHook, postTone, newsUrl, extraInstruction } = parsed.data;
  const userId = req.user!.userId;
  const voiceContext = await getUserBrandContext(userId);
  const fallbackBrand = buildBrandContext(objective ?? "", persona ?? "", tone ?? "");

  const audienceLabel = audience && NEW_FLOW_AUDIENCES.has(audience) ? audience : (audience ?? "My audience");
  const feelingLabel = feeling ?? postTone ?? "Direct";
  const audienceOverlay = AUDIENCE_OVERLAYS[audienceLabel] ?? AUDIENCE_OVERLAYS["My audience"];
  const feelingOverlay = FEELING_INSTRUCTIONS[feelingLabel] ?? FEELING_INSTRUCTIONS["Direct"];

  let newsContext = "";
  let newsAnchor: { headline: string; url?: string | null; sourceLine?: string | null } | null = null;
  if (tieToNews) {
    const fetched = await fetchNewsAnchorForGenerate(rawInput, audienceLabel);
    newsContext = fetched.context;
    newsAnchor = fetched.anchor;
  } else if (newsUrl) {
    newsContext = `News URL the author is reacting to: ${newsUrl}`;
  }

  const legacyHints: string[] = [];
  if (structure?.topic) legacyHints.push(`Topic hint: ${structure.topic}`);
  if (structure?.angle) legacyHints.push(`Angle hint: ${structure.angle}`);
  if (selectedHook) legacyHints.push(`Suggested opening hook (use as-is or rework): ${selectedHook}`);

  const userMessage = [
    "## RAW THOUGHT (primary source — write from this, stay close to the words):",
    rawInput,
    "",
    "## WHO THIS PERSON IS:",
    voiceContext || fallbackBrand,
    "",
    "## AUDIENCE OVERLAY (mandatory):",
    audienceOverlay,
    "",
    "## FEELING OVERLAY (mandatory):",
    feelingOverlay,
    legacyHints.length ? `\n## OPTIONAL HINTS:\n${legacyHints.join("\n")}` : "",
    newsContext ? `\n## TODAY'S NEWS CONTEXT (weave the headline naturally — never paste a URL):\n${newsContext}` : "",
    extraInstruction ? `\n## EXTRA INSTRUCTION (apply on top of everything else, this is the user's refine ask):\n${extraInstruction}` : "",
    "",
    "Return ONLY valid JSON, no markdown fences, with the exact shape from the system prompt.",
  ].filter(Boolean).join("\n");

  try {
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

    let parsedJson: Record<string, unknown>;
    try {
      const stripped = text.text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      parsedJson = JSON.parse(stripped) as Record<string, unknown>;
    } catch {
      res.status(500).json({ error: "AI returned invalid JSON" });
      return;
    }

    if (newsAnchor && !parsedJson.newsAnchor) {
      parsedJson.newsAnchor = newsAnchor;
    }
    if (audienceLabel && !parsedJson.audience) parsedJson.audience = audienceLabel;
    if (feelingLabel && !parsedJson.feeling) parsedJson.feeling = feelingLabel;

    const validated = GenerateContentResponse.safeParse(parsedJson);
    if (!validated.success) {
      console.error("[ai-generate] schema mismatch", validated.error.message);
      res.status(500).json({ error: "AI response did not match expected shape" });
      return;
    }
    res.json(validated.data);
  } catch (err) {
    console.error("[ai-generate] failed", err);
    res.status(500).json({ error: "Failed to generate content" });
  }
});

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

const ALLOWED_VOICE_FIELDS = ["tone", "objective", "persona", "brandRole", "brandAudience", "brandBelief"] as const;
type AllowedVoiceField = typeof ALLOWED_VOICE_FIELDS[number];

function resonanceScore(s: { impressions: number; reactions: number; comments: number; reposts: number }): number {
  const w = s.reactions * 3 + s.comments * 5 + s.reposts * 4;
  if (s.impressions > 0) return Math.min(100, Math.round((w / s.impressions) * 1000));
  if (w === 0) return 0;
  return Math.min(100, Math.round(Math.log2(1 + w) * 12));
}

router.post("/ai/voice-insights", requireAuth, aiRateLimit, async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const [prefs] = await db.select().from(preferencesTable).where(eq(preferencesTable.userId, userId)).limit(1);

  // Check if pending suggestions already exist — skip generation if so
  const existingPending = await db
    .select({ id: voiceSuggestionsTable.id })
    .from(voiceSuggestionsTable)
    .where(and(eq(voiceSuggestionsTable.userId, userId), eq(voiceSuggestionsTable.status, "pending")))
    .limit(1);

  if (existingPending.length > 0) {
    const pending = await db
      .select()
      .from(voiceSuggestionsTable)
      .where(and(eq(voiceSuggestionsTable.userId, userId), eq(voiceSuggestionsTable.status, "pending")));
    res.json({ status: "ok", suggestions: pending });
    return;
  }

  const publishedDrafts = await db
    .select()
    .from(draftsTable)
    .where(and(eq(draftsTable.userId, userId), eq(draftsTable.status, "published")))
    .orderBy(desc(draftsTable.updatedAt));

  if (publishedDrafts.length === 0) {
    res.json({ status: "insufficient", count: 0, suggestions: [] });
    return;
  }

  const draftIds = publishedDrafts.map((d) => d.id);
  const signals = await db
    .select()
    .from(performanceSignalsTable)
    .where(inArray(performanceSignalsTable.draftId, draftIds));

  const perfMap = new Map(signals.map((s) => [s.draftId, s]));
  const scored = publishedDrafts
    .map((d) => {
      const p = perfMap.get(d.id);
      if (!p) return null;
      return { draft: d, resonance: resonanceScore(p), signal: p };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.resonance - a.resonance);

  if (scored.length < 5) {
    res.json({ status: "insufficient", count: scored.length, suggestions: [] });
    return;
  }

  const top = scored.slice(0, 10);
  const snippetMap = new Map(top.map((x) => [
    x.draft.id,
    (x.draft.postOutput ?? x.draft.rawInput ?? "").slice(0, 120).replace(/\n/g, " ").trim()
  ]));
  const topPostSummaries = top.map((x) => {
    const bd = x.draft.structuredBreakdown as { topic?: string; angle?: string; archetype?: string } | null;
    return `[id:${x.draft.id}] Topic: ${bd?.topic ?? "unknown"} | Angle: ${bd?.angle ?? "unknown"} | Tone: ${x.draft.tone} | Objective: ${x.draft.objective} | Resonance: ${x.resonance} | Snippet: "${snippetMap.get(x.draft.id) ?? ""}"`;
  }).join("\n");

  const currentProfile = `Current profile:
- tone: ${prefs?.tone ?? "unknown"}
- objective: ${prefs?.objective ?? "unknown"}
- persona: ${prefs?.persona ?? "unknown"}
- brandRole: ${prefs?.brandRole ?? ""}
- brandAudience: ${prefs?.brandAudience ?? ""}
- brandBelief: ${prefs?.brandBelief ?? ""}`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: `You are a LinkedIn brand strategist. Based on a creator's best-performing posts, identify 1-3 specific improvements to their brand profile settings. Return only valid JSON — no markdown fences.

Allowed fields to suggest: tone, objective, persona, brandRole, brandAudience, brandBelief.

JSON shape:
{"suggestions": [{"field": "tone", "suggestedValue": "...", "rationale": "1-2 sentences explaining why based on the data", "evidenceDraftIds": [123, 456]}]}

Rules:
- Only suggest fields where you see a clear pattern in the high-resonance posts.
- Keep rationale specific and data-driven (reference the actual post patterns).
- Maximum 3 suggestions.
- Never suggest a value identical to the current value.
- For "tone", only suggest values from: Executive, Direct, Story, Contrarian, Witty, Vulnerable, Playful, Snappy.
- For "objective", only suggest values from: Clients, Job, Authority, Documenting, Expert, Hiring.
- evidenceDraftIds: list 1-3 post IDs from the provided list that best support this suggestion.`,
    messages: [{
      role: "user",
      content: `${currentProfile}

Top performing posts (sorted by resonance):
${topPostSummaries}

Identify 1-3 brand voice improvements based on what's working. Return JSON only.`,
    }],
  });

  const t = message.content[0];
  if (t.type !== "text") {
    res.status(500).json({ error: "Unexpected AI response" });
    return;
  }

  let parsed: { suggestions: Array<{ field: string; suggestedValue: string; rationale: string; evidenceDraftIds?: number[] }> };
  try {
    const stripped = t.text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    parsed = JSON.parse(stripped) as typeof parsed;
  } catch {
    res.status(500).json({ error: "AI returned invalid JSON" });
    return;
  }

  const currentPrefsMap: Record<string, string> = {
    tone: prefs?.tone ?? "",
    objective: prefs?.objective ?? "",
    persona: prefs?.persona ?? "",
    brandRole: prefs?.brandRole ?? "",
    brandAudience: prefs?.brandAudience ?? "",
    brandBelief: prefs?.brandBelief ?? "",
  };

  const valid = (parsed.suggestions ?? [])
    .filter(
      (s) => ALLOWED_VOICE_FIELDS.includes(s.field as AllowedVoiceField) && s.suggestedValue && s.rationale
    )
    .filter(
      (s) => s.suggestedValue.trim().toLowerCase() !== (currentPrefsMap[s.field] ?? "").trim().toLowerCase()
    )
    .slice(0, 3);

  if (valid.length === 0) {
    res.json({ status: "ok", suggestions: [] });
    return;
  }

  const inserted = await db
    .insert(voiceSuggestionsTable)
    .values(valid.map((s) => {
      const ids = Array.isArray(s.evidenceDraftIds) ? s.evidenceDraftIds : [];
      const snippets = ids.map((id: number) => snippetMap.get(id) ?? "").filter(Boolean);
      return {
        userId,
        field: s.field,
        currentValue: currentPrefsMap[s.field] ?? "",
        suggestedValue: s.suggestedValue,
        rationale: s.rationale,
        evidenceDraftIds: ids,
        evidenceSnippets: snippets,
      };
    }))
    .returning();

  res.json({ status: "ok", suggestions: inserted });
});

router.post("/ai/post-diagnosis/:draftId", requireAuth, async (req, res): Promise<void> => {
  const draftId = Number(req.params.draftId);
  if (isNaN(draftId)) { res.status(400).json({ error: "Invalid draft ID" }); return; }

  const userId = req.user!.userId;

  const [draft] = await db
    .select()
    .from(draftsTable)
    .where(and(eq(draftsTable.id, draftId), eq(draftsTable.userId, userId)))
    .limit(1);

  if (!draft) { res.status(404).json({ error: "Draft not found" }); return; }

  const cached = draft.diagnosis as { sections?: unknown } | null;
  if (cached && cached.sections) {
    res.json({ diagnosis: cached });
    return;
  }

  const [[signal], [prefs]] = await Promise.all([
    db.select().from(performanceSignalsTable).where(eq(performanceSignalsTable.draftId, draftId)).limit(1),
    db.select().from(preferencesTable).where(eq(preferencesTable.userId, userId)).limit(1),
  ]);

  const bd = draft.structuredBreakdown as { topic?: string; angle?: string; archetype?: string; coreMessage?: string; visualType?: string } | null;
  const postText = draft.postOutput ?? draft.rawInput;
  const resonance = signal ? resonanceScore(signal) : null;
  const perfContext = signal
    ? `Performance: ${resonance} resonance score (${signal.impressions} impressions, ${signal.reactions} reactions, ${signal.comments} comments, ${signal.reposts} reposts)`
    : "No performance data yet";

  // Derive visual type robustly: check structuredBreakdown, draft.visualType column, and output fields
  const deriveVisualType = (): string => {
    if (bd?.visualType) return bd.visualType;
    if (draft.visualType) return draft.visualType;
    if (draft.carouselOutput) return "carousel";
    if (draft.visualOutput) return "image";
    const infographicMarkers = ["infographic", "data viz", "chart", "graph"];
    if (infographicMarkers.some((m) => postText?.toLowerCase().includes(m))) return "infographic";
    return "text-only";
  };
  const thisVisualType = deriveVisualType();

  // Visual type track-record analysis: benchmark against user's other high performers
  let visualBenchmarkContext = "";
  const allPublished = await db
    .select({ id: draftsTable.id, structuredBreakdown: draftsTable.structuredBreakdown, visualType: draftsTable.visualType, carouselOutput: draftsTable.carouselOutput, visualOutput: draftsTable.visualOutput })
    .from(draftsTable)
    .where(and(eq(draftsTable.userId, userId), eq(draftsTable.status, "published")));

  const siblingIds = allPublished
    .filter((d) => {
      if (d.id === draftId) return false;
      const sbd = d.structuredBreakdown as { visualType?: string } | null;
      const dvt = sbd?.visualType ?? d.visualType ?? (d.carouselOutput ? "carousel" : d.visualOutput ? "image" : "text-only");
      return dvt === thisVisualType;
    })
    .map((d) => d.id);

  if (siblingIds.length > 0) {
    const siblingSignals = await db
      .select()
      .from(performanceSignalsTable)
      .where(inArray(performanceSignalsTable.draftId, siblingIds));
    const siblingScores = siblingSignals.map((s) => resonanceScore(s)).filter((r) => r > 0);
    if (siblingScores.length > 0) {
      const avgScore = Math.round(siblingScores.reduce((a, b) => a + b, 0) / siblingScores.length);
      const highCount = siblingScores.filter((r) => r >= 60).length;
      visualBenchmarkContext = `\nVisual type "${thisVisualType}" benchmark: ${siblingScores.length} other post(s) with this visual type averaged ${avgScore} resonance (${highCount} high-performer${highCount !== 1 ? "s" : ""} ≥ 60). ${resonance !== null && resonance > avgScore ? "This post outperformed the average for its visual type." : resonance !== null ? "This post was below average for its visual type." : ""}`;
    }
  }

  // Voice profile context for tone alignment evaluation
  const voiceProfileContext = prefs
    ? `\nUser voice profile: Declared tone="${draft.tone}", Persona="${prefs.persona ?? "not set"}", Brand role="${prefs.brandRole ?? "not set"}", Audience="${prefs.brandAudience ?? "not set"}", Core belief="${prefs.brandBelief ?? "not set"}"`
    : "";

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 900,
    system: `You are a LinkedIn content analyst. Diagnose a post by analyzing each structural element. Return only valid JSON — no markdown fences.

JSON shape:
{
  "headline": "1 sentence summary of the single biggest success factor",
  "sections": {
    "hook": {"rating": 4, "analysis": "1-2 sentences on the opening line effectiveness (1=weak, 5=exceptional)"},
    "body": {"rating": 3, "analysis": "1-2 sentences on the body structure and flow (1=weak, 5=exceptional)"},
    "tone": {"rating": 5, "analysis": "1-2 sentences on tone alignment with the author's declared voice profile (1=weak, 5=exceptional)"},
    "cta": {"rating": 2, "analysis": "1-2 sentences on call-to-action effectiveness (1=weak, 5=exceptional; null rating if no CTA)"},
    "visual": {"rating": null, "analysis": "Note if visual element present/absent and its impact; null rating for text-only posts"}
  },
  "reasons": ["specific reason 1 under 20 words", "specific reason 2 under 20 words", "specific reason 3 under 20 words"],
  "replicateTip": "1 actionable tip to replicate this success in your next post"
}

Rules:
- Rating is 1-5 integer or null for visual if no visual.
- For the tone section: evaluate whether the post voice matches the user's declared brand profile (persona, role, audience, belief).
- Be specific to the actual post content and hook.
- If no performance data, note what the content suggests about performance.`,
    messages: [{
      role: "user",
      content: `Post topic: ${bd?.topic ?? "unknown"}
Angle: ${bd?.angle ?? "unknown"}
Tone: ${draft.tone} | Objective: ${draft.objective}
Visual type: ${thisVisualType}${voiceProfileContext}
${perfContext}${visualBenchmarkContext}

Post excerpt:
${postText?.slice(0, 800) ?? "(no text)"}

Diagnose this post. Return JSON only.`,
    }],
  });

  const t = message.content[0];
  if (t.type !== "text") { res.status(500).json({ error: "Unexpected AI response" }); return; }

  type DiagnosisSection = { rating: number | null; analysis: string };
  let diagnosis: {
    headline: string;
    sections?: {
      hook?: DiagnosisSection;
      body?: DiagnosisSection;
      tone?: DiagnosisSection;
      cta?: DiagnosisSection;
      visual?: DiagnosisSection;
    };
    reasons: string[];
    replicateTip: string;
    hookAnalysis?: string;
    toneMatch?: string;
  };
  try {
    const stripped = t.text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    diagnosis = JSON.parse(stripped) as typeof diagnosis;
  } catch {
    res.status(500).json({ error: "AI returned invalid JSON" });
    return;
  }

  await db.update(draftsTable).set({ diagnosis }).where(eq(draftsTable.id, draftId));

  res.json({ diagnosis });
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
