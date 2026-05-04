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
  // backdropFilter is safe to put directly on the content panel now that all
  // modals use createPortal() — they render in document.body, so they are NOT
  // position:fixed descendants of this div and won't be trapped by its stacking
  // context. The blur only affects what's painted behind the panel (the animated
  // background), never the panel's own children (cards, text, buttons).
  const alpha = BgComponent ? (PANEL_OPACITY_ALPHA[panelOpacity] ?? 1) : 1;
  const hasFrost = alpha < 1;
  const panelBgStyle = hasFrost
    ? {
        backgroundColor: `rgba(249,250,251,${alpha})`,
        borderColor: `rgba(229,231,235,${Math.min(1, alpha + 0.1)})`,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
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
        <div
          className={cn(
            "w-full bg-gray-50 min-h-screen shadow-2xl flex flex-col border-x border-gray-200",
            "max-w-[430px]",
            !noNav && "pb-20 md:pb-8 md:max-w-[700px] lg:max-w-[900px] md:shadow-xl",
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
