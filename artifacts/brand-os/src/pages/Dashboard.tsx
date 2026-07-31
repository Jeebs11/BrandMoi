import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Settings, ArrowRight, Clock, Flame, ChevronDown, X, Zap, Bot, Layers, RefreshCw, Newspaper, Sparkles, GraduationCap, PenLine, Lightbulb, Check, ChevronRight, Brain, Wrench, Plus, ThumbsUp, ThumbsDown, Bookmark, TrendingUp, Loader2 } from "lucide-react";
import { useListDrafts } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AppShell } from "@/components/AppShell";
import { InfoTooltip } from "@/components/InfoTooltip";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { thoughtsApi, momentumApi, agentApi, voiceInsightsApi, resonanceMapApi, checkinsApi, type Thought, type MomentumData, type AgentBrief, type AgentTheme, type VoiceSuggestion, type PainPoint, type SkillAngle, type SavedIdea, type TopPostSuggestion, type DareResult, type CheckinEntry, type BrandAngle } from "@/lib/api";
import { LengthPicker, type PostLength } from "@/components/LengthPicker";
import { useToast } from "@/hooks/use-toast";

function dayUserKey(name: string, userId: number | string) {
  return `bos_${name}_v3_${userId}_${new Date().toISOString().slice(0, 10)}`;
}

