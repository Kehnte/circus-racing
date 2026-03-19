// auth.ts — JWT authentication middleware (extracts user from Bearer token).
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import type { PilotRole } from "../db/schema.js";

export interface AuthUser {
  id: string;
  role: PilotRole;
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
 * requireAuth — verifies the JWT from Authorization: Bearer <token>
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

  try {
    const payload = jwt.verify(token, secret) as AuthUser;
    req.user = { id: payload.id, role: payload.role };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * Generates a signed JWT for a pilot.
 */
export function signToken(payload: AuthUser): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return jwt.sign(payload, secret, { expiresIn: "30d" });
}
