import { useEffect, useState } from "react";
import { Compass } from "lucide-react";
import { guidanceApi, type GuidanceStage } from "@/lib/api";
import { cn } from "@/lib/utils";

const fmt = (n: number) => n.toLocaleString("en-GB");
const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function Stage({ stage, measured }: { stage: GuidanceStage; measured: number }) {
  return (
    <li className="rounded-2xl border border-gray-200 bg-gray-50 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-xs font-bold text-gray-900">{stage.label}</p>
        <span
          className={cn(
            "flex-shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider",
            stage.status === "tracking" ? "bg-emerald-100 text-emerald-800" : "bg-gray-200 text-gray-500",
          )}
        >
          {stage.status === "inactive" ? "Not active yet" : stage.status === "tracking" ? "Tracking" : stage.status === "too_early" ? "Too early" : "Can't date"}
        </span>
      </div>

      {stage.status === "inactive" && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-gray-500">
          Switches on at {stage.minMeasuredPosts} posts with results; you have {measured}.
        </p>
      )}

      {stage.activatedAt && stage.status !== "inactive" && (
        <p className="mt-1.5 text-[11px] text-gray-500">Active since about {date(stage.activatedAt)}.</p>
      )}

      {stage.before && stage.after && (
        <div className="mt-2 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-white py-2">
            <p className="text-sm font-black tabular-nums text-gray-900">{fmt(stage.before.medianImpressions)}</p>
            <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Before · {stage.before.posts} posts</p>
          </div>
          <div className="rounded-xl bg-white py-2">
            <p className="text-sm font-black tabular-nums text-gray-900">{fmt(stage.after.medianImpressions)}</p>
            <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">After · {stage.after.posts} posts</p>
          </div>
        </div>
      )}

      {stage.status === "tracking" && stage.changePct !== null && (
        <p className="mt-2 text-[11px] leading-relaxed text-gray-700">
          Median impressions per post {stage.changePct >= 0 ? "rose" : "fell"} {Math.abs(stage.changePct)}% after this started.
        </p>
      )}

      {stage.caveats.map((c) => (
        <p key={c} className="mt-1.5 text-[10px] leading-relaxed text-gray-500">{c}</p>
      ))}
    </li>
  );
}

export function GuidanceTrackerCard() {
  const [data, setData] = useState<{ measuredPosts: number; stages: GuidanceStage[] } | null>(null);

  useEffect(() => {
    let active = true;
    guidanceApi.get().then((r) => { if (active) setData(r); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  if (!data || data.measuredPosts === 0) return null;

  return (
    <div className="space-y-3 rounded-3xl border border-gray-100 bg-white p-4 shadow-sm" data-testid="guidance-tracker">
      <div className="flex items-center gap-2">
        <Compass className="h-3.5 w-3.5 text-violet-500" />
        <h2 className="font-display text-lg font-semibold text-gray-900">Is the learning helping?</h2>
      </div>
      <p className="text-[11px] leading-relaxed text-gray-500">
        BrandMoi feeds what it measures from your posts back into how it writes. This compares your posts before and after each kind of guidance began.
      </p>
      <ul className="space-y-2">
        {data.stages.map((stage) => <Stage key={stage.key} stage={stage} measured={data.measuredPosts} />)}
      </ul>
      <p className="text-[10px] leading-relaxed text-gray-400">
        A before/after on a handful of posts, with LinkedIn's feed and your topics changing at the same time. Read it as a hint, not proof it worked.
      </p>
    </div>
  );
}
