import { Router, type IRouter } from "express";
import { z } from "zod";
import multer from "multer";
import { eq, and, desc, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import { draftsTable, performanceSignalsTable, preferencesTable } from "@workspace/db";
import { parseLinkedinAnalytics } from "../lib/linkedin-analytics-parser.js";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import {
  CreateDraftBody,
  UpdateDraftBody,
  UpdateDraftParams,
  GetDraftParams,
  GetDraftResponse,
  UpdateDraftResponse,
  DeleteDraftParams,
  ListDraftsResponse,
  GetAnalyticsOverviewResponse,
  CheckDraftAuthenticityBody,
  CheckDraftAuthenticityResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middleware/auth.js";
import { isDemoUser } from "../lib/demo-content.js";
import { upsertDailyActivity } from "../lib/momentum.js";
import { computeEditPercent, computeWordChangeSummary, runAuthenticityCheck } from "../lib/authenticity-check.js";

const router: IRouter = Router();

const LEGACY_STYLE_REMAP: Record<string, string> = {
  sketch: "new-yorker",
  blueprint: "new-yorker",
  vintage: "new-yorker",
};

function deriveAudience(objective: unknown): string | undefined {
  if (typeof objective !== "string") return undefined;
  const o = objective.toLowerCase();
  if (o.includes("client")) return "Clients";
  // Per spec: "Hiring" (the user is recruiting) → My audience (their followers).
  // Only "Job"/"recruit" map to Recruiters & Headhunters.
  if (o === "hiring") return "My audience";
  if (o.includes("job") || o.includes("recruit")) return "Recruiters & Headhunters";
  if (o.includes("invest")) return "Investors";
  if (o.includes("authority") || o.includes("expert") || o.includes("peer")) return "Peers";
  return "My audience";
}

function deriveFeeling(tone: unknown, storyMode: unknown): string | undefined {
  if (storyMode === true) return "Story";
  if (typeof tone !== "string") return undefined;
  const t = tone.toLowerCase();
  if (t.includes("playful") || t.includes("witty")) return "Witty";
  if (t.includes("vulnerab")) return "Vulnerable";
  if (t.includes("contrarian")) return "Contrarian";
  if (t.includes("story")) return "Story";
  return "Direct";
}

function normalizeDraft<T extends { structuredBreakdown: unknown; objective?: unknown; tone?: unknown; visualStyle?: unknown }>(draft: T): T {
  // Always ensure structuredBreakdown is a plain object so audience/feeling
  // derivation runs even for legacy drafts with a null breakdown.
  if (!draft.structuredBreakdown || typeof draft.structuredBreakdown !== "object" || Array.isArray(draft.structuredBreakdown)) {
    (draft as { structuredBreakdown: unknown }).structuredBreakdown = {};
  }
  const sb = draft.structuredBreakdown as Record<string, unknown>;

  if (Array.isArray(sb.hooks)) {
    sb.hooks = sb.hooks.map((h: unknown) =>
      typeof h === "string" ? { text: h } : h
    );
  }
  if (Array.isArray(sb.narrativeFlow)) {
    sb.narrativeFlow = sb.narrativeFlow.map((n: unknown) =>
      typeof n === "string" ? n : String(n)
    );
  }

  // Derive audience/feeling from top-level draft.objective/tone (legacy fields)
  // when the new structuredBreakdown.audience/feeling fields are missing.
  if (typeof sb.audience !== "string" || !sb.audience) {
    const derived = deriveAudience(draft.objective);
    if (derived) sb.audience = derived;
  }
  if (typeof sb.feeling !== "string" || !sb.feeling) {
    const derived = deriveFeeling(draft.tone, sb.storyMode);
    if (derived) sb.feeling = derived;
  }

  if (typeof draft.visualStyle === "string" && LEGACY_STYLE_REMAP[draft.visualStyle]) {
    (draft as { visualStyle?: string }).visualStyle = LEGACY_STYLE_REMAP[draft.visualStyle];
  }

  // JSONB stores the cached Brand Review timestamp as an ISO string, while
  // the server-side response schema uses a Date for date-time fields.
  const brandReview = (draft as { brandReview?: unknown }).brandReview;
  if (brandReview && typeof brandReview === "object" && !Array.isArray(brandReview)) {
    const cachedAt = (brandReview as { cachedAt?: unknown }).cachedAt;
    if (typeof cachedAt === "string") {
      (brandReview as { cachedAt: Date }).cachedAt = new Date(cachedAt);
    }

    const reviewedPost = (brandReview as { reviewedPost?: unknown }).reviewedPost;
    const originalPost = (draft as { aiOriginalPost?: unknown }).aiOriginalPost;
    const existingCheck = (brandReview as { authenticityCheck?: unknown }).authenticityCheck;
    if (typeof reviewedPost === "string" && typeof originalPost === "string") {
      const wordChangeSummary = computeWordChangeSummary(originalPost, reviewedPost);
      if (wordChangeSummary) {
        const check = existingCheck && typeof existingCheck === "object" && !Array.isArray(existingCheck)
          ? existingCheck as { editPct?: number | null; flags?: string[]; severity?: "low" | "medium" | "high"; wordChangeSummary?: unknown }
          : null;
        (brandReview as {
          authenticityCheck: {
            editPct: number | null;
            flags: string[];
            severity: "low" | "medium" | "high";
            wordChangeSummary: typeof wordChangeSummary;
          };
        }).authenticityCheck = {
          editPct: check?.editPct ?? computeEditPercent(originalPost, reviewedPost),
          flags: check?.flags ?? [],
          severity: check?.severity ?? "low",
          wordChangeSummary,
        };
      }
    }
  }
  return draft;
}

router.get("/drafts", requireAuth, async (req, res): Promise<void> => {
  const drafts = await db
    .select()
    .from(draftsTable)
    .where(eq(draftsTable.userId, req.user!.userId))
    .orderBy(desc(draftsTable.createdAt));

  const normalized = drafts.map(normalizeDraft);
  const parsed: unknown[] = [];
  for (const draft of normalized) {
    const result = ListDraftsResponse.element.safeParse(draft);
    if (result.success) {
      parsed.push(result.data);
    } else {
      console.warn(`Skipping malformed draft id=${draft.id}:`, result.error.issues.map(i => i.message).join(", "));
    }
  }
  res.json(parsed);
});

router.post("/drafts", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateDraftBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // A brand-new draft can be created directly with status "published" (e.g.
  // first-ever "Ship it" with no prior Save) — the authenticity check needs
  // to run here too, not just on PATCH, or that path never gets checked.
  const isPublishingOnCreate = parsed.data.status === "published";

  // Demo accounts get a success-shaped ephemeral draft so the generate→save
  // flow works, without writing to (and polluting) the shared demo data.
  if (isDemoUser(req.user!.email)) {
    const now = new Date();
    const synthetic = {
      id: 1_000_000_000 + Math.floor(Math.random() * 1_000_000),
      userId: req.user!.userId,
      rawInput: parsed.data.rawInput,
      objective: parsed.data.objective,
      persona: parsed.data.persona,
      tone: parsed.data.tone,
      structuredBreakdown: parsed.data.structuredBreakdown as object,
      selectedHook: parsed.data.selectedHook ?? null,
      postOutput: parsed.data.postOutput ?? null,
      aiOriginalPost: parsed.data.aiOriginalPost ?? null,
      authenticityFeedback: parsed.data.authenticityFeedback ?? null,
      shortPost: parsed.data.shortPost ?? null,
      carouselOutput: parsed.data.carouselOutput ?? null,
      visualOutput: parsed.data.visualOutput ?? null,
      status: parsed.data.status ?? "draft",
      contentSource: parsed.data.contentSource ?? null,
      visualType: parsed.data.visualType ?? null,
      externalId: null,
      postType: null,
      diagnosis: null,
      mediaFormat: null,
      linkedinUrl: null,
      isVoiceSample: false,
      topicId: parsed.data.topicId ?? null,
      seriesId: parsed.data.seriesId ?? null,
      seriesPart: parsed.data.seriesPart ?? null,
      createdAt: now,
      updatedAt: now,
    };
    const authenticityCheck = isPublishingOnCreate ? runAuthenticityCheck(synthetic.aiOriginalPost, synthetic.postOutput ?? "") : undefined;
    res.status(201).json(GetDraftResponse.parse({ ...normalizeDraft(synthetic), authenticityCheck }));
    return;
  }

  const [draft] = await db
    .insert(draftsTable)
    .values({
      userId: req.user!.userId,
      rawInput: parsed.data.rawInput,
      objective: parsed.data.objective,
      persona: parsed.data.persona,
      tone: parsed.data.tone,
      structuredBreakdown: parsed.data.structuredBreakdown as object,
      selectedHook: parsed.data.selectedHook ?? null,
      postOutput: parsed.data.postOutput ?? null,
      aiOriginalPost: parsed.data.aiOriginalPost ?? null,
      authenticityFeedback: parsed.data.authenticityFeedback ?? null,
      shortPost: parsed.data.shortPost ?? null,
      carouselOutput: parsed.data.carouselOutput ?? null,
      visualOutput: parsed.data.visualOutput ?? null,
      status: parsed.data.status ?? "draft",
      contentSource: parsed.data.contentSource ?? null,
      visualType: parsed.data.visualType ?? null,
      topicId: parsed.data.topicId ?? null,
      seriesId: parsed.data.seriesId ?? null,
      seriesPart: parsed.data.seriesPart ?? null,
    })
    .returning();

  const authenticityCheck = isPublishingOnCreate ? runAuthenticityCheck(draft.aiOriginalPost, draft.postOutput ?? "") : undefined;
  res.status(201).json(GetDraftResponse.parse({ ...draft, authenticityCheck }));

  void upsertDailyActivity(req.user!.userId);
});

router.post("/drafts/authenticity-check", requireAuth, async (req, res): Promise<void> => {
  const parsed = CheckDraftAuthenticityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let original = parsed.data.aiOriginalPost ?? null;
  let postOutput = parsed.data.postOutput;
  if (parsed.data.draftId !== undefined) {
    const [draft] = await db
      .select({ aiOriginalPost: draftsTable.aiOriginalPost, postOutput: draftsTable.postOutput })
      .from(draftsTable)
      .where(and(eq(draftsTable.id, parsed.data.draftId), eq(draftsTable.userId, req.user!.userId)));
    if (!draft) {
      res.status(404).json({ error: "Draft not found" });
      return;
    }
    original = draft.aiOriginalPost;
    postOutput = postOutput ?? draft.postOutput ?? "";
  }
  if (!postOutput?.trim()) {
    res.status(400).json({ error: "A post is required for review" });
    return;
  }

  // This endpoint deliberately has no persistence side effects and no AI
  // provider call. It gives Capture and Library a review before publishing.
  const check = runAuthenticityCheck(original, postOutput);
  res.json(CheckDraftAuthenticityResponse.parse({ check }));
});

router.get("/drafts/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetDraftParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [draft] = await db
    .select()
    .from(draftsTable)
    .where(and(eq(draftsTable.id, params.data.id), eq(draftsTable.userId, req.user!.userId)));

  if (!draft) {
    res.status(404).json({ error: "Draft not found" });
    return;
  }

  res.json(GetDraftResponse.parse(normalizeDraft(draft)));
});

