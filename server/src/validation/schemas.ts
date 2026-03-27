// schemas.ts — Zod validation schemas for all API request bodies.
import { z } from "zod";

// Auth

export const registerSchema = z.object({
  displayName: z.string().min(2).max(50),
  password:    z.string().min(6),
  country:     z.string().length(2).optional(),
  avatarUrl:   z.string().url().optional().nullable(),
  teamId:      z.string().uuid().optional().nullable(),
  vehicleId:   z.string().uuid().optional().nullable(),
  controlsId:  z.string().uuid().optional().nullable(),
});

export const loginSchema = z.object({
  displayName: z.string().min(1),
  password:    z.string().min(1),
});

// Races

const trackingMode = z.enum(["manual", "auto"]);
const sessionMode  = z.enum(["laps", "timed"]);

export const createRaceSchema = z.object({
  name:              z.string().min(1).max(100),
  racetrackId:       z.string().uuid().optional().nullable(),
  lapCount:          z.number().int().min(1).optional(),
  session:           z.string().min(1).max(50).optional(),
  weather:           z.string().min(1).max(50).optional(),
  startType:         z.string().min(1).max(50).optional(),
  trackingMode:      trackingMode.optional(),
  sessionMode:       sessionMode.optional(),
  sessionDurationMs: z.number().int().positive().optional().nullable(),
  teamDisplayMode:   z.enum(["color-bar", "acronym", "hidden"]).optional(),
  chronoDisplayMode: z.enum(["leader", "gap", "best-lap", "last-lap"]).optional(),
  timingEnabled:     z.boolean().optional(),
  eventDuration:     z.number().int().min(1).optional(),
});

export const updateRaceSchema = createRaceSchema.partial();

// Pilots

export const createPilotSchema = z.object({
  displayName: z.string().min(2).max(50),
  country:     z.string().length(2).optional(),
  avatarUrl:   z.string().url().optional().nullable(),
  teamId:      z.string().uuid().optional().nullable(),
  vehicleId:   z.string().uuid().optional().nullable(),
  controlsId:  z.string().uuid().optional().nullable(),
});

export const updatePilotSchema = z.object({
  displayName: z.string().min(2).max(50).optional(),
  email:       z.string().email().optional().nullable(),
  country:     z.string().length(2).optional(),
  avatarUrl:   z.string().url().optional().nullable(),
  teamId:      z.string().uuid().optional().nullable(),
  vehicleId:   z.string().uuid().optional().nullable(),
  controlsId:  z.string().uuid().optional().nullable(),
  role:        z.enum(["ADMIN", "MODERATOR", "PILOT"]).optional(),
});

// Teams

export const createTeamSchema = z.object({
  name:    z.string().min(1).max(50),
  acronym: z.string().min(1).max(10),
  color:   z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const updateTeamSchema = createTeamSchema.partial();

// Vehicles

export const createVehicleSchema = z.object({
  type:         z.string().min(1).max(50),
  manufacturer: z.string().min(1).max(50).optional().nullable(),
  model:        z.string().min(1).max(100),
  img:          z.string().url().optional().nullable(),
});

export const updateVehicleSchema = createVehicleSchema.partial();

// Controls

export const createControlsSchema = z.object({
  type: z.string().min(1).max(50),
  img:  z.string().url().optional().nullable(),
});

export const updateControlsSchema = createControlsSchema.partial();

// Racetracks

export const checkpointSchema = z.object({
  order:    z.number().int().min(0).optional(),
  position: z.tuple([z.number(), z.number(), z.number()]),
});

export const createRacetrackSchema = z.object({
  name:        z.string().min(1).max(100),
  checkpoints: z.array(checkpointSchema).optional(),
});

export const updateRacetrackSchema = createRacetrackSchema.partial();

// OCR

export const ocrPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

// Race entries (admin add)

export const addEntryAdminSchema = z.object({
  pilotId: z.string().uuid(),
});
