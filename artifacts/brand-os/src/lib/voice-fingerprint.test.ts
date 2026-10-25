import { describe, expect, it } from "vitest";
import { compareToFingerprint, computeMetrics, fingerprintFromSamples, voiceRewriteInstruction } from "./voice-fingerprint";

const punchyOnce = (n: number) =>
  `I shipped ${n} releases in 6 weeks.\n\nWe didn't plan it. We just fixed what broke.\n\nWhy did it work? Because I stopped asking for permission.\n\nI'd do it again. My team would too.`;
const punchy = (n: number) => `${punchyOnce(n)}\n\n${punchyOnce(n + 10)}\n\n${punchyOnce(n + 20)}`;
const long = "The reason that most large organisations struggle to adapt is that their planning processes were designed for stability, and they reward predictability far more than they reward the kind of quick experimentation that would reveal what customers actually want, which is why transformation programmes so often stall after the first quarter.";

describe("fingerprint", () => {
  it("needs enough samples and words", () => {
    expect(fingerprintFromSamples([punchy(1), punchy(2)])).toBeNull();
    expect(fingerprintFromSamples([punchy(1), punchy(2), punchy(3)])).not.toBeNull();
  });

  it("scores a draft in the same shape higher than one in a different shape", () => {
    const fp = fingerprintFromSamples([punchy(1), punchy(2), punchy(3), punchy(4)])!;
    const same = compareToFingerprint(punchy(9), fp)!;
    const different = compareToFingerprint(`${long} ${long}`, fp)!;
    expect(same.match).toBeGreaterThan(different.match);
    expect(different.note).toContain("This draft has");
  });

  it("measures the same as the server on the same text", () => {
    const m = computeMetrics(punchyOnce(5))!;
    expect(m.sentenceLength).toBeCloseTo(4.857, 2);
    expect(m.firstPerson).toBeGreaterThan(8);
  });

  it("builds a rewrite instruction that protects the facts", () => {
    const fp = fingerprintFromSamples([punchy(1), punchy(2), punchy(3), punchy(4)])!;
    const different = compareToFingerprint(`${long} ${long}`, fp)!;
    const instruction = voiceRewriteInstruction(different)!;
    expect(instruction).toContain("average sentence length about");
    expect(instruction).toContain("Keep every fact");
    const same = compareToFingerprint(punchy(9), fp)!;
    expect(voiceRewriteInstruction(same)).toBeNull();
  });

  it("returns null for very short text", () => {
    expect(computeMetrics("Too short.")).toBeNull();
  });
});