router.patch("/drafts/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateDraftParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateDraftBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.postOutput !== undefined) updateData.postOutput = parsed.data.postOutput;
  if (parsed.data.shortPost !== undefined) updateData.shortPost = parsed.data.shortPost;
  if (parsed.data.carouselOutput !== undefined) updateData.carouselOutput = parsed.data.carouselOutput;
  if (parsed.data.visualOutput !== undefined) updateData.visualOutput = parsed.data.visualOutput;
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
  if (parsed.data.structuredBreakdown !== undefined) updateData.structuredBreakdown = parsed.data.structuredBreakdown as object;
  if (parsed.data.contentSource !== undefined) updateData.contentSource = parsed.data.contentSource;
  if (parsed.data.visualType !== undefined) updateData.visualType = parsed.data.visualType;
  if (parsed.data.isVoiceSample !== undefined) updateData.isVoiceSample = parsed.data.isVoiceSample;
  if (parsed.data.authenticityFeedback !== undefined) updateData.authenticityFeedback = parsed.data.authenticityFeedback;
  if (parsed.data.topicId !== undefined) updateData.topicId = parsed.data.topicId;
  if (parsed.data.seriesId !== undefined) updateData.seriesId = parsed.data.seriesId;
  if (parsed.data.seriesPart !== undefined) updateData.seriesPart = parsed.data.seriesPart;

  // Rule-based, publish-time-only nudge — never blocks, only attached to the
  // response when there's actually something worth surfacing (see
  // runAuthenticityCheck). Runs once here so it applies identically whether
  // the publish came from Capture's "Ship it" or Library's "Mark as
  // Published" — both hit this same endpoint.
  const isPublishing = parsed.data.status === "published";

  // Demo accounts: apply the edit in-memory and echo it back without persisting,
  // so the editing flow works but shared demo data stays untouched.
  if (isDemoUser(req.user!.email)) {
    const [existing] = await db
      .select()
      .from(draftsTable)
      .where(and(eq(draftsTable.id, params.data.id), eq(draftsTable.userId, req.user!.userId)));
    if (!existing) {
      res.status(404).json({ error: "Draft not found" });
      return;
    }
    const merged = { ...existing, ...updateData, updatedAt: new Date() };
    const authenticityCheck = isPublishing ? runAuthenticityCheck(merged.aiOriginalPost, merged.postOutput ?? "") : undefined;
    res.json(UpdateDraftResponse.parse({ ...normalizeDraft(merged), authenticityCheck }));
    return;
  }

  const [draft] = await db
    .update(draftsTable)
    .set(updateData)
    .where(and(eq(draftsTable.id, params.data.id), eq(draftsTable.userId, req.user!.userId)))
    .returning();

  if (!draft) {
    res.status(404).json({ error: "Draft not found" });
    return;
  }

  const authenticityCheck = isPublishing ? runAuthenticityCheck(draft.aiOriginalPost, draft.postOutput ?? "") : undefined;
  res.json(UpdateDraftResponse.parse({ ...normalizeDraft(draft), authenticityCheck }));
});

