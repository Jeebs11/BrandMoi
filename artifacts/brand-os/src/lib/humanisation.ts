export type MomentDetails = {
  scene: string;
  stakes: string;
  action: string;
  changed: string;
};

export const EMPTY_MOMENT_DETAILS: MomentDetails = {
  scene: "",
  stakes: "",
  action: "",
  changed: "",
};

export const HUMANISE_ACTIONS = [
  {
    key: "preserve-story",
    label: "Preserve the story",
    instruction:
      "Preserve the story, sequence, and every existing fact. Improve clarity and flow without adding or removing factual details. Return the complete revised post only.",
  },
  {
    key: "more-spoken",
    label: "Make it more spoken",
    instruction:
      "Make this sound more spoken and natural, as if the author is saying it to a thoughtful colleague. Preserve the story and all facts. Do not add fabricated specifics. Return the complete revised post only.",
  },
  {
    key: "add-texture",
    label: "Add texture",
    instruction:
      "Add texture through the existing details, sensory language, or pacing already present. Do not invent scenes, dialogue, names, numbers, or other specifics; use only details already in the post. Preserve the story. Return the complete revised post only.",
  },
  {
    key: "more-relatable",
    label: "Make it more relatable",
    instruction:
      "Make this more relatable by clarifying the human tension and takeaway using only what is already in the post. Do not invent experiences, facts, or specifics. Preserve the story. Return the complete revised post only.",
  },
] as const;

export type HumaniseAction = (typeof HUMANISE_ACTIONS)[number];

const HUMAN_DETAIL_FIELDS: Array<{
  key: keyof MomentDetails;
  label: string;
}> = [
  { key: "scene", label: "Specific moment or scene" },
  { key: "stakes", label: "What was at stake or went wrong" },
  { key: "action", label: "What I did" },
  { key: "changed", label: "What changed or what I learned" },
];

export type UsedDetail = {
  key: "idea" | keyof MomentDetails;
  label: string;
  value: string;
};

export function hasMomentDetails(momentDetails: MomentDetails): boolean {
  return Object.values(momentDetails).some((value) => value.trim().length > 0);
}

export function getSpecificityQuestion(rawInput: string): string {
  if (/team|client|customer|conversation|meeting/i.test(rawInput)) {
    return "What did the other person say or do in that moment?";
  }
  if (/fail|wrong|mistake|hard|stuck|problem/i.test(rawInput)) {
    return "What specifically went wrong, and what did you do next?";
  }
  return "What was happening right before you had to act?";
}

export function shouldShowSpecificityPrompt(
  rawInput: string,
  momentDetails: MomentDetails,
): boolean {
  const trimmedInput = rawInput.trim();
  const hasConcreteSignal =
    /\b(last|yesterday|today|this morning|this afternoon|this week|during|when|after|before|on monday|on tuesday|on wednesday|on thursday|on friday)\b|\d/i.test(
      rawInput,
    );

  return (
    trimmedInput.length >= 24 &&
    trimmedInput.length < 280 &&
    !hasMomentDetails(momentDetails) &&
    !hasConcreteSignal
  );
}

export function composeHumanDetailBlock(momentDetails: MomentDetails): string {
  const detailLines = HUMAN_DETAIL_FIELDS.map(({ key, label }) => {
    const value = momentDetails[key].trim();
    return value ? `${label}: ${value}` : "";
  }).filter(Boolean);

  return detailLines.length > 0
    ? `Human detail provided by the author:\n${detailLines.join("\n")}`
    : "";
}

export function composeGenerationInput(
  rawInput: string,
  momentDetails: MomentDetails,
): string {
  const humanDetailBlock = composeHumanDetailBlock(momentDetails);
  return humanDetailBlock
    ? `${rawInput.trim()}\n\n${humanDetailBlock}`
    : rawInput;
}

export function getDetailsUsed(
  rawIdea: string,
  momentDetails: MomentDetails,
): UsedDetail[] {
  return [
    { key: "idea" as const, label: "Your idea", value: rawIdea.trim() },
    ...HUMAN_DETAIL_FIELDS.map(({ key, label }) => ({
      key,
      label,
      value: momentDetails[key].trim(),
    })),
  ].filter((detail) => detail.value);
}