import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db } from "@workspace/db";
import { preferencesTable, draftsTable, stressTestScoresTable, performanceSignalsTable, ideaFeedbackTable, voiceSuggestionsTable, aiUsageTable, seriesTable, topicsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth.js";
import { aiRateLimit } from "../middleware/rate-limit.js";
import { fetchMomentumNewsAnchor } from "../lib/momentum.js";
import { buildLearnedPatterns, resonanceScore } from "../lib/learning.js";
import { buildCanonicalBrandContext } from "../lib/brand-context.js";
import { checkAndIncrementDailyLimit } from "../lib/daily-limit.js";
import { isDemoUser, demoDelay, getDemoBrief, getDemoIdeas, getDemoDare } from "../lib/demo-content.js";
import { respondAiError } from "../lib/ai-errors.js";
import {
  computeEditPercent,
  computeWordChangeSummary,
  runAuthenticityCheck,
  type AuthenticityCheck,
} from "../lib/authenticity-check.js";

// Legacy-objective → modern-audience fallback for drafts saved before the
// audience taxonomy existed. Mirrors momentum.ts's deriveAudience.
function deriveAudienceFallback(objective: unknown): string {
  if (typeof objective !== "string") return "My audience";
  const o = objective.toLowerCase();
  if (o.includes("client")) return "Clients";
  if (o === "hiring") return "My audience";
  if (o.includes("job") || o.includes("recruit")) return "Recruiters & Headhunters";
  if (o.includes("invest")) return "Investors";
  if (o.includes("authority") || o.includes("expert") || o.includes("peer")) return "Peers";
  return "My audience";
}

function parseJson(text: string): unknown {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Some models prepend/append a sentence around the JSON. Find the first
    // complete object or array while respecting quoted braces and brackets.
    // Using lastIndexOf("}") is unsafe when the model returns an array or
    // includes a brace inside a quoted string.
    const objectStart = cleaned.indexOf("{");
    const arrayStart = cleaned.indexOf("[");
    const startCandidates = [objectStart, arrayStart].filter((index) => index >= 0);
    if (startCandidates.length === 0) throw new Error("No JSON object or array found in AI response");

    const start = Math.min(...startCandidates);
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < cleaned.length; i += 1) {
      const char = cleaned[i];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === "\"") {
          inString = false;
        }
        continue;
      }
      if (char === "\"") {
        inString = true;
      } else if (char === "{" || char === "[") {
        depth += 1;
      } else if (char === "}" || char === "]") {
        depth -= 1;
        if (depth === 0) {
          return JSON.parse(cleaned.slice(start, i + 1));
        }
      }
    }

    throw new Error("Incomplete JSON in AI response");
  }
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

  const ideaFeedback = await db
    .select()
    .from(ideaFeedbackTable)
    .where(eq(ideaFeedbackTable.userId, userId))
    .orderBy(desc(ideaFeedbackTable.createdAt))
    .limit(40);

  const brandContext = await buildCanonicalBrandContext(userId);
  return { prefs, recentDrafts, dna: brandContext.context, ideaFeedback };
}

