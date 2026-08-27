import { createPortal } from "react-dom";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Check, ChevronDown, ChevronRight, ChevronUp, Edit3, ExternalLink, Loader2, RotateCcw, ShieldCheck, Target, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BrandReviewRecommendation, BrandReviewResult } from "@/lib/api";
import type { AuthenticityFeedback, AuthenticityReview } from "@/components/AuthenticityReviewDialog";

type PendingBrandChange = {
  recommendation: BrandReviewRecommendation;
  content: string;
};

interface BrandReviewPanelProps {
  result: BrandReviewResult | null;
  isLoading: boolean;
  isApplyingId: string | null;
  pendingChange: PendingBrandChange | null;
  onClose: () => void;
  onApplyRecommendation: (recommendation: BrandReviewRecommendation) => void;
  onApprove: () => void;
  onDiscard: () => void;
  onEditManually: () => void;
  authenticityCheck?: AuthenticityReview;
  feedback?: AuthenticityFeedback;
  isSavingFeedback?: boolean;
  onFeedback?: (value: AuthenticityFeedback) => void;
  onSaveAndPublish?: () => void;
  isPublishing?: boolean;
}

const VERDICT_COPY = {
  specific: {
    label: "Specific and recognisable",
    description: "This draft has a clear point of view and feels connected to your actual expertise.",
    className: "bg-emerald-50 border-emerald-100 text-emerald-800",
  },
  mixed: {
    label: "Good core — sharpen the point",
    description: "The idea is working, but one or two details could make it feel more distinctly yours.",
    className: "bg-amber-50 border-amber-100 text-amber-800",
  },
  generalist: {
    label: "A little too generalist",
    description: "This could have been written by almost anyone in the field. Add a specific situation, decision, or audience.",
    className: "bg-orange-50 border-orange-100 text-orange-800",
  },
} as const;

