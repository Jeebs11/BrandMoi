import { Router, type IRouter } from "express";
import { requireAuth } from "../middleware/auth.js";
import { computeMomentum } from "../lib/momentum.js";

const router: IRouter = Router();

router.get("/momentum", requireAuth, async (req, res): Promise<void> => {
  const data = await computeMomentum(req.user!.userId);
  res.json(data);
});

export default router;
