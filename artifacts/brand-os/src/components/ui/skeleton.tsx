import { cn } from "@/lib/utils";
import { Sparkles, FlaskConical } from "lucide-react";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-2xl bg-primary/10", className)}
      {...props}
    />
  );
}

export function GenerationLoader({ text, isDemo = false }: { text: string; isDemo?: boolean }) {
  if (isDemo) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-8 animate-in fade-in duration-500 py-20">
        <div className="relative">
          <div className="absolute inset-0 bg-amber-400/20 blur-xl rounded-full animate-pulse"></div>
          <div className="w-20 h-20 bg-gradient-to-tr from-amber-400 to-orange-500 rounded-3xl flex items-center justify-center shadow-2xl relative animate-bounce">
            <FlaskConical className="w-10 h-10 text-white" />
          </div>
        </div>

        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold uppercase tracking-wide mb-1">
            Demo Preview
          </div>
          <h3 className="text-xl font-bold text-foreground">{text}</h3>
          <p className="text-muted-foreground text-sm max-w-[260px] mx-auto">
            Showing a curated example — sign up for real AI-generated posts tailored to your voice.
          </p>
        </div>

        <div className="w-full max-w-[250px] space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6 mx-auto" />
          <Skeleton className="h-4 w-4/6 mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-8 animate-in fade-in duration-500 py-20">
      <div className="relative">
        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse"></div>
        <div className="w-20 h-20 bg-gradient-to-tr from-primary to-purple-500 rounded-3xl flex items-center justify-center shadow-2xl relative animate-bounce">
          <Sparkles className="w-10 h-10 text-white" />
        </div>
      </div>
      
      <div className="text-center space-y-3">
        <h3 className="text-xl font-bold text-foreground">{text}</h3>
        <p className="text-muted-foreground text-sm max-w-[250px] mx-auto">
          Our AI is doing the heavy lifting. This usually takes 10-15 seconds.
        </p>
      </div>

      <div className="w-full max-w-[250px] space-y-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6 mx-auto" />
        <Skeleton className="h-4 w-4/6 mx-auto" />
      </div>
    </div>
  );
}

export { Skeleton };
