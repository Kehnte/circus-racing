// auth.ts — JWT authentication middleware (extracts user from Bearer token).
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/db.js";
import { pilot, type PilotRole } from "../db/schema.js";

export interface AuthUser {
  id: string;
  role: PilotRole;
  tokenVersion?: number;
}

// Extends Express Request with the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * requireAuth — verifies the JWT and checks tokenVersion against the DB.
 * Attaches req.user = { id, role } on success, returns 401 otherwise.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = header.slice(7);
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");

  let payload: AuthUser;
  try {
    payload = jwt.verify(token, secret) as AuthUser;
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  // Verify tokenVersion to detect revoked tokens (e.g. after admin password reset).
  db.select({ tokenVersion: pilot.tokenVersion })
    .from(pilot)
    .where(eq(pilot.id, payload.id))
    .get()
    .then((found) => {
      if (!found) { res.status(401).json({ error: "Account not found" }); return; }
      if (payload.tokenVersion !== undefined && found.tokenVersion !== payload.tokenVersion) {
        res.status(401).json({ error: "Session expired" });
        return;
      }
      req.user = { id: payload.id, role: payload.role };
      next();
    })
    .catch(() => { res.status(500).json({ error: "Auth check failed" }); });
}

/**
 * Generates a signed JWT for a pilot, embedding tokenVersion for revocation support.
 */
export function signToken(payload: AuthUser & { tokenVersion: number }): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return jwt.sign(payload, secret, { expiresIn: "30d" });
}