router.get("/agent/brief", requireAuth, aiRateLimit, async (req, res): Promise<void> => {
  if (isDemoUser(req.user!.email)) {
    await demoDelay();
    res.json(getDemoBrief());
    return;
  }
  try {
    const { prefs, recentDrafts, dna, ideaFeedback: _ideaFeedback } = await getUserAgentContext(req.user!.userId);

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

    // Audience mix (modern taxonomy) over the same recent window — used to
    // bias brand-angle generation toward audiences the user hasn't been
    // posting for lately (e.g. they've been all-Peers, nudge a Recruiters
    // angle). No extra DB call or AI call — reuses recentDrafts already fetched.
    const audienceCounts: Record<string, number> = {};
    for (const d of recentDrafts.slice(0, 10)) {
      const sb = d.structuredBreakdown as { audience?: string } | null;
      const aud = (typeof sb?.audience === "string" && sb.audience) || deriveAudienceFallback(d.objective);
      audienceCounts[aud] = (audienceCounts[aud] ?? 0) + 1;
    }
    const ALL_AUDIENCES = ["Clients", "Peers", "Recruiters & Headhunters", "Investors", "My audience"];
    // Every audience gets its own angle every time (see prompt below); this
    // list is just used to flag which ones deserve extra sharpness because
    // the user hasn't been posting there.
    const underusedAudiences = ALL_AUDIENCES.filter((a) => !audienceCounts[a]);

    // Series-in-progress nudge: one cheap extra query (few rows, indexed by
    // user+status), then reuse recentDrafts (already fetched) to count parts
    // written per series — no AI call involved in computing this.
    const activeSeries = await db
      .select()
      .from(seriesTable)
      .where(and(eq(seriesTable.userId, req.user!.userId), eq(seriesTable.status, "active")));
    let seriesNudge: { seriesId: number; title: string; nextPart: number; plannedParts: number | null } | null = null;
    if (activeSeries.length > 0) {
      const partsBySeriesId: Record<number, number> = {};
      for (const d of recentDrafts) {
        if (d.seriesId) partsBySeriesId[d.seriesId] = (partsBySeriesId[d.seriesId] ?? 0) + 1;
      }
      // Endless series (plannedParts null) always have a "next part" to nudge toward.
      const needingNext = activeSeries.find((s) => s.plannedParts === null || (partsBySeriesId[s.id] ?? 0) < s.plannedParts);
      if (needingNext) {
        const written = partsBySeriesId[needingNext.id] ?? 0;
        seriesNudge = { seriesId: needingNext.id, title: needingNext.title, nextPart: written + 1, plannedParts: needingNext.plannedParts };
      }
    }

    // Web search for current news relevant to the user's role and audience
    let newsContext = "";
    let newsHeadline = "";
    let newsSourceLine = "";
    let newsUrl = "";
    let newsPublishedAt = "";
    let newsSourceDomain = "";
    let newsDescription = "";
    let trendingTopics: Array<{ headline: string; sourceLine: string }> = [];
    try {
      const news = await fetchMomentumNewsAnchor(req.user!.userId);
      newsContext = news.context;
      newsUrl = news.url ?? "";
    } catch {
      newsContext = "";
    }

    const ideaFeedback = _ideaFeedback;
    const likedIdeas = ideaFeedback.filter((f) => f.signal === "like").map((f) => f.ideaText);
    const dislikedIdeas = ideaFeedback.filter((f) => f.signal === "dislike").map((f) => f.ideaText);
    const pillars = Array.isArray(prefs?.contentPillars) ? (prefs.contentPillars as string[]) : [];

    const userMessage = [
      prefs?.brandRole ? `Role: ${prefs.brandRole}` : "",
      prefs?.brandAudience ? `Audience: ${prefs.brandAudience}` : "",
      prefs?.brandBelief ? `Core belief: ${prefs.brandBelief}` : "",
      pillars.length > 0 ? `Content pillars: ${pillars.join(", ")}` : "",
      dna ? `\nWriting DNA:\n${dna}` : "",
      recentTopics ? `\nRecent topics: ${recentTopics}` : "",
      daysSinceLast !== null ? `Days since last draft: ${daysSinceLast}` : "No drafts yet",
      underused.length > 0 ? `Underused objectives: ${underused.join(", ")}` : "",
      underusedAudiences.length > 0 ? `Audiences not covered in recent posts — make these angles especially sharp since the user needs a reason to post there: ${underusedAudiences.join(", ")}` : "",
      `Total drafts: ${recentDrafts.length}`,
      likedIdeas.length > 0 ? `\nIdeas this user has liked (generate more in this direction):\n${likedIdeas.slice(0, 10).map((t) => `- ${t}`).join("\n")}` : "",
      dislikedIdeas.length > 0 ? `\nIdeas this user has disliked (avoid these angles and themes):\n${dislikedIdeas.slice(0, 10).map((t) => `- ${t}`).join("\n")}` : "",
      newsContext ? `\nToday's news context (use this to make angles timely):\n${newsContext}` : "",
      seriesNudge ? `\nActive series "${seriesNudge.title}" needs part ${seriesNudge.nextPart}${seriesNudge.plannedParts ? ` of ${seriesNudge.plannedParts}` : ""} — factor this into the insight if it fits naturally.` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 750,
      system: `You are an AI creative director for a LinkedIn creator. Generate a personalized daily brief — like a smart chief-of-staff, not a motivational poster.

Return JSON only (no markdown):
{
  "headline": "One sharp directive about what to focus on today (max 12 words)",
  "insight": "One specific observation about their content gap or momentum (max 25 words)",
  "angles": [
    {"angle": "specific post angle for Clients (max 10 words)", "audience": "Clients"},
    {"angle": "specific post angle for Peers (max 10 words)", "audience": "Peers"},
    {"angle": "specific post angle for Recruiters & Headhunters (max 10 words)", "audience": "Recruiters & Headhunters"},
    {"angle": "specific post angle for Investors (max 10 words)", "audience": "Investors"},
    {"angle": "specific post angle for My audience (max 10 words)", "audience": "My audience"}
  ],
  "teachAngles": ["FAQ or analogy seed 1 (max 12 words)", "FAQ or analogy seed 2 (max 12 words)", "FAQ or analogy seed 3 (max 12 words)"],
  "newsHeadline": "If today's news context was provided, extract the single most relevant news headline verbatim or summarised in max 12 words. Otherwise empty string.",
  "newsSourceLine": "If today's news context was provided, write one sentence max 20 words saying what this news means for their field. Otherwise empty string.",
  "newsPublishedAt": "If today's news context includes a date or time (e.g. '2 hours ago', 'April 3', 'yesterday'), convert it to an ISO 8601 datetime string (e.g. '2026-04-03T10:00:00Z'). Use today's date as the reference. If no date mentioned, empty string.",
  "newsSourceDomain": "If today's news context includes a publication name (e.g. 'Reuters', 'TechCrunch', 'Harvard Business Review'), extract it as a clean short name. Otherwise empty string.",
  "newsDescription": "If today's news context was provided, write 2-3 sentences (max 60 words) summarising the key finding or development — this will be used as context for post angle generation. Otherwise empty string.",
  "trendingTopics": "If today's news context includes multiple distinct articles, return up to 3 as an array of {headline, sourceLine} — headline is the article's headline (max 12 words), sourceLine is one sentence (max 20 words) on what it means for their field. Otherwise empty array."
}

Rules:
- headline must be specific to their actual brand or gap, not generic
- insight must reference something concrete from their history or underused objectives
- angles are real post ideas they could write today
- return EXACTLY 5 angles, one for EACH of these 5 audiences, in this order: Clients, Peers, Recruiters & Headhunters, Investors, My audience. Never skip one, never give two angles to the same audience.
- each angle must genuinely fit its tagged audience — e.g. the Recruiters & Headhunters angle should read as evidence of capability/judgment (an outcome, a hard call made well), NOT a craft debate; the Peers angle can be more insider/contrarian; the Investors angle should reframe a market or show pattern-matching; the Clients angle should demonstrate you understand their problem; the My audience angle can be the most personal/direct one
- if news context is available, let it inspire whichever of the 5 angles it fits best — don't force it
- teachAngles are "explain via analogy" or FAQ ideas grounded in their exact industry/role. Each should be a short prompt like "Why [common misconception] — an analogy for [audience]" or "The real reason [industry thing] fails (explained simply)". Never generic — always tied to their specific brand context.
- tone: direct, peer-level, no fluff, no "great job"
- newsHeadline, newsSourceLine, newsPublishedAt, newsSourceDomain, newsDescription, trendingTopics must only be set when real news context was provided — not invented`,
      messages: [{ role: "user", content: userMessage }],
    });

    const block = msg.content[0];
    if (block.type !== "text") { res.status(500).json({ error: "AI error" }); return; }
    try {
      const parsed = parseJson(block.text) as Record<string, unknown>;
      newsHeadline = typeof parsed.newsHeadline === "string" ? parsed.newsHeadline.trim() : "";
      newsSourceLine = typeof parsed.newsSourceLine === "string" ? parsed.newsSourceLine.trim() : "";
      newsPublishedAt = typeof parsed.newsPublishedAt === "string" ? parsed.newsPublishedAt.trim() : "";
      newsSourceDomain = typeof parsed.newsSourceDomain === "string" ? parsed.newsSourceDomain.trim() : "";
      newsDescription = typeof parsed.newsDescription === "string" ? parsed.newsDescription.trim() : "";
      trendingTopics = Array.isArray(parsed.trendingTopics)
        ? (parsed.trendingTopics as unknown[])
            .map((t) => {
              if (t && typeof t === "object" && typeof (t as { headline?: unknown }).headline === "string") {
                const obj = t as { headline: string; sourceLine?: unknown };
                return { headline: obj.headline.trim(), sourceLine: typeof obj.sourceLine === "string" ? obj.sourceLine.trim() : "" };
              }
              return null;
            })
            .filter((t): t is { headline: string; sourceLine: string } => t !== null && t.headline.length > 0)
            .slice(0, 3)
        : [];
      const role = prefs?.brandRole ?? "professional";
      const audience = prefs?.brandAudience ?? "your audience";
      const FALLBACK_TEACH_ANGLES = [
        `Explain a core ${role} concept via analogy for ${audience}`,
        `Debunk a common misconception in ${role} — explained simply`,
        `Simplify the most complex thing about ${role} for ${audience}`,
      ];
      const rawTeachAngles: string[] = Array.isArray(parsed.teachAngles)
        ? (parsed.teachAngles as unknown[]).filter((a): a is string => typeof a === "string").slice(0, 3)
        : [];
      const teachAngles: string[] = [
        rawTeachAngles[0] ?? FALLBACK_TEACH_ANGLES[0],
        rawTeachAngles[1] ?? FALLBACK_TEACH_ANGLES[1],
        rawTeachAngles[2] ?? FALLBACK_TEACH_ANGLES[2],
      ];
      const headline = typeof parsed.headline === "string" && parsed.headline.trim()
        ? parsed.headline.trim()
        : `What should you post today as a ${role}?`;
      const insight = typeof parsed.insight === "string" && parsed.insight.trim()
        ? parsed.insight.trim()
        : `Focus on your most underused content angle to build authority faster.`;
      // Angles now come tagged with a target audience. Accept the new
      // {angle, audience} shape; if the model (or an old cached shape)
      // returns a bare string, default it to "My audience" rather than drop it.
      const VALID_AUDIENCES = new Set(ALL_AUDIENCES);
      const rawAngles: Array<{ angle: string; audience: string }> = Array.isArray(parsed.angles)
        ? (parsed.angles as unknown[])
            .map((a) => {
              if (typeof a === "string") return { angle: a, audience: "My audience" };
              if (a && typeof a === "object" && typeof (a as { angle?: unknown }).angle === "string") {
                const obj = a as { angle: string; audience?: unknown };
                const audience = typeof obj.audience === "string" && VALID_AUDIENCES.has(obj.audience) ? obj.audience : "My audience";
                return { angle: obj.angle, audience };
              }
              return null;
            })
            .filter((a): a is { angle: string; audience: string } => a !== null)
        : [];
      // Guarantee exactly one angle per audience, in ALL_AUDIENCES order —
      // fill any the model missed or duplicated from a per-audience fallback.
      const FALLBACK_BY_AUDIENCE: Record<string, string> = {
        "Clients": `Show a prospective client how you think about their exact problem`,
        "Peers": `Challenge the most common assumption in your field`,
        "Recruiters & Headhunters": `Share a hard call you made under pressure at work`,
        "Investors": `Share a non-consensus read on where your market is heading`,
        "My audience": `Teach one thing you wish you knew earlier in your career`,
      };
      const angles: Array<{ angle: string; audience: string }> = ALL_AUDIENCES.map(
        (aud) => rawAngles.find((a) => a.audience === aud) ?? { angle: FALLBACK_BY_AUDIENCE[aud], audience: aud }
      );
      res.json({
        headline,
        insight,
        angles,
        teachAngles,
        ...(newsHeadline ? {
          newsHeadline,
          newsSourceLine,
          ...(newsUrl ? { newsUrl } : {}),
          ...(newsPublishedAt ? { newsPublishedAt } : {}),
          ...(newsSourceDomain ? { newsSourceDomain } : {}),
          ...(newsDescription ? { newsDescription } : {}),
          ...(trendingTopics.length > 0 ? { trendingTopics } : {}),
        } : {}),
        ...(seriesNudge ? { seriesNudge } : {}),
      });
    } catch {
      res.status(500).json({ error: "Invalid AI response" });
    }
  } catch (err) {
    console.error("[agent-brief]", err);
    // Surface Anthropic rate limits as 429 so the UI can say "try again in a
    // minute" instead of a generic failure.
    const status = (err as { status?: number })?.status;
    if (status === 429 || status === 529) {
      res.status(429).json({ error: "The AI is at its rate limit right now — try again in a minute or two." });
      return;
    }
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
    respondAiError(res, err, "Failed to generate coaching note");
  }
});

const NewsAnglesBody = z.object({
  newsHeadline: z.string().min(5).max(300),
  newsSourceLine: z.string().max(300).optional(),
  newsUrl: z.string().url().optional(),
  newsDescription: z.string().max(500).optional(),
});

router.post("/agent/news-angles", requireAuth, aiRateLimit, async (req, res): Promise<void> => {
  const parsed = NewsAnglesBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "newsHeadline is required." }); return; }

  try {
    const { prefs, dna } = await getUserAgentContext(req.user!.userId);

    const userMessage = [
      `News headline: "${parsed.data.newsHeadline}"`,
      parsed.data.newsSourceLine ? `What it means: "${parsed.data.newsSourceLine}"` : "",
      parsed.data.newsDescription ? `Article summary: "${parsed.data.newsDescription}"` : "",
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
    respondAiError(res, err, "Failed to generate news angles");
  }
});

