import { Router, type IRouter } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getVoiceProfile } from "../lib/voice-profile.js";

const router: IRouter = Router();

// Measured shape of the author's writing: average, best-performing posts,
// hand-written baseline, and how AI-assisted posts drift from it. Rule-based.
router.get("/user/voice-profile", requireAuth, async (req, res): Promise<void> => {
  res.json(await getVoiceProfile(req.user!.userId));
});

export default router;
