import { eq, and, desc, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import { rankedResonance } from "./resonance.js";
import { checkGenericPatterns } from "./authenticity-check.js";
import {
  draftsTable,
  performanceSignalsTable,
  voiceSuggestionsTable,
  ideaFeedbackTable,
  preferencesTable,
} from "@workspace/db";

// Shared resonance formula (same as routes/ai.ts) — kept here so learned
// pattern analysis ranks posts the same way the rest of the app does.
export function resonanceScore(s: {
  impressions: number;
  reactions: number;
  comments: number;
  reposts: number;
  saves?: number;
  membersReached?: number;
}): number {
  const w = s.reactions * 3 + s.comments * 5 + s.reposts * 4 + (s.saves ?? 0) * 8;
  const reach = (s.membersReached ?? 0) > 0 ? (s.membersReached ?? 0) : s.impressions;
  if (reach > 0) return Math.min(100, Math.round((w / reach) * 1000));
  if (w === 0) return 0;
  return Math.min(100, Math.round(Math.log2(1 + w) * 12));
}

export function isAcceptedSuggestionCurrent(field: string, currentValue: unknown, suggestedValue: string): boolean {
  const normalise = (value: unknown) => {
    const values = field === "contentPillars"
      ? (Array.isArray(value) ? value : String(value ?? "").split(","))
      : [value];
    return values
      .map((item) => String(item).trim().toLowerCase())
      .filter(Boolean)
      .sort()
      .join(",");
  };

  return normalise(currentValue) === normalise(suggestedValue);
}

/**
 * Feedback the user has explicitly given — accepted voice suggestions and
 * liked/disliked idea directions. Injected into generation prompts so the
 * agent's output actually changes as the user teaches it.
 */
export async function buildFeedbackContext(userId: number): Promise<string> {
  const [[prefs], acceptedSuggestions, ideaFeedback, draftFeedback] = await Promise.all([
    db.select().from(preferencesTable).where(eq(preferencesTable.userId, userId)).limit(1),
    db.select()
      .from(voiceSuggestionsTable)
      .where(and(eq(voiceSuggestionsTable.userId, userId), eq(voiceSuggestionsTable.status, "accepted")))
      .orderBy(desc(voiceSuggestionsTable.createdAt))
      .limit(5),
    db.select()
      .from(ideaFeedbackTable)
      .where(eq(ideaFeedbackTable.userId, userId))
      .orderBy(desc(ideaFeedbackTable.createdAt))
      .limit(30),
    db.select({ authenticityFeedback: draftsTable.authenticityFeedback })
      .from(draftsTable)
      .where(and(eq(draftsTable.userId, userId), inArray(draftsTable.authenticityFeedback, ["sounds_like_me", "too_generic", "needs_specificity", "too_polished"])))
      .orderBy(desc(draftsTable.updatedAt))
      .limit(20),
  ]);

  const parts: string[] = [];

  const activeAcceptedSuggestions = acceptedSuggestions.filter((suggestion) => {
    if (!prefs) return true;
    const currentValue = (prefs as Record<string, unknown>)[suggestion.field];
    // An accepted suggestion remains valid only while the profile still
    // contains the value the user accepted. A later manual edit wins.
    return isAcceptedSuggestionCurrent(suggestion.field, currentValue, suggestion.suggestedValue);
  });

  if (activeAcceptedSuggestions.length > 0) {
    const lines = ["## SECONDARY LEARNED VOICE ADJUSTMENTS (accepted by the user; current manual settings and direct feedback outrank these):"];
    for (const s of activeAcceptedSuggestions) {
      lines.push(`- ${s.field}: now "${s.suggestedValue}" (was "${s.currentValue}"). Why: ${s.rationale}`);
    }
    parts.push(lines.join("\n"));
  }

  const liked = ideaFeedback.filter((f) => f.signal === "like").slice(0, 8);
  const disliked = ideaFeedback.filter((f) => f.signal === "dislike").slice(0, 8);
  if (liked.length > 0 || disliked.length > 0) {
    const lines = ["## IDEA TASTE (signals from the user's likes/dislikes on suggested ideas):"];
    if (liked.length > 0) {
      lines.push("Liked directions (lean into these themes and angles):");
      lines.push(...liked.map((f) => `  ✓ ${f.ideaText.slice(0, 120)}`));
    }
    if (disliked.length > 0) {
      lines.push("Disliked directions (avoid these themes and angles):");
      lines.push(...disliked.map((f) => `  ✗ ${f.ideaText.slice(0, 120)}`));
    }
    parts.push(lines.join("\n"));
  }

  const feedbackCounts = draftFeedback.reduce<Record<string, number>>((counts, draft) => {
    if (draft.authenticityFeedback) {
      counts[draft.authenticityFeedback] = (counts[draft.authenticityFeedback] ?? 0) + 1;
    }
    return counts;
  }, {});
  const signals: string[] = [];
  if (feedbackCounts.too_generic) signals.push(`The author marked ${feedbackCounts.too_generic} recent draft${feedbackCounts.too_generic === 1 ? "" : "s"} as too generic — avoid vague claims, stock hooks, and boilerplate.`);
  if (feedbackCounts.needs_specificity) signals.push(`The author asked for more specificity on ${feedbackCounts.needs_specificity} recent draft${feedbackCounts.needs_specificity === 1 ? "" : "s"} — preserve concrete moments, names, numbers, and trade-offs from their raw input.`);
  if (feedbackCounts.too_polished) signals.push(`The author marked ${feedbackCounts.too_polished} recent draft${feedbackCounts.too_polished === 1 ? "" : "s"} as too polished — keep a more natural, direct voice rather than smoothing every edge.`);
  if (feedbackCounts.sounds_like_me) signals.push(`The author explicitly approved the voice on ${feedbackCounts.sounds_like_me} recent draft${feedbackCounts.sounds_like_me === 1 ? "" : "s"} — preserve that grounded, personal register.`);
  if (signals.length > 0) {
    parts.push(["## AUTHOR VOICE FEEDBACK (explicit signals from the author — honor these):", ...signals.map((signal) => `- ${signal}`)].join("\n"));
  }

  return parts.join("\n\n");
}

type StructuralStats = {
  avgWords: number;
  avgParagraphs: number;
  questionHookPct: number;
  shortHookPct: number;
  avgHookWords: number;
};

function analyzeStructure(posts: string[]): StructuralStats | null {
  if (posts.length === 0) return null;
  let words = 0;
  let paragraphs = 0;
  let questionHooks = 0;
  let shortHooks = 0;
  let hookWords = 0;
  for (const text of posts) {
    const t = text.trim();
    words += t.split(/\s+/).length;
    paragraphs += t.split(/\n\s*\n/).length;
    const hook = t.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "";
    const hw = hook.split(/\s+/).length;
    hookWords += hw;
    if (hook.includes("?")) questionHooks++;
    if (hw <= 8) shortHooks++;
  }
  const n = posts.length;
  return {
    avgWords: Math.round(words / n),
    avgParagraphs: Math.round((paragraphs / n) * 10) / 10,
    questionHookPct: Math.round((questionHooks / n) * 100),
    shortHookPct: Math.round((shortHooks / n) * 100),
    avgHookWords: Math.round((hookWords / n) * 10) / 10,
  };
}

/**
 * Hashtags that have historically resonated for this user — extracted from
 * measured published posts and ranked by average resonance. Injected into
 * generation so the AI prefers tags with a track record over generic ones.
 */
export async function buildTopHashtags(userId: number): Promise<string> {
  const drafts = await db
    .select({ id: draftsTable.id, postOutput: draftsTable.postOutput })
    .from(draftsTable)
    .where(and(eq(draftsTable.userId, userId), eq(draftsTable.status, "published")))
    .orderBy(desc(draftsTable.updatedAt))
    .limit(80);

  const withText = drafts.filter((d) => d.postOutput);
  if (withText.length === 0) return "";

  const signals = await db
    .select()
    .from(performanceSignalsTable)
    .where(inArray(performanceSignalsTable.draftId, withText.map((d) => d.id)));
  const perfMap = new Map(signals.map((s) => [s.draftId, s]));
  const ranks = rankedResonance(signals.map((signal) => ({ id: signal.draftId, signal })));

  const tagMap = new Map<string, { resonances: number[]; count: number }>();
  for (const d of withText) {
    const tags = [...d.postOutput!.matchAll(/#([A-Za-z][A-Za-z0-9_]*)/g)].map((m) => m[1]!.toLowerCase());
    const s = perfMap.get(d.id);
    const r = s ? (ranks.get(d.id) ?? resonanceScore(s)) : null;
    for (const tag of new Set(tags)) {
      if (!tagMap.has(tag)) tagMap.set(tag, { resonances: [], count: 0 });
      const e = tagMap.get(tag)!;
      e.count++;
      if (r !== null) e.resonances.push(r);
    }
  }

  // Only tags measured on 2+ posts carry signal worth acting on
  const ranked = [...tagMap.entries()]
    .map(([tag, { resonances, count }]) => ({
      tag,
      count,
      avg: resonances.length >= 2 ? Math.round(resonances.reduce((a, b) => a + b, 0) / resonances.length) : null,
    }))
    .filter((t) => t.avg !== null)
    .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))
    .slice(0, 5);

  if (ranked.length === 0) return "";

  return [
    "## PROVEN HASHTAGS (measured on this user's own posts — prefer these over generic tags when relevant; still cap at 1-3 tags total):",
    ...ranked.map((t) => `- #${t.tag} (avg rank ${t.avg}/100 among your posts, across ${t.count} posts)`),
  ].join("\n");
}

/**
 * Measured performance is useful for choosing strategic patterns, not for
 * replacing the author's current voice preferences.
 */
export async function buildPerformanceContext(userId: number): Promise<string> {
  const publishedDrafts = await db
    .select()
    .from(draftsTable)
    .where(and(eq(draftsTable.userId, userId), eq(draftsTable.status, "published")))
    .orderBy(desc(draftsTable.updatedAt))
    .limit(50);

  if (publishedDrafts.length === 0) return "";

  const signals = await db
    .select()
    .from(performanceSignalsTable)
    .where(inArray(performanceSignalsTable.draftId, publishedDrafts.map((draft) => draft.id)));

  if (signals.length < 3) return "";

  const perfMap = new Map(signals.map((signal) => [signal.draftId, signal]));
  // Percentile rank among this author's own posts (reach + engagement), so it
  // can't saturate and it sees a fall in reach, not just engagement per view.
  const ranks = rankedResonance(signals.map((signal) => ({ id: signal.draftId, signal })));
  const scored = publishedDrafts
    .map((draft) => {
      const signal = perfMap.get(draft.id);
      if (!signal) return null;
      const saveRate = signal.impressions > 0 ? ((signal.saves / signal.impressions) * 100).toFixed(1) : "0";
      return { draft, resonance: ranks.get(draft.id) ?? resonanceScore(signal), saveRate };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => b.resonance - a.resonance);

  if (scored.length < 3) return "";

  const top = scored.slice(0, Math.min(5, scored.length));
  const bottom = scored.slice(-Math.min(3, Math.floor(scored.length / 2)));
  const describePost = (entry: typeof scored[0]) => {
    const breakdown = entry.draft.structuredBreakdown as { topic?: string; feeling?: string; audience?: string } | null;
    const topic = breakdown?.topic ?? entry.draft.rawInput.slice(0, 50) ?? "unknown";
    const feeling = breakdown?.feeling ?? entry.draft.tone ?? "unknown";
    const audience = breakdown?.audience ?? entry.draft.objective ?? "unknown";
    const hook = (entry.draft.postOutput ?? "")
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 10)
      ?.slice(0, 110) ?? "";
    const base = `Topic: "${topic}" | ${feeling} | ${audience} | Rank among their posts: ${entry.resonance}/100 | Saves: ${entry.saveRate}%`;
    return hook ? `${base}\n    Structural reference: "${hook}"` : base;
  };

  return [
    "## PERFORMANCE HISTORY (strategy-only evidence — do not override direct author voice evidence). Rank = percentile among this author's own measured posts on reach and engagement; 100 is their best:",
    "HIGH RESONANCE — study the structural pattern and strategic framing; do NOT repeat the topic, claim, or exact wording:",
    ...top.map((entry) => `  ✓ ${describePost(entry)}`),
    ...(bottom.length > 0 ? [
      "LOW RESONANCE — avoid these structural patterns, not merely these topics:",
      ...bottom.map((entry) => `  ✗ ${describePost(entry)}`),
    ] : []),
  ].join("\n");
}

type PostFeatures = { words: number; paragraphs: number; hookWords: number; questionHook: number; shortHook: number };

function featuresOf(text: string): PostFeatures {
  const t = text.trim();
  const firstLine = t.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "";
  // The hook is the opening sentence, not a whole unbroken paragraph.
  const hook = firstLine.split(/(?<=[.!?])\s+/)[0] ?? firstLine;
  const hookWords = hook.split(/\s+/).length;
  return {
    words: t.split(/\s+/).length,
    paragraphs: t.split(/\n\s*\n/).length,
    hookWords,
    questionHook: hook.includes("?") ? 1 : 0,
    shortHook: hookWords <= 8 ? 1 : 0,
  };
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Standardised difference between two groups (Cohen's d). */
function effectSize(a: number[], b: number[]): number {
  const ma = mean(a);
  const mb = mean(b);
  const variance = (xs: number[], m: number) => xs.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, xs.length - 1);
  const pooled = Math.sqrt(((a.length - 1) * variance(a, ma) + (b.length - 1) * variance(b, mb)) / Math.max(1, a.length + b.length - 2));
  if (pooled < 1e-6) return ma === mb ? 0 : 5;
  return Math.min(5, (ma - mb) / pooled);
}

export type EvidenceConfidence = "high" | "medium";

/**
 * A pattern is only worth giving the model if the two groups are far enough
 * apart relative to how much posts vary, and each group has enough posts.
 * Below this bar it is noise, and the prompt gets nothing.
 */
export function numericConfidence(d: number, perGroup: number): EvidenceConfidence | null {
  const size = Math.abs(d);
  if (size >= 0.8 && perGroup >= 5) return "high";
  if (size >= 0.5 && perGroup >= 3) return "medium";
  return null;
}

export function shareConfidence(diffPoints: number, perGroup: number): EvidenceConfidence | null {
  const diff = Math.abs(diffPoints);
  if (diff >= 50 && perGroup >= 5) return "high";
  if (diff >= 30 && perGroup >= 4) return "medium";
  return null;
}

/**
 * Per-user learned structural patterns: compares the structure of this user's
 * best-ranked posts against their weakest and emits only the differences that
 * clear an evidence bar, each tagged with its sample size and confidence.
 */
export async function buildLearnedPatterns(userId: number): Promise<string> {
  const publishedDrafts = await db
    .select({ id: draftsTable.id, postOutput: draftsTable.postOutput })
    .from(draftsTable)
    .where(and(eq(draftsTable.userId, userId), eq(draftsTable.status, "published")))
    .orderBy(desc(draftsTable.updatedAt))
    .limit(60);

  const withText = publishedDrafts.filter((d) => d.postOutput && d.postOutput.trim().length > 80);
  if (withText.length < 6) return "";

  const signals = await db
    .select()
    .from(performanceSignalsTable)
    .where(inArray(performanceSignalsTable.draftId, withText.map((d) => d.id)));

  const ranks = rankedResonance(signals.map((signal) => ({ id: signal.draftId, signal })));
  const scored = withText
    .map((d) => {
      const rank = ranks.get(d.id);
      return rank === undefined ? null : { text: d.postOutput!, rank };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.rank - a.rank);

  if (scored.length < 6) return "";

  const groupSize = Math.max(3, Math.floor(scored.length / 3));
  const top = scored.slice(0, groupSize).map((x) => featuresOf(x.text));
  const bottom = scored.slice(-groupSize).map((x) => featuresOf(x.text));
  const col = (rows: PostFeatures[], key: keyof PostFeatures) => rows.map((r) => r[key]);
  const n = groupSize;

  const findings: string[] = [];
  const tag = (c: EvidenceConfidence) => `confidence: ${c}, ${n} best vs ${n} weakest`;

  // Beyond statistical consistency, the difference must be big enough to matter
  // in practice: 20% on length, a full paragraph, three words on a hook.
  const words = Math.abs(mean(col(top, "words")) - mean(col(bottom, "words"))) >= 0.2 * mean(col(bottom, "words"))
    ? numericConfidence(effectSize(col(top, "words"), col(bottom, "words")), n)
    : null;
  if (words) {
    const t = Math.round(mean(col(top, "words")));
    const b = Math.round(mean(col(bottom, "words")));
    findings.push(`Length: best posts ~${t} words vs weakest ~${b} (${tag(words)}) — aim for roughly ${t} words.`);
  }
  const paragraphs = Math.abs(mean(col(top, "paragraphs")) - mean(col(bottom, "paragraphs"))) >= 1
    ? numericConfidence(effectSize(col(top, "paragraphs"), col(bottom, "paragraphs")), n)
    : null;
  if (paragraphs) {
    const t = Math.round(mean(col(top, "paragraphs")) * 10) / 10;
    const b = Math.round(mean(col(bottom, "paragraphs")) * 10) / 10;
    findings.push(`Paragraphs: best posts ~${t} vs weakest ~${b} (${tag(paragraphs)}).`);
  }
  const hookLen = Math.abs(mean(col(top, "hookWords")) - mean(col(bottom, "hookWords"))) >= 3
    ? numericConfidence(effectSize(col(top, "hookWords"), col(bottom, "hookWords")), n)
    : null;
  if (hookLen) {
    const t = Math.round(mean(col(top, "hookWords")) * 10) / 10;
    const b = Math.round(mean(col(bottom, "hookWords")) * 10) / 10;
    findings.push(`Hook length: best posts ${t} words vs weakest ${b} (${tag(hookLen)}).`);
  }
  const questionDiff = (mean(col(top, "questionHook")) - mean(col(bottom, "questionHook"))) * 100;
  const questions = shareConfidence(questionDiff, n);
  if (questions) {
    findings.push(`${questionDiff > 0 ? "Question hooks" : "Statement hooks"} did better for this author (${tag(questions)}).`);
  }
  const shortDiff = (mean(col(top, "shortHook")) - mean(col(bottom, "shortHook"))) * 100;
  const shortHooks = shareConfidence(shortDiff, n);
  if (shortHooks) {
    findings.push(`${shortDiff > 0 ? "Short hooks (8 words or fewer)" : "Longer hooks (over 8 words)"} did better for this author (${tag(shortHooks)}).`);
  }

  if (findings.length === 0) return "";
  return [
    `## LEARNED STRUCTURAL PATTERNS (from this author's own ${scored.length} measured posts; only differences that clear an evidence bar are listed — treat "medium" as a nudge, not a rule):`,
    ...findings.map((f) => `- ${f}`),
  ].join("\n");
}

/**
 * Closes the loop on the pre-publish check: does the check's "generic" flag
 * actually predict weaker results for THIS author? Flags are recomputed from
 * each published post's text (they are deterministic), so nothing needs storing.
 */
export async function buildAuthenticityLearning(userId: number): Promise<string> {
  const published = await db
    .select({ id: draftsTable.id, postOutput: draftsTable.postOutput })
    .from(draftsTable)
    .where(and(eq(draftsTable.userId, userId), eq(draftsTable.status, "published")))
    .orderBy(desc(draftsTable.updatedAt))
    .limit(60);
  const withText = published.filter((d) => d.postOutput && d.postOutput.trim().length > 80);
  if (withText.length < 8) return "";

  const signals = await db
    .select()
    .from(performanceSignalsTable)
    .where(inArray(performanceSignalsTable.draftId, withText.map((d) => d.id)));
  const ranks = rankedResonance(signals.map((signal) => ({ id: signal.draftId, signal })));

  const measured = withText
    .map((d) => {
      const rank = ranks.get(d.id);
      return rank === undefined ? null : { rank, flags: checkGenericPatterns(d.postOutput!) };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  if (measured.length < 8) return "";

  const flagged = measured.filter((m) => m.flags.length > 0);
  const clean = measured.filter((m) => m.flags.length === 0);
  if (flagged.length < 3 || clean.length < 3) return "";

  const diff = mean(clean.map((m) => m.rank)) - mean(flagged.map((m) => m.rank));
  const perGroup = Math.min(flagged.length, clean.length);
  const confidence: EvidenceConfidence | null = diff >= 25 && perGroup >= 5 ? "high" : diff >= 15 && perGroup >= 3 ? "medium" : null;
  if (!confidence) return "";

  const counts = new Map<string, number>();
  for (const m of flagged) for (const f of m.flags) counts.set(f, (counts.get(f) ?? 0) + 1);
  const common = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([f]) => f);

  return [
    `## WHAT THE PRE-PUBLISH CHECK HAS CAUGHT (from this author's own ${measured.length} measured posts):`,
    `- Posts the check flagged as generic ranked ${Math.round(mean(flagged.map((m) => m.rank)))}/100 on average against ${Math.round(mean(clean.map((m) => m.rank)))}/100 for clean posts (confidence: ${confidence}, ${flagged.length} flagged vs ${clean.length} clean).`,
    `- Their most common flags: ${common.join("; ")}. Avoid these patterns.`,
  ].join("\n");
}
