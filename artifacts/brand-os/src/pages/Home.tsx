import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Sparkles, Check, ChevronLeft, Briefcase,
  Target, Zap, PenTool, Layout, Image as ImageIcon,
  RefreshCw, Copy, AlertTriangle, BookOpen, ChevronDown,
} from "lucide-react";
import {
  useStructureIdea,
  useGenerateContent,
  useRefineContent,
  useCreateDraft,
} from "@workspace/api-client-react";
import type {
  HookItem,
  StructuredBreakdown,
  StructureIdeaResponse,
  GeneratedContent,
  CarouselSlide,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { GenerationLoader } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

const OBJECTIVES = ["Clients", "Job", "Authority", "Documenting", "Expert", "Hiring"];
const PERSONAS = ["Operator", "Founder", "Career", "Technical", "Sales"];
const TONES = ["Direct", "Story", "Educational", "Bold"];

type TabType = "post" | "carousel" | "visual";

type WorkflowState = {
  step: number;
  rawInput: string;
  objective: string;
  persona: string;
  tone: string;
  structureResult: StructureIdeaResponse | null;
  selectedLane: "evergreen" | "trending";
  structure: StructuredBreakdown | null;
  selectedHook: string | null;
  content: GeneratedContent | null;
  activeTab: TabType;
  storyMode: boolean;
};

const initialState: WorkflowState = {
  step: 1,
  rawInput: "",
  objective: "Authority",
  persona: "Founder",
  tone: "Direct",
  structureResult: null,
  selectedLane: "evergreen",
  structure: null,
  selectedHook: null,
  content: null,
  activeTab: "post",
  storyMode: false,
};

export default function Home() {
  const [state, setState] = useState<WorkflowState>(initialState);
  const { toast } = useToast();

  const { mutate: structureIdea, isPending: isStructuring, error: structureError, reset: resetStructure } = useStructureIdea();
  const { mutate: generateContent, isPending: isGenerating, error: generateError, reset: resetGenerate } = useGenerateContent();
  const { mutate: refineContent, isPending: isRefining } = useRefineContent();
  const { mutate: createDraft, isPending: isSaving } = useCreateDraft();

  const [refiningTab, setRefiningTab] = useState<string | null>(null);
  const [storyArcOpen, setStoryArcOpen] = useState(false);

  // FIXED: immediately advance to step 3 so the loader shows during the API call
  const handleStructure = () => {
    if (!state.rawInput.trim()) return;
    resetStructure();
    setState(s => ({ ...s, step: 3, structureResult: null, selectedLane: "evergreen", structure: null, selectedHook: null }));
    structureIdea(
      { data: { rawInput: state.rawInput, objective: state.objective, persona: state.persona, tone: state.tone } },
      {
        onSuccess: (data) => {
          setState(s => ({
            ...s,
            structureResult: data,
            selectedLane: "evergreen",
            structure: data.evergreen,
            storyMode: s.storyMode || data.evergreen.archetype === "storytelling" || data.trending?.archetype === "storytelling",
          }));
        },
      }
    );
  };

  const handleLaneSelect = (lane: "evergreen" | "trending") => {
    const newStructure = state.structureResult?.[lane] ?? null;
    if (!newStructure) return;
    setState(s => ({
      ...s,
      selectedLane: lane,
      structure: newStructure,
      selectedHook: null,
      storyMode: s.storyMode || newStructure.archetype === "storytelling",
    }));
  };

  // FIXED: immediately advance to step 4 so the loader shows during the API call
  const handleGenerate = () => {
    if (!state.structure || !state.selectedHook) return;
    resetGenerate();
    setState(s => ({ ...s, step: 4, content: null }));
    generateContent(
      {
        data: {
          rawInput: state.rawInput,
          objective: state.objective,
          persona: state.persona,
          tone: state.tone,
          structure: state.structure,
          selectedHook: state.selectedHook,
          storyMode: state.storyMode,
        },
      },
      {
        onSuccess: (data) => setState(s => ({ ...s, content: data, activeTab: "post" })),
      }
    );
  };

  const handleRefine = (instruction: string) => {
    if (!state.content) return;
    setRefiningTab(instruction);

    let contentToRefine = "";
    if (state.activeTab === "post") contentToRefine = state.content.post;
    else if (state.activeTab === "visual") contentToRefine = state.content.visual;
    else if (state.activeTab === "carousel") contentToRefine = JSON.stringify(state.content.carousel);

    refineContent(
      { data: { content: contentToRefine, instruction, tab: state.activeTab } },
      {
        onSuccess: (data) => {
          setState(s => {
            if (!s.content) return s;
            const newContent = { ...s.content };
            if (s.activeTab === "post") newContent.post = data.content;
            else if (s.activeTab === "visual") newContent.visual = data.content;
            else if (s.activeTab === "carousel") {
              try {
                const cleaned = data.content.replace(/```json/g, "").replace(/```/g, "");
                newContent.carousel = JSON.parse(cleaned) as CarouselSlide[];
              } catch {
                toast({ title: "Could not parse refined carousel.", variant: "destructive" });
              }
            }
            return { ...s, content: newContent };
          });
          toast({ title: "Done — refinement applied." });
        },
        onError: () => toast({ title: "Refinement failed. Try again.", variant: "destructive" }),
        onSettled: () => setRefiningTab(null),
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
          structuredBreakdown: { ...state.structure, storyMode: state.storyMode },
          selectedHook: state.selectedHook ?? null,
          postOutput: state.content?.post ?? null,
          carouselOutput: state.content ? JSON.stringify(state.content.carousel) : null,
          visualOutput: state.content?.visual ?? null,
          status: "draft",
        },
      },
      {
        onSuccess: () => setState(s => ({ ...s, step: 6 })),
        onError: () => toast({ title: "Failed to save. Try again.", variant: "destructive" }),
      }
    );
  };

  const updateCarouselSlide = (idx: number, field: "title" | "description", value: string) => {
    setState(s => {
      if (!s.content?.carousel) return s;
      const newCarousel = [...s.content.carousel];
      newCarousel[idx] = { ...newCarousel[idx], [field]: value };
      return { ...s, content: { ...s.content, carousel: newCarousel } };
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard." });
  };

  const resetFlow = () => {
    resetStructure();
    resetGenerate();
    setState(initialState);
  };

  const renderStep = () => {
    switch (state.step) {
      // ─── STEP 1: CAPTURE ───────────────────────────────────────────────────
      case 1:
        return (
          <motion.div key="step1" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col h-full">
            <div className="flex-1 mt-4">
              <textarea
                className="w-full h-full text-2xl font-medium outline-none placeholder:text-gray-300 bg-transparent resize-none leading-relaxed text-foreground"
                placeholder="Drop a thought, a lesson, an observation — messy is fine..."
                value={state.rawInput}
                onChange={(e) => setState(s => ({ ...s, rawInput: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="sticky bottom-0 pb-6 pt-4 bg-gradient-to-t from-gray-50 via-gray-50/90 to-transparent">
              <Button
                className="w-full h-14 text-base font-semibold group"
                onClick={() => setState(s => ({ ...s, step: 2 }))}
                disabled={!state.rawInput.trim()}
              >
                Add context
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </motion.div>
        );

      // ─── STEP 2: CONTEXT ───────────────────────────────────────────────────
      case 2:
        return (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto no-scrollbar pb-36 space-y-7">
              <button
                onClick={() => setState(s => ({ ...s, step: 1 }))}
                className="text-muted-foreground flex items-center text-sm font-semibold hover:text-foreground transition-colors"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </button>

              <div className="bg-white p-4 rounded-2xl border border-gray-100">
                <p className="text-gray-500 text-sm line-clamp-3 italic">"{state.rawInput}"</p>
              </div>

              <div className="space-y-6">
                <SelectionGroup label="Objective" icon={<Target className="w-4 h-4" />} options={OBJECTIVES} selected={state.objective} onSelect={v => setState(s => ({ ...s, objective: v }))} />
                <SelectionGroup label="Persona" icon={<Briefcase className="w-4 h-4" />} options={PERSONAS} selected={state.persona} onSelect={v => setState(s => ({ ...s, persona: v }))} />
                <SelectionGroup label="Tone" icon={<Zap className="w-4 h-4" />} options={TONES} selected={state.tone} onSelect={v => setState(s => ({ ...s, tone: v }))} />
                <div className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-violet-500" />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">This is a story</p>
                      <p className="text-[11px] text-gray-400 leading-tight">Uses 5-beat narrative arc: Scene → Tension → Turn → Lesson → CTA</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setState(s => ({ ...s, storyMode: !s.storyMode }))}
                    className={cn(
                      "relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0",
                      state.storyMode ? "bg-violet-500" : "bg-gray-200"
                    )}
                    role="switch"
                    aria-checked={state.storyMode}
                  >
                    <span className={cn(
                      "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200",
                      state.storyMode ? "translate-x-5" : "translate-x-0"
                    )} />
                  </button>
                </div>
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 px-6 pb-8 pt-4 bg-gradient-to-t from-gray-50 via-gray-50/90 to-transparent z-10">
              <Button className="w-full h-14 text-base font-semibold group" onClick={handleStructure}>
                Structure this idea
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </motion.div>
        );

      // ─── STEP 3: STRUCTURE ─────────────────────────────────────────────────
      case 3:
        // Show loader while AI is thinking
        if (isStructuring) {
          return <GenerationLoader key="load3" text="Structuring your idea..." />;
        }

        // Show error state if the call failed
        if (structureError) {
          return (
            <ErrorState
              key="err3"
              message="Couldn't structure your idea."
              onRetry={handleStructure}
              onBack={() => setState(s => ({ ...s, step: 2 }))}
            />
          );
        }

        // Should not happen, but guard against null structure
        if (!state.structure) return null;

        return (
          <motion.div key="step3" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto no-scrollbar pb-36 space-y-5">
              <button
                onClick={() => setState(s => ({ ...s, step: 2 }))}
                className="text-muted-foreground flex items-center text-sm font-semibold hover:text-foreground transition-colors"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </button>

              {/* Info cards — reflect selected lane data (default evergreen) */}
              <div className="space-y-3">
                <InfoCard label="Topic" value={state.structure.topic} />
                <InfoCard label="Angle" value={state.structure.angle} />
                <InfoCard label="Core Message" value={state.structure.coreMessage} />
                <InfoCard label="Why This Matters" value={state.structure.whyItMatters} />
              </div>

              {/* Hook selection — two visible sections simultaneously */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm text-gray-900">Choose a hook</h3>
                  <span className="text-xs text-primary font-semibold bg-primary/10 px-2 py-1 rounded-full">Required to continue</span>
                </div>
                {(() => {
                  const HOOK_TYPE_LABELS: Record<string, { label: string; color: string }> = {
                    "how-i":      { label: "How I",          color: "bg-violet-100 text-violet-700" },
                    "contrarian": { label: "Contrarian",     color: "bg-rose-100 text-rose-700" },
                    "number":     { label: "By the Numbers", color: "bg-amber-100 text-amber-700" },
                    "how-to":     { label: "How To",         color: "bg-sky-100 text-sky-700" },
                    "story":      { label: "Story",          color: "bg-emerald-100 text-emerald-700" },
                  };
                  const renderHook = (hook: HookItem, idx: number, lane: "evergreen" | "trending") => {
                    const hookMeta = hook.type ? HOOK_TYPE_LABELS[hook.type] : null;
                    const usageCount = hook.type ? (state.structureResult?.hookUsage?.[hook.type] ?? 0) : 0;
                    const isOverused = usageCount >= 2;
                    const isSelected = state.selectedHook === hook.text;
                    const isTrending = lane === "trending";
                    return (
                      <button key={idx}
                        onClick={() => setState(s => {
                          const newStructure = s.structureResult?.[lane] ?? s.structure;
                          return {
                            ...s,
                            selectedHook: hook.text,
                            selectedLane: lane,
                            structure: newStructure,
                            storyMode: s.storyMode || newStructure?.archetype === "storytelling",
                          };
                        })}
                        className={cn("w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 relative", isSelected ? "border-primary bg-primary/5" : "border-gray-100 hover:border-primary/40 bg-white")}
                      >
                        {isSelected && (
                          <div className="absolute top-3 right-3 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" strokeWidth={3} />
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                          {isTrending && (
                            <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                              Trending
                            </span>
                          )}
                          {hookMeta && (
                            <span className={cn("inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full", hookMeta.color)}>
                              {hookMeta.label}
                            </span>
                          )}
                          {hook.usedBefore && (
                            <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                              Used before
                            </span>
                          )}
                          {isOverused && (
                            <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">
                              Used {usageCount}×
                            </span>
                          )}
                        </div>
                        <p className={cn("text-sm leading-relaxed pr-7", isSelected ? "text-primary font-semibold" : "text-gray-700")}>{hook.text}</p>
                        {hook.sourceLine && (
                          <p className="mt-2 text-[11px] italic text-gray-400 leading-snug">{hook.sourceLine}</p>
                        )}
                      </button>
                    );
                  };
                  return (
                    <div className="space-y-5">
                      {/* Evergreen section */}
                      <div>
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Timeless</p>
                        <div className="space-y-3">
                          {state.structureResult!.evergreen.hooks.map((hook, idx) => renderHook(hook, idx, "evergreen"))}
                        </div>
                      </div>
                      {/* Trending section */}
                      {state.structureResult?.trending && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Based on what's happening now</p>
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          </div>
                          <div className="space-y-3">
                            {state.structureResult.trending.hooks.map((hook, idx) =>
                              renderHook(hook as HookItem, idx, "trending")
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className="p-4 bg-white border border-gray-100 rounded-2xl">
                <h3 className="font-bold text-xs text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Layout className="w-3.5 h-3.5" /> Narrative Flow
                </h3>
                <div className="flex flex-wrap gap-2">
                  {state.structure.narrativeFlow.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-full">{step}</span>
                      {idx < state.structure!.narrativeFlow.length - 1 && (
                        <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 px-6 pb-8 pt-4 bg-gradient-to-t from-gray-50 via-gray-50/90 to-transparent z-10">
              {!state.selectedHook && (
                <p className="text-center text-xs text-gray-400 font-medium mb-3">← Tap a hook above to continue</p>
              )}
              <Button
                className="w-full h-14 text-base font-semibold group"
                onClick={handleGenerate}
                disabled={!state.selectedHook}
              >
                Looks good — generate content
                <Sparkles className="ml-2 w-4 h-4 group-hover:scale-110 transition-transform" />
              </Button>
            </div>
          </motion.div>
        );

      // ─── STEP 4 + 5: CREATE & REFINE ───────────────────────────────────────
      case 4:
      case 5:
        // Show loader while AI is writing
        if (isGenerating) {
          return <GenerationLoader key="load4" text="Writing your content..." />;
        }

        // Show error state if generation failed
        if (generateError) {
          return (
            <ErrorState
              key="err4"
              message="Couldn't generate content."
              onRetry={handleGenerate}
              onBack={() => setState(s => ({ ...s, step: 3 }))}
            />
          );
        }

        if (!state.content) return null;

        return (
          <motion.div key="step45" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col h-full">
            {/* Tab bar */}
            <div className="flex p-1 bg-gray-100 rounded-xl mb-5 gap-1">
              {[
                { id: "post" as TabType, icon: <PenTool className="w-3.5 h-3.5" />, label: "Post" },
                { id: "carousel" as TabType, icon: <Layout className="w-3.5 h-3.5" />, label: "Carousel" },
                { id: "visual" as TabType, icon: <ImageIcon className="w-3.5 h-3.5" />, label: "Visual" },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setState(s => ({ ...s, activeTab: t.id }))}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all duration-200",
                    state.activeTab === t.id
                      ? "bg-white shadow text-primary"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-y-auto no-scrollbar relative mb-5">
              {isRefining && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-2xl">
                  <RefreshCw className="w-6 h-6 text-primary animate-spin mb-2" />
                  <p className="text-sm font-semibold text-primary">Refining...</p>
                </div>
              )}

              {state.activeTab === "post" && (
                <div className="flex flex-col gap-2 h-full">
                  <div className="relative group flex-1">
                    <textarea
                      className="w-full h-full min-h-[280px] p-5 bg-white border border-gray-100 rounded-2xl text-sm outline-none resize-none leading-relaxed text-gray-800 focus:ring-2 focus:ring-primary/20 transition-shadow"
                      value={state.content.post}
                      onChange={e => setState(s => s.content ? { ...s, content: { ...s.content, post: e.target.value } } : s)}
                    />
                    <button
                      onClick={() => copyToClipboard(state.content!.post)}
                      className="absolute top-3 right-3 p-2 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  {state.storyMode && (
                    <div className="bg-violet-50 border border-violet-100 rounded-2xl overflow-hidden">
                      <button
                        onClick={() => setStoryArcOpen(o => !o)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-3.5 h-3.5 text-violet-500" />
                          <span className="text-xs font-bold text-violet-700">Story arc applied</span>
                        </div>
                        <ChevronDown className={cn("w-4 h-4 text-violet-400 transition-transform duration-200", storyArcOpen ? "rotate-180" : "")} />
                      </button>
                      {storyArcOpen && (
                        <div className="px-4 pb-4 space-y-2">
                          {[
                            { beat: "Scene", desc: "Hook — drops the reader into the exact moment" },
                            { beat: "Tension", desc: "The conflict, struggle, or thing that went wrong" },
                            { beat: "Turn", desc: "The insight, realization, or pivot point" },
                            { beat: "Lesson", desc: "The transferable takeaway for the reader" },
                            { beat: "CTA", desc: "One clear call-to-action that fits the story" },
                          ].map(({ beat, desc }, i) => (
                            <div key={beat} className="flex items-start gap-2">
                              <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-600 text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                              <div>
                                <span className="text-xs font-bold text-violet-700">{beat}</span>
                                <span className="text-xs text-violet-500"> — {desc}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {state.activeTab === "visual" && (
                <div className="relative group h-full">
                  <textarea
                    className="w-full h-full min-h-[340px] p-5 bg-white border border-gray-100 rounded-2xl text-sm outline-none resize-none leading-relaxed text-gray-800 focus:ring-2 focus:ring-primary/20 transition-shadow"
                    value={state.content.visual}
                    onChange={e => setState(s => s.content ? { ...s, content: { ...s.content, visual: e.target.value } } : s)}
                  />
                  <button
                    onClick={() => copyToClipboard(state.content!.visual)}
                    className="absolute top-3 right-3 p-2 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              )}

              {state.activeTab === "carousel" && (
                <div className="space-y-3 pb-6">
                  {state.content.carousel.map((slide, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-2xl border border-gray-100">
                      <div className="text-xs font-black text-primary/50 tracking-widest mb-2 uppercase">Slide {slide.slide}</div>
                      <input
                        className="w-full bg-transparent font-bold text-sm mb-1.5 outline-none placeholder:text-gray-300"
                        value={slide.title}
                        placeholder="Title"
                        onChange={e => updateCarouselSlide(idx, "title", e.target.value)}
                      />
                      <textarea
                        className="w-full bg-transparent text-gray-500 text-sm outline-none resize-none leading-relaxed"
                        value={slide.description}
                        placeholder="Description..."
                        rows={2}
                        onChange={e => updateCarouselSlide(idx, "description", e.target.value)}
                      />
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const text = state.content!.carousel.map(s => `SLIDE ${s.slide}\n${s.title}\n${s.description}`).join("\n\n");
                      copyToClipboard(text);
                    }}
                    className="w-full py-3 text-xs font-bold text-gray-500 hover:text-gray-700 bg-white rounded-xl border border-gray-200"
                  >
                    Copy all slides
                  </button>
                </div>
              )}
            </div>

            {/* Refine buttons or advance to save */}
            {state.step === 4 ? (
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Sharper", instruction: "Tighten language, remove hedging. Keep every idea." },
                    { label: "More Personal", instruction: "Add human detail, reduce abstraction." },
                    { label: "More Concise", instruction: "Cut by ~30%. Keep the core message and hook." },
                    { label: "Client-Focused", instruction: "Reframe toward client value and problems." },
                  ].map(action => (
                    <button
                      key={action.label}
                      disabled={isRefining}
                      onClick={() => handleRefine(action.instruction)}
                      className={cn(
                        "py-3 px-3 rounded-xl text-xs font-bold border-2 transition-all",
                        refiningTab === action.instruction
                          ? "bg-primary text-white border-primary"
                          : "bg-white text-gray-700 border-gray-200 hover:border-primary/50 hover:bg-primary/5 disabled:opacity-40"
                      )}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
                <Button className="w-full h-14 text-base font-semibold" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save draft"}
                  {!isSaving && <Check className="ml-2 w-4 h-4" />}
                </Button>
              </div>
            ) : (
              <div className="border-t border-gray-100 pt-4">
                <Button className="w-full h-14 text-base font-semibold" onClick={() => setState(s => ({ ...s, step: 4 }))}>
                  Refine content
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            )}
          </motion.div>
        );

      // ─── STEP 6: SAVED ─────────────────────────────────────────────────────
      case 6:
        return (
          <motion.div key="step6" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-6 shadow-lg">
              <Check className="w-10 h-10" strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl font-extrabold mb-2 text-gray-900">Draft saved</h2>
            <p className="text-gray-500 mb-10 text-sm">Your content is ready for LinkedIn.</p>
            <div className="w-full space-y-3 px-4">
              <Link href="/library">
                <Button className="w-full h-14 text-base font-semibold">Go to Library</Button>
              </Link>
              <Button variant="outline" className="w-full h-14 text-base font-semibold border-2" onClick={resetFlow}>
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
    <div className="min-h-screen bg-[#EDEDEE] flex justify-center">
      <div className="w-full max-w-[430px] bg-gray-50 min-h-screen shadow-2xl relative flex flex-col border-x border-gray-200">
        <header className="px-6 py-5 bg-gray-50 z-20 sticky top-0">
          <ProgressBar step={state.step} totalSteps={6} />
        </header>
        <main className="flex-1 px-6 pb-6 overflow-hidden flex flex-col relative">
          <AnimatePresence mode="wait">
            {renderStep()}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

function ProgressBar({ step, totalSteps }: { step: number; totalSteps: number }) {
  return (
    <div className="flex gap-1.5 w-full items-center">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div key={i} className="h-1 flex-1 rounded-full bg-gray-200 overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            animate={{ width: step > i ? "100%" : "0%" }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          />
        </div>
      ))}
    </div>
  );
}

function SelectionGroup({
  label, icon, options, selected, onSelect,
}: {
  label: string; icon: React.ReactNode; options: string[]; selected: string; onSelect: (val: string) => void;
}) {
  return (
    <div>
      <h3 className="font-bold text-xs text-gray-400 uppercase tracking-wider mb-2.5 flex items-center gap-2">
        {icon} {label}
      </h3>
      <div className="flex flex-wrap gap-2">
        {options.map(o => (
          <button
            key={o}
            onClick={() => onSelect(o)}
            className={cn(
              "px-3.5 py-2 rounded-xl text-sm font-semibold transition-all border-2",
              selected === o
                ? "bg-primary text-white border-primary shadow-sm"
                : "bg-white text-gray-600 border-gray-200 hover:border-primary/40"
            )}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-gray-100">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm text-gray-800 leading-relaxed">{value}</p>
    </div>
  );
}

function ErrorState({ message, onRetry, onBack }: { message: string; onRetry: () => void; onBack: () => void }) {
  return (
    <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full text-center py-16 gap-5">
      <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
        <AlertTriangle className="w-8 h-8 text-red-400" />
      </div>
      <div>
        <p className="font-bold text-gray-900 mb-1">{message}</p>
        <p className="text-sm text-gray-500">Check your connection and try again.</p>
      </div>
      <div className="flex gap-3 w-full px-4">
        <Button variant="outline" className="flex-1 border-2" onClick={onBack}>Go back</Button>
        <Button className="flex-1" onClick={onRetry}>Try again</Button>
      </div>
    </motion.div>
  );
}
