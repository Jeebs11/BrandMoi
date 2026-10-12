import { eq, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { draftsTable, performanceSignalsTable, dailyActivityTable, preferencesTable } from "@workspace/db";
import { ai as gemini } from "@workspace/integrations-gemini-ai";

const OBJECTIVES = ["Clients", "Job", "Authority", "Documenting", "Expert", "Hiring"];

// Web search can return an older article while explaining that no result met
// the requested freshness window. Treat that response as no usable news
// rather than presenting the older article as a current anchor.
const NO_FRESH_NEWS_MARKERS = [
  /\bno (?:fresh|recent|new) (?:news|articles?|results?)\b/i,
  /\bnone of (?:the )?(?:search )?(?:results?|articles?)\b/i,
  /\bnot within the last 7 days\b/i,
  /\bolder than (?:the )?last 7 days\b/i,
  /\bno results? (?:were|was)?\s*returned\b/i,
];

export type MomentumNewsArticle = {
  headline: string;
  source: string;
  url: string;
  publishedAt: string;
  summary: string;
};

/**
 * Shared Momentum news-anchor signal. Used by both /agent/brief (the daily
 * Momentum feed) and /ai/generate (when the user toggles "Tie to news" while
 * generating a post). Centralising this keeps the news the user sees in their
 * Momentum feed consistent with the news a tied post weaves in.
 *
 * `topicHint` is an optional bias for the search — when generating a post, we
 * pass the user's raw idea so the chosen article relates to it. When called
 * for the daily brief, we omit it and search broadly across the user's role.
 */
export async function fetchMomentumNewsAnchor(
  userId: number,
  opts?: { topicHint?: string; audience?: string },
): Promise<{
  context: string;
  url: string | null;
  articles: MomentumNewsArticle[];
}> {
  const [prefs] = await db
    .select({
      brandRole: preferencesTable.brandRole,
      brandAudience: preferencesTable.brandAudience,
    })
    .from(preferencesTable)
    .where(eq(preferencesTable.userId, userId))
    .limit(1);

  const roleContext = [prefs?.brandRole, prefs?.brandAudience]
    .filter(Boolean)
    .join(" working with ");
  const persona = roleContext || "LinkedIn professional";

  const now = new Date();
  const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const searchQuery = [
    `Today is ${now.toISOString()}.`,
    `Find up to 5 genuinely relevant news reports published from ${cutoff.toISOString()} through now for a ${persona}.`,
    opts?.topicHint
      ? `Prioritise reports that connect directly to this idea: "${opts.topicHint.trim().slice(0, 240)}".`
      : "",
    opts?.audience ? `The intended audience is ${opts.audience}.` : "",
    "Use Google Search grounding. Do not invent or infer articles.",
    "Only include reports with a verifiable publication date inside that seven-day window.",
    "Return JSON only in this exact shape:",
    '{"articles":[{"headline":"...","source":"...","url":"https://...","publishedAt":"2026-01-01T12:00:00Z","summary":"..."}]}',
    "If no relevant report meets the date and relevance requirements, return {\"articles\":[]}.",
  ].filter(Boolean).join("\n");

  try {
    const response = await gemini.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: searchQuery,
      config: {
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }],
        abortSignal: AbortSignal.timeout(20_000),
      },
    });

    const parsed = JSON.parse(response.text ?? "") as {
      articles?: Array<{
        headline?: unknown;
        source?: unknown;
        url?: unknown;
        publishedAt?: unknown;
        summary?: unknown;
      }>;
    };
    const articles = (Array.isArray(parsed.articles) ? parsed.articles : [])
      .map((article) => {
        const headline = typeof article.headline === "string" ? article.headline.trim() : "";
        const source = typeof article.source === "string" ? article.source.trim() : "";
        const url = typeof article.url === "string" ? article.url.trim() : "";
        const publishedAt = typeof article.publishedAt === "string" ? article.publishedAt.trim() : "";
        const summary = typeof article.summary === "string" ? article.summary.trim() : "";
        const publishedTime = Date.parse(publishedAt);
        let validUrl = false;
        try {
          validUrl = new URL(url).protocol === "https:";
        } catch {
          validUrl = false;
        }
        if (
          !headline
          || !source
          || !summary
          || !validUrl
          || !Number.isFinite(publishedTime)
          || publishedTime < cutoff.getTime()
          || publishedTime > now.getTime()
        ) {
          return null;
        }
        return { headline, source, url, publishedAt, summary };
      })
      .filter((article): article is {
        headline: string;
        source: string;
        url: string;
        publishedAt: string;
        summary: string;
      } => article !== null)
      .slice(0, 3);

    const context = articles
      .map((article, index) => [
        `Article ${index + 1}:`,
        `Headline: ${article.headline}`,
        `Source: ${article.source}`,
        `Published: ${article.publishedAt}`,
        `URL: ${article.url}`,
        `Summary: ${article.summary}`,
      ].join("\n"))
      .join("\n\n");

    if (!context || NO_FRESH_NEWS_MARKERS.some((marker) => marker.test(context))) {
      return { context: "", url: null, articles: [] };
    }
    return { context, url: articles[0]?.url ?? null, articles };
  } catch (err) {
    console.warn("Gemini news fetch failed:", err);
    return { context: "", url: null, articles: [] };
  }
}

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

