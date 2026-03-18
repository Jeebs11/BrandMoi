import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db } from "@workspace/db";
import { preferencesTable } from "@workspace/db";
import {
  StructureIdeaBody,
  StructureIdeaResponse,
  GenerateContentBody,
  GenerateContentResponse,
  RefineContentBody,
  RefineContentResponse,
} from "@workspace/api-zod";
import {
  buildBrandContext,
  STRUCTURE_SYSTEM_PROMPT,
  GENERATE_SYSTEM_PROMPT,
  REFINE_SYSTEM_PROMPT,
} from "../lib/ai-prompts.js";
import { requireAuth } from "../middleware/auth.js";

const router: IRouter = Router();

async function getUserBrandContext(userId: number): Promise<string> {
  const [prefs] = await db
    .select()
    .from(preferencesTable)
    .where(eq(preferencesTable.userId, userId))
    .limit(1);

  if (!prefs) return "";
  return `Brand voice:\n- Role: ${prefs.brandRole}\n- Audience: ${prefs.brandAudience}\n- Belief: ${prefs.brandBelief}`;
}

router.post("/ai/structure", requireAuth, async (req, res): Promise<void> => {
  const parsed = StructureIdeaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { rawInput, objective, persona, tone } = parsed.data;
  const brandContext = buildBrandContext(objective, persona, tone);
  const voiceContext = await getUserBrandContext(req.user!.userId);

  const userMessage = `Raw thought: ${rawInput}

${brandContext}
${voiceContext ? `\n${voiceContext}` : ""}

Return this exact JSON shape (no markdown fences):
{
  "topic": "",
  "angle": "",
  "coreMessage": "",
  "whyItMatters": "",
  "hooks": ["", "", ""],
  "narrativeFlow": ["", "", "", ""]
}`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: STRUCTURE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = message.content[0];
  if (text.type !== "text") {
    res.status(500).json({ error: "Unexpected AI response type" });
    return;
  }

  let parsed2: unknown;
  try {
    parsed2 = JSON.parse(text.text);
  } catch {
    res.status(500).json({ error: "AI returned invalid JSON" });
    return;
  }

  const validated = StructureIdeaResponse.safeParse(parsed2);
  if (!validated.success) {
    res.status(500).json({ error: "AI response did not match expected shape" });
    return;
  }

  res.json(validated.data);
});

router.post("/ai/generate", requireAuth, async (req, res): Promise<void> => {
  const parsed = GenerateContentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { rawInput, objective, persona, tone, structure, selectedHook } = parsed.data;
  const brandContext = buildBrandContext(objective, persona, tone);
  const voiceContext = await getUserBrandContext(req.user!.userId);

  const userMessage = `Create LinkedIn content based on this structure:

Raw thought: ${rawInput}
${brandContext}
${voiceContext ? `\n${voiceContext}` : ""}

Structure:
- Topic: ${structure.topic}
- Angle: ${structure.angle}
- Core Message: ${structure.coreMessage}
- Why It Matters: ${structure.whyItMatters}
- Selected Hook: ${selectedHook}
- Narrative Flow: ${structure.narrativeFlow.join(" → ")}

Return this exact JSON shape (no markdown fences):
{
  "post": "",
  "carousel": [{"slide": 1, "title": "", "description": ""}],
  "visual": ""
}`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: GENERATE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = message.content[0];
  if (text.type !== "text") {
    res.status(500).json({ error: "Unexpected AI response type" });
    return;
  }

  let parsed2: unknown;
  try {
    parsed2 = JSON.parse(text.text);
  } catch {
    res.status(500).json({ error: "AI returned invalid JSON" });
    return;
  }

  const validated = GenerateContentResponse.safeParse(parsed2);
  if (!validated.success) {
    res.status(500).json({ error: "AI response did not match expected shape" });
    return;
  }

  res.json(validated.data);
});

router.post("/ai/refine", requireAuth, async (req, res): Promise<void> => {
  const parsed = RefineContentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { content, instruction, tab } = parsed.data;

  const userMessage = `Refine this ${tab} content:

${content}

Instruction: ${instruction}

Return this exact JSON shape (no markdown fences):
{"content": ""}`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: REFINE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = message.content[0];
  if (text.type !== "text") {
    res.status(500).json({ error: "Unexpected AI response type" });
    return;
  }

  let parsed2: unknown;
  try {
    parsed2 = JSON.parse(text.text);
  } catch {
    res.status(500).json({ error: "AI returned invalid JSON" });
    return;
  }

  const validated = RefineContentResponse.safeParse(parsed2);
  if (!validated.success) {
    res.status(500).json({ error: "AI response did not match expected shape" });
    return;
  }

  res.json(validated.data);
});

export default router;
