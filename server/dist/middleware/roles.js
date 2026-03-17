"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePilot = exports.requireModo = exports.requireAdmin = void 0;
const auth_js_1 = require("./auth.js");
function requireRole(...roles) {
    return [
        auth_js_1.requireAuth,
        (req, res, next) => {
            if (!req.user || !roles.includes(req.user.role)) {
                res.status(403).json({ error: "Forbidden" });
                return;
            }
            next();
        },
    ];
}
/** Only ADMIN */
exports.requireAdmin = requireRole("ADMIN");
/** ADMIN or MODERATOR */
exports.requireModo = requireRole("ADMIN", "MODERATOR");
/** ADMIN, MODERATOR, or PILOT (any authenticated user) */
exports.requirePilot = requireRole("ADMIN", "MODERATOR", "PILOT");
//# sourceMappingURL=roles.js.map