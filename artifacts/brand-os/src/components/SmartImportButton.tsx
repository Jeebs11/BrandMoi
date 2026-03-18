import { useRef, useState } from "react";
import { Upload, Sparkles, X, Check, FileText, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { smartImportApi, type ExtractedBrandVoice } from "@/lib/api";

interface Props {
  onApply: (data: ExtractedBrandVoice) => void;
}

type State =
  | { phase: "idle" }
  | { phase: "loading"; filename: string }
  | { phase: "preview"; filename: string; data: ExtractedBrandVoice }
  | { phase: "error"; message: string };

const FIELD_LABELS: Array<{ key: keyof ExtractedBrandVoice; label: string; sub?: boolean }> = [
  { key: "summary",       label: "Overview",       sub: true },
  { key: "brandRole",     label: "Your role" },
  { key: "brandAudience", label: "Your audience" },
  { key: "brandBelief",   label: "Your core belief" },
  { key: "objective",     label: "Objective" },
  { key: "persona",       label: "Persona" },
  { key: "tone",          label: "Tone" },
];

export function SmartImportButton({ onApply }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ phase: "idle" });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!e.target) return;
    e.target.value = "";
    if (!file) return;

    setState({ phase: "loading", filename: file.name });

    try {
      const data = await smartImportApi.extract(file);
      setState({ phase: "preview", filename: file.name, data });
    } catch (err) {
      setState({ phase: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  };

  const handleApply = () => {
    if (state.phase !== "preview") return;
    onApply(state.data);
    setState({ phase: "idle" });
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.doc,.txt"
        className="hidden"
        onChange={handleFileChange}
      />

      {state.phase === "idle" && (
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 text-primary font-bold text-sm hover:bg-primary/10 hover:border-primary/50 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            Smart import from document
            <Upload className="w-3.5 h-3.5 opacity-60" />
          </button>
          <p className="text-[10px] text-center text-gray-400 flex items-center justify-center gap-1">
            <span className="inline-block w-3 h-3 rounded-full border border-gray-300 flex items-center justify-center text-[8px] font-bold">✓</span>
            Documents are not stored after extraction
          </p>
        </div>
      )}

      {state.phase === "loading" && (
        <div className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-2xl bg-primary/5 border-2 border-primary/20">
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
          <div className="text-left">
            <p className="text-sm font-bold text-primary">Analysing document…</p>
            <p className="text-[11px] text-primary/60 truncate max-w-[240px]">{state.filename}</p>
          </div>
        </div>
      )}

      {state.phase === "error" && (
        <div className="w-full rounded-2xl border-2 border-red-100 bg-red-50 p-4">
          <div className="flex items-start gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 font-medium">{state.message}</p>
          </div>
          <button
            onClick={() => setState({ phase: "idle" })}
            className="text-xs font-bold text-red-500 hover:text-red-700 transition-colors"
          >
            Try a different file
          </button>
        </div>
      )}

      {state.phase === "preview" && (
        <div className="w-full rounded-2xl border-2 border-primary/20 bg-white overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <div>
                <p className="text-xs font-black text-primary">Smart import ready</p>
                <p className="text-[10px] text-primary/60 flex items-center gap-1 mt-0.5">
                  <FileText className="w-2.5 h-2.5" />
                  {state.filename}
                </p>
              </div>
            </div>
            <button
              onClick={() => setState({ phase: "idle" })}
              className="p-1 rounded-lg hover:bg-primary/10 text-primary/40 hover:text-primary transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-4 space-y-3">
            {FIELD_LABELS.map(({ key, label, sub }) => {
              const val = state.data[key];
              if (!val) return null;
              return (
                <div key={key} className={cn(sub ? "pb-3 border-b border-gray-100" : "")}>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">{label}</p>
                  <p className={cn("text-gray-800 leading-relaxed", sub ? "text-xs text-gray-500" : "text-sm font-medium")}>{val}</p>
                </div>
              );
            })}
          </div>

          <div className="px-4 pb-4 flex gap-2">
            <button
              onClick={() => setState({ phase: "idle" })}
              className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-600 font-bold text-sm hover:border-gray-300 transition-colors"
            >
              Discard
            </button>
            <button
              onClick={handleApply}
              className="flex-1 py-2.5 rounded-xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
            >
              <Check className="w-4 h-4" />
              Apply to my profile
            </button>
          </div>
        </div>
      )}
    </>
  );
}
