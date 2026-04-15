// race-finish.ts — Finish the active race.

import { action, KeyAction, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
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

  private refresh(ev: WillAppearEvent): void {
    const snap = getSnapshot();
    const active = snap?.raceStatus === "STARTED" || snap?.raceStatus === "PAUSED";
    (ev.action as KeyAction).setTitle("Finish");
    (ev.action as KeyAction).setState(active ? 0 : 1);
  }

  async onKeyDown(_ev: KeyDownEvent): Promise<void> {
    const snap = getSnapshot();
    if (snap && (snap.raceStatus === "STARTED" || snap.raceStatus === "PAUSED")) {
      await finishRace(snap.raceId);
    }
  }
}
