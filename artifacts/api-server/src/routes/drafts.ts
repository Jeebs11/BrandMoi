import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { draftsTable, performanceSignalsTable } from "@workspace/db";
import {
  CreateDraftBody,
  UpdateDraftBody,
  UpdateDraftParams,
  GetDraftParams,
  GetDraftResponse,
  UpdateDraftResponse,
  DeleteDraftParams,
  ListDraftsResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middleware/auth.js";
import { extractVoiceDNA } from "./ai.js";
import { upsertDailyActivity } from "../lib/momentum.js";

const router: IRouter = Router();

router.get("/drafts", requireAuth, async (req, res): Promise<void> => {
  const drafts = await db
    .select()
    .from(draftsTable)
    .where(eq(draftsTable.userId, req.user!.userId))
    .orderBy(desc(draftsTable.createdAt));
  res.json(ListDraftsResponse.parse(drafts));
});

router.post("/drafts", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateDraftBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
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
      carouselOutput: parsed.data.carouselOutput ?? null,
      visualOutput: parsed.data.visualOutput ?? null,
      status: parsed.data.status ?? "draft",
    })
    .returning();

  res.status(201).json(GetDraftResponse.parse(draft));

  void upsertDailyActivity(req.user!.userId);
  if ((parsed.data.status === "ready" || parsed.data.status === "published") && draft.postOutput) {
    void extractVoiceDNA(req.user!.userId, draft.id, draft.postOutput);
  }
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

  res.json(GetDraftResponse.parse(draft));
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
  if (parsed.data.carouselOutput !== undefined) updateData.carouselOutput = parsed.data.carouselOutput;
  if (parsed.data.visualOutput !== undefined) updateData.visualOutput = parsed.data.visualOutput;
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;

  const [draft] = await db
    .update(draftsTable)
    .set(updateData)
    .where(and(eq(draftsTable.id, params.data.id), eq(draftsTable.userId, req.user!.userId)))
    .returning();

  if (!draft) {
    res.status(404).json({ error: "Draft not found" });
    return;
  }

  res.json(UpdateDraftResponse.parse(draft));

  if ((parsed.data.status === "ready" || parsed.data.status === "published") && draft.postOutput) {
    void extractVoiceDNA(req.user!.userId, draft.id, draft.postOutput);
  }
});

router.delete("/drafts/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteDraftParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(draftsTable).where(and(eq(draftsTable.id, params.data.id), eq(draftsTable.userId, req.user!.userId)));

  res.sendStatus(204);
});

const PerformanceBody = z.object({
  impressions: z.number().int().min(0),
  reactions: z.number().int().min(0),
  comments: z.number().int().min(0),
});

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

  let signal;
  if (existing) {
    const [updated] = await db
      .update(performanceSignalsTable)
      .set({ impressions: parsed.data.impressions, reactions: parsed.data.reactions, comments: parsed.data.comments })
      .where(eq(performanceSignalsTable.draftId, params.data.id))
      .returning();
    signal = updated;
  } else {
    const [created] = await db
      .insert(performanceSignalsTable)
      .values({ draftId: params.data.id, ...parsed.data })
      .returning();
    signal = created;
  }

  res.json(signal);
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

export default router;
