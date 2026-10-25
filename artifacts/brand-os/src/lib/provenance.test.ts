import { describe, expect, it } from "vitest";
import { computeInk, findFlagSpans } from "./provenance";

describe("computeInk", () => {
  it("marks untouched words as AI and new words as yours", () => {
    const ink = computeInk("We shipped the release late.", "We shipped the release late, and I owned it.");
    const you = ink.tokens.filter((t) => t.source === "you" && t.text.trim()).map((t) => t.text);
    expect(you).toEqual(expect.arrayContaining(["and", "I", "owned", "it."]));
    expect(ink.tokens.find((t) => t.text === "shipped")?.source).toBe("ai");
    expect(ink.yourPct).toBeGreaterThan(0);
    expect(ink.yourPct).toBeLessThan(100);
  });

  it("treats everything as yours when there is no AI original", () => {
    const ink = computeInk(null, "I wrote every word of this myself.");
    expect(ink.yourPct).toBe(100);
  });

  it("reports 0% yours when the text is unchanged", () => {
    const text = "Exactly what the model wrote.";
    expect(computeInk(text, text).yourPct).toBe(0);
  });

  it("preserves the text exactly", () => {
    const text = "Line one.\n\nLine two, with  spacing.";
    expect(computeInk("Line one.", text).tokens.map((t) => t.text).join("")).toBe(text);
  });
});

describe("findFlagSpans", () => {
  it("flags generic phrases, reframes and mic-drop endings", () => {
    const text = "Leadership isn't about control, it's about trust.\n\nA real game-changer.\n\nThat's the job.";
    const reasons = findFlagSpans(text).map((s) => s.reason).join(" | ");
    expect(reasons).toContain("Generic phrase");
    expect(reasons).toContain("reframe");
    expect(reasons).toContain("mic-drop");
  });

  it("matches whole phrases only", () => {
    expect(findFlagSpans("Real thought leadership is citing something uncomfortable.")).toEqual([]);
    expect(findFlagSpans("Every thought leader posts daily.").length).toBe(1);
  });

  it("stays quiet on specific writing", () => {
    expect(findFlagSpans("A client asked for a fourth dashboard view before anyone used the first three.")).toEqual([]);
  });
});
