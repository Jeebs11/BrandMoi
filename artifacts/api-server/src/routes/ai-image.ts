import { Router, type IRouter } from "express";
import { z } from "zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { requireAuth } from "../middleware/auth.js";
import { aiRateLimit } from "../middleware/rate-limit.js";

const router: IRouter = Router();

const GenerateImagePromptBody = z.object({
  visualDescription: z.string().min(10).max(3000),
});

// ── Illustration concept ────────────────────────────────────────────────────

const STYLE_WRAPPERS: Record<string, string> = {
  cartoon:
    "Single-panel editorial cartoon, clean black ink line art on white background, New Yorker magazine pen-and-ink style, no text or lettering in the image, detailed cross-hatching",
  isometric:
    "3D isometric illustration, flat vibrant colours, clean geometric shapes, modern professional style, light background, no text in the image",
  sketch:
    "Hand-drawn whiteboard sketch, rough expressive pencil-marker lines, monochrome, white background, thought-leadership illustration, no text in the image",
  blueprint:
    "Technical blueprint illustration, precise white line art on deep blue background (#0a2a5e), architectural drawing style, clean geometric forms, no text in the image",
  vintage:
    "Vintage 1950s mid-century editorial poster illustration, bold graphic shapes, limited warm colour palette, retro print style, no text in the image",
};

const ILLUSTRATION_CONCEPT_SYSTEM = `You are a creative director specialising in single-panel editorial illustrations for LinkedIn. Given a LinkedIn post, you will:
1. Devise a strong visual metaphor or scene that captures the post's core insight — think New Yorker cartoon energy.
2. Write a witty 1–2 line caption (can be dialogue between two characters, or a single sharp observation).
3. Follow the style instruction provided.

Return ONLY valid JSON, no markdown fences, no explanation:
{
  "scenePrompt": "Concise DALL-E 3 scene description — max 200 characters, describes ONLY the visual. NO text, letters, or words should appear in the image.",
  "caption": "The witty 1–2 line caption displayed BELOW the illustration.",
  "chosenStyle": "Name of the illustration style used."
}`;

const GenerateIllustrationConceptBody = z.object({
  postContent: z.string().min(10).max(5000),
  style: z.string().min(1).max(50),
});

router.post("/ai/generate-illustration-concept", requireAuth, aiRateLimit, async (req, res): Promise<void> => {
  const parsed = GenerateIllustrationConceptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Post content is required." });
    return;
  }

  const { postContent, style } = parsed.data;

  const styleInstruction =
    style === "surprise"
      ? "Choose the most creative and impactful illustration style for this post. You may pick from Editorial Cartoon, Isometric, Whiteboard Sketch, Blueprint, Vintage Poster — or invent a completely different style if it better suits the content."
      : `Use this illustration style: ${style}. Match the scenePrompt description to that style.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system: `${ILLUSTRATION_CONCEPT_SYSTEM}\n\nStyle instruction: ${styleInstruction}`,
      messages: [{ role: "user", content: `LinkedIn post:\n\n${postContent}` }],
    });

    const text = message.content[0];
    if (text.type !== "text") {
      res.status(500).json({ error: "Unexpected AI response." });
      return;
    }

    const cleaned = text.text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const result = JSON.parse(cleaned) as { scenePrompt: string; caption: string; chosenStyle: string };
    res.json(result);
  } catch (err: unknown) {
    console.error("[ai-illustration-concept] failed:", err);
    res.status(500).json({ error: "Failed to generate illustration concept. Please try again." });
  }
});

router.post("/ai/generate-image-prompt", requireAuth, aiRateLimit, async (req, res): Promise<void> => {
  const parsed = GenerateImagePromptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A visual description of at least 10 characters is required." });
    return;
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 200,
      system: "You are a visual creative director specialising in LinkedIn content imagery. Distil the given visual brief into a single crisp DALL-E 3 image prompt. Rules: max 160 characters, describe only the visual concept + style + mood, no text overlays in the image, professional photography or clean illustration style. Output the prompt only — no explanation, no quotes, no punctuation at the end.",
      messages: [{ role: "user", content: parsed.data.visualDescription }],
    });

    const text = message.content[0];
    if (text.type !== "text") {
      res.status(500).json({ error: "Unexpected AI response." });
      return;
    }

    res.json({ imagePrompt: text.text.trim() });
  } catch (err: unknown) {
    console.error("[ai-image-prompt] failed:", err);
    res.status(500).json({ error: "Failed to generate image prompt. Please try again." });
  }
});

const GenerateImageBody = z.object({
  prompt: z.string().min(10).max(2000),
  mode: z.enum(["photo", "illustration"]).optional().default("photo"),
  illustrationStyle: z.string().optional(),
});

router.post("/ai/generate-image", requireAuth, aiRateLimit, async (req, res): Promise<void> => {
  if (!process.env.OPENAI_API_KEY) {
    res.status(503).json({
      error: "Image generation is not configured. Add an OPENAI_API_KEY secret to enable this feature.",
    });
    return;
  }

  const parsed = GenerateImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A prompt of at least 10 characters is required." });
    return;
  }

  const { default: OpenAI } = await import("openai");
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const { prompt, mode, illustrationStyle } = parsed.data;
  let imagePrompt: string;
  if (mode === "illustration") {
    const styleKey = (illustrationStyle ?? "").toLowerCase().split(" ")[0];
    const stylePrefix = STYLE_WRAPPERS[styleKey]
      ?? "Creative editorial illustration, professional quality, white background, no text in the image";
    imagePrompt = `${stylePrefix}. Scene: ${prompt}. Absolutely no text, words, or letters visible in the image.`;
  } else {
    imagePrompt = `Professional LinkedIn visual for this concept: ${prompt}. Clean, modern, high-quality. No text overlays. No watermarks.`;
  }

  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: imagePrompt,
      n: 1,
      size: "1024x1024",
      response_format: "b64_json",
    });

    const imageData = Array.isArray(response.data) ? response.data[0] : undefined;
    const b64 = imageData?.b64_json;
    if (!b64) {
      res.status(500).json({ error: "No image data returned from generation service." });
      return;
    }

    res.json({ imageBase64: b64 });
  } catch (err: unknown) {
    console.error("[ai-image] generation failed:", err);
    const message =
      err instanceof Error ? err.message : "Image generation failed. Please try again.";
    res.status(500).json({ error: message });
  }
});

export default router;
