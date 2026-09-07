import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, Layers, Plus, Trash2, Sparkles, X, Pencil, Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AppShell } from "@/components/AppShell";
import { usePageTour } from "@/components/tour/usePageTour";
import { SERIES_TOUR_STEPS } from "@/components/tour/page-tours";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  seriesApi, topicsApi,
  type Series, type SeriesDetail, type SeriesFormat, type Topic, type PlannedPart,
} from "@/lib/api";

const AUDIENCES = ["Clients", "Peers", "Recruiters & Headhunters", "Investors", "My audience"];
// Below these lengths the AI has too little to plan progressive, non-repetitive
// parts from — a title needs to read as an actual premise, a theme needs to
// carry enough specifics for the planner and format-detector to work with.
const MIN_TITLE_LENGTH = 10;
const MIN_THEME_LENGTH = 20;
const FORMAT_LABELS: Record<SeriesFormat, string> = {
  standard: "Standard post",
  dialogue: "Dialogue",
  letter: "Letter",
  qa: "Q&A",
  story_arc: "Story arc",
};

export default function SeriesPage() {
  const [, navigate] = useLocation();
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const refresh = () => seriesApi.list().then(setSeries).catch(() => {});

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: number) => {
    setSeries((prev) => prev.filter((s) => s.id !== id));
    try {
      await seriesApi.delete(id);
    } catch {
      refresh();
    }
  };

  const pageTour = usePageTour("series-tour", SERIES_TOUR_STEPS);

  if (detailId) {
    return <SeriesDetailView id={detailId} onBack={() => { setDetailId(null); refresh(); }} />;
  }

  return (
    <AppShell>
      <header className="px-6 pt-12 pb-5 bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-1">
          <button onClick={() => navigate("/")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <Layers className="w-5 h-5 text-indigo-500" />
          <h1 className="text-xl font-extrabold text-gray-900">Series</h1>
        </div>
        <p className="text-sm text-gray-400 ml-11">Plan multi-part arcs. Track progress. See rolled-up performance.</p>
      </header>

      <main className="flex-1 px-5 py-5 overflow-y-auto space-y-4">
        <Button onClick={() => setCreating(true)} data-tour="series-new" className="w-full rounded-2xl font-bold gap-2">
          <Plus className="w-4 h-4" /> New series
        </Button>

        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
        ) : series.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-10 text-center px-6">
            <Layers className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No series yet.</p>
            <p className="text-xs text-gray-300 mt-1">Plan a themed, multi-part arc to build a bigger idea over time.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {series.map((s) => (
              <SeriesCard key={s.id} series={s} onOpen={() => setDetailId(s.id)} onDelete={() => void handleDelete(s.id)} />
            ))}
          </div>
        )}
      </main>

      {creating && (
        <CreateSeriesModal
          onClose={() => setCreating(false)}
          onCreated={(s) => { setCreating(false); setSeries((prev) => [...prev, s]); setDetailId(s.id); }}
        />
      )}
      {pageTour}
    </AppShell>
  );
}

