# Circus Racing Monitor

OCR-based position tracker for Star Citizen races. Captures the HUD coordinates and sends them to the Circus Racing server in real time. Includes a local web UI that opens automatically in your browser.

## Setup

### 1. Install dependencies

```bash
pip install -e .
```

### 2. Tesseract OCR

Tesseract binaries are **not included in this repository** (too large). Before running or building the .exe, download the Windows installer from the official release page:

**https://github.com/UB-Mannheim/tesseract/wiki**

Install to `C:/Program Files/Tesseract-OCR` (default), or place the extracted `tesseract/` folder next to `main.py`.

### 3. Configure

Copy `config.example.cfg` to `config.cfg` and fill in your token and server URL — or use the Config section in the web UI after launching.

### 4. Run

```bash
python main.py
```

The browser opens automatically at `http://localhost:17432`.

A `data/` folder is created automatically next to `main.py` (or the .exe) to store runtime files: OCR captures, exports, and logs.

## Build (.exe)

```bash
pyinstaller circus_racing_monitor.spec
```

The distributable is in `dist/circus-racing-monitor/`. The `tesseract/` folder must be present before building.

## Hotkeys (Record mode)

| Key | Action |
|---|---|
| Ctrl+Num1 | Mark start |
| Ctrl+Num2 | Mark checkpoint |
| Ctrl+Num3 | Mark finish + export |
| Ctrl+Num4 | Cancel |

These work in parallel with the UI buttons.
