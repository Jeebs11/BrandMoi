import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocation, useSearch } from "wouter";
import { Pencil, Trash2, MoreVertical, CheckCircle2, Clock, FileText, BookOpen, BarChart2, X, CalendarDays, Sparkles, Loader2, Upload } from "lucide-react";
import { useListDrafts, useDeleteDraft, useUpdateDraft } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { AppShell } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { performanceApi, resonanceMapApi, diagnosisApi, type PerformanceSignal, type PostDiagnosis, type DiagnosisSection } from "@/lib/api";
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
  const search = useSearch();
  const highlightId = (() => { const m = new URLSearchParams(search).get("highlight"); return m ? Number(m) : null; })();
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const [audienceFilter, setAudienceFilter] = useState("All");
  const [feelingFilter, setFeelingFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [perfModal, setPerfModal] = useState<PerformanceModalState | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [resonanceMap, setResonanceMap] = useState<Record<string, number>>({});
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

  useEffect(() => { loadResonanceMap(); }, []);

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
      { onSuccess: () => void refetch() }
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
            <button
              onClick={() => setShowHeatmap((v) => !v)}
              className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all",
                showHeatmap ? "bg-primary text-white border-primary" : "bg-white text-gray-500 border-gray-200 hover:border-primary/40")}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Rhythm
            </button>
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
                        <span className="text-[10px] text-gray-300">
                          {new Date(draft.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                        {resonanceMap[String(draft.id)] !== undefined && (
                          <>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                              ◈ logged
                            </span>
                            {resonanceMap[String(draft.id)] > 0 && (
                              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", resonanceMap[String(draft.id)] >= 60 ? "bg-violet-50 text-violet-700" : "bg-gray-50 text-gray-500")}>
                                {resonanceMap[String(draft.id)]} resonance
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      {(resonanceMap[String(draft.id)] ?? 0) >= 60 && (
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

        {perfModal && (
          <PerformanceModal
            modal={perfModal}
            onClose={() => setPerfModal(null)}
            onSuccess={handlePerfSuccess}
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
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSummary, setUploadSummary] = useState<{ impressions: number; reactions: number; saves: number; membersReached: number } | null>(null);
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

  const handleXlsxUpload = async (file: File) => {
    setUploadState("uploading");
    setUploadError(null);
    try {
      const { signal, parsed } = await performanceApi.uploadXlsx(modal.draftId, file);
      setUploadSummary({
        impressions: signal.impressions,
        reactions: signal.reactions,
        saves: signal.saves,
        membersReached: signal.membersReached,
      });
      setImpressions(signal.impressions);
      setReactions(signal.reactions);
      setComments(signal.comments);
      setReposts(signal.reposts);
      setSaves(signal.saves);
      // Store parsed URL separately for match-check; only auto-fill if user left it blank
      if (signal.linkedinUrl) {
        setParsedLinkedinUrl(signal.linkedinUrl);
        if (!linkedinUrl.trim()) setLinkedinUrl(signal.linkedinUrl);
      }
      void parsed;
      setUploadState("success");
      onSuccess();
      setTimeout(onClose, 2000);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
      setUploadState("error");
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
      <div className="relative w-full max-w-[430px] bg-white rounded-t-3xl p-6 shadow-2xl">
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
            <p className="text-xs text-gray-500 mb-3 leading-relaxed">
              Export your post's analytics from LinkedIn (Content → Post → Export) and upload the <strong>.xlsx</strong> file. The AI will learn what content works best for your audience.
            </p>

            {/* URL input — always visible so user can paste before or after upload */}
            <div className="mb-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">LinkedIn post URL</p>
              <input
                type="url"
                placeholder="https://www.linkedin.com/posts/..."
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-semibold outline-none focus:border-primary transition-colors placeholder:font-normal placeholder:text-gray-300"
              />
              {/* URL match indicator — shown after a file is uploaded */}
              {parsedLinkedinUrl && (
                <div className={cn("flex items-center gap-1.5 mt-1.5 text-xs font-semibold",
                  urlMatchStatus === "match" ? "text-emerald-600" : urlMatchStatus === "mismatch" ? "text-amber-600" : "text-gray-400"
                )}>
                  {urlMatchStatus === "match" && <><span>✓</span> URL matches the file</>}
                  {urlMatchStatus === "mismatch" && <><span>⚠</span> URL in file differs — check you chose the right post</>}
                  {urlMatchStatus === "parsed-only" && <><span>→</span> URL auto-filled from file</>}
                </div>
              )}
            </div>

            {uploadState === "success" && uploadSummary ? (
              <div className="p-4 bg-green-50 rounded-2xl border border-green-200 text-center">
                <div className="text-2xl mb-1">✓</div>
                <p className="font-bold text-green-700 text-sm mb-2">Analytics imported!</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white rounded-xl p-2 text-center">
                    <div className="font-black text-gray-900">{uploadSummary.impressions.toLocaleString()}</div>
                    <div className="text-gray-400">impressions</div>
                  </div>
                  <div className="bg-white rounded-xl p-2 text-center">
                    <div className="font-black text-gray-900">{uploadSummary.membersReached.toLocaleString()}</div>
                    <div className="text-gray-400">members reached</div>
                  </div>
                  <div className="bg-white rounded-xl p-2 text-center">
                    <div className="font-black text-gray-900">{uploadSummary.reactions.toLocaleString()}</div>
                    <div className="text-gray-400">reactions</div>
                  </div>
                  <div className="bg-white rounded-xl p-2 text-center">
                    <div className="font-black text-gray-900">{uploadSummary.saves.toLocaleString()}</div>
                    <div className="text-gray-400">saves</div>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadState === "uploading"}
                className={cn(
                  "w-full border-2 border-dashed rounded-2xl p-8 flex flex-col items-center gap-3 transition-all",
                  uploadState === "error" ? "border-red-300 bg-red-50" : "border-violet-200 bg-violet-50 hover:bg-violet-100 hover:border-violet-400",
                  uploadState === "uploading" && "opacity-60 cursor-not-allowed"
                )}
              >
                {uploadState === "uploading"
                  ? <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
                  : <Upload className="w-8 h-8 text-violet-400" />
                }
                <div className="text-center">
                  <p className="text-sm font-bold text-violet-700">
                    {uploadState === "uploading" ? "Parsing analytics…" : "Tap to choose xlsx file"}
                  </p>
                  <p className="text-xs text-violet-400 mt-0.5">LinkedIn single-post export · max 2 MB</p>
                </div>
              </button>
            )}

            {uploadState === "error" && uploadError && (
              <p className="text-xs text-red-500 mt-2 text-center">{uploadError}</p>
            )}

            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleXlsxUpload(file);
                e.target.value = "";
              }}
            />
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
                  <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider mb-0.5">Resonance Score</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-violet-700">{resonanceScore}</span>
                    <span className="text-xs text-violet-400 font-bold">/100</span>
                  </div>
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
