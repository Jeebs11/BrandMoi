import { useMemo } from "react";
import { cn } from "@/lib/utils";

// LinkedIn truncates the in-feed preview at ~210 chars (≈3 lines) on desktop.
// Everything before that is the hook that earns the "…see more" click.
const FOLD = 210;

const WEAK_OPENERS = [
  "i'm excited", "im excited", "i am excited", "i'm thrilled", "im thrilled",
  "today i", "today,", "in this post", "i wanted to", "i'm happy to",
  "sharing this", "i am pleased", "i'm pleased", "excited to announce",
];

type Tone = "good" | "warn" | "bad" | "muted";
const TONE: Record<Tone, string> = {
  good: "bg-emerald-50 text-emerald-700 border-emerald-100",
  warn: "bg-amber-50 text-amber-700 border-amber-100",
  bad: "bg-red-50 text-red-600 border-red-100",
  muted: "bg-gray-50 text-gray-500 border-gray-100",
};

function Chip({ tone, label, title }: { tone: Tone; label: string; title?: string }) {
  return (
    <span title={title} className={cn("text-[10px] font-bold px-2 py-1 rounded-full border whitespace-nowrap", TONE[tone])}>
      {label}
    </span>
  );
}

export function PostMeter({ post, hashtags }: { post: string; hashtags: string }) {
  const m = useMemo(() => {
    const text = post ?? "";
    const chars = text.length;

    // Character zone
    let charTone: Tone = "muted";
    let charLabel = `${chars} chars`;
    if (chars === 0) { charTone = "muted"; charLabel = "empty"; }
    else if (chars < 800) { charTone = "muted"; charLabel = `${chars} · a bit short`; }
    else if (chars <= 2000) { charTone = "good"; charLabel = `${chars} · ideal`; }
    else if (chars <= 2800) { charTone = "warn"; charLabel = `${chars} · getting long`; }
    else { charTone = "bad"; charLabel = `${chars} · too long`; }

    // Hook before the fold
    const firstLine = text.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "";
    const hookLen = Math.min(chars, FOLD);
    const hookFits = chars > 0;
    const hookTone: Tone = !hookFits ? "muted" : chars <= FOLD ? "good" : "good";

    // Paragraph structure — flag walls of text
    const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    const longest = paragraphs.reduce((mx, p) => Math.max(mx, p.split("\n").length), 0);
    const wallOfText = longest >= 5;

    // Hashtags (body + the dedicated field)
    const bodyTags = (text.match(/#[A-Za-z][A-Za-z0-9_]*/g) ?? []).length;
    const fieldTags = (hashtags.match(/#[A-Za-z][A-Za-z0-9_]*/g) ?? []).length;
    const totalTags = bodyTags + fieldTags;
    let tagTone: Tone = "muted";
    if (totalTags === 0) tagTone = "muted";
    else if (totalTags <= 3) tagTone = "good";
    else if (totalTags <= 5) tagTone = "warn";
    else tagTone = "bad";

    // External link in body
    const hasLink = /https?:\/\/\S+/i.test(text);

    // Weak opener
    const lower = firstLine.toLowerCase();
    const weakOpener = WEAK_OPENERS.some((w) => lower.startsWith(w));

    return { chars, charTone, charLabel, firstLine, hookLen, hookFits, hookTone, paragraphs: paragraphs.length, wallOfText, totalTags, tagTone, hasLink, weakOpener };
  }, [post, hashtags]);

  if (m.chars === 0) return null;

  const aboveFold = post.slice(0, FOLD);
  const belowFold = post.slice(FOLD);

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-3 space-y-2.5">
      {/* Feed preview — exactly what shows before "…see more" */}
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">
          Feed preview · {m.hookLen}/{FOLD} before “see more”
        </p>
        <div className="text-xs leading-relaxed bg-gray-50 rounded-xl p-2.5 whitespace-pre-wrap">
          <span className="text-gray-800">{aboveFold}</span>
          {belowFold && (
            <>
              <span className="text-gray-300">{belowFold.length > 60 ? belowFold.slice(0, 60) + "…" : belowFold}</span>
              <span className="ml-1 text-[11px] font-semibold text-gray-400">…see more</span>
            </>
          )}
        </div>
      </div>

      {/* Live chips */}
      <div className="flex flex-wrap gap-1.5">
        <Chip tone={m.charTone} label={m.charLabel} title="LinkedIn's engagement sweet spot is ~800–2,000 characters." />
        <Chip tone={m.hookTone} label={`hook ${m.hookLen}/${FOLD}`} title="Everything before ~210 chars is your hook — it must earn the 'see more' click." />
        <Chip tone={m.wallOfText ? "warn" : "good"} label={`${m.paragraphs} paragraph${m.paragraphs !== 1 ? "s" : ""}`} title={m.wallOfText ? "A paragraph is 5+ lines — break it up. Whitespace boosts dwell time." : "Good — short paragraphs lift dwell time."} />
        <Chip tone={m.tagTone} label={`${m.totalTags} hashtag${m.totalTags !== 1 ? "s" : ""}`} title="1–3 hashtags is optimal; more than 5 hurts reach." />
        {m.hasLink && <Chip tone="bad" label="link in body" title="External links in the post body carry a ~25–40% reach penalty. Put it in the first comment." />}
        {m.weakOpener && <Chip tone="warn" label="weak opener" title="Starting with 'I'm excited…' / 'Today…' buries the hook. Lead with tension or a bold claim." />}
      </div>
    </div>
  );
}
