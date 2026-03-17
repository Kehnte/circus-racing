"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.raceState = exports.raceEntry = exports.race = exports.pilot = exports.racetrack = exports.controls = exports.vehicle = exports.team = void 0;
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
const drizzle_orm_1 = require("drizzle-orm");
// ---------------------------------------------------------------------------
// Reference entities (managed by admin/modo)
// ---------------------------------------------------------------------------
exports.team = (0, sqlite_core_1.sqliteTable)("team", {
    id: (0, sqlite_core_1.text)().primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: (0, sqlite_core_1.text)().notNull().unique(),
    acronym: (0, sqlite_core_1.text)().notNull(),
    color: (0, sqlite_core_1.text)().notNull(), // hex, e.g. "#E91E63"
});
exports.vehicle = (0, sqlite_core_1.sqliteTable)("vehicle", {
    id: (0, sqlite_core_1.text)().primaryKey().$defaultFn(() => crypto.randomUUID()),
    type: (0, sqlite_core_1.text)().notNull(), // "ship" | "bike" | "rover" | ...
    model: (0, sqlite_core_1.text)().notNull(),
    img: (0, sqlite_core_1.text)(), // optional URL
});
exports.controls = (0, sqlite_core_1.sqliteTable)("controls", {
    id: (0, sqlite_core_1.text)().primaryKey().$defaultFn(() => crypto.randomUUID()),
    type: (0, sqlite_core_1.text)().notNull(), // "HOTAS" | "Keyboard/Mouse" | "Gamepad"
    img: (0, sqlite_core_1.text)(), // optional URL
});
exports.racetrack = (0, sqlite_core_1.sqliteTable)("racetrack", {
    id: (0, sqlite_core_1.text)().primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: (0, sqlite_core_1.text)().notNull().unique(),
    checkpoints: (0, sqlite_core_1.text)({ mode: "json" }).$type().notNull(),
    bufferRadius: (0, sqlite_core_1.integer)(), // override for DNF_BUFFER_RADIUS env
});
exports.pilot = (0, sqlite_core_1.sqliteTable)("pilot", {
    id: (0, sqlite_core_1.text)().primaryKey().$defaultFn(() => crypto.randomUUID()),
    displayName: (0, sqlite_core_1.text)().notNull().unique(),
    email: (0, sqlite_core_1.text)().notNull().unique(),
    passwordHash: (0, sqlite_core_1.text)().notNull(),
    role: (0, sqlite_core_1.text)().$type().notNull().default("PILOT"),
    token: (0, sqlite_core_1.text)().notNull().unique(), // OCR auth token + lightweight session id
    country: (0, sqlite_core_1.text)().default("un"), // ISO 2-letter code
    avatarUrl: (0, sqlite_core_1.text)(),
    teamId: (0, sqlite_core_1.text)().references(() => exports.team.id, { onDelete: "set null" }),
    vehicleId: (0, sqlite_core_1.text)().references(() => exports.vehicle.id, { onDelete: "set null" }),
    controlsId: (0, sqlite_core_1.text)().references(() => exports.controls.id, { onDelete: "set null" }),
    createdAt: (0, sqlite_core_1.text)().notNull().default((0, drizzle_orm_1.sql) `(datetime('now'))`),
});
exports.race = (0, sqlite_core_1.sqliteTable)("race", {
    id: (0, sqlite_core_1.text)().primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: (0, sqlite_core_1.text)().notNull(),
    racetrackId: (0, sqlite_core_1.text)().references(() => exports.racetrack.id),
    lapCount: (0, sqlite_core_1.integer)().notNull().default(3),
    session: (0, sqlite_core_1.text)().notNull().default("Race"), // "Qualifying" | "Race" | "Sprint" | ...
    weather: (0, sqlite_core_1.text)().notNull().default("Clear"), // "Clear" | "Cloudy" | "Fog" | "Rain" | "Storm" | "Snow"
    startType: (0, sqlite_core_1.text)().notNull().default("Grid Start"),
    trackingMode: (0, sqlite_core_1.text)().$type().notNull().default("manual"),
    sessionMode: (0, sqlite_core_1.text)().$type().notNull().default("laps"),
    sessionDurationMs: (0, sqlite_core_1.integer)(), // only if sessionMode = "timed"
    teamDisplayMode: (0, sqlite_core_1.text)().$type().notNull().default("color-bar"),
    chronoDisplayMode: (0, sqlite_core_1.text)().$type().notNull().default("gap"),
    timingEnabled: (0, sqlite_core_1.integer)({ mode: "boolean" }).notNull().default(true),
    eventDuration: (0, sqlite_core_1.integer)().notNull().default(5), // seconds for overlay alerts
    status: (0, sqlite_core_1.text)().$type().notNull().default("PENDING"),
    createdAt: (0, sqlite_core_1.text)().notNull().default((0, drizzle_orm_1.sql) `(datetime('now'))`),
});
exports.raceEntry = (0, sqlite_core_1.sqliteTable)("race_entry", {
    id: (0, sqlite_core_1.text)().primaryKey().$defaultFn(() => crypto.randomUUID()),
    raceId: (0, sqlite_core_1.text)().notNull().references(() => exports.race.id, { onDelete: "cascade" }),
    pilotId: (0, sqlite_core_1.text)().notNull().references(() => exports.pilot.id, { onDelete: "cascade" }),
    status: (0, sqlite_core_1.text)().$type().notNull().default("PENDING"),
    // Snapshots saved at validation time (for historical records)
    teamSnapshot: (0, sqlite_core_1.text)({ mode: "json" }).$type(),
    vehicleSnapshot: (0, sqlite_core_1.text)({ mode: "json" }).$type(),
    controlsSnapshot: (0, sqlite_core_1.text)({ mode: "json" }).$type(),
});
exports.raceState = (0, sqlite_core_1.sqliteTable)("race_state", {
    raceId: (0, sqlite_core_1.text)().primaryKey().references(() => exports.race.id, { onDelete: "cascade" }),
    pilotStates: (0, sqlite_core_1.text)({ mode: "json" }).$type().notNull().default((0, drizzle_orm_1.sql) `'{}'`),
    startedAt: (0, sqlite_core_1.text)(), // ISO timestamp
    pausedAt: (0, sqlite_core_1.text)(), // ISO timestamp, null if running
    totalPausedMs: (0, sqlite_core_1.integer)().notNull().default(0),
});
//# sourceMappingURL=schema.js.map