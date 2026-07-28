// Rollback for the first (buggy) seed-demo.ts run: deletes the seeded
// drafts/performance rows, the visible "seeded-demo-v1" marker topic, the
// other seeded topics, and the two seeded series — so seed-demo.ts can be
// re-run cleanly after the structuredBreakdown fix.
import { db, usersTable, topicsTable, seriesTable, draftsTable, performanceSignalsTable, dailyActivityTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";

const DEMO_EMAIL = "demo@brandos.app";
const SEEDED_TOPIC_NAMES = ["seeded-demo-v1", "Founder Lessons", "Hiring & Team Building", "Product Strategy", "AI & Operations"];
const SEEDED_SERIES_TITLES = ["Junior PM Diaries", "Systems Over Hustle"];
// Exact rawInput values inserted by seed-demo.ts — used to precisely identify
// seeded drafts without risking the account's own real content.
const SEEDED_RAW_INPUTS = [
  "Why most scaling advice is wrong",
  "The hire that changed how I interview",
  "AI won't fix a broken process",
  "What junior PMs get wrong about roadmaps",
  "The 3-question hiring filter",
  "Systems over hustle",
  "A client engagement that almost failed",
  "Meetings that could have been a Slack message",
  "Why junior PMs over-index on frameworks",
  "Firing fast vs firing right",
  "The 4-day week debate",
  "A week in the life of a fractional COO",
  "Systems over hustle, part 2",
  "The scope conversation nobody wants to have",
];

async function main() {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, DEMO_EMAIL)).limit(1);
  if (!user) throw new Error(`No user found for ${DEMO_EMAIL}`);
  const userId = user.id;

  const topics = await db.select().from(topicsTable).where(and(eq(topicsTable.userId, userId), inArray(topicsTable.name, SEEDED_TOPIC_NAMES)));
  const series = await db.select().from(seriesTable).where(and(eq(seriesTable.userId, userId), inArray(seriesTable.title, SEEDED_SERIES_TITLES)));
  const topicIds = topics.map((t) => t.id);
  const seriesIds = series.map((s) => s.id);

  const drafts = await db.select().from(draftsTable).where(eq(draftsTable.userId, userId));
  const seededDraftIds = drafts
    .filter((d) => SEEDED_RAW_INPUTS.includes(d.rawInput))
    .map((d) => d.id);

  if (seededDraftIds.length > 0) {
    await db.delete(performanceSignalsTable).where(inArray(performanceSignalsTable.draftId, seededDraftIds));
    await db.delete(draftsTable).where(inArray(draftsTable.id, seededDraftIds));
  }
  if (seriesIds.length > 0) await db.delete(seriesTable).where(inArray(seriesTable.id, seriesIds));
  if (topicIds.length > 0) await db.delete(topicsTable).where(inArray(topicsTable.id, topicIds));

  // Daily activity rows can't be cleanly attributed back, so clear all for
  // this user — seed-demo.ts will re-insert the correct ones on next run.
  await db.delete(dailyActivityTable).where(eq(dailyActivityTable.userId, userId));

  console.log(`Removed ${seededDraftIds.length} drafts, ${seriesIds.length} series, ${topicIds.length} topics, and reset daily activity for demo@brandos.app.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
