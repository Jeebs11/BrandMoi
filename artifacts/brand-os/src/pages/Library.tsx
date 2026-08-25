import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocation, useSearch } from "wouter";
import { Pencil, Trash2, MoreVertical, CheckCircle2, Clock, FileText, BookOpen, BarChart2, X, CalendarDays, Sparkles, Loader2, Upload, Eye, Copy, Check, Zap, ChevronDown, ChevronUp, AlertTriangle, XCircle, Star, ThumbsUp, MessageCircle, Repeat2, Users } from "lucide-react";
import { useListDrafts, useDeleteDraft, useUpdateDraft, useCreateDraft } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { AppShell } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { performanceApi, resonanceMapApi, diagnosisApi, agentApi, studioApi, topicsApi, type PerformanceSignal, type PostDiagnosis, type DiagnosisSection, type StressTestScoreEntry, type StressTestFactor, type Topic, type ResonanceMapEntry } from "@/lib/api";
import { InfoTooltip } from "@/components/InfoTooltip";
import { CalendarHeatmap } from "@/components/CalendarHeatmap";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const AUDIENCE_FILTERS = ["All", "Clients", "Peers", "Recruiters & Headhunters", "Investors", "My audience"];
const FEELING_FILTERS = ["All", "Direct", "Witty", "Vulnerable", "Story", "Contrarian"];
const STATUSES = ["All", "draft", "ready", "published"];

// Map legacy tone values onto the new Feeling chips so historical drafts
// still get matched by the feeling filter.
const TONE_TO_FEELING: Record<string, string> = {
  Direct: "Direct",
  Witty: "Witty",
  Vulnerable: "Vulnerable",
  Story: "Story",
  Contrarian: "Contrarian",
  Bold: "Direct",
  Warm: "Vulnerable",
  Reflective: "Vulnerable",
  Playful: "Witty",
  Authoritative: "Direct",
};

// Maps both legacy Objective values AND new Audience values to chip colours.
const OBJECTIVE_COLORS: Record<string, string> = {
  Clients: "bg-amber-50 text-amber-700",
  Peers: "bg-violet-50 text-violet-700",
  "Recruiters & Headhunters": "bg-sky-50 text-sky-700",
  Investors: "bg-emerald-50 text-emerald-700",
  "My audience": "bg-orange-50 text-orange-700",
  Job: "bg-sky-50 text-sky-700",
  Authority: "bg-violet-50 text-violet-700",
  Documenting: "bg-emerald-50 text-emerald-700",
  Expert: "bg-orange-50 text-orange-700",
  Hiring: "bg-teal-50 text-teal-700",
};

// Old objective → new audience mapping for filter matching.
// Authority/Expert/Documenting collapse into Peers/My audience by intent;
// Investors is a brand-new audience with no legacy equivalent and is matched
// only via persisted structuredBreakdown.audience.
const OBJECTIVE_TO_AUDIENCE: Record<string, string> = {
  Clients: "Clients",
  Job: "Recruiters & Headhunters",
  Hiring: "My audience",
  Authority: "Peers",
  Expert: "Peers",
  Documenting: "My audience",
};

const STATUS_ICONS: Record<string, typeof FileText> = {
  draft: FileText,
  ready: Clock,
  published: CheckCircle2,
};

const STATUS_COLORS: Record<string, string> = {
  draft: "text-gray-500",
  ready: "text-blue-500",
  published: "text-green-600",
};

type PerformanceModalState = {
  draftId: number;
  topic: string;
  existing: PerformanceSignal | null;
  initialTab?: "upload" | "manual";
};

