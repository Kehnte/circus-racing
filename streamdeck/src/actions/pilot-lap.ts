// pilot-lap.ts — Add (+1) or remove (-1) a lap for the pilot at this slot.
// Settings: { slotIndex: 0-4, delta: 1 | -1 }

import { action, KeyAction, KeyDownEvent, SingletonAction, WillAppearEvent, DidReceiveSettingsEvent } from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";
import { getSnapshot, onStateChange } from "../race-state.js";
import { onPageChange, getPilotAtSlot } from "../pilot-pager.js";
import { manualLap } from "../api.js";

type PilotLapSettings = JsonObject & {
  slotIndex?: number;
  delta?: number;
};

@action({ UUID: "com.circusracing.streamdeck.pilot-lap" })
export class PilotLapAction extends SingletonAction<PilotLapSettings> {
  private unsubState?: () => void;
  private unsubPage?:  () => void;
  private lastEv?: WillAppearEvent<PilotLapSettings>;

  onWillAppear(ev: WillAppearEvent<PilotLapSettings>): void {
    this.lastEv = ev;
    this.unsubState = onStateChange(() => this.refresh());
    this.unsubPage  = onPageChange(() => this.refresh());
    this.refresh();
  }

  onWillDisappear(): void {
    this.unsubState?.();
    this.unsubPage?.();
  }

  onDidReceiveSettings(ev: DidReceiveSettingsEvent<PilotLapSettings>): void {
    this.lastEv = ev as unknown as WillAppearEvent<PilotLapSettings>;
    this.refresh();
  }

  private refresh(): void {
    const ev = this.lastEv;
    if (!ev) return;
    const snap  = getSnapshot();
    const slot  = parseInt(String(ev.payload.settings.slotIndex ?? 0), 10) || 0;
    const pilot = snap ? getPilotAtSlot(snap.pilots, slot) : null;
    const key   = ev.action as KeyAction;

    if (!pilot) {
      void key.setTitle("—");
      void key.setState(1);
      return;
    }

    const team  = pilot.teamAcronym ?? "—";
    void key.setTitle(`${team}\nL${pilot.lap}`);
    void key.setState(pilot.status === "DNF" ? 1 : 0);
  }

  async onKeyDown(ev: KeyDownEvent<PilotLapSettings>): Promise<void> {
    const snap = getSnapshot();
    if (!snap || snap.raceStatus !== "STARTED") return;
    const slot  = parseInt(String(ev.payload.settings.slotIndex ?? 0), 10) || 0;
    const delta = (ev.payload.settings.delta as number) === -1 ? -1 : 1;
    const pilot = getPilotAtSlot(snap.pilots, slot);
    if (!pilot) return;
    await manualLap(snap.raceId, pilot.pilotId, delta as 1 | -1);
  }
}