const ALL_HOOK_TYPES = [
  { key: "how-i",        instruction: 'A personal "How I [achieved X]" opener. Doesn\'t start with "I". Implies you\'ve done it.' },
  { key: "contrarian",   instruction: 'A bold claim challenging conventional wisdom. No question mark. Doesn\'t start with "I" or "You".' },
  { key: "number",       instruction: 'Starts with a specific number, percentage, or timeframe. E.g. "After 3 years…" or "47% of…".' },
  { key: "question",     instruction: 'A specific, uncomfortable question that makes the reader stop and reconsider. Must end with "?".' },
  { key: "scene-setter", instruction: 'Drops the reader into a specific moment using concrete sensory detail. Past or present tense. No question mark.' },
  { key: "prediction",   instruction: 'A bold, specific claim about what will happen. Must start with a timeframe or "By [year]".' },
  { key: "analogy",      instruction: 'Uses a surprising comparison or metaphor to reframe the topic in an unexpected way.' },
  { key: "story",        instruction: 'Opens with a vivid first-person scene or specific moment. Past tense. Drops the reader into the action immediately — no preamble, no "I want to tell you about".' },
  { key: "picture-this", instruction: 'Starts with "Picture this:" followed by an immersive scenario or analogy that makes the reader visualise something very specific and relatable.' },
];

const HookAlternativesBody = z.object({
  draftText: z.string().min(20).max(4000),
  tone: z.string().optional(),
  hookTypes: z.array(z.string()).optional(),
});

router.post("/agent/hook-alternatives", requireAuth, aiRateLimit, async (req, res): Promise<void> => {
  const parsed = HookAlternativesBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "draftText is required." }); return; }

  try {
    const { draftText, tone, hookTypes } = parsed.data;
    const toneContext = tone ? `The post was written in a "${tone}" tone — the alternatives should match that energy.` : "";

    const filteredTypes = hookTypes && hookTypes.length > 0
      ? ALL_HOOK_TYPES.filter(t => hookTypes.includes(t.key))
      : ALL_HOOK_TYPES;
    const shuffled = [...filteredTypes].sort(() => Math.random() - 0.5);
    // Ensure exactly 3 by cycling through filtered types if fewer than 3 selected
    const chosen = shuffled.length >= 3
      ? shuffled.slice(0, 3)
      : Array.from({ length: 3 }, (_, i) => shuffled[i % shuffled.length]);

    const hookInstructions = chosen.map((t, i) =>
      `  Hook ${i + 1} (${t.key}): ${t.instruction}`
    ).join("\n");

    const userMessage = `LinkedIn post draft:\n\n${draftText}\n\n${toneContext}`;

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system: `You are a LinkedIn hook specialist. Given a draft post, generate exactly 3 alternative opening lines — each a stronger replacement for the current first line.

STRICT REQUIREMENTS:
- Return exactly 3 hooks — no more, no fewer
- Each hook must be maximum 200 characters (count carefully)
- Each hook uses a DIFFERENT structure as defined below:
${hookInstructions}
- Each must be specific, punchy, and human — not generic
- Match the topic and ${toneContext ? "tone" : "energy"} of the original post
- Do NOT explain or label the hooks

Return JSON only (no markdown):
{ "hooks": ["hook 1", "hook 2", "hook 3"] }`,
      messages: [{ role: "user", content: userMessage }],
    });

    const block = msg.content[0];
    if (block.type !== "text") { res.status(500).json({ error: "AI error" }); return; }
    try {
      const data = parseJson(block.text) as { hooks?: unknown };
      if (!Array.isArray(data.hooks)) throw new Error("bad shape");
      const hooks = (data.hooks as string[])
        .slice(0, 3)
        .map(h => String(h).trim().slice(0, 200))
        .filter(h => h.length > 0);
      if (hooks.length < 3) throw new Error("insufficient hooks");
      res.json({ hooks });
    } catch {
      res.status(500).json({ error: "Invalid AI response" });
    }
  } catch (err) {
    console.error("[agent-hook-alternatives]", err);
    respondAiError(res, err, "Failed to generate hook alternatives");
  }
});

router.get("/agent/pain-points", requireAuth, aiRateLimit, async (req, res): Promise<void> => {
  try {
    const { prefs } = await getUserAgentContext(req.user!.userId);

    const userMessage = [
      prefs?.brandRole ? `Role: ${prefs.brandRole}` : "Professional",
      prefs?.brandAudience ? `Target audience: ${prefs.brandAudience}` : "",
      prefs?.brandBelief ? `Core belief: ${prefs.brandBelief}` : "",
    ].filter(Boolean).join("\n");

    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 700,
      system: `You are a LinkedIn content strategist. Given a creator's brand profile, identify the 4 most pressing pain points their target audience faces day-to-day.

For each pain point:
- title: short punchy label (3-5 words, no generic words like "challenges" or "issues")
- description: what this pain feels like in practice — visceral, specific, recognisable (max 25 words)
- angle: a LinkedIn post angle this creator could write to address it (max 15 words, sounds like a real post premise)

Return JSON only (no markdown):
{
  "painPoints": [
    { "title": "...", "description": "...", "angle": "..." }
  ]
}`,
      messages: [{ role: "user", content: userMessage }],
    });

    const block = msg.content[0];
    if (block.type !== "text") { res.status(500).json({ error: "AI error" }); return; }
    try {
      const data = parseJson(block.text) as { painPoints?: unknown };
      if (!Array.isArray(data.painPoints)) throw new Error("bad shape");
      res.json({ painPoints: data.painPoints.slice(0, 4) });
    } catch {
      res.status(500).json({ error: "Invalid AI response" });
    }
  } catch (err) {
    console.error("[agent-pain-points]", err);
    respondAiError(res, err, "Failed to generate pain points");
  }
});

const SkillAnglesBody = z.object({ skill: z.string().min(2).max(200) });

router.post("/agent/skill-angles", requireAuth, aiRateLimit, async (req, res): Promise<void> => {
  const parsed = SkillAnglesBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "skill is required." }); return; }

  try {
    const { prefs } = await getUserAgentContext(req.user!.userId);

    const userMessage = [
      `Skill: ${parsed.data.skill}`,
      prefs?.brandRole ? `Creator's role: ${prefs.brandRole}` : "",
      prefs?.brandAudience ? `Audience: ${prefs.brandAudience}` : "",
      prefs?.brandBelief ? `Core belief: ${prefs.brandBelief}` : "",
    ].filter(Boolean).join("\n");

    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 600,
      system: `You are a LinkedIn content strategist. Given a professional's skill, generate 3 compelling post angles they could write.

For each angle:
- angle: the post premise in 1-2 sentences (20-35 words) — specific enough to write from immediately, not a vague topic label
- hook: a strong opening line (max 15 words) that would stop someone scrolling

Vary the 3 angles: (1) personal story/lesson, (2) contrarian or counterintuitive take, (3) tactical how-to or framework.

Return JSON only (no markdown):
{ "angles": [{ "angle": "...", "hook": "..." }, { "angle": "...", "hook": "..." }, { "angle": "...", "hook": "..." }] }`,
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
    console.error("[agent-skill-angles]", err);
    respondAiError(res, err, "Failed to generate skill angles");
  }
});

const StressTestBody = z.object({
  postContent: z.string().min(10).max(5000),
  draftId: z.number().int().positive().optional().nullable(),
  fixesApplied: z.boolean().optional().default(false),
});

