// schema.ts — SQLite table definitions with Drizzle ORM.
// Entities: pilot, team, vehicle, controls, racetrack, race, race_entry, race_state.
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import type {
  PilotRole, RaceStatus, TrackingMode, SessionMode,
  TeamDisplayMode, ChronoDisplayMode, RaceEntryStatus, PilotRuntimeStatus,
} from "@circus-racing/types";

export type {
  PilotRole, RaceStatus, TrackingMode, SessionMode,
  TeamDisplayMode, ChronoDisplayMode, RaceEntryStatus, PilotRuntimeStatus,
};

// Reference entities (managed by admin/modo)

export const team = sqliteTable("team", {
  id:      text().primaryKey().$defaultFn(() => crypto.randomUUID()),
  name:    text().notNull().unique(),
  acronym: text().notNull(),
  color:   text().notNull(), // hex, e.g. "#E91E63"
});

export const vehicle = sqliteTable("vehicle", {
  id:           text().primaryKey().$defaultFn(() => crypto.randomUUID()),
  type:         text().notNull(), // "ship" | "bike" | "rover" | ...
  manufacturer: text(),           // e.g. "Anvil", "Drake", "RSI"
  model:        text().notNull(),
  img:          text(),           // optional URL
});

export const controls = sqliteTable("controls", {
  id:   text().primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: text().notNull(), // "HOTAS" | "Keyboard/Mouse" | "Gamepad"
  img:  text(),           // optional URL
});

export const racetrack = sqliteTable("racetrack", {
  id:           text().primaryKey().$defaultFn(() => crypto.randomUUID()),
  name:         text().notNull().unique(),
  checkpoints:  text({ mode: "json" }).$type<Array<{ order: number; position: [number, number, number]; direction: [number, number, number]; radius: number }>>().notNull(),
});

// Pilot (permanent account)

export const pilot = sqliteTable("pilot", {
  id:           text().primaryKey().$defaultFn(() => crypto.randomUUID()),
  displayName:  text().notNull().unique(),
  passwordHash: text().notNull(),
  role:         text().$type<PilotRole>().notNull().default("PILOT"),
  token:        text().notNull().unique(), // OCR auth token + lightweight session id
  tokenVersion: integer().notNull().default(0), // bumped on admin password reset to invalidate JWTs
  country:      text().default("un"),      // ISO 2-letter code
  avatarUrl:    text(),
  teamId:       text().references(() => team.id, { onDelete: "set null" }),
  vehicleId:    text().references(() => vehicle.id, { onDelete: "set null" }),
  controlsId:   text().references(() => controls.id, { onDelete: "set null" }),
  createdAt:    text().notNull().default(sql`(datetime('now'))`),
});

// Race

export const race = sqliteTable("race", {
  id:                text().primaryKey().$defaultFn(() => crypto.randomUUID()),
  name:              text().notNull(),
  racetrackId:       text().references(() => racetrack.id),
  lapCount:          integer().notNull().default(3),
  session:           text().notNull().default("Race"),    // "Qualifying" | "Race" | "Sprint" | ...
  weather:           text().notNull().default("Clear"),   // "Clear" | "Cloudy" | "Fog" | "Rain" | "Storm" | "Snow"
  startType:         text().notNull().default("Grid Start"),
  trackingMode:      text().$type<TrackingMode>().notNull().default("manual"),
  sessionMode:       text().$type<SessionMode>().notNull().default("laps"),
  sessionDurationMs: integer(),                           // only if sessionMode = "timed"
  teamDisplayMode:   text().$type<TeamDisplayMode>().notNull().default("color-bar"),
  chronoDisplayMode: text().$type<ChronoDisplayMode>().notNull().default("hidden"),
  timingEnabled:     integer({ mode: "boolean" }).notNull().default(true),
  eventDuration:     integer().notNull().default(5),      // seconds for overlay alerts
  status:            text().$type<RaceStatus>().notNull().default("PENDING"),
  createdAt:         text().notNull().default(sql`(datetime('now'))`),
});

// Race entry (pilot registration for a race)

export const raceEntry = sqliteTable("race_entry", {
  id:               text().primaryKey().$defaultFn(() => crypto.randomUUID()),
  raceId:           text().notNull().references(() => race.id, { onDelete: "cascade" }),
  pilotId:          text().notNull().references(() => pilot.id, { onDelete: "cascade" }),
  status:           text().$type<RaceEntryStatus>().notNull().default("PENDING"),
  gridPosition:     integer(),  // 1-based grid order, set by admin
  // Snapshots saved at validation time (for historical records)
  teamSnapshot:     text({ mode: "json" }).$type<Record<string, unknown>>(),
  vehicleSnapshot:  text({ mode: "json" }).$type<Record<string, unknown>>(),
  controlsSnapshot: text({ mode: "json" }).$type<Record<string, unknown>>(),
});

// Race state (runtime — persisted for crash recovery)

export interface PilotState {
  position: [number, number, number];
  lap: number;
  progress: number;         // 0–1 within current lap
  raceProgress: number;     // overall 0–N (laps + progress)
  gridPosition: number;     // 1-based explicit rank (manual mode + grid setup)
  lapTimes: number[];       // ms per completed lap
  status: PilotRuntimeStatus;
  frozenTime: string | null;  // ISO timestamp when finished/DNF
  lastCheckpointTime: string | null;
  nextCheckpointOrder: number;
}

export const raceState = sqliteTable("race_state", {
  raceId:        text().primaryKey().references(() => race.id, { onDelete: "cascade" }),
  pilotStates:   text({ mode: "json" }).$type<Record<string, PilotState>>().notNull().default(sql`'{}'`),
  startedAt:     text(),  // ISO timestamp
  pausedAt:      text(),  // ISO timestamp, null if running
  totalPausedMs: integer().notNull().default(0),
});

// Streaming settings (singleton, id = 1) — quality constraints for pilot streams
export const streamSettings = sqliteTable("stream_settings", {
  id:            integer().primaryKey().default(1),
  maxResolution: text().notNull().default("1080p"), // "480p" | "720p" | "1080p"
  maxFps:        integer().notNull().default(30),    // 30 | 60
});

// Director layout state (singleton, id = 1)
export const directorState = sqliteTable("director_state", {
  id:    integer().primaryKey().default(1),
  mode:  text().notNull().default("single"), // "single" | "side-by-side" | "quad" | "pip"
  slots: text({ mode: "json" }).$type<Array<{ type: "pilot" | "camera"; id: string } | null>>().notNull().default(sql`'[]'`),
});

// Inferred types

export type StreamSettings = typeof streamSettings.$inferSelect;
export type DirectorState  = typeof directorState.$inferSelect;
export type Team       = typeof team.$inferSelect;
export type Vehicle    = typeof vehicle.$inferSelect;
export type Controls   = typeof controls.$inferSelect;
export type Racetrack  = typeof racetrack.$inferSelect;
export type Pilot      = typeof pilot.$inferSelect;
export type Race       = typeof race.$inferSelect;
export type RaceEntry  = typeof raceEntry.$inferSelect;
export type RaceState  = typeof raceState.$inferSelect;
