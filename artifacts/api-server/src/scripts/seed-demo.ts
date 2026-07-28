// One-off seed for demo@brandos.app so Dashboard/Analytics/Library/Series all
// have realistic example content to show prospects, without needing any real
// AI calls or real LinkedIn data. Safe to re-run: it's guarded by a check for
// the "Junior PM Diaries" series (a real, visible seeded row — no separate
// marker topic, so nothing artificial leaks into the topic filter UI).
//
// Run with: cd artifacts/api-server && npx tsx src/scripts/seed-demo.ts
import { db, usersTable, topicsTable, seriesTable, draftsTable, performanceSignalsTable, dailyActivityTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const DEMO_EMAIL = "demo@brandos.app";

async function main() {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, DEMO_EMAIL)).limit(1);
  if (!user) throw new Error(`No user found for ${DEMO_EMAIL}`);
  const userId = user.id;

  const existing = await db.select().from(seriesTable).where(and(eq(seriesTable.userId, userId), eq(seriesTable.title, "Junior PM Diaries")));
  if (existing.length > 0) {
    console.log("Already seeded — skipping. Run unseed-demo.ts first to re-seed.");
    process.exit(0);
  }

  const topics = await db.insert(topicsTable).values([
    { userId, name: "Founder Lessons", color: "#6366f1" },
    { userId, name: "Hiring & Team Building", color: "#f59e0b" },
    { userId, name: "Product Strategy", color: "#10b981" },
    { userId, name: "AI & Operations", color: "#ec4899" },
  ]).returning();
  const [tFounder, tHiring, tProduct, tAI] = topics;

  const series = await db.insert(seriesTable).values([
    {
      userId,
      title: "Junior PM Diaries",
      theme: "Lessons from mentoring early-career product managers",
      topicId: tProduct!.id,
      targetAudience: "Founders and operators building serious companies",
      format: "story_arc",
      plannedParts: 5,
      status: "active",
      hook: "🧵 Junior PM Diaries",
    },
    {
      userId,
      title: "Systems Over Hustle",
      theme: "Why process beats heroics as a company scales",
      topicId: tFounder!.id,
      targetAudience: "Founders and operators building serious companies",
      format: "standard",
      plannedParts: null,
      status: "active",
      hook: "⚙️ Systems Over Hustle",
    },
  ]).returning();
  const [sJuniorPM, sSystems] = series;

  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);

  type SeedDraft = {
    daysAgo: number;
    objective: string;
    persona: string;
    tone: string;
    contentSource: string;
    visualType: string;
    mediaFormat: string;
    topic: string;
    audience: string;
    topicId?: number;
    seriesId?: number;
    seriesPart?: number;
    post: string;
    perf: { impressions: number; reactions: number; comments: number; reposts: number; saves: number };
  };

  const posts: SeedDraft[] = [
    {
      daysAgo: 0, objective: "Authority", persona: "Founder", tone: "Direct", contentSource: "capture", visualType: "none", mediaFormat: "NONE",
      topic: "Why most scaling advice is wrong", audience: "Founders and operators building serious companies",
      topicId: tFounder!.id,
      post: "Most \"scale your startup\" advice is written by people who never had to un-scale a mess.\n\nClarity beats cleverness every time. If your team can't explain the plan in one sentence, you don't have a plan — you have a vibe.\n\n#Founders #Leadership #Startups",
      perf: { impressions: 14200, reactions: 312, comments: 41, reposts: 18, saves: 22 },
    },
    {
      daysAgo: 2, objective: "Hiring", persona: "Founder", tone: "Story", contentSource: "story_mode", visualType: "card", mediaFormat: "IMAGE",
      topic: "The hire that changed how I interview", audience: "Founders and operators building serious companies",
      topicId: tHiring!.id,
      post: "Two years ago I hired someone purely on gut feel. Six months later I had to let them go — and it was entirely my fault, not theirs.\n\nNow every hire goes through the same 3-question filter. Simple, boring, and it works.\n\n#Hiring #Leadership #Founders",
      perf: { impressions: 9800, reactions: 201, comments: 33, reposts: 9, saves: 14 },
    },
    {
      daysAgo: 3, objective: "Authority", persona: "Founder", tone: "Contrarian", contentSource: "news_reaction", visualType: "none", mediaFormat: "NONE",
      topic: "AI won't fix a broken process", audience: "Founders and operators building serious companies",
      topicId: tAI!.id,
      post: "Everyone's bolting AI onto broken workflows and calling it transformation.\n\nAI on top of chaos is just faster chaos. Fix the process first. The AI part is the easy 10%.\n\n#AI #Operations #ProductManagement",
      perf: { impressions: 21500, reactions: 480, comments: 67, reposts: 34, saves: 40 },
    },
    {
      daysAgo: 5, objective: "Documenting", persona: "Founder", tone: "Executive", contentSource: "capture", visualType: "none", mediaFormat: "NONE",
      topic: "What junior PMs get wrong about roadmaps", audience: "Founders and operators building serious companies",
      topicId: tProduct!.id, seriesId: sJuniorPM!.id, seriesPart: 1,
      post: "🧵 Junior PM Diaries — Part 1\n\nThe #1 mistake I see junior PMs make: treating the roadmap as a promise instead of a hypothesis.\n\nA roadmap is a bet, not a contract. Say that out loud to your stakeholders.\n\n#ProductManagement #Leadership",
      perf: { impressions: 6400, reactions: 98, comments: 12, reposts: 4, saves: 6 },
    },
    {
      daysAgo: 6, objective: "Expert", persona: "Founder", tone: "Snappy", contentSource: "teach_audience", visualType: "infographic", mediaFormat: "DOCUMENT",
      topic: "The 3-question hiring filter", audience: "Founders and operators building serious companies",
      topicId: tHiring!.id,
      post: "The 3 questions I ask before any hire:\n\n1. Can they do the job in front of them today?\n2. Can they grow into the job in 12 months?\n3. Do they make the team better, not just bigger?\n\nMiss #3 and you'll regret it.\n\n#Hiring #Founders",
      perf: { impressions: 11200, reactions: 265, comments: 29, reposts: 15, saves: 31 },
    },
    {
      daysAgo: 9, objective: "Authority", persona: "Founder", tone: "Direct", contentSource: "capture", visualType: "none", mediaFormat: "NONE",
      topic: "Systems over hustle", audience: "Founders and operators building serious companies",
      topicId: tFounder!.id, seriesId: sSystems!.id, seriesPart: 1,
      post: "⚙️ Systems Over Hustle — Part 1\n\nHustle gets you to $1M ARR. Systems get you past $10M without you personally burning out.\n\nThe founders who scale calmly aren't working harder than you. They just stopped being the bottleneck.\n\n#Founders #Leadership",
      perf: { impressions: 17800, reactions: 390, comments: 52, reposts: 21, saves: 28 },
    },
    {
      daysAgo: 10, objective: "Clients", persona: "Founder", tone: "Vulnerable", contentSource: "brand_voice_idea", visualType: "none", mediaFormat: "NONE",
      topic: "A client engagement that almost failed", audience: "Founders and operators building serious companies",
      post: "A client engagement almost fell apart in month two because I was too polite to say the real problem out loud.\n\nSaid it anyway. Uncomfortable meeting. Best outcome we've had together since.\n\n#Consulting #Leadership",
      perf: { impressions: 5200, reactions: 88, comments: 19, reposts: 3, saves: 5 },
    },
    {
      daysAgo: 12, objective: "Authority", persona: "Founder", tone: "Witty", contentSource: "capture", visualType: "carousel", mediaFormat: "DOCUMENT",
      topic: "Meetings that could have been a Slack message", audience: "Founders and operators building serious companies",
      topicId: tProduct!.id,
      post: "A carousel on the 5 meetings your calendar doesn't need. Swipe through — you'll recognize at least 3 on your own calendar this week.\n\n#Productivity #Leadership #Startups",
      perf: { impressions: 13100, reactions: 275, comments: 22, reposts: 11, saves: 45 },
    },
    {
      daysAgo: 13, objective: "Expert", persona: "Founder", tone: "Executive", contentSource: "teach_audience", visualType: "none", mediaFormat: "NONE",
      topic: "Why junior PMs over-index on frameworks", audience: "Founders and operators building serious companies",
      topicId: tProduct!.id, seriesId: sJuniorPM!.id, seriesPart: 2,
      post: "🧵 Junior PM Diaries — Part 2\n\nFrameworks are training wheels. The best PMs I know eventually stop naming the framework and just make the right call.\n\n#ProductManagement #Leadership",
      perf: { impressions: 7300, reactions: 110, comments: 14, reposts: 6, saves: 9 },
    },
    // A quiet stretch (~2-4 weeks ago) is intentionally left with no posts —
    // the weekly wall should show cracked bricks there to demonstrate the gap.
    {
      daysAgo: 33, objective: "Hiring", persona: "Founder", tone: "Direct", contentSource: "capture", visualType: "none", mediaFormat: "NONE",
      topic: "Firing fast vs firing right", audience: "Founders and operators building serious companies",
      topicId: tHiring!.id,
      post: "\"Hire slow, fire fast\" is half right. Fire fast, but never fire lazy — do the work to know it's actually them, not your onboarding.\n\n#Hiring #Leadership",
      perf: { impressions: 8900, reactions: 190, comments: 24, reposts: 8, saves: 12 },
    },
    {
      daysAgo: 35, objective: "Authority", persona: "Founder", tone: "Contrarian", contentSource: "news_reaction", visualType: "none", mediaFormat: "NONE",
      topic: "The 4-day week debate", audience: "Founders and operators building serious companies",
      topicId: tAI!.id,
      post: "The 4-day week debate misses the point. It's not about the number of days — it's whether your systems let people actually stop thinking about work on day 5.\n\n#Leadership #Operations",
      perf: { impressions: 19600, reactions: 410, comments: 58, reposts: 26, saves: 19 },
    },
    {
      daysAgo: 38, objective: "Documenting", persona: "Founder", tone: "Playful", contentSource: "capture", visualType: "art", mediaFormat: "IMAGE",
      topic: "A week in the life of a fractional COO", audience: "Founders and operators building serious companies",
      post: "A week in the life: 3 board decks, 1 hiring panel, 1 very long Slack thread about a logo, and exactly zero minutes of deep work. Send help (or a better calendar).\n\n#Founders #Startups",
      perf: { impressions: 4100, reactions: 71, comments: 9, reposts: 2, saves: 3 },
    },
    {
      daysAgo: 40, objective: "Expert", persona: "Founder", tone: "Snappy", contentSource: "teach_audience", visualType: "none", mediaFormat: "NONE",
      topic: "Systems over hustle, part 2", audience: "Founders and operators building serious companies",
      topicId: tFounder!.id, seriesId: sSystems!.id, seriesPart: 2,
      post: "⚙️ Systems Over Hustle — Part 2\n\nA system you follow inconsistently is worse than no system — it just adds guilt on top of chaos.\n\nStart smaller. Keep it for 90 days before you judge it.\n\n#Founders #Productivity",
      perf: { impressions: 10400, reactions: 230, comments: 18, reposts: 10, saves: 15 },
    },
    {
      daysAgo: 43, objective: "Clients", persona: "Founder", tone: "Executive", contentSource: "capture", visualType: "none", mediaFormat: "NONE",
      topic: "The scope conversation nobody wants to have", audience: "Founders and operators building serious companies",
      post: "The scope conversation nobody wants to have: telling a client \"that's a new project, not a change request.\"\n\nSay it early. It's cheaper for everyone than saying it late.\n\n#Consulting #Leadership",
      perf: { impressions: 6700, reactions: 105, comments: 15, reposts: 5, saves: 7 },
    },
  ];

  let inserted = 0;
  for (const p of posts) {
    const createdAt = daysAgo(p.daysAgo);
    const firstLine = p.post.split("\n").find((l) => l.trim().length > 0) ?? p.topic;
    const [draft] = await db.insert(draftsTable).values({
      userId,
      rawInput: p.topic,
      objective: p.objective,
      persona: p.persona,
      tone: p.tone,
      // Matches ListDraftsResponseItem's structuredBreakdown shape (topic,
      // angle, coreMessage, whyItMatters, hooks, narrativeFlow are required)
      // — these are cosmetic demo fillers, not used for real generation.
      structuredBreakdown: {
        topic: p.topic,
        audience: p.audience,
        angle: p.topic,
        coreMessage: firstLine,
        whyItMatters: "Demonstrates a real decision this creator made, in their own voice.",
        hooks: [{ text: firstLine }],
        narrativeFlow: ["Hook", "Insight", "Takeaway"],
      },
      postOutput: p.post,
      status: "published",
      contentSource: p.contentSource,
      visualType: p.visualType,
      mediaFormat: p.mediaFormat,
      topicId: p.topicId ?? null,
      seriesId: p.seriesId ?? null,
      seriesPart: p.seriesPart ?? null,
      createdAt,
      updatedAt: createdAt,
    }).returning();

    await db.insert(performanceSignalsTable).values({
      draftId: draft!.id,
      impressions: p.perf.impressions,
      reactions: p.perf.reactions,
      comments: p.perf.comments,
      reposts: p.perf.reposts,
      saves: p.perf.saves,
      membersReached: Math.round(p.perf.impressions * 0.82),
    });

    await db.insert(dailyActivityTable).values({
      userId,
      date: createdAt.toISOString().slice(0, 10),
    }).onConflictDoNothing();

    inserted++;
  }

  console.log(`Seeded ${inserted} published posts, ${topics.length} topics, ${series.length} series for demo@brandos.app (userId=${userId}).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
