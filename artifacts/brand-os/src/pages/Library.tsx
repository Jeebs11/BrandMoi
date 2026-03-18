import { useState } from "react";
import { useLocation } from "wouter";
import { Pencil, Trash2, MoreVertical, CheckCircle2, Clock, FileText, BookOpen } from "lucide-react";
import { useListDrafts, useDeleteDraft, useUpdateDraft } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BottomNav } from "@/components/BottomNav";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const OBJECTIVES = ["All", "Clients", "Job", "Authority", "Documenting"];
const STATUSES = ["All", "draft", "ready", "published"];

const OBJECTIVE_COLORS: Record<string, string> = {
  Clients: "bg-amber-50 text-amber-700",
  Job: "bg-sky-50 text-sky-700",
  Authority: "bg-violet-50 text-violet-700",
  Documenting: "bg-emerald-50 text-emerald-700",
};

const STATUS_ICONS: Record<string, typeof FileText> = {
  draft: FileText,
  ready: Clock,
  published: CheckCircle2,
};

const STATUS_COLORS: Record<string, string> = {
  draft: "text-gray-500",
  ready: "text-blue-500",
  published: "text-green-600",
};

export default function Library() {
  const [, navigate] = useLocation();
  const [objFilter, setObjFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data: drafts, isLoading, refetch } = useListDrafts();
  const { mutate: deleteDraft, isPending: isDeleting } = useDeleteDraft();
  const { mutate: updateDraft } = useUpdateDraft();

  const filtered = (drafts ?? []).filter((d) => {
    if (objFilter !== "All" && d.objective !== objFilter) return false;
    if (statusFilter !== "All" && d.status !== statusFilter) return false;
    return true;
  });

  const handleDelete = (id: number) => {
    setDeletingId(id);
    deleteDraft(
      { id },
      {
        onSuccess: () => { setDeletingId(null); refetch(); },
        onError: () => setDeletingId(null),
      }
    );
  };

  const handleStatusChange = (id: number, status: "draft" | "ready" | "published") => {
    updateDraft(
      { id, data: { status } },
      { onSuccess: () => refetch() }
    );
  };

  return (
    <div className="min-h-screen bg-[#EDEDEE] flex justify-center">
      <div className="w-full max-w-[430px] bg-gray-50 min-h-screen shadow-2xl flex flex-col border-x border-gray-200 pb-20">
        <header className="px-6 pt-12 pb-4 bg-white border-b border-gray-100 sticky top-0 z-10">
          <div className="flex items-center gap-3 mb-4">
            <BookOpen className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-extrabold text-gray-900">Library</h1>
          </div>
          <div className="space-y-2">
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {OBJECTIVES.map((o) => (
                <button key={o} onClick={() => setObjFilter(o)}
                  className={cn("px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border",
                    objFilter === o ? "bg-primary text-white border-primary" : "bg-white text-gray-500 border-gray-200 hover:border-primary/40")}
                >{o}</button>
              ))}
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {STATUSES.map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={cn("px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border capitalize",
                    statusFilter === s ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-500 border-gray-200 hover:border-gray-400")}
                >{s}</button>
              ))}
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-4 space-y-3 overflow-y-auto">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center px-8">
              <BookOpen className="w-12 h-12 text-gray-200 mb-4" />
              <p className="font-bold text-gray-600 mb-1">Nothing here yet</p>
              <p className="text-sm text-gray-400">
                {objFilter !== "All" || statusFilter !== "All" ? "Try adjusting your filters." : "Capture an idea to get started."}
              </p>
            </div>
          ) : (
            filtered.map((draft) => {
              const topic = (draft.structuredBreakdown as { topic?: string })?.topic ?? "Untitled";
              const StatusIcon = STATUS_ICONS[draft.status] ?? FileText;
              const isBeingDeleted = deletingId === draft.id && isDeleting;
              return (
                <div key={draft.id} className={cn("bg-white rounded-2xl border border-gray-100 p-4 transition-opacity", isBeingDeleted && "opacity-40")}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-gray-900 truncate mb-1">{topic}</p>
                      <div className="flex items-center gap-2">
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", OBJECTIVE_COLORS[draft.objective] ?? "bg-gray-100 text-gray-600")}>
                          {draft.objective}
                        </span>
                        <div className={cn("flex items-center gap-1 text-[10px] font-bold capitalize", STATUS_COLORS[draft.status])}>
                          <StatusIcon className="w-3 h-3" />
                          {draft.status}
                        </div>
                        <span className="text-[10px] text-gray-300">
                          {new Date(draft.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors flex-shrink-0">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[180px]">
                        <DropdownMenuItem onClick={() => navigate(`/capture?draftId=${draft.id}`)}>
                          <Pencil className="w-4 h-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {draft.status !== "draft" && (
                          <DropdownMenuItem onClick={() => handleStatusChange(draft.id, "draft")}>
                            <FileText className="w-4 h-4 mr-2 text-gray-500" /> Mark as Draft
                          </DropdownMenuItem>
                        )}
                        {draft.status !== "ready" && (
                          <DropdownMenuItem onClick={() => handleStatusChange(draft.id, "ready")}>
                            <Clock className="w-4 h-4 mr-2 text-blue-500" /> Mark as Ready
                          </DropdownMenuItem>
                        )}
                        {draft.status !== "published" && (
                          <DropdownMenuItem onClick={() => handleStatusChange(draft.id, "published")}>
                            <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" /> Mark as Published
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600 focus:bg-red-50"
                          onClick={() => {
                            if (confirm(`Delete "${topic}"? This can't be undone.`)) handleDelete(draft.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })
          )}
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
