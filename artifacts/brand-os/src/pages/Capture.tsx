import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearch, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight, Sparkles, Check, ChevronLeft, Briefcase,
  Target, Zap, PenTool, Layout, Image as ImageIcon,
  RefreshCw, Copy, AlertTriangle, X, Lightbulb, Download,
  ChevronDown, BookOpen, Newspaper, Wand2, Shuffle, GraduationCap,
} from "lucide-react";
import {
  useStructureIdea, useGenerateContent, useRefineContent,
  useCreateDraft, useUpdateDraft, useGetDraft, getGetDraftQueryKey,
} from "@workspace/api-client-react";
import type { HookItem, StructuredBreakdown, StructureIdeaResponse, GeneratedContent, CarouselSlide, Draft, InfographicData, CreateDraftBodyContentSource, UpdateDraftBodyContentSource } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { GenerationLoader } from "@/components/ui/skeleton";
import { AppShell } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { angleApi, thoughtsApi, imageGenApi, imagePromptApi, preferencesApi, agentApi, aiApi, illustrationConceptApi, type AngleCheckResult, type AgentCoach } from "@/lib/api";
import { downloadCarouselPDF, previewCarouselSlide } from "@/lib/export-carousel";
import { downloadVisualCard, previewVisualCard } from "@/lib/export-visual-card";
import { downloadAnimatedCard, type CardAnimPreset, CARD_BASE_DURATIONS } from "@/lib/export-animated-card";
import { downloadAnimatedCarousel, type CarouselAnimPreset, CAROUSEL_PRESET_DURATIONS } from "@/lib/export-animated-carousel";
import { previewInfographic, downloadInfographic, downloadAnimatedInfographic, type InfographicAnimPreset, INFOGRAPHIC_BASE_DURATIONS } from "@/lib/export-infographic";
import { previewIllustrationCard, downloadIllustrationCard, downloadAnimatedIllustration, type IllustrationAnimPreset, ILLUS_BASE_DURATIONS } from "@/lib/export-illustration";

const OBJECTIVES = ["Clients", "Job", "Authority", "Documenting", "Expert", "Hiring"];
const PERSONAS = ["Operator", "Founder", "Career", "Technical", "Sales"];
const TONES = ["Executive", "Direct", "Story", "Contrarian", "Witty", "Vulnerable", "Playful", "Snappy"];

const POST_TONES = [
  { key: "Executive",  emoji: "🎩", label: "Executive",  desc: "Polished, authoritative, considered" },
  { key: "Direct",     emoji: "🎯", label: "Direct",     desc: "Clear, authoritative, no fluff" },
  { key: "Story",      emoji: "📖", label: "Story",      desc: "Opens with a vivid scene" },
  { key: "Contrarian", emoji: "⚡", label: "Contrarian", desc: "Challenges conventional wisdom" },
  { key: "Witty",      emoji: "😏", label: "Witty",      desc: "Dry, self-aware, human" },
  { key: "Vulnerable", emoji: "💙", label: "Vulnerable", desc: "Personal, honest, open" },
  { key: "Playful",    emoji: "🎉", label: "Playful",    desc: "Warm humour, personality-forward" },
  { key: "Snappy",     emoji: "✂️", label: "Snappy",     desc: "Under 150 words, punchy" },
] as const;

type PostToneKey = typeof POST_TONES[number]["key"];

const HOOK_TYPES_META = [
  { key: "how-i",          label: "How I",       emoji: "🙋", color: "bg-violet-100 text-violet-700",  border: "border-violet-200" },
  { key: "contrarian",     label: "Contrarian",  emoji: "⚡", color: "bg-rose-100 text-rose-700",      border: "border-rose-200" },
  { key: "number",         label: "Numbers",     emoji: "📊", color: "bg-amber-100 text-amber-700",    border: "border-amber-200" },
  { key: "question",       label: "Question",    emoji: "❓", color: "bg-blue-100 text-blue-700",      border: "border-blue-200" },
  { key: "scene-setter",   label: "Scene",       emoji: "🎬", color: "bg-teal-100 text-teal-700",      border: "border-teal-200" },
  { key: "prediction",     label: "Prediction",  emoji: "🔮", color: "bg-purple-100 text-purple-700",  border: "border-purple-200" },
  { key: "analogy",        label: "Analogy",     emoji: "🔗", color: "bg-orange-100 text-orange-700",  border: "border-orange-200" },
  { key: "disarming-joke", label: "Joke",        emoji: "😄", color: "bg-yellow-100 text-yellow-700",  border: "border-yellow-200" },
  { key: "tension-setter", label: "Tension",     emoji: "😬", color: "bg-red-100 text-red-700",        border: "border-red-200" },
  { key: "confession",     label: "Confession",  emoji: "🤍", color: "bg-pink-100 text-pink-700",      border: "border-pink-200" },
] as const;

const ALL_HOOK_TYPE_KEYS = HOOK_TYPES_META.map(t => t.key);

type TabType = "post" | "short" | "carousel" | "visual" | "infographic" | "illustration";

type PostFormatKey = "standard" | "frustrated-expert" | "lived-lesson" | "clean-breakdown";

