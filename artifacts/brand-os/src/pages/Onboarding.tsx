import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ChevronLeft, Check, Loader2 } from "lucide-react";
import { useUpdatePreferences } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

const OBJECTIVES = ["Clients", "Job", "Authority", "Documenting"];
const PERSONAS = ["Operator", "Founder", "Career", "Technical", "Sales"];
const TONES = ["Direct", "Story", "Educational", "Bold"];

const OBJECTIVE_DESC: Record<string, string> = {
  Clients: "Attract better clients and showcase your expertise",
  Job: "Build visibility and credibility in your field",
  Authority: "Become the go-to voice in your industry",
  Documenting: "Share your journey and lessons in real time",
};

const PERSONA_DESC: Record<string, string> = {
  Operator: "You run the day-to-day and make things work",
  Founder: "You're building a company from scratch",
  Career: "You're growing your professional reputation",
  Technical: "You go deep on craft, engineering, or data",
  Sales: "You build relationships and close deals",
};

const TONE_DESC: Record<string, string> = {
  Direct: "Clear, confident, no fluff",
  Story: "Narrative-driven, personal, human",
  Educational: "Structured, instructive, value-first",
  Bold: "Strong opinions, sharp contrasts, memorable",
};

type OnboardingState = {
  objective: string;
  persona: string;
  tone: string;
  brandRole: string;
  brandAudience: string;
  brandBelief: string;
};

