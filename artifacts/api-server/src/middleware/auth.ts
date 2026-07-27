import { Request, Response, NextFunction } from "express";
import { verifyToken, JwtPayload } from "../lib/jwt.js";
import { isBlocked } from "../lib/blocklist.js";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.brandos_token as string | undefined;
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }

  // Blocked users are rejected even with a valid session cookie
  if (isBlocked(payload.userId)) {
    res.status(403).json({ error: "This account has been blocked. Contact support." });
    return;
  }

  req.user = payload;
  next();
}
