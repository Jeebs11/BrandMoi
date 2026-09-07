import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  BarChart2, TrendingUp, Layers, FileText, Trophy, Zap, AlertCircle, HeartHandshake,
  ArrowUp, ArrowDown, Minus, Clock, Hash, CalendarDays, Activity, ChevronDown,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Cell, AreaChart, Area,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { usePageTour } from "@/components/tour/usePageTour";
import { ANALYTICS_TOUR_STEPS } from "@/components/tour/page-tours";
import { Skeleton } from "@/components/ui/skeleton";
import { InfoTooltip } from "@/components/InfoTooltip";
import { cn } from "@/lib/utils";
import { analyticsApi, seriesApi, topicsApi, type AnalyticsOverview, type KpiTrend, type Series, type Topic } from "@/lib/api";

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

// Recharts category-axis ticks don't wrap — long labels get clipped at the
// axis width, especially on mobile. Truncate defensively for any horizontal
// bar chart's YAxis category label.
function truncateLabel(v: string, max = 12): string {
  return v.length > max ? `${v.slice(0, max - 1)}…` : v;
}

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

  const { data: seriesList } = useQuery<Series[]>({
    queryKey: ["series-list"],
    queryFn: () => seriesApi.list(),
    staleTime: 60_000,
  });
  const { data: topicsList } = useQuery<Topic[]>({
    queryKey: ["topics-list"],
    queryFn: () => topicsApi.list(),
    staleTime: 60_000,
  });

  const pageTour = usePageTour("analytics-tour", ANALYTICS_TOUR_STEPS, !isLoading && !!data && data.totalPublished > 0);

  return (
    <AppShell>
      <header className="px-6 pt-10 pb-4 bg-white/80 backdrop-blur border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BarChart2 className="w-4.5 h-4.5 text-gray-900" />
            <h1 className="text-lg font-extrabold text-gray-900 tracking-tight">Analytics</h1>
          </div>
          <div className="flex gap-1 bg-gray-50 rounded-full p-0.5">
            {([30, 60, 90] as const).map(w => (
              <button
                key={w}
                onClick={() => setTrendWindow(w)}
                className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full transition-all", trendWindow === w ? "bg-gray-900 text-white shadow-sm" : "text-gray-400 hover:text-gray-600")}
              >
                {w}d
              </button>
            ))}
          </div>
        </div>
      </header>
      <main className="flex-1 px-4 py-5 overflow-y-auto pb-28">
        <div className="max-w-3xl mx-auto space-y-5">
          {isLoading ? <LoadingState /> : !data || data.totalPublished === 0 ? <EmptyState /> : <Content data={data} trendWindow={trendWindow} seriesList={seriesList} topicsList={topicsList} />}
        </div>
      </main>
      {pageTour}
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

const BREAKDOWN_TABS = [
  { key: "tone", label: "Tone" },
  { key: "source", label: "Content source" },
  { key: "visual", label: "Visual format" },
  { key: "objective", label: "Objective" },
] as const;
type BreakdownKey = (typeof BREAKDOWN_TABS)[number]["key"];

function Content({ data, trendWindow, seriesList, topicsList }: { data: AnalyticsOverview; trendWindow: 30 | 60 | 90; seriesList?: Series[]; topicsList?: Topic[] }) {
  const [, navigate] = useLocation();
  const [activeBreakdown, setActiveBreakdown] = useState<BreakdownKey>("tone");
  const [moreOpen, setMoreOpen] = useState(false);

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

  const nextMilestone = [5, 10, 25, 50, 100, 250].find((m) => m > data.totalPublished) ?? null;
  const champion = data.topPosts[0] ?? null;
  const heroTrend = useResonanceTrend ? filteredResTrend : filteredCountTrend;
  const heroKey = useResonanceTrend ? "avgResonance" : "count";

  return (
    <>
      {/* ── Hero band ── */}
      <section data-tour="analytics-hero" className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-gray-900 via-gray-900 to-violet-950 px-6 pt-6 pb-4">
        <div className="absolute -top-20 -right-10 w-56 h-56 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-end justify-between gap-4 mb-1">
          <div>
            <p className="text-[10px] font-bold text-white/40 tracking-[0.25em] uppercase mb-1.5 flex items-center gap-1">
              {hasResonanceData ? (
                <InfoTooltip content="Reactions + comments + reposts, divided by impressions. This is LinkedIn's own way of measuring how well a post performed relative to its reach.">
                  Engagement rate
                </InfoTooltip>
              ) : "Posts published"} · last {trendWindow} days
            </p>
            <div className="flex items-baseline gap-2.5">
              <span className="text-5xl font-black text-white tabular-nums tracking-tight">
                {hasResonanceData ? (data.kpiTrends.avgEngagementRate.current ?? data.avgEngagementRate ?? 0) : (data.kpiTrends.totalPublished.current ?? data.totalPublished)}
              </span>
              {hasResonanceData && <span className="text-xs text-white/40 font-bold">%</span>}
              {(hasResonanceData ? data.kpiTrends.avgEngagementRate : data.kpiTrends.totalPublished).trend === "up" && (
                <span className="text-[11px] font-black text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">▲ climbing</span>
              )}
              {(hasResonanceData ? data.kpiTrends.avgEngagementRate : data.kpiTrends.totalPublished).trend === "down" && (
                <span className="text-[11px] font-black text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">▼ dipped</span>
              )}
            </div>
          </div>
        </div>
        {heroTrend.length >= 2 && (
          <div className="relative h-16 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={heroTrend} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey={heroKey} stroke="#a78bfa" strokeWidth={2} fill="url(#heroGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="relative grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4 pt-3 border-t border-white/10">
          <div>
            <p className="text-lg font-extrabold text-white tabular-nums">{data.kpiTrends.totalPublished.current ?? data.totalPublished}</p>
            <p className="text-[9px] font-bold text-white/35 uppercase tracking-wider">Published</p>
          </div>
          {data.avgEngagementRate !== null && (
            <div>
              <p className="text-lg font-extrabold text-white tabular-nums">{data.avgEngagementRate}%</p>
              <p className="text-[9px] font-bold text-white/35 uppercase tracking-wider">Engagement</p>
            </div>
          )}
          {data.totalImpressions > 0 && (
            <div>
              <p className="text-lg font-extrabold text-white tabular-nums">{data.totalImpressions.toLocaleString()}</p>
              <p className="text-[9px] font-bold text-white/35 uppercase tracking-wider">Impressions</p>
            </div>
          )}
          {data.postingConsistency.avgDaysBetweenPosts !== null && (
            <div>
              <p className="text-lg font-extrabold text-white tabular-nums">~{data.postingConsistency.avgDaysBetweenPosts}d</p>
              <p className="text-[9px] font-bold text-white/35 uppercase tracking-wider">Cadence</p>
            </div>
          )}
          {bestTone && (
            <div>
              <p className="text-lg font-extrabold text-white">{TONE_EMOJI[bestTone.tone] ?? ""} {bestTone.tone}</p>
              <p className="text-[9px] font-bold text-white/35 uppercase tracking-wider">Best tone</p>
            </div>
          )}
        </div>
      </section>

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

      {/* Trend chart */}
      <div data-tour="analytics-trend" className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>
            {useResonanceTrend ? "Impact trend" : "Publishing trend"}
          </SectionTitle>
        </div>

        {useResonanceTrend ? (
          <>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredResTrend} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="impactGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={BAR_COLOR} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={BAR_COLOR} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="week" tick={{ fontSize: 9, fill: "#9ca3af" }} tickLine={false} axisLine={false} tickFormatter={(v: string) => `W${v.split("-W")[1] ?? v}`} />
                  <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 10, border: "1px solid #e5e7eb", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}
                    formatter={(val: number) => [val, "Avg Impact"]}
                    labelFormatter={(l: string) => `Week ${l.split("-W")[1] ?? l}`}
                  />
                  <Area type="monotone" dataKey="avgResonance" stroke={BAR_COLOR} strokeWidth={2.5} fill="url(#impactGrad)" dot={{ r: 3, fill: BAR_COLOR, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-gray-400 text-right mt-1">{trendTotal} post{trendTotal !== 1 ? "s" : ""} in last {trendWindow} days</p>
          </>
        ) : filteredCountTrend.length < 2 ? (
          <div className="h-24 flex flex-col items-center justify-center gap-2">
            <p className="text-xs text-gray-400">Not enough data for this window yet</p>
            {!hasResonanceData && (
              <p className="text-[10px] text-amber-500">Log performance on ≥5 posts to unlock the impact trend</p>
            )}
          </div>
        ) : (
          <>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredCountTrend} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="countGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={BAR_COLOR} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={BAR_COLOR} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="week" tick={{ fontSize: 9, fill: "#9ca3af" }} tickLine={false} axisLine={false} tickFormatter={(v: string) => `W${v.split("-W")[1] ?? v}`} />
                  <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 10, border: "1px solid #e5e7eb", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}
                    formatter={(val: number) => [val, "Posts"]}
                    labelFormatter={(l: string) => `Week ${l.split("-W")[1] ?? l}`}
                  />
                  <Area type="monotone" dataKey="count" stroke={BAR_COLOR} strokeWidth={2.5} fill="url(#countGrad)" dot={{ r: 3, fill: BAR_COLOR, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-gray-400 text-right mt-1">{trendTotal} post{trendTotal !== 1 ? "s" : ""} in last {trendWindow} days · Log 5+ performances to unlock the impact trend</p>
          </>
        )}
      </div>

      {/* Best time to post */}
      {(data.bestTimeToPost.byDayOfWeek.length > 0 || data.bestTimeToPost.byTimeBlock.length > 0) && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-3.5 h-3.5 text-violet-500" />
            <SectionTitle>
              <InfoTooltip content="Shows which days and time blocks your posts tend to perform best in, based on your logged engagement.">
                Best time to post
              </InfoTooltip>
            </SectionTitle>
          </div>
          {data.bestTimeToPost.topCombination && (
            <div className="bg-violet-50 border border-violet-100 rounded-xl px-3 py-2 mb-3">
              <p className="text-[11px] font-bold text-violet-700">
                🏆 {data.bestTimeToPost.topCombination.day} {data.bestTimeToPost.topCombination.block.toLowerCase()} posts average {data.bestTimeToPost.topCombination.avgResonance} impact
              </p>
            </div>
          )}
          {!data.bestTimeToPost.topCombination && bestDay && bestDay.avgResonance !== null && (
            <div className="bg-violet-50 border border-violet-100 rounded-xl px-3 py-2 mb-3">
              <p className="text-[11px] font-bold text-violet-700">
                🏆 {bestDay.day} posts average {bestDay.avgResonance} impact
              </p>
            </div>
          )}
          {data.bestTimeToPost.byDayOfWeek.length > 0 && (() => {
            const chartable = data.bestTimeToPost.byDayOfWeek
              .filter(d => d.avgResonance !== null)
              .map(d => ({ label: d.day.slice(0, 3), value: d.avgResonance as number, count: d.count }));
            const sparseCount = data.bestTimeToPost.byDayOfWeek.length - chartable.length;
            return (
              <div className="mb-3">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">By day of week</p>
                {chartable.length > 0 ? (
                  <div style={{ height: chartable.length * 24 + 8 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartable} layout="vertical" margin={{ top: 2, right: 24, left: 0, bottom: 0 }}>
                        <XAxis type="number" hide domain={[0, 100]} />
                        <YAxis type="category" dataKey="label" width={32} tick={{ fontSize: 10, fill: "#6b7280" }} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }} formatter={(val: number) => [val, "Avg Impact"]} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 10, fill: "#6b7280" }}>
                          {chartable.map((entry, i) => <Cell key={i} fill={i === 0 ? BAR_COLOR : BAR_MUTED} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <SparseLabel />
                )}
                {sparseCount > 0 && (
                  <p className="text-[10px] text-gray-400 mt-1">{sparseCount} day{sparseCount !== 1 ? "s" : ""} with limited data not shown</p>
                )}
              </div>
            );
          })()}
          {data.bestTimeToPost.byTimeBlock.length > 0 && (() => {
            const chartable = data.bestTimeToPost.byTimeBlock
              .filter(b => b.avgResonance !== null)
              .map(b => ({ label: b.block, value: b.avgResonance as number, count: b.count }));
            const sparseCount = data.bestTimeToPost.byTimeBlock.length - chartable.length;
            return (
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">By time of day</p>
                {chartable.length > 0 ? (
                  <div style={{ height: chartable.length * 24 + 8 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartable} layout="vertical" margin={{ top: 2, right: 24, left: 0, bottom: 0 }}>
                        <XAxis type="number" hide domain={[0, 100]} />
                        <YAxis type="category" dataKey="label" width={68} tick={{ fontSize: 10, fill: "#6b7280" }} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }} formatter={(val: number) => [val, "Avg Impact"]} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 10, fill: "#6b7280" }}>
                          {chartable.map((entry, i) => <Cell key={i} fill={i === 0 ? BAR_COLOR : BAR_MUTED} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <SparseLabel />
                )}
                {sparseCount > 0 && (
                  <p className="text-[10px] text-gray-400 mt-1">{sparseCount} time block{sparseCount !== 1 ? "s" : ""} with limited data not shown</p>
                )}
              </div>
            );
          })()}
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
          {(() => {
            const chartable = data.hashtagPerformance
              .filter(h => h.avgResonance !== null)
              .map(h => ({ label: `#${h.hashtag}`, value: h.avgResonance as number, count: h.count }));
            const sparse = data.hashtagPerformance.filter(h => h.avgResonance === null);
            return (
              <>
                {chartable.length > 0 ? (
                  <div style={{ height: chartable.length * 24 + 8 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartable} layout="vertical" margin={{ top: 2, right: 24, left: 0, bottom: 0 }}>
                        <XAxis type="number" hide domain={[0, 100]} />
                        <YAxis
                          type="category"
                          dataKey="label"
                          width={80}
                          tick={{ fontSize: 10, fill: "#6b7280" }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={truncateLabel}
                        />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }} formatter={(val: number) => [val, "Avg Impact"]} labelFormatter={(l: string) => l} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 10, fill: "#6b7280" }}>
                          {chartable.map((entry, i) => <Cell key={i} fill={i === 0 ? BAR_COLOR : BAR_MUTED} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <SparseLabel />
                )}
                {sparse.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {sparse.map(h => (
                      <div key={h.hashtag} className="flex items-center gap-2 text-xs">
                        <span className="text-gray-700 font-medium flex-1 truncate">#{h.hashtag}</span>
                        <span className="text-gray-400 tabular-nums text-[10px] flex-shrink-0">{h.count}×</span>
                        <SparseLabel />
                      </div>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Consolidated breakdowns: tone / content source / visual format / objective */}
      {(data.byTone.length > 0 || data.byContentSource.length > 0 || data.byVisualType.length > 0 || data.byObjective.length > 0) && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <SectionTitle>Breakdown by category</SectionTitle>
          </div>
          <div className="flex gap-1 bg-gray-50 rounded-full p-0.5 mb-3 overflow-x-auto">
            {BREAKDOWN_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveBreakdown(t.key)}
                className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap transition-all", activeBreakdown === t.key ? "bg-gray-900 text-white shadow-sm" : "text-gray-400 hover:text-gray-600")}
              >
                {t.label}
              </button>
            ))}
          </div>

          {activeBreakdown === "tone" && data.byTone.length > 0 && (
          <>
          {tonesWithResonance.length >= 2 ? (
            <>
              {bestTone && (
                <p className="text-[10px] text-violet-600 font-bold mb-2">
                  🏆 Strongest tone: {TONE_EMOJI[bestTone.tone] ?? ""} {bestTone.tone} ({bestTone.avgResonance} avg impact)
                </p>
              )}
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tonesWithResonance} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <XAxis dataKey="tone" tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: string) => `${TONE_EMOJI[v] ?? ""} ${v}`} />
                    <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
                      formatter={(val: number) => [val, "Avg Impact"]}
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
              <p className="text-[10px] text-amber-500 mt-2 text-center">Log performance on 2+ posts per tone to see the impact breakdown</p>
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
          </>
          )}

          {activeBreakdown === "source" && data.byContentSource.length > 0 && (
          <>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byContentSource.map(s => ({ ...s, label: `${SOURCE_EMOJI[s.source] ?? ""} ${SOURCE_LABELS[s.source] ?? s.source}` }))} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#9ca3af" }} />
                  <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }} formatter={(val: number) => [val, "Posts"]} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {data.byContentSource.map((_, i) => <Cell key={i} fill={i === 0 ? BAR_COLOR : BAR_MUTED} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 space-y-1.5 border-t border-gray-50 pt-3">
              {data.byContentSource.map((s) => (
                <div key={s.source} className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500 font-medium flex-1 truncate">{SOURCE_EMOJI[s.source] ?? ""} {SOURCE_LABELS[s.source] ?? s.source}</span>
                  <span className="text-gray-400 tabular-nums">{s.count}p</span>
                  {s.sampledCount < 2 ? <SparseLabel /> : (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-500 rounded-full" style={{ width: `${s.avgResonance}%` }} />
                      </div>
                      <span className="font-bold text-gray-700 tabular-nums w-5 text-right">{s.avgResonance}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
          )}

          {activeBreakdown === "visual" && data.byVisualType.length > 0 && (
          <>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byVisualType.map(v => ({ ...v, label: `${VISUAL_EMOJI[v.type] ?? ""} ${VISUAL_LABELS[v.type] ?? v.type}` }))} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#9ca3af" }} />
                  <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }} formatter={(val: number) => [val, "Posts"]} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {data.byVisualType.map((_, i) => <Cell key={i} fill={i === 0 ? "#10b981" : "#d1fae5"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 space-y-1.5 border-t border-gray-50 pt-3">
              {data.byVisualType.map((v) => (
                <div key={v.type} className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500 font-medium flex-1 truncate">{VISUAL_EMOJI[v.type] ?? ""} {VISUAL_LABELS[v.type] ?? v.type}</span>
                  <span className="text-gray-400 tabular-nums">{v.count}p</span>
                  {v.sampledCount < 2 ? <SparseLabel /> : (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${v.avgResonance}%` }} />
                      </div>
                      <span className="font-bold text-gray-700 tabular-nums w-5 text-right">{v.avgResonance}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
          )}

          {activeBreakdown === "objective" && data.byObjective.length > 0 && (
          <>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byObjective} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <XAxis dataKey="objective" tick={{ fontSize: 9, fill: "#9ca3af" }} />
                  <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }} formatter={(val: number) => [val, "Posts"]} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {data.byObjective.map((_, i) => <Cell key={i} fill={i === 0 ? "#f59e0b" : "#fef3c7"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 space-y-1.5 border-t border-gray-50 pt-3">
              {data.byObjective.map((o) => (
                <div key={o.objective} className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500 font-medium flex-1 truncate">{o.objective}</span>
                  <span className="text-gray-400 tabular-nums">{o.count}p</span>
                  {o.sampledCount < 2 ? <SparseLabel /> : (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: `${o.avgResonance}%` }} />
                      </div>
                      <span className="font-bold text-gray-700 tabular-nums w-5 text-right">{o.avgResonance}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
          )}
        </div>
      )}

      {/* Top posts */}
      {data.topPosts.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <SectionTitle>
            <InfoTooltip content="Engagement rate — reactions + comments + reposts, divided by impressions. LinkedIn's own measure of how well a post did relative to how many people saw it.">
              Best performing posts
            </InfoTooltip>
          </SectionTitle>
          <div className="space-y-3">
            {data.topPosts.map((p, i) => (
              <button
                key={p.id}
                onClick={() => navigate(`/library?highlight=${p.id}`)}
                className="w-full flex items-start gap-3 text-left hover:bg-gray-50 rounded-xl p-1 -mx-1 transition-colors"
              >
                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold flex-shrink-0 mt-0.5", i === 0 ? "bg-violet-100 text-violet-700" : "bg-gray-100 text-gray-500")}>
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
                  </div>
                  {p.impressions > 0 && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      {p.impressions.toLocaleString()} impressions · {p.reactions} reactions · {p.comments} comments{p.reposts > 0 ? ` · ${p.reposts} reposts` : ""}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-sm font-extrabold text-violet-700 tabular-nums">
                    {p.engagementRate !== null ? `${p.engagementRate}%` : "—"}
                  </span>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Eng. rate</p>
                </div>
              </button>
            ))}
          </div>
          <button onClick={() => navigate("/library")} className="mt-4 w-full text-center text-xs text-violet-600 font-bold py-2 hover:underline">
            View all in Library →
          </button>
        </div>
      )}

      {/* ── More insights (collapsed by default) ── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div
          className="px-4 py-3 flex items-center justify-between cursor-pointer"
          onClick={() => setMoreOpen((v) => !v)}
        >
          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">More insights</span>
          </div>
          <ChevronDown className={cn("w-3.5 h-3.5 text-gray-400 transition-transform duration-200", moreOpen && "rotate-180")} />
        </div>
        {moreOpen && (
          <div className="px-4 pb-4 space-y-4 border-t border-gray-50 pt-4">
            {/* Milestone progress */}
            {nextMilestone && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Next milestone</p>
                  <p className="text-[11px] font-black text-violet-600 tabular-nums">{data.totalPublished} / {nextMilestone} posts</p>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-700" style={{ width: `${Math.min(100, Math.round((data.totalPublished / nextMilestone) * 100))}%` }} />
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5">{nextMilestone - data.totalPublished} more post{nextMilestone - data.totalPublished !== 1 ? "s" : ""} to hit {nextMilestone} 🏅</p>
              </div>
            )}

            {/* Personal best */}
            {champion && champion.resonance >= 40 && (
              <button
                onClick={() => navigate(`/library?highlight=${champion.id}`)}
                className="w-full rounded-2xl bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 p-[1.5px] text-left group"
              >
                <div className="rounded-[14.5px] bg-white px-4 py-3 flex items-center gap-3 group-hover:bg-amber-50/50 transition-colors">
                  <span className="text-xl flex-shrink-0">🏆</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Personal best</p>
                    <p className="text-xs font-bold text-gray-800 truncate">{champion.topic}</p>
                    {champion.impressions > 0 && (
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {champion.impressions.toLocaleString()} impressions · {champion.reactions + champion.comments} reactions & comments
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-xl font-black text-amber-500 tabular-nums">{champion.engagementRate !== null ? `${champion.engagementRate}%` : "—"}</span>
                    <p className="text-[9px] font-bold text-amber-500/70 uppercase tracking-wider">Engagement</p>
                  </div>
                </div>
              </button>
            )}

            {/* Learning signal health */}
            <div data-tour="analytics-learning">
              <div className="flex items-center gap-2 mb-1">
                <HeartHandshake className="w-3.5 h-3.5 text-violet-500" />
                <SectionTitle>How BrandMoi is learning</SectionTitle>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed mb-3">
                Your direct feedback and current settings lead. Post outcomes provide supporting context only.
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <LearningMetric
                  label="Voice approvals"
                  value={data.learningMetrics.authorFeedback.approvalRate === null ? "—" : `${data.learningMetrics.authorFeedback.approvalRate}%`}
                  detail={data.learningMetrics.authorFeedback.reviewedDrafts === 0
                    ? "No reviews yet"
                    : `${data.learningMetrics.authorFeedback.soundsLikeMe} of ${data.learningMetrics.authorFeedback.reviewedDrafts} reviews`}
                />
                <LearningMetric
                  label="Meaningful edits"
                  value={data.learningMetrics.evidence.materiallyEditedBeforePublish}
                  detail="Before publishing"
                />
                <LearningMetric
                  label="Voice evidence"
                  value={data.learningMetrics.evidence.pinnedWritingSamples + data.learningMetrics.evidence.authenticatedPosts}
                  detail={`${data.learningMetrics.evidence.pinnedWritingSamples} samples · ${data.learningMetrics.evidence.authenticatedPosts} verified posts`}
                />
                <LearningMetric
                  label="Measured outcomes"
                  value={data.learningMetrics.outcomes.performanceEntries}
                  detail={`${data.learningMetrics.outcomes.externalFeedbackUnknown} feedback states unknown`}
                />
              </div>
              {data.feedbackCoaching.message && (
                <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-1">Post-level coaching</p>
                  <p className="text-[11px] leading-relaxed text-amber-800">{data.feedbackCoaching.message}</p>
                </div>
              )}
            </div>

            {/* Series performance rollup — reuses each series' already-computed
                aggregate (GET /series), no extra AI or query here. */}
            {seriesList && seriesList.filter((s) => s.performance.impressions > 0).length > 0 && (() => {
              const chartable = [...seriesList]
                .filter((s) => s.performance.impressions > 0)
                .sort((a, b) => b.performance.impressions - a.performance.impressions)
                .map((s) => ({ label: s.title, value: s.performance.impressions, parts: `${s.partsPublished}/${s.plannedParts}` }));
              return (
                <div>
                  <SectionTitle>By series</SectionTitle>
                  <div style={{ height: chartable.length * 26 + 8 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartable} layout="vertical" margin={{ top: 2, right: 32, left: 0, bottom: 0 }}>
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="label" width={92} tick={{ fontSize: 10, fill: "#6b7280" }} tickLine={false} axisLine={false} tickFormatter={(v: string) => truncateLabel(v, 14)} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }} formatter={(val: number) => [val.toLocaleString(), "Impressions"]} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 9, fill: "#6b7280", formatter: (v: number) => v.toLocaleString() }}>
                          {chartable.map((entry, i) => <Cell key={i} fill={i === 0 ? BAR_COLOR : BAR_MUTED} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })()}

            {/* Topic breakdown — post count per topic (performance rollup by topic
                would need a new aggregation endpoint; this is the count-only view). */}
            {topicsList && topicsList.filter((t) => t.draftCount > 0).length > 0 && (() => {
              const chartable = [...topicsList]
                .filter((t) => t.draftCount > 0)
                .sort((a, b) => b.draftCount - a.draftCount)
                .map((t) => ({ label: t.name, value: t.draftCount }));
              return (
                <div>
                  <SectionTitle>By topic</SectionTitle>
                  <div style={{ height: chartable.length * 26 + 8 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartable} layout="vertical" margin={{ top: 2, right: 24, left: 0, bottom: 0 }}>
                        <XAxis type="number" hide allowDecimals={false} />
                        <YAxis type="category" dataKey="label" width={92} tick={{ fontSize: 10, fill: "#6b7280" }} tickLine={false} axisLine={false} tickFormatter={(v: string) => truncateLabel(v, 14)} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }} formatter={(val: number) => [val, "Posts"]} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 9, fill: "#6b7280" }}>
                          {chartable.map((entry, i) => <Cell key={i} fill={i === 0 ? BAR_COLOR : BAR_MUTED} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })()}

            {/* LinkedIn media format breakdown */}
            {hasMediaFormatData && (() => {
              const chartable = data.byMediaFormat.map((f) => ({
                label: `${MEDIA_FORMAT_EMOJI[f.format] ?? "📄"} ${MEDIA_FORMAT_LABELS[f.format] ?? f.format}`,
                value: f.count,
              }));
              return (
                <div>
                  <SectionTitle>LinkedIn content format</SectionTitle>
                  <div style={{ height: chartable.length * 26 + 8 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartable} layout="vertical" margin={{ top: 2, right: 24, left: 0, bottom: 0 }}>
                        <XAxis type="number" hide allowDecimals={false} />
                        <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 10, fill: "#6b7280" }} tickLine={false} axisLine={false} tickFormatter={(v: string) => truncateLabel(v, 16)} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }} formatter={(val: number) => [val, "Posts"]} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 9, fill: "#6b7280" }}>
                          {chartable.map((entry, i) => <Cell key={i} fill={i === 0 ? "#0ea5e9" : "#e0f2fe"} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </>
  );
}

function LearningMetric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="mt-0.5 text-lg font-extrabold tabular-nums text-gray-900">{value}</p>
      <p className="text-[10px] leading-snug text-gray-400">{detail}</p>
    </div>
  );
}
