import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { isActivePath, spaceForLocation } from "@/lib/spaces";

// Segmented control shown inside a space that groups several pages (Write, You).
// Deliberately large and filled so the sibling pages are hard to miss.
export function SpaceTabs() {
  const [location] = useLocation();
  const space = spaceForLocation(location);
  if (!space || space.pages.length < 2) return null;

  return (
    <div className="mx-auto w-full max-w-[560px] px-5 pt-4" data-testid="space-tabs">
      <nav
        aria-label={`${space.label} pages`}
        className="flex items-stretch gap-1 rounded-2xl border border-gray-200 bg-gray-100 p-1 shadow-[inset_0_1px_2px_rgba(26,24,18,0.06)]"
      >
        {space.pages.map((page) => {
          const active = isActivePath(location, page.href);
          const Icon = page.icon;
          return (
            <Link
              key={page.href}
              href={page.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition-all",
                active
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-gray-500 hover:bg-white hover:text-gray-900",
              )}
            >
              {Icon && <Icon className="h-4 w-4 flex-shrink-0" strokeWidth={active ? 2.25 : 1.75} />}
              <span className="truncate">{page.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
