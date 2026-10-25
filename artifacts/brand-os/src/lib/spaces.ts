import { Home, PenSquare, BarChart2, FlaskConical, BookOpen, PenLine, Lightbulb, Layers, Target, type LucideIcon } from "lucide-react";

// Nine pages, four working spaces (plus Today). The nav shows spaces; pages
// that belong together get a small tab strip inside the space instead of a
// nav item each.
export type SpacePage = { href: string; label: string; icon?: LucideIcon };
export type Space = {
  key: "today" | "write" | "signals" | "you" | "library";
  href: string;
  label: string;
  icon: LucideIcon;
  pages: SpacePage[];
  /** Only offered once the user has published a post (nothing to show before). */
  needsPublished?: boolean;
};

export const SPACES: Space[] = [
  { key: "today", href: "/", label: "Today", icon: Home, pages: [{ href: "/", label: "Today" }] },
  {
    key: "write", href: "/capture", label: "Write", icon: PenSquare,
    pages: [
      { href: "/capture", label: "Write", icon: PenLine },
      { href: "/vault", label: "Thought Vault", icon: Lightbulb },
      { href: "/series", label: "Series", icon: Layers },
    ],
  },
  { key: "signals", href: "/analytics", label: "Signals", icon: BarChart2, needsPublished: true, pages: [{ href: "/analytics", label: "Signals" }] },
  {
    key: "you", href: "/studio", label: "You", icon: FlaskConical,
    pages: [
      { href: "/studio", label: "Brand Studio", icon: FlaskConical },
      { href: "/profile-alignment", label: "Profile Alignment", icon: Target },
    ],
  },
  { key: "library", href: "/library", label: "Library", icon: BookOpen, pages: [{ href: "/library", label: "Library" }] },
];

export function isActivePath(location: string, href: string): boolean {
  return href === "/" ? location === "/" : location === href || location.startsWith(`${href}/`);
}

export function spaceForLocation(location: string): Space | undefined {
  return SPACES.find((space) => space.pages.some((page) => isActivePath(location, page.href)));
}
