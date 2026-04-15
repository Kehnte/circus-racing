// race-pause.ts — Pause the active race.

import { action, KeyAction, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { getSnapshot, onStateChange } from "../race-state.js";
import { pauseRace } from "../api.js";

@action({ UUID: "com.circusracing.streamdeck.race-pause" })
export class RacePauseAction extends SingletonAction {
  private unsubscribe?: () => void;

  onWillAppear(ev: WillAppearEvent): void {
    this.unsubscribe = onStateChange(() => this.refresh(ev));
    this.refresh(ev);
  }

  onWillDisappear(): void { this.unsubscribe?.(); }

  private refresh(ev: WillAppearEvent): void {
    const snap = getSnapshot();
    const enabled = snap?.raceStatus === "STARTED";
    (ev.action as KeyAction).setTitle("Pause");
    (ev.action as KeyAction).setState(enabled ? 0 : 1);
  }

  async onKeyDown(_ev: KeyDownEvent): Promise<void> {
    const snap = getSnapshot();
    if (snap?.raceStatus === "STARTED") await pauseRace(snap.raceId);
  }
}
