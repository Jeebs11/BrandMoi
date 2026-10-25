import { useState } from "react";
import { MessageCircle, X } from "lucide-react";

const WINDOW_MINUTES = 90;

type DraftLike = { id: number; status: string; updatedAt: string };

function dismissedKey(id: number) {
  return `brandmoi:first-hour-dismissed:${id}`;
}

function wasDismissed(id: number): boolean {
  try {
    return localStorage.getItem(dismissedKey(id)) === "1";
  } catch {
    return false;
  }
}

// Shown only right after a post is marked published. Comments and replies are
// among the actions LinkedIn says its feed model learns from; the "first hour"
// timing itself comes from third-party analyses, so the copy doesn't promise
// a specific effect.
export function FirstHourReminder({ drafts }: { drafts: DraftLike[] | undefined }) {
  const [, setTick] = useState(0);

  const latest = (drafts ?? [])
    .filter((d) => d.status === "published")
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
  if (!latest) return null;

  const minutesAgo = Math.floor((Date.now() - Date.parse(latest.updatedAt)) / 60000);
  if (!Number.isFinite(minutesAgo) || minutesAgo < 0 || minutesAgo > WINDOW_MINUTES) return null;
  if (wasDismissed(latest.id)) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(dismissedKey(latest.id), "1");
    } catch {
      // Dismissal just won't persist.
    }
    setTick((n) => n + 1);
  };

  return (
    <div className="w-full rounded-3xl border border-emerald-100 bg-emerald-50/70 px-5 py-3.5 flex items-start gap-3" data-testid="first-hour-reminder">
      <MessageCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-emerald-900">
          Posted {minutesAgo < 2 ? "just now" : `${minutesAgo} minutes ago`} — stay for the replies
        </p>
        <p className="text-xs text-emerald-800 leading-relaxed mt-0.5">
          Answer each comment properly while the post is fresh. Comments and replies are among the actions LinkedIn's feed model learns from, and a real answer keeps people reading.
        </p>
      </div>
      <button onClick={dismiss} aria-label="Dismiss" className="p-1 -mr-1 text-emerald-600/70 hover:text-emerald-800">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
