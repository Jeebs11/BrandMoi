const DEMO_EMAIL = "demo@brandos.app";

export { DEMO_EMAIL };

export function isDemoUser(email: string | undefined): boolean {
  return email === DEMO_EMAIL;
}

export async function demoDelay(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 700));
}

export const DEMO_GENERATE_RESPONSES = [
  {
    post: `Most founders think "authentic" means sharing failures.\n\nIt doesn't.\n\nAuthentic means *specific*.\n\nAnyone can say "I failed and learned."\n\nFew say: "At 2:47am I deleted 3 months of code because I couldn't sleep knowing it was wrong."\n\nSpecificity is credibility.\nSpecificity is voice.\nSpecificity is what people actually remember.\n\nYour stories aren't too small to share.\nThey're too vague.`,
    alternativeHooks: [
      `The word "authentic" has lost all meaning on LinkedIn.`,
      `Your audience doesn't need your highlight reel. They need your specifics.`,
    ],
    shortPost: `"Authentic" doesn't mean vulnerable.\n\nIt means specific.\n\nAnyone can say they failed. Few say exactly when, how, and what it cost them.\n\nSpecificity is your real voice.`,
    carousel: [
      { slide: 1, title: "Stop being 'authentic'", description: "That word means nothing. Here's what actually builds trust on LinkedIn." },
      { slide: 2, title: "Authentic = Specific", description: "Vague vulnerability is just noise. Precise moments are what people remember." },
      { slide: 3, title: "Two posts — which stays with you?", description: "'I failed and learned' vs 'At 2:47am I deleted 3 months of work.' Feel the difference." },
      { slide: 4, title: "Your specifics ARE your brand", description: "The exact number. The exact time. The exact feeling. That's where your voice lives." },
      { slide: 5, title: "One thing to do today", description: "Take your last post. Add one specific detail. Watch what changes." },
    ],
    visual: "A close-up of a laptop screen at 2:47 AM, lines of code reflected in a developer's glasses. Cinematic, moody blue light, quiet intensity.",
    infographic: {
      headline: "Authenticity vs Specificity on LinkedIn",
      bullets: [
        "Vague: 'I failed and learned from it'",
        "Specific: 'At 2:47am I deleted 3 months of code'",
        "Specific posts earn 3× more saves and DMs",
        "Your stories aren't too small — they're too vague",
        "One precise detail is all it takes",
      ],
    },
    hashtags: "#PersonalBrand #ContentStrategy #LinkedInTips #Authenticity",
    audience: "Peers",
    feeling: "Direct",
  },
  {
    post: `I used to hate the phrase "build in public."\n\nFelt like oversharing for likes.\n\nThen I posted about a feature we almost shipped that would have destroyed 40% of our revenue.\n\nThe comments weren't claps — they were warnings.\n\nTwo people had seen this exact pattern before. One DM saved us $200k.\n\nBuilding in public isn't performance.\nIt's the cheapest due diligence you'll ever do.\n\nYour network knows things you don't.\nGive them a reason to tell you.`,
    alternativeHooks: [
      `"Build in public" used to make me cringe.`,
      `One LinkedIn post saved our company $200k. Here's exactly what happened.`,
    ],
    shortPost: `Building in public isn't performance.\n\nIt's the cheapest due diligence you'll ever do.\n\nOne post about a near-miss brought two DMs from people who'd seen it before. One saved us $200k.\n\nYour network knows things you don't.`,
    carousel: [
      { slide: 1, title: "Building in public saved us $200k", description: "Not from a viral post. From one honest question about a mistake we almost made." },
      { slide: 2, title: "We almost shipped a disaster", description: "A pricing change that would have quietly killed retention. We posted about the dilemma." },
      { slide: 3, title: "The comments weren't what we expected", description: "No cheerleading. Two people had seen this exact pattern. One DM changed everything." },
      { slide: 4, title: "Building in public = free due diligence", description: "Your network has context you don't. Give them a reason to share it." },
      { slide: 5, title: "What to share vs what to keep private", description: "Share the dilemma, not the disaster. Share the question, not the crisis." },
    ],
    visual: "Split-screen: a confident Slack message on the left, a near-miss spreadsheet on the right. Clean editorial, slightly tense, honest energy.",
    infographic: {
      headline: "Why Building in Public is Business Strategy",
      bullets: [
        "Your network has seen your mistakes before",
        "Posting dilemmas beats posting achievements",
        "One honest question can save months of wrong direction",
        "Vulnerability earns context you can't buy",
        "ROI of transparency: priceless and measurable",
      ],
    },
    hashtags: "#BuildInPublic #Startups #Entrepreneurship #Leadership",
    audience: "Peers",
    feeling: "Story",
  },
  {
    post: `Unpopular opinion: most "thought leaders" on LinkedIn are just good at formatting.\n\nReal thought leadership is citing something that made you uncomfortable.\n\nIt's changing your mind publicly.\n\nIt's saying "I was wrong about X, and here's what actually shifted my view."\n\nFormatting is a skill.\nOpinion-changing is authority.\n\nThe first gets impressions.\nThe second gets trust.\n\nAre you optimising for the right metric?`,
    alternativeHooks: [
      `Most LinkedIn "thought leaders" are just good at bullet points.`,
      `There's a difference between formatting well and thinking well.`,
    ],
    shortPost: `"Thought leadership" mostly means good formatting.\n\nReal authority? Changing your mind publicly.\n\nThe first gets impressions. The second gets trust.\n\nAre you optimising for the right one?`,
    carousel: [
      { slide: 1, title: "Formatting ≠ Thought Leadership", description: "One is a skill. The other is authority. LinkedIn rewards both, but only one builds lasting reputation." },
      { slide: 2, title: "What formatting gives you", description: "Impressions. Saves. Follower growth. The algorithm loves a clean bullet list." },
      { slide: 3, title: "What real thought leadership gives you", description: "Referrals. Trust. DMs that lead to partnerships, not just connections." },
      { slide: 4, title: "How to tell the difference", description: "Ask: does my post change how someone thinks, or just how their feed looks?" },
      { slide: 5, title: "The highest-value move", description: "One post per month where you genuinely changed your mind. Hard to write. Impossible to ignore." },
    ],
    visual: "Two side-by-side LinkedIn posts: one perfectly formatted with bullets, one raw block of text with a genuinely surprising idea. A spotlight lands on the raw one.",
    infographic: {
      headline: "Formatting vs Thought Leadership",
      bullets: [
        "Formatting earns impressions and saves",
        "Thought leadership earns referrals and trust",
        "The test: does it change how people think?",
        "Hardest post to write: 'I was wrong about X'",
        "Monthly mind-change post = highest-ROI content",
      ],
    },
    hashtags: "#ThoughtLeadership #LinkedInStrategy #PersonalBranding #ContentCreation",
    audience: "Peers",
    feeling: "Contrarian",
  },
];

