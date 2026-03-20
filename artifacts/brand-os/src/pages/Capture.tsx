import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearch, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight, Sparkles, Check, ChevronLeft, Briefcase,
  Target, Zap, PenTool, Layout, Image as ImageIcon,
  RefreshCw, Copy, AlertTriangle, X, Lightbulb, Download,
} from "lucide-react";
import {
  useStructureIdea, useGenerateContent, useRefineContent,
  useCreateDraft, useUpdateDraft, useGetDraft, getGetDraftQueryKey,
} from "@workspace/api-client-react";
import type { StructuredBreakdown, GeneratedContent, CarouselSlide, Draft } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { GenerationLoader } from "@/components/ui/skeleton";
import { BottomNav } from "@/components/BottomNav";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { angleApi, thoughtsApi, imageGenApi, imagePromptApi, preferencesApi, agentApi, type AngleCheckResult, type AgentCoach } from "@/lib/api";
import { downloadCarouselPDF, previewCarouselSlide } from "@/lib/export-carousel";
import { downloadVisualCard, previewVisualCard } from "@/lib/export-visual-card";
import { downloadAnimatedCard, type CardAnimPreset, CARD_BASE_DURATIONS } from "@/lib/export-animated-card";
import { downloadAnimatedCarousel, type CarouselAnimPreset, CAROUSEL_PRESET_DURATIONS } from "@/lib/export-animated-carousel";

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
  const rawParam = params.get("raw") ?? "";

  const { preferences } = useAuth();
  const { toast } = useToast();

  const initialState: WorkflowState = {
    step: 1,
    rawInput: thoughtParam ? decodeURIComponent(thoughtParam) : rawParam ? decodeURIComponent(rawParam) : "",
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
      setUserEditedPost(false);
    }
  }, [existingDraft, initialized]);

  const { mutate: structureIdea, isPending: isStructuring, error: structureError, reset: resetStructure } = useStructureIdea();
  const { mutate: generateContent, isPending: isGenerating, error: generateError, reset: resetGenerate } = useGenerateContent();
  const { mutate: refineContent, isPending: isRefining } = useRefineContent();
  const queryClient = useQueryClient();
  const { mutate: createDraft, isPending: isCreating } = useCreateDraft();
  const { mutate: updateDraft, isPending: isUpdating } = useUpdateDraft();
  const isSaving = isCreating || isUpdating;

  const [refiningTab, setRefiningTab] = useState<string | null>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingCard, setIsExportingCard] = useState(false);
  const [isAnimatingCard, setIsAnimatingCard] = useState<CardAnimPreset | null>(null);
  const [isAnimatingCarousel, setIsAnimatingCarousel] = useState<CarouselAnimPreset | null>(null);
  const [animSpeedMult, setAnimSpeedMult] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [includeCta, setIncludeCta] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImageBase64, setGeneratedImageBase64] = useState<string | null>(null);

  // Brand palette
  const [bgColor, setBgColor] = useState("#0f172a");
  const [accentColor, setAccentColor] = useState("#6366f1");
  const [textColor, setTextColor] = useState("#ffffff");
  const bgColorRef = useRef(bgColor);
  const accentColorRef = useRef(accentColor);
  const textColorRef = useRef(textColor);
  bgColorRef.current = bgColor;
  accentColorRef.current = accentColor;
  textColorRef.current = textColor;
  const paletteInitializedRef = useRef(false);
  const paletteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Slide preview
  const [slidePreviewUrl, setSlidePreviewUrl] = useState<string | null>(null);
  const [isPreviewingSlide, setIsPreviewingSlide] = useState(false);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Visual card preview
  const [cardPreviewUrl, setCardPreviewUrl] = useState<string | null>(null);
  const [isPreviewingCard, setIsPreviewingCard] = useState(false);
  const cardPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Image prompt (two-step)
  const [imagePrompt, setImagePrompt] = useState("");
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);

  // Pre-save coach
  const [coachModal, setCoachModal] = useState<{ note: string; type: AgentCoach["type"]; rewrite: string } | null>(null);
  const [isCoaching, setIsCoaching] = useState(false);
  const pendingSaveRef = useRef<((postOverride?: string) => void) | null>(null);
  // Track whether the user has hand-edited the post text after AI generation.
  // The coach only fires when this is true — pure AI output skips it.
  const [userEditedPost, setUserEditedPost] = useState(false);

  // Initialize palette from saved preferences (once)
  useEffect(() => {
    if (preferences && !paletteInitializedRef.current) {
      const p = preferences as Record<string, unknown>;
      if (typeof p.brandBgColor === "string") setBgColor(p.brandBgColor);
      if (typeof p.brandAccentColor === "string") setAccentColor(p.brandAccentColor);
      if (typeof p.brandTextColor === "string") setTextColor(p.brandTextColor);
      paletteInitializedRef.current = true;
    }
  }, [preferences]);

  // Auto-generate slide preview when carousel tab is active or colors change
  const firstSlideTitle = state.content?.carousel?.[0]?.title;
  const carouselLength = state.content?.carousel?.length ?? 0;
  useEffect(() => {
    if (state.activeTab !== "carousel" || carouselLength === 0) {
      setSlidePreviewUrl(null);
      return;
    }
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    setIsPreviewingSlide(true);
    previewTimerRef.current = setTimeout(() => {
      void (async () => {
        try {
          const url = await previewCarouselSlide(
            state.content!.carousel[0],
            carouselLength,
            bgColorRef.current,
            accentColorRef.current,
            textColorRef.current
          );
          setSlidePreviewUrl(url);
        } catch {
          setSlidePreviewUrl(null);
        } finally {
          setIsPreviewingSlide(false);
        }
      })();
    }, 400);
    return () => { if (previewTimerRef.current) clearTimeout(previewTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeTab, carouselLength, firstSlideTitle, bgColor, accentColor, textColor]);

  // Auto-generate visual card preview when visual tab is active or text/colors change
  const visualText = state.content?.visual ?? "";
  useEffect(() => {
    if (state.activeTab !== "visual" || !visualText) {
      setCardPreviewUrl(null);
      return;
    }
    if (cardPreviewTimerRef.current) clearTimeout(cardPreviewTimerRef.current);
    setIsPreviewingCard(true);
    cardPreviewTimerRef.current = setTimeout(() => {
      void (async () => {
        try {
          const url = await previewVisualCard(visualText, bgColorRef.current, accentColorRef.current, textColorRef.current);
          setCardPreviewUrl(url);
        } catch {
          setCardPreviewUrl(null);
        } finally {
          setIsPreviewingCard(false);
        }
      })();
    }, 400);
    return () => { if (cardPreviewTimerRef.current) clearTimeout(cardPreviewTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeTab, visualText, bgColor, accentColor, textColor]);

  const schedulePaletteSave = () => {
    if (paletteTimerRef.current) clearTimeout(paletteTimerRef.current);
    paletteTimerRef.current = setTimeout(() => {
      void preferencesApi.updatePalette(bgColorRef.current, accentColorRef.current, textColorRef.current);
    }, 800);
  };

  const handleBgColorChange = (value: string) => {
    setBgColor(value);
    bgColorRef.current = value;
    schedulePaletteSave();
  };

  const handleAccentColorChange = (value: string) => {
    setAccentColor(value);
    accentColorRef.current = value;
    schedulePaletteSave();
  };

  const handleTextColorChange = (value: string) => {
    setTextColor(value);
    textColorRef.current = value;
    schedulePaletteSave();
  };

  const handleDownloadCarouselPDF = async () => {
    if (!state.content?.carousel?.length) return;
    setIsExportingPDF(true);
    try {
      await downloadCarouselPDF(
        state.content.carousel,
        state.structure?.topic ?? "carousel",
        bgColor,
        accentColor,
        textColor
      );
    } catch {
      toast({ title: "PDF export failed. Please try again.", variant: "destructive" });
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleDownloadVisualCard = async () => {
    if (!state.content?.visual) return;
    setIsExportingCard(true);
    try {
      await downloadVisualCard(state.content.visual, state.structure?.topic ?? "visual", bgColor, accentColor, textColor);
    } catch {
      toast({ title: "Card export failed. Please try again.", variant: "destructive" });
    } finally {
      setIsExportingCard(false);
    }
  };

  const handleDownloadAnimatedCard = async (preset: CardAnimPreset) => {
    if (!state.content?.visual) return;
    setIsAnimatingCard(preset);
    try {
      await downloadAnimatedCard(
        state.content.visual,
        state.structure?.topic ?? "visual",
        bgColor,
        accentColor,
        preset,
        textColor,
        Math.round(CARD_BASE_DURATIONS[preset] * animSpeedMult)
      );
    } catch {
      toast({ title: "Animated export failed. Please try again.", variant: "destructive" });
    } finally {
      setIsAnimatingCard(null);
    }
  };

  const handleDownloadAnimatedCarousel = async (preset: CarouselAnimPreset) => {
    if (!state.content?.carousel?.length) return;
    setIsAnimatingCarousel(preset);
    try {
      const { holdMs, transMs } = CAROUSEL_PRESET_DURATIONS[preset];
      await downloadAnimatedCarousel(
        state.content.carousel,
        state.structure?.topic ?? "carousel",
        bgColor,
        accentColor,
        textColor,
        preset,
        Math.round(holdMs * animSpeedMult),
        Math.round(transMs * animSpeedMult)
      );
    } catch {
      toast({ title: "Animated export failed. Please try again.", variant: "destructive" });
    } finally {
      setIsAnimatingCarousel(null);
    }
  };

  const handleGenerateImagePrompt = async () => {
    if (!state.content?.visual) return;
    setIsGeneratingPrompt(true);
    try {
      const result = await imagePromptApi.generate(state.content.visual);
      setImagePrompt(result.imagePrompt);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate prompt.";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) return;
    setIsGeneratingImage(true);
    setGeneratedImageBase64(null);
    try {
      const result = await imageGenApi.generate(imagePrompt);
      setGeneratedImageBase64(result.imageBase64);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Image generation failed.";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleDownloadGeneratedImage = () => {
    if (!generatedImageBase64) return;
    const a = document.createElement("a");
    const safeName = (state.structure?.topic ?? "visual").replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40);
    a.download = `${safeName}-generated.png`;
    a.href = `data:image/png;base64,${generatedImageBase64}`;
    a.click();
  };

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
          includeCta,
        },
      },
      {
        onSuccess: (data) => {
          setState(s => ({ ...s, content: data, activeTab: "post" }));
          setImagePrompt("");
          setGeneratedImageBase64(null);
          setUserEditedPost(false);
        },
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

    // When refining carousel or visual, always inject the current post as context
    // so the AI can naturally align the content with any edits/rewrites made to the post.
    let fullInstruction = instruction;
    if (state.activeTab !== "post" && state.content.post?.trim()) {
      fullInstruction = `${instruction}\n\nFor context, the current post reads:\n${state.content.post}`;
    }

    refineContent(
      { data: { content: contentToRefine, instruction: fullInstruction, tab: state.activeTab } },
      {
        onSuccess: (data) => {
          setState(s => {
            if (!s.content) return s;
            const nc = { ...s.content };
            if (s.activeTab === "post") {
              nc.post = data.content;
              setUserEditedPost(false);
            }
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

  const executeSave = (postOverride?: string) => {
    if (!state.structure) return;
    const draftData = {
      rawInput: state.rawInput,
      objective: state.objective,
      persona: state.persona,
      tone: state.tone,
      structuredBreakdown: state.structure,
      postOutput: postOverride ?? state.content?.post ?? null,
      carouselOutput: state.content ? JSON.stringify(state.content.carousel) : null,
      visualOutput: state.content?.visual ?? null,
      status: "draft" as const,
    };

    const afterSave = () => {
      setState(s => ({ ...s, step: 6 }));
      if (thoughtId) {
        void thoughtsApi.markDeveloped(thoughtId);
      }
    };

    if (draftId) {
      updateDraft(
        { id: draftId!, data: { postOutput: draftData.postOutput, carouselOutput: draftData.carouselOutput, visualOutput: draftData.visualOutput } },
        {
          onSuccess: (saved: Draft) => {
            // Populate the cache so Library → "Edit and continue" always sees the latest content
            queryClient.setQueryData(getGetDraftQueryKey(draftId!), saved);
            afterSave();
          },
          onError: () => toast({ title: "Failed to update draft.", variant: "destructive" }),
        }
      );
    } else {
      createDraft(
        { data: draftData },
        {
          onSuccess: (saved: Draft) => {
            // Pre-populate the new draft's cache entry so the first load is instant and correct
            queryClient.setQueryData(getGetDraftQueryKey(saved.id), saved);
            afterSave();
          },
          onError: () => toast({ title: "Failed to save draft.", variant: "destructive" }),
        }
      );
    }
  };

  const handleSave = () => {
    const postText = state.content?.post;
    // Only run the writing coach when the user has hand-edited the post.
    // Pure AI-generated output skips it and saves directly.
    if (postText && postText.length >= 20 && userEditedPost) {
      setIsCoaching(true);
      pendingSaveRef.current = executeSave;
      agentApi.coach(postText).then((result) => {
        setCoachModal({ note: result.note, type: result.type, rewrite: (result as { note: string; type: AgentCoach["type"]; rewrite: string }).rewrite ?? "" });
      }).catch(() => {
        executeSave();
      }).finally(() => {
        setIsCoaching(false);
      });
    } else {
      executeSave();
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

  const addCarouselSlide = () => {
    setState(s => {
      if (!s.content?.carousel) return s;
      const nc = [...s.content.carousel, { slide: s.content.carousel.length + 1, title: "", description: "" }];
      return { ...s, content: { ...s.content, carousel: nc } };
    });
  };

  const deleteCarouselSlide = (idx: number) => {
    setState(s => {
      if (!s.content?.carousel || s.content.carousel.length <= 1) return s;
      const nc = s.content.carousel.filter((_, i) => i !== idx).map((sl, i) => ({ ...sl, slide: i + 1 }));
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
              <label className="flex items-center gap-2.5 mb-3 cursor-pointer group">
                <div className={cn(
                  "w-5 h-5 rounded flex items-center justify-center border-2 flex-shrink-0 transition-all duration-150",
                  includeCta ? "bg-primary border-primary" : "border-gray-300 bg-white group-hover:border-primary/50"
                )}>
                  {includeCta && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </div>
                <input type="checkbox" className="sr-only" checked={includeCta} onChange={e => setIncludeCta(e.target.checked)} />
                <span className="text-sm font-medium text-gray-700 select-none">Include a CTA</span>
              </label>
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
                    value={state.content.post} onChange={e => { setState(s => s.content ? { ...s, content: { ...s.content, post: e.target.value } } : s); setUserEditedPost(true); }} />
                  <button onClick={() => copyToClipboard(state.content!.post)} className="absolute top-3 right-3 p-2 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              )}
              {state.activeTab === "visual" && (
                <div className="space-y-3 pb-4">
                  {/* 1. Visual Card editable text */}
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Visual Card</p>
                    <div className="relative group">
                      <textarea
                        className="w-full min-h-[100px] p-5 bg-white border border-gray-100 rounded-2xl text-sm outline-none resize-none leading-relaxed text-gray-800 focus:ring-2 focus:ring-primary/20 transition-shadow"
                        value={state.content.visual}
                        onChange={e => setState(s => s.content ? { ...s, content: { ...s.content, visual: e.target.value } } : s)}
                      />
                      <button onClick={() => copyToClipboard(state.content!.visual)} className="absolute top-3 right-3 p-2 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* 2. Card Palette above preview */}
                  <div className="bg-white rounded-2xl border border-gray-100 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Card Palette</p>
                      <p className="text-[10px] text-gray-300">Auto-saved</p>
                    </div>
                    <div className="flex gap-3">
                      <label className="flex items-center gap-2 flex-1 cursor-pointer">
                        <div className="relative w-8 h-8 rounded-lg overflow-hidden border-2 border-gray-200 flex-shrink-0">
                          <div className="absolute inset-0" style={{ background: bgColor }} />
                          <input type="color" value={bgColor} onChange={e => handleBgColorChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                        </div>
                        <span className="text-xs text-gray-500 font-medium">Background</span>
                      </label>
                      <label className="flex items-center gap-2 flex-1 cursor-pointer">
                        <div className="relative w-8 h-8 rounded-lg overflow-hidden border-2 border-gray-200 flex-shrink-0">
                          <div className="absolute inset-0" style={{ background: accentColor }} />
                          <input type="color" value={accentColor} onChange={e => handleAccentColorChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                        </div>
                        <span className="text-xs text-gray-500 font-medium">Accent</span>
                      </label>
                      <label className="flex items-center gap-2 flex-1 cursor-pointer">
                        <div className="relative w-8 h-8 rounded-lg overflow-hidden border-2 border-gray-200 flex-shrink-0">
                          <div className="absolute inset-0" style={{ background: textColor }} />
                          <input type="color" value={textColor} onChange={e => handleTextColorChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                        </div>
                        <span className="text-xs text-gray-500 font-medium">Text</span>
                      </label>
                    </div>
                  </div>

                  {/* 3. Card Preview */}
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider px-4 pt-4 pb-3">Preview</p>
                    {isPreviewingCard && (
                      <div className="w-full aspect-square bg-gray-50 flex items-center justify-center pb-4">
                        <RefreshCw className="w-5 h-5 text-gray-300 animate-spin" />
                      </div>
                    )}
                    {cardPreviewUrl && !isPreviewingCard && (
                      <div>
                        <div className="relative">
                          <img src={cardPreviewUrl} alt="Card preview" className="w-full aspect-square object-cover" />
                          <button
                            onClick={handleDownloadVisualCard}
                            disabled={isExportingCard}
                            className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-2 bg-black/60 hover:bg-black/80 text-white text-xs font-bold rounded-xl backdrop-blur-sm transition-all disabled:opacity-50"
                          >
                            <Download className="w-3.5 h-3.5" />
                            {isExportingCard ? "Exporting…" : "Download PNG"}
                          </button>
                        </div>
                        <div className="px-4 pt-3 pb-1">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Download animated</p>
                            <div className="flex gap-1">
                              {([1, 2, 3, 4, 5] as const).map((mult) => (
                                <button
                                  key={mult}
                                  onClick={() => setAnimSpeedMult(mult)}
                                  className={cn(
                                    "px-2 py-0.5 rounded text-[10px] font-bold transition-all",
                                    animSpeedMult === mult
                                      ? "bg-primary text-white"
                                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                  )}
                                >
                                  {mult}×
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {(["typewriter", "fade", "slide"] as CardAnimPreset[]).map((preset) => (
                              <button
                                key={preset}
                                onClick={() => handleDownloadAnimatedCard(preset)}
                                disabled={!!isAnimatingCard}
                                className="py-2 text-[11px] font-bold text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 rounded-xl border border-primary/20 flex items-center justify-center gap-1 disabled:opacity-50 transition-all capitalize"
                              >
                                {isAnimatingCard === preset ? (
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Download className="w-3 h-3" />
                                )}
                                {isAnimatingCard === preset ? "…" : preset === "typewriter" ? "Type" : preset === "fade" ? "Fade" : "Slide"}
                              </button>
                            ))}
                          </div>
                          <p className="text-[10px] text-gray-400 mt-1.5">Saves as .webm · upload directly to LinkedIn</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 4. Feedback loops */}
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

                  {/* Sync to post */}
                  {state.content?.post && (
                    <button
                      disabled={isRefining}
                      onClick={() => handleRefine("Rewrite this visual card text so it captures the core message, tone, and theme of the updated post. Keep it punchy and visual-friendly.")}
                      className={cn("w-full py-3 px-3 rounded-xl text-xs font-bold border-2 transition-all flex items-center justify-center gap-2",
                        refiningTab?.startsWith("Rewrite this visual") ? "bg-primary text-white border-primary" : "bg-primary/5 text-primary border-primary/20 hover:bg-primary/10 disabled:opacity-40")}
                    >
                      <RefreshCw className={cn("w-3.5 h-3.5", refiningTab?.startsWith("Rewrite this visual") && "animate-spin")} />
                      {refiningTab?.startsWith("Rewrite this visual") ? "Syncing…" : "Sync to current post"}
                    </button>
                  )}

                  {/* 5. Generate image prompt */}
                  <button
                    onClick={handleGenerateImagePrompt}
                    disabled={isGeneratingPrompt || !state.content?.visual}
                    className="w-full py-3 text-xs font-bold text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 rounded-xl border border-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {isGeneratingPrompt ? "Crafting prompt…" : "Generate image prompt"}
                  </button>

                  {/* 6. Image prompt box */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Image Prompt</p>
                      <p className="text-[10px] text-gray-300 normal-case font-normal">Edit before generating</p>
                    </div>
                    <textarea
                      value={imagePrompt}
                      onChange={e => setImagePrompt(e.target.value)}
                      placeholder="Generate a prompt above, or write your own…"
                      rows={3}
                      className="w-full px-4 py-3 bg-white border-2 border-dashed border-gray-200 focus:border-primary rounded-2xl text-sm outline-none resize-none leading-relaxed text-gray-800 transition-colors placeholder:text-gray-300"
                    />
                  </div>

                  {/* 7. Generate Image button */}
                  <button
                    onClick={handleGenerateImage}
                    disabled={isGeneratingImage || !imagePrompt.trim()}
                    className="w-full py-3 text-xs font-bold text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 rounded-xl border border-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {isGeneratingImage ? "Generating image…" : "Generate image"}
                  </button>

                  {/* 8. AI-generated image preview */}
                  {isGeneratingImage && (
                    <div className="w-full aspect-square rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 flex flex-col items-center justify-center gap-3">
                      <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                      <p className="text-xs font-semibold text-primary/70">Creating your image with AI…</p>
                    </div>
                  )}
                  {generatedImageBase64 && !isGeneratingImage && (
                    <div className="relative rounded-2xl overflow-hidden border border-gray-100">
                      <img src={`data:image/png;base64,${generatedImageBase64}`} alt="AI-generated visual" className="w-full aspect-square object-cover" />
                      <button onClick={handleDownloadGeneratedImage} className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-2 bg-black/60 hover:bg-black/80 text-white text-xs font-bold rounded-xl backdrop-blur-sm transition-all">
                        <Download className="w-3.5 h-3.5" /> Download PNG
                      </button>
                    </div>
                  )}
                </div>
              )}
              {state.activeTab === "carousel" && (
                <div className="space-y-3 pb-6">
                  {state.content.carousel.map((slide, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-2xl border border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-black text-primary/50 tracking-widest uppercase">Slide {slide.slide}</div>
                        {state.content!.carousel.length > 1 && (
                          <button
                            onClick={() => deleteCarouselSlide(idx)}
                            className="w-5 h-5 flex items-center justify-center rounded-full text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all"
                            title="Delete slide"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <input className="w-full bg-transparent font-bold text-sm mb-1.5 outline-none placeholder:text-gray-300" value={slide.title} placeholder="Title" onChange={e => updateCarouselSlide(idx, "title", e.target.value)} />
                      <textarea className="w-full bg-transparent text-gray-500 text-sm outline-none resize-none leading-relaxed" value={slide.description} placeholder="Description..." rows={2} onChange={e => updateCarouselSlide(idx, "description", e.target.value)} />
                    </div>
                  ))}

                  <button
                    onClick={addCarouselSlide}
                    className="w-full py-2.5 rounded-2xl border border-dashed border-primary/30 text-primary/60 text-xs font-bold hover:border-primary/60 hover:text-primary hover:bg-primary/5 transition-all"
                  >
                    + Add slide
                  </button>

                  {/* Brand Palette */}
                  <div className="bg-white rounded-2xl border border-gray-100 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Brand Palette</p>
                      <p className="text-[10px] text-gray-300">Auto-saved</p>
                    </div>
                    <div className="flex gap-3">
                      <label className="flex items-center gap-2 flex-1 cursor-pointer">
                        <div className="relative w-8 h-8 rounded-lg overflow-hidden border-2 border-gray-200 flex-shrink-0">
                          <div className="absolute inset-0" style={{ background: bgColor }} />
                          <input
                            type="color"
                            value={bgColor}
                            onChange={e => handleBgColorChange(e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                        </div>
                        <span className="text-xs text-gray-500 font-medium">Background</span>
                      </label>
                      <label className="flex items-center gap-2 flex-1 cursor-pointer">
                        <div className="relative w-8 h-8 rounded-lg overflow-hidden border-2 border-gray-200 flex-shrink-0">
                          <div className="absolute inset-0" style={{ background: accentColor }} />
                          <input
                            type="color"
                            value={accentColor}
                            onChange={e => handleAccentColorChange(e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                        </div>
                        <span className="text-xs text-gray-500 font-medium">Accent</span>
                      </label>
                      <label className="flex items-center gap-2 flex-1 cursor-pointer">
                        <div className="relative w-8 h-8 rounded-lg overflow-hidden border-2 border-gray-200 flex-shrink-0">
                          <div className="absolute inset-0" style={{ background: textColor }} />
                          <input
                            type="color"
                            value={textColor}
                            onChange={e => handleTextColorChange(e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                        </div>
                        <span className="text-xs text-gray-500 font-medium">Text</span>
                      </label>
                    </div>
                  </div>

                  {/* Slide 1 Preview */}
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider px-4 pt-4 pb-3">Preview — Slide 1</p>
                    {isPreviewingSlide && (
                      <div className="w-full aspect-square bg-gray-50 flex items-center justify-center pb-4">
                        <RefreshCw className="w-5 h-5 text-gray-300 animate-spin" />
                      </div>
                    )}
                    {slidePreviewUrl && !isPreviewingSlide && (
                      <img src={slidePreviewUrl} alt="Slide 1 preview" className="w-full aspect-square object-cover" />
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => copyToClipboard(state.content!.carousel.map(s => `SLIDE ${s.slide}\n${s.title}\n${s.description}`).join("\n\n"))}
                      className="flex-1 py-3 text-xs font-bold text-gray-500 hover:text-gray-700 bg-white rounded-xl border border-gray-200">
                      Copy all slides
                    </button>
                    <button
                      onClick={handleDownloadCarouselPDF}
                      disabled={isExportingPDF}
                      className="flex-1 py-3 text-xs font-bold text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 rounded-xl border border-primary/20 flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {isExportingPDF ? "Building PDF…" : "Download PDF"}
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Animated (.mp4)</p>
                      <div className="flex gap-1">
                        {([1, 2, 3, 4, 5] as const).map((mult) => (
                          <button
                            key={mult}
                            onClick={() => setAnimSpeedMult(mult)}
                            className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-bold transition-all",
                              animSpeedMult === mult
                                ? "bg-primary text-white"
                                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                            )}
                          >
                            {mult}×
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(["swipe", "fade", "zoom"] as CarouselAnimPreset[]).map((preset) => (
                        <button
                          key={preset}
                          disabled={!!isAnimatingCarousel}
                          onClick={() => handleDownloadAnimatedCarousel(preset)}
                          className={cn(
                            "py-3 rounded-xl text-xs font-bold border-2 transition-all flex items-center justify-center gap-1",
                            isAnimatingCarousel === preset
                              ? "bg-primary text-white border-primary"
                              : "bg-white text-gray-700 border-gray-200 hover:border-primary/50 hover:bg-primary/5 disabled:opacity-40"
                          )}
                        >
                          {isAnimatingCarousel === preset ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Download className="w-3 h-3" />
                          )}
                          {isAnimatingCarousel === preset ? "…" : preset === "swipe" ? "Swipe" : preset === "fade" ? "Fade" : "Zoom"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-3">
              {state.activeTab !== "visual" && (
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
              )}
              {state.activeTab === "carousel" && state.content?.post && (
                <button
                  disabled={isRefining}
                  onClick={() => handleRefine("Rewrite every slide so the titles and descriptions directly reflect the key points and narrative of the updated post. Keep the same number of slides.")}
                  className={cn("w-full py-3 px-3 rounded-xl text-xs font-bold border-2 transition-all flex items-center justify-center gap-2",
                    refiningTab?.startsWith("Rewrite every slide") ? "bg-primary text-white border-primary" : "bg-primary/5 text-primary border-primary/20 hover:bg-primary/10 disabled:opacity-40")}
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", refiningTab?.startsWith("Rewrite every slide") && "animate-spin")} />
                  {refiningTab?.startsWith("Rewrite every slide") ? "Syncing…" : "Sync to current post"}
                </button>
              )}
              <Button className="w-full h-14 text-base font-semibold" onClick={handleSave} disabled={isSaving || isCoaching}>
                {isSaving ? "Saving..." : isCoaching ? "Reviewing draft..." : draftId ? "Update draft" : "Save draft"}
                {!isSaving && !isCoaching && <Check className="ml-2 w-4 h-4" />}
              </Button>
            </div>
          </motion.div>
        );

      case 6: {
        const postText = state.content?.post ?? null;
        const topic = state.structure?.topic ?? "draft";
        const handleExport = () => {
          if (!postText) return;
          const filename = topic.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40);
          const blob = new Blob([postText], { type: "text/plain" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${filename}.txt`;
          a.click();
          URL.revokeObjectURL(url);
        };
        const handleCopy = () => {
          if (!postText) return;
          navigator.clipboard.writeText(postText);
          toast({ title: "Copied to clipboard." });
        };
        return (
          <motion.div key="s6" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-6">
              <Check className="w-10 h-10" strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl font-extrabold mb-2 text-gray-900">{draftId ? "Draft updated" : "Draft saved"}</h2>
            <p className="text-gray-500 mb-8 text-sm">Your content is ready for LinkedIn.</p>
            <div className="w-full space-y-3 px-4">
              {postText && (
                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex-1 h-12 rounded-2xl border-2 border-gray-200 bg-white text-gray-700 font-bold text-sm flex items-center justify-center gap-2 hover:border-primary/50 hover:text-primary transition-colors"
                  >
                    <Copy className="w-4 h-4" /> Copy post
                  </button>
                  <button
                    onClick={handleExport}
                    className="flex-1 h-12 rounded-2xl border-2 border-gray-200 bg-white text-gray-700 font-bold text-sm flex items-center justify-center gap-2 hover:border-primary/50 hover:text-primary transition-colors"
                  >
                    <Download className="w-4 h-4" /> Export .txt
                  </button>
                </div>
              )}
              <Button className="w-full h-14 text-base font-semibold" onClick={() => navigate("/library")}>Go to Library</Button>
              <Button variant="outline" className="w-full h-14 text-base font-semibold border-2" onClick={resetFlow}>Capture another idea</Button>
            </div>
          </motion.div>
        );
      }

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

        {/* Pre-save Coach Modal */}
        <AnimatePresence>
          {coachModal && (
            <motion.div
              key="coach-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[60] flex items-end"
            >
              <div className="absolute inset-0 bg-black/60" />
              <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}
                className="relative w-full bg-white rounded-t-3xl px-5 pt-5 pb-24 shadow-2xl flex flex-col gap-4 max-h-[82vh] overflow-y-auto"
              >
                <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto -mb-1 shrink-0" />

                {/* Header */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Writing Coach</span>
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize", {
                    "bg-orange-50 border-orange-200 text-orange-700": coachModal.type === "hook",
                    "bg-blue-50 border-blue-200 text-blue-700": coachModal.type === "clarity",
                    "bg-violet-50 border-violet-200 text-violet-700": coachModal.type === "voice",
                    "bg-sky-50 border-sky-200 text-sky-700": coachModal.type === "structure",
                    "bg-emerald-50 border-emerald-200 text-emerald-700": coachModal.type === "cta",
                  })}>
                    {coachModal.type}
                  </span>
                </div>

                {/* Coaching note */}
                <p className="text-gray-700 text-sm leading-relaxed shrink-0">{coachModal.note}</p>

                {/* Suggested rewrite */}
                {coachModal.rewrite && (
                  <div className="shrink-0">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-[10px] font-bold text-primary uppercase tracking-widest">✦ Suggested rewrite</span>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 max-h-52 overflow-y-auto">
                      <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">{coachModal.rewrite}</p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-2.5 shrink-0 pt-1">
                  {/* Primary: use the rewrite */}
                  <button
                    onClick={() => {
                      const rewrite = coachModal.rewrite;
                      // Update the post textarea so the user sees the rewrite if they navigate back
                      if (rewrite) {
                        setState(s => s.content ? { ...s, content: { ...s.content, post: rewrite } } : s);
                        setUserEditedPost(false);
                      }
                      setCoachModal(null);
                      // Pass rewrite directly — avoids the stale state closure in pendingSaveRef
                      pendingSaveRef.current?.(rewrite || undefined);
                    }}
                    className="w-full h-12 rounded-2xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
                  >
                    Use this rewrite
                  </button>

                  {/* Secondary row */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={() => setCoachModal(null)}
                      className="h-12 rounded-2xl border-2 border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Edit manually
                    </button>
                    <button
                      onClick={() => { setCoachModal(null); pendingSaveRef.current?.(); }}
                      className="h-12 rounded-2xl border-2 border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
                    >
                      Save as-is
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <BottomNav />
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
