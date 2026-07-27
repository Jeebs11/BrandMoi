import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronDown, ChevronUp, Loader2, Zap, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type StressTestFactor = {
  name: string;
  score: number;
  maxScore: number;
  why: string;
  howToFix?: string;
};

export type StressTestResult = {
  score: number;
  factors: StressTestFactor[];
  fixes: string[];
  personalInsight?: string;
  publishReady: boolean;
  persistenceWarning?: string;
};

interface StressTestPanelProps {
  result: StressTestResult | null;
  isLoading: boolean;
  onClose: () => void;
  onApplyFixes: () => void;
  isApplying: boolean;
  pendingContent?: string | null;
  onApprove?: () => void;
  onDiscard?: () => void;
}

function ScoreRing({ score, publishReady }: { score: number; publishReady: boolean }) {
  const color = publishReady
    ? "text-emerald-600"
    : score >= 60
    ? "text-amber-500"
    : "text-red-500";

  const barColor = publishReady
    ? "bg-emerald-500"
    : score >= 60
    ? "bg-amber-500"
    : "bg-red-500";

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <div className={cn("text-5xl font-black tabular-nums", color)}>{score}</div>
      <div className="text-xs text-gray-400 font-medium -mt-1">out of 100</div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full", barColor)}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function FactorStatusIcon({ score, maxScore }: { score: number; maxScore: number }) {
  const pct = score / maxScore;
  if (pct >= 1) return <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />;
  if (pct >= 0.6) return <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />;
  return <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />;
}

// Each factor is a "round" against the algorithm: rounds reveal one at a
// time with a verdict chip. Same data, pure theatre.
function roundVerdict(score: number, maxScore: number): { label: string; cls: string } {
  const pct = score / maxScore;
  if (pct >= 1) return { label: "CLEAN HIT", cls: "bg-emerald-100 text-emerald-700" };
  if (pct >= 0.6) return { label: "GLANCING", cls: "bg-amber-100 text-amber-700" };
  return { label: "TOOK A HIT", cls: "bg-red-100 text-red-600" };
}