function mondayOf(d: Date): Date {
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setUTCDate(d.getUTCDate() + diff);
  m.setUTCHours(0, 0, 0, 0);
  return m;
}

const WEEKLY_WALL_WEEKS = 6;

export async function computeMomentum(userId: number): Promise<{
  score: number;
  label: string;
  breakdown: { recency: number; variety: number; volume: number; resonance: number };
  streak: number;
  cadenceAlerts: Array<{ type: string; message: string; daysSince: number; objective?: string }>;
  weeklyWall: Array<{ weekStart: string; posted: boolean }>;
  currentWeekDays: boolean[];
  weekStreak: number;
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

  // Variety: unique objectives used in last 30 days. Cap at 4 so using 4 of 6 still scores 100%.
  // This prevents penalising users who don't use every objective (e.g. Hiring may not be relevant).
  const usedObjectives = new Set(recentDrafts.map((d) => d.objective));
  const varietyScore = Math.min(100, Math.round((usedObjectives.size / 4) * 100));

  // Volume: drafts in last 30 days, cap at 20
  const volumeScore = Math.min(100, Math.round((recentDrafts.length / 20) * 100));

  // Resonance: average resonance from performance signals (join via drafts)
  let resonanceScore = 50;
  const signals = await db
    .select({
      impressions: performanceSignalsTable.impressions,
      reactions: performanceSignalsTable.reactions,
      comments: performanceSignalsTable.comments,
      reposts: performanceSignalsTable.reposts,
    })
    .from(performanceSignalsTable)
    .innerJoin(draftsTable, eq(performanceSignalsTable.draftId, draftsTable.id))
    .where(eq(draftsTable.userId, userId));

  if (signals.length > 0) {
    const scored = signals.map((s) => {
      const engagementWeight = s.reactions * 3 + s.comments * 5 + s.reposts * 4;
      if (s.impressions > 0) {
        return Math.min(100, Math.round((engagementWeight / s.impressions) * 1000));
      }
      if (engagementWeight === 0) return 0;
      return Math.min(100, Math.round(Math.log2(1 + engagementWeight) * 12));
    });
    resonanceScore = Math.round(scored.reduce((a, b) => a + b, 0) / scored.length);
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

  // Weekly wall: last WEEKLY_WALL_WEEKS Mon–Sun weeks, oldest first, each
  // marked posted if any day in that week has a dailyActivityTable row.
  const thisMonday = mondayOf(new Date(now));
  const weeklyWall: Array<{ weekStart: string; posted: boolean }> = [];
  for (let i = WEEKLY_WALL_WEEKS - 1; i >= 0; i--) {
    const monday = new Date(thisMonday.getTime() - i * 7 * 86400000);
    let posted = false;
    for (let d = 0; d < 7; d++) {
      const dateStr = new Date(monday.getTime() + d * 86400000).toISOString().slice(0, 10);
      if (activityDates.has(dateStr)) {
        posted = true;
        break;
      }
    }
    weeklyWall.push({ weekStart: monday.toISOString().slice(0, 10), posted });
  }

  const currentWeekDays: boolean[] = [];
  for (let d = 0; d < 7; d++) {
    const dateStr = new Date(thisMonday.getTime() + d * 86400000).toISOString().slice(0, 10);
    currentWeekDays.push(activityDates.has(dateStr));
  }

  let weekStreak = 0;
  for (let i = weeklyWall.length - 1; i >= 0; i--) {
    if (weeklyWall[i].posted) weekStreak++;
    else break;
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
    weeklyWall,
    currentWeekDays,
    weekStreak,
  };
}
