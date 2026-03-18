import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { thoughtsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth.js";

const router: IRouter = Router();

const CreateThoughtBody = z.object({
  content: z.string().min(1).max(2000),
});

const UpdateThoughtParams = z.object({ id: z.coerce.number().int().positive() });

router.get("/thoughts", requireAuth, async (req, res): Promise<void> => {
  const thoughts = await db
    .select()
    .from(thoughtsTable)
    .where(eq(thoughtsTable.userId, req.user!.userId))
    .orderBy(desc(thoughtsTable.createdAt));

  res.json(thoughts);
});

router.post("/thoughts", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateThoughtBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
    return;
  }

  const [thought] = await db
    .insert(thoughtsTable)
    .values({ userId: req.user!.userId, content: parsed.data.content })
    .returning();

  res.status(201).json(thought);
});

router.patch("/thoughts/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateThoughtParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const PatchBody = z.object({
    content: z.string().min(1).max(2000).optional(),
    developed: z.boolean().optional(),
  });

  const parsed = PatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.content !== undefined) updateData.content = parsed.data.content;
  if (parsed.data.developed !== undefined) updateData.developed = parsed.data.developed;

  const [thought] = await db
    .update(thoughtsTable)
    .set(updateData)
    .where(and(eq(thoughtsTable.id, params.data.id), eq(thoughtsTable.userId, req.user!.userId)))
    .returning();

  if (!thought) {
    res.status(404).json({ error: "Thought not found" });
    return;
  }

  res.json(thought);
});

router.delete("/thoughts/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateThoughtParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  await db
    .delete(thoughtsTable)
    .where(and(eq(thoughtsTable.id, params.data.id), eq(thoughtsTable.userId, req.user!.userId)));

  res.sendStatus(204);
});

export default router;
