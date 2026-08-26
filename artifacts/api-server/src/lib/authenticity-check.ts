import { STOCK_OPENERS } from "./ai-prompts.js";

// Rule-based only — no AI/API call. We already know a draft's text came from
// Claude (we generated it), so this isn't guessing at unknown provenance the
// way an "AI detector" does; it's just measuring two known, concrete things:
// how much the final post has actually changed since generation, and whether
// it still contains known generic-AI markers.

const MIN_SENTENCES_FOR_VARIANCE = 5;
const LOW_VARIANCE_THRESHOLD = 0.15; // coefficient of variation (stdev/mean)
const CONCRETE_DETAIL_PATTERN = /(?:\b\d+(?:[,.]\d+)?(?:%|x|k|m| years?| months?| days?)?\b|\b(?:I|my|we|our)\b|["“][^"”]{3,}["”])/i;
const HIGH_CONFIDENCE_GENERIC_PHRASES = [
  "game-changer",
  "thought leader",
  "value-add",
  "circle back",
  "move the needle",
  "bleeding edge",
];

export type AuthenticitySeverity = "low" | "medium" | "high";

export type AuthenticityCheck = {
  editPct: number | null;
  flags: string[];
  severity: AuthenticitySeverity;
};

/**
 * Word-level sequence similarity (LCS-based ratio, same idea as Python's
 * difflib.SequenceMatcher.ratio()) — captures real rewrites (reordering,
 * added/removed sentences) sensibly, unlike character-level edit distance
 * which is noisy about minor typo fixes.
 *
 * Returns the fraction of the text that has CHANGED (0 = identical,
 * 1 = completely different), or null if there's nothing to compare against.
 */
export function computeEditPercent(original: string | null | undefined, final: string): number | null {
  if (!original || !original.trim() || !final.trim()) return null;
  const a = original.trim().split(/\s+/);
  const b = final.trim().split(/\s+/);
  if (a.length === 0 || b.length === 0) return null;

  // Longest common subsequence length via DP — O(n*m), trivially fast at
  // post length (~150-300 words).
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i]![j] = a[i - 1] === b[j - 1] ? dp[i - 1]![j - 1]! + 1 : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
    }
  }
  const lcs = dp[a.length]![b.length]!;
  const similarity = (2 * lcs) / (a.length + b.length);
  return Math.round((1 - similarity) * 100) / 100;
}

function splitSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function containsWholePhrase(text: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i").test(text);
}

/**
 * Flags patterns that can make a post feel templated or generic. These are
 * coaching signals, not proof of AI authorship: a user may intentionally use
 * a short, punchy rhythm or a familiar professional phrase.
 */
export function checkGenericPatterns(text: string): string[] {
  const flags: string[] = [];
  const lower = text.toLowerCase();

  const foundBannedWord = HIGH_CONFIDENCE_GENERIC_PHRASES.find((phrase) => containsWholePhrase(lower, phrase));
  if (foundBannedWord) flags.push(`generic phrase ("${foundBannedWord}")`);

  const firstLine = text.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "";
  const firstLineLower = firstLine.toLowerCase();
  if (STOCK_OPENERS.some((opener) => firstLineLower.startsWith(opener))) {
    flags.push("a stock opening line");
  }

  if (/^not\s+.+,\s+but\s+.+[.!?]?$/i.test(firstLine)) {
    flags.push('a familiar "not X, but Y" hook');
  }

  if (/^(?:here are|the)\s+\d+\s+(?:lessons|things|ways|rules|tips)\b/i.test(firstLine)) {
    flags.push("a templated list hook");
  }

  const sentences = splitSentences(text);
  if (sentences.length >= MIN_SENTENCES_FOR_VARIANCE) {
    const lengths = sentences.map((s) => s.split(/\s+/).length);
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((sum, l) => sum + (l - mean) ** 2, 0) / lengths.length;
    const stdev = Math.sqrt(variance);
    const coefficientOfVariation = mean > 0 ? stdev / mean : 0;
    if (coefficientOfVariation < LOW_VARIANCE_THRESHOLD) {
      flags.push("very uniform sentence rhythm");
    }
  }

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount >= 90 && !CONCRETE_DETAIL_PATTERN.test(text)) {
    flags.push("few concrete personal details or evidence");
  }

  return flags;
}

export function runAuthenticityCheck(
  original: string | null | undefined,
  final: string,
): AuthenticityCheck | null {
  const editPct = computeEditPercent(original, final);
  const flags = checkGenericPatterns(final);

  const editIsVeryLow = editPct !== null && editPct < 0.1;
  const editIsLow = editPct !== null && editPct < 0.25;
  if (!editIsLow && flags.length === 0) return null;

  const score =
    (editIsVeryLow ? 3 : editIsLow ? 2 : 0) +
    flags.reduce((total, flag) => total + (
      flag.includes("stock opening") || flag.includes("generic phrase") ? 2 : 1
    ), 0);
  const severity: AuthenticitySeverity = score >= 3 ? "high" : score >= 2 ? "medium" : "low";

  return { editPct, flags, severity };
}