const POST_FORMATS: Array<{ key: PostFormatKey; emoji: string; label: string; desc: string }> = [
  { key: "standard",          emoji: "✍️",  label: "Standard",          desc: "Your natural voice" },
  { key: "frustrated-expert", emoji: "🔥",  label: "Frustrated Expert", desc: "Earned rant, disarming opener" },
  { key: "lived-lesson",      emoji: "📚",  label: "Lived Lesson",      desc: "Personal transformation story" },
  { key: "clean-breakdown",   emoji: "🗂️",  label: "Clean Breakdown",   desc: "Step-by-step clarity" },
];

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
  postTone: PostToneKey;
  postFormat: PostFormatKey;
  content: GeneratedContent | null;
  activeTab: TabType;
  storyMode: boolean;
  teacherMode: boolean;
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
  const newsUrlParam = params.get("newsUrl") ?? "";
  const toneParam = params.get("tone") ?? "";
  const stepParamRaw = params.get("step") ? parseInt(params.get("step")!, 10) : null;
  const stepParam = stepParamRaw !== null && !isNaN(stepParamRaw) ? stepParamRaw : null;
  const teacherModeParam = params.get("teacherMode") === "true";
  const lengthParam = (params.get("length") ?? "") as "short" | "medium" | "long" | "";

  const { preferences } = useAuth();
  const { toast } = useToast();

  const forcedTone = POST_TONES.find(t => t.key === toneParam)?.key ?? null;

  // Map length param → initial mode/tone
  const lengthInitialTone: PostToneKey = lengthParam === "short"
    ? "Snappy"
    : (forcedTone as PostToneKey) ?? ((preferences?.tone ?? "Direct") as PostToneKey);
  // Long always → storyMode; teacherMode must be off (Story Mode takes precedence)
  const lengthInitialStoryMode = lengthParam === "long";
  // When length=long, teacherMode is disabled (storyMode takes precedence per spec)
  const lengthInitialTeacherMode = lengthParam === "long" ? false : teacherModeParam;

  const initialState: WorkflowState = {
    step: stepParam ?? 1,
    rawInput: thoughtParam || rawParam || "",
    objective: preferences?.objective ?? "Authority",
    persona: preferences?.persona ?? "Founder",
    tone: preferences?.tone ?? "Direct",
    structureResult: null,
    selectedLane: "evergreen",
    structure: null,
    selectedHook: null,
    postTone: lengthInitialTone,
    postFormat: "standard",
    content: null,
    activeTab: "post",
    storyMode: lengthInitialStoryMode,
    teacherMode: lengthInitialTeacherMode,
  };

  const [state, setState] = useState<WorkflowState>(initialState);
  const downloadedVisualTypeRef = useRef<string | null>(null);
  const currentDraftIdRef = useRef<number | null>(draftId);
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
          shortPost: existingDraft.shortPost ?? "",
          carousel: existingDraft.carouselOutput ? JSON.parse(existingDraft.carouselOutput) as CarouselSlide[] : [],
          visual: existingDraft.visualOutput ?? "",
        };
      }
      const archetype = structure?.archetype ?? "";
      const draftAutoTone: PostToneKey =
        archetype === "storytelling" ? "Story" :
        archetype === "contrarian" ? "Contrarian" :
        existingDraft.tone === "Bold" ? "Contrarian" :
        existingDraft.tone === "Story" ? "Story" :
        "Direct";
      const sf = (structure as { postFormat?: string | null })?.postFormat;
      const restoredFormat: PostFormatKey =
        sf === "frustrated-expert" ? "frustrated-expert" :
        sf === "lived-lesson" ? "lived-lesson" :
        sf === "clean-breakdown" ? "clean-breakdown" :
        "standard";
      setState({
        step: content ? 4 : 3,
        rawInput: existingDraft.rawInput,
        objective: existingDraft.objective,
        persona: existingDraft.persona,
        tone: existingDraft.tone,
        postTone: draftAutoTone,
        postFormat: restoredFormat,
        structureResult: null,
        selectedLane: "evergreen",
        structure,
        selectedHook: structure?.hooks?.[0]?.text ?? null,
        content,
        activeTab: "post",
        storyMode: (structure?.storyMode ?? (structure?.archetype === "storytelling")) && !structure?.teacherMode,
        teacherMode: !!structure?.teacherMode,
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
  const [storyArcOpen, setStoryArcOpen] = useState(false);
  const [isLoadingHooks, setIsLoadingHooks] = useState(false);
  const [hookAlternatives, setHookAlternatives] = useState<string[] | null>(null);
  const [hookTypeFilter, setHookTypeFilter] = useState<Set<string>>(new Set(ALL_HOOK_TYPE_KEYS));
  const [shuffledHooks, setShuffledHooks] = useState<Array<{ text: string; type: string }> | null>(null);
  const [isShufflingHooks, setIsShufflingHooks] = useState(false);
  const lastShuffleCombo = useRef<string>("");
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

  // Infographic preview + export
  const [infographicPreviewUrl, setInfographicPreviewUrl] = useState<string | null>(null);
  const [isPreviewingInfographic, setIsPreviewingInfographic] = useState(false);
  const [isExportingInfographic, setIsExportingInfographic] = useState(false);
  const [isAnimatingInfographic, setIsAnimatingInfographic] = useState<InfographicAnimPreset | null>(null);
  const infographicPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const infographicRenderKey = useRef<string>("");

  // Illustration tab
  const [illustStyle, setIllustStyle] = useState("surprise");
  const [illustConcept, setIllustConcept] = useState<{ scenePrompt: string; caption: string; chosenStyle: string } | null>(null);
  const [illustScenePrompt, setIllustScenePrompt] = useState("");
  const [illustImageBase64, setIllustImageBase64] = useState<string | null>(null);
  const [illustCaption, setIllustCaption] = useState("");
  const [illustPreviewUrl, setIllustPreviewUrl] = useState<string | null>(null);
  const [isGeneratingIllustConcept, setIsGeneratingIllustConcept] = useState(false);
  const [isGeneratingIllustImage, setIsGeneratingIllustImage] = useState(false);
  const [isPreviewingIllustration, setIsPreviewingIllustration] = useState(false);
  const [isExportingIllust, setIsExportingIllust] = useState(false);
  const [isAnimatingIllust, setIsAnimatingIllust] = useState<IllustrationAnimPreset | null>(null);
  const illustPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Image prompt (two-step)
  const [imagePrompt, setImagePrompt] = useState("");
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);

  // Pre-save coach
  const [coachModal, setCoachModal] = useState<{ note: string; type: AgentCoach["type"]; rewrite: string } | null>(null);
  const [isCoaching, setIsCoaching] = useState(false);
  const pendingSaveRef = useRef<((postOverride?: string) => void) | null>(null);
  const postTextareaRef = useRef<HTMLTextAreaElement>(null);

  // LinkedIn-compatible Unicode text formatters (LinkedIn ignores markdown but renders Unicode math chars)
  const applyUnicode = (text: string, mode: "bold" | "italic" | "bolditalic"): string =>
    text.split("").map(ch => {
      const c = ch.charCodeAt(0);
      if (mode === "bolditalic") {
        if (c >= 65 && c <= 90) return String.fromCodePoint(0x1D63C + c - 65);
        if (c >= 97 && c <= 122) return String.fromCodePoint(0x1D656 + c - 97);
        return ch;
      }
      if (mode === "bold") {
        if (c >= 65 && c <= 90) return String.fromCodePoint(0x1D5D4 + c - 65);
        if (c >= 97 && c <= 122) return String.fromCodePoint(0x1D5EE + c - 97);
        if (c >= 48 && c <= 57) return String.fromCodePoint(0x1D7EC + c - 48);
        return ch;
      }
      if (mode === "italic") {
        if (c >= 65 && c <= 90) return String.fromCodePoint(0x1D608 + c - 65);
        if (c >= 97 && c <= 122) return String.fromCodePoint(0x1D622 + c - 97);
        return ch;
      }
      return ch;
    }).join("");
  const toLiBold = (t: string) => applyUnicode(t, "bold");
  const toLiItalic = (t: string) => applyUnicode(t, "italic");
  const toLiBoldItalic = (t: string) => applyUnicode(t, "bolditalic");

  const applyPostFormat = (formatter: (t: string) => string) => {
    const el = postTextareaRef.current;
    if (!el || !state.content) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start === end) return;
    const post = state.content.post;
    const formatted = formatter(post.substring(start, end));
    const newPost = post.substring(0, start) + formatted + post.substring(end);
    setState(s => s.content ? { ...s, content: { ...s.content, post: newPost } } : s);
    setUserEditedPost(true);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start, start + formatted.length);
    });
  };
  // Track whether the user has hand-edited the post text after AI generation.
  // The coach only fires when this is true — pure AI output skips it.
  const [userEditedPost, setUserEditedPost] = useState(false);

  // Initialize palette from saved preferences (once)
  useEffect(() => {
    if (preferences && !paletteInitializedRef.current) {
      if (preferences.brandBgColor) setBgColor(preferences.brandBgColor);
      if (preferences.brandAccentColor) setAccentColor(preferences.brandAccentColor);
      if (preferences.brandTextColor) setTextColor(preferences.brandTextColor);
      paletteInitializedRef.current = true;
    }
  }, [preferences]);

  // Auto-generate slide preview when carousel tab is active or colors change
  const carouselLength = state.content?.carousel?.length ?? 0;
  // Stringify the full carousel so ANY edit or refinement (title, description, slide count) triggers a preview refresh
  const carouselFingerprint = JSON.stringify(state.content?.carousel ?? []);
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
  }, [state.activeTab, carouselFingerprint, bgColor, accentColor, textColor]);

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

  // Auto-generate infographic preview when data/colors change.
  // The preview URL is KEPT when switching tabs — only regenerated when content actually changes.
  const infographicFingerprint = JSON.stringify(state.content?.infographic ?? {});
  useEffect(() => {
    const info = state.content?.infographic;

    // If there's no data at all, clear everything and reset the key
    if (!info?.headline) {
      setInfographicPreviewUrl(null);
      infographicRenderKey.current = "";
      return;
    }

    // Build a signature that captures everything that affects the rendered output.
    // RENDERER_V bumps when the HTML/canvas renderer code changes, invalidating old previews.
    const RENDERER_V = "v2";
    const sig = `${RENDERER_V}|${infographicFingerprint}|${bgColor}|${accentColor}|${textColor}`;

    // Preview is already up-to-date — nothing to do (preserves it across tab switches)
    if (infographicRenderKey.current === sig) return;

    // Only actually generate while on the infographic tab; if the user is on another
    // tab the stale preview stays visible and re-renders once they come back.
    if (state.activeTab !== "infographic") return;

    if (infographicPreviewTimerRef.current) clearTimeout(infographicPreviewTimerRef.current);
    setIsPreviewingInfographic(true);
    infographicPreviewTimerRef.current = setTimeout(() => {
      void (async () => {
        try {
          const url = await previewInfographic(info.headline, info.bullets, bgColorRef.current, accentColorRef.current, textColorRef.current);
          setInfographicPreviewUrl(url);
          infographicRenderKey.current = sig;
        } catch {
          setInfographicPreviewUrl(null);
          infographicRenderKey.current = "";
        } finally {
          setIsPreviewingInfographic(false);
        }
      })();
    }, 400);
    return () => { if (infographicPreviewTimerRef.current) clearTimeout(infographicPreviewTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeTab, infographicFingerprint, bgColor, accentColor, textColor]);

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
      patchVisualType("carousel");
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
      patchVisualType("card");
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
      patchVisualType("card");
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
      patchVisualType("carousel");
    } catch {
      toast({ title: "Animated export failed. Please try again.", variant: "destructive" });
    } finally {
      setIsAnimatingCarousel(null);
    }
  };

  const handleDownloadInfographic = async () => {
    const info = state.content?.infographic;
    if (!info) return;
    setIsExportingInfographic(true);
    try {
      await downloadInfographic(info.headline, info.bullets, state.structure?.topic ?? "infographic", bgColor, accentColor, textColor);
      patchVisualType("infographic");
    } catch {
      toast({ title: "Infographic export failed. Please try again.", variant: "destructive" });
    } finally {
      setIsExportingInfographic(false);
    }
  };

  const handleDownloadAnimatedInfographic = async (preset: InfographicAnimPreset) => {
    const info = state.content?.infographic;
    if (!info) return;
    setIsAnimatingInfographic(preset);
    try {
      await downloadAnimatedInfographic(
        info.headline,
        info.bullets,
        state.structure?.topic ?? "infographic",
        bgColor,
        accentColor,
        textColor,
        preset,
        Math.round(INFOGRAPHIC_BASE_DURATIONS[preset] * animSpeedMult)
      );
      patchVisualType("infographic");
    } catch {
      toast({ title: "Animated export failed. Please try again.", variant: "destructive" });
    } finally {
      setIsAnimatingInfographic(null);
    }
  };

  const updateInfographicHeadline = (value: string) => {
    setState(s => {
      if (!s.content?.infographic) return s;
      return { ...s, content: { ...s.content, infographic: { ...s.content.infographic, headline: value } } };
    });
  };

  const updateInfographicBullet = (idx: number, value: string) => {
    setState(s => {
      if (!s.content?.infographic) return s;
      const bullets = [...s.content.infographic.bullets];
      bullets[idx] = value;
      return { ...s, content: { ...s.content, infographic: { ...s.content.infographic, bullets } } };
    });
  };

  const addInfographicBullet = () => {
    setState(s => {
      if (!s.content?.infographic) return s;
      const bullets = [...s.content.infographic.bullets, "New point"];
      return { ...s, content: { ...s.content, infographic: { ...s.content.infographic, bullets } } };
    });
  };

  const deleteInfographicBullet = (idx: number) => {
    setState(s => {
      if (!s.content?.infographic || s.content.infographic.bullets.length <= 2) return s;
      const bullets = s.content.infographic.bullets.filter((_, i) => i !== idx);
      return { ...s, content: { ...s.content, infographic: { ...s.content.infographic, bullets } } };
    });
  };

  const handleGenerateInfographic = () => {
    if (!state.content?.post) return;
    setRefiningTab("__infographic_generate__");
    refineContent(
      {
        data: {
          content: state.content.post,
          instruction: "Extract the core message and key insights from this post. Create a punchy headline (6-10 words) and 3-5 bullet points that capture the main takeaways someone would want to screenshot and save.",
          tab: "infographic",
        },
      },
      {
        onSuccess: (data) => {
          try {
            const cleaned = data.content.replace(/```json/g, "").replace(/```/g, "");
            const parsed = JSON.parse(cleaned) as InfographicData;
            setState(s => s.content ? { ...s, content: { ...s.content, infographic: parsed } } : s);
          } catch {
            toast({ title: "Could not generate infographic.", variant: "destructive" });
          }
        },
        onError: () => toast({ title: "Generation failed.", variant: "destructive" }),
        onSettled: () => setRefiningTab(null),
      }
    );
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
    patchVisualType("art");
  };

  // ── Illustration handlers ──────────────────────────────────────────────────

  const handleCraftIllustConcept = async () => {
    if (!state.content?.post) return;
    setIsGeneratingIllustConcept(true);
    setIllustConcept(null);
    setIllustScenePrompt("");
    setIllustCaption("");
    setIllustImageBase64(null);
    setIllustPreviewUrl(null);
    try {
      const concept = await illustrationConceptApi.generate(state.content.post, illustStyle);
      setIllustConcept(concept);
      setIllustScenePrompt(concept.scenePrompt);
      setIllustCaption(concept.caption);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Concept generation failed.";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setIsGeneratingIllustConcept(false);
    }
  };

  const handleGenerateIllustImage = async () => {
    if (!illustScenePrompt.trim()) return;
    setIsGeneratingIllustImage(true);
    setIllustImageBase64(null);
    setIllustPreviewUrl(null);
    try {
      const style = illustConcept?.chosenStyle ?? illustStyle;
      const { imageBase64 } = await imageGenApi.generate(illustScenePrompt, "illustration", style);
      setIllustImageBase64(imageBase64);

      setIsPreviewingIllustration(true);
      const previewUrl = await previewIllustrationCard(imageBase64, illustCaption);
      setIllustPreviewUrl(previewUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Image generation failed.";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setIsGeneratingIllustImage(false);
      setIsPreviewingIllustration(false);
    }
  };

  useEffect(() => {
    if (!illustImageBase64 || !illustCaption.trim()) return;
    if (illustPreviewTimerRef.current) clearTimeout(illustPreviewTimerRef.current);
    illustPreviewTimerRef.current = setTimeout(async () => {
      setIsPreviewingIllustration(true);
      try {
        const url = await previewIllustrationCard(illustImageBase64, illustCaption);
        setIllustPreviewUrl(url);
      } catch {
        // ignore
      } finally {
        setIsPreviewingIllustration(false);
      }
    }, 600);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [illustCaption, illustImageBase64]);

  const handleDownloadIllustrationCard = async () => {
    if (!illustImageBase64 || !illustCaption) return;
    setIsExportingIllust(true);
    try {
      await downloadIllustrationCard(illustImageBase64, illustCaption, `illustration-${illustStyle}`);
      patchVisualType("art");
    } finally {
      setIsExportingIllust(false);
    }
  };

  const handleDownloadAnimatedIllustration = async (preset: IllustrationAnimPreset) => {
    if (!illustImageBase64 || !illustCaption) return;
    setIsAnimatingIllust(preset);
    try {
      await downloadAnimatedIllustration(
        illustImageBase64,
        illustCaption,
        preset,
        `illustration-${illustStyle}`,
        Math.round(ILLUS_BASE_DURATIONS[preset] * animSpeedMult)
      );
      patchVisualType("art");
    } finally {
      setIsAnimatingIllust(null);
    }
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

  // Fast path for short posts: auto-structure → pick first hook → auto-generate
  // teacherModeOverride: explicit teacherMode from URL (preserved from suggestion context)
  const handleShortFastPath = (teacherModeOverride?: boolean) => {
    if (!state.rawInput.trim()) return;
    const useTeacherMode = teacherModeOverride ?? state.teacherMode;
    resetStructure();
    resetGenerate();
    setAngleResult(null);
    setAngleDismissed(false);
    setState(s => ({ ...s, step: 3, structureResult: null, selectedLane: "evergreen", structure: null, selectedHook: null }));
    structureIdea(
      { data: { rawInput: state.rawInput, objective: state.objective, persona: state.persona, tone: state.tone } },
      {
        onSuccess: (data) => {
          const structure = data.evergreen;
          const firstHook = structure.hooks?.[0]?.text ?? null;
          if (!firstHook) return;
          setState(s => ({
            ...s,
            structureResult: data,
            selectedLane: "evergreen",
            structure,
            selectedHook: firstHook,
            postTone: "Snappy",
            storyMode: false,
            teacherMode: useTeacherMode,
            step: 4,
            content: null,
          }));
          generateContent(
            { data: { rawInput: state.rawInput, objective: state.objective, persona: state.persona, tone: state.tone, structure, selectedHook: firstHook, includeCta: false, storyMode: false, postTone: "Snappy", teacherMode: useTeacherMode, newsUrl: newsUrlParam || undefined } },
            {
              onSuccess: (genData) => {
                const defaultTab: TabType = genData.shortPost ? "short" : "post";
                setState(s => ({ ...s, content: genData, activeTab: defaultTab }));
                setImagePrompt("");
                setGeneratedImageBase64(null);
                setUserEditedPost(false);
              },
            }
          );
        },
      }
    );
  };

  // Auto-trigger short fast-path on mount when length=short + raw is pre-filled + step=2
  // (suggestion-origin flows: user tapped "Write this →" from a pillar card)
  const shortFastPathFiredRef = useRef(false);
  useEffect(() => {
    if (
      lengthParam === "short" &&
      state.rawInput.trim() &&
      state.step === 2 &&
      !shortFastPathFiredRef.current &&
      !draftId
    ) {
      shortFastPathFiredRef.current = true;
      handleShortFastPath(teacherModeParam);
    }
  // Only run once on mount — all deps intentionally omitted
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStructure = () => {
    if (!state.rawInput.trim()) return;
    resetStructure();
    setAngleResult(null);
    setAngleDismissed(false);
    setState(s => ({ ...s, step: 3, structureResult: null, selectedLane: "evergreen", structure: null, selectedHook: null }));
    structureIdea(
      { data: { rawInput: state.rawInput, objective: state.objective, persona: state.persona, tone: state.tone } },
      {
        onSuccess: (data) => {
          const archetype = data.evergreen.archetype ?? "";
          const autoTone: PostToneKey =
            archetype === "storytelling" ? "Story" :
            archetype === "contrarian" ? "Contrarian" :
            state.tone === "Bold" ? "Contrarian" :
            state.tone === "Story" ? "Story" :
            "Direct";
          // If user explicitly chose a length, preserve its derived tone and storyMode
          const preserveLengthTone = lengthParam === "short" || lengthParam === "medium" || lengthParam === "long";
          // long always → storyMode (spec says long=Story Mode+carousel); teacherMode disabled for long
          const isLong = lengthParam === "long";
          setState(s => ({
            ...s,
            structureResult: data,
            selectedLane: "evergreen",
            structure: data.evergreen,
            postTone: preserveLengthTone ? s.postTone : autoTone,
            storyMode: isLong
              ? true
              : (s.storyMode || data.evergreen.archetype === "storytelling" || data.trending?.archetype === "storytelling") && !s.teacherMode,
            teacherMode: isLong ? false : s.teacherMode,
          }));
          setShuffledHooks(null);
          setHookTypeFilter(new Set(ALL_HOOK_TYPE_KEYS));
          void checkAngle(data.evergreen.topic, data.evergreen.angle);
        }
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
      storyMode: (s.storyMode || newStructure.archetype === "storytelling") && !s.teacherMode,
    }));
    void checkAngle(newStructure.topic, newStructure.angle);
  };

  const handleGenerate = () => {
    if (!state.structure || !state.selectedHook) return;
    resetGenerate();
    setHookAlternatives(null);
    setState(s => ({ ...s, step: 4, content: null }));
    generateContent(
      {
        data: {
          rawInput: state.rawInput, objective: state.objective, persona: state.persona,
          tone: state.tone, structure: state.structure, selectedHook: state.selectedHook,
          includeCta, storyMode: state.storyMode, postTone: state.postTone,
          teacherMode: state.teacherMode, newsUrl: newsUrlParam || undefined,
          postFormat: state.postFormat !== "standard" ? state.postFormat : undefined,
        },
      },
      {
        onSuccess: (data) => {
          const isSnappy = state.postTone === "Snappy";
          const defaultTab: TabType = isSnappy && data.shortPost ? "short" : state.storyMode ? "carousel" : "post";
          setState(s => ({ ...s, content: data, activeTab: defaultTab }));
          setImagePrompt("");
          setGeneratedImageBase64(null);
          setUserEditedPost(false);
        },
      }
    );
  };

  const handleLoadHooks = async () => {
    if (!state.content?.post || isLoadingHooks) return;
    setIsLoadingHooks(true);
    setHookAlternatives(null);
    try {
      const activeTypes = hookTypeFilter.size > 0 ? Array.from(hookTypeFilter) : undefined;
      const result = await agentApi.hookAlternatives(state.content.post, state.postTone, activeTypes);
      setHookAlternatives(result.hooks);
    } catch {
      toast({ title: "Couldn't generate hook alternatives. Try again.", variant: "destructive" });
    } finally {
      setIsLoadingHooks(false);
    }
  };

  const applyHook = (hook: string) => {
    if (!state.content) return;
    const postLines = state.content.post.split("\n");
    const firstNonEmptyIdx = postLines.findIndex(l => l.trim().length > 0);
    if (firstNonEmptyIdx !== -1) {
      postLines[firstNonEmptyIdx] = hook;
    } else {
      postLines.unshift(hook);
    }
    setState(s => s.content ? { ...s, content: { ...s.content, post: postLines.join("\n") } } : s);
    setHookAlternatives(null);
    setUserEditedPost(true);
    toast({ title: "Hook applied." });
  };

  const handleRefine = (instruction: string) => {
    if (!state.content) return;
    setRefiningTab(instruction);
    let contentToRefine = "";
    const refineTab = state.activeTab === "short" ? "post" : state.activeTab;
    if (state.activeTab === "post") contentToRefine = state.content.post;
    else if (state.activeTab === "short") contentToRefine = state.content.shortPost ?? "";
    else if (state.activeTab === "visual") contentToRefine = state.content.visual;
    else if (state.activeTab === "carousel") contentToRefine = JSON.stringify(state.content.carousel);
    else if (state.activeTab === "infographic") contentToRefine = JSON.stringify(state.content.infographic ?? { headline: "", bullets: [] });

    // When refining non-post tabs, always inject the current post as context
    let fullInstruction = instruction;
    if (state.activeTab !== "post" && state.activeTab !== "short" && state.content.post?.trim()) {
      fullInstruction = `${instruction}\n\nFor context, the current post reads:\n${state.content.post}`;
    }
    // When Teacher Mode is active, preserve the analogy structure
    if (state.teacherMode) {
      fullInstruction = `${fullInstruction}\n\nIMPORTANT: This content was written in Teacher Mode. Preserve the 4-part analogy structure: (1) analogy hook line under 140 chars, (2) real-world case or FAQ answer, (3) transferable lesson/insight, (4) CTA. Do not collapse or reorder these parts.`;
    }

    refineContent(
      { data: { content: contentToRefine, instruction: fullInstruction, tab: refineTab } },
      {
        onSuccess: (data) => {
          setState(s => {
            if (!s.content) return s;
            const nc = { ...s.content };
            if (s.activeTab === "post") {
              nc.post = data.content;
              setUserEditedPost(false);
            }
            else if (s.activeTab === "short") nc.shortPost = data.content;
            else if (s.activeTab === "visual") nc.visual = data.content;
            else if (s.activeTab === "carousel") {
              try {
                const cleaned = data.content.replace(/```json/g, "").replace(/```/g, "");
                nc.carousel = JSON.parse(cleaned) as CarouselSlide[];
              } catch {
                toast({ title: "Could not parse refined carousel.", variant: "destructive" });
              }
            }
            else if (s.activeTab === "infographic") {
              try {
                const cleaned = data.content.replace(/```json/g, "").replace(/```/g, "");
                nc.infographic = JSON.parse(cleaned) as InfographicData;
              } catch {
                toast({ title: "Could not parse refined infographic.", variant: "destructive" });
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
    // Infer content source from URL params and current state
    const derivedContentSource = newsUrlParam
      ? "news_reaction"
      : state.teacherMode
        ? "teach_audience"
        : state.storyMode
          ? "story_mode"
          : rawParam && !thoughtParam
            ? "brand_voice_idea"
            : "capture";
    const draftData = {
      rawInput: state.rawInput,
      objective: state.objective,
      persona: state.persona,
      tone: state.tone,
      structuredBreakdown: { ...state.structure, storyMode: state.storyMode, teacherMode: state.teacherMode, postFormat: state.postFormat },
      selectedHook: state.selectedHook ?? null,
      postOutput: postOverride ?? state.content?.post ?? null,
      shortPost: state.content?.shortPost ?? null,
      carouselOutput: state.content ? JSON.stringify(state.content.carousel) : null,
      visualOutput: state.content?.visual ?? null,
      status: "draft" as const,
      contentSource: derivedContentSource as CreateDraftBodyContentSource,
      visualType: (downloadedVisualTypeRef.current as "none" | "card" | "carousel" | "infographic" | "art" | undefined) ?? "none",
    };

    const afterSave = (savedId: number) => {
      currentDraftIdRef.current = savedId;
      setState(s => ({ ...s, step: 6 }));
      if (thoughtId) {
        void thoughtsApi.markDeveloped(thoughtId);
      }
    };

    if (draftId) {
      updateDraft(
        { id: draftId!, data: { postOutput: draftData.postOutput, shortPost: draftData.shortPost, carouselOutput: draftData.carouselOutput, visualOutput: draftData.visualOutput, structuredBreakdown: draftData.structuredBreakdown, contentSource: draftData.contentSource as unknown as UpdateDraftBodyContentSource, visualType: draftData.visualType } },
        {
          onSuccess: (saved: Draft) => {
            // Populate the cache so Library → "Edit and continue" always sees the latest content
            queryClient.setQueryData(getGetDraftQueryKey(draftId!), saved);
            afterSave(saved.id);
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
            afterSave(saved.id);
          },
          onError: () => toast({ title: "Failed to save draft.", variant: "destructive" }),
        }
      );
    }
  };

  // Patch visual type on the already-saved draft whenever user downloads in step 6
  const patchVisualType = (vt: "card" | "carousel" | "infographic" | "art") => {
    downloadedVisualTypeRef.current = vt;
    const id = currentDraftIdRef.current;
    if (id) {
      updateDraft({ id, data: { visualType: vt } });
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
    setIncludeCta(false);
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
            {newsUrlParam && (
              <div className="mb-4 flex items-center justify-between gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="flex items-center gap-2 min-w-0">
                  <Newspaper className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <p className="text-xs text-emerald-700 font-medium">Based on a news article</p>
                </div>
                <a
                  href={newsUrlParam}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-emerald-600 hover:text-emerald-800 font-semibold underline underline-offset-2 flex-shrink-0 transition-colors"
                >
                  View source →
                </a>
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
              {(state.rawInput || lengthParam) && (
                <div className="bg-white p-4 rounded-2xl border border-gray-100">
                  {state.rawInput && <p className={cn("text-gray-500 text-sm line-clamp-3 italic", lengthParam && "mb-2")}>"{state.rawInput}"</p>}
                  {lengthParam && (
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full",
                        lengthParam === "short" ? "bg-blue-50 text-blue-600" :
                        lengthParam === "long" ? "bg-violet-50 text-violet-600" :
                        "bg-gray-100 text-gray-500"
                      )}>
                        {lengthParam === "short" ? "✂️ Short post" : lengthParam === "long" ? "📖 Long story" : "📝 Medium post"}
                      </span>
                      <span className="text-[10px] text-gray-400">You can change this below</span>
                    </div>
                  )}
                </div>
              )}
              <div className="space-y-6">
                <SelGroup label="Objective" icon={<Target className="w-4 h-4" />} options={OBJECTIVES} selected={state.objective} onSelect={v => setState(s => ({ ...s, objective: v }))} />
                <SelGroup label="Persona" icon={<Briefcase className="w-4 h-4" />} options={PERSONAS} selected={state.persona} onSelect={v => setState(s => ({ ...s, persona: v }))} />
                <SelGroup label="Tone" icon={<Zap className="w-4 h-4" />} options={TONES} selected={state.tone} onSelect={v => setState(s => ({ ...s, tone: v }))} />
                <div className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-violet-500" />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">This is a story</p>
                      <p className="text-[11px] text-gray-400 leading-tight">Uses 5-beat narrative arc: Scene → Tension → Turn → Lesson → CTA</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setState(s => {
                      const enabling = !s.storyMode;
                      return { ...s, storyMode: enabling, teacherMode: enabling ? false : s.teacherMode };
                    })}
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
                <div className="flex items-center justify-between bg-white border border-indigo-100 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-indigo-500" />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Teacher Mode</p>
                      <p className="text-[11px] text-gray-400 leading-tight">Analogy hook → real-world case → lesson → CTA</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setState(s => {
                      const enabling = !s.teacherMode;
                      return { ...s, teacherMode: enabling, storyMode: enabling ? false : s.storyMode };
                    })}
                    className={cn(
                      "relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0",
                      state.teacherMode ? "bg-indigo-500" : "bg-gray-200"
                    )}
                    role="switch"
                    aria-checked={state.teacherMode}
                  >
                    <span className={cn(
                      "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200",
                      state.teacherMode ? "translate-x-5" : "translate-x-0"
                    )} />
                  </button>
                </div>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 px-6 pb-8 pt-4 bg-gradient-to-t from-gray-50 via-gray-50/90 to-transparent z-10 space-y-2.5">
              {lengthParam === "short" && state.rawInput.trim() && (
                <Button
                  variant="outline"
                  className="w-full h-12 text-sm font-semibold border-2 border-primary/30 text-primary group"
                  onClick={() => handleShortFastPath()}
                >
                  ⚡ Quick generate short post
                </Button>
              )}
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

              {/* Story Mode toggle (step 3) */}
              <div className={cn(
                "flex items-center gap-2 px-3 py-2 border rounded-xl transition-colors cursor-pointer",
                state.storyMode
                  ? "bg-violet-50 border-violet-100"
                  : "bg-white border-gray-100 hover:border-violet-100"
              )} onClick={() => setState(s => {
                const enabling = !s.storyMode;
                return { ...s, storyMode: enabling, teacherMode: enabling ? false : s.teacherMode };
              })}>
                <BookOpen className={cn("w-3.5 h-3.5 flex-shrink-0", state.storyMode ? "text-violet-500" : "text-gray-400")} />
                <p className={cn("text-xs font-semibold", state.storyMode ? "text-violet-700" : "text-gray-500")}>
                  {state.storyMode ? "Story Mode — 5-beat arc will be used" : "Enable Story Mode"}
                </p>
                {state.storyMode && (
                  <button
                    onClick={e => { e.stopPropagation(); setState(s => ({ ...s, storyMode: false })); }}
                    className="ml-auto text-violet-300 hover:text-violet-500"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {/* Teacher Mode toggle (step 3) */}
              <div className={cn(
                "flex items-center gap-2 px-3 py-2 border rounded-xl transition-colors cursor-pointer",
                state.teacherMode
                  ? "bg-indigo-50 border-indigo-100"
                  : "bg-white border-gray-100 hover:border-indigo-100"
              )} onClick={() => setState(s => {
                const enabling = !s.teacherMode;
                return { ...s, teacherMode: enabling, storyMode: enabling ? false : s.storyMode };
              })}>
                <GraduationCap className={cn("w-3.5 h-3.5 flex-shrink-0", state.teacherMode ? "text-indigo-500" : "text-gray-400")} />
                <p className={cn("text-xs font-semibold", state.teacherMode ? "text-indigo-700" : "text-gray-500")}>
                  {state.teacherMode ? "Teacher Mode — analogy + case + lesson format" : "Enable Teacher Mode"}
                </p>
                {state.teacherMode && (
                  <button
                    onClick={e => { e.stopPropagation(); setState(s => ({ ...s, teacherMode: false })); }}
                    className="ml-auto text-indigo-300 hover:text-indigo-500"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Info cards — show the selected lane's data (default: evergreen) */}
              <div className="space-y-3">
                <InfoCard label="Topic" value={state.structure.topic} />
                <InfoCard label="Angle" value={state.structure.angle} />
                <InfoCard label="Core Message" value={state.structure.coreMessage} />
                <InfoCard label="Why This Matters" value={state.structure.whyItMatters} />
              </div>

              {/* Hook selection — two visible sections */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm text-gray-900">Choose a hook</h3>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={isShufflingHooks}
                      onClick={async () => {
                        if (!state.structureResult || !state.rawInput) return;
                        const all = ALL_HOOK_TYPE_KEYS;
                        let picked: string[];
                        let attempts = 0;
                        do {
                          picked = [...all].sort(() => Math.random() - 0.5).slice(0, 3);
                          attempts++;
                        } while (attempts < 10 && picked.slice().sort().join(",") === lastShuffleCombo.current);
                        lastShuffleCombo.current = picked.slice().sort().join(",");
                        setHookTypeFilter(new Set(picked));
                        setIsShufflingHooks(true);
                        try {
                          const result = await aiApi.generateHooks({
                            rawInput: state.rawInput,
                            topic: state.structureResult.evergreen.topic,
                            angle: state.structureResult.evergreen.angle,
                            hookTypes: picked,
                          });
                          setShuffledHooks(result.hooks);
                        } catch (err) {
                          console.error("[Shuffle] API error:", err);
                          toast({ title: "Couldn't shuffle hooks. Try again.", variant: "destructive" });
                        } finally {
                          setIsShufflingHooks(false);
                        }
                      }}
                      className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                      title="Generate 3 fresh hooks in random styles"
                    >
                      {isShufflingHooks ? (
                        <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin inline-block" />
                      ) : (
                        <Shuffle className="w-3 h-3" />
                      )}
                      Shuffle
                    </button>
                    <span className="text-xs text-primary font-semibold bg-primary/10 px-2 py-1 rounded-full">Required</span>
                  </div>
                </div>
                {/* Hook style filter chips */}
                <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 -mx-1 px-1 scrollbar-none">
                  {HOOK_TYPES_META.map(type => {
                    const isActive = hookTypeFilter.has(type.key);
                    const usageCount = state.structureResult?.hookUsage?.[type.key] ?? 0;
                    const isOverused = usageCount >= 3;
                    return (
                      <button
                        key={type.key}
                        aria-pressed={isActive}
                        aria-label={`${type.label} hook style${isActive ? " (active)" : " (inactive)"}`}
                        onClick={() => {
                          setShuffledHooks(null);
                          setHookTypeFilter(prev => {
                            const next = new Set(prev);
                            if (next.has(type.key)) {
                              if (next.size > 1) next.delete(type.key);
                            } else {
                              next.add(type.key);
                            }
                            return next;
                          });
                        }}
                        className={cn(
                          "flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border-2 transition-all",
                          isActive ? `${type.color} ${type.border}` : "bg-gray-50 text-gray-400 border-gray-100"
                        )}
                      >
                        <span>{type.emoji}</span>
                        <span>{type.label}</span>
                        {isOverused && <span className="ml-0.5 text-orange-500">!</span>}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => {
                      setShuffledHooks(null);
                      setHookTypeFilter(new Set(ALL_HOOK_TYPE_KEYS));
                    }}
                    className="flex-shrink-0 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border-2 border-dashed border-gray-200 text-gray-400 hover:border-primary/40 hover:text-primary transition-all"
                  >
                    All
                  </button>
                </div>
                {(() => {
                  const HOOK_TYPE_LABELS: Record<string, { label: string; color: string }> = {
                    "how-i":          { label: "How I",       color: "bg-violet-100 text-violet-700" },
                    "contrarian":     { label: "Contrarian",  color: "bg-rose-100 text-rose-700" },
                    "number":         { label: "Numbers",     color: "bg-amber-100 text-amber-700" },
                    "question":       { label: "Question",    color: "bg-blue-100 text-blue-700" },
                    "scene-setter":   { label: "Scene",       color: "bg-teal-100 text-teal-700" },
                    "prediction":     { label: "Prediction",  color: "bg-purple-100 text-purple-700" },
                    "analogy":        { label: "Analogy",     color: "bg-orange-100 text-orange-700" },
                    "how-to":         { label: "How To",      color: "bg-sky-100 text-sky-700" },
                    "story":          { label: "Story",       color: "bg-emerald-100 text-emerald-700" },
                    "disarming-joke": { label: "Joke",        color: "bg-yellow-100 text-yellow-700" },
                    "tension-setter": { label: "Tension",     color: "bg-red-100 text-red-700" },
                    "confession":     { label: "Confession",  color: "bg-pink-100 text-pink-700" },
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
                            storyMode: (s.storyMode || newStructure?.archetype === "storytelling") && !s.teacherMode,
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

                  const baseEvergreen = shuffledHooks
                    ? shuffledHooks.map(h => ({ ...h, usedBefore: false } as HookItem))
                    : state.structureResult!.evergreen.hooks;

                  const filteredEvergreen = baseEvergreen.filter(
                    h => !h.type || hookTypeFilter.has(h.type)
                  );

                  const filteredTrending = state.structureResult?.trending?.hooks.filter(
                    h => !h.type || hookTypeFilter.has(h.type)
                  ) ?? [];

                  return (
                    <div className="space-y-5">
                      {/* Evergreen section */}
                      <div>
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                          {shuffledHooks ? "Fresh shuffle" : "Timeless"}
                        </p>
                        <div className="space-y-3">
                          {filteredEvergreen.length > 0
                            ? filteredEvergreen.map((hook, idx) => renderHook(hook, idx, "evergreen"))
                            : <p className="text-xs text-gray-400 text-center py-3">No hooks match the selected styles. Tap a chip above to show more.</p>
                          }
                        </div>
                      </div>
                      {/* Trending section — only show when not in shuffled mode */}
                      {!shuffledHooks && state.structureResult?.trending && filteredTrending.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Based on what's happening now</p>
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          </div>
                          <div className="space-y-3">
                            {filteredTrending.map((hook, idx) =>
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
                  {state.structure.narrativeFlow.map((s, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-full">{s}</span>
                      {i < state.structure!.narrativeFlow.length - 1 && <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 px-6 pb-8 pt-4 bg-gradient-to-t from-gray-50 via-gray-50/90 to-transparent z-10 space-y-2.5">
              {/* Tone dial */}
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Writing energy</p>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {POST_TONES.map(t => (
                    <button
                      key={t.key}
                      onClick={() => setState(s => ({ ...s, postTone: t.key }))}
                      title={t.desc}
                      className={cn(
                        "flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border-2",
                        state.postTone === t.key
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "bg-white text-gray-600 border-gray-200 hover:border-primary/40"
                      )}
                    >
                      <span>{t.emoji}</span> {t.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Post Format picker — hidden when Story Mode or Teacher Mode are active */}
              {!state.storyMode && !state.teacherMode && (
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Post format</p>
                  <div className="grid grid-cols-2 gap-2">
                    {POST_FORMATS.map(f => (
                      <button
                        key={f.key}
                        onClick={() => setState(s => ({ ...s, postFormat: f.key }))}
                        className={cn(
                          "flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-xl text-left transition-all border-2",
                          state.postFormat === f.key
                            ? "bg-primary text-white border-primary shadow-sm"
                            : "bg-white text-gray-600 border-gray-200 hover:border-primary/40"
                        )}
                      >
                        <span className="text-xs font-bold flex items-center gap-1"><span>{f.emoji}</span> {f.label}</span>
                        <span className={cn("text-[10px] leading-tight", state.postFormat === f.key ? "text-white/80" : "text-gray-400")}>{f.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {!state.selectedHook && <p className="text-center text-xs text-gray-400 font-medium">← Tap a hook above to continue</p>}
              <label className="flex items-center gap-2.5 cursor-pointer group">
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
              {([
                ["post", "Post", <PenTool className="w-3 h-3" />],
                ...(state.content?.shortPost ? [["short", "Short", <Zap className="w-3 h-3" />]] : []) as [TabType, string, React.ReactNode][],
                ["carousel", "Slides", <Layout className="w-3 h-3" />],
                ["visual", "Card", <ImageIcon className="w-3 h-3" />],
                ["infographic", "Info", <Sparkles className="w-3 h-3" />],
                ["illustration", "Art", <Sparkles className="w-3 h-3" />],
              ] as const).map(([id, label, icon]) => (
                <button key={id} onClick={() => setState(s => ({ ...s, activeTab: id as TabType }))}
                  className={cn("flex-1 flex items-center justify-center gap-0.5 py-2.5 rounded-lg text-[10px] font-bold transition-all duration-200",
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
                <div className="flex flex-col h-full gap-2">
                  {/* LinkedIn text formatter toolbar */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider mr-1">Format</span>
                    <button
                      onMouseDown={e => { e.preventDefault(); applyPostFormat(toLiBold); }}
                      className="w-8 h-8 flex items-center justify-center font-black text-sm text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 active:scale-95 transition-all select-none"
                      title="Bold (renders on LinkedIn)"
                    >B</button>
                    <button
                      onMouseDown={e => { e.preventDefault(); applyPostFormat(toLiItalic); }}
                      className="w-8 h-8 flex items-center justify-center italic font-semibold text-sm text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 active:scale-95 transition-all select-none"
                      title="Italic (renders on LinkedIn)"
                    >I</button>
                    <button
                      onMouseDown={e => { e.preventDefault(); applyPostFormat(toLiBoldItalic); }}
                      className="w-8 h-8 flex items-center justify-center italic font-black text-sm text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 active:scale-95 transition-all select-none"
                      title="Bold Italic (renders on LinkedIn)"
                    >BI</button>
                    <span className="text-[9px] text-gray-300 ml-1">Select text, then tap</span>
                  </div>
                  {/* Post textarea with copy button */}
                  <div className="relative group flex-1">
                    <textarea
                      ref={postTextareaRef}
                      className="w-full h-full min-h-[300px] p-5 bg-white border border-gray-100 rounded-2xl text-sm outline-none resize-none leading-relaxed text-gray-800 focus:ring-2 focus:ring-primary/20 transition-shadow"
                      value={state.content.post}
                      onChange={e => { setState(s => s.content ? { ...s, content: { ...s.content, post: e.target.value } } : s); setUserEditedPost(true); }}
                    />
                    <button onClick={() => copyToClipboard(state.content!.post)} className="absolute top-3 right-3 p-2 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  {/* Hook optimizer */}
                  {state.content.post.trim().length >= 40 && (
                    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                      <button
                        onClick={() => void handleLoadHooks()}
                        disabled={isLoadingHooks}
                        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                      >
                        {isLoadingHooks ? (
                          <RefreshCw className="w-3.5 h-3.5 text-primary animate-spin flex-shrink-0" />
                        ) : (
                          <Wand2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        )}
                        <span className="text-xs font-bold text-gray-700">
                          {isLoadingHooks ? "Generating hooks..." : "Rewrite opening line →"}
                        </span>
                      </button>
                      {hookAlternatives && hookAlternatives.length > 0 && (
                        <div className="border-t border-gray-100 px-4 pb-3 pt-2 space-y-2">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Pick one to replace your opening line</p>
                          {hookAlternatives.map((hook, i) => (
                            <button
                              key={i}
                              onClick={() => applyHook(hook)}
                              className="w-full text-left p-3 rounded-xl border-2 border-gray-100 hover:border-primary/40 hover:bg-primary/5 transition-all text-sm text-gray-700 leading-snug"
                            >
                              {hook}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Story Arc guide (visible when Story Mode is active) */}
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
              {state.activeTab === "short" && state.content?.shortPost && (() => {
                const assembledShort = [
                  state.content.shortPost,
                  newsUrlParam ? newsUrlParam : null,
                  state.content.hashtags?.trim() ? state.content.hashtags.trim() : null,
                ].filter(Boolean).join("\n\n");
                return (
                <div className="flex flex-col gap-3 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Short post</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        {assembledShort.trim().length} chars
                      </span>
                      <button
                        onClick={() => copyToClipboard(assembledShort)}
                        className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-lg transition-all"
                        title="Copy full post"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <textarea
                    className="w-full min-h-[180px] p-5 bg-white border border-gray-100 rounded-2xl text-sm outline-none resize-none leading-relaxed text-gray-800 focus:ring-2 focus:ring-primary/20 transition-shadow"
                    value={state.content.shortPost}
                    onChange={e => setState(s => s.content ? { ...s, content: { ...s.content, shortPost: e.target.value } } : s)}
                  />
                  {newsUrlParam && (
                    <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl space-y-2">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Appended when you copy</p>
                      <p className="text-xs text-blue-500 break-all leading-relaxed">{newsUrlParam}</p>
                      {state.content.hashtags?.trim() && (
                        <p className="text-xs text-gray-500 leading-relaxed">{state.content.hashtags}</p>
                      )}
                    </div>
                  )}
                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                    <p className="text-xs font-bold text-amber-700 mb-1">Micro-post rules</p>
                    <p className="text-[11px] text-amber-600 leading-relaxed">Gut reaction · Real voice · Emoji OK · Under 120 words</p>
                  </div>
                </div>
                );
              })()}
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
                          <p className="text-[10px] text-gray-400 mt-1.5">Saves as .mp4 · upload directly to LinkedIn</p>
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

              {/* ── INFOGRAPHIC TAB ─────────────────────────────── */}
              {state.activeTab === "infographic" && (
                <div className="space-y-3 pb-6">
                  {!state.content.infographic ? (
                    /* Empty state — draft loaded without infographic data */
                    <div className="bg-white rounded-2xl border border-gray-100 p-8 flex flex-col items-center gap-4 text-center">
                      <Sparkles className="w-8 h-8 text-primary/40" />
                      <div>
                        <p className="text-sm font-bold text-gray-700 mb-1">Generate your infographic</p>
                        <p className="text-xs text-gray-400">We'll extract the key takeaways from your post</p>
                      </div>
                      <button
                        disabled={isRefining}
                        onClick={handleGenerateInfographic}
                        className="px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center gap-2"
                      >
                        {isRefining ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        {isRefining ? "Generating…" : "Generate Infographic"}
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* 1. Headline */}
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Headline</p>
                        <div className="relative group">
                          <input
                            className="w-full px-5 py-4 bg-white border border-gray-100 rounded-2xl text-sm font-bold outline-none text-gray-800 focus:ring-2 focus:ring-primary/20 transition-shadow"
                            value={state.content.infographic.headline}
                            onChange={e => updateInfographicHeadline(e.target.value)}
                            placeholder="Infographic headline…"
                          />
                        </div>
                      </div>

                      {/* 2. Bullets */}
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Key Points</p>
                        <div className="space-y-2">
                          {state.content.infographic.bullets.map((bullet, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-3">
                                {idx + 1}
                              </div>
                              <textarea
                                className="flex-1 px-4 py-3 bg-white border border-gray-100 rounded-2xl text-sm outline-none resize-none leading-relaxed text-gray-700 focus:ring-2 focus:ring-primary/20 transition-shadow"
                                value={bullet}
                                rows={2}
                                onChange={e => updateInfographicBullet(idx, e.target.value)}
                              />
                              {state.content!.infographic!.bullets.length > 2 && (
                                <button
                                  onClick={() => deleteInfographicBullet(idx)}
                                  className="w-5 h-5 flex items-center justify-center rounded-full text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all mt-3 flex-shrink-0"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        {state.content.infographic.bullets.length < 6 && (
                          <button
                            onClick={addInfographicBullet}
                            className="w-full mt-2 py-2.5 rounded-2xl border border-dashed border-primary/30 text-primary/60 text-xs font-bold hover:border-primary/60 hover:text-primary hover:bg-primary/5 transition-all"
                          >
                            + Add point
                          </button>
                        )}
                      </div>

                      {/* 3. Preview */}
                      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider px-4 pt-4 pb-3">Preview</p>
                        {isPreviewingInfographic && (
                          <div className="w-full aspect-square bg-gray-50 flex items-center justify-center pb-4">
                            <RefreshCw className="w-5 h-5 text-gray-300 animate-spin" />
                          </div>
                        )}
                        {infographicPreviewUrl && !isPreviewingInfographic && (
                          <div>
                            <div className="relative">
                              <img src={infographicPreviewUrl} alt="Infographic preview" className="w-full aspect-square object-cover" />
                              <button
                                onClick={handleDownloadInfographic}
                                disabled={isExportingInfographic}
                                className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-2 bg-black/60 hover:bg-black/80 text-white text-xs font-bold rounded-xl backdrop-blur-sm transition-all disabled:opacity-50"
                              >
                                <Download className="w-3.5 h-3.5" />
                                {isExportingInfographic ? "Exporting…" : "Download PNG"}
                              </button>
                            </div>

                            {/* Animated export */}
                            <div className="px-4 pt-3 pb-4">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Animated (.mp4)</p>
                                <div className="flex gap-1">
                                  {([1, 2, 3, 4, 5] as const).map((mult) => (
                                    <button
                                      key={mult}
                                      onClick={() => setAnimSpeedMult(mult)}
                                      className={cn("px-2 py-0.5 rounded text-[10px] font-bold transition-all", animSpeedMult === mult ? "bg-primary text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200")}
                                    >{mult}×</button>
                                  ))}
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                {(["reveal", "fade", "typewriter", "rise", "pop", "wipe"] as InfographicAnimPreset[]).map((preset) => {
                                  const labels: Record<InfographicAnimPreset, string> = { reveal: "Reveal", fade: "Fade", typewriter: "Type", rise: "Rise", pop: "Pop", wipe: "Wipe" };
                                  return (
                                    <button
                                      key={preset}
                                      onClick={() => handleDownloadAnimatedInfographic(preset)}
                                      disabled={!!isAnimatingInfographic}
                                      className={cn(
                                        "py-2.5 rounded-xl text-[11px] font-bold border-2 transition-all flex items-center justify-center gap-1",
                                        isAnimatingInfographic === preset
                                          ? "bg-primary text-white border-primary"
                                          : "bg-white text-gray-700 border-gray-200 hover:border-primary/50 hover:bg-primary/5 disabled:opacity-40"
                                      )}
                                    >
                                      {isAnimatingInfographic === preset ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                                      {isAnimatingInfographic === preset ? "…" : labels[preset]}
                                    </button>
                                  );
                                })}
                              </div>
                              <p className="text-[10px] text-gray-400 mt-1.5">Saves as .mp4 · upload directly to LinkedIn</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 4. Refine buttons */}
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: "Sharper", instruction: "Tighten the headline and each bullet. Make them punchier and more concrete." },
                          { label: "More Specific", instruction: "Replace abstract bullets with specific examples, numbers, or data points." },
                          { label: "More Personal", instruction: "Rewrite bullets to include personal perspective and first-person insight." },
                          { label: "Client-Focused", instruction: "Reframe the headline and bullets toward client outcomes and results they care about." },
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
                          onClick={() => handleRefine("Rewrite the headline and bullets to directly reflect the key insights and core message of the current post. Keep the same bullet count.")}
                          className={cn("w-full py-3 px-3 rounded-xl text-xs font-bold border-2 transition-all flex items-center justify-center gap-2",
                            refiningTab?.startsWith("Rewrite the headline and bullets") ? "bg-primary text-white border-primary" : "bg-primary/5 text-primary border-primary/20 hover:bg-primary/10 disabled:opacity-40")}
                        >
                          <RefreshCw className={cn("w-3.5 h-3.5", refiningTab?.startsWith("Rewrite the headline and bullets") && "animate-spin")} />
                          {refiningTab?.startsWith("Rewrite the headline and bullets") ? "Syncing…" : "Sync to current post"}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── ILLUSTRATION TAB ─────────────────────────────── */}
              {state.activeTab === "illustration" && (
                <div className="space-y-3 pb-6">
                  {/* Style selector */}
                  <div className="bg-white rounded-2xl border border-gray-100 p-4">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-3">Illustration Style</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: "surprise", label: "✨ Surprise Me" },
                        { id: "cartoon", label: "Cartoon" },
                        { id: "new-yorker", label: "Black & White Ink" },
                        { id: "isometric", label: "Isometric" },
                        { id: "sketch", label: "Sketch" },
                        { id: "blueprint", label: "Blueprint" },
                        { id: "vintage", label: "Vintage" },
                      ].map(({ id, label }) => (
                        <button key={id} onClick={() => setIllustStyle(id)}
                          className={cn("px-3.5 py-2 rounded-xl text-xs font-bold transition-all border-2",
                            illustStyle === id
                              ? "bg-primary text-white border-primary"
                              : "bg-white text-gray-600 border-gray-200 hover:border-primary/30")}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ── STEP 1: Craft concept ── */}
                  {!illustConcept && !isGeneratingIllustConcept && (
                    <>
                      <Button className="w-full h-12 font-semibold group" onClick={handleCraftIllustConcept}>
                        <Sparkles className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                        Generate Concept
                      </Button>
                      <div className="flex flex-col items-center justify-center py-8 gap-3">
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                          <Sparkles className="w-6 h-6 text-gray-300" />
                        </div>
                        <p className="text-sm text-gray-400 text-center leading-relaxed">
                          Pick a style, generate a concept,<br />edit the scene, then render
                        </p>
                      </div>
                    </>
                  )}

                  {isGeneratingIllustConcept && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                      </div>
                      <p className="text-sm font-semibold text-gray-700 text-center">Generating concept & caption...</p>
                    </div>
                  )}

                  {/* ── STEP 2: Edit concept + generate image ── */}
                  {illustConcept && !isGeneratingIllustConcept && (
                    <>
                      {illustConcept && (
                        <div className="flex items-center gap-2 px-1">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Style</span>
                          <span className="px-2.5 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full">
                            {illustConcept.chosenStyle}
                          </span>
                          <button onClick={handleCraftIllustConcept} disabled={isGeneratingIllustImage}
                            className="ml-auto text-[10px] font-bold text-gray-400 hover:text-primary transition-colors disabled:opacity-40 flex items-center gap-1">
                            <RefreshCw className="w-3 h-3" /> New concept
                          </button>
                        </div>
                      )}

                      <div className="bg-white rounded-2xl border border-gray-100 p-4">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Scene</p>
                        <textarea
                          value={illustScenePrompt}
                          onChange={e => setIllustScenePrompt(e.target.value)}
                          rows={3}
                          className="w-full text-sm text-gray-800 bg-transparent outline-none resize-none leading-relaxed placeholder:text-gray-300"
                          placeholder="Describe the scene to illustrate..."
                        />
                      </div>

                      <div className="bg-white rounded-2xl border border-gray-100 p-4">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Caption</p>
                        <textarea
                          value={illustCaption}
                          onChange={e => setIllustCaption(e.target.value)}
                          rows={2}
                          className="w-full text-sm text-gray-800 bg-transparent outline-none resize-none leading-relaxed placeholder:text-gray-300"
                          placeholder="Edit caption..."
                        />
                      </div>

                      {!isGeneratingIllustImage && !isPreviewingIllustration && (
                        <Button className="w-full h-12 font-semibold group" onClick={handleGenerateIllustImage}
                          disabled={!illustScenePrompt.trim()}>
                          <Sparkles className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                          {illustPreviewUrl ? "Re-render Image" : "Generate Image"}
                        </Button>
                      )}

                      {(isGeneratingIllustImage || isPreviewingIllustration) && (
                        <div className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                          </div>
                          <p className="text-sm font-semibold text-gray-700 text-center">
                            {isGeneratingIllustImage ? "Rendering illustration..." : "Building preview..."}
                          </p>
                          {isGeneratingIllustImage && (
                            <p className="text-xs text-gray-400 text-center">This takes ~30 s — worth the wait!</p>
                          )}
                        </div>
                      )}

                      {/* Preview */}
                      {(illustPreviewUrl || isPreviewingIllustration) && (
                        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider px-4 pt-4 pb-3">Preview</p>
                          {isPreviewingIllustration && !illustPreviewUrl && (
                            <div className="w-full bg-gray-50 flex items-center justify-center pb-6" style={{ aspectRatio: "4/5" }}>
                              <RefreshCw className="w-5 h-5 text-gray-300 animate-spin" />
                            </div>
                          )}
                          {illustPreviewUrl && (
                            <div className="relative">
                              <img src={illustPreviewUrl} alt="Illustration preview" className="w-full" style={{ aspectRatio: "4/5", objectFit: "cover" }} />
                              {isPreviewingIllustration && (
                                <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                                  <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Download + animate (only after image exists) */}
                      {illustPreviewUrl && !isGeneratingIllustImage && !isPreviewingIllustration && (
                        <>
                          <div className="flex gap-2">
                            <button onClick={handleDownloadIllustrationCard}
                              disabled={isExportingIllust || isAnimatingIllust !== null}
                              className="flex-1 py-3 text-xs font-bold text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 rounded-xl border border-primary/20 flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all"
                            >
                              <Download className="w-3.5 h-3.5" />
                              {isExportingIllust ? "Saving…" : "Download PNG"}
                            </button>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Animated (.mp4)</p>
                              <div className="flex gap-1">
                                {([1, 2, 3, 4, 5] as const).map((mult) => (
                                  <button key={mult} onClick={() => setAnimSpeedMult(mult)}
                                    className={cn("px-2 py-0.5 rounded text-[10px] font-bold transition-all",
                                      animSpeedMult === mult ? "bg-primary text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200")}
                                  >{mult}×</button>
                                ))}
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              {(["draw", "reveal", "pop"] as IllustrationAnimPreset[]).map(preset => (
                                <button key={preset} disabled={!!isAnimatingIllust || isExportingIllust}
                                  onClick={() => handleDownloadAnimatedIllustration(preset)}
                                  className={cn(
                                    "py-3 rounded-xl text-xs font-bold border-2 transition-all flex items-center justify-center gap-1",
                                    isAnimatingIllust === preset
                                      ? "bg-primary text-white border-primary"
                                      : "bg-white text-gray-700 border-gray-200 hover:border-primary/50 hover:bg-primary/5 disabled:opacity-40"
                                  )}
                                >
                                  {isAnimatingIllust === preset
                                    ? <RefreshCw className="w-3 h-3 animate-spin" />
                                    : <Download className="w-3 h-3" />}
                                  {isAnimatingIllust === preset ? "…" : preset === "draw" ? "Ink" : preset === "reveal" ? "Reveal" : "Pop"}
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-3">
              {/* Length-switch strip */}
              {(state.activeTab === "post" || state.activeTab === "short" || state.activeTab === "carousel") && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Regenerate as</p>
                  <div className="flex gap-1.5">
                    {([
                      { key: "short", label: "✂️ Short", tone: "Snappy" as PostToneKey, story: false },
                      { key: "medium", label: "📝 Medium", tone: (state.postTone === "Snappy" ? (preferences?.tone ?? "Direct") : state.postTone) as PostToneKey, story: false },
                      { key: "long", label: "📖 Long story", tone: (state.postTone === "Snappy" ? (preferences?.tone ?? "Direct") : state.postTone) as PostToneKey, story: true },
                    ] as { key: string; label: string; tone: PostToneKey; story: boolean }[]).map(opt => {
                      const isActive =
                        (opt.key === "short" && state.postTone === "Snappy" && !state.storyMode) ||
                        (opt.key === "medium" && state.postTone !== "Snappy" && !state.storyMode) ||
                        (opt.key === "long" && state.storyMode);
                      return (
                        <button
                          key={opt.key}
                          disabled={isRefining || isGenerating || isActive}
                          onClick={() => {
                            if (!state.structure || !state.selectedHook) return;
                            const newTone = opt.tone;
                            const newStory = opt.story;
                            const newTeacher = newStory ? false : state.teacherMode;
                            resetGenerate();
                            setHookAlternatives(null);
                            setState(s => ({ ...s, postTone: newTone, storyMode: newStory, teacherMode: newTeacher, content: null, step: 4 }));
                            generateContent(
                              { data: { rawInput: state.rawInput, objective: state.objective, persona: state.persona, tone: state.tone, structure: state.structure, selectedHook: state.selectedHook, includeCta, storyMode: newStory, postTone: newTone, teacherMode: newTeacher, newsUrl: newsUrlParam || undefined } },
                              { onSuccess: (data) => {
                                  const defaultTab: TabType = newTone === "Snappy" && data.shortPost ? "short" : newStory ? "carousel" : "post";
                                  setState(s => ({ ...s, content: data, activeTab: defaultTab }));
                                  setImagePrompt("");
                                  setGeneratedImageBase64(null);
                                  setUserEditedPost(false);
                                }
                              }
                            );
                          }}
                          className={cn(
                            "flex-1 py-2 rounded-xl text-[11px] font-bold border-2 transition-all",
                            isActive
                              ? "bg-primary text-white border-primary"
                              : "bg-white text-gray-600 border-gray-200 hover:border-primary/50 disabled:opacity-40"
                          )}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {state.activeTab !== "visual" && state.activeTab !== "infographic" && state.activeTab !== "illustration" && (
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
    <AppShell contentClassName="relative">
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

    </AppShell>
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
