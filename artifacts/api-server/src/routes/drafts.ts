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
  GetAnalyticsOverviewResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middleware/auth.js";
import { extractVoiceDNA } from "./ai.js";
import { upsertDailyActivity } from "../lib/momentum.js";

const router: IRouter = Router();

function normalizeDraft<T extends { structuredBreakdown: unknown }>(draft: T): T {
  if (!draft.structuredBreakdown || typeof draft.structuredBreakdown !== "object") return draft;
  const sb = draft.structuredBreakdown as Record<string, unknown>;
  if (Array.isArray(sb.hooks)) {
    sb.hooks = sb.hooks.map((h: unknown) =>
      typeof h === "string" ? { text: h } : h
    );
  }
  if (Array.isArray(sb.narrativeFlow)) {
    sb.narrativeFlow = sb.narrativeFlow.map((n: unknown) =>
      typeof n === "string" ? n : String(n)
    );
  }
  return draft;
}

router.get("/drafts", requireAuth, async (req, res): Promise<void> => {
  const drafts = await db
    .select()
    .from(draftsTable)
    .where(eq(draftsTable.userId, req.user!.userId))
    .orderBy(desc(draftsTable.createdAt));

  const normalized = drafts.map(normalizeDraft);
  const parsed: unknown[] = [];
  for (const draft of normalized) {
    const result = ListDraftsResponse.element.safeParse(draft);
    if (result.success) {
      parsed.push(result.data);
    } else {
      console.warn(`Skipping malformed draft id=${draft.id}:`, result.error.issues.map(i => i.message).join(", "));
    }
  }
  res.json(parsed);
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

  res.json(GetDraftResponse.parse(normalizeDraft(draft)));
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

  res.json(UpdateDraftResponse.parse(normalizeDraft(draft)));

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
  const windowDays = req.query["window"] === "30" ? 30 : req.query["window"] === "60" ? 60 : 90;

  const allDrafts = await db
    .select()
    .from(draftsTable)
    .where(and(eq(draftsTable.userId, userId), eq(draftsTable.status, "published")))
    .orderBy(desc(draftsTable.createdAt));

  const totalPublished = allDrafts.length;

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

  const engagementRateOf = (draftId: number): number | null => {
    const p = perfMap.get(draftId);
    if (!p || p.impressions === 0) return null;
    return Math.round(((p.reactions + p.comments) / p.impressions) * 10000) / 100;
  };

  const resonanceValues = allDrafts.map(d => resonanceOf(d.id)).filter((v): v is number => v !== null);
  const avgResonance = resonanceValues.length > 0
    ? Math.round(resonanceValues.reduce((a, b) => a + b, 0) / resonanceValues.length)
    : 0;

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

  const avgResForDrafts = (drafts: typeof allDrafts) => {
    const vals = drafts.map(d => resonanceOf(d.id)).filter((v): v is number => v !== null);
    return { avgResonance: vals.length >= 2 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null, sampledCount: vals.length };
  };

  const srcBuckets = new Map<string, typeof allDrafts>();
  for (const d of allDrafts) {
    const src = (d.contentSource as string | null) || "capture";
    if (!srcBuckets.has(src)) srcBuckets.set(src, []);
    srcBuckets.get(src)!.push(d);
  }
  const byContentSource = Array.from(srcBuckets.entries())
    .map(([source, drafts]) => ({ source, count: drafts.length, ...avgResForDrafts(drafts) }))
    .sort((a, b) => b.count - a.count);

  const visBuckets = new Map<string, typeof allDrafts>();
  for (const d of allDrafts) {
    const vt = (d.visualType as string | null) || "none";
    if (!visBuckets.has(vt)) visBuckets.set(vt, []);
    visBuckets.get(vt)!.push(d);
  }
  const byVisualType = Array.from(visBuckets.entries())
    .map(([type, drafts]) => ({ type, count: drafts.length, ...avgResForDrafts(drafts) }))
    .sort((a, b) => b.count - a.count);

  const objBuckets = new Map<string, typeof allDrafts>();
  for (const d of allDrafts) {
    const obj = d.objective || "Unknown";
    if (!objBuckets.has(obj)) objBuckets.set(obj, []);
    objBuckets.get(obj)!.push(d);
  }
  const byObjective = Array.from(objBuckets.entries())
    .map(([objective, drafts]) => ({ objective, count: drafts.length, ...avgResForDrafts(drafts) }))
    .sort((a, b) => b.count - a.count);

  const withResonance = allDrafts
    .map(d => ({ d, r: resonanceOf(d.id) }))
    .filter((x): x is { d: typeof allDrafts[0]; r: number } => x.r !== null)
    .sort((a, b) => b.r - a.r)
    .slice(0, 5);
  const topPosts = withResonance.map(({ d, r }) => ({
    id: d.id,
    topic: ((d.structuredBreakdown as Record<string, unknown>)?.topic as string | undefined) ?? "Untitled",
    resonance: r,
    engagementRate: engagementRateOf(d.id),
    tone: d.tone,
    contentSource: (d.contentSource as string | null) || "capture",
    visualType: (d.visualType as string | null) || "none",
    publishedAt: d.updatedAt.toISOString(),
  }));

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

  const last30 = allDrafts.filter(d => d.createdAt >= cutoffs[30]).length;
  const last60 = allDrafts.filter(d => d.createdAt >= cutoffs[60]).length;
  const last90 = allDrafts.filter(d => d.createdAt >= cutoffs[90]).length;

  // ── Time-windowed analytics (respects ?window param) ──────────────────────
  const windowMs = windowDays * 86400000;
  const windowStart = new Date(now.getTime() - windowMs);
  const priorStart = new Date(now.getTime() - windowMs * 2);
  const windowDrafts = allDrafts.filter(d => d.createdAt >= windowStart);
  const priorDrafts = allDrafts.filter(d => d.createdAt >= priorStart && d.createdAt < windowStart);

  const trendDir = (curr: number | null, prior: number | null): "up" | "down" | "flat" | null => {
    if (curr === null || prior === null) return null;
    if (prior === 0 && curr === 0) return "flat";
    if (prior === 0) return "up";
    const change = (curr - prior) / prior;
    if (change > 0.05) return "up";
    if (change < -0.05) return "down";
    return "flat";
  };

  const avgResOf = (drafts: typeof allDrafts): number | null => {
    const vals = drafts.map(d => resonanceOf(d.id)).filter((v): v is number => v !== null);
    return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  };

  const avgEngRateOf = (drafts: typeof allDrafts): number | null => {
    const vals = drafts.map(d => engagementRateOf(d.id)).filter((v): v is number => v !== null);
    return vals.length > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : null;
  };

  const currAvgRes = avgResOf(windowDrafts);
  const priorAvgRes = avgResOf(priorDrafts);
  const currEngRate = avgEngRateOf(windowDrafts);
  const priorEngRate = avgEngRateOf(priorDrafts);

  const kpiTrends = {
    avgResonance: { current: currAvgRes, prior: priorAvgRes, trend: trendDir(currAvgRes, priorAvgRes) },
    totalPublished: { current: windowDrafts.length, prior: priorDrafts.length, trend: trendDir(windowDrafts.length, priorDrafts.length) },
    avgEngagementRate: { current: currEngRate, prior: priorEngRate, trend: trendDir(currEngRate, priorEngRate) },
  };

  const avgEngagementRate = currEngRate;

  // Posting consistency
  const computeConsistency = (drafts: typeof allDrafts): number | null => {
    if (drafts.length < 2) return null;
    const sorted = [...drafts].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push((sorted[i].createdAt.getTime() - sorted[i - 1].createdAt.getTime()) / 86400000);
    }
    return Math.round((gaps.reduce((a, b) => a + b, 0) / gaps.length) * 10) / 10;
  };
  const currConsistency = computeConsistency(windowDrafts);
  const priorConsistency = computeConsistency(priorDrafts);
  // "improved" means posting MORE frequently (smaller gap), so invert for trend direction
  const postingConsistency = {
    avgDaysBetweenPosts: currConsistency,
    prior: priorConsistency,
    trend: trendDir(
      currConsistency !== null ? -currConsistency : null,
      priorConsistency !== null ? -priorConsistency : null
    ) as "up" | "down" | "flat" | null,
  };

  // Best time to post
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const timeBlock = (hour: number): string => {
    if (hour >= 6 && hour <= 11) return "Morning";
    if (hour >= 12 && hour <= 13) return "Midday";
    if (hour >= 14 && hour <= 17) return "Afternoon";
    if (hour >= 18 && hour <= 21) return "Evening";
    return "Night";
  };

  const timeCells = new Map<string, { resonances: number[]; count: number }>();
  const dayMap = new Map<string, { resonances: number[]; count: number }>();
  const blockMap = new Map<string, { resonances: number[]; count: number }>();

  for (const d of windowDrafts) {
    const r = resonanceOf(d.id);
    const date = new Date(d.createdAt);
    const day = DAY_NAMES[date.getDay()] ?? "Unknown";
    const block = timeBlock(date.getHours());
    const cellKey = `${day}|${block}`;

    if (!timeCells.has(cellKey)) timeCells.set(cellKey, { resonances: [], count: 0 });
    const cell = timeCells.get(cellKey)!;
    cell.count++;
    if (r !== null) cell.resonances.push(r);

    if (!dayMap.has(day)) dayMap.set(day, { resonances: [], count: 0 });
    const de = dayMap.get(day)!;
    de.count++;
    if (r !== null) de.resonances.push(r);

    if (!blockMap.has(block)) blockMap.set(block, { resonances: [], count: 0 });
    const be = blockMap.get(block)!;
    be.count++;
    if (r !== null) be.resonances.push(r);
  }

  const byDayOfWeek = DAY_NAMES
    .map(day => {
      const e = dayMap.get(day);
      if (!e) return null;
      return {
        day,
        count: e.count,
        avgResonance: e.resonances.length >= 2 ? Math.round(e.resonances.reduce((a, b) => a + b, 0) / e.resonances.length) : null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const TIME_BLOCK_ORDER = ["Morning", "Midday", "Afternoon", "Evening", "Night"];
  const byTimeBlock = TIME_BLOCK_ORDER
    .map(block => {
      const e = blockMap.get(block);
      if (!e) return null;
      return {
        block,
        count: e.count,
        avgResonance: e.resonances.length >= 2 ? Math.round(e.resonances.reduce((a, b) => a + b, 0) / e.resonances.length) : null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  let topCombination: { day: string; block: string; avgResonance: number } | null = null;
  let bestCellRes = -1;
  for (const [key, { resonances, count }] of timeCells.entries()) {
    if (count < 2 || resonances.length < 2) continue;
    const avg = Math.round(resonances.reduce((a, b) => a + b, 0) / resonances.length);
    if (avg > bestCellRes) {
      bestCellRes = avg;
      const parts = key.split("|");
      topCombination = { day: parts[0] ?? "", block: parts[1] ?? "", avgResonance: avg };
    }
  }

  const bestTimeToPost = { byDayOfWeek, byTimeBlock, topCombination };

  // Hashtag performance
  const hashtagMap = new Map<string, { resonances: number[]; count: number }>();
  for (const d of windowDrafts) {
    if (!d.postOutput) continue;
    const tags = [...d.postOutput.matchAll(/#([A-Za-z][A-Za-z0-9_]*)/g)].map(m => m[1]!.toLowerCase());
    const r = resonanceOf(d.id);
    for (const tag of new Set(tags)) {
      if (!hashtagMap.has(tag)) hashtagMap.set(tag, { resonances: [], count: 0 });
      const e = hashtagMap.get(tag)!;
      e.count++;
      if (r !== null) e.resonances.push(r);
    }
  }
  const hashtagPerformance = Array.from(hashtagMap.entries())
    .map(([hashtag, { resonances, count }]) => ({
      hashtag,
      count,
      avgResonance: resonances.length >= 2 ? Math.round(resonances.reduce((a, b) => a + b, 0) / resonances.length) : null,
    }))
    .sort((a, b) => (b.avgResonance ?? -1) - (a.avgResonance ?? -1) || b.count - a.count)
    .slice(0, 10);

  // Media format breakdown (LinkedIn shareMediaCategory)
  const fmtBuckets = new Map<string, typeof allDrafts>();
  for (const d of windowDrafts) {
    const fmt = (d.mediaFormat as string | null) || "NONE";
    if (!fmtBuckets.has(fmt)) fmtBuckets.set(fmt, []);
    fmtBuckets.get(fmt)!.push(d);
  }
  const byMediaFormat = Array.from(fmtBuckets.entries())
    .map(([format, drafts]) => ({ format, count: drafts.length, ...avgResForDrafts(drafts) }))
    .sort((a, b) => b.count - a.count);

  const result = GetAnalyticsOverviewResponse.parse({
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
    kpiTrends,
    avgEngagementRate,
    postingConsistency,
    bestTimeToPost,
    hashtagPerformance,
    byMediaFormat,
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