function loadDayCache<T>(name: string, userId: number | string): T | null {
  try {
    const raw = localStorage.getItem(dayUserKey(name, userId));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch { return null; }
}

function saveDayCache(name: string, userId: number | string, value: unknown) {
  try { localStorage.setItem(dayUserKey(name, userId), JSON.stringify(value)); } catch { /* noop */ }
}

function clearDayCache(name: string, userId: number | string) {
  try { localStorage.removeItem(dayUserKey(name, userId)); } catch { /* noop */ }
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

// Small tag on each "For your brand" idea showing which audience it targets
// — restructures suggestions by audience without adding a new top-level tab.
const AUDIENCE_TAG_COLORS: Record<string, string> = {
  "Clients": "bg-amber-50 text-amber-700",
  "Peers": "bg-violet-50 text-violet-700",
  "Recruiters & Headhunters": "bg-sky-50 text-sky-700",
  "Investors": "bg-emerald-50 text-emerald-700",
  "My audience": "bg-gray-100 text-gray-500",
};


const WEEK_STREAK_LINES = (weekStreak: number): string => {
  if (weekStreak === 0) return "Post once this week to start the wall.";
  if (weekStreak === 1) return "1-week streak — lay the next brick.";
  if (weekStreak < 6) return `${weekStreak}-week streak — the wall is holding.`;
  return `Full wall — ${weekStreak} weeks strong.`;
};

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

// Compact 7-day tracker for the current week: filled = posted that day,
// dashed outline = today (not yet posted), plain outline = future/past-empty.
function WeekDayTracker({ days }: { days: boolean[] }) {
  const todayIdx = (new Date().getDay() + 6) % 7; // 0=Mon .. 6=Sun
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      {days.map((posted, i) => (
        <div
          key={i}
          className={cn(
            "w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold flex-shrink-0",
            posted
              ? "bg-emerald-400 text-emerald-950"
              : i === todayIdx
                ? "border border-dashed border-white/40 text-white/50"
                : "bg-white/10 text-white/25"
          )}
        >
          {posted ? <Check className="w-3 h-3" /> : DAY_LABELS[i]}
        </div>
      ))}
    </div>
  );
}

// The "wall": one brick per past week, oldest to newest. A week with no
// posts cracks/greys out — a gap shows exactly where momentum broke instead
// of an abstract score.
function MomentumWall({ weeklyWall }: { weeklyWall: MomentumData["weeklyWall"] }) {
  return (
    <div className="flex items-stretch gap-1.5">
      {weeklyWall.map((w, i) => (
        <div
          key={w.weekStart}
          className={cn(
            "flex-1 h-9 rounded-lg flex items-center justify-center transition-colors",
            w.posted
              ? "bg-gradient-to-br from-violet-500 to-fuchsia-500"
              : "bg-gray-100 border border-dashed border-gray-300"
          )}
          title={w.weekStart}
        >
          {!w.posted && <span className="text-gray-300 text-xs leading-none">×</span>}
          {i === weeklyWall.length - 1 && <span className="sr-only">This week</span>}
        </div>
      ))}
    </div>
  );
}

// Dare mode: one provocative-but-defensible take with a 24h post-it-or-lose-it
// timer. The dare persists in localStorage so the countdown survives reloads;
// the API call happens only when the user explicitly asks to be dared (3/day).
const DARE_STORAGE_KEY = "brandos-dare";

function DareCard({ onWrite }: { onWrite: (raw: string) => void }) {
  const { toast } = useToast();
  const [dare, setDare] = useState<DareResult | null>(() => {
    try {
      const raw = localStorage.getItem(DARE_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as DareResult;
      return new Date(parsed.expiresAt).getTime() > Date.now() ? parsed : null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());
  // Active dares render as a slim strip until tapped — keeps the page calm.
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!dare) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [dare]);

  const msLeft = dare ? new Date(dare.expiresAt).getTime() - now : 0;
  const expired = dare !== null && msLeft <= 0;

  useEffect(() => {
    if (expired) {
      localStorage.removeItem(DARE_STORAGE_KEY);
      setDare(null);
      toast({ title: "The dare expired. The algorithm wins this round. 😏" });
    }
  }, [expired]); // eslint-disable-line react-hooks/exhaustive-deps

  const requestDare = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const d = await agentApi.dare();
      localStorage.setItem(DARE_STORAGE_KEY, JSON.stringify(d));
      setDare(d);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Couldn't fetch a dare — try again.";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const hh = Math.floor(msLeft / 3600000);
  const mm = Math.floor((msLeft % 3600000) / 60000);
  const ss = Math.floor((msLeft % 60000) / 1000);
  const riskColor = dare?.risk === "Spicy" ? "text-red-500 bg-red-50 border-red-100"
    : dare?.risk === "Medium" ? "text-orange-500 bg-orange-50 border-orange-100"
    : "text-yellow-600 bg-yellow-50 border-yellow-100";

  return (
    <div className="rounded-3xl border border-red-100 bg-white overflow-hidden">
      {!dare ? (
        <button
          onClick={requestDare}
          disabled={loading}
          className="w-full px-5 py-4 flex items-center justify-between group"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-base">😈</span>
            <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Dare mode</span>
            <span className="text-[10px] text-gray-400 font-medium hidden sm:inline">· The take you've been avoiding</span>
          </div>
          {loading
            ? <Loader2 className="w-4 h-4 text-red-400 animate-spin" />
            : <span className="text-xs font-bold text-red-400 group-hover:text-red-600 transition-colors">Give me a bold take →</span>}
        </button>
      ) : !expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="w-full px-5 py-3 flex items-center gap-2.5 text-left hover:bg-red-50/40 transition-colors"
        >
          <span className="text-sm flex-shrink-0">😈</span>
          <span className="flex-1 text-xs font-bold text-gray-800 truncate">“{dare.dare}”</span>
          <span className="text-[11px] font-mono font-bold text-red-500 tabular-nums flex-shrink-0">
            {String(hh).padStart(2, "0")}:{String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-red-300 flex-shrink-0" />
        </button>
      ) : (
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(false)}>
            <div className="flex items-center gap-1.5">
              <span className="text-base">😈</span>
              <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Dare mode</span>
              <span className={cn("text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full border", riskColor)}>{dare.risk}</span>
            </div>
            <span className="text-xs font-mono font-bold text-red-500 tabular-nums">
              {String(hh).padStart(2, "0")}:{String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
            </span>
          </div>
          <p className="text-sm font-bold text-gray-900 leading-snug">“{dare.dare}”</p>
          {dare.why && <p className="text-[11px] text-gray-400 leading-relaxed italic">{dare.why}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => { localStorage.removeItem(DARE_STORAGE_KEY); setDare(null); }}
              className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-400 text-xs font-bold hover:border-gray-300 transition-colors"
            >
              Chicken out
            </button>
            <button
              onClick={() => onWrite(dare.dare)}
              className="flex-[2] py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white text-xs font-bold transition-colors"
            >
              Post it or lose it →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MomentumCard({ data }: { data: MomentumData }) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white overflow-hidden px-5 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
          <InfoTooltip content="Each brick is one week — filled if you posted at least once that week, cracked if you didn't. A run of filled bricks is your streak.">
            This week
          </InfoTooltip>
        </p>
        <p className="text-xs text-gray-400">{data.currentWeekDays.filter(Boolean).length} of 7 days</p>
      </div>
      <WeekDayTracker days={data.currentWeekDays} />
      <div className="border-t border-gray-100 pt-3">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Last 6 weeks</p>
          <p className="text-xs font-bold text-violet-600">{data.weekStreak}-week streak</p>
        </div>
        <MomentumWall weeklyWall={data.weeklyWall} />
      </div>
    </div>
  );
}

// Profile completeness nudge: these four fields are the ones actually
// injected into every generation prompt (voice context, audience overlay,
// belief framing) — an incomplete profile means generically-voiced output,
// not a cosmetic gap. Disappears entirely once all four are filled in.
type ProfileFields = { brandRole?: string; brandAudience?: string; brandBelief?: string; aboutMe?: string };

function ProfileStrengthCard({ preferences, onComplete }: { preferences: ProfileFields | undefined; onComplete: () => void }) {
  if (!preferences) return null;
  const fields: Array<{ key: keyof ProfileFields; label: string }> = [
    { key: "brandRole", label: "your role" },
    { key: "brandAudience", label: "your audience" },
    { key: "brandBelief", label: "your core belief" },
    { key: "aboutMe", label: "a short bio" },
  ];
  const missing = fields.filter((f) => !preferences[f.key]?.trim());
  if (missing.length === 0) return null;
  const pct = Math.round(((fields.length - missing.length) / fields.length) * 100);

  return (
    <button
      onClick={onComplete}
      className="w-full rounded-3xl border border-violet-100 bg-violet-50/60 px-5 py-3.5 flex items-center gap-3 text-left hover:bg-violet-50 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-bold text-violet-500 uppercase tracking-widest">Profile strength</p>
          <p className="text-[10px] font-bold text-violet-600 tabular-nums">{pct}%</p>
        </div>
        <div className="h-1.5 bg-violet-100 rounded-full overflow-hidden mb-1.5">
          <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-gray-600">
          Add <span className="font-bold text-gray-800">{missing[0]!.label}</span> — every post is written using this, so filling it in sharpens what you get.
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-violet-400 flex-shrink-0" />
    </button>
  );
}

export default function Dashboard() {
  const { user, preferences } = useAuth();
  const uid = user?.id ?? "anon";
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { data: drafts, isLoading: draftsLoading } = useListDrafts();
  const [ripeThoughts, setRipeThoughts] = useState<Thought[]>([]);
  const [thoughtsLoading, setThoughtsLoading] = useState(true);
  const [momentum, setMomentum] = useState<MomentumData | null>(null);
  const [checkins, setCheckins] = useState<CheckinEntry[]>([]);
  const [momOpen, setMomOpen] = useState(false);
  const [ideaTab, setIdeaTab] = useState<"brand" | "teach" | "best" | "pain" | "skills">("brand");
  // Per-tab refreshed angles override the daily brief's set — so refreshing
  // one tab never re-runs the whole brief (or its news fetch).
  const [brandAnglesOverride, setBrandAnglesOverride] = useState<BrandAngle[] | null>(null);
  const [teachAnglesOverride, setTeachAnglesOverride] = useState<string[] | null>(null);
  const [tabRefreshing, setTabRefreshing] = useState(false);
  const [brief, setBrief] = useState<AgentBrief | null>(() => loadDayCache<AgentBrief>("brief", user?.id ?? "anon"));
  const [briefLoading, setBriefLoading] = useState(() => !loadDayCache<AgentBrief>("brief", user?.id ?? "anon"));
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
  const [painPoints, setPainPoints] = useState<PainPoint[] | null>(() => loadDayCache<PainPoint[]>("pain", user?.id ?? "anon"));
  const [painPointsLoading, setPainPointsLoading] = useState<boolean>(false);
  const [expandedPainPoint, setExpandedPainPoint] = useState<number | null>(null);
  const [skillInput, setSkillInput] = useState<string>("");
  const [skillAngles, setSkillAngles] = useState<SkillAngle[] | null>(null);
  const [skillAnglesLoading, setSkillAnglesLoading] = useState<boolean>(false);
  const [expandedSkillAngle, setExpandedSkillAngle] = useState<number | null>(null);
  const [ideaFeedback, setIdeaFeedback] = useState<Record<string, "like" | "dislike">>({});
  const [savedIdeas, setSavedIdeas] = useState<SavedIdea[]>([]);
  const [savedIdeasOpen, setSavedIdeasOpen] = useState(false);
  const [topSuggestions, setTopSuggestions] = useState<TopPostSuggestion[] | null>(() => loadDayCache<TopPostSuggestion[]>("top", user?.id ?? "anon"));
  const [topSuggestionsLoading, setTopSuggestionsLoading] = useState(false);
  const [expandedTopSuggestion, setExpandedTopSuggestion] = useState<number | null>(null);

  // Section open/collapsed state — all collapsed by default
  const [briefOpen, setBriefOpen] = useState(false);
  const [postIdeasOpen, setPostIdeasOpen] = useState(false);
  const [teachOpen, setTeachOpen] = useState(false);
  const [topPostsOpen, setTopPostsOpen] = useState(false);
  const [painPointsOpen, setPainPointsOpen] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [threadsOpen, setThreadsOpen] = useState(false);
  const [ripeOpen, setRipeOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [seriesNudgeDismissed, setSeriesNudgeDismissed] = useState(false);

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

    checkinsApi.list().then((r) => setCheckins(r.checkins)).catch(() => {});

    const cached = loadDayCache<AgentBrief>("brief", uid);
    if (!cached) {
      agentApi.brief().then((b) => {
        setBrief(b);
        saveDayCache("brief", uid, b);
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

    agentApi.savedIdeas().then((r) => setSavedIdeas(r.ideas)).catch(() => {});

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

  const refreshTopPosts = () => {
    setTopSuggestionsLoading(true);
    setTopSuggestions(null);
    setExpandedTopSuggestion(null);
    agentApi.topPostSuggestions()
      .then((r) => { const v = r.suggestions.length > 0 ? r.suggestions : []; setTopSuggestions(v); saveDayCache("top", uid, v); })
      .catch((err: unknown) => { setTopSuggestions(null); aiErrorToast(err); })
      .finally(() => setTopSuggestionsLoading(false));
  };

  // Surfaces the server's actual error message instead of a flat generic
  // string — /agent/* routes already send a specific reason ("Invalid AI
  // response", "Failed to generate ideas", a rate-limit message, etc.) via
  // apiFetch's thrown Error, so show that directly rather than discarding it.
  const aiErrorToast = (err: unknown) => {
    console.error(err);
    const msg = err instanceof Error && err.message ? err.message : "Couldn't refresh right now — try again shortly.";
    toast({ title: msg, variant: "destructive" });
  };

  const refreshPainPoints = () => {
    setPainPointsLoading(true);
    agentApi.painPoints()
      .then((r) => { setPainPoints(r.painPoints); saveDayCache("pain", uid, r.painPoints); })
      .catch(aiErrorToast)
      .finally(() => setPainPointsLoading(false));
  };

  const refreshTabIdeas = (type: "brand" | "teach") => {
    if (tabRefreshing) return;
    setTabRefreshing(true);
    const request = type === "brand" ? agentApi.brandIdeas() : agentApi.teachIdeas();
    request
      .then((r) => {
        if (type === "brand") { setBrandAnglesOverride(r.angles as BrandAngle[]); setExpandedBriefAngle(null); }
        else { setTeachAnglesOverride(r.angles as string[]); setExpandedTeachAngle(null); }
      })
      .catch(aiErrorToast)
      .finally(() => setTabRefreshing(false));
  };

  const refreshBrief = () => {
    setBriefLoading(true);
    clearDayCache("brief", uid);
    agentApi.brief().then((b) => {
      setBrief(b);
      saveDayCache("brief", uid, b);
    }).catch(aiErrorToast).finally(() => setBriefLoading(false));
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

  return (
    <AppShell>


        {/* Header */}
        <header className="px-6 pt-10 pb-4 bg-white/80 backdrop-blur border-b border-gray-100 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <p className="text-sm font-black tracking-tight text-gray-900">Brand<span className="text-gray-300">Moi</span></p>
            <div className="flex items-center gap-2">
              {momentum && momentum.weekStreak >= 2 && (
                <div className="flex items-center gap-1 bg-violet-50 border border-violet-100 px-2.5 py-1.5 rounded-xl">
                  <span className="text-xs font-bold text-violet-600">{momentum.weekStreak}-week streak</span>
                </div>
              )}
              <Link href="/settings" className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
                <Settings className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 px-6 py-6">
          <div className="max-w-5xl mx-auto space-y-4">
          {/* Hero — greeting + this week's post tracker */}
          <section
            className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-gray-900 via-gray-900 to-indigo-950 px-6 py-6 cursor-pointer select-none"
            onClick={() => setMomOpen((v) => !v)}
          >
            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none" />
            <div className="relative flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-white/40 tracking-[0.25em] uppercase mb-1">
                  {new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening"}
                </p>
                <h1 className="text-2xl font-extrabold text-white tracking-tight truncate">{firstName ?? "Creator"}</h1>
                <p className="text-xs text-white/55 mt-1.5 font-medium">
                  {momentum ? WEEK_STREAK_LINES(momentum.weekStreak) : "Loading your week…"}
                </p>
              </div>
              {momentum ? (
                <WeekDayTracker days={momentum.currentWeekDays} />
              ) : (
                <Skeleton className="w-44 h-6 rounded-md bg-white/10 flex-shrink-0" />
              )}
            </div>
          </section>
          {momOpen && momentum && <MomentumCard data={momentum} />}

          <ProfileStrengthCard preferences={preferences} onComplete={() => navigate("/settings")} />

          {/* Performance check-in nudges — published posts with no logged stats */}
          {checkins.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(`/library?highlight=${c.id}`)}
              className="w-full rounded-3xl border border-sky-100 bg-sky-50/60 px-5 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-sky-50 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-sky-500 uppercase tracking-widest mb-0.5">Performance check-in</p>
                <p className="text-sm font-bold text-gray-800 truncate">How did “{c.topic}” do?</p>
                <p className="text-[11px] text-gray-400">Published {c.ageDays} day{c.ageDays !== 1 ? "s" : ""} ago — logging the numbers makes your AI smarter.</p>
              </div>
              <ChevronRight className="w-4 h-4 text-sky-400 flex-shrink-0" />
            </button>
          ))}

          {/* Series-in-progress nudge — points at the next unwritten part of
              whichever active series needs it, pulled from the daily brief's
              already-computed rollup (no extra AI call). */}
          {brief?.seriesNudge && !seriesNudgeDismissed && (
            <div className="w-full rounded-3xl border border-indigo-100 bg-indigo-50/60 px-5 py-3.5 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-0.5">Series in progress</p>
                <p className="text-sm font-bold text-gray-800 truncate">
                  Part {brief.seriesNudge.nextPart}{brief.seriesNudge.plannedParts ? ` of ${brief.seriesNudge.plannedParts}` : ""} — {brief.seriesNudge.title}
                </p>
              </div>
              <button
                onClick={() => navigate(`/capture?seriesId=${brief.seriesNudge!.seriesId}&seriesPart=${brief.seriesNudge!.nextPart}`)}
                className="flex-shrink-0 text-[11px] font-bold text-indigo-600 bg-white border border-indigo-200 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap"
              >
                Write it
              </button>
              <button
                onClick={() => setSeriesNudgeDismissed(true)}
                className="flex-shrink-0 p-1 rounded-lg text-indigo-300 hover:text-indigo-500 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="md:grid md:grid-cols-5 md:gap-5 md:items-start space-y-4 md:space-y-0">
          <div className="md:col-span-3 space-y-4">
          {/* Write your own — primary CTA always visible */}
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

          {/* ── Idea Engine — one card, four lenses ── */}
          <div className="bg-white rounded-[28px] border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-gray-900" />
                <span className="text-[10px] font-bold text-gray-900 uppercase tracking-widest">Idea Engine</span>
              </div>
              {ideaTab !== "skills" && (
                <button
                  onClick={() => (ideaTab === "pain" ? refreshPainPoints() : ideaTab === "best" ? refreshTopPosts() : refreshTabIdeas(ideaTab))}
                  disabled={tabRefreshing || (ideaTab === "pain" && painPointsLoading) || (ideaTab === "best" && topSuggestionsLoading)}
                  className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 hover:text-gray-700 disabled:opacity-50 transition-colors"
                  title="Regenerates only this tab — other tabs are untouched"
                >
                  <RefreshCw className={cn("w-3 h-3", (tabRefreshing || (ideaTab === "pain" && painPointsLoading) || (ideaTab === "best" && topSuggestionsLoading)) && "animate-spin")} />
                  {ideaTab === "brand" ? "New brand ideas" : ideaTab === "teach" ? "New teach ideas" : ideaTab === "best" ? "New angles from best posts" : "New pain points"}
                </button>
              )}
            </div>
            <div className="px-5 pb-3 flex gap-1.5 overflow-x-auto no-scrollbar">
              {([["brand", "For your brand"], ["teach", "Teach"], ["best", "Best posts"], ["pain", "Pain points"], ["skills", "Skills"]] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => {
                    setIdeaTab(key);
                    // Lazy-load: first visit to a data tab fetches once; after
                    // that it's the day cache until the user hits refresh.
                    if (key === "pain" && painPoints === null && !painPointsLoading) refreshPainPoints();
                    if (key === "best" && topSuggestions === null && !topSuggestionsLoading) refreshTopPosts();
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all",
                    ideaTab === key ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {ideaTab === "brand" && ((brandAnglesOverride ?? brief?.angles ?? []).length > 0 ? (

                <div className="px-5 pb-5 flex flex-col gap-1.5 border-t border-gray-50 pt-3">
                  {(brandAnglesOverride ?? brief?.angles ?? []).map((item, i) => {
                    const isOpen = expandedBriefAngle === i;
                    const fbKey = `brand:${item.angle}`;
                    const fb = ideaFeedback[fbKey];
                    return (
                      <div key={i} className="rounded-xl border border-gray-100 overflow-hidden">
                        <button onClick={() => setExpandedBriefAngle(isOpen ? null : i)} className="w-full text-left flex items-start gap-2 px-3 py-2.5 min-w-0 bg-gray-50 hover:bg-gray-100 transition-colors">
                          <span className={cn("text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5", AUDIENCE_TAG_COLORS[item.audience] ?? AUDIENCE_TAG_COLORS["My audience"])}>
                            {item.audience === "Recruiters & Headhunters" ? "Recruiters" : item.audience}
                          </span>
                          <span className={cn("text-gray-800 text-xs font-medium leading-snug flex-1", !isOpen && "line-clamp-1")}>{item.angle}</span>
                          <ChevronDown className={cn("w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5 transition-transform duration-200", isOpen && "rotate-180")} />
                        </button>
                        {isOpen && (
                          <div className="px-3 pb-3 pt-2.5 bg-white border-t border-gray-100 space-y-2">
                            <button onClick={() => openLengthPicker(item.angle, `audience=${encodeURIComponent(item.audience)}`)} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-primary hover:bg-primary/80 text-white text-xs font-bold transition-colors">Write this →</button>
                            <div className="flex gap-2">
                              <button onClick={() => void handleIdeaFeedback(item.angle, "brand", "like")} className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors", fb === "like" ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-gray-50 text-gray-400 border border-gray-100 hover:text-emerald-500 hover:bg-emerald-50")}><ThumbsUp className="w-3.5 h-3.5" /> Good idea</button>
                              <button onClick={() => void handleIdeaFeedback(item.angle, "brand", "dislike")} className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors", fb === "dislike" ? "bg-rose-50 text-rose-500 border border-rose-200" : "bg-gray-50 text-gray-400 border border-gray-100 hover:text-rose-400 hover:bg-rose-50")}><ThumbsDown className="w-3.5 h-3.5" /> Not for me</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

            ) : (
              <p className="text-xs text-gray-400 text-center px-5 pb-5 pt-2">{briefLoading ? "Generating ideas…" : "Ideas appear once your daily brief loads."}</p>
            ))}

            {ideaTab === "teach" && ((teachAnglesOverride ?? brief?.teachAngles ?? []).length > 0 ? (

                <div className="px-5 pb-5 flex flex-col gap-1.5 border-t border-indigo-50 pt-3">
                  {(teachAnglesOverride ?? brief?.teachAngles ?? []).map((angle, i) => {
                    const isOpen = expandedTeachAngle === i;
                    const fbKey = `teach:${angle}`;
                    const fb = ideaFeedback[fbKey];
                    return (
                      <div key={i} className="rounded-xl border border-indigo-100 overflow-hidden">
                        <button onClick={() => setExpandedTeachAngle(isOpen ? null : i)} className="w-full text-left flex items-start justify-between gap-2 px-3 py-2.5 bg-indigo-50/60 hover:bg-indigo-100/60 transition-colors">
                          <span className={cn("text-gray-800 text-xs font-medium leading-snug flex-1", !isOpen && "line-clamp-1")}>{angle}</span>
                          <ChevronDown className={cn("w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5 transition-transform duration-200", isOpen && "rotate-180")} />
                        </button>
                        {isOpen && (
                          <div className="px-3 pb-3 pt-2.5 bg-white border-t border-indigo-100 space-y-2">
                            <button onClick={() => openLengthPicker(angle, "teacherMode=true")} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors">Write this →</button>
                            <div className="flex gap-2">
                              <button onClick={() => void handleIdeaFeedback(angle, "teach", "like")} className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors", fb === "like" ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-gray-50 text-gray-400 border border-gray-100 hover:text-emerald-500 hover:bg-emerald-50")}><ThumbsUp className="w-3.5 h-3.5" /> Good idea</button>
                              <button onClick={() => void handleIdeaFeedback(angle, "teach", "dislike")} className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors", fb === "dislike" ? "bg-rose-50 text-rose-500 border border-rose-200" : "bg-gray-50 text-gray-400 border border-gray-100 hover:text-rose-400 hover:bg-rose-50")}><ThumbsDown className="w-3.5 h-3.5" /> Not for me</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

            ) : (
              <p className="text-xs text-gray-400 text-center px-5 pb-5 pt-2">{briefLoading ? "Generating ideas…" : "Teaching angles appear once your daily brief loads."}</p>
            ))}

            {ideaTab === "best" && (topSuggestionsLoading ? (
              <div className="px-5 pb-5 pt-2 flex justify-center"><span className="w-4 h-4 rounded-full border border-gray-300 border-t-transparent animate-spin" /></div>
            ) : topSuggestions && topSuggestions.length > 0 ? (
<div className="px-5 pb-5 flex flex-col gap-3 border-t border-orange-50 pt-3">
                  {topSuggestions.map((s, i) => {
                    const isOpen = expandedTopSuggestion === i;
                    return (
                      <div key={i} className="rounded-xl border border-orange-100 overflow-hidden">
                        <button onClick={() => setExpandedTopSuggestion(isOpen ? null : i)} className="w-full text-left flex items-start justify-between gap-2 bg-orange-50/50 hover:bg-orange-50 px-3 py-2.5 transition-colors">
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
                                    <button onClick={() => openLengthPicker(a.angle)} className="flex-shrink-0 text-[10px] font-bold text-orange-700 bg-orange-100 hover:bg-orange-200 px-2 py-1 rounded-lg transition-colors whitespace-nowrap">Write →</button>
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

            ) : (
              <p className="text-xs text-gray-400 text-center px-5 pb-5 pt-2 leading-relaxed">
                {topSuggestions === null
                  ? "Tap refresh to mine your best posts for fresh angles."
                  : "Needs posts with logged engagement — log performance on a few posts, then refresh."}
              </p>
            ))}

            {ideaTab === "pain" && (painPointsLoading ? (
              <div className="px-5 pb-5 pt-2 flex justify-center"><span className="w-4 h-4 rounded-full border border-gray-300 border-t-transparent animate-spin" /></div>
            ) : painPoints && painPoints.length > 0 ? (

                <div className="px-5 pb-5 flex flex-col gap-1.5 border-t border-rose-50 pt-3">
                  {painPoints.map((pp, i) => {
                    const isOpen = expandedPainPoint === i;
                    return (
                      <div key={i} className="rounded-xl border border-rose-100 overflow-hidden">
                        <button onClick={() => setExpandedPainPoint(isOpen ? null : i)} className="w-full text-left flex items-start justify-between gap-2 bg-rose-50/60 hover:bg-rose-100/60 px-3 py-2.5 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-900 text-xs font-bold leading-snug">{pp.title}</p>
                            {!isOpen && <p className="text-gray-500 text-[11px] mt-0.5 line-clamp-1">{pp.description}</p>}
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
                            <button onClick={() => openLengthPicker(pp.angle)} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors">Write about this →</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

            ) : (
              <p className="text-xs text-gray-400 text-center px-5 pb-5 pt-2">No pain points yet — tap refresh.</p>
            ))}

            {ideaTab === "skills" && (
              <div>

              <div className="border-t border-amber-50">
                <div className="px-5 pt-4 pb-4">
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
                          <button onClick={() => setExpandedSkillAngle(isOpen ? null : i)} className="w-full text-left flex items-start justify-between gap-2 bg-amber-50/60 hover:bg-amber-100/60 px-3 py-2.5 transition-colors">
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
                              <button onClick={() => openLengthPicker(sa.angle, `extraInstruction=${encodeURIComponent(`Open with: "${sa.hook}"`)}`)} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold transition-colors">Use this angle →</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              </div>
            )}
          </div>

          {/* ── Voice Insights ── */}
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
            <div className="bg-white rounded-3xl border border-violet-100 shadow-sm overflow-hidden">
              <div
                className="px-5 pt-5 pb-4 flex items-center justify-between cursor-pointer"
                onClick={() => setVoiceOpen((v) => !v)}
              >
                <div className="flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-violet-500" />
                  <span className="text-[10px] font-bold text-violet-700 uppercase tracking-widest">Voice Insights</span>
                  {voiceSuggestions.length > 0 && (
                    <span className="text-[10px] font-bold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">{voiceSuggestions.length}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); void handleGenerateInsights(); }}
                    disabled={voiceInsightsGenerating}
                    className="flex items-center gap-1 text-[10px] font-semibold text-violet-600 hover:text-violet-500 disabled:opacity-50 transition-colors"
                    title="Analyse my voice (2/day)"
                  >
                    <Sparkles className="w-3 h-3" />
                    {voiceInsightsGenerating ? "Analysing…" : "Analyse"}
                  </button>
                  <ChevronDown className={cn("w-3.5 h-3.5 text-gray-400 transition-transform duration-200", voiceOpen && "rotate-180")} />
                </div>
              </div>
              {voiceOpen && (
                <div className="px-5 pb-5 border-t border-violet-50 pt-4">
                  {voiceSuggestions.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-3">No suggestions yet — tap Analyse above.</p>
                  ) : (
                    <div className="space-y-3">
                      {voiceSuggestions.map((s) => (
                        <div key={s.id} className="bg-gray-50 rounded-2xl border border-violet-100 p-4">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{s.field}</span>
                            <span className="text-[10px] text-gray-400 line-through truncate max-w-[80px]">{s.currentValue || "not set"}</span>
                            <ChevronRight className="w-3 h-3 text-violet-400 flex-shrink-0" />
                            <span className="text-[10px] font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full truncate max-w-[120px]">{s.suggestedValue}</span>
                          </div>
                          <p className="text-xs text-gray-600 leading-relaxed mb-3">{s.rationale}</p>
                          {Array.isArray(s.evidenceSnippets) && s.evidenceSnippets.length > 0 && (
                            <div className="mb-3 space-y-1">
                              {(s.evidenceSnippets as string[]).slice(0, 2).map((snippet, i) => (
                                <p key={i} className="text-[10px] text-gray-400 italic leading-snug border-l-2 border-violet-200 pl-2">&ldquo;{snippet}&rdquo;</p>
                              ))}
                            </div>
                          )}
                          <div className="flex gap-2">
                            <button onClick={() => void handleAcceptSuggestion(s.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-colors"><Check className="w-3 h-3" /> Apply</button>
                            <button onClick={() => void handleDismissSuggestion(s.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold transition-colors"><X className="w-3 h-3" /> Dismiss</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}



          {/* ── Saved Ideas tray ── */}
          {savedIdeas.length > 0 && (
            <div className="bg-white rounded-3xl border border-emerald-100 shadow-sm overflow-hidden">
              <div
                className="px-5 pt-5 pb-4 flex items-center justify-between cursor-pointer"
                onClick={() => setSavedIdeasOpen((v) => !v)}
              >
                <div className="flex items-center gap-1.5">
                  <Bookmark className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Saved Ideas</span>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">{savedIdeas.length}</span>
                </div>
                <ChevronDown className={cn("w-3.5 h-3.5 text-gray-400 transition-transform duration-200", savedIdeasOpen && "rotate-180")} />
              </div>
              {savedIdeasOpen && (
                <div className="px-5 pb-5 flex flex-col gap-1.5 border-t border-emerald-50 pt-3">
                  {savedIdeas.map((idea) => (
                    <div key={idea.id} className="rounded-xl border border-emerald-100 overflow-hidden">
                      <div className="flex items-center gap-2 bg-emerald-50/50 px-3 py-2.5">
                        <span className="flex-1 text-gray-800 text-xs font-medium leading-snug">{idea.text}</span>
                        <button onClick={() => openLengthPicker(idea.text, idea.type === "teach" ? "teacherMode=true" : "")} className="flex-shrink-0 text-[10px] font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2 py-1 rounded-lg transition-colors whitespace-nowrap">Write →</button>
                        <button
                          onClick={() => {
                            setSavedIdeas((prev) => prev.filter((i) => i.id !== idea.id));
                            agentApi.deleteSavedIdea(idea.id).catch(() => { setSavedIdeas((prev) => [idea, ...prev]); });
                          }}
                          className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
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

          </div>

          <div className="md:col-span-2 space-y-4">
          {/* ── Today's Brief ── */}
          {briefLoading ? (
            <div className="rounded-3xl overflow-hidden bg-gray-900 p-5 space-y-3">
              <Skeleton className="h-3 w-20 bg-white/10 rounded-full" />
              <Skeleton className="h-5 w-full bg-white/10 rounded-full" />
              <Skeleton className="h-4 w-4/5 bg-white/10 rounded-full" />
            </div>
          ) : brief ? (
            <div className="rounded-3xl overflow-hidden bg-gray-900">
              {/* Collapsible header */}
              <div
                className="flex items-center justify-between px-5 pt-5 pb-4 cursor-pointer"
                onClick={() => setBriefOpen((v) => !v)}
              >
                <div className="flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-white/70" />
                  <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest">In the news</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); refreshBrief(); }}
                    className="text-white/30 hover:text-white/60 transition-colors"
                    title="Refresh brief"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <ChevronDown className={cn("w-3.5 h-3.5 text-white/40 transition-transform duration-200", briefOpen && "rotate-180")} />
                </div>
              </div>
              {briefOpen && (
                <div className="px-5 pb-5">
                  {!brief.newsHeadline && (
                    <button
                      onClick={(e) => { e.stopPropagation(); refreshBrief(); }}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-3 py-2.5 mb-3 flex items-center gap-2 text-left hover:bg-white/10 transition-colors"
                    >
                      <Newspaper className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
                      <span className="text-[11px] text-white/45 leading-snug">No fresh headline matched on the last fetch — tap to retry.</span>
                      <RefreshCw className="w-3 h-3 text-white/30 flex-shrink-0 ml-auto" />
                    </button>
                  )}
                  {brief.newsHeadline && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-3 py-2.5 mb-3">
                      <div className="flex items-start gap-2">
                        <Newspaper className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          {(() => {
                            const ageLabel = formatNewsAge(brief.newsPublishedAt);
                            return (
                              <div className="flex items-center gap-2 mb-0.5">
                                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">In the news</p>
                                {ageLabel && (
                                  <span className="text-[10px] font-semibold text-emerald-300/80 bg-emerald-500/15 px-1.5 py-0.5 rounded-full">{ageLabel}</span>
                                )}
                              </div>
                            );
                          })()}
                          <p className="text-white/80 text-xs font-medium leading-snug">{brief.newsHeadline}</p>
                          {(brief.newsSourceDomain || brief.newsSourceLine) && (
                            <div className="mt-1 space-y-0.5">
                              {brief.newsSourceDomain && (
                                <p className="text-emerald-400/60 text-[10px] font-semibold uppercase tracking-wider">via {brief.newsSourceDomain}</p>
                              )}
                              {brief.newsSourceLine && (
                                <p className="text-white/40 text-[11px] leading-snug italic">{brief.newsSourceLine}</p>
                              )}
                            </div>
                          )}
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            {brief.newsUrl && (
                              <a href={brief.newsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-emerald-400/70 hover:text-emerald-300 transition-colors underline underline-offset-2" onClick={(e) => e.stopPropagation()}>
                                View source →
                              </a>
                            )}
                            {!newsAngles && (
                              <button
                                onClick={() => {
                                  if (newsAnglesLoading || !brief.newsHeadline) return;
                                  setNewsAnglesLoading(true);
                                  agentApi.newsAngles({ newsHeadline: brief.newsHeadline!, newsSourceLine: brief.newsSourceLine, newsUrl: brief.newsUrl, newsDescription: brief.newsDescription })
                                    .then((r) => setNewsAngles(r.angles)).catch(() => {}).finally(() => setNewsAnglesLoading(false));
                                }}
                                disabled={newsAnglesLoading}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 hover:text-emerald-200 transition-colors disabled:opacity-50"
                              >
                                {newsAnglesLoading ? <><span className="w-2.5 h-2.5 rounded-full border border-emerald-400/60 border-t-transparent animate-spin inline-block" /> Generating…</> : <>✦ Create post angles</>}
                              </button>
                            )}
                          </div>
                          {newsAngles && newsAngles.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-emerald-500/15">
                              <p className="text-[10px] font-bold text-emerald-400/70 uppercase tracking-wider mb-2">Post angles from this news</p>
                              <div className="flex flex-col gap-1.5">
                                {newsAngles.map((angle, i) => {
                                  const enrichedRaw = [angle, "", `News reference: ${brief.newsHeadline}`, brief.newsSourceLine ?? ""].filter(Boolean).join("\n");
                                  const isOpen = expandedNewsAngle === i;
                                  return (
                                    <div key={i} className="rounded-xl border border-emerald-500/15 overflow-hidden">
                                      <button onClick={() => setExpandedNewsAngle(isOpen ? null : i)} className="w-full text-left flex items-start justify-between gap-2 bg-emerald-500/10 hover:bg-emerald-500/15 px-3 py-2.5 transition-colors">
                                        <span className={cn("text-white/80 text-xs font-medium leading-snug flex-1", !isOpen && "line-clamp-1")}>{angle}</span>
                                        <ChevronDown className={cn("w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5 transition-transform duration-200", isOpen && "rotate-180")} />
                                      </button>
                                      {isOpen && (
                                        <div className="px-3 pb-3 pt-2.5 bg-emerald-500/5 border-t border-emerald-500/10">
                                          <button onClick={() => { const extra = brief.newsUrl ? `newsUrl=${encodeURIComponent(brief.newsUrl)}` : ""; openLengthPicker(enrichedRaw, extra); }} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold transition-colors">Write this →</button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                <button onClick={() => { setNewsAngles(null); setExpandedNewsAngle(null); }} className="w-full flex items-center justify-center gap-1.5 mt-1 py-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/15 text-emerald-400 hover:text-emerald-300 text-xs font-semibold transition-colors">
                                  <RefreshCw className="w-3 h-3" /> Regenerate angles
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  <p className="text-white font-extrabold text-base leading-snug mb-1">{brief.headline}</p>
                  <p className="text-white/50 text-xs leading-relaxed">{brief.insight}</p>
                </div>
              )}
            </div>
          ) : null}

{/* ── Dare Mode ── */}
          <DareCard onWrite={(raw) => openLengthPicker(raw)} />

          {/* ── Ripe for Developing ── */}
          {!thoughtsLoading && ripeThoughts.length > 0 && (
            <div className="bg-white rounded-3xl border border-amber-100 shadow-sm overflow-hidden">
              <div
                className="px-5 pt-5 pb-4 flex items-center justify-between cursor-pointer"
                onClick={() => setRipeOpen((v) => !v)}
              >
                <div className="flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Ripe for Developing</span>
                  <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full">{ripeThoughts.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Link href="/vault" onClick={(e) => e.stopPropagation()} className="text-[10px] font-semibold text-primary hover:underline">View all</Link>
                  <ChevronDown className={cn("w-3.5 h-3.5 text-gray-400 transition-transform duration-200", ripeOpen && "rotate-180")} />
                </div>
              </div>
              {ripeOpen && (
                <div className="px-5 pb-5 flex flex-col gap-2 border-t border-amber-50 pt-3">
                  {ripeThoughts.map((thought) => {
                    const daysOld = Math.floor((Date.now() - new Date(thought.createdAt).getTime()) / (1000 * 60 * 60 * 24));
                    const encoded = encodeURIComponent(thought.content);
                    return (
                      <Link key={thought.id} href={`/capture?thought=${encoded}&thoughtId=${thought.id}`}>
                        <div className="bg-amber-50/40 border border-amber-100 rounded-2xl p-4 cursor-pointer hover:border-amber-300 hover:shadow-sm transition-all">
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
              )}
            </div>
          )}

          {/* ── Content Threads ── */}
          {!themesLoading && themes.length > 0 && (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div
                className="px-5 pt-5 pb-4 flex items-center justify-between cursor-pointer"
                onClick={() => setThreadsOpen((v) => !v)}
              >
                <div className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Content Threads</span>
                  <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{themes.length}</span>
                </div>
                <ChevronDown className={cn("w-3.5 h-3.5 text-gray-400 transition-transform duration-200", threadsOpen && "rotate-180")} />
              </div>
              {threadsOpen && (
                <div className="px-5 pb-5 flex flex-col gap-2 border-t border-gray-50 pt-3">
                  {themes.map((theme, i) => (
                    <div key={i} className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm font-bold text-gray-800">{theme.name}</p>
                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full flex-shrink-0">{theme.postCount} posts</span>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed mb-3">{theme.pattern}</p>
                      <button onClick={() => navigate(`/capture?raw=${encodeURIComponent(theme.seriesIdea)}`)} className="text-xs text-primary font-semibold flex items-center gap-1 hover:gap-2 transition-all">
                        Start series: {theme.seriesIdea} <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Recent Work ── */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div
              className="px-5 pt-5 pb-4 flex items-center justify-between cursor-pointer"
              onClick={() => setRecentOpen((v) => !v)}
            >
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Recent Work</span>
                {recentDrafts.length > 0 && (
                  <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{recentDrafts.length}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {(drafts?.length ?? 0) > 5 && (
                  <Link href="/library" onClick={(e) => e.stopPropagation()} className="text-[10px] font-semibold text-primary hover:underline">View all</Link>
                )}
                <ChevronDown className={cn("w-3.5 h-3.5 text-gray-400 transition-transform duration-200", recentOpen && "rotate-180")} />
              </div>
            </div>
            {recentOpen && (
              <div className="border-t border-gray-50">
                {draftsLoading ? (
                  <div className="px-5 py-4 space-y-2">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-2xl" />)}
                  </div>
                ) : recentDrafts.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <Zap className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No drafts yet.</p>
                    <p className="text-xs text-gray-400 mt-1">Your saved content will appear here.</p>
                  </div>
                ) : (
                  <div className="px-5 py-3 space-y-2">
                    {recentDrafts.map((draft) => (
                      <Link key={draft.id} href={`/capture?draftId=${draft.id}`}>
                        <div className="bg-gray-50 rounded-2xl px-4 py-3 border border-gray-100 flex items-center gap-3 hover:border-primary/30 transition-colors cursor-pointer">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">{(draft.structuredBreakdown as { topic?: string })?.topic ?? "Untitled"}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{new Date(draft.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", OBJECTIVE_COLORS[draft.objective] ?? "bg-gray-100 text-gray-600")}>{draft.objective}</span>
                            {draft.shortPost && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">⚡ Short</span>}
                            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full capitalize", STATUS_COLORS[draft.status] ?? "bg-gray-100 text-gray-600")}>{draft.status}</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          </div>
          </div>
          </div>
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