export function getDemoGenerateResponse(rawInput: string) {
  const idx = Math.abs(rawInput.length + rawInput.charCodeAt(0)) % DEMO_GENERATE_RESPONSES.length;
  return DEMO_GENERATE_RESPONSES[idx];
}

const DEMO_BRIEFS = [
  {
    headline: "Turn last week's hiring post into a client-facing angle today.",
    insight: "You've posted twice for Peers this week but nothing for Clients or Investors — that gap is costing you reach with decision-makers.",
    angles: [
      { angle: "Show a client exactly how you triage a messy backlog in week one", audience: "Clients" },
      { angle: "Challenge the '10x engineer' myth with a hiring story", audience: "Peers" },
      { angle: "Share the interview question that revealed real judgment, not rehearsed answers", audience: "Recruiters & Headhunters" },
      { angle: "Explain why you're betting on boring infrastructure over hype this year", audience: "Investors" },
      { angle: "The exec hire I doubted for weeks — and why I almost said no", audience: "My audience" },
    ],
    teachAngles: [
      "Why 'move fast' quietly breaks onboarding — an analogy for new managers",
      "The real reason standups fail (explained simply)",
      "What a roadmap actually is, for someone who's never owned one",
    ],
    newsHeadline: "Remote-first companies are quietly rewriting their hiring bars",
    newsSourceLine: "Worth watching if you're hiring — the bar for 'senior' is shifting toward async communication skills.",
    trendingTopics: [
      { headline: "Remote-first companies are quietly rewriting their hiring bars", sourceLine: "The bar for 'senior' is shifting toward async communication skills." },
      { headline: "LinkedIn's algorithm now favors dwell time over reactions", sourceLine: "Longer, slower-reading posts are starting to outperform quick-hit ones." },
      { headline: "Layoff-driven job searches are getting more public, not less", sourceLine: "Openly documenting a search is becoming normalized rather than stigmatized." },
    ],
  },
  {
    headline: "You're due for a Recruiters & Headhunters post — it's been 12 days.",
    insight: "Your last 5 posts skew heavily toward Peers. A capability-proof post for recruiters would balance the mix.",
    angles: [
      { angle: "Break down how you'd fix a stalled product launch in 30 days", audience: "Clients" },
      { angle: "Call out the 'growth at all costs' era as officially over", audience: "Peers" },
      { angle: "Describe the hardest call you made under pressure last quarter", audience: "Recruiters & Headhunters" },
      { angle: "Explain the market shift you're quietly positioning the business around", audience: "Investors" },
      { angle: "The career mistake I still think about — and what it actually cost", audience: "My audience" },
    ],
    teachAngles: [
      "Why 'data-driven' often means 'afraid to decide' — explained simply",
      "The onboarding checklist nobody writes down, for first-time managers",
      "What 'technical debt' actually costs, in plain English",
    ],
    newsHeadline: "Boards are pushing back on 'growth at all costs' roadmaps",
    newsSourceLine: "A useful signal if you're positioning a post around discipline over speed.",
    trendingTopics: [
      { headline: "Boards are pushing back on 'growth at all costs' roadmaps", sourceLine: "Discipline-over-speed narratives are landing better with investors right now." },
      { headline: "AI-generated LinkedIn posts are getting easier to spot", sourceLine: "Generic structure and stock phrasing are the biggest tells reported so far." },
      { headline: "Mid-level hiring is quietly picking back up", sourceLine: "A good moment for a capability-proof post aimed at recruiters." },
    ],
  },
];

