import { Router, type IRouter } from "express";
import { z } from "zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { requireAuth } from "../middleware/auth.js";
import { aiRateLimit } from "../middleware/rate-limit.js";
import { isDemoUser } from "../lib/demo-content.js";

const router: IRouter = Router();

const GenerateImagePromptBody = z.object({
  visualDescription: z.string().min(10).max(3000),
});

// ── Illustration concept ────────────────────────────────────────────────────

const STYLE_WRAPPERS: Record<string, string> = {
  cartoon:
    "Traditional Saturday-morning cartoon illustration, bold thick black outlines, vibrant saturated flat colours (bright reds, blues, yellows, greens), classic comic-strip energy, cheerful and expressive characters, colourful background",
  "new-yorker":
    "Classic New Yorker magazine single-panel cartoon, pure black-and-white pen-and-ink illustration, expressive fine-line cross-hatching, white paper background, no colour, no grey tones, witty editorial scene composition",
  isometric:
    "3D isometric illustration, flat vibrant colours, clean geometric shapes, modern professional style, light background",
  "loose-pencil":
    "Loose, expressive hand-drawn pencil illustration on off-white paper, confident sketchy line work with visible graphite texture, occasional warm accent wash (single muted colour), soft handwritten signage and labels welcome — render any text in a casual handwritten serif",
};

// Backwards-compatibility map for legacy persisted styles.
const LEGACY_STYLE_REMAP: Record<string, string> = {
  sketch: "new-yorker",
  blueprint: "new-yorker",
  vintage: "new-yorker",
};

