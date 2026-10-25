import { checkGenericPatterns, computeEditPercent } from "./authenticity-check.js";

// Rule-based, no AI call. Answers "did my reach change, when, and what do the
// posts that did better have in common?" from the author's own measured posts.
// Everything here is correlation on small samples, and the wording of the
// findings says so — it never claims to know why LinkedIn distributed a post.

export interface DiagnosisPost {
  id: number;
  postedAt: Date;
  impressions: number;
  reactions: number;
  comments: number;
  reposts: number;
  saves: number;
  sends: number;
  text: string | null;
  aiOriginalText: string | null;
  hasVisual: boolean;
}

// Dates LinkedIn itself has documented a feed change (engineering post, and
// the AI-slop classifier announcement). Not a list of "algorithm updates".
export const PLATFORM_EVENTS: Array<{ date: string; label: string }> = [
  { date: "2026-03-12", label: "LinkedIn's LLM feed rebuild" },
  { date: "2026-07-30", label: "LinkedIn's AI-slop classifiers" },
];

const MIN_PER_GROUP = 3;
const MIN_LIFT_TO_REPORT = 0.25;
const MIN_ERA_DROP_TO_REPORT = 0.3;
const RECENT_WINDOW = 5;
const CONCRETE_NUMBER = /\d/;

export interface EraSummary {
  label: string;
  from: string | null;
  to: string | null;
  posts: number;
  medianImpressions: number;
}

export interface SplitSummary {
  key: string;
  label: string;
  withLabel: string;
  withoutLabel: string;
  withPosts: number;
  withoutPosts: number;
  withMedian: number;
  withoutMedian: number;
  liftPct: number;
}

