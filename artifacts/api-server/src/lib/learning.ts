import { eq, and, desc, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  draftsTable,
  performanceSignalsTable,
  voiceSuggestionsTable,
  ideaFeedbackTable,
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

/**
 * Feedback the user has explicitly given — accepted voice suggestions and
 * liked/disliked idea directions. Injected into generation prompts so the
 * agent's output actually changes as the user teaches it.
 */
export async function buildFeedbackContext(userId: number): Promise<string> {
  const [acceptedSuggestions, ideaFeedback] = await Promise.all([
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
  ]);

  const parts: string[] = [];

  if (acceptedSuggestions.length > 0) {
    const lines = ["## LEARNED VOICE ADJUSTMENTS (the user accepted these data-driven changes — honor them):"];
    for (const s of acceptedSuggestions) {
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

  const tagMap = new Map<string, { resonances: number[]; count: number }>();
  for (const d of withText) {
    const tags = [...d.postOutput!.matchAll(/#([A-Za-z][A-Za-z0-9_]*)/g)].map((m) => m[1]!.toLowerCase());
    const s = perfMap.get(d.id);
    const r = s ? resonanceScore(s) : null;
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
    ...ranked.map((t) => `- #${t.tag} (avg resonance ${t.avg} across ${t.count} posts)`),
  ].join("\n");
}

/**
 * Per-user learned structural patterns: compares the structure of this user's
 * high-resonance posts against their low-resonance posts and emits a compact
 * context block. This replaces a one-size-fits-all rubric with patterns that
 * actually predict resonance for THIS user.
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

  const perfMap = new Map(signals.map((s) => [s.draftId, s]));
  const scored = withText
    .map((d) => {
      const s = perfMap.get(d.id);
      if (!s) return null;
      return { text: d.postOutput!, resonance: resonanceScore(s) };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.resonance - a.resonance);

  if (scored.length < 6) return "";

  const topCount = Math.max(3, Math.floor(scored.length / 3));
  const top = analyzeStructure(scored.slice(0, topCount).map((x) => x.text));
  const bottom = analyzeStructure(scored.slice(-topCount).map((x) => x.text));
  if (!top || !bottom) return "";

  const lines = [
    `## LEARNED STRUCTURAL PATTERNS (from this user's own ${scored.length} measured posts — these predict what resonates for THEM):`,
    `High-resonance posts: ~${top.avgWords} words, ~${top.avgParagraphs} paragraphs, hooks avg ${top.avgHookWords} words (${top.questionHookPct}% questions, ${top.shortHookPct}% under 8 words).`,
    `Low-resonance posts: ~${bottom.avgWords} words, ~${bottom.avgParagraphs} paragraphs, hooks avg ${bottom.avgHookWords} words (${bottom.questionHookPct}% questions, ${bottom.shortHookPct}% under 8 words).`,
  ];

  const guidance: string[] = [];
  if (Math.abs(top.avgWords - bottom.avgWords) > 40) {
    guidance.push(`aim for roughly ${top.avgWords} words`);
  }
  if (top.questionHookPct - bottom.questionHookPct >= 25) {
    guidance.push("question hooks outperform statements for this user");
  } else if (bottom.questionHookPct - top.questionHookPct >= 25) {
    guidance.push("statement hooks outperform questions for this user");
  }
  if (top.shortHookPct - bottom.shortHookPct >= 25) {
    guidance.push("short punchy hooks (under 8 words) work best");
  }
  if (guidance.length > 0) {
    lines.push(`Apply: ${guidance.join("; ")}.`);
  }

  return lines.join("\n");
}
