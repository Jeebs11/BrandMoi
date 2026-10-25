import { useEffect, useState } from "react";
import { profileAlignmentApi, type ComparisonRow, type ComparisonTable, type ApplicableSource } from "@/lib/api";
import { coherenceScore, isProofPointRow, outliers } from "@/lib/profile-coherence";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";

const SOURCES: Array<{ key: ApplicableSource; label: string }> = [
  { key: "cv", label: "CV" },
  { key: "brandmoi", label: "BrandMoi" },
  { key: "linkedin", label: "LinkedIn" },
];

const show = (v: string | string[] | undefined) => (!v || (Array.isArray(v) && v.length === 0) ? null : Array.isArray(v) ? v.join(", ") : v);

function Ring({ score }: { score: number }) {
  const R = 38;
  const C = 2 * Math.PI * R;
  const tone = score >= 75 ? "stroke-emerald-600" : score >= 50 ? "stroke-amber-500" : "stroke-[var(--color-pen)]";
  return (
    <div className="relative h-24 w-24 flex-shrink-0" role="img" aria-label={`Coherence ${score} out of 100`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={R} fill="none" strokeWidth="8" className="stroke-gray-200" />
        <circle cx="50" cy="50" r={R} fill="none" strokeWidth="8" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - score / 100)} className={cn("transition-all duration-700", tone)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-semibold leading-none tabular-nums text-gray-900">{score}</span>
        <span className="mt-0.5 text-[8px] font-bold uppercase tracking-widest text-gray-400">coherence</span>
      </div>
    </div>
  );
}

function RowMirror({ row }: { row: ComparisonRow }) {
  const off = outliers(row.status);
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3.5">
      <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-gray-400">{row.label}</p>
      <div className="space-y-1.5">
        {SOURCES.filter((s) => row.applicableSources.includes(s.key)).map((source) => {
          const value = show(row[source.key]?.value);
          const isOff = off.includes(source.key);
          return (
            <div
              key={source.key}
              className={cn(
                "flex gap-3 rounded-xl border-l-2 px-3 py-2",
                isOff ? "border-[var(--color-pen)] bg-[var(--color-pen-soft)]" : "border-gray-200 bg-gray-50",
              )}
            >
              <span className="w-14 flex-shrink-0 pt-0.5 text-[9px] font-black uppercase tracking-wider text-gray-400">{source.label}</span>
              <span className={cn("min-w-0 flex-1 text-xs leading-relaxed", value ? "text-gray-800" : "text-gray-400")}>{value ?? "Not set"}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-gray-500">{row.statusDetail}</p>
    </div>
  );
}

function Mark({ ok }: { ok: boolean }) {
  return ok
    ? <Check className="h-3.5 w-3.5 text-emerald-600" aria-label="Yes" />
    : <X className="h-3.5 w-3.5 text-[var(--color-pen)]" aria-label="No" />;
}

export function ProfileMirror({ enabled, refreshKey }: { enabled: boolean; refreshKey: number }) {
  const [table, setTable] = useState<ComparisonTable | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    profileAlignmentApi.comparison().then((t) => { if (active) setTable(t); }).catch(() => { if (active) setTable(null); });
    return () => { active = false; };
  }, [enabled, refreshKey]);

  if (!enabled || !table) return null;
  const coherence = coherenceScore(table);

  return (
    <section className="space-y-3" data-testid="profile-mirror">
      <div className="flex items-center gap-4 rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
        {coherence ? <Ring score={coherence.score} /> : null}
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold leading-tight text-gray-900">Does your profile tell one story?</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
            {coherence
              ? `LinkedIn's feed reads your profile next to each post, so the gaps below are worth closing. Based on ${coherence.counted} comparable ${coherence.counted === 1 ? "area" : "areas"}; this view costs no AI.`
              : "Add your CV and LinkedIn profile to compare them with BrandMoi. This view costs no AI."}
          </p>
        </div>
      </div>

      {table.rows.map((row) =>
        isProofPointRow(row) ? (
          <div key={row.rowKey} className="rounded-2xl border border-gray-200 bg-white p-3.5">
            <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-gray-400">{row.label}</p>
            {row.points.length === 0 ? (
              <p className="text-xs text-gray-400">No proof points to compare yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {row.points.map((p) => (
                  <li key={p.point} className="flex items-start justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2">
                    <span className="min-w-0 flex-1 text-xs leading-relaxed text-gray-800">{p.point}</span>
                    <span className="flex flex-shrink-0 items-center gap-3 text-[9px] font-bold uppercase tracking-wider text-gray-400">
                      <span className="flex items-center gap-1">CV <Mark ok={p.presentInCv} /></span>
                      <span className="flex items-center gap-1">LinkedIn <Mark ok={p.reflectedInLinkedin} /></span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[11px] leading-relaxed text-gray-500">{row.statusDetail}</p>
          </div>
        ) : (
          <RowMirror key={row.rowKey} row={row} />
        ),
      )}
    </section>
  );
}
