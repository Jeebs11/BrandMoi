import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type BgSpeed = "slow" | "normal" | "fast";
export type BgDensity = "low" | "normal" | "high";
export type BgPanelOpacity = "solid" | "frosted" | "semi" | "glass";
export type SiteTheme = "indigo" | "violet" | "sky" | "emerald" | "rose" | "amber";
export type BgPalette = "ocean" | "sunset" | "forest" | "void" | "ember" | "rose" | "arctic" | "gold";

export const SPEED_MULT: Record<BgSpeed, number> = {
  slow: 0.35,
  normal: 1.0,
  fast: 2.8,
};

export const DENSITY_MULT: Record<BgDensity, number> = {
  low: 0.45,
  normal: 1.0,
  high: 1.8,
};

// Alpha values for the gray-50 content panel (rgb 249,250,251)
export const PANEL_OPACITY_ALPHA: Record<BgPanelOpacity, number> = {
  solid:   1.0,
  frosted: 0.88,
  semi:    0.70,
  glass:   0.42,
};

export const SITE_THEMES: Record<SiteTheme, { label: string; primary: string; foreground: string; hex: string }> = {
  indigo:  { label: "Indigo",  primary: "243 75% 59%", foreground: "0 0% 100%", hex: "#6366f1" },
  violet:  { label: "Violet",  primary: "263 70% 58%", foreground: "0 0% 100%", hex: "#8b5cf6" },
  sky:     { label: "Sky",     primary: "199 89% 48%", foreground: "0 0% 100%", hex: "#0ea5e9" },
  emerald: { label: "Emerald", primary: "160 84% 39%", foreground: "0 0% 100%", hex: "#10b981" },
  rose:    { label: "Rose",    primary: "347 77% 50%", foreground: "0 0% 100%", hex: "#f43f5e" },
  amber:   { label: "Amber",   primary: "38 92% 50%",  foreground: "0 0% 10%",  hex: "#f59e0b" },
};

export type PaletteEntry = {
  label: string;
  preview: [string, string, string];
  hueBase: number;
  hueSpread: number;
  saturation: number;
  lightness: number;
  bg: string;
};

export const BG_PALETTES: Record<BgPalette, PaletteEntry> = {
  ocean:  { label: "Ocean",   preview: ["#06b6d4", "#0ea5e9", "#38bdf8"], hueBase: 190, hueSpread: 42, saturation: 85, lightness: 62, bg: "#030a16" },
  sunset: { label: "Sunset",  preview: ["#f97316", "#f59e0b", "#fb923c"], hueBase: 18,  hueSpread: 42, saturation: 90, lightness: 62, bg: "#160800" },
  forest: { label: "Forest",  preview: ["#10b981", "#059669", "#34d399"], hueBase: 155, hueSpread: 46, saturation: 80, lightness: 58, bg: "#041208" },
  void:   { label: "Void",    preview: ["#8b5cf6", "#a78bfa", "#7c3aed"], hueBase: 268, hueSpread: 46, saturation: 78, lightness: 65, bg: "#080514" },
  ember:  { label: "Ember",   preview: ["#ef4444", "#f97316", "#fca5a5"], hueBase: 5,   hueSpread: 32, saturation: 92, lightness: 60, bg: "#130200" },
  rose:   { label: "Rose",    preview: ["#f43f5e", "#ec4899", "#fb7185"], hueBase: 340, hueSpread: 55, saturation: 85, lightness: 63, bg: "#130008" },
  arctic: { label: "Arctic",  preview: ["#bae6fd", "#e0f2fe", "#7dd3fc"], hueBase: 200, hueSpread: 28, saturation: 88, lightness: 75, bg: "#020c14" },
  gold:   { label: "Gold",    preview: ["#f59e0b", "#fbbf24", "#fde68a"], hueBase: 42,  hueSpread: 28, saturation: 92, lightness: 62, bg: "#100a00" },
};

// Backgrounds that support palette coloring
export const PALETTEABLE_THEMES = new Set(["ripple", "plasma", "prismatic"]);

// Theme keys that have been removed — clamp them to "none" on load.
const REMOVED_THEMES = new Set([
  "aurora", "grid-pulse", "ink-wash",
  "breathe", "zen-mist", "still-aurora",
  "solid-cloud", "solid-paper", "solid-sage", "solid-slate",
  "solid-navy", "solid-charcoal", "solid-dusk", "solid-forest",
  "stars",
]);

function clampTheme(t: string | null | undefined): string {
  if (!t) return "none";
  if (REMOVED_THEMES.has(t)) return "none";
  return t;
}

function clampPalette(p: string | null | undefined): BgPalette {
  if (p && p in BG_PALETTES) return p as BgPalette;
  return "ocean";
}

