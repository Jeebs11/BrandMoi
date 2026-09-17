import { useMemo } from "react";
import { BriefcaseBusiness, Copy, Image, Info, Lightbulb, Search, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FieldRewrite, ProfileAlignmentAnalysis } from "@/lib/api";

interface Props {
  analysis: ProfileAlignmentAnalysis;
  onCopy: (text: string, label?: string) => void;
}

function rewriteFor(analysis: ProfileAlignmentAnalysis, field: FieldRewrite["field"]): FieldRewrite | undefined {
  return analysis.fieldRewrites.find((rewrite) => rewrite.field === field);
}

function Annotation({
  number,
  tone = "violet",
  children,
}: {
  number: number;
  tone?: "violet" | "amber" | "emerald" | "sky";
  children: React.ReactNode;
}) {
  const styles = {
    violet: "bg-violet-100 text-violet-700 border-violet-200",
    amber: "bg-amber-100 text-amber-700 border-amber-200",
    emerald: "bg-emerald-100 text-emerald-700 border-emerald-200",
    sky: "bg-sky-100 text-sky-700 border-sky-200",
  } as const;
  return (
    <div className={cn("flex items-start gap-2 rounded-xl border px-2.5 py-2 text-[10px] leading-relaxed", styles[tone])}>
      <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-white/80 text-[9px] font-black">{number}</span>
      <span>{children}</span>
    </div>
  );
}

function CopySuggestion({
  value,
  onCopy,
}: {
  value: string;
  onCopy: () => void;
}) {
  return (
    <div className="mt-2 rounded-xl border border-violet-100 bg-violet-50/70 p-2.5">
      <div className="flex items-start gap-2">
        <p className="flex-1 whitespace-pre-wrap text-xs leading-relaxed text-gray-800">{value}</p>
        <button
          type="button"
          onClick={onCopy}
          className="flex flex-shrink-0 items-center gap-1 rounded-lg border border-violet-200 bg-white px-2 py-1 text-[10px] font-bold text-violet-700 hover:bg-violet-50"
        >
          <Copy className="h-3 w-3" /> Copy
        </button>
      </div>
    </div>
  );
}