const DEMO_SCENARIOS: Record<string, { scenarioType: string; scenario: string; tension: string; whyItResonates: string; professionalTerritory: string; professionalSignal: string }> = {
  "Clients": {
    scenarioType: "Client tension",
    scenario: "A new client hands you a messy backlog and expects priorities by Friday",
    tension: "Moving quickly without pretending every request is equally urgent",
    whyItResonates: "Clients recognise the relief of clear priorities in a messy situation",
    professionalTerritory: "Product leadership",
    professionalSignal: "Shows structured prioritisation when client pressure is high",
  },
  "Peers": {
    scenarioType: "Team tradeoff",
    scenario: "A meeting ends with agreement, but nobody can name the actual decision",
    tension: "Visible alignment versus real commitment",
    whyItResonates: "Peers have lived through meetings that create motion without clarity",
    professionalTerritory: "Team leadership",
    professionalSignal: "Shows an ability to turn discussion into accountable decisions",
  },
  "Recruiters & Headhunters": {
    scenarioType: "Hard decision",
    scenario: "A deadline is fixed, quality is slipping, and the team needs a defensible call",
    tension: "Protecting standards while still delivering under pressure",
    whyItResonates: "Hiring managers want evidence of judgment when no option is perfect",
    professionalTerritory: "Product leadership",
    professionalSignal: "Shows credible judgment and delivery leadership under pressure",
  },
  "Investors": {
    scenarioType: "Market signal",
    scenario: "Customer behaviour contradicts the growth story everyone expected to be true",
    tension: "Defending the plan versus following the evidence",
    whyItResonates: "Investors value leaders who recognise signals before consensus catches up",
    professionalTerritory: "Market strategy",
    professionalSignal: "Shows evidence-led thinking when the expected story changes",
  },
  "My audience": {
    scenarioType: "Vulnerable moment",
    scenario: "A real moment of doubt before a decision that turned out fine",
    tension: "The urge to hide the doubt versus admitting it happened",
    whyItResonates: "People connect with your specific doubts and mistakes, not your polish",
    professionalTerritory: "Leadership lessons",
    professionalSignal: "Shows reflective judgment grounded in a concrete work moment",
  },
};

function addDemoScenarios<T extends { angle: string; audience: string }>(angles: T[]) {
  return angles.map((item) => ({ ...item, ...DEMO_SCENARIOS[item.audience] }));
}

export function getDemoBrief() {
  const idx = Math.floor(Date.now() / 86400000) % DEMO_BRIEFS.length;
  const brief = DEMO_BRIEFS[idx]!;
  return { ...brief, angles: addDemoScenarios(brief.angles) };
}

