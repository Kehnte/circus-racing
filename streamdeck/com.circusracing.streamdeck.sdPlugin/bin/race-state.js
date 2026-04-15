// race-state.ts — Shared in-memory state polled from the server, with change callbacks.
import { getActiveRace, getRaceEntries } from "./api.js";
import { config } from "./config.js";
let current = null;
const listeners = [];
let timer = null;
export function getSnapshot() { return current; }
export function onStateChange(fn) {
    listeners.push(fn);
    return () => { const i = listeners.indexOf(fn); if (i !== -1)
        listeners.splice(i, 1); };
}
function notify() { for (const fn of listeners)
    fn(current); }
async function poll() {
    try {
        const race = await getActiveRace();
        if (!race) {
            if (current !== null) {
                current = null;
                notify();
            }
            return;
        }
        const entries = await getRaceEntries(race.id);
        const sorted = [...entries].sort((a, b) => (a.gridPosition ?? 99) - (b.gridPosition ?? 99));
        const pilots = sorted.map(e => ({
            pilotId: e.pilotId,
            displayName: e.pilot?.displayName ?? e.pilotId.slice(0, 8),
            lap: 0,
            status: "RUNNING",
            position: e.gridPosition,
        }));
        const next = {
            raceId: race.id,
            raceName: race.name,
            raceStatus: race.status,
            pilots,
        };
        const changed = JSON.stringify(next) !== JSON.stringify(current);
        if (changed) {
            current = next;
            notify();
        }
    }
    catch {
        // server unreachable — keep last known state
    }
}
export function startPolling() {
    if (timer)
        return;
    void poll();
    timer = setInterval(() => { void poll(); }, config.pollIntervalMs);
}
export function stopPolling() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
}
