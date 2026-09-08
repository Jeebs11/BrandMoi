import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import type { TourStep } from "./tour-steps";

interface Rect { top: number; left: number; width: number; height: number }

function findTargetRect(step: TourStep): Rect | null {
  const primary = document.querySelector(step.selector);
  const primaryRect = primary?.getBoundingClientRect();
  if (primaryRect && primaryRect.width > 0 && primaryRect.height > 0) {
    return { top: primaryRect.top, left: primaryRect.left, width: primaryRect.width, height: primaryRect.height };
  }
  if (step.mobileSelector) {
    const mobile = document.querySelector(step.mobileSelector);
    const mobileRect = mobile?.getBoundingClientRect();
    if (mobileRect && mobileRect.width > 0 && mobileRect.height > 0) {
      return { top: mobileRect.top, left: mobileRect.left, width: mobileRect.width, height: mobileRect.height };
    }
  }
  return null;
}

interface Props {
  steps: TourStep[];
  onDone: () => void;
}

export function TourOverlay({ steps, onDone }: Props) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const anchorElRef = useRef<HTMLDivElement>(null);
  const step = steps[index];

  const recalc = useCallback(() => {
    if (!step) return;
    setRect(findTargetRect(step));
  }, [step]);

  useEffect(() => {
    recalc();
    const raf = () => requestAnimationFrame(recalc);
    window.addEventListener("resize", raf);
    window.addEventListener("scroll", raf, true);
    const observer = new ResizeObserver(raf);
    observer.observe(document.body);
    return () => {
      window.removeEventListener("resize", raf);
      window.removeEventListener("scroll", raf, true);
      observer.disconnect();
    };
  }, [recalc]);

  if (!step) return null;

  const isLast = index === steps.length - 1;
  const skip = () => onDone();
  const next = () => (isLast ? onDone() : setIndex((i) => i + 1));
  const back = () => setIndex((i) => Math.max(0, i - 1));

  const pad = 6;
  const spot = rect ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 } : null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[200]">
        {/* Dimming — skipped entirely (no cutout math needed) when the target isn't found this render */}
        {!spot ? (
          <motion.div
            className="absolute inset-0 bg-black/55"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={skip}
          />
        ) : (
          <>
            <motion.div className="absolute left-0 right-0 bg-black/55" style={{ top: 0, height: Math.max(0, spot.top) }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={skip} />
            <motion.div className="absolute left-0 right-0 bg-black/55" style={{ top: spot.top + spot.height, bottom: 0 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={skip} />
            <motion.div className="absolute bg-black/55" style={{ top: spot.top, height: spot.height, left: 0, width: Math.max(0, spot.left) }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={skip} />
            <motion.div className="absolute bg-black/55" style={{ top: spot.top, height: spot.height, left: spot.left + spot.width, right: 0 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={skip} />
            <div
              className="absolute rounded-xl ring-2 ring-violet-400 pointer-events-none"
              style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
            />
          </>
        )}

        {/* Anchor + callout, positioned via an invisible div matching the target rect */}
        <Popover open>
          <PopoverAnchor asChild>
            <div
              ref={anchorElRef}
              style={{ position: "fixed", top: rect?.top ?? "50%", left: rect?.left ?? "50%", width: rect?.width ?? 1, height: rect?.height ?? 1 }}
            />
          </PopoverAnchor>
          <PopoverContent
            side={step.placement ?? "bottom"}
            sideOffset={12}
            onOpenAutoFocus={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
            className="w-72 rounded-2xl border border-gray-100 bg-white p-4 shadow-xl z-[201]"
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <p className="text-sm font-extrabold text-gray-900">{step.title}</p>
              <button onClick={skip} className="p-1 -mr-1 -mt-1 rounded-lg hover:bg-gray-100 text-gray-400 flex-shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed mb-4">{step.description}</p>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-300 tabular-nums">{index + 1} / {steps.length}</span>
              <div className="flex items-center gap-1.5">
                {index > 0 && (
                  <button onClick={back} className="flex items-center gap-0.5 text-xs font-bold text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg transition-colors">
                    <ChevronLeft className="w-3.5 h-3.5" /> Back
                  </button>
                )}
                <button onClick={next} className="flex items-center gap-0.5 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 px-3 py-1.5 rounded-lg transition-colors">
                  {isLast ? "Done" : "Next"} {!isLast && <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </AnimatePresence>,
    document.body,
  );
}
