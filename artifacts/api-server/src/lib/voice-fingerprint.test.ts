import test from "node:test";
import assert from "node:assert/strict";
import { computeMetrics, matchScore, meanMetrics, styleTargetsText, winnerInsights } from "./voice-fingerprint.js";

const punchyOnce = (n: number) =>
  `I shipped ${n} releases in 6 weeks.\n\nWe didn't plan it. We just fixed what broke.\n\nWhy did it work? Because I stopped asking for permission.\n\nI'd do it again. My team would too.`;
const punchy = (n: number) => `${punchyOnce(n)}\n\n${punchyOnce(n + 10)}\n\n${punchyOnce(n + 20)}`;
const long = "The reason that most large organisations struggle to adapt is that their planning processes were designed for stability, and they reward predictability far more than they reward the kind of quick experimentation that would reveal what customers actually want, which is why transformation programmes so often stall after the first quarter.";

test("matches the client's measurements on the same text", () => {
  const m = computeMetrics(punchyOnce(5))!;
  assert.ok(Math.abs(m.sentenceLength - 4.857) < 0.01, `sentenceLength ${m.sentenceLength}`);
  assert.ok(m.firstPerson > 8 && m.firstPerson < 20);
  assert.ok(m.questions > 0.05);
  assert.ok(m.contractions > 3);
});

test("a same-shape draft scores higher than a different shape", () => {
  const target = meanMetrics([1, 2, 3].map((n) => computeMetrics(punchy(n))!))!;
  const same = matchScore(computeMetrics(punchy(9))!, target);
  const different = matchScore(computeMetrics(`${long} ${long}`)!, target);
  assert.ok(same > different, `${same} vs ${different}`);
});

test("winner insights name the axes that differ", () => {
  const top = computeMetrics(punchy(1))!;
  const rest = computeMetrics(`${long} ${long}`)!;
  const insights = winnerInsights(top, rest);
  assert.ok(insights.length > 0);
  assert.ok(insights.some((i) => i.key === "sentenceLength" && i.direction === "lower"));
});

test("style targets read as instructions", () => {
  const text = styleTargetsText(computeMetrics(punchy(1))!, "best-performing");
  assert.ok(text.includes("STYLE TARGETS") && text.includes("sentence length"));
});
