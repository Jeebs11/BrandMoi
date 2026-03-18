import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowRight, Sparkles, Check, ChevronLeft, Briefcase, 
  Target, Zap, PenTool, Layout, Image as ImageIcon,
  AlertCircle,
  RefreshCw,
  Copy
} from "lucide-react";
import { 
  useStructureIdea, 
  useGenerateContent, 
  useRefineContent, 
  useCreateDraft 
} from "@workspace/api-client-react";
import type { 
  StructuredBreakdown, 
  GeneratedContent, 
  CarouselSlide 
} from "@workspace/api-client-react/src/generated/api.schemas";
import { Button } from "@/components/ui/button";
import { GenerationLoader } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

const OBJECTIVES = ["Clients", "Job", "Authority", "Documenting"];
const PERSONAS = ["Operator", "Founder", "Career", "Technical", "Sales"];
const TONES = ["Direct", "Story", "Educational", "Bold"];

type TabType = "post" | "carousel" | "visual";

type WorkflowState = {
  step: number;
  rawInput: string;
  objective: string;
  persona: string;
  tone: string;
  structure: StructuredBreakdown | null;
  selectedHook: string | null;
  content: GeneratedContent | null;
  activeTab: TabType;
};

const initialState: WorkflowState = {
  step: 1,
  rawInput: "",
  objective: "Authority",
  persona: "Founder",
  tone: "Direct",
  structure: null,
  selectedHook: null,
  content: null,
  activeTab: "post"
};

