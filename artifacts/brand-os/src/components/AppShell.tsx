import { cn } from "@/lib/utils";
import { BottomNav } from "@/components/BottomNav";
import { SideNav } from "@/components/SideNav";

interface AppShellProps {
  children: React.ReactNode;
  noNav?: boolean;
  contentClassName?: string;
}

export function AppShell({ children, noNav = false, contentClassName }: AppShellProps) {
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
