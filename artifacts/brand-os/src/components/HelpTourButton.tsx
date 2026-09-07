import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { HelpCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { LATEST_UPDATE_ID, unseenUpdates } from "@/lib/product-updates";
import { WELCOME_TOUR_STEPS, type TourStep } from "@/components/tour/tour-steps";
import { TourOverlay } from "@/components/tour/TourOverlay";
import { preferencesApi } from "@/lib/api";
import {
  CAPTURE_TOUR_STEPS,
  LIBRARY_TOUR_STEPS,
  ANALYTICS_TOUR_STEPS,
  SERIES_TOUR_STEPS,
  STUDIO_TOUR_STEPS,
  VAULT_TOUR_STEPS,
  PROFILE_ALIGNMENT_TOUR_STEPS,
} from "@/components/tour/page-tours";

// Route -> that page's own mini-tour, so the icon can offer it directly
// instead of only ever replaying the original Dashboard welcome tour.
const PAGE_TOUR_BY_ROUTE: Record<string, { id: string; label: string; steps: TourStep[] }> = {
  "/capture": { id: "capture-tour", label: "Capture", steps: CAPTURE_TOUR_STEPS },
  "/library": { id: "library-tour", label: "Library", steps: LIBRARY_TOUR_STEPS },
  "/analytics": { id: "analytics-tour", label: "Analytics", steps: ANALYTICS_TOUR_STEPS },
  "/series": { id: "series-tour", label: "Series", steps: SERIES_TOUR_STEPS },
  "/studio": { id: "studio-tour", label: "Brand Studio", steps: STUDIO_TOUR_STEPS },
  "/vault": { id: "vault-tour", label: "Thought Vault", steps: VAULT_TOUR_STEPS },
  "/profile-alignment": { id: "profile-alignment-tour", label: "Profile Alignment", steps: PROFILE_ALIGNMENT_TOUR_STEPS },
};

type ActiveTour = { kind: "welcome" } | { kind: "page"; id: string; steps: TourStep[] };

export function HelpTourButton() {
  const { user, preferences, invalidate } = useAuth();
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTour, setActiveTour] = useState<ActiveTour | null>(null);

  // Demo account's PUT /user/preferences always 403s by design, so "seen"
  // state can never actually persist there — keep the icon quiet and skip
  // the auto-launch entirely rather than showing a badge that can never clear.
  const isDemo = user?.email === "demo@brandos.app";

  const rawLastSeenUpdateId = (preferences as typeof preferences & { lastSeenUpdateId?: string | null })?.lastSeenUpdateId ?? null;
  // Demo is always treated as fully caught-up — its writes can never persist,
  // so every downstream calculation (icon state, popover content, auto-launch)
  // derives from this one effective value rather than the real DB value.
  const lastSeenUpdateId = isDemo ? LATEST_UPDATE_ID : rawLastSeenUpdateId;
  const isBold = lastSeenUpdateId !== LATEST_UPDATE_ID;
  const isFirstRun = lastSeenUpdateId == null;
  const pending = unseenUpdates(lastSeenUpdateId).filter((u) => u.kind === "whats-new");

  const seenPageTours = (preferences as typeof preferences & { seenPageTours?: string[] })?.seenPageTours ?? [];
  const currentPageTour = PAGE_TOUR_BY_ROUTE[location];

  // Auto-launch once, right after onboarding: the user's first authenticated
  // page is always "/" (Onboarding.tsx navigates there on finish), so a
  // first-run user landing on Dashboard gets the tour without any extra
  // signal needed from Onboarding itself — idempotent, survives a refresh.
  useEffect(() => {
    if (isFirstRun && location === "/") setActiveTour({ kind: "welcome" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFirstRun, location]);

  const markWelcomeSeen = async () => {
    if (isDemo) return;
    try {
      await preferencesApi.updateFields({ lastSeenUpdateId: LATEST_UPDATE_ID });
      await invalidate();
    } catch { /* non-critical — worst case the icon stays bold until next successful click */ }
  };

  const markPageSeen = async (pageId: string) => {
    if (isDemo) return;
    try {
      const next = Array.from(new Set([...seenPageTours, pageId]));
      await preferencesApi.updateFields({ seenPageTours: next });
      await invalidate();
    } catch { /* non-critical — worst case it re-offers next visit */ }
  };

  const openWelcomeTour = () => {
    setMenuOpen(false);
    setActiveTour({ kind: "welcome" });
  };

  const openPageTour = () => {
    if (!currentPageTour) return;
    setMenuOpen(false);
    setActiveTour({ kind: "page", id: currentPageTour.id, steps: currentPageTour.steps });
  };

  const handleTourDone = () => {
    const tour = activeTour;
    setActiveTour(null);
    if (!tour) return;
    if (tour.kind === "welcome") void markWelcomeSeen();
    else void markPageSeen(tour.id);
  };

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "fixed top-3 right-3 z-40 w-8 h-8 rounded-full flex items-center justify-center transition-all",
              isBold
                ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30"
                : "bg-white/70 text-gray-300 hover:text-gray-500 border border-gray-200/70",
            )}
            aria-label="Help and what's new"
          >
            <HelpCircle className="w-4 h-4" />
            {isBold && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-rose-500 border-2 border-white animate-pulse" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={8} className="w-64 rounded-2xl border border-gray-100 bg-white p-3 shadow-xl z-40 space-y-1">
          {isFirstRun ? (
            <button onClick={openWelcomeTour} className="w-full text-left px-2 py-2 rounded-xl hover:bg-gray-50 text-sm font-bold text-gray-800 transition-colors">
              Take the tour
            </button>
          ) : pending.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider px-2">What's new</p>
              {pending.map((u) => (
                <div key={u.id} className="px-2">
                  <p className="text-xs font-bold text-gray-900">{u.title}</p>
                  <p className="text-[11px] text-gray-500 leading-relaxed mt-0.5">{u.description}</p>
                </div>
              ))}
              <button
                onClick={() => { setMenuOpen(false); void markWelcomeSeen(); }}
                className="w-full text-center px-2 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-colors"
              >
                Got it
              </button>
              <button onClick={openWelcomeTour} className="w-full text-center px-2 py-1.5 text-[11px] font-semibold text-gray-400 hover:text-gray-600 transition-colors">
                Retake full tour
              </button>
            </div>
          ) : (
            <button onClick={openWelcomeTour} className="w-full text-left px-2 py-2 rounded-xl hover:bg-gray-50 text-sm font-bold text-gray-800 transition-colors">
              Retake tour
            </button>
          )}

          {currentPageTour && (
            <button
              onClick={openPageTour}
              className="w-full flex items-center gap-1.5 text-left px-2 py-2 rounded-xl hover:bg-violet-50 text-sm font-bold text-violet-700 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
              Tour {currentPageTour.label}
            </button>
          )}
        </PopoverContent>
      </Popover>

      {activeTour && (
        <TourOverlay steps={activeTour.kind === "welcome" ? WELCOME_TOUR_STEPS : activeTour.steps} onDone={handleTourDone} />
      )}
    </>
  );
}
