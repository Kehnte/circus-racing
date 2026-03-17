import type { Request, Response, NextFunction } from "express";
type MiddlewareFn = (req: Request, res: Response, next: NextFunction) => void;
/** Only ADMIN */
export declare const requireAdmin: MiddlewareFn[];
/** ADMIN or MODERATOR */
export declare const requireModo: MiddlewareFn[];
/** ADMIN, MODERATOR, or PILOT (any authenticated user) */
export declare const requirePilot: MiddlewareFn[];
export {};
//# sourceMappingURL=roles.d.ts.map