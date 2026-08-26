import { eq } from "drizzle-orm";
import { db, preferencesTable } from "@workspace/db";
import { buildFeedbackContext, buildLearnedPatterns, buildPerformanceContext, buildTopHashtags } from "./learning.js";
import { buildVoiceDNA } from "./voice-dna.js";

export type BrandContextConfidence = "starting" | "developing" | "grounded";

export type CanonicalBrandContext = {
  context: string;
  feedbackContext: string;
  objective: string | null;
  tone: string | null;
  persona: string | null;
  confidence: BrandContextConfidence;
  evidence: {
    writingSamples: number;
    proofPoints: number;
    contentPillars: number;
    hasAboutMe: boolean;
    hasVoiceDNA: boolean;
  };
};

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

/**
 * Single source of truth for creator context sent to AI features.
 *
 * Positioning and proof are kept separate from voice evidence so a style
 * sample cannot accidentally become a claim about the creator. Feature
 * routes should append their own audience, format, news, or workflow overlay
 * after this context rather than rebuilding the profile independently.
 */
export async function buildCanonicalBrandContext(userId: number): Promise<CanonicalBrandContext> {
  const [[prefs], voiceDNA, feedbackContext, performanceContext, learnedPatterns, topHashtags] = await Promise.all([
    db.select().from(preferencesTable).where(eq(preferencesTable.userId, userId)).limit(1),
    buildVoiceDNA(userId),
    buildFeedbackContext(userId),
    buildPerformanceContext(userId),
    buildLearnedPatterns(userId),
    buildTopHashtags(userId),
  ]);

  const writingSamples = cleanList(prefs?.writingSamples);
  const proofPoints = cleanList(prefs?.proofPoints);
  const contentPillars = cleanList(prefs?.contentPillars);
  const aspirationalSamples = cleanList(prefs?.aspirationalSamples);
  const aboutMe = prefs?.aboutMe?.trim() ?? "";
  const directEvidence = writingSamples.length + (aboutMe ? 1 : 0);
  const learnedEvidence = voiceDNA ? 1 : 0;
  const confidence: BrandContextConfidence =
    directEvidence >= 2 && learnedEvidence > 0
      ? "grounded"
      : directEvidence > 0 || learnedEvidence > 0
        ? "developing"
        : "starting";

  const parts: string[] = [
    "## CANONICAL BRAND & VOICE CONTEXT",
    `Context confidence: ${confidence}. Treat this as guidance, not a license to invent details.`,
  ];

  const positioning: string[] = [];
  if (prefs?.brandRole) positioning.push(`- Role: ${prefs.brandRole}`);
  if (prefs?.brandAudience) positioning.push(`- Audience: ${prefs.brandAudience}`);
  if (prefs?.brandBelief) positioning.push(`- Core belief: ${prefs.brandBelief}`);
  if (prefs?.objective) positioning.push(`- Default objective: ${prefs.objective}`);
  if (prefs?.persona) positioning.push(`- Persona: ${prefs.persona}`);
  if (positioning.length > 0) parts.push(["Positioning (what this creator knows and stands for):", ...positioning].join("\n"));

  if (aboutMe) parts.push(`Creator background (use only as supplied, never embellish):\n${aboutMe}`);

  if (contentPillars.length > 0) {
    parts.push([
      "Content pillars (recurring territories, not mandatory topics for every post):",
      ...contentPillars.slice(0, 6).map((pillar) => `- ${pillar}`),
    ].join("\n"));
  }

  if (proofPoints.length > 0) {
    parts.push([
      "Verified proof points (use at most one when relevant; never invent or combine numbers):",
      ...proofPoints.slice(0, 8).map((point) => `- ${point}`),
    ].join("\n"));
  }

  if (aspirationalSamples.length > 0) {
    parts.push([
      "Aspirational style targets (style only; never reuse their topics, claims, stories, or phrases):",
      ...aspirationalSamples.slice(0, 3).map((sample, index) => `Style target ${index + 1}: "${sample.trim().slice(0, 600)}"`),
    ].join("\n"));
  }

  if (voiceDNA) parts.push(voiceDNA);
  const strategySignals = [performanceContext, learnedPatterns, topHashtags].filter(Boolean);
  if (strategySignals.length > 0) {
    parts.push([
      "## STRATEGY & RESONANCE SIGNALS",
      "Use these measured patterns to guide format, structure, and strategic framing. They are supporting evidence and must not replace the author's current voice settings or direct feedback.",
      ...strategySignals,
    ].join("\n"));
  }
  if (feedbackContext) {
    parts.push([
      "## SIGNAL PRECEDENCE",
      "Direct author feedback and current manual settings outrank accepted suggestions, published-post patterns, performance, external feedback, and automated inference.",
      "Use external feedback as post-level coaching only. Do not treat it as proof of AI authorship or silently rewrite the creator's Voice DNA.",
      feedbackContext,
    ].join("\n"));
  }

  return {
    context: parts.join("\n\n"),
    feedbackContext,
    objective: prefs?.objective ?? null,
    tone: prefs?.tone ?? null,
    persona: prefs?.persona ?? null,
    confidence,
    evidence: {
      writingSamples: writingSamples.length,
      proofPoints: proofPoints.length,
      contentPillars: contentPillars.length,
      hasAboutMe: Boolean(aboutMe),
      hasVoiceDNA: Boolean(voiceDNA),
    },
  };
}