interface BackgroundContextType {
  activeTheme: string;
  setActiveTheme: (key: string) => void;
  speed: BgSpeed;
  setSpeed: (s: BgSpeed) => void;
  density: BgDensity;
  setDensity: (d: BgDensity) => void;
  panelOpacity: BgPanelOpacity;
  setPanelOpacity: (o: BgPanelOpacity) => void;
  siteTheme: SiteTheme;
  setSiteTheme: (t: SiteTheme) => void;
  customImageUrl: string | null;
  setCustomImageUrl: (url: string | null) => void;
  bgPalette: BgPalette;
  setBgPalette: (p: BgPalette) => void;
}

const BackgroundContext = createContext<BackgroundContextType>({
  activeTheme: "none",
  setActiveTheme: () => {},
  speed: "normal",
  setSpeed: () => {},
  density: "normal",
  setDensity: () => {},
  panelOpacity: "solid",
  setPanelOpacity: () => {},
  siteTheme: "indigo",
  setSiteTheme: () => {},
  customImageUrl: null,
  setCustomImageUrl: () => {},
  bgPalette: "ocean",
  setBgPalette: () => {},
});

export function BackgroundProvider({
  children,
  initialTheme,
  initialSpeed,
  initialDensity,
  initialPanelOpacity,
  initialSiteTheme,
  initialCustomImageUrl,
  initialBgPalette,
}: {
  children: ReactNode;
  initialTheme?: string | null;
  initialSpeed?: string | null;
  initialDensity?: string | null;
  initialPanelOpacity?: string | null;
  initialSiteTheme?: string | null;
  initialCustomImageUrl?: string | null;
  initialBgPalette?: string | null;
}) {
  const [activeTheme, setActiveTheme] = useState(() => clampTheme(initialTheme));
  const [speed, setSpeed] = useState<BgSpeed>((initialSpeed as BgSpeed) ?? "normal");
  const [density, setDensity] = useState<BgDensity>((initialDensity as BgDensity) ?? "normal");
  const [panelOpacity, setPanelOpacity] = useState<BgPanelOpacity>((initialPanelOpacity as BgPanelOpacity) ?? "solid");
  const [siteTheme, setSiteTheme] = useState<SiteTheme>((initialSiteTheme as SiteTheme) ?? "indigo");
  const [customImageUrl, setCustomImageUrl] = useState<string | null>(initialCustomImageUrl ?? null);
  const [bgPalette, setBgPalette] = useState<BgPalette>(() => clampPalette(initialBgPalette));

  useEffect(() => {
    const clamped = clampTheme(initialTheme);
    if (clamped !== activeTheme) setActiveTheme(clamped);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTheme]);

  useEffect(() => {
    if (initialSpeed && initialSpeed !== speed) setSpeed(initialSpeed as BgSpeed);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSpeed]);

  useEffect(() => {
    if (initialDensity && initialDensity !== density) setDensity(initialDensity as BgDensity);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDensity]);

  useEffect(() => {
    if (initialPanelOpacity && initialPanelOpacity !== panelOpacity) setPanelOpacity(initialPanelOpacity as BgPanelOpacity);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPanelOpacity]);

  useEffect(() => {
    if (initialSiteTheme && initialSiteTheme !== siteTheme) setSiteTheme(initialSiteTheme as SiteTheme);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSiteTheme]);

  useEffect(() => {
    if (initialCustomImageUrl !== undefined && initialCustomImageUrl !== customImageUrl) {
      setCustomImageUrl(initialCustomImageUrl);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCustomImageUrl]);

  useEffect(() => {
    const clamped = clampPalette(initialBgPalette);
    if (clamped !== bgPalette) setBgPalette(clamped);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBgPalette]);

  useEffect(() => {
    const t = SITE_THEMES[siteTheme] ?? SITE_THEMES.indigo;
    const root = document.documentElement;
    root.style.setProperty("--primary", t.primary);
    root.style.setProperty("--accent", t.primary);
    root.style.setProperty("--primary-foreground", t.foreground);
    root.style.setProperty("--accent-foreground", t.foreground);
    root.style.setProperty("--ring", t.primary);
  }, [siteTheme]);

  return (
    <BackgroundContext.Provider value={{
      activeTheme, setActiveTheme,
      speed, setSpeed,
      density, setDensity,
      panelOpacity, setPanelOpacity,
      siteTheme, setSiteTheme,
      customImageUrl, setCustomImageUrl,
      bgPalette, setBgPalette,
    }}>
      {children}
    </BackgroundContext.Provider>
  );
}

export function useBackgroundTheme() {
  return useContext(BackgroundContext);
}
