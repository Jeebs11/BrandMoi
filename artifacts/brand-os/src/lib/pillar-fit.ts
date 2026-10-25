// Rule-based check for "does this idea connect to what my profile says I do?".
// LinkedIn's feed model reads the author's headline and experience next to the
// post (per its engineering post), so a post far from the author's territory
// is a plausible reach risk. This is a soft nudge, never a block: it only
// speaks when the idea shares no meaningful vocabulary with the profile.

const STOPWORDS = new Set([
  "about", "after", "again", "also", "because", "been", "being", "could", "does", "doing", "done",
  "from", "have", "having", "here", "into", "just", "like", "made", "make", "more", "most", "much",
  "only", "over", "really", "should", "some", "than", "that", "their", "them", "then", "there",
  "these", "they", "thing", "things", "this", "those", "very", "want", "were", "what", "when",
  "where", "which", "while", "will", "with", "would", "your", "work", "team", "people",
]);

const MIN_INPUT_WORDS = 15;

export type TerritoryProfile = {
  contentPillars?: string[] | null;
  brandRole?: string | null;
  brandAudience?: string | null;
  proofPoints?: string[] | null;
};

function stems(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().match(/[a-z]{4,}/g) ?? []) {
    if (STOPWORDS.has(raw)) continue;
    out.add(raw.replace(/(?:ing|ed|es|s)$/, ""));
  }
  return out;
}

export function territoryLabel(profile: TerritoryProfile): string[] {
  return (profile.contentPillars ?? []).filter((p) => p.trim()).slice(0, 3);
}

/** True when the idea is long enough to judge and shares nothing with the profile. */
export function isOffTerritory(idea: string, profile: TerritoryProfile): boolean {
  const territory = [
    ...(profile.contentPillars ?? []),
    profile.brandRole ?? "",
    profile.brandAudience ?? "",
    ...(profile.proofPoints ?? []),
  ].join(" ");
  const territoryStems = stems(territory);
  if (territoryStems.size === 0) return false;

  if (idea.trim().split(/\s+/).filter(Boolean).length < MIN_INPUT_WORDS) return false;
  const ideaStems = stems(idea);
  if (ideaStems.size === 0) return false;
  for (const stem of ideaStems) {
    if (territoryStems.has(stem)) return false;
  }
  return true;
}
