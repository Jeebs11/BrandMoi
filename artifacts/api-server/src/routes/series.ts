import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, and, sql, asc } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db } from "@workspace/db";
import { seriesTable, draftsTable, performanceSignalsTable, topicsTable, ideaFeedbackTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth.js";
import { aiRateLimit } from "../middleware/rate-limit.js";
import { AUDIENCE_OVERLAYS, FORMATS, FORMAT_INSTRUCTIONS } from "../lib/ai-prompts.js";
import { respondAiError } from "../lib/ai-errors.js";

const router: IRouter = Router();

function parseJson(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("No JSON object found in AI response");
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

const FORMAT_SET = new Set<string>(FORMATS);

// How many angles to suggest per "plan" click for an endless series (no fixed
// plannedParts) — capped at 5 so each batch stays cheap and reacts to what's
// actually landed since the last one, rather than planning far ahead. The
// frontend also gates re-suggesting until the current batch is written, so
// this shouldn't be raised without revisiting that gate too.
const ENDLESS_BATCH_SIZE = 5;

// Rollup of a set of drafts' progress + aggregated performance — shared by
// the list and detail routes so both surfaces agree on the same numbers.
async function rollupForSeries(seriesId: number) {
  const parts = await db
    .select({
      id: draftsTable.id,
      seriesPart: draftsTable.seriesPart,
      status: draftsTable.status,
      postOutput: draftsTable.postOutput,
      createdAt: draftsTable.createdAt,
      impressions: performanceSignalsTable.impressions,
      reactions: performanceSignalsTable.reactions,
      comments: performanceSignalsTable.comments,
      reposts: performanceSignalsTable.reposts,
      saves: performanceSignalsTable.saves,
    })
    .from(draftsTable)
    .leftJoin(performanceSignalsTable, eq(performanceSignalsTable.draftId, draftsTable.id))
    .where(eq(draftsTable.seriesId, seriesId))
    .orderBy(asc(draftsTable.seriesPart));

  const partsWritten = parts.length;
  const partsPublished = parts.filter((p) => p.status === "published").length;
  const performance = parts.reduce(
    (acc, p) => ({
      impressions: acc.impressions + (p.impressions ?? 0),
      reactions: acc.reactions + (p.reactions ?? 0),
      comments: acc.comments + (p.comments ?? 0),
      reposts: acc.reposts + (p.reposts ?? 0),
      saves: acc.saves + (p.saves ?? 0),
    }),
    { impressions: 0, reactions: 0, comments: 0, reposts: 0, saves: 0 }
  );

  return { parts, partsWritten, partsPublished, performance };
}

router.get("/series", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const rows = await db
    .select()
    .from(seriesTable)
    .where(eq(seriesTable.userId, userId))
    .orderBy(asc(seriesTable.createdAt));

  const withRollups = await Promise.all(
    rows.map(async (s) => {
      const { partsWritten, partsPublished, performance } = await rollupForSeries(s.id);
      return { ...s, partsWritten, partsPublished, performance };
    })
  );

  res.json(withRollups);
});

router.get("/series/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid series id" });
    return;
  }

  const [series] = await db
    .select()
    .from(seriesTable)
    .where(and(eq(seriesTable.id, id), eq(seriesTable.userId, req.user!.userId)));

  if (!series) {
    res.status(404).json({ error: "Series not found" });
    return;
  }

  const { parts, partsWritten, partsPublished, performance } = await rollupForSeries(id);
  res.json({ ...series, parts, partsWritten, partsPublished, performance });
});

const PlannedAngleShape = z.object({ part: z.number().int(), angle: z.string() });

const CreateSeriesBody = z.object({
  title: z.string().min(1),
  theme: z.string().min(1),
  topicId: z.number().int().nullish(),
  targetAudience: z.string().nullish(),
  format: z.enum(FORMATS).default("standard"),
  // Omit or pass null for an endless series with no fixed part count.
  plannedParts: z.number().int().min(1).max(1000).nullish(),
  hook: z.string().nullish(),
});

router.post("/series", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateSeriesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [series] = await db
    .insert(seriesTable)
    .values({
      userId: req.user!.userId,
      title: parsed.data.title,
      theme: parsed.data.theme,
      topicId: parsed.data.topicId ?? null,
      targetAudience: parsed.data.targetAudience ?? null,
      format: parsed.data.format,
      plannedParts: parsed.data.plannedParts ?? null,
      hook: parsed.data.hook ?? null,
    })
    .returning();

  res.status(201).json(series);
});

