import { Router, type IRouter } from "express";
import { z } from "zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { requireAuth } from "../middleware/auth.js";
import { aiRateLimit } from "../middleware/rate-limit.js";

const router: IRouter = Router();

const GenerateImagePromptBody = z.object({
  visualDescription: z.string().min(10).max(3000),
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

  const imagePrompt = `Professional LinkedIn visual for this concept: ${parsed.data.prompt}. Clean, modern, high-quality. No text overlays. No watermarks.`;

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
