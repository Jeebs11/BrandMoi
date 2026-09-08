import { createPortal } from "react-dom";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Copy, Edit3, RotateCcw, ShieldAlert, Target, X, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  profileAlignmentApi,
  preferencesApi,
  type ProfileAlignmentAnalysis,
  type ComparisonStatus,
  type ComparisonRow,
  type ProofPointComparisonRow,
  type FieldRewrite,
  type PairedFactSuggestion,
  type RecommendationStatus,
} from "@/lib/api";

interface Props {
  analysis: ProfileAlignmentAnalysis;
  onClose: () => void;
}

const STATUS_COPY: Record<ComparisonStatus, { label: string; className: string }> = {
  all_agree: { label: "Aligned", className: "bg-emerald-50 border-emerald-100 text-emerald-800" },
  cv_brandmoi_agree_linkedin_differs: { label: "Your profile needs updating", className: "bg-orange-50 border-orange-100 text-orange-800" },
  cv_linkedin_agree_brandmoi_stale: { label: "Your BrandMoi positioning may be stale", className: "bg-amber-50 border-amber-100 text-amber-800" },
  brandmoi_linkedin_agree_cv_differs: { label: "Your CV says something different", className: "bg-amber-50 border-amber-100 text-amber-800" },
  all_differ: { label: "Needs your call — all three differ", className: "bg-rose-50 border-rose-100 text-rose-800" },
  only_one_source: { label: "Only one source has this", className: "bg-gray-50 border-gray-200 text-gray-600" },
  insufficient_data: { label: "Not enough data yet", className: "bg-gray-50 border-gray-200 text-gray-500" },
};

function displayValue(v: string | string[] | null | undefined): string {
  if (!v) return "—";
  return Array.isArray(v) ? v.join(", ") : v;
}

function isProofPointRow(row: ComparisonRow | ProofPointComparisonRow): row is ProofPointComparisonRow {
  return row.rowKey === "proof_points";
}

