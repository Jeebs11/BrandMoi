import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronDown, ChevronUp, Loader2, Zap, CheckCircle2, AlertTriangle, XCircle, RefreshCw } from "lucide-react";
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
};

interface StressTestPanelProps {
  result: StressTestResult | null;
  isLoading: boolean;
  onClose: () => void;
  onApplyFixes: () => void;
  isApplying: boolean;
}

function ScoreRing({ score, publishReady }: { score: number; publishReady: boolean }) {
  const color = publishReady
    ? "text-emerald-600"
    : score >= 65
    ? "text-amber-500"
    : "text-red-500";

  const barColor = publishReady
    ? "bg-emerald-500"
    : score >= 65
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

function FactorRow({ factor }: { factor: StressTestFactor }) {
  const [whyOpen, setWhyOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const isFullScore = factor.score >= factor.maxScore;

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-3 py-2.5 bg-white">
        <FactorStatusIcon score={factor.score} maxScore={factor.maxScore} />
        <span className="flex-1 text-sm font-semibold text-gray-800">{factor.name}</span>
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
    </div>
  );
}

export function StressTestPanel({ result, isLoading, onClose, onApplyFixes, isApplying }: StressTestPanelProps) {
  const summaryLine = () => {
    if (!result) return "";
    if (result.publishReady) return "This post is ready to publish.";
    const failing = result.factors.filter((f) => f.score < f.maxScore).length;
    return `${failing} ${failing === 1 ? "thing" : "things"} to fix before publishing.`;
  };

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
              <h3 className="font-extrabold text-gray-900">Stress Test</h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="w-7 h-7 text-violet-400 animate-spin" />
                <p className="text-sm text-gray-500 font-medium">Analysing your post…</p>
                <p className="text-xs text-gray-400 text-center">Checking 6 LinkedIn algorithm factors from research across 1.8M+ posts</p>
              </div>
            )}

            {!isLoading && result && (
              <>
                {/* Score */}
                <ScoreRing score={result.score} publishReady={result.publishReady} />

                {/* Summary line */}
                <p className={cn(
                  "text-sm font-bold text-center -mt-1",
                  result.publishReady ? "text-emerald-700" : "text-gray-700"
                )}>
                  {summaryLine()}
                </p>

                {/* Publish-ready celebration */}
                {result.publishReady && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <p className="text-sm font-bold text-emerald-800">Strong across all signals</p>
                    <p className="text-xs text-emerald-700 mt-1">This post is optimised for LinkedIn's algorithm. Time to publish.</p>
                  </div>
                )}

                {/* Factor breakdown */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Factor breakdown — tap to expand</p>
                  {result.factors.map((f, i) => (
                    <FactorRow key={i} factor={f} />
                  ))}
                </div>

                {/* Personal insight */}
                {result.personalInsight && (
                  <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-violet-500 mb-1.5">Your personal signal</p>
                    <p className="text-xs text-violet-800 leading-relaxed">{result.personalInsight}</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer — apply fixes button */}
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
                    Applying fixes…
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Apply fixes &amp; regenerate
                  </>
                )}
              </Button>
              <p className="text-[10px] text-gray-400 text-center mt-2">Rewrites the post using the fixes above, then re-scores it</p>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