const UpdateSeriesBody = z.object({
  title: z.string().min(1).optional(),
  theme: z.string().min(1).optional(),
  topicId: z.number().int().nullish(),
  targetAudience: z.string().nullish(),
  format: z.enum(FORMATS).optional(),
  plannedParts: z.number().int().min(1).max(1000).nullish(),
  status: z.enum(["planning", "active", "completed"]).optional(),
  hook: z.string().nullish(),
  plannedAngles: z.array(PlannedAngleShape).nullish(),
});

router.patch("/series/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid series id" });
    return;
  }
  const parsed = UpdateSeriesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  for (const key of ["title", "theme", "topicId", "targetAudience", "format", "plannedParts", "status", "hook", "plannedAngles"] as const) {
    if (parsed.data[key] !== undefined) updateData[key] = parsed.data[key];
  }

  const [series] = await db
    .update(seriesTable)
    .set(updateData)
    .where(and(eq(seriesTable.id, id), eq(seriesTable.userId, req.user!.userId)))
    .returning();

  if (!series) {
    res.status(404).json({ error: "Series not found" });
    return;
  }
  res.json(series);
});

router.delete("/series/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid series id" });
    return;
  }

  const [series] = await db
    .delete(seriesTable)
    .where(and(eq(seriesTable.id, id), eq(seriesTable.userId, req.user!.userId)))
    .returning();

  if (!series) {
    res.status(404).json({ error: "Series not found" });
    return;
  }
  res.sendStatus(204);
});

const InferFormatBody = z.object({
  title: z.string().min(1),
  theme: z.string().nullish(),
});

router.post("/series/infer-format", requireAuth, aiRateLimit, async (req, res): Promise<void> => {
  const parsed = InferFormatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 150,
      system: `You classify a LinkedIn content-series premise into the structural format that best fits how it should be written. Options:
- standard: a normal post, no special framing device
- dialogue: reads as a back-and-forth exchange between two voices (e.g. a conversation with a past/future self, a debate, an interview)
- letter: reads as a direct address to someone, written as an actual letter
- qa: a series of explicit question-then-answer beats
- story_arc: a scene-by-scene narrative arc (Scene/Struggle/Turn/Lesson/CTA)
Return JSON only: {"format": "one of the 5 options above", "rationale": "under 12 words explaining why"}`,
      messages: [{
        role: "user",
        content: `Series title: ${parsed.data.title}\n${parsed.data.theme ? `Theme: ${parsed.data.theme}` : ""}`,
      }],
    });

    const block = msg.content[0];
    if (block.type !== "text") { res.status(500).json({ error: "AI error" }); return; }
    const data = parseJson(block.text) as { format?: unknown; rationale?: unknown };
    const format = typeof data.format === "string" && FORMAT_SET.has(data.format) ? data.format : "standard";
    const rationale = typeof data.rationale === "string" ? data.rationale : "";
    res.json({ format, rationale });
  } catch (err) {
    console.error("[series-infer-format]", err);
    respondAiError(res, err, "Failed to infer format");
  }
});

const PlanBody = z.object({
  // "all": regenerate every unwritten part from scratch. "remaining": only
  // fill part numbers that have neither a draft nor an existing suggestion,
  // leaving anything the user already has (written or manually typed) alone.
  scope: z.enum(["all", "remaining"]).default("remaining"),
  // Optional free-text steer for this batch — e.g. a topic the user wants
  // covered next. Folded into the prompt as a strong hint, not a hard rule.
  guidance: z.string().nullish(),
});

