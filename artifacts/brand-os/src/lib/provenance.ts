// "Provenance ink": which words in the final post are still the AI's draft and
// which are yours. Word-level LCS against the immutable AI original (same idea
// as the server's authenticity check), done client-side so it updates as you edit.

export type InkSource = "ai" | "you";
export type InkToken = { text: string; source: InkSource; flag: string | null };

export interface InkSummary {
  tokens: InkToken[];
  totalWords: number;
  yourWords: number;
  yourPct: number;
  flags: string[];
}

const TOKEN_PATTERN = /\S+|\s+/g;
const normalise = (word: string) => word.toLowerCase().replace(/^[^a-z0-9#]+|[^a-z0-9]+$/g, "");

type FlagSpan = { start: number; end: number; reason: string };

const GENERIC_PHRASES = ["game-changer", "thought leader", "value-add", "circle back", "move the needle", "bleeding edge"];
const CLICKBAIT = ["nobody talks about this", "this changed everything", "read that again", "let that sink in", "here's the truth", "you need to hear this"];
const STOCK_OPENERS = ["in today's fast-paced world", "we've all been there", "let's talk about", "i want to share something"];
const MIC_DROPS = ["that's the job", "that's it", "let that sink in", "agree?", "thoughts?"];
const NEGATION_REFRAME = /\b(?:(?:it'?s|it is|this is|that'?s|that is)\s+not|\w+\s+(?:isn'?t|is not|wasn'?t|was not|aren'?t))\s+(?:just\s+|only\s+)?[^.!?\n]{2,60}?[,;—–-]\s*(?:it'?s|it is|but)\b[^.!?\n]*/gi;

/** Character ranges worth a red-pen underline, with the reason shown on hover. */
export function findFlagSpans(text: string): FlagSpan[] {
  const spans: FlagSpan[] = [];
  const addAll = (phrases: string[], reason: string) => {
    for (const phrase of phrases) {
      const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const wholePhrase = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "gi");
      for (const match of text.matchAll(wholePhrase)) {
        if (match.index !== undefined) spans.push({ start: match.index, end: match.index + match[0].length, reason });
      }
    }
  };
  addAll(GENERIC_PHRASES, "Generic phrase — say the specific thing instead");
  addAll(CLICKBAIT, "Bait opener — start on the actual moment or claim");
  addAll(STOCK_OPENERS, "Stock opener — open on something specific");

  for (const match of text.matchAll(NEGATION_REFRAME)) {
    if (match.index !== undefined) {
      spans.push({ start: match.index, end: match.index + match[0].length, reason: "\"Not X, it's Y\" reframe — show the moment instead of asserting the contrast" });
    }
  }

  const trimmedEnd = text.replace(/\s+$/, "");
  const lastBreak = Math.max(trimmedEnd.lastIndexOf("\n"), -1);
  const lastLine = trimmedEnd.slice(lastBreak + 1);
  if (MIC_DROPS.includes(lastLine.toLowerCase().replace(/[.!]+$/, "").trim())) {
    spans.push({ start: lastBreak + 1, end: trimmedEnd.length, reason: "Generic mic-drop ending — end on the real point or cut it" });
  }
  return spans;
}

export function computeInk(original: string | null | undefined, final: string): InkSummary {
  const rawTokens = final.match(TOKEN_PATTERN) ?? [];
  const words = rawTokens
    .map((text, index) => ({ text, index }))
    .filter((t) => !/^\s+$/.test(t.text));
  const keys = words.map((w) => normalise(w.text));

  // Words with no original to compare against are all yours.
  const source = new Array<InkSource>(words.length).fill("you");
  const hasOriginal = !!original && original.trim().length > 0;
  if (hasOriginal) {
    const originalKeys = (original!.match(/\S+/g) ?? []).map(normalise);
    const n = originalKeys.length;
    const m = keys.length;
    const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        dp[i]![j] = originalKeys[i - 1] && originalKeys[i - 1] === keys[j - 1]
          ? dp[i - 1]![j - 1]! + 1
          : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
    let i = n;
    let j = m;
    while (i > 0 && j > 0) {
      if (originalKeys[i - 1] && originalKeys[i - 1] === keys[j - 1]) {
        source[j - 1] = "ai";
        i--;
        j--;
      } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) {
        i--;
      } else {
        j--;
      }
    }
  }

  const spans = findFlagSpans(final);
  const wordSource = new Map<number, InkSource>();
  words.forEach((w, k) => wordSource.set(w.index, source[k]!));

  let offset = 0;
  let lastSource: InkSource = hasOriginal ? "ai" : "you";
  const flags = new Set<string>();
  const tokens: InkToken[] = rawTokens.map((text, index) => {
    const start = offset;
    offset += text.length;
    const isSpace = /^\s+$/.test(text);
    const tokenSource = isSpace ? lastSource : wordSource.get(index)!;
    if (!isSpace) lastSource = tokenSource;
    const span = !isSpace ? spans.find((s) => start < s.end && offset > s.start) : undefined;
    if (span) flags.add(span.reason);
    return { text, source: tokenSource, flag: span?.reason ?? null };
  });

  const yourWords = source.filter((s) => s === "you").length;
  return {
    tokens,
    totalWords: words.length,
    yourWords,
    yourPct: words.length > 0 ? Math.round((yourWords / words.length) * 100) : 0,
    flags: [...flags],
  };
}
