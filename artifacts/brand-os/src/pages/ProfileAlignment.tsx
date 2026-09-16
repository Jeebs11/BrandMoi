import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, Target, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { profileAlignmentApi, type TargetAudience, type ProfileAlignmentAnalysis } from "@/lib/api";
import { ProfileAlignmentUpload } from "@/components/ProfileAlignmentUpload";
import { ProfileAlignmentReport } from "@/components/ProfileAlignmentReport";
import { usePageTour } from "@/components/tour/usePageTour";
import { PROFILE_ALIGNMENT_TOUR_STEPS } from "@/components/tour/page-tours";

const TARGET_AUDIENCES: TargetAudience[] = [
  "Recruiters",
  "Hiring managers",
  "Clients",
  "Founders & operators",
  "Personal brand audience",
  "Peers",
  "Investors",
  "General",
];

export default function ProfileAlignment() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [hasCvFacts, setHasCvFacts] = useState(false);
  const [hasLinkedinFacts, setHasLinkedinFacts] = useState(false);
  const [targetAudience, setTargetAudience] = useState<TargetAudience>("Recruiters");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ProfileAlignmentAnalysis | null>(null);
  const [analysisIsCurrent, setAnalysisIsCurrent] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const pageTour = usePageTour("profile-alignment-tour", PROFILE_ALIGNMENT_TOUR_STEPS);

  useEffect(() => {
    let active = true;
    profileAlignmentApi.latest()
      .then((result) => {
        if (!active) return;
        setHasCvFacts(result.hasCvFacts);
        setHasLinkedinFacts(result.hasLinkedinFacts);
        if (result.analysis) {
          setAnalysis(result.analysis);
          setAnalysisIsCurrent(result.isCurrent);
          setTargetAudience(result.analysis.targetAudience);
        }
      })
      .catch(() => {
        // A saved report is optional; the upload flow remains available if
        // the user has no prior profile snapshot yet.
      })
      .finally(() => {
        if (active) setRestoring(false);
      });
    return () => { active = false; };
  }, []);

  const handleViewComparison = async () => {
    if (comparisonLoading) return;
    setComparisonLoading(true);
    try {
      const comparisonTable = await profileAlignmentApi.comparison();
      setAnalysis({
        id: 0,
        targetAudience,
        comparisonTable,
        narrativeSummary: "",
        fieldRewrites: [],
        pairedFactSuggestions: [],
        createdAt: new Date().toISOString(),
      });
      setAnalysisIsCurrent(false);
      setReportOpen(true);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Couldn't load the comparison.", variant: "destructive" });
    } finally {
      setComparisonLoading(false);
    }
  };

  const handleRunAnalysis = async () => {
    if (analyzing) return;
    setAnalyzing(true);
    try {
      const result = await profileAlignmentApi.analyze(targetAudience, {
        forceFresh: Boolean(analysis && analysisIsCurrent),
      });
      setAnalysis(result);
      setAnalysisIsCurrent(true);
      setReportOpen(true);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Couldn't run the analysis.", variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <AppShell>
      <div className="px-5 pt-4 pb-28 space-y-6 max-w-[430px] mx-auto min-w-0 w-full">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => navigate("/")} className="p-2 -ml-2 rounded-xl hover:bg-gray-100 text-gray-400 flex-shrink-0">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
              <Target className="w-5 h-5 text-violet-500 flex-shrink-0" />
              Profile Alignment
            </h1>
              <p className="text-xs text-gray-400">Score your LinkedIn profile and make every section prove your value.</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 space-y-4">
          <div data-tour="align-cv">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Your CV</p>
            <ProfileAlignmentUpload kind="cv" onSuccess={() => { setHasCvFacts(true); setAnalysisIsCurrent(false); }} />
          </div>
          <div data-tour="align-linkedin">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Your LinkedIn profile</p>
            <ProfileAlignmentUpload kind="linkedin" onSuccess={() => { setHasLinkedinFacts(true); setAnalysisIsCurrent(false); }} />
          </div>

          {hasLinkedinFacts && (
            <div className="pt-3 border-t border-gray-100 space-y-3">
              {hasCvFacts && (
                <button
                  onClick={() => void handleViewComparison()}
                  disabled={comparisonLoading}
                  className="w-full flex items-center justify-center gap-1.5 h-9 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:border-gray-300 disabled:opacity-50 transition-colors"
                >
                  {comparisonLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  {comparisonLoading ? "Loading…" : "View CV vs BrandMoi vs LinkedIn (no AI cost)"}
                </button>
              )}
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Who should this profile speak to?</p>
                <div className="flex flex-wrap gap-1.5">
                  {TARGET_AUDIENCES.map((aud) => (
                    <button
                      key={aud}
                      onClick={() => {
                        setTargetAudience(aud);
                        if (analysis && analysis.targetAudience !== aud) setAnalysisIsCurrent(false);
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all",
                        targetAudience === aud ? "bg-violet-600 text-white" : "bg-gray-50 text-gray-500 hover:bg-gray-100",
                      )}
                    >
                      {aud}
                    </button>
                  ))}
                </div>
              </div>
              {analysis && (
                <div className={cn(
                  "rounded-xl px-3 py-2 text-[10px] leading-relaxed",
                  analysisIsCurrent ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
                )}>
                  {analysisIsCurrent
                    ? "Saved analysis loaded. Your profile and audience have not changed, so returning here will not run AI again."
                    : "This saved report is from an older profile or audience selection. Score again to refresh it."}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => void handleRunAnalysis()}
                  disabled={analyzing || restoring}
                  className="flex-1 flex items-center justify-center gap-1.5 h-11 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold disabled:opacity-50 transition-colors"
                >
                  {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
                  {analyzing
                    ? "Scoring profile…"
                    : analysisIsCurrent
                      ? "Run fresh analysis"
                      : analysis
                        ? "Score updated profile"
                        : "Score my profile (3/day)"}
                </button>
                {analysis && (
                  <button
                    onClick={() => setReportOpen(true)}
                    className="px-4 h-11 rounded-2xl border border-gray-200 text-gray-600 text-sm font-bold hover:border-gray-300 transition-colors"
                  >
                    View last report
                  </button>
                )}
              </div>
              {!hasCvFacts && (
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  You can score LinkedIn now. Add your CV first if you want stronger proof-point and experience comparisons.
                </p>
              )}
            </div>
          )}
        </div>

        <p className="text-[11px] text-gray-400 leading-relaxed px-1">
          Nothing is ever published automatically. Your score explains the evidence behind every result, and suggested rewrites never invent missing outcomes.
        </p>
      </div>

      {reportOpen && analysis && (
        <ProfileAlignmentReport analysis={analysis} onClose={() => setReportOpen(false)} />
      )}
      {pageTour}
    </AppShell>
  );
}
