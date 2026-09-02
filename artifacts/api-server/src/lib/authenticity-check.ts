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

export type WordChangeSummary = {
  originalWordCount: number;
  finalWordCount: number;
  unchangedWordCount: number;
  removedWordCount: number;
  addedWordCount: number;
  unchangedPct: number;
  aiChangedPct: number;
  userAddedPct: number;
  removedWords: string[];
  addedWords: string[];
};

export type AuthenticityCheck = {
  editPct: number | null;
  flags: string[];
  severity: AuthenticitySeverity;
  wordChangeSummary?: WordChangeSummary;
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
  const summary = computeWordChangeSummary(original, final);
  if (!summary) return null;
  const similarity = (2 * summary.unchangedWordCount)
    / (summary.originalWordCount + summary.finalWordCount);
  return Math.round((1 - similarity) * 100) / 100;
}

type WordToken = {
  display: string;
  key: string;
};

const WORD_TOKEN_PATTERN = /#?[A-Za-z0-9]+(?:['’\-][A-Za-z0-9]+)*/g;
const WORD_PREVIEW_LIMIT = 24;

function tokenizeWords(text: string): WordToken[] {
  return (text.match(WORD_TOKEN_PATTERN) ?? []).map((display) => ({
    display,
    key: display.toLocaleLowerCase(),
  }));
}

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/**
 * Creates an explainable word-level diff. It deliberately reports additions
 * and removals separately: replacing one AI word with one user word is one
 * removed word plus one added word, rather than pretending we know authorship.
 * Punctuation and line breaks do not count as word changes.
 */
export function computeWordChangeSummary(
  original: string | null | undefined,
  final: string,
): WordChangeSummary | null {
  if (!original || !original.trim() || !final.trim()) return null;

  const a = tokenizeWords(original);
  const b = tokenizeWords(final);
  if (a.length === 0 || b.length === 0) return null;

  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i]![j] = a[i - 1]!.key === b[j - 1]!.key
        ? dp[i - 1]![j - 1]! + 1
        : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
    }
  }

  const removedWords: string[] = [];
  const addedWords: string[] = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1]!.key === b[j - 1]!.key) {
      i--;
      j--;
    } else if (i > 0 && (j === 0 || dp[i - 1]![j]! >= dp[i]![j - 1]!)) {
      removedWords.push(a[i - 1]!.display);
      i--;
    } else {
      addedWords.push(b[j - 1]!.display);
      j--;
    }
  }
  removedWords.reverse();
  addedWords.reverse();

  const unchangedWordCount = dp[a.length]![b.length]!;
  return {
    originalWordCount: a.length,
    finalWordCount: b.length,
    unchangedWordCount,
    removedWordCount: removedWords.length,
    addedWordCount: addedWords.length,
    unchangedPct: percent(unchangedWordCount, a.length),
    aiChangedPct: percent(removedWords.length, a.length),
    userAddedPct: percent(addedWords.length, b.length),
    removedWords: removedWords.slice(0, WORD_PREVIEW_LIMIT),
    addedWords: addedWords.slice(0, WORD_PREVIEW_LIMIT),
  };
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