router.post("/agent/stress-test", requireAuth, aiRateLimit, async (req, res): Promise<void> => {
  // The scorecard has been retired in favour of the draft-level Brand Review.
  // Preserve historical records and the read route below, but never create
  // another subjective score.
  if (req.method === "POST") {
    res.status(410).json({ error: "Stress Test has been retired. Use Brand Review instead." });
    return;
  }

  const parsed = StressTestBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "postContent is required." }); return; }

  try {
    const userId = req.user!.userId;
    const { postContent, draftId, fixesApplied } = parsed.data;
    const [{ dna }, learnedPatterns] = await Promise.all([
      getUserAgentContext(userId),
      buildLearnedPatterns(userId),
    ]);

    // Verify draft ownership before any read/write using draftId (prevents IDOR)
    let verifiedDraftId: number | null = null;
    if (draftId) {
      const [ownedDraft] = await db
        .select({ id: draftsTable.id })
        .from(draftsTable)
        .where(and(eq(draftsTable.id, draftId), eq(draftsTable.userId, userId)))
        .limit(1);
      if (!ownedDraft) {
        res.status(404).json({ error: "Draft not found." });
        return;
      }
      verifiedDraftId = ownedDraft.id;
    }

    // Fetch resonance context from performance signals (ownership already verified)
    let resonanceContext = "";
    if (verifiedDraftId) {
      try {
        const [signal] = await db
          .select()
          .from(performanceSignalsTable)
          .where(eq(performanceSignalsTable.draftId, verifiedDraftId))
          .limit(1);
        if (signal) {
          const total = signal.reactions + signal.comments + signal.reposts;
          if (total > 0) {
            resonanceContext = `Previous performance on this post: ${signal.reactions} reactions, ${signal.comments} comments, ${signal.reposts} reposts, ${signal.impressions} impressions.`;
          }
        }
      } catch { /* continue without resonance context */ }
    }

    const charCount = postContent.length;

    const systemPrompt = `You are a LinkedIn content quality judge. Score this post on how well it aligns with LinkedIn's OWN published creator guidance — the principles LinkedIn states its feed rewards. A high score must mean "this is the kind of post LinkedIn says it promotes," NOT "this uses engagement hacks." Score 4 judgment-based factors. Return ONLY valid JSON — no markdown, no commentary.

These 4 factors are deliberately the QUALITATIVE ones a human editor must judge. Do NOT score length, hashtag count, or links here — a separate live tool already checks those mechanics; focus only on the judgment below.

SCORING RUBRIC (LinkedIn creator-guidance pillars):

Factor 1 — Expertise & Relevance (max 30 points)
LinkedIn's knowledge/interest graph rewards demonstrated, topic-consistent expertise aimed at a clear audience. The platform explicitly favours people sharing genuine knowledge in their field.
- 30 pts: Clearly written by someone with real expertise on this topic, aimed at an identifiable professional audience; teaches or reframes something only an insider would know.
- 15 pts: On-topic and competent but generic — could be written by anyone; expertise is implied, not demonstrated.
- 0-5 pts: Off-niche, surface-level, or could be AI-generic; no evidence of real expertise.

Factor 2 — Original Perspective & Authenticity (max 25 points)
LinkedIn states it rewards authentic, original, first-person content and down-ranks generic or inauthentic posts.
- 25 pts: A clear, specific point of view or lived experience; says something the author actually believes, with a concrete anchor (real number, named situation, genuine lesson).
- 13 pts: Has a viewpoint but it's safe/conventional, or specifics are thin.
- 0-5 pts: Platitudes, regurgitated advice, or "thought-leader" filler with no real stance.

Factor 3 — Meaningful Conversation (max 25 points)
LinkedIn rewards posts that spark SUBSTANTIVE comments and replies, and actively penalises engagement bait. Quality of invited conversation matters, not volume of reactions.
- 25 pts: Naturally invites thoughtful responses — a genuine question, a debatable stance, or an idea people will want to add to. No bait.
- 13 pts: Some conversational pull but the prompt is generic ("thoughts?", "let me know") or weakly tied to the content.
- 0-5 pts: No conversational hook, OR uses engagement bait ("Comment YES", "Tag someone", "Like & share", "Follow for more", "Repost this") — these are penalised by LinkedIn.

Factor 4 — Hook & Readability (max 20 points)
LinkedIn rewards dwell time. The opening must earn the "see more" expand, and the body must be easy to read on a phone.
- 20 pts: First line creates curiosity/tension/value and clearly earns the expand; body is skimmable (short paragraphs, whitespace) and pulls the reader down.
- 10 pts: Decent opener or readable body, but not both; some momentum lost.
- 0-5 pts: Weak/generic opener ("I'm excited…", "Today…") or a dense wall of text that kills dwell.

RULES:
- score = sum of the 4 factor scores (max 100).
- publishReady MUST be true if and only if score is 80 or higher.
- If publishReady: fixes array empty (or 1 minor polish note). Do NOT invent problems.
- If not publishReady: surface at most 2-3 fixes, focused on the lowest factors.
- howToFix: only for factors below max; specific to THIS post, tied to the LinkedIn principle it serves.
- why: 1-2 sentences naming the LinkedIn creator-guidance principle at play.
- Reward alignment with guidance; never reward gimmicks. Engagement bait must score Factor 3 at 0-5 regardless of how "engaging" it seems.

Return this exact JSON shape:
{
  "score": <integer 0-100>,
  "publishReady": <boolean>,
  "factors": [
    { "name": "Expertise & Relevance", "score": <0-30>, "maxScore": 30, "why": "<names the LinkedIn principle>", "howToFix": "<specific, or omit if at max>" },
    { "name": "Original Perspective", "score": <0-25>, "maxScore": 25, "why": "<names the LinkedIn principle>", "howToFix": "<specific, or omit if at max>" },
    { "name": "Meaningful Conversation", "score": <0-25>, "maxScore": 25, "why": "<names the LinkedIn principle>", "howToFix": "<specific, or omit if at max>" },
    { "name": "Hook & Readability", "score": <0-20>, "maxScore": 20, "why": "<names the LinkedIn principle>", "howToFix": "<specific, or omit if at max>" }
  ],
  "fixes": ["<fix 1>", "<fix 2>"],
  "personalInsight": "<optional: 1-2 sentences comparing to user's voice DNA or best posts. Omit if no voice data available.>"
}`;

    const userMessage = [
      `Post draft (${charCount} characters):\n\n${postContent}`,
      dna ? `\nUser's writing DNA for personalInsight:\n${dna}` : "",
      resonanceContext ? `\nResonance/performance context (use in personalInsight if helpful):\n${resonanceContext}` : "",
      learnedPatterns ? `\n${learnedPatterns}\nWhen this user's own measured patterns conflict with the generic rubric, weight the user's patterns — mention it in personalInsight.` : "",
    ].filter(Boolean).join("\n");

    const completion = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      temperature: 0.2,
      system: systemPrompt + "\n\nReturn ONLY valid JSON — no markdown fences, no commentary.",
      messages: [{ role: "user", content: userMessage }],
    });

    const block = completion.content[0];
    const raw = block?.type === "text"
      ? block.text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim()
      : "{}";
    const data = JSON.parse(raw) as {
      score?: number;
      publishReady?: boolean;
      factors?: Array<{ name: string; score: number; maxScore: number; why: string; howToFix?: string }>;
      fixes?: string[];
      personalInsight?: string;
    };

    const validFactors = Array.isArray(data.factors) &&
      data.factors.length === 4 &&
      data.factors.every(
        (f: unknown) => f && typeof f === "object" && "name" in (f as object) &&
          typeof (f as { name: unknown }).name === "string" &&
          typeof (f as { score: unknown }).score === "number" &&
          typeof (f as { maxScore: unknown }).maxScore === "number" &&
          (f as { score: number }).score >= 0 &&
          (f as { maxScore: number }).maxScore > 0 &&
          (f as { score: number }).score <= (f as { maxScore: number }).maxScore
      );
    if (data.score === undefined || data.score === null || !validFactors) {
      res.status(500).json({ error: "Invalid AI response shape" });
      return;
    }

    // After validation, factors is guaranteed to be a valid 6-element array
    const validatedFactors = data.factors as Array<{ name: string; score: number; maxScore: number; why?: string; howToFix?: string }>;

    const normalizedScore = Math.min(100, Math.max(0, Number(data.score)));
    const publishReady = normalizedScore >= 80;
    // When publish-ready, strip howToFix from every factor so the UI cannot
    // surface improvement suggestions after the 85+ threshold is reached.
    // Fallback defaults for why/name ensure UI never receives empty strings.
    const factors = validatedFactors.slice(0, 4).map((f, i) => ({
      name: typeof f.name === "string" && f.name.trim() ? f.name.trim() : `Factor ${i + 1}`,
      score: f.score,
      maxScore: f.maxScore,
      why: typeof f.why === "string" && f.why.trim() ? f.why.trim() : "No explanation provided.",
      ...(publishReady ? {} : {
        howToFix: typeof f.howToFix === "string" && f.howToFix.trim() ? f.howToFix.trim() : undefined,
      }),
    }));
    const result = {
      score: normalizedScore,
      publishReady,
      factors,
      fixes: publishReady ? [] : (data.fixes ?? []).slice(0, 3),
      personalInsight: dna && data.personalInsight ? data.personalInsight : undefined,
    };

    // Save to DB if ownership-verified draftId is present
    let persistenceWarning: string | undefined;
    if (verifiedDraftId) {
      try {
        await db.insert(stressTestScoresTable).values({
          draftId: verifiedDraftId,
          userId,
          overallScore: result.score,
          factorScores: result.factors as unknown as Record<string, unknown>[],
          fixesApplied: fixesApplied ?? false,
        });
      } catch (dbErr) {
        console.error("[stress-test] DB save failed:", dbErr);
        persistenceWarning = "Score could not be saved. Your result is shown but will not appear in Library.";
      }
    } else {
      // No draftId provided — result is shown but not persisted
      persistenceWarning = "Save your draft first to keep this score in your Library.";
    }

    res.json({ ...result, ...(persistenceWarning ? { persistenceWarning } : {}) });
  } catch (err) {
    console.error("[agent-stress-test]", err);
    respondAiError(res, err, "Failed to run stress test");
  }
});

router.get("/agent/stress-test/scores", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const scores = await db
      .select()
      .from(stressTestScoresTable)
      .where(eq(stressTestScoresTable.userId, userId))
      .orderBy(desc(stressTestScoresTable.createdAt));

    // Return latest score per draftId
    const scoreMap: Record<string, { score: number; publishReady: boolean; createdAt: string; factors: unknown }> = {};
    for (const s of scores) {
      if (s.draftId && !scoreMap[String(s.draftId)]) {
        scoreMap[String(s.draftId)] = {
          score: s.overallScore,
          publishReady: s.overallScore >= 80,
          createdAt: s.createdAt.toISOString(),
          factors: s.factorScores,
        };
      }
    }

    res.json(scoreMap);
  } catch (err) {
    console.error("[stress-test-scores]", err);
    res.status(500).json({ error: "Failed to fetch scores" });
  }
});

const BrandReviewBody = z.object({
  postText: z.string().min(20).max(6000),
  draftId: z.number().int().positive().optional(),
  force: z.boolean().optional().default(false),
});

