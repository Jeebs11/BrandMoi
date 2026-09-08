import { describe, expect, it } from "vitest";
import {
  EMPTY_MOMENT_DETAILS,
  HUMANISE_ACTIONS,
  composeGenerationInput,
  getDetailsUsed,
  getSpecificityQuestion,
  shouldShowSpecificityPrompt,
  type MomentDetails,
} from "./humanisation";

const partialDetails: MomentDetails = {
  ...EMPTY_MOMENT_DETAILS,
  scene: "In a client call on Thursday afternoon",
  changed: "We stopped trying to solve the wrong problem",
};

describe("human detail input", () => {
  it("keeps the original idea unchanged when every optional field is empty", () => {
    const rawInput = "I want to write about a difficult client decision.";

    expect(composeGenerationInput(rawInput, EMPTY_MOMENT_DETAILS)).toBe(rawInput);
    expect(getDetailsUsed(rawInput, EMPTY_MOMENT_DETAILS)).toEqual([
      { key: "idea", label: "Your idea", value: rawInput },
    ]);
  });

  it("includes only completed fields when details are partially filled", () => {
    const result = composeGenerationInput(
      "We changed our approach after a difficult call.",
      partialDetails,
    );

    expect(result).toContain("Human detail provided by the author:");
    expect(result).toContain("Specific moment or scene: In a client call on Thursday afternoon");
    expect(result).toContain("What changed or what I learned: We stopped trying to solve the wrong problem");
    expect(result).not.toContain("What was at stake or went wrong:");
    expect(result).not.toContain("What I did:");

    expect(getDetailsUsed("An idea", partialDetails)).toEqual([
      { key: "idea", label: "Your idea", value: "An idea" },
      {
        key: "scene",
        label: "Specific moment or scene",
        value: partialDetails.scene,
      },
      {
        key: "changed",
        label: "What changed or what I learned",
        value: partialDetails.changed,
      },
    ]);
  });
});

describe("specificity prompt", () => {
  it("is advisory and does not block generation when no details were captured", () => {
    const rawInput = "Our difficult client conversation changed our approach.";

    expect(shouldShowSpecificityPrompt(rawInput, EMPTY_MOMENT_DETAILS)).toBe(true);
    expect(getSpecificityQuestion(rawInput)).toBe(
      "What did the other person say or do in that moment?",
    );
    expect(composeGenerationInput(rawInput, EMPTY_MOMENT_DETAILS)).toBe(rawInput);
  });

  it("hides the prompt as soon as any optional detail is supplied", () => {
    expect(shouldShowSpecificityPrompt("A sufficiently long rough idea", partialDetails)).toBe(
      false,
    );
  });
});

describe("humanise actions", () => {
  it("keeps all four actions fact-preserving", () => {
    expect(HUMANISE_ACTIONS).toHaveLength(4);

    for (const action of HUMANISE_ACTIONS) {
      expect(action.instruction).toMatch(/preserve/i);
      expect(action.instruction).toMatch(/fact|specific|story/i);
      expect(action.instruction).toMatch(/return the complete revised post only/i);
    }
  });

  it("uses distinct instructions for each action", () => {
    expect(new Set(HUMANISE_ACTIONS.map((action) => action.instruction)).size).toBe(4);
  });
});