import { eq, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { brandVoiceSignalsTable } from "@workspace/db";

export type VoiceSignals = {
  sentenceStyle: string;
  punctuationStyle: string;
  openingStyle: string;
  vocabulary: string[];
  structurePattern: string;
  toneMarkers: string[];
};

/**
 * Compose a concise voice DNA excerpt from a user's latest brand voice signals.
 * This is injected into AI prompts to personalise the output.
 */
export async function buildVoiceDNA(userId: number): Promise<string> {
  const signals = await db
    .select()
    .from(brandVoiceSignalsTable)
    .where(eq(brandVoiceSignalsTable.userId, userId))
    .orderBy(desc(brandVoiceSignalsTable.createdAt))
    .limit(10);

  if (signals.length === 0) return "";

  const allSignals = signals.map((s) => s.signals as VoiceSignals);

  const sentenceStyles = allSignals.map((s) => s.sentenceStyle).filter(Boolean);
  const toneMarkers = [...new Set(allSignals.flatMap((s) => s.toneMarkers ?? []))].slice(0, 5);
  const vocabulary = [...new Set(allSignals.flatMap((s) => s.vocabulary ?? []))].slice(0, 8);
  const openingStyles = allSignals.map((s) => s.openingStyle).filter(Boolean);

  const dominantSentenceStyle = mostCommon(sentenceStyles);
  const dominantOpeningStyle = mostCommon(openingStyles);

  const parts: string[] = ["Voice DNA (learned from this user's past writing):"];
  if (dominantSentenceStyle) parts.push(`- Sentence style: ${dominantSentenceStyle}`);
  if (dominantOpeningStyle) parts.push(`- Typical opening: ${dominantOpeningStyle}`);
  if (toneMarkers.length > 0) parts.push(`- Tone markers: ${toneMarkers.join(", ")}`);
  if (vocabulary.length > 0) parts.push(`- Vocabulary fingerprint: ${vocabulary.join(", ")}`);

  return parts.join("\n");
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