export default function Onboarding() {
  const [, navigate] = useLocation();
  const { invalidate } = useAuth();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingState>({
    objective: "Authority",
    persona: "Founder",
    tone: "Direct",
    brandRole: "",
    brandAudience: "",
    brandBelief: "",
  });

  const { mutate: updatePreferences, isPending } = useUpdatePreferences();

  const set = <K extends keyof OnboardingState>(key: K, value: string) =>
    setData((d) => ({ ...d, [key]: value }));

  const handleFinish = () => {
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
              <h2 className="text-2xl font-extrabold text-gray-900 mb-2">What's your main goal?</h2>
              <p className="text-gray-500 text-sm mb-7">This shapes every piece of content we create with you.</p>
              <div className="space-y-3">
                {OBJECTIVES.map((obj) => (
                  <button
                    key={obj}
                    onClick={() => set("objective", obj)}
                    className={cn(
                      "w-full text-left p-5 rounded-2xl border-2 transition-all",
                      data.objective === obj ? "border-primary bg-primary/5" : "border-gray-100 bg-white hover:border-primary/30"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={cn("font-bold mb-0.5", data.objective === obj ? "text-primary" : "text-gray-800")}>{obj}</p>
                        <p className="text-xs text-gray-500">{OBJECTIVE_DESC[obj]}</p>
                      </div>
                      {data.objective === obj && (
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
              <h2 className="text-2xl font-extrabold text-gray-900 mb-2">How do you see yourself?</h2>
              <p className="text-gray-500 text-sm mb-7">Your persona shapes who you're writing for.</p>
              <div className="space-y-3">
                {PERSONAS.map((p) => (
                  <button
                    key={p}
                    onClick={() => set("persona", p)}
                    className={cn(
                      "w-full text-left p-5 rounded-2xl border-2 transition-all",
                      data.persona === p ? "border-primary bg-primary/5" : "border-gray-100 bg-white hover:border-primary/30"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={cn("font-bold mb-0.5", data.persona === p ? "text-primary" : "text-gray-800")}>{p}</p>
                        <p className="text-xs text-gray-500">{PERSONA_DESC[p]}</p>
                      </div>
                      {data.persona === p && (
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
              <h2 className="text-2xl font-extrabold text-gray-900 mb-2">How do you sound?</h2>
              <p className="text-gray-500 text-sm mb-7">Your writing tone sets the feeling of your content.</p>
              <div className="space-y-3">
                {TONES.map((t) => (
                  <button
                    key={t}
                    onClick={() => set("tone", t)}
                    className={cn(
                      "w-full text-left p-5 rounded-2xl border-2 transition-all",
                      data.tone === t ? "border-primary bg-primary/5" : "border-gray-100 bg-white hover:border-primary/30"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={cn("font-bold mb-0.5", data.tone === t ? "text-primary" : "text-gray-800")}>{t}</p>
                        <p className="text-xs text-gray-500">{TONE_DESC[t]}</p>
                      </div>
                      {data.tone === t && (
                        <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center flex-shrink-0 ml-3">
                          <Check className="w-3 h-3 text-white" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <NextButton onClick={() => setStep(4)} />
          </motion.div>
        );

      case 4:
        return (
          <motion.div key="ob4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col h-full">
            <BackButton onClick={() => setStep(3)} />
            <div className="flex-1 pt-4 pb-32 overflow-y-auto no-scrollbar">
              <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Define your voice</h2>
              <p className="text-gray-500 text-sm mb-7">This gives the AI the depth to write content that sounds like you — not anyone else.</p>

              <div className="space-y-5">
                <VoiceField
                  label="Your role in one sentence"
                  placeholder="I help founders build systems that scale without chaos"
                  value={data.brandRole}
                  onChange={(v) => set("brandRole", v)}
                />
                <VoiceField
                  label="Who specifically is your audience?"
                  placeholder="B2B founders with 5–50 person teams looking to systematise ops"
                  value={data.brandAudience}
                  onChange={(v) => set("brandAudience", v)}
                />
                <VoiceField
                  label="Your core belief about your field"
                  placeholder="Clarity beats cleverness. Simple systems beat complex ones."
                  value={data.brandBelief}
                  onChange={(v) => set("brandBelief", v)}
                />
              </div>
            </div>
            <NextButton onClick={() => setStep(5)} label="Continue" />
          </motion.div>
        );

      case 5:
        return (
          <motion.div key="ob5" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col h-full items-center justify-center text-center gap-6">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
              <Check className="w-10 h-10 text-primary" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-gray-900 mb-2">You're set up</h2>
              <p className="text-gray-500 text-sm max-w-[280px] mx-auto">
                Brand OS will use your voice settings to personalise every piece of content it helps you create.
              </p>
            </div>

            <div className="w-full bg-gray-50 rounded-2xl p-4 text-left space-y-2 border border-gray-100">
              <SummaryRow label="Objective" value={data.objective} />
              <SummaryRow label="Persona" value={data.persona} />
              <SummaryRow label="Tone" value={data.tone} />
              {data.brandRole && <SummaryRow label="Role" value={data.brandRole} />}
            </div>

            <div className="w-full space-y-3">
              <Button className="w-full h-14 text-base font-semibold" onClick={handleFinish} disabled={isPending}>
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Start creating"}
              </Button>
              <button onClick={() => setStep(4)} className="text-sm text-gray-400 hover:text-gray-600">
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
    <div className="min-h-screen bg-[#EDEDEE] flex justify-center">
      <div className="w-full max-w-[430px] bg-gray-50 min-h-screen shadow-2xl flex flex-col border-x border-gray-200">
        <header className="px-6 py-5 sticky top-0 bg-gray-50 z-10">
          <div className="flex gap-1.5 w-full items-center mb-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-1 flex-1 rounded-full bg-gray-200 overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  animate={{ width: step > i ? "100%" : "0%" }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 font-medium mt-1">Step {step} of 5</p>
        </header>

        <main className="flex-1 px-6 pb-6 overflow-hidden flex flex-col relative">
          <AnimatePresence mode="wait">{renderStep()}</AnimatePresence>
        </main>
      </div>
    </div>
  );
}

function NextButton({ onClick, label = "Next" }: { onClick: () => void; label?: string }) {
  return (
    <div className="absolute bottom-0 left-0 right-0 px-6 pb-8 pt-4 bg-gradient-to-t from-gray-50 via-gray-50/90 to-transparent z-10">
      <Button className="w-full h-14 text-base font-semibold group" onClick={onClick}>
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

function VoiceField({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">{label}</label>
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