type BrandReviewResultData = {
  verdict: "specific" | "mixed" | "generalist";
  headline: string;
  summary: string;
  signals: Array<{
    key: "specificity" | "positioning" | "voice";
    label: string;
    status: "strong" | "mixed" | "needs_attention";
    detail: string;
  }>;
  strengths: string[];
  recommendations: Array<{
    id: string;
    title: string;
    issue: string;
    change: string;
    instruction: string;
    example?: string;
    priority: "high" | "medium";
  }>;
};

type BrandReviewCache = {
  result: BrandReviewResultData;
  authenticityCheck: AuthenticityCheck | null;
  reviewedPost: string;
  cachedAt: string;
};

function isBrandReviewCache(value: unknown): value is BrandReviewCache {
  if (!value || typeof value !== "object") return false;
  const cache = value as Partial<BrandReviewCache>;
  return !!cache.result
    && typeof cache.reviewedPost === "string"
    && typeof cache.cachedAt === "string"
    && (cache.authenticityCheck === undefined || cache.authenticityCheck === null || typeof cache.authenticityCheck === "object");
}

function buildAuthenticityEvidence(original: string | null | undefined, final: string): AuthenticityCheck {
  const wordChangeSummary = computeWordChangeSummary(original, final);
  const base = runAuthenticityCheck(original, final) ?? {
    editPct: computeEditPercent(original, final),
    flags: [],
    severity: "low" as const,
  };
  return wordChangeSummary ? { ...base, wordChangeSummary } : base;
}

router.post("/agent/brand-review", requireAuth, aiRateLimit, async (req, res): Promise<void> => {
  const parsedBody = BrandReviewBody.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ error: "Post text required." });
    return;
  }

  try {
    const { postText, draftId, force } = parsedBody.data;
    let draft: typeof draftsTable.$inferSelect | undefined;
    if (draftId !== undefined) {
      [draft] = await db
        .select()
        .from(draftsTable)
        .where(and(eq(draftsTable.id, draftId), eq(draftsTable.userId, req.user!.userId)))
        .limit(1);
      if (!draft) {
        res.status(404).json({ error: "Draft not found" });
        return;
      }

      const cached = isBrandReviewCache(draft.brandReview) ? draft.brandReview : null;
      if (cached && !force) {
        const authenticityCheck = cached.authenticityCheck?.wordChangeSummary
          ? cached.authenticityCheck
          : buildAuthenticityEvidence(draft.aiOriginalPost, cached.reviewedPost);
        if (!cached.authenticityCheck?.wordChangeSummary && !isDemoUser(req.user!.email)) {
          await db
            .update(draftsTable)
            .set({ brandReview: { ...cached, authenticityCheck } })
            .where(and(eq(draftsTable.id, draft.id), eq(draftsTable.userId, req.user!.userId)));
        }
        res.json({
          ...cached,
          authenticityCheck,
          fromCache: true,
          isStale: cached.reviewedPost !== postText,
        });
        return;
      }
    }

    const { dna } = await getUserAgentContext(req.user!.userId);
    const completion = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 8192,
      system: `You are BrandMoi's draft-level brand editor. Review the creator's draft against their positioning and writing evidence.

Your job is not to make the post sound more polished. Identify whether it is too broad/generalist, too generic, or disconnected from the creator's actual expertise. Reward concrete lived experience, a clear point of view, and a recognisable audience. Preserve the creator's voice.

Return JSON only:
{
  "verdict": "specific" | "mixed" | "generalist",
  "headline": "short plain-language verdict",
  "summary": "2 sentences explaining the most important finding",
  "signals": [
    {
      "key": "specificity" | "positioning" | "voice",
      "label": "short non-numeric status, such as 'Grounded in real experience'",
      "status": "strong" | "mixed" | "needs_attention",
      "detail": "1-2 sentences explaining this signal for this draft and what to do, if anything"
    }
  ],
  "strengths": ["specific strength", "specific strength"],
  "recommendations": [
    {
      "id": "specificity",
      "title": "Make the audience more specific",
      "issue": "what is currently too broad or generic",
      "change": "the concrete change to make",
      "instruction": "an exact instruction for rewriting this draft",
      "example": "optional example of the direction, not a full replacement post",
      "priority": "high" | "medium"
    }
  ]
}

Rules:
- "generalist" means the draft could have been written by almost anyone in the field; do not use it merely because the creator serves more than one audience.
- Recommend no more than 3 changes. Only recommend a change when it is grounded in the actual draft and the creator context.
- Prefer adding a concrete decision, scenario, consequence, audience, or point of view over adding buzzwords.
- If the draft is already specific, return verdict "specific" and an empty recommendations array.
- Each instruction must be usable as a refinement instruction for this exact draft.
- Do not recommend changing the creator's permanent Brand DNA. This review is for the current draft only.
- Return exactly three signals in this order: specificity, positioning, voice. These are editorial guidance, not scores or proof of authorship.`,
      messages: [{
        role: "user",
        content: `Creator's Brand and Voice context:
${dna || "No detailed Brand DNA is available yet."}

Draft to review:
${postText}

Return the JSON review now.`,
      }],
    });

    const block = completion.content[0];
    if (block.type !== "text") {
      res.status(500).json({ error: "Unexpected AI response" });
      return;
    }

    const data = parseJson(block.text) as {
      verdict?: unknown;
      headline?: unknown;
      summary?: unknown;
      signals?: unknown;
      strengths?: unknown;
      recommendations?: unknown;
    };
    const verdict = data.verdict === "specific" || data.verdict === "mixed" || data.verdict === "generalist"
      ? data.verdict
      : null;
    const headline = typeof data.headline === "string" ? data.headline.trim() : "";
    const summary = typeof data.summary === "string" ? data.summary.trim() : "";
    const allowedSignalKeys = ["specificity", "positioning", "voice"] as const;
    type SignalKey = typeof allowedSignalKeys[number];
    const parsedSignals = Array.isArray(data.signals)
      ? data.signals
        .filter((value): value is Record<string, unknown> => !!value && typeof value === "object")
        .map((value) => ({
          key: allowedSignalKeys.includes(value.key as SignalKey) ? value.key as SignalKey : null,
          label: typeof value.label === "string" ? value.label.trim() : "",
          status: value.status === "strong" || value.status === "mixed" || value.status === "needs_attention"
            ? value.status
            : null,
          detail: typeof value.detail === "string" ? value.detail.trim() : "",
        }))
        .filter((value): value is { key: SignalKey; label: string; status: "strong" | "mixed" | "needs_attention"; detail: string } =>
          !!value.key && !!value.label && !!value.status && !!value.detail)
      : [];
    const fallbackStatus: BrandReviewResultData["signals"][number]["status"] =
      verdict === "specific" ? "strong" : verdict === "mixed" ? "mixed" : "needs_attention";
    const fallbackSignals = allowedSignalKeys.map((key) => ({
      key,
      label: key === "specificity" ? "Review draft detail" : key === "positioning" ? "Review audience fit" : "Review voice fit",
      status: fallbackStatus,
      detail: summary || "Use the recommendations below as editorial guidance for this draft.",
    }));
    const signals = allowedSignalKeys.every((key) => parsedSignals.some((signal) => signal.key === key))
      ? allowedSignalKeys.map((key) => parsedSignals.find((signal) => signal.key === key)!)
      : fallbackSignals;
    const strengths = Array.isArray(data.strengths)
      ? data.strengths.filter((value): value is string => typeof value === "string" && value.trim().length > 0).map((value) => value.trim()).slice(0, 3)
      : [];
    const recommendations = Array.isArray(data.recommendations)
      ? data.recommendations
        .filter((value): value is Record<string, unknown> => !!value && typeof value === "object")
        .map((value, index) => ({
          id: typeof value.id === "string" && value.id.trim() ? value.id.trim() : `recommendation-${index + 1}`,
          title: typeof value.title === "string" ? value.title.trim() : "",
          issue: typeof value.issue === "string" ? value.issue.trim() : "",
          change: typeof value.change === "string" ? value.change.trim() : "",
          instruction: typeof value.instruction === "string" ? value.instruction.trim() : "",
          example: typeof value.example === "string" && value.example.trim() ? value.example.trim() : undefined,
          priority: value.priority === "high" ? "high" as const : "medium" as const,
        }))
        .filter((value) => value.title && value.issue && value.change && value.instruction)
        .slice(0, 3)
      : [];

    if (!verdict || !headline || !summary) {
      console.error("[brand-review] unexpected shape. raw text:", block.text.slice(0, 500));
      res.status(500).json({ error: "Invalid AI response shape" });
      return;
    }

    const authenticityCheck = buildAuthenticityEvidence(draft?.aiOriginalPost, postText);
    const cache: BrandReviewCache = {
      result: { verdict, headline, summary, signals, strengths, recommendations },
      authenticityCheck,
      reviewedPost: postText,
      cachedAt: new Date().toISOString(),
    };

    // Demo drafts are intentionally ephemeral. They can still display a
    // review during the session, but must not write to shared demo data.
    if (draft && !isDemoUser(req.user!.email)) {
      const [updated] = await db
        .update(draftsTable)
        .set({ brandReview: cache })
        .where(and(eq(draftsTable.id, draft.id), eq(draftsTable.userId, req.user!.userId)))
        .returning({ id: draftsTable.id });
      if (!updated) {
        res.status(404).json({ error: "Draft not found" });
        return;
      }
    }

    res.json({ ...cache, fromCache: false, isStale: false });
  } catch (err) {
    console.error("[brand-review]", err);
    respondAiError(res, err, "Failed to review this draft");
  }
});

