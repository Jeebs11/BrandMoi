import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Settings, ArrowRight, Clock, Flame, ChevronDown, ChevronUp, AlertCircle, X, Zap, Bot, Layers, RefreshCw, Newspaper, Sparkles, GraduationCap, PenLine, Lightbulb, Check, ChevronRight, Brain, Wrench, Plus, ThumbsUp, ThumbsDown, Bookmark, TrendingUp } from "lucide-react";
import { useListDrafts } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { thoughtsApi, momentumApi, agentApi, voiceInsightsApi, resonanceMapApi, type Thought, type MomentumData, type AgentBrief, type AgentTheme, type VoiceSuggestion, type PainPoint, type SkillAngle, type SavedIdea, type TopPostSuggestion } from "@/lib/api";
import { LengthPicker, type PostLength } from "@/components/LengthPicker";
import { useToast } from "@/hooks/use-toast";

function todayKey() {
  return `brand_os_brief_v2_${new Date().toISOString().slice(0, 10)}`;
}

function loadCachedBrief(): AgentBrief | null {
  try {
    const raw = sessionStorage.getItem(todayKey());
    if (!raw) return null;
    return JSON.parse(raw) as AgentBrief;
  } catch { return null; }
}

function saveBriefCache(brief: AgentBrief) {
  try { sessionStorage.setItem(todayKey(), JSON.stringify(brief)); } catch { /* noop */ }
}

function painPointsCacheKey() {
  return `brand_os_pp_v1_${new Date().toISOString().slice(0, 10)}`;
}
function loadCachedPainPoints(): PainPoint[] | null {
  try {
    const raw = sessionStorage.getItem(painPointsCacheKey());
    if (!raw) return null;
    return JSON.parse(raw) as PainPoint[];
  } catch { return null; }
}
function savePainPointsCache(points: PainPoint[]) {
  try { sessionStorage.setItem(painPointsCacheKey(), JSON.stringify(points)); } catch { /* noop */ }
}