router.delete("/drafts/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteDraftParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // Demo accounts: acknowledge without persisting so shared demo data survives.
  if (isDemoUser(req.user!.email)) {
    res.sendStatus(204);
    return;
  }

  await db.delete(draftsTable).where(and(eq(draftsTable.id, params.data.id), eq(draftsTable.userId, req.user!.userId)));

  res.sendStatus(204);
});

const PerformanceBody = z.object({
  impressions: z.number().int().min(0),
  reactions: z.number().int().min(0),
  comments: z.number().int().min(0),
  reposts: z.number().int().min(0).optional().default(0),
  saves: z.number().int().min(0).optional().default(0),
  sends: z.number().int().min(0).optional().default(0),
  membersReached: z.number().int().min(0).optional().default(0),
  followersGained: z.number().int().min(0).optional().default(0),
  linkEngagements: z.number().int().min(0).optional().default(0),
  linkedinUrl: z.string().max(2000).optional().nullable(),
  linkedinPostDate: z.string().max(50).optional().nullable(),
  demographics: z.record(z.unknown()).optional().nullable(),
  linkedinFeedbackStatus: z.enum(["reported", "not_reported", "unknown"]).optional(),
  linkedinFeedbackLabel: z.string().max(300).optional().nullable(),
  linkedinFeedbackSource: z.enum(["manual", "linkedin_xlsx"]).optional().nullable(),
  linkedinFeedbackRaw: z.string().max(500).optional().nullable(),
});

const xlsxUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

router.post("/drafts/:id/performance", requireAuth, async (req, res): Promise<void> => {
  const params = GetDraftParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = PerformanceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid performance data" });
    return;
  }

  const [draft] = await db
    .select({ id: draftsTable.id })
    .from(draftsTable)
    .where(and(eq(draftsTable.id, params.data.id), eq(draftsTable.userId, req.user!.userId)));

  if (!draft) {
    res.status(404).json({ error: "Draft not found" });
    return;
  }

  const [existing] = await db
    .select()
    .from(performanceSignalsTable)
    .where(eq(performanceSignalsTable.draftId, params.data.id));

  const signalData = {
    impressions: parsed.data.impressions,
    reactions: parsed.data.reactions,
    comments: parsed.data.comments,
    reposts: parsed.data.reposts ?? 0,
    saves: parsed.data.saves ?? 0,
    sends: parsed.data.sends ?? 0,
    membersReached: parsed.data.membersReached ?? 0,
    followersGained: parsed.data.followersGained ?? 0,
    linkEngagements: parsed.data.linkEngagements ?? 0,
    ...(parsed.data.linkedinUrl !== undefined ? { linkedinUrl: parsed.data.linkedinUrl } : {}),
    ...(parsed.data.linkedinPostDate !== undefined ? { linkedinPostDate: parsed.data.linkedinPostDate } : {}),
    ...(parsed.data.demographics !== undefined ? { demographics: parsed.data.demographics } : {}),
    ...(parsed.data.linkedinFeedbackStatus !== undefined ? { linkedinFeedbackStatus: parsed.data.linkedinFeedbackStatus } : {}),
    ...(parsed.data.linkedinFeedbackLabel !== undefined ? { linkedinFeedbackLabel: parsed.data.linkedinFeedbackLabel } : {}),
    ...(parsed.data.linkedinFeedbackSource !== undefined ? { linkedinFeedbackSource: parsed.data.linkedinFeedbackSource } : {}),
    ...(parsed.data.linkedinFeedbackRaw !== undefined ? { linkedinFeedbackRaw: parsed.data.linkedinFeedbackRaw } : {}),
  };

  let signal;
  if (existing) {
    const [updated] = await db
      .update(performanceSignalsTable)
      .set(signalData)
      .where(eq(performanceSignalsTable.draftId, params.data.id))
      .returning();
    signal = updated;
  } else {
    const [created] = await db
      .insert(performanceSignalsTable)
      .values({ draftId: params.data.id, ...signalData })
      .returning();
    signal = created;
  }

  // Persist LinkedIn URL to the draft itself so it surfaces in the card/list
  if (parsed.data.linkedinUrl) {
    await db
      .update(draftsTable)
      .set({ linkedinUrl: parsed.data.linkedinUrl })
      .where(and(eq(draftsTable.id, params.data.id), eq(draftsTable.userId, req.user!.userId)));
  }

  res.json(signal);
});

