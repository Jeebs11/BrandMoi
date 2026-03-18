import type { Request, Response, NextFunction } from "express";

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const store = new Map<string, RateLimitEntry>();
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 10;

export function aiRateLimit(req: Request, res: Response, next: NextFunction): void {
  const userId = req.user?.userId;
  if (!userId) {
    next();
    return;
  }

  const key = String(userId);
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    store.set(key, { count: 1, windowStart: now });
    next();
    return;
  }

  if (entry.count >= MAX_REQUESTS) {
    res.status(429).json({ error: "Too many AI requests. Please wait a moment." });
    return;
  }

  entry.count++;
  next();
}
