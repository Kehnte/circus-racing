import { type PilotState, type TrackingMode, type SessionMode, type TeamDisplayMode, type ChronoDisplayMode, type RaceStatus } from "../db/schema.js";
export declare const CHECKPOINT_RADIUS: number;
export interface PilotProfile {
    displayName: string;
    country: string;
    teamSnapshot: Record<string, unknown> | null;
    vehicleSnapshot: Record<string, unknown> | null;
    controlsSnapshot: Record<string, unknown> | null;
}
export interface RaceContext {
    raceId: string;
    raceStatus: RaceStatus;
    trackingMode: TrackingMode;
    lapCount: number;
    sessionMode: SessionMode;
    sessionDurationMs: number | null;
    checkpoints: Array<{
        order: number;
        position: [number, number, number];
    }>;
    bufferRadius: number;
    pilotStates: Record<string, PilotState>;
    pilotProfiles: Record<string, PilotProfile>;
    entryIds: Record<string, string>;
    startedAt: string | null;
    pausedAt: string | null;
    totalPausedMs: number;
    globalFastestLapMs: number | null;
    globalFastestLapPilotId: string | null;
    teamDisplayMode: TeamDisplayMode;
    chronoDisplayMode: ChronoDisplayMode;
    timingEnabled: boolean;
    eventDuration: number;
    raceName: string;
    session: string;
    weather: string;
    startType: string;
}
export declare function getContext(): RaceContext | null;
export declare function hasContext(): boolean;
export declare function loadRace(raceId: string): Promise<RaceContext>;
export declare function setPilotState(pilotId: string, patch: Partial<PilotState>): void;
export declare function persistState(): Promise<void>;
export declare function clearContext(): Promise<void>;
export declare function setGridOrder(pilotIds: string[]): void;
export declare function setManualPosition(pilotId: string, targetPos: number): void;
export declare function reorderPilot(pilotId: string, direction: "up" | "down"): void;
export declare function toggleDnf(pilotId: string): void;
export type ManualLapEvent = {
    type: "fastest-lap";
    pilotId: string;
    lapMs: number;
    lapFormatted: string;
} | {
    type: "finished";
    pilotId: string;
} | {
    type: "race-finished";
};
export declare function incrementLap(pilotId: string, delta: 1 | -1): {
    events: ManualLapEvent[];
} | null;
//# sourceMappingURL=race-context.d.ts.map