function formatNewsAge(publishedAt: string | undefined): string | null {
  if (!publishedAt) return null;
  try {
    const date = new Date(publishedAt);
    if (isNaN(date.getTime())) return null;
    const diffMs = Date.now() - date.getTime();
    if (diffMs < 0) return null;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffHours < 1) return "Published today";
    if (diffHours < 24) return `Published ${diffHours}h ago`;
    if (diffDays === 1) return "Published yesterday";
    return `Published ${diffDays} days ago`;
  } catch { return null; }
}

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
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { data: drafts, isLoading: draftsLoading } = useListDrafts();
  const [ripeThoughts, setRipeThoughts] = useState<Thought[]>([]);
  const [thoughtsLoading, setThoughtsLoading] = useState(true);
  const [momentum, setMomentum] = useState<MomentumData | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [brief, setBrief] = useState<AgentBrief | null>(loadCachedBrief());
  const [briefLoading, setBriefLoading] = useState(!loadCachedBrief());
  const [themes, setThemes] = useState<AgentTheme[]>([]);
  const [themesLoading, setThemesLoading] = useState(true);
  const [newsAngles, setNewsAngles] = useState<string[] | null>(null);
  const [newsAnglesLoading, setNewsAnglesLoading] = useState(false);
  const [expandedNewsAngle, setExpandedNewsAngle] = useState<number | null>(null);
  const [expandedBriefAngle, setExpandedBriefAngle] = useState<number | null>(null);
  const [expandedTeachAngle, setExpandedTeachAngle] = useState<number | null>(null);
  const [lengthPickerOpen, setLengthPickerOpen] = useState(false);
  const [pendingRaw, setPendingRaw] = useState<string>("");
  const [pendingExtra, setPendingExtra] = useState<string>("");
  const [voiceSuggestions, setVoiceSuggestions] = useState<VoiceSuggestion[]>([]);
  const [voiceSuggestionsLoading, setVoiceSuggestionsLoading] = useState(true);
  const [voiceInsightsGenerating, setVoiceInsightsGenerating] = useState(false);
  const [scoredPostCount, setScoredPostCount] = useState<number>(0);
  const [painPoints, setPainPoints] = useState<PainPoint[] | null>(loadCachedPainPoints());
  const [painPointsLoading, setPainPointsLoading] = useState<boolean>(!loadCachedPainPoints());
  const [expandedPainPoint, setExpandedPainPoint] = useState<number | null>(null);
  const [skillInput, setSkillInput] = useState<string>("");
  const [skillAngles, setSkillAngles] = useState<SkillAngle[] | null>(null);
  const [skillAnglesLoading, setSkillAnglesLoading] = useState<boolean>(false);
  const [expandedSkillAngle, setExpandedSkillAngle] = useState<number | null>(null);
  const [ideaFeedback, setIdeaFeedback] = useState<Record<string, "like" | "dislike">>({});
  const [savedIdeas, setSavedIdeas] = useState<SavedIdea[]>([]);
  const [savedIdeasOpen, setSavedIdeasOpen] = useState(false);
  const [topSuggestions, setTopSuggestions] = useState<TopPostSuggestion[] | null>(null);
  const [topSuggestionsLoading, setTopSuggestionsLoading] = useState(true);
  const [expandedTopSuggestion, setExpandedTopSuggestion] = useState<number | null>(null);

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

    const cached = loadCachedBrief();
    if (!cached) {
      agentApi.brief().then((b) => {
        setBrief(b);
        saveBriefCache(b);
      }).catch(() => {}).finally(() => setBriefLoading(false));
    } else {
      setBriefLoading(false);
    }

    agentApi.themes().then((r) => setThemes(r.themes ?? [])).catch(() => {}).finally(() => setThemesLoading(false));

    Promise.all([
      voiceInsightsApi.list().catch(() => [] as VoiceSuggestion[]),
      resonanceMapApi.get().catch(() => ({} as Record<string, number>)),
    ]).then(([suggestions, map]) => {
      const count = Object.keys(map).length;
      setScoredPostCount(count);
      if (suggestions.length > 0) setVoiceSuggestions(suggestions);
    }).finally(() => setVoiceSuggestionsLoading(false));

    const cachedPP = loadCachedPainPoints();
    if (cachedPP) {
      setPainPoints(cachedPP);
      setPainPointsLoading(false);
    } else {
      agentApi.painPoints().then((r) => {
        setPainPoints(r.painPoints);
        savePainPointsCache(r.painPoints);
      }).catch(() => {}).finally(() => setPainPointsLoading(false));
    }

    agentApi.savedIdeas().then((r) => setSavedIdeas(r.ideas)).catch(() => {});

    agentApi.topPostSuggestions()
      .then((r) => setTopSuggestions(r.suggestions.length > 0 ? r.suggestions : null))
      .catch(() => setTopSuggestions(null))
      .finally(() => setTopSuggestionsLoading(false));
  }, []);

  const handleIdeaFeedback = async (ideaText: string, ideaType: "brand" | "teach", signal: "like" | "dislike") => {
    const key = `${ideaType}:${ideaText}`;
    const prev = ideaFeedback[key];
    if (prev === signal) return;
    setIdeaFeedback((f) => ({ ...f, [key]: signal }));
    try {
      await agentApi.ideaFeedback(ideaText, ideaType, signal);
      if (signal === "like") {
        const newIdea: SavedIdea = { id: Date.now(), text: ideaText, type: ideaType, createdAt: new Date().toISOString() };
        setSavedIdeas((prev) => [newIdea, ...prev.filter((i) => i.text !== ideaText)]);
        toast({ title: "Saved to your ideas tray" });
      } else {
        setSavedIdeas((prev) => prev.filter((i) => i.text !== ideaText));
      }
    } catch {
      setIdeaFeedback((f) => { const next = { ...f }; delete next[key]; return next; });
    }
  };

  const handleGenerateSkillAngles = async () => {
    if (!skillInput.trim() || skillAnglesLoading) return;
    setSkillAnglesLoading(true);
    setSkillAngles(null);
    setExpandedSkillAngle(null);
    try {
      const result = await agentApi.skillAngles(skillInput.trim());
      setSkillAngles(result.angles);
    } catch {
      toast({ title: "Couldn't generate angles — try again.", variant: "destructive" });
    } finally {
      setSkillAnglesLoading(false);
    }
  };

  const refreshBrief = () => {
    setBriefLoading(true);
    sessionStorage.removeItem(todayKey());
    agentApi.brief().then((b) => {
      setBrief(b);
      saveBriefCache(b);
    }).catch(() => {}).finally(() => setBriefLoading(false));
  };

  const openLengthPicker = (raw: string, extra = "") => {
    setPendingRaw(raw);
    setPendingExtra(extra);
    setLengthPickerOpen(true);
  };

  const handleLengthSelect = (length: PostLength) => {
    setLengthPickerOpen(false);
    const hasRaw = pendingRaw.trim().length > 0;
    const extraStr = pendingExtra ? "&" + pendingExtra : "";
    const rawStr = `raw=${encodeURIComponent(pendingRaw)}`;
    // If no raw input, start at step 1 so user can enter their idea; preserve length intent
    const step = hasRaw ? 2 : 1;
    const base = `/capture?${rawStr}${extraStr}&length=${length}&step=${step}`;
    navigate(base);
  };

  const handleAcceptSuggestion = async (id: number) => {
    const suggestion = voiceSuggestions.find((s) => s.id === id);
    try {
      await voiceInsightsApi.accept(id);
      setVoiceSuggestions((prev) => prev.filter((s) => s.id !== id));
      toast({ title: suggestion ? `${suggestion.field} updated to "${suggestion.suggestedValue}"` : "Voice setting applied." });
    } catch {
      toast({ title: "Failed to apply suggestion.", variant: "destructive" });
    }
  };

  const handleDismissSuggestion = async (id: number) => {
    try {
      await voiceInsightsApi.dismiss(id);
      setVoiceSuggestions((prev) => prev.filter((s) => s.id !== id));
      toast({ title: "Suggestion dismissed." });
    } catch { /* ignore */ }
  };

  const handleGenerateInsights = async () => {
    setVoiceInsightsGenerating(true);
    try {
      const result = await voiceInsightsApi.generate();
      if (result.status === "insufficient") {
        toast({ title: `Need ${5 - result.count} more performance-logged posts to unlock insights.` });
      } else if (result.suggestions.length === 0) {
        toast({ title: "Your settings already match your top posts — nothing to suggest." });
      } else {
        setVoiceSuggestions(result.suggestions);
        toast({ title: `${result.suggestions.length} insight${result.suggestions.length !== 1 ? "s" : ""} generated.` });
      }
    } catch {
      toast({ title: "Could not generate insights — try again.", variant: "destructive" });
    } finally {
      setVoiceInsightsGenerating(false);
    }
  };

  const recentDrafts = drafts?.slice(0, 5) ?? [];
  const firstName = user?.displayName ? user.displayName.split(" ")[0] : null;

  const visibleAlerts = momentum?.cadenceAlerts.filter(
    (a) => !dismissedAlerts.has(a.type + (a.objective ?? ""))
  ) ?? [];

  return (
    <AppShell>
        {/* Header */}
        <header className="px-6 pt-12 pb-6 bg-white border-b border-gray-100 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">BrandMe</p>
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

          {/* Voice Insights */}
          {!voiceSuggestionsLoading && scoredPostCount >= 1 && scoredPostCount < 5 && (
            <div className="flex items-center gap-3 bg-violet-50 border border-violet-100 rounded-2xl px-4 py-3">
              <Lightbulb className="w-4 h-4 text-violet-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-violet-800">Voice Insights unlocks at 5 posts</p>
                <p className="text-[11px] text-violet-500 mt-0.5">Log performance on {5 - scoredPostCount} more post{5 - scoredPostCount !== 1 ? "s" : ""} to unlock AI-powered brand voice suggestions.</p>
              </div>
            </div>
          )}
          {!voiceSuggestionsLoading && scoredPostCount >= 5 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-violet-500" />
                <h3 className="text-sm font-bold text-gray-700">Voice Insights</h3>
                {voiceSuggestions.length > 0 && (
                  <span className="text-[10px] font-bold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">{voiceSuggestions.length} suggestion{voiceSuggestions.length !== 1 ? "s" : ""}</span>
                )}
              </div>
              {voiceSuggestions.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 px-4 py-5 text-center">
                  <p className="text-xs text-gray-500 mb-3">No suggestions yet.</p>
                  <button
                    onClick={() => void handleGenerateInsights()}
                    disabled={voiceInsightsGenerating}
                    className="flex items-center gap-1.5 mx-auto px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-bold transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {voiceInsightsGenerating ? "Analysing…" : "Analyse my voice"}
                  </button>
                  <p className="text-[10px] text-gray-300 mt-2">Uses AI — limited to a few runs per day</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {voiceSuggestions.map((s) => (
                    <div key={s.id} className="bg-white rounded-2xl border border-violet-100 p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{s.field}</span>
                            <span className="text-[10px] text-gray-400 line-through truncate max-w-[80px]">{s.currentValue || "not set"}</span>
                            <ChevronRight className="w-3 h-3 text-violet-400 flex-shrink-0" />
                            <span className="text-[10px] font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full truncate max-w-[120px]">{s.suggestedValue}</span>
                          </div>
                          <p className="text-xs text-gray-600 leading-relaxed">{s.rationale}</p>
                          {Array.isArray(s.evidenceSnippets) && s.evidenceSnippets.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {(s.evidenceSnippets as string[]).slice(0, 2).map((snippet, i) => (
                                <p key={i} className="text-[10px] text-gray-400 italic leading-snug border-l-2 border-violet-200 pl-2">&ldquo;{snippet}&rdquo;</p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => void handleAcceptSuggestion(s.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-colors"
                        >
                          <Check className="w-3 h-3" /> Apply
                        </button>
                        <button
                          onClick={() => void handleDismissSuggestion(s.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold transition-colors"
                        >
                          <X className="w-3 h-3" /> Dismiss
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Agent Brief */}
          {briefLoading ? (
            <div className="rounded-3xl overflow-hidden bg-gray-900 p-5 space-y-3">
              <Skeleton className="h-3 w-20 bg-white/10 rounded-full" />
              <Skeleton className="h-5 w-full bg-white/10 rounded-full" />
              <Skeleton className="h-4 w-4/5 bg-white/10 rounded-full" />
              <div className="flex gap-2 pt-1">
                <Skeleton className="h-7 flex-1 bg-white/10 rounded-full" />
                <Skeleton className="h-7 flex-1 bg-white/10 rounded-full" />
                <Skeleton className="h-7 flex-1 bg-white/10 rounded-full" />
              </div>
            </div>
          ) : brief ? (
            <div className="rounded-3xl overflow-hidden bg-gray-900 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Today's Brief</span>
                </div>
                <button onClick={refreshBrief} className="text-white/30 hover:text-white/60 transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* News signal — shown when a real news article was found */}
              {brief.newsHeadline && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-3 py-2.5 mb-3">
                  <div className="flex items-start gap-2">
                    <Newspaper className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      {/* Header row: label + freshness badge */}
                      {(() => {
                        const ageLabel = formatNewsAge(brief.newsPublishedAt);
                        return (
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">In the news</p>
                            {ageLabel && (
                              <span className="text-[10px] font-semibold text-emerald-300/80 bg-emerald-500/15 px-1.5 py-0.5 rounded-full">
                                {ageLabel}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                      <p className="text-white/80 text-xs font-medium leading-snug">{brief.newsHeadline}</p>
                      {/* Source domain + source line */}
                      {(brief.newsSourceDomain || brief.newsSourceLine) && (
                        <div className="mt-1 space-y-0.5">
                          {brief.newsSourceDomain && (
                            <p className="text-emerald-400/60 text-[10px] font-semibold uppercase tracking-wider">
                              via {brief.newsSourceDomain}
                            </p>
                          )}
                          {brief.newsSourceLine && (
                            <p className="text-white/40 text-[11px] leading-snug italic">{brief.newsSourceLine}</p>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {brief.newsUrl && (
                          <a
                            href={brief.newsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-emerald-400/70 hover:text-emerald-300 transition-colors underline underline-offset-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View source →
                          </a>
                        )}
                        {!newsAngles && (
                          <button
                            onClick={() => {
                              if (newsAnglesLoading || !brief.newsHeadline) return;
                              setNewsAnglesLoading(true);
                              agentApi.newsAngles({
                                newsHeadline: brief.newsHeadline!,
                                newsSourceLine: brief.newsSourceLine,
                                newsUrl: brief.newsUrl,
                                newsDescription: brief.newsDescription,
                              }).then((r) => setNewsAngles(r.angles))
                                .catch(() => {})
                                .finally(() => setNewsAnglesLoading(false));
                            }}
                            disabled={newsAnglesLoading}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 hover:text-emerald-200 transition-colors disabled:opacity-50"
                          >
                            {newsAnglesLoading ? (
                              <><span className="w-2.5 h-2.5 rounded-full border border-emerald-400/60 border-t-transparent animate-spin inline-block" /> Generating…</>
                            ) : (
                              <>✦ Create post angles</>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Generated news angles */}
                  {newsAngles && newsAngles.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-emerald-500/15">
                      <p className="text-[10px] font-bold text-emerald-400/70 uppercase tracking-wider mb-2">Post angles from this news</p>
                      <div className="flex flex-col gap-1.5">
                        {newsAngles.map((angle, i) => {
                          const enrichedRaw = [
                            angle,
                            "",
                            `News reference: ${brief.newsHeadline}`,
                            brief.newsSourceLine ?? "",
                          ].filter(Boolean).join("\n");
                          const newsUrlParam = brief.newsUrl ? `&newsUrl=${encodeURIComponent(brief.newsUrl)}` : "";
                          const isOpen = expandedNewsAngle === i;
                          return (
                            <div key={i} className="rounded-xl border border-emerald-500/15 overflow-hidden">
                              <button
                                onClick={() => setExpandedNewsAngle(isOpen ? null : i)}
                                className="w-full text-left flex items-start justify-between gap-2 bg-emerald-500/10 hover:bg-emerald-500/15 px-3 py-2.5 transition-colors"
                              >
                                <span className={cn("text-white/80 text-xs font-medium leading-snug flex-1", !isOpen && "line-clamp-1")}>
                                  {angle}
                                </span>
                                <ChevronDown className={cn("w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5 transition-transform duration-200", isOpen && "rotate-180")} />
                              </button>
                              {isOpen && (
                                <div className="px-3 pb-3 pt-2.5 bg-emerald-500/5 border-t border-emerald-500/10">
                                  <button
                                    onClick={() => {
                                      const extra = brief.newsUrl ? `newsUrl=${encodeURIComponent(brief.newsUrl)}` : "";
                                      openLengthPicker(enrichedRaw, extra);
                                    }}
                                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold transition-colors"
                                  >
                                    Write this →
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <button
                          onClick={() => { setNewsAngles(null); setExpandedNewsAngle(null); }}
                          className="w-full flex items-center justify-center gap-1.5 mt-1 py-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/15 text-emerald-400 hover:text-emerald-300 text-xs font-semibold transition-colors"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Regenerate angles
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <p className="text-white font-extrabold text-base leading-snug mb-1">{brief.headline}</p>
              <p className="text-white/50 text-xs leading-relaxed">{brief.insight}</p>
            </div>
          ) : null}

          {/* Write your own — prominent primary CTA (above suggestion pillars) */}
          <button
            onClick={() => openLengthPicker("", "")}
            className="w-full bg-primary rounded-3xl p-5 flex items-center justify-between shadow-lg shadow-primary/20 cursor-pointer hover:bg-primary/90 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                <PenLine className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <p className="text-primary-foreground/70 text-[10px] font-bold uppercase tracking-wider mb-0.5">Your idea</p>
                <h2 className="text-base font-extrabold text-white leading-tight">Write your own post</h2>
              </div>
            </div>
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
              <ArrowRight className="w-5 h-5 text-white" />
            </div>
          </button>

          {/* Brand voice post ideas — separate card */}
          {brief && brief.angles.length > 0 && (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Post ideas for your brand</span>
                </div>
                <p className="text-[10px] text-gray-400 font-medium">From your voice & gaps</p>
              </div>
              <div className="px-5 pb-5 flex flex-col gap-1.5">
                {brief.angles.map((angle, i) => {
                  const isOpen = expandedBriefAngle === i;
                  const fbKey = `brand:${angle}`;
                  const fb = ideaFeedback[fbKey];
                  return (
                    <div key={i} className="rounded-xl border border-gray-100 overflow-hidden">
                      <div className="flex items-center gap-1 bg-gray-50 hover:bg-gray-100 transition-colors">
                        <button
                          onClick={() => setExpandedBriefAngle(isOpen ? null : i)}
                          className="flex-1 text-left flex items-start justify-between gap-2 px-3 py-2.5"
                        >
                          <span className={cn("text-gray-800 text-xs font-medium leading-snug flex-1", !isOpen && "line-clamp-1")}>
                            {angle}
                          </span>
                          <ChevronDown className={cn("w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5 transition-transform duration-200", isOpen && "rotate-180")} />
                        </button>
                        <div className="flex items-center gap-0.5 pr-2 flex-shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); void handleIdeaFeedback(angle, "brand", "like"); }}
                            className={cn("w-6 h-6 flex items-center justify-center rounded-lg transition-colors", fb === "like" ? "text-emerald-600 bg-emerald-50" : "text-gray-300 hover:text-emerald-500 hover:bg-emerald-50")}
                          >
                            <ThumbsUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); void handleIdeaFeedback(angle, "brand", "dislike"); }}
                            className={cn("w-6 h-6 flex items-center justify-center rounded-lg transition-colors", fb === "dislike" ? "text-rose-500 bg-rose-50" : "text-gray-300 hover:text-rose-400 hover:bg-rose-50")}
                          >
                            <ThumbsDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      {isOpen && (
                        <div className="px-3 pb-3 pt-2.5 bg-white border-t border-gray-100">
                          <button
                            onClick={() => openLengthPicker(angle)}
                            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-primary hover:bg-primary/80 text-white text-xs font-bold transition-colors"
                          >
                            Write this →
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Teach your audience pillar */}
          {brief && brief.teachAngles && brief.teachAngles.length > 0 && (
            <div className="bg-white rounded-3xl border border-indigo-100 shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Teach your audience</span>
                </div>
                <p className="text-[10px] text-gray-400 font-medium">Analogy &amp; FAQ ideas</p>
              </div>
              <div className="px-5 pb-5 flex flex-col gap-1.5">
                {brief.teachAngles.map((angle, i) => {
                  const isOpen = expandedTeachAngle === i;
                  const fbKey = `teach:${angle}`;
                  const fb = ideaFeedback[fbKey];
                  return (
                    <div key={i} className="rounded-xl border border-indigo-100 overflow-hidden">
                      <div className="flex items-center gap-1 bg-indigo-50/60 hover:bg-indigo-100/60 transition-colors">
                        <button
                          onClick={() => setExpandedTeachAngle(isOpen ? null : i)}
                          className="flex-1 text-left flex items-start justify-between gap-2 px-3 py-2.5"
                        >
                          <span className={cn("text-gray-800 text-xs font-medium leading-snug flex-1", !isOpen && "line-clamp-1")}>
                            {angle}
                          </span>
                          <ChevronDown className={cn("w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5 transition-transform duration-200", isOpen && "rotate-180")} />
                        </button>
                        <div className="flex items-center gap-0.5 pr-2 flex-shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); void handleIdeaFeedback(angle, "teach", "like"); }}
                            className={cn("w-6 h-6 flex items-center justify-center rounded-lg transition-colors", fb === "like" ? "text-emerald-600 bg-emerald-50" : "text-gray-300 hover:text-emerald-500 hover:bg-emerald-50")}
                          >
                            <ThumbsUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); void handleIdeaFeedback(angle, "teach", "dislike"); }}
                            className={cn("w-6 h-6 flex items-center justify-center rounded-lg transition-colors", fb === "dislike" ? "text-rose-500 bg-rose-50" : "text-gray-300 hover:text-rose-400 hover:bg-rose-50")}
                          >
                            <ThumbsDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      {isOpen && (
                        <div className="px-3 pb-3 pt-2.5 bg-white border-t border-indigo-100">
                          <button
                            onClick={() => openLengthPicker(angle, "teacherMode=true")}
                            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors"
                          >
                            Write this →
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Saved Ideas tray */}
          {savedIdeas.length > 0 && (
            <div className="bg-white rounded-3xl border border-emerald-100 shadow-sm overflow-hidden">
              <button
                onClick={() => setSavedIdeasOpen((v) => !v)}
                className="w-full px-5 pt-5 pb-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-1.5">
                  <Bookmark className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Saved Ideas</span>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">{savedIdeas.length}</span>
                </div>
                <ChevronDown className={cn("w-3.5 h-3.5 text-gray-400 transition-transform duration-200", savedIdeasOpen && "rotate-180")} />
              </button>
              {savedIdeasOpen && (
                <div className="px-5 pb-5 flex flex-col gap-1.5 border-t border-emerald-50 pt-3">
                  {savedIdeas.map((idea) => (
                    <div key={idea.id} className="rounded-xl border border-emerald-100 overflow-hidden">
                      <div className="flex items-center gap-2 bg-emerald-50/50 px-3 py-2.5">
                        <span className="flex-1 text-gray-800 text-xs font-medium leading-snug">{idea.text}</span>
                        <button
                          onClick={() => openLengthPicker(idea.text, idea.type === "teach" ? "teacherMode=true" : "")}
                          className="flex-shrink-0 text-[10px] font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2 py-1 rounded-lg transition-colors whitespace-nowrap"
                        >
                          Write →
                        </button>
                        <button
                          onClick={() => {
                            setSavedIdeas((prev) => prev.filter((i) => i.id !== idea.id));
                            agentApi.deleteSavedIdea(idea.id).catch(() => {
                              setSavedIdeas((prev) => [idea, ...prev]);
                            });
                          }}
                          className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                          title="Remove idea"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Top Post Suggestions */}
          {topSuggestionsLoading ? (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-orange-500" />
                <h3 className="text-sm font-bold text-gray-700">From Your Best Posts</h3>
              </div>
              <div className="space-y-2">
                {[1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-2xl" />)}
              </div>
            </section>
          ) : topSuggestions && topSuggestions.length > 0 ? (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-orange-500" />
                <h3 className="text-sm font-bold text-gray-700">From Your Best Posts</h3>
                <span className="text-[10px] font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full">Fresh angles</span>
              </div>
              <div className="bg-white rounded-3xl border border-orange-100 shadow-sm overflow-hidden">
                <div className="px-5 pt-5 pb-3">
                  <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">Your top performers, reimagined</p>
                </div>
                <div className="px-5 pb-5 flex flex-col gap-3">
                  {topSuggestions.map((s, i) => {
                    const isOpen = expandedTopSuggestion === i;
                    return (
                      <div key={i} className="rounded-xl border border-orange-100 overflow-hidden">
                        <button
                          onClick={() => setExpandedTopSuggestion(isOpen ? null : i)}
                          className="w-full text-left flex items-start justify-between gap-2 bg-orange-50/50 hover:bg-orange-50 px-3 py-2.5 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-900 text-xs font-bold leading-snug">{s.originalTopic}</p>
                            {!isOpen && <p className="text-gray-500 text-[11px] mt-0.5 line-clamp-1">{s.why}</p>}
                          </div>
                          <ChevronDown className={cn("w-3.5 h-3.5 text-orange-400 flex-shrink-0 mt-0.5 transition-transform duration-200", isOpen && "rotate-180")} />
                        </button>
                        {isOpen && (
                          <div className="px-3 pb-3 pt-2 bg-white border-t border-orange-100 space-y-2.5">
                            <div className="bg-orange-50 rounded-lg px-2.5 py-2">
                              <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wide mb-0.5">Why it performed</p>
                              <p className="text-xs text-gray-700">{s.why}</p>
                            </div>
                            <div className="flex flex-col gap-1.5">
                              {s.angles.map((a, j) => (
                                <div key={j} className="rounded-lg border border-orange-100 overflow-hidden">
                                  <div className="flex items-center gap-2 bg-orange-50/40 px-2.5 py-2">
                                    <span className="text-[10px] font-bold text-orange-500 uppercase tracking-wide flex-shrink-0">{a.label}</span>
                                    <p className="flex-1 text-xs text-gray-700 leading-snug">{a.angle}</p>
                                    <button
                                      onClick={() => openLengthPicker(a.angle)}
                                      className="flex-shrink-0 text-[10px] font-bold text-orange-700 bg-orange-100 hover:bg-orange-200 px-2 py-1 rounded-lg transition-colors whitespace-nowrap"
                                    >
                                      Write →
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          ) : null}

          {/* Pain Point Map */}
          {painPointsLoading ? (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Brain className="w-4 h-4 text-rose-500" />
                <h3 className="text-sm font-bold text-gray-700">Audience Pain Points</h3>
              </div>
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 rounded-2xl" />)}
              </div>
            </section>
          ) : painPoints && painPoints.length > 0 ? (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Brain className="w-4 h-4 text-rose-500" />
                <h3 className="text-sm font-bold text-gray-700">Audience Pain Points</h3>
                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">What they struggle with</span>
              </div>
              <div className="bg-white rounded-3xl border border-rose-100 shadow-sm overflow-hidden">
                <div className="px-5 pt-5 pb-3">
                  <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Write about what hurts</p>
                </div>
                <div className="px-5 pb-5 flex flex-col gap-1.5">
                  {painPoints.map((pp, i) => {
                    const isOpen = expandedPainPoint === i;
                    return (
                      <div key={i} className="rounded-xl border border-rose-100 overflow-hidden">
                        <button
                          onClick={() => setExpandedPainPoint(isOpen ? null : i)}
                          className="w-full text-left flex items-start justify-between gap-2 bg-rose-50/60 hover:bg-rose-100/60 px-3 py-2.5 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-900 text-xs font-bold leading-snug">{pp.title}</p>
                            {!isOpen && (
                              <p className="text-gray-500 text-[11px] mt-0.5 line-clamp-1">{pp.description}</p>
                            )}
                          </div>
                          <ChevronDown className={cn("w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5 transition-transform duration-200", isOpen && "rotate-180")} />
                        </button>
                        {isOpen && (
                          <div className="px-3 pb-3 pt-2 bg-white border-t border-rose-100 space-y-2.5">
                            <p className="text-xs text-gray-600 leading-relaxed">{pp.description}</p>
                            <div className="bg-rose-50 rounded-lg px-2.5 py-2">
                              <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wide mb-0.5">Post angle</p>
                              <p className="text-xs text-gray-700 font-medium">{pp.angle}</p>
                            </div>
                            <button
                              onClick={() => openLengthPicker(pp.angle)}
                              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors"
                            >
                              Write about this →
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          ) : null}

          {/* Skills Workshop */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-gray-700">Skills Workshop</h3>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">Turn a skill into post angles</span>
            </div>
            <div className="bg-white rounded-3xl border border-amber-100 shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-4">
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-3">What skill do you want to post about?</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void handleGenerateSkillAngles()}
                    placeholder="e.g. Negotiation, Data storytelling, Cold outreach…"
                    className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 focus:border-amber-400 focus:outline-none text-sm"
                  />
                  <button
                    onClick={() => void handleGenerateSkillAngles()}
                    disabled={skillAnglesLoading || !skillInput.trim()}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white text-xs font-bold transition-colors whitespace-nowrap"
                  >
                    {skillAnglesLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    {skillAnglesLoading ? "Generating…" : "Generate"}
                  </button>
                </div>
              </div>
              {skillAngles && skillAngles.length > 0 && (
                <div className="px-5 pb-5 flex flex-col gap-1.5 border-t border-amber-100 pt-4">
                  {skillAngles.map((sa, i) => {
                    const isOpen = expandedSkillAngle === i;
                    const labels = ["Personal story", "Contrarian take", "Tactical how-to"];
                    return (
                      <div key={i} className="rounded-xl border border-amber-100 overflow-hidden">
                        <button
                          onClick={() => setExpandedSkillAngle(isOpen ? null : i)}
                          className="w-full text-left flex items-start justify-between gap-2 bg-amber-50/60 hover:bg-amber-100/60 px-3 py-2.5 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wide">{labels[i] ?? `Angle ${i + 1}`}</span>
                            <p className={cn("text-gray-800 text-xs font-medium leading-snug mt-0.5", !isOpen && "line-clamp-1")}>{sa.angle}</p>
                          </div>
                          <ChevronDown className={cn("w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-1 transition-transform duration-200", isOpen && "rotate-180")} />
                        </button>
                        {isOpen && (
                          <div className="px-3 pb-3 pt-2 bg-white border-t border-amber-100 space-y-2.5">
                            <div className="bg-amber-50 rounded-lg px-2.5 py-2">
                              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide mb-0.5">Opening hook</p>
                              <p className="text-xs text-gray-700 font-medium italic">"{sa.hook}"</p>
                            </div>
                            <button
                              onClick={() => openLengthPicker(sa.angle, `extraInstruction=${encodeURIComponent(`Open with: "${sa.hook}"`)}`)}
                              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold transition-colors"
                            >
                              Use this angle →
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

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

          {/* Theme Radar */}
          {themesLoading ? (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-gray-700">Content Threads</h3>
              </div>
              <div className="space-y-2">
                {[1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
              </div>
            </section>
          ) : themes.length > 0 ? (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-gray-700">Content Threads</h3>
              </div>
              <div className="space-y-2">
                {themes.map((theme, i) => (
                  <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-bold text-gray-800">{theme.name}</p>
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full flex-shrink-0">
                        {theme.postCount} posts
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed mb-3">{theme.pattern}</p>
                    <button
                      onClick={() => navigate(`/capture?raw=${encodeURIComponent(theme.seriesIdea)}`)}
                      className="text-xs text-primary font-semibold flex items-center gap-1 hover:gap-2 transition-all"
                    >
                      Start series: {theme.seriesIdea} <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

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
                      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", OBJECTIVE_COLORS[draft.objective] ?? "bg-gray-100 text-gray-600")}>
                          {draft.objective}
                        </span>
                        {draft.shortPost && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            ⚡ Short
                          </span>
                        )}
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

        <LengthPicker
          open={lengthPickerOpen}
          onClose={() => setLengthPickerOpen(false)}
          onSelect={handleLengthSelect}
          title={pendingRaw ? "How long should this be?" : "Choose post length"}
        />
    </AppShell>
  );
}
