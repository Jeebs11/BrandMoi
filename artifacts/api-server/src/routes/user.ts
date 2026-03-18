import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, desc, and } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db } from "@workspace/db";
import { preferencesTable, draftsTable, brandVoiceSignalsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth.js";

const router: IRouter = Router();

const UpdatePreferencesBody = z.object({
  objective: z.string().optional(),
  persona: z.string().optional(),
  tone: z.string().optional(),
  brandRole: z.string().optional(),
  brandAudience: z.string().optional(),
  brandBelief: z.string().optional(),
  onboarded: z.boolean().optional(),
});

router.get("/user/preferences", requireAuth, async (req, res): Promise<void> => {
  const [prefs] = await db
    .select()
    .from(preferencesTable)
    .where(eq(preferencesTable.userId, req.user!.userId))
    .limit(1);

  if (!prefs) {
    const [newPrefs] = await db
      .insert(preferencesTable)
      .values({ userId: req.user!.userId })
      .returning();
    res.json(newPrefs);
    return;
  }

  res.json(prefs);
});

router.put("/user/preferences", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdatePreferencesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.objective !== undefined) updateData.objective = parsed.data.objective;
  if (parsed.data.persona !== undefined) updateData.persona = parsed.data.persona;
  if (parsed.data.tone !== undefined) updateData.tone = parsed.data.tone;
  if (parsed.data.brandRole !== undefined) updateData.brandRole = parsed.data.brandRole;
  if (parsed.data.brandAudience !== undefined) updateData.brandAudience = parsed.data.brandAudience;
  if (parsed.data.brandBelief !== undefined) updateData.brandBelief = parsed.data.brandBelief;
  if (parsed.data.onboarded !== undefined) updateData.onboarded = parsed.data.onboarded;

  const [prefs] = await db
    .update(preferencesTable)
    .set(updateData)
    .where(eq(preferencesTable.userId, req.user!.userId))
    .returning();

  res.json(prefs);
});

router.get("/user/suggestions", requireAuth, async (req, res): Promise<void> => {
  const drafts = await db
    .select()
    .from(draftsTable)
    .where(eq(draftsTable.userId, req.user!.userId))
    .orderBy(desc(draftsTable.createdAt))
    .limit(10);

  const suggestions = buildSuggestions(drafts);
  res.json(suggestions);
});

router.get("/user/voice-summary", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const [prefs] = await db
    .select()
    .from(preferencesTable)
    .where(eq(preferencesTable.userId, userId))
    .limit(1);

  const publishedCount = await db
    .select({ id: draftsTable.id })
    .from(draftsTable)
    .where(and(eq(draftsTable.userId, userId), eq(draftsTable.status, "published")));

  const currentCount = publishedCount.length;
  const lastCount = prefs?.voiceSummaryDraftCount ?? 0;
  const hasExistingSummary = !!prefs?.brandVoiceSummary;
  const needsRefresh = currentCount - lastCount >= 5 || (!hasExistingSummary && currentCount > 0);

  if (!needsRefresh && hasExistingSummary) {
    res.json({ summary: prefs!.brandVoiceSummary, draftCount: currentCount });
    return;
  }

  const signals = await db
    .select()
    .from(brandVoiceSignalsTable)
    .where(eq(brandVoiceSignalsTable.userId, userId))
    .orderBy(desc(brandVoiceSignalsTable.createdAt))
    .limit(20);

  if (signals.length === 0) {
    res.json({ summary: null, draftCount: currentCount });
    return;
  }

  try {
    const signalsText = signals
      .map((s) => JSON.stringify(s.signals))
      .join("\n");

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: "You are a brand voice analyst. Based on writing pattern signals extracted from a user's LinkedIn posts, write a plain-language voice profile. Return 3-5 bullet points starting with 'You'. Be specific, descriptive, and flattering. Focus on what makes their writing distinctive and effective.",
      messages: [{ role: "user", content: `Writing signals from ${signals.length} posts:\n${signalsText}\n\nReturn 3-5 bullet points about this person's writing voice.` }],
    });

    const t = message.content[0];
    if (t.type !== "text") {
      res.json({ summary: prefs?.brandVoiceSummary ?? null, draftCount: currentCount });
      return;
    }

    const summary = t.text.trim();

    await db
      .update(preferencesTable)
      .set({ brandVoiceSummary: summary, voiceSummaryDraftCount: currentCount })
      .where(eq(preferencesTable.userId, userId));

    res.json({ summary, draftCount: currentCount });
  } catch {
    res.json({ summary: prefs?.brandVoiceSummary ?? null, draftCount: currentCount });
  }
});

