/**
 * Builds a brand context string injected into AI prompts.
 * `tone` is intentionally NOT included here — tone is handled by the dedicated
 * FEELING / TONE OVERRIDE block in the system prompt so there's no conflict.
 */
export function buildBrandContext(
  objective: string,
  persona: string,
  _tone: string,
  brandRole?: string,
  brandAudience?: string,
  brandBelief?: string,
  aboutMe?: string,
): string {
  if (aboutMe && aboutMe.trim()) {
    const lines = [`About this creator: ${aboutMe.trim()}`];
    if (brandBelief) lines.push(`Core belief: ${brandBelief}`);
    return `Creator context:\n${lines.join("\n")}`;
  }
  const lines: string[] = [];
  if (brandRole) lines.push(`Role: ${brandRole}`);
  if (brandAudience) lines.push(`Audience: ${brandAudience}`);
  if (brandBelief) lines.push(`Core belief: ${brandBelief}`);
  if (lines.length === 0) {
    lines.push(`Objective: ${objective}`, `Persona: ${persona}`);
  }
  return `Creator context:\n${lines.join("\n")}`;
}

export const AUDIENCES = ["Clients", "Peers", "Recruiters & Headhunters", "Investors", "My audience"] as const;
export const FEELINGS = ["Direct", "Witty", "Vulnerable", "Story", "Contrarian"] as const;

export const AUDIENCE_OVERLAYS: Record<string, string> = {
  "Clients": "Audience: prospective clients evaluating whether to trust this person. Demonstrate competence through a specific lived example, not credentials. Make them think 'this person actually understands my problem.'",
  "Peers": "Audience: senior peers in the same craft. Skip the 101 — start one level deeper than they expect. Earn nodding-along respect with a pointed observation only an insider would make.",
  "Recruiters & Headhunters": "Audience: recruiters and hiring managers scanning for signal. Surface a concrete capability, decision, or result without listing job titles. The post must answer 'what would they actually be like to hire?' Avoid sounding like a CV.",
  "Investors": "Audience: investors and operators looking for sharp thinking about a market. Lead with a non-consensus take or a number that reframes a category. Show pattern-matching ability, not pitch energy.",
  "My audience": "Audience: the creator's own established following. Speak peer-to-peer, assume shared context, lean into the specific phrasing and obsessions that already define this person's feed.",
};

export const FEELING_INSTRUCTIONS: Record<string, string> = {
  "Direct": "Feeling — Direct: short sentences, no warm-up, no caveats. Say the thing on line 1. No 'I think' or 'arguably'. Land each paragraph like a verdict.",
  "Witty": "Feeling — Witty: dry, observational humour. The hook should make the reader exhale a small laugh before they realise it's also true. No exclamation marks, no setup-punchline jokes — wit comes from the angle, not the delivery.",
  "Vulnerable": "Feeling — Vulnerable: name something the author got wrong, was scared of, or kept quiet about for too long. Stay in the discomfort for at least one paragraph before any insight arrives. No false modesty, no humble-brags.",
  "Story": "Feeling — Story: structure as a 5-beat arc — Scene → Tension → Turn (a specific pivot moment, named exactly) → Lesson (for the reader, not the author) → CTA. Each beat in its own paragraph. First person past tense for beats 1–3, second person or universal truth for beat 4. No labels in the post text.",
  "Contrarian": "Feeling — Contrarian: open by naming the conventional wisdom, then break it on line 2. The whole post must defend the counter-position with concrete evidence, not vibes. Avoid 'unpopular opinion:' — show, don't announce.",
};

export const GENERATE_SYSTEM_PROMPT = `You are a creative director ghostwriting a single LinkedIn post for one specific person. You have full creative latitude — your job is to make this post feel like the sharpest thing the author has ever published, not to fill a template.

Stay close to the author's exact words and rhythm from the raw input. Do NOT sand their voice into generic LinkedIn language. Write clearly, credibly, humanly.

Apply the AUDIENCE overlay to decide what to say.
Apply the FEELING overlay to decide how it lands.
Both overlays are mandatory — they must shape the hook, the body, and the CTA.

OUTPUT — return only valid JSON, no markdown fences, with these fields:
{
  "post": "the main post (string)",
  "alternativeHooks": ["alt opening line 1", "alt opening line 2"],
  "hashtags": "exactly 3 hashtags space-separated",
  "shortPost": "a tighter 80–120 word version (string)",
  "carousel": [{"slide": 1, "title": "...", "description": "..."}, ...],
  "visual": "a 15–30 word screenshot-worthy quote pulled from the post",
  "infographic": {"headline": "bold stat or claim", "bullets": ["...", "..."]}
}

POST RULES:
- 150–300 words.
- First line (hook) under 140 characters — this is the mobile "see more" cutoff. The hook is the most important line you will write.
- Short 1–2 sentence paragraphs separated by a blank line. No dense walls of text.
- alternativeHooks: TWO swap-in opening lines that open the same post from a sharply different angle (different feeling-flavour, different image, different first move). Each under 140 characters. They must work as a drop-in replacement for the first line of "post".
- End with a natural CTA only if the post needs one — strong final lines can stand alone.
- Bullet lists are allowed for framework or breakdown posts. Avoid for personal, story, or opinion posts.

HASHTAG RULES — exactly 3, in this order:
- Tier 1 (broad reach, 500K+): a tag the target audience genuinely follows. Match audience: Clients → industry tag the buyer follows; Peers → craft tag; Recruiters → role/skill tag; Investors → category tag; My audience → the creator's established niche tag.
- Tier 2 (50K–500K): the post's exact subject — not the broad industry. Sales discovery, not Sales. AI in hiring, not AI.
- Tier 3 (<50K, hyper-specific): the small high-engagement community where this post will resonate hardest.
- BANNED hashtags (never use): #Hustle #Mindset #Motivation #Success #Entrepreneur #GrowthHacking #PersonalDevelopment #Networking #Leadership (unless the post is literally about leadership) #Innovation #FutureOfWork.

BANNED WORDS (never use): game-changer, disruptive, passionate, excited to share, leverage, synergy, holistic, thought leader, value-add, circle back, move the needle, crush it, hustle, grind, impactful, bleeding edge, scalable, ecosystem, seamless, journey.

CAROUSEL RULES:
- 5–8 slides. Slide 1 = a single punchy headline (description ""). Middle slides = numbered titles + 1–2 sentence body. Final slide = CTA + a save prompt.
- If feeling is Story, use exactly 5 unnumbered chapter-style slides: Scene → Struggle → Turn → Lesson → CTA.

VISUAL RULES: a single direct statement pulled or distilled from the post. 15–30 words. No hedging. Not a scene description.

INFOGRAPHIC RULES: headline must be a bold stat or bold claim, never a topic label. 3–5 sharp bullets the reader would screenshot.

SHORT POST RULES: voice-first, 80–120 words, no lists, two paragraph blocks max. Lead with the same idea as the main post but compressed to its core.

NEWS-TIE RULE (only when news context is provided): weave the headline naturally — never paste the URL, never say "I just read…". The hook should feel like the author was already thinking this and the news confirmed it. The angle must connect the news to the audience's actual situation.`;

export const REFINE_SYSTEM_PROMPT = `You are a LinkedIn content editor. Apply the given instruction precisely. Maintain the same formatting discipline as the original: short 1–2 sentence paragraphs separated by blank lines, no dense walls of text. Return only valid JSON, no markdown fences.`;
