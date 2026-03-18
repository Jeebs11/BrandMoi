import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, LogOut, Save, Loader2, Eye, EyeOff } from "lucide-react";
import { useUpdatePreferences, useLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const OBJECTIVES = ["Clients", "Job", "Authority", "Documenting"];
const PERSONAS = ["Operator", "Founder", "Career", "Technical", "Sales"];
const TONES = ["Direct", "Story", "Educational", "Bold"];

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

  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (preferences) {
      setObjective(preferences.objective);
      setPersona(preferences.persona);
      setTone(preferences.tone);
      setBrandRole(preferences.brandRole);
      setBrandAudience(preferences.brandAudience);
      setBrandBelief(preferences.brandBelief);
    }
  }, [preferences]);

  const { mutate: updatePreferences, isPending: isSaving } = useUpdatePreferences();
  const { mutate: logout, isPending: isLoggingOut } = useLogout();

  const handleSave = () => {
    updatePreferences(
      { data: { objective, persona, tone, brandRole, brandAudience, brandBelief } },
      {
        onSuccess: async () => {
          await invalidate();
          toast({ title: "Settings saved." });
        },
        onError: () => toast({ title: "Failed to save settings.", variant: "destructive" }),
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
          {/* Content Settings */}
          <section>
            <h2 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-4">Content Preferences</h2>
            <div className="space-y-5">
              <SelRow label="Default Objective" options={OBJECTIVES} selected={objective} onSelect={setObjective} />
              <SelRow label="Persona" options={PERSONAS} selected={persona} onSelect={setPersona} />
              <SelRow label="Tone" options={TONES} selected={tone} onSelect={setTone} />
            </div>
          </section>

          {/* Brand Voice */}
          <section>
            <h2 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-4">Brand Voice</h2>
            <div className="space-y-4">
              <VoiceInput label="Your role" value={brandRole} onChange={setBrandRole} placeholder="I help founders build systems that scale..." />
              <VoiceInput label="Your audience" value={brandAudience} onChange={setBrandAudience} placeholder="B2B founders with 5–50 person teams..." />
              <VoiceInput label="Your core belief" value={brandBelief} onChange={setBrandBelief} placeholder="Clarity beats cleverness..." />
            </div>
          </section>

          {/* Account */}
          <section>
            <h2 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-4">Account</h2>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Display name</p>
                <p className="text-sm text-gray-800">{user?.displayName}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Email</p>
                <p className="text-sm text-gray-800">{user?.email}</p>
              </div>
            </div>
          </section>

          {/* Save Button */}
          <Button className="w-full h-14 text-base font-semibold" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Save changes</>}
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

function SelRow({ label, options, selected, onSelect }: { label: string; options: string[]; selected: string; onSelect: (v: string) => void }) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{label}</p>
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

function VoiceInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">{label}</p>
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
