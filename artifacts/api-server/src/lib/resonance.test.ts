import test from "node:test";
import assert from "node:assert/strict";
import { rankedResonance } from "./resonance.js";

const sig = (impressions: number, reactions: number) => ({ impressions, reactions, comments: 0, reposts: 0, saves: 0 });

test("does not saturate: strong posts keep distinct ranks", () => {
  const items = [1, 2, 3, 4, 5].map((i) => ({ id: i, signal: sig(1000 * i, 100 * i * i) }));
  const ranks = rankedResonance(items);
  const values = [...ranks.values()];
  assert.equal(new Set(values).size, values.length);
  assert.ok(ranks.get(5)! > ranks.get(4)! && ranks.get(4)! > ranks.get(1)!);
});

test("sees a fall in reach even when engagement rate holds", () => {
  const items = [
    { id: 1, signal: sig(3000, 150) },
    { id: 2, signal: sig(2900, 145) },
    { id: 3, signal: sig(240, 12) },
    { id: 4, signal: sig(200, 10) },
  ];
  const ranks = rankedResonance(items);
  assert.ok(ranks.get(1)! > ranks.get(3)!);
  assert.ok(ranks.get(2)! > ranks.get(4)!);
});

test("returns nothing when there are too few posts to rank", () => {
  assert.equal(rankedResonance([{ id: 1, signal: sig(100, 5) }, { id: 2, signal: sig(200, 9) }]).size, 0);
});
