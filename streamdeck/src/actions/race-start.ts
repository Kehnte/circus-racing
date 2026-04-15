// race-start.ts — Start or resume the active race.

import streamDeck, { action, KeyAction, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { getSnapshot, onStateChange } from "../race-state.js";
import { startRace, resumeRace } from "../api.js";
import { config } from "../config.js";

@action({ UUID: "com.circusracing.streamdeck.race-start" })
export class RaceStartAction extends SingletonAction {
  private unsubscribe?: () => void;

  onWillAppear(ev: WillAppearEvent): void {
    this.unsubscribe = onStateChange(() => this.refresh(ev));
    this.refresh(ev);
  }

  onWillDisappear(): void {
    this.unsubscribe?.();
  }

  private refresh(ev: WillAppearEvent): void {
    const snap = getSnapshot();
    if (!snap) {
      (ev.action as KeyAction).setTitle("No race");
      (ev.action as KeyAction).setState(1); // dimmed
      return;
    }
    const label = snap.raceStatus === "PAUSED" ? "Resume" : "Start";
    (ev.action as KeyAction).setTitle(label);
    // dimmed when already running
    (ev.action as KeyAction).setState(snap.raceStatus === "STARTED" ? 1 : 0);
  }

  async onKeyDown(_ev: KeyDownEvent): Promise<void> {
    streamDeck.logger.info(`race-start keydown — serverUrl=${config.serverUrl} token=${config.apiToken ? "set" : "empty"}`);
    const snap = getSnapshot();
    streamDeck.logger.info(`snapshot=${snap ? snap.raceStatus : "null"}`);
    if (!snap) return;
    try {
      if (snap.raceStatus === "PAUSED") {
        await resumeRace(snap.raceId);
      } else {
        await startRace(snap.raceId);
      }
    } catch (err) {
      streamDeck.logger.error("race-start error: " + String(err));
    }
  }
}
