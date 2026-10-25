import { useMemo } from "react";
import type { ReachDiagnosis } from "@/lib/api";

const W = 640;
const H = 190;
const PAD = { l: 8, r: 8, t: 14, b: 26 };

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

// Every measured post as a dot: height is impressions, ink is a post with a
// concrete detail, red pen is one the check flagged as generic. LinkedIn's two
// documented feed changes are vertical lines, so a step change is obvious.
export function ReachTimeline({ data }: { data: ReachDiagnosis }) {
  const chart = useMemo(() => {
    if (data.points.length < 2) return null;
    const times = data.points.map((p) => Date.parse(p.date));
    const eventTimes = data.events.map((e) => Date.parse(`${e.date}T00:00:00Z`));
    const day = 86400000;
    const min = Math.min(...times) - day * 3;
    const max = Math.max(...times) + day * 3;
    const span = max - min || 1;
    const maxImpressions = Math.max(...data.points.map((p) => p.impressions), 1);
    const x = (t: number) => PAD.l + ((t - min) / span) * (W - PAD.l - PAD.r);
    const y = (v: number) => PAD.t + (1 - Math.sqrt(v / maxImpressions)) * (H - PAD.t - PAD.b);
    return {
      min, max, x, y, maxImpressions,
      dots: data.points.map((p, i) => ({ ...p, cx: x(times[i]!), cy: y(p.impressions) })),
      events: data.events
        .map((e, i) => ({ ...e, t: eventTimes[i]! }))
        .filter((e) => e.t >= min && e.t <= max),
    };
  }, [data]);

  if (!chart) return null;

  return (
    <figure className="space-y-1.5" data-testid="reach-timeline">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto overflow-visible" role="img" aria-label="Impressions for each measured post over time, with LinkedIn feed changes marked">
        {[0.25, 0.5, 1].map((fraction) => (
          <line key={fraction} x1={PAD.l} x2={W - PAD.r} y1={chart.y(chart.maxImpressions * fraction)} y2={chart.y(chart.maxImpressions * fraction)} stroke="currentColor" className="text-gray-200" strokeDasharray="2 4" />
        ))}
        {chart.events.map((e) => (
          <g key={e.date}>
            <line x1={chart.x(e.t)} x2={chart.x(e.t)} y1={PAD.t - 6} y2={H - PAD.b} stroke="currentColor" className="text-violet-500" strokeWidth={1.25} />
            <text
              x={chart.x(e.t) + (chart.x(e.t) < W * 0.3 ? 5 : -5)}
              y={H - PAD.b - 6}
              textAnchor={chart.x(e.t) < W * 0.3 ? "start" : "end"}
              className="fill-violet-600"
              fontSize={10}
              fontWeight={600}
            >{e.label}</text>
          </g>
        ))}
        {chart.dots.map((d) => (
          <circle
            key={d.id}
            cx={d.cx}
            cy={d.cy}
            r={6}
            className={d.flagged ? "fill-[var(--color-pen)]" : d.hasNumber ? "fill-gray-900" : "fill-gray-400"}
            fillOpacity={0.9}
            stroke="#FFFDF8"
            strokeWidth={1.5}
          >
            <title>{`${fmtDate(Date.parse(d.date))}: ${d.impressions.toLocaleString("en-GB")} impressions${d.flagged ? " · flagged generic" : d.hasNumber ? " · has a number" : ""}`}</title>
          </circle>
        ))}
        <text x={PAD.l} y={H - 8} fontSize={10} className="fill-gray-400">{fmtDate(chart.min)}</text>
        <text x={W - PAD.r} y={H - 8} fontSize={10} textAnchor="end" className="fill-gray-400">{fmtDate(chart.max)}</text>
      </svg>
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-semibold text-gray-500">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-gray-900" />Has a number</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-gray-400" />No number</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--color-pen)]" />Flagged generic</span>
        <span className="ml-auto text-gray-400">Height = impressions</span>
      </figcaption>
    </figure>
  );
}
