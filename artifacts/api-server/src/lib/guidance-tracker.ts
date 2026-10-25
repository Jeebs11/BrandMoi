import { PLATFORM_EVENTS } from "./performance-diagnosis.js";

// "Is the learning helping?" Guidance switches on once enough of the author's
// posts have measured results (3 for performance history, 6 for learned
// structure, 8 for best-post style targets). This dates each switch-on from
// when the Nth measured post was logged and compares posts written before and
// after. It is a before/after on a few posts with other things changing at the
// same time (LinkedIn's feed, topic, season), so it never claims credit.

export interface TrackedPost {
  postedAt: Date;
  loggedAt: Date;
  impressions: number;
}

export interface GuidanceStage {
  key: "performance_history" | "learned_patterns" | "style_targets";
  label: string;
  minMeasuredPosts: number;
}

export const STAGES: GuidanceStage[] = [
  { key: "performance_history", label: "Performance history in the writing prompt", minMeasuredPosts: 3 },
  { key: "learned_patterns", label: "Learned structural patterns", minMeasuredPosts: 6 },
  { key: "style_targets", label: "Style targets from your best posts", minMeasuredPosts: 8 },
];

export type StageStatus = "inactive" | "undatable" | "too_early" | "tracking";

export interface StageResult {
  key: GuidanceStage["key"];
  label: string;
  status: StageStatus;
  minMeasuredPosts: number;
  activatedAt: string | null;
  before: { posts: number; medianImpressions: number } | null;
  after: { posts: number; medianImpressions: number } | null;
  changePct: number | null;
  caveats: string[];
}

const MIN_PER_SIDE = 3;
const BULK_LOGGING_DAYS = 2;
const DAY = 86400000;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

export function trackGuidance(allPosts: TrackedPost[], now: Date = new Date()): StageResult[] {
  const posts = allPosts.filter((p) => p.impressions > 0 && !Number.isNaN(p.postedAt.getTime()) && !Number.isNaN(p.loggedAt.getTime()));
  const byLogged = [...posts].sort((a, b) => a.loggedAt.getTime() - b.loggedAt.getTime());

  return STAGES.map((stage): StageResult => {
    const base = {
      key: stage.key, label: stage.label, minMeasuredPosts: stage.minMeasuredPosts,
      activatedAt: null, before: null, after: null, changePct: null, caveats: [] as string[],
    };
    if (byLogged.length < stage.minMeasuredPosts) return { ...base, status: "inactive" };

    const first = byLogged[0]!.loggedAt;
    const activated = byLogged[stage.minMeasuredPosts - 1]!.loggedAt;
    const dated = { ...base, activatedAt: activated.toISOString() };

    // Results logged in one sitting can't tell us when the guidance began.
    if ((activated.getTime() - first.getTime()) / DAY < BULK_LOGGING_DAYS) {
      return { ...dated, status: "undatable", caveats: ["Your results were logged in one go, so there's no way to tell when this guidance began."] };
    }

    const before = posts.filter((p) => p.postedAt < activated);
    const after = posts.filter((p) => p.postedAt >= activated);
    if (before.length < MIN_PER_SIDE || after.length < MIN_PER_SIDE) {
      return {
        ...dated, status: "too_early",
        before: { posts: before.length, medianImpressions: before.length ? median(before.map((p) => p.impressions)) : 0 },
        after: { posts: after.length, medianImpressions: after.length ? median(after.map((p) => p.impressions)) : 0 },
        caveats: [`Needs at least ${MIN_PER_SIDE} posts on each side of the start date (you have ${before.length} before, ${after.length} after).`],
      };
    }

    const beforeMedian = median(before.map((p) => p.impressions));
    const afterMedian = median(after.map((p) => p.impressions));
    const caveats = PLATFORM_EVENTS
      .filter((e) => {
        const t = Date.parse(`${e.date}T00:00:00Z`);
        return t >= activated.getTime() && t <= now.getTime();
      })
      .map((e) => `${e.label} (${e.date}) falls inside this window, so a change here can't be credited to the guidance.`);

    return {
      ...dated,
      status: "tracking",
      before: { posts: before.length, medianImpressions: beforeMedian },
      after: { posts: after.length, medianImpressions: afterMedian },
      changePct: beforeMedian > 0 ? Math.round(((afterMedian - beforeMedian) / beforeMedian) * 100) : null,
      caveats,
    };
  });
}
