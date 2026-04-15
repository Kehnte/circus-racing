// auth.ts — JWT and device-token authentication middleware.
import jwt from "jsonwebtoken";
import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/db.js";
import { pilot, deviceToken, type PilotRole } from "../db/schema.js";

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
 * requireAuth — accepts either a pilot JWT or a device token (Bearer prefix).
 * Device tokens are recognised by their SHA-256 hash stored in device_token table.
 * On success attaches req.user = { id, role } and calls next().
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const raw    = header.slice(7);
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");

  // Try JWT first
  let payload: AuthUser | null = null;
  try {
    payload = jwt.verify(raw, secret) as AuthUser;
  } catch { /* not a JWT — may be a device token */ }

  if (payload) {
    db.select({ tokenVersion: pilot.tokenVersion })
      .from(pilot)
      .where(eq(pilot.id, payload.id))
      .get()
      .then((found) => {
        if (!found) { res.status(401).json({ error: "Account not found" }); return; }
        if (payload!.tokenVersion !== undefined && found.tokenVersion !== payload!.tokenVersion) {
          res.status(401).json({ error: "Session expired" });
          return;
        }
        req.user = { id: payload!.id, role: payload!.role };
        next();
      })
      .catch(() => { res.status(500).json({ error: "Auth check failed" }); });
    return;
  }

  // Fall back to device token (SHA-256 hash lookup)
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  db.select({ id: deviceToken.id })
    .from(deviceToken)
    .where(eq(deviceToken.tokenHash, hash))
    .get()
    .then((found) => {
      if (!found) { res.status(401).json({ error: "Invalid token" }); return; }
      req.user = { id: `device:${found.id}`, role: "MODERATOR" as PilotRole };
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
