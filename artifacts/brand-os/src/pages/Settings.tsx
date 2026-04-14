import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, LogOut, Save, Loader2, Brain, RefreshCw, Eye, EyeOff, KeyRound, Info } from "lucide-react";
import { useUpdatePreferences, useLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { voiceApi, accountApi, type VoiceSummaryResult } from "@/lib/api";
import { SmartImportButton } from "@/components/SmartImportButton";
import type { ExtractedBrandVoice } from "@/lib/api";

const OBJECTIVES = ["Clients", "Job", "Authority", "Documenting", "Expert", "Hiring"];
const PERSONAS = ["Operator", "Founder", "Career", "Technical", "Sales"];
const TONES = ["Executive", "Direct", "Story", "Contrarian", "Witty", "Vulnerable", "Playful", "Snappy"];

export default function Settings() {
  const [, navigate] = useLocation();
  const { user, preferences, invalidate } = useAuth();
  const { toast } = useToast();

  const [objective, setObjective] = useState(preferences?.objective ?? "Authority");
  const [persona, setPersona] = useState(preferences?.persona ?? "Founder");
  const [tone, setTone] = useState(preferences?.tone ?? "Direct");
  const [brandRole, setBrandRole] = useState(preferences?.brandRole ?? "");
  const [brandAudience, setBrandAudience] = useState(preferences?.brandAudience ?? "");
  const [brandBelief, setBrandBelief] = useState(preferences?.brandBelief ?? "");
  const [aboutMe, setAboutMe] = useState((preferences as typeof preferences & { aboutMe?: string })?.aboutMe ?? "");

  const prefs = preferences as (typeof preferences & { brandBgColor?: string; brandAccentColor?: string; brandTextColor?: string });
  const [brandBgColor, setBrandBgColor] = useState(prefs?.brandBgColor ?? "#0f172a");
  const [brandAccentColor, setBrandAccentColor] = useState(prefs?.brandAccentColor ?? "#6366f1");
  const [brandTextColor, setBrandTextColor] = useState(prefs?.brandTextColor ?? "#ffffff");

  const [openPanelId, setOpenPanelId] = useState<string | null>(null);
  const togglePanel = (id: string) => setOpenPanelId(prev => prev === id ? null : id);

  const [voiceData, setVoiceData] = useState<VoiceSummaryResult | null>(null);
  const [voiceLoading, setVoiceLoading] = useState(true);
  const [voiceRefreshing, setVoiceRefreshing] = useState(false);

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
      const p = preferences as Record<string, unknown>;
      if (typeof p.aboutMe === "string") setAboutMe(p.aboutMe);
      if (typeof p.brandBgColor === "string") setBrandBgColor(p.brandBgColor);
      if (typeof p.brandAccentColor === "string") setBrandAccentColor(p.brandAccentColor);
      if (typeof p.brandTextColor === "string") setBrandTextColor(p.brandTextColor);
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

  const { mutate: updatePreferences, isPending: isSaving } = useUpdatePreferences();
  const { mutate: logout, isPending: isLoggingOut } = useLogout();

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
    <div className="min-h-screen bg-[#EDEDEE] flex justify-center">
      <div className="w-full max-w-[430px] bg-gray-50 min-h-screen shadow-2xl flex flex-col border-x border-gray-200">
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

          {/* Content Settings */}
          <section>
            <h2 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-1">Content Preferences</h2>
            <p className="text-[11px] text-gray-400 mb-4 leading-relaxed">Used as fallback when "About You" is empty.</p>
            <div className="space-y-5">
              <SelRow
                label="Default Objective" options={OBJECTIVES} selected={objective} onSelect={setObjective}
                panelId="objective" openPanelId={openPanelId} onTogglePanel={togglePanel}
                info="Sets the LinkedIn goal shaping every post you generate."
                optionInfo={{
                  "Clients": "Positions you as the solution enterprise buyers are looking for.",
                  "Job": "Signals career momentum and the value you bring to a new role.",
                  "Authority": "Produces opinion-led content that builds long-term credibility.",
                  "Documenting": "Shows the real work — builds trust through transparency.",
                  "Expert": "Deep technical content that earns respect from peers.",
                  "Hiring": "Attracts talent by showcasing culture, mission, and opportunity.",
                }}
              />
              <SelRow
                label="Persona" options={PERSONAS} selected={persona} onSelect={setPersona}
                panelId="persona" openPanelId={openPanelId} onTogglePanel={togglePanel}
                info="Frames your point of view and what you optimise for."
                optionInfo={{
                  "Founder": "Assumes vision and leadership language.",
                  "Operator": "Assumes systems, execution, and measurable outcomes.",
                  "Career": "Focuses on professional growth, credibility, and opportunities.",
                  "Technical": "Leads with depth, precision, and craft.",
                  "Sales": "Focuses on value, trust, and closing the gap.",
                }}
              />
              <SelRow
                label="Tone" options={TONES} selected={tone} onSelect={setTone}
                panelId="tone" openPanelId={openPanelId} onTogglePanel={togglePanel}
                info="The default writing energy applied to every post. You can override this per post."
                optionInfo={{
                  "Executive": "Polished, measured, authoritative — warm and human, never cold. Reads like a considered keynote.",
                  "Direct": "Punchy and efficient — no warm-up, straight to the point.",
                  "Story": "Opens with a scene or moment that pulls the reader in.",
                  "Contrarian": "Challenges the dominant assumption head-on — sparks debate and earns attention.",
                  "Witty": "Dry, self-aware humour — clever without being cynical, warm without being soft.",
                  "Vulnerable": "Personal and honest — shares what was learned the hard way, no performance.",
                  "Playful": "Light wordplay and warm professional humour — personality-forward without being cringe.",
                  "Snappy": "Under 150 words, 3–5 punchy lines — no buildup, straight to the sharpest point.",
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

          {/* Voice Evolution Timeline */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-violet-500" />
                <h2 className="text-xs font-black uppercase tracking-wider text-gray-400">Voice DNA Analysis</h2>
              </div>
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
      </div>
    </div>
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
