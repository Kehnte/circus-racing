// pilot-info.ts — Displays pilot name and current position (line 2).
// Settings: { slotIndex: 0-4 }

import { action, KeyAction, SingletonAction, WillAppearEvent, DidReceiveSettingsEvent } from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";
import { getSnapshot, onStateChange } from "../race-state.js";
import { onPageChange, getPilotAtSlot } from "../pilot-pager.js";

type PilotInfoSettings = JsonObject & {
  slotIndex?: number;
};

@action({ UUID: "com.circusracing.streamdeck.pilot-info" })
export class PilotInfoAction extends SingletonAction<PilotInfoSettings> {
  private unsubState?: () => void;
  private unsubPage?:  () => void;
  private lastEv?: WillAppearEvent<PilotInfoSettings>;

  onWillAppear(ev: WillAppearEvent<PilotInfoSettings>): void {
    this.lastEv = ev;
    this.unsubState = onStateChange(() => this.refresh());
    this.unsubPage  = onPageChange(() => this.refresh());
    this.refresh();
  }

  onWillDisappear(): void {
    this.unsubState?.();
    this.unsubPage?.();
  }

  onDidReceiveSettings(ev: DidReceiveSettingsEvent<PilotInfoSettings>): void {
    this.lastEv = ev as unknown as WillAppearEvent<PilotInfoSettings>;
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
      void key.setTitle("Info");
      return;
    }

    const pos = pilot.position != null ? `P${pilot.position}` : "—";
    void key.setTitle(`${pilot.displayName}\n${pos}\nL${pilot.lap}`);
  }
}
