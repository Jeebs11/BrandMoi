import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ChevronLeft, Check, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useUpdatePreferences } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { SmartImportButton } from "@/components/SmartImportButton";
import type { ExtractedBrandVoice } from "@/lib/api";

// Audience replaces the legacy Objective field. Stored in preferences.objective for back-compat.
const AUDIENCES = ["Clients", "Peers", "Recruiters & Headhunters", "Investors", "My audience"];
// Feelings replace the legacy Tone field. Stored in preferences.tone.
const FEELINGS = ["Direct", "Witty", "Vulnerable", "Story", "Contrarian"];

const AUDIENCE_DESC: Record<string, string> = {
  "Clients": "Future buyers and prospects",
  "Peers": "Other operators in your field",
  "Recruiters & Headhunters": "Hiring managers and recruiters",
  "Investors": "VCs, angels, capital allocators",
  "My audience": "Mixed crowd already following you",
};

const FEELING_DESC: Record<string, string> = {
  Direct: "Clear, authoritative, no fluff",
  Witty: "Dry, self-aware humour",
  Vulnerable: "Personal, honest, open",
  Story: "Opens with a vivid scene",
  Contrarian: "Challenges conventional wisdom",
};

type OnboardingState = {
  objective: string;
  persona: string;
  tone: string;
  brandRole: string;
  brandAudience: string;
  brandBelief: string;
  contentPillars: string[];
  proofPoints: string[];
  aboutMe: string;
  writingSamples: string[];
};

