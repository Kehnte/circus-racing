// api.ts — Thin HTTP client wrapping the Circus Racing REST API.
import { config } from "./config.js";
async function request(method, path, body) {
    const res = await fetch(`${config.serverUrl}${path}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            ...(config.apiToken ? { Authorization: `Bearer ${config.apiToken}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok)
        throw new Error(`API ${method} ${path} → ${res.status}`);
    if (res.status === 204)
        return null;
    return res.json();
}
// Fetch all active races (STARTED or PAUSED)
export async function getActiveRace() {
    const races = await request("GET", "/api/races?status=STARTED,PAUSED");
    return races[0] ?? null;
}
export async function getRaceEntries(raceId) {
    return request("GET", `/api/races/${raceId}/entries`);
}
// Lifecycle
export const startRace = (id) => request("POST", `/api/races/${id}/start`);
export const pauseRace = (id) => request("POST", `/api/races/${id}/pause`);
export const resumeRace = (id) => request("POST", `/api/races/${id}/resume`);
export const finishRace = (id) => request("POST", `/api/races/${id}/finish`);
// Pilot actions
export const manualLap = (raceId, pilotId, delta) => request("POST", `/api/race-events/races/${raceId}/manual-lap`, { pilotId, delta });
export const manualDnf = (raceId, pilotId) => request("POST", `/api/race-events/races/${raceId}/manual-dnf`, { pilotId });
export const manualPosition = (raceId, pilotId, position) => request("POST", `/api/race-events/races/${raceId}/manual-position`, { pilotId, position });
