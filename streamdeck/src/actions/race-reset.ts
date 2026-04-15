// race-reset.ts — Reset the active race back to PENDING.

import streamDeck, { action, KeyAction, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { getSnapshot, onStateChange } from "../race-state.js";
import { resetRace } from "../api.js";

@action({ UUID: "com.circusracing.streamdeck.race-reset" })
export class RaceResetAction extends SingletonAction {
  private unsub?: () => void;

  onWillAppear(ev: WillAppearEvent): void {
    this.unsub = onStateChange(() => this.refresh(ev));
    this.refresh(ev);
  }
  onWillDisappear(): void { this.unsub?.(); }

  private refresh(ev: WillAppearEvent): void {
    const key  = ev.action as KeyAction;
    const snap = getSnapshot();
    const active = snap && ["STARTED", "PAUSED", "FINISHED"].includes(snap.raceStatus);
    void key.setTitle("Reset");
    void key.setState(active ? 0 : 1);
  }

  async onKeyDown(_ev: KeyDownEvent): Promise<void> {
    const snap = getSnapshot();
    if (!snap) return;
    try {
      await resetRace(snap.raceId);
    } catch (err) {
      streamDeck.logger.error("race-reset error: " + String(err));
    }
  }
}
