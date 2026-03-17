import type { Request, Response, NextFunction } from "express";
import type { PilotRole } from "../db/schema.js";
export interface AuthUser {
    id: string;
    role: PilotRole;
}
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
export declare function requireAuth(req: Request, res: Response, next: NextFunction): void;
/**
 * Generates a signed JWT for a pilot.
 */
export declare function signToken(payload: AuthUser): string;
//# sourceMappingURL=auth.d.ts.map