export default function Onboarding() {
  const [, navigate] = useLocation();
  const { invalidate } = useAuth();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingState>({
    objective: "My audience",
    persona: "Founder",
    tone: "Direct",
    brandRole: "",
    brandAudience: "",
    brandBelief: "",
    contentPillars: [],
    proofPoints: [],
    aboutMe: "",
    writingSamples: [],
  });
  const [newSample, setNewSample] = useState("");
  const [newPillar, setNewPillar] = useState("");
  const [newProofPoint, setNewProofPoint] = useState("");

  const { mutate: updatePreferences, isPending } = useUpdatePreferences();
  const missingRequired = [
    !data.brandRole.trim() ? "your role" : "",
    !data.brandAudience.trim() ? "your audience" : "",
    data.contentPillars.length === 0 ? "one professional territory" : "",
    data.proofPoints.length === 0 ? "one proof point" : "",
  ].filter(Boolean);

  const set = <K extends keyof OnboardingState>(key: K, value: string) =>
    setData((d) => ({ ...d, [key]: value }));

  const handleSmartImport = (extracted: ExtractedBrandVoice) => {
    setData((d) => ({
      ...d,
      brandRole: extracted.brandRole || d.brandRole,
      brandAudience: extracted.brandAudience || d.brandAudience,
      brandBelief: extracted.brandBelief || d.brandBelief,
      objective: extracted.objective || d.objective,
      persona: extracted.persona || d.persona,
      tone: extracted.tone || d.tone,
      contentPillars: extracted.contentPillars?.length ? extracted.contentPillars : d.contentPillars,
      proofPoints: extracted.proofPoints?.length ? extracted.proofPoints : d.proofPoints,
      aboutMe: extracted.summary ? extracted.summary.slice(0, 500) : d.aboutMe,
    }));
  };

  const handleFinish = () => {
    if (missingRequired.length > 0) {
      setStep(3);
      return;
    }
    updatePreferences(
      {
        data: {
          objective: data.objective,
          persona: data.persona,
          tone: data.tone,
          brandRole: data.brandRole,
          brandAudience: data.brandAudience,
          brandBelief: data.brandBelief,
          onboarded: true,
          ...(data.contentPillars.length > 0 ? { contentPillars: data.contentPillars } : {}),
          ...(data.proofPoints.length > 0 ? { proofPoints: data.proofPoints } : {}),
          ...(data.writingSamples.length > 0 ? { writingSamples: data.writingSamples } : {}),
          ...(data.aboutMe ? { aboutMe: data.aboutMe } : {}),
        },
      },
      {
        onSuccess: async () => {
          await invalidate();
          navigate("/");
        },
      }
    );
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <motion.div key="ob1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col h-full">
            <div className="flex-1 pt-4 pb-32 overflow-y-auto no-scrollbar">
              <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Who are you writing for?</h2>
              <p className="text-gray-500 text-sm mb-7">Your default audience. You can swap it on any post.</p>
              <div className="space-y-3">
                {AUDIENCES.map((a) => (
                  <button
                    key={a}
                    onClick={() => set("objective", a)}
                    className={cn(
                      "w-full text-left p-5 rounded-2xl border-2 transition-all",
                      data.objective === a ? "border-primary bg-primary/5" : "border-gray-100 bg-white hover:border-primary/30"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={cn("font-bold mb-0.5", data.objective === a ? "text-primary" : "text-gray-800")}>{a}</p>
                        <p className="text-xs text-gray-500">{AUDIENCE_DESC[a]}</p>
                      </div>
                      {data.objective === a && (
                        <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center flex-shrink-0 ml-3">
                          <Check className="w-3 h-3 text-white" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <NextButton onClick={() => setStep(2)} />
          </motion.div>
        );

      case 2:
        return (
          <motion.div key="ob2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col h-full">
            <BackButton onClick={() => setStep(1)} />
            <div className="flex-1 pt-4 pb-32 overflow-y-auto no-scrollbar">
              <h2 className="text-2xl font-extrabold text-gray-900 mb-2">How should it feel?</h2>
              <p className="text-gray-500 text-sm mb-7">Your default writing energy. Swap it on any post.</p>
              <div className="space-y-3">
                {FEELINGS.map((f) => (
                  <button
                    key={f}
                    onClick={() => set("tone", f)}
                    className={cn(
                      "w-full text-left p-5 rounded-2xl border-2 transition-all",
                      data.tone === f ? "border-primary bg-primary/5" : "border-gray-100 bg-white hover:border-primary/30"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={cn("font-bold mb-0.5", data.tone === f ? "text-primary" : "text-gray-800")}>{f}</p>
                        <p className="text-xs text-gray-500">{FEELING_DESC[f]}</p>
                      </div>
                      {data.tone === f && (
                        <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center flex-shrink-0 ml-3">
                          <Check className="w-3 h-3 text-white" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <NextButton onClick={() => setStep(3)} />
          </motion.div>
        );

      case 3:
        return (
          <motion.div key="ob3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col h-full">
            <BackButton onClick={() => setStep(2)} />
            <div className="flex-1 pt-4 pb-32 overflow-y-auto no-scrollbar">
              <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Define your voice</h2>
              <p className="text-gray-500 text-sm mb-2">Required details give BrandMoi enough evidence to build your professional positioning. Optional details make the voice more personal.</p>
              <p className="text-[11px] text-gray-400 mb-5"><span className="font-bold text-rose-500">Required</span> fields must be completed before you can start creating.</p>

              <div className="mb-5">
                <SmartImportButton onApply={handleSmartImport} />
              </div>

              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs font-bold text-gray-300">or fill in manually</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <div className="space-y-5">
                <VoiceField
                  label="Your role in one sentence"
                  placeholder="I help founders build systems that scale without chaos"
                  value={data.brandRole}
                  onChange={(v) => set("brandRole", v)}
                  required
                />
                <VoiceField
                  label="Who specifically is your audience?"
                  placeholder="B2B founders with 5–50 person teams looking to systematise ops"
                  value={data.brandAudience}
                  onChange={(v) => set("brandAudience", v)}
                  required
                />
                <VoiceField
                  label="Your core belief about your field"
                  placeholder="Clarity beats cleverness. Simple systems beat complex ones."
                  value={data.brandBelief}
                  onChange={(v) => set("brandBelief", v)}
                />

                <div className="pt-1">
                  <VoiceField
                    label="A little more about you"
                    placeholder="What have you learned, built, or experienced that shapes the way you see your work?"
                    value={data.aboutMe}
                    onChange={(v) => set("aboutMe", v.slice(0, 500))}
                    optional
                  />
                  <p className="text-[10px] text-gray-300 text-right mt-1">{data.aboutMe.length}/500</p>
                </div>

                <div className="pt-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">
                     Show us how you write <FieldStatus optional />
                  </label>
                  <p className="text-xs text-gray-400 mb-2 leading-relaxed">
                    Add up to 3 posts or paragraphs you wrote yourself. These are the strongest early anchors for Voice DNA.
                  </p>
                  {data.writingSamples.length > 0 && (
                    <div className="space-y-2 mb-2">
                      {data.writingSamples.map((sample, index) => (
                        <div key={`${sample.slice(0, 12)}-${index}`} className="flex items-start gap-2 rounded-xl bg-violet-50 border border-violet-100 px-3 py-2">
                          <p className="text-xs text-violet-900 leading-relaxed flex-1 line-clamp-2">{sample}</p>
                          <button
                            type="button"
                            onClick={() => setData((current) => ({ ...current, writingSamples: current.writingSamples.filter((_, i) => i !== index) }))}
                            className="text-violet-300 hover:text-violet-700 text-sm leading-none p-1"
                            aria-label={`Remove writing sample ${index + 1}`}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {data.writingSamples.length < 3 && (
                    <>
                      <textarea
                        value={newSample}
                        onChange={(e) => setNewSample(e.target.value.slice(0, 3000))}
                        placeholder="Paste something you wrote and still recognise as your voice…"
                        rows={4}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm outline-none focus:border-primary transition-colors resize-none leading-relaxed placeholder:text-gray-300"
                      />
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-gray-300">{newSample.length}/3000</span>
                        <button
                          type="button"
                          disabled={newSample.trim().length < 50}
                          onClick={() => {
                            if (newSample.trim().length < 50) return;
                            setData((current) => ({ ...current, writingSamples: [...current.writingSamples, newSample.trim()].slice(0, 3) }));
                            setNewSample("");
                          }}
                          className="text-xs font-bold text-primary disabled:text-gray-300 hover:text-primary/80 transition-colors"
                        >
                          Add sample
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <TagInput
                   label="What do you want to be known for?"
                   hint="Add at least one professional territory. BrandMoi uses these to keep your ideas building a consistent reputation."
                  placeholder="e.g. leadership, operating systems, founder lessons"
                  values={data.contentPillars}
                  value={newPillar}
                  maxItems={6}
                  maxLength={60}
                  onChange={setNewPillar}
                  onAdd={() => {
                    const value = newPillar.trim();
                    if (!value || data.contentPillars.length >= 6) return;
                    setData((current) => ({ ...current, contentPillars: [...current.contentPillars, value] }));
                    setNewPillar("");
                  }}
                  onRemove={(index) => setData((current) => ({ ...current, contentPillars: current.contentPillars.filter((_, i) => i !== index) }))}
                   required
                />

                <TagInput
                   label="Real proof points"
                   hint="Add at least one result, decision, project, or work moment you can credibly discuss. BrandMoi will not invent evidence."
                  placeholder="e.g. Grew the team from 5 to 40 in 18 months"
                  values={data.proofPoints}
                  value={newProofPoint}
                  maxItems={8}
                  maxLength={200}
                  onChange={setNewProofPoint}
                  onAdd={() => {
                    const value = newProofPoint.trim();
                    if (!value || data.proofPoints.length >= 8) return;
                    setData((current) => ({ ...current, proofPoints: [...current.proofPoints, value] }));
                    setNewProofPoint("");
                  }}
                  onRemove={(index) => setData((current) => ({ ...current, proofPoints: current.proofPoints.filter((_, i) => i !== index) }))}
                   required
                />
              </div>
            </div>
             <NextButton onClick={() => setStep(4)} label={missingRequired.length ? `Add ${missingRequired[0]} to continue` : "Continue"} disabled={missingRequired.length > 0} />
          </motion.div>
        );

      case 4:
        return (
          <motion.div key="ob4" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col h-full items-center justify-center text-center gap-6">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
              <Check className="w-10 h-10 text-primary" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-gray-900 mb-2">You're set up</h2>
              <p className="text-gray-500 text-sm max-w-[280px] mx-auto">
                BrandMoi will use your voice settings to personalise every piece of content it helps you create.
              </p>
            </div>

            <div className="w-full bg-gray-50 rounded-2xl p-4 text-left space-y-2 border border-gray-100">
              <SummaryRow label="Audience" value={data.objective} />
              <SummaryRow label="Feeling" value={data.tone} />
              {data.brandRole && <SummaryRow label="Role" value={data.brandRole} />}
              {data.aboutMe && <SummaryRow label="About you" value={data.aboutMe} />}
              {data.writingSamples.length > 0 && <SummaryRow label="Writing samples" value={`${data.writingSamples.length} added`} />}
              {data.contentPillars.length > 0 && <SummaryRow label="Content pillars" value={data.contentPillars.join(", ")} />}
              {data.proofPoints.length > 0 && <SummaryRow label="Proof points" value={`${data.proofPoints.length} added`} />}
            </div>

            <div className="w-full space-y-3">
              <Button className="w-full h-14 text-base font-semibold" onClick={handleFinish} disabled={isPending}>
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Start creating"}
              </Button>
              <button onClick={() => setStep(3)} className="text-sm text-gray-400 hover:text-gray-600">
                ← Go back and edit
              </button>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <AppShell noNav>
        <header className="px-6 py-5 sticky top-0 bg-gray-50 z-10">
          <div className="flex gap-1.5 w-full items-center mb-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-1 flex-1 rounded-full bg-gray-200 overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  animate={{ width: step > i ? "100%" : "0%" }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 font-medium mt-1">Step {step} of 4</p>
        </header>

        <main className="flex-1 px-6 pb-6 overflow-hidden flex flex-col relative">
          <AnimatePresence mode="wait">{renderStep()}</AnimatePresence>
        </main>
    </AppShell>
  );
}

function NextButton({ onClick, label = "Next", disabled = false }: { onClick: () => void; label?: string; disabled?: boolean }) {
  return (
    <div className="absolute bottom-0 left-0 right-0 px-6 pb-8 pt-4 bg-gradient-to-t from-gray-50 via-gray-50/90 to-transparent z-10">
      <Button className="w-full h-14 text-base font-semibold group" onClick={onClick} disabled={disabled}>
        {label}
        <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </Button>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-muted-foreground flex items-center text-sm font-semibold hover:text-foreground transition-colors mt-2 mb-0"
    >
      <ChevronLeft className="w-4 h-4 mr-1" /> Back
    </button>
  );
}

function TagInput({
  label,
  hint,
  placeholder,
  values,
  value,
  maxItems,
  maxLength,
  onChange,
  onAdd,
  onRemove,
  required = false,
}: {
  label: string;
  hint: string;
  placeholder: string;
  values: string[];
  value: string;
  maxItems: number;
  maxLength: number;
  onChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  required?: boolean;
}) {
  return (
    <div className="pt-1">
      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">
        {label} <FieldStatus required={required} />
      </label>
      <p className="text-xs text-gray-400 mb-2 leading-relaxed">{hint}</p>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {values.map((item, index) => (
            <span key={`${item}-${index}`} className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 border border-sky-100 text-sky-700 text-xs px-3 py-1.5">
              <span className="max-w-[220px] truncate">{item}</span>
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="text-sky-300 hover:text-sky-700 text-sm leading-none"
                aria-label={`Remove ${item}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {values.length < maxItems && (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <input
              value={value}
              onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onAdd();
                }
              }}
              placeholder={placeholder}
              maxLength={maxLength}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm outline-none focus:border-primary transition-colors placeholder:text-gray-300"
            />
            <p className="text-[10px] text-gray-300 text-right mt-1">{value.length}/{maxLength}</p>
          </div>
          <button
            type="button"
            disabled={!value.trim()}
            onClick={onAdd}
            className="pb-3 text-xs font-bold text-primary disabled:text-gray-300 hover:text-primary/80 transition-colors"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}

function FieldStatus({ required = false, optional = false }: { required?: boolean; optional?: boolean }) {
  return (
    <span className={cn(
      "ml-1 font-bold normal-case tracking-normal",
      required ? "text-rose-500" : "text-gray-300",
    )}>
      {required ? "Required" : optional ? "Optional" : "Optional"}
    </span>
  );
}

function VoiceField({ label, placeholder, value, onChange, required = false, optional = false }: { label: string; placeholder: string; value: string; onChange: (v: string) => void; required?: boolean; optional?: boolean }) {
  return (
    <div>
      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">{label}<FieldStatus required={required} optional={optional} /></label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm outline-none focus:border-primary transition-colors resize-none leading-relaxed placeholder:text-gray-300"
      />
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-700 text-right">{value}</span>
    </div>
  );
}
