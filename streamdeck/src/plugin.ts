// plugin.ts — Entry point. Loads global settings, registers actions, starts the state poller.

import streamDeck from "@elgato/streamdeck";
import { RaceControlAction }  from "./actions/race-control.js";
import { RaceFinishAction }   from "./actions/race-finish.js";
import { RaceResetAction }    from "./actions/race-reset.js";
import { PilotInfoAction }    from "./actions/pilot-info.js";
import { PilotLapUpAction }   from "./actions/pilot-lap-up.js";
import { PilotLapDownAction } from "./actions/pilot-lap-down.js";
import { PilotPosUpAction }   from "./actions/pilot-pos-up.js";
import { PilotPosDownAction } from "./actions/pilot-pos-down.js";
import { PilotDnfAction }     from "./actions/pilot-dnf.js";
import { startPolling }       from "./race-state.js";
import { applyGlobalSettings } from "./config.js";

streamDeck.settings.onDidReceiveGlobalSettings((ev) => {
  applyGlobalSettings(ev.settings as Record<string, unknown>);
});

streamDeck.actions.registerAction(new RaceControlAction());
streamDeck.actions.registerAction(new RaceFinishAction());
streamDeck.actions.registerAction(new RaceResetAction());
streamDeck.actions.registerAction(new PilotInfoAction());
streamDeck.actions.registerAction(new PilotLapUpAction());
streamDeck.actions.registerAction(new PilotLapDownAction());
streamDeck.actions.registerAction(new PilotPosUpAction());
streamDeck.actions.registerAction(new PilotPosDownAction());
streamDeck.actions.registerAction(new PilotDnfAction());

startPolling();

streamDeck.connect().then(() => {
  streamDeck.logger.info("Plugin connected");
  void streamDeck.settings.getGlobalSettings().then((s) => {
    applyGlobalSettings(s as Record<string, unknown>);
  });
});

process.on("unhandledRejection", (reason) => {
  streamDeck.logger.error("Unhandled rejection: " + String(reason));
});
