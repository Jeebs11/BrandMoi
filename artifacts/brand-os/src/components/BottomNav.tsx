import { Link, useLocation } from "wouter";
import { Home, PenSquare, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/capture", label: "Capture", icon: PenSquare },
  { href: "/library", label: "Library", icon: BookOpen },
];

export function BottomNav() {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none">
      <div className="w-full max-w-[430px] pointer-events-auto border-t border-gray-200 bg-white/95 backdrop-blur-sm">
        <div className="flex">
          {ITEMS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? location === "/" : location.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 py-3 transition-colors",
                  active ? "text-primary" : "text-gray-400 hover:text-gray-600"
                )}
              >
                <Icon className={cn("w-5 h-5", active && "fill-current opacity-20")} strokeWidth={active ? 2.5 : 1.5} />
                <span className={cn("text-[10px] font-bold tracking-wide", active ? "text-primary" : "text-gray-400")}>
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
