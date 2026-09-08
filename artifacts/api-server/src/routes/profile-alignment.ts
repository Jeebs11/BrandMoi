import { Router, type IRouter } from "express";
import multer from "multer";
import { z } from "zod";
import { eq, desc, and } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db, preferencesTable, draftsTable, profileSnapshotsTable, profileAnalysesTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth.js";
import { aiRateLimit } from "../middleware/rate-limit.js";
import { checkAndIncrementDailyLimit } from "../lib/daily-limit.js";
import { respondAiError } from "../lib/ai-errors.js";
import { isDemoUser } from "../lib/demo-content.js";
import { getDemoProfileAlignment, getDemoProfileFacts } from "../lib/demo-content.js";
import { buildCanonicalBrandContext } from "../lib/brand-context.js";
import { extractText } from "../lib/extract-text.js";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "application/msword",
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(pdf|docx|txt|doc)$/i)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type. Please upload a PDF, Word document, or text file."));
    }
  },
});

function parseJson(text: string): unknown {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const objectStart = cleaned.indexOf("{");
    const arrayStart = cleaned.indexOf("[");
    const startCandidates = [objectStart, arrayStart].filter((index) => index >= 0);
    if (startCandidates.length === 0) throw new Error("No JSON object or array found in AI response");

    const start = Math.min(...startCandidates);
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < cleaned.length; i += 1) {
      const char = cleaned[i];
      if (inString) {
        if (escaped) { escaped = false; }
        else if (char === "\\") { escaped = true; }
        else if (char === "\"") { inString = false; }
        continue;
      }
      if (char === "\"") { inString = true; }
      else if (char === "{" || char === "[") { depth += 1; }
      else if (char === "}" || char === "]") {
        depth -= 1;
        if (depth === 0) return JSON.parse(cleaned.slice(start, i + 1));
      }
    }
    throw new Error("Incomplete JSON in AI response");
  }
}

// ---------------------------------------------------------------------------
// Types (hand-declared, not generated — this route follows the same
// hand-rolled-zod pattern as agent.ts/user.ts/smart-import.ts rather than
// going through lib/api-spec/openapi.yaml).
// ---------------------------------------------------------------------------

export type ProfileFacts = {
  // Structurally null for a CV — a CV has no "headline"/"About" concept.
  headline: string | null;
  about: string | null;
  currentTitle: string | null;
  currentEmployer: string | null;
  currentRoleDates: string | null;
  achievements: string[];
  skills: string[];
};

type ApplicableSource = "cv" | "brandmoi" | "linkedin";

type ComparisonStatus =
  | "all_agree"
  | "cv_brandmoi_agree_linkedin_differs"
  | "cv_linkedin_agree_brandmoi_stale"
  | "brandmoi_linkedin_agree_cv_differs"
  | "all_differ"
  | "only_one_source"
  | "insufficient_data";

type SourceValue = { value: string | string[]; source: ApplicableSource } | null;

export type ComparisonRow = {
  rowKey: "role_title" | "territories" | "audience" | "recent_content_themes";
  label: string;
  applicableSources: ApplicableSource[];
  cv: SourceValue;
  brandmoi: SourceValue;
  linkedin: SourceValue;
  status: ComparisonStatus;
  statusDetail: string;
};

export type ProofPointComparisonRow = {
  rowKey: "proof_points";
  label: string;
  applicableSources: ApplicableSource[];
  points: Array<{ point: string; presentInCv: boolean; reflectedInLinkedin: boolean }>;
  status: ComparisonStatus;
  statusDetail: string;
};

export type ComparisonTable = {
  generatedAt: string;
  rows: Array<ComparisonRow | ProofPointComparisonRow>;
};

export type TargetAudience = "Recruiters" | "Hiring managers" | "Clients" | "Peers" | "Investors" | "General";
const TARGET_AUDIENCES: TargetAudience[] = ["Recruiters", "Hiring managers", "Clients", "Peers", "Investors", "General"];

