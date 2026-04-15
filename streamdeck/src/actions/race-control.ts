// race-control.ts — Contextual Start / Pause / Resume button.

import streamDeck, { action, KeyAction, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { getSnapshot, onStateChange } from "../race-state.js";
import { startRace, pauseRace, resumeRace } from "../api.js";

@action({ UUID: "com.circusracing.streamdeck.race-control" })
export class RaceControlAction extends SingletonAction {
  private unsubscribe?: () => void;

  onWillAppear(ev: WillAppearEvent): void {
    this.unsubscribe = onStateChange(() => this.refresh(ev));
    this.refresh(ev);
  }

  onWillDisappear(): void {
    this.unsubscribe?.();
  }

  private refresh(ev: WillAppearEvent): void {
    const key = ev.action as KeyAction;
    const snap = getSnapshot();
    if (!snap) {
      void key.setTitle("No race");
      void key.setState(1);
      return;
    }
    switch (snap.raceStatus) {
      case "PENDING":
      case "SCHEDULED":
        void key.setTitle("Start");
        void key.setState(0);
        break;
      case "STARTED":
        void key.setTitle("Pause");
        void key.setState(0);
        break;
      case "PAUSED":
        void key.setTitle("Resume");
        void key.setState(0);
        break;
      case "FINISHED":
        void key.setTitle("Finished");
        void key.setState(1);
        break;
    }
  }

  async onKeyDown(_ev: KeyDownEvent): Promise<void> {
    const snap = getSnapshot();
    if (!snap) return;
    try {
      switch (snap.raceStatus) {
        case "PENDING":
        case "SCHEDULED":
          await startRace(snap.raceId);
          break;
        case "STARTED":
          await pauseRace(snap.raceId);
          break;
        case "PAUSED":
          await resumeRace(snap.raceId);
          break;
      }
    } catch (err) {
      streamDeck.logger.error("race-control error: " + String(err));
    }
  }
}
