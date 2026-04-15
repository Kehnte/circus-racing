# Circus Racing — Stream Deck Plugin

Manual race control panel for Circus Racing events on a physical Stream Deck device.

---

## What it does

| Action | Description |
|--------|-------------|
| **Race Control** | Contextual button — Start / Pause / Resume depending on race state |
| **Race Finish** | Finish the active race |
| **Race Reset** | Reset the race back to Pending |
| **Pilot Info** | Read-only display — pilot name, live position, lap count |
| **Pilot Lap +** | Add a lap to the pilot at this slot |
| **Pilot Lap -** | Remove a lap from the pilot at this slot |
| **Pilot Position +** | Move pilot up one position |
| **Pilot Position -** | Move pilot down one position |
| **Pilot DNF** | Mark pilot as DNF |

Pilot actions display the pilot's name on the key and update live every second. Slots are numbered 0–19 and map to pilots in stable order (by pilot ID), regardless of live position changes.

---

## Requirements

- Stream Deck app 6.4+ (Windows)
- Circus Racing server running and reachable on the network
- Account with **Admin** or **Moderator** role on the Circus Racing dashboard

---

## Installation

### Option A — From a release (recommended)

1. Download `circus-racing.streamDeckPlugin` from [GitHub Releases](https://github.com/Kehnte/circus-racing/releases)
2. Double-click the file — Stream Deck installs it automatically
3. The **Circus Racing** category appears in the action list

### Option B — From source

```bash
cd streamdeck
npm install
npm run build
npm run install-plugin
```

Then restart the Stream Deck app (right-click tray icon → Quit, reopen).

---

## Setup

### 1. Generate a device token

1. Log in to the Circus Racing dashboard
2. Go to your **Profile** page
3. Under **Stream Deck**, click **Generate token**
4. Copy the token — it is shown only once. If lost, regenerate it.

> Only Admin and Moderator accounts can generate a device token.

### 2. Configure the plugin

1. Drag any **Circus Racing** action onto a key
2. In the Property Inspector on the right, fill in:
   - **Server URL**: `http://<server-ip>:3000`
   - **Device Token**: paste the token from step 1
3. These settings are global — shared by all Circus Racing keys on this Stream Deck

---

## Layout example (Stream Deck 5×3)

| Col 1 | Col 2 | Col 3 | Col 4 | Col 5 |
|-------|-------|-------|-------|-------|
| Race Control | Race Finish | Race Reset | — | — |
| Pilot Lap+ (slot 0) | Pilot Lap+ (slot 1) | Pilot Lap+ (slot 2) | Pilot Lap+ (slot 3) | Pilot Lap+ (slot 4) |
| Pilot DNF (slot 0) | Pilot DNF (slot 1) | Pilot DNF (slot 2) | Pilot DNF (slot 3) | Pilot DNF (slot 4) |

Set `Pilot slot` to 0–19 in each key's settings to assign a pilot. Slot 0 is the first pilot registered in the race, slot 1 the second, etc.

---

## Behaviour

- **No active race** — pilot keys show their action label (Lap+, DNF, etc.) and do nothing on press
- **Race PENDING / SCHEDULED** — Race Control shows "Start"
- **Race STARTED** — pilot keys show name + live data; Race Control shows "Pause"
- **Race PAUSED** — Race Control shows "Resume"
- **Race FINISHED** — Race Control is inactive
- Pilot actions (Lap, Position, DNF) only fire when the race is **STARTED**
- State is polled from the server every second — no manual refresh needed

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Plugin not in SD action list | Restart Stream Deck app completely (tray → Quit) |
| Keys show no pilot name | Server not running, or wrong Server URL / token |
| Key press does nothing | Race must be in STARTED state for pilot actions |
| Token rejected (401) | Regenerate token in Profile → Stream Deck |
| Pilot slots shift after position change | Expected — slots are stable by pilot ID, not live rank |

---

## Updating

### From a release

Download the new `.streamDeckPlugin` from [GitHub Releases](https://github.com/Kehnte/circus-racing/releases) and double-click to install over the existing version. Settings are preserved.

### From source

```bash
cd streamdeck
npm run build
npm run install-plugin
# Restart Stream Deck app
```
