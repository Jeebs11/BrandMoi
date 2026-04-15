import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  BarChart2, TrendingUp, Layers, FileText, Trophy, Zap, AlertCircle,
  ArrowUp, ArrowDown, Minus, Clock, Hash, CalendarDays, Activity,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Cell,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { analyticsApi, type AnalyticsOverview, type KpiTrend } from "@/lib/api";

const SOURCE_LABELS: Record<string, string> = {
  capture: "Direct capture",
  news_reaction: "News reaction",
  teach_audience: "Teach audience",
  story_mode: "Story mode",
  brand_voice_idea: "Agent idea",
  linkedin: "LinkedIn",
};
const SOURCE_EMOJI: Record<string, string> = {
  capture: "✍️",
  news_reaction: "📰",
  teach_audience: "🎓",
  story_mode: "📖",
  brand_voice_idea: "🤖",
  linkedin: "💼",
};
const VISUAL_LABELS: Record<string, string> = {
  none: "Text only",
  card: "Visual card",
  carousel: "Carousel",
  infographic: "Infographic",
  art: "AI artwork",
};
const VISUAL_EMOJI: Record<string, string> = {
  none: "📝",
  card: "🖼️",
  carousel: "📑",
  infographic: "📊",
  art: "🎨",
};
const TONE_EMOJI: Record<string, string> = {
  Executive: "🎩",
  Direct: "🎯",
  Story: "📖",
  Contrarian: "⚡",
  Witty: "😏",
  Vulnerable: "💙",
  Playful: "🎉",
  Snappy: "✂️",
};
const MEDIA_FORMAT_LABELS: Record<string, string> = {
  NONE: "Text only",
  IMAGE: "Image post",
  VIDEO: "Video post",
  DOCUMENT: "Document / Carousel",
  ARTICLE: "Article",
};
const MEDIA_FORMAT_EMOJI: Record<string, string> = {
  NONE: "📝",
  IMAGE: "🖼️",
  VIDEO: "🎬",
  DOCUMENT: "📄",
  ARTICLE: "📰",
};

const BAR_COLOR = "#7c3aed";
const BAR_MUTED = "#ede9fe";

function TrendArrow({ trend }: { trend: "up" | "down" | "flat" | null }) {
  if (!trend) return null;
  if (trend === "up") return <ArrowUp className="w-3.5 h-3.5 text-emerald-500 inline-block ml-1 flex-shrink-0" />;
  if (trend === "down") return <ArrowDown className="w-3.5 h-3.5 text-red-400 inline-block ml-1 flex-shrink-0" />;
  return <Minus className="w-3.5 h-3.5 text-gray-400 inline-block ml-1 flex-shrink-0" />;
}

function KpiTrendBadge({ kpi }: { kpi: KpiTrend }) {
  if (!kpi.trend || kpi.prior === null) return null;
  const pct = kpi.prior !== 0
    ? Math.abs(Math.round(((( kpi.current ?? 0) - kpi.prior) / kpi.prior) * 100))
    : null;
  const color = kpi.trend === "up" ? "text-emerald-500" : kpi.trend === "down" ? "text-red-400" : "text-gray-400";
  return (
    <span className={cn("flex items-center gap-0.5 text-[10px] font-bold", color)}>
      <TrendArrow trend={kpi.trend} />
      {pct !== null && `${pct}%`}
      <span className="text-gray-400 font-normal ml-0.5">vs prior</span>
    </span>
  );
}

function StatCard({ icon, label, value, sub, accent, trend }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  trend?: KpiTrend;
}) {
  return (
    <div className={cn("rounded-2xl border p-4 flex items-start gap-3", accent ? "bg-violet-600 border-violet-500" : "bg-white border-gray-100")}>
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", accent ? "bg-violet-500 text-white" : "bg-violet-50 text-violet-600")}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className={cn("text-[11px] font-bold uppercase tracking-wider mb-0.5", accent ? "text-violet-200" : "text-gray-400")}>{label}</p>
        <p className={cn("text-2xl font-extrabold leading-none", accent ? "text-white" : "text-gray-900")}>{value}</p>
        {sub && <p className={cn("text-xs mt-0.5", accent ? "text-violet-200" : "text-gray-400")}>{sub}</p>}
        {trend && <KpiTrendBadge kpi={trend} />}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest px-1 mb-2">{children}</h2>;
}

function SparseLabel() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-amber-500 font-medium whitespace-nowrap">
      <AlertCircle className="w-3 h-3" /> Limited data
    </span>
  );
}

