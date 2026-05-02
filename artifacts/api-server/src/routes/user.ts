import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, desc, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db } from "@workspace/db";
import { preferencesTable, draftsTable, brandVoiceSignalsTable, usersTable, voiceSuggestionsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth.js";
import { signToken } from "../lib/jwt.js";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: "/",
};

const router: IRouter = Router();

const UpdatePreferencesBody = z.object({
  objective: z.string().optional(),
  persona: z.string().optional(),
  tone: z.string().optional(),
  brandRole: z.string().optional(),
  brandAudience: z.string().optional(),
  brandBelief: z.string().optional(),
  aboutMe: z.string().max(500).optional(),
  onboarded: z.boolean().optional(),
  brandBgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  brandAccentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  brandTextColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  backgroundTheme: z.enum(["none", "aurora", "matrix", "neural", "particles", "grid-pulse", "constellation", "topographic", "ink-wash", "neon-grid", "wave"]).optional(),
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
  if (parsed.data.aboutMe !== undefined) updateData.aboutMe = parsed.data.aboutMe;
  if (parsed.data.onboarded !== undefined) updateData.onboarded = parsed.data.onboarded;
  if (parsed.data.brandBgColor !== undefined) updateData.brandBgColor = parsed.data.brandBgColor;
  if (parsed.data.brandAccentColor !== undefined) updateData.brandAccentColor = parsed.data.brandAccentColor;
  if (parsed.data.brandTextColor !== undefined) updateData.brandTextColor = parsed.data.brandTextColor;
  if (parsed.data.backgroundTheme !== undefined) updateData.backgroundTheme = parsed.data.backgroundTheme;

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
  const allObjectives = ["Clients", "Job", "Authority", "Documenting", "Expert", "Hiring"];
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

router.get("/voice-suggestions", requireAuth, async (req, res): Promise<void> => {
  const suggestions = await db
    .select()
    .from(voiceSuggestionsTable)
    .where(and(
      eq(voiceSuggestionsTable.userId, req.user!.userId),
      eq(voiceSuggestionsTable.status, "pending"),
    ))
    .orderBy(desc(voiceSuggestionsTable.createdAt));
  res.json(suggestions);
});

router.patch("/voice-suggestions/:id/accept", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const userId = req.user!.userId;

  const [suggestion] = await db
    .select()
    .from(voiceSuggestionsTable)
    .where(and(eq(voiceSuggestionsTable.id, id), eq(voiceSuggestionsTable.userId, userId)))
    .limit(1);

  if (!suggestion) { res.status(404).json({ error: "Not found" }); return; }

  const ALLOWED_FIELDS = ["tone", "objective", "persona", "brandRole", "brandAudience", "brandBelief"] as const;
  type AllowedField = typeof ALLOWED_FIELDS[number];

  if (!ALLOWED_FIELDS.includes(suggestion.field as AllowedField)) {
    res.status(400).json({ error: `Invalid field: ${suggestion.field}. Allowed: ${ALLOWED_FIELDS.join(", ")}` });
    return;
  }

  await db
    .update(preferencesTable)
    .set({ [suggestion.field]: suggestion.suggestedValue })
    .where(eq(preferencesTable.userId, userId));

  const [updated] = await db
    .update(voiceSuggestionsTable)
    .set({ status: "accepted" })
    .where(eq(voiceSuggestionsTable.id, id))
    .returning();

  res.json(updated);
});

router.patch("/voice-suggestions/:id/dismiss", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [updated] = await db
    .update(voiceSuggestionsTable)
    .set({ status: "dismissed" })
    .where(and(
      eq(voiceSuggestionsTable.id, id),
      eq(voiceSuggestionsTable.userId, req.user!.userId),
    ))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

const UpdateAccountBody = z.object({
  displayName: z.string().min(1).max(80).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, "New password must be at least 8 characters").optional(),
}).refine(
  (d) => !d.newPassword || !!d.currentPassword,
  { message: "Current password is required to set a new password", path: ["currentPassword"] }
);

router.put("/user/account", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
    return;
  }

  const { displayName, currentPassword, newPassword } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.userId))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const updates: Record<string, unknown> = {};

  if (displayName !== undefined) {
    updates.displayName = displayName.trim();
  }

  if (newPassword) {
    const valid = await bcrypt.compare(currentPassword!, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }
    updates.passwordHash = await bcrypt.hash(newPassword, 12);
  }

  if (Object.keys(updates).length === 0) {
    res.json({ message: "Nothing to update" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, req.user!.userId))
    .returning();

  // Reissue the JWT so /auth/me immediately reflects any updated displayName
  const newToken = signToken({ userId: updated.id, email: updated.email, displayName: updated.displayName });
  res.cookie("brandos_token", newToken, COOKIE_OPTIONS);

  res.json({ id: updated.id, email: updated.email, displayName: updated.displayName });
});

export default router;
