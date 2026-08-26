import { eq, desc, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { brandVoiceSignalsTable, draftsTable, preferencesTable } from "@workspace/db";

export type VoiceSignals = {
  sentenceStyle: string;
  punctuationStyle: string;
  openingStyle: string;
  vocabulary: string[];
  structurePattern: string;
  toneMarkers: string[];
};

/**
 * Compose a concise voice DNA excerpt from a user's latest brand voice signals,
 * actual writing samples from real PUBLISHED drafts (prioritising ones the user
 * has flagged as "my voice"), and any manually-pinned writing samples from their
 * profile preferences.
 *
 * This is injected into AI prompts to personalise the output.
 */
export async function buildVoiceDNA(userId: number): Promise<string> {
  const [signals, publishedDrafts, prefs] = await Promise.all([
    db
      .select()
      .from(brandVoiceSignalsTable)
      .where(eq(brandVoiceSignalsTable.userId, userId))
      .orderBy(desc(brandVoiceSignalsTable.createdAt))
      .limit(10),
    // Only look at published posts — they represent what the user actually put their name on
    db
      .select({ postOutput: draftsTable.postOutput, isVoiceSample: draftsTable.isVoiceSample })
      .from(draftsTable)
      .where(and(eq(draftsTable.userId, userId), eq(draftsTable.status, "published")))
      .orderBy(desc(draftsTable.updatedAt))
      .limit(20),
    db
      .select({ writingSamples: preferencesTable.writingSamples })
      .from(preferencesTable)
      .where(eq(preferencesTable.userId, userId))
      .limit(1),
  ]);

  const parts: string[] = [];

  // ── Pinned writing samples from preferences (highest authority) ──────────
  const pinnedSamples = (prefs[0]?.writingSamples ?? []) as string[];
  if (pinnedSamples.length > 0) {
    const lines = ["Pinned writing samples (this is how the user sounds — match this voice above all else):"];
    pinnedSamples.slice(0, 5).forEach((s, i) => {
      const preview = s.trim().slice(0, 300) + (s.trim().length > 300 ? "…" : "");
      lines.push(`Sample ${i + 1}: "${preview}"`);
    });
    parts.push(lines.join("\n"));
  }

  // ── Voice signals (sentence/tone patterns from analysis) ─────────────────
  if (signals.length > 0) {
    const allSignals = signals.map((s) => s.signals as VoiceSignals);
    const sentenceStyles = allSignals.map((s) => s.sentenceStyle).filter(Boolean);
    const toneMarkers = [...new Set(allSignals.flatMap((s) => s.toneMarkers ?? []))].slice(0, 5);
    const vocabulary = [...new Set(allSignals.flatMap((s) => s.vocabulary ?? []))].slice(0, 8);
    const openingStyles = allSignals.map((s) => s.openingStyle).filter(Boolean);
      const punctuationStyles = allSignals.map((s) => s.punctuationStyle).filter(Boolean);
      const structurePatterns = allSignals.map((s) => s.structurePattern).filter(Boolean);
    const dominantSentenceStyle = mostCommon(sentenceStyles);
    const dominantOpeningStyle = mostCommon(openingStyles);
      const dominantPunctuationStyle = mostCommon(punctuationStyles);
      const dominantStructurePattern = mostCommon(structurePatterns);

    const dnaLines: string[] = ["Voice DNA (writing style patterns from published posts):"];
    if (dominantSentenceStyle) dnaLines.push(`- Sentence style: ${dominantSentenceStyle}`);
    if (dominantOpeningStyle) dnaLines.push(`- Typical opening: ${dominantOpeningStyle}`);
      if (dominantPunctuationStyle) dnaLines.push(`- Punctuation habits: ${dominantPunctuationStyle}`);
      if (dominantStructurePattern) dnaLines.push(`- Structure pattern: ${dominantStructurePattern}`);
    if (toneMarkers.length > 0) dnaLines.push(`- Tone markers: ${toneMarkers.join(", ")}`);
    if (vocabulary.length > 0) dnaLines.push(`- Vocabulary fingerprint: ${vocabulary.join(", ")}`);
    parts.push(dnaLines.join("\n"));
  }

  // ── Actual writing samples from published posts ───────────────────────────
  // User-flagged "my voice" samples come first, then other published posts
  const voiceFlagged = publishedDrafts
    .filter((d) => d.isVoiceSample && d.postOutput && d.postOutput.trim().length > 120);
  const regular = publishedDrafts
    .filter((d) => !d.isVoiceSample && d.postOutput && d.postOutput.trim().length > 120);

  const orderedSamples = [...voiceFlagged, ...regular].slice(0, 5);

  if (orderedSamples.length > 0) {
    const sampleLines = voiceFlagged.length > 0
      ? ["Writing samples from published posts (★ = user-flagged as authentic voice):"]
      : ["Writing samples from published posts:"];
    orderedSamples.forEach((d, i) => {
      const text = (d.postOutput ?? "").trim();
      const words = text.split(/\s+/);
      const preview = words.slice(0, 80).join(" ") + (words.length > 80 ? "…" : "");
      const flag = d.isVoiceSample ? "★ " : "";
      sampleLines.push(`${flag}Sample ${i + 1}: "${preview}"`);
    });
    parts.push(sampleLines.join("\n"));
  }

  return parts.join("\n\n");
}

function mostCommon<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  const counts = new Map<T, number>();
  for (const item of arr) counts.set(item, (counts.get(item) ?? 0) + 1);
  let best: T | undefined;
  let bestCount = 0;
  for (const [item, count] of counts) {
    if (count > bestCount) { bestCount = count; best = item; }
  }
  return best;
}

/**
 * Simple Jaccard similarity for topic/angle overlap detection.
 */
export function computeJaccard(a: string, b: string): number {
  const tokenise = (s: string) =>
    new Set(s.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  const setA = tokenise(a);
  const setB = tokenise(b);
  const intersection = [...setA].filter((w) => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}
