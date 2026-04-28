import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearch, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  Sparkles, ChevronLeft, RefreshCw, Copy, Save, Newspaper,
  Image as ImageIcon, Layout, BarChart3, PenTool, Wand2,
  ArrowDown, ArrowUp, BookOpen, Check,
} from "lucide-react";
import {
  useGenerateContent, useRefineContent,
  useCreateDraft, useUpdateDraft, useGetDraft, getGetDraftQueryKey,
} from "@workspace/api-client-react";
import type {
  GeneratedContent, CarouselSlide, StructuredBreakdown, InfographicData,
  CreateDraftBodyContentSource,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { GenerationLoader } from "@/components/ui/skeleton";
import { AppShell } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { imageGenApi, illustrationConceptApi } from "@/lib/api";
import { downloadCarouselPDF } from "@/lib/export-carousel";
import { downloadVisualCard } from "@/lib/export-visual-card";
import { downloadInfographic } from "@/lib/export-infographic";
import { downloadIllustrationCard } from "@/lib/export-illustration";

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

// Map persisted-draft objective → audience chip (mirrors backend normaliser).
function audienceFromObjective(objective?: string | null): string {
  if (!objective) return "My audience";
  const o = objective.toLowerCase();
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

  const { preferences } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── State ────────────────────────────────────────────────────────────────
  const [rawInput, setRawInput] = useState<string>(thoughtParam || rawParam || "");
  const [audience, setAudience] = useState<string>(audienceFromObjective(preferences?.objective));
  const [feeling, setFeeling] = useState<string>(feelingFromTone(preferences?.tone));
  const [tieToNews, setTieToNews] = useState<boolean>(!!newsUrlParam);
  const [content, setContent] = useState<GeneratedContent | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("post");
  const [editedPost, setEditedPost] = useState<string>("");
  const [hashtags, setHashtags] = useState<string>("");
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

  const { mutate: generateContent, isPending: isGenerating, error: generateError } = useGenerateContent();
  const { mutate: refineContent, isPending: isRefining } = useRefineContent();
  const { mutate: createDraft, isPending: isCreating } = useCreateDraft();
  const { mutate: updateDraft, isPending: isUpdating } = useUpdateDraft();
  const isSaving = isCreating || isUpdating;

  // ── Load draft if ?draftId= ─────────────────────────────────────────────
  const { data: existingDraft } = useGetDraft(draftId ?? 0, {
    query: { enabled: !!draftId, staleTime: 0 },
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
      }
      setSavedDraftId(existingDraft.id);
      setInitialized(true);
    }
  }, [existingDraft, initialized]);

  // ── Generate (initial Make-it / Try a different angle) ─────────────────
  const runGenerate = (overrides?: { extraInstruction?: string; feeling?: string; audience?: string }) => {
    if (!rawInput.trim()) {
      toast({ title: "Add an idea first", description: "Tell us what you want to say.", variant: "destructive" });
      return;
    }
    const effectiveAudience = overrides?.audience ?? audience;
    const effectiveFeeling = overrides?.feeling ?? feeling;
    generateContent(
      {
        data: {
          rawInput,
          audience: effectiveAudience,
          feeling: effectiveFeeling,
          tieToNews,
          ...(newsUrlParam ? { newsUrl: newsUrlParam } : {}),
          ...(overrides?.extraInstruction ? { extraInstruction: overrides.extraInstruction } : {}),
          // legacy fields kept for backend safety
          objective: objectiveFromAudience(effectiveAudience),
          persona: preferences?.persona ?? "Founder",
          tone: toneFromFeeling(effectiveFeeling),
        },
      },
      {
        onSuccess: (data) => {
          setContent(data);
          setEditedPost(data.post);
          setHashtags(data.hashtags ?? "");
          setActiveTab("post");
          setVisualImage(null);
          setIllustrationImage(null);
          setIllustrationCaption("");
          setIllustrationScene("");
          downloadedVisualRef.current = null;
        },
        onError: (err) => {
          toast({ title: "Couldn't generate", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" });
        },
      }
    );
  };

  // ── Refine: Shorter / Longer / Story / freeform ───────────────────────
  const runRefine = (instruction: string, tab: TabType = "post") => {
    if (!content) return;
    const source =
      tab === "short" ? (content.shortPost ?? "") :
      tab === "carousel" ? JSON.stringify(content.carousel ?? []) :
      tab === "visual" ? (content.visual ?? "") :
      tab === "infographic" ? JSON.stringify(content.infographic ?? {}) :
      editedPost;
    refineContent(
      { data: { content: source, instruction, tab } },
      {
        onSuccess: (data) => {
          const refined = data.content ?? "";
          if (tab === "post") {
            setEditedPost(refined);
            setContent((c) => c ? { ...c, post: refined } : c);
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
  };

  // ── Save / update draft ───────────────────────────────────────────────
  const buildStructuredBreakdown = (): StructuredBreakdown & Record<string, unknown> => {
    const existing = (existingDraft?.structuredBreakdown as Record<string, unknown> | undefined) ?? {};
    return {
      ...existing,
      topic: rawInput.slice(0, 100),
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
      newsAnchor: content?.newsAnchor ?? null,
      infographic: content?.infographic ?? null,
    } as StructuredBreakdown & Record<string, unknown>;
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
      shortPost: content.shortPost ?? "",
      carouselOutput: JSON.stringify(content.carousel ?? []),
      visualOutput: content.visual ?? "",
      status: "draft" as const,
      visualStyle,
      contentSource: "capture" as CreateDraftBodyContentSource,
    };
    if (savedDraftId) {
      updateDraft(
        { id: savedDraftId, data: payload },
        {
          onSuccess: () => {
            toast({ title: "Saved", description: "Draft updated." });
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
          },
          onError: (err) => toast({ title: "Save failed", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" }),
        }
      );
    }
  };

  // ── Lazy-load visual image when Visual tab opens ──────────────────────
  useEffect(() => {
    if (activeTab !== "visual" || !content?.visual || visualImage || isLoadingVisual) return;
    setIsLoadingVisual(true);
    imageGenApi.generate(content.visual, "photo")
      .then(({ imageBase64 }) => setVisualImage(imageBase64))
      .catch((err) => toast({ title: "Visual failed", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" }))
      .finally(() => setIsLoadingVisual(false));
  }, [activeTab, content?.visual, visualImage, isLoadingVisual, toast]);

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
      .then(({ imageBase64 }) => setIllustrationImage(imageBase64))
      .catch((err) => toast({ title: "Illustration failed", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" }))
      .finally(() => setIsLoadingIllustration(false));
  };

  // ── Copy helper ──────────────────────────────────────────────────────
  const copy = (text: string, label = "Copied") => {
    void navigator.clipboard.writeText(text);
    toast({ title: label });
  };

  // ── Render ──────────────────────────────────────────────────────────
  const showResult = !!content;
  const fullPost = useMemo(() => `${editedPost}${hashtags ? `\n\n${hashtags}` : ""}`, [editedPost, hashtags]);

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

        {!showResult && (
          <CaptureForm
            rawInput={rawInput} setRawInput={setRawInput}
            audience={audience} setAudience={setAudience}
            feeling={feeling} setFeeling={setFeeling}
            tieToNews={tieToNews} setTieToNews={setTieToNews}
            isGenerating={isGenerating}
            onMakeIt={() => runGenerate()}
            error={generateError instanceof Error ? generateError.message : null}
          />
        )}

        {showResult && content && (
          <ResultView
            content={content}
            editedPost={editedPost} setEditedPost={setEditedPost}
            hashtags={hashtags} setHashtags={setHashtags}
            activeTab={activeTab} setActiveTab={setActiveTab}
            visualStyle={visualStyle} setVisualStyle={setVisualStyle}
            visualImage={visualImage} isLoadingVisual={isLoadingVisual}
            illustrationImage={illustrationImage} illustrationCaption={illustrationCaption}
            illustrationScene={illustrationScene} isLoadingIllustration={isLoadingIllustration}
            fullPost={fullPost}
            audience={audience} feeling={feeling}
            isRefining={isRefining}
            isSaving={isSaving}
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
            onSave={handleSave}
            onCopy={copy}
          />
        )}

        {/* Loading overlay */}
        <AnimatePresence>
          {isGenerating && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-white/90 z-50 flex items-center justify-center"
            >
              <div className="text-center">
                <GenerationLoader text="Crafting your post…" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
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
  onMakeIt: () => void;
  error: string | null;
}

function CaptureForm(props: CaptureFormProps) {
  const { rawInput, setRawInput, audience, setAudience, feeling, setFeeling, tieToNews, setTieToNews, isGenerating, onMakeIt, error } = props;
  return (
    <div className="space-y-6">
      <textarea
        value={rawInput}
        onChange={(e) => setRawInput(e.target.value)}
        placeholder="A rough thought, a story, an opinion. Just type — we'll shape it."
        className="w-full min-h-[140px] p-4 rounded-2xl border border-gray-200 focus:border-primary focus:outline-none text-base leading-relaxed resize-none"
        autoFocus
      />

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
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">How should it feel?</p>
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

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>
      )}

      <Button
        onClick={onMakeIt}
        disabled={isGenerating || !rawInput.trim()}
        className="w-full h-14 text-base rounded-2xl"
      >
        <Sparkles className="w-4 h-4 mr-2" />
        Make it
      </Button>
    </div>
  );
}

// ── ResultView ─────────────────────────────────────────────────────────────

interface ResultViewProps {
  content: GeneratedContent;
  editedPost: string; setEditedPost: (v: string) => void;
  hashtags: string; setHashtags: (v: string) => void;
  activeTab: TabType; setActiveTab: (t: TabType) => void;
  visualStyle: string; setVisualStyle: (s: string) => void;
  visualImage: string | null; isLoadingVisual: boolean;
  illustrationImage: string | null; illustrationCaption: string;
  illustrationScene: string; isLoadingIllustration: boolean;
  fullPost: string;
  audience: string; feeling: string;
  isRefining: boolean;
  isSaving: boolean;
  onSwapHook: (hook: string) => void;
  onRefine: (instruction: string, tab?: TabType) => void;
  onTryAgain: () => void;
  onChangeFeeling: (newFeeling: string) => void;
  onChangeVisualStyle: (newStyle: string) => void;
  setIllustrationCaption: (v: string) => void;
  setIllustrationScene: (v: string) => void;
  onGenerateIllustration: () => void;
  onRegenIllustration: (scene: string) => void;
  onSave: () => void;
  onCopy: (text: string, label?: string) => void;
}

function ResultView(props: ResultViewProps) {
  const {
    content, editedPost, setEditedPost, hashtags, setHashtags,
    activeTab, setActiveTab, visualStyle, setVisualStyle,
    visualImage, isLoadingVisual,
    illustrationImage, illustrationCaption, illustrationScene, isLoadingIllustration,
    fullPost, audience, feeling, isRefining, isSaving,
    onSwapHook, onRefine, onTryAgain, onChangeFeeling, onChangeVisualStyle,
    setIllustrationCaption, setIllustrationScene, onGenerateIllustration, onRegenIllustration,
    onSave, onCopy,
  } = props;

  return (
    <div className="space-y-4">
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
            value={editedPost}
            onChange={(e) => setEditedPost(e.target.value)}
            className="w-full min-h-[280px] p-4 rounded-2xl border border-gray-200 focus:border-primary focus:outline-none text-sm leading-relaxed font-mono"
          />

          <input
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            placeholder="#hashtags"
            className="w-full p-3 rounded-xl border border-gray-200 focus:border-primary focus:outline-none text-sm"
          />

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => onRefine("Make this shorter and punchier.")} disabled={isRefining}>
              <ArrowUp className="w-3.5 h-3.5 mr-1" />Shorter
            </Button>
            <Button variant="outline" onClick={() => onRefine("Add more depth and a personal example.")} disabled={isRefining}>
              <ArrowDown className="w-3.5 h-3.5 mr-1" />Longer
            </Button>
            <Button variant="outline" onClick={() => onRefine("Reframe this as a personal story with a vivid opening scene.")} disabled={isRefining}>
              <BookOpen className="w-3.5 h-3.5 mr-1" />Story
            </Button>
            <Button variant="outline" onClick={onTryAgain} disabled={isRefining}>
              <RefreshCw className="w-3.5 h-3.5 mr-1" />New angle
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={() => onCopy(fullPost, "Post copied")}>
              <Copy className="w-3.5 h-3.5 mr-1" />Copy
            </Button>
            <Button onClick={onSave} disabled={isSaving}>
              <Save className="w-3.5 h-3.5 mr-1" />{isSaving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      )}

      {activeTab === "short" && (
        <div className="space-y-3">
          <pre className="whitespace-pre-wrap text-sm p-4 bg-gray-50 rounded-xl">{content.shortPost ?? "No short version yet."}</pre>
          <Button variant="outline" onClick={() => onCopy(content.shortPost ?? "", "Short post copied")}>
            <Copy className="w-3.5 h-3.5 mr-1" />Copy short
          </Button>
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