export type FieldRewrite = {
  id: string;
  field: "headline" | "about" | "current_role";
  currentBrandmoi: string | null;
  currentLinkedin: string | null;
  rewrite: string;
  rationale: string;
  status: "pending" | "accepted" | "edited" | "rejected";
  editedValue?: string;
};

export type PairedFactSuggestion = {
  id: string;
  rowKey: ComparisonRow["rowKey"];
  claim: string;
  updateBrandmoi: {
    targetField: "brandRole" | "aboutMe" | "contentPillars" | "proofPoints";
    suggestedValue: string | string[];
    status: "pending" | "accepted" | "edited" | "rejected";
    editedValue?: string | string[];
  };
  updateLinkedin: {
    suggestedValue: string;
    status: "pending" | "accepted" | "edited" | "rejected";
    editedValue?: string;
  };
};

export type StoredRecommendations = {
  narrativeSummary: string;
  fieldRewrites: FieldRewrite[];
  pairedFactSuggestions: PairedFactSuggestion[];
};

// ---------------------------------------------------------------------------
// Upload + normalize (one small AI call each, mirrors smart-import.ts)
// ---------------------------------------------------------------------------

async function normalizeProfileFacts(rawText: string, sourceType: "cv" | "linkedin"): Promise<ProfileFacts> {
  const truncated = rawText.slice(0, 15000);

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1200,
    system: `You extract structured professional facts from a ${sourceType === "cv" ? "CV/resume" : "LinkedIn profile export"}. Return valid JSON only — no markdown, no commentary. Never invent a fact that isn't in the document — use null or an empty array when something isn't present.`,
    messages: [
      {
        role: "user",
        content: `Read this document and extract these facts exactly as stated — never infer or invent a number, employer, or date that isn't written down.

Document:
${truncated}

Return this exact JSON:
{
  "headline": ${sourceType === "linkedin" ? '"the LinkedIn headline line, verbatim, or null if not present"' : "null"},
  "about": ${sourceType === "linkedin" ? '"the About/Summary section text, verbatim, or null if not present"' : "null"},
  "currentTitle": "their current/most recent job title, verbatim, or null",
  "currentEmployer": "their current/most recent employer name, verbatim, or null",
  "currentRoleDates": "the date range for that role as written (e.g. '2022 - Present'), or null",
  "achievements": ["quantified achievement 1 (must contain a real number, name, or scale from the document)", "..."],
  "skills": ["skill 1", "skill 2", "..."]
}

Rules:
- ${sourceType === "cv" ? "This is a CV — headline and about MUST be null, a CV does not have those sections." : "Extract headline/about only if this document actually has those LinkedIn sections."}
- achievements: up to 8, each one sentence, max 140 characters, must contain a real number/name/scale taken from the document. Never invent one.
- skills: up to 12, short phrases as written in the document.`,
      },
    ],
  });

  const block = message.content[0];
  if (block.type !== "text") throw new Error("Unexpected AI response");
  const parsed = parseJson(block.text) as Record<string, unknown>;

  const asStringArray = (v: unknown, cap: number): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, cap) : [];

  return {
    headline: typeof parsed.headline === "string" && parsed.headline.trim() ? parsed.headline.trim() : null,
    about: typeof parsed.about === "string" && parsed.about.trim() ? parsed.about.trim() : null,
    currentTitle: typeof parsed.currentTitle === "string" && parsed.currentTitle.trim() ? parsed.currentTitle.trim() : null,
    currentEmployer: typeof parsed.currentEmployer === "string" && parsed.currentEmployer.trim() ? parsed.currentEmployer.trim() : null,
    currentRoleDates: typeof parsed.currentRoleDates === "string" && parsed.currentRoleDates.trim() ? parsed.currentRoleDates.trim() : null,
    achievements: asStringArray(parsed.achievements, 8),
    skills: asStringArray(parsed.skills, 12),
  };
}

