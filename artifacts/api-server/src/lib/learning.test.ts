import assert from "node:assert/strict";
import { isAcceptedSuggestionCurrent, numericConfidence, shareConfidence } from "./learning.js";

assert.equal(
  isAcceptedSuggestionCurrent("tone", "Direct", "direct"),
  true,
  "matching current settings keep an accepted suggestion active",
);

assert.equal(
  isAcceptedSuggestionCurrent("tone", "Warm", "Direct"),
  false,
  "a later manual setting suppresses the stale accepted suggestion",
);

assert.equal(
  isAcceptedSuggestionCurrent("contentPillars", ["Strategy", "Founder stories"], "founder stories, strategy"),
  true,
  "content-pillar suggestions compare independent of order and casing",
);

assert.equal(numericConfidence(0.9, 5), "high", "a large, well-sampled difference is high confidence");
assert.equal(numericConfidence(0.6, 3), "medium", "a moderate difference with 3 per group is a nudge");
assert.equal(numericConfidence(0.3, 10), null, "a small difference is noise however many posts");
assert.equal(numericConfidence(1.5, 2), null, "two posts per group is never enough");
assert.equal(shareConfidence(60, 5), "high");
assert.equal(shareConfidence(35, 4), "medium");
assert.equal(shareConfidence(25, 10), null, "a 25-point swing in hook style is not enough");

console.log("learning precedence tests passed");