// pilot-pos-down.ts — Move pilot down one position (position number increases).

import { action, KeyAction, KeyDownEvent, SingletonAction, WillAppearEvent, DidReceiveSettingsEvent } from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";
import { getSnapshot, onStateChange } from "../race-state.js";
import { getPilotAtSlot } from "../pilot-pager.js";
import { manualPosition } from "../api.js";

type Settings = JsonObject & { slotIndex?: number };

@action({ UUID: "com.circusracing.streamdeck.pilot-pos-down" })
export class PilotPosDownAction extends SingletonAction<Settings> {
  private unsub?: () => void;
  private lastEv?: WillAppearEvent<Settings>;

  onWillAppear(ev: WillAppearEvent<Settings>): void {
    this.lastEv = ev;
    this.unsub = onStateChange(() => this.refresh());
    this.refresh();
  }
  onWillDisappear(): void { this.unsub?.(); }
  onDidReceiveSettings(ev: DidReceiveSettingsEvent<Settings>): void {
    this.lastEv = ev as unknown as WillAppearEvent<Settings>;
    this.refresh();
  }

  private refresh(): void {
    const ev = this.lastEv;
    if (!ev) return;
    const snap  = getSnapshot();
    const slot  = parseInt(String(ev.payload.settings.slotIndex ?? 0), 10) || 0;
    const pilot = snap ? getPilotAtSlot(snap.pilots, slot) : null;
    const key   = ev.action as KeyAction;
    if (!pilot) { void key.setTitle("—\nP-"); void key.setState(1); return; }
    const pos = pilot.position != null ? `P${pilot.position}` : "—";
    void key.setTitle(`${pilot.displayName}\n${pos}▼`);
    void key.setState(pilot.status === "DNF" ? 1 : 0);
  }

  async onKeyDown(ev: KeyDownEvent<Settings>): Promise<void> {
    const snap = getSnapshot();
    if (!snap || snap.raceStatus !== "STARTED") return;
    const slot  = parseInt(String(ev.payload.settings.slotIndex ?? 0), 10) || 0;
    const pilot = getPilotAtSlot(snap.pilots, slot);
    if (!pilot || pilot.position == null) return;
    await manualPosition(snap.raceId, pilot.pilotId, pilot.position + 1);
  }
}
