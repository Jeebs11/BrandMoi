import { db, draftsTable } from "@workspace/db";

const SEED_DRAFTS = [
  {
    rawInput:
      "Most companies treat systems as a cost centre. The ones that win treat them as leverage. I keep seeing this pattern — founders who invest in clear processes early move faster later, not slower.",
    objective: "Authority",
    persona: "Founder",
    tone: "Direct",
    structuredBreakdown: {
      topic: "Systems as competitive leverage",
      angle: "The counterintuitive cost of avoiding systems",
      coreMessage:
        "Founders who build systems early gain speed later — not lose it",
      whyItMatters:
        "Most founders avoid systems because they feel bureaucratic. But the absence of systems is itself a system — a chaotic one.",
      hooks: [
        "The founders moving fastest aren't working harder. They built systems first.",
        "Everyone says systems slow you down. They're wrong.",
        "Here's what separates the founders who scale from the ones who stall.",
      ],
      narrativeFlow: ["Hook", "Problem", "Insight", "Proof", "CTA"],
    },
    postOutput: `The founders moving fastest aren't working harder. They built systems first.

Most operators avoid process early on. It feels bureaucratic. Heavyweight. Like something big companies do.

But here's what I've seen repeatedly: the absence of a system is itself a system. A chaotic one.

When there's no process, every decision gets reinvented. Every new hire has to figure it out from scratch. Every week burns energy on things that should be automatic.

Founders who invest in clear, simple systems — even rough ones — in years one and two move dramatically faster in years three and four.

Not because the systems are perfect. Because the team isn't running on friction.

The insight: systems don't slow you down. The wrong systems do. Simple, documented, revisable systems give your team leverage.

If you're avoiding systems because you think you're too early — you're probably already too late.

#founders #operations #leverage`,
    carouselOutput: JSON.stringify([
      {
        slide: 1,
        title: "The founders moving fastest built systems first.",
        description:
          "Most people think systems slow you down. The data says otherwise.",
      },
      {
        slide: 2,
        title: "No system is still a system.",
        description:
          "The absence of process is itself a process — a chaotic one that burns time every single week.",
      },
      {
        slide: 3,
        title: "Every decision gets reinvented.",
        description:
          "Without systems, teams spend energy on things that should be automatic. New hires figure everything out from scratch.",
      },
      {
        slide: 4,
        title: "Simple systems compound.",
        description:
          "Founders who build rough-but-clear processes in years 1-2 move faster in years 3-4. Not slower.",
      },
      {
        slide: 5,
        title: "The rule: simple, documented, revisable.",
        description:
          "You don't need perfect systems. You need systems your team can run without you in the room.",
      },
      {
        slide: 6,
        title: "If you think you're too early for systems — you're probably already late.",
        description: "Start simpler than you think. Document one thing today.",
      },
    ]),
    visualOutput:
      "Clean white background with a single bold line of text centred vertically. Deep charcoal typography, no imagery. A subtle left-aligned indigo border accent on the key insight slide. Minimal — like a well-designed memo.",
    status: "ready",
  },
  {
    rawInput:
      "Had a client call today that completely reframed how I think about positioning. They kept saying their differentiator was quality — but when I pushed them on a specific client win, the real story was speed. They could turn things around in 48 hours when competitors took two weeks. Nobody knew.",
    objective: "Clients",
    persona: "Founder",
    tone: "Story",
    structuredBreakdown: {
      topic: "Hidden differentiators in positioning",
      angle: "The gap between what you think makes you different and what actually does",
      coreMessage:
        "Your real differentiator is often buried in a specific client story, not your pitch",
      whyItMatters:
        "Most businesses compete on the wrong thing because they haven't asked the right question. One conversation can reveal the real edge.",
      hooks: [
        "A client told me their differentiator was quality. Twenty minutes later, they revealed the real one.",
        "The best positioning insight I've heard in months came from a client who didn't know they had it.",
        "Most businesses compete on the wrong thing — not because they're wrong, but because nobody asked the right question.",
      ],
      narrativeFlow: ["Hook", "Scene", "Turn", "Lesson", "Application"],
    },
    postOutput: `A client told me their differentiator was quality. Twenty minutes later, they revealed the real one.

We were doing a positioning session. I asked what made them different. They said quality — great work, attention to detail. Standard stuff.

I pushed. "Tell me about a client who chose you over a competitor."

They thought for a moment, then described a situation where a client needed something done in 48 hours. Their main competitor needed two weeks. They delivered. The client has been with them for four years since.

That's not a quality story. That's a speed story.

And nobody knew. Not their website. Not their proposals. Not their sales calls.

The differentiator wasn't what they were saying — it was buried in a specific outcome.

This happens constantly. Businesses position on generic claims when the real edge lives in the specifics.

One question to try: "Tell me about a client who chose you in a situation where it shouldn't have been obvious." The answer is usually where the real positioning lives.

#positioning #b2bmarketing #founders`,
    carouselOutput: JSON.stringify([
      {
        slide: 1,
        title: "Your real differentiator is probably not what you think it is.",
        description:
          "Most businesses compete on the wrong thing — not because they're wrong, but because they haven't looked in the right place.",
      },
      {
        slide: 2,
        title: "The scene: a positioning session.",
        description:
          "I asked a client what made them different. They said quality. I kept pushing.",
      },
      {
        slide: 3,
        title: "The turn: one specific story changed everything.",
        description:
          "48-hour turnaround vs. two weeks from a competitor. That client has stayed for four years.",
      },
      {
        slide: 4,
        title: "That's not a quality story. That's a speed story.",
        description:
          "And it appeared nowhere — not on their site, their proposals, or their sales calls.",
      },
      {
        slide: 5,
        title: "The pattern: real differentiators live in specific outcomes.",
        description:
          "Generic claims feel safe. Specific stories do the actual work of convincing.",
      },
      {
        slide: 6,
        title: "Try this question.",
        description:
          '"Tell me about a client who chose you in a situation where it shouldn\'t have been obvious." The answer is usually where the real positioning lives.',
      },
    ]),
    visualOutput:
      "Two-tone layout: left panel warm off-white with the hook text in large dark type, right panel a subtle texture or light geometric pattern. Feels like a consultancy deck — serious and considered. No photos.",
    status: "draft",
  },
];

export async function seedDraftsIfEmpty(): Promise<void> {
  const existing = await db.select().from(draftsTable).limit(1);
  if (existing.length > 0) return;

  for (const draft of SEED_DRAFTS) {
    await db.insert(draftsTable).values({
      rawInput: draft.rawInput,
      objective: draft.objective,
      persona: draft.persona,
      tone: draft.tone,
      structuredBreakdown: draft.structuredBreakdown as object,
      postOutput: draft.postOutput,
      carouselOutput: draft.carouselOutput,
      visualOutput: draft.visualOutput,
      status: draft.status,
    });
  }

  console.log("Seeded 2 example drafts");
}