export function ProfileAlignmentAnnotatedView({ analysis, onCopy }: Props) {
  const headline = rewriteFor(analysis, "headline");
  const about = rewriteFor(analysis, "about");
  const currentRole = rewriteFor(analysis, "current_role");
  const audits = analysis.scorecard?.experienceBullets ?? [];
  const skills = analysis.scorecard?.skills;

  const roleAudits = useMemo(() => {
    const grouped = new Map<string, typeof audits>();
    audits.forEach((audit) => {
      const existing = grouped.get(audit.role) ?? [];
      existing.push(audit);
      grouped.set(audit.role, existing);
    });
    return [...grouped.entries()];
  }, [audits]);

  const roleTitle = currentRole?.currentLinkedin ?? "Current role";
  const displayRole = currentRole?.editedValue ?? currentRole?.rewrite ?? roleTitle;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Annotated profile</p>
          <p className="mt-0.5 text-xs text-gray-500">See what to keep, improve, and rewrite in context.</p>
        </div>
        <span className="rounded-full bg-[#e8f3ff] px-2.5 py-1 text-[10px] font-bold text-[#0a66c2]">LinkedIn view</span>
      </div>

      <div className="overflow-hidden rounded-3xl border border-[#d9e2ec] bg-[#f3f6f8] shadow-sm">
        <div className="h-16 bg-gradient-to-r from-[#dbeafe] via-[#ede9fe] to-[#cffafe]" />
        <div className="relative bg-white px-4 pb-4">
          <div className="-mt-7 flex items-end justify-between">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-[#0a66c2] text-white shadow-sm">
              <UserRound className="h-6 w-6" />
            </div>
            <span className="mb-1 rounded-full border border-gray-200 bg-white px-2 py-1 text-[9px] font-bold text-gray-500">Profile preview</span>
          </div>
          <p className="mt-2 text-sm font-extrabold text-gray-900">Your LinkedIn profile</p>
          <p className="text-[11px] text-gray-500">{roleTitle}</p>
          <p className="mt-1 text-[10px] text-gray-400">Target audience: {analysis.targetAudience}</p>
        </div>

        <div className="space-y-2.5 p-2.5">
          <div className="rounded-2xl border border-gray-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-extrabold text-gray-900">Headline</p>
              <span className="rounded-full bg-violet-50 px-2 py-1 text-[9px] font-black text-violet-700">1</span>
            </div>
            <p className="text-xs leading-relaxed text-gray-700">{headline?.currentLinkedin || "No headline was captured."}</p>
            {headline && <Annotation number={1}>{headline.rationale}</Annotation>}
            {headline?.rewrite && <CopySuggestion value={headline.editedValue ?? headline.rewrite} onCopy={() => onCopy(headline.editedValue ?? headline.rewrite, "Headline copied")} />}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-extrabold text-gray-900">About</p>
              <span className="rounded-full bg-violet-50 px-2 py-1 text-[9px] font-black text-violet-700">2</span>
            </div>
            <p className="line-clamp-5 whitespace-pre-wrap text-xs leading-relaxed text-gray-700">{about?.currentLinkedin || "No About section was captured."}</p>
            {about && <Annotation number={2}>{about.rationale}</Annotation>}
            {about?.rewrite && <CopySuggestion value={about.editedValue ?? about.rewrite} onCopy={() => onCopy(about.editedValue ?? about.rewrite, "About section copied")} />}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <BriefcaseBusiness className="h-3.5 w-3.5 text-gray-500" />
                <p className="text-xs font-extrabold text-gray-900">Experience</p>
              </div>
              <span className="rounded-full bg-amber-50 px-2 py-1 text-[9px] font-black text-amber-700">3</span>
            </div>
            {currentRole && (
              <>
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Current role</p>
                <p className="mt-1 text-xs font-bold text-gray-800">{roleTitle}</p>
                <Annotation number={3} tone="amber">
                  Keep the factual role visible. The suggested wording clarifies the searchable scope without inventing a new job title.
                </Annotation>
                {displayRole !== roleTitle && (
                  <CopySuggestion value={displayRole} onCopy={() => onCopy(displayRole, "Role wording copied")} />
                )}
              </>
            )}
            {roleAudits.length > 0 ? (
              <div className="mt-3 space-y-3">
                {roleAudits.slice(0, 5).map(([role, roleBullets]) => (
                  <div key={role} className="border-t border-gray-100 pt-3">
                    <p className="text-xs font-bold text-gray-800">{role}</p>
                    <div className="mt-2 space-y-2">
                      {roleBullets.slice(0, 4).map((audit, index) => (
                        <div key={`${role}-${index}`} className="rounded-xl bg-gray-50 p-2.5">
                          <p className="text-[11px] leading-relaxed text-gray-700">{audit.bullet}</p>
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <span className={cn(
                              "rounded-full px-1.5 py-0.5 text-[9px] font-black capitalize",
                              audit.classification === "impact" ? "bg-emerald-100 text-emerald-700" : audit.classification === "mixed" ? "bg-amber-100 text-amber-700" : "bg-orange-100 text-orange-700",
                            )}>
                              {audit.classification} · {audit.impactScore}
                            </span>
                            {audit.missing.length > 0 && <span className="truncate text-[9px] text-orange-700">Missing {audit.missing.join(", ")}</span>}
                          </div>
                          {audit.suggestedRewrite && <CopySuggestion value={audit.suggestedRewrite} onCopy={() => onCopy(audit.suggestedRewrite, "Experience bullet copied")} />}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Annotation number={3} tone="amber">Experience bullets will appear here once the profile export includes role descriptions.</Annotation>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-3">
            <div className="mb-2 flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5 text-gray-500" />
              <p className="text-xs font-extrabold text-gray-900">Skills</p>
              <span className="ml-auto rounded-full bg-sky-50 px-2 py-1 text-[9px] font-black text-sky-700">4</span>
            </div>
            {skills ? (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {[...skills.keep, ...skills.review].slice(0, 16).map((skill) => (
                    <span key={skill} className={cn("rounded-lg border px-2 py-1 text-[10px] font-semibold", skills.review.includes(skill) ? "border-orange-100 bg-orange-50 text-orange-700" : "border-gray-100 bg-gray-50 text-gray-700")}>{skill}</span>
                  ))}
                </div>
                <Annotation number={4} tone="sky">{skills.summary}</Annotation>
                {skills.add.length > 0 && (
                  <div className="mt-2 flex items-start gap-2 rounded-xl border border-violet-100 bg-violet-50/60 px-2.5 py-2 text-[10px] leading-relaxed text-violet-700">
                    <Lightbulb className="mt-0.5 h-3 w-3 flex-shrink-0" />
                    <span><strong>Consider adding:</strong> {skills.add.join(" · ")}</span>
                  </div>
                )}
              </>
            ) : (
              <Annotation number={4} tone="sky">Skills recommendations will appear after the profile is scored.</Annotation>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-[10px] leading-relaxed text-gray-500">
            <Image className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
            <span><strong>Banner note:</strong> LinkedIn exports do not include the banner image. Use it to repeat the profile’s positioning in one short, readable line.</span>
            <Info className="mt-0.5 h-3 w-3 flex-shrink-0 text-gray-400" />
          </div>
        </div>
      </div>
    </section>
  );
}