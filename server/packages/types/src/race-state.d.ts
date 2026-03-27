import type { ChronoDisplayMode, TrackingMode, SessionMode } from "./race.js";
export type PilotRuntimeStatus = "RUNNING" | "FINISHED" | "DNF";
export interface PilotRaceState {
    id: string;
    entryId: string | null;
    displayName: string;
    country: string;
    teamSnapshot: {
        name: string;
        color: string;
        acronym: string;
    } | null;
    vehicleSnapshot: {
        type: string;
        manufacturer: string;
        model: string;
    } | null;
    position: number;
    lap: number;
    lapTimes: number[];
    status: PilotRuntimeStatus;
    frozenTime: string | null;
}
export interface RaceStatePayload {
    raceId: string;
    raceName: string;
    racetrackId: string | null;
    status: string;
    trackingMode: TrackingMode;
    session: string;
    weather: string;
    startType: string;
    sessionMode: SessionMode;
    lapCount: number;
    sessionDurationMs: number | null;
    startedAt: string | null;
    pausedAt: string | null;
    totalPausedMs: number;
    globalFastestLapMs: number | null;
    globalFastestLapPilotId: string | null;
    teamDisplayMode: string;
    chronoDisplayMode: ChronoDisplayMode;
    timingEnabled: boolean;
    eventDuration: number;
    pilots: PilotRaceState[];
}
//# sourceMappingURL=race-state.d.ts.map