router.get("/agent/themes", requireAuth, aiRateLimit, async (req, res): Promise<void> => {
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
      model: "claude-haiku-4-5",
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
    respondAiError(res, err, "Failed to analyze themes");
  }
});

// Dare mode: one spicy-but-defensible contrarian take the user is dared to
// post within 24h. Capped at 3/day so it can't quietly burn API budget.
router.post("/agent/dare", requireAuth, aiRateLimit, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  if (isDemoUser(req.user!.email)) {
    await demoDelay();
    res.json(getDemoDare());
    return;
  }
  try {
    const limit = await checkAndIncrementDailyLimit(userId, "dare", 3);
    if (!limit.allowed) {
      res.status(429).json({ error: "You've used your 3 dares for today. The algorithm gets a day off." });
      return;
    }

    const { prefs, dna } = await getUserAgentContext(userId);
    const pillars = Array.isArray(prefs?.contentPillars) ? (prefs.contentPillars as string[]) : [];
    const proofPoints = Array.isArray(prefs?.proofPoints) ? (prefs.proofPoints as string[]) : [];

    const userMessage = [
      prefs?.brandRole ? `Role: ${prefs.brandRole}` : "",
      prefs?.brandAudience ? `Audience: ${prefs.brandAudience}` : "",
      prefs?.brandBelief ? `Core belief: ${prefs.brandBelief}` : "",
      pillars.length > 0 ? `Content pillars: ${pillars.join(", ")}` : "",
      proofPoints.length > 0 ? `Proof points they can back claims with:\n${proofPoints.map((p) => `- ${p}`).join("\n")}` : "",
      dna ? `\nWriting DNA:\n${dna}` : "",
    ].filter(Boolean).join("\n");

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      system: `You are the mischievous side of a LinkedIn brand strategist. Generate ONE dare: the spiciest contrarian take this person's actual experience can defend. It must be provocative enough to make them hesitate, but professionally defensible — never offensive, never punching down, never fabricated.

Return JSON only (no markdown):
{
  "dare": "The contrarian take, phrased as the opening line of a post (max 25 words)",
  "why": "One sentence on why their experience earns them the right to say this (max 20 words)",
  "risk": "One of: Mild, Medium, Spicy"
}`,
      messages: [{ role: "user", content: userMessage }],
    });

    const block = msg.content[0];
    if (block.type !== "text") { res.status(500).json({ error: "AI error" }); return; }
    try {
      const data = parseJson(block.text) as { dare?: string; why?: string; risk?: string };
      if (!data.dare) throw new Error("bad shape");
      res.json({
        dare: data.dare,
        why: data.why ?? "",
        risk: ["Mild", "Medium", "Spicy"].includes(data.risk ?? "") ? data.risk : "Medium",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        remaining: limit.remaining,
      });
    } catch {
      res.status(500).json({ error: "Invalid AI response" });
    }
  } catch (err) {
    console.error("[agent-dare]", err);
    respondAiError(res, err, "Failed to generate dare");
  }
});

const IdeasBody = z.object({ type: z.enum(["brand", "teach"]), topicId: z.number().int().nullish() });

// Per-tab idea refresh: regenerates ONLY brand angles or teach angles, on
// Haiku — much cheaper than re-running the whole daily brief (which also
// re-fetches news). Used by the Idea Engine's per-tab refresh buttons.
router.post("/agent/ideas", requireAuth, aiRateLimit, async (req, res): Promise<void> => {
  const parsed = IdeasBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "type must be brand or teach." }); return; }

  if (isDemoUser(req.user!.email)) {
    await demoDelay();
    res.json(getDemoIdeas(parsed.data.type));
    return;
  }

  try {
    const { prefs, recentDrafts, ideaFeedback } = await getUserAgentContext(req.user!.userId);
    const liked = ideaFeedback.filter((f) => f.signal === "like").map((f) => f.ideaText).slice(0, 8);
    const disliked = ideaFeedback.filter((f) => f.signal === "dislike").map((f) => f.ideaText).slice(0, 8);
    const pillars = Array.isArray(prefs?.contentPillars) ? (prefs.contentPillars as string[]) : [];
    const recentTopics = recentDrafts.slice(0, 8)
      .map((d) => (d.structuredBreakdown as { topic?: string } | null)?.topic)
      .filter(Boolean).join(", ");

    const ALL_AUDIENCES = ["Clients", "Peers", "Recruiters & Headhunters", "Investors", "My audience"];

    let topicName: string | null = null;
    if (parsed.data.topicId) {
      const [topic] = await db.select().from(topicsTable)
        .where(and(eq(topicsTable.id, parsed.data.topicId), eq(topicsTable.userId, req.user!.userId)));
      topicName = topic?.name ?? null;
    }

    const isTeach = parsed.data.type === "teach";
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 450,
      system: isTeach
        ? `You generate "teach your audience" LinkedIn post seeds — analogy or FAQ ideas grounded in the creator's exact field. Each max 12 words, like "Why [misconception] — an analogy for [audience]". Return JSON only: {"angles": ["...", "...", "..."]}`
        : `You generate sharp LinkedIn post angles for a creator's brand, each tagged with the audience it targets. Each angle max 10 words, specific to their field — real post ideas, not generic topics.
Each angle must genuinely fit its tagged audience — e.g. the Recruiters & Headhunters angle should read as evidence of capability/judgment (an outcome, a hard call made well), NOT a craft debate; the Peers angle can be more insider/contrarian; the Investors angle should reframe a market or show pattern-matching; the Clients angle should demonstrate you understand their problem; the My audience angle can be the most personal/direct one.
Return EXACTLY 5 angles, one for EACH of these 5 audiences, in this order: Clients, Peers, Recruiters & Headhunters, Investors, My audience. Never skip one, never give two angles to the same audience.
Return JSON only: {"angles": [{"angle": "...", "audience": "Clients"}, {"angle": "...", "audience": "Peers"}, {"angle": "...", "audience": "Recruiters & Headhunters"}, {"angle": "...", "audience": "Investors"}, {"angle": "...", "audience": "My audience"}]}`,
      messages: [{
        role: "user",
        content: [
          prefs?.brandRole ? `Role: ${prefs.brandRole}` : "",
          prefs?.brandAudience ? `Audience: ${prefs.brandAudience}` : "",
          pillars.length > 0 ? `Content pillars: ${pillars.join(", ")}` : "",
          topicName ? `Generate ideas specifically for this topic (all angles must fit it): ${topicName}` : "",
          recentTopics ? `Recent topics (avoid repeating): ${recentTopics}` : "",
          liked.length > 0 ? `Liked idea directions:\n${liked.map((t) => `- ${t}`).join("\n")}` : "",
          disliked.length > 0 ? `Disliked directions (avoid):\n${disliked.map((t) => `- ${t}`).join("\n")}` : "",
          isTeach ? "Generate 3 fresh angles. JSON only." : "Generate 5 fresh angles, one per audience. JSON only.",
        ].filter(Boolean).join("\n"),
      }],
    });

    const block = msg.content[0];
    if (block.type !== "text") { res.status(500).json({ error: "AI error" }); return; }
    const data = parseJson(block.text) as { angles?: unknown };
    if (!Array.isArray(data.angles)) throw new Error("bad shape");

    if (isTeach) {
      res.json({ angles: data.angles.filter((a): a is string => typeof a === "string").slice(0, 3) });
      return;
    }

    const VALID_AUDIENCES = new Set(ALL_AUDIENCES);
    const rawAngles = data.angles
      .map((a) => {
        if (typeof a === "string") return { angle: a, audience: "My audience" };
        if (a && typeof a === "object" && typeof (a as { angle?: unknown }).angle === "string") {
          const obj = a as { angle: string; audience?: unknown };
          const audience = typeof obj.audience === "string" && VALID_AUDIENCES.has(obj.audience) ? obj.audience : "My audience";
          return { angle: obj.angle, audience };
        }
        return null;
      })
      .filter((a): a is { angle: string; audience: string } => a !== null);

    // Guarantee exactly one angle per audience — fill any the model missed
    // or duplicated from a per-audience fallback.
    const FALLBACK_BY_AUDIENCE: Record<string, string> = {
      "Clients": `Show a prospective client how you think about their exact problem`,
      "Peers": `Challenge the most common assumption in your field`,
      "Recruiters & Headhunters": `Share a hard call you made under pressure at work`,
      "Investors": `Share a non-consensus read on where your market is heading`,
      "My audience": `Teach one thing you wish you knew earlier in your career`,
    };
    const angles = ALL_AUDIENCES.map(
      (aud) => rawAngles.find((a) => a.audience === aud) ?? { angle: FALLBACK_BY_AUDIENCE[aud], audience: aud }
    );
    res.json({ angles });
  } catch (err) {
    console.error("[agent-ideas]", err);
    respondAiError(res, err, "Failed to generate ideas");
  }
});

const ClassifyPostBody = z.object({ text: z.string().min(80).max(6000) });

