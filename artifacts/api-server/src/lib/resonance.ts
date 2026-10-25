// Rank-based resonance for LEARNING (which of this author's posts to learn from).
//
// The absolute 0-100 score in learning.ts saturates (many strong posts all hit
// the cap) and only looks at engagement per impression, so it can't see a fall
// in reach. This ranks each post against the author's OTHER measured posts on
// two things — how many people it reached and how much it engaged them — and
// blends the ranks. It is relative by design (the average is always ~50), so it
// is for choosing patterns to learn from, never for showing a user a "score".
//
// The engagement weights (reaction 3, comment 5, repost 4, save 8) are
// BrandMoi's own; LinkedIn does not publish its weighting. They only decide the
// order of the author's posts here.

export interface ResonanceInput {
  impressions: number;
  reactions: number;
  comments: number;
  reposts: number;
  saves?: number;
  membersReached?: number;
}

export const MIN_POSTS_FOR_RANKING = 3;

export function engagementPerReach(s: ResonanceInput): number {
  const weight = s.reactions * 3 + s.comments * 5 + s.reposts * 4 + (s.saves ?? 0) * 8;
  const reach = (s.membersReached ?? 0) > 0 ? (s.membersReached ?? 0) : s.impressions;
  return reach > 0 ? weight / reach : 0;
}

/** Percentile rank (0-100) of each value among the others; ties share their mean rank. */
function percentileRanks(values: number[]): number[] {
  const n = values.length;
  return values.map((v) => {
    let below = 0;
    let equal = 0;
    for (const other of values) {
      if (other < v) below++;
      else if (other === v) equal++;
    }
    return n > 1 ? (100 * (below + (equal - 1) / 2)) / (n - 1) : 50;
  });
}

/** Blended reach + engagement rank for each post; empty if there are too few to rank. */
export function rankedResonance(items: Array<{ id: number; signal: ResonanceInput }>): Map<number, number> {
  const out = new Map<number, number>();
  if (items.length < MIN_POSTS_FOR_RANKING) return out;
  const reach = percentileRanks(items.map((i) => i.signal.impressions));
  const engagement = percentileRanks(items.map((i) => engagementPerReach(i.signal)));
  items.forEach((item, index) => {
    out.set(item.id, Math.round(reach[index]! * 0.5 + engagement[index]! * 0.5));
  });
  return out;
}
