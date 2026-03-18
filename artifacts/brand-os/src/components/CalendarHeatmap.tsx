import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface Props {
  dates: string[];
}

function getColor(count: number): string {
  if (count === 0) return "bg-gray-100";
  if (count === 1) return "bg-primary/20";
  if (count === 2) return "bg-primary/45";
  if (count === 3) return "bg-primary/70";
  return "bg-primary";
}

const DAY_LABELS = ["Sun", "", "Tue", "", "Thu", "", "Sat"];

export function CalendarHeatmap({ dates }: Props) {
  const { grid, monthLabels } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const countMap = new Map<string, number>();
    for (const d of dates) {
      const key = d.slice(0, 10);
      countMap.set(key, (countMap.get(key) ?? 0) + 1);
    }

    // Build 14 weeks (98 days) back from today, aligned to Sunday of this week
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    const weeks: { date: Date; count: number }[][] = [];
    const monthLabelMap = new Map<number, string>();

    for (let w = 13; w >= 0; w--) {
      const week: { date: Date; count: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() - w * 7 + d);
        const key = date.toISOString().slice(0, 10);
        const count = countMap.get(key) ?? 0;
        week.push({ date, count });

        if (d === 0) {
          const month = date.toLocaleDateString("en", { month: "short" });
          const colIdx = 13 - w;
          if (colIdx === 0 || date.getDate() <= 7) {
            monthLabelMap.set(colIdx, month);
          }
        }
      }
      weeks.push(week);
    }

    return {
      grid: weeks,
      monthLabels: monthLabelMap,
    };
  }, [dates]);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Content Rhythm</p>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-400">Less</span>
          {[0, 1, 2, 3, 4].map((n) => (
            <div key={n} className={cn("w-2.5 h-2.5 rounded-sm", getColor(n))} />
          ))}
          <span className="text-[10px] text-gray-400">More</span>
        </div>
      </div>

      <div className="flex gap-0.5">
        {/* Day labels column */}
        <div className="flex flex-col gap-0.5 mr-1 justify-end pb-4">
          {DAY_LABELS.map((label, i) => (
            <div key={i} className="h-2.5 flex items-center">
              <span className="text-[8px] text-gray-300 w-4 leading-none">{label}</span>
            </div>
          ))}
        </div>

        {/* Weeks grid */}
        <div className="flex-1 overflow-hidden">
          {/* Month labels */}
          <div className="flex gap-0.5 mb-1 h-4">
            {grid.map((_, wi) => (
              <div key={wi} className="flex-1 flex items-center">
                {monthLabels.has(wi) && (
                  <span className="text-[8px] text-gray-400 font-semibold">{monthLabels.get(wi)}</span>
                )}
              </div>
            ))}
          </div>
          {/* Cells: rows = days (0-6), cols = weeks */}
          <div className="flex gap-0.5">
            {grid.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-0.5 flex-1">
                {week.map((cell, di) => (
                  <div
                    key={di}
                    title={`${cell.date.toLocaleDateString("en", { month: "short", day: "numeric" })}: ${cell.count} draft${cell.count !== 1 ? "s" : ""}`}
                    className={cn("h-2.5 w-full rounded-sm transition-colors", getColor(cell.count))}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
