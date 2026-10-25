import { useEffect, useMemo, useState } from "react";
import { Fingerprint as FingerprintIcon, Wand2 } from "lucide-react";
import { voiceProfileApi, type VoiceProfile } from "@/lib/api";
import {
  AXES, MIN_SAMPLES_FOR_FINGERPRINT, MIN_WORDS_FOR_FINGERPRINT,
  compareToFingerprint, fingerprintFromRaw, voiceRewriteInstruction, type AxisKey, type Fingerprint,
} from "@/lib/voice-fingerprint";
import { cn } from "@/lib/utils";

/**
 * The measured shape of your writing, computed server-side from your published
 * posts and pinned samples. `fingerprint` is what drafts are matched against:
 * your best-performing posts once there are enough measured ones, else your average.
 */
export function useVoiceFingerprint(): { fingerprint: Fingerprint | null; profile: VoiceProfile | null; loading: boolean } {
  const [profile, setProfile] = useState<VoiceProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    voiceProfileApi.get()
      .then((p) => { if (active) setProfile(p); })
      .catch(() => { if (active) setProfile(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const fingerprint = useMemo(
    () => (profile?.target ? fingerprintFromRaw(profile.target.raw, profile.samples, profile.words, profile.target.basis) : null),
    [profile],
  );
  return { fingerprint, profile, loading };
}

const SIZE = 280;
const C = SIZE / 2;
const R = 80;

const point = (index: number, value: number) => {
  const angle = (Math.PI * 2 * index) / AXES.length - Math.PI / 2;
  return [C + Math.cos(angle) * R * value, C + Math.sin(angle) * R * value] as const;
};
const polygon = (vector: number[]) => vector.map((v, i) => point(i, Math.max(0.04, v)).join(",")).join(" ");

export function VoiceRadar({ vector, draft, compact = false }: { vector: number[]; draft?: number[]; compact?: boolean }) {
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className={cn("flex-shrink-0", compact ? "h-28 w-28" : "h-64 w-64")} role="img" aria-label="Your writing fingerprint">
      {[0.33, 0.66, 1].map((ring) => (
        <polygon key={ring} points={polygon(AXES.map(() => ring))} fill="none" stroke="currentColor" className="text-gray-200" strokeWidth={1} />
      ))}
      {AXES.map((axis, i) => {
        const [x, y] = point(i, 1);
        return <line key={axis.key} x1={C} y1={C} x2={x} y2={y} stroke="currentColor" className="text-gray-200" strokeWidth={1} />;
      })}
      <polygon points={polygon(vector)} className="fill-violet-500/20 stroke-violet-600" strokeWidth={2} strokeLinejoin="round" />
      {draft && (
        <polygon points={polygon(draft)} fill="none" stroke="var(--color-pen)" strokeWidth={1.75} strokeDasharray="4 3" strokeLinejoin="round" />
      )}
      {!compact && AXES.map((axis, i) => {
        const [x, y] = point(i, 1.3);
        return (
          <text key={axis.key} x={x} y={y} fontSize={9} fontWeight={600} textAnchor="middle" dominantBaseline="middle" className="fill-gray-500">
            {axis.label}
          </text>
        );
      })}
    </svg>
  );
}

const FORMAT: Record<AxisKey, (v: number) => string> = {
  sentenceLength: (v) => `${v.toFixed(1)} words`,
  rhythm: (v) => v.toFixed(2),
  lineBreaks: (v) => `${v.toFixed(1)} per 100 words`,
  firstPerson: (v) => `${v.toFixed(1)} per 100 words`,
  questions: (v) => `${Math.round(v * 100)}% of sentences`,
  numbers: (v) => `${v.toFixed(1)} per 100 words`,
  contractions: (v) => `${v.toFixed(1)} per 100 words`,
};

function DriftChart({ points }: { points: NonNullable<VoiceProfile["drift"]>["points"] }) {
  const W = 300;
  const H = 70;
  if (points.length < 2) return null;
  const x = (i: number) => 8 + (i / (points.length - 1)) * (W - 16);
  const y = (match: number) => 6 + (1 - match / 100) * (H - 12);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="How closely each post matches your baseline, oldest to newest">
      <line x1={8} x2={W - 8} y1={y(75)} y2={y(75)} stroke="currentColor" className="text-gray-200" strokeDasharray="2 4" />
      {points.map((p, i) => (
        <circle
          key={p.id}
          cx={x(i)}
          cy={y(p.match)}
          r={4.5}
          className={p.aiAssisted ? "fill-white stroke-violet-600" : "fill-gray-900 stroke-gray-900"}
          strokeWidth={1.75}
        >
          <title>{`${new Date(p.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}: ${p.match}% match${p.aiAssisted ? " · AI-assisted" : " · hand-written"}`}</title>
        </circle>
      ))}
    </svg>
  );
}

export function VoiceFingerprintCard() {
  const { fingerprint, profile, loading } = useVoiceFingerprint();
  if (loading) return null;

  const drift = profile?.drift ?? null;
  const gap = drift && drift.assistedAvg !== null && drift.handwrittenAvg !== null ? drift.handwrittenAvg - drift.assistedAvg : null;

  return (
    <section className="space-y-5 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm" data-testid="voice-fingerprint-card">
      <div className="flex items-center gap-2">
        <FingerprintIcon className="h-4 w-4 text-violet-600" />
        <h2 className="font-display text-lg font-semibold text-gray-900">Your writing fingerprint</h2>
      </div>

      {fingerprint && profile ? (
        <>
          <div className="flex flex-col items-center gap-3">
            <VoiceRadar vector={fingerprint.vector} />
            <div className="w-full min-w-0 space-y-1.5">
              {AXES.map((axis) => (
                <div key={axis.key} className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="text-gray-500">{axis.label}</span>
                  <span className="font-bold tabular-nums text-gray-900">{FORMAT[axis.key](fingerprint.raw[axis.key])}</span>
                </div>
              ))}
              <p className="pt-2 text-[10px] leading-relaxed text-gray-400">
                {fingerprint.basis === "best-performing"
                  ? `Measured from your best-performing posts (top third of ${profile.measuredPosts} measured). New drafts are written toward this shape and compared against it.`
                  : `Measured from ${profile.samples} of your posts and samples (${profile.words.toLocaleString("en-GB")} words). Once you have 8 posts with performance data, it switches to your best-performing posts.`}
                {" "}It captures rhythm and phrasing, not meaning.
              </p>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h3 className="mb-2 text-[10px] font-black uppercase tracking-wider text-gray-400">What your best posts do differently</h3>
            {profile.insights.length > 0 ? (
              <ul className="space-y-1.5">
                {profile.insights.map((i) => (
                  <li key={i.key} className="text-xs leading-relaxed text-gray-700">
                    <span className="font-bold text-gray-900">{i.label}:</span> {FORMAT[i.key](i.top)} in your best posts against {FORMAT[i.key](i.rest)} in the rest.
                  </li>
                ))}
                <li className="pt-1 text-[10px] leading-relaxed text-gray-400">A pattern in your own posts, not proof of cause — a few posts can move these.</li>
              </ul>
            ) : profile.measuredPosts >= 8 ? (
              <p className="text-xs leading-relaxed text-gray-500">No clear difference in shape between your best posts and the rest. What separates them is probably the content.</p>
            ) : (
              <p className="text-xs leading-relaxed text-gray-500">
                Needs 8 posts with performance data to compare your best against the rest (you have {profile.measuredPosts}). Upload your LinkedIn exports to unlock it.
              </p>
            )}
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h3 className="mb-2 text-[10px] font-black uppercase tracking-wider text-gray-400">Drift from your baseline</h3>
            {drift && profile.baseline ? (
              <>
                <DriftChart points={drift.points} />
                <p className="mt-1 flex items-center gap-4 text-[10px] font-semibold text-gray-500">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-gray-900" />Hand-written</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full border-2 border-violet-600 bg-white" />AI-assisted</span>
                  <span className="ml-auto text-gray-400">Height = match</span>
                </p>
                <p className="mt-2 text-xs leading-relaxed text-gray-700">
                  {gap !== null && drift.assistedCount >= 3 && drift.handwrittenCount >= 3
                    ? gap >= 10
                      ? `Your AI-assisted posts match your baseline ${drift.assistedAvg}% on average, against ${drift.handwrittenAvg}% for hand-written ones. That gap suggests the drafts are flattening your style — editing more would close it.`
                      : `Your AI-assisted posts match your baseline ${drift.assistedAvg}% on average, against ${drift.handwrittenAvg}% for hand-written ones. No meaningful gap.`
                    : "Not enough AI-assisted and hand-written posts to compare yet (needs 3 of each)."}
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-gray-400">
                  {profile.baseline.kind === "hand-written"
                    ? `Baseline: ${profile.baseline.posts} posts and samples that didn't start as an AI draft.`
                    : `Baseline: your first ${profile.baseline.posts} posts (no hand-written set yet).`}
                  {" "}This can't tell you why your reach changed.
                </p>
              </>
            ) : (
              <p className="text-xs leading-relaxed text-gray-500">Needs a hand-written baseline of at least {MIN_SAMPLES_FOR_FINGERPRINT} posts or pinned samples first.</p>
            )}
          </div>
        </>
      ) : (
        <p className="text-xs leading-relaxed text-gray-500">
          Your fingerprint appears once you have at least {MIN_SAMPLES_FOR_FINGERPRINT} published posts or pinned writing samples
          ({MIN_WORDS_FOR_FINGERPRINT}+ words in total). Pin a few of your own posts in Settings to start.
        </p>
      )}
    </section>
  );
}

/** "Does this draft sound like me", with a one-tap fix. */
export function VoiceMatch({
  text, fingerprint, onRefine, isRefining = false,
}: {
  text: string;
  fingerprint: Fingerprint | null | undefined;
  onRefine?: (instruction: string, tab?: "post", label?: string) => void;
  isRefining?: boolean;
}) {
  const comparison = useMemo(
    () => (fingerprint ? compareToFingerprint(text, fingerprint) : null),
    [fingerprint, text],
  );
  if (!fingerprint || !comparison) return null;

  const instruction = voiceRewriteInstruction(comparison, fingerprint.basis);
  const tone = comparison.match >= 75 ? "text-emerald-700" : comparison.match >= 55 ? "text-amber-700" : "text-[var(--color-pen)]";
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4" data-testid="voice-match">
      <VoiceRadar vector={fingerprint.vector} draft={comparison.vector} compact />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
          Voice match{fingerprint.basis === "best-performing" ? " · vs your best posts" : ""}
        </p>
        <p className={cn("font-display text-3xl font-semibold leading-tight tabular-nums", tone)}>{comparison.match}%</p>
        <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
          {comparison.note ?? "The shape of this draft is close to how you usually write."}
        </p>
        {instruction && onRefine && comparison.match < 90 && (
          <button
            type="button"
            onClick={() => onRefine(instruction, "post", "Closer to my voice")}
            disabled={isRefining}
            data-testid="button-match-voice"
            className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            <Wand2 className="h-3.5 w-3.5" />
            {isRefining ? "Rewriting…" : "Rewrite closer to my voice"}
          </button>
        )}
        <p className="mt-2 flex items-center gap-3 text-[10px] font-semibold text-gray-400">
          <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-violet-600" />You</span>
          <span className="flex items-center gap-1"><span className="h-0.5 w-3 border-t border-dashed border-[var(--color-pen)]" />This draft</span>
        </p>
      </div>
    </div>
  );
}