function sceneContainsText(scene: string): boolean {
  const lower = scene.toLowerCase();
  return (
    lower.includes("speech bubble") ||
    lower.includes("speech-bubble") ||
    lower.includes("saying") ||
    lower.includes(" says ") ||
    lower.includes("caption") ||
    lower.includes("label") ||
    lower.includes("sign saying") ||
    lower.includes("text saying") ||
    lower.includes("words ") ||
    /['"]/.test(scene)
  );
}

const ILLUSTRATION_CONCEPT_SYSTEM = `You are a creative director making the single visual that will stop a feed for this LinkedIn post.

What you do:
1. Devise the strongest possible scene to carry the post's core insight — pick whichever angle gives the highest stopping power.
2. Write a 1–2 line caption that lands the punchline (single observation, dialogue, or sign text — your call).
3. Follow the style instruction provided.

CLICHÉ-TROPE BAN — these are off-limits regardless of the topic:
- No cranes, scaffolding, hard hats, blueprints, cardboard boxes labelled "team", brick walls being built.
- No light bulbs as ideas, no chess pieces as strategy, no jigsaw puzzles being completed, no rocket launches, no mountain summits with flags, no handshakes over conference tables.
- No glossy stock-photo polish — these are illustrations, not corporate photography. No suits in boardrooms unless the post is literally about a boardroom.

Beyond that: literal scenes are fine. If the strongest visual IS a builder fixing a roof, a kitchen at 3am, or a single sign on a roadside — go with it. Surprise and specificity win over cleverness for its own sake.

Return ONLY valid JSON, no markdown fences, no explanation:
{
  "scenePrompt": "Concise DALL-E 3 scene description — max 220 characters, describes ONLY the visual. If the scene benefits from a speech bubble, sign, or label with short text, include the exact words in quotes. Otherwise specify NO text, letters, or words in the image.",
  "caption": "The 1–2 line caption displayed BELOW the illustration.",
  "chosenStyle": "Name of the illustration style used."
}`;

const GenerateIllustrationConceptBody = z.object({
  postContent: z.string().min(10).max(5000),
  style: z.string().min(1).max(50),
  audience: z.string().optional(),
  feeling: z.string().optional(),
});

router.post("/ai/generate-illustration-concept", requireAuth, aiRateLimit, async (req, res): Promise<void> => {
  if (isDemoUser(req.user?.email)) {
    res.status(403).json({ error: "Image generation is not available in demo mode. Sign up to unlock it." });
    return;
  }

  const parsed = GenerateIllustrationConceptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Post content is required." });
    return;
  }

  const { postContent, style, audience, feeling } = parsed.data;

  const styleInstruction =
    style === "surprise"
      ? "Choose the most impactful illustration style for this post from: Cartoon (bold flat colour Saturday-morning energy), New Yorker (black-and-white pen-and-ink), Isometric (3D flat-colour technical), Loose Pencil (sketchy hand-drawn graphite with handwritten signage)."
      : `Use this illustration style: ${style}. Match the scenePrompt description to that style.`;

  const audienceLine = audience ? `\nThis post is aimed at: ${audience}. The visual must speak to that exact audience.` : "";
  const feelingLine = feeling ? `\nThe post's feeling is: ${feeling}. The image should land with the same emotional register.` : "";

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system: `${ILLUSTRATION_CONCEPT_SYSTEM}\n\nStyle instruction: ${styleInstruction}${audienceLine}${feelingLine}`,
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
  if (isDemoUser(req.user?.email)) {
    res.status(403).json({ error: "Image generation is not available in demo mode. Sign up to unlock it." });
    return;
  }

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
  if (isDemoUser(req.user?.email)) {
    res.status(403).json({ error: "Image generation is not available in demo mode. Sign up to unlock it." });
    return;
  }

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
    const resolveStyleKey = (style: string): string => {
      const lower = style.toLowerCase().trim();
      const remapped = LEGACY_STYLE_REMAP[lower];
      if (remapped) return remapped;
      if (STYLE_WRAPPERS[lower]) return lower;
      for (const word of lower.split(/[\s_-]+/)) {
        if (LEGACY_STYLE_REMAP[word]) return LEGACY_STYLE_REMAP[word];
        if (STYLE_WRAPPERS[word]) return word;
      }
      for (const key of Object.keys(STYLE_WRAPPERS)) {
        if (lower.includes(key)) return key;
      }
      return "";
    };
    const styleKey = resolveStyleKey(illustrationStyle ?? "");
    const stylePrefix = STYLE_WRAPPERS[styleKey]
      ?? "Creative editorial illustration, professional quality, white background";
    const hasText = sceneContainsText(prompt);
    const noTextSuffix = hasText
      ? "Render any speech bubbles or labels exactly as described. No extra unspecified text."
      : "Absolutely no text, words, or letters visible in the image.";
    imagePrompt = `${stylePrefix}. Scene: ${prompt}. ${noTextSuffix}`;
  } else {
    imagePrompt = `Professional LinkedIn visual for this concept: ${prompt}. Clean, modern, high-quality. No text overlays. No watermarks.`;
  }

  try {
    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt: imagePrompt,
      n: 1,
      size: "1024x1024",
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

const EditSceneBody = z.object({
  currentScene: z.string().min(5).max(1000),
  editRequest: z.string().min(3).max(500),
});

router.post("/ai/edit-scene", requireAuth, aiRateLimit, async (req, res): Promise<void> => {
  if (isDemoUser(req.user?.email)) {
    res.status(403).json({ error: "Image generation is not available in demo mode. Sign up to unlock it." });
    return;
  }

  const parsed = EditSceneBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Current scene and edit request are required." });
    return;
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      system: `You are editing a DALL-E 3 image scene description.
Apply the user's requested change to the scene while preserving all other elements exactly as they are.
Keep the revised scene concise (max 220 characters if possible).
If the change mentions speech bubbles or specific text to be rendered in the image, include the exact quoted words.
Return ONLY the revised scene description — no explanation, no surrounding quotes.`,
      messages: [{ role: "user", content: `Current scene: ${parsed.data.currentScene}\n\nChange to apply: ${parsed.data.editRequest}` }],
    });

    const text = message.content[0];
    if (text.type !== "text") {
      res.status(500).json({ error: "Unexpected AI response." });
      return;
    }

    res.json({ revisedScene: text.text.trim() });
  } catch (err: unknown) {
    console.error("[ai-edit-scene] failed:", err);
    res.status(500).json({ error: "Failed to apply edit. Please try again." });
  }
});

export default router;