export default function Library() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const isDemo = user?.email === "demo@brandos.app";
  const { toast } = useToast();
  const search = useSearch();
  const highlightId = (() => { const m = new URLSearchParams(search).get("highlight"); return m ? Number(m) : null; })();
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const [audienceFilter, setAudienceFilter] = useState("All");
  const [feelingFilter, setFeelingFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [topicFilter, setTopicFilter] = useState<number | "All">("All");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [viewDraft, setViewDraft] = useState<{ id: number; topic: string; postOutput: string | null; shortPost: string | null; status: string; audience: string; feeling: string } | null>(null);
  const [perfModal, setPerfModal] = useState<PerformanceModalState | null>(null);
  const [perfViewDraft, setPerfViewDraft] = useState<{ topic: string; entry: ResonanceMapEntry } | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [resonanceMap, setResonanceMap] = useState<Record<string, ResonanceMapEntry>>({});
  const [stressScoreMap, setStressScoreMap] = useState<Record<string, StressTestScoreEntry>>({});
  const [diagnosisPanel, setDiagnosisPanel] = useState<{ draftId: number; topic: string; diagnosis: PostDiagnosis | null; loading: boolean } | null>(null);

  const { data: drafts, isLoading, refetch } = useListDrafts();

  useEffect(() => {
    if (highlightId && highlightRef.current) {
      setTimeout(() => highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
    }
  }, [highlightId, drafts]);

  const loadResonanceMap = () => {
    resonanceMapApi.get().then(setResonanceMap).catch(() => {});
  };

  const loadStressScoreMap = () => {
    agentApi.stressTestScores().then(setStressScoreMap).catch(() => {});
  };

  useEffect(() => { loadResonanceMap(); loadStressScoreMap(); }, []);
  useEffect(() => { topicsApi.list().then(setTopics).catch(() => {}); }, []);

  const openDiagnosis = async (draftId: number, topic: string, cachedDiagnosis?: PostDiagnosis | null) => {
    if (cachedDiagnosis) {
      setDiagnosisPanel({ draftId, topic, diagnosis: cachedDiagnosis, loading: false });
      return;
    }
    setDiagnosisPanel({ draftId, topic, diagnosis: null, loading: true });
    try {
      const result = await diagnosisApi.get(draftId);
      setDiagnosisPanel((prev) => prev ? { ...prev, diagnosis: result.diagnosis, loading: false } : null);
    } catch {
      setDiagnosisPanel((prev) => prev ? { ...prev, loading: false } : null);
    }
  };
  const { mutate: deleteDraft, isPending: isDeleting } = useDeleteDraft();
  const { mutate: updateDraft } = useUpdateDraft();

  const filtered = (drafts ?? []).filter((d) => {
    if (audienceFilter !== "All") {
      // Match against either the new audience field (from normaliser) or legacy objective.
      const sb = (d.structuredBreakdown ?? {}) as { audience?: string };
      const draftAudience = sb.audience ?? OBJECTIVE_TO_AUDIENCE[d.objective] ?? d.objective;
      if (draftAudience !== audienceFilter) return false;
    }
    if (feelingFilter !== "All") {
      const sb = (d.structuredBreakdown ?? {}) as { feeling?: string };
      const draftFeeling = sb.feeling ?? TONE_TO_FEELING[d.tone] ?? d.tone;
      if (draftFeeling !== feelingFilter) return false;
    }
    if (statusFilter !== "All" && d.status !== statusFilter) return false;
    if (topicFilter !== "All" && d.topicId !== topicFilter) return false;
    return true;
  });

  const handleDelete = (id: number) => {
    setDeletingId(id);
    deleteDraft(
      { id },
      {
        onSuccess: () => { setDeletingId(null); void refetch(); },
        onError: () => setDeletingId(null),
      }
    );
  };

  const handleStatusChange = (id: number, status: "draft" | "ready" | "published") => {
    updateDraft(
      { id, data: { status } },
      {
        onSuccess: (updated) => {
          void refetch();
          // Same rule-based, publish-time-only nudge as Capture.tsx's ship
          // flow — both hit the same PATCH endpoint, so this covers
          // "Mark as Published" too, not just Ship it.
          const check = updated.authenticityCheck;
          if (!check) return;
          if (check.editPct !== null && check.editPct < 0.1) {
            toast({ title: "This is close to the original AI draft — a real personal pass tends to read (and perform) better." });
          } else if (check.flags.length > 0) {
            toast({ title: `Still has ${check.flags[0]} — worth a quick look before it's out there.` });
          }
        },
      }
    );
  };

  const openPerfModal = async (draftId: number, topic: string, initialTab?: "upload" | "manual") => {
    const existing = await performanceApi.get(draftId).catch(() => null);
    setPerfModal({ draftId, topic, existing, initialTab });
  };

  const handlePerfSuccess = () => {
    void refetch();
    loadResonanceMap();
  };

  return (
    <AppShell>
        <header className="px-6 pt-12 pb-4 bg-white border-b border-gray-100 sticky top-0 z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <BookOpen className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-extrabold text-gray-900">Library</h1>
            </div>
            <div className="flex items-center gap-2">
              {!isDemo && (
                <button
                  onClick={() => setImportOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border border-emerald-200 text-emerald-700 bg-white hover:bg-emerald-50 transition-all"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Add past post
                </button>
              )}
              <button
                onClick={() => setShowHeatmap((v) => !v)}
                className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all",
                  showHeatmap ? "bg-primary text-white border-primary" : "bg-white text-gray-500 border-gray-200 hover:border-primary/40")}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                Rhythm
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {AUDIENCE_FILTERS.map((a) => (
                <button key={a} onClick={() => setAudienceFilter(a)}
                  className={cn("px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border",
                    audienceFilter === a ? "bg-primary text-white border-primary" : "bg-white text-gray-500 border-gray-200 hover:border-primary/40")}
                >{a}</button>
              ))}
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {FEELING_FILTERS.map((f) => (
                <button key={f} onClick={() => setFeelingFilter(f)}
                  className={cn("px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border",
                    feelingFilter === f ? "bg-violet-600 text-white border-violet-600" : "bg-white text-gray-500 border-gray-200 hover:border-violet-400")}
                >{f}</button>
              ))}
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {STATUSES.map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={cn("px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border capitalize",
                    statusFilter === s ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-500 border-gray-200 hover:border-gray-400")}
                >{s}</button>
              ))}
            </div>
            {topics.length > 0 && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                <button onClick={() => setTopicFilter("All")}
                  className={cn("px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border",
                    topicFilter === "All" ? "bg-sky-600 text-white border-sky-600" : "bg-white text-gray-500 border-gray-200 hover:border-sky-400")}
                >All topics</button>
                {topics.map((t) => (
                  <button key={t.id} onClick={() => setTopicFilter(t.id)}
                    className={cn("px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border",
                      topicFilter === t.id ? "bg-sky-600 text-white border-sky-600" : "bg-white text-gray-500 border-gray-200 hover:border-sky-400")}
                  >{t.name}</button>
                ))}
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 px-4 py-4 space-y-3 overflow-y-auto">
          {showHeatmap && (
            <CalendarHeatmap
              dates={(drafts ?? []).map((d) => d.createdAt)}
            />
          )}
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center px-8">
              <BookOpen className="w-12 h-12 text-gray-200 mb-4" />
              <p className="font-bold text-gray-600 mb-1">Nothing here yet</p>
              <p className="text-sm text-gray-400">
                {audienceFilter !== "All" || statusFilter !== "All" ? "Try adjusting your filters." : "Capture an idea to get started."}
              </p>
            </div>
          ) : (
            filtered.map((draft) => {
              const topic = (draft.structuredBreakdown as { topic?: string })?.topic ?? "Untitled";
              const StatusIcon = STATUS_ICONS[draft.status] ?? FileText;
              const isBeingDeleted = deletingId === draft.id && isDeleting;
              const isHighlighted = draft.id === highlightId;
              return (
                <div
                  key={draft.id}
                  ref={isHighlighted ? highlightRef : null}
                  className={cn("bg-white rounded-2xl border p-4 transition-opacity", isBeingDeleted && "opacity-40", isHighlighted ? "border-violet-400 ring-2 ring-violet-200" : "border-gray-100")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-gray-900 truncate mb-1">{topic}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", OBJECTIVE_COLORS[draft.objective] ?? "bg-gray-100 text-gray-600")}>
                          {draft.objective}
                        </span>
                        <div className={cn("flex items-center gap-1 text-[10px] font-bold capitalize", STATUS_COLORS[draft.status])}>
                          <StatusIcon className="w-3 h-3" />
                          {draft.status}
                        </div>
                        {draft.shortPost && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            ⚡ Short
                          </span>
                        )}
                        {draft.externalId && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                            via LinkedIn {draft.postType === "article" ? "· Article" : "· Post"}
                          </span>
                        )}
                        {draft.seriesId && draft.seriesPart && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                            Part {draft.seriesPart}
                          </span>
                        )}
                        <span className="text-[10px] text-gray-300">
                          {new Date(draft.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                        {resonanceMap[String(draft.id)] !== undefined && (
                          <>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                              ◈ logged
                            </span>
                            {resonanceMap[String(draft.id)].engagementRate !== null && (
                              <InfoTooltip content="Engagement rate — reactions + comments + reposts, divided by impressions. LinkedIn's own measure of how well a post did relative to how many people saw it.">
                                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", resonanceMap[String(draft.id)].resonance >= 60 ? "bg-violet-50 text-violet-700" : "bg-gray-50 text-gray-500")}>
                                  {resonanceMap[String(draft.id)].engagementRate}% engagement
                                </span>
                              </InfoTooltip>
                            )}
                          </>
                        )}
                        {stressScoreMap[String(draft.id)] !== undefined && (
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5",
                            stressScoreMap[String(draft.id)].publishReady
                              ? "bg-emerald-50 text-emerald-700"
                              : stressScoreMap[String(draft.id)].score >= 65
                              ? "bg-amber-50 text-amber-700"
                              : "bg-red-50 text-red-600"
                          )}>
                            {stressScoreMap[String(draft.id)].score}/100
                          </span>
                        )}
                      </div>
                      {(resonanceMap[String(draft.id)]?.resonance ?? 0) >= 60 && (
                        <button
                          onClick={() => void openDiagnosis(draft.id, topic, draft.diagnosis)}
                          className="mt-2 flex items-center gap-1 text-xs text-violet-600 font-semibold hover:text-violet-800 transition-colors"
                        >
                          <Sparkles className="w-3 h-3" /> Why it worked →
                        </button>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors flex-shrink-0">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[190px]">
                        <DropdownMenuItem onClick={() => {
                          const sb = (draft.structuredBreakdown ?? {}) as { feeling?: string; audience?: string };
                          setViewDraft({
                            id: draft.id,
                            topic,
                            postOutput: draft.postOutput ?? null,
                            shortPost: draft.shortPost ?? null,
                            status: draft.status,
                            audience: sb.audience ?? OBJECTIVE_TO_AUDIENCE[draft.objective] ?? draft.objective ?? "",
                            feeling: sb.feeling ?? TONE_TO_FEELING[draft.tone] ?? draft.tone ?? "",
                          });
                        }}>
                          <Eye className="w-4 h-4 mr-2" /> View post
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/capture?draftId=${draft.id}`)}>
                          <Pencil className="w-4 h-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        {!isDemo && (
                          <DropdownMenuItem onClick={() => {
                            const sb = (draft.structuredBreakdown ?? {}) as { feeling?: string; audience?: string };
                            const draftFeeling = sb.feeling ?? TONE_TO_FEELING[draft.tone] ?? "Direct";
                            const draftAudience = sb.audience ?? OBJECTIVE_TO_AUDIENCE[draft.objective] ?? draft.objective ?? "My audience";
                            const hook = draft.postOutput?.split("\n").map(l => l.trim()).find(l => l.length > 10)?.slice(0, 100) ?? topic;
                            navigate(`/capture?audience=${encodeURIComponent(draftAudience)}&feeling=${encodeURIComponent(draftFeeling)}&raw=${encodeURIComponent(`More like: ${hook}`)}`);
                          }}>
                            <Sparkles className="w-4 h-4 mr-2 text-violet-500" /> More like this
                          </DropdownMenuItem>
                        )}
                        {!isDemo && draft.status === "published" && (
                          <>
                            {resonanceMap[String(draft.id)] !== undefined && (
                              <DropdownMenuItem onClick={() => setPerfViewDraft({ topic, entry: resonanceMap[String(draft.id)]! })}>
                                <BarChart2 className="w-4 h-4 mr-2 text-emerald-500" /> View performance
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => void openPerfModal(draft.id, topic, "upload")}>
                              <Upload className="w-4 h-4 mr-2 text-violet-500" /> Upload LinkedIn analytics
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void openPerfModal(draft.id, topic, "manual")}>
                              <BarChart2 className="w-4 h-4 mr-2 text-gray-500" /> Log Performance manually
                            </DropdownMenuItem>
                          </>
                        )}
                        {!isDemo && (
                          <>
                            <DropdownMenuSeparator />
                            {draft.status !== "draft" && (
                              <DropdownMenuItem onClick={() => handleStatusChange(draft.id, "draft")}>
                                <FileText className="w-4 h-4 mr-2 text-gray-500" /> Mark as Draft
                              </DropdownMenuItem>
                            )}
                            {draft.status !== "ready" && (
                              <DropdownMenuItem onClick={() => handleStatusChange(draft.id, "ready")}>
                                <Clock className="w-4 h-4 mr-2 text-blue-500" /> Mark as Ready
                              </DropdownMenuItem>
                            )}
                            {draft.status !== "published" && (
                              <DropdownMenuItem onClick={() => handleStatusChange(draft.id, "published")}>
                                <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" /> Mark as Published
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => {
                              const current = (draft as typeof draft & { isVoiceSample?: boolean }).isVoiceSample;
                              updateDraft({ id: draft.id, data: { isVoiceSample: !current } });
                            }}>
                              <Star className={cn("w-4 h-4 mr-2", (draft as typeof draft & { isVoiceSample?: boolean }).isVoiceSample ? "fill-amber-400 text-amber-400" : "text-gray-400")} />
                              {(draft as typeof draft & { isVoiceSample?: boolean }).isVoiceSample ? "Remove Voice Sample" : "This is my voice"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600 focus:bg-red-50"
                              onClick={() => {
                                if (confirm(`Delete "${topic}"? This can't be undone.`)) handleDelete(draft.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })
          )}
        </main>

        {viewDraft && (
          <ViewPostModal
            draft={viewDraft}
            onClose={() => setViewDraft(null)}
            onEdit={() => { setViewDraft(null); navigate(`/capture?draftId=${viewDraft.id}`); }}
            stressScore={stressScoreMap[String(viewDraft.id)]}
          />
        )}

        {perfModal && (
          <PerformanceModal
            modal={perfModal}
            onClose={() => setPerfModal(null)}
            onSuccess={handlePerfSuccess}
          />
        )}

        {perfViewDraft && (
          <PerformanceViewModal
            topic={perfViewDraft.topic}
            entry={perfViewDraft.entry}
            onClose={() => setPerfViewDraft(null)}
          />
        )}

        {importOpen && (
          <ImportPastPostModal
            onClose={() => setImportOpen(false)}
            onSuccess={() => { setImportOpen(false); void refetch(); }}
          />
        )}

        {diagnosisPanel && createPortal(
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDiagnosisPanel(null)} />
            <div className="relative w-full max-w-[430px] bg-white rounded-t-3xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <Sparkles className="w-4 h-4 text-violet-500" />
                    <h3 className="font-extrabold text-gray-900">Why It Worked</h3>
                  </div>
                  <p className="text-xs text-gray-400 ml-6 truncate max-w-[280px]">{diagnosisPanel.topic}</p>
                </div>
                <button onClick={() => setDiagnosisPanel(null)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {diagnosisPanel.loading ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
                  <p className="text-sm text-gray-500">Analysing your post...</p>
                </div>
              ) : diagnosisPanel.diagnosis ? (
                <div className="space-y-4">
                  <div className="bg-violet-50 rounded-2xl p-4">
                    <p className="text-sm font-bold text-violet-800 leading-relaxed">{diagnosisPanel.diagnosis.headline}</p>
                  </div>
                  {diagnosisPanel.diagnosis.sections && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Section breakdown</p>
                      {(["hook", "body", "tone", "cta", "visual"] as const).map((key) => {
                        const sec = diagnosisPanel.diagnosis!.sections?.[key] as DiagnosisSection | undefined;
                        if (!sec) return null;
                        const ratingColor = sec.rating === null ? "text-gray-400" : sec.rating >= 4 ? "text-emerald-600" : sec.rating >= 3 ? "text-amber-600" : "text-red-500";
                        return (
                          <div key={key} className="flex items-start gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                            <div className="flex-shrink-0 w-12">
                              <p className="text-[10px] font-bold text-gray-500 uppercase">{key}</p>
                              <p className={`text-xs font-black ${ratingColor}`}>{sec.rating !== null ? `${sec.rating}/5` : "—"}</p>
                            </div>
                            <p className="text-xs text-gray-600 leading-relaxed flex-1">{sec.analysis}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">What made it click</p>
                    <div className="space-y-2">
                      {diagnosisPanel.diagnosis.reasons.map((reason, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-600 text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                          <p className="text-sm text-gray-700 leading-relaxed">{reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Replicate this</p>
                    <p className="text-sm text-emerald-800 leading-relaxed">{diagnosisPanel.diagnosis.replicateTip}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500">Could not generate diagnosis. Try again later.</p>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </AppShell>
  );
}

function FactorBreakdown({ factors }: { factors: StressTestFactor[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  return (
    <div className="px-4 pb-4 space-y-1.5 border-t border-gray-100">
      {factors.map((f, i) => {
        const pct = f.score / f.maxScore;
        const FactorIcon = pct >= 1 ? CheckCircle2 : pct >= 0.6 ? AlertTriangle : XCircle;
        const iconColor = pct >= 1 ? "text-emerald-500" : pct >= 0.6 ? "text-amber-500" : "text-red-500";
        const isOpen = expanded === i;
        return (
          <div key={i} className="bg-white rounded-xl overflow-hidden">
            <button
              onClick={() => setExpanded(isOpen ? null : i)}
              className="w-full flex items-center gap-2.5 p-3 text-left"
            >
              <FactorIcon className={cn("w-4 h-4 flex-shrink-0", iconColor)} />
              <span className="flex-1 text-xs font-semibold text-gray-800">{f.name}</span>
              <span className={cn("text-xs font-bold tabular-nums mr-1", pct >= 1 ? "text-emerald-600" : pct >= 0.6 ? "text-amber-600" : "text-red-500")}>
                {f.score}/{f.maxScore}
              </span>
              {isOpen ? <ChevronUp className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
            </button>
            {isOpen && (
              <div className="px-3 pb-3 space-y-1.5 border-t border-gray-100">
                {f.why && (
                  <p className="text-[11px] text-gray-600 leading-relaxed">
                    <span className="font-semibold text-gray-700">Why: </span>{f.why}
                  </p>
                )}
                {f.howToFix && (
                  <p className="text-[11px] text-gray-600 leading-relaxed">
                    <span className="font-semibold text-gray-700">How to fix: </span>{f.howToFix}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
      <p className="text-[10px] text-gray-400 text-center pt-1">Open in editor to apply fixes and re-test</p>
    </div>
  );
}

function ViewPostModal({
  draft,
  onClose,
  onEdit,
  stressScore,
}: {
  draft: { id: number; topic: string; postOutput: string | null; shortPost: string | null; status: string; audience: string; feeling: string };
  onClose: () => void;
  onEdit: () => void;
  stressScore?: StressTestScoreEntry;
}) {
  const [activeTab, setActiveTab] = useState<"post" | "short">("post");
  const [copied, setCopied] = useState(false);
  const [stressExpanded, setStressExpanded] = useState(false);

  const text = activeTab === "short" ? draft.shortPost : draft.postOutput;

  const handleCopy = () => {
    if (!text) return;
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const StatusIcon = STATUS_ICONS[draft.status] ?? FileText;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[430px] bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 mb-1">
              <Eye className="w-4 h-4 text-violet-500 flex-shrink-0" />
              <h3 className="font-extrabold text-gray-900 text-sm truncate">{draft.topic}</h3>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {draft.audience && (
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", OBJECTIVE_COLORS[draft.audience] ?? "bg-gray-100 text-gray-600")}>
                  {draft.audience}
                </span>
              )}
              {draft.feeling && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  {draft.feeling}
                </span>
              )}
              <div className={cn("flex items-center gap-1 text-[10px] font-bold capitalize", STATUS_COLORS[draft.status])}>
                <StatusIcon className="w-3 h-3" />
                {draft.status}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs — only show if short post exists */}
        {draft.shortPost && (
          <div className="flex gap-1 p-1 mx-6 mt-4 bg-gray-100 rounded-xl flex-shrink-0">
            {(["post", "short"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={cn(
                  "flex-1 py-2 rounded-lg text-xs font-bold transition-all",
                  activeTab === t ? "bg-white text-violet-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}
              >
                {t === "post" ? "Full post" : "⚡ Short version"}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {text ? (
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{text}</p>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="w-10 h-10 text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">No content saved yet.</p>
              <p className="text-xs text-gray-300 mt-1">Tap Edit to write or generate content.</p>
            </div>
          )}

          {/* Stress test score section */}
          {stressScore && (
            <div className={cn(
              "border rounded-2xl overflow-hidden",
              stressScore.publishReady ? "border-emerald-200 bg-emerald-50/50" : stressScore.score >= 65 ? "border-amber-200 bg-amber-50/50" : "border-red-200 bg-red-50/50"
            )}>
              <button
                className="w-full flex items-center justify-between px-4 py-3"
                onClick={() => setStressExpanded((v) => !v)}
              >
                <div className="flex items-center gap-2.5">
                  <Zap className={cn("w-4 h-4", stressScore.publishReady ? "text-emerald-600" : stressScore.score >= 65 ? "text-amber-600" : "text-red-500")} />
                  <div className="text-left">
                    <p className="text-xs font-extrabold text-gray-800">Stress Test Score</p>
                    <p className={cn("text-[10px] font-semibold", stressScore.publishReady ? "text-emerald-700" : stressScore.score >= 65 ? "text-amber-700" : "text-red-600")}>
                      {stressScore.publishReady ? "Publish ready" : stressScore.score >= 65 ? "Needs minor fixes" : "Needs improvement"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-xl font-black tabular-nums", stressScore.publishReady ? "text-emerald-700" : stressScore.score >= 65 ? "text-amber-700" : "text-red-600")}>
                    {stressScore.score}
                  </span>
                  {stressExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </button>

              {stressExpanded && stressScore.factors && stressScore.factors.length > 0 && (
                <FactorBreakdown factors={stressScore.factors} />
              )}

              {stressExpanded && (!stressScore.factors || stressScore.factors.length === 0) && (
                <p className="px-4 pb-4 text-xs text-gray-400">Factor breakdown not available for this result.</p>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex gap-2 px-6 pb-6 pt-3 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={handleCopy}
            disabled={!text}
            className={cn(
              "flex items-center gap-1.5 px-4 py-3 rounded-2xl text-sm font-bold border-2 transition-all",
              copied
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 disabled:opacity-40"
            )}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-2 h-12 rounded-2xl font-bold text-sm bg-primary text-white hover:bg-primary/90 transition-all"
          >
            <Pencil className="w-4 h-4" />
            Edit in BrandMoi
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function PerformanceModal({ modal, onClose, onSuccess }: { modal: PerformanceModalState; onClose: () => void; onSuccess: () => void }) {
  const [tab, setTab] = useState<"upload" | "manual">(modal.initialTab ?? "upload");
  const [impressions, setImpressions] = useState(modal.existing?.impressions ?? 0);
  const [reactions, setReactions] = useState(modal.existing?.reactions ?? 0);
  const [comments, setComments] = useState(modal.existing?.comments ?? 0);
  const [reposts, setReposts] = useState(modal.existing?.reposts ?? 0);
  const [saves, setSaves] = useState(modal.existing?.saves ?? 0);
  const [linkedinUrl, setLinkedinUrl] = useState(modal.existing?.linkedinUrl ?? "");
  const [parsedLinkedinUrl, setParsedLinkedinUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<"idle" | "staged" | "analysing" | "results" | "error">("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [uploadAnalysis, setUploadAnalysis] = useState<{
    metrics: { impressions: number; reactions: number; comments: number; reposts: number; saves: number; membersReached: number };
    strengths: string[];
    takeaways: string[];
    futureImprovement: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const normalizeUrl = (u: string) => u.trim().replace(/\/$/, "").toLowerCase();
  const urlMatchStatus: "match" | "mismatch" | "parsed-only" | "typed-only" | null = (() => {
    const typed = linkedinUrl.trim();
    const parsed = parsedLinkedinUrl;
    if (!typed && !parsed) return null;
    if (typed && !parsed) return "typed-only";
    if (!typed && parsed) return "parsed-only";
    return normalizeUrl(typed) === normalizeUrl(parsed!) ? "match" : "mismatch";
  })();

  const resonanceScore = (() => {
    const reach = (modal.existing?.membersReached ?? 0) > 0 ? (modal.existing?.membersReached ?? 0) : impressions;
    const w = reactions * 3 + comments * 5 + reposts * 4 + saves * 8;
    if (reach > 0) return Math.min(100, Math.round((w / reach) * 1000));
    return 0;
  })();
  const engagementRate = impressions > 0
    ? Math.round(((reactions + comments + reposts) / impressions) * 10000) / 100
    : null;

  const handleFileStage = (file: File) => {
    setStagedFile(file);
    setUploadPhase("staged");
    setUploadError(null);
  };

  const handleAnalyse = async () => {
    if (!stagedFile) return;
    setUploadPhase("analysing");
    setUploadError(null);
    try {
      const result = await performanceApi.uploadXlsx(modal.draftId, stagedFile);
      const { signal } = result;
      setImpressions(signal.impressions);
      setReactions(signal.reactions);
      setComments(signal.comments);
      setReposts(signal.reposts);
      setSaves(signal.saves);
      if (signal.linkedinUrl) {
        setParsedLinkedinUrl(signal.linkedinUrl);
        if (!linkedinUrl.trim()) setLinkedinUrl(signal.linkedinUrl);
      }
      setUploadAnalysis({
        metrics: {
          impressions: signal.impressions,
          reactions: signal.reactions,
          comments: signal.comments,
          reposts: signal.reposts,
          saves: signal.saves,
          membersReached: signal.membersReached,
        },
        strengths: result.analysis?.strengths ?? [],
        takeaways: result.analysis?.takeaways ?? [],
        futureImprovement: result.analysis?.futureImprovement ?? "",
      });
      setUploadPhase("results");
      onSuccess();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
      setUploadPhase("error");
    }
  };

  const handleManualSave = async () => {
    setSaving(true);
    try {
      await performanceApi.log(modal.draftId, {
        impressions, reactions, comments, reposts, saves,
        linkedinUrl: linkedinUrl.trim() || null,
      });
      setSaved(true);
      onSuccess();
      setTimeout(onClose, 1200);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[430px] bg-white rounded-t-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <BarChart2 className="w-4 h-4 text-violet-500" />
              <h3 className="font-extrabold text-gray-900">Log Performance</h3>
            </div>
            <p className="text-xs text-gray-400 ml-6 truncate max-w-[280px]">{modal.topic}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-5">
          {(["upload", "manual"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn("flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                tab === t ? "bg-white text-violet-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}
            >
              {t === "upload" ? <><Upload className="w-3.5 h-3.5" /> Upload xlsx</> : <><Pencil className="w-3.5 h-3.5" /> Enter manually</>}
            </button>
          ))}
        </div>

        {tab === "upload" ? (
          <div>
            {uploadPhase === "results" && uploadAnalysis ? (
              /* ── Analysis results popup ── */
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-600 font-black text-sm">✓</span>
                  </div>
                  <div>
                    <p className="font-extrabold text-gray-900 text-sm">Analysis complete</p>
                    <p className="text-[11px] text-gray-400">AI has learned from this post</p>
                  </div>
                </div>

                {/* Metrics row */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { label: "impressions", value: uploadAnalysis.metrics.impressions },
                    { label: "reached", value: uploadAnalysis.metrics.membersReached },
                    { label: "reactions", value: uploadAnalysis.metrics.reactions },
                    { label: "comments", value: uploadAnalysis.metrics.comments },
                    { label: "saves", value: uploadAnalysis.metrics.saves },
                    { label: "reposts", value: uploadAnalysis.metrics.reposts },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-gray-50 rounded-xl p-2.5 text-center">
                      <div className="font-black text-gray-900 text-sm">{value.toLocaleString()}</div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</div>
                    </div>
                  ))}
                </div>

                {/* URL match status */}
                {parsedLinkedinUrl && (
                  <div className={cn("flex items-center gap-1.5 mb-3 text-xs font-semibold px-1",
                    urlMatchStatus === "match" ? "text-emerald-600" : urlMatchStatus === "mismatch" ? "text-amber-600" : "text-gray-400"
                  )}>
                    {urlMatchStatus === "match" && <><span>✓</span> URL matches the file</>}
                    {urlMatchStatus === "mismatch" && <><span>⚠</span> URL in file differs — double-check you chose the right post</>}
                    {urlMatchStatus === "parsed-only" && <><span>→</span> URL auto-filled from file</>}
                  </div>
                )}

                {/* AI diagnosis */}
                {uploadAnalysis.strengths.length > 0 && (
                  <div className="mb-3 p-3.5 bg-violet-50 rounded-2xl border border-violet-100">
                    <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider mb-2">What worked</p>
                    <div className="space-y-1.5">
                      {uploadAnalysis.strengths.map((s, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-violet-200 text-violet-700 text-[9px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                          <p className="text-xs text-gray-700 leading-relaxed">{s}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {uploadAnalysis.takeaways.length > 0 && (
                  <div className="mb-3 p-3.5 bg-blue-50 rounded-2xl border border-blue-100">
                    <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-2">Key takeaways</p>
                    <div className="space-y-1.5">
                      {uploadAnalysis.takeaways.map((t, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-blue-400 font-black text-xs flex-shrink-0 mt-0.5">→</span>
                          <p className="text-xs text-gray-700 leading-relaxed">{t}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {uploadAnalysis.futureImprovement && (
                  <div className="mb-4 p-3.5 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1.5">How this improves your content</p>
                    <p className="text-xs text-emerald-800 leading-relaxed">{uploadAnalysis.futureImprovement}</p>
                  </div>
                )}

                <button
                  onClick={onClose}
                  className="w-full h-12 rounded-2xl font-bold text-sm bg-primary text-white hover:bg-primary/90 transition-all"
                >
                  Done
                </button>
              </div>
            ) : (
              /* ── Upload / stage flow ── */
              <div>
                <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                  Export your post's analytics from LinkedIn (Content → Post → Export) and upload the <strong>.xlsx</strong> file. The AI will learn what content works best for your audience.
                </p>

                {/* URL input */}
                <div className="mb-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">LinkedIn post URL</p>
                  <input
                    type="url"
                    placeholder="https://www.linkedin.com/posts/..."
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-semibold outline-none focus:border-primary transition-colors placeholder:font-normal placeholder:text-gray-300"
                  />
                </div>

                {/* File select area */}
                {uploadPhase === "staged" && stagedFile ? (
                  <div className="border-2 border-emerald-200 bg-emerald-50 rounded-2xl p-4 flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <Upload className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-emerald-800 truncate">{stagedFile.name}</p>
                      <p className="text-[11px] text-emerald-600">{(stagedFile.size / 1024).toFixed(0)} KB · ready to analyse</p>
                    </div>
                    <button
                      onClick={() => { setStagedFile(null); setUploadPhase("idle"); setUploadError(null); }}
                      className="text-emerald-400 hover:text-emerald-600 transition-colors p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploadPhase === "analysing"}
                    className={cn(
                      "w-full border-2 border-dashed rounded-2xl p-8 flex flex-col items-center gap-3 transition-all mb-3",
                      uploadPhase === "error" ? "border-red-300 bg-red-50" : "border-violet-200 bg-violet-50 hover:bg-violet-100 hover:border-violet-400",
                      uploadPhase === "analysing" && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    <Upload className="w-8 h-8 text-violet-400" />
                    <div className="text-center">
                      <p className="text-sm font-bold text-violet-700">Tap to choose xlsx file</p>
                      <p className="text-xs text-violet-400 mt-0.5">LinkedIn single-post export · max 2 MB</p>
                    </div>
                  </button>
                )}

                {uploadPhase === "error" && uploadError && (
                  <p className="text-xs text-red-500 mb-3 text-center">{uploadError}</p>
                )}

                {/* Analyse button — only shown when a file is staged */}
                {uploadPhase === "staged" || uploadPhase === "analysing" ? (
                  <button
                    onClick={() => void handleAnalyse()}
                    disabled={uploadPhase === "analysing"}
                    className={cn(
                      "w-full h-12 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2",
                      uploadPhase === "analysing"
                        ? "bg-violet-100 text-violet-400 cursor-not-allowed"
                        : "bg-primary text-white hover:bg-primary/90"
                    )}
                  >
                    {uploadPhase === "analysing" ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Analysing post…</>
                    ) : (
                      "Analyse this post"
                    )}
                  </button>
                ) : null}

                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileStage(file);
                    e.target.value = "";
                  }}
                />
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="space-y-3 mb-5">
              <NumberInput label="Impressions" value={impressions} onChange={setImpressions} />
              <NumberInput label="Reactions" value={reactions} onChange={setReactions} />
              <NumberInput label="Comments" value={comments} onChange={setComments} />
              <NumberInput label="Reposts" value={reposts} onChange={setReposts} />
              <NumberInput label="Saves" value={saves} onChange={setSaves} />
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">LinkedIn post URL (optional)</p>
                <input
                  type="url"
                  placeholder="https://www.linkedin.com/posts/..."
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-semibold outline-none focus:border-primary transition-colors placeholder:font-normal placeholder:text-gray-300"
                />
              </div>
            </div>

            {impressions > 0 && (
              <div className="flex items-center gap-3 p-3 bg-violet-50 rounded-xl mb-4">
                <div className="flex-1">
                  <InfoTooltip
                    className="mb-0.5"
                    content="Engagement rate — reactions + comments + reposts, divided by impressions. LinkedIn's own measure of how well a post did relative to how many people saw it."
                  >
                    <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider">Engagement rate</p>
                  </InfoTooltip>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-violet-700">{engagementRate ?? 0}</span>
                    <span className="text-xs text-violet-400 font-bold">%</span>
                  </div>
                  <p className="text-[10px] text-violet-400 mt-0.5">{reactions + comments + reposts} reactions, comments &amp; reposts · {impressions.toLocaleString()} impressions</p>
                </div>
                <div className="w-16 h-16 relative flex items-center justify-center">
                  <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="26" fill="none" stroke="#ede9fe" strokeWidth="8" />
                    <circle cx="32" cy="32" r="26" fill="none" stroke="#7c3aed" strokeWidth="8"
                      strokeDasharray={`${(resonanceScore / 100) * 163} 163`} strokeLinecap="round" />
                  </svg>
                  <span className="absolute text-xs font-black text-violet-700">{resonanceScore}</span>
                </div>
              </div>
            )}

            <button
              onClick={() => void handleManualSave()}
              disabled={saving || saved}
              className={cn("w-full h-12 rounded-2xl font-bold text-sm transition-all",
                saved ? "bg-green-500 text-white" : "bg-primary text-white hover:bg-primary/90 disabled:opacity-60"
              )}
            >
              {saved ? "✓ Saved" : saving ? "Saving..." : "Save performance data"}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">{label}</p>
      <input
        type="number"
        min="0"
        value={value}
        onChange={(e) => onChange(Math.max(0, parseInt(e.target.value) || 0))}
        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-semibold outline-none focus:border-primary transition-colors"
      />
    </div>
  );
}

// ── Quick performance breakdown ─────────────────────────────────────────────
// Read-only view opened from the "···" menu once a post has logged
// performance — reuses the same ResonanceMapEntry the list badge already
// fetched, no extra request. Impressions is shown as reach (not a bar, since
// it's the denominator and dwarfs the others); reactions/comments/reposts get
// bars scaled against each other so their relative weight is legible.
function PerformanceViewModal({ topic, entry, onClose }: { topic: string; entry: ResonanceMapEntry; onClose: () => void }) {
  const rows = [
    { label: "Reactions", value: entry.reactions, icon: ThumbsUp, color: "bg-violet-500" },
    { label: "Comments", value: entry.comments, icon: MessageCircle, color: "bg-sky-500" },
    { label: "Reposts", value: entry.reposts, icon: Repeat2, color: "bg-emerald-500" },
  ];
  const max = Math.max(...rows.map((r) => r.value), 1);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[430px] bg-white rounded-t-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <BarChart2 className="w-4 h-4 text-emerald-500" />
              <h3 className="font-extrabold text-gray-900">Performance</h3>
            </div>
            <p className="text-xs text-gray-400 ml-6 truncate max-w-[280px]">{topic}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-violet-50 rounded-2xl p-4 mb-5 flex items-center justify-between">
          <div>
            <InfoTooltip content="Reactions + comments + reposts, divided by impressions. LinkedIn's own measure of how well a post did relative to how many people saw it.">
              <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider mb-0.5">Engagement rate</p>
            </InfoTooltip>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-violet-700">{entry.engagementRate ?? 0}</span>
              <span className="text-sm text-violet-400 font-bold">%</span>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5 text-gray-500">
              <Users className="w-3.5 h-3.5" />
              <span className="text-lg font-extrabold text-gray-800 tabular-nums">{entry.impressions.toLocaleString()}</span>
            </div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Impressions</p>
          </div>
        </div>

        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Engagement breakdown</p>
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-3">
              <r.icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-xs text-gray-600 font-medium w-20 flex-shrink-0">{r.label}</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full", r.color)} style={{ width: `${Math.round((r.value / max) * 100)}%` }} />
              </div>
              <span className="text-xs font-extrabold text-gray-800 tabular-nums w-8 text-right flex-shrink-0">{r.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Import a past LinkedIn post ─────────────────────────────────────────────
// Two-step verification flow: paste the post text, then upload its LinkedIn
// single-post analytics .xlsx. The export is only available to the post's
// author, so a successful parse doubles as ownership verification — the post
// only becomes "published" evidence after the upload succeeds. If the upload
// fails, the draft is deleted so unverified text never enters the voice DNA.
function ImportPastPostModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const { mutateAsync: createDraftAsync } = useCreateDraft();
  const { mutateAsync: updateDraftAsync } = useUpdateDraft();
  const { mutateAsync: deleteDraftAsync } = useDeleteDraft();

  const handleImport = async () => {
    if (busy || text.trim().length < 80 || !file) return;
    setBusy(true);
    const trimmed = text.trim();
    const fallbackTopic = trimmed.split("\n").find((l) => l.trim())?.slice(0, 80) ?? "Past LinkedIn post";

    // Classify the post so it gets real audience/feeling/topic labels instead
    // of defaults. Best-effort — a failed classification never blocks import.
    const cls = await studioApi.classifyPost(trimmed).catch(() => null);
    const topic = cls?.topic ?? fallbackTopic;

    let draftId: number | null = null;
    try {
      const draft = await createDraftAsync({
        data: {
          rawInput: trimmed,
          objective: cls?.objective ?? "Authority",
          persona: "Founder",
          tone: cls?.tone ?? "Direct",
          structuredBreakdown: {
            topic,
            angle: "Imported past post",
            coreMessage: trimmed.slice(0, 200),
            whyItMatters: "Imported with verified LinkedIn analytics",
            hooks: [{ text: topic }],
            narrativeFlow: [],
            ...(cls ? { audience: cls.audience, feeling: cls.feeling } : {}),
          },
          postOutput: trimmed,
          status: "draft",
          contentSource: "linkedin",
        },
      });
      draftId = draft.id;

      // Ownership gate: the analytics export must parse before this counts.
      await performanceApi.uploadXlsx(draft.id, file);
      await updateDraftAsync({ id: draft.id, data: { status: "published" } });

      toast({ title: "✓ Post verified & imported", description: "Performance attached — it now feeds your voice DNA and learned patterns." });
      onSuccess();
    } catch (err: unknown) {
      // Roll back the unverified draft
      if (draftId) { try { await deleteDraftAsync({ id: draftId }); } catch { /* already gone */ } }
      const msg = err instanceof Error ? err.message : "Import failed.";
      toast({ title: "Couldn't verify this post", description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[430px] bg-white rounded-t-3xl shadow-2xl flex flex-col" style={{ maxHeight: "88vh" }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-emerald-600" />
            <h3 className="font-extrabold text-gray-900">Add a past post</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
            <p className="text-[11px] text-amber-800 leading-relaxed">
              <span className="font-bold">Your own posts only.</span> The post is verified by uploading its LinkedIn analytics export — only the author can download that file. It won't count toward your voice or brand evidence until verification succeeds.
            </p>
          </div>

          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Step 1 · Paste the post</p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste the full text of a LinkedIn post you published…"
              maxLength={5000}
              rows={7}
              className="w-full text-sm rounded-2xl border border-gray-200 px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white placeholder-gray-300"
            />
            <p className="text-[10px] text-gray-300 text-right">{text.length}/5000</p>
          </div>

          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Step 2 · Verify with its analytics export</p>
            <label className={cn(
              "w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border-2 border-dashed cursor-pointer transition-all text-sm font-bold",
              file ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-gray-200 text-gray-400 hover:border-emerald-300"
            )}>
              <input
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <Upload className="w-4 h-4" />
              {file ? file.name : "Upload the post's LinkedIn analytics .xlsx"}
            </label>
            <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">On LinkedIn: open your post → View analytics → Export. The numbers attach automatically.</p>
          </div>
        </div>

        <div className="px-5 pb-6 pt-3 border-t border-gray-100 flex gap-3">
          <Button variant="outline" className="flex-1 h-12 rounded-2xl text-sm font-bold border-gray-200 text-gray-600" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-[2] h-12 rounded-2xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700"
            onClick={() => void handleImport()}
            disabled={busy || text.trim().length < 80 || !file}
          >
            {busy ? "Verifying…" : "Verify & import"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
