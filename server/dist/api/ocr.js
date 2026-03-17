"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const db_js_1 = require("../db/db.js");
const schema_js_1 = require("../db/schema.js");
const race_context_js_1 = require("../engine/race-context.js");
const race_engine_js_1 = require("../engine/race-engine.js");
const emitter_js_1 = require("../socket/emitter.js");
const router = (0, express_1.Router)();
// ---------------------------------------------------------------------------
// Token auth middleware — reads x-token header, looks up pilot.token
// ---------------------------------------------------------------------------
async function requireOcrToken(req, res, next) {
    const token = req.headers["x-token"];
    if (!token) {
        res.status(401).json({ error: "Missing x-token header" });
        return;
    }
    const found = await db_js_1.db.select({
        id: schema_js_1.pilot.id,
        role: schema_js_1.pilot.role,
    }).from(schema_js_1.pilot).where((0, drizzle_orm_1.eq)(schema_js_1.pilot.token, token)).get();
    if (!found) {
        res.status(401).json({ error: "Invalid token" });
        return;
    }
    req.user = { id: found.id, role: found.role };
    next();
}
// ---------------------------------------------------------------------------
// PUT /ocr/position
// Body: { x: number, y: number, z: number }
// ---------------------------------------------------------------------------
router.put("/position", requireOcrToken, async (req, res) => {
    const { x, y, z } = req.body;
    if (typeof x !== "number" || typeof y !== "number" || typeof z !== "number") {
        res.status(400).json({ error: "Body must be { x, y, z } numbers" });
        return;
    }
    const pilotId = req.user.id;
    const result = (0, race_engine_js_1.processPosition)(pilotId, [x, y, z], new Date());
    if (!result) {
        // Race not active, pilot not in race, or not in AUTO mode — silently OK
        res.json({ ok: true });
        return;
    }
    const ctx = (0, race_context_js_1.getContext)();
    if (!ctx) {
        res.json({ ok: true });
        return;
    }
    // Emit events
    for (const event of result.events) {
        switch (event.type) {
            case "dnf-warning":
                (0, emitter_js_1.emitDashboard)("dnf-warning", { pilotId: event.pilotId, cleared: false });
                break;
            case "dnf-cleared":
                (0, emitter_js_1.emitDashboard)("dnf-warning", { pilotId: event.pilotId, cleared: true });
                break;
            case "fastest-lap":
                (0, emitter_js_1.emitAll)("race-event", {
                    type: "fastest-lap",
                    pilotId: event.pilotId,
                    pilotName: ctx.pilotProfiles[event.pilotId]?.displayName ?? event.pilotId,
                    pilotCountry: ctx.pilotProfiles[event.pilotId]?.country ?? "un",
                    teamName: ctx.pilotProfiles[event.pilotId]?.teamSnapshot?.name ?? null,
                    teamColor: ctx.pilotProfiles[event.pilotId]?.teamSnapshot?.color ?? null,
                    shipModel: ctx.pilotProfiles[event.pilotId]?.vehicleSnapshot?.model ?? null,
                    time: event.lapFormatted,
                    displayDuration: ctx.eventDuration,
                });
                break;
            case "finished":
                (0, emitter_js_1.emitAll)("race-event", {
                    type: "finished",
                    pilotId: event.pilotId,
                    pilotName: ctx.pilotProfiles[event.pilotId]?.displayName ?? event.pilotId,
                    pilotCountry: ctx.pilotProfiles[event.pilotId]?.country ?? "un",
                    teamName: ctx.pilotProfiles[event.pilotId]?.teamSnapshot?.name ?? null,
                    teamColor: ctx.pilotProfiles[event.pilotId]?.teamSnapshot?.color ?? null,
                    shipModel: ctx.pilotProfiles[event.pilotId]?.vehicleSnapshot?.model ?? null,
                    displayDuration: ctx.eventDuration,
                });
                break;
            case "race-finished":
                (0, emitter_js_1.emitAll)("race-event", { type: "race-finished" });
                (0, emitter_js_1.emitDashboard)("race-auto-finished", { raceId: ctx.raceId });
                break;
        }
    }
    (0, emitter_js_1.broadcastRaceState)(ctx);
    (0, race_context_js_1.persistState)(); // fire-and-forget
    res.json({ ok: true, lap: result.pilotState.lap });
});
exports.default = router;
//# sourceMappingURL=ocr.js.map