async function upsertSnapshot(userId: number, field: "cvFacts" | "linkedinFacts", facts: ProfileFacts): Promise<void> {
  const [existing] = await db.select().from(profileSnapshotsTable).where(eq(profileSnapshotsTable.userId, userId)).limit(1);
  if (existing) {
    await db.update(profileSnapshotsTable).set({ [field]: facts, capturedAt: new Date() }).where(eq(profileSnapshotsTable.userId, userId));
  } else {
    await db.insert(profileSnapshotsTable).values({ userId, [field]: facts });
  }
}

router.post("/profile-alignment/cv", requireAuth, aiRateLimit, upload.single("document"), async (req, res): Promise<void> => {
  if (isDemoUser(req.user!.email)) {
    const facts = getDemoProfileFacts("cv");
    res.json(facts);
    return;
  }
  if (!req.file) { res.status(400).json({ error: "No file uploaded." }); return; }

  let rawText: string;
  try {
    rawText = await extractText(req.file.buffer, req.file.mimetype, req.file.originalname);
  } catch (err) {
    console.error("[profile-alignment] extractText (cv) failed:", err);
    res.status(422).json({ error: "Could not read this file. Try a PDF or plain text document." });
    return;
  }
  if (rawText.trim().length < 100) { res.status(422).json({ error: "The document appears to be empty or unreadable." }); return; }

  try {
    const facts = await normalizeProfileFacts(rawText, "cv");
    await upsertSnapshot(req.user!.userId, "cvFacts", facts);
    res.json(facts);
  } catch (err) {
    respondAiError(res, err, "Failed to read your CV.");
  }
});

const LinkedinPasteBody = z.object({ pastedText: z.string().min(100).max(20000).optional() });

router.post("/profile-alignment/linkedin", requireAuth, aiRateLimit, upload.single("document"), async (req, res): Promise<void> => {
  if (isDemoUser(req.user!.email)) {
    const facts = getDemoProfileFacts("linkedin");
    res.json(facts);
    return;
  }

  let rawText: string;
  if (req.file) {
    try {
      rawText = await extractText(req.file.buffer, req.file.mimetype, req.file.originalname);
    } catch (err) {
      console.error("[profile-alignment] extractText (linkedin) failed:", err);
      res.status(422).json({ error: "Could not read this file. Try pasting your profile text instead." });
      return;
    }
  } else {
    const parsed = LinkedinPasteBody.safeParse(req.body);
    if (!parsed.success || !parsed.data.pastedText) {
      res.status(400).json({ error: "Upload a LinkedIn PDF export or paste your profile text (at least 100 characters)." });
      return;
    }
    rawText = parsed.data.pastedText;
  }
  if (rawText.trim().length < 100) { res.status(422).json({ error: "That doesn't look like enough profile text to read." }); return; }

  try {
    const facts = await normalizeProfileFacts(rawText, "linkedin");
    await upsertSnapshot(req.user!.userId, "linkedinFacts", facts);
    res.json(facts);
  } catch (err) {
    respondAiError(res, err, "Failed to read your LinkedIn profile.");
  }
});

// ---------------------------------------------------------------------------
// Deterministic comparison table — zero AI cost
// ---------------------------------------------------------------------------

