// A measurable "how you write" fingerprint, computed from your own published
// posts and pinned writing samples. It captures rhythm and phrasing (sentence
// length, variety, line breaks, first person, questions, numbers,
// contractions) — not meaning — so "match" means "this reads like your usual
// shape", nothing more.

export type AxisKey = "sentenceLength" | "rhythm" | "lineBreaks" | "firstPerson" | "questions" | "numbers" | "contractions";

export interface Axis {
  key: AxisKey;
  label: string;
  /** Raw value that maps to 0 and 1 on the radar. */
  min: number;
  max: number;
  /** How to describe a gap between draft and usual, for the note. */
  longer: string;
  shorter: string;
}

export const AXES: Axis[] = [
  { key: "sentenceLength", label: "Sentence length", min: 5, max: 26, longer: "longer sentences than usual", shorter: "shorter sentences than usual" },
  { key: "rhythm", label: "Rhythm variety", min: 0, max: 0.9, longer: "more varied rhythm than usual", shorter: "more uniform rhythm than usual" },
  { key: "lineBreaks", label: "Line breaks", min: 0, max: 14, longer: "more line breaks than usual", shorter: "denser paragraphs than usual" },
  { key: "firstPerson", label: "First person", min: 0, max: 9, longer: "more “I/we” than usual", shorter: "less “I/we” than usual" },
  { key: "questions", label: "Questions", min: 0, max: 0.3, longer: "more questions than usual", shorter: "fewer questions than usual" },
  { key: "numbers", label: "Numbers", min: 0, max: 5, longer: "more numbers than usual", shorter: "fewer numbers than usual" },
  { key: "contractions", label: "Contractions", min: 0, max: 6, longer: "more contractions than usual", shorter: "fewer contractions than usual" },
];

export type RawMetrics = Record<AxisKey, number>;

export const MIN_WORDS_FOR_FINGERPRINT = 150;
export const MIN_SAMPLES_FOR_FINGERPRINT = 3;

const FIRST_PERSON = /\b(?:i|i'm|i've|i'd|i'll|my|me|mine|we|we're|we've|our|us)\b/gi;
const CONTRACTION = /\b[a-z]+['’](?:s|t|re|ve|ll|d|m)\b/gi;

function words(text: string): string[] {
  return text.match(/[A-Za-z0-9][A-Za-z0-9'’%$.,-]*/g) ?? [];
}

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => /[A-Za-z0-9]/.test(s));
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

export const normalise = (axis: Axis, value: number) =>
  Math.min(1, Math.max(0, (value - axis.min) / (axis.max - axis.min)));

export type FingerprintBasis = "best-performing" | "published";

export interface Fingerprint {
  raw: RawMetrics;
  vector: number[];
  samples: number;
  words: number;
  /** What the target was measured from: your best posts, or everything you've published. */
  basis?: FingerprintBasis;
}

export function fingerprintFromRaw(raw: RawMetrics, samples: number, words: number, basis: FingerprintBasis): Fingerprint {
  return { raw, vector: AXES.map((a) => normalise(a, raw[a.key])), samples, words, basis };
}

export function fingerprintFromSamples(samples: string[]): Fingerprint | null {
  const usable = samples.map((text) => ({ text, metrics: computeMetrics(text) })).filter((s) => s.metrics);
  const totalWords = usable.reduce((n, s) => n + words(s.text).length, 0);
  if (usable.length < MIN_SAMPLES_FOR_FINGERPRINT || totalWords < MIN_WORDS_FOR_FINGERPRINT) return null;

  const raw = {} as RawMetrics;
  for (const axis of AXES) {
    raw[axis.key] = usable.reduce((sum, s) => sum + s.metrics![axis.key], 0) / usable.length;
  }
  return { raw, vector: AXES.map((a) => normalise(a, raw[a.key])), samples: usable.length, words: totalWords };
}

export interface AxisGap {
  key: AxisKey;
  label: string;
  draft: number;
  target: number;
  /** Normalised draft minus target; positive means the draft has more of it. */
  gap: number;
}

export interface VoiceComparison {
  /** 0-100. How close the draft's shape is to the usual shape. */
  match: number;
  vector: number[];
  /** The axis the draft differs on most, in plain words, if the gap is meaningful. */
  note: string | null;
  gaps: AxisGap[];
}

const NOTE_THRESHOLD = 0.22;

export function compareToFingerprint(text: string, fingerprint: Fingerprint): VoiceComparison | null {
  const metrics = computeMetrics(text);
  if (!metrics) return null;
  const vector = AXES.map((a) => normalise(a, metrics[a.key]));
  const gaps = vector.map((v, i) => v - fingerprint.vector[i]!);
  const meanGap = gaps.reduce((s, g) => s + Math.abs(g), 0) / gaps.length;
  const match = Math.max(0, Math.round((1 - meanGap * 1.6) * 100));

  let worst = 0;
  gaps.forEach((g, i) => { if (Math.abs(g) > Math.abs(gaps[worst]!)) worst = i; });
  const gap = gaps[worst]!;
  const note = Math.abs(gap) >= NOTE_THRESHOLD
    ? `This draft has ${gap > 0 ? AXES[worst]!.longer : AXES[worst]!.shorter}.`
    : null;
  const axisGaps: AxisGap[] = AXES.map((a, i) => ({
    key: a.key, label: a.label, draft: metrics[a.key], target: fingerprint.raw[a.key], gap: gaps[i]!,
  }));
  return { match, vector, note, gaps: axisGaps };
}

const REWRITE_GAP = 0.12;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The refine instruction behind "Rewrite closer to my voice". Facts stay untouched. */
export function voiceRewriteInstruction(comparison: VoiceComparison, basis: FingerprintBasis = "published"): string | null {
  const asks = comparison.gaps
    .filter((g) => Math.abs(g.gap) >= REWRITE_GAP)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .slice(0, 4)
    .map((g) => {
      switch (g.key) {
        case "sentenceLength": return `average sentence length about ${Math.round(g.target)} words (currently ${Math.round(g.draft)})`;
        case "rhythm": return g.gap > 0 ? "less uneven sentence lengths" : "a more varied sentence rhythm";
        case "lineBreaks": return g.gap > 0 ? "fewer blank-line breaks, denser paragraphs" : "more short paragraphs with blank-line breaks";
        case "firstPerson": return g.gap > 0 ? "less first person (I/we)" : "more first person (I/we) where it is true to the content";
        case "questions": return g.gap > 0 ? "fewer questions" : "one real question if it fits";
        case "numbers": return g.gap > 0 ? "fewer numbers" : "bring forward any real numbers or specifics the post already contains; if it has none, leave it as is and do not invent any";
        case "contractions": return g.gap > 0 ? "fewer contractions" : "more natural contractions";
      }
    });
  if (asks.length === 0) return null;
  return [
    `Rewrite this post so its shape sits closer to how the author usually writes (measured from their ${basis === "best-performing" ? "best-performing" : "published"} posts): ${asks.join("; ")}.`,
    "Keep every fact, number, name and the core idea exactly as they are. Do not invent anything new. Change phrasing and structure only.",
  ].join(" ");
}
