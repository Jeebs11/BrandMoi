import test from "node:test";
import assert from "node:assert/strict";
import { buildVoiceProfile, type VoicePost } from "./voice-profile.js";

const punchy = (n: number) =>
  `I shipped ${n} releases in 6 weeks.\n\nWe didn't plan it. We just fixed what broke.\n\nWhy did it work? Because I stopped asking for permission.\n\nI'd do it again. My team would too.\n\nI cut churn ${n}% too. We kept 12 customers.`;
const long = "The reason that most large organisations struggle to adapt is that their planning processes were designed for stability, and they reward predictability far more than they reward the kind of quick experimentation that would reveal what customers actually want, which is why transformation programmes so often stall after the first quarter of the year.";

function post(id: number, text: string, impressions: number | null, aiOriginal: string | null, day: number): VoicePost {
  return { id, date: new Date(Date.UTC(2026, 0, day)), text, aiOriginal, impressions };
}

test("finds what the best posts do differently and uses them as the target", () => {
  const posts = [
    ...[1, 2, 3, 4].map((i) => post(i, punchy(i), 3000 + i, null, i)),
    ...[5, 6, 7, 8, 9].map((i) => post(i, `${long} ${long}`, 200 + i, null, i)),
  ];
  const p = buildVoiceProfile(posts, []);
  assert.equal(p.measuredPosts, 9);
  assert.ok(p.winners && p.rest);
  assert.ok(p.insights.some((x) => x.key === "sentenceLength" && x.direction === "lower"));
  assert.equal(p.target?.basis, "best-performing");
});

test("falls back to your average until there are 8 measured posts", () => {
  const posts = [1, 2, 3, 4].map((i) => post(i, punchy(i), 1000 * i, null, i));
  const p = buildVoiceProfile(posts, []);
  assert.equal(p.winners, null);
  assert.equal(p.target?.basis, "published");
});

test("reports how AI-assisted posts sit against the hand-written baseline", () => {
  const posts = [
    ...[1, 2, 3, 4].map((i) => post(i, punchy(i), 1000, null, i)),
    ...[5, 6, 7].map((i) => post(i, `${long} ${long}`, 500, "ai draft text here", i)),
  ];
  const p = buildVoiceProfile(posts, []);
  assert.equal(p.baseline?.kind, "hand-written");
  assert.ok(p.drift && p.drift.assistedAvg !== null && p.drift.handwrittenAvg !== null);
  assert.ok(p.drift!.handwrittenAvg! > p.drift!.assistedAvg!);
});

test("returns an empty profile when there is too little writing", () => {
  const p = buildVoiceProfile([post(1, punchy(1), 100, null, 1)], []);
  assert.equal(p.average, null);
  assert.equal(p.target, null);
  assert.equal(p.baseline, null);
});