export function BrandReviewPanel({
  result,
  isLoading,
  isApplyingId,
  pendingChange,
  onClose,
  onApplyRecommendation,
  onApprove,
  onDiscard,
  onEditManually,
  authenticityCheck = null,
  feedback = null,
  isSavingFeedback = false,
  onFeedback,
  onSaveAndPublish,
  isPublishing = false,
}: BrandReviewPanelProps) {
  const verdict = result ? VERDICT_COPY[result.verdict] : null;
  const isReviewingChange = !!pendingChange;
  const [expandedSignal, setExpandedSignal] = useState<string | null>(null);
  const changedPercent = authenticityCheck?.editPct !== null && authenticityCheck?.editPct !== undefined
    ? Math.round(authenticityCheck.editPct * 100)
    : null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center">
        <motion.div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />
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
              <Target className="w-4 h-4 text-sky-600" />
              <h3 className="font-extrabold text-gray-900">Brand Review</h3>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors" aria-label="Close brand review">
              <X className="w-4 h-4" />
            </button>
          </div>

          {isReviewingChange && pendingChange ? (
            <>
              <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
                <div className="flex items-start gap-2">
                  <RotateCcw className="w-4 h-4 text-sky-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-gray-900">Review this change before it applies</p>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{pendingChange.recommendation.change}</p>
                  </div>
                </div>
                <div className="bg-sky-50/60 border border-sky-100 rounded-2xl p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-sky-600 mb-2">Proposed draft</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{pendingChange.content}</p>
                </div>
              </div>
              <div className="px-5 pb-6 pt-3 border-t border-gray-100 flex-shrink-0 flex gap-3">
                <Button variant="outline" className="flex-1 h-12 rounded-2xl text-sm font-bold" onClick={onDiscard}>
                  Discard
                </Button>
                <Button className="flex-1 h-12 rounded-2xl text-sm font-bold bg-sky-600 hover:bg-sky-700" onClick={onApprove}>
                  <Check className="w-4 h-4 mr-2" />Apply to post
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
                {isLoading && (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Target className="w-8 h-8 text-sky-500 animate-pulse" />
                    <p className="text-sm text-gray-700 font-bold">Reading this draft against your brand…</p>
                    <p className="text-xs text-gray-400 text-center">Checking specificity, positioning, and whether it sounds distinctly like you.</p>
                    <Loader2 className="w-4 h-4 text-sky-500 animate-spin" />
                  </div>
                )}

                {!isLoading && result && verdict && (
                  <>
                    <div className={cn("rounded-2xl border p-4", verdict.className)}>
                      <p className="text-[10px] font-black uppercase tracking-wider mb-1">Draft diagnosis</p>
                      <p className="text-base font-extrabold">{verdict.label}</p>
                      <p className="text-xs leading-relaxed mt-1">{result.summary || verdict.description}</p>
                    </div>

                    <div>
                      <p className="text-sm font-bold text-gray-900">{result.headline}</p>
                      <p className="text-[11px] text-gray-400 mt-1">These recommendations apply to this draft only. Your permanent Brand DNA will not change.</p>
                    </div>

                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">Quick glance</p>
                      <div className="space-y-2">
                        {result.signals.map((signal) => {
                          const isExpanded = expandedSignal === signal.key;
                          const tone = signal.status === "strong"
                            ? "border-emerald-100 bg-emerald-50/70 text-emerald-800"
                            : signal.status === "mixed"
                            ? "border-amber-100 bg-amber-50/70 text-amber-800"
                            : "border-orange-100 bg-orange-50/70 text-orange-800";
                          const Icon = signal.status === "strong" ? Check : signal.status === "mixed" ? AlertTriangle : Target;
                          return (
                            <button
                              key={signal.key}
                              type="button"
                              onClick={() => setExpandedSignal(isExpanded ? null : signal.key)}
                              className={cn("w-full rounded-2xl border px-3.5 py-3 text-left transition-colors", tone)}
                            >
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4 flex-none" />
                                <span className="flex-1 text-xs font-extrabold capitalize">{signal.key}</span>
                                <span className="text-xs font-semibold">{signal.label}</span>
                                {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                              </div>
                              {isExpanded && <p className="mt-2 border-t border-current/10 pt-2 text-xs leading-relaxed">{signal.detail}</p>}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {result.strengths.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {result.strengths.map((strength) => (
                          <span key={strength} className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold">
                            <Check className="w-3 h-3 inline mr-1" />{strength}
                          </span>
                        ))}
                      </div>
                    )}

                    {result.recommendations.length > 0 ? (
                      <div className="space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Recommended changes</p>
                        {result.recommendations.map((recommendation, index) => (
                          <div key={recommendation.id} className="rounded-2xl border border-sky-100 bg-white p-4">
                            <div className="flex items-start gap-2">
                              <span className={cn(
                                "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0",
                                recommendation.priority === "high" ? "bg-orange-100 text-orange-700" : "bg-sky-100 text-sky-700",
                              )}>{index + 1}</span>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-gray-900">{recommendation.title}</p>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{recommendation.issue}</p>
                              </div>
                            </div>
                            <div className="mt-3 pl-7 space-y-1.5">
                              <p className="text-xs text-sky-800 leading-relaxed"><span className="font-bold">Change:</span> {recommendation.change}</p>
                              {recommendation.example && <p className="text-[11px] text-gray-400 italic leading-relaxed">Direction: “{recommendation.example}”</p>}
                            </div>
                            <div className="mt-3 flex gap-2">
                              <Button
                                size="sm"
                                className="flex-1 rounded-xl bg-sky-600 hover:bg-sky-700 text-xs"
                                onClick={() => onApplyRecommendation(recommendation)}
                                disabled={!!isApplyingId}
                              >
                                {isApplyingId === recommendation.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <ChevronRight className="w-3 h-3 mr-1" />}
                                {isApplyingId === recommendation.id ? "Preparing…" : "Preview this change"}
                              </Button>
                              <Button size="sm" variant="outline" className="rounded-xl text-xs" onClick={onEditManually} disabled={!!isApplyingId}>
                                <Edit3 className="w-3 h-3 mr-1" />Edit
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                        <p className="text-sm font-bold text-emerald-800">Nothing needs changing in this draft.</p>
                        <p className="text-xs text-emerald-700 mt-1 leading-relaxed">{verdict.description}</p>
                      </div>
                    )}

                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex items-start gap-2">
                        <ShieldCheck className="mt-0.5 h-4 w-4 flex-none text-violet-600" />
                        <div>
                          <p className="text-xs font-extrabold text-gray-900">Transparent draft check</p>
                          <p className="mt-1 text-[11px] leading-relaxed text-gray-500">This compares the original draft with your final edits and looks for common generic patterns. It does not claim to detect AI authorship.</p>
                        </div>
                      </div>
                      <div className="mt-3 space-y-2 text-xs text-gray-700">
                        {changedPercent !== null && (
                          <p>You changed about <strong>{changedPercent}%</strong> of the original draft.</p>
                        )}
                        {authenticityCheck?.flags.length ? (
                          <ul className="space-y-1.5">
                            {authenticityCheck.flags.map((flag) => (
                              <li key={flag} className="flex items-start gap-2">
                                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
                                <span>May read as <strong>{flag}</strong>.</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-emerald-700">No common generic patterns were found.</p>
                        )}
                      </div>
                      {onFeedback && (
                        <div className="mt-3 border-t border-gray-200 pt-3">
                          <p className="text-[11px] text-gray-500">Optional: this helps guide future drafts you request.</p>
                          <button
                            type="button"
                            disabled={isSavingFeedback}
                            onClick={() => onFeedback(feedback === "sounds_like_me" ? null : "sounds_like_me")}
                            className={cn(
                              "mt-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50",
                              feedback === "sounds_like_me"
                                ? "border-violet-500 bg-violet-600 text-white"
                                : "border-gray-200 bg-white text-gray-600 hover:border-violet-300 hover:text-violet-700",
                            )}
                          >
                            {feedback === "sounds_like_me" && <Check className="mr-1 inline h-3 w-3" />}
                            Sounds like me
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              {!isLoading && result && (
                <div className="px-5 pb-6 pt-3 border-t border-gray-100 flex-shrink-0 flex gap-3">
                  <Button variant="outline" className="flex-1 h-11 rounded-2xl text-sm font-bold" onClick={onEditManually}>
                    <Edit3 className="w-4 h-4 mr-2" />Edit
                  </Button>
                  {onSaveAndPublish && (
                    <Button className="flex-[1.45] h-11 rounded-2xl text-sm font-bold bg-violet-600 hover:bg-violet-700" onClick={onSaveAndPublish} disabled={isPublishing}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      {isPublishing ? "Saving…" : "Save, copy & open LinkedIn"}
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body,
  );
}