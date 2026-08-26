import assert from "node:assert/strict";
import { isAcceptedSuggestionCurrent } from "./learning.js";

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

console.log("learning precedence tests passed");