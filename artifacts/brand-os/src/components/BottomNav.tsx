import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useListDrafts } from "@workspace/api-client-react";
import { SPACES, spaceForLocation } from "@/lib/spaces";

export function BottomNav() {
  const [location] = useLocation();
  const { data: drafts } = useListDrafts();
  const hasPublished = (drafts ?? []).some(d => d.status === "published");
  const activeSpace = spaceForLocation(location);
  const items = SPACES.filter((space) => !space.needsPublished || hasPublished);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none">
      <div className="w-full max-w-[430px] pointer-events-auto border-t border-gray-200 bg-white/95 backdrop-blur-sm">
        <div className="flex">
          {items.map(({ href, label, icon: Icon, key }) => {
            const active = activeSpace?.key === key;
            return (
              <Link
                key={href}
                href={href}
                data-tour={key === "you" ? "profile-alignment" : undefined}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 py-3 transition-colors",
                  active ? "text-primary" : "text-gray-400 hover:text-gray-600"
                )}
              >
                <Icon className={cn("w-5 h-5", active && "fill-current opacity-20")} strokeWidth={active ? 2.5 : 1.5} />
                <span className={cn("text-[9px] font-bold tracking-wide", active ? "text-primary" : "text-gray-400")}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
