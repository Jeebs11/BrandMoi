import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useSearch, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  Sparkles, ChevronLeft, RefreshCw, Copy, Save, Newspaper,
  Image as ImageIcon, Layout, BarChart3, PenTool, Wand2,
  ArrowDown, ArrowUp, BookOpen, Check, Layers, Target, CheckCircle2,
} from "lucide-react";
import { BrandReviewPanel } from "@/components/BrandReviewPanel";
import { PostMeter } from "@/components/PostMeter";
import { agentApi, analyticsApi, seriesApi, type BrandReviewRecommendation, type BrandReviewResult, type SeriesDetail } from "@/lib/api";
import {
  useGenerateContent, useRefineContent,
  useCreateDraft, useUpdateDraft, useGetDraft, getGetDraftQueryKey,
  useExploreDirections, useGetPerformanceInsights,
} from "@workspace/api-client-react";
import type {
  GeneratedContent, CarouselSlide, StructuredBreakdown, InfographicData,
  CreateDraftBodyContentSource, DirectionConcept,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { GenerationLoader } from "@/components/ui/skeleton";
import { AppShell } from "@/components/AppShell";
import { usePageTour } from "@/components/tour/usePageTour";
import { CAPTURE_TOUR_STEPS } from "@/components/tour/page-tours";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { imageGenApi, illustrationConceptApi } from "@/lib/api";
import { applyBrandClosing, removeBrandClosing, type BrandClosingMode, type BrandClosingStyle } from "@/lib/brand-closing";
import { downloadCarouselPDF } from "@/lib/export-carousel";
import { downloadVisualCard } from "@/lib/export-visual-card";
import { downloadInfographic } from "@/lib/export-infographic";
import { downloadIllustrationCard } from "@/lib/export-illustration";
import { trackEvent } from "@/lib/analytics";
import {
  type AuthenticityFeedback,
  type AuthenticityReview,
} from "@/components/AuthenticityReviewDialog";

// ── Constants ───────────────────────────────────────────────────────────────

export const AUDIENCES = [
  { key: "Clients", emoji: "🤝", desc: "Future buyers and prospects" },
  { key: "Peers", emoji: "👥", desc: "Operators in your field" },
  { key: "Recruiters & Headhunters", emoji: "🎯", desc: "Hiring managers and recruiters" },
  { key: "Investors", emoji: "💼", desc: "VCs, angels, capital allocators" },
  { key: "My audience", emoji: "🌍", desc: "Mixed crowd already following you" },
] as const;

export const FEELINGS = [
  { key: "Direct", emoji: "🎯", desc: "Clear, authoritative, no fluff" },
  { key: "Witty", emoji: "😏", desc: "Dry, self-aware, human" },
  { key: "Vulnerable", emoji: "💙", desc: "Personal, honest, open" },
  { key: "Story", emoji: "📖", desc: "Opens with a vivid scene" },
  { key: "Contrarian", emoji: "⚡", desc: "Challenges conventional wisdom" },
] as const;

const VISUAL_STYLES = [
  { key: "cartoon", label: "Cartoon" },
  { key: "new-yorker", label: "New Yorker" },
  { key: "isometric", label: "Isometric" },
  { key: "loose-pencil", label: "Loose Pencil" },
] as const;

type TabType = "post" | "short" | "carousel" | "visual" | "infographic" | "illustration";

const TABS: Array<{ key: TabType; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: "post", label: "Post", icon: PenTool },
  { key: "short", label: "Short", icon: Sparkles },
  { key: "carousel", label: "Carousel", icon: Layout },
  { key: "visual", label: "Visual", icon: ImageIcon },
  { key: "infographic", label: "Infographic", icon: BarChart3 },
  { key: "illustration", label: "Illustration", icon: Wand2 },
];

// Map persisted-draft objective → audience chip (mirrors backend normalizeDraft).
function audienceFromObjective(objective?: string | null): string {
  if (!objective) return "My audience";
  const o = objective.toLowerCase().trim();
  // "Hiring" means the user is recruiting (their own audience) — NOT the same as Recruiters.
  if (o === "hiring") return "My audience";
  if (o.includes("client")) return "Clients";
  if (o.includes("job") || o.includes("recruit") || o.includes("hire")) return "Recruiters & Headhunters";
  if (o.includes("invest")) return "Investors";
  if (o.includes("authority") || o.includes("expert") || o.includes("peer")) return "Peers";
  return "My audience";
}

function feelingFromTone(tone?: string | null, storyMode?: boolean): string {
  if (storyMode) return "Story";
  if (!tone) return "Direct";
  const t = tone.toLowerCase();
  if (t.includes("playful") || t.includes("witty")) return "Witty";
  if (t.includes("vulnerab")) return "Vulnerable";
  if (t.includes("contrarian")) return "Contrarian";
  if (t.includes("story")) return "Story";
  return "Direct";
}

// Deterministically stamps a series' recurring hook onto a generated part so
// every part carries the exact same recognisable marker — not left to the
// model's phrasing. Hashtag-shaped hooks (#Foo) are appended to the hashtags
// field; anything else (a tagline/emoji motif) is prepended as the post's
// opening line.
function applySeriesHook(post: string, hashtags: string, hook: string): { post: string; hashtags: string } {
  const trimmedHook = hook.trim();
  if (!trimmedHook) return { post, hashtags };
  if (trimmedHook.startsWith("#")) {
    if (hashtags.includes(trimmedHook)) return { post, hashtags };
    return { post, hashtags: [hashtags, trimmedHook].filter(Boolean).join(" ") };
  }
  if (post.startsWith(trimmedHook)) return { post, hashtags };
  return { post: `${trimmedHook}\n\n${post}`, hashtags };
}

// Map audience → legacy objective field for the drafts table.
function objectiveFromAudience(audience: string): string {
  switch (audience) {
    case "Clients": return "Clients";
    case "Recruiters & Headhunters": return "Job";
    case "Investors": return "Authority";
    case "Peers": return "Authority";
    default: return "Documenting";
  }
}

function toneFromFeeling(feeling: string): string {
  switch (feeling) {
    case "Witty": return "Witty";
    case "Vulnerable": return "Vulnerable";
    case "Contrarian": return "Contrarian";
    case "Story": return "Story";
    default: return "Direct";
  }
}

const LINKEDIN_COMPOSER_URL = "https://www.linkedin.com/feed/?shareActive=true";

type PublishStatus = {
  text: string;
  copy: "checking" | "copied" | "failed";
  linkedIn: "opened" | "blocked";
};

async function copyTextWithFallback(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Some browsers deny Clipboard API access in embedded previews. Try the
    // older user-gesture-based route before reporting a failure.
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  } catch {
    return false;
  }
}

function composeLinkedInText(post: string, hashtags: string): string {
  const postText = post.trimEnd();
  const hashtagText = hashtags.trim();
  return [postText, hashtagText].filter(Boolean).join("\n\n");
}

// ── Component ───────────────────────────────────────────────────────────────

