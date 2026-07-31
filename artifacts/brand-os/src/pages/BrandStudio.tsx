import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, Sparkles, Loader2, Check, X, FlaskConical, TrendingUp, Quote } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useUpdatePreferences } from "@workspace/api-client-react";
import { studioApi, voiceInsightsApi, type BrandHealth, type StudioPost, type VoiceSuggestion } from "@/lib/api";

const FIELD_LABELS: Record<string, string> = {
  tone: "Tone",
  objective: "Objective",
  persona: "Persona",
  brandRole: "Your role",
  brandAudience: "Your audience",
  brandBelief: "Core belief",
  contentPillars: "Content pillars",
};

export default function BrandStudio() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { preferences, invalidate } = useAuth();
  const { mutate: updatePreferences } = useUpdatePreferences();

  const [health, setHealth] = useState<BrandHealth | null>(null);
  const [posts, setPosts] = useState<StudioPost[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);
  const [query, setQuery] = useState("");
  const [audienceFilter, setAudienceFilter] = useState<string>("All");
  const [feelingFilter, setFeelingFilter] = useState<string>("All");
  const [dataOnly, setDataOnly] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [suggestions, setSuggestions] = useState<VoiceSuggestion[]>([]);
  const [analyzedOnce, setAnalyzedOnce] = useState(false);

  const [aspirational, setAspirational] = useState<string[]>(
    ((preferences as typeof preferences & { aspirationalSamples?: string[] })?.aspirationalSamples ?? [])
  );
  const [newSample, setNewSample] = useState("");

  useEffect(() => {
    studioApi.health().then(setHealth).catch(() => {});
    studioApi.posts().then((r) => {
      setPosts(r.posts);
      // Pre-select the top 5 posts that have performance data
      setSelected(new Set(r.posts.filter((p) => p.hasData).slice(0, 5).map((p) => p.id)));
    }).catch(() => setPosts([]));
    // Pending suggestions from a previous analysis still need answering
    voiceInsightsApi.list().then((s) => setSuggestions(s)).catch(() => {});
  }, []);

  useEffect(() => {
    const p = (preferences as typeof preferences & { aspirationalSamples?: string[] })?.aspirationalSamples;
    if (p) setAspirational(p);
  }, [preferences]);

  const togglePost = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 8) next.add(id);
      return next;
    });
  };

  // The active filters become the analysis lens — categorized selections
  // produce sharper findings than diverse ones.
  const focusLens = (() => {
    const parts: string[] = [];
    if (feelingFilter !== "All") parts.push(`${feelingFilter} posts`);
    if (audienceFilter !== "All") parts.push(`aimed at ${audienceFilter}`);
    return parts.length > 0 ? parts.join(" ") : undefined;
  })();

  const filteredPosts = (posts ?? []).filter((p) => {
    if (query && !p.topic.toLowerCase().includes(query.toLowerCase())) return false;
    if (audienceFilter !== "All" && p.audience !== audienceFilter) return false;
    if (feelingFilter !== "All" && p.feeling !== feelingFilter) return false;
    if (dataOnly && !p.hasData) return false;
    return true;
  });
  const visiblePosts = showAll ? filteredPosts : filteredPosts.slice(0, 12);

  const audienceOptions = ["All", ...new Set((posts ?? []).map((p) => p.audience).filter((a): a is string => !!a))];
  const feelingOptions = ["All", ...new Set((posts ?? []).map((p) => p.feeling).filter((f): f is string => !!f))];

  const runAnalysis = async () => {
    if (selected.size === 0 || analyzing) return;
    setAnalyzing(true);
    try {
      const r = await studioApi.analyze([...selected], focusLens);
      setSuggestions((prev) => [...r.suggestions, ...prev.filter((p) => !r.suggestions.some((n) => n.id === p.id))]);
      setAnalyzedOnce(true);
      if (r.suggestions.length === 0) {
        toast({ title: "Your brand profile already matches the evidence — nothing to change. 💪" });
      }
      studioApi.health().then(setHealth).catch(() => {});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Analysis failed — try again.";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAccept = async (s: VoiceSuggestion) => {
    try {
      await voiceInsightsApi.accept(s.id);
      setSuggestions((prev) => prev.filter((x) => x.id !== s.id));
      await invalidate();
      toast({ title: `${FIELD_LABELS[s.field] ?? s.field} updated — future posts will use it.` });
    } catch {
      toast({ title: "Couldn't apply that change.", variant: "destructive" });
    }
  };

  const handleDismiss = async (s: VoiceSuggestion) => {
    try {
      await voiceInsightsApi.dismiss(s.id);
      setSuggestions((prev) => prev.filter((x) => x.id !== s.id));
    } catch {
      toast({ title: "Couldn't dismiss.", variant: "destructive" });
    }
  };

  const saveAspirational = (next: string[]) => {
    setAspirational(next);
    // The generated UpdatePreferencesBody type lags the API — pass through
    // the same way contentPillars/proofPoints do elsewhere.
    updatePreferences(
      { data: { aspirationalSamples: next } as Parameters<typeof updatePreferences>[0]["data"] },
      {
        onSuccess: () => toast({ title: "Style targets saved." }),
        onError: () => toast({ title: "Couldn't save style targets.", variant: "destructive" }),
      }
    );
  };

  return (
    <AppShell>
      <div className="px-5 pt-4 pb-28 space-y-7 max-w-[430px] mx-auto min-w-0 w-full">
        {/* Header */}
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => navigate("/")} className="p-2 -ml-2 rounded-xl hover:bg-gray-100 text-gray-400 flex-shrink-0">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-violet-500 flex-shrink-0" />
              Brand Studio
            </h1>
            <p className="text-xs text-gray-400">Tune your brand with evidence from what actually worked.</p>
          </div>
        </div>

        {/* ── Zone 1: Brand health ── */}
        <section className="rounded-3xl bg-gray-900 px-5 py-4">
          {health ? (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1">Brand health</p>
                <p className="text-sm font-bold text-white">
                  {health.lastAnalyzedAt
                    ? `Last tuned ${health.lastAnalyzedAt}`
                    : "Never tuned with performance data"}
                </p>
                <p className="text-[11px] text-white/50 mt-0.5">
                  {health.measuredPostsSince > 0
                    ? `${health.measuredPostsSince} measured post${health.measuredPostsSince !== 1 ? "s" : ""} since — fresh evidence available.`
                    : `${health.measuredPostsTotal} post${health.measuredPostsTotal !== 1 ? "s" : ""} with performance data overall.`}
                </p>
              </div>
              <TrendingUp className={cn("w-8 h-8 flex-shrink-0", health.measuredPostsSince > 2 ? "text-emerald-400" : "text-white/20")} />
            </div>
          ) : (
            <Skeleton className="h-12 bg-white/10 rounded-xl" />
          )}
        </section>

        {/* ── Zone 2: Top-post analysis ── */}
        <section>
          <h2 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-1">What's working</h2>
          <p className="text-xs text-gray-400 mb-4 leading-relaxed">Pick the posts that represent your best work (top performers pre-selected). The analysis compares them against your brand profile and recommends updates.</p>

          {posts === null ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-11 rounded-2xl" />)}</div>
          ) : posts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 p-5 text-center">
              <p className="text-sm text-gray-500 font-medium">No published posts yet</p>
              <p className="text-xs text-gray-400 mt-1">Ship a few posts and log their performance — then come back to tune the brand.</p>
            </div>
          ) : (
            <>
              {/* Search + filters — active filters also become the analysis lens */}
              <div className="space-y-2 mb-3">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search posts…"
                  className="w-full text-sm rounded-2xl border border-gray-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white placeholder-gray-300"
                />
                {audienceOptions.length > 2 && (
                  <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                    {audienceOptions.map((a) => (
                      <button key={a} onClick={() => setAudienceFilter(a)}
                        className={cn("px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap border transition-all",
                          audienceFilter === a ? "bg-violet-600 text-white border-violet-600" : "bg-white text-gray-500 border-gray-200 hover:border-violet-300")}
                      >{a}</button>
                    ))}
                  </div>
                )}
                {feelingOptions.length > 2 && (
                  <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                    {feelingOptions.map((f) => (
                      <button key={f} onClick={() => setFeelingFilter(f)}
                        className={cn("px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap border transition-all",
                          feelingFilter === f ? "bg-sky-600 text-white border-sky-600" : "bg-white text-gray-500 border-gray-200 hover:border-sky-300")}
                      >{f}</button>
                    ))}
                  </div>
                )}
                <button onClick={() => setDataOnly((v) => !v)}
                  className={cn("px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all",
                    dataOnly ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-500 border-gray-200 hover:border-emerald-300")}
                >
                  With performance data
                </button>
              </div>

              {focusLens && (
                <p className="text-[11px] text-violet-600 font-semibold mb-2">
                  🔍 Analysis lens: {focusLens} — a focused selection gives sharper recommendations.
                </p>
              )}

              <div className="space-y-2 mb-2">
                {visiblePosts.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">No posts match — adjust the search or filters.</p>
                )}
                {visiblePosts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => togglePost(p.id)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-left transition-all",
                      selected.has(p.id) ? "border-violet-300 bg-violet-50" : "border-gray-100 bg-white hover:border-gray-200"
                    )}
                  >
                    <span className={cn(
                      "w-4 h-4 rounded-md border-2 flex items-center justify-center flex-shrink-0",
                      selected.has(p.id) ? "border-violet-500 bg-violet-500" : "border-gray-200"
                    )}>
                      {selected.has(p.id) && <Check className="w-3 h-3 text-white" />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-medium text-gray-700 truncate">{p.topic}</span>
                      {(p.audience || p.feeling) && (
                        <span className="block text-[9px] text-gray-300 font-bold uppercase tracking-wide truncate">
                          {[p.feeling, p.audience].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </span>
                    {p.resonance !== null ? (
                      <span className={cn(
                        "text-[10px] font-black tabular-nums px-1.5 py-0.5 rounded-full flex-shrink-0",
                        p.resonance >= 50 ? "bg-emerald-100 text-emerald-700" : p.resonance >= 20 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
                      )}>
                        {p.resonance}
                      </span>
                    ) : (
                      <span className="text-[9px] text-gray-300 font-bold uppercase flex-shrink-0">no data</span>
                    )}
                  </button>
                ))}
              </div>

              {filteredPosts.length > 12 && (
                <button
                  onClick={() => setShowAll((v) => !v)}
                  className="w-full text-xs font-bold text-violet-500 hover:text-violet-700 py-1.5 mb-2 transition-colors"
                >
                  {showAll ? "Show top 12 only" : `Show all ${filteredPosts.length} posts`}
                </button>
              )}
              <Button
                className="w-full h-12 rounded-2xl font-bold bg-violet-600 hover:bg-violet-700"
                onClick={runAnalysis}
                disabled={selected.size === 0 || analyzing}
              >
                {analyzing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Reading the evidence…</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" />Analyze {selected.size} post{selected.size !== 1 ? "s" : ""} → tune my brand</>
                )}
              </Button>
              <p className="text-[10px] text-gray-300 text-center mt-1.5">2 analyses per day</p>
            </>
          )}
        </section>

        {/* ── Brand diff: suggestions ── */}
        {(suggestions.length > 0 || analyzedOnce) && (
          <section>
            <h2 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3">Recommended brand updates</h2>
            {suggestions.length === 0 ? (
              <p className="text-xs text-gray-400">All caught up — no pending recommendations.</p>
            ) : (
              <div className="space-y-3">
                {suggestions.map((s) => (
                  <div key={s.id} className="rounded-2xl border border-violet-100 bg-white p-4">
                    <p className="text-[10px] font-black text-violet-400 uppercase tracking-wider mb-2">{FIELD_LABELS[s.field] ?? s.field}</p>
                    {s.currentValue && (
                      <p className="text-xs text-gray-400 line-through leading-relaxed mb-1">{s.currentValue}</p>
                    )}
                    <p className="text-sm font-bold text-gray-900 leading-snug mb-2">{s.suggestedValue}</p>
                    <p className="text-[11px] text-gray-500 leading-relaxed mb-3">{s.rationale}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => void handleDismiss(s)}
                        className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-400 text-xs font-bold hover:border-gray-300 transition-colors"
                      >
                        <X className="w-3 h-3 inline mr-1" />Keep current
                      </button>
                      <button
                        onClick={() => void handleAccept(s)}
                        className="flex-[2] py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-colors"
                      >
                        <Check className="w-3 h-3 inline mr-1" />Apply update
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Zone 3: Aspirational voice ── */}
        <section>
          <div className="flex items-center gap-2 mb-1">
            <Quote className="w-4 h-4 text-sky-500" />
            <h2 className="text-xs font-black uppercase tracking-wider text-gray-400">Aspirational voice</h2>
          </div>
          <p className="text-xs text-gray-400 mb-4 leading-relaxed">Paste up to 3 posts whose <span className="font-bold text-gray-500">style</span> you want to lean toward — yours or anyone's. The AI learns the rhythm and energy, never the topics or claims.</p>

          <div className="space-y-3 mb-3">
            {aspirational.map((sample, idx) => (
              <div key={idx} className="relative bg-sky-50/60 rounded-2xl border border-sky-100 p-4">
                <button
                  type="button"
                  onClick={() => saveAspirational(aspirational.filter((_, i) => i !== idx))}
                  className="absolute top-2 right-2 p-1 rounded-lg text-sky-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <p className="text-xs text-gray-600 leading-relaxed pr-6 line-clamp-3">{sample}</p>
              </div>
            ))}
          </div>

          {aspirational.length < 3 ? (
            <div className="space-y-2">
              <textarea
                value={newSample}
                onChange={(e) => setNewSample(e.target.value)}
                placeholder="Paste a post whose writing style you admire…"
                maxLength={3000}
                rows={4}
                className="w-full text-sm rounded-2xl border border-gray-200 px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white placeholder-gray-300"
              />
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-gray-300">{newSample.length}/3000</p>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={newSample.trim().length < 80}
                  onClick={() => {
                    saveAspirational([...aspirational, newSample.trim()]);
                    setNewSample("");
                  }}
                  className="text-xs rounded-xl"
                >
                  Add style target
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400 text-center py-2">3 style targets saved. Remove one to add another.</p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
