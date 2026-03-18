import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import userRouter from "./user.js";
import aiRouter from "./ai.js";
import draftsRouter from "./drafts.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(userRouter);
router.use(aiRouter);
router.use(draftsRouter);

export default router;
