import { cn } from "@/lib/utils";
import { BottomNav } from "@/components/BottomNav";
import { SideNav } from "@/components/SideNav";

interface AppShellProps {
  children: React.ReactNode;
  /** Hides sidebar + bottom nav, keeps full-height column (for Onboarding wizard) */
  noNav?: boolean;
  /** Auth card mode: centers children vertically, no sidebar/nav (for Login/Signup/404) */
  auth?: boolean;
  contentClassName?: string;
}

export function AppShell({ children, noNav = false, auth = false, contentClassName }: AppShellProps) {
  if (auth) {
    return (
      <div className="min-h-screen bg-[#EDEDEE] flex justify-center items-center px-4">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EDEDEE]">
      {!noNav && <SideNav />}
      <div
        className={cn(
          "flex justify-center min-h-screen",
          !noNav && "md:ml-[220px]"
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
