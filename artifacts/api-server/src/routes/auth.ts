import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable, preferencesTable, loginEventsTable } from "@workspace/db";
import { signToken } from "../lib/jwt.js";
import { requireAuth } from "../middleware/auth.js";
import { isDemoUser } from "../lib/demo-content.js";

const router: IRouter = Router();

const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().min(1).max(80),
});

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: "/",
};

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
    return;
  }

  const { email, password, displayName } = parsed.data;

  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "An account with that email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db
    .insert(usersTable)
    .values({ email: email.toLowerCase(), passwordHash, displayName })
    .returning();

  await db.insert(preferencesTable).values({ userId: user.id });

  const token = signToken({ userId: user.id, email: user.email, displayName: user.displayName });
  res.cookie("brandos_token", token, COOKIE_OPTIONS);
  res.status(201).json({ id: user.id, email: user.email, displayName: user.displayName });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid email or password format" });
    return;
  }

  const { email, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "No account found with that email" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Incorrect password" });
    return;
  }

  const token = signToken({ userId: user.id, email: user.email, displayName: user.displayName });
  res.cookie("brandos_token", token, COOKIE_OPTIONS);
  // Track login event (fire-and-forget, never block the response)
  db.insert(loginEventsTable).values({ userId: user.id }).catch(() => {});
  res.json({ id: user.id, email: user.email, displayName: user.displayName });
});

router.get("/auth/me", requireAuth, (req, res): void => {
  const user = req.user!;
  res.json({ id: user.userId, email: user.email, displayName: user.displayName });
});

router.post("/auth/logout", (_req, res): void => {
  res.clearCookie("brandos_token", { path: "/" });
  res.sendStatus(204);
});

const ChangePasswordBody = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

router.post("/auth/change-password", requireAuth, async (req, res): Promise<void> => {
  if (isDemoUser(req.user!.email)) {
    res.status(403).json({ error: "Demo accounts cannot change their password." });
    return;
  }
  const parsed = ChangePasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
    return;
  }

  const { currentPassword, newPassword } = parsed.data;
  const userId = req.user!.userId;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, userId));

  res.sendStatus(204);
});

export default router;