const DEMO_IDEAS_BRAND: Array<{ angle: string; audience: string }>[] = [
  [
    { angle: "Show how you'd triage a messy backlog in a client's first week", audience: "Clients" },
    { angle: "Challenge the assumption that more meetings mean more alignment", audience: "Peers" },
    { angle: "Share a hiring decision you'd defend even under pushback", audience: "Recruiters & Headhunters" },
    { angle: "Explain the contrarian bet you're making on the market this year", audience: "Investors" },
    { angle: "The first hire I got wrong, and the moment I knew it", audience: "My audience" },
  ],
  [
    { angle: "Walk through the exact framework you use to scope a new client", audience: "Clients" },
    { angle: "Call out the 'thought leadership' posts that are just good formatting", audience: "Peers" },
    { angle: "Describe a hard call you made under pressure that paid off", audience: "Recruiters & Headhunters" },
    { angle: "Share why you're avoiding the obvious growth lever everyone else is chasing", audience: "Investors" },
    { angle: "The week I nearly burned out scaling this — what actually helped", audience: "My audience" },
  ],
];

const DEMO_IDEAS_TEACH: string[][] = [
  [
    "Why 'move fast' quietly breaks onboarding — an analogy for new managers",
    "The real reason standups fail (explained simply)",
    "What a roadmap actually is, for someone who's never owned one",
  ],
  [
    "Why 'data-driven' often means 'afraid to decide' — explained simply",
    "The onboarding checklist nobody writes down, for first-time managers",
    "What 'technical debt' actually costs, in plain English",
  ],
];

export function getDemoIdeas(type: "brand" | "teach") {
  const idx = Math.floor(Date.now() / 3600000) % 2;
  if (type === "teach") return { angles: DEMO_IDEAS_TEACH[idx] };
  return { angles: addDemoScenarios(DEMO_IDEAS_BRAND[idx]!) };
}

const DEMO_DARES = [
  { dare: "Most 'thought leadership' on LinkedIn is just good formatting, not good thinking.", why: "You've shipped enough real decisions to back this up without flinching.", risk: "Medium" },
  { dare: "Hustle culture is a symptom of founders who never built real systems.", why: "You've made the systems-over-hustle case in your own scaling story.", risk: "Spicy" },
  { dare: "Most hiring processes optimize for confidence, not competence.", why: "You've walked back a gut-feel hire before — you've earned the right to say this.", risk: "Mild" },
];

export function getDemoDare() {
  const idx = Math.floor(Date.now() / 86400000) % DEMO_DARES.length;
  const d = DEMO_DARES[idx]!;
  return {
    dare: d.dare,
    why: d.why,
    risk: d.risk,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    remaining: 2,
  };
}

const DEMO_CV_FACTS = {
  headline: null,
  about: null,
  currentTitle: "Senior Product Manager",
  currentEmployer: "Northwind Analytics",
  currentRoleDates: "2022 - Present",
  achievements: [
    "Led discovery research that cut onboarding drop-off by 23% in 6 months",
    "Grew activation from 41% to 58% across a 12-person cross-functional team",
    "Ran 40+ customer interviews that reshaped the 2024 product roadmap",
  ],
  skills: ["Product discovery", "Customer research", "Roadmapping", "Stakeholder alignment"],
};

const DEMO_LINKEDIN_FACTS = {
  headline: "Business professional | Product & Strategy",
  about: "Experienced professional with a background in product management. Passionate about building great products and leading teams.",
  currentTitle: "Product Lead",
  currentEmployer: "Northwind Analytics",
  currentRoleDates: "2021 - Present",
  achievements: [],
  skills: ["Leadership", "Product Management", "Strategy"],
};

export function getDemoProfileFacts(kind: "cv" | "linkedin") {
  return kind === "cv" ? DEMO_CV_FACTS : DEMO_LINKEDIN_FACTS;
}

