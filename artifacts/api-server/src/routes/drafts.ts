import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { draftsTable } from "@workspace/db";
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
      postOutput: parsed.data.postOutput ?? null,
      carouselOutput: parsed.data.carouselOutput ?? null,
      visualOutput: parsed.data.visualOutput ?? null,
      status: parsed.data.status ?? "draft",
    })
    .returning();

  res.status(201).json(GetDraftResponse.parse(draft));
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

export default router;
