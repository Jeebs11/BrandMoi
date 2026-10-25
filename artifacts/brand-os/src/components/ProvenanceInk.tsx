import { useMemo } from "react";
import { computeInk } from "@/lib/provenance";
import { cn } from "@/lib/utils";

// The post as ink on paper: your words solid, the AI's untouched words faded,
// generic phrases underlined in the editor's red pen.
export function ProvenanceInk({ original, text }: { original: string | null | undefined; text: string }) {
  const ink = useMemo(() => computeInk(original, text), [original, text]);
  const hasOriginal = !!original && original.trim().length > 0;

  return (
    <div className="space-y-3" data-testid="provenance-ink">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          {hasOriginal ? (
            <>
              <p className="font-display text-3xl font-semibold leading-none text-gray-900 tabular-nums">
                {ink.yourPct}<span className="text-lg text-gray-400">% yours</span>
              </p>
              <p className="mt-1 text-[11px] text-gray-500">{ink.yourWords} of {ink.totalWords} words are yours; the rest are still the AI draft.</p>
            </>
          ) : (
            <p className="text-[11px] text-gray-500">No AI draft to compare against — this one is all you.</p>
          )}
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-1 text-[10px] font-semibold text-gray-500">
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-gray-900" />Your words</span>
          {hasOriginal && <span className="flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-gray-300" />AI draft</span>}
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-[var(--color-pen)]" />Generic</span>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
        <p className="whitespace-pre-wrap font-display text-[17px] leading-[1.75]">
          {ink.tokens.map((token, i) => (
            <span
              key={i}
              title={token.flag ?? undefined}
              className={cn(
                token.source === "you" ? "text-gray-900" : hasOriginal ? "text-gray-400" : "text-gray-900",
                token.flag && "underline decoration-[var(--color-pen)] decoration-wavy decoration-1 underline-offset-[5px]",
              )}
            >
              {token.text}
            </span>
          ))}
        </p>
      </div>

      {ink.flags.length > 0 && (
        <ul className="space-y-1" data-testid="ink-flags">
          {ink.flags.map((flag) => (
            <li key={flag} className="flex items-start gap-2 text-[11px] leading-relaxed text-gray-600">
              <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--color-pen)]" />
              {flag}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
