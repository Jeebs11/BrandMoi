export type MomentDetails = {
  scene: string;
  stakes: string;
  action: string;
  changed: string;
};

export type IdeaTerritoryKey =
  | "hard_won_lesson"
  | "industry_belief"
  | "audience_pain"
  | "behind_the_scenes"
  | "operating_principle"
  | "market_observation";

export type IdeaModeKey =
  | "messy_thought"
  | "from_experience"
  | "market_moment"
  | "audience_pain"
  | "past_post"
  | "profile_positioning"
  | "lesson_learned";

export type IdeaQualitySignal = {
  key: "specificity" | "tension" | "audience" | "proof" | "freshness";
  label: string;
  passed: boolean;
  detail: string;
};

export type IdeaQuality = {
  score: number;
  label: "Strong" | "Needs detail" | "Too broad";
  summary: string;
  missingPrompt: string | null;
  signals: IdeaQualitySignal[];
};

export const EMPTY_MOMENT_DETAILS: MomentDetails = {
  scene: "",
  stakes: "",
  action: "",
  changed: "",
};

export const IDEA_TERRITORIES: Array<{
  key: IdeaTerritoryKey;
  label: string;
  description: string;
}> = [
  { key: "hard_won_lesson", label: "Hard-won lesson", description: "Something you learned through pressure, failure, or repetition." },
  { key: "industry_belief", label: "Industry belief", description: "A point of view about how your field really works." },
  { key: "audience_pain", label: "Audience pain", description: "A problem your reader feels but may not have named clearly." },
  { key: "behind_the_scenes", label: "Behind the scenes", description: "A decision, process, tradeoff, or working note from your day-to-day." },
  { key: "operating_principle", label: "Operating principle", description: "A rule, standard, or habit that shapes how you work." },
  { key: "market_observation", label: "Market observation", description: "A timely pattern you are seeing in the market or profession." },
];

export const IDEA_MODES: Array<{
  key: IdeaModeKey;
  label: string;
  prompt: string;
}> = [
  { key: "messy_thought", label: "Messy thought", prompt: "Shape this from a rough, unfinished thought." },
  { key: "from_experience", label: "My experience", prompt: "Pull the angle from a real experience or decision." },
  { key: "market_moment", label: "Market moment", prompt: "Connect this to a market shift, news pattern, or industry change." },
  { key: "audience_pain", label: "Audience pain", prompt: "Start from the reader's worry, mistake, delay, or objection." },
  { key: "past_post", label: "Past post", prompt: "Borrow the strategic pattern from something that worked before, without copying it." },
  { key: "profile_positioning", label: "Profile fit", prompt: "Tie this back to the author's positioning and authority." },
  { key: "lesson_learned", label: "Lesson learned", prompt: "Turn this into a grounded lesson without forcing a moral." },
];

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

export function getIdeaTerritory(key: IdeaTerritoryKey) {
  return IDEA_TERRITORIES.find((territory) => territory.key === key) ?? IDEA_TERRITORIES[0];
}

export function getIdeaMode(key: IdeaModeKey) {
  return IDEA_MODES.find((mode) => mode.key === key) ?? IDEA_MODES[0];
}

export function analyzeIdeaQuality(
  rawInput: string,
  momentDetails: MomentDetails,
  audience: string,
  territory: IdeaTerritoryKey,
): IdeaQuality {
  const input = rawInput.trim();
  const details = Object.values(momentDetails).filter((value) => value.trim().length > 0);
  const words = input.split(/\s+/).filter(Boolean);
  const hasConcreteSignal =
    /\b(last|yesterday|today|this morning|this afternoon|this week|during|when|after|before|client|customer|team|meeting|project|launch|deal|interview|manager|founder)\b|\d/i.test(input)
    || details.length > 0;
  const hasTension = /\b(but|however|hard|wrong|mistake|stuck|risk|tradeoff|tension|friction|problem|delay|failed|pressure|surprised|changed)\b/i.test(input)
    || Boolean(momentDetails.stakes.trim());
  const hasAudience = audience !== "My audience"
    || /\b(founders|clients|customers|recruiters|investors|teams|managers|operators|leaders|candidates|buyers)\b/i.test(input);
  const hasProof = Boolean(momentDetails.action.trim() || momentDetails.changed.trim())
    || /\b(i|we|my|our|built|shipped|led|learned|noticed|tested|worked|saw|helped)\b/i.test(input);
  const territoryLabel = getIdeaTerritory(territory).label;
  const hasFreshness = words.length >= 8 && !/^(leadership|mindset|growth|success|innovation|personal branding)$/i.test(input);

  const signals: IdeaQualitySignal[] = [
    {
      key: "specificity",
      label: "Specific detail",
      passed: hasConcreteSignal,
      detail: hasConcreteSignal ? "There is a concrete anchor to build from." : "Add a real moment, person, number, or situation.",
    },
    {
      key: "tension",
      label: "Tension",
      passed: hasTension,
      detail: hasTension ? "There is friction or a reason the reader should care." : "Name what is difficult, misunderstood, delayed, or at stake.",
    },
    {
      key: "audience",
      label: "Reader fit",
      passed: hasAudience,
      detail: hasAudience ? "The reader is clear enough." : "Choose a sharper audience or name who this helps.",
    },
    {
      key: "proof",
      label: "Author proof",
      passed: hasProof,
      detail: hasProof ? "The idea has some connection to your work or judgment." : "Add what you saw, did, learned, or believe from experience.",
    },
    {
      key: "freshness",
      label: territoryLabel,
      passed: hasFreshness,
      detail: hasFreshness ? `This fits a reusable ${territoryLabel.toLowerCase()} territory.` : "The topic is still broad; make the angle less generic.",
    },
  ];

  const score = signals.filter((signal) => signal.passed).length;
  const missing = signals.find((signal) => !signal.passed);
  const label = score >= 4 ? "Strong" : score >= 2 ? "Needs detail" : "Too broad";
  const summary = score >= 4
    ? "Strong enough to draft. A little human texture will still help."
    : score >= 2
    ? "Usable, but one more concrete detail will make the post sound more lived-in."
    : "This is likely to produce generic content unless you add a sharper human anchor.";

  return {
    score,
    label,
    summary,
    missingPrompt: missing ? missing.detail : null,
    signals,
  };
}

export function composeIdeaEngineContext(
  territory: IdeaTerritoryKey,
  mode: IdeaModeKey,
  quality: IdeaQuality,
): string {
  const selectedTerritory = getIdeaTerritory(territory);
  const selectedMode = getIdeaMode(mode);
  const weakSignals = quality.signals.filter((signal) => !signal.passed);

  return [
    "Idea engine context:",
    `Territory: ${selectedTerritory.label} — ${selectedTerritory.description}`,
    `Mode: ${selectedMode.label} — ${selectedMode.prompt}`,
    `Pre-draft quality: ${quality.label} (${quality.score}/5). ${quality.summary}`,
    weakSignals.length > 0
      ? `Missing signals to compensate for without inventing: ${weakSignals.map((signal) => signal.label).join(", ")}. If evidence is missing, keep the post grounded and do not fabricate specifics.`
      : "The idea has enough signal; preserve the human evidence and avoid over-polishing.",
  ].join("\n");
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
