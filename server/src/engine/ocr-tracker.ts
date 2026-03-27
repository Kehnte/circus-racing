// ocr-tracker.ts — Tracks last OCR position per pilot for dashboard status display.

interface OcrPilotStatus {
  lastPositionAt: number; // epoch ms
  lastPosition: [number, number, number];
}

const tracker = new Map<string, OcrPilotStatus>();

export function recordOcrPosition(pilotId: string, position: [number, number, number]): void {
  tracker.set(pilotId, { lastPositionAt: Date.now(), lastPosition: position });
}

export type OcrStatus = 'active' | 'stale' | 'offline';

export interface OcrPilotStatusEntry {
  status: OcrStatus;
  lastPositionAt: string | null;
}

export function getOcrStatusMap(): Record<string, OcrPilotStatusEntry> {
  const now = Date.now();
  const result: Record<string, OcrPilotStatusEntry> = {};
  for (const [pilotId, entry] of tracker.entries()) {
    const age = now - entry.lastPositionAt;
    const status: OcrStatus = age < 10_000 ? 'active' : age < 30_000 ? 'stale' : 'offline';
    result[pilotId] = { status, lastPositionAt: new Date(entry.lastPositionAt).toISOString() };
  }
  return result;
}

export function clearOcrTracker(): void {
  tracker.clear();
}
