import { useState } from "react";
import { cn } from "@/lib/utils";
import { BottomNav } from "@/components/BottomNav";
import { SideNav } from "@/components/SideNav";
import { useBackgroundTheme, PANEL_OPACITY_ALPHA } from "@/lib/background-context";
import { getBackground } from "@/lib/backgrounds";

interface AppShellProps {
  children: React.ReactNode;
  /** Hides sidebar + bottom nav, keeps full-height column (for Onboarding wizard) */
  noNav?: boolean;
  /** Auth card mode: centers children vertically, no sidebar/nav (for Login/Signup/404) */
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
      try { localStorage.setItem("sidenav-collapsed", String(next)); } catch { /* ignore */ }
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

  // Tailwind classes must be full strings for static analysis — pick from these two
  const marginClass = !noNav
    ? (sidebarCollapsed ? "md:ml-[56px]" : "md:ml-[220px]")
    : "";

  // When an animated background is active, apply the user-chosen translucency.
  // IMPORTANT: backdropFilter must NOT be set on the panel div itself — any element
  // with backdropFilter creates a new containing block for position:fixed children,
  // which breaks fixed-position modals (they render inside the panel instead of
  // covering the viewport). We instead apply the blur on a separate sibling element
  // that sits behind the content but is not an ancestor of it.
  const alpha = BgComponent ? (PANEL_OPACITY_ALPHA[panelOpacity] ?? 1) : 1;
  const hasFrost = alpha < 1;
  const panelBgStyle = hasFrost
    ? {
        backgroundColor: `rgba(249,250,251,${alpha})`,
        borderColor: `rgba(229,231,235,${Math.min(1, alpha + 0.1)})`,
      } as React.CSSProperties
    : undefined;

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
        {/* Frosted-glass backdrop layer — separate from content so backdropFilter
            never becomes a containing block for fixed-position children (modals). */}
        {hasFrost && (
          <div
            aria-hidden="true"
            className={cn(
              "absolute inset-0 pointer-events-none",
              "max-w-[430px]",
              !noNav && "md:max-w-[700px]",
              "mx-auto"
            )}
            style={{
              backdropFilter: "blur(2px)",
              WebkitBackdropFilter: "blur(2px)",
            }}
          />
        )}
        <div
          className={cn(
            "w-full bg-gray-50 min-h-screen shadow-2xl flex flex-col border-x border-gray-200",
            "max-w-[430px]",
            !noNav && "pb-20 md:pb-8 md:max-w-[700px] md:shadow-xl",
            contentClassName
          )}
          style={panelBgStyle}
        >
          {children}
        </div>
      </div>

      {!noNav && <BottomNav />}
    </div>
  );
}