router.post("/series/:id/plan", requireAuth, aiRateLimit, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid series id" });
    return;
  }
  const parsedBody = PlanBody.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    res.status(400).json({ error: parsedBody.error.message });
    return;
  }

  const [series] = await db
    .select()
    .from(seriesTable)
    .where(and(eq(seriesTable.id, id), eq(seriesTable.userId, req.user!.userId)));

  if (!series) {
    res.status(404).json({ error: "Series not found" });
    return;
  }

  try {
    const [existingParts, topic, liked, disliked, existingRow, publishedPerf] = await Promise.all([
      db.select({ seriesPart: draftsTable.seriesPart, structuredBreakdown: draftsTable.structuredBreakdown })
        .from(draftsTable)
        .where(eq(draftsTable.seriesId, id)),
      series.topicId
        ? db.select().from(topicsTable).where(eq(topicsTable.id, series.topicId)).then((r) => r[0])
        : Promise.resolve(undefined),
      db.select({ ideaText: ideaFeedbackTable.ideaText }).from(ideaFeedbackTable)
        .where(and(eq(ideaFeedbackTable.userId, req.user!.userId), eq(ideaFeedbackTable.signal, "like"))).limit(8),
      db.select({ ideaText: ideaFeedbackTable.ideaText }).from(ideaFeedbackTable)
        .where(and(eq(ideaFeedbackTable.userId, req.user!.userId), eq(ideaFeedbackTable.signal, "dislike"))).limit(8),
      db.select({ plannedAngles: seriesTable.plannedAngles }).from(seriesTable).where(eq(seriesTable.id, id)).then((r) => r[0]),
      db.select({
        structuredBreakdown: draftsTable.structuredBreakdown,
        impressions: performanceSignalsTable.impressions,
        reactions: performanceSignalsTable.reactions,
        comments: performanceSignalsTable.comments,
        reposts: performanceSignalsTable.reposts,
      })
        .from(draftsTable)
        .innerJoin(performanceSignalsTable, eq(performanceSignalsTable.draftId, draftsTable.id))
        .where(and(eq(draftsTable.seriesId, id), eq(draftsTable.status, "published"))),
    ]);

    const existingAngles = existingParts
      .map((p) => (p.structuredBreakdown as { angle?: string } | null)?.angle)
      .filter(Boolean)
      .join("; ");

    const audienceOverlay = series.targetAudience ? AUDIENCE_OVERLAYS[series.targetAudience] : "";
    const formatOverlay = FORMAT_INSTRUCTIONS[series.format] ?? FORMAT_INSTRUCTIONS["standard"];
    const isEndless = series.plannedParts === null;
    const { scope, guidance } = parsedBody.data;

    const existingPlannedAngles = existingRow?.plannedAngles ?? [];
    const writtenPartNums = new Set(existingParts.map((p) => p.seriesPart).filter((n): n is number => n !== null));

    // Rough resonance ranking — reactions/comments/reposts are a much
    // stronger signal of "this landed" than raw impressions, which can be
    // large from feed distribution alone. Only meaningful with real data.
    const resonanceScored = publishedPerf
      .map((p) => ({
        angle: (p.structuredBreakdown as { angle?: string } | null)?.angle,
        score: (p.reactions ?? 0) * 3 + (p.comments ?? 0) * 4 + (p.reposts ?? 0) * 5 + (p.impressions ?? 0) * 0.01,
        impressions: p.impressions ?? 0,
        reactions: p.reactions ?? 0,
      }))
      .filter((p): p is { angle: string; score: number; impressions: number; reactions: number } => !!p.angle)
      .sort((a, b) => b.score - a.score);

    let resonanceContext = "";
    if (resonanceScored.length >= 2) {
      const best = resonanceScored[0];
      const worst = resonanceScored[resonanceScored.length - 1];
      resonanceContext = `Performance signal from this series so far (use this to steer new angles):\n- Resonated best: "${best.angle}" (${best.impressions} impressions, ${best.reactions} reactions) — lean into similar territory or tone.\n- Resonated weakest: "${worst.angle}" (${worst.impressions} impressions, ${worst.reactions} reactions) — avoid similar framing unless there's a clear reason to try again.`;
    } else if (resonanceScored.length === 1) {
      resonanceContext = `Early performance signal: "${resonanceScored[0].angle}" got ${resonanceScored[0].impressions} impressions and ${resonanceScored[0].reactions} reactions — treat as a weak early data point, not a firm rule.`;
    }

    let targetParts: number[];
    let arcInstruction: string;

    if (isEndless) {
      // Keep endless batches to a deliberate cadence: don't spend another AI
      // call piling on more suggestions while the last batch is still sitting
      // unwritten — write (or delete) those first. Cheaper, and nudges toward
      // actually publishing + logging performance before planning further ahead.
      const unwrittenSuggested = existingPlannedAngles.filter((p) => !writtenPartNums.has(p.part));
      if (unwrittenSuggested.length > 0) {
        res.status(400).json({
          error: `You still have ${unwrittenSuggested.length} unwritten suggested angle${unwrittenSuggested.length === 1 ? "" : "s"} from the last batch — write or edit those first before generating more.`,
        });
        return;
      }

      const maxKnownPart = Math.max(0, ...existingParts.map((p) => p.seriesPart ?? 0), ...existingPlannedAngles.map((p) => p.part));
      const startPart = maxKnownPart + 1;
      targetParts = Array.from({ length: ENDLESS_BATCH_SIZE }, (_, i) => startPart + i);
      arcInstruction = `This is an ongoing, endless series — there is no final part and no overall arc to close. Generate the next ${targetParts.length} angles (numbered ${targetParts[0]} through ${targetParts[targetParts.length - 1]}) that continue developing the theme. Each is a distinct beat, never repeating a prior part's exact angle.`;
    } else {
      const allParts = Array.from({ length: series.plannedParts! }, (_, i) => i + 1);
      if (scope === "remaining") {
        const suggestedNums = new Set(existingPlannedAngles.map((p) => p.part));
        targetParts = allParts.filter((n) => !writtenPartNums.has(n) && !suggestedNums.has(n));
        if (targetParts.length === 0) {
          res.json({ parts: existingPlannedAngles });
          return;
        }
      } else {
        targetParts = allParts.filter((n) => !writtenPartNums.has(n));
      }
      arcInstruction = `Plan the requested parts of a ${series.plannedParts}-part series that builds progressively across the whole arc — part 1 hooks/sets up the premise, middle parts each develop a distinct beat, the final part (${series.plannedParts}) must land a payoff or clear CTA. You are only being asked for parts ${targetParts.join(", ")} specifically — write angles that fit correctly at those positions in the overall arc.`;
    }

    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 600,
      system: `You plan a LinkedIn content series.
${arcInstruction}
${audienceOverlay ? `${audienceOverlay}\n` : ""}${formatOverlay}
Return JSON only: {"parts": [{"part": ${targetParts[0]}, "angle": "..."}, ...]} — exactly ${targetParts.length} entries, one per requested part number. Each angle max 14 words.`,
      messages: [{
        role: "user",
        content: [
          `Series title: ${series.title}`,
          `Theme: ${series.theme}`,
          topic ? `Topic: ${topic.name}` : "",
          guidance ? `Direction requested by the user for this batch (prioritise this): ${guidance}` : "",
          resonanceContext,
          existingAngles ? `Already-published parts (do not repeat): ${existingAngles}` : "",
          existingPlannedAngles.length > 0 ? `Already-suggested parts (do not repeat, and take inspiration/continuity from these): ${existingPlannedAngles.map((p) => `#${p.part}: ${p.angle}`).join("; ")}` : "",
          liked.length > 0 ? `Liked idea directions:\n${liked.map((l) => `- ${l.ideaText}`).join("\n")}` : "",
          disliked.length > 0 ? `Disliked directions (avoid):\n${disliked.map((l) => `- ${l.ideaText}`).join("\n")}` : "",
          `Generate exactly ${targetParts.length} parts for positions ${targetParts.join(", ")}. JSON only.`,
        ].filter(Boolean).join("\n"),
      }],
    });

    const block = msg.content[0];
    if (block.type !== "text") { res.status(500).json({ error: "AI error" }); return; }
    const data = parseJson(block.text) as { parts?: unknown };
    if (!Array.isArray(data.parts)) throw new Error("bad shape");

    const newParts = data.parts
      .map((p) => {
        if (p && typeof p === "object" && typeof (p as { angle?: unknown }).angle === "string") {
          const obj = p as { part?: unknown; angle: string };
          const part = typeof obj.part === "number" ? obj.part : undefined;
          return part ? { part, angle: obj.angle } : null;
        }
        return null;
      })
      .filter((p): p is { part: number; angle: string } => p !== null)
      .filter((p) => targetParts.includes(p.part))
      .sort((a, b) => a.part - b.part)
      .slice(0, targetParts.length);

    // Merge: keep every existing suggestion not covered by this batch, replace
    // (or add) the ones that were just (re)generated.
    const persistedParts = [
      ...existingPlannedAngles.filter((p) => !newParts.some((n) => n.part === p.part)),
      ...newParts,
    ].sort((a, b) => a.part - b.part);

    // Persist so the suggestions (and any later edits to them) survive a
    // reload instead of vanishing the moment the user navigates away.
    await db.update(seriesTable).set({ plannedAngles: persistedParts }).where(eq(seriesTable.id, id));

    res.json({ parts: persistedParts });
  } catch (err) {
    console.error("[series-plan]", err);
    respondAiError(res, err, "Failed to plan series");
  }
});

export default router;
