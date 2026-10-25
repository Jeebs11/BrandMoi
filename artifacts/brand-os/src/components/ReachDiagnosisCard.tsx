import { useEffect, useState } from "react";
import { Stethoscope } from "lucide-react";
import { reachDiagnosisApi, type ReachDiagnosis } from "@/lib/api";

const fmt = (n: number) => n.toLocaleString("en-GB");

export function ReachDiagnosisCard() {
  const [data, setData] = useState<ReachDiagnosis | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    reachDiagnosisApi.get()
      .then((result) => { if (active) setData(result); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);

  if (failed || !data || data.postCount === 0) return null;

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Stethoscope className="w-3.5 h-3.5 text-violet-500" />
        <h2 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest">What changed in your reach</h2>
      </div>

      <ul className="space-y-1.5">
        {data.findings.map((finding) => (
          <li key={finding} className="text-xs text-gray-700 leading-relaxed">{finding}</li>
        ))}
      </ul>

      {data.eras.length > 1 && (
        <div className="space-y-1">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Median impressions by period</p>
          {data.eras.map((era) => (
            <div key={era.label} className="flex items-baseline justify-between gap-3 text-[11px]">
              <span className="text-gray-500 min-w-0 truncate">{era.label} <span className="text-gray-300">· {era.posts} posts</span></span>
              <span className="font-black text-gray-900 tabular-nums">{fmt(era.medianImpressions)}</span>
            </div>
          ))}
        </div>
      )}

      {data.conversation && (
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Per 1,000 impressions</p>
          <div className="grid grid-cols-4 gap-2 text-center">
            {([
              ["Comments", data.conversation.commentsPer1000],
              ["Saves", data.conversation.savesPer1000],
              ["Sends", data.conversation.sendsPer1000],
              ["Reposts", data.conversation.repostsPer1000],
            ] as const).map(([label, value]) => (
              <div key={label} className="rounded-xl bg-gray-50 py-2">
                <p className="text-sm font-black text-gray-900 tabular-nums">{value}</p>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-gray-400 leading-relaxed">
        Based on your own measured posts. These are patterns, not proof — LinkedIn does not publish how it ranks posts.
      </p>
    </div>
  );
}
