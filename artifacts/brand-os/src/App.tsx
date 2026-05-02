import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { BackgroundProvider } from "@/lib/background-context";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Onboarding from "@/pages/Onboarding";
import Dashboard from "@/pages/Dashboard";
import Capture from "@/pages/Capture";
import Library from "@/pages/Library";
import Settings from "@/pages/Settings";
import Vault from "@/pages/Vault";
import Analytics from "@/pages/Analytics";
import NotFound from "@/pages/not-found";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function AuthGuard({ children, requireOnboarded = true }: { children: React.ReactNode; requireOnboarded?: boolean }) {
  const { user, preferences, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        navigate("/login");
      } else if (requireOnboarded && preferences && !preferences.onboarded) {
        navigate("/onboarding");
      }
    }
  }, [user, preferences, isLoading, requireOnboarded, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#EDEDEE] flex justify-center md:ml-[220px]">
        <div className="w-full max-w-[430px] md:max-w-[700px] bg-gray-50 min-h-screen shadow-2xl border-x border-gray-200 animate-pulse" />
      </div>
    );
  }

  if (!user) return null;
  if (requireOnboarded && preferences && !preferences.onboarded) return null;
  return <>{children}</>;
}

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { user, preferences, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        navigate("/login");
      } else if (preferences?.onboarded) {
        navigate("/");
      }
    }
  }, [user, preferences, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#EDEDEE] flex justify-center">
        <div className="w-full max-w-[430px] bg-gray-50 min-h-screen shadow-2xl border-x border-gray-200 animate-pulse" />
      </div>
    );
  }

  if (!user) return null;
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/onboarding">
        <OnboardingGuard>
          <Onboarding />
        </OnboardingGuard>
      </Route>
      <Route path="/settings">
        <AuthGuard requireOnboarded={false}>
          <Settings />
        </AuthGuard>
      </Route>
      <Route path="/capture">
        <AuthGuard>
          <Capture />
        </AuthGuard>
      </Route>
      <Route path="/library">
        <AuthGuard>
          <Library />
        </AuthGuard>
      </Route>
      <Route path="/vault">
        <AuthGuard>
          <Vault />
        </AuthGuard>
      </Route>
      <Route path="/analytics">
        <AuthGuard>
          <Analytics />
        </AuthGuard>
      </Route>
      <Route path="/">
        <AuthGuard>
          <Dashboard />
        </AuthGuard>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

/**
 * Reads backgroundTheme from preferences (inside AuthProvider) and provides
 * BackgroundContext to the entire app so any page (including Settings) can
 * call useBackgroundTheme() without being a direct child of AppShell.
 */
function RootBackgroundProvider({ children }: { children: React.ReactNode }) {
  const { preferences } = useAuth();
  const prefs = preferences as (typeof preferences & { backgroundTheme?: string | null }) | undefined;
  return (
    <BackgroundProvider initialTheme={prefs?.backgroundTheme ?? "none"}>
      {children}
    </BackgroundProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <RootBackgroundProvider>
              <ErrorBoundary>
                <Router />
              </ErrorBoundary>
            </RootBackgroundProvider>
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
