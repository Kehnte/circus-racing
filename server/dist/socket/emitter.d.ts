import type { Server } from "socket.io";
import type { RaceContext } from "../engine/race-context.js";
export declare function initEmitter(io: Server): void;
export declare function emitAll(event: string, data?: unknown): void;
export declare function emitDashboard(event: string, data?: unknown): void;
export declare function buildRaceUpdatePayload(ctx: RaceContext): object;
export declare function broadcastRaceState(ctx: RaceContext): void;
//# sourceMappingURL=emitter.d.ts.map