import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Settings, ArrowRight, Lightbulb, Clock, Flame, ChevronDown, ChevronUp, AlertCircle, X, Zap } from "lucide-react";
import { useListDrafts, useGetSuggestions } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { thoughtsApi, momentumApi, type Thought, type MomentumData } from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  ready: "bg-blue-50 text-blue-600",
  published: "bg-green-50 text-green-700",
};

const OBJECTIVE_COLORS: Record<string, string> = {
  Clients: "bg-amber-50 text-amber-700",
  Job: "bg-sky-50 text-sky-700",
  Authority: "bg-violet-50 text-violet-700",
  Documenting: "bg-emerald-50 text-emerald-700",
};

const SUGGESTION_ACCENT: Record<string, string> = {
  angle: "border-l-violet-400",
  repurpose: "border-l-amber-400",
  gap: "border-l-sky-400",
  depth: "border-l-emerald-400",
  prompt: "border-l-primary",
};

const MOMENTUM_STYLES: Record<string, { bg: string; text: string; label: string; bar: string }> = {
  Strong:   { bg: "bg-emerald-500", text: "text-emerald-600", label: "bg-emerald-50 border-emerald-100", bar: "bg-emerald-500" },
  Building: { bg: "bg-primary",     text: "text-primary",     label: "bg-blue-50 border-blue-100",     bar: "bg-primary" },
  Fading:   { bg: "bg-amber-500",   text: "text-amber-600",   label: "bg-amber-50 border-amber-100",   bar: "bg-amber-400" },
  Silent:   { bg: "bg-gray-400",    text: "text-gray-500",    label: "bg-gray-50 border-gray-200",     bar: "bg-gray-400" },
};

const BREAKDOWN_LABELS: Record<string, { label: string; weight: string }> = {
  recency:   { label: "Recency",   weight: "30%" },
  variety:   { label: "Variety",   weight: "25%" },
  volume:    { label: "Volume",    weight: "25%" },
  resonance: { label: "Resonance", weight: "20%" },
};