// Classify a pasted past post so imports get real audience/feeling/topic
// labels instead of defaults. One small Haiku call.
router.post("/agent/classify-post", requireAuth, aiRateLimit, async (req, res): Promise<void> => {
  const parsed = ClassifyPostBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "text required (80-6000 chars)." }); return; }

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 250,
      system: `You classify LinkedIn posts. Return JSON only (no markdown):
{
  "topic": "short topic label (max 70 chars, taken from what the post is actually about)",
  "audience": "One of: Clients, Peers, Recruiters & Headhunters, Investors, My audience",
  "feeling": "One of: Direct, Witty, Vulnerable, Story, Contrarian",
  "objective": "One of: Clients, Job, Authority, Documenting, Expert, Hiring",
  "tone": "One of: Direct, Witty, Vulnerable, Story, Contrarian"
}
Infer from the post's content, framing, and call-to-action. Pick the closest match; never invent values outside the lists.`,
      messages: [{ role: "user", content: parsed.data.text }],
    });

    const block = msg.content[0];
    if (block.type !== "text") { res.status(500).json({ error: "AI error" }); return; }
    const data = parseJson(block.text) as { topic?: string; audience?: string; feeling?: string; objective?: string; tone?: string };

    const AUD = ["Clients", "Peers", "Recruiters & Headhunters", "Investors", "My audience"];
    const FEEL = ["Direct", "Witty", "Vulnerable", "Story", "Contrarian"];
    const OBJ = ["Clients", "Job", "Authority", "Documenting", "Expert", "Hiring"];

    res.json({
      topic: (data.topic ?? "").slice(0, 70) || null,
      audience: AUD.includes(data.audience ?? "") ? data.audience : "My audience",
      feeling: FEEL.includes(data.feeling ?? "") ? data.feeling : "Direct",
      objective: OBJ.includes(data.objective ?? "") ? data.objective : "Authority",
      tone: FEEL.includes(data.tone ?? "") ? data.tone : "Direct",
    });
  } catch (err) {
    console.error("[classify-post]", err);
    respondAiError(res, err, "Failed to classify post");
  }
});

// ── Brand Studio ─────────────────────────────────────────────────────────

// Health snapshot: when the brand was last tuned (last brand-analysis run)
// and how many measured posts have landed since. No AI call.
router.get("/agent/brand-health", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  try {
    const [lastAnalysis] = await db
      .select({ date: aiUsageTable.date })
      .from(aiUsageTable)
      .where(and(eq(aiUsageTable.userId, userId), eq(aiUsageTable.kind, "brand-analysis")))
      .orderBy(desc(aiUsageTable.date))
      .limit(1);

    const published = await db
      .select({ id: draftsTable.id, updatedAt: draftsTable.updatedAt })
      .from(draftsTable)
      .where(and(eq(draftsTable.userId, userId), eq(draftsTable.status, "published")));

    const signals = published.length > 0
      ? await db
          .select({ draftId: performanceSignalsTable.draftId })
          .from(performanceSignalsTable)
          .where(inArray(performanceSignalsTable.draftId, published.map((d) => d.id)))
      : [];
    const measured = new Set(signals.map((s) => s.draftId));

    const since = lastAnalysis ? new Date(lastAnalysis.date + "T00:00:00Z").getTime() : 0;
    const measuredSince = published.filter((d) => measured.has(d.id) && new Date(d.updatedAt).getTime() > since).length;

    res.json({
      lastAnalyzedAt: lastAnalysis?.date ?? null,
      measuredPostsTotal: measured.size,
      measuredPostsSince: measuredSince,
    });
  } catch (err) {
    console.error("[brand-health]", err);
    res.status(500).json({ error: "Failed to load brand health" });
  }
});

// Published posts ranked by resonance for the analysis picker. No AI call.
router.get("/agent/studio-posts", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  try {
    const drafts = await db
      .select({ id: draftsTable.id, structuredBreakdown: draftsTable.structuredBreakdown, postOutput: draftsTable.postOutput, updatedAt: draftsTable.updatedAt })
      .from(draftsTable)
      .where(and(eq(draftsTable.userId, userId), eq(draftsTable.status, "published")))
      .orderBy(desc(draftsTable.updatedAt))
      .limit(60);

    const signals = drafts.length > 0
      ? await db.select().from(performanceSignalsTable).where(inArray(performanceSignalsTable.draftId, drafts.map((d) => d.id)))
      : [];
    const perfMap = new Map(signals.map((s) => [s.draftId, s]));

    const posts = drafts
      .filter((d) => d.postOutput && d.postOutput.trim().length > 60)
      .map((d) => {
        const s = perfMap.get(d.id);
        const bd = d.structuredBreakdown as { topic?: string; audience?: string; feeling?: string } | null;
        return {
          id: d.id,
          topic: bd?.topic ?? d.postOutput!.split("\n").find((l) => l.trim())?.slice(0, 70) ?? `Post #${d.id}`,
          resonance: s ? resonanceScore(s) : null,
          hasData: !!s,
          audience: bd?.audience ?? null,
          feeling: bd?.feeling ?? null,
        };
      })
      .sort((a, b) => (b.resonance ?? -1) - (a.resonance ?? -1));

    res.json({ posts });
  } catch (err) {
    console.error("[studio-posts]", err);
    res.status(500).json({ error: "Failed to load posts" });
  }
});

const BrandAnalysisBody = z.object({
  draftIds: z.array(z.number().int()).min(1).max(8),
  // Optional lens: when the user filtered to a category (e.g. "Story posts to
  // Peers"), the analysis frames its findings through that lens.
  focus: z.string().max(120).optional(),
});

// The Brand Studio engine: deep-dive the selected posts vs the current brand
// profile and emit a "brand diff" as pending voice suggestions. 2/day cap.
router.post("/agent/brand-analysis", requireAuth, aiRateLimit, async (req, res): Promise<void> => {
  const parsed = BrandAnalysisBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "draftIds required (1-8)." }); return; }
  const userId = req.user!.userId;

  try {
    const limit = await checkAndIncrementDailyLimit(userId, "brand-analysis", 2);
    if (!limit.allowed) {
      res.status(429).json({ error: "You've used both brand analyses for today. Come back tomorrow." });
      return;
    }

    const [prefs] = await db.select().from(preferencesTable).where(eq(preferencesTable.userId, userId)).limit(1);
    const drafts = await db
      .select()
      .from(draftsTable)
      .where(and(eq(draftsTable.userId, userId), inArray(draftsTable.id, parsed.data.draftIds)));
    if (drafts.length === 0) { res.status(404).json({ error: "No matching posts found." }); return; }

    const signals = await db.select().from(performanceSignalsTable).where(inArray(performanceSignalsTable.draftId, drafts.map((d) => d.id)));
    const perfMap = new Map(signals.map((s) => [s.draftId, s]));
    const learnedPatterns = await buildLearnedPatterns(userId);

    const pillars = Array.isArray(prefs?.contentPillars) ? (prefs.contentPillars as string[]) : [];
    const proofPoints = Array.isArray(prefs?.proofPoints) ? (prefs.proofPoints as string[]) : [];
    const aspirational = Array.isArray(prefs?.aspirationalSamples) ? (prefs.aspirationalSamples as string[]) : [];

    const postsBlock = drafts.map((d) => {
      const s = perfMap.get(d.id);
      const perf = s ? `resonance ${resonanceScore(s)} · ${s.impressions} impressions · ${s.reactions} reactions · ${s.comments} comments` : "no performance data";
      return `[id:${d.id}] (${perf})\n${(d.postOutput ?? "").slice(0, 1200)}`;
    }).join("\n\n---\n\n");

    const profileBlock = [
      `objective: ${prefs?.objective ?? ""}`,
      `persona: ${prefs?.persona ?? ""}`,
      `tone: ${prefs?.tone ?? ""}`,
      `brandRole: ${prefs?.brandRole ?? ""}`,
      `brandAudience: ${prefs?.brandAudience ?? ""}`,
      `brandBelief: ${prefs?.brandBelief ?? ""}`,
      `contentPillars: ${pillars.join(", ")}`,
      proofPoints.length > 0 ? `proofPoints:\n${proofPoints.map((p) => `- ${p}`).join("\n")}` : "",
      aspirational.length > 0 ? `aspirationalStyleTargets (the user is deliberately steering toward this writing style — recommendations should be compatible with this direction, not fight it):\n${aspirational.map((s) => `- "${s.slice(0, 200)}…"`).join("\n")}` : "",
    ].filter(Boolean).join("\n");

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      system: `You are a personal brand strategist doing a periodic tune-up. Compare what this creator's chosen posts prove is working against their declared brand profile, and recommend profile updates so the brand keeps evolving with the evidence.

Return JSON only (no markdown):
{"suggestions": [{"field": "...", "suggestedValue": "...", "rationale": "...", "evidenceDraftIds": [1,2]}]}

Rules:
- Allowed fields: tone, objective, persona, brandRole, brandAudience, brandBelief, contentPillars.
- For contentPillars: suggestedValue is a comma-separated list of 3-6 pillars (each max 40 chars) — the FULL new set, not just additions.
- For tone use only: Executive, Direct, Story, Contrarian, Witty, Vulnerable, Playful, Snappy. For objective only: Clients, Job, Authority, Documenting, Expert, Hiring.
- Only suggest a change when the posts clearly contradict or outgrow the current value — quote the evidence in the rationale (reference what the posts actually do).
- Maximum 4 suggestions. Zero suggestions is a valid answer if the profile already matches the evidence.
- Never suggest a value identical to the current one.
- rationale: 1-2 sentences, specific, citing the pattern in the selected posts.`,
      messages: [{
        role: "user",
        content: `CURRENT BRAND PROFILE:\n${profileBlock}\n\n${learnedPatterns ? learnedPatterns + "\n\n" : ""}${parsed.data.focus ? `ANALYSIS LENS: the creator deliberately selected ${parsed.data.focus}. Frame findings through this lens — what does THIS category of post prove, and what should change because of it?\n\n` : ""}SELECTED POSTS (the creator's evidence of what works):\n${postsBlock}\n\nRecommend profile updates. JSON only.`,
      }],
    });

    const block = msg.content[0];
    if (block.type !== "text") { res.status(500).json({ error: "AI error" }); return; }

    const data = parseJson(block.text) as { suggestions?: Array<{ field: string; suggestedValue: string; rationale: string; evidenceDraftIds?: number[] }> };
    const currentMap: Record<string, string> = {
      tone: prefs?.tone ?? "", objective: prefs?.objective ?? "", persona: prefs?.persona ?? "",
      brandRole: prefs?.brandRole ?? "", brandAudience: prefs?.brandAudience ?? "", brandBelief: prefs?.brandBelief ?? "",
      contentPillars: pillars.join(", "),
    };
    const ALLOWED = Object.keys(currentMap);
    const valid = (data.suggestions ?? [])
      .filter((s) => ALLOWED.includes(s.field) && s.suggestedValue && s.rationale)
      .filter((s) => s.suggestedValue.trim().toLowerCase() !== (currentMap[s.field] ?? "").trim().toLowerCase())
      .slice(0, 4);

    if (valid.length === 0) {
      res.json({ status: "ok", suggestions: [], remaining: limit.remaining });
      return;
    }

    const snippetMap = new Map(drafts.map((d) => [d.id, (d.postOutput ?? "").slice(0, 120).replace(/\n/g, " ").trim()]));
    const inserted = await db
      .insert(voiceSuggestionsTable)
      .values(valid.map((s) => {
        const ids = (Array.isArray(s.evidenceDraftIds) ? s.evidenceDraftIds : []).filter((id) => snippetMap.has(id));
        return {
          userId,
          field: s.field,
          currentValue: currentMap[s.field] ?? "",
          suggestedValue: s.suggestedValue,
          rationale: s.rationale,
          evidenceDraftIds: ids,
          evidenceSnippets: ids.map((id) => snippetMap.get(id) ?? "").filter(Boolean),
        };
      }))
      .returning();

    res.json({ status: "ok", suggestions: inserted, remaining: limit.remaining });
  } catch (err) {
    console.error("[brand-analysis]", err);
    respondAiError(res, err, "Failed to run brand analysis");
  }
});

