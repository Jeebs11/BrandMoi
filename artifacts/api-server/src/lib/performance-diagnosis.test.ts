import test from "node:test";
import assert from "node:assert/strict";
import { diagnosePerformance, type DiagnosisPost } from "./performance-diagnosis.js";

function post(id: number, date: string, impressions: number, text: string, extra: Partial<DiagnosisPost> = {}): DiagnosisPost {
  return {
    id, postedAt: new Date(date), impressions, reactions: 0, comments: 0, reposts: 0, saves: 0, sends: 0,
    text, aiOriginalText: null, hasVisual: false, ...extra,
  };
}

test("reports a drop across the July classifier date", () => {
  const posts = [
    post(1, "2026-06-01", 3000, "Cut churn 18% in 90 days."),
    post(2, "2026-06-10", 2800, "We shipped 3 releases."),
    post(3, "2026-06-20", 3200, "Hired 12 people."),
    post(4, "2026-08-05", 300, "Some thoughts on leadership."),
    post(5, "2026-08-12", 250, "More thoughts on teams."),
    post(6, "2026-08-20", 200, "Thoughts on culture."),
    post(7, "2026-08-27", 220, "Thoughts on hiring."),
    post(8, "2026-09-03", 180, "Thoughts on process."),
  ];
  const d = diagnosePerformance(posts);
  assert.equal(d.eras.length, 2);
  assert.ok(d.findings.some((f) => f.includes("AI-slop classifiers") && f.includes("can't prove")));
  assert.ok(d.recent && d.recent.changePct < -80);
});

test("flags numbers as a differentiator only with enough posts per side", () => {
  const withNumbers = [1, 2, 3].map((i) => post(i, `2026-05-0${i}`, 2000, "We grew 40% in 6 months."));
  const without = [4, 5, 6].map((i) => post(i, `2026-05-1${i}`, 500, "Reflections on growth."));
  const d = diagnosePerformance([...withNumbers, ...without]);
  const s = d.splits.find((x) => x.key === "numbers");
  assert.ok(s && s.liftPct > 100);
  const sparse = diagnosePerformance([...withNumbers.slice(0, 2), ...without]);
  assert.equal(sparse.splits.find((x) => x.key === "numbers"), undefined);
});

test("says so when there is too little data", () => {
  const d = diagnosePerformance([post(1, "2026-05-01", 1000, "One post.")]);
  assert.ok(d.findings[0]!.includes("Only 1 measured posts"));
});
