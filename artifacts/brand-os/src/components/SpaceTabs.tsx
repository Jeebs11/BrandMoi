import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { isActivePath, spaceForLocation } from "@/lib/spaces";

// Tab strip shown inside a space that groups several pages (Write, You).
export function SpaceTabs() {
  const [location] = useLocation();
  const space = spaceForLocation(location);
  if (!space || space.pages.length < 2) return null;

  return (
    <div className="px-5 pt-4 -mb-1" data-testid="space-tabs">
      <div className="flex items-center gap-1 border-b border-gray-200">
        {space.pages.map((page) => {
          const active = isActivePath(location, page.href);
          return (
            <Link
              key={page.href}
              href={page.href}
              className={cn(
                "relative -mb-px px-3 py-2 text-xs font-bold tracking-wide transition-colors",
                active ? "text-gray-900" : "text-gray-400 hover:text-gray-700",
              )}
            >
              {page.label}
              {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-violet-600" />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
