import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, and, desc, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import { draftsTable, performanceSignalsTable } from "@workspace/db";
import {
  CreateDraftBody,
  UpdateDraftBody,
  UpdateDraftParams,
  GetDraftParams,
  GetDraftResponse,
  UpdateDraftResponse,
  DeleteDraftParams,
  ListDraftsResponse,
  AnalyticsOverviewResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middleware/auth.js";
import { extractVoiceDNA } from "./ai.js";
import { upsertDailyActivity } from "../lib/momentum.js";

const router: IRouter = Router();

router.get("/drafts", requireAuth, async (req, res): Promise<void> => {
  const drafts = await db
    .select()
    .from(draftsTable)
    .where(eq(draftsTable.userId, req.user!.userId))
    .orderBy(desc(draftsTable.createdAt));
  res.json(ListDraftsResponse.parse(drafts));
});

router.post("/drafts", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateDraftBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [draft] = await db
    .insert(draftsTable)
    .values({
      userId: req.user!.userId,
      rawInput: parsed.data.rawInput,
      objective: parsed.data.objective,
      persona: parsed.data.persona,
      tone: parsed.data.tone,
      structuredBreakdown: parsed.data.structuredBreakdown as object,
      selectedHook: parsed.data.selectedHook ?? null,
      postOutput: parsed.data.postOutput ?? null,
      shortPost: parsed.data.shortPost ?? null,
      carouselOutput: parsed.data.carouselOutput ?? null,
      visualOutput: parsed.data.visualOutput ?? null,
      status: parsed.data.status ?? "draft",
      contentSource: parsed.data.contentSource ?? null,
      visualType: parsed.data.visualType ?? null,
    })
    .returning();

  res.status(201).json(GetDraftResponse.parse(draft));

  void upsertDailyActivity(req.user!.userId);
  if ((parsed.data.status === "ready" || parsed.data.status === "published") && draft.postOutput) {
    void extractVoiceDNA(req.user!.userId, draft.id, draft.postOutput);
  }
});

router.get("/drafts/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetDraftParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [draft] = await db
    .select()
    .from(draftsTable)
    .where(and(eq(draftsTable.id, params.data.id), eq(draftsTable.userId, req.user!.userId)));

  if (!draft) {
    res.status(404).json({ error: "Draft not found" });
    return;
  }

  res.json(GetDraftResponse.parse(draft));
});

router.patch("/drafts/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateDraftParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateDraftBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.postOutput !== undefined) updateData.postOutput = parsed.data.postOutput;
  if (parsed.data.shortPost !== undefined) updateData.shortPost = parsed.data.shortPost;
  if (parsed.data.carouselOutput !== undefined) updateData.carouselOutput = parsed.data.carouselOutput;
  if (parsed.data.visualOutput !== undefined) updateData.visualOutput = parsed.data.visualOutput;
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
  if (parsed.data.structuredBreakdown !== undefined) updateData.structuredBreakdown = parsed.data.structuredBreakdown as object;
  if (parsed.data.contentSource !== undefined) updateData.contentSource = parsed.data.contentSource;
  if (parsed.data.visualType !== undefined) updateData.visualType = parsed.data.visualType;

  const [draft] = await db
    .update(draftsTable)
    .set(updateData)
    .where(and(eq(draftsTable.id, params.data.id), eq(draftsTable.userId, req.user!.userId)))
    .returning();

  if (!draft) {
    res.status(404).json({ error: "Draft not found" });
    return;
  }

  res.json(UpdateDraftResponse.parse(draft));

  if ((parsed.data.status === "ready" || parsed.data.status === "published") && draft.postOutput) {
    void extractVoiceDNA(req.user!.userId, draft.id, draft.postOutput);
  }
});

router.delete("/drafts/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteDraftParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(draftsTable).where(and(eq(draftsTable.id, params.data.id), eq(draftsTable.userId, req.user!.userId)));

  res.sendStatus(204);
});

const PerformanceBody = z.object({
  impressions: z.number().int().min(0),
  reactions: z.number().int().min(0),
  comments: z.number().int().min(0),
});

router.post("/drafts/:id/performance", requireAuth, async (req, res): Promise<void> => {
  const params = GetDraftParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = PerformanceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid performance data" });
    return;
  }

  const [draft] = await db
    .select({ id: draftsTable.id })
    .from(draftsTable)
    .where(and(eq(draftsTable.id, params.data.id), eq(draftsTable.userId, req.user!.userId)));

  if (!draft) {
    res.status(404).json({ error: "Draft not found" });
    return;
  }

  const [existing] = await db
    .select()
    .from(performanceSignalsTable)
    .where(eq(performanceSignalsTable.draftId, params.data.id));

  let signal;
  if (existing) {
    const [updated] = await db
      .update(performanceSignalsTable)
      .set({ impressions: parsed.data.impressions, reactions: parsed.data.reactions, comments: parsed.data.comments })
      .where(eq(performanceSignalsTable.draftId, params.data.id))
      .returning();
    signal = updated;
  } else {
    const [created] = await db
      .insert(performanceSignalsTable)
      .values({ draftId: params.data.id, ...parsed.data })
      .returning();
    signal = created;
  }

  res.json(signal);
});

