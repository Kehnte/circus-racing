// race-finish.ts — Finish the active race.

import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { getSnapshot, onStateChange } from "../race-state.js";
import { finishRace } from "../api.js";

@action({ UUID: "com.circusracing.streamdeck.race-finish" })
export class RaceFinishAction extends SingletonAction {
  private unsubscribe?: () => void;

  onWillAppear(ev: WillAppearEvent): void {
    this.unsubscribe = onStateChange(() => this.refresh(ev));
    this.refresh(ev);
  }

  onWillDisappear(): void { this.unsubscribe?.(); }

  private refresh(_ev: WillAppearEvent): void {
    // no state to manage — single-state action
  }

  async onKeyDown(_ev: KeyDownEvent): Promise<void> {
    const snap = getSnapshot();
    if (snap && (snap.raceStatus === "STARTED" || snap.raceStatus === "PAUSED")) {
      await finishRace(snap.raceId);
    }
  }
}
