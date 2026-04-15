// race-reset.ts — Reset the active race back to PENDING.

import streamDeck, { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
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

  private refresh(_ev: WillAppearEvent): void {
    // no state to manage — single-state action
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