router.post("/drafts/:id/performance/upload", requireAuth, xlsxUpload.single("file"), async (req, res): Promise<void> => {
  const params = GetDraftParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
  const validExt = req.file.originalname.toLowerCase().endsWith(".xlsx");
  const validMagic = req.file.buffer.length >= 4
    && req.file.buffer[0] === 0x50 && req.file.buffer[1] === 0x4B; // ZIP/OOXML magic bytes (PK)
  if (!validExt || !validMagic) {
    res.status(400).json({ error: "File must be a LinkedIn analytics .xlsx export" }); return;
  }

  const [draft] = await db
    .select({ id: draftsTable.id })
    .from(draftsTable)
    .where(and(eq(draftsTable.id, params.data.id), eq(draftsTable.userId, req.user!.userId)));

  if (!draft) { res.status(404).json({ error: "Draft not found" }); return; }

  let parsed: ReturnType<typeof parseLinkedinAnalytics>;
  try {
    parsed = parseLinkedinAnalytics(req.file.buffer);
  } catch (err) {
    console.error("[upload-analytics] parse error", err);
    res.status(422).json({ error: "Could not parse the xlsx file. Make sure it is a LinkedIn single-post analytics export." });
    return;
  }

  const signalData = {
    impressions: parsed.impressions,
    reactions: parsed.reactions,
    comments: parsed.comments,
    reposts: parsed.reposts,
    saves: parsed.saves,
    sends: parsed.sends,
    membersReached: parsed.membersReached,
    followersGained: parsed.followersGained,
    linkEngagements: parsed.linkEngagements,
    demographics: parsed.demographics as Record<string, unknown>,
    linkedinUrl: parsed.linkedinUrl ?? undefined,
    linkedinPostDate: parsed.linkedinPostDate ?? undefined,
    linkedinFeedbackStatus: parsed.linkedinFeedback.status,
    linkedinFeedbackLabel: parsed.linkedinFeedback.label,
    linkedinFeedbackSource: "linkedin_xlsx",
    linkedinFeedbackRaw: parsed.linkedinFeedback.raw,
  };

  const [existing] = await db
    .select()
    .from(performanceSignalsTable)
    .where(eq(performanceSignalsTable.draftId, params.data.id));

  let signal;
  if (existing) {
    const [updated] = await db
      .update(performanceSignalsTable)
      .set(signalData)
      .where(eq(performanceSignalsTable.draftId, params.data.id))
      .returning();
    signal = updated;
  } else {
    const [created] = await db
      .insert(performanceSignalsTable)
      .values({ draftId: params.data.id, ...signalData })
      .returning();
    signal = created;
  }

  // Auto-mark the draft as published if it isn't already, and grab postOutput for analysis
  const [updatedDraft] = await db
    .update(draftsTable)
    .set({ status: "published", ...(parsed.linkedinUrl ? { linkedinUrl: parsed.linkedinUrl } : {}) })
    .where(and(eq(draftsTable.id, params.data.id), eq(draftsTable.userId, req.user!.userId)))
    .returning({ postOutput: draftsTable.postOutput });

  // Generate AI analysis of the post performance (best-effort — non-fatal)
  let analysis: { strengths: string[]; takeaways: string[]; futureImprovement: string } | null = null;
  try {
    const postText = updatedDraft?.postOutput;
    if (postText && postText.length > 50) {
      const reach = parsed.membersReached > 0 ? parsed.membersReached : parsed.impressions;
      const w = parsed.reactions * 3 + parsed.comments * 5 + parsed.reposts * 4 + parsed.saves * 8;
      const resonanceScore = reach > 0 ? Math.min(100, Math.round((w / reach) * 1000)) : 0;

      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        system: `You are a LinkedIn content analyst. Analyse a post and its performance data.
Return JSON only — no markdown, no explanation:
{
  "strengths": ["specific thing this post did well (max 20 words)", "another strength (max 20 words)"],
  "takeaways": ["key content lesson from the performance (max 20 words)", "another lesson (max 20 words)"],
  "futureImprovement": "One sentence: the specific pattern or technique from this post the AI should replicate to improve this creator's future content (max 35 words)"
}`,
        messages: [{
          role: "user",
          content: `Post:\n${postText.slice(0, 1500)}\n\nPerformance metrics:\n- Impressions: ${parsed.impressions.toLocaleString()}\n- Members reached: ${parsed.membersReached.toLocaleString()}\n- Reactions: ${parsed.reactions}\n- Comments: ${parsed.comments}\n- Saves: ${parsed.saves}\n- Reposts: ${parsed.reposts}\n- Resonance score: ${resonanceScore}/100`,
        }],
      });

      const block = msg.content[0];
      if (block.type === "text") {
        const cleaned = block.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/m, "").trim();
        analysis = JSON.parse(cleaned) as { strengths: string[]; takeaways: string[]; futureImprovement: string };
      }
    }
  } catch (err) {
    console.error("[upload-analytics] analysis generation failed (non-fatal):", err);
  }

  res.json({ signal, parsed, ...(analysis ? { analysis } : {}) });
});

