export type RaceStatus = "PENDING" | "SCHEDULED" | "STARTED" | "PAUSED" | "FINISHED";
export type TrackingMode = "manual" | "auto";
export type SessionMode = "laps" | "timed";
export type TeamDisplayMode = "color-bar" | "acronym" | "hidden";
export type ChronoDisplayMode = "leader" | "gap" | "best-lap" | "last-lap";
export type RaceEntryStatus = "PENDING" | "VALIDATED";
export interface Race {
    id: string;
    name: string;
    racetrackId: string | null;
    lapCount: number;
    session: string;
    weather: string;
    startType: string;
    trackingMode: TrackingMode;
    sessionMode: SessionMode;
    sessionDurationMs: number | null;
    teamDisplayMode: TeamDisplayMode;
    chronoDisplayMode: ChronoDisplayMode;
    timingEnabled: boolean;
    eventDuration: number;
    status: RaceStatus;
    createdAt: string;
}
export interface RaceMeta {
    id: string;
    name: string;
    status: RaceStatus;
    trackingMode: TrackingMode;
    session: string;
}
//# sourceMappingURL=race.d.ts.map