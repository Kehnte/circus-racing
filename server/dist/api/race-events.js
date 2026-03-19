"use strict";
// race-events.ts — Live admin commands: manual controls, grid order,
// countdown, AUTO DNF, AUTO position override.
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const db_js_1 = require("../db/db.js");
const schema_js_1 = require("../db/schema.js");
const roles_js_1 = require("../middleware/roles.js");
const race_context_js_1 = require("../engine/race-context.js");
const emitter_js_1 = require("../socket/emitter.js");
const router = (0, express_1.Router)();
// Helper — verifies the context is loaded for the given race
function requireContext(raceId, res) {
    raceId = String(raceId);
    const ctx = (0, race_context_js_1.getContext)();
    if (!ctx || ctx.raceId !== raceId) {
        res.status(409).json({ error: "Race context not loaded or race mismatch" });
        return null;
    }
    return ctx;
}
// POST /race-events/races/:id/manual-lap — modo+
// Body: { pilotId, delta: 1 | -1 }
router.post("/races/:id/manual-lap", ...roles_js_1.requireModo, async (req, res) => {
    const ctx = requireContext(req.params.id, res);
    if (!ctx)
        return;
    const { pilotId, delta } = req.body;
    if (!pilotId || (delta !== 1 && delta !== -1)) {
        res.status(400).json({ error: "pilotId and delta (1 or -1) are required" });
        return;
    }
    if (!ctx.pilotStates[pilotId]) {
        res.status(404).json({ error: "Pilot not in race" });
        return;
    }
    const result = (0, race_context_js_1.incrementLap)(pilotId, delta);
    if (!result) {
        res.status(409).json({ error: "Cannot increment lap for this pilot" });
        return;
    }
    // Emit engine events
    const profile = ctx.pilotProfiles[pilotId];
    for (const event of result.events) {
        if (event.type === "fastest-lap") {
            (0, emitter_js_1.emitAll)("race-event", {
                type: "fastest-lap",
                pilotId,
                pilotName: profile?.displayName ?? pilotId,
                pilotCountry: profile?.country ?? "un",
                teamName: profile?.teamSnapshot?.name ?? null,
                teamColor: profile?.teamSnapshot?.color ?? null,
                shipModel: profile?.vehicleSnapshot?.model ?? null,
                lapMs: event.lapMs,
                lapFormatted: event.lapFormatted,
                displayDuration: ctx.eventDuration,
            });
        }
        else if (event.type === "finished") {
            (0, emitter_js_1.emitAll)("race-event", {
                type: "finished",
                pilotId,
                pilotName: profile?.displayName ?? pilotId,
                pilotCountry: profile?.country ?? "un",
                teamName: profile?.teamSnapshot?.name ?? null,
                teamColor: profile?.teamSnapshot?.color ?? null,
                displayDuration: ctx.eventDuration,
            });
        }
        else if (event.type === "race-finished") {
            (0, emitter_js_1.emitAll)("race-event", { type: "race-finished" });
        }
    }
    (0, emitter_js_1.broadcastRaceState)(ctx);
    (0, race_context_js_1.persistState)();
    res.json({ ok: true, lap: ctx.pilotStates[pilotId]?.lap });
});
// POST /race-events/races/:id/manual-position — modo+
// Body: { pilotId, position: number }
router.post("/races/:id/manual-position", ...roles_js_1.requireModo, async (req, res) => {
    const ctx = requireContext(req.params.id, res);
    if (!ctx)
        return;
    const { pilotId, position } = req.body;
    if (!pilotId || typeof position !== "number") {
        res.status(400).json({ error: "pilotId and position (number) are required" });
        return;
    }
    if (!ctx.pilotStates[pilotId]) {
        res.status(404).json({ error: "Pilot not in race" });
        return;
    }
    (0, race_context_js_1.setManualPosition)(pilotId, position);
    // Persist gridPosition to DB
    await db_js_1.db
        .update(schema_js_1.raceEntry)
        .set({ gridPosition: ctx.pilotStates[pilotId].gridPosition })
        .where((0, drizzle_orm_1.eq)(schema_js_1.raceEntry.pilotId, pilotId));
    (0, emitter_js_1.broadcastRaceState)(ctx);
    (0, race_context_js_1.persistState)();
    res.json({ ok: true, gridPosition: ctx.pilotStates[pilotId].gridPosition });
});
// POST /race-events/races/:id/manual-reorder — modo+
// Body: { pilotId, direction: "up" | "down" }
router.post("/races/:id/manual-reorder", ...roles_js_1.requireModo, async (req, res) => {
    const ctx = requireContext(req.params.id, res);
    if (!ctx)
        return;
    const { pilotId, direction } = req.body;
    if (!pilotId || (direction !== "up" && direction !== "down")) {
        res.status(400).json({ error: 'pilotId and direction ("up" or "down") are required' });
        return;
    }
    if (!ctx.pilotStates[pilotId]) {
        res.status(404).json({ error: "Pilot not in race" });
        return;
    }
    (0, race_context_js_1.reorderPilot)(pilotId, direction);
    // Persist all grid positions to DB
    await Promise.all(Object.entries(ctx.pilotStates).map(([pid, state]) => db_js_1.db.update(schema_js_1.raceEntry).set({ gridPosition: state.gridPosition }).where((0, drizzle_orm_1.eq)(schema_js_1.raceEntry.pilotId, pid))));
    (0, emitter_js_1.broadcastRaceState)(ctx);
    (0, race_context_js_1.persistState)();
    res.json({ ok: true });
});
// POST /race-events/races/:id/manual-dnf — modo+
// Body: { pilotId }  — toggle DNF / RUNNING
router.post("/races/:id/manual-dnf", ...roles_js_1.requireModo, async (req, res) => {
    const ctx = requireContext(req.params.id, res);
    if (!ctx)
        return;
    const { pilotId } = req.body;
    if (!pilotId) {
        res.status(400).json({ error: "pilotId is required" });
        return;
    }
    if (!ctx.pilotStates[pilotId]) {
        res.status(404).json({ error: "Pilot not in race" });
        return;
    }
    (0, race_context_js_1.toggleDnf)(pilotId);
    const state = ctx.pilotStates[pilotId];
    if (state.status === "DNF") {
        const profile = ctx.pilotProfiles[pilotId];
        (0, emitter_js_1.emitAll)("race-event", {
            type: "dnf",
            pilotId,
            pilotName: profile?.displayName ?? pilotId,
            pilotCountry: profile?.country ?? "un",
            teamName: profile?.teamSnapshot?.name ?? null,
            teamColor: profile?.teamSnapshot?.color ?? null,
            displayDuration: ctx.eventDuration,
        });
    }
    (0, emitter_js_1.broadcastRaceState)(ctx);
    (0, race_context_js_1.persistState)();
    res.json({ ok: true, status: state.status });
});
// POST /race-events/races/:id/grid-order — modo+
// Body: { pilotIds: string[] }
router.post("/races/:id/grid-order", ...roles_js_1.requireModo, async (req, res) => {
    const ctx = requireContext(req.params.id, res);
    if (!ctx)
        return;
    const { pilotIds } = req.body;
    if (!Array.isArray(pilotIds)) {
        res.status(400).json({ error: "pilotIds must be an array" });
        return;
    }
    (0, race_context_js_1.setGridOrder)(pilotIds);
    // Persist to DB
    await Promise.all(pilotIds.map((pid, i) => db_js_1.db.update(schema_js_1.raceEntry).set({ gridPosition: i + 1 }).where((0, drizzle_orm_1.eq)(schema_js_1.raceEntry.pilotId, pid))));
    (0, emitter_js_1.broadcastRaceState)(ctx);
    (0, race_context_js_1.persistState)();
    res.json({ ok: true });
});
// POST /race-events/races/:id/countdown — modo+
// Body: { seconds: number }
router.post("/races/:id/countdown", ...roles_js_1.requireModo, async (req, res) => {
    const { seconds } = req.body;
    if (typeof seconds !== "number" || seconds < 1) {
        res.status(400).json({ error: "seconds must be a positive number" });
        return;
    }
    (0, emitter_js_1.emitAll)("race-event", { type: "countdown", seconds });
    res.json({ ok: true });
});
// POST /race-events/races/:id/countdown-stop — modo+
router.post("/races/:id/countdown-stop", ...roles_js_1.requireModo, async (req, res) => {
    (0, emitter_js_1.emitAll)("race-event", { type: "countdown-stop" });
    res.json({ ok: true });
});
// POST /race-events/races/:id/confirm-dnf/:pilotId — modo+ (AUTO)
// Confirms a WARNING_DNF as official DNF.
router.post("/races/:id/confirm-dnf/:pilotId", ...roles_js_1.requireModo, async (req, res) => {
    const raceId = String(req.params.id);
    const pilotId = String(req.params.pilotId);
    const ctx = requireContext(raceId, res);
    if (!ctx)
        return;
    const state = ctx.pilotStates[pilotId];
    if (!state) {
        res.status(404).json({ error: "Pilot not in race" });
        return;
    }
    (0, race_context_js_1.setPilotState)(pilotId, {
        status: "DNF",
        frozenTime: new Date().toISOString(),
        dnfWarning: false,
    });
    const profile = ctx.pilotProfiles[pilotId];
    (0, emitter_js_1.emitAll)("race-event", {
        type: "dnf",
        pilotId,
        pilotName: profile?.displayName ?? pilotId,
        pilotCountry: profile?.country ?? "un",
        teamName: profile?.teamSnapshot?.name ?? null,
        teamColor: profile?.teamSnapshot?.color ?? null,
        displayDuration: ctx.eventDuration,
    });
    (0, emitter_js_1.broadcastRaceState)(ctx);
    (0, race_context_js_1.persistState)();
    res.json({ ok: true });
});
// POST /race-events/races/:id/ignore-dnf/:pilotId — modo+ (AUTO)
// False positive: clears the WARNING_DNF.
router.post("/races/:id/ignore-dnf/:pilotId", ...roles_js_1.requireModo, async (req, res) => {
    const raceId = String(req.params.id);
    const pilotId = String(req.params.pilotId);
    const ctx = requireContext(raceId, res);
    if (!ctx)
        return;
    const state = ctx.pilotStates[pilotId];
    if (!state) {
        res.status(404).json({ error: "Pilot not in race" });
        return;
    }
    (0, race_context_js_1.setPilotState)(pilotId, { status: "RUNNING", dnfWarning: false });
    (0, race_context_js_1.persistState)();
    res.json({ ok: true });
});
// POST /race-events/races/:id/override-position — modo+ (AUTO)
// Body: { pilotId, position: number } — force a rank in AUTO mode
router.post("/races/:id/override-position", ...roles_js_1.requireModo, async (req, res) => {
    const ctx = requireContext(req.params.id, res);
    if (!ctx)
        return;
    const { pilotId, position } = req.body;
    if (!pilotId || typeof position !== "number") {
        res.status(400).json({ error: "pilotId and position (number) are required" });
        return;
    }
    if (!ctx.pilotStates[pilotId]) {
        res.status(404).json({ error: "Pilot not in race" });
        return;
    }
    (0, race_context_js_1.setManualPosition)(pilotId, position);
    (0, emitter_js_1.broadcastRaceState)(ctx);
    (0, race_context_js_1.persistState)();
    res.json({ ok: true, gridPosition: ctx.pilotStates[pilotId].gridPosition });
});
exports.default = router;
//# sourceMappingURL=race-events.js.map