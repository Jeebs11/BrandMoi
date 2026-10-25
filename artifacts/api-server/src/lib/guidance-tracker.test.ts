import test from "node:test";
import assert from "node:assert/strict";
import { trackGuidance, type TrackedPost } from "./guidance-tracker.js";

const day = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 86400000);
const p = (posted: number, logged: number, impressions: number): TrackedPost => ({ postedAt: day(posted), loggedAt: day(logged), impressions });

test("is inactive until enough posts have results", () => {
  const stages = trackGuidance([p(1, 2, 100), p(3, 4, 100)]);
  assert.ok(stages.every((s) => s.status === "inactive"));
});

test("refuses to date guidance when results were logged in bulk", () => {
  const posts = Array.from({ length: 9 }, (_, i) => p(i * 3, 40, 500));
  const stages = trackGuidance(posts);
  assert.equal(stages[0]!.status, "undatable");
  assert.ok(stages[0]!.caveats[0]!.includes("one go"));
});

test("compares posts before and after the guidance began, and refuses to take credit across a platform change", () => {
  // Logged a week apart; the 3rd result is logged on day 15, so performance
  // history starts then. Posts 0-12 fall before, 15+ after.
  const posts = [
    p(0, 1, 1000), p(4, 8, 1100), p(8, 15, 900),
    p(16, 20, 2000), p(20, 25, 2200), p(24, 30, 1800), p(28, 35, 2100),
  ];
  const stage = trackGuidance(posts, new Date(Date.UTC(2026, 11, 1)))[0]!;
  assert.equal(stage.status, "tracking");
  assert.equal(stage.before!.posts, 3);
  assert.equal(stage.after!.posts, 4);
  assert.ok(stage.changePct! > 80);
});

test("says it's too early when one side has too few posts", () => {
  const posts = [p(0, 1, 100), p(4, 8, 100), p(8, 15, 100), p(16, 20, 100)];
  const stage = trackGuidance(posts)[0]!;
  assert.equal(stage.status, "too_early");
});
