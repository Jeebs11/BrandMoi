import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { ChevronLeft, LogOut, Save, Loader2, Brain, RefreshCw, Eye, EyeOff, KeyRound, Info, Link2, Unlink, RefreshCcw, CheckCircle2, ExternalLink, ChevronDown, ChevronUp, Sparkles, ImagePlus, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useUpdatePreferences, useLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { voiceApi, accountApi, linkedinApi, voiceInsightsApi, type VoiceSummaryResult, type LinkedinStatus } from "@/lib/api";
import { SmartImportButton } from "@/components/SmartImportButton";
import type { ExtractedBrandVoice } from "@/lib/api";
import { BACKGROUNDS } from "@/lib/backgrounds";
import { useBackgroundTheme, SITE_THEMES, type BgSpeed, type BgDensity, type SiteTheme } from "@/lib/background-context";

// Audience replaces legacy Objective. Stored in preferences.objective for back-compat.
const AUDIENCES = ["Clients", "Peers", "Recruiters & Headhunters", "Investors", "My audience"];
// Feeling replaces legacy Tone. Stored in preferences.tone.
const FEELINGS = ["Direct", "Witty", "Vulnerable", "Story", "Contrarian"];
// Persona kept hidden — defaults to "Founder" backend-side; existing values preserved.
const PERSONAS = ["Operator", "Founder", "Career", "Technical", "Sales"];

function ThumbBtn({
  bgKey, label, isActive, onSelect, children,
}: {
  bgKey: string;
  label: string;
  isActive: boolean;
  onSelect: (key: string) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(bgKey)}
      className={cn(
        "relative rounded-xl overflow-hidden border-2 transition-all aspect-[8/5]",
        isActive ? "border-primary ring-2 ring-primary/30" : "border-gray-200 hover:border-gray-300"
      )}
      title={label}
    >
      {children}
      {isActive && (
        <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-primary flex items-center justify-center">
          <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </button>
  );
}

export default function Settings() {
  const [, navigate] = useLocation();
  const { user, preferences, invalidate } = useAuth();
  const { toast } = useToast();
  const { activeTheme, setActiveTheme, speed, setSpeed, density, setDensity, siteTheme: activeSiteTheme, setSiteTheme, customImageUrl, setCustomImageUrl } = useBackgroundTheme();
  const uploadRef = useRef<HTMLInputElement>(null);

  const [objective, setObjective] = useState(preferences?.objective ?? "Authority");
  const [persona, setPersona] = useState(preferences?.persona ?? "Founder");
  const [tone, setTone] = useState(preferences?.tone ?? "Direct");
  const [brandRole, setBrandRole] = useState(preferences?.brandRole ?? "");
  const [brandAudience, setBrandAudience] = useState(preferences?.brandAudience ?? "");
  const [brandBelief, setBrandBelief] = useState(preferences?.brandBelief ?? "");
  const [aboutMe, setAboutMe] = useState((preferences as typeof preferences & { aboutMe?: string })?.aboutMe ?? "");

  const prefs = preferences as (typeof preferences & {
    brandBgColor?: string;
    brandAccentColor?: string;
    brandTextColor?: string;
    backgroundTheme?: string;
    bgSpeed?: string;
    bgDensity?: string;
    siteTheme?: string;
    bgCustomImageUrl?: string | null;
  });
  const [brandBgColor, setBrandBgColor] = useState(prefs?.brandBgColor ?? "#0f172a");
  const [brandAccentColor, setBrandAccentColor] = useState(prefs?.brandAccentColor ?? "#6366f1");
  const [brandTextColor, setBrandTextColor] = useState(prefs?.brandTextColor ?? "#ffffff");

  const [openPanelId, setOpenPanelId] = useState<string | null>(null);
  const togglePanel = (id: string) => setOpenPanelId(prev => prev === id ? null : id);

  const [voiceData, setVoiceData] = useState<VoiceSummaryResult | null>(null);
  const [voiceLoading, setVoiceLoading] = useState(true);
  const [voiceRefreshing, setVoiceRefreshing] = useState(false);
  const [insightRefreshing, setInsightRefreshing] = useState(false);

  const [linkedinStatus, setLinkedinStatus] = useState<LinkedinStatus | null>(null);
  const [linkedinSyncing, setLinkedinSyncing] = useState(false);
  const [linkedinDisconnecting, setLinkedinDisconnecting] = useState(false);
  const [linkedinGuideOpen, setLinkedinGuideOpen] = useState(false);

  const search = useSearch();
  const linkedinParam = new URLSearchParams(search).get("linkedin");

  // Account editing
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [isSavingAccount, setIsSavingAccount] = useState(false); // kept for loading state during combined save

  useEffect(() => {
    if (preferences) {
      setObjective(preferences.objective);
      setPersona(preferences.persona);
      setTone(preferences.tone);
      setBrandRole(preferences.brandRole);
      setBrandAudience(preferences.brandAudience);
      setBrandBelief(preferences.brandBelief);
      if (preferences.aboutMe) setAboutMe(preferences.aboutMe);
      if (preferences.brandBgColor) setBrandBgColor(preferences.brandBgColor);
      if (preferences.brandAccentColor) setBrandAccentColor(preferences.brandAccentColor);
      if (preferences.brandTextColor) setBrandTextColor(preferences.brandTextColor);
    }
  }, [preferences]);

  useEffect(() => {
    if (user?.displayName) setDisplayName(user.displayName);
  }, [user?.displayName]);

  useEffect(() => {
    voiceApi.getSummary()
      .then((data) => setVoiceData(data))
      .catch(() => {})
      .finally(() => setVoiceLoading(false));
  }, []);

  useEffect(() => {
    linkedinApi.status().then(setLinkedinStatus).catch(() => {});
  }, []);

  useEffect(() => {
    if (linkedinParam === "connected") {
      toast({ title: "LinkedIn connected successfully." });
      linkedinApi.status().then(setLinkedinStatus).catch(() => {});
    } else if (linkedinParam === "error") {
      toast({ title: "LinkedIn connection failed. Please try again.", variant: "destructive" });
    }
  }, [linkedinParam]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLinkedinConnect = () => {
    window.location.href = linkedinApi.authUrl();
  };

  const handleLinkedinDisconnect = async () => {
    setLinkedinDisconnecting(true);
    try {
      await linkedinApi.disconnect();
      setLinkedinStatus({ configured: true, connected: false });
      toast({ title: "LinkedIn disconnected." });
    } catch {
      toast({ title: "Could not disconnect LinkedIn.", variant: "destructive" });
    } finally {
      setLinkedinDisconnecting(false);
    }
  };

  const handleLinkedinSync = async () => {
    setLinkedinSyncing(true);
    try {
      const result = await linkedinApi.sync();
      const msg = result.imported > 0
        ? `Synced ${result.imported} post${result.imported !== 1 ? "s" : ""} from LinkedIn.`
        : "No new posts to import.";
      toast({ title: msg });
      linkedinApi.status().then(setLinkedinStatus).catch(() => {});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sync failed.";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setLinkedinSyncing(false);
    }
  };

  const handleSmartImport = (extracted: ExtractedBrandVoice) => {
    if (extracted.brandRole) setBrandRole(extracted.brandRole);
    if (extracted.brandAudience) setBrandAudience(extracted.brandAudience);
    if (extracted.brandBelief) setBrandBelief(extracted.brandBelief);
    if (extracted.objective) setObjective(extracted.objective);
    if (extracted.persona) setPersona(extracted.persona);
    if (extracted.tone) setTone(extracted.tone);
    toast({ title: "Brand voice imported — review and save when ready." });
  };

  const handleRefreshVoice = async () => {
    setVoiceRefreshing(true);
    try {
      const data = await voiceApi.getSummary();
      setVoiceData(data);
    } catch {
      toast({ title: "Could not refresh voice analysis.", variant: "destructive" });
    } finally {
      setVoiceRefreshing(false);
    }
  };

  const handleRefreshInsights = async () => {
    setInsightRefreshing(true);
    try {
      const result = await voiceInsightsApi.generate();
      if (result.status === "insufficient") {
        toast({ title: `Need ${5 - result.count} more performance-logged posts to unlock insights.` });
      } else if (result.suggestions.length === 0) {
        toast({ title: "Your settings already match your top posts — no changes suggested." });
      } else {
        toast({ title: `${result.suggestions.length} new voice insight${result.suggestions.length !== 1 ? "s" : ""} generated. Check the Dashboard.` });
      }
    } catch {
      toast({ title: "Could not generate insights.", variant: "destructive" });
    } finally {
      setInsightRefreshing(false);
    }
  };

  const { mutate: updatePreferences, isPending: isSaving } = useUpdatePreferences();
  const { mutate: logout, isPending: isLoggingOut } = useLogout();

  const handleThemeSelect = (key: string) => {
    setActiveTheme(key);
    updatePreferences(
      { data: { backgroundTheme: key } },
      { onError: () => toast({ title: "Could not save theme.", variant: "destructive" }) }
    );
  };

  const handleCustomUpload = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please choose an image file.", variant: "destructive" });
      return;
    }
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1200;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.78);
      setCustomImageUrl(dataUrl);
      setActiveTheme("custom");
      updatePreferences(
        { data: { bgCustomImageUrl: dataUrl, backgroundTheme: "custom" } as Parameters<typeof updatePreferences>[0]["data"] },
        { onError: () => toast({ title: "Could not save background.", variant: "destructive" }) }
      );
    };
    img.src = objectUrl;
  };

  const handleRemoveCustomBg = () => {
    setCustomImageUrl(null);
    setActiveTheme("none");
    updatePreferences(
      { data: { bgCustomImageUrl: null, backgroundTheme: "none" } as Parameters<typeof updatePreferences>[0]["data"] },
      { onError: () => toast({ title: "Could not remove background.", variant: "destructive" }) }
    );
  };

  const handleSpeedSelect = (s: BgSpeed) => {
    setSpeed(s);
    updatePreferences(
      { data: { bgSpeed: s } },
      { onError: () => toast({ title: "Could not save speed.", variant: "destructive" }) }
    );
  };

  const handleDensitySelect = (d: BgDensity) => {
    setDensity(d);
    updatePreferences(
      { data: { bgDensity: d } },
      { onError: () => toast({ title: "Could not save detail level.", variant: "destructive" }) }
    );
  };

  const handleSiteThemeSelect = (t: SiteTheme) => {
    setSiteTheme(t);
    updatePreferences(
      { data: { siteTheme: t } },
      { onError: () => toast({ title: "Could not save colour theme.", variant: "destructive" }) }
    );
  };

  const handleSave = () => {
    if (showPasswordSection) {
      if (!currentPassword) {
        toast({ title: "Enter your current password.", variant: "destructive" });
        return;
      }
      if (newPassword.length < 8) {
        toast({ title: "New password must be at least 8 characters.", variant: "destructive" });
        return;
      }
      if (newPassword !== confirmPassword) {
        toast({ title: "New passwords don't match.", variant: "destructive" });
        return;
      }
    }

    const accountPayload: { displayName?: string; currentPassword?: string; newPassword?: string } = {};
    if (displayName.trim() && displayName.trim() !== user?.displayName) {
      accountPayload.displayName = displayName.trim();
    }
    if (showPasswordSection && newPassword) {
      accountPayload.currentPassword = currentPassword;
      accountPayload.newPassword = newPassword;
    }
    const hasAccountChanges = Object.keys(accountPayload).length > 0;

    setIsSavingAccount(true);
    updatePreferences(
      { data: { objective, persona, tone, brandRole, brandAudience, brandBelief, aboutMe, brandBgColor, brandAccentColor, brandTextColor } },
      {
        onSuccess: async () => {
          try {
            if (hasAccountChanges) {
              await accountApi.update(accountPayload);
              setCurrentPassword("");
              setNewPassword("");
              setConfirmPassword("");
              setShowPasswordSection(false);
            }
            await invalidate();
            toast({ title: "Settings saved." });
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Could not update account.";
            toast({ title: msg, variant: "destructive" });
          } finally {
            setIsSavingAccount(false);
          }
        },
        onError: () => {
          toast({ title: "Failed to save settings.", variant: "destructive" });
          setIsSavingAccount(false);
        },
      }
    );
  };

  const handleLogout = () => {
    logout(undefined, {
      onSuccess: async () => {
        await invalidate();
        navigate("/login");
      },
    });
  };

  return (
    <AppShell>
        <header className="px-6 pt-12 pb-5 bg-white border-b border-gray-100 sticky top-0 z-10">
          <div className="flex items-center gap-3 mb-1">
            <button onClick={() => navigate("/")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-extrabold text-gray-900">Settings</h1>
          </div>
          <p className="text-sm text-gray-500 ml-11">{user?.email}</p>
        </header>

        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          {/* Smart Import — top of page so it can auto-fill everything */}
          <section>
            <SmartImportButton onApply={handleSmartImport} />
          </section>

          {/* About me — primary context for AI */}
          <section>
            <h2 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-1">About You</h2>
            <p className="text-[11px] text-gray-400 mb-3 leading-relaxed">
              Write 1–3 sentences describing who you are and what you write about. When filled, this replaces the generic Objective + Persona labels and gives the AI real context to write in your voice.
            </p>
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <textarea
                value={aboutMe}
                onChange={e => setAboutMe(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="e.g. I'm a PMO consultant who helps enterprise teams implement AI-driven project delivery. I write for CIOs and VPs of Engineering who are planning digital transformation but keep hitting governance roadblocks."
                className="w-full text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 transition-shadow resize-none leading-relaxed placeholder:text-gray-300"
              />
              <p className="text-[10px] text-gray-300 text-right mt-1">{aboutMe.length}/500</p>
            </div>
          </section>

          {/* Default Audience + Feeling — used as defaults in the Capture flow */}
          <section>
            <h2 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-4">Default Feeling</h2>
            <div className="space-y-5">
              <SelRow
                label="Feeling" options={FEELINGS} selected={tone} onSelect={setTone}
                panelId="tone" openPanelId={openPanelId} onTogglePanel={togglePanel}
                info="The default emotional register for every post. You can swap it on any post."
                optionInfo={{
                  "Direct": "Clear, authoritative, no fluff — straight to the point.",
                  "Witty": "Dry, self-aware humour — clever without cynicism.",
                  "Vulnerable": "Personal and honest — what you learned the hard way.",
                  "Story": "Opens with a vivid scene or moment that pulls the reader in.",
                  "Contrarian": "Challenges the dominant assumption head-on.",
                }}
              />
            </div>
          </section>

          <section>
            <h2 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-4">Default Audience</h2>
            <div className="space-y-5">
              <SelRow
                label="Audience" options={AUDIENCES} selected={objective} onSelect={setObjective}
                panelId="objective" openPanelId={openPanelId} onTogglePanel={togglePanel}
                info="Who you're writing for by default. Swap on any post."
                optionInfo={{
                  "Clients": "Future buyers and prospects — positions you as the answer.",
                  "Peers": "Operators in your field — earns respect through specificity.",
                  "Recruiters & Headhunters": "Hiring managers and recruiters — signals you're hireable.",
                  "Investors": "VCs, angels, capital allocators — speaks to ambition and traction.",
                  "My audience": "Mixed crowd already following you — broad relatability.",
                }}
              />
            </div>
          </section>

          {/* Brand Voice */}
          <section>
            <h2 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-4">Brand Voice</h2>
            <div className="space-y-4">
              <VoiceInput label="Your role" value={brandRole} onChange={setBrandRole} placeholder="I help founders build systems that scale..."
                panelId="role" openPanelId={openPanelId} onTogglePanel={togglePanel}
                info="Tells the AI who you are in one sentence. The more specific, the more precise the content. Example: 'PMO consultant helping enterprise teams implement AI-driven project delivery'."
              />
              <VoiceInput label="Your audience" value={brandAudience} onChange={setBrandAudience} placeholder="B2B founders with 5–50 person teams..."
                panelId="audience" openPanelId={openPanelId} onTogglePanel={togglePanel}
                info="Tells the AI who you're speaking to. Example: 'CIOs and VPs of Engineering at companies with 500+ employees planning digital transformation'."
              />
              <VoiceInput label="Your core belief" value={brandBelief} onChange={setBrandBelief} placeholder="Clarity beats cleverness..."
                panelId="belief" openPanelId={openPanelId} onTogglePanel={togglePanel}
                info="Your philosophical anchor — the contrarian or foundational idea that makes your POV unique. Example: 'Most digital transformations fail because of governance gaps, not technology gaps'."
              />
            </div>
          </section>

          {/* Brand Palette */}
          <section>
            <h2 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-4">Brand Palette</h2>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
              <p className="text-xs text-gray-400 leading-relaxed">These colours are used for carousel slides and visual cards.</p>
              <div className="flex gap-4">
                <label className="flex flex-col gap-2 flex-1 cursor-pointer">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Background</span>
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-xl overflow-hidden border-2 border-gray-200 flex-shrink-0">
                      <div className="absolute inset-0" style={{ background: brandBgColor }} />
                      <input
                        type="color"
                        value={brandBgColor}
                        onChange={e => setBrandBgColor(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </div>
                    <code className="text-xs text-gray-400 font-mono">{brandBgColor}</code>
                  </div>
                </label>
                <label className="flex flex-col gap-2 flex-1 cursor-pointer">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Accent</span>
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-xl overflow-hidden border-2 border-gray-200 flex-shrink-0">
                      <div className="absolute inset-0" style={{ background: brandAccentColor }} />
                      <input
                        type="color"
                        value={brandAccentColor}
                        onChange={e => setBrandAccentColor(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </div>
                    <code className="text-xs text-gray-400 font-mono">{brandAccentColor}</code>
                  </div>
                </label>
                <label className="flex flex-col gap-2 flex-1 cursor-pointer">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Text</span>
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-xl overflow-hidden border-2 border-gray-200 flex-shrink-0">
                      <div className="absolute inset-0" style={{ background: brandTextColor }} />
                      <input
                        type="color"
                        value={brandTextColor}
                        onChange={e => setBrandTextColor(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </div>
                    <code className="text-xs text-gray-400 font-mono">{brandTextColor}</code>
                  </div>
                </label>
              </div>
            </div>
          </section>

          {/* Appearance */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <h2 className="text-xs font-black uppercase tracking-wider text-gray-400">Appearance</h2>
            </div>
            <p className="text-[11px] text-gray-400 mb-4 leading-relaxed">
              Pick an animated background, control its speed, and set your app colour theme. All changes apply instantly.
            </p>

            {/* App colour theme */}
            <div className="mb-5">
              <p className="text-[10px] font-black text-gray-300 uppercase tracking-wider mb-2.5">App Colour Theme</p>
              <div className="flex gap-2.5 flex-wrap">
                {(Object.entries(SITE_THEMES) as [SiteTheme, typeof SITE_THEMES[SiteTheme]][]).map(([key, t]) => {
                  const isActive = activeSiteTheme === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      title={t.label}
                      onClick={() => handleSiteThemeSelect(key)}
                      className={cn(
                        "w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center",
                        isActive ? "border-gray-700 ring-2 ring-offset-1 ring-gray-400 scale-110" : "border-transparent hover:scale-105"
                      )}
                      style={{ background: t.hex }}
                    >
                      {isActive && (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke={t.foreground === "0 0% 100%" ? "white" : "#111"} strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-gray-400 mt-2">
                {SITE_THEMES[activeSiteTheme]?.label ?? "Indigo"} — changes buttons, links and highlights across the app.
              </p>
            </div>

            {/* Animation speed */}
            <div className="mb-5">
              <p className="text-[10px] font-black text-gray-300 uppercase tracking-wider mb-2.5">Animation Speed</p>
              <div className="flex gap-2">
                {(["slow", "normal", "fast"] as BgSpeed[]).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSpeedSelect(s)}
                    className={cn(
                      "flex-1 py-1.5 rounded-xl text-[11px] font-bold border transition-all capitalize",
                      speed === s
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                    )}
                  >
                    {s === "slow" ? "🐢 Slow" : s === "normal" ? "⚡ Normal" : "🔥 Fast"}
                  </button>
                ))}
              </div>
            </div>

            {/* Detail level / density */}
            <div className="mb-5">
              <p className="text-[10px] font-black text-gray-300 uppercase tracking-wider mb-2.5">Detail Level</p>
              <div className="flex gap-2">
                {(["low", "normal", "high"] as BgDensity[]).map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handleDensitySelect(d)}
                    className={cn(
                      "flex-1 py-1.5 rounded-xl text-[11px] font-bold border transition-all",
                      density === d
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                    )}
                  >
                    {d === "low" ? "✦ Sparse" : d === "normal" ? "— Normal" : "✦✦✦ Dense"}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-2">Scales stars, particles and node counts.</p>
            </div>

            {/* None + My Photo — always first */}
            <div className="mb-4">
              <p className="text-[10px] font-black text-gray-300 uppercase tracking-wider mb-2">Default</p>
              <div className="grid grid-cols-3 gap-2.5">
                <ThumbBtn bgKey="none" label="None" isActive={activeTheme === "none"} onSelect={handleThemeSelect}>
                  <div className="absolute inset-0 bg-[#EDEDEE] flex items-center justify-center">
                    <span className="text-[10px] font-bold text-gray-400">None</span>
                  </div>
                </ThumbBtn>

                {/* My Photo — custom upload tile */}
                <button
                  type="button"
                  onClick={() => uploadRef.current?.click()}
                  className={cn(
                    "relative rounded-xl overflow-hidden border-2 transition-all aspect-[8/5]",
                    activeTheme === "custom" ? "border-primary ring-2 ring-primary/30" : "border-gray-200 hover:border-gray-300"
                  )}
                  title="My Photo"
                >
                  {customImageUrl ? (
                    <>
                      <img src={customImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute bottom-0 inset-x-0 px-1.5 py-1 bg-gradient-to-t from-black/70 to-transparent flex items-center justify-between">
                        <p className="text-[9px] font-bold text-white leading-tight">My Photo</p>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); handleRemoveCustomBg(); }}
                          className="w-4 h-4 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-red-500 transition-colors"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 bg-gray-100 flex flex-col items-center justify-center gap-1">
                      <ImagePlus className="w-4 h-4 text-gray-400" />
                      <span className="text-[9px] font-bold text-gray-400">My Photo</span>
                    </div>
                  )}
                  {activeTheme === "custom" && (
                    <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-primary flex items-center justify-center">
                      <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              </div>
              <input
                ref={uploadRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleCustomUpload(f); e.target.value = ""; }}
              />
            </div>

            {/* Grouped by category — custom is handled above, skip it here */}
            {Array.from(new Set(BACKGROUNDS.filter(b => b.key !== "custom").map(b => b.category))).map(cat => {
              const items = BACKGROUNDS.filter(b => b.category === cat && b.key !== "custom");
              if (items.length === 0) return null;
              return (
                <div key={cat} className="mb-4">
                  <p className="text-[10px] font-black text-gray-300 uppercase tracking-wider mb-2">{cat}</p>
                  <div className="grid grid-cols-3 gap-2.5">
                    {items.map(bg => {
                      const BgComp = bg.component;
                      return (
                        <ThumbBtn key={bg.key} bgKey={bg.key} label={bg.label} isActive={activeTheme === bg.key} onSelect={handleThemeSelect}>
                          <div className="absolute inset-0" style={{ pointerEvents: "none" }}>
                            <BgComp />
                          </div>
                          <div className="absolute bottom-0 inset-x-0 px-1.5 py-1 bg-gradient-to-t from-black/60 to-transparent">
                            <p className="text-[9px] font-bold text-white leading-tight truncate">{bg.label}</p>
                          </div>
                        </ThumbBtn>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>

          {/* LinkedIn */}
          <section>
            <h2 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-4">LinkedIn</h2>
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              {linkedinStatus === null ? (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking connection…
                </div>
              ) : !linkedinStatus.configured ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Link2 className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">LinkedIn not connected yet</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                        Connecting LinkedIn lets you import your posts, track real engagement data, and get smarter AI suggestions based on what's actually working for you.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLinkedinGuideOpen(v => !v)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors"
                  >
                    <span>How to set this up (one-time, 5 min)</span>
                    {linkedinGuideOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {linkedinGuideOpen && (
                    <div className="bg-gray-50 rounded-xl p-4 space-y-4 text-xs text-gray-600 leading-relaxed">
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">One-time setup — done by you as the app owner</p>
                        <p className="text-gray-500 mt-1">Once done, all users just tap "Connect LinkedIn" — they never see any of this.</p>
                      </div>
                      <ol className="space-y-4 list-none">
                        <li className="flex gap-3">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                          <span>
                            Go to <a href="https://www.linkedin.com/developers/apps/new" target="_blank" rel="noreferrer" className="text-blue-600 font-semibold underline inline-flex items-center gap-0.5">LinkedIn Developer Portal <ExternalLink className="w-3 h-3" /></a> and create a new app. Use any name you like — "Brand OS" works.
                          </span>
                        </li>
                        <li className="flex gap-3">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                          <div className="flex-1">
                            <span>Inside your LinkedIn app, go to the <strong>Auth</strong> tab. Add <strong>both</strong> of these as Authorized Redirect URLs — one for testing, one for your live site:</span>
                            <code className="mt-1.5 mb-1 flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2 py-1 text-[11px] break-all">
                              <span className="text-gray-400 flex-shrink-0">DEV</span>
                              <span className="select-all">{window.location.origin}/api/linkedin/callback</span>
                            </code>
                            <code className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2 py-1 text-[11px] break-all">
                              <span className="text-gray-400 flex-shrink-0">LIVE</span>
                              <span className="text-gray-400 select-all">https://your-published-app-url.replit.app/api/linkedin/callback</span>
                            </code>
                            <p className="mt-1.5 text-[10px] text-amber-600 font-medium">⚠ The redirect URL is shared — all users go through the same server endpoint (that's normal and secure). If you ever change your app's domain, you'll need to update this in your LinkedIn app too.</p>
                          </div>
                        </li>
                        <li className="flex gap-3">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                          <span>
                            On the <strong>Products</strong> tab, request access to <strong>"Share on LinkedIn"</strong> and <strong>"Sign In with LinkedIn using OpenID Connect"</strong>. LinkedIn may take a day or two to approve.
                          </span>
                        </li>
                        <li className="flex gap-3">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                          <span>
                            Back on the <strong>Auth</strong> tab, copy your <strong>Client ID</strong> and <strong>Client Secret</strong>. Keep these private — treat them like passwords.
                          </span>
                        </li>
                        <li className="flex gap-3">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">5</span>
                          <div className="flex-1">
                            <span>Open your <strong>Replit project</strong> in a separate tab. In the left sidebar, click the <strong>padlock icon</strong> (called Secrets). This is where your app stores private values — they're never visible to users or stored in your code.</span>
                            <div className="mt-2 space-y-1.5">
                              <div className="bg-white border border-gray-200 rounded-lg px-2 py-2">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Secret name</p>
                                <code className="text-[11px] font-semibold">LINKEDIN_CLIENT_ID</code>
                                <p className="text-[10px] text-gray-400 mt-0.5">Value: paste your Client ID here</p>
                              </div>
                              <div className="bg-white border border-gray-200 rounded-lg px-2 py-2">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Secret name</p>
                                <code className="text-[11px] font-semibold">LINKEDIN_CLIENT_SECRET</code>
                                <p className="text-[10px] text-gray-400 mt-0.5">Value: paste your Client Secret here</p>
                              </div>
                            </div>
                          </div>
                        </li>
                        <li className="flex gap-3">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">6</span>
                          <span>
                            In Replit, restart the <strong>API Server</strong> workflow (Workflows panel → click the restart button next to it). Then refresh this page — a "Connect LinkedIn" button will appear here.
                          </span>
                        </li>
                      </ol>
                    </div>
                  )}
                </div>
              ) : linkedinStatus.connected ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Connected as {linkedinStatus.displayName}</p>
                      {linkedinStatus.lastSyncedAt && (
                        <p className="text-xs text-gray-400">
                          Last synced {(() => {
                            const diffMs = Date.now() - new Date(linkedinStatus.lastSyncedAt!).getTime();
                            const mins = Math.floor(diffMs / 60000);
                            if (mins < 1) return "just now";
                            if (mins < 60) return `${mins}m ago`;
                            const hrs = Math.floor(mins / 60);
                            if (hrs < 24) return `${hrs}h ago`;
                            return `${Math.floor(hrs / 24)}d ago`;
                          })()}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    We only import posts and articles you authored — never reposts or comments, and never anything posted on your behalf.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => void handleLinkedinSync()}
                      disabled={linkedinSyncing}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {linkedinSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
                      {linkedinSyncing ? "Syncing…" : "Sync Posts"}
                    </button>
                    <button
                      onClick={() => void handleLinkedinDisconnect()}
                      disabled={linkedinDisconnecting}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    >
                      {linkedinDisconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
                      Disconnect
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Connect your LinkedIn account to automatically import your posts and their engagement data.
                  </p>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    We only import posts and articles you authored — never reposts or comments, and never anything posted on your behalf.
                  </p>
                  <button
                    onClick={handleLinkedinConnect}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  >
                    <Link2 className="w-4 h-4" />
                    Connect LinkedIn
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Voice Evolution Timeline */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-violet-500" />
                <h2 className="text-xs font-black uppercase tracking-wider text-gray-400">Voice DNA Analysis</h2>
              </div>
              <div className="flex items-center gap-3">
                {voiceData && voiceData.draftCount > 0 && (
                  <button
                    onClick={() => void handleRefreshVoice()}
                    disabled={voiceRefreshing}
                    className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/70 transition-colors"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", voiceRefreshing && "animate-spin")} />
                    Refresh
                  </button>
                )}
                <button
                  onClick={() => void handleRefreshInsights()}
                  disabled={insightRefreshing}
                  className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors"
                >
                  {insightRefreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Get Insights
                </button>
              </div>
            </div>

            {voiceLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 rounded-full w-3/4" />
                <Skeleton className="h-4 rounded-full w-full" />
                <Skeleton className="h-4 rounded-full w-5/6" />
              </div>
            ) : !voiceData || voiceData.draftCount === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-5 text-center">
                <Brain className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-500 font-medium">No voice data yet</p>
                <p className="text-xs text-gray-400 mt-1">Publish your first drafts to unlock your voice analysis.</p>
              </div>
            ) : voiceData.summary ? (
              <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-black text-violet-400 uppercase tracking-wider">Based on {voiceData.draftCount} published post{voiceData.draftCount !== 1 ? "s" : ""}</p>
                </div>
                <div className="space-y-2">
                  {voiceData.summary.split("\n").filter(Boolean).map((line, i) => (
                    <p key={i} className="text-sm text-violet-900 leading-relaxed">{line}</p>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center">
                <p className="text-sm text-gray-500">Voice analysis will appear once you have published posts with enough writing signals.</p>
              </div>
            )}
          </section>

          {/* Account */}
          <section>
            <h2 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-4">Account</h2>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Display name</p>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  maxLength={80}
                  className="w-full text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20 transition-shadow"
                />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Email</p>
                <p className="text-sm text-gray-500">{user?.email}</p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => setShowPasswordSection(v => !v)}
                  className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  {showPasswordSection ? "Cancel password change" : "Change password"}
                </button>
                {showPasswordSection && (
                  <div className="mt-3 space-y-3">
                    <div className="relative">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Current password</p>
                      <input
                        type={showCurrentPw ? "text" : "password"}
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                        className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 pr-10 outline-none focus:ring-2 focus:ring-primary/20 transition-shadow"
                      />
                      <button type="button" onClick={() => setShowCurrentPw(v => !v)} className="absolute right-3 top-8 text-gray-400 hover:text-gray-600">
                        {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="relative">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">New password</p>
                      <input
                        type={showNewPw ? "text" : "password"}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 pr-10 outline-none focus:ring-2 focus:ring-primary/20 transition-shadow"
                      />
                      <button type="button" onClick={() => setShowNewPw(v => !v)} className="absolute right-3 top-8 text-gray-400 hover:text-gray-600">
                        {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Confirm new password</p>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Repeat new password"
                        className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20 transition-shadow"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Save Button */}
          <Button className="w-full h-14 text-base font-semibold" onClick={handleSave} disabled={isSavingAccount || isSaving}>
            {(isSavingAccount || isSaving) ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Save changes</>}
          </Button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full h-12 flex items-center justify-center gap-2 text-red-500 hover:text-red-600 text-sm font-semibold transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {isLoggingOut ? "Logging out..." : "Log out"}
          </button>
        </main>
    </AppShell>
  );
}

function SelRow({
  label, options, selected, onSelect,
  info, optionInfo,
  panelId, openPanelId, onTogglePanel,
}: {
  label: string;
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
  info?: string;
  optionInfo?: Record<string, string>;
  panelId?: string;
  openPanelId?: string | null;
  onTogglePanel?: (id: string) => void;
}) {
  const isOpen = panelId !== undefined && openPanelId === panelId;
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</p>
        {panelId && onTogglePanel && (
          <button
            type="button"
            onClick={() => onTogglePanel(panelId)}
            aria-expanded={isOpen}
            aria-label={`Info about ${label}`}
            className={cn("p-0.5 rounded-md transition-colors", isOpen ? "text-primary" : "text-gray-400 hover:text-gray-600")}
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {isOpen && (info || optionInfo) && (
        <div className="mb-3 bg-indigo-50 border border-indigo-100 rounded-xl px-3.5 py-3 space-y-2">
          {info && <p className="text-xs text-indigo-700 leading-relaxed">{info}</p>}
          {optionInfo && (
            <ul className="space-y-1">
              {options.filter(o => optionInfo[o]).map(o => (
                <li key={o} className="text-xs text-indigo-600 leading-relaxed">
                  <span className="font-bold">{o}</span> — {optionInfo[o]}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o} onClick={() => onSelect(o)}
            className={cn("px-3.5 py-2 rounded-xl text-xs font-bold transition-all border-2",
              selected === o ? "bg-primary text-white border-primary" : "bg-white text-gray-600 border-gray-200 hover:border-primary/40")}
          >{o}</button>
        ))}
      </div>
    </div>
  );
}

function VoiceInput({
  label, value, onChange, placeholder,
  info, panelId, openPanelId, onTogglePanel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  info?: string;
  panelId?: string;
  openPanelId?: string | null;
  onTogglePanel?: (id: string) => void;
}) {
  const isOpen = panelId !== undefined && openPanelId === panelId;
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</p>
        {panelId && onTogglePanel && (
          <button
            type="button"
            onClick={() => onTogglePanel(panelId)}
            aria-expanded={isOpen}
            aria-label={`Info about ${label}`}
            className={cn("p-0.5 rounded-md transition-colors", isOpen ? "text-primary" : "text-gray-400 hover:text-gray-600")}
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {isOpen && info && (
        <div className="mb-2 bg-indigo-50 border border-indigo-100 rounded-xl px-3.5 py-3">
          <p className="text-xs text-indigo-700 leading-relaxed">{info}</p>
        </div>
      )}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm outline-none focus:border-primary transition-colors resize-none leading-relaxed placeholder:text-gray-300 bg-white"
      />
    </div>
  );
}