export default function Capture() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const draftIdParam = params.get("draftId");
  const draftId = draftIdParam ? parseInt(draftIdParam) : null;
  const thoughtParam = params.get("thought") ?? "";
  const rawParam = params.get("raw") ?? "";
  const newsUrlParam = params.get("newsUrl") ?? "";
  // Set by audience-tagged idea suggestions (e.g. a Recruiters-targeted brand
  // angle) so tapping "Write this" opens Capture pre-set to that audience.
  const audienceParam = params.get("audience") ?? "";
  // Set when writing a part of a planned series (from the Series detail page).
  const seriesIdParam = params.get("seriesId");
  const seriesId = seriesIdParam ? parseInt(seriesIdParam) : null;
  const seriesPartParam = params.get("seriesPart");
  const seriesPart = seriesPartParam ? parseInt(seriesPartParam) : null;
  const topicIdParam = params.get("topicId");
  const topicId = topicIdParam ? parseInt(topicIdParam) : null;
  // A recurring tag/tagline set on the series (e.g. "#JuniorPMDiaries") so every
  // part carries the same recognisable marker — deterministic, not left to the
  // model's discretion, since consistency across parts matters more here than
  // natural-language phrasing.
  const seriesHookParam = params.get("seriesHook") ?? "";

  const { user, preferences } = useAuth();
  const isDemo = user?.email === "demo@brandos.app";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── State ────────────────────────────────────────────────────────────────
  const [rawInput, setRawInput] = useState<string>(thoughtParam || rawParam || "");
  const [audience, setAudience] = useState<string>(
    AUDIENCES.some((a) => a.key === audienceParam) ? audienceParam : audienceFromObjective(preferences?.objective)
  );
  const [feeling, setFeeling] = useState<string>(feelingFromTone(preferences?.tone));
  const [tieToNews, setTieToNews] = useState<boolean>(!!newsUrlParam);
  const [content, setContent] = useState<GeneratedContent | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("post");
  const [editedPost, setEditedPost] = useState<string>("");
  const [hashtags, setHashtags] = useState<string>("");
  const [aiOriginalPost, setAiOriginalPost] = useState<string>("");
  const [brandClosingMode, setBrandClosingMode] = useState<BrandClosingMode>("never");
  const [brandClosingStyle, setBrandClosingStyle] = useState<BrandClosingStyle>("expert");
  const [brandClosingText, setBrandClosingText] = useState<string>("");
  const [brandClosingApplied, setBrandClosingApplied] = useState(false);
  // Version history — every AI-produced version of the Post is snapshotted so
  // the user can flip back to a different tone / opener / length. In-memory
  // for the editing session; manual typing isn't snapshotted (too noisy).
  const [versions, setVersions] = useState<Array<{ id: number; label: string; post: string; hashtags: string }>>([]);
  const versionSeq = useRef(0);
  const addVersion = (label: string, post: string, tags: string) => {
    if (!post.trim()) return;
    setVersions((prev) => {
      if (prev.some((v) => v.post === post)) return prev; // skip exact dupes
      const next = [...prev, { id: ++versionSeq.current, label, post, hashtags: tags }];
      return next.slice(-12); // keep the last 12
    });
  };
  const [savedDraftId, setSavedDraftId] = useState<number | null>(draftId);
  const [initialized, setInitialized] = useState(false);
  const [visualStyle, setVisualStyle] = useState<string>("new-yorker");
  const [visualImage, setVisualImage] = useState<string | null>(null);
  const [illustrationCaption, setIllustrationCaption] = useState<string>("");
  const [illustrationScene, setIllustrationScene] = useState<string>("");
  const [illustrationImage, setIllustrationImage] = useState<string | null>(null);
  const [isLoadingVisual, setIsLoadingVisual] = useState(false);
  const [isLoadingIllustration, setIsLoadingIllustration] = useState(false);
  const downloadedVisualRef = useRef<string | null>(null);
  const [brandReviewOpen, setBrandReviewOpen] = useState(false);
  const [brandReviewResult, setBrandReviewResult] = useState<BrandReviewResult | null>(null);
  const [brandReviewEvidence, setBrandReviewEvidence] = useState<AuthenticityReview>(null);
  const [brandReviewReviewedPost, setBrandReviewReviewedPost] = useState<string | null>(null);
  const [brandReviewCachedAt, setBrandReviewCachedAt] = useState<string | null>(null);
  const [brandReviewIsForPublish, setBrandReviewIsForPublish] = useState(false);
  const [isBrandReviewLoading, setIsBrandReviewLoading] = useState(false);
  const [isApplyingBrandReviewId, setIsApplyingBrandReviewId] = useState<string | null>(null);
  const [pendingBrandChange, setPendingBrandChange] = useState<{ recommendation: BrandReviewRecommendation; content: string } | null>(null);
  const [isCheckingAuthenticity, setIsCheckingAuthenticity] = useState(false);
  const [authenticityFeedback, setAuthenticityFeedback] = useState<AuthenticityFeedback>(null);
  const [isSavingAuthenticityFeedback, setIsSavingAuthenticityFeedback] = useState(false);
  const [publishStatus, setPublishStatus] = useState<PublishStatus | null>(null);

  // ── Series context (banner + continuity for prompt) ────────────────────
  const [seriesDetail, setSeriesDetail] = useState<SeriesDetail | null>(null);
  useEffect(() => {
    if (!seriesId) return;
    seriesApi.get(seriesId).then(setSeriesDetail).catch(() => {});
  }, [seriesId]);

  // Prior parts' post excerpts, woven into generation as continuity context
  // so a later part builds on what's already been written (same "extra
  // context block" pattern used for news context on the backend).
  const continuityContext = useMemo(() => {
    if (!seriesDetail || !seriesPart) return "";
    const priorParts = seriesDetail.parts
      .filter((p) => p.seriesPart !== null && p.seriesPart < seriesPart && p.postOutput)
      .sort((a, b) => (a.seriesPart ?? 0) - (b.seriesPart ?? 0));
    if (priorParts.length === 0) return "";
    return priorParts
      .map((p) => `Part ${p.seriesPart}: ${(p.postOutput ?? "").slice(0, 400)}`)
      .join("\n\n");
  }, [seriesDetail, seriesPart]);

  const { mutate: generateContent, isPending: isGenerating, error: generateError } = useGenerateContent();
  const { mutate: refineContent, isPending: isRefining } = useRefineContent();
  const { mutate: createDraft, mutateAsync: createDraftAsync, isPending: isCreating } = useCreateDraft();
  const { mutate: updateDraft, isPending: isUpdating } = useUpdateDraft();
  const isSaving = isCreating || isUpdating;

  // ── Load draft if ?draftId= ─────────────────────────────────────────────
  const { data: existingDraft } = useGetDraft(draftId ?? 0, {
    query: { enabled: !!draftId, staleTime: 0, queryKey: getGetDraftQueryKey(draftId ?? 0) },
  });

  useEffect(() => {
    if (existingDraft && !initialized) {
      const sb = existingDraft.structuredBreakdown as StructuredBreakdown & { audience?: string; feeling?: string; storyMode?: boolean };
      setRawInput(existingDraft.rawInput);
      setAudience(sb?.audience ?? audienceFromObjective(existingDraft.objective));
      setFeeling(sb?.feeling ?? feelingFromTone(existingDraft.tone, sb?.storyMode));
      if (existingDraft.postOutput || existingDraft.carouselOutput || existingDraft.visualOutput) {
        const carousel: CarouselSlide[] = existingDraft.carouselOutput
          ? (JSON.parse(existingDraft.carouselOutput) as CarouselSlide[])
          : [];
        const persistedHashtags = (sb as { hashtags?: string })?.hashtags ?? "";
        const restored: GeneratedContent = {
          post: existingDraft.postOutput ?? "",
          shortPost: existingDraft.shortPost ?? "",
          carousel,
          visual: existingDraft.visualOutput ?? "",
          infographic: (sb as { infographic?: InfographicData })?.infographic ?? null,
          hashtags: persistedHashtags,
          alternativeHooks: (sb as { alternativeHooks?: string[] })?.alternativeHooks ?? [],
        };
        setContent(restored);
        setEditedPost(restored.post);
        setHashtags(persistedHashtags);
        setAiOriginalPost(existingDraft.aiOriginalPost ?? "");
        const savedClosing = (sb as {
          brandClosing?: { enabled?: boolean; mode?: BrandClosingMode; style?: BrandClosingStyle; text?: string };
        }).brandClosing;
        if (savedClosing) {
          if (savedClosing.mode === "always" || savedClosing.mode === "smart" || savedClosing.mode === "never") setBrandClosingMode(savedClosing.mode);
          if (savedClosing.style === "signature" || savedClosing.style === "follow" || savedClosing.style === "expert" || savedClosing.style === "custom") setBrandClosingStyle(savedClosing.style);
          if (typeof savedClosing.text === "string") setBrandClosingText(savedClosing.text);
          setBrandClosingApplied(savedClosing.enabled === true);
        }
      }
      setSavedDraftId(existingDraft.id);
      setAuthenticityFeedback((existingDraft.authenticityFeedback as AuthenticityFeedback | undefined) ?? null);
      if (existingDraft.brandReview) {
        setBrandReviewResult(existingDraft.brandReview.result);
        setBrandReviewEvidence(existingDraft.brandReview.authenticityCheck);
        setBrandReviewReviewedPost(existingDraft.brandReview.reviewedPost);
        setBrandReviewCachedAt(existingDraft.brandReview.cachedAt);
      }
      setInitialized(true);
    }
  }, [existingDraft, initialized]);

  useEffect(() => {
    if (existingDraft || content || !preferences) return;
    const next = preferences as typeof preferences & {
      brandClosingMode?: string;
      brandClosingStyle?: string;
      brandClosingText?: string;
    };
    if (next.brandClosingMode === "always" || next.brandClosingMode === "smart" || next.brandClosingMode === "never") setBrandClosingMode(next.brandClosingMode);
    if (next.brandClosingStyle === "signature" || next.brandClosingStyle === "follow" || next.brandClosingStyle === "expert" || next.brandClosingStyle === "custom") setBrandClosingStyle(next.brandClosingStyle);
    if (typeof next.brandClosingText === "string") setBrandClosingText(next.brandClosingText);
  }, [preferences, existingDraft, content]);

  // ── Generate (initial Make-it / Try a different angle) ─────────────────
  const runGenerate = (overrides?: { extraInstruction?: string; feeling?: string; audience?: string; rawInput?: string }) => {
    const effectiveRawInput = overrides?.rawInput ?? rawInput;
    if (!effectiveRawInput.trim()) {
      toast({ title: "Add an idea first", description: "Tell us what you want to say.", variant: "destructive" });
      return;
    }
    const effectiveAudience = overrides?.audience ?? audience;
    const effectiveFeeling = overrides?.feeling ?? feeling;
    trackEvent("content_generation_started", {
      audience: effectiveAudience,
      feeling: effectiveFeeling,
      tie_to_news: tieToNews,
      has_series: Boolean(seriesDetail),
    });
    generateContent(
      {
        data: {
          rawInput: effectiveRawInput,
          audience: effectiveAudience,
          feeling: effectiveFeeling,
          tieToNews,
          ...(newsUrlParam ? { newsUrl: newsUrlParam } : {}),
          ...(overrides?.extraInstruction ? { extraInstruction: overrides.extraInstruction } : {}),
          ...(seriesDetail ? { format: seriesDetail.format } : {}),
          ...(continuityContext ? { continuityContext } : {}),
          // legacy fields kept for backend safety
          objective: objectiveFromAudience(effectiveAudience),
          persona: preferences?.persona ?? "Founder",
          tone: toneFromFeeling(effectiveFeeling),
        },
      },
      {
        onSuccess: (data) => {
          const { post: hookedPost, hashtags: hookedHashtags } = seriesPart && seriesHookParam
            ? applySeriesHook(data.post, data.hashtags ?? "", seriesHookParam)
            : { post: data.post, hashtags: data.hashtags ?? "" };
          const withClosing = applyBrandClosing(hookedPost, brandClosingMode, brandClosingText);
          setAiOriginalPost(hookedPost);
          setBrandClosingApplied(withClosing.applied);
          setContent({ ...data, post: withClosing.post, hashtags: hookedHashtags });
          setEditedPost(withClosing.post);
          setHashtags(hookedHashtags);
          addVersion(versions.length === 0 ? `${effectiveFeeling} · original` : effectiveFeeling, withClosing.post, hookedHashtags);
          setActiveTab("post");
          setVisualImage(null);
          setIllustrationImage(null);
          setIllustrationCaption("");
          setIllustrationScene("");
          downloadedVisualRef.current = null;
           trackEvent("content_generated", {
             audience: effectiveAudience,
             feeling: effectiveFeeling,
             tie_to_news: tieToNews,
             has_series: Boolean(seriesDetail),
           });
        },
        onError: (err) => {
           trackEvent("content_generation_failed", {
             audience: effectiveAudience,
             feeling: effectiveFeeling,
             tie_to_news: tieToNews,
           });
          toast({ title: "Couldn't generate", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" });
        },
      }
    );
  };

  // ── Refine: Shorter / Longer / Story / freeform ───────────────────────
  const runRefine = (instruction: string, tab: TabType = "post", label?: string) => {
    if (!content) return;
    const source =
      tab === "short" ? (content.shortPost ?? "") :
      tab === "carousel" ? JSON.stringify(content.carousel ?? []) :
      tab === "visual" ? (content.visual ?? "") :
      tab === "infographic" ? JSON.stringify(content.infographic ?? {}) :
      (brandClosingApplied ? removeBrandClosing(editedPost, brandClosingText) : editedPost);
    refineContent(
      { data: { content: source, instruction, tab } },
      {
        onSuccess: (data) => {
          const refined = data.content ?? "";
          if (tab === "post") {
            const refinedPost = brandClosingApplied
              ? applyBrandClosing(refined, "always", brandClosingText).post
              : refined;
            setEditedPost(refinedPost);
            setContent((c) => c ? { ...c, post: refinedPost } : c);
            addVersion(label ?? "Refined", refinedPost, hashtags);
          } else if (tab === "short") {
            setContent((c) => c ? { ...c, shortPost: refined } : c);
          } else if (tab === "visual") {
            setContent((c) => c ? { ...c, visual: refined } : c);
            setVisualImage(null);
          } else if (tab === "carousel") {
            try {
              const parsed = JSON.parse(refined || "[]") as CarouselSlide[];
              setContent((c) => c ? { ...c, carousel: parsed } : c);
            } catch { /* ignore */ }
          } else if (tab === "infographic") {
            try {
              const parsed = JSON.parse(refined || "{}") as InfographicData;
              setContent((c) => c ? { ...c, infographic: parsed } : c);
            } catch { /* ignore */ }
          }
        },
        onError: (err) => {
          toast({ title: "Refine failed", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" });
        },
      }
    );
  };

  // ── Swap alternative hook into post ────────────────────────────────────
  const swapHook = (newHook: string) => {
    if (!content) return;
    const lines = editedPost.split("\n");
    if (lines.length === 0) return;
    lines[0] = newHook;
    const updated = lines.join("\n");
    setEditedPost(updated);
    setContent((c) => c ? { ...c, post: updated } : c);
    addVersion("New opener", updated, hashtags);
  };

  // ── Save / update draft ───────────────────────────────────────────────
  const buildStructuredBreakdown = (): StructuredBreakdown & Record<string, unknown> => {
    const existing = (existingDraft?.structuredBreakdown as Record<string, unknown> | undefined) ?? {};
    // The save schema treats newsAnchor.url/sourceLine as optional strings (not
    // nullable) — sending null fails validation. Drop null/empty fields so a
    // news anchor with no URL still saves.
    const rawAnchor = content?.newsAnchor;
    const cleanAnchor = rawAnchor && rawAnchor.headline
      ? {
          headline: rawAnchor.headline,
          ...(rawAnchor.url ? { url: rawAnchor.url } : {}),
          ...(rawAnchor.sourceLine ? { sourceLine: rawAnchor.sourceLine } : {}),
        }
      : undefined;
    // Title = the post's actual hook (first line of the final edited text),
    // so edits to the post are reflected in Library/Studio titles. Falls back
    // to the raw idea only before any post exists.
    const hookLine = editedPost.split("\n").map((l) => l.trim()).find((l) => l.length > 0);
    return {
      ...existing,
      topic: (hookLine ?? rawInput).slice(0, 100),
      angle: feeling,
      coreMessage: rawInput,
      whyItMatters: "",
      hooks: content?.alternativeHooks?.map((h) => ({ text: h })) ?? [],
      narrativeFlow: [],
      proofPoints: [],
      audience,
      feeling,
      hashtags,
      objective: objectiveFromAudience(audience),
      persona: preferences?.persona ?? "Founder",
      tone: toneFromFeeling(feeling),
      alternativeHooks: content?.alternativeHooks ?? [],
      newsAnchor: cleanAnchor,
      infographic: content?.infographic ?? null,
      brandClosing: {
        enabled: brandClosingApplied && !!brandClosingText.trim() && editedPost.toLocaleLowerCase().endsWith(brandClosingText.trim().toLocaleLowerCase()),
        mode: brandClosingMode,
        style: brandClosingStyle,
        text: brandClosingText.trim(),
      },
    } as StructuredBreakdown & Record<string, unknown>;
  };

  // Shared across save payloads so a part always carries its series/topic tags.
  const seriesFields = {
    ...(topicId ? { topicId } : {}),
    ...(seriesId ? { seriesId } : {}),
    ...(seriesPart ? { seriesPart } : {}),
  };

  const handleSave = () => {
    if (!content) {
      toast({ title: "Nothing to save yet", variant: "destructive" });
      return;
    }
    const payload = {
      rawInput,
      objective: objectiveFromAudience(audience),
      persona: preferences?.persona ?? "Founder",
      tone: toneFromFeeling(feeling),
      structuredBreakdown: buildStructuredBreakdown() as StructuredBreakdown,
      postOutput: editedPost,
      aiOriginalPost: versions[0]?.post ?? null,
      shortPost: content.shortPost ?? "",
      carouselOutput: JSON.stringify(content.carousel ?? []),
      visualOutput: content.visual ?? "",
      status: "draft" as const,
      visualStyle,
      contentSource: "capture" as CreateDraftBodyContentSource,
      authenticityFeedback,
      ...seriesFields,
    };
    if (savedDraftId) {
      updateDraft(
        { id: savedDraftId, data: payload },
        {
          onSuccess: () => {
            toast({ title: "Saved", description: "Draft updated." });
            trackEvent("draft_saved", { status: "draft", updated: true });
            void queryClient.invalidateQueries({ queryKey: getGetDraftQueryKey(savedDraftId) });
          },
          onError: (err) => toast({ title: "Save failed", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" }),
        }
      );
    } else {
      createDraft(
        { data: payload },
        {
          onSuccess: (newDraft) => {
            setSavedDraftId(newDraft.id);
            toast({ title: "Saved", description: "Draft created." });
            trackEvent("draft_saved", { status: "draft", updated: false });
          },
          onError: (err) => toast({ title: "Save failed", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" }),
        }
      );
    }
  };

  // Best-time hint shown after shipping — reuses analytics the user already has.
  const showBestTimeHint = () => {
    analyticsApi.overview(90).then((a) => {
      const combo = a.bestTimeToPost?.topCombination;
      if (combo?.day && combo?.block) {
        toast({ title: `💡 Your ${combo.day} ${combo.block.toLowerCase()} posts perform best — worth timing the next one.` });
      }
    }).catch(() => {});
  };

  const buildDraftPayload = (status: "draft" | "published") => ({
    rawInput,
    objective: objectiveFromAudience(audience),
    persona: preferences?.persona ?? "Founder",
    tone: toneFromFeeling(feeling),
    structuredBreakdown: buildStructuredBreakdown() as StructuredBreakdown,
    postOutput: editedPost,
    aiOriginalPost: aiOriginalPost || versions[0]?.post || null,
    shortPost: content?.shortPost ?? "",
    carouselOutput: JSON.stringify(content?.carousel ?? []),
    visualOutput: content?.visual ?? "",
    status,
    visualStyle,
    contentSource: "capture" as CreateDraftBodyContentSource,
    authenticityFeedback,
    ...seriesFields,
  });

  const handleAuthenticityFeedback = (nextFeedback: AuthenticityFeedback) => {
    const previous = authenticityFeedback;
    setAuthenticityFeedback(nextFeedback);
    if (!savedDraftId) return;
    setIsSavingAuthenticityFeedback(true);
    updateDraft(
      { id: savedDraftId, data: { authenticityFeedback: nextFeedback } },
      {
        onSuccess: () => {
          setIsSavingAuthenticityFeedback(false);
          toast({ title: nextFeedback ? "Voice preference saved" : "Voice preference cleared" });
        },
        onError: () => {
          setAuthenticityFeedback(previous);
          setIsSavingAuthenticityFeedback(false);
          toast({ title: "Couldn't save voice preference", variant: "destructive" });
        },
      },
    );
  };

  const handleBrandClosingToggle = (enabled: boolean) => {
    if (!brandClosingText.trim()) {
      toast({ title: "Add a Brand Closing in Settings first.", variant: "destructive" });
      return;
    }
    const next = enabled
      ? applyBrandClosing(editedPost, "always", brandClosingText).post
      : removeBrandClosing(editedPost, brandClosingText);
    setBrandClosingApplied(enabled);
    setEditedPost(next);
    setContent((current) => current ? { ...current, post: next } : current);
  };

  const completePublish = () => {
    if (!content) {
      toast({ title: "Nothing to save yet", variant: "destructive" });
      return;
    }

    // This is the explicit action from the review panel, so opening a tab still
    // occurs synchronously and is less likely to be blocked by the browser.
    const shipText = composeLinkedInText(editedPost, hashtags);
    trackEvent("linkedin_publish_started", {
      has_brand_review: Boolean(brandReviewResult),
      has_hashtags: Boolean(hashtags.trim()),
    });
    // Start the clipboard operation while the original click still owns the
    // browser user gesture. Opening/navigating LinkedIn first can cause some
    // browsers to reject the clipboard write, especially in an embedded app.
    const copyPromise = copyTextWithFallback(shipText);
    let linkedIn: PublishStatus["linkedIn"] = "blocked";
    try {
      const linkedInWindow = window.open("", "_blank");
      if (linkedInWindow) {
        linkedInWindow.opener = null;
        linkedInWindow.location.href = LINKEDIN_COMPOSER_URL;
        linkedIn = "opened";
      }
    } catch {
      linkedIn = "blocked";
    }
    setBrandReviewOpen(false);
    setBrandReviewIsForPublish(false);
    setPublishStatus({ text: shipText, copy: "checking", linkedIn });
    void copyPromise.then((copied) => {
      setPublishStatus((current) => current ? { ...current, copy: copied ? "copied" : "failed" } : current);
      toast(copied
        ? { title: "Post copied", description: "Your latest post and hashtags are ready to paste into LinkedIn." }
        : { title: "Couldn't copy automatically", description: "Use the Copy post button below, then paste into LinkedIn.", variant: "destructive" },
      );
    });

    const payload = buildDraftPayload("published");
    if (savedDraftId) {
      updateDraft(
        { id: savedDraftId, data: payload },
        {
          onSuccess: () => {
            toast({ title: "Saved for publishing", description: "The current post and hashtags have been saved." });
            trackEvent("draft_published", { updated: true });
            void queryClient.invalidateQueries({ queryKey: getGetDraftQueryKey(savedDraftId) });
            showBestTimeHint();
          },
          onError: (err) => toast({ title: "Save failed", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" }),
        }
      );
    } else {
      createDraft(
        { data: payload },
        {
          onSuccess: (newDraft) => {
            setSavedDraftId(newDraft.id);
            toast({ title: "Saved for publishing", description: "The current post and hashtags have been saved." });
            trackEvent("draft_published", { updated: false });
            showBestTimeHint();
          },
          onError: (err) => toast({ title: "Save failed", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" }),
        }
      );
    }
  };

  const handleSaveAndPublish = async () => {
    if (!content || isCheckingAuthenticity || isBrandReviewLoading) {
      if (!content) toast({ title: "Nothing to save yet", variant: "destructive" });
      return;
    }
    void handleViewBrandReview(true);
  };

  const retryPublishCopy = () => {
    if (!publishStatus) return;
    setPublishStatus((current) => current ? { ...current, copy: "checking" } : current);
    void copyTextWithFallback(publishStatus.text).then((copied) => {
      setPublishStatus((current) => current ? { ...current, copy: copied ? "copied" : "failed" } : current);
      toast(copied
        ? { title: "Post copied", description: "Your latest post and hashtags are ready to paste." }
        : { title: "Couldn't copy automatically", description: "Select the post in the editor and copy it manually.", variant: "destructive" },
      );
    });
  };

  // ── Draft Brand Review ─────────────────────────────────────────────────
  const handleBrandReview = async (postText: string, forPublish = false, force = false) => {
    if (!postText.trim() || isBrandReviewLoading) return;
    setBrandReviewOpen(true);
    // Keep the previous result visible while an explicit refresh is running.
    // If the refresh fails, the user can still inspect the last good review.
    if (!brandReviewResult) {
      setBrandReviewResult(null);
      setBrandReviewEvidence(null);
      setBrandReviewReviewedPost(null);
      setBrandReviewCachedAt(null);
    }
    setBrandReviewIsForPublish(forPublish);
    setPendingBrandChange(null);
    setIsBrandReviewLoading(true);
    setIsCheckingAuthenticity(forPublish);
    try {
      // A review needs a stable draft owner so it can be reopened later. Save
      // generated content as a draft the first time review is requested.
      let reviewDraftId = savedDraftId;
      if (!reviewDraftId) {
        const newDraft = await createDraftAsync({ data: buildDraftPayload("draft") });
        reviewDraftId = newDraft.id;
        setSavedDraftId(reviewDraftId);
      }

      const brandReview = await agentApi.brandReview(postText, reviewDraftId, force);
      setBrandReviewResult(brandReview.result);
      setBrandReviewEvidence(brandReview.authenticityCheck);
      setBrandReviewReviewedPost(brandReview.reviewedPost);
      setBrandReviewCachedAt(brandReview.cachedAt);
       trackEvent("brand_review_completed", {
         purpose: forPublish ? "publish" : "preview",
         refreshed: force,
       });
    } catch (err) {
      // Keep an existing review open on refresh failure; closing it would hide
      // the cached result the user explicitly asked to preserve.
      if (!brandReviewResult) {
        setBrandReviewOpen(false);
        setBrandReviewIsForPublish(false);
      }
      toast({
        title: force ? "Couldn't refresh Brand Review" : "Couldn't run Brand Review",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setIsCheckingAuthenticity(false);
      setIsBrandReviewLoading(false);
    }
  };

  const handleViewBrandReview = (forPublish = false) => {
    if (brandReviewResult) {
      setBrandReviewIsForPublish(forPublish);
      setBrandReviewOpen(true);
      setPendingBrandChange(null);
      return;
    }
    void handleBrandReview(fullPost, forPublish);
  };

  const handleReRunBrandReview = () => {
    void handleBrandReview(fullPost, brandReviewIsForPublish, true);
  };

  // ── Generate visual image on demand (triggered by user, not auto-fired) ─
  const generateVisual = () => {
    if (!content?.visual || isLoadingVisual) return;
    setIsLoadingVisual(true);
    imageGenApi.generate(content.visual, "photo")
      .then(({ imageBase64 }) => {
        setVisualImage(imageBase64);
        trackEvent("visual_generated", { kind: "photo" });
      })
      .catch((err) => toast({ title: "Visual failed", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" }))
      .finally(() => setIsLoadingVisual(false));
  };

  // ── Generate illustration on demand (triggered by user, not auto-fired) ─
  const generateIllustration = () => {
    if (!content || isLoadingIllustration) return;
    setIsLoadingIllustration(true);
    (async () => {
      try {
        const concept = await illustrationConceptApi.generate(editedPost, visualStyle, audience, feeling);
        setIllustrationCaption(concept.caption);
        setIllustrationScene(concept.scenePrompt);
        const { imageBase64 } = await imageGenApi.generate(concept.scenePrompt, "illustration", visualStyle);
        setIllustrationImage(imageBase64);
        trackEvent("visual_generated", { kind: "illustration", style: visualStyle });
      } catch (err) {
        toast({ title: "Illustration failed", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" });
      } finally {
        setIsLoadingIllustration(false);
      }
    })();
  };

  // ── Regen illustration with a custom scene (skips concept generation) ─
  const regenIllustrationWithScene = (scene: string) => {
    if (!scene.trim() || isLoadingIllustration) return;
    setIsLoadingIllustration(true);
    imageGenApi.generate(scene, "illustration", visualStyle)
      .then(({ imageBase64 }) => {
        setIllustrationImage(imageBase64);
        trackEvent("visual_generated", { kind: "illustration", style: visualStyle });
      })
      .catch((err) => toast({ title: "Illustration failed", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" }))
      .finally(() => setIsLoadingIllustration(false));
  };

  // ── Copy helper ──────────────────────────────────────────────────────
  const copy = (text: string, label = "Copied") => {
    void navigator.clipboard.writeText(text);
    toast({ title: label });
  };

  const handleApplyBrandRecommendation = (recommendation: BrandReviewRecommendation) => {
    if (!editedPost.trim() || isApplyingBrandReviewId) return;
    setIsApplyingBrandReviewId(recommendation.id);
    refineContent(
      {
        data: {
          content: editedPost,
          instruction: `Apply only this Brand Review recommendation to the draft: ${recommendation.instruction}. Preserve the topic, useful details, and the author's voice. Return the complete revised post only.`,
          tab: "post",
        },
      },
      {
        onSuccess: (data) => {
          setPendingBrandChange({ recommendation, content: data.content ?? editedPost });
          setIsApplyingBrandReviewId(null);
        },
        onError: (err) => {
          toast({ title: "Could not prepare that change", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" });
          setIsApplyingBrandReviewId(null);
        },
      },
    );
  };

  const handleApproveBrandChange = () => {
    if (!pendingBrandChange) return;
    const { recommendation, content: revisedPost } = pendingBrandChange;
    setEditedPost(revisedPost);
    setContent((current) => current ? { ...current, post: revisedPost } : current);
    addVersion(`Brand review · ${recommendation.title}`, revisedPost, hashtags);
    setBrandReviewResult((current) => current
      ? { ...current, recommendations: current.recommendations.filter((item) => item.id !== recommendation.id) }
      : current);
    setPendingBrandChange(null);
    toast({ title: "Change applied to this draft", description: "Your Brand DNA was not changed." });
  };

  const handleEditDraftManually = () => {
    setBrandReviewOpen(false);
    setPendingBrandChange(null);
    window.setTimeout(() => document.getElementById("draft-post-editor")?.focus(), 0);
  };

  // ── Render ──────────────────────────────────────────────────────────
  const showResult = !!content;
  const fullPost = useMemo(() => `${editedPost}${hashtags ? `\n\n${hashtags}` : ""}`, [editedPost, hashtags]);
  const brandReviewIsStale = !!brandReviewResult
    && brandReviewReviewedPost !== null
    && brandReviewReviewedPost !== fullPost;
  const pageTour = usePageTour("capture-tour", CAPTURE_TOUR_STEPS);

  return (
    <AppShell>
      <div className="max-w-[430px] mx-auto px-4 pt-4 pb-32">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          {showResult ? (
            <button
              onClick={() => { setContent(null); setEditedPost(""); setHashtags(""); }}
              className="p-2 -ml-2 rounded-full hover:bg-gray-100"
              aria-label="Back"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          ) : null}
          <h1 className="text-xl font-bold flex-1">
            {showResult ? "Your post" : "What do you want to say?"}
          </h1>
        </div>

        {seriesId && seriesPart && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-2xl bg-indigo-50 border border-indigo-100">
            <Layers className="w-4 h-4 text-indigo-500 flex-shrink-0" />
            <p className="text-xs font-bold text-indigo-700 truncate">
              Part {seriesPart}{seriesDetail ? `${seriesDetail.plannedParts ? ` of ${seriesDetail.plannedParts}` : ""} — ${seriesDetail.title}` : ""}
            </p>
          </div>
        )}

        {!showResult && (
          <CaptureForm
            rawInput={rawInput} setRawInput={setRawInput}
            audience={audience} setAudience={setAudience}
            feeling={feeling} setFeeling={setFeeling}
            tieToNews={tieToNews} setTieToNews={setTieToNews}
            isGenerating={isGenerating}
            onMakeIt={(overrides) => runGenerate(overrides)}
            onSelectDirection={(d) => {
              setFeeling(d.feeling);
              runGenerate({
                feeling: d.feeling,
                extraInstruction: `Open with a hook in this direction (make it your own voice): "${d.hook}"`,
              });
            }}
            error={generateError instanceof Error ? generateError.message : null}
          />
        )}

        {showResult && content && (
          <ResultView
            content={content}
            editedPost={editedPost} setEditedPost={setEditedPost}
            hashtags={hashtags} setHashtags={setHashtags}
            versions={versions}
            onRestoreVersion={(v) => { setEditedPost(v.post); setHashtags(v.hashtags); setContent((c) => c ? { ...c, post: v.post } : c); }}
            activeTab={activeTab} setActiveTab={setActiveTab}
            visualStyle={visualStyle} setVisualStyle={setVisualStyle}
            visualImage={visualImage} isLoadingVisual={isLoadingVisual}
            illustrationImage={illustrationImage} illustrationCaption={illustrationCaption}
            illustrationScene={illustrationScene} isLoadingIllustration={isLoadingIllustration}
            fullPost={fullPost}
            brandClosingMode={brandClosingMode}
            brandClosingText={brandClosingText}
            brandClosingApplied={brandClosingApplied}
            onToggleBrandClosing={handleBrandClosingToggle}
            audience={audience} feeling={feeling}
            isRefining={isRefining}
            isSaving={isSaving}
            isCheckingAuthenticity={isCheckingAuthenticity}
            isDemo={isDemo}
            onSwapHook={swapHook}
            onRefine={runRefine}
            onTryAgain={() => runGenerate({ extraInstruction: "Take a completely different angle on the same idea." })}
            onChangeFeeling={(newFeeling) => { setFeeling(newFeeling); runGenerate({ feeling: newFeeling }); }}
            onChangeVisualStyle={(newStyle) => {
              if (newStyle === visualStyle) return;
              setVisualStyle(newStyle);
              setIllustrationImage(null);
              setIllustrationCaption("");
              setIllustrationScene("");
            }}
            setIllustrationCaption={setIllustrationCaption}
            setIllustrationScene={setIllustrationScene}
            onGenerateIllustration={generateIllustration}
            onRegenIllustration={regenIllustrationWithScene}
            onGenerateVisual={generateVisual}
            onSave={handleSave}
            onSaveAndPublish={handleSaveAndPublish}
            onCopy={copy}
            onBrandReview={() => handleViewBrandReview(false)}
            isBrandReviewLoading={isBrandReviewLoading}
            hasCachedBrandReview={!!brandReviewResult && !!brandReviewCachedAt}
            brandReviewIsStale={brandReviewIsStale}
          />
        )}

        {publishStatus && (
          <div className={cn(
            "mt-4 rounded-2xl border p-4 text-sm",
            publishStatus.copy === "failed" || publishStatus.linkedIn === "blocked"
              ? "border-amber-200 bg-amber-50 text-amber-950"
              : "border-emerald-200 bg-emerald-50 text-emerald-950",
          )}>
            <p className="font-bold">
              {publishStatus.copy === "checking"
                ? "Preparing your post for LinkedIn…"
                : publishStatus.copy === "copied"
                ? "Your post and hashtags are copied."
                : "Your post could not be copied automatically."}
            </p>
            <p className="mt-1 text-xs leading-relaxed">
              {publishStatus.linkedIn === "opened"
                ? "LinkedIn opened in a new tab. Paste the copied text there, then publish manually."
                : "Your browser blocked the LinkedIn tab. Open LinkedIn below, then paste and publish manually."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {publishStatus.copy !== "copied" && (
                <Button size="sm" variant="outline" onClick={retryPublishCopy}>
                  <Copy className="mr-1.5 h-3.5 w-3.5" />Try copying again
                </Button>
              )}
              {publishStatus.linkedIn === "blocked" && (
                <a
                  href={LINKEDIN_COMPOSER_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
                >
                  Open LinkedIn
                </a>
              )}
              <Button size="sm" variant="ghost" onClick={() => setPublishStatus(null)}>Dismiss</Button>
            </div>
            {publishStatus.copy === "failed" && (
              <div className="mt-3">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                  Complete text to copy manually
                </p>
                <textarea
                  readOnly
                  value={publishStatus.text}
                  aria-label="Complete post text including hashtags"
                  onClick={(event) => event.currentTarget.select()}
                  className="min-h-28 w-full resize-y rounded-xl border border-amber-200 bg-white p-3 text-xs leading-relaxed text-gray-700 outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            )}
          </div>
        )}

        {brandReviewOpen && (
          <BrandReviewPanel
            result={brandReviewResult}
            isLoading={isBrandReviewLoading}
            isApplyingId={isApplyingBrandReviewId}
            pendingChange={pendingBrandChange}
            onClose={() => { setBrandReviewOpen(false); setPendingBrandChange(null); }}
            onApplyRecommendation={handleApplyBrandRecommendation}
            onApprove={handleApproveBrandChange}
            onDiscard={() => setPendingBrandChange(null)}
            onEditManually={handleEditDraftManually}
            authenticityCheck={brandReviewEvidence}
            cachedAt={brandReviewCachedAt}
            isStale={brandReviewIsStale}
            onReRun={handleReRunBrandReview}
            feedback={authenticityFeedback}
            isSavingFeedback={isSavingAuthenticityFeedback}
            onFeedback={handleAuthenticityFeedback}
            onSaveAndPublish={brandReviewIsForPublish ? completePublish : undefined}
            isPublishing={isSaving}
          />
        )}

        {/* Loading overlay — rendered via portal so fixed positioning is always viewport-relative.
            AnimatePresence is always mounted (outside the condition) so the exit fade plays
            when isGenerating flips to false. */}
        {createPortal(
          <AnimatePresence>
            {isGenerating && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-white/90 z-50 flex items-center justify-center"
              >
                <div className="text-center">
                  <GenerationLoader text={isDemo ? "Loading your demo post…" : "Crafting your post…"} isDemo={isDemo} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
      </div>
      {pageTour}
    </AppShell>
  );

}

// ── CaptureForm ────────────────────────────────────────────────────────────

interface CaptureFormProps {
  rawInput: string; setRawInput: (v: string) => void;
  audience: string; setAudience: (v: string) => void;
  feeling: string; setFeeling: (v: string) => void;
  tieToNews: boolean; setTieToNews: (v: boolean) => void;
  isGenerating: boolean;
  onMakeIt: (overrides?: { rawInput?: string; extraInstruction?: string }) => void;
  onSelectDirection: (d: { feeling: string; hook: string }) => void;
  error: string | null;
}

function CaptureForm(props: CaptureFormProps) {
  const {
    rawInput, setRawInput, audience, setAudience,
    feeling, setFeeling, tieToNews, setTieToNews,
    isGenerating, onMakeIt, onSelectDirection, error,
  } = props;

  const [showDirections, setShowDirections] = useState(false);
  const [directions, setDirections] = useState<DirectionConcept[]>([]);
  const [painPointMode, setPainPointMode] = useState(false);
  const [ppConcept, setPpConcept] = useState("");
  const [ppWentWrong, setPpWentWrong] = useState("");
  const [ppAnalogy, setPpAnalogy] = useState("");

  const handleMakeIt = () => {
    if (painPointMode) {
      if (!ppConcept.trim()) return;
      const composed = [
        `Topic: ${ppConcept}`,
        ppWentWrong ? `What goes wrong: ${ppWentWrong}` : "",
        ppAnalogy ? `Analogy or hook: ${ppAnalogy}` : "",
      ].filter(Boolean).join("\n");
      onMakeIt({
        rawInput: composed,
        extraInstruction:
          "Structure this as a Pain Point Post: open with an uncomfortable question or bold observation that surfaces the pain, use the analogy/hook to make it vivid and concrete, describe the real-world consequences people feel, then close with the key insight or reframe. Direct and conversational.",
      });
    } else {
      onMakeIt();
    }
  };

  const { mutate: exploreDirs, isPending: isExploring } = useExploreDirections();
  const { data: insights } = useGetPerformanceInsights();

  const handleExplore = () => {
    if (!rawInput.trim()) return;
    setShowDirections(true);
    setDirections([]);
    exploreDirs(
      { data: { rawInput, audience: audience || undefined } },
      {
        onSuccess: (data) => setDirections(data.directions),
        onError: () => setShowDirections(false),
      }
    );
  };

  // Reset explore panel when the raw idea changes significantly
  const prevRawRef = React.useRef(rawInput);
  useEffect(() => {
    if (Math.abs(rawInput.length - prevRawRef.current.length) > 20) {
      setShowDirections(false);
      setDirections([]);
    }
    prevRawRef.current = rawInput;
  }, [rawInput]);

  const feelingNudge = insights && insights.confidence !== "low" && insights.bestFeeling && insights.bestFeeling !== feeling
    ? insights.bestFeeling
    : null;

  return (
    <div className="space-y-6">
      {!painPointMode && (
        <textarea
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          placeholder="A rough thought, a story, an opinion. Just type — we'll shape it."
          className="w-full min-h-[140px] p-4 rounded-2xl border border-gray-200 focus:border-primary focus:outline-none text-base leading-relaxed resize-none"
          autoFocus
        />
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Who's it for?</p>
        <div className="flex flex-wrap gap-2">
          {AUDIENCES.map((a) => (
            <button
              key={a.key}
              onClick={() => setAudience(a.key)}
              className={cn(
                "px-3 py-2 rounded-full border text-sm transition flex items-center gap-1.5",
                audience === a.key
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-gray-700 border-gray-200 hover:border-primary/40"
              )}
            >
              <span>{a.emoji}</span><span>{a.key}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">How should it feel?</p>
          {feelingNudge && (
            <button
              onClick={() => setFeeling(feelingNudge)}
              className="flex items-center gap-1 text-[10px] font-semibold text-violet-600 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full hover:bg-violet-100 transition"
            >
              <Sparkles className="w-2.5 h-2.5" />
              {feelingNudge} works best for you
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {FEELINGS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFeeling(f.key)}
              className={cn(
                "px-3 py-2 rounded-full border text-sm transition flex items-center gap-1.5",
                feeling === f.key
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-gray-700 border-gray-200 hover:border-primary/40"
              )}
            >
              <span>{f.emoji}</span><span>{f.key}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Pain Point Post mode toggle */}
      <button
        onClick={() => { setPainPointMode(!painPointMode); setShowDirections(false); }}
        className={cn(
          "w-full flex items-center gap-3 p-4 rounded-2xl border transition text-left",
          painPointMode ? "bg-rose-50 border-rose-300" : "bg-white border-gray-200 hover:border-gray-300"
        )}
      >
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
          painPointMode ? "bg-rose-200 text-rose-900" : "bg-gray-100 text-gray-500"
        )}>
          <Target className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-sm">Pain Point Post</p>
          <p className="text-xs text-gray-500">Question → analogy → pain → insight</p>
        </div>
        <div className={cn(
          "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
          painPointMode ? "bg-rose-500 border-rose-500" : "border-gray-300"
        )}>
          {painPointMode && <Check className="w-3 h-3 text-white" />}
        </div>
      </button>

      {painPointMode && (
        <div className="space-y-3 p-4 bg-rose-50/50 rounded-2xl border border-rose-100">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500 block mb-1.5">
              Skill or concept <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={ppConcept}
              onChange={(e) => setPpConcept(e.target.value)}
              placeholder="e.g. Emotional intelligence, Pricing strategy, Delegation"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-rose-400 focus:outline-none text-sm"
              autoFocus
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500 block mb-1.5">
              What goes wrong when people get this wrong?
            </label>
            <textarea
              value={ppWentWrong}
              onChange={(e) => setPpWentWrong(e.target.value)}
              placeholder="e.g. Teams burn out, deals collapse, decisions stall…"
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-rose-400 focus:outline-none text-sm resize-none"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500 block mb-1.5">
              Analogy or hook <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={ppAnalogy}
              onChange={(e) => setPpAnalogy(e.target.value)}
              placeholder="e.g. It's like trying to drive without a dashboard…"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-rose-400 focus:outline-none text-sm"
            />
          </div>
        </div>
      )}

      <button
        onClick={() => setTieToNews(!tieToNews)}
        className={cn(
          "w-full flex items-center gap-3 p-4 rounded-2xl border transition text-left",
          tieToNews ? "bg-amber-50 border-amber-300" : "bg-white border-gray-200 hover:border-gray-300"
        )}
      >
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
          tieToNews ? "bg-amber-200 text-amber-900" : "bg-gray-100 text-gray-500"
        )}>
          <Newspaper className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-sm">Tie to fresh news</p>
          <p className="text-xs text-gray-500">Anchor your post to a recent headline.</p>
        </div>
        <div className={cn(
          "w-5 h-5 rounded-full border-2 flex items-center justify-center",
          tieToNews ? "bg-amber-500 border-amber-500" : "border-gray-300"
        )}>
          {tieToNews && <Check className="w-3 h-3 text-white" />}
        </div>
      </button>

      {/* Explore 3 directions */}
      {!showDirections && rawInput.trim() && (
        <button
          onClick={handleExplore}
          disabled={isExploring || isGenerating}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm text-violet-600 font-medium border border-violet-200 rounded-2xl hover:bg-violet-50 transition disabled:opacity-50"
        >
          <Layers className="w-4 h-4" />
          Not sure? Explore 3 angles
        </button>
      )}

      {showDirections && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pick a direction — tap to generate</p>
            <button onClick={() => setShowDirections(false)} className="text-xs text-gray-400 hover:text-gray-600">Hide</button>
          </div>
          {isExploring || directions.length === 0 ? (
            <div className="text-center py-8">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-violet-400 mb-2" />
              <p className="text-sm text-gray-400">Finding angles…</p>
            </div>
          ) : (
            directions.map((d, i) => (
              <button
                key={i}
                onClick={() => onSelectDirection(d)}
                disabled={isGenerating}
                className="w-full text-left p-4 rounded-2xl border border-gray-200 hover:border-violet-400 hover:bg-violet-50/30 transition space-y-2 disabled:opacity-50"
              >
                <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                  {d.feeling}
                </span>
                <p className="font-semibold text-sm text-gray-900 leading-snug">"{d.hook}"</p>
                <ul className="text-xs text-gray-500 space-y-0.5">
                  {d.points.map((pt, j) => <li key={j}>· {pt}</li>)}
                </ul>
              </button>
            ))
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>
      )}

      <Button
        onClick={handleMakeIt}
        disabled={isGenerating || (painPointMode ? !ppConcept.trim() : !rawInput.trim())}
        data-tour="make-it"
        className={cn("w-full h-14 text-base rounded-2xl", painPointMode && "bg-rose-600 hover:bg-rose-500 border-rose-600")}
      >
        <Sparkles className="w-4 h-4 mr-2" />
        {painPointMode ? "Write Pain Point Post" : "Make it"}
      </Button>
    </div>
  );
}

// ── ResultView ─────────────────────────────────────────────────────────────

interface ResultViewProps {
  content: GeneratedContent;
  editedPost: string; setEditedPost: (v: string) => void;
  hashtags: string; setHashtags: (v: string) => void;
  versions: Array<{ id: number; label: string; post: string; hashtags: string }>;
  onRestoreVersion: (v: { id: number; label: string; post: string; hashtags: string }) => void;
  activeTab: TabType; setActiveTab: (t: TabType) => void;
  visualStyle: string; setVisualStyle: (s: string) => void;
  visualImage: string | null; isLoadingVisual: boolean;
  illustrationImage: string | null; illustrationCaption: string;
  illustrationScene: string; isLoadingIllustration: boolean;
  fullPost: string;
  brandClosingMode: BrandClosingMode;
  brandClosingText: string;
  brandClosingApplied: boolean;
  onToggleBrandClosing: (enabled: boolean) => void;
  audience: string; feeling: string;
  isRefining: boolean;
  isSaving: boolean;
  isCheckingAuthenticity: boolean;
  isDemo: boolean;
  onSwapHook: (hook: string) => void;
  onRefine: (instruction: string, tab?: TabType, label?: string) => void;
  onTryAgain: () => void;
  onChangeFeeling: (newFeeling: string) => void;
  onChangeVisualStyle: (newStyle: string) => void;
  setIllustrationCaption: (v: string) => void;
  setIllustrationScene: (v: string) => void;
  onGenerateIllustration: () => void;
  onRegenIllustration: (scene: string) => void;
  onGenerateVisual: () => void;
  onSave: () => void;
  onSaveAndPublish?: () => void;
  onCopy: (text: string, label?: string) => void;
  onBrandReview: (postText: string) => void;
  isBrandReviewLoading: boolean;
  hasCachedBrandReview: boolean;
  brandReviewIsStale: boolean;
}

function ResultView(props: ResultViewProps) {
  const {
    content, editedPost, setEditedPost, hashtags, setHashtags,
    versions, onRestoreVersion,
    activeTab, setActiveTab, visualStyle, setVisualStyle,
    visualImage, isLoadingVisual,
    illustrationImage, illustrationCaption, illustrationScene, isLoadingIllustration,
    fullPost, audience, feeling, isRefining, isSaving, isCheckingAuthenticity, isDemo,
    brandClosingMode, brandClosingText, brandClosingApplied, onToggleBrandClosing,
    onSwapHook, onRefine, onTryAgain, onChangeFeeling, onChangeVisualStyle,
    setIllustrationCaption, setIllustrationScene, onGenerateIllustration, onRegenIllustration, onGenerateVisual,
    onSave, onSaveAndPublish, onCopy, onBrandReview, isBrandReviewLoading,
    hasCachedBrandReview, brandReviewIsStale,
  } = props;

  return (
    <div className="space-y-4">
      {/* Demo mode banner */}
      {isDemo && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
          <span className="text-base">🧪</span>
          <div>
            <span className="font-semibold">Demo preview</span>
            <span className="text-amber-700"> — this is a curated example, not AI output. </span>
            <a href="/signup" className="font-semibold underline underline-offset-2 hover:text-amber-900">Sign up free</a>
            <span className="text-amber-700"> to generate posts from your own ideas.</span>
          </div>
        </div>
      )}

      {/* Audience badge + News pill */}
      <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
        <span className="px-2 py-1 bg-gray-100 rounded-full">{audience}</span>
        {content.newsAnchor && (
          <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-full flex items-center gap-1">
            <Newspaper className="w-3 h-3" />News
          </span>
        )}
      </div>

      {/* Feeling chips — tap to re-generate the post in a different feeling */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Feeling — tap to re-generate</p>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {FEELINGS.map((f) => {
            const active = feeling === f.key;
            return (
              <button
                key={f.key}
                onClick={() => { if (!active && !isRefining) onChangeFeeling(f.key); }}
                disabled={isRefining}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap border transition",
                  active
                    ? "bg-violet-600 text-white border-violet-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-violet-400 disabled:opacity-50"
                )}
              >
                {f.key}
              </button>
            );
          })}
        </div>
      </div>

      {/* News fallback note (tieToNews ON but no fresh article matched) */}
      {content.newsFallback && !content.newsAnchor && (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-600 flex items-start gap-2">
          <Newspaper className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-400" />
          <span>{content.newsFallback}</span>
        </div>
      )}

      {/* News anchor (if tied) */}
      {content.newsAnchor && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs">
          <p className="font-medium text-amber-900">{content.newsAnchor.headline}</p>
          {content.newsAnchor.url && (
            <a href={content.newsAnchor.url} target="_blank" rel="noopener noreferrer" className="text-amber-700 underline">
              source
            </a>
          )}
        </div>
      )}

      {/* Tab strip */}
      <div className="flex overflow-x-auto -mx-4 px-4 gap-1 no-scrollbar">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              "px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition",
              activeTab === key ? "bg-primary text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "post" && (
        <div className="space-y-4">
          {/* Alternative hooks (tap to swap) */}
          {content.alternativeHooks && content.alternativeHooks.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Try a different opener</p>
              {content.alternativeHooks.slice(0, 2).map((hook, i) => (
                <button
                  key={i}
                  onClick={() => onSwapHook(hook)}
                  className="w-full text-left p-3 rounded-xl border border-dashed border-gray-300 hover:border-primary hover:bg-primary/5 text-sm transition"
                >
                  {hook}
                </button>
              ))}
            </div>
          )}

          <textarea
            id="draft-post-editor"
            value={editedPost}
            onChange={(e) => setEditedPost(e.target.value)}
            spellCheck
            className="w-full min-h-[280px] p-4 rounded-2xl border border-gray-200 focus:border-primary focus:outline-none text-sm leading-relaxed font-mono"
          />

          <div className={cn(
            "rounded-2xl border p-3.5",
            brandClosingApplied ? "border-indigo-100 bg-indigo-50/60" : "border-gray-100 bg-gray-50",
          )}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={brandClosingApplied}
                onChange={(e) => onToggleBrandClosing(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-indigo-600"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-xs font-bold text-gray-700">
                  Brand closing
                  <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-indigo-500 capitalize">{brandClosingMode}</span>
                </span>
                <span className="block text-[11px] text-gray-500 leading-relaxed mt-1">
                  {brandClosingApplied
                    ? "Included before hashtags. You can turn it off for this post."
                    : brandClosingMode === "smart"
                    ? "Smart mode left it off because this post already has a natural close."
                    : "Turn it on for this post; manage the wording in Settings."}
                </span>
                {brandClosingApplied && brandClosingText.trim() && (
                  <span className="block text-xs text-indigo-900 leading-relaxed mt-2 whitespace-pre-line">{brandClosingText.trim()}</span>
                )}
              </span>
            </label>
          </div>

          <input
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            placeholder="#hashtags"
            spellCheck
            className="w-full p-3 rounded-xl border border-gray-200 focus:border-primary focus:outline-none text-sm"
          />

          {/* Version history — flip between generated tones / openers / lengths */}
          {versions.length > 1 && (
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Versions · tap to restore</p>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                {versions.map((v, i) => {
                  const isCurrent = v.post === editedPost;
                  return (
                    <button
                      key={v.id}
                      onClick={() => onRestoreVersion(v)}
                      className={cn(
                        "px-2.5 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap border transition-all flex-shrink-0",
                        isCurrent ? "bg-primary text-white border-primary" : "bg-white text-gray-500 border-gray-200 hover:border-primary/40"
                      )}
                      title={v.post.slice(0, 80) + (v.post.length > 80 ? "…" : "")}
                    >
                      {i + 1}. {v.label}{isCurrent ? " ✓" : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Live algorithm tracker — fold line, counts, structure, hashtags, links */}
          <PostMeter post={editedPost} hashtags={hashtags} />

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => onRefine("Make this shorter and punchier.", "post", "Shorter")} disabled={isRefining}>
              <ArrowUp className="w-3.5 h-3.5 mr-1" />Shorter
            </Button>
            <Button variant="outline" onClick={() => onRefine("Add more depth and a personal example.", "post", "Longer")} disabled={isRefining}>
              <ArrowDown className="w-3.5 h-3.5 mr-1" />Longer
            </Button>
            <Button variant="outline" onClick={() => onRefine("Reframe this as a personal story with a vivid opening scene.", "post", "Story")} disabled={isRefining}>
              <BookOpen className="w-3.5 h-3.5 mr-1" />Story
            </Button>
            <Button variant="outline" onClick={onTryAgain} disabled={isRefining}>
              <RefreshCw className="w-3.5 h-3.5 mr-1" />New angle
            </Button>
          </div>

          <div className={cn("grid gap-2", isDemo ? "grid-cols-1" : "grid-cols-2")}>
            <Button variant="ghost" onClick={() => onCopy(fullPost, "Post copied")}>
              <Copy className="w-3.5 h-3.5 mr-1" />Copy
            </Button>
            {!isDemo && (
              <Button onClick={onSave} disabled={isSaving}>
                <Save className="w-3.5 h-3.5 mr-1" />{isSaving ? "Saving…" : "Save"}
              </Button>
            )}
          </div>
          {!isDemo && onSaveAndPublish && (
            <Button
              variant="outline"
              className="w-full border-green-200 text-green-700 hover:bg-green-50 hover:border-green-400"
              onClick={onSaveAndPublish}
              disabled={isSaving || isCheckingAuthenticity}
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              {isCheckingAuthenticity ? "Reviewing…" : isSaving ? "Saving…" : "Save & Publish"}
            </Button>
          )}
          <Button
            variant="outline"
            className="w-full border-sky-200 text-sky-700 hover:bg-sky-50 hover:border-sky-400"
            onClick={() => onBrandReview(fullPost)}
            disabled={isBrandReviewLoading || isRefining}
          >
            <Target className="w-3.5 h-3.5 mr-1.5" />
            {isBrandReviewLoading
              ? "Reviewing brand fit…"
              : hasCachedBrandReview
              ? brandReviewIsStale ? "View saved review · draft changed" : "View saved Brand Review"
              : "Brand Review"}
          </Button>
        </div>
      )}

      {activeTab === "short" && (
        <div className="space-y-3">
          <pre className="whitespace-pre-wrap text-sm p-4 bg-gray-50 rounded-xl">{content.shortPost ?? "No short version yet."}</pre>
          <div>
            <Button variant="outline" onClick={() => onCopy(content.shortPost ?? "", "Short post copied")}>
              <Copy className="w-3.5 h-3.5 mr-1" />Copy
            </Button>
          </div>
        </div>
      )}

      {activeTab === "carousel" && (
        <div className="space-y-3">
          {(content.carousel ?? []).length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No carousel yet.</p>
          ) : (
            <>
              {content.carousel.map((slide, i) => (
                <div key={i} className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-400 mb-1">Slide {slide.slide ?? i + 1}</p>
                  <p className="font-semibold text-sm mb-1">{slide.title}</p>
                  <p className="text-xs text-gray-700">{slide.description}</p>
                </div>
              ))}
              <Button variant="outline" onClick={() => downloadCarouselPDF(content.carousel, audience || "carousel")}>
                Download PDF
              </Button>
            </>
          )}
        </div>
      )}

      {activeTab === "visual" && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">{content.visual}</p>
          {!visualImage && !isLoadingVisual && (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="text-sm text-gray-500 text-center">Generate a photo-style visual for this post.</p>
              <Button onClick={onGenerateVisual} className="px-6">
                <Sparkles className="w-4 h-4 mr-2" />
                Generate image
              </Button>
            </div>
          )}
          {isLoadingVisual && <p className="text-sm text-gray-500 text-center py-8">Generating image…</p>}
          {visualImage && (
            <>
              <img src={`data:image/png;base64,${visualImage}`} alt="Visual" className="w-full rounded-xl" />
              <Button variant="outline" onClick={() => downloadVisualCard(editedPost.split("\n")[0] ?? "Visual", audience || "visual")}>
                Download card
              </Button>
            </>
          )}
        </div>
      )}

      {activeTab === "infographic" && (
        <div className="space-y-3">
          {content.infographic ? (
            <>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="font-semibold text-sm mb-2">{content.infographic.headline}</p>
                <ul className="text-xs space-y-1 list-disc pl-4">
                  {content.infographic.bullets.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              </div>
              <Button variant="outline" onClick={() => downloadInfographic(content.infographic!.headline, content.infographic!.bullets, audience || "infographic")}>
                Download infographic
              </Button>
            </>
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">No infographic data.</p>
          )}
        </div>
      )}

      {activeTab === "illustration" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {VISUAL_STYLES.map((s) => (
              <button
                key={s.key}
                onClick={() => onChangeVisualStyle(s.key)}
                className={cn(
                  "px-3 py-1.5 rounded-full border text-xs transition",
                  visualStyle === s.key
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-gray-700 border-gray-200 hover:border-primary/40"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          {/* Idle state — user picks style first, then generates */}
          {!illustrationImage && !isLoadingIllustration && (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="text-sm text-gray-500 text-center">Pick a style above, then generate your illustration.</p>
              <Button onClick={onGenerateIllustration} className="px-6">
                <Sparkles className="w-4 h-4 mr-2" />
                Generate illustration
              </Button>
            </div>
          )}
          {isLoadingIllustration && <p className="text-sm text-gray-500 text-center py-8">Generating illustration…</p>}
          {illustrationImage && (
            <>
              <img src={`data:image/png;base64,${illustrationImage}`} alt="Illustration" className="w-full rounded-xl" />

              {/* Editable caption */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Caption</p>
                <textarea
                  rows={2}
                  value={illustrationCaption}
                  onChange={(e) => setIllustrationCaption(e.target.value)}
                  placeholder="Add a caption…"
                  className="w-full text-sm italic text-gray-700 text-center bg-transparent border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Editable scene prompt */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Scene prompt — edit and regenerate</p>
                <textarea
                  rows={3}
                  value={illustrationScene}
                  onChange={(e) => setIllustrationScene(e.target.value)}
                  placeholder="Describe the scene…"
                  className="w-full text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full"
                  disabled={isLoadingIllustration || !illustrationScene.trim()}
                  onClick={() => onRegenIllustration(illustrationScene)}
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Regenerate with this scene
                </Button>
              </div>

              <Button variant="outline" onClick={() => downloadIllustrationCard(illustrationImage, illustrationCaption)}>
                Download illustration
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