const IdeaFeedbackBody = z.object({
  ideaText: z.string().min(1).max(500),
  ideaType: z.enum(["brand", "teach"]),
  signal: z.enum(["like", "dislike"]),
});

router.post("/agent/idea-feedback", requireAuth, async (req, res): Promise<void> => {
  const parsed = IdeaFeedbackBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input." }); return; }
  const { ideaText, ideaType, signal } = parsed.data;
  const userId = req.user!.userId;
  try {
    const [row] = await db
      .insert(ideaFeedbackTable)
      .values({ userId, ideaText, ideaType, signal })
      .returning();
    res.status(201).json({ id: row.id });
  } catch (err) {
    console.error("[idea-feedback]", err);
    res.status(500).json({ error: "Failed to save feedback" });
  }
});

router.get("/agent/saved-ideas", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  try {
    const rows = await db
      .select()
      .from(ideaFeedbackTable)
      .where(and(eq(ideaFeedbackTable.userId, userId), eq(ideaFeedbackTable.signal, "like")))
      .orderBy(desc(ideaFeedbackTable.createdAt))
      .limit(50);
    res.json({ ideas: rows.map((r) => ({ id: r.id, text: r.ideaText, type: r.ideaType, createdAt: r.createdAt.toISOString() })) });
  } catch (err) {
    console.error("[saved-ideas]", err);
    res.status(500).json({ error: "Failed to fetch saved ideas" });
  }
});

router.delete("/agent/saved-ideas/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    await db
      .delete(ideaFeedbackTable)
      .where(and(eq(ideaFeedbackTable.id, id), eq(ideaFeedbackTable.userId, userId)));
    res.json({ ok: true });
  } catch (err) {
    console.error("[saved-ideas delete]", err);
    res.status(500).json({ error: "Failed to delete idea" });
  }
});

router.get("/agent/top-post-suggestions", requireAuth, aiRateLimit, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  try {
    const { prefs, dna } = await getUserAgentContext(userId);

    // Get top 5 posts by engagement (reactions + comments * 2 + reposts) with their content
    const topPosts = await db
      .select({
        id: draftsTable.id,
        rawInput: draftsTable.rawInput,
        postOutput: draftsTable.postOutput,
        objective: draftsTable.objective,
        structuredBreakdown: draftsTable.structuredBreakdown,
        reactions: performanceSignalsTable.reactions,
        comments: performanceSignalsTable.comments,
        reposts: performanceSignalsTable.reposts,
        impressions: performanceSignalsTable.impressions,
      })
      .from(draftsTable)
      .innerJoin(performanceSignalsTable, eq(performanceSignalsTable.draftId, draftsTable.id))
      .where(
        and(
          eq(draftsTable.userId, userId),
          sql`(${performanceSignalsTable.reactions} + ${performanceSignalsTable.comments} * 2 + ${performanceSignalsTable.reposts}) > 0`
        )
      )
      .orderBy(desc(sql`(${performanceSignalsTable.reactions} + ${performanceSignalsTable.comments} * 2 + ${performanceSignalsTable.reposts})`))
      .limit(5);

    if (topPosts.length === 0) {
      res.json({ suggestions: [], reason: "no_data" });
      return;
    }

    const postSummaries = topPosts.map((p, i) => {
      const breakdown = p.structuredBreakdown as { topic?: string; angle?: string } | null;
      const topic = breakdown?.topic ?? p.rawInput.slice(0, 80);
      const angle = breakdown?.angle ?? "";
      const content = (p.postOutput ?? p.rawInput).slice(0, 400);
      const reactions = p.reactions ?? 0;
      const comments = p.comments ?? 0;
      const reposts = p.reposts ?? 0;
      const engagement = reactions + comments * 2 + reposts;
      return `Post ${i + 1}: "${topic}"${angle ? ` (angle: ${angle})` : ""}
Engagement score: ${engagement} (${reactions} reactions, ${comments} comments, ${reposts} reposts)
Content preview: ${content}`;
    }).join("\n\n");

    const userContext = [
      prefs?.brandRole ? `Role: ${prefs.brandRole}` : "",
      prefs?.brandAudience ? `Audience: ${prefs.brandAudience}` : "",
      dna ? `Writing DNA:\n${dna}` : "",
    ].filter(Boolean).join("\n");

    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      // Five posts can produce ten 20–35-word angles plus explanations.
      // 800 tokens can truncate the JSON before the closing array/object.
      max_tokens: 8192,
      system: `You are a LinkedIn content strategist. Given a creator's top-performing posts, analyse what made each one resonate and generate follow-up angle suggestions.

For each top post, generate 2 angles:
1. A direct follow-up or deeper dive on the same topic
2. A "different lens" — same topic viewed from a fresh angle, contrarian take, or opposite perspective

Each angle must be 1-2 sentences (20-35 words), specific and immediately writable — not a topic label.

Return JSON only (no markdown):
{
  "suggestions": [
    {
      "originalTopic": "short topic label from the post (max 8 words)",
      "engagementScore": number,
      "why": "one sentence explaining what made this post perform well (max 20 words)",
      "angles": [
        { "label": "Follow-up", "angle": "..." },
        { "label": "Fresh lens", "angle": "..." }
      ]
    }
  ]
}`,
      messages: [{
        role: "user",
        content: `${userContext}\n\nTop performing posts:\n${postSummaries}`,
      }],
    });

    const block = msg.content[0];
    if (block.type !== "text") { res.status(500).json({ error: "AI error" }); return; }
    try {
      const data = parseJson(block.text) as { suggestions?: unknown };
      // Tolerate the AI returning the array at the top level or nested
      const suggestions =
        Array.isArray(data) ? data :
        Array.isArray(data.suggestions) ? data.suggestions :
        null;
      if (!suggestions) {
        console.error("[top-post-suggestions] unexpected shape. raw text:", block.text.slice(0, 500));
        throw new Error("bad shape");
      }
      res.json({ suggestions: suggestions.slice(0, 5) });
    } catch (parseErr) {
      console.error("[top-post-suggestions] parse failed:", parseErr);
      res.status(500).json({ error: "Invalid AI response" });
    }
  } catch (err) {
    console.error("[top-post-suggestions]", err);
    respondAiError(res, err, "Failed to generate top post suggestions");
  }
});

export default router;
