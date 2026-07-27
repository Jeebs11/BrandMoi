import { Router, type IRouter } from "express";
import multer from "multer";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { requireAuth } from "../middleware/auth.js";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "application/msword",
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(pdf|docx|txt|doc)$/i)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type. Please upload a PDF, Word document, or text file."));
    }
  },
});

async function extractText(buffer: Buffer, mimetype: string, filename: string): Promise<string> {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  if (mimetype === "application/pdf" || ext === "pdf") {
    // Import from the inner lib path to bypass index.js which tries to read
    // a test file (./test/data/05-versions-space.pdf) relative to process.cwd()
    const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js") as { default: (buf: Buffer) => Promise<{ text: string }> };
    const result = await pdfParse(buffer);
    return result.text;
  }

  if (
    mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimetype === "application/msword" ||
    ext === "docx" ||
    ext === "doc"
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  return buffer.toString("utf-8");
}

export type ExtractedBrandVoice = {
  brandRole: string;
  brandAudience: string;
  brandBelief: string;
  objective: string;
  persona: string;
  tone: string;
  summary: string;
  contentPillars: string[];
  proofPoints: string[];
  firstPostAngles: string[];
};

router.post(
  "/user/extract-brand-voice",
  requireAuth,
  upload.single("document"),
  async (req, res): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded." });
      return;
    }

    let rawText: string;
    try {
      rawText = await extractText(req.file.buffer, req.file.mimetype, req.file.originalname);
    } catch (err) {
      console.error("[smart-import] extractText failed:", err);
      res.status(422).json({ error: "Could not read this file. Try a PDF or plain text document." });
      return;
    }

    const truncated = rawText.slice(0, 15000);

    if (truncated.trim().length < 100) {
      res.status(422).json({ error: "The document appears to be empty or unreadable." });
      return;
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: `You extract professional brand voice data from documents. Always return valid JSON only — no markdown, no explanation. Be concise and specific. Map all values to the exact allowed options listed.`,
      messages: [
        {
          role: "user",
          content: `Read this professional document and extract the person's brand voice for LinkedIn content creation.

Document:
${truncated}

Return this exact JSON (no markdown, no commentary):
{
  "brandRole": "One sentence describing their professional role and what they do",
  "brandAudience": "Specific description of who they help or who they're targeting",
  "brandBelief": "An opinionated, slightly contrarian professional stance this person would defend in public — NOT a value proposition or mission statement",
  "objective": "One of: Clients, Job, Authority, Documenting, Expert, Hiring",
  "persona": "One of: Operator, Founder, Career, Technical, Sales",
  "tone": "One of: Direct, Story, Educational, Bold",
  "summary": "2-3 sentences describing how this person should come across on LinkedIn — their distinctive expertise and what makes their perspective worth following",
  "contentPillars": ["pillar 1", "pillar 2", "pillar 3"],
  "proofPoints": ["proof point 1", "proof point 2"],
  "firstPostAngles": ["angle 1", "angle 2", "angle 3"]
}

Rules:
- objective: Choose "Job" if this is a CV/resume, "Clients" if it's a business/service document, "Expert" if it's thought leadership or industry analysis, "Authority" if it's personal brand/story content, "Hiring" if focused on team building or employer brand
- persona: Choose the closest match based on their role
- tone: Infer from the document's writing style if it contains posts/articles; for CVs and resumes default to "Direct" (a CV's style says nothing about post-writing voice)
- summary: write for content positioning, never recruiter-speak — do NOT mention job seeking, availability, or "looking for a role" even when the document is a CV
- brandBelief: derive from what their career choices imply they believe. Good: "Most transformations fail because governance is bolted on after the fact, not designed in." Bad: "Delivering value through structured frameworks."
- Keep brandRole under 120 characters
- Keep brandAudience under 120 characters
- Keep brandBelief under 150 characters
- contentPillars: Extract 3-4 distinct recurring themes or topics this person writes about or is known for (e.g. "Leadership & team culture", "SaaS growth strategy", "Career transitions in tech"). Each pillar max 40 characters. These should reflect the person's actual content themes, not generic categories.
- proofPoints: Extract 6-8 of the most concrete, quantified achievements from the document — each must contain a real number, name, scale, or timeframe taken from the document (budget figures, team sizes, programme names, % outcomes, durations). One sentence each, max 140 characters. These become specificity anchors for future posts. Never invent numbers.
- firstPostAngles: 3 ready-to-write LinkedIn post angles drawn from real moments in this document — a specific decision, turnaround, client result, lesson, or contrarian observation their experience supports. Each max 15 words, phrased as the seed of a post (e.g. "The governance mistake that nearly sank a $30m programme"). Not generic topics.`,
        },
      ],
    });

    const text = message.content[0];
    if (text.type !== "text") {
      res.status(500).json({ error: "Unexpected AI response." });
      return;
    }

    let extracted: ExtractedBrandVoice;
    try {
      const cleaned = text.text.replace(/```json/g, "").replace(/```/g, "").trim();
      extracted = JSON.parse(cleaned) as ExtractedBrandVoice;
    } catch {
      res.status(500).json({ error: "Could not parse AI response. Please try again." });
      return;
    }

    const VALID_OBJECTIVES = ["Clients", "Job", "Authority", "Documenting", "Expert", "Hiring"];
    const VALID_PERSONAS = ["Operator", "Founder", "Career", "Technical", "Sales"];
    const VALID_TONES = ["Direct", "Story", "Educational", "Bold"];

    if (!VALID_OBJECTIVES.includes(extracted.objective)) extracted.objective = "Authority";
    if (!VALID_PERSONAS.includes(extracted.persona)) extracted.persona = "Founder";
    if (!VALID_TONES.includes(extracted.tone)) extracted.tone = "Direct";
    if (!Array.isArray(extracted.contentPillars)) extracted.contentPillars = [];
    if (!Array.isArray(extracted.proofPoints)) extracted.proofPoints = [];
    extracted.proofPoints = extracted.proofPoints.filter((p) => typeof p === "string" && p.trim()).slice(0, 8);
    if (!Array.isArray(extracted.firstPostAngles)) extracted.firstPostAngles = [];
    extracted.firstPostAngles = extracted.firstPostAngles.filter((a) => typeof a === "string" && a.trim()).slice(0, 3);

    res.json(extracted);
  }
);

export default router;
