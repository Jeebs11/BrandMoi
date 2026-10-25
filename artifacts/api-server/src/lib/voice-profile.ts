import { eq, and, desc } from "drizzle-orm";
import { db, draftsTable, performanceSignalsTable, preferencesTable } from "@workspace/db";
import {
  MIN_SAMPLES, MIN_WORDS, computeMetrics, matchScore, meanMetrics, styleTargetsText, winnerInsights, wordCount,
  type RawMetrics, type WinnerInsight,
} from "./voice-fingerprint.js";

export interface VoicePost {
  id: number;
  date: Date;
  text: string;
  aiOriginal: string | null;
  impressions: number | null;
}

export interface VoiceProfile {
  samples: number;
  words: number;
  /** Mean shape across everything you've published or pinned. */
  average: RawMetrics | null;
  /** Mean shape of your best-performing third (needs 8+ measured posts). */
  winners: RawMetrics | null;
  rest: RawMetrics | null;
  insights: WinnerInsight[];
  measuredPosts: number;
  /** What drafts are matched against: winners when we have them, else the average. */
  target: { basis: "best-performing" | "published"; raw: RawMetrics } | null;
  baseline: { kind: "hand-written" | "earliest"; posts: number; raw: RawMetrics } | null;
  drift: {
    points: Array<{ id: number; date: string; match: number; aiAssisted: boolean }>;
    assistedAvg: number | null;
    handwrittenAvg: number | null;
    assistedCount: number;
    handwrittenCount: number;
  } | null;
}

const MIN_MEASURED_FOR_WINNERS = 8;
const EARLIEST_BASELINE_POSTS = 5;

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

function usable(texts: string[]): { metrics: RawMetrics[]; words: number } {
  const metrics: RawMetrics[] = [];
  let words = 0;
  for (const text of texts) {
    const m = computeMetrics(text);
    if (m) { metrics.push(m); words += wordCount(text); }
  }
  return { metrics, words };
}

function enough(u: { metrics: RawMetrics[]; words: number }): boolean {
  return u.metrics.length >= MIN_SAMPLES && u.words >= MIN_WORDS;
}

export function buildVoiceProfile(posts: VoicePost[], pinned: string[]): VoiceProfile {
  const chronological = [...posts].sort((a, b) => a.date.getTime() - b.date.getTime());
  const all = usable([...pinned, ...chronological.map((p) => p.text)]);
  const average = enough(all) ? meanMetrics(all.metrics) : null;

  // Winners vs the rest, by impressions.
  const measured = chronological
    .filter((p) => (p.impressions ?? 0) > 0)
    .map((p) => ({ post: p, metrics: computeMetrics(p.text) }))
    .filter((x): x is { post: VoicePost; metrics: RawMetrics } => x.metrics !== null)
    .sort((a, b) => (b.post.impressions ?? 0) - (a.post.impressions ?? 0));
  let winners: RawMetrics | null = null;
  let rest: RawMetrics | null = null;
  let insights: WinnerInsight[] = [];
  if (measured.length >= MIN_MEASURED_FOR_WINNERS) {
    const topN = Math.max(3, Math.ceil(measured.length / 3));
    winners = meanMetrics(measured.slice(0, topN).map((x) => x.metrics));
    rest = meanMetrics(measured.slice(topN).map((x) => x.metrics));
    if (winners && rest) insights = winnerInsights(winners, rest);
  }

  const target = winners
    ? { basis: "best-performing" as const, raw: winners }
    : average
      ? { basis: "published" as const, raw: average }
      : null;

  // Baseline: writing that didn't start as an AI draft, else your earliest posts.
  const handwritten = chronological.filter((p) => !p.aiOriginal?.trim());
  const handUsable = usable([...pinned, ...handwritten.map((p) => p.text)]);
  let baseline: VoiceProfile["baseline"] = null;
  if (enough(handUsable)) {
    baseline = { kind: "hand-written", posts: handUsable.metrics.length, raw: meanMetrics(handUsable.metrics)! };
  } else {
    const earliest = usable(chronological.slice(0, EARLIEST_BASELINE_POSTS).map((p) => p.text));
    if (enough(earliest)) baseline = { kind: "earliest", posts: earliest.metrics.length, raw: meanMetrics(earliest.metrics)! };
  }

  let drift: VoiceProfile["drift"] = null;
  if (baseline) {
    const points = chronological
      .map((p) => ({ p, m: computeMetrics(p.text) }))
      .filter((x): x is { p: VoicePost; m: RawMetrics } => x.m !== null)
      .map(({ p, m }) => ({
        id: p.id,
        date: p.date.toISOString(),
        match: matchScore(m, baseline!.raw),
        aiAssisted: !!p.aiOriginal?.trim(),
      }));
    const assisted = points.filter((x) => x.aiAssisted);
    const hand = points.filter((x) => !x.aiAssisted);
    drift = {
      points,
      assistedAvg: avg(assisted.map((x) => x.match)),
      handwrittenAvg: avg(hand.map((x) => x.match)),
      assistedCount: assisted.length,
      handwrittenCount: hand.length,
    };
  }

  return { samples: all.metrics.length, words: all.words, average, winners, rest, insights, measuredPosts: measured.length, target, baseline, drift };
}

export async function loadVoiceInputs(userId: number): Promise<{ posts: VoicePost[]; pinned: string[] }> {
  const [rows, [prefs]] = await Promise.all([
    db
      .select({ draft: draftsTable, signal: performanceSignalsTable })
      .from(draftsTable)
      .leftJoin(performanceSignalsTable, eq(performanceSignalsTable.draftId, draftsTable.id))
      .where(and(eq(draftsTable.userId, userId), eq(draftsTable.status, "published")))
      .orderBy(desc(draftsTable.createdAt)),
    db.select({ writingSamples: preferencesTable.writingSamples }).from(preferencesTable).where(eq(preferencesTable.userId, userId)).limit(1),
  ]);

  const posts: VoicePost[] = rows
    .filter(({ draft }) => !!draft.postOutput)
    .map(({ draft, signal }) => {
      const exportDate = signal?.linkedinPostDate ? new Date(signal.linkedinPostDate) : null;
      return {
        id: draft.id,
        date: exportDate && !Number.isNaN(exportDate.getTime()) ? exportDate : draft.createdAt,
        text: draft.postOutput as string,
        aiOriginal: draft.aiOriginalPost,
        impressions: signal?.impressions ?? null,
      };
    });
  return { posts, pinned: ((prefs?.writingSamples ?? []) as string[]).filter((s) => typeof s === "string") };
}

export async function getVoiceProfile(userId: number): Promise<VoiceProfile> {
  const { posts, pinned } = await loadVoiceInputs(userId);
  return buildVoiceProfile(posts, pinned);
}

/** Style-target prompt block, or "" when there isn't enough of the author's writing yet. */
export async function getStyleTargetsPrompt(userId: number): Promise<string> {
  try {
    const profile = await getVoiceProfile(userId);
    return profile.target ? styleTargetsText(profile.target.raw, profile.target.basis) : "";
  } catch {
    return "";
  }
}