export interface PerformanceDiagnosis {
  postCount: number;
  eras: EraSummary[];
  recent: { posts: number; median: number; earlierPosts: number; earlierMedian: number; changePct: number } | null;
  splits: SplitSummary[];
  conversation: { commentsPer1000: number; savesPer1000: number; sendsPer1000: number; repostsPer1000: number } | null;
  findings: string[];
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function pctChange(from: number, to: number): number {
  return from > 0 ? Math.round(((to - from) / from) * 100) : 0;
}

function buildEras(posts: DiagnosisPost[]): EraSummary[] {
  const boundaries = PLATFORM_EVENTS.map((e) => ({ ...e, time: Date.parse(`${e.date}T00:00:00Z`) }));
  const eras: EraSummary[] = [];
  const edges = [{ label: "Start", time: -Infinity, date: null as string | null }, ...boundaries.map((b) => ({ label: b.label, time: b.time, date: b.date }))];
  for (let i = 0; i < edges.length; i++) {
    const start = edges[i]!;
    const next = edges[i + 1];
    const inEra = posts.filter((p) => p.postedAt.getTime() >= start.time && (!next || p.postedAt.getTime() < next.time));
    if (inEra.length === 0) continue;
    eras.push({
      label: i === 0 ? `Before ${next ? next.label : "any tracked change"}` : `After ${start.label}`,
      from: start.date,
      to: next?.date ?? null,
      posts: inEra.length,
      medianImpressions: median(inEra.map((p) => p.impressions)),
    });
  }
  return eras;
}

function split(
  posts: DiagnosisPost[],
  key: string,
  label: string,
  withLabel: string,
  withoutLabel: string,
  predicate: (p: DiagnosisPost) => boolean,
): SplitSummary | null {
  const withGroup = posts.filter(predicate);
  const withoutGroup = posts.filter((p) => !predicate(p));
  if (withGroup.length < MIN_PER_GROUP || withoutGroup.length < MIN_PER_GROUP) return null;
  const withMedian = median(withGroup.map((p) => p.impressions));
  const withoutMedian = median(withoutGroup.map((p) => p.impressions));
  return {
    key, label, withLabel, withoutLabel,
    withPosts: withGroup.length, withoutPosts: withoutGroup.length,
    withMedian, withoutMedian,
    liftPct: pctChange(withoutMedian, withMedian),
  };
}

export function diagnosePerformance(allPosts: DiagnosisPost[]): PerformanceDiagnosis {
  const posts = allPosts
    .filter((p) => p.impressions > 0 && !Number.isNaN(p.postedAt.getTime()))
    .sort((a, b) => a.postedAt.getTime() - b.postedAt.getTime());

  const findings: string[] = [];
  const eras = buildEras(posts);

  let recent: PerformanceDiagnosis["recent"] = null;
  if (posts.length >= RECENT_WINDOW + MIN_PER_GROUP) {
    const recentPosts = posts.slice(-RECENT_WINDOW);
    const earlier = posts.slice(0, -RECENT_WINDOW);
    const recentMedian = median(recentPosts.map((p) => p.impressions));
    const earlierMedian = median(earlier.map((p) => p.impressions));
    recent = {
      posts: recentPosts.length,
      median: recentMedian,
      earlierPosts: earlier.length,
      earlierMedian,
      changePct: pctChange(earlierMedian, recentMedian),
    };
    if (recent.changePct <= -MIN_ERA_DROP_TO_REPORT * 100) {
      findings.push(`Your last ${recent.posts} posts reached a median of ${recentMedian.toLocaleString("en-GB")} impressions, ${Math.abs(recent.changePct)}% below the ${earlierMedian.toLocaleString("en-GB")} of the ${recent.earlierPosts} before.`);
    }
  }

  for (let i = 1; i < eras.length; i++) {
    const prev = eras[i - 1]!;
    const cur = eras[i]!;
    if (prev.posts >= MIN_PER_GROUP && cur.posts >= MIN_PER_GROUP && prev.medianImpressions > 0) {
      const change = pctChange(prev.medianImpressions, cur.medianImpressions);
      if (change <= -MIN_ERA_DROP_TO_REPORT * 100) {
        findings.push(`Median reach fell ${Math.abs(change)}% across ${cur.label.replace("After ", "")} (${cur.from}). That timing lines up with the change, but it can't prove it was the cause.`);
      }
    }
  }

  const splits = [
    split(posts, "numbers", "Specific numbers", "Has a number", "No numbers", (p) => !!p.text && CONCRETE_NUMBER.test(p.text)),
    split(posts, "generic", "Generic patterns", "Flagged as generic", "Not flagged", (p) => !!p.text && checkGenericPatterns(p.text).length > 0),
    split(posts, "edited", "Your edits to the AI draft", "Edited 25%+", "Under 25% edited", (p) => {
      const pct = p.text ? computeEditPercent(p.aiOriginalText, p.text) : null;
      return pct !== null && pct >= 0.25;
    }),
    split(posts, "length", "Length", "Over 200 words", "200 words or fewer", (p) => !!p.text && wordCount(p.text) > 200),
    split(posts, "visual", "Visual", "Has a visual", "Text only", (p) => p.hasVisual),
  ].filter((s): s is SplitSummary => s !== null);

  for (const s of splits) {
    if (Math.abs(s.liftPct) >= MIN_LIFT_TO_REPORT * 100) {
      const better = s.liftPct > 0 ? s.withLabel : s.withoutLabel;
      const worse = s.liftPct > 0 ? s.withoutLabel : s.withLabel;
      findings.push(`${s.label}: "${better}" posts reached a median ${Math.abs(s.liftPct)}% more than "${worse}" posts (${s.withPosts} vs ${s.withoutPosts} posts).`);
    }
  }

  const totalImpressions = posts.reduce((sum, p) => sum + p.impressions, 0);
  const per1000 = (sum: number) => Math.round((sum / totalImpressions) * 10000) / 10;
  const conversation = totalImpressions > 0
    ? {
      commentsPer1000: per1000(posts.reduce((s, p) => s + p.comments, 0)),
      savesPer1000: per1000(posts.reduce((s, p) => s + p.saves, 0)),
      sendsPer1000: per1000(posts.reduce((s, p) => s + p.sends, 0)),
      repostsPer1000: per1000(posts.reduce((s, p) => s + p.reposts, 0)),
    }
    : null;

  if (posts.length < MIN_PER_GROUP * 2) {
    findings.push(`Only ${posts.length} measured posts so far — upload more LinkedIn exports before reading much into any of this.`);
  } else if (findings.length === 0) {
    findings.push("No clear step change or standout pattern in your measured posts yet.");
  }

  return { postCount: posts.length, eras, recent, splits, conversation, findings };
}
