import { Router, type IRouter } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { aiRateLimit } from "../middleware/rate-limit.js";

const router: IRouter = Router();

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
