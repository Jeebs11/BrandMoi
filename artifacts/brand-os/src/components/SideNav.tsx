import { Link, useLocation } from "wouter";
import { Home, PenSquare, BookOpen, Lightbulb, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/capture", label: "Capture", icon: PenSquare },
  { href: "/vault", label: "Vault", icon: Lightbulb },
  { href: "/library", label: "Library", icon: BookOpen },
];

export function SideNav() {
  const [location] = useLocation();
  const { user } = useAuth();

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-full w-[220px] flex-col bg-white border-r border-gray-200 z-50">
      <div className="px-5 py-6 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary rounded-xl flex-shrink-0" />
          <span className="text-base font-extrabold text-gray-900 tracking-tight">Brand OS</span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? location === "/" : location.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-semibold",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              )}
            >
              <Icon
                className={cn("w-5 h-5 flex-shrink-0", active ? "text-primary" : "text-gray-400")}
                strokeWidth={active ? 2.5 : 1.75}
              />
              {label}
              {active && <div className="ml-auto w-1.5 h-1.5 bg-primary rounded-full" />}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-gray-100 space-y-0.5">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-semibold",
            location === "/settings"
              ? "bg-primary/10 text-primary"
              : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          )}
        >
          <Settings
            className={cn("w-5 h-5 flex-shrink-0", location === "/settings" ? "text-primary" : "text-gray-400")}
            strokeWidth={location === "/settings" ? 2.5 : 1.75}
          />
          Settings
        </Link>
        {user && (
          <div className="px-3 py-2 mt-1">
            <p className="text-[11px] text-gray-600 font-semibold truncate">{user.displayName || user.email}</p>
            {user.displayName && (
              <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
