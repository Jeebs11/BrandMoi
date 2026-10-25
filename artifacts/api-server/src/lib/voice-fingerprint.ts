// Server-side twin of artifacts/brand-os/src/lib/voice-fingerprint.ts. The two
// MUST measure identically (the draft screen compares live text against what
// this returns); voice-fingerprint.test.ts and the client test assert the same
// numbers on the same text. Rule-based, no AI call.

export type AxisKey = "sentenceLength" | "rhythm" | "lineBreaks" | "firstPerson" | "questions" | "numbers" | "contractions";
export type RawMetrics = Record<AxisKey, number>;

export interface Axis { key: AxisKey; label: string; min: number; max: number }

export const AXES: Axis[] = [
  { key: "sentenceLength", label: "Sentence length", min: 5, max: 26 },
  { key: "rhythm", label: "Rhythm variety", min: 0, max: 0.9 },
  { key: "lineBreaks", label: "Line breaks", min: 0, max: 14 },
  { key: "firstPerson", label: "First person", min: 0, max: 9 },
  { key: "questions", label: "Questions", min: 0, max: 0.3 },
  { key: "numbers", label: "Numbers", min: 0, max: 5 },
  { key: "contractions", label: "Contractions", min: 0, max: 6 },
];

export const MIN_WORDS = 150;
export const MIN_SAMPLES = 3;

const FIRST_PERSON = /\b(?:i|i'm|i've|i'd|i'll|my|me|mine|we|we're|we've|our|us)\b/gi;
const CONTRACTION = /\b[a-z]+['’](?:s|t|re|ve|ll|d|m)\b/gi;

const words = (text: string): string[] => text.match(/[A-Za-z0-9][A-Za-z0-9'’%$.,-]*/g) ?? [];
const sentences = (text: string): string[] =>
  text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => /[A-Za-z0-9]/.test(s));

export function wordCount(text: string): number {
  return words(text).length;
}

export function computeMetrics(text: string): RawMetrics | null {
  const allWords = words(text);
  if (allWords.length < 20) return null;
  const sents = sentences(text);
  const lengths = sents.map((s) => words(s).length).filter((n) => n > 0);
  if (lengths.length === 0) return null;
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((s, l) => s + (l - mean) ** 2, 0) / lengths.length;
  const per100 = (count: number) => (count / allWords.length) * 100;
  return {
    sentenceLength: mean,
    rhythm: mean > 0 ? Math.sqrt(variance) / mean : 0,
    lineBreaks: per100((text.match(/\n\s*\n/g) ?? []).length),
    firstPerson: per100((text.match(FIRST_PERSON) ?? []).length),
    questions: (text.match(/\?/g) ?? []).length / sents.length,
    numbers: per100((text.match(/\b\d[\d,.]*%?/g) ?? []).length),
    contractions: per100((text.match(CONTRACTION) ?? []).length),
  };
}

export const normalise = (axis: Axis, value: number): number =>
  Math.min(1, Math.max(0, (value - axis.min) / (axis.max - axis.min)));

export function meanMetrics(list: RawMetrics[]): RawMetrics | null {
  if (list.length === 0) return null;
  const out = {} as RawMetrics;
  for (const axis of AXES) out[axis.key] = list.reduce((s, m) => s + m[axis.key], 0) / list.length;
  return out;
}

/** 0-100: how close `metrics` is to `target`, same formula as the client. */
export function matchScore(metrics: RawMetrics, target: RawMetrics): number {
  const gaps = AXES.map((a) => normalise(a, metrics[a.key]) - normalise(a, target[a.key]));
  const meanGap = gaps.reduce((s, g) => s + Math.abs(g), 0) / gaps.length;
  return Math.max(0, Math.round((1 - meanGap * 1.6) * 100));
}

export interface WinnerInsight {
  key: AxisKey;
  label: string;
  top: number;
  rest: number;
  direction: "higher" | "lower";
}

const INSIGHT_MIN_GAP = 0.15;

/** Axes where your best posts clearly differ from the rest of your posts. */
export function winnerInsights(top: RawMetrics, rest: RawMetrics): WinnerInsight[] {
  return AXES
    .map((a) => ({ axis: a, gap: normalise(a, top[a.key]) - normalise(a, rest[a.key]) }))
    .filter((x) => Math.abs(x.gap) >= INSIGHT_MIN_GAP)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .slice(0, 4)
    .map(({ axis, gap }) => ({
      key: axis.key,
      label: axis.label,
      top: top[axis.key],
      rest: rest[axis.key],
      direction: gap > 0 ? "higher" : "lower",
    }));
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Plain-English style targets for the writing prompt. */
export function styleTargetsText(target: RawMetrics, basis: "best-performing" | "published"): string {
  const lines = [
    `Average sentence length about ${Math.round(target.sentenceLength)} words, with rhythm variety around ${round1(target.rhythm)} (0 = uniform, 0.9 = very uneven).`,
    target.lineBreaks >= 1
      ? `Roughly ${round1(target.lineBreaks)} blank-line breaks per 100 words.`
      : "Keep paragraphs fairly dense, with few blank-line breaks.",
    target.firstPerson >= 0.8
      ? `First person (I/my/we/our) about ${round1(target.firstPerson)} times per 100 words.`
      : "Use first person sparingly.",
    target.questions >= 0.05
      ? `About ${Math.round(target.questions * 100)}% of sentences are questions.`
      : "Questions are rare; use at most one.",
    target.numbers >= 0.5
      ? `Concrete numbers about ${round1(target.numbers)} per 100 words — but only numbers supplied in the raw thought, never invented.`
      : "Numbers are not a feature of this voice; do not force them in.",
    target.contractions >= 0.8
      ? `Contractions about ${round1(target.contractions)} per 100 words (conversational).`
      : "Prefer fully written-out forms over contractions.",
  ];
  return [
    `## STYLE TARGETS (measured from the author's ${basis} posts — match this shape; never mention these numbers):`,
    ...lines.map((l) => `- ${l}`),
  ].join("\n");
}
