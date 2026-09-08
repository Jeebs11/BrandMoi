import { useRef, useState } from "react";
import { Upload, FileText, Loader2, AlertCircle, Check, RefreshCw, ClipboardPaste } from "lucide-react";
import { cn } from "@/lib/utils";
import { profileAlignmentApi, type ProfileFacts } from "@/lib/api";

interface Props {
  kind: "cv" | "linkedin";
  onSuccess: (facts: ProfileFacts) => void;
}

type State =
  | { phase: "idle" }
  | { phase: "pasting" }
  | { phase: "loading"; filename?: string }
  | { phase: "success"; filename?: string; data: ProfileFacts }
  | { phase: "error"; message: string };

const LABEL = { cv: "CV", linkedin: "LinkedIn profile" };

export function ProfileAlignmentUpload({ kind, onSuccess }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ phase: "idle" });
  const [pasteText, setPasteText] = useState("");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!e.target) return;
    e.target.value = "";
    if (!file) return;

    setState({ phase: "loading", filename: file.name });
    try {
      const data = kind === "cv" ? await profileAlignmentApi.uploadCv(file) : await profileAlignmentApi.uploadLinkedin(file);
      setState({ phase: "success", filename: file.name, data });
      onSuccess(data);
    } catch (err) {
      setState({ phase: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  };

  const handlePasteSubmit = async () => {
    if (pasteText.trim().length < 100) return;
    setState({ phase: "loading" });
    try {
      const data = await profileAlignmentApi.pasteLinkedin(pasteText.trim());
      setState({ phase: "success", data });
      onSuccess(data);
    } catch (err) {
      setState({ phase: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" accept=".pdf,.docx,.doc,.txt" className="hidden" onChange={handleFileChange} />

      {state.phase === "idle" && (
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 text-primary font-bold text-sm hover:bg-primary/10 hover:border-primary/50 transition-all"
          >
            <Upload className="w-4 h-4" />
            Upload {LABEL[kind]} {kind === "cv" ? "(PDF/DOCX/TXT)" : "PDF export"}
          </button>
          {kind === "linkedin" && (
            <button
              type="button"
              onClick={() => setState({ phase: "pasting" })}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-gray-500 hover:text-primary transition-colors"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              Or paste your profile text instead (more reliable than a PDF export)
            </button>
          )}
        </div>
      )}

      {state.phase === "pasting" && (
        <div className="space-y-2">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste your Headline, About, and current role text from your LinkedIn profile…"
            className="w-full h-32 rounded-2xl border-2 border-primary/20 p-3 text-sm text-gray-800 focus:outline-none focus:border-primary/50"
          />
          <div className="flex gap-2">
            <button
              onClick={() => { setState({ phase: "idle" }); setPasteText(""); }}
              className="flex-1 py-2 rounded-xl border-2 border-gray-200 text-gray-600 font-bold text-xs hover:border-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => void handlePasteSubmit()}
              disabled={pasteText.trim().length < 100}
              className="flex-1 py-2 rounded-xl bg-primary text-white font-bold text-xs disabled:opacity-40 hover:bg-primary/90 transition-colors"
            >
              Use this text
            </button>
          </div>
        </div>
      )}

      {state.phase === "loading" && (
        <div className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-2xl bg-primary/5 border-2 border-primary/20">
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
          <div className="text-left">
            <p className="text-sm font-bold text-primary">Reading your {LABEL[kind].toLowerCase()}…</p>
            {state.filename && <p className="text-[11px] text-primary/60 truncate max-w-[240px]">{state.filename}</p>}
          </div>
        </div>
      )}

      {state.phase === "error" && (
        <div className="w-full rounded-2xl border-2 border-red-100 bg-red-50 p-4">
          <div className="flex items-start gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 font-medium">{state.message}</p>
          </div>
          <button onClick={() => setState({ phase: "idle" })} className="text-xs font-bold text-red-500 hover:text-red-700 transition-colors">
            Try again
          </button>
        </div>
      )}

      {state.phase === "success" && (
        <div className="w-full rounded-2xl border-2 border-emerald-200 bg-emerald-50/60 overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <div>
                <p className="text-xs font-black text-emerald-700">{LABEL[kind]} saved</p>
                {state.filename && (
                  <p className="text-[10px] text-emerald-600/70 flex items-center gap-1 mt-0.5">
                    <FileText className="w-2.5 h-2.5" />
                    {state.filename}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => setState({ phase: "idle" })}
              className={cn("flex items-center gap-1 text-[11px] font-semibold text-emerald-700/70 hover:text-emerald-800 transition-colors")}
            >
              <RefreshCw className="w-3 h-3" /> Replace
            </button>
          </div>
          {state.data.currentTitle && (
            <div className="px-4 pb-3 text-xs text-emerald-800/80">
              Read: <span className="font-semibold">{state.data.currentTitle}</span>
              {state.data.currentEmployer ? ` at ${state.data.currentEmployer}` : ""}
            </div>
          )}
        </div>
      )}
    </>
  );
}
