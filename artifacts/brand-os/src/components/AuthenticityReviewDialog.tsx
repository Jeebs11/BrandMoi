import { AlertTriangle, CheckCircle2, ExternalLink, PencilLine, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type AuthenticityReview = {
  editPct: number | null;
  flags: string[];
  severity: "low" | "medium" | "high";
} | null;

export type AuthenticityFeedback =
  | "sounds_like_me"
  | "too_generic"
  | "needs_specificity"
  | "too_polished"
  | null;

const FEEDBACK_OPTIONS: Array<{
  value: Exclude<AuthenticityFeedback, null>;
  label: string;
}> = [
  { value: "sounds_like_me", label: "Sounds like me" },
];

type Props = {
  open: boolean;
  check: AuthenticityReview;
  feedback: AuthenticityFeedback;
  isSavingFeedback?: boolean;
  continueLabel: string;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onContinue: () => void;
  onFeedback: (value: AuthenticityFeedback) => void;
};

export function AuthenticityReviewDialog({
  open,
  check,
  feedback,
  isSavingFeedback = false,
  continueLabel,
  onOpenChange,
  onEdit,
  onContinue,
  onFeedback,
}: Props) {
  const hasConcerns = check !== null;
  const changedPercent = check?.editPct !== null && check?.editPct !== undefined
    ? Math.round(check.editPct * 100)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl p-0 overflow-hidden">
        <div className={cn(
          "px-6 pt-6 pb-5 border-b",
          hasConcerns ? "bg-amber-50 border-amber-100" : "bg-emerald-50 border-emerald-100",
        )}>
          <DialogHeader className="text-left">
            <div className="flex items-center gap-2">
              {hasConcerns
                ? <AlertTriangle className="w-5 h-5 text-amber-600" />
                : <ShieldCheck className="w-5 h-5 text-emerald-600" />}
              <DialogTitle className="text-lg">
                {hasConcerns ? "Quick authenticity review" : "Ready for your voice"}
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm text-gray-600 pt-1">
              {hasConcerns
                ? "These are coaching signals, not an AI verdict. You stay in control."
                : "No common generic patterns were found. Give it one final personal read before sharing."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-5">
          {hasConcerns && (
            <div className="space-y-3">
              {changedPercent !== null && changedPercent < 25 && (
                <div className="rounded-2xl bg-amber-50 border border-amber-100 px-3.5 py-3 text-sm text-amber-900">
                  You changed about <strong>{changedPercent}%</strong> of the original draft. A concrete memory, number, or opinion can make it more recognisably yours.
                </div>
              )}
              {check!.flags.length > 0 && (
                <ul className="space-y-2">
                  {check!.flags.map((flag) => (
                    <li key={flag} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 flex-none" />
                      <span>May read as <strong>{flag}</strong>.</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3.5">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Teach BrandMoi your preference</p>
            <p className="mt-1 text-xs text-gray-500">This is optional, reversible, and only shapes future drafts you request.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {FEEDBACK_OPTIONS.map((option) => {
                const selected = feedback === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={isSavingFeedback}
                    onClick={() => onFeedback(selected ? null : option.value)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50",
                      selected
                        ? "border-violet-500 bg-violet-600 text-white"
                        : "border-gray-200 bg-white text-gray-600 hover:border-violet-300 hover:text-violet-700",
                    )}
                  >
                    {selected && <CheckCircle2 className="mr-1 inline h-3 w-3" />}
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t bg-white px-6 py-4 gap-2 sm:justify-between">
          <Button variant="outline" onClick={onEdit}>
            <PencilLine className="mr-1.5 h-4 w-4" />
            Edit first
          </Button>
          <Button onClick={onContinue} className="bg-violet-600 hover:bg-violet-700">
            <ExternalLink className="mr-1.5 h-4 w-4" />
            {continueLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}