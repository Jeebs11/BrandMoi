import { useState } from "react";
import { cn } from "@/lib/utils";
import { BottomNav } from "@/components/BottomNav";
import { SideNav } from "@/components/SideNav";
import { BackgroundProvider, useBackgroundTheme } from "@/lib/background-context";
import { getBackground } from "@/lib/backgrounds";
import { useAuth } from "@/hooks/use-auth";

interface AppShellProps {
  children: React.ReactNode;
  /** Hides sidebar + bottom nav, keeps full-height column (for Onboarding wizard) */
  noNav?: boolean;
  /** Auth card mode: centers children vertically, no sidebar/nav (for Login/Signup/404) */
  auth?: boolean;
  contentClassName?: string;
}

function AppShellInner({ children, noNav = false, auth = false, contentClassName }: AppShellProps) {
  const { activeTheme } = useBackgroundTheme();

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
            !noNav && "pb-20 md:pb-8 md:max-w-[700px] md:shadow-xl",
            contentClassName
          )}
        >
          {children}
        </div>
      </div>

      {!noNav && <BottomNav />}
    </div>
  );
}

export function AppShell(props: AppShellProps) {
  const { preferences } = useAuth();
  const prefs = preferences as (typeof preferences & { backgroundTheme?: string | null }) | undefined;

  return (
    <BackgroundProvider initialTheme={prefs?.backgroundTheme ?? "none"}>
      <AppShellInner {...props} />
    </BackgroundProvider>
  );
}