function normalizeForCompare(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

function textsRoughlyMatch(a: string, b: string): boolean {
  const na = normalizeForCompare(a);
  const nb = normalizeForCompare(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  return na.includes(nb) || nb.includes(na);
}

function computeStatus(cvVal: string | null, brandmoiVal: string | null, linkedinVal: string | null, applicable: ApplicableSource[]): { status: ComparisonStatus; detail: string } {
  const present = applicable.filter((s) => (s === "cv" ? cvVal : s === "brandmoi" ? brandmoiVal : linkedinVal));
  if (present.length < 2) return { status: "insufficient_data", detail: "Not enough sources to compare yet." };
  if (present.length === 1) return { status: "only_one_source", detail: "Only one source has this information." };

  const hasCv = applicable.includes("cv") && !!cvVal;
  const hasLinkedin = applicable.includes("linkedin") && !!linkedinVal;
  const hasBrandmoi = applicable.includes("brandmoi") && !!brandmoiVal;

  const cvBrandmoiAgree = hasCv && hasBrandmoi && textsRoughlyMatch(cvVal!, brandmoiVal!);
  const cvLinkedinAgree = hasCv && hasLinkedin && textsRoughlyMatch(cvVal!, linkedinVal!);
  const brandmoiLinkedinAgree = hasBrandmoi && hasLinkedin && textsRoughlyMatch(brandmoiVal!, linkedinVal!);

  if (!hasCv) {
    // Only brandmoi vs linkedin applicable (e.g. audience, recent themes rows)
    if (brandmoiLinkedinAgree) return { status: "all_agree", detail: "BrandMoi and LinkedIn agree." };
    return { status: "cv_brandmoi_agree_linkedin_differs", detail: "Your BrandMoi positioning and your LinkedIn profile say different things here." };
  }

  if (cvBrandmoiAgree && cvLinkedinAgree) return { status: "all_agree", detail: "CV, BrandMoi, and LinkedIn all agree." };
  if (cvBrandmoiAgree && !cvLinkedinAgree) return { status: "cv_brandmoi_agree_linkedin_differs", detail: "Your CV and BrandMoi agree — your LinkedIn profile still says something different." };
  if (cvLinkedinAgree && !cvBrandmoiAgree) return { status: "cv_linkedin_agree_brandmoi_stale", detail: "Your CV and LinkedIn agree — your BrandMoi positioning may be stale here." };
  if (brandmoiLinkedinAgree && !cvBrandmoiAgree) return { status: "brandmoi_linkedin_agree_cv_differs", detail: "BrandMoi and LinkedIn agree, but your CV says something different." };
  return { status: "all_differ", detail: "All three sources say something different here — this needs your call." };
}

async function computeComparisonTable(userId: number): Promise<ComparisonTable> {
  const [prefs] = await db.select().from(preferencesTable).where(eq(preferencesTable.userId, userId)).limit(1);
  const [snapshot] = await db.select().from(profileSnapshotsTable).where(eq(profileSnapshotsTable.userId, userId)).limit(1);
  const cvFacts = (snapshot?.cvFacts ?? null) as ProfileFacts | null;
  const linkedinFacts = (snapshot?.linkedinFacts ?? null) as ProfileFacts | null;

  const recentDrafts = await db
    .select({ structuredBreakdown: draftsTable.structuredBreakdown })
    .from(draftsTable)
    .where(and(eq(draftsTable.userId, userId), eq(draftsTable.status, "published")))
    .orderBy(desc(draftsTable.createdAt))
    .limit(10);
  const recentTopics = recentDrafts
    .map((d) => (d.structuredBreakdown as { topic?: string } | null)?.topic)
    .filter((t): t is string => typeof t === "string" && t.trim().length > 0);

  const rows: Array<ComparisonRow | ProofPointComparisonRow> = [];

  // Role / title
  {
    const cvVal = cvFacts?.currentTitle ?? null;
    const brandmoiVal = prefs?.brandRole?.trim() || null;
    const linkedinVal = linkedinFacts?.currentTitle ?? linkedinFacts?.headline ?? null;
    const applicable: ApplicableSource[] = ["cv", "brandmoi", "linkedin"];
    const { status, detail } = computeStatus(cvVal, brandmoiVal, linkedinVal, applicable);
    rows.push({
      rowKey: "role_title", label: "Role / Title", applicableSources: applicable,
      cv: cvVal ? { value: cvVal, source: "cv" } : null,
      brandmoi: brandmoiVal ? { value: brandmoiVal, source: "brandmoi" } : null,
      linkedin: linkedinVal ? { value: linkedinVal, source: "linkedin" } : null,
      status, statusDetail: detail,
    });
  }

  // Territories (contentPillars) — CV rarely states these explicitly as a
  // list, so we treat "applicable" as brandmoi + linkedin (skills) only.
  {
    const pillars = Array.isArray(prefs?.contentPillars) ? (prefs!.contentPillars as string[]) : [];
    const brandmoiVal = pillars.length > 0 ? pillars.join(", ") : null;
    const linkedinSkills = linkedinFacts?.skills ?? [];
    const linkedinVal = linkedinSkills.length > 0 ? linkedinSkills.join(", ") : null;
    const applicable: ApplicableSource[] = ["brandmoi", "linkedin"];
    const { status, detail } = computeStatus(null, brandmoiVal, linkedinVal, applicable);
    rows.push({
      rowKey: "territories", label: "Territories", applicableSources: applicable,
      cv: null,
      brandmoi: brandmoiVal ? { value: pillars, source: "brandmoi" } : null,
      linkedin: linkedinVal ? { value: linkedinSkills, source: "linkedin" } : null,
      status, statusDetail: detail,
    });
  }

  // Audience — CV has no opinion
  {
    const brandmoiVal = prefs?.brandAudience?.trim() || null;
    const linkedinVal = linkedinFacts?.about ?? null;
    const applicable: ApplicableSource[] = ["brandmoi", "linkedin"];
    const { status, detail } = computeStatus(null, brandmoiVal, linkedinVal, applicable);
    rows.push({
      rowKey: "audience", label: "Audience", applicableSources: applicable,
      cv: null,
      brandmoi: brandmoiVal ? { value: brandmoiVal, source: "brandmoi" } : null,
      linkedin: linkedinVal ? { value: linkedinVal, source: "linkedin" } : null,
      status, statusDetail: detail,
    });
  }

  // Recent content themes — CV has no opinion
  {
    const brandmoiVal = recentTopics.length > 0 ? recentTopics.slice(0, 5).join(", ") : null;
    const linkedinVal = linkedinFacts?.about ?? null;
    const applicable: ApplicableSource[] = ["brandmoi", "linkedin"];
    const { status, detail } = computeStatus(null, brandmoiVal, linkedinVal, applicable);
    rows.push({
      rowKey: "recent_content_themes", label: "Recent Content Themes", applicableSources: applicable,
      cv: null,
      brandmoi: brandmoiVal ? { value: recentTopics.slice(0, 5), source: "brandmoi" } : null,
      linkedin: linkedinVal ? { value: linkedinVal, source: "linkedin" } : null,
      status, statusDetail: detail,
    });
  }

  // Proof points — approximate keyword/number overlap, not exact match.
  {
    const proofPoints = Array.isArray(prefs?.proofPoints) ? (prefs!.proofPoints as string[]) : [];
    const cvText = normalizeForCompare([cvFacts?.currentTitle, cvFacts?.currentEmployer, ...(cvFacts?.achievements ?? [])].filter(Boolean).join(" "));
    const linkedinText = normalizeForCompare([linkedinFacts?.headline, linkedinFacts?.about, linkedinFacts?.currentTitle, ...(linkedinFacts?.achievements ?? [])].filter(Boolean).join(" "));
    const extractTokens = (point: string): string[] => {
      const numbers = point.match(/\d+[%kKmM]?/g) ?? [];
      const properNouns = point.match(/\b[A-Z][a-zA-Z]{2,}\b/g) ?? [];
      return [...numbers, ...properNouns].map((t) => t.toLowerCase());
    };
    const points = proofPoints.slice(0, 8).map((point) => {
      const tokens = extractTokens(point);
      const presentInCv = tokens.length > 0 && tokens.some((t) => cvText.includes(t.toLowerCase()));
      const reflectedInLinkedin = tokens.length > 0 && tokens.some((t) => linkedinText.includes(t.toLowerCase()));
      return { point, presentInCv, reflectedInLinkedin };
    });
    const anyMissingFromLinkedin = points.some((p) => p.presentInCv && !p.reflectedInLinkedin);
    rows.push({
      rowKey: "proof_points", label: "Proof Points (approximate match)",
      applicableSources: ["cv", "brandmoi", "linkedin"],
      points,
      status: points.length === 0 ? "insufficient_data" : anyMissingFromLinkedin ? "cv_brandmoi_agree_linkedin_differs" : "all_agree",
      statusDetail: points.length === 0
        ? "No proof points on file yet."
        : anyMissingFromLinkedin
          ? "Some of your proof points aren't showing up on your LinkedIn profile yet."
          : "Your proof points appear to be reflected on LinkedIn.",
    });
  }

  return { generatedAt: new Date().toISOString(), rows };
}

router.get("/profile-alignment/comparison", requireAuth, async (req, res): Promise<void> => {
  if (isDemoUser(req.user!.email)) {
    res.json(getDemoProfileAlignment().comparisonTable);
    return;
  }
  const [snapshot] = await db.select().from(profileSnapshotsTable).where(eq(profileSnapshotsTable.userId, req.user!.userId)).limit(1);
  if (!snapshot?.cvFacts || !snapshot?.linkedinFacts) {
    res.status(400).json({ error: "Upload both your CV and LinkedIn profile before running a comparison." });
    return;
  }
  const table = await computeComparisonTable(req.user!.userId);
  res.json(table);
});

// ---------------------------------------------------------------------------
// The single AI analysis call
// ---------------------------------------------------------------------------

const AnalyzeBody = z.object({ targetAudience: z.enum(TARGET_AUDIENCES as [TargetAudience, ...TargetAudience[]]) });

router.post("/profile-alignment/analyze", requireAuth, aiRateLimit, async (req, res): Promise<void> => {
  if (isDemoUser(req.user!.email)) {
    res.json(getDemoProfileAlignment());
    return;
  }

  const parsed = AnalyzeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Choose a target audience first." }); return; }
  const { targetAudience } = parsed.data;
  const userId = req.user!.userId;

  const [snapshot] = await db.select().from(profileSnapshotsTable).where(eq(profileSnapshotsTable.userId, userId)).limit(1);
  if (!snapshot?.cvFacts || !snapshot?.linkedinFacts) {
    res.status(400).json({ error: "Upload both your CV and LinkedIn profile before running an analysis." });
    return;
  }

  const brandContext = await buildCanonicalBrandContext(userId);
  if (brandContext.confidence === "starting") {
    res.status(400).json({
      error: "There isn't enough BrandMoi positioning on file yet to run a meaningful analysis — finish Professional Positioning or Smart Import first, then come back.",
    });
    return;
  }

  const limit = await checkAndIncrementDailyLimit(userId, "profile-alignment", 3);
  if (!limit.allowed) {
    res.status(429).json({ error: "You've used today's profile alignment runs (3/day) — try again tomorrow." });
    return;
  }

  try {
    const comparisonTable = await computeComparisonTable(userId);
    const [prefs] = await db.select().from(preferencesTable).where(eq(preferencesTable.userId, userId)).limit(1);
    const cvFacts = snapshot.cvFacts as ProfileFacts;
    const linkedinFacts = snapshot.linkedinFacts as ProfileFacts;

    const disagreements = comparisonTable.rows.filter(
      (r): r is ComparisonRow => "status" in r && r.rowKey !== "proof_points" && r.status !== "all_agree" && r.status !== "insufficient_data",
    );

    const userMessage = `BrandMoi context:\n${brandContext.context}\n\nCurrent BrandMoi fields: brandRole="${prefs?.brandRole ?? ""}", aboutMe="${prefs?.aboutMe ?? ""}"\n\nCV facts: ${JSON.stringify(cvFacts)}\n\nLinkedIn facts: ${JSON.stringify(linkedinFacts)}\n\nDeterministic comparison findings (already computed, do not recompute — use these as ground truth for what disagrees):\n${JSON.stringify(disagreements.map((r) => ({ rowKey: r.rowKey, status: r.status, detail: r.statusDetail })))}\n\nTarget audience for the rewrite tone: ${targetAudience}`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: `You are a LinkedIn profile alignment assistant. You NEVER invent facts — every claim you write must come from the CV facts, LinkedIn facts, or BrandMoi context provided. If something is uncertain, say so instead of guessing.

Ground rule: the CV is the source of truth for anything it actually states (title, employer, dates, achievements). BrandMoi's own stored positioning (audience, belief, tone) is authoritative for anything the CV has no opinion on — a CV cannot be "wrong" about something it never addresses.

Return JSON only (no markdown):
{
  "narrativeSummary": "2-4 plain-language sentences: what the profile currently communicates, what gap matters most, max 80 words",
  "fieldRewrites": [
    {"field": "headline", "rewrite": "one rewritten LinkedIn headline, tone-matched to ${targetAudience}, max 220 characters", "rationale": "1-2 sentences grounded in the comparison findings, max 40 words"},
    {"field": "about", "rewrite": "one rewritten About section, tone-matched to ${targetAudience}, 3-6 short paragraphs", "rationale": "1-2 sentences, max 40 words"},
    {"field": "current_role", "rewrite": "one rewritten current-role positioning line — this updates BrandMoi's 'brandRole' positioning sentence, NOT a literal 'Title at Company' line, max 200 characters", "rationale": "1-2 sentences, max 40 words"}
  ],
  "pairedFactSuggestions": [
    {"rowKey": "role_title", "claim": "the CV's stated fact, near-verbatim", "brandmoiSuggestion": "what BrandMoi's relevant field should say instead, grounded in the CV", "linkedinSuggestion": "what LinkedIn's wording should say instead, grounded in the CV"}
  ]
}

Rules:
- fieldRewrites must contain exactly 3 entries, one per field, in this order: headline, about, current_role.
- pairedFactSuggestions: only include a row here if the deterministic findings show CV disagreeing with BrandMoi and/or LinkedIn on a factual matter (role_title, territories). Do not include audience or recent_content_themes here — CV has no opinion on those. Omit entirely if there's nothing to reconcile.
- Never invent an employer, date, metric, or achievement not present in the CV or LinkedIn facts provided.`,
      messages: [{ role: "user", content: userMessage }],
    });

    const block = message.content[0];
    if (block.type !== "text") { res.status(500).json({ error: "Unexpected AI response." }); return; }
    const raw = parseJson(block.text) as {
      narrativeSummary?: unknown;
      fieldRewrites?: unknown;
      pairedFactSuggestions?: unknown;
    };

    const FIELD_ORDER: FieldRewrite["field"][] = ["headline", "about", "current_role"];
    const rawRewrites = Array.isArray(raw.fieldRewrites) ? (raw.fieldRewrites as Array<Record<string, unknown>>) : [];
    const fieldRewrites: FieldRewrite[] = FIELD_ORDER.map((field) => {
      const match = rawRewrites.find((r) => r.field === field);
      return {
        id: `field:${field}`,
        field,
        currentBrandmoi: field === "about" ? (prefs?.aboutMe ?? null) : (prefs?.brandRole ?? null),
        currentLinkedin: field === "headline" ? linkedinFacts.headline : field === "about" ? linkedinFacts.about : linkedinFacts.currentTitle,
        rewrite: typeof match?.rewrite === "string" ? match.rewrite.slice(0, 3000) : "",
        rationale: typeof match?.rationale === "string" ? match.rationale.slice(0, 400) : "",
        status: "pending" as const,
      };
    }).filter((r) => r.rewrite.length > 0);

    const rawPaired = Array.isArray(raw.pairedFactSuggestions) ? (raw.pairedFactSuggestions as Array<Record<string, unknown>>) : [];
    const pairedFactSuggestions: PairedFactSuggestion[] = rawPaired
      .filter((p) => typeof p.rowKey === "string" && (p.rowKey === "role_title" || p.rowKey === "territories") && typeof p.claim === "string")
      .slice(0, 5)
      .map((p, i) => ({
        id: `fact:${i}`,
        rowKey: p.rowKey as ComparisonRow["rowKey"],
        claim: String(p.claim).slice(0, 300),
        updateBrandmoi: {
          targetField: (p.rowKey === "territories" ? "contentPillars" : "brandRole") as "brandRole" | "contentPillars",
          suggestedValue: typeof p.brandmoiSuggestion === "string" ? p.brandmoiSuggestion.slice(0, 300) : "",
          status: "pending" as const,
        },
        updateLinkedin: {
          suggestedValue: typeof p.linkedinSuggestion === "string" ? p.linkedinSuggestion.slice(0, 300) : "",
          status: "pending" as const,
        },
      }))
      .filter((p) => p.updateBrandmoi.suggestedValue && p.updateLinkedin.suggestedValue);

    const recommendations: StoredRecommendations = {
      narrativeSummary: typeof raw.narrativeSummary === "string" ? raw.narrativeSummary.slice(0, 600) : "",
      fieldRewrites,
      pairedFactSuggestions,
    };

    const [analysis] = await db
      .insert(profileAnalysesTable)
      .values({
        userId,
        snapshotId: snapshot.id,
        comparisonTable,
        recommendations,
        targetAudience,
      })
      .returning();

    res.json({ id: analysis.id, targetAudience, comparisonTable, ...recommendations, createdAt: analysis.createdAt });
  } catch (err) {
    console.error("[profile-alignment-analyze]", err);
    respondAiError(res, err, "Failed to run profile alignment analysis.");
  }
});