export function ProfileAlignmentReport({ analysis: initial, onClose }: Props) {
  const { toast } = useToast();
  const [analysis, setAnalysis] = useState(initial);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const copyText = (text: string, label = "Copied to clipboard") => {
    void navigator.clipboard.writeText(text);
    toast({ title: label });
  };

  const persistFieldRewrite = async (id: string, status: RecommendationStatus, editedValue?: string) => {
    setBusyId(id);
    try {
      await profileAlignmentApi.reviewRecommendation(analysis.id, id, status, editedValue !== undefined ? { editedValue } : undefined);
      setAnalysis((a) => ({
        ...a,
        fieldRewrites: a.fieldRewrites.map((r) => (r.id === id ? { ...r, status, ...(editedValue !== undefined ? { editedValue } : {}) } : r)),
      }));
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Couldn't save that.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const acceptFieldRewriteToBrandmoi = async (rewrite: FieldRewrite) => {
    const value = rewrite.editedValue ?? rewrite.rewrite;
    const targetField = rewrite.field === "about" ? "aboutMe" : "brandRole";
    setBusyId(rewrite.id);
    try {
      await preferencesApi.updateFields({ [targetField]: value });
      await profileAlignmentApi.reviewRecommendation(analysis.id, rewrite.id, "accepted");
      setAnalysis((a) => ({ ...a, fieldRewrites: a.fieldRewrites.map((r) => (r.id === rewrite.id ? { ...r, status: "accepted" } : r)) }));
      toast({ title: "Updated your BrandMoi positioning" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Couldn't update BrandMoi.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const persistPairedHalf = async (
    suggestion: PairedFactSuggestion,
    half: "brandmoi" | "linkedin",
    status: RecommendationStatus,
    editedValue?: string | string[],
  ) => {
    const busyKey = `${suggestion.id}:${half}`;
    setBusyId(busyKey);
    try {
      await profileAlignmentApi.reviewRecommendation(analysis.id, suggestion.id, status, { target: half, ...(editedValue !== undefined ? { editedValue } : {}) });
      setAnalysis((a) => ({
        ...a,
        pairedFactSuggestions: a.pairedFactSuggestions.map((p) => {
          if (p.id !== suggestion.id) return p;
          const key = half === "brandmoi" ? "updateBrandmoi" : "updateLinkedin";
          return { ...p, [key]: { ...p[key], status, ...(editedValue !== undefined ? { editedValue } : {}) } };
        }),
      }));
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Couldn't save that.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const acceptPairedBrandmoi = async (suggestion: PairedFactSuggestion) => {
    const value = suggestion.updateBrandmoi.editedValue ?? suggestion.updateBrandmoi.suggestedValue;
    setBusyId(`${suggestion.id}:brandmoi`);
    try {
      await preferencesApi.updateFields({ [suggestion.updateBrandmoi.targetField]: value } as never);
      await profileAlignmentApi.reviewRecommendation(analysis.id, suggestion.id, "accepted", { target: "brandmoi" });
      setAnalysis((a) => ({
        ...a,
        pairedFactSuggestions: a.pairedFactSuggestions.map((p) => (p.id === suggestion.id ? { ...p, updateBrandmoi: { ...p.updateBrandmoi, status: "accepted" } } : p)),
      }));
      toast({ title: "Updated your BrandMoi positioning" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Couldn't update BrandMoi.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center">
        <motion.div className="absolute inset-0 bg-black/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
        <motion.div
          className="relative w-full max-w-[430px] bg-white rounded-t-3xl shadow-2xl flex flex-col"
          style={{ maxHeight: "88vh" }}
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-violet-600" />
              <h3 className="font-extrabold text-gray-900">Profile Alignment</h3>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
            {analysis.narrativeSummary && (
              <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-violet-600 mb-1">Summary</p>
                <p className="text-sm text-gray-800 leading-relaxed">{analysis.narrativeSummary}</p>
              </div>
            )}

            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">CV vs BrandMoi vs LinkedIn</p>
              <div className="space-y-2">
                {analysis.comparisonTable.rows.map((row) => {
                  const status = STATUS_COPY[row.status];
                  const isExpanded = expandedRow === row.rowKey;
                  return (
                    <button
                      key={row.rowKey}
                      type="button"
                      onClick={() => setExpandedRow(isExpanded ? null : row.rowKey)}
                      className={cn("w-full rounded-2xl border px-3.5 py-3 text-left transition-colors", status.className)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex-1 text-xs font-extrabold">{row.label}</span>
                        <span className="text-[11px] font-semibold">{status.label}</span>
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </div>
                      {isExpanded && (
                        <div className="mt-2 border-t border-current/10 pt-2 space-y-1.5 text-xs">
                          {isProofPointRow(row) ? (
                            row.points.map((p, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <span>{p.presentInCv ? (p.reflectedInLinkedin ? "✓" : "⚠") : "?"}</span>
                                <span className="flex-1">{p.point} {p.presentInCv && !p.reflectedInLinkedin && <em>(not yet on LinkedIn)</em>}</span>
                              </div>
                            ))
                          ) : (
                            <>
                              <p><span className="font-bold">CV:</span> {row.applicableSources.includes("cv") ? displayValue(row.cv?.value) : "—"}</p>
                              <p><span className="font-bold">BrandMoi:</span> {row.applicableSources.includes("brandmoi") ? displayValue(row.brandmoi?.value) : "—"}</p>
                              <p><span className="font-bold">LinkedIn:</span> {row.applicableSources.includes("linkedin") ? displayValue(row.linkedin?.value) : "—"}</p>
                            </>
                          )}
                          <p className="opacity-70 italic">{row.statusDetail}</p>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {analysis.fieldRewrites.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Suggested rewrites</p>
              {analysis.fieldRewrites.map((rewrite) => {
                const isEditing = editingId === rewrite.id;
                const isBusy = busyId === rewrite.id;
                const shownValue = rewrite.editedValue ?? rewrite.rewrite;
                return (
                  <div key={rewrite.id} className="rounded-2xl border border-violet-100 bg-white p-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-bold text-gray-900 capitalize">{rewrite.field.replace("_", " ")}</p>
                      {rewrite.status !== "pending" && (
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full",
                          rewrite.status === "rejected" ? "bg-gray-100 text-gray-500" : "bg-emerald-100 text-emerald-700",
                        )}>{rewrite.status}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mb-2 leading-relaxed">{rewrite.rationale}</p>
                    {isEditing ? (
                      <textarea
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        className="w-full h-24 rounded-xl border border-violet-200 p-2.5 text-sm text-gray-800 focus:outline-none focus:border-violet-400"
                      />
                    ) : (
                      <div className="bg-violet-50/60 border border-violet-100 rounded-xl p-3">
                        <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{shownValue}</p>
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => { setEditingId(null); void persistFieldRewrite(rewrite.id, "edited", editDraft); }}
                            className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-colors"
                          >
                            Save edit
                          </button>
                          <button onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-bold transition-colors">
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => copyText(shownValue)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 text-xs font-bold hover:border-gray-300 transition-colors"
                          >
                            <Copy className="w-3 h-3" /> Copy for LinkedIn
                          </button>
                          <button
                            onClick={() => void acceptFieldRewriteToBrandmoi(rewrite)}
                            disabled={isBusy || rewrite.status === "accepted"}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold disabled:opacity-50 transition-colors"
                          >
                            <Check className="w-3 h-3" /> {rewrite.status === "accepted" ? "Applied to BrandMoi" : "Update BrandMoi"}
                          </button>
                          <button
                            onClick={() => { setEditingId(rewrite.id); setEditDraft(shownValue); }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 text-xs font-bold hover:border-gray-300 transition-colors"
                          >
                            <Edit3 className="w-3 h-3" /> Edit
                          </button>
                          <button
                            onClick={() => void persistFieldRewrite(rewrite.id, "rejected")}
                            className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-gray-600 text-xs font-bold transition-colors"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            )}

            {analysis.pairedFactSuggestions.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Your CV says otherwise</p>
                </div>
                {analysis.pairedFactSuggestions.map((suggestion) => (
                  <div key={suggestion.id} className="rounded-2xl border border-amber-100 bg-white p-4">
                    <p className="text-xs text-gray-500 mb-3">Per your CV: <span className="font-semibold text-gray-800">{suggestion.claim}</span></p>

                    <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3 mb-2">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-black uppercase tracking-wide text-gray-500">Update BrandMoi</p>
                        {suggestion.updateBrandmoi.status !== "pending" && (
                          <span className="text-[10px] font-bold text-gray-500">{suggestion.updateBrandmoi.status}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-700 mb-2">{displayValue(suggestion.updateBrandmoi.editedValue ?? suggestion.updateBrandmoi.suggestedValue)}</p>
                      <button
                        onClick={() => void acceptPairedBrandmoi(suggestion)}
                        disabled={busyId === `${suggestion.id}:brandmoi` || suggestion.updateBrandmoi.status === "accepted"}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-[11px] font-bold disabled:opacity-50 transition-colors"
                      >
                        <Check className="w-3 h-3" /> {suggestion.updateBrandmoi.status === "accepted" ? "Applied" : "Accept"}
                      </button>
                    </div>

                    <div className="rounded-xl border border-sky-100 bg-sky-50/40 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-black uppercase tracking-wide text-sky-600">Update LinkedIn</p>
                        {suggestion.updateLinkedin.status !== "pending" && (
                          <span className="text-[10px] font-bold text-sky-600">{suggestion.updateLinkedin.status}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-700 mb-2">{suggestion.updateLinkedin.editedValue ?? suggestion.updateLinkedin.suggestedValue}</p>
                      <button
                        onClick={() => {
                          copyText(String(suggestion.updateLinkedin.editedValue ?? suggestion.updateLinkedin.suggestedValue));
                          void persistPairedHalf(suggestion, "linkedin", "accepted");
                        }}
                        disabled={busyId === `${suggestion.id}:linkedin`}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold disabled:opacity-50 transition-colors"
                      >
                        <Copy className="w-3 h-3" /> Copy for LinkedIn
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-5 pb-6 pt-3 border-t border-gray-100 flex-shrink-0">
            <button onClick={onClose} className="w-full flex items-center justify-center gap-2 h-11 rounded-2xl border border-gray-200 text-gray-600 text-sm font-bold hover:border-gray-300 transition-colors">
              <RotateCcw className="w-3.5 h-3.5" /> Done for now
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body,
  );
}