export default function Home() {
  const [state, setState] = useState<WorkflowState>(initialState);
  const { toast } = useToast();

  const { mutate: structureIdea, isPending: isStructuring, error: structureError } = useStructureIdea();
  const { mutate: generateContent, isPending: isGenerating, error: generateError } = useGenerateContent();
  const { mutate: refineContent, isPending: isRefining } = useRefineContent();
  const { mutate: createDraft, isPending: isSaving } = useCreateDraft();

  const [activeRefineInstruction, setActiveRefineInstruction] = useState<string | null>(null);

  const handleStructure = () => {
    if (!state.rawInput.trim()) return;
    structureIdea(
      { data: { rawInput: state.rawInput, objective: state.objective, persona: state.persona, tone: state.tone } },
      {
        onSuccess: (data) => setState(s => ({ ...s, structure: data, step: 3, selectedHook: null })),
        onError: () => toast({ title: "Failed to structure idea. Please try again.", variant: "destructive" })
      }
    );
  };

  const handleGenerate = () => {
    if (!state.structure || !state.selectedHook) return;
    generateContent(
      {
        data: {
          rawInput: state.rawInput,
          objective: state.objective,
          persona: state.persona,
          tone: state.tone,
          structure: state.structure,
          selectedHook: state.selectedHook
        }
      },
      {
        onSuccess: (data) => setState(s => ({ ...s, content: data, step: 4, activeTab: "post" })),
        onError: () => toast({ title: "Failed to generate content. Please try again.", variant: "destructive" })
      }
    );
  };

  const handleRefine = (instruction: string) => {
    if (!state.content) return;
    setActiveRefineInstruction(instruction);
    
    let contentToRefine = "";
    if (state.activeTab === "post") contentToRefine = state.content.post;
    else if (state.activeTab === "visual") contentToRefine = state.content.visual;
    else if (state.activeTab === "carousel") contentToRefine = JSON.stringify(state.content.carousel);

    refineContent(
      {
        data: {
          content: contentToRefine,
          instruction,
          tab: state.activeTab
        }
      },
      {
        onSuccess: (data) => {
          setState(s => {
            if (!s.content) return s;
            const newContent = { ...s.content };
            
            if (s.activeTab === "post") newContent.post = data.content;
            else if (s.activeTab === "visual") newContent.visual = data.content;
            else if (s.activeTab === "carousel") {
              try {
                // The AI might return pure JSON string or markdown block
                const cleaned = data.content.replace(/```json/g, '').replace(/```/g, '');
                newContent.carousel = JSON.parse(cleaned) as CarouselSlide[];
              } catch (e) {
                toast({ title: "Could not apply refinements to carousel format.", variant: "destructive" });
              }
            }
            return { ...s, content: newContent };
          });
          toast({ title: "Refinement applied!", className: "bg-green-500 text-white border-none" });
        },
        onSettled: () => setActiveRefineInstruction(null)
      }
    );
  };

  const handleSave = () => {
    if (!state.structure) return;
    createDraft(
      {
        data: {
          rawInput: state.rawInput,
          objective: state.objective,
          persona: state.persona,
          tone: state.tone,
          structuredBreakdown: state.structure,
          postOutput: state.content?.post || null,
          carouselOutput: state.content ? JSON.stringify(state.content.carousel) : null,
          visualOutput: state.content?.visual || null,
          status: "draft"
        }
      },
      {
        onSuccess: () => setState(s => ({ ...s, step: 6 })),
        onError: () => toast({ title: "Failed to save draft", variant: "destructive" })
      }
    );
  };

  const updateCarouselSlide = (idx: number, field: 'title' | 'description', value: string) => {
    setState(s => {
      if (!s.content || !s.content.carousel) return s;
      const newCarousel = [...s.content.carousel];
      newCarousel[idx] = { ...newCarousel[idx], [field]: value };
      return { ...s, content: { ...s.content, carousel: newCarousel } };
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard!" });
  };

  const resetFlow = () => setState(initialState);

  const renderStep = () => {
    switch (state.step) {
      case 1:
        return (
          <motion.div key="step1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col h-full">
            <div className="flex-1 mt-4">
              <textarea
                className="w-full h-full text-2xl md:text-3xl font-medium outline-none placeholder:text-gray-300 bg-transparent resize-none leading-relaxed text-foreground"
                placeholder="Drop a thought, a lesson, an observation — messy is fine..."
                value={state.rawInput}
                onChange={(e) => setState(s => ({ ...s, rawInput: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="sticky bottom-0 pb-6 pt-4 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent">
              <Button 
                className="w-full h-16 text-lg group" 
                onClick={() => setState(s => ({ ...s, step: 2 }))}
                disabled={!state.rawInput.trim()}
              >
                Add Context
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </motion.div>
        );

      case 2:
        return (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col h-full">
            <div className="flex-1 space-y-8 overflow-y-auto no-scrollbar pb-32">
              <button 
                onClick={() => setState(s => ({ ...s, step: 1 }))}
                className="text-muted-foreground flex items-center text-sm font-bold hover:text-foreground transition-colors"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Back to capture
              </button>

              <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
                <p className="text-gray-500 text-sm line-clamp-3 italic">"{state.rawInput}"</p>
              </div>

              <div className="space-y-6">
                <SelectionGroup label="Objective" icon={<Target className="w-4 h-4"/>} options={OBJECTIVES} selected={state.objective} onSelect={v => setState(s => ({...s, objective: v}))} />
                <SelectionGroup label="Persona" icon={<Briefcase className="w-4 h-4"/>} options={PERSONAS} selected={state.persona} onSelect={v => setState(s => ({...s, persona: v}))} />
                <SelectionGroup label="Tone" icon={<Zap className="w-4 h-4"/>} options={TONES} selected={state.tone} onSelect={v => setState(s => ({...s, tone: v}))} />
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent z-10">
              <Button className="w-full h-16 text-lg group" onClick={handleStructure}>
                Structure this idea
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </motion.div>
        );

      case 3:
        if (isStructuring) return <GenerationLoader key="load3" text="Structuring your idea..." />;
        if (structureError) return <ErrorState onRetry={handleStructure} message="Failed to structure your idea." />;
        if (!state.structure) return null;

        return (
          <motion.div key="step3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto no-scrollbar pb-32 space-y-6">
              <div className="space-y-4">
                <InfoCard label="Topic" value={state.structure.topic} />
                <InfoCard label="Angle" value={state.structure.angle} />
                <InfoCard label="Core Message" value={state.structure.coreMessage} />
                <InfoCard label="Why This Matters" value={state.structure.whyItMatters} />
              </div>

              <div className="pt-6 border-t border-gray-100">
                <h3 className="font-bold text-lg mb-4 text-foreground flex items-center">
                  <span className="bg-primary/10 text-primary w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm">1</span>
                  Select a Hook
                </h3>
                <div className="space-y-3">
                  {state.structure.hooks.map((hook, idx) => (
                    <button
                      key={idx}
                      onClick={() => setState(s => ({ ...s, selectedHook: hook }))}
                      className={cn(
                        "w-full text-left p-5 rounded-2xl border-2 transition-all duration-300 relative overflow-hidden",
                        state.selectedHook === hook 
                          ? "border-primary bg-primary/5 shadow-md" 
                          : "border-gray-100 hover:border-primary/30 bg-white"
                      )}
                    >
                      {state.selectedHook === hook && (
                        <div className="absolute top-0 right-0 w-12 h-12 bg-primary flex items-start justify-end rounded-bl-3xl p-2 text-white">
                          <Check className="w-5 h-5" />
                        </div>
                      )}
                      <p className={cn("text-[15px] leading-relaxed pr-8", state.selectedHook === hook ? "text-primary font-semibold" : "text-gray-700")}>
                        {hook}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-8 p-6 bg-white border border-gray-100 shadow-sm rounded-3xl">
                <h3 className="font-bold mb-4 text-xs text-gray-400 uppercase tracking-widest flex items-center">
                  <Layout className="w-4 h-4 mr-2" /> Narrative Flow
                </h3>
                <ol className="relative border-l-2 border-gray-100 ml-3 space-y-6">
                  {state.structure.narrativeFlow.map((flow, idx) => (
                    <li key={idx} className="ml-6">
                      <span className="absolute flex items-center justify-center w-6 h-6 bg-gray-100 rounded-full -left-[13px] ring-4 ring-white text-[10px] font-bold text-gray-500">
                        {idx + 1}
                      </span>
                      <p className="text-sm font-medium text-gray-700 leading-tight pt-0.5">{flow}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent z-10">
              <Button 
                className="w-full h-16 text-lg group" 
                onClick={handleGenerate}
                disabled={!state.selectedHook}
              >
                Generate Content
                <Sparkles className="ml-2 w-5 h-5 group-hover:scale-110 transition-transform" />
              </Button>
            </div>
          </motion.div>
        );

      case 4:
      case 5:
        if (isGenerating) return <GenerationLoader key="load4" text="Writing your post..." />;
        if (generateError) return <ErrorState onRetry={handleGenerate} message="Failed to generate content." />;
        if (!state.content) return null;

        return (
          <motion.div key="step4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col h-full">
            <div className="flex p-1.5 bg-gray-200/50 rounded-2xl mb-6 shadow-inner">
              {[
                { id: "post", icon: <PenTool className="w-4 h-4 mr-2" />, label: "Post" },
                { id: "carousel", icon: <Layout className="w-4 h-4 mr-2" />, label: "Carousel" },
                { id: "visual", icon: <ImageIcon className="w-4 h-4 mr-2" />, label: "Visual" }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setState(s => ({ ...s, activeTab: t.id as TabType }))}
                  className={cn(
                    "flex-1 flex items-center justify-center py-3 rounded-xl text-sm font-bold capitalize transition-all duration-300",
                    state.activeTab === t.id 
                      ? "bg-white shadow-md text-primary" 
                      : "text-gray-500 hover:text-gray-800 hover:bg-gray-200/50"
                  )}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar relative mb-6">
              {isRefining && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-3xl border border-gray-100">
                  <RefreshCw className="w-8 h-8 text-primary animate-spin mb-4" />
                  <p className="font-bold text-primary animate-pulse">Refining {state.activeTab}...</p>
                </div>
              )}

              {state.activeTab === "post" && (
                <div className="h-full relative group">
                  <textarea 
                    className="w-full h-full min-h-[400px] p-6 bg-white border border-gray-100 shadow-sm rounded-3xl text-[15px] outline-none resize-none leading-relaxed text-gray-800 focus:ring-2 focus:ring-primary/20 transition-shadow"
                    value={state.content.post}
                    onChange={e => setState(s => s.content ? { ...s, content: { ...s.content, post: e.target.value } } : s)}
                  />
                  <button onClick={() => copyToClipboard(state.content!.post)} className="absolute top-4 right-4 p-3 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-xl transition-colors opacity-0 group-hover:opacity-100">
                    <Copy className="w-5 h-5" />
                  </button>
                </div>
              )}

              {state.activeTab === "visual" && (
                <div className="h-full relative group">
                  <textarea 
                    className="w-full h-full min-h-[400px] p-6 bg-white border border-gray-100 shadow-sm rounded-3xl text-[15px] outline-none resize-none leading-relaxed text-gray-800 focus:ring-2 focus:ring-primary/20 transition-shadow"
                    value={state.content.visual}
                    onChange={e => setState(s => s.content ? { ...s, content: { ...s.content, visual: e.target.value } } : s)}
                  />
                  <button onClick={() => copyToClipboard(state.content!.visual)} className="absolute top-4 right-4 p-3 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-xl transition-colors opacity-0 group-hover:opacity-100">
                    <Copy className="w-5 h-5" />
                  </button>
                </div>
              )}

              {state.activeTab === "carousel" && (
                <div className="space-y-4 pb-10">
                  {state.content.carousel.map((slide, idx) => (
                    <div key={idx} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 relative group">
                      <div className="text-xs font-black text-primary/60 tracking-widest mb-3 uppercase">Slide {slide.slide}</div>
                      <input
                        className="w-full bg-transparent font-bold text-lg mb-2 outline-none placeholder:text-gray-300"
                        value={slide.title}
                        placeholder="Slide Title"
                        onChange={(e) => updateCarouselSlide(idx, 'title', e.target.value)}
                      />
                      <textarea
                        className="w-full bg-transparent text-gray-600 outline-none resize-none leading-relaxed"
                        value={slide.description}
                        placeholder="Slide content..."
                        onChange={(e) => updateCarouselSlide(idx, 'description', e.target.value)}
                        rows={3}
                      />
                    </div>
                  ))}
                  <button 
                    onClick={() => {
                      const text = state.content!.carousel.map(s => `Slide ${s.slide}\n${s.title}\n${s.description}`).join('\n\n');
                      copyToClipboard(text);
                    }} 
                    className="w-full py-4 text-sm font-bold text-gray-500 hover:text-gray-800 bg-white rounded-2xl border border-gray-200"
                  >
                    Copy Carousel Text
                  </button>
                </div>
              )}
            </div>

            {state.step === 4 ? (
              <div className="pt-4 border-t border-gray-100">
                <Button className="w-full h-16 text-lg" onClick={() => setState(s => ({ ...s, step: 5 }))}>
                  Refine further <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            ) : (
              <div className="pt-4 border-t border-gray-100 bg-gray-50">
                <p className="text-xs font-bold text-center text-gray-400 uppercase tracking-widest mb-4">Refine {state.activeTab}</p>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {["Sharper", "More Personal", "More Concise", "Client-Focused"].map(action => (
                    <button
                      key={action}
                      disabled={isRefining}
                      onClick={() => handleRefine(action)}
                      className={cn(
                        "py-3 px-4 rounded-xl text-sm font-bold border transition-all flex justify-center items-center",
                        activeRefineInstruction === action
                          ? "bg-primary text-white border-primary"
                          : "bg-white text-gray-700 border-gray-200 hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50"
                      )}
                    >
                      {action}
                    </button>
                  ))}
                </div>
                <Button className="w-full h-16 text-lg" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save Draft"}
                  {!isSaving && <Check className="ml-2 w-5 h-5" />}
                </Button>
              </div>
            )}
          </motion.div>
        );

      case 6:
        return (
          <motion.div key="step6" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center h-full text-center py-20">
            <div className="w-24 h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-8 shadow-xl shadow-green-100/50">
              <Check className="w-12 h-12" strokeWidth={3} />
            </div>
            <h2 className="text-3xl font-extrabold mb-3 text-gray-900">Draft Saved!</h2>
            <p className="text-gray-500 mb-12 text-lg">Your content is ready for LinkedIn.</p>

            <div className="w-full space-y-4 px-6">
              <Link href="/library">
                <Button className="w-full h-16 text-lg">Go to Library</Button>
              </Link>
              <Button variant="outline" className="w-full h-16 text-lg border-2" onClick={resetFlow}>
                Capture another idea
              </Button>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F4F5] flex justify-center selection:bg-primary/20">
      <div className="w-full max-w-[430px] bg-gray-50 min-h-screen shadow-2xl relative flex flex-col border-x border-gray-200">
        <header className="px-6 py-6 bg-gray-50 z-20">
          <ProgressBar step={state.step} totalSteps={6} />
        </header>

        <main className="flex-1 px-6 overflow-hidden flex flex-col relative">
          <AnimatePresence mode="wait">
            {renderStep()}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

// Subcomponents

function ProgressBar({ step, totalSteps }: { step: number, totalSteps: number }) {
  return (
    <div className="flex gap-2 w-full">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div key={i} className="h-1.5 flex-1 rounded-full bg-gray-200 overflow-hidden">
          <motion.div 
            className="h-full bg-primary"
            initial={{ width: step > i ? "100%" : "0%" }}
            animate={{ width: step > i ? "100%" : "0%" }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>
      ))}
    </div>
  );
}

function SelectionGroup({ label, icon, options, selected, onSelect }: { label: string, icon: React.ReactNode, options: string[], selected: string, onSelect: (val: string) => void }) {
  return (
    <div>
      <h3 className="font-bold text-sm text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
        {icon} {label}
      </h3>
      <div className="flex flex-wrap gap-2">
        {options.map(o => (
          <button
            key={o}
            onClick={() => onSelect(o)}
            className={cn(
              "px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 border-2",
              selected === o 
                ? "bg-primary text-white border-primary shadow-md shadow-primary/20" 
                : "bg-white text-gray-600 border-gray-100 hover:border-gray-300 hover:bg-gray-50"
            )}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string, value: string }) {
  return (
    <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
      <div className="text-[11px] font-black text-primary/60 uppercase tracking-widest mb-1">{label}</div>
      <p className="text-gray-800 font-semibold leading-relaxed">{value}</p>
    </div>
  );
}

function ErrorState({ onRetry, message }: { onRetry: () => void, message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-20 text-center">
      <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-6">
        <AlertCircle className="w-8 h-8" />
      </div>
      <h3 className="text-xl font-bold mb-2">Something went wrong</h3>
      <p className="text-gray-500 mb-8">{message}</p>
      <Button onClick={onRetry} variant="outline" className="border-2">Try Again</Button>
    </div>
  );
}
