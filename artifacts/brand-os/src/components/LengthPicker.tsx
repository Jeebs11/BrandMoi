import { Zap, AlignLeft, BookOpen, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type PostLength = "short" | "medium" | "long";

const LENGTH_OPTIONS: {
  key: PostLength;
  label: string;
  wordHint: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  border: string;
  bg: string;
  badgeColor: string;
}[] = [
  {
    key: "short",
    label: "Short",
    wordHint: "~80–120 words",
    description: "Punchy, scroll-stopping. Great for hot takes and quick wins.",
    icon: <Zap className="w-4 h-4" />,
    color: "text-amber-600",
    border: "border-amber-200",
    bg: "bg-amber-50 hover:bg-amber-100",
    badgeColor: "bg-amber-100 text-amber-700",
  },
  {
    key: "medium",
    label: "Medium",
    wordHint: "~200–300 words",
    description: "Standard post in your brand voice. Balanced depth and readability.",
    icon: <AlignLeft className="w-4 h-4" />,
    color: "text-primary",
    border: "border-primary/20",
    bg: "bg-blue-50 hover:bg-blue-100",
    badgeColor: "bg-primary/10 text-primary",
  },
  {
    key: "long",
    label: "Long",
    wordHint: "400+ words",
    description: "Full story-arc post plus carousel. Your best content on a topic.",
    icon: <BookOpen className="w-4 h-4" />,
    color: "text-violet-600",
    border: "border-violet-200",
    bg: "bg-violet-50 hover:bg-violet-100",
    badgeColor: "bg-violet-100 text-violet-700",
  },
];

interface LengthPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (length: PostLength) => void;
  title?: string;
}

export function LengthPicker({ open, onClose, onSelect, title }: LengthPickerProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ maxWidth: 430, left: "50%", transform: "translateX(-50%)" }}
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-t-3xl shadow-2xl px-5 pb-8 pt-5 z-10">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Choose length</p>
            <h3 className="text-base font-extrabold text-gray-900">
              {title ?? "How long should this be?"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {LENGTH_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => onSelect(opt.key)}
              className={cn(
                "w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border-2 transition-all text-left",
                opt.bg, opt.border
              )}
            >
              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", opt.badgeColor)}>
                <span className={opt.color}>{opt.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={cn("text-sm font-extrabold", opt.color)}>{opt.label}</span>
                  <span className="text-[10px] font-semibold text-gray-400">{opt.wordHint}</span>
                </div>
                <p className="text-xs text-gray-600 leading-snug">{opt.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
