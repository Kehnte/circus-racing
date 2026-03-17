"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const db_js_1 = require("../db/db.js");
const schema_js_1 = require("../db/schema.js");
const roles_js_1 = require("../middleware/roles.js");
const race_context_js_1 = require("../engine/race-context.js");
const emitter_js_1 = require("../socket/emitter.js");
const router = (0, express_1.Router)();
// ---------------------------------------------------------------------------
// POST /race-events/races/:id/confirm-dnf/:pilotId — admin/modo
// Confirms a WARNING_DNF pilot as officially DNF.
// ---------------------------------------------------------------------------
router.post("/races/:id/confirm-dnf/:pilotId", ...roles_js_1.requireModo, async (req, res) => {
    const { id: raceId, pilotId } = req.params;
    const ctx = (0, race_context_js_1.getContext)();
    if (!ctx || ctx.raceId !== raceId) {
        res.status(409).json({ error: "Race not active or context not loaded" });
        return;
    }
    const state = ctx.pilotStates[pilotId];
    if (!state) {
        res.status(404).json({ error: "Pilot not in race" });
        return;
    }
    const nowIso = new Date().toISOString();
    (0, race_context_js_1.setPilotState)(pilotId, {
        status: "DNF",
        frozenTime: nowIso,
        dnfWarning: false,
    });
    // Update raceEntry in DB
    await db_js_1.db
        .update(schema_js_1.raceEntry)
        .set({ status: "DNF" })
        .where((0, drizzle_orm_1.eq)(schema_js_1.raceEntry.pilotId, pilotId));
    // Emit overlay event for incident/DNF
    const profile = ctx.pilotProfiles[pilotId];
    (0, emitter_js_1.emitAll)("race-event", {
        type: "incident",
        pilotId,
        pilotName: profile?.displayName ?? pilotId,
        pilotCountry: profile?.country ?? "un",
        teamName: profile?.teamSnapshot?.name ?? null,
        teamColor: profile?.teamSnapshot?.color ?? null,
        shipModel: profile?.vehicleSnapshot?.model ?? null,
        displayDuration: ctx.eventDuration,
    });
    (0, emitter_js_1.broadcastRaceState)(ctx);
    (0, race_context_js_1.persistState)();
    res.json({ ok: true });
});
// ---------------------------------------------------------------------------
// POST /race-events/races/:id/ignore-dnf/:pilotId — admin/modo
// Clears the WARNING_DNF flag (false positive).
// ---------------------------------------------------------------------------
router.post("/races/:id/ignore-dnf/:pilotId", ...roles_js_1.requireModo, async (req, res) => {
    const { id: raceId, pilotId } = req.params;
    const ctx = (0, race_context_js_1.getContext)();
    if (!ctx || ctx.raceId !== raceId) {
        res.status(409).json({ error: "Race not active or context not loaded" });
        return;
    }
    const state = ctx.pilotStates[pilotId];
    if (!state) {
        res.status(404).json({ error: "Pilot not in race" });
        return;
    }
    (0, race_context_js_1.setPilotState)(pilotId, { status: "RUNNING", dnfWarning: false });
    (0, race_context_js_1.persistState)();
    res.json({ ok: true });
});
// ---------------------------------------------------------------------------
// POST /race-events/races/:id/manual-incident — admin/modo
// Body: { pilotId: string }
// Manually triggers an incident overlay alert (no status change).
// ---------------------------------------------------------------------------
router.post("/races/:id/manual-incident", ...roles_js_1.requireModo, async (req, res) => {
    const { id: raceId } = req.params;
    const { pilotId } = req.body;
    if (!pilotId) {
        res.status(400).json({ error: "pilotId is required" });
        return;
    }
    const ctx = (0, race_context_js_1.getContext)();
    const profile = ctx?.pilotProfiles[pilotId];
    // Look up pilot info even if no active AUTO context (MANUAL mode incidents)
    const pilotRow = !profile
        ? await db_js_1.db.select({
            displayName: schema_js_1.pilot.displayName,
            country: schema_js_1.pilot.country,
        }).from(schema_js_1.pilot).where((0, drizzle_orm_1.eq)(schema_js_1.pilot.id, pilotId)).get()
        : null;
    (0, emitter_js_1.emitAll)("race-event", {
        type: "incident",
        pilotId,
        pilotName: profile?.displayName ?? pilotRow?.displayName ?? pilotId,
        pilotCountry: profile?.country ?? pilotRow?.country ?? "un",
        teamName: profile?.teamSnapshot?.name ?? null,
        teamColor: profile?.teamSnapshot?.color ?? null,
        shipModel: profile?.vehicleSnapshot?.model ?? null,
        displayDuration: ctx?.eventDuration ?? 5,
    });
    res.json({ ok: true });
});
exports.default = router;
//# sourceMappingURL=race-events.js.map