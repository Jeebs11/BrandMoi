import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type BgSpeed = "slow" | "normal" | "fast";
export type BgDensity = "low" | "normal" | "high";
export type SiteTheme = "indigo" | "violet" | "sky" | "emerald" | "rose" | "amber";

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

export const SITE_THEMES: Record<SiteTheme, { label: string; primary: string; foreground: string; hex: string }> = {
  indigo:  { label: "Indigo",  primary: "243 75% 59%", foreground: "0 0% 100%", hex: "#6366f1" },
  violet:  { label: "Violet",  primary: "263 70% 58%", foreground: "0 0% 100%", hex: "#8b5cf6" },
  sky:     { label: "Sky",     primary: "199 89% 48%", foreground: "0 0% 100%", hex: "#0ea5e9" },
  emerald: { label: "Emerald", primary: "160 84% 39%", foreground: "0 0% 100%", hex: "#10b981" },
  rose:    { label: "Rose",    primary: "347 77% 50%", foreground: "0 0% 100%", hex: "#f43f5e" },
  amber:   { label: "Amber",   primary: "38 92% 50%",  foreground: "0 0% 10%",  hex: "#f59e0b" },
};

interface BackgroundContextType {
  activeTheme: string;
  setActiveTheme: (key: string) => void;
  speed: BgSpeed;
  setSpeed: (s: BgSpeed) => void;
  density: BgDensity;
  setDensity: (d: BgDensity) => void;
  siteTheme: SiteTheme;
  setSiteTheme: (t: SiteTheme) => void;
  customImageUrl: string | null;
  setCustomImageUrl: (url: string | null) => void;
}

const BackgroundContext = createContext<BackgroundContextType>({
  activeTheme: "none",
  setActiveTheme: () => {},
  speed: "normal",
  setSpeed: () => {},
  density: "normal",
  setDensity: () => {},
  siteTheme: "indigo",
  setSiteTheme: () => {},
  customImageUrl: null,
  setCustomImageUrl: () => {},
});

export function BackgroundProvider({
  children,
  initialTheme,
  initialSpeed,
  initialDensity,
  initialSiteTheme,
  initialCustomImageUrl,
}: {
  children: ReactNode;
  initialTheme?: string | null;
  initialSpeed?: string | null;
  initialDensity?: string | null;
  initialSiteTheme?: string | null;
  initialCustomImageUrl?: string | null;
}) {
  const [activeTheme, setActiveTheme] = useState(initialTheme ?? "none");
  const [speed, setSpeed] = useState<BgSpeed>((initialSpeed as BgSpeed) ?? "normal");
  const [density, setDensity] = useState<BgDensity>((initialDensity as BgDensity) ?? "normal");
  const [siteTheme, setSiteTheme] = useState<SiteTheme>((initialSiteTheme as SiteTheme) ?? "indigo");
  const [customImageUrl, setCustomImageUrl] = useState<string | null>(initialCustomImageUrl ?? null);

  useEffect(() => {
    if (initialTheme && initialTheme !== activeTheme) setActiveTheme(initialTheme);
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
    const t = SITE_THEMES[siteTheme] ?? SITE_THEMES.indigo;
    const root = document.documentElement;
    root.style.setProperty("--primary", t.primary);
    root.style.setProperty("--accent", t.primary);
    root.style.setProperty("--primary-foreground", t.foreground);
    root.style.setProperty("--accent-foreground", t.foreground);
    root.style.setProperty("--ring", t.primary);
  }, [siteTheme]);

  return (
    <BackgroundContext.Provider value={{ activeTheme, setActiveTheme, speed, setSpeed, density, setDensity, siteTheme, setSiteTheme, customImageUrl, setCustomImageUrl }}>
      {children}
    </BackgroundContext.Provider>
  );
}

export function useBackgroundTheme() {
  return useContext(BackgroundContext);
}
