export interface Team {
    id: string;
    name: string;
    acronym: string;
    color: string;
}
export interface Vehicle {
    id: string;
    type: string;
    manufacturer: string | null;
    model: string;
    img: string | null;
}
export interface Controls {
    id: string;
    type: string;
    img: string | null;
}
export interface Checkpoint {
    order: number;
    position: [number, number, number];
}
export interface Racetrack {
    id: string;
    name: string;
    checkpoints: Checkpoint[];
}
export type PilotRole = "ADMIN" | "MODERATOR" | "PILOT";
export interface Pilot {
    id: string;
    displayName: string;
    email: string | null;
    role: PilotRole;
    country: string;
    avatarUrl: string | null;
    teamId: string | null;
    vehicleId: string | null;
    controlsId: string | null;
    createdAt: string;
    token: string;
}
//# sourceMappingURL=entities.d.ts.map