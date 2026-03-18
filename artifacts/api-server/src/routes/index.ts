import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import aiRouter from "./ai.js";
import draftsRouter from "./drafts.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(aiRouter);
router.use(draftsRouter);

export default router;