// Published drafts that have no performance data yet, 2–14 days old — the
// window where LinkedIn numbers are worth logging. Powers the dashboard
// check-in nudge that feeds the learning loop.
router.get("/checkins", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const drafts = await db
    .select({
      id: draftsTable.id,
      structuredBreakdown: draftsTable.structuredBreakdown,
      postOutput: draftsTable.postOutput,
      updatedAt: draftsTable.updatedAt,
    })
    .from(draftsTable)
    .where(and(eq(draftsTable.userId, userId), eq(draftsTable.status, "published")))
    .orderBy(desc(draftsTable.updatedAt))
    .limit(30);

  const withSignals = drafts.length > 0
    ? await db
        .select({ draftId: performanceSignalsTable.draftId })
        .from(performanceSignalsTable)
        .where(inArray(performanceSignalsTable.draftId, drafts.map((d) => d.id)))
    : [];
  const logged = new Set(withSignals.map((s) => s.draftId));

  const now = Date.now();
  const checkins = drafts
    .filter((d) => {
      if (logged.has(d.id)) return false;
      const ageDays = (now - new Date(d.updatedAt).getTime()) / 86400000;
      return ageDays >= 2 && ageDays <= 14;
    })
    .slice(0, 2)
    .map((d) => {
      const bd = d.structuredBreakdown as { topic?: string } | null;
      const topic = bd?.topic ?? d.postOutput?.split("\n").find((l) => l.trim())?.slice(0, 60) ?? `Post #${d.id}`;
      const ageDays = Math.floor((now - new Date(d.updatedAt).getTime()) / 86400000);
      return { id: d.id, topic, ageDays };
    });

  res.json({ checkins });
});

