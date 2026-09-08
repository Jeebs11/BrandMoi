import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { preferencesApi } from "@/lib/api";
import { TourOverlay } from "./TourOverlay";
import type { TourStep } from "./tour-steps";

// Auto-launches a page-specific mini-tour the first time this user visits,
// tracked independently per page (unlike lastSeenUpdateId's single linear
// pointer, since pages can be visited in any order). `ready` lets a page
// delay auto-launch until it actually has content to spotlight (Analytics
// needs this — its whole content area is conditionally mounted).
export function usePageTour(pageId: string, steps: TourStep[], ready: boolean = true): ReactNode {
  const { user, preferences, invalidate } = useAuth();
  const [open, setOpen] = useState(false);

  const isDemo = user?.email === "demo@brandos.app";
  const seenPageTours = (preferences as typeof preferences & { seenPageTours?: string[] })?.seenPageTours ?? [];
  const alreadySeen = isDemo || seenPageTours.includes(pageId);

  useEffect(() => {
    if (!alreadySeen && ready && steps.length > 0) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alreadySeen, ready]);

  const handleDone = async () => {
    setOpen(false);
    if (isDemo) return;
    try {
      const next = Array.from(new Set([...seenPageTours, pageId]));
      await preferencesApi.updateFields({ seenPageTours: next });
      await invalidate();
    } catch { /* non-critical — worst case it re-offers next visit */ }
  };

  return open ? <TourOverlay steps={steps} onDone={handleDone} /> : null;
}