function SeriesCard({ series, onOpen, onDelete }: { series: Series; onOpen: () => void; onDelete: () => void }) {
  const isEndless = series.plannedParts === null;
  const pct = series.plannedParts && series.plannedParts > 0 ? Math.round((series.partsPublished / series.plannedParts) * 100) : 0;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 cursor-pointer hover:border-indigo-200 transition-colors" onClick={onOpen}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-gray-900 truncate">{series.title}</h3>
          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{series.theme}</p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-indigo-50 text-indigo-600">{FORMAT_LABELS[series.format]}</span>
        {series.targetAudience && <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-gray-50 text-gray-500">{series.targetAudience}</span>}
        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-gray-50 text-gray-500 capitalize">{series.status}</span>
        {isEndless && <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-violet-50 text-violet-600">Ongoing</span>}
      </div>
      <div className="mt-3">
        {isEndless ? (
          <p className="text-[10px] text-gray-400">{series.partsWritten} written · {series.partsPublished} published</p>
        ) : (
          <>
            <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
              <span>{series.partsPublished}/{series.plannedParts} published</span>
              <span>{pct}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </>
        )}
      </div>
      {series.performance.impressions > 0 && (
        <p className="text-[10px] text-gray-400 mt-2">
          {series.performance.impressions.toLocaleString()} impressions · {series.performance.reactions} reactions
        </p>
      )}
    </div>
  );
}

// Shared field set for both creating and editing a series.
function SeriesFormFields({
  title, setTitle, theme, setTheme, format, setFormat, topicId, setTopicId, topics,
  targetAudience, setTargetAudience, isEndless, setIsEndless, plannedParts, setPlannedParts,
  hook, setHook, rationale, inferring, onDetectFormat, titleTooShort, themeTooShort,
}: {
  title: string; setTitle: (v: string) => void;
  theme: string; setTheme: (v: string) => void;
  format: SeriesFormat; setFormat: (v: SeriesFormat) => void;
  topicId: number | null; setTopicId: (v: number | null) => void;
  topics: Topic[];
  targetAudience: string; setTargetAudience: (v: string) => void;
  isEndless: boolean; setIsEndless: (v: boolean) => void;
  plannedParts: number; setPlannedParts: (v: number) => void;
  hook: string; setHook: (v: string) => void;
  rationale: string; inferring: boolean; onDetectFormat: () => void;
  titleTooShort: boolean; themeTooShort: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-bold text-gray-500 mb-1.5 block">Title <span className="text-red-400">*</span> required</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. A conversation with my younger self"
          className="w-full text-sm rounded-2xl border border-gray-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <p className={cn("text-[10px] mt-1", titleTooShort && title.length > 0 ? "text-amber-500" : "text-gray-300")}>
          Min {MIN_TITLE_LENGTH} characters — a real premise, not a label ({title.trim().length}/{MIN_TITLE_LENGTH})
        </p>
      </div>

      <div>
        <label className="text-xs font-bold text-gray-500 mb-1.5 block">Theme <span className="text-red-400">*</span> required</label>
        <textarea
          value={theme}
          onChange={(e) => {
            setTheme(e.target.value);
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${el.scrollHeight}px`;
          }}
          rows={2}
          placeholder="What is this series really about?"
          className="w-full text-sm rounded-2xl border border-gray-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-y min-h-[4.5rem]"
        />
        <p className={cn("text-[10px] mt-1", themeTooShort && theme.length > 0 ? "text-amber-500" : "text-gray-300")}>
          Min {MIN_THEME_LENGTH} characters — the more specific, the better the plan and part-to-part continuity ({theme.trim().length}/{MIN_THEME_LENGTH})
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-bold text-gray-500 block">Format <span className="text-gray-300 font-medium">— optional</span></label>
          <button
            type="button"
            onClick={onDetectFormat}
            disabled={titleTooShort || themeTooShort || inferring}
            className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 disabled:text-gray-300 disabled:cursor-not-allowed hover:text-indigo-800 transition-colors"
          >
            <Sparkles className="w-3 h-3" /> {inferring ? "Detecting…" : "Detect from title & theme"}
          </button>
        </div>
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as SeriesFormat)}
          className="w-full text-sm rounded-2xl border border-gray-200 px-4 py-2.5 bg-white"
        >
          {Object.entries(FORMAT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        {titleTooShort || themeTooShort ? (
          <p className="text-[10px] text-gray-300 mt-1">Finish the title and theme above to enable detection.</p>
        ) : null}
        {!inferring && rationale && (
          <p className="text-[10px] text-indigo-500 mt-1 flex items-center gap-1"><Sparkles className="w-3 h-3" /> {rationale}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold text-gray-500 mb-1.5 block">Topic <span className="text-gray-300 font-medium">— optional</span></label>
          <select
            value={topicId ?? ""}
            onChange={(e) => setTopicId(e.target.value ? Number(e.target.value) : null)}
            className="w-full text-sm rounded-2xl border border-gray-200 px-3 py-2.5 bg-white"
          >
            <option value="">None</option>
            {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 mb-1.5 block">Audience <span className="text-gray-300 font-medium">— optional</span></label>
          <select
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            className="w-full text-sm rounded-2xl border border-gray-200 px-3 py-2.5 bg-white"
          >
            <option value="">Any</option>
            {AUDIENCES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-bold text-gray-500 block">Number of parts {!isEndless && <span className="text-red-400">*</span>}</label>
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 cursor-pointer">
            <input type="checkbox" checked={isEndless} onChange={(e) => setIsEndless(e.target.checked)} className="rounded" />
            Endless — keep adding parts, no fixed count
          </label>
        </div>
        {!isEndless && (
          <input
            type="number"
            min={1}
            max={1000}
            value={plannedParts}
            onChange={(e) => setPlannedParts(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))}
            className="w-24 text-sm rounded-2xl border border-gray-200 px-4 py-2.5"
          />
        )}
      </div>

      <div>
        <label className="text-xs font-bold text-gray-500 mb-1.5 block">Series hook <span className="text-gray-300 font-medium">— optional</span></label>
        <input
          value={hook}
          onChange={(e) => setHook(e.target.value)}
          placeholder="e.g. #JuniorPMDiaries or 🧵 Junior PM Diaries"
          className="w-full text-sm rounded-2xl border border-gray-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <p className="text-[10px] text-gray-300 mt-1">
          A short recurring tag repeated on every part so readers recognise it's the same series and can find the others — e.g. a dedicated hashtag or a one-line tagline.
        </p>
      </div>
    </div>
  );
}

// Reversible-close backdrop: only closes when both mousedown and click land
// exactly on the backdrop itself — otherwise starting a text-selection drag
// inside the modal and releasing outside it would close the modal and
// discard whatever had been typed.
function ModalBackdrop({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const mouseDownOnBackdrop = useRef(false);
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-6"
      onMouseDown={(e) => { mouseDownOnBackdrop.current = e.target === e.currentTarget; }}
      onClick={(e) => {
        if (e.target === e.currentTarget && mouseDownOnBackdrop.current) onClose();
        mouseDownOnBackdrop.current = false;
      }}
    >
      {children}
    </div>
  );
}

function CreateSeriesModal({ onClose, onCreated }: { onClose: () => void; onCreated: (s: Series) => void }) {
  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState("");
  const [topicId, setTopicId] = useState<number | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [targetAudience, setTargetAudience] = useState("");
  const [plannedParts, setPlannedParts] = useState(3);
  const [isEndless, setIsEndless] = useState(false);
  const [format, setFormat] = useState<SeriesFormat>("standard");
  const [rationale, setRationale] = useState("");
  const [inferring, setInferring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hook, setHook] = useState("");

  useEffect(() => {
    topicsApi.list().then(setTopics).catch(() => {});
  }, []);

  const titleTooShort = title.trim().length < MIN_TITLE_LENGTH;
  const themeTooShort = theme.trim().length < MIN_THEME_LENGTH;

  // Explicit, user-triggered only — this is a real AI call, so it must never
  // fire on passive events like blur/tab (that fired repeatedly and often
  // before the user had finished writing the title/theme).
  const handleDetectFormat = async () => {
    if (titleTooShort || themeTooShort || inferring) return;
    setInferring(true);
    try {
      const result = await seriesApi.inferFormat(title.trim(), theme.trim());
      setFormat(result.format);
      setRationale(result.rationale);
    } catch {
      // silent — format defaults to standard, user can still pick manually
    } finally {
      setInferring(false);
    }
  };

  const handleCreate = async () => {
    if (titleTooShort || themeTooShort || saving) return;
    setSaving(true);
    try {
      const created = await seriesApi.create({
        title: title.trim(),
        theme: theme.trim(),
        topicId,
        targetAudience: targetAudience || null,
        format,
        plannedParts: isEndless ? null : plannedParts,
        hook: hook.trim() || null,
      });
      onCreated(created);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold text-gray-900">New series</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
        </div>

        <SeriesFormFields
          title={title} setTitle={setTitle}
          theme={theme} setTheme={setTheme}
          format={format} setFormat={setFormat}
          topicId={topicId} setTopicId={setTopicId} topics={topics}
          targetAudience={targetAudience} setTargetAudience={setTargetAudience}
          isEndless={isEndless} setIsEndless={setIsEndless}
          plannedParts={plannedParts} setPlannedParts={setPlannedParts}
          hook={hook} setHook={setHook}
          rationale={rationale} inferring={inferring} onDetectFormat={() => void handleDetectFormat()}
          titleTooShort={titleTooShort} themeTooShort={themeTooShort}
        />

        <Button
          onClick={() => void handleCreate()}
          disabled={saving || titleTooShort || themeTooShort}
          className="w-full rounded-2xl font-bold mt-4"
        >
          {saving ? "Creating…" : "Create series"}
        </Button>
      </div>
    </ModalBackdrop>
  );
}

// Fields whose change materially affects what a "good" angle looks like —
// editing any of these makes existing unwritten suggestions worth revisiting.
function angleRelevantFieldsChanged(a: Series, b: { title: string; theme: string; format: SeriesFormat; targetAudience: string }): boolean {
  return a.title !== b.title || a.theme !== b.theme || a.format !== b.format || (a.targetAudience ?? "") !== b.targetAudience;
}

function EditSeriesModal({
  series, onClose, onSaved,
}: {
  series: Series;
  onClose: () => void;
  onSaved: (updated: Series, angleRelevantChange: boolean) => void;
}) {
  const [title, setTitle] = useState(series.title);
  const [theme, setTheme] = useState(series.theme);
  const [topicId, setTopicId] = useState<number | null>(series.topicId);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [targetAudience, setTargetAudience] = useState(series.targetAudience ?? "");
  const [plannedParts, setPlannedParts] = useState(series.plannedParts ?? 3);
  const [isEndless, setIsEndless] = useState(series.plannedParts === null);
  const [format, setFormat] = useState<SeriesFormat>(series.format);
  const [rationale, setRationale] = useState("");
  const [inferring, setInferring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hook, setHook] = useState(series.hook ?? "");

  useEffect(() => {
    topicsApi.list().then(setTopics).catch(() => {});
  }, []);

  const titleTooShort = title.trim().length < MIN_TITLE_LENGTH;
  const themeTooShort = theme.trim().length < MIN_THEME_LENGTH;

  const handleDetectFormat = async () => {
    if (titleTooShort || themeTooShort || inferring) return;
    setInferring(true);
    try {
      const result = await seriesApi.inferFormat(title.trim(), theme.trim());
      setFormat(result.format);
      setRationale(result.rationale);
    } catch {
      // silent
    } finally {
      setInferring(false);
    }
  };

  const handleSave = async () => {
    if (titleTooShort || themeTooShort || saving) return;
    setSaving(true);
    try {
      const nextValues = { title: title.trim(), theme: theme.trim(), format, targetAudience };
      const angleRelevantChange = angleRelevantFieldsChanged(series, nextValues);
      const updated = await seriesApi.update(series.id, {
        title: nextValues.title,
        theme: nextValues.theme,
        topicId,
        targetAudience: targetAudience || null,
        format,
        plannedParts: isEndless ? null : plannedParts,
        hook: hook.trim() || null,
      });
      onSaved(updated, angleRelevantChange);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold text-gray-900">Edit series</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
        </div>

        <p className="text-[11px] text-gray-400 mb-4">
          Already-written and published parts stay exactly as they are in your Library — editing the series only affects the definition and any unwritten suggested angles.
        </p>

        <SeriesFormFields
          title={title} setTitle={setTitle}
          theme={theme} setTheme={setTheme}
          format={format} setFormat={setFormat}
          topicId={topicId} setTopicId={setTopicId} topics={topics}
          targetAudience={targetAudience} setTargetAudience={setTargetAudience}
          isEndless={isEndless} setIsEndless={setIsEndless}
          plannedParts={plannedParts} setPlannedParts={setPlannedParts}
          hook={hook} setHook={setHook}
          rationale={rationale} inferring={inferring} onDetectFormat={() => void handleDetectFormat()}
          titleTooShort={titleTooShort} themeTooShort={themeTooShort}
        />

        <Button
          onClick={() => void handleSave()}
          disabled={saving || titleTooShort || themeTooShort}
          className="w-full rounded-2xl font-bold mt-4"
        >
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </ModalBackdrop>
  );
}

function SeriesDetailView({ id, onBack }: { id: number; onBack: () => void }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [detail, setDetail] = useState<SeriesDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [plannedAngles, setPlannedAngles] = useState<PlannedPart[]>([]);
  const [editingPart, setEditingPart] = useState<number | null>(null);
  const [editingAngleText, setEditingAngleText] = useState("");
  const [editingHook, setEditingHook] = useState(false);
  const [hookDraft, setHookDraft] = useState("");
  const [editingSeries, setEditingSeries] = useState(false);
  const [resetPrompt, setResetPrompt] = useState(false);
  const [guidance, setGuidance] = useState("");

  const load = () =>
    seriesApi.get(id).then((d) => {
      setDetail(d);
      setPlannedAngles(d.plannedAngles ?? []);
    }).catch(() => {});

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [id]);

  const handlePlan = async (scope: "all" | "remaining") => {
    setPlanning(true);
    try {
      const { parts } = await seriesApi.plan(id, { scope, guidance: guidance.trim() || undefined });
      setPlannedAngles(parts);
    } catch (err) {
      toast({ title: "Couldn't generate suggestions", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" });
    } finally {
      setPlanning(false);
    }
  };

  const handleSeriesSaved = (updated: Series, angleRelevantChange: boolean) => {
    setDetail((prev) => (prev ? { ...prev, ...updated } : prev));
    setEditingSeries(false);
    // Only worth asking if there's actually something unwritten to reset —
    // written/published parts in the Library are never touched either way.
    const hasUnwrittenSuggestions = plannedAngles.some((p) => !detail?.parts.some((part) => part.seriesPart === p.part));
    if (angleRelevantChange && hasUnwrittenSuggestions) setResetPrompt(true);
  };

  const handleResetAngles = async () => {
    setResetPrompt(false);
    const writtenNums = new Set((detail?.parts ?? []).map((p) => p.seriesPart));
    const next = plannedAngles.filter((p) => writtenNums.has(p.part));
    setPlannedAngles(next);
    try {
      await seriesApi.update(id, { plannedAngles: next.length > 0 ? next : null });
    } catch { /* local state already reflects the reset */ }
  };

  // Persist an edited (or newly-planned) set of angles so they survive reload,
  // and so a re-write of a part keeps whatever the user last tweaked.
  const persistAngles = async (next: PlannedPart[]) => {
    setPlannedAngles(next);
    try {
      await seriesApi.update(id, { plannedAngles: next });
    } catch { /* local state still reflects the edit even if the save fails */ }
  };

  const startEditingAngle = (part: number, currentAngle: string) => {
    setEditingPart(part);
    setEditingAngleText(currentAngle);
  };

  const saveEditingAngle = () => {
    if (editingPart === null) return;
    const trimmed = editingAngleText.trim();
    if (!trimmed) { setEditingPart(null); return; }
    const next = plannedAngles.some((p) => p.part === editingPart)
      ? plannedAngles.map((p) => (p.part === editingPart ? { ...p, angle: trimmed } : p))
      : [...plannedAngles, { part: editingPart, angle: trimmed }];
    void persistAngles(next);
    setEditingPart(null);
  };

  const saveHook = async () => {
    if (!detail) return;
    const trimmed = hookDraft.trim();
    setDetail({ ...detail, hook: trimmed || null });
    setEditingHook(false);
    try {
      await seriesApi.update(id, { hook: trimmed || null });
    } catch { /* local state already reflects the edit */ }
  };

  const handleWritePart = (part: number, angle?: string) => {
    if (!detail) return;
    const params = new URLSearchParams({
      seriesId: String(detail.id),
      seriesPart: String(part),
    });
    if (detail.topicId) params.set("topicId", String(detail.topicId));
    if (angle) params.set("raw", angle);
    if (detail.hook) params.set("seriesHook", detail.hook);
    navigate(`/capture?${params.toString()}`);
  };

  if (loading || !detail) {
    return (
      <AppShell>
        <div className="p-6 space-y-3"><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" /></div>
      </AppShell>
    );
  }

  const isEndlessDetail = detail.plannedParts === null;
  let partNumbers: number[];
  if (detail.plannedParts === null) {
    // No fixed total — show every written or suggested part, plus one open
    // slot at the end so there's always a "next part" to write or suggest.
    const writtenNums = detail.parts.map((p) => p.seriesPart).filter((n): n is number => n !== null);
    const suggestedNums = plannedAngles.map((p) => p.part);
    const known = Array.from(new Set([...writtenNums, ...suggestedNums])).sort((a, b) => a - b);
    const maxNum = known.length > 0 ? known[known.length - 1] : 0;
    partNumbers = [...known, maxNum + 1];
  } else {
    partNumbers = Array.from({ length: detail.plannedParts }, (_, i) => i + 1);
  }

  const writtenPartNumsForGate = new Set(detail.parts.map((p) => p.seriesPart));
  const unwrittenSuggestedCount = plannedAngles.filter((p) => !writtenPartNumsForGate.has(p.part)).length;
  const unloggedPublishedCount = detail.parts.filter((p) => p.status === "published" && p.impressions === null).length;

  return (
    <AppShell>
      <header className="px-6 pt-12 pb-5 bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-1">
          <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-extrabold text-gray-900 truncate flex-1">{detail.title}</h1>
          <button
            onClick={() => setEditingSeries(true)}
            className="flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-indigo-600 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
        </div>
        <p className="text-sm text-gray-400 ml-11 line-clamp-1">{detail.theme}</p>
      </header>

      {editingSeries && (
        <EditSeriesModal series={detail} onClose={() => setEditingSeries(false)} onSaved={handleSeriesSaved} />
      )}

      {resetPrompt && (
        <ModalBackdrop onClose={() => setResetPrompt(false)}>
          <div className="bg-white rounded-3xl w-full sm:max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-extrabold text-gray-900 mb-2">Reset unwritten suggestions?</h3>
            <p className="text-sm text-gray-500 mb-5">
              You changed the title, theme, format, or audience. Your existing unwritten suggested angles were based on the old version — reset them so the next suggestion pass reflects the update, or keep them as-is.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl font-bold" onClick={() => setResetPrompt(false)}>
                Keep as-is
              </Button>
              <Button className="flex-1 rounded-xl font-bold" onClick={() => void handleResetAngles()}>
                Reset suggestions
              </Button>
            </div>
          </div>
        </ModalBackdrop>
      )}

      <main className="flex-1 px-5 py-5 overflow-y-auto space-y-5">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Series hook</p>
          {editingHook ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={hookDraft}
                onChange={(e) => setHookDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void saveHook(); if (e.key === "Escape") setEditingHook(false); }}
                placeholder="e.g. #JuniorPMDiaries or 🧵 Junior PM Diaries"
                className="flex-1 text-sm rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <button onClick={() => void saveHook()} className="p-2 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100"><Check className="w-4 h-4" /></button>
            </div>
          ) : (
            <button
              onClick={() => { setHookDraft(detail.hook ?? ""); setEditingHook(true); }}
              className="flex items-center gap-2 text-sm text-gray-700 hover:text-indigo-600 transition-colors group"
            >
              {detail.hook ? <span className="font-semibold">{detail.hook}</span> : <span className="text-gray-300">No hook set — add a recurring tag so parts are recognisable</span>}
              <Pencil className="w-3 h-3 text-gray-300 group-hover:text-indigo-400 flex-shrink-0" />
            </button>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div><p className="text-lg font-extrabold text-gray-900">{detail.partsWritten}{!isEndlessDetail && `/${detail.plannedParts}`}</p><p className="text-[10px] text-gray-400">written</p></div>
            <div><p className="text-lg font-extrabold text-gray-900">{detail.partsPublished}{!isEndlessDetail && `/${detail.plannedParts}`}</p><p className="text-[10px] text-gray-400">published</p></div>
            <div><p className="text-lg font-extrabold text-gray-900">{detail.performance.impressions.toLocaleString()}</p><p className="text-[10px] text-gray-400">impressions</p></div>
          </div>
          {detail.performance.impressions > 0 && (
            <div className="flex items-center justify-center gap-3 mt-3 text-[11px] text-gray-400">
              <span>{detail.performance.reactions} reactions</span>
              <span>{detail.performance.comments} comments</span>
              <span>{detail.performance.reposts} reposts</span>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <div>
            <label className="text-xs font-bold text-gray-500 mb-1.5 block">Steer this batch <span className="text-gray-300 font-medium">— optional</span></label>
            <input
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
              placeholder="e.g. cover our new pricing model next — leave blank to let it build from the theme alone"
              className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <p className="text-[10px] text-gray-300 mt-1">
              Give it a direction if you have one in mind, or leave it empty and it'll build fully from the series theme{plannedAngles.length > 0 ? " — either way it picks up from what's already suggested." : "."}
            </p>
          </div>
          {(detail.performance.reactions > 0 || detail.performance.impressions > 0) && (
            <p className="text-[10px] text-violet-500 flex items-center gap-1">
              <Sparkles className="w-3 h-3 flex-shrink-0" /> Suggestions factor in how your published parts have performed so far.
            </p>
          )}
          {isEndlessDetail && unloggedPublishedCount > 0 && (
            <p className="text-[10px] text-amber-500 flex items-center gap-1">
              <Sparkles className="w-3 h-3 flex-shrink-0" /> Log performance on your {unloggedPublishedCount} published part{unloggedPublishedCount !== 1 ? "s" : ""} in Library for sharper future suggestions.
            </p>
          )}
          {isEndlessDetail ? (
            <>
              <Button
                onClick={() => void handlePlan("remaining")}
                disabled={planning || unwrittenSuggestedCount > 0}
                variant="outline"
                className="w-full rounded-xl font-bold gap-2"
              >
                <Sparkles className="w-4 h-4" /> {planning ? "Planning…" : plannedAngles.length === 0 ? "Suggest next 5 angles" : "Suggest 5 more angles"}
              </Button>
              {unwrittenSuggestedCount > 0 && (
                <p className="text-[10px] text-gray-400">
                  You have {unwrittenSuggestedCount} unwritten suggestion{unwrittenSuggestedCount !== 1 ? "s" : ""} below — write or edit those before generating more. Keeps batches purposeful and API usage efficient.
                </p>
              )}
            </>
          ) : (
            <div className="flex gap-2">
              <Button onClick={() => void handlePlan("remaining")} disabled={planning} variant="outline" className="flex-1 rounded-xl font-bold gap-2 text-xs">
                <Sparkles className="w-3.5 h-3.5" /> {planning ? "Planning…" : "Suggest remaining only"}
              </Button>
              <Button onClick={() => void handlePlan("all")} disabled={planning} variant="outline" className="flex-1 rounded-xl font-bold gap-2 text-xs">
                <Sparkles className="w-3.5 h-3.5" /> {planning ? "Planning…" : "Regenerate all unwritten"}
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          {partNumbers.map((num) => {
            const existing = detail.parts.find((p) => p.seriesPart === num);
            const suggested = plannedAngles.find((p) => p.part === num);
            const isEditing = editingPart === num;
            return (
              <div key={num} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                  existing ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-400"
                )}>
                  {num}
                </div>
                <div className="min-w-0 flex-1">
                  {existing ? (
                    <>
                      <p className="text-xs font-bold text-gray-700 capitalize">{existing.status}</p>
                      {existing.postOutput && <p className="text-xs text-gray-400 line-clamp-1">{existing.postOutput}</p>}
                    </>
                  ) : isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={editingAngleText}
                        onChange={(e) => setEditingAngleText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveEditingAngle(); if (e.key === "Escape") setEditingPart(null); }}
                        className="flex-1 text-xs rounded-lg border border-gray-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                      <button onClick={saveEditingAngle} className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex-shrink-0"><Check className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : suggested ? (
                    <button
                      onClick={() => startEditingAngle(num, suggested.angle)}
                      className="flex items-center gap-1.5 text-left group w-full"
                    >
                      <p className="text-xs text-gray-500 line-clamp-2 flex-1">{suggested.angle}</p>
                      <Pencil className="w-3 h-3 text-gray-300 group-hover:text-indigo-400 flex-shrink-0" />
                    </button>
                  ) : (
                    <button
                      onClick={() => startEditingAngle(num, "")}
                      className="text-xs text-gray-300 hover:text-indigo-500 transition-colors"
                    >
                      Not written yet — click to add an angle
                    </button>
                  )}
                </div>
                {!existing && !isEditing && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl text-xs flex-shrink-0"
                    onClick={() => handleWritePart(num, suggested?.angle)}
                  >
                    Write
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </AppShell>
  );
}
