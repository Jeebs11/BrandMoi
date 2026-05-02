import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useRegister } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";

export default function Signup() {
  const [, navigate] = useLocation();
  const { invalidate } = useAuth();
  const search = useSearch();
  const prefillEmail = new URLSearchParams(search).get("email") ?? "";
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");

  const { mutate: register, isPending } = useRegister();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    register(
      { data: { displayName, email, password } },
      {
        onSuccess: async () => {
          await invalidate();
          navigate("/onboarding");
        },
        onError: (err: unknown) => {
          const msg = (err as { data?: { error?: string } })?.data?.error ?? "Sign up failed. Try again.";
          setError(msg);
        },
      }
    );
  };

  return (
    <AppShell auth>
      <div className="w-full max-w-[430px] md:max-w-[480px] bg-white rounded-3xl shadow-2xl p-8">
        <div className="mb-8">
          <div className="w-10 h-10 bg-primary rounded-2xl mb-5" />
          <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Create your account</h1>
          <p className="text-gray-500 text-sm">Build your personal brand operating system.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Your Name</label>
            <input
              type="text"
              required
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm outline-none focus:border-primary transition-colors"
              placeholder="First Last"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm outline-none focus:border-primary transition-colors"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
              Password <span className="text-gray-400 font-normal">(min 8 chars)</span>
            </label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-11 border-2 border-gray-200 rounded-xl text-sm outline-none focus:border-primary transition-colors"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full h-13 text-base font-semibold mt-2" disabled={isPending}>
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create account"}
          </Button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-primary font-semibold hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </AppShell>
  );
}
