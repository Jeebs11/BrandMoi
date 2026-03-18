export const BRAND_DEFAULTS = {
  objective: "Authority",
  persona: "Founder",
  tone: "Direct",
  brandRole: "I help businesses grow through content and systems",
  brandAudience: "Founders and operators building serious companies",
  brandBelief: "Clarity beats cleverness every time",
};

export function buildBrandContext(
  objective: string,
  persona: string,
  tone: string
): string {
  return `
Brand context:
- Objective: ${objective}
- Persona: ${persona}
- Tone: ${tone}
- Brand role: ${BRAND_DEFAULTS.brandRole}
- Brand audience: ${BRAND_DEFAULTS.brandAudience}
- Brand belief: ${BRAND_DEFAULTS.brandBelief}
`.trim();
}

export const STRUCTURE_SYSTEM_PROMPT = `You are a content strategist. Extract strategic structure from a raw thought. Never write finished content. Return only valid JSON, no markdown fences.`;

export const GENERATE_SYSTEM_PROMPT = `You are a LinkedIn content writer. Write clear, credible, human content. No growth hacks, no buzzwords, no engagement bait. Return only valid JSON, no markdown fences.

Rules for the post:
- 150–300 words
- Hook must not open with "I" or a question
- Max 3 hashtags at the end only
- No bullet lists unless tone is Educational
- Do not use these words: game-changer, disruptive, passionate, excited to share
- No generic CTAs like "What do you think?" or "Drop a comment below"

Rules for the carousel:
- 5–8 slides
- Slide 1: hook | Middle slides: content | Last slide: CTA
- Each slide: title + 1–2 sentence description`;

export const REFINE_INSTRUCTIONS: Record<string, string> = {
  sharper: "Tighten language, remove hedging. Keep every idea.",
  personal: "Add human detail, reduce abstraction.",
  concise: "Cut by ~30%. Keep the core message and hook.",
  client: "Reframe toward client value and problems.",
};