function MomentumCard({ data }: { data: MomentumData }) {
  const [expanded, setExpanded] = useState(false);
  const style = MOMENTUM_STYLES[data.label] ?? MOMENTUM_STYLES.Silent;

  return (
    <div className={cn("rounded-3xl border overflow-hidden", style.label)}>
      <button
        className="w-full px-5 py-4 flex items-center justify-between"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-4">
          <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl flex-shrink-0", style.bg)}>
            {data.score}
          </div>
          <div className="text-left">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Momentum Score</p>
            <p className={cn("text-base font-extrabold", style.text)}>{data.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">Tap to see breakdown</p>
          </div>
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="px-5 pb-4 space-y-3 border-t border-gray-100 pt-3">
          {(Object.entries(data.breakdown) as [string, number][]).map(([key, val]) => {
            const info = BREAKDOWN_LABELS[key];
            if (!info) return null;
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-600">{info.label}</span>
                  <span className="text-xs text-gray-400">{val}/100 · {info.weight}</span>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", style.bar)}
                    style={{ width: `${val}%` }}
                  />
                </div>
              </div>
            );
          })}
          <p className="text-[10px] text-gray-400 pt-1">
            Recency · Variety of objectives · Volume of posts · Resonance from performance data
          </p>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: drafts, isLoading: draftsLoading } = useListDrafts();
  const { data: suggestions, isLoading: suggestionsLoading } = useGetSuggestions();
  const [ripeThoughts, setRipeThoughts] = useState<Thought[]>([]);
  const [thoughtsLoading, setThoughtsLoading] = useState(true);
  const [momentum, setMomentum] = useState<MomentumData | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  useEffect(() => {
    thoughtsApi.list().then((all) => {
      const ripe = all.filter((t) => {
        if (t.developed) return false;
        const daysOld = (Date.now() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        return daysOld >= 2;
      }).slice(0, 3);
      setRipeThoughts(ripe);
    }).catch(() => {}).finally(() => setThoughtsLoading(false));

    momentumApi.get().then(setMomentum).catch(() => {});
  }, []);

  const recentDrafts = drafts?.slice(0, 5) ?? [];
  const firstName = user?.displayName ? user.displayName.split(" ")[0] : null;

  const visibleAlerts = momentum?.cadenceAlerts.filter(
    (a) => !dismissedAlerts.has(a.type + (a.objective ?? ""))
  ) ?? [];

  return (
    <div className="min-h-screen bg-[#EDEDEE] flex justify-center">
      <div className="w-full max-w-[430px] bg-gray-50 min-h-screen shadow-2xl flex flex-col border-x border-gray-200 pb-20">
        {/* Header */}
        <header className="px-6 pt-12 pb-6 bg-white border-b border-gray-100 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Brand OS</p>
              <h1 className="text-xl font-extrabold text-gray-900">
                {firstName ? `Hey, ${firstName}` : "Dashboard"}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {momentum && momentum.streak >= 2 && (
                <div className="flex items-center gap-1 bg-orange-50 border border-orange-100 px-2.5 py-1.5 rounded-xl">
                  <Flame className="w-3.5 h-3.5 text-orange-500" />
                  <span className="text-xs font-bold text-orange-600">{momentum.streak}-day streak</span>
                </div>
              )}
              <Link href="/settings" className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
                <Settings className="w-4.5 h-4.5" />
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 px-6 py-6 space-y-7">
          {/* Cadence alerts */}
          {visibleAlerts.length > 0 && (
            <div className="space-y-2">
              {visibleAlerts.map((alert) => {
                const key = alert.type + (alert.objective ?? "");
                return (
                  <div key={key} className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                    <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 font-medium flex-1 leading-relaxed">{alert.message}</p>
                    <button
                      onClick={() => setDismissedAlerts((s) => new Set([...s, key]))}
                      className="text-amber-400 hover:text-amber-600 flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Momentum Score Card */}
          {momentum ? (
            <MomentumCard data={momentum} />
          ) : (
            <Skeleton className="h-20 rounded-3xl" />
          )}

          {/* Capture CTA */}
          <Link href="/capture">
            <div className="bg-primary rounded-3xl p-6 flex items-center justify-between shadow-lg shadow-primary/20 cursor-pointer hover:bg-primary/90 transition-colors group">
              <div>
                <p className="text-primary-foreground/70 text-xs font-bold uppercase tracking-wider mb-1">Start here</p>
                <h2 className="text-xl font-extrabold text-white leading-tight">Capture a new idea</h2>
                <p className="text-primary-foreground/60 text-xs mt-1">Turn a rough thought into polished content</p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                <ArrowRight className="w-6 h-6 text-white" />
              </div>
            </div>
          </Link>

          {/* Ripe Thoughts */}
          {!thoughtsLoading && ripeThoughts.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-bold text-gray-700">Ripe for Developing</h3>
                </div>
                <Link href="/vault" className="text-xs text-primary font-semibold hover:underline">
                  View all
                </Link>
              </div>
              <div className="space-y-2">
                {ripeThoughts.map((thought) => {
                  const daysOld = Math.floor((Date.now() - new Date(thought.createdAt).getTime()) / (1000 * 60 * 60 * 24));
                  const encoded = encodeURIComponent(thought.content);
                  return (
                    <Link key={thought.id} href={`/capture?thought=${encoded}&thoughtId=${thought.id}`}>
                      <div className="bg-white border border-amber-100 rounded-2xl p-4 cursor-pointer hover:border-amber-300 hover:shadow-sm transition-all">
                        <p className="text-sm text-gray-700 leading-relaxed line-clamp-2">{thought.content}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{daysOld}d marinating</span>
                          <span className="text-xs text-primary font-semibold flex items-center gap-1">Develop <ArrowRight className="w-3 h-3" /></span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Suggestions */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-gray-700">Smart Suggestions</h3>
            </div>
            {suggestionsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
              </div>
            ) : (
              <div className="space-y-2">
                {(suggestions ?? []).map((s) => (
                  <Link key={s.id} href="/capture">
                    <div className={cn("bg-white rounded-2xl p-4 border-l-4 border border-gray-100 cursor-pointer hover:shadow-sm transition-shadow", SUGGESTION_ACCENT[s.type] ?? "border-l-primary")}>
                      <p className="text-sm text-gray-700 leading-relaxed">{s.message}</p>
                      <p className="text-xs text-primary font-semibold mt-1.5 flex items-center gap-1">
                        {s.action} <ArrowRight className="w-3 h-3" />
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Recent work */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-bold text-gray-700">Recent Work</h3>
              </div>
              {(drafts?.length ?? 0) > 5 && (
                <Link href="/library" className="text-xs text-primary font-semibold hover:underline">
                  View all
                </Link>
              )}
            </div>

            {draftsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-2xl" />)}
              </div>
            ) : recentDrafts.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 text-center border border-gray-100">
                <Zap className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No drafts yet.</p>
                <p className="text-xs text-gray-400 mt-1">Your saved content will appear here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentDrafts.map((draft) => (
                  <Link key={draft.id} href={`/capture?draftId=${draft.id}`}>
                    <div className="bg-white rounded-2xl px-4 py-3 border border-gray-100 flex items-center gap-3 hover:border-primary/30 transition-colors cursor-pointer">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {(draft.structuredBreakdown as { topic?: string })?.topic ?? "Untitled"}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(draft.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", OBJECTIVE_COLORS[draft.objective] ?? "bg-gray-100 text-gray-600")}>
                          {draft.objective}
                        </span>
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full capitalize", STATUS_COLORS[draft.status] ?? "bg-gray-100 text-gray-600")}>
                          {draft.status}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
