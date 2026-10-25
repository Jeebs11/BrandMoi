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
assert.ok(
  checkGenericPatterns("Leadership isn't about control, it's about trust.\n\nTeams follow people they trust.").includes('a "not X, it\'s Y" reframe'),
  "negation-then-reframe is flagged",
);

assert.ok(
  checkGenericPatterns("The hardest thing a leader can do is listen.\n\nMost never learn how.").includes("a sweeping-superlative hook"),
  "sweeping superlative hooks are flagged",
);

assert.ok(
  checkGenericPatterns("Name the status.\n\nEscalate early.\n\nOwn the conversation.\n\nThen move on.").includes("a run of three short parallel lines"),
  "runs of three short parallel lines are flagged",
);

const vague = "Teams that communicate well tend to perform better over time because people feel safe raising problems early and leaders respond with curiosity instead of blame, which keeps projects moving and makes it much easier to adapt when circumstances change unexpectedly and priorities shift. Good habits compound quietly over many months and eventually become the way a whole group simply works together every day.";
assert.ok(
  checkGenericPatterns(vague).includes("no numbers, names or quotes to anchor it"),
  "long vague posts with no specifics are flagged",
);
assert.ok(
  !checkGenericPatterns(vague.replace("Teams", "At Acme, 3 of our teams")).includes("no numbers, names or quotes to anchor it"),
  "a number or name satisfies the specifics check",
);