export default function Analytics() {
  const [trendWindow, setTrendWindow] = useState<30 | 60 | 90>(90);

  const { data, isLoading } = useQuery<AnalyticsOverview>({
    queryKey: ["analytics-overview", trendWindow],
    queryFn: () => analyticsApi.overview(trendWindow),
    staleTime: 60_000,
  });

  return (
    <AppShell>
      <header className="px-6 pt-12 pb-4 bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart2 className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-extrabold text-gray-900">Analytics</h1>
          </div>
          <div className="flex gap-1">
            {([30, 60, 90] as const).map(w => (
              <button
                key={w}
                onClick={() => setTrendWindow(w)}
                className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors", trendWindow === w ? "bg-violet-100 text-violet-700" : "text-gray-400 hover:text-gray-600")}
              >
                {w}d
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-1 ml-8">Performance insights across your published posts</p>
      </header>
      <main className="flex-1 px-4 py-5 space-y-6 overflow-y-auto pb-28">
        {isLoading ? <LoadingState /> : !data || data.totalPublished === 0 ? <EmptyState /> : <Content data={data} trendWindow={trendWindow} />}
      </main>
    </AppShell>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
      </div>
      <Skeleton className="h-48 rounded-2xl" />
      <Skeleton className="h-48 rounded-2xl" />
    </div>
  );
}

function EmptyState() {
  const [, navigate] = useLocation();
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-8">
      <BarChart2 className="w-12 h-12 text-gray-200 mb-4" />
      <p className="font-bold text-gray-600 mb-1">No published posts yet</p>
      <p className="text-sm text-gray-400 mb-6">Mark your first post as published in the Library to start seeing analytics.</p>
      <button onClick={() => navigate("/library")} className="px-5 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 transition-colors">
        Go to Library
      </button>
    </div>
  );
}

function Content({ data, trendWindow }: { data: AnalyticsOverview; trendWindow: 30 | 60 | 90 }) {
  const [, navigate] = useLocation();

  const hasResonanceData = data.loggedPerformanceCount > 0;

  const bestTone = hasResonanceData
    ? [...data.byTone]
        .filter(t => t.avgResonance !== null && t.sampledCount >= 2)
        .sort((a, b) => (b.avgResonance ?? 0) - (a.avgResonance ?? 0))[0] ?? null
    : null;

  const topSource = data.byContentSource[0] ?? null;

  const cutoffLabel = (() => {
    const cutMs = { 30: 30 * 86400000, 60: 60 * 86400000, 90: 91 * 86400000 }[trendWindow];
    const cutDate = new Date(Date.now() - cutMs);
    const jan1 = new Date(cutDate.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((cutDate.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
    return `${cutDate.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
  })();

  const filteredCountTrend = data.weeklyTrend.filter(w => w.week >= cutoffLabel);
  const filteredResTrend = data.weeklyResonanceTrend.filter(w => w.week >= cutoffLabel);
  const useResonanceTrend = filteredResTrend.length >= 5;
  const trendTotal = { 30: data.last30, 60: data.last60, 90: data.last90 }[trendWindow];

  const tonesWithResonance = data.byTone.filter(t => t.avgResonance !== null && t.sampledCount >= 2);

  // Best day for recommendation callout
  const bestDay = data.bestTimeToPost.byDayOfWeek
    .filter(d => d.avgResonance !== null)
    .sort((a, b) => (b.avgResonance ?? 0) - (a.avgResonance ?? 0))[0] ?? null;

  const hasMediaFormatData = data.byMediaFormat.some(f => f.format !== "NONE");

  return (
    <>
      {/* Performance CTA */}
      {data.loggedPerformanceCount < 5 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <Zap className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-bold text-amber-800">Log performance to unlock deeper insights</p>
            <p className="text-[11px] text-amber-600 mt-0.5">
              You have {data.loggedPerformanceCount} of 5 performance entries. In Library, tap ··· on any published post → Log Performance to add impressions and reactions.
            </p>
          </div>
        </div>
      )}

      {/* Overview stats with trend arrows */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<FileText className="w-4 h-4" />}
          label="Published"
          value={data.kpiTrends.totalPublished.current ?? data.totalPublished}
          sub={`last ${trendWindow} days`}
          trend={data.kpiTrends.totalPublished}
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Avg Resonance"
          value={hasResonanceData ? `${data.kpiTrends.avgResonance.current ?? data.avgResonance}` : "—"}
          sub={hasResonanceData ? "out of 100" : "log performance to track"}
          trend={hasResonanceData ? data.kpiTrends.avgResonance : undefined}
        />
        {data.avgEngagementRate !== null && (
          <StatCard
            icon={<Activity className="w-4 h-4" />}
            label="Eng. Rate"
            value={`${data.avgEngagementRate}%`}
            sub="reactions+comments/impressions"
            trend={data.kpiTrends.avgEngagementRate}
          />
        )}
        {data.postingConsistency.avgDaysBetweenPosts !== null && (
          <StatCard
            icon={<CalendarDays className="w-4 h-4" />}
            label="Cadence"
            value={`~${data.postingConsistency.avgDaysBetweenPosts}d`}
            sub="avg days between posts"
            trend={data.postingConsistency.trend ? { current: data.postingConsistency.avgDaysBetweenPosts, prior: data.postingConsistency.prior, trend: data.postingConsistency.trend } : undefined}
          />
        )}
        {bestTone && (
          <StatCard
            icon={<Trophy className="w-4 h-4" />}
            label="Best tone"
            value={`${TONE_EMOJI[bestTone.tone] ?? ""} ${bestTone.tone}`}
            sub={`${bestTone.avgResonance} avg resonance`}
            accent
          />
        )}
        {topSource && (
          <StatCard
            icon={<Layers className="w-4 h-4" />}
            label="Top source"
            value={`${SOURCE_EMOJI[topSource.source] ?? ""} ${SOURCE_LABELS[topSource.source] ?? topSource.source}`}
            sub={`${topSource.count} post${topSource.count !== 1 ? "s" : ""}`}
          />
        )}
      </div>

      {/* Trend chart */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>
            {useResonanceTrend ? "Resonance trend" : "Publishing trend"}
          </SectionTitle>
        </div>

        {useResonanceTrend ? (
          <>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={filteredResTrend} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="week" tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: string) => `W${v.split("-W")[1] ?? v}`} />
                  <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
                    formatter={(val: number) => [val, "Avg Resonance"]}
                    labelFormatter={(l: string) => `Week ${l.split("-W")[1] ?? l}`}
                  />
                  <Line type="monotone" dataKey="avgResonance" stroke={BAR_COLOR} strokeWidth={2} dot={{ r: 3, fill: BAR_COLOR }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-gray-400 text-right mt-1">{trendTotal} post{trendTotal !== 1 ? "s" : ""} in last {trendWindow} days</p>
          </>
        ) : filteredCountTrend.length < 2 ? (
          <div className="h-24 flex flex-col items-center justify-center gap-2">
            <p className="text-xs text-gray-400">Not enough data for this window yet</p>
            {!hasResonanceData && (
              <p className="text-[10px] text-amber-500">Log performance on ≥5 posts to unlock resonance trend</p>
            )}
          </div>
        ) : (
          <>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={filteredCountTrend} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="week" tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: string) => `W${v.split("-W")[1] ?? v}`} />
                  <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
                    formatter={(val: number) => [val, "Posts"]}
                    labelFormatter={(l: string) => `Week ${l.split("-W")[1] ?? l}`}
                  />
                  <Line type="monotone" dataKey="count" stroke={BAR_COLOR} strokeWidth={2} dot={{ r: 3, fill: BAR_COLOR }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-gray-400 text-right mt-1">{trendTotal} post{trendTotal !== 1 ? "s" : ""} in last {trendWindow} days · Log 5+ performances to unlock resonance trend</p>
          </>
        )}
      </div>

      {/* Best time to post */}
      {(data.bestTimeToPost.byDayOfWeek.length > 0 || data.bestTimeToPost.byTimeBlock.length > 0) && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-3.5 h-3.5 text-violet-500" />
            <SectionTitle>Best time to post</SectionTitle>
          </div>
          {data.bestTimeToPost.topCombination && (
            <div className="bg-violet-50 border border-violet-100 rounded-xl px-3 py-2 mb-3">
              <p className="text-[11px] font-bold text-violet-700">
                🏆 {data.bestTimeToPost.topCombination.day} {data.bestTimeToPost.topCombination.block.toLowerCase()} posts average {data.bestTimeToPost.topCombination.avgResonance} resonance
              </p>
            </div>
          )}
          {!data.bestTimeToPost.topCombination && bestDay && bestDay.avgResonance !== null && (
            <div className="bg-violet-50 border border-violet-100 rounded-xl px-3 py-2 mb-3">
              <p className="text-[11px] font-bold text-violet-700">
                🏆 {bestDay.day} posts average {bestDay.avgResonance} resonance
              </p>
            </div>
          )}
          {data.bestTimeToPost.byDayOfWeek.length > 0 && (
            <>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">By day of week</p>
              <div className="space-y-1.5 mb-3">
                {data.bestTimeToPost.byDayOfWeek.map(d => (
                  <div key={d.day} className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500 font-medium w-20 flex-shrink-0">{d.day.slice(0, 3)}</span>
                    <span className="text-gray-400 tabular-nums text-[10px] w-6">{d.count}p</span>
                    {d.avgResonance === null ? (
                      <SparseLabel />
                    ) : (
                      <div className="flex items-center gap-1.5 flex-1">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-violet-500 rounded-full" style={{ width: `${d.avgResonance}%` }} />
                        </div>
                        <span className="font-bold text-gray-700 tabular-nums w-5 text-right text-[10px]">{d.avgResonance}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          {data.bestTimeToPost.byTimeBlock.length > 0 && (
            <>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">By time of day</p>
              <div className="space-y-1.5">
                {data.bestTimeToPost.byTimeBlock.map(b => (
                  <div key={b.block} className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500 font-medium w-20 flex-shrink-0">{b.block}</span>
                    <span className="text-gray-400 tabular-nums text-[10px] w-6">{b.count}p</span>
                    {b.avgResonance === null ? (
                      <SparseLabel />
                    ) : (
                      <div className="flex items-center gap-1.5 flex-1">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-violet-500 rounded-full" style={{ width: `${b.avgResonance}%` }} />
                        </div>
                        <span className="font-bold text-gray-700 tabular-nums w-5 text-right text-[10px]">{b.avgResonance}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          {data.bestTimeToPost.byDayOfWeek.length === 0 && data.bestTimeToPost.byTimeBlock.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-3">Publish more posts in this window to see timing data</p>
          )}
        </div>
      )}

      {/* Hashtag performance */}
      {data.hashtagPerformance.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Hash className="w-3.5 h-3.5 text-violet-500" />
            <SectionTitle>Hashtag performance</SectionTitle>
          </div>
          <div className="space-y-1.5">
            {data.hashtagPerformance.map((h, i) => (
              <div key={h.hashtag} className="flex items-center gap-2 text-xs">
                <span className={cn("font-medium flex-shrink-0 w-4 text-[10px] tabular-nums text-center", i < 3 ? "text-violet-600" : "text-gray-400")}>{i + 1}</span>
                <span className="text-gray-700 font-medium flex-1 truncate">#{h.hashtag}</span>
                <span className="text-gray-400 tabular-nums text-[10px] flex-shrink-0">{h.count}×</span>
                {h.avgResonance === null ? (
                  <SparseLabel />
                ) : (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${h.avgResonance}%`, backgroundColor: i === 0 ? BAR_COLOR : BAR_MUTED }} />
                    </div>
                    <span className="font-bold text-gray-700 tabular-nums w-5 text-right text-[10px]">{h.avgResonance}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tone breakdown */}
      {data.byTone.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <SectionTitle>By tone</SectionTitle>
          {tonesWithResonance.length >= 2 ? (
            <>
              {bestTone && (
                <p className="text-[10px] text-violet-600 font-bold mb-2">
                  🏆 Strongest tone: {TONE_EMOJI[bestTone.tone] ?? ""} {bestTone.tone} ({bestTone.avgResonance} avg resonance)
                </p>
              )}
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tonesWithResonance} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <XAxis dataKey="tone" tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: string) => `${TONE_EMOJI[v] ?? ""} ${v}`} />
                    <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
                      formatter={(val: number) => [val, "Avg Resonance"]}
                    />
                    <Bar dataKey="avgResonance" radius={[4, 4, 0, 0]}>
                      {tonesWithResonance.map((entry, i) => (
                        <Cell key={i} fill={bestTone && entry.tone === bestTone.tone ? BAR_COLOR : BAR_MUTED} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.byTone} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <XAxis dataKey="tone" tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: string) => `${TONE_EMOJI[v] ?? ""} ${v}`} />
                    <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }} formatter={(val: number) => [val, "Posts"]} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {data.byTone.map((_, i) => <Cell key={i} fill={i === 0 ? BAR_COLOR : BAR_MUTED} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[10px] text-amber-500 mt-2 text-center">Log performance on 2+ posts per tone to see resonance breakdown</p>
            </>
          )}
          <div className="mt-3 space-y-1.5 border-t border-gray-50 pt-3">
            {data.byTone.map((t) => (
              <div key={t.tone} className="flex items-center gap-2 text-xs">
                <span className="text-gray-500 font-medium flex-1 truncate">{TONE_EMOJI[t.tone] ?? ""} {t.tone}</span>
                <span className="text-gray-400 tabular-nums">{t.count}p</span>
                {t.sampledCount < 2 ? (
                  <SparseLabel />
                ) : (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-500 rounded-full" style={{ width: `${t.avgResonance}%` }} />
                    </div>
                    <span className="font-bold text-gray-700 tabular-nums w-5 text-right">{t.avgResonance}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content source */}
      {data.byContentSource.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <SectionTitle>Content source</SectionTitle>
          <div className="space-y-2.5">
            {data.byContentSource.map((s, i) => {
              const pct = Math.round((s.count / data.totalPublished) * 100);
              return (
                <div key={s.source}>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-xs text-gray-600 flex-1 font-medium">{SOURCE_EMOJI[s.source] ?? ""} {SOURCE_LABELS[s.source] ?? s.source}</span>
                    <span className="text-[10px] text-gray-400 tabular-nums">{s.count} post{s.count !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: i === 0 ? BAR_COLOR : BAR_MUTED }} />
                    </div>
                    {s.sampledCount < 2 ? <SparseLabel /> : (
                      <span className="text-[10px] font-bold text-violet-600 tabular-nums w-14 text-right flex-shrink-0">⚡ {s.avgResonance}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* LinkedIn media format breakdown */}
      {hasMediaFormatData && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <SectionTitle>LinkedIn content format</SectionTitle>
          <div className="space-y-2.5">
            {data.byMediaFormat.map((f, i) => {
              const total = data.byMediaFormat.reduce((s, x) => s + x.count, 0);
              const pct = total > 0 ? Math.round((f.count / total) * 100) : 0;
              return (
                <div key={f.format}>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-xs text-gray-600 flex-1 font-medium">{MEDIA_FORMAT_EMOJI[f.format] ?? "📄"} {MEDIA_FORMAT_LABELS[f.format] ?? f.format}</span>
                    <span className="text-[10px] text-gray-400 tabular-nums">{f.count} post{f.count !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: i === 0 ? "#0ea5e9" : "#e0f2fe" }} />
                    </div>
                    {f.sampledCount < 2 ? <SparseLabel /> : (
                      <span className="text-[10px] font-bold text-sky-600 tabular-nums w-14 text-right flex-shrink-0">⚡ {f.avgResonance}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Visual type */}
      {data.byVisualType.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <SectionTitle>Visual format used</SectionTitle>
          <div className="space-y-2.5">
            {data.byVisualType.map((v, i) => {
              const pct = Math.round((v.count / data.totalPublished) * 100);
              return (
                <div key={v.type}>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-xs text-gray-600 flex-1 font-medium">{VISUAL_EMOJI[v.type] ?? ""} {VISUAL_LABELS[v.type] ?? v.type}</span>
                    <span className="text-[10px] text-gray-400 tabular-nums">{v.count} post{v.count !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: i === 0 ? "#10b981" : "#d1fae5" }} />
                    </div>
                    {v.sampledCount < 2 ? <SparseLabel /> : (
                      <span className="text-[10px] font-bold text-emerald-600 tabular-nums w-14 text-right flex-shrink-0">⚡ {v.avgResonance}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Objective */}
      {data.byObjective.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <SectionTitle>By objective</SectionTitle>
          <div className="space-y-2.5">
            {data.byObjective.map((o, i) => {
              const pct = Math.round((o.count / data.totalPublished) * 100);
              return (
                <div key={o.objective}>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-xs text-gray-600 flex-1 font-medium">{o.objective}</span>
                    <span className="text-[10px] text-gray-400 tabular-nums">{o.count} post{o.count !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: i === 0 ? "#f59e0b" : "#fef3c7" }} />
                    </div>
                    {o.sampledCount < 2 ? <SparseLabel /> : (
                      <span className="text-[10px] font-bold text-amber-600 tabular-nums w-14 text-right flex-shrink-0">⚡ {o.avgResonance}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top posts */}
      {data.topPosts.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <SectionTitle>Top posts by resonance</SectionTitle>
          <div className="space-y-3">
            {data.topPosts.map((p, i) => (
              <button
                key={p.id}
                onClick={() => navigate(`/library?highlight=${p.id}`)}
                className="w-full flex items-center gap-3 text-left hover:bg-gray-50 rounded-xl p-1 -mx-1 transition-colors"
              >
                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold flex-shrink-0", i === 0 ? "bg-violet-100 text-violet-700" : "bg-gray-100 text-gray-500")}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-800 truncate">{p.topic}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {p.tone && (
                      <span className="text-[10px] bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded-full font-medium">
                        {TONE_EMOJI[p.tone] ?? ""} {p.tone}
                      </span>
                    )}
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">
                      {SOURCE_EMOJI[p.contentSource] ?? ""} {SOURCE_LABELS[p.contentSource] ?? p.contentSource}
                    </span>
                    {p.visualType !== "none" && (
                      <span className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full font-medium">
                        {VISUAL_EMOJI[p.visualType] ?? ""} {VISUAL_LABELS[p.visualType] ?? p.visualType}
                      </span>
                    )}
                    {p.engagementRate !== null && (
                      <span className="text-[10px] bg-sky-50 text-sky-600 px-1.5 py-0.5 rounded-full font-medium">
                        {p.engagementRate}% eng
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-violet-500 rounded-full" style={{ width: `${p.resonance}%` }} />
                  </div>
                  <span className="text-xs font-extrabold text-violet-700 tabular-nums">{p.resonance}</span>
                </div>
              </button>
            ))}
          </div>
          <button onClick={() => navigate("/library")} className="mt-4 w-full text-center text-xs text-violet-600 font-bold py-2 hover:underline">
            View all in Library →
          </button>
        </div>
      )}
    </>
  );
}
