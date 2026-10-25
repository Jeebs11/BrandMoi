import { describe, expect, it } from "vitest";
import { isOffTerritory } from "./pillar-fit";

const profile = {
  contentPillars: ["Product strategy", "SaaS growth"],
  brandRole: "Head of Product at a B2B SaaS company",
  brandAudience: "Founders and product leaders",
  proofPoints: ["Grew ARR from $5m to $30m in three years"],
};

describe("isOffTerritory", () => {
  it("stays quiet when the idea shares vocabulary with the profile", () => {
    const idea = "Our product roadmap slipped because we tried to ship every request from the biggest customers during one quarter.";
    expect(isOffTerritory(idea, profile)).toBe(false);
  });

  it("flags a long idea with nothing in common", () => {
    const idea = "Yesterday I baked sourdough for the first time and the crust turned out wonderfully crisp after an overnight rest in the fridge.";
    expect(isOffTerritory(idea, profile)).toBe(true);
  });

  it("does not judge short ideas or empty profiles", () => {
    expect(isOffTerritory("Sourdough is great.", profile)).toBe(false);
    expect(isOffTerritory("Yesterday I baked sourdough for the first time and the crust turned out wonderfully crisp after an overnight rest.", {})).toBe(false);
  });
});
