import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Lightbulb, Plus, Trash2, ArrowRight, CheckCircle2, ChevronLeft, Lock, Pencil, X, Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AppShell } from "@/components/AppShell";
import { usePageTour } from "@/components/tour/usePageTour";
import { VAULT_TOUR_STEPS } from "@/components/tour/page-tours";
import { cn } from "@/lib/utils";
import { thoughtsApi, type Thought } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { trackEvent } from "@/lib/analytics";

export default function Vault() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const isDemo = user?.email === "demo@brandos.app";
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [developingId, setDevelopingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    thoughtsApi.list().then((data) => {
      setThoughts(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleCapture = async () => {
    if (!input.trim() || saving) return;
    setSaving(true);
    try {
      const thought = await thoughtsApi.create(input.trim());
      setThoughts((prev) => [thought, ...prev]);
      setInput("");
      textareaRef.current?.focus();
      trackEvent("vault_idea_captured");
    } finally {
      setSaving(false);
    }
  };

  const handleDevelop = (thought: Thought) => {
    const encoded = encodeURIComponent(thought.content);
    trackEvent("vault_idea_developed");
    navigate(`/capture?thought=${encoded}&thoughtId=${thought.id}`);
  };

  const handleMarkDeveloped = async (id: number) => {
    setDevelopingId(id);
    try {
      await thoughtsApi.markDeveloped(id);
      setThoughts((prev) => prev.map((t) => (t.id === id ? { ...t, developed: true } : t)));
      trackEvent("vault_idea_marked_developed");
    } finally {
      setDevelopingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await thoughtsApi.delete(id);
      setThoughts((prev) => prev.filter((t) => t.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = async (id: number, content: string) => {
    const updated = await thoughtsApi.update(id, content);
    setThoughts((prev) => prev.map((t) => (t.id === id ? { ...t, content: updated.content } : t)));
  };

  const undeveloped = thoughts.filter((t) => !t.developed);
  const developed = thoughts.filter((t) => t.developed);
  const pageTour = usePageTour("vault-tour", VAULT_TOUR_STEPS);

  return (
    <AppShell>
        <header className="px-6 pt-12 pb-5 bg-white border-b border-gray-100 sticky top-0 z-10">
          <div className="flex items-center gap-3 mb-1">
            <button onClick={() => navigate("/")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <Lightbulb className="w-5 h-5 text-amber-500" />
            <h1 className="text-xl font-extrabold text-gray-900">Thought Vault</h1>
          </div>
          <p className="text-sm text-gray-400 ml-11">Capture raw ideas. Develop the best ones.</p>
        </header>

        <main className="flex-1 px-5 py-5 overflow-y-auto space-y-6">
          {/* Quick capture input — hidden for demo users */}
          {isDemo ? (
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              <Lock className="w-4 h-4 flex-shrink-0 text-amber-500" />
              <span>Vault capture is view-only in demo mode. <a href="/signup" className="font-semibold underline underline-offset-2">Sign up free</a> to capture your own ideas.</span>
            </div>
          ) : (
            <div data-tour="vault-capture" className="bg-white rounded-2xl border-2 border-gray-100 focus-within:border-primary/40 transition-colors shadow-sm">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void handleCapture();
                  }
                }}
                placeholder="Drop a half-formed idea, question, or observation — no editing needed..."
                rows={3}
                className="w-full px-4 pt-4 pb-2 text-sm text-gray-800 placeholder:text-gray-300 bg-transparent outline-none resize-none leading-relaxed"
              />
              <div className="flex items-center justify-between px-4 pb-3">
                <span className="text-[10px] text-gray-300 font-medium">⌘↵ to save</span>
                <button
                  onClick={() => void handleCapture()}
                  disabled={!input.trim() || saving}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                    input.trim() && !saving
                      ? "bg-primary text-white hover:bg-primary/90"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  )}
                >
                  <Plus className="w-3.5 h-3.5" />
                  {saving ? "Saving..." : "Capture"}
                </button>
              </div>
            </div>
          )}

          {/* Undeveloped thoughts */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-black uppercase tracking-wider text-gray-500">
                Raw Ideas
                {undeveloped.length > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px]">
                    {undeveloped.length}
                  </span>
                )}
              </h2>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
              </div>
            ) : undeveloped.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-10 text-center px-6">
                <Lightbulb className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No raw ideas yet.</p>
                <p className="text-xs text-gray-300 mt-1">Capture a thought above to get started.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {undeveloped.map((thought) => (
                  <ThoughtCard
                    key={thought.id}
                    thought={thought}
                    onDevelop={() => handleDevelop(thought)}
                    onMarkDeveloped={() => void handleMarkDeveloped(thought.id)}
                    onDelete={() => void handleDelete(thought.id)}
                    onEdit={(content) => handleEdit(thought.id, content)}
                    developingId={developingId}
                    deletingId={deletingId}
                    isDemo={isDemo}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Developed thoughts */}
          {developed.length > 0 && (
            <section>
              <h2 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3">Developed</h2>
              <div className="space-y-2 opacity-60">
                {developed.map((thought) => (
                  <div key={thought.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <p className="text-sm text-gray-500 flex-1 line-clamp-2">{thought.content}</p>
                    {!isDemo && (
                      <button
                        onClick={() => void handleDelete(thought.id)}
                        disabled={deletingId === thought.id}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>

      {pageTour}
    </AppShell>
  );
}

function ThoughtCard({
  thought, onDevelop, onMarkDeveloped, onDelete, onEdit, developingId, deletingId, isDemo,
}: {
  thought: Thought;
  onDevelop: () => void;
  onMarkDeveloped: () => void;
  onDelete: () => void;
  onEdit: (content: string) => Promise<void>;
  developingId: number | null;
  deletingId: number | null;
  isDemo: boolean;
}) {
  const daysOld = Math.floor((Date.now() - new Date(thought.createdAt).getTime()) / (1000 * 60 * 60 * 24));
  const isRipe = daysOld >= 2;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(thought.content);
  const [savingEdit, setSavingEdit] = useState(false);

  const saveEdit = async () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === thought.content) { setEditing(false); setDraft(thought.content); return; }
    setSavingEdit(true);
    try {
      await onEdit(trimmed);
      setEditing(false);
    } catch {
      // keep editing open on failure so the user doesn't lose their text
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className={cn("bg-white rounded-2xl border p-4 transition-all", isRipe ? "border-amber-200 shadow-sm" : "border-gray-100")}>
      {isRipe && (
        <div className="flex items-center gap-1 mb-2">
          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
            Ripe · {daysOld}d old
          </span>
        </div>
      )}

      {editing ? (
        <div className="mb-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void saveEdit(); }
              if (e.key === "Escape") { setEditing(false); setDraft(thought.content); }
            }}
            rows={4}
            maxLength={2000}
            autoFocus
            className="w-full text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-primary/40 resize-none leading-relaxed"
          />
          <div className="flex items-center justify-end gap-2 mt-2">
            <button
              onClick={() => { setEditing(false); setDraft(thought.content); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-400 hover:text-gray-700 transition-colors"
            >
              <X className="w-3 h-3" /> Cancel
            </button>
            <button
              onClick={() => void saveEdit()}
              disabled={savingEdit || !draft.trim()}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Check className="w-3 h-3" /> {savingEdit ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-800 leading-relaxed mb-3 whitespace-pre-wrap">{thought.content}</p>
      )}

      {!editing && (
        <div className="flex items-center gap-2">
          <button
            onClick={onDevelop}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-xs font-bold transition-colors"
          >
            Develop <ArrowRight className="w-3 h-3" />
          </button>
          {!isDemo && (
            <button
              onClick={onMarkDeveloped}
              disabled={developingId === thought.id}
              className="flex items-center gap-1 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-600 rounded-xl text-xs font-bold transition-colors"
            >
              <CheckCircle2 className="w-3 h-3" /> Done
            </button>
          )}
          <div className="flex-1" />
          {!isDemo && (
            <button
              onClick={() => { setDraft(thought.content); setEditing(true); }}
              className="p-2 rounded-xl hover:bg-gray-100 text-gray-300 hover:text-gray-600 transition-colors"
              title="Edit"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {!isDemo && (
            <button
              onClick={onDelete}
              disabled={deletingId === thought.id}
              className="p-2 rounded-xl hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <span className="text-[10px] text-gray-300 font-medium">
            {new Date(thought.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        </div>
      )}
    </div>
  );
}
