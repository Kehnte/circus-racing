import { type PilotState, type TrackingMode, type SessionMode, type TeamDisplayMode, type ChronoDisplayMode } from "../db/schema.js";
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
//# sourceMappingURL=race-context.d.ts.map