// plugin.ts — Entry point. Loads global settings, registers actions, starts the state poller.

import streamDeck from "@elgato/streamdeck";
import { RaceControlAction } from "./actions/race-control.js";
import { RaceFinishAction }  from "./actions/race-finish.js";
import { PilotInfoAction }  from "./actions/pilot-info.js";
import { PilotLapAction }   from "./actions/pilot-lap.js";
import { PilotPageAction }  from "./actions/pilot-page.js";
import { startPolling }     from "./race-state.js";
import { applyGlobalSettings } from "./config.js";

// Apply saved settings whenever they change or are received
streamDeck.settings.onDidReceiveGlobalSettings((ev) => {
  applyGlobalSettings(ev.settings as Record<string, unknown>);
});

streamDeck.actions.registerAction(new RaceControlAction());
streamDeck.actions.registerAction(new RaceFinishAction());
streamDeck.actions.registerAction(new PilotInfoAction());
streamDeck.actions.registerAction(new PilotLapAction());
streamDeck.actions.registerAction(new PilotPageAction());

startPolling();

// Connect, then immediately fetch persisted global settings
streamDeck.connect().then(() => {
  streamDeck.logger.info("Plugin connected");
  void streamDeck.settings.getGlobalSettings().then((s) => {
    streamDeck.logger.info("Global settings received: " + JSON.stringify(s));
    applyGlobalSettings(s as Record<string, unknown>);
  });
});

// Prevent unhandled promise rejections from crashing the plugin
process.on("unhandledRejection", (reason) => {
  streamDeck.logger.error("Unhandled rejection: " + String(reason));
});
