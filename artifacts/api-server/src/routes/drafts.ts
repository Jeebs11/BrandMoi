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
  const perfMap = new Map<number, { impressions: number; reactions: number; comments: number; reposts: number }>();
  if (draftIds.length > 0) {
    const signals = await db
      .select()
      .from(performanceSignalsTable)
      .where(inArray(performanceSignalsTable.draftId, draftIds));
    for (const s of signals) {
      perfMap.set(s.draftId, { impressions: s.impressions, reactions: s.reactions, comments: s.comments, reposts: s.reposts });
    }
  }

  const resonanceOf = (draftId: number): number | null => {
    const p = perfMap.get(draftId);
    if (!p) return null;
    const engagementWeight = p.reactions * 3 + p.comments * 5 + p.reposts * 4;
    if (p.impressions > 0) {
      return Math.min(100, Math.round((engagementWeight / p.impressions) * 1000));
    }
    if (engagementWeight === 0) return null;
    return Math.min(100, Math.round(Math.log2(1 + engagementWeight) * 12));
  };

  // Avg resonance across all published with perf data
  const resonanceValues = allDrafts.map(d => resonanceOf(d.id)).filter((v): v is number => v !== null);
  const avgResonance = resonanceValues.length > 0
    ? Math.round(resonanceValues.reduce((a, b) => a + b, 0) / resonanceValues.length)
    : 0;

  // By tone (with sampledCount for sparse-bucket enforcement)
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
    sampledCount: resonances.length,
    avgResonance: resonances.length >= 2 ? Math.round(resonances.reduce((a, b) => a + b, 0) / resonances.length) : null,
  })).sort((a, b) => b.count - a.count);

  const loggedPerformanceCount = resonanceValues.length;

  // Helper to compute avg resonance for a list of drafts, enforcing 2+ sample minimum
  const avgResForDrafts = (drafts: typeof allDrafts) => {
    const vals = drafts.map(d => resonanceOf(d.id)).filter((v): v is number => v !== null);
    return { avgResonance: vals.length >= 2 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null, sampledCount: vals.length };
  };

  // By content source (with resonance)
  const srcBuckets = new Map<string, typeof allDrafts>();
  for (const d of allDrafts) {
    const src = (d.contentSource as string | null) || "capture";
    if (!srcBuckets.has(src)) srcBuckets.set(src, []);
    srcBuckets.get(src)!.push(d);
  }
  const byContentSource = Array.from(srcBuckets.entries())
    .map(([source, drafts]) => ({ source, count: drafts.length, ...avgResForDrafts(drafts) }))
    .sort((a, b) => b.count - a.count);

  // By visual type (with resonance)
  const visBuckets = new Map<string, typeof allDrafts>();
  for (const d of allDrafts) {
    const vt = (d.visualType as string | null) || "none";
    if (!visBuckets.has(vt)) visBuckets.set(vt, []);
    visBuckets.get(vt)!.push(d);
  }
  const byVisualType = Array.from(visBuckets.entries())
    .map(([type, drafts]) => ({ type, count: drafts.length, ...avgResForDrafts(drafts) }))
    .sort((a, b) => b.count - a.count);

  // By objective (with resonance)
  const objBuckets = new Map<string, typeof allDrafts>();
  for (const d of allDrafts) {
    const obj = d.objective || "Unknown";
    if (!objBuckets.has(obj)) objBuckets.set(obj, []);
    objBuckets.get(obj)!.push(d);
  }
  const byObjective = Array.from(objBuckets.entries())
    .map(([objective, drafts]) => ({ objective, count: drafts.length, ...avgResForDrafts(drafts) }))
    .sort((a, b) => b.count - a.count);

  // Top 5 by resonance (only those with perf data), include source + visual metadata
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
    contentSource: (d.contentSource as string | null) || "capture",
    visualType: (d.visualType as string | null) || "none",
    publishedAt: d.updatedAt.toISOString(),
  }));

  // Weekly trend — last 13 weeks (90 days), with 30/60/90-day totals
  const now = new Date();
  const cutoffs = { 30: new Date(now.getTime() - 30 * 86400000), 60: new Date(now.getTime() - 60 * 86400000), 90: new Date(now.getTime() - 91 * 86400000) };
  const weekMap = new Map<string, number>();
  for (const d of allDrafts) {
    if (d.createdAt < cutoffs[90]) continue;
    const date = new Date(d.createdAt);
    const jan1 = new Date(date.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((date.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
    const key = `${date.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
    weekMap.set(key, (weekMap.get(key) ?? 0) + 1);
  }
  const weeklyTrend = Array.from(weekMap.entries())
    .map(([week, count]) => ({ week, count }))
    .sort((a, b) => a.week.localeCompare(b.week));

  // Weekly resonance trend — avg resonance per week (only weeks with ≥2 performance samples)
  const weekResMap = new Map<string, number[]>();
  for (const d of allDrafts) {
    const r = resonanceOf(d.id);
    if (r === null || d.createdAt < cutoffs[90]) continue;
    const date = new Date(d.createdAt);
    const jan1 = new Date(date.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((date.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
    const key = `${date.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
    if (!weekResMap.has(key)) weekResMap.set(key, []);
    weekResMap.get(key)!.push(r);
  }
  const weeklyResonanceTrend = Array.from(weekResMap.entries())
    .filter(([, vals]) => vals.length >= 2)
    .map(([week, vals]) => ({ week, avgResonance: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length), sampleCount: vals.length }))
    .sort((a, b) => a.week.localeCompare(b.week));

  // 30/60/90-day counts
  const last30 = allDrafts.filter(d => d.createdAt >= cutoffs[30]).length;
  const last60 = allDrafts.filter(d => d.createdAt >= cutoffs[60]).length;
  const last90 = allDrafts.filter(d => d.createdAt >= cutoffs[90]).length;

  const result = AnalyticsOverviewResponse.parse({
    totalPublished,
    avgResonance,
    loggedPerformanceCount,
    byTone,
    byContentSource,
    byVisualType,
    byObjective,
    topPosts,
    weeklyTrend,
    weeklyResonanceTrend,
    last30,
    last60,
    last90,
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

router.get("/analytics/resonance-map", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const publishedDrafts = await db
    .select({ id: draftsTable.id })
    .from(draftsTable)
    .where(and(eq(draftsTable.userId, userId), eq(draftsTable.status, "published")));

  if (publishedDrafts.length === 0) {
    res.json({});
    return;
  }

  const draftIds = publishedDrafts.map((d) => d.id);
  const signals = await db
    .select()
    .from(performanceSignalsTable)
    .where(inArray(performanceSignalsTable.draftId, draftIds));

  const map: Record<number, number> = {};
  for (const s of signals) {
    const w = s.reactions * 3 + s.comments * 5 + s.reposts * 4;
    let score: number;
    if (s.impressions > 0) {
      score = Math.min(100, Math.round((w / s.impressions) * 1000));
    } else if (w === 0) {
      score = 0;
    } else {
      score = Math.min(100, Math.round(Math.log2(1 + w) * 12));
    }
    map[s.draftId] = score;
  }

  res.json(map);
});

export default router;
