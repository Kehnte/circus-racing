import type { Request, Response, NextFunction } from "express";
import { requireAuth } from "./auth.js";

type MiddlewareFn = (req: Request, res: Response, next: NextFunction) => void;

function requireRole(...roles: string[]): MiddlewareFn[] {
  return [
    requireAuth,
    (req: Request, res: Response, next: NextFunction) => {
      if (!req.user || !roles.includes(req.user.role)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      next();
    },
  ];
}

/** Only ADMIN */
export const requireAdmin = requireRole("ADMIN");

/** ADMIN or MODERATOR */
export const requireModo = requireRole("ADMIN", "MODERATOR");

/** ADMIN, MODERATOR, or PILOT (any authenticated user) */
export const requirePilot = requireRole("ADMIN", "MODERATOR", "PILOT");