// ---------------------------------------------------------------------------
// Accept / edit / reject persistence
// ---------------------------------------------------------------------------

const RecommendationActionBody = z.object({
  status: z.enum(["accepted", "edited", "rejected", "pending"]),
  target: z.enum(["field", "brandmoi", "linkedin"]).optional(),
  editedValue: z.union([z.string(), z.array(z.string())]).optional(),
});

router.patch("/profile-alignment/analyses/:id/recommendations/:recId", requireAuth, async (req, res): Promise<void> => {
  const analysisId = Number(req.params.id);
  const recId = String(req.params.recId);
  const parsed = RecommendationActionBody.safeParse(req.body);
  if (!Number.isFinite(analysisId) || !parsed.success) { res.status(400).json({ error: "Invalid request." }); return; }

  const [analysis] = await db
    .select()
    .from(profileAnalysesTable)
    .where(and(eq(profileAnalysesTable.id, analysisId), eq(profileAnalysesTable.userId, req.user!.userId)))
    .limit(1);
  if (!analysis) { res.status(404).json({ error: "Analysis not found." }); return; }

  const recs = analysis.recommendations as StoredRecommendations;
  const { status, target, editedValue } = parsed.data;

  if (recId.startsWith("field:")) {
    const idx = recs.fieldRewrites.findIndex((r) => r.id === recId);
    if (idx === -1) { res.status(404).json({ error: "Recommendation not found." }); return; }
    recs.fieldRewrites[idx].status = status;
    if (status === "edited" && typeof editedValue === "string") recs.fieldRewrites[idx].editedValue = editedValue;
  } else if (recId.startsWith("fact:")) {
    const idx = recs.pairedFactSuggestions.findIndex((r) => r.id === recId);
    if (idx === -1) { res.status(404).json({ error: "Recommendation not found." }); return; }
    const suggestion = recs.pairedFactSuggestions[idx];
    const half = target === "linkedin" ? suggestion.updateLinkedin : suggestion.updateBrandmoi;
    half.status = status;
    if (status === "edited" && editedValue !== undefined) {
      (half as { editedValue?: string | string[] }).editedValue = editedValue;
    }
  } else {
    res.status(404).json({ error: "Recommendation not found." });
    return;
  }

  await db.update(profileAnalysesTable).set({ recommendations: recs }).where(eq(profileAnalysesTable.id, analysisId));
  res.json({ ok: true });
});

export default router;
