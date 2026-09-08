import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import userRouter from "./user.js";
import aiRouter from "./ai.js";
import draftsRouter from "./drafts.js";
import thoughtsRouter from "./thoughts.js";
import momentumRouter from "./momentum.js";
import smartImportRouter from "./smart-import.js";
import aiImageRouter from "./ai-image.js";
import agentRouter from "./agent.js";
import linkedinRouter from "./linkedin.js";
import adminRouter from "./admin.js";
import topicsRouter from "./topics.js";
import seriesRouter from "./series.js";
import profileAlignmentRouter from "./profile-alignment.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(userRouter);
router.use(aiRouter);
router.use(aiImageRouter);
router.use(draftsRouter);
router.use(thoughtsRouter);
router.use(momentumRouter);
router.use(smartImportRouter);
router.use(agentRouter);
router.use(linkedinRouter);
router.use(topicsRouter);
router.use(seriesRouter);
router.use(profileAlignmentRouter);
router.use(adminRouter);

export default router;
