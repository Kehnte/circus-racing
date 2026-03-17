"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("@node-rs/bcrypt"));
const crypto_1 = __importDefault(require("crypto"));
const drizzle_orm_1 = require("drizzle-orm");
const db_js_1 = require("../db/db.js");
const schema_js_1 = require("../db/schema.js");
const auth_js_1 = require("../middleware/auth.js");
const auth_js_2 = require("../middleware/auth.js");
const router = (0, express_1.Router)();
const SALT_ROUNDS = 12;
/**
 * POST /auth/register
 * Body: { displayName, email, password, country?, avatarUrl?, teamId?, vehicleId?, controlsId? }
 */
router.post("/register", async (req, res) => {
    const { displayName, email, password, country, avatarUrl, teamId, vehicleId, controlsId } = req.body;
    if (!displayName || !email || !password) {
        res.status(400).json({ error: "displayName, email and password are required" });
        return;
    }
    // Check uniqueness
    const existing = await db_js_1.db.select({ id: schema_js_1.pilot.id })
        .from(schema_js_1.pilot)
        .where((0, drizzle_orm_1.eq)(schema_js_1.pilot.email, email))
        .get();
    if (existing) {
        res.status(409).json({ error: "Email already in use" });
        return;
    }
    const existingName = await db_js_1.db.select({ id: schema_js_1.pilot.id })
        .from(schema_js_1.pilot)
        .where((0, drizzle_orm_1.eq)(schema_js_1.pilot.displayName, displayName))
        .get();
    if (existingName) {
        res.status(409).json({ error: "Display name already taken" });
        return;
    }
    const passwordHash = await bcrypt_1.default.hash(password, SALT_ROUNDS);
    const token = generateOcrToken();
    // First pilot ever becomes ADMIN automatically
    const count = await db_js_1.db.select({ id: schema_js_1.pilot.id }).from(schema_js_1.pilot).all();
    const role = count.length === 0 ? "ADMIN" : "PILOT";
    const [created] = await db_js_1.db.insert(schema_js_1.pilot).values({
        displayName,
        email,
        passwordHash,
        role,
        token,
        country: country ?? "un",
        avatarUrl: avatarUrl ?? null,
        teamId: teamId ?? null,
        vehicleId: vehicleId ?? null,
        controlsId: controlsId ?? null,
    }).returning();
    const jwt = (0, auth_js_1.signToken)({ id: created.id, role: created.role });
    res.status(201).json({
        token: jwt,
        ocrToken: created.token,
        pilot: safePublic(created),
    });
});
/**
 * POST /auth/login
 * Body: { email, password }
 */
router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        res.status(400).json({ error: "email and password are required" });
        return;
    }
    const found = await db_js_1.db.select().from(schema_js_1.pilot).where((0, drizzle_orm_1.eq)(schema_js_1.pilot.email, email)).get();
    if (!found) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
    }
    const match = await bcrypt_1.default.compare(password, found.passwordHash);
    if (!match) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
    }
    const jwt = (0, auth_js_1.signToken)({ id: found.id, role: found.role });
    res.json({
        token: jwt,
        ocrToken: found.token,
        pilot: safePublic(found),
    });
});
/**
 * POST /auth/regenerate-token
 * Regenerates the OCR token for the authenticated pilot.
 */
router.post("/regenerate-token", ...[auth_js_2.requireAuth], async (req, res) => {
    const newToken = generateOcrToken();
    await db_js_1.db.update(schema_js_1.pilot).set({ token: newToken }).where((0, drizzle_orm_1.eq)(schema_js_1.pilot.id, req.user.id));
    res.json({ ocrToken: newToken });
});
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function generateOcrToken() {
    return crypto_1.default.randomBytes(32).toString("hex");
}
function safePublic(p) {
    const { passwordHash, ...safe } = p;
    return safe;
}
exports.default = router;
//# sourceMappingURL=auth.js.map