import { type Vec3 } from "./math.js";
import type { PilotState } from "../db/schema.js";
export type EngineEvent = {
    type: "fastest-lap";
    pilotId: string;
    lapMs: number;
    lapFormatted: string;
} | {
    type: "finished";
    pilotId: string;
} | {
    type: "dnf-warning";
    pilotId: string;
} | {
    type: "dnf-cleared";
    pilotId: string;
} | {
    type: "race-finished";
};
export interface ProcessPositionResult {
    pilotState: PilotState;
    events: EngineEvent[];
}
export declare function processPosition(pilotId: string, position: Vec3, now: Date): ProcessPositionResult | null;
//# sourceMappingURL=race-engine.d.ts.map