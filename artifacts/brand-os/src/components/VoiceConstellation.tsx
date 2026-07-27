import { useEffect, useMemo, useState } from "react";
import { voiceApi, type VoiceSignalEntry } from "@/lib/api";

type Star = {
  key: string;
  label: string;
  kind: "tone" | "vocab" | "style";
  weight: number; // how many posts exhibit this trait
  topics: string[]; // posts that taught it
  x: number;
  y: number;
  delay: number;
};

const KIND_COLOR: Record<Star["kind"], string> = {
  tone: "#a78bfa",   // violet — tone markers
  vocab: "#34d399",  // emerald — vocabulary fingerprint
  style: "#fbbf24",  // amber — sentence/opening styles
};

// Deterministic pseudo-random from a string, so star positions are stable
// across renders and visits — the sky only changes when the DNA does.
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function buildStars(entries: VoiceSignalEntry[]): Star[] {
  const traits = new Map<string, { label: string; kind: Star["kind"]; weight: number; topics: Set<string> }>();

  const add = (label: string, kind: Star["kind"], topic: string | null) => {
    const key = `${kind}:${label.toLowerCase()}`;
    const existing = traits.get(key);
    if (existing) {
      existing.weight++;
      if (topic) existing.topics.add(topic);
    } else {
      traits.set(key, { label, kind, weight: 1, topics: new Set(topic ? [topic] : []) });
    }
  };

  for (const e of entries) {
    for (const t of e.signals.toneMarkers ?? []) add(t, "tone", e.topic);
    for (const v of (e.signals.vocabulary ?? []).slice(0, 4)) add(v, "vocab", e.topic);
    if (e.signals.sentenceStyle) add(e.signals.sentenceStyle, "style", e.topic);
    if (e.signals.openingStyle) add(e.signals.openingStyle, "style", e.topic);
  }

  return [...traits.entries()]
    .sort((a, b) => b[1].weight - a[1].weight)
    .slice(0, 18)
    .map(([key, t]) => {
      const r1 = hash(key);
      const r2 = hash(key + "y");
      return {
        key,
        label: t.label.length > 26 ? t.label.slice(0, 24) + "…" : t.label,
        kind: t.kind,
        weight: t.weight,
        topics: [...t.topics].slice(0, 3),
        x: 8 + r1 * 84,
        y: 12 + r2 * 70,
        delay: hash(key + "d") * 3,
      };
    });
}

export function VoiceConstellation() {
  const [entries, setEntries] = useState<VoiceSignalEntry[] | null>(null);
  const [selected, setSelected] = useState<Star | null>(null);

  useEffect(() => {
    voiceApi.signals().then((r) => setEntries(r.signals)).catch(() => setEntries([]));
  }, []);

  const stars = useMemo(() => buildStars(entries ?? []), [entries]);

  // Connect each star to its nearest same-kind neighbour for constellation lines
  const lines = useMemo(() => {
    const out: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    for (const s of stars) {
      let best: Star | null = null;
      let bestD = Infinity;
      for (const o of stars) {
        if (o.key === s.key || o.kind !== s.kind) continue;
        const d = (s.x - o.x) ** 2 + (s.y - o.y) ** 2;
        if (d < bestD) { bestD = d; best = o; }
      }
      if (best && bestD < 1400) out.push({ x1: s.x, y1: s.y, x2: best.x, y2: best.y });
    }
    return out;
  }, [stars]);

  if (entries === null) {
    return <div className="h-44 rounded-2xl bg-gray-900 animate-pulse" />;
  }

  if (stars.length === 0) {
    return (
      <div className="h-44 rounded-2xl bg-gray-900 flex items-center justify-center px-8">
        <p className="text-xs text-white/40 text-center leading-relaxed">
          Your voice constellation appears here once you've published a few posts.
          Every post adds a star — this is the system learning how you write.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative rounded-2xl bg-gray-900 overflow-hidden" style={{ height: "13rem" }}>
        <svg viewBox="0 0 100 90" className="w-full h-full" preserveAspectRatio="none">
          {lines.map((l, i) => (
            <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="white" strokeOpacity="0.12" strokeWidth="0.25" />
          ))}
          {stars.map((s) => (
            <g key={s.key} onClick={() => setSelected(selected?.key === s.key ? null : s)} className="cursor-pointer">
              <circle cx={s.x} cy={s.y} r={1 + Math.min(s.weight, 6) * 0.45} fill={KIND_COLOR[s.kind]}
                style={{ animation: `star-pulse 2.6s ease-in-out ${s.delay}s infinite` }} />
              <circle cx={s.x} cy={s.y} r={5} fill="transparent" />
              {selected?.key === s.key && (
                <circle cx={s.x} cy={s.y} r={3.2} fill="none" stroke={KIND_COLOR[s.kind]} strokeWidth="0.3" strokeOpacity="0.7" />
              )}
            </g>
          ))}
        </svg>
        <div className="absolute bottom-2 left-3 flex gap-3">
          {(["tone", "vocab", "style"] as const).map((k) => (
            <span key={k} className="flex items-center gap-1 text-[9px] text-white/50 uppercase tracking-wider font-bold">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: KIND_COLOR[k] }} />
              {k === "tone" ? "Tone" : k === "vocab" ? "Vocabulary" : "Style"}
            </span>
          ))}
        </div>
        <style>{`@keyframes star-pulse { 0%,100% { opacity: 0.65; } 50% { opacity: 1; } }`}</style>
      </div>

      {selected && (
        <div className="rounded-2xl border border-gray-100 bg-white p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: KIND_COLOR[selected.kind] }} />
            <p className="text-sm font-bold text-gray-800">{selected.label}</p>
            <span className="text-[10px] text-gray-400 ml-auto">seen in {selected.weight} post{selected.weight !== 1 ? "s" : ""}</span>
          </div>
          {selected.topics.length > 0 && (
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Learned from: {selected.topics.map((t) => `“${t}”`).join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