router.get("/analytics/overview", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  // All published drafts for this user
  const allDrafts = await db
    .select()
    .from(draftsTable)
    .where(and(eq(draftsTable.userId, userId), eq(draftsTable.status, "published")))
    .orderBy(desc(draftsTable.createdAt));

  const totalPublished = allDrafts.length;

  // Fetch performance signals for these drafts
  const draftIds = allDrafts.map(d => d.id);
  const perfMap = new Map<number, { impressions: number; reactions: number; comments: number }>();
  if (draftIds.length > 0) {
    const signals = await db
      .select()
      .from(performanceSignalsTable)
      .where(inArray(performanceSignalsTable.draftId, draftIds));
    for (const s of signals) {
      perfMap.set(s.draftId, { impressions: s.impressions, reactions: s.reactions, comments: s.comments });
    }
  }

  const resonanceOf = (draftId: number) => {
    const p = perfMap.get(draftId);
    if (!p || p.impressions === 0) return null;
    return Math.min(100, Math.round(((p.reactions * 3 + p.comments * 5) / p.impressions) * 1000));
  };

  // Avg resonance across all published with perf data
  const resonanceValues = allDrafts.map(d => resonanceOf(d.id)).filter((v): v is number => v !== null);
  const avgResonance = resonanceValues.length > 0
    ? Math.round(resonanceValues.reduce((a, b) => a + b, 0) / resonanceValues.length)
    : 0;

  // By tone
  const toneMap = new Map<string, { count: number; resonances: number[] }>();
  for (const d of allDrafts) {
    const tone = d.tone || "Unknown";
    if (!toneMap.has(tone)) toneMap.set(tone, { count: 0, resonances: [] });
    const entry = toneMap.get(tone)!;
    entry.count++;
    const r = resonanceOf(d.id);
    if (r !== null) entry.resonances.push(r);
  }
  const byTone = Array.from(toneMap.entries()).map(([tone, { count, resonances }]) => ({
    tone,
    count,
    avgResonance: resonances.length > 0 ? Math.round(resonances.reduce((a, b) => a + b, 0) / resonances.length) : 0,
  })).sort((a, b) => b.count - a.count);

  // By content source
  const srcMap = new Map<string, number>();
  for (const d of allDrafts) {
    const src = (d.contentSource as string | null) || "capture";
    srcMap.set(src, (srcMap.get(src) ?? 0) + 1);
  }
  const byContentSource = Array.from(srcMap.entries()).map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  // By visual type
  const visMap = new Map<string, number>();
  for (const d of allDrafts) {
    const vt = (d.visualType as string | null) || "none";
    visMap.set(vt, (visMap.get(vt) ?? 0) + 1);
  }
  const byVisualType = Array.from(visMap.entries()).map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  // By objective
  const objMap = new Map<string, number>();
  for (const d of allDrafts) {
    const obj = d.objective || "Unknown";
    objMap.set(obj, (objMap.get(obj) ?? 0) + 1);
  }
  const byObjective = Array.from(objMap.entries()).map(([objective, count]) => ({ objective, count }))
    .sort((a, b) => b.count - a.count);

  // Top 5 by resonance (only those with perf data)
  const withResonance = allDrafts
    .map(d => ({ d, r: resonanceOf(d.id) }))
    .filter((x): x is { d: typeof allDrafts[0]; r: number } => x.r !== null)
    .sort((a, b) => b.r - a.r)
    .slice(0, 5);
  const topPosts = withResonance.map(({ d, r }) => ({
    id: d.id,
    topic: ((d.structuredBreakdown as Record<string, unknown>)?.topic as string | undefined) ?? "Untitled",
    resonance: r,
    tone: d.tone,
    publishedAt: d.updatedAt.toISOString(),
  }));

  // Weekly trend — last 13 weeks
  const thirteenWeeksAgo = new Date();
  thirteenWeeksAgo.setDate(thirteenWeeksAgo.getDate() - 91);
  const weekMap = new Map<string, number>();
  for (const d of allDrafts) {
    if (d.createdAt < thirteenWeeksAgo) continue;
    // ISO week label: YYYY-Www
    const date = new Date(d.createdAt);
    const jan1 = new Date(date.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((date.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
    const key = `${date.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
    weekMap.set(key, (weekMap.get(key) ?? 0) + 1);
  }
  const weeklyTrend = Array.from(weekMap.entries())
    .map(([week, count]) => ({ week, count }))
    .sort((a, b) => a.week.localeCompare(b.week));

  const result = AnalyticsOverviewResponse.parse({
    totalPublished,
    avgResonance,
    byTone,
    byContentSource,
    byVisualType,
    byObjective,
    topPosts,
    weeklyTrend,
  });

  res.json(result);
});

router.get("/drafts/:id/performance", requireAuth, async (req, res): Promise<void> => {
  const params = GetDraftParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [draft] = await db
    .select({ id: draftsTable.id })
    .from(draftsTable)
    .where(and(eq(draftsTable.id, params.data.id), eq(draftsTable.userId, req.user!.userId)));

  if (!draft) {
    res.status(404).json({ error: "Draft not found" });
    return;
  }

  const [signal] = await db
    .select()
    .from(performanceSignalsTable)
    .where(eq(performanceSignalsTable.draftId, params.data.id));

  res.json(signal ?? null);
});

export default router;
