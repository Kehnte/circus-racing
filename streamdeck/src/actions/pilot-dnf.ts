// pilot-dnf.ts — Toggle DNF for the pilot at this slot.
// Settings: { slotIndex: 0-4 }

import { action, KeyAction, KeyDownEvent, SingletonAction, WillAppearEvent, DidReceiveSettingsEvent } from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";
import { getSnapshot, onStateChange } from "../race-state.js";
import { onPageChange, getPilotAtSlot } from "../pilot-pager.js";
import { manualDnf } from "../api.js";

type PilotDnfSettings = JsonObject & {
  slotIndex?: number;
};

@action({ UUID: "com.circusracing.streamdeck.pilot-dnf" })
export class PilotDnfAction extends SingletonAction<PilotDnfSettings> {
  private unsubState?: () => void;
  private unsubPage?:  () => void;
  private lastEv?: WillAppearEvent<PilotDnfSettings>;

  onWillAppear(ev: WillAppearEvent<PilotDnfSettings>): void {
    this.lastEv = ev;
    this.unsubState = onStateChange(() => this.refresh());
    this.unsubPage  = onPageChange(() => this.refresh());
    this.refresh();
  }

  onWillDisappear(): void {
    this.unsubState?.();
    this.unsubPage?.();
  }

  onDidReceiveSettings(ev: DidReceiveSettingsEvent<PilotDnfSettings>): void {
    this.lastEv = ev as unknown as WillAppearEvent<PilotDnfSettings>;
    this.refresh();
  }

  private refresh(): void {
    const ev = this.lastEv;
    if (!ev) return;
    const snap  = getSnapshot();
    const slot  = (ev.payload.settings.slotIndex as number) ?? 0;
    const pilot = snap ? getPilotAtSlot(snap.pilots, slot) : null;
    const key   = ev.action as KeyAction;

    if (!pilot) {
      void key.setTitle("—");
      void key.setState(1);
      return;
    }

    void key.setTitle(`${pilot.displayName}\nDNF`);
    void key.setState(pilot.status === "DNF" ? 0 : 1); // state 0 = red (active DNF)
  }

  async onKeyDown(ev: KeyDownEvent<PilotDnfSettings>): Promise<void> {
    const snap = getSnapshot();
    if (!snap) return;
    const slot  = (ev.payload.settings.slotIndex as number) ?? 0;
    const pilot = getPilotAtSlot(snap.pilots, slot);
    if (!pilot) return;
    await manualDnf(snap.raceId, pilot.pilotId);
  }
}