export function getDemoProfileAlignment() {
  const comparisonTable = {
    generatedAt: new Date().toISOString(),
    rows: [
      {
        rowKey: "role_title", label: "Role / Title", applicableSources: ["cv", "brandmoi", "linkedin"],
        cv: { value: "Senior Product Manager", source: "cv" },
        brandmoi: { value: "Product professional focused on discovery and research", source: "brandmoi" },
        linkedin: { value: "Product Lead", source: "linkedin" },
        status: "all_differ",
        statusDetail: "All three sources say something different here — this needs your call.",
      },
      {
        rowKey: "territories", label: "Territories", applicableSources: ["brandmoi", "linkedin"],
        cv: null,
        brandmoi: { value: ["Product discovery", "Customer research"], source: "brandmoi" },
        linkedin: { value: ["Leadership", "Product Management", "Strategy"], source: "linkedin" },
        status: "cv_brandmoi_agree_linkedin_differs",
        statusDetail: "Your BrandMoi positioning and your LinkedIn profile say different things here.",
      },
      {
        rowKey: "proof_points", label: "Proof Points (approximate match)", applicableSources: ["cv", "brandmoi", "linkedin"],
        points: [
          { point: "Cut onboarding drop-off by 23% in 6 months", presentInCv: true, reflectedInLinkedin: false },
          { point: "Grew activation from 41% to 58%", presentInCv: true, reflectedInLinkedin: false },
        ],
        status: "cv_brandmoi_agree_linkedin_differs",
        statusDetail: "Some of your proof points aren't showing up on your LinkedIn profile yet.",
      },
    ],
  };

  return {
    id: 0,
    targetAudience: "Recruiters",
    comparisonTable,
    narrativeSummary: "Your LinkedIn headline reads as generic (\"Business professional\") while your CV and BrandMoi positioning both point to product discovery and customer research — that gap is the main thing costing you recognisability.",
    fieldRewrites: [
      {
        id: "field:headline", field: "headline",
        currentBrandmoi: "Product professional focused on discovery and research",
        currentLinkedin: "Business professional | Product & Strategy",
        rewrite: "Product Discovery Leader — turning ambiguous customer problems into validated direction",
        rationale: "Your current headline is generic enough to fit almost any profile; your CV's actual achievements point specifically to discovery and research.",
        status: "pending",
      },
      {
        id: "field:about", field: "about",
        currentBrandmoi: null,
        currentLinkedin: "Experienced professional with a background in product management. Passionate about building great products and leading teams.",
        rewrite: "I turn ambiguous customer problems into validated product direction.\n\nOver the last few years I've run 40+ customer interviews, cut onboarding drop-off by 23%, and grown activation from 41% to 58% — not by guessing, but by building a repeatable discovery process.\n\nIf you're trying to figure out what to build next, that's the conversation I want to have.",
        rationale: "The current About section is a template — no numbers, no specifics. Your CV has three concrete, quantified wins that belong here instead.",
        status: "pending",
      },
      {
        id: "field:current_role", field: "current_role",
        currentBrandmoi: "Product professional focused on discovery and research",
        currentLinkedin: "Product Lead",
        rewrite: "Senior Product Manager driving discovery-led roadmaps at Northwind Analytics",
        rationale: "Your CV states \"Senior Product Manager\" — LinkedIn currently says \"Product Lead\". The CV is the more current, authoritative title.",
        status: "pending",
      },
    ],
    pairedFactSuggestions: [
      {
        id: "fact:0", rowKey: "role_title",
        claim: "Senior Product Manager, 2022 - Present (per CV)",
        updateBrandmoi: { targetField: "brandRole", suggestedValue: "Senior Product Manager focused on discovery-led roadmaps", status: "pending" },
        updateLinkedin: { suggestedValue: "Senior Product Manager", status: "pending" },
      },
    ],
    createdAt: new Date().toISOString(),
  };
}

export const DEMO_EXPLORE_DIRECTIONS = {
  directions: [
    {
      feeling: "Direct",
      hook: "Specificity is the only authenticity that builds trust on LinkedIn.",
      points: [
        "Vague vulnerability is noise; precise moments are signal",
        "The exact number, time, or cost makes your story real",
        "Readers don't remember lessons — they remember scenes",
      ],
    },
    {
      feeling: "Story",
      hook: "At 2:47am I deleted three months of work. Best decision I ever made.",
      points: [
        "Open with the exact moment, not the lesson",
        "Let the reader feel the stakes before you explain them",
        "End with the shift, not the moral",
      ],
    },
    {
      feeling: "Contrarian",
      hook: "Stop trying to be authentic. Start trying to be specific.",
      points: [
        "Authenticity has become a performance; specificity is the antidote",
        "Most 'vulnerable' posts are still generic",
        "One specific detail does more work than a whole paragraph of feelings",
      ],
    },
  ],
};
