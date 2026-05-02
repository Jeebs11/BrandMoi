import type { Request, Response, NextFunction } from "express";

const ADMIN_EMAIL = "odmlawal@gmail.com";

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.email !== ADMIN_EMAIL) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}
