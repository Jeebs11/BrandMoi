import { eq, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { draftsTable, performanceSignalsTable, dailyActivityTable } from "@workspace/db";

const OBJECTIVES = ["Clients", "Job", "Authority", "Documenting"];

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function upsertDailyActivity(userId: number): Promise<void> {
  const today = todayStr();
  await db
    .insert(dailyActivityTable)
    .values({ userId, date: today })
    .onConflictDoNothing();
}

export async function computeMomentum(userId: number): Promise<{
  score: number;
  label: string;
  breakdown: { recency: number; variety: number; volume: number; resonance: number };
  streak: number;
  cadenceAlerts: Array<{ type: string; message: string; daysSince: number; objective?: string }>;
}> {
  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const allDrafts = await db
    .select()
    .from(draftsTable)
    .where(eq(draftsTable.userId, userId))
    .orderBy(desc(draftsTable.createdAt));

  const recentDrafts = allDrafts.filter(
    (d) => new Date(d.createdAt) >= thirtyDaysAgo
  );

  // Recency: days since last draft (any status). 100 at 0 days, 0 at 30 days.
  let recencyScore = 0;
  if (allDrafts.length > 0) {
    const lastDraftMs = new Date(allDrafts[0].createdAt).getTime();
    const daysSinceLast = (now - lastDraftMs) / (1000 * 60 * 60 * 24);
    recencyScore = Math.max(0, Math.round(100 - (daysSinceLast / 30) * 100));
  }

  // Variety: unique objectives in last 30 days / 4 total
  const usedObjectives = new Set(recentDrafts.map((d) => d.objective));
  const varietyScore = Math.round((usedObjectives.size / OBJECTIVES.length) * 100);

  // Volume: drafts in last 30 days, cap at 20
  const volumeScore = Math.min(100, Math.round((recentDrafts.length / 20) * 100));

  // Resonance: average resonance from performance signals (join via drafts)
  let resonanceScore = 50;
  const signals = await db
    .select({
      impressions: performanceSignalsTable.impressions,
      reactions: performanceSignalsTable.reactions,
      comments: performanceSignalsTable.comments,
    })
    .from(performanceSignalsTable)
    .innerJoin(draftsTable, eq(performanceSignalsTable.draftId, draftsTable.id))
    .where(eq(draftsTable.userId, userId));

  if (signals.length > 0) {
    const scored = signals
      .filter((s) => s.impressions > 0)
      .map((s) =>
        Math.min(100, Math.round(((s.reactions * 3 + s.comments * 5) / s.impressions) * 1000))
      );
    if (scored.length > 0) {
      resonanceScore = Math.round(scored.reduce((a, b) => a + b, 0) / scored.length);
    }
  }

  const score = Math.round(
    recencyScore * 0.3 +
    varietyScore * 0.25 +
    volumeScore * 0.25 +
    resonanceScore * 0.2
  );

  let label: string;
  if (score >= 80) label = "Strong";
  else if (score >= 50) label = "Building";
  else if (score >= 20) label = "Fading";
  else label = "Silent";

  // Streak: consecutive active days
  const activities = await db
    .select({ date: dailyActivityTable.date })
    .from(dailyActivityTable)
    .where(eq(dailyActivityTable.userId, userId))
    .orderBy(desc(dailyActivityTable.date));

  let streak = 0;
  const today = todayStr();
  const yesterday = new Date(now - 86400000).toISOString().slice(0, 10);
  const activityDates = new Set(activities.map((a) => a.date));

  let checkDate = activityDates.has(today) ? today : activityDates.has(yesterday) ? yesterday : null;
  if (checkDate) {
    let cursor = new Date(checkDate);
    while (activityDates.has(cursor.toISOString().slice(0, 10))) {
      streak++;
      cursor = new Date(cursor.getTime() - 86400000);
    }
  }

  // Cadence alerts
  const cadenceAlerts: Array<{ type: string; message: string; daysSince: number; objective?: string }> = [];

  if (allDrafts.length > 0) {
    const lastMs = new Date(allDrafts[0].createdAt).getTime();
    const daysSinceLast = Math.floor((now - lastMs) / (1000 * 60 * 60 * 24));
    if (daysSinceLast >= 5) {
      cadenceAlerts.push({
        type: "quiet",
        message: `You've been quiet for ${daysSinceLast} days — your audience forgets fast.`,
        daysSince: daysSinceLast,
      });
    }
  }

  // Per-objective gap alerts (only for objectives the user has used before)
  for (const obj of OBJECTIVES) {
    const objDrafts = allDrafts.filter((d) => d.objective === obj);
    if (objDrafts.length === 0) continue;
    const lastObjMs = new Date(objDrafts[0].createdAt).getTime();
    const daysSinceObj = Math.floor((now - lastObjMs) / (1000 * 60 * 60 * 24));
    if (daysSinceObj >= 14) {
      cadenceAlerts.push({
        type: "objective_gap",
        message: `No ${obj} content in ${daysSinceObj} days.`,
        daysSince: daysSinceObj,
        objective: obj,
      });
    }
  }

  return {
    score,
    label,
    breakdown: {
      recency: recencyScore,
      variety: varietyScore,
      volume: volumeScore,
      resonance: resonanceScore,
    },
    streak,
    cadenceAlerts,
  };
}
