import assert from "node:assert/strict";
import { checkGenericPatterns } from "./authenticity-check.js";

assert.ok(
  checkGenericPatterns("Nobody talks about this problem.\n\nHere is the rest of the post.").includes("a clickbait opening line"),
  "clickbait openings are flagged",
);

assert.ok(
  checkGenericPatterns("A client asked for a fourth dashboard view.\n\nWe left it out.\n\nThat's the job.").includes("a generic mic-drop ending"),
  "generic mic-drop endings are flagged",
);

assert.ok(
  checkGenericPatterns("Here are 3 lessons from the project.\n\nThe first one mattered most.").includes("a templated list hook"),
  "templated list hooks remain flagged",
);

assert.deepEqual(
  checkGenericPatterns("A client asked for a fourth dashboard view before anyone had used the first three.\n\nI asked which decision it would change."),
  [],
  "specific, grounded openings are not flagged",
);

console.log("authenticity pattern tests passed");