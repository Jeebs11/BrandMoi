import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { topicsTable, draftsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth.js";

const router: IRouter = Router();

router.get("/topics", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const rows = await db
    .select({
      id: topicsTable.id,
      name: topicsTable.name,
      color: topicsTable.color,
      createdAt: topicsTable.createdAt,
      draftCount: sql<number>`count(${draftsTable.id})`.mapWith(Number),
    })
    .from(topicsTable)
    .leftJoin(draftsTable, eq(draftsTable.topicId, topicsTable.id))
    .where(eq(topicsTable.userId, userId))
    .groupBy(topicsTable.id)
    .orderBy(topicsTable.createdAt);

  res.json(rows);
});

const CreateTopicBody = z.object({
  name: z.string().min(1),
  color: z.string().nullish(),
});

router.post("/topics", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateTopicBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [topic] = await db
    .insert(topicsTable)
    .values({ userId: req.user!.userId, name: parsed.data.name, color: parsed.data.color ?? null })
    .returning();

  res.status(201).json(topic);
});

const UpdateTopicBody = z.object({
  name: z.string().min(1).optional(),
  color: z.string().nullish(),
});

router.patch("/topics/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid topic id" });
    return;
  }
  const parsed = UpdateTopicBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.color !== undefined) updateData.color = parsed.data.color;

  const [topic] = await db
    .update(topicsTable)
    .set(updateData)
    .where(and(eq(topicsTable.id, id), eq(topicsTable.userId, req.user!.userId)))
    .returning();

  if (!topic) {
    res.status(404).json({ error: "Topic not found" });
    return;
  }
  res.json(topic);
});

router.delete("/topics/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid topic id" });
    return;
  }

  const [topic] = await db
    .delete(topicsTable)
    .where(and(eq(topicsTable.id, id), eq(topicsTable.userId, req.user!.userId)))
    .returning();

  if (!topic) {
    res.status(404).json({ error: "Topic not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
