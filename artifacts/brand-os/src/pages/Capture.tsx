import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearch, useLocation } from "wouter";
import {
  ArrowRight, Sparkles, Check, ChevronLeft, Briefcase,
  Target, Zap, PenTool, Layout, Image as ImageIcon,
  RefreshCw, Copy, AlertTriangle, X, Lightbulb,
} from "lucide-react";
import {
  useStructureIdea, useGenerateContent, useRefineContent,
  useCreateDraft, useUpdateDraft, useGetDraft, getGetDraftQueryKey,
} from "@workspace/api-client-react";
import type { StructuredBreakdown, GeneratedContent, CarouselSlide } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { GenerationLoader } from "@/components/ui/skeleton";
import { BottomNav } from "@/components/BottomNav";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { angleApi, thoughtsApi, type AngleCheckResult } from "@/lib/api";

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

export default function Capture() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const draftIdParam = params.get("draftId");
  const draftId = draftIdParam ? parseInt(draftIdParam) : null;
  const thoughtParam = params.get("thought") ?? "";
  const thoughtIdParam = params.get("thoughtId");
  const thoughtId = thoughtIdParam ? parseInt(thoughtIdParam) : null;

  const { preferences } = useAuth();
  const { toast } = useToast();

  const initialState: WorkflowState = {
    step: 1,
    rawInput: thoughtParam ? decodeURIComponent(thoughtParam) : "",
    objective: preferences?.objective ?? "Authority",
    persona: preferences?.persona ?? "Founder",
    tone: preferences?.tone ?? "Direct",
    structure: null,
    selectedHook: null,
    content: null,
    activeTab: "post",
  };

  const [state, setState] = useState<WorkflowState>(initialState);
  const [initialized, setInitialized] = useState(false);
  const [angleResult, setAngleResult] = useState<AngleCheckResult | null>(null);
  const [angleChecking, setAngleChecking] = useState(false);
  const [angleDismissed, setAngleDismissed] = useState(false);

  const { data: existingDraft } = useGetDraft(
    draftId!,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { queryKey: getGetDraftQueryKey(draftId!), enabled: !!draftId, staleTime: 0 } as any }
  );

  useEffect(() => {
    if (existingDraft && !initialized) {
      const structure = existingDraft.structuredBreakdown as StructuredBreakdown;
      let content: GeneratedContent | null = null;
      if (existingDraft.postOutput || existingDraft.carouselOutput || existingDraft.visualOutput) {
        content = {
          post: existingDraft.postOutput ?? "",
          carousel: existingDraft.carouselOutput ? JSON.parse(existingDraft.carouselOutput) as CarouselSlide[] : [],
          visual: existingDraft.visualOutput ?? "",
        };
      }
      setState({
        step: content ? 4 : 3,
        rawInput: existingDraft.rawInput,
        objective: existingDraft.objective,
        persona: existingDraft.persona,
        tone: existingDraft.tone,
        structure,
        selectedHook: structure?.hooks?.[0] ?? null,
        content,
        activeTab: "post",
      });
      setInitialized(true);
    }
  }, [existingDraft, initialized]);

  const { mutate: structureIdea, isPending: isStructuring, error: structureError, reset: resetStructure } = useStructureIdea();
  const { mutate: generateContent, isPending: isGenerating, error: generateError, reset: resetGenerate } = useGenerateContent();
  const { mutate: refineContent, isPending: isRefining } = useRefineContent();
  const { mutate: createDraft, isPending: isCreating } = useCreateDraft();
  const { mutate: updateDraft, isPending: isUpdating } = useUpdateDraft();
  const isSaving = isCreating || isUpdating;

  const [refiningTab, setRefiningTab] = useState<string | null>(null);

  const checkAngle = async (topic: string, angle: string) => {
    setAngleChecking(true);
    setAngleDismissed(false);
    try {
      const result = await angleApi.check(topic, angle);
      setAngleResult(result);
    } catch {
      setAngleResult(null);
    } finally {
      setAngleChecking(false);
    }
  };

  const handleStructure = () => {
    if (!state.rawInput.trim()) return;
    resetStructure();
    setAngleResult(null);
    setAngleDismissed(false);
    setState(s => ({ ...s, step: 3, structure: null, selectedHook: null }));
    structureIdea(
      { data: { rawInput: state.rawInput, objective: state.objective, persona: state.persona, tone: state.tone } },
      {
        onSuccess: (data) => {
          setState(s => ({ ...s, structure: data }));
          void checkAngle(data.topic, data.angle);
        }
      }
    );
  };

  const handleGenerate = () => {
    if (!state.structure || !state.selectedHook) return;
    resetGenerate();
    setState(s => ({ ...s, step: 4, content: null }));
    generateContent(
      {
        data: {
          rawInput: state.rawInput, objective: state.objective, persona: state.persona,
          tone: state.tone, structure: state.structure, selectedHook: state.selectedHook,
        },
      },
      { onSuccess: (data) => setState(s => ({ ...s, content: data, activeTab: "post" })) }
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
            const nc = { ...s.content };
            if (s.activeTab === "post") nc.post = data.content;
            else if (s.activeTab === "visual") nc.visual = data.content;
            else if (s.activeTab === "carousel") {
              try {
                const cleaned = data.content.replace(/```json/g, "").replace(/```/g, "");
                nc.carousel = JSON.parse(cleaned) as CarouselSlide[];
              } catch {
                toast({ title: "Could not parse refined carousel.", variant: "destructive" });
              }
            }
            return { ...s, content: nc };
          });
          toast({ title: "Refinement applied." });
        },
        onError: () => toast({ title: "Refinement failed.", variant: "destructive" }),
        onSettled: () => setRefiningTab(null),
      }
    );
  };

  const handleSave = () => {
    if (!state.structure) return;
    const draftData = {
      rawInput: state.rawInput,
      objective: state.objective,
      persona: state.persona,
      tone: state.tone,
      structuredBreakdown: state.structure,
      postOutput: state.content?.post ?? null,
      carouselOutput: state.content ? JSON.stringify(state.content.carousel) : null,
      visualOutput: state.content?.visual ?? null,
      status: "draft" as const,
    };

    const onSuccess = () => {
      setState(s => ({ ...s, step: 6 }));
      if (thoughtId) {
        void thoughtsApi.markDeveloped(thoughtId);
      }
    };

    if (draftId) {
      updateDraft(
        { id: draftId!, data: { postOutput: draftData.postOutput, carouselOutput: draftData.carouselOutput, visualOutput: draftData.visualOutput } },
        {
          onSuccess,
          onError: () => toast({ title: "Failed to update draft.", variant: "destructive" }),
        }
      );
    } else {
      createDraft(
        { data: draftData },
        {
          onSuccess,
          onError: () => toast({ title: "Failed to save draft.", variant: "destructive" }),
        }
      );
    }
  };

  const updateCarouselSlide = (idx: number, field: "title" | "description", value: string) => {
    setState(s => {
      if (!s.content?.carousel) return s;
      const nc = [...s.content.carousel];
      nc[idx] = { ...nc[idx], [field]: value };
      return { ...s, content: { ...s.content, carousel: nc } };
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard." });
  };

  const resetFlow = () => {
    resetStructure();
    resetGenerate();
    setAngleResult(null);
    setAngleDismissed(false);
    setState({ ...initialState, rawInput: "", objective: preferences?.objective ?? "Authority", persona: preferences?.persona ?? "Founder", tone: preferences?.tone ?? "Direct" });
    setInitialized(false);
    navigate("/capture");
  };

  const renderStep = () => {
    switch (state.step) {
      case 1:
        return (
          <motion.div key="s1" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col h-full">
            {thoughtId && (
              <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                <Lightbulb className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                <p className="text-xs text-amber-700 font-medium">From your Vault — develop this thought into content</p>
              </div>
            )}
            <div className="flex-1 mt-4">
              <textarea
                className="w-full h-full text-2xl font-medium outline-none placeholder:text-gray-300 bg-transparent resize-none leading-relaxed text-foreground"
                placeholder="Drop a thought, a lesson, an observation — messy is fine..."
                value={state.rawInput}
                onChange={(e) => setState(s => ({ ...s, rawInput: e.target.value }))}
                autoFocus={!thoughtParam}
              />
            </div>
            <div className="sticky bottom-0 pb-6 pt-4 bg-gradient-to-t from-gray-50 via-gray-50/90 to-transparent">
              <Button className="w-full h-14 text-base font-semibold group" onClick={() => setState(s => ({ ...s, step: 2 }))} disabled={!state.rawInput.trim()}>
                Add context <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </motion.div>
        );

      case 2:
        return (
          <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto no-scrollbar pb-36 space-y-7">
              <BackBtn onClick={() => setState(s => ({ ...s, step: 1 }))} />
              <div className="bg-white p-4 rounded-2xl border border-gray-100">
                <p className="text-gray-500 text-sm line-clamp-3 italic">"{state.rawInput}"</p>
              </div>
              <div className="space-y-6">
                <SelGroup label="Objective" icon={<Target className="w-4 h-4" />} options={OBJECTIVES} selected={state.objective} onSelect={v => setState(s => ({ ...s, objective: v }))} />
                <SelGroup label="Persona" icon={<Briefcase className="w-4 h-4" />} options={PERSONAS} selected={state.persona} onSelect={v => setState(s => ({ ...s, persona: v }))} />
                <SelGroup label="Tone" icon={<Zap className="w-4 h-4" />} options={TONES} selected={state.tone} onSelect={v => setState(s => ({ ...s, tone: v }))} />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 px-6 pb-8 pt-4 bg-gradient-to-t from-gray-50 via-gray-50/90 to-transparent z-10">
              <Button className="w-full h-14 text-base font-semibold group" onClick={handleStructure}>
                Structure this idea <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </motion.div>
        );

      case 3:
        if (isStructuring) return <GenerationLoader key="l3" text="Structuring your idea..." />;
        if (structureError) return <ErrState key="e3" message="Couldn't structure your idea." onRetry={handleStructure} onBack={() => setState(s => ({ ...s, step: 2 }))} />;
        if (!state.structure) return null;
        return (
          <motion.div key="s3" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto no-scrollbar pb-36 space-y-5">
              <BackBtn onClick={() => setState(s => ({ ...s, step: 2 }))} />

              {/* Angle Freshness Guard */}
              {!angleDismissed && !angleChecking && angleResult?.similar && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs font-bold text-amber-800">Angle already in your history ({angleResult.score}% overlap)</p>
                    </div>
                    <button onClick={() => setAngleDismissed(true)} className="text-amber-400 hover:text-amber-600 flex-shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-amber-700 mb-1">Similar to: <span className="font-semibold">"{angleResult.match.topic} — {angleResult.match.angle}"</span></p>
                  {angleResult.freshAngles.length > 0 && (
                    <div className="mt-3">
                      <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-2">Try a fresh angle:</p>
                      <div className="space-y-1.5">
                        {angleResult.freshAngles.map((fa, i) => (
                          <button key={i} onClick={() => {
                            setState(s => s.structure ? { ...s, structure: { ...s.structure!, angle: fa } } : s);
                            setAngleDismissed(true);
                          }}
                            className="w-full text-left px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs text-amber-800 hover:border-amber-400 hover:bg-amber-50 transition-all">
                            {fa}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
              {angleChecking && (
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl">
                  <RefreshCw className="w-3.5 h-3.5 text-gray-400 animate-spin" />
                  <p className="text-xs text-gray-500">Checking angle freshness...</p>
                </div>
              )}

              <div className="space-y-3">
                <InfoCard label="Topic" value={state.structure.topic} />
                <InfoCard label="Angle" value={state.structure.angle} />
                <InfoCard label="Core Message" value={state.structure.coreMessage} />
                <InfoCard label="Why This Matters" value={state.structure.whyItMatters} />
              </div>
              <div className="pt-2">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm text-gray-900">Choose a hook</h3>
                  <span className="text-xs text-primary font-semibold bg-primary/10 px-2 py-1 rounded-full">Required to continue</span>
                </div>
                <div className="space-y-3">
                  {state.structure.hooks.map((hook, idx) => (
                    <button key={idx} onClick={() => setState(s => ({ ...s, selectedHook: hook }))}
                      className={cn("w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 relative", state.selectedHook === hook ? "border-primary bg-primary/5" : "border-gray-100 hover:border-primary/40 bg-white")}
                    >
                      {state.selectedHook === hook && (
                        <div className="absolute top-3 right-3 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" strokeWidth={3} />
                        </div>
                      )}
                      <p className={cn("text-sm leading-relaxed pr-7", state.selectedHook === hook ? "text-primary font-semibold" : "text-gray-700")}>{hook}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-4 bg-white border border-gray-100 rounded-2xl">
                <h3 className="font-bold text-xs text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Layout className="w-3.5 h-3.5" /> Narrative Flow
                </h3>
                <div className="flex flex-wrap gap-2">
                  {state.structure.narrativeFlow.map((s, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-full">{s}</span>
                      {i < state.structure!.narrativeFlow.length - 1 && <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 px-6 pb-8 pt-4 bg-gradient-to-t from-gray-50 via-gray-50/90 to-transparent z-10">
              {!state.selectedHook && <p className="text-center text-xs text-gray-400 font-medium mb-3">← Tap a hook above to continue</p>}
              <Button className="w-full h-14 text-base font-semibold group" onClick={handleGenerate} disabled={!state.selectedHook}>
                Looks good — generate content <Sparkles className="ml-2 w-4 h-4 group-hover:scale-110 transition-transform" />
              </Button>
            </div>
          </motion.div>
        );

      case 4:
      case 5:
        if (isGenerating) return <GenerationLoader key="l4" text="Writing your content..." />;
        if (generateError) return <ErrState key="e4" message="Couldn't generate content." onRetry={handleGenerate} onBack={() => setState(s => ({ ...s, step: 3 }))} />;
        if (!state.content) return null;
        return (
          <motion.div key="s45" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col h-full">
            <div className="flex p-1 bg-gray-100 rounded-xl mb-5 gap-1">
              {([["post", "Post", <PenTool className="w-3.5 h-3.5" />], ["carousel", "Carousel", <Layout className="w-3.5 h-3.5" />], ["visual", "Visual", <ImageIcon className="w-3.5 h-3.5" />]] as const).map(([id, label, icon]) => (
                <button key={id} onClick={() => setState(s => ({ ...s, activeTab: id as TabType }))}
                  className={cn("flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all duration-200",
                    state.activeTab === id ? "bg-white shadow text-primary" : "text-gray-500 hover:text-gray-700")}
                >
                  {icon} {label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar relative mb-5">
              {isRefining && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-2xl">
                  <RefreshCw className="w-6 h-6 text-primary animate-spin mb-2" />
                  <p className="text-sm font-semibold text-primary">Refining...</p>
                </div>
              )}
              {state.activeTab === "post" && (
                <div className="relative group h-full">
                  <textarea className="w-full h-full min-h-[340px] p-5 bg-white border border-gray-100 rounded-2xl text-sm outline-none resize-none leading-relaxed text-gray-800 focus:ring-2 focus:ring-primary/20 transition-shadow"
                    value={state.content.post} onChange={e => setState(s => s.content ? { ...s, content: { ...s.content, post: e.target.value } } : s)} />
                  <button onClick={() => copyToClipboard(state.content!.post)} className="absolute top-3 right-3 p-2 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              )}
              {state.activeTab === "visual" && (
                <div className="relative group h-full">
                  <textarea className="w-full h-full min-h-[340px] p-5 bg-white border border-gray-100 rounded-2xl text-sm outline-none resize-none leading-relaxed text-gray-800 focus:ring-2 focus:ring-primary/20 transition-shadow"
                    value={state.content.visual} onChange={e => setState(s => s.content ? { ...s, content: { ...s.content, visual: e.target.value } } : s)} />
                  <button onClick={() => copyToClipboard(state.content!.visual)} className="absolute top-3 right-3 p-2 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              )}
              {state.activeTab === "carousel" && (
                <div className="space-y-3 pb-6">
                  {state.content.carousel.map((slide, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-2xl border border-gray-100">
                      <div className="text-xs font-black text-primary/50 tracking-widest mb-2 uppercase">Slide {slide.slide}</div>
                      <input className="w-full bg-transparent font-bold text-sm mb-1.5 outline-none placeholder:text-gray-300" value={slide.title} placeholder="Title" onChange={e => updateCarouselSlide(idx, "title", e.target.value)} />
                      <textarea className="w-full bg-transparent text-gray-500 text-sm outline-none resize-none leading-relaxed" value={slide.description} placeholder="Description..." rows={2} onChange={e => updateCarouselSlide(idx, "description", e.target.value)} />
                    </div>
                  ))}
                  <button onClick={() => copyToClipboard(state.content!.carousel.map(s => `SLIDE ${s.slide}\n${s.title}\n${s.description}`).join("\n\n"))}
                    className="w-full py-3 text-xs font-bold text-gray-500 hover:text-gray-700 bg-white rounded-xl border border-gray-200">
                    Copy all slides
                  </button>
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Sharper", instruction: "Tighten language, remove hedging. Keep every idea." },
                  { label: "More Personal", instruction: "Add human detail, reduce abstraction." },
                  { label: "More Concise", instruction: "Cut by ~30%. Keep the core message and hook." },
                  { label: "Client-Focused", instruction: "Reframe toward client value and problems." },
                ].map(action => (
                  <button key={action.label} disabled={isRefining} onClick={() => handleRefine(action.instruction)}
                    className={cn("py-3 px-3 rounded-xl text-xs font-bold border-2 transition-all",
                      refiningTab === action.instruction ? "bg-primary text-white border-primary" : "bg-white text-gray-700 border-gray-200 hover:border-primary/50 hover:bg-primary/5 disabled:opacity-40")}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
              <Button className="w-full h-14 text-base font-semibold" onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving..." : draftId ? "Update draft" : "Save draft"}
                {!isSaving && <Check className="ml-2 w-4 h-4" />}
              </Button>
            </div>
          </motion.div>
        );

      case 6:
        return (
          <motion.div key="s6" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-6">
              <Check className="w-10 h-10" strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl font-extrabold mb-2 text-gray-900">{draftId ? "Draft updated" : "Draft saved"}</h2>
            <p className="text-gray-500 mb-10 text-sm">Your content is ready for LinkedIn.</p>
            <div className="w-full space-y-3 px-4">
              <Button className="w-full h-14 text-base font-semibold" onClick={() => navigate("/library")}>Go to Library</Button>
              <Button variant="outline" className="w-full h-14 text-base font-semibold border-2" onClick={resetFlow}>Capture another idea</Button>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#EDEDEE] flex justify-center">
      <div className="w-full max-w-[430px] bg-gray-50 min-h-screen shadow-2xl relative flex flex-col border-x border-gray-200 pb-20">
        <header className="px-6 py-5 bg-gray-50 z-20 sticky top-0">
          <ProgressBar step={Math.min(state.step, 6)} totalSteps={6} />
          {draftId && state.step >= 4 && state.step < 6 && (
            <p className="text-xs text-primary font-semibold mt-2">Editing existing draft</p>
          )}
          {thoughtId && state.step === 1 && (
            <p className="text-xs text-amber-600 font-semibold mt-2 flex items-center gap-1">
              <Lightbulb className="w-3 h-3" /> From your Vault
            </p>
          )}
        </header>
        <main className="flex-1 px-6 pb-6 overflow-hidden flex flex-col relative">
          <AnimatePresence mode="wait">{renderStep()}</AnimatePresence>
        </main>
        {state.step >= 4 && state.step < 6 && <BottomNav />}
      </div>
    </div>
  );
}

function ProgressBar({ step, totalSteps }: { step: number; totalSteps: number }) {
  return (
    <div className="flex gap-1.5 w-full items-center">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div key={i} className="h-1 flex-1 rounded-full bg-gray-200 overflow-hidden">
          <motion.div className="h-full bg-primary rounded-full" animate={{ width: step > i ? "100%" : "0%" }} transition={{ duration: 0.35 }} />
        </div>
      ))}
    </div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-muted-foreground flex items-center text-sm font-semibold hover:text-foreground transition-colors">
      <ChevronLeft className="w-4 h-4 mr-1" /> Back
    </button>
  );
}

function SelGroup({ label, icon, options, selected, onSelect }: { label: string; icon: React.ReactNode; options: string[]; selected: string; onSelect: (v: string) => void }) {
  return (
    <div>
      <h3 className="font-bold text-xs text-gray-400 uppercase tracking-wider mb-2.5 flex items-center gap-2">{icon} {label}</h3>
      <div className="flex flex-wrap gap-2">
        {options.map(o => (
          <button key={o} onClick={() => onSelect(o)}
            className={cn("px-3.5 py-2 rounded-xl text-xs font-bold transition-all border-2", selected === o ? "bg-primary text-white border-primary" : "bg-white text-gray-600 border-gray-200 hover:border-primary/30")}
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
    <div className="bg-white border border-gray-100 rounded-2xl p-4">
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm font-semibold text-gray-800 leading-relaxed">{value}</p>
    </div>
  );
}

function ErrState({ message, onRetry, onBack }: { message: string; onRetry: () => void; onBack: () => void }) {
  return (
    <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full text-center py-16 gap-5">
      <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
        <AlertTriangle className="w-8 h-8 text-red-400" />
      </div>
      <p className="text-gray-600 font-medium">{message}</p>
      <div className="flex gap-3 w-full px-4">
        <Button variant="outline" className="flex-1 border-2" onClick={onBack}>Go back</Button>
        <Button className="flex-1" onClick={onRetry}>Try again</Button>
      </div>
    </motion.div>
  );
}
