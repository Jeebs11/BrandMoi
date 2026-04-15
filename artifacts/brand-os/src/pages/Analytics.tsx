import { useQuery } from "@tanstack/react-query";
import { BarChart2, TrendingUp, Target, Layers, Sparkles, FileText } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Cell,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { analyticsApi, type AnalyticsOverview } from "@/lib/api";

const SOURCE_LABELS: Record<string, string> = {
  capture: "Direct capture",
  news_reaction: "News reaction",
  teach_audience: "Teach audience",
  story_mode: "Story mode",
  brand_voice_idea: "Agent idea",
};

const VISUAL_LABELS: Record<string, string> = {
  none: "Text only",
  card: "Visual card",
  carousel: "Carousel",
  infographic: "Infographic",
  art: "AI artwork",
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

const BAR_COLOR = "#7c3aed";
const BAR_MUTED = "#ede9fe";

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0 text-violet-600">
        {icon}
      </div>
      <div>
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-2xl font-extrabold text-gray-900 leading-none">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest px-1 mb-2">{children}</h2>;
}

export default function Analytics() {
  const { data, isLoading } = useQuery<AnalyticsOverview>({
    queryKey: ["analytics-overview"],
    queryFn: analyticsApi.overview,
    staleTime: 60_000,
  });

  return (
    <AppShell>
      <header className="px-6 pt-12 pb-4 bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <BarChart2 className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-extrabold text-gray-900">Analytics</h1>
        </div>
        <p className="text-xs text-gray-400 mt-1 ml-8">Performance insights across your published posts</p>
      </header>

      <main className="flex-1 px-4 py-5 space-y-6 overflow-y-auto pb-28">
        {isLoading ? (
          <LoadingState />
        ) : !data || data.totalPublished === 0 ? (
          <EmptyState />
        ) : (
          <Content data={data} />
        )}
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
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-8">
      <BarChart2 className="w-12 h-12 text-gray-200 mb-4" />
      <p className="font-bold text-gray-600 mb-1">No published posts yet</p>
      <p className="text-sm text-gray-400">
        Mark your first post as published in the Library to start seeing analytics.
      </p>
    </div>
  );
}

function Content({ data }: { data: AnalyticsOverview }) {
  const hasResonance = data.avgResonance > 0;

  return (
    <>
      {/* Overview stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<FileText className="w-4 h-4" />}
          label="Published"
          value={data.totalPublished}
          sub="total posts"
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Avg Resonance"
          value={hasResonance ? `${data.avgResonance}` : "—"}
          sub={hasResonance ? "out of 100" : "log performance to track"}
        />
      </div>

      {/* Weekly trend */}
      {data.weeklyTrend.length > 1 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <SectionTitle>Publishing trend</SectionTitle>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.weeklyTrend} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 9, fill: "#9ca3af" }}
                  tickFormatter={(v: string) => v.split("-W")[1] ? `W${v.split("-W")[1]}` : v}
                />
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
        </div>
      )}

      {/* Tone breakdown */}
      {data.byTone.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <SectionTitle>By tone</SectionTitle>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byTone} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <XAxis
                  dataKey="tone"
                  tick={{ fontSize: 9, fill: "#9ca3af" }}
                  tickFormatter={(v: string) => `${TONE_EMOJI[v] ?? ""} ${v}`}
                />
                <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
                  formatter={(val: number, name: string) => [
                    val,
                    name === "count" ? "Posts" : "Avg resonance",
                  ]}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {data.byTone.map((entry, i) => (
                    <Cell key={i} fill={i === 0 ? BAR_COLOR : BAR_MUTED} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {hasResonance && (
            <div className="mt-3 space-y-1.5">
              {data.byTone.filter(t => t.avgResonance > 0).map((t) => (
                <div key={t.tone} className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-medium">{TONE_EMOJI[t.tone] ?? ""} {t.tone}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-500 rounded-full" style={{ width: `${t.avgResonance}%` }} />
                    </div>
                    <span className="font-bold text-gray-700 tabular-nums w-6 text-right">{t.avgResonance}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Content source */}
      {data.byContentSource.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <SectionTitle>Content source</SectionTitle>
          <div className="space-y-2">
            {data.byContentSource.map((s, i) => {
              const pct = Math.round((s.count / data.totalPublished) * 100);
              return (
                <div key={s.source} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-28 truncate font-medium">{SOURCE_LABELS[s.source] ?? s.source}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: i === 0 ? BAR_COLOR : BAR_MUTED }}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-gray-600 tabular-nums w-8 text-right">{s.count}</span>
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
          <div className="space-y-2">
            {data.byVisualType.map((v, i) => {
              const pct = Math.round((v.count / data.totalPublished) * 100);
              return (
                <div key={v.type} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-28 truncate font-medium">{VISUAL_LABELS[v.type] ?? v.type}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: i === 0 ? "#10b981" : "#d1fae5" }}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-gray-600 tabular-nums w-8 text-right">{v.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Objective */}
      {data.byObjective.length > 1 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <SectionTitle>By objective</SectionTitle>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byObjective} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <XAxis dataKey="objective" tick={{ fontSize: 9, fill: "#9ca3af" }} />
                <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }} formatter={(val: number) => [val, "Posts"]} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {data.byObjective.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? "#f59e0b" : "#fef3c7"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Top posts */}
      {data.topPosts.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <SectionTitle>Top posts by resonance</SectionTitle>
          <div className="space-y-3">
            {data.topPosts.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3">
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold flex-shrink-0",
                  i === 0 ? "bg-violet-100 text-violet-700" : "bg-gray-100 text-gray-500"
                )}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-800 truncate">{p.topic}</p>
                  <p className="text-[10px] text-gray-400">{TONE_EMOJI[p.tone] ?? ""} {p.tone}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-violet-500 rounded-full" style={{ width: `${p.resonance}%` }} />
                  </div>
                  <span className="text-xs font-extrabold text-violet-700 tabular-nums">{p.resonance}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