router.get("/analytics/overview", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const windowDays = req.query["window"] === "30" ? 30 : req.query["window"] === "60" ? 60 : 90;

  const [allDrafts, [preferences]] = await Promise.all([
    db
      .select()
      .from(draftsTable)
      .where(and(eq(draftsTable.userId, userId), eq(draftsTable.status, "published")))
      .orderBy(desc(draftsTable.createdAt)),
    db.select().from(preferencesTable).where(eq(preferencesTable.userId, userId)).limit(1),
  ]);

  const totalPublished = allDrafts.length;

  const draftIds = allDrafts.map(d => d.id);
  const signals = draftIds.length > 0
    ? await db
      .select()
      .from(performanceSignalsTable)
      .where(inArray(performanceSignalsTable.draftId, draftIds))
    : [];
  const perfMap = new Map<number, { impressions: number; reactions: number; comments: number; reposts: number; saves: number; membersReached: number }>();
  for (const s of signals) {
    perfMap.set(s.draftId, { impressions: s.impressions, reactions: s.reactions, comments: s.comments, reposts: s.reposts, saves: s.saves, membersReached: s.membersReached });
  }

  const resonanceOf = (draftId: number): number | null => {
    const p = perfMap.get(draftId);
    if (!p) return null;
    const engagementWeight = p.reactions * 3 + p.comments * 5 + p.reposts * 4 + p.saves * 8;
    const reach = p.membersReached > 0 ? p.membersReached : p.impressions;
    if (reach > 0) {
      return Math.min(100, Math.round((engagementWeight / reach) * 1000));
    }
    if (engagementWeight === 0) return null;
    return Math.min(100, Math.round(Math.log2(1 + engagementWeight) * 12));
  };

  const engagementRateOf = (draftId: number): number | null => {
    const p = perfMap.get(draftId);
    if (!p || p.impressions === 0) return null;
    return Math.round(((p.reactions + p.comments + p.reposts) / p.impressions) * 10000) / 100;
  };

  const resonanceValues = allDrafts.map(d => resonanceOf(d.id)).filter((v): v is number => v !== null);
  const avgResonance = resonanceValues.length > 0
    ? Math.round(resonanceValues.reduce((a, b) => a + b, 0) / resonanceValues.length)
    : 0;

  const toneMap = new Map<string, { count: number; resonances: number[] }>();
  for (const d of allDrafts) {
    const tone = d.tone || "Unknown";
    if (!toneMap.has(tone)) toneMap.set(tone, { count: 0, resonances: [] });
    const entry = toneMap.get(tone)!;
    entry.count++;
    const r = resonanceOf(d.id);
    if (r !== null) entry.resonances.push(r);
  }
  const byTone = Array.from(toneMap.entries()).map(([tone, { count, resonances }]) => ({
    tone,
    count,
    sampledCount: resonances.length,
    avgResonance: resonances.length >= 2 ? Math.round(resonances.reduce((a, b) => a + b, 0) / resonances.length) : null,
  })).sort((a, b) => b.count - a.count);

  const loggedPerformanceCount = resonanceValues.length;
  const feedbackCounts = allDrafts.reduce<Record<string, number>>((counts, draft) => {
    if (draft.authenticityFeedback) {
      counts[draft.authenticityFeedback] = (counts[draft.authenticityFeedback] ?? 0) + 1;
    }
    return counts;
  }, {});
  const reviewedDrafts = Object.values(feedbackCounts).reduce((total, count) => total + count, 0);
  const words = (text: string) => new Set(
    text.toLowerCase().match(/[a-z0-9']+/g) ?? [],
  );
  const materiallyEditedBeforePublish = allDrafts.filter((draft) => {
    if (!draft.aiOriginalPost || !draft.postOutput) return false;
    const originalWords = words(draft.aiOriginalPost);
    const finalWords = words(draft.postOutput);
    if (originalWords.size === 0 || finalWords.size === 0) return false;
    const shared = [...originalWords].filter((word) => finalWords.has(word)).length;
    const similarity = shared / new Set([...originalWords, ...finalWords]).size;
    return similarity < 0.88;
  }).length;
  const externalFeedbackReported = signals.filter((signal) => signal.linkedinFeedbackStatus === "reported").length;
  const externalFeedbackNotReported = signals.filter((signal) => signal.linkedinFeedbackStatus === "not_reported").length;
  const externalFeedbackUnknown = signals.filter((signal) => signal.linkedinFeedbackStatus === "unknown").length;
  const learningMetrics = {
    authorFeedback: {
      reviewedDrafts,
      soundsLikeMe: feedbackCounts.sounds_like_me ?? 0,
      tooGeneric: feedbackCounts.too_generic ?? 0,
      needsSpecificity: feedbackCounts.needs_specificity ?? 0,
      tooPolished: feedbackCounts.too_polished ?? 0,
      approvalRate: reviewedDrafts > 0
        ? Math.round(((feedbackCounts.sounds_like_me ?? 0) / reviewedDrafts) * 100)
        : null,
    },
    evidence: {
      pinnedWritingSamples: preferences?.writingSamples?.length ?? 0,
      authenticatedPosts: allDrafts.filter((draft) => draft.isVoiceSample).length,
      materiallyEditedBeforePublish,
    },
    outcomes: {
      performanceEntries: signals.length,
      externalFeedbackReported,
      externalFeedbackNotReported,
      externalFeedbackUnknown,
    },
  };
  const feedbackCoaching = {
    reportedPostCount: externalFeedbackReported,
    message: externalFeedbackReported >= 2
      ? "A member-feedback indicator appeared on more than one measured post. Treat this as a prompt to review specificity and the pre-publish check on future drafts—not as a verdict on your voice."
      : externalFeedbackReported === 1
        ? "One measured post included a member-feedback indicator. Keep it attached to that post and use the pre-publish check as a light coaching prompt for the next draft."
        : null,
  };

  const avgResForDrafts = (drafts: typeof allDrafts) => {
    const vals = drafts.map(d => resonanceOf(d.id)).filter((v): v is number => v !== null);
    return { avgResonance: vals.length >= 2 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null, sampledCount: vals.length };
  };

  const srcBuckets = new Map<string, typeof allDrafts>();
  for (const d of allDrafts) {
    const src = (d.contentSource as string | null) || "capture";
    if (!srcBuckets.has(src)) srcBuckets.set(src, []);
    srcBuckets.get(src)!.push(d);
  }
  const byContentSource = Array.from(srcBuckets.entries())
    .map(([source, drafts]) => ({ source, count: drafts.length, ...avgResForDrafts(drafts) }))
    .sort((a, b) => b.count - a.count);

  const visBuckets = new Map<string, typeof allDrafts>();
  for (const d of allDrafts) {
    const vt = (d.visualType as string | null) || "none";
    if (!visBuckets.has(vt)) visBuckets.set(vt, []);
    visBuckets.get(vt)!.push(d);
  }
  const byVisualType = Array.from(visBuckets.entries())
    .map(([type, drafts]) => ({ type, count: drafts.length, ...avgResForDrafts(drafts) }))
    .sort((a, b) => b.count - a.count);

  const objBuckets = new Map<string, typeof allDrafts>();
  for (const d of allDrafts) {
    const obj = d.objective || "Unknown";
    if (!objBuckets.has(obj)) objBuckets.set(obj, []);
    objBuckets.get(obj)!.push(d);
  }
  const byObjective = Array.from(objBuckets.entries())
    .map(([objective, drafts]) => ({ objective, count: drafts.length, ...avgResForDrafts(drafts) }))
    .sort((a, b) => b.count - a.count);

  const withResonance = allDrafts
    .map(d => ({ d, r: resonanceOf(d.id) }))
    .filter((x): x is { d: typeof allDrafts[0]; r: number } => x.r !== null)
    .sort((a, b) => b.r - a.r)
    .slice(0, 5);
  const topPosts = withResonance.map(({ d, r }) => {
    const p = perfMap.get(d.id);
    return {
      id: d.id,
      topic: ((d.structuredBreakdown as Record<string, unknown>)?.topic as string | undefined) ?? "Untitled",
      resonance: r,
      engagementRate: engagementRateOf(d.id),
      impressions: p?.impressions ?? 0,
      reactions: p?.reactions ?? 0,
      comments: p?.comments ?? 0,
      reposts: p?.reposts ?? 0,
      tone: d.tone,
      contentSource: (d.contentSource as string | null) || "capture",
      visualType: (d.visualType as string | null) || "none",
      publishedAt: d.updatedAt.toISOString(),
    };
  });

  const now = new Date();
  const cutoffs = { 30: new Date(now.getTime() - 30 * 86400000), 60: new Date(now.getTime() - 60 * 86400000), 90: new Date(now.getTime() - 91 * 86400000) };
  const weekMap = new Map<string, number>();
  for (const d of allDrafts) {
    if (d.createdAt < cutoffs[90]) continue;
    const date = new Date(d.createdAt);
    const jan1 = new Date(date.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((date.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
    const key = `${date.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
    weekMap.set(key, (weekMap.get(key) ?? 0) + 1);
  }
  const weeklyTrend = Array.from(weekMap.entries())
    .map(([week, count]) => ({ week, count }))
    .sort((a, b) => a.week.localeCompare(b.week));

  const weekResMap = new Map<string, number[]>();
  for (const d of allDrafts) {
    const r = resonanceOf(d.id);
    if (r === null || d.createdAt < cutoffs[90]) continue;
    const date = new Date(d.createdAt);
    const jan1 = new Date(date.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((date.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
    const key = `${date.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
    if (!weekResMap.has(key)) weekResMap.set(key, []);
    weekResMap.get(key)!.push(r);
  }
  const weeklyResonanceTrend = Array.from(weekResMap.entries())
    .filter(([, vals]) => vals.length >= 2)
    .map(([week, vals]) => ({ week, avgResonance: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length), sampleCount: vals.length }))
    .sort((a, b) => a.week.localeCompare(b.week));

  const last30 = allDrafts.filter(d => d.createdAt >= cutoffs[30]).length;
  const last60 = allDrafts.filter(d => d.createdAt >= cutoffs[60]).length;
  const last90 = allDrafts.filter(d => d.createdAt >= cutoffs[90]).length;

  // ── Time-windowed analytics (respects ?window param) ──────────────────────
  const windowMs = windowDays * 86400000;
  const windowStart = new Date(now.getTime() - windowMs);
  const priorStart = new Date(now.getTime() - windowMs * 2);
  const windowDrafts = allDrafts.filter(d => d.createdAt >= windowStart);
  const priorDrafts = allDrafts.filter(d => d.createdAt >= priorStart && d.createdAt < windowStart);

  const trendDir = (curr: number | null, prior: number | null): "up" | "down" | "flat" | null => {
    if (curr === null || prior === null) return null;
    if (prior === 0 && curr === 0) return "flat";
    if (prior === 0) return "up";
    const change = (curr - prior) / prior;
    if (change > 0.05) return "up";
    if (change < -0.05) return "down";
    return "flat";
  };

  const avgResOf = (drafts: typeof allDrafts): number | null => {
    const vals = drafts.map(d => resonanceOf(d.id)).filter((v): v is number => v !== null);
    return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  };

  const avgEngRateOf = (drafts: typeof allDrafts): number | null => {
    const vals = drafts.map(d => engagementRateOf(d.id)).filter((v): v is number => v !== null);
    return vals.length > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : null;
  };

  const sumImpressionsOf = (drafts: typeof allDrafts): number =>
    drafts.reduce((sum, d) => sum + (perfMap.get(d.id)?.impressions ?? 0), 0);

  const currAvgRes = avgResOf(windowDrafts);
  const priorAvgRes = avgResOf(priorDrafts);
  const currEngRate = avgEngRateOf(windowDrafts);
  const priorEngRate = avgEngRateOf(priorDrafts);
  const currImpressions = sumImpressionsOf(windowDrafts);
  const priorImpressions = sumImpressionsOf(priorDrafts);

  const kpiTrends = {
    avgResonance: { current: currAvgRes, prior: priorAvgRes, trend: trendDir(currAvgRes, priorAvgRes) },
    totalPublished: { current: windowDrafts.length, prior: priorDrafts.length, trend: trendDir(windowDrafts.length, priorDrafts.length) },
    avgEngagementRate: { current: currEngRate, prior: priorEngRate, trend: trendDir(currEngRate, priorEngRate) },
    totalImpressions: { current: currImpressions, prior: priorImpressions, trend: trendDir(currImpressions, priorImpressions) },
  };

  const avgEngagementRate = currEngRate;
  const totalImpressions = sumImpressionsOf(allDrafts);

  // Posting consistency
  const computeConsistency = (drafts: typeof allDrafts): number | null => {
    if (drafts.length < 2) return null;
    const sorted = [...drafts].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push((sorted[i].createdAt.getTime() - sorted[i - 1].createdAt.getTime()) / 86400000);
    }
    return Math.round((gaps.reduce((a, b) => a + b, 0) / gaps.length) * 10) / 10;
  };
  const currConsistency = computeConsistency(windowDrafts);
  const priorConsistency = computeConsistency(priorDrafts);
  // "improved" means posting MORE frequently (smaller gap), so invert for trend direction
  const postingConsistency = {
    avgDaysBetweenPosts: currConsistency,
    prior: priorConsistency,
    trend: trendDir(
      currConsistency !== null ? -currConsistency : null,
      priorConsistency !== null ? -priorConsistency : null
    ) as "up" | "down" | "flat" | null,
  };

  // Best time to post
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const timeBlock = (hour: number): string => {
    if (hour >= 6 && hour <= 11) return "Morning";
    if (hour >= 12 && hour <= 13) return "Midday";
    if (hour >= 14 && hour <= 17) return "Afternoon";
    if (hour >= 18 && hour <= 21) return "Evening";
    return "Night";
  };

  const timeCells = new Map<string, { resonances: number[]; count: number }>();
  const dayMap = new Map<string, { resonances: number[]; count: number }>();
  const blockMap = new Map<string, { resonances: number[]; count: number }>();

  for (const d of windowDrafts) {
    const r = resonanceOf(d.id);
    const date = new Date(d.createdAt);
    const day = DAY_NAMES[date.getDay()] ?? "Unknown";
    const block = timeBlock(date.getHours());
    const cellKey = `${day}|${block}`;

    if (!timeCells.has(cellKey)) timeCells.set(cellKey, { resonances: [], count: 0 });
    const cell = timeCells.get(cellKey)!;
    cell.count++;
    if (r !== null) cell.resonances.push(r);

    if (!dayMap.has(day)) dayMap.set(day, { resonances: [], count: 0 });
    const de = dayMap.get(day)!;
    de.count++;
    if (r !== null) de.resonances.push(r);

    if (!blockMap.has(block)) blockMap.set(block, { resonances: [], count: 0 });
    const be = blockMap.get(block)!;
    be.count++;
    if (r !== null) be.resonances.push(r);
  }

  const byDayOfWeek = DAY_NAMES
    .map(day => {
      const e = dayMap.get(day);
      if (!e) return null;
      return {
        day,
        count: e.count,
        avgResonance: e.resonances.length >= 2 ? Math.round(e.resonances.reduce((a, b) => a + b, 0) / e.resonances.length) : null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const TIME_BLOCK_ORDER = ["Morning", "Midday", "Afternoon", "Evening", "Night"];
  const byTimeBlock = TIME_BLOCK_ORDER
    .map(block => {
      const e = blockMap.get(block);
      if (!e) return null;
      return {
        block,
        count: e.count,
        avgResonance: e.resonances.length >= 2 ? Math.round(e.resonances.reduce((a, b) => a + b, 0) / e.resonances.length) : null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  let topCombination: { day: string; block: string; avgResonance: number } | null = null;
  let bestCellRes = -1;
  for (const [key, { resonances, count }] of timeCells.entries()) {
    if (count < 2 || resonances.length < 2) continue;
    const avg = Math.round(resonances.reduce((a, b) => a + b, 0) / resonances.length);
    if (avg > bestCellRes) {
      bestCellRes = avg;
      const parts = key.split("|");
      topCombination = { day: parts[0] ?? "", block: parts[1] ?? "", avgResonance: avg };
    }
  }

  const bestTimeToPost = { byDayOfWeek, byTimeBlock, topCombination };

  // Hashtag performance
  const hashtagMap = new Map<string, { resonances: number[]; count: number }>();
  for (const d of windowDrafts) {
    if (!d.postOutput) continue;
    const tags = [...d.postOutput.matchAll(/#([A-Za-z][A-Za-z0-9_]*)/g)].map(m => m[1]!.toLowerCase());
    const r = resonanceOf(d.id);
    for (const tag of new Set(tags)) {
      if (!hashtagMap.has(tag)) hashtagMap.set(tag, { resonances: [], count: 0 });
      const e = hashtagMap.get(tag)!;
      e.count++;
      if (r !== null) e.resonances.push(r);
    }
  }
  const hashtagPerformance = Array.from(hashtagMap.entries())
    .map(([hashtag, { resonances, count }]) => ({
      hashtag,
      count,
      avgResonance: resonances.length >= 2 ? Math.round(resonances.reduce((a, b) => a + b, 0) / resonances.length) : null,
    }))
    .sort((a, b) => (b.avgResonance ?? -1) - (a.avgResonance ?? -1) || b.count - a.count)
    .slice(0, 10);

  // Media format breakdown (LinkedIn shareMediaCategory)
  const fmtBuckets = new Map<string, typeof allDrafts>();
  for (const d of windowDrafts) {
    const fmt = (d.mediaFormat as string | null) || "NONE";
    if (!fmtBuckets.has(fmt)) fmtBuckets.set(fmt, []);
    fmtBuckets.get(fmt)!.push(d);
  }
  const byMediaFormat = Array.from(fmtBuckets.entries())
    .map(([format, drafts]) => ({ format, count: drafts.length, ...avgResForDrafts(drafts) }))
    .sort((a, b) => b.count - a.count);

  const result = GetAnalyticsOverviewResponse.parse({
    totalPublished,
    avgResonance,
    loggedPerformanceCount,
    byTone,
    byContentSource,
    byVisualType,
    byObjective,
    topPosts,
    weeklyTrend,
    weeklyResonanceTrend,
    last30,
    last60,
    last90,
    kpiTrends,
    avgEngagementRate,
    totalImpressions,
    postingConsistency,
    bestTimeToPost,
    hashtagPerformance,
    byMediaFormat,
    learningMetrics,
    feedbackCoaching,
  });

  res.json(result);
});

router.get("/drafts/:id/performance", requireAuth, async (req, res): Promise<void> => {
  const params = GetDraftParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [draft] = await db
    .select({ id: draftsTable.id })
    .from(draftsTable)
    .where(and(eq(draftsTable.id, params.data.id), eq(draftsTable.userId, req.user!.userId)));

  if (!draft) {
    res.status(404).json({ error: "Draft not found" });
    return;
  }

  const [signal] = await db
    .select()
    .from(performanceSignalsTable)
    .where(eq(performanceSignalsTable.draftId, params.data.id));

  res.json(signal ?? null);
});

router.get("/analytics/resonance-map", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const publishedDrafts = await db
    .select({ id: draftsTable.id })
    .from(draftsTable)
    .where(and(eq(draftsTable.userId, userId), eq(draftsTable.status, "published")));

  if (publishedDrafts.length === 0) {
    res.json({});
    return;
  }

  const draftIds = publishedDrafts.map((d) => d.id);
  const signals = await db
    .select()
    .from(performanceSignalsTable)
    .where(inArray(performanceSignalsTable.draftId, draftIds));

  const map: Record<number, { resonance: number; engagementRate: number | null; impressions: number; reactions: number; comments: number; reposts: number }> = {};
  for (const s of signals) {
    const w = s.reactions * 3 + s.comments * 5 + s.reposts * 4 + s.saves * 8;
    const reach = s.membersReached > 0 ? s.membersReached : s.impressions;
    let score: number;
    if (reach > 0) {
      score = Math.min(100, Math.round((w / reach) * 1000));
    } else if (w === 0) {
      score = 0;
    } else {
      score = Math.min(100, Math.round(Math.log2(1 + w) * 12));
    }
    const engagementRate = s.impressions > 0
      ? Math.round(((s.reactions + s.comments + s.reposts) / s.impressions) * 10000) / 100
      : null;
    map[s.draftId] = { resonance: score, engagementRate, impressions: s.impressions, reactions: s.reactions, comments: s.comments, reposts: s.reposts };
  }

  res.json(map);
});

export default router;