function countBy(items: { objective: string }[], key: "objective"): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const k = item[key];
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}

function maxKey(counts: Record<string, number>): string | undefined {
  return Object.keys(counts).reduce<string | undefined>((a, b) => {
    if (a === undefined) return b;
    return (counts[a] ?? 0) >= (counts[b] ?? 0) ? a : b;
  }, undefined);
}

type DraftRow = {
  objective: string;
  persona: string;
  postOutput: string | null;
  carouselOutput: string | null;
  structuredBreakdown: unknown;
};

function buildSuggestions(drafts: DraftRow[]): Array<{ id: string; type: string; message: string; action: string }> {
  if (drafts.length < 3) {
    return [
      { id: "s1", type: "prompt", message: "Share a lesson from your biggest professional mistake this year.", action: "Capture this idea" },
      { id: "s2", type: "prompt", message: "What's one counterintuitive truth about your industry most people get wrong?", action: "Capture this idea" },
      { id: "s3", type: "prompt", message: "Describe a client win in under 50 words — what made it work?", action: "Capture this idea" },
      { id: "s4", type: "prompt", message: "What would you tell yourself 3 years ago about your field?", action: "Capture this idea" },
    ];
  }

  const suggestions: Array<{ id: string; type: string; message: string; action: string }> = [];

  const objCounts = countBy(drafts as { objective: string }[], "objective");
  const topObj = maxKey(objCounts);
  const allObjectives = ["Clients", "Job", "Authority", "Documenting"];
  const otherObjs = allObjectives.filter((o) => o !== topObj);
  if (topObj && otherObjs.length > 0) {
    const suggested = otherObjs[Math.floor(Math.random() * otherObjs.length)];
    suggestions.push({
      id: "angle-variety",
      type: "angle",
      message: `You write a lot for ${topObj}. Try a post aimed at ${suggested} this week to reach a new audience.`,
      action: "Capture an idea",
    });
  }

  const repurpose = drafts.find((d) => d.postOutput && !d.carouselOutput);
  if (repurpose) {
    const breakdown = repurpose.structuredBreakdown as { topic?: string } | null;
    const topic = breakdown?.topic?.slice(0, 45) ?? "your recent post";
    suggestions.push({
      id: "repurpose",
      type: "repurpose",
      message: `"${topic}..." would make a strong carousel. Posts that work as essays often work better as slides.`,
      action: "Repurpose it",
    });
  }

  const recent5 = drafts.slice(0, 5);
  const recentObjs = new Set(recent5.map((d) => d.objective));
  const missingObjs = allObjectives.filter((o) => !recentObjs.has(o));
  if (missingObjs.length > 0) {
    suggestions.push({
      id: "content-gap",
      type: "gap",
      message: `You haven't written for ${missingObjs[0]} in your last 5 posts. That audience hasn't heard from you lately.`,
      action: `Write for ${missingObjs[0]}`,
    });
  }

  suggestions.push({
    id: "persona-depth",
    type: "depth",
    message: `What's one thing only you can say — something nobody in your field has the context to write?`,
    action: "Capture this angle",
  });

  return suggestions.slice(0, 4);
}

export default router;
