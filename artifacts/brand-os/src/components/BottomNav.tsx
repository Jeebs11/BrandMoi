import { useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "wouter";
import { Home, PenSquare, BookOpen, BarChart2, Menu, X, Lightbulb, Layers, FlaskConical, Target, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useListDrafts } from "@workspace/api-client-react";

// Pages that don't fit in the 5-slot bottom tab bar live behind "More" —
// otherwise Series and Brand Studio have no mobile entry point at all
// (desktop reaches them via the sidebar, which is hidden below md).
const MORE_ITEMS = [
  { href: "/vault", label: "Thought Vault", sub: "Capture raw ideas", icon: Lightbulb },
  { href: "/series", label: "Series", sub: "Multi-part content threads", icon: Layers },
  { href: "/studio", label: "Brand Studio", sub: "Tune your brand with what's working", icon: FlaskConical },
  { href: "/profile-alignment", label: "Profile Alignment", sub: "CV, BrandMoi, and LinkedIn — keep them in sync", icon: Target },
];

export function BottomNav() {
  const [location, navigate] = useLocation();
  const { data: drafts } = useListDrafts();
  const hasPublished = (drafts ?? []).some(d => d.status === "published");
  const [moreOpen, setMoreOpen] = useState(false);

  const ITEMS = [
    { href: "/", label: "Home", icon: Home },
    { href: "/capture", label: "Capture", icon: PenSquare },
    { href: "/library", label: "Library", icon: BookOpen },
    ...(hasPublished ? [{ href: "/analytics", label: "Analytics", icon: BarChart2 }] : []),
  ];

  const moreActive = MORE_ITEMS.some((m) => location.startsWith(m.href));

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none">
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
                  <span className={cn("text-[9px] font-bold tracking-wide", active ? "text-primary" : "text-gray-400")}>
                    {label}
                  </span>
                </Link>
              );
            })}
            <button
              onClick={() => setMoreOpen(true)}
              data-tour="more-menu"
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-3 transition-colors",
                moreActive ? "text-primary" : "text-gray-400 hover:text-gray-600"
              )}
            >
              <Menu className={cn("w-5 h-5", moreActive && "fill-current opacity-20")} strokeWidth={moreActive ? 2.5 : 1.5} />
              <span className={cn("text-[9px] font-bold tracking-wide", moreActive ? "text-primary" : "text-gray-400")}>
                More
              </span>
            </button>
          </div>
        </div>
      </nav>

      {moreOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center md:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMoreOpen(false)} />
          <div className="relative w-full max-w-[430px] bg-white rounded-t-3xl p-4 pb-8 shadow-2xl">
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-xs font-extrabold text-gray-400 uppercase tracking-widest">More</p>
              <button onClick={() => setMoreOpen(false)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1.5">
              {MORE_ITEMS.map(({ href, label, sub, icon: Icon }) => (
                <button
                  key={href}
                  onClick={() => { setMoreOpen(false); navigate(href); }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900">{label}</p>
                    <p className="text-[11px] text-gray-400 truncate">{sub}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
