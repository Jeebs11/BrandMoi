import { Info } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Inline "(i)" affordance for explaining a term or metric in place — pairs a
 * label with a hover tooltip instead of leaving jargon (or a bare number)
 * unexplained. `children` is the label text itself; `content` is the
 * explanation shown on hover.
 */
export function InfoTooltip({
  children, content, className,
}: {
  children?: React.ReactNode;
  content: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {children}
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.preventDefault()}
            className="inline-flex items-center justify-center text-gray-300 hover:text-gray-500 transition-colors"
            aria-label="More info"
          >
            <Info className="w-3 h-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-[240px] text-[11px] leading-relaxed">
          {content}
        </TooltipContent>
      </Tooltip>
    </span>
  );
}
