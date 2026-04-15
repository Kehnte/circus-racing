// pilot-page.ts — Navigate to the previous or next pilot page.
// Settings: { direction: "prev" | "next" }

import { action, KeyAction, KeyDownEvent, SingletonAction, WillAppearEvent, DidReceiveSettingsEvent } from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";
import { getSnapshot, onStateChange } from "../race-state.js";
import { getCurrentPage, onPageChange, nextPage, prevPage, PILOTS_PER_PAGE } from "../pilot-pager.js";

type PilotPageSettings = JsonObject & {
  direction?: string;
};

@action({ UUID: "com.circusracing.streamdeck.pilot-page" })
export class PilotPageAction extends SingletonAction<PilotPageSettings> {
  private unsubState?: () => void;
  private unsubPage?:  () => void;
  private lastEv?: WillAppearEvent<PilotPageSettings>;

  onWillAppear(ev: WillAppearEvent<PilotPageSettings>): void {
    this.lastEv = ev;
    this.unsubState = onStateChange(() => this.refresh());
    this.unsubPage  = onPageChange(() => this.refresh());
    this.refresh();
  }

  onWillDisappear(): void {
    this.unsubState?.();
    this.unsubPage?.();
  }

  onDidReceiveSettings(ev: DidReceiveSettingsEvent<PilotPageSettings>): void {
    this.lastEv = ev as unknown as WillAppearEvent<PilotPageSettings>;
    this.refresh();
  }

  private refresh(): void {
    const ev = this.lastEv;
    if (!ev) return;
    const snap   = getSnapshot();
    const dir    = (ev.payload.settings.direction as string) ?? "next";
    const page   = getCurrentPage();
    const total  = snap ? Math.ceil(snap.pilots.length / PILOTS_PER_PAGE) : 1;
    const symbol = dir === "next" ? "▶" : "◀";
    void (ev.action as KeyAction).setTitle(`${symbol}\n${page + 1}/${total}`);
  }

  onKeyDown(ev: KeyDownEvent<PilotPageSettings>): void {
    const snap = getSnapshot();
    const dir  = (ev.payload.settings.direction as string) ?? "next";
    if (dir === "next") nextPage(snap?.pilots.length ?? 0);
    else prevPage();
  }
}
