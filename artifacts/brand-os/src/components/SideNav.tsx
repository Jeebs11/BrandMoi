import { Link, useLocation } from "wouter";
import { Home, PenSquare, BookOpen, Lightbulb, Settings, BarChart2, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useListDrafts } from "@workspace/api-client-react";

const BASE_NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/capture", label: "Capture", icon: PenSquare },
  { href: "/vault", label: "Vault", icon: Lightbulb },
  { href: "/library", label: "Library", icon: BookOpen },
];

interface SideNavProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function SideNav({ collapsed, onToggle }: SideNavProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const { data: drafts } = useListDrafts();
  const hasPublished = (drafts ?? []).some(d => d.status === "published");
  const NAV_ITEMS = [
    ...BASE_NAV_ITEMS,
    ...(hasPublished ? [{ href: "/analytics", label: "Analytics", icon: BarChart2 }] : []),
  ];

  return (
    <aside className={cn(
      "hidden md:flex fixed left-0 top-0 h-full flex-col bg-white border-r border-gray-200 z-50 transition-[width] duration-200 overflow-hidden",
      collapsed ? "w-[56px]" : "w-[220px]"
    )}>
      {/* Logo / brand */}
      <div className={cn(
        "flex items-center border-b border-gray-100 flex-shrink-0",
        collapsed ? "justify-center py-5 h-[65px]" : "gap-2.5 px-5 py-6"
      )}>
        <div className="w-8 h-8 bg-primary rounded-xl flex-shrink-0" />
        {!collapsed && (
          <span className="text-base font-extrabold text-gray-900 tracking-tight whitespace-nowrap">Brand OS</span>
        )}
      </div>

      {/* Nav items */}
      <nav className={cn("flex-1 py-4 space-y-0.5 overflow-y-auto", collapsed ? "px-1" : "px-3")}>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? location === "/" : location.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center rounded-xl transition-all text-sm font-semibold",
                collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              )}
            >
              <Icon
                className={cn("w-5 h-5 flex-shrink-0", active ? "text-primary" : "text-gray-400")}
                strokeWidth={active ? 2.5 : 1.75}
              />
              {!collapsed && label}
              {!collapsed && active && <div className="ml-auto w-1.5 h-1.5 bg-primary rounded-full" />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className={cn(
        "border-t border-gray-100 space-y-0.5 flex-shrink-0",
        collapsed ? "px-1 py-4" : "px-3 py-4"
      )}>
        <Link
          href="/settings"
          title={collapsed ? "Settings" : undefined}
          className={cn(
            "flex items-center rounded-xl transition-all text-sm font-semibold",
            collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5",
            location === "/settings"
              ? "bg-primary/10 text-primary"
              : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          )}
        >
          <Settings
            className={cn("w-5 h-5 flex-shrink-0", location === "/settings" ? "text-primary" : "text-gray-400")}
            strokeWidth={location === "/settings" ? 2.5 : 1.75}
          />
          {!collapsed && "Settings"}
        </Link>

        {user && !collapsed && (
          <div className="flex items-center gap-2.5 px-3 py-2 mt-1">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary text-xs font-extrabold uppercase select-none">
              {(user.displayName || user.email).charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-gray-700 font-semibold truncate leading-tight">{user.displayName || user.email}</p>
              {user.displayName && (
                <p className="text-[10px] text-gray-400 truncate leading-tight">{user.email}</p>
              )}
            </div>
          </div>
        )}

        {user && collapsed && (
          <div title={user.displayName || user.email} className="flex justify-center py-2">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-extrabold uppercase select-none">
              {(user.displayName || user.email).charAt(0)}
            </div>
          </div>
        )}

        {/* Collapse toggle */}
        <button
          onClick={onToggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex items-center w-full rounded-xl transition-all text-gray-400 hover:text-gray-700 hover:bg-gray-100",
            collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
          )}
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4 flex-shrink-0" />
            : <><ChevronLeft className="w-4 h-4 flex-shrink-0" /><span className="text-xs font-semibold">Collapse</span></>
          }
        </button>
      </div>
    </aside>
  );
}