function FactorRow({ factor, round }: { factor: StressTestFactor; round: number }) {
  const [whyOpen, setWhyOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const isFullScore = factor.score >= factor.maxScore;
  const verdict = roundVerdict(factor.score, factor.maxScore);

  return (
    <motion.div
      className="border border-gray-100 rounded-xl overflow-hidden"
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.45 + round * 0.4, duration: 0.3 }}
    >
      <div className="flex items-center gap-2.5 px-3 py-2.5 bg-white">
        <span className="text-[9px] font-black text-gray-300 tabular-nums w-7 flex-shrink-0">R{round + 1}</span>
        <FactorStatusIcon score={factor.score} maxScore={factor.maxScore} />
        <span className="flex-1 text-sm font-semibold text-gray-800">{factor.name}</span>
        <motion.span
          className={cn("text-[8px] font-black px-1.5 py-0.5 rounded-full tracking-wider", verdict.cls)}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.65 + round * 0.4, type: "spring", stiffness: 400, damping: 15 }}
        >
          {verdict.label}
        </motion.span>
        <span className={cn(
          "text-xs font-bold tabular-nums",
          isFullScore ? "text-emerald-600" : factor.score / factor.maxScore >= 0.6 ? "text-amber-600" : "text-red-500"
        )}>
          {factor.score}/{factor.maxScore}
        </span>
      </div>

      <div className="flex gap-2 px-3 pb-2.5">
        <button
          onClick={() => setWhyOpen((v) => !v)}
          className={cn(
            "flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all",
            whyOpen
              ? "bg-violet-600 text-white border-violet-600"
              : "bg-white text-violet-700 border-violet-200 hover:bg-violet-50"
          )}
        >
          Why {whyOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {!isFullScore && factor.howToFix && (
          <button
            onClick={() => setHowOpen((v) => !v)}
            className={cn(
              "flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all",
              howOpen
                ? "bg-orange-500 text-white border-orange-500"
                : "bg-white text-orange-600 border-orange-200 hover:bg-orange-50"
            )}
          >
            How to fix {howOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
      </div>

      <AnimatePresence>
        {whyOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="text-xs text-gray-600 leading-relaxed px-3 pb-3 bg-violet-50/50 border-t border-violet-100">
              {factor.why}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {howOpen && factor.howToFix && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="text-xs text-gray-700 leading-relaxed px-3 pb-3 bg-orange-50/50 border-t border-orange-100">
              {factor.howToFix}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Fight verdict banner — the headline moment after the rounds play out.
function VerdictBanner({ score, publishReady }: { score: number; publishReady: boolean }) {
  const verdict = publishReady
    ? { emoji: "🏆", title: "STRONG — READY TO PUBLISH", sub: "Well aligned with LinkedIn's creator guidance. Ship it.", cls: "from-emerald-500 to-teal-500" }
    : score >= 60
    ? { emoji: "🥊", title: "SOLID", sub: "Good post — a few tweaks lift it into publish-ready.", cls: "from-amber-500 to-orange-500" }
    : { emoji: "😵", title: "NEEDS WORK", sub: "Some of LinkedIn's guidance isn't met yet. Fix and re-check.", cls: "from-red-500 to-rose-500" };

  return (
    <motion.div
      className={cn("rounded-2xl bg-gradient-to-r text-white text-center py-3 px-4", verdict.cls)}
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 3.1, type: "spring", stiffness: 260, damping: 18 }}
    >
      <p className="text-lg font-black tracking-wide">{verdict.emoji} {verdict.title}</p>
      <p className="text-[11px] text-white/85 font-medium">{verdict.sub}</p>
    </motion.div>
  );
}

export function StressTestPanel({
  result, isLoading, onClose, onApplyFixes, isApplying,
  pendingContent, onApprove, onDiscard,
}: StressTestPanelProps) {
  const summaryLine = () => {
    if (!result) return "";
    if (result.publishReady) return "This post is ready to publish.";
    const failing = result.factors.filter((f) => f.score < f.maxScore).length;
    return `${failing} ${failing === 1 ? "thing" : "things"} to fix before publishing.`;
  };

  const isReviewing = !!pendingContent;

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
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-violet-600" />
              <h3 className="font-extrabold text-gray-900">
                {isReviewing ? "Review rewrite" : "Stress Test"}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── Review screen ── */}
          {isReviewing && pendingContent && (
            <>
              <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
                <p className="text-xs text-gray-500 leading-relaxed">
                  Here's the rewritten version. Review it before replacing your current post.
                </p>
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                    {pendingContent}
                  </p>
                </div>
              </div>
              <div className="px-5 pb-6 pt-3 border-t border-gray-100 flex-shrink-0 flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-12 rounded-2xl text-sm font-bold border-gray-200 text-gray-600"
                  onClick={onDiscard}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Discard
                </Button>
                <Button
                  className="flex-1 h-12 rounded-2xl text-sm font-bold bg-violet-600 hover:bg-violet-700"
                  onClick={onApprove}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Apply to post
                </Button>
              </div>
            </>
          )}

          {/* ── Normal score screen ── */}
          {!isReviewing && (
            <>
              <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
                {isLoading && (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <motion.span
                      className="text-4xl"
                      animate={{ rotate: [0, -12, 10, -6, 0] }}
                      transition={{ duration: 0.9, repeat: Infinity }}
                    >
                      🥊
                    </motion.span>
                    <p className="text-sm text-gray-700 font-bold">Your post steps into the ring…</p>
                    <p className="text-xs text-gray-400 text-center">vs LINKEDIN'S CREATOR GUIDANCE · 4 rounds · scored on what LinkedIn says it rewards</p>
                    <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                  </div>
                )}

                {!isLoading && result && (
                  <>
                    <ScoreRing score={result.score} publishReady={result.publishReady} />

                    <p className={cn(
                      "text-sm font-bold text-center -mt-1",
                      result.publishReady ? "text-emerald-700" : "text-gray-700"
                    )}>
                      {summaryLine()}
                    </p>

                    <div className="space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Alignment with LinkedIn creator guidance — 4 rounds</p>
                      {result.factors.map((f, i) => (
                        <FactorRow key={i} factor={f} round={i} />
                      ))}
                    </div>

                    <VerdictBanner score={result.score} publishReady={result.publishReady} />

                    {result.personalInsight && (
                      <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-violet-500 mb-1.5">Your personal signal</p>
                        <p className="text-xs text-violet-800 leading-relaxed">{result.personalInsight}</p>
                      </div>
                    )}
                    {result.persistenceWarning && (
                      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
                        <p className="text-[11px] text-amber-700 leading-relaxed">{result.persistenceWarning}</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {!isLoading && result && !result.publishReady && (
                <div className="px-5 pb-6 pt-3 border-t border-gray-100 flex-shrink-0">
                  <Button
                    className="w-full h-12 rounded-2xl text-sm font-bold"
                    onClick={onApplyFixes}
                    disabled={isApplying}
                  >
                    {isApplying ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Generating rewrite…
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Apply fixes &amp; demand a rematch
                      </>
                    )}
                  </Button>
                  <p className="text-[10px] text-gray-400 text-center mt-2">Rewrites the post using the fixes above — you'll review before it applies</p>
                </div>
              )}
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
