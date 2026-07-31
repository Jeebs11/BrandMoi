import { useState } from "react";
import { cn } from "@/lib/utils";
import { BottomNav } from "@/components/BottomNav";
import { SideNav } from "@/components/SideNav";
import { useBackgroundTheme, PANEL_OPACITY_ALPHA } from "@/lib/background-context";
import { getBackground } from "@/lib/backgrounds";

interface AppShellProps {
  children: React.ReactNode;
  noNav?: boolean;
  auth?: boolean;
  contentClassName?: string;
}

export function AppShell({ children, noNav = false, auth = false, contentClassName }: AppShellProps) {
  const { activeTheme, panelOpacity } = useBackgroundTheme();

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem("sidenav-collapsed") === "true"; } catch { return false; }
  });

  const toggleSidebar = () => {
    setSidebarCollapsed(v => {
      const next = !v;
      try { localStorage.setItem("sidenav-collapsed", String(next)); } catch { }
      return next;
    });
  };

  const bgEntry = getBackground(activeTheme);
  const BgComponent = bgEntry?.component;

  if (auth) {
    return (
      <div className="min-h-screen bg-[#EDEDEE] flex justify-center items-center px-4">
        {children}
      </div>
    );
  }

  const marginClass = !noNav
    ? (sidebarCollapsed ? "md:ml-[56px]" : "md:ml-[220px]")
    : "";

  const alpha = BgComponent ? (PANEL_OPACITY_ALPHA[panelOpacity] ?? 1) : 1;
  const hasFrost = alpha < 1;

  // Shared width classes for both the frost layer and content panel
  const panelWidthClasses = cn(
    "max-w-[430px]",
    !noNav && "md:max-w-[700px] lg:max-w-[900px]"
  );

  return (
    <div className="min-h-screen bg-[#EDEDEE] relative">
      {BgComponent && (
        <div
          className="fixed inset-0 z-0"
          aria-hidden="true"
          style={{ pointerEvents: "none" }}
        >
          <BgComponent />
        </div>
      )}

      {!noNav && (
        <SideNav collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      )}

      <div
        className={cn(
          "flex justify-center min-h-screen relative z-10 transition-[margin] duration-200",
          marginClass
        )}
      >
        {/*
          FROST LAYER — z-0, absolute, rendered BEHIND the content panel.
          - Has the semi-transparent background + backdrop blur.
          - backdrop-filter here only blurs the animated background behind this div,
            NOT the content panel (which is stacked above it at z-[1]).
          - All modals use createPortal(document.body) so position:fixed children
            of the content panel are never trapped by this element's stacking context.
        */}
        {hasFrost && (
          <div
            aria-hidden="true"
            className={cn(
              "absolute inset-0 z-0 pointer-events-none mx-auto",
              panelWidthClasses
            )}
            style={{
              backgroundColor: `rgba(249,250,251,${alpha})`,
              borderLeft: `1px solid rgba(229,231,235,${Math.min(1, alpha + 0.1)})`,
              borderRight: `1px solid rgba(229,231,235,${Math.min(1, alpha + 0.1)})`,
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          />
        )}

        {/*
          CONTENT PANEL — relative z-[1], stacked ABOVE the frost layer.
          - No background in frost mode (transparent — lets the frost layer show through).
          - In solid mode keeps the default bg-gray-50.
          - Children (cards, buttons, text) have their own opaque backgrounds and
            are completely unaffected by the frost layer below.
        */}
        <div
          className={cn(
            // [&>*]:min-w-0 — every page renders one root child here; without this,
            // that child is a flex item with the default min-width:auto, so any
            // unwrapped content inside it (a wide row, long badge, etc.) can force
            // the whole shell wider than the viewport instead of shrinking/wrapping.
            "w-full min-w-0 min-h-screen shadow-2xl flex flex-col [&>*]:min-w-0",
            "max-w-[430px]",
            !noNav && "pb-20 md:pb-8 md:max-w-[700px] lg:max-w-[900px] md:shadow-xl",
            hasFrost
              ? "relative z-[1] bg-transparent border-x"
              : "bg-gray-50 border-x border-gray-200",
            contentClassName
          )}
          style={hasFrost ? {
            borderColor: `rgba(229,231,235,${Math.min(1, alpha + 0.1)})`,
          } : undefined}
        >
          {children}
        </div>
      </div>

      {!noNav && <BottomNav />}
    </div>
  );
}
