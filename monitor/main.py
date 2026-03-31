# Circus Racing Monitor — OCR position tracker with local web UI (Flask)
import time
import os
import re
import math
import sys
import json
import logging
import datetime
import threading
import webbrowser
import configparser
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
import mss
import mss.tools
from PIL import Image
import pytesseract

import requests
import keyboard

import win32gui

from flask import Flask, jsonify, request, send_from_directory


# ---------------------------------------------------------------------------
# Runtime data directory — all generated files go here
# ---------------------------------------------------------------------------

DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# Logging (file only — console window is hidden in the .exe build)
# ---------------------------------------------------------------------------

logging.basicConfig(
    filename=str(DATA_DIR / "monitor.log"),
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Tesseract
# ---------------------------------------------------------------------------

def _get_tesseract_cmd() -> str:
    """Return the full path to the tesseract executable."""
    if getattr(sys, "frozen", False):
        base = Path(sys._MEIPASS)
        tesseract_path = base / "tesseract" / "tesseract.exe"
        if tesseract_path.exists():
            tessdata = base / "tesseract" / "tessdata"
            if tessdata.exists():
                os.environ["TESSDATA_PREFIX"] = str(tessdata) + os.sep
            return str(tesseract_path)

    if "Tesseract" not in os.environ.get("PATH", "") and os.path.isdir("C:/Program Files/Tesseract-OCR"):
        return "C:/Program Files/Tesseract-OCR/tesseract.exe"

    return "tesseract/tesseract.exe"


pytesseract.pytesseract.tesseract_cmd = _get_tesseract_cmd()


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

def _load_config() -> configparser.ConfigParser:
    config = configparser.ConfigParser()

    if Path("config.cfg").exists():
        config.read("config.cfg")
        return config

    if getattr(sys, "frozen", False):
        bundle_cfg = Path(sys._MEIPASS) / "config.cfg"
        if bundle_cfg.exists():
            config.read(bundle_cfg)
            return config

    # No config found — create a blank one so the UI can guide the user.
    config["auth"] = {"token": ""}
    config["server"] = {"url": ""}
    config["screen"] = {"monitor_index": "1"}
    config["debug"] = {
        "delta_time_s": "1",
        "checkpoint_save": "false",
        "checkpoint_save_distance": "150",
    }
    return config


config = _load_config()


def save_config():
    with open("config.cfg", "w") as f:
        config.write(f)


# ---------------------------------------------------------------------------
# Shared state
# ---------------------------------------------------------------------------

@dataclass
class MonitorState:
    lock: threading.Lock = field(default_factory=threading.Lock)

    mode: str = "RACE"                    # "RACE" | "RECORD"
    position: Optional[list] = None
    last_ocr_at: Optional[str] = None
    last_send_status: object = None       # 200, "error", or None
    server_ok: bool = False               # last OCR send succeeded
    server_reachable: bool = False        # /api/ping reachable

    # Record mode
    recording: bool = False
    raw_trace: list = field(default_factory=list)
    marks: list = field(default_factory=list)
    finished: bool = False
    circuit_name: str = "Circuit"
    circuit_type: str = "LOOP"

    # Last Ctrl+Shift+T capture test result
    last_capture_test: Optional[dict] = None

    # Restart signal for mode switches
    restart_event: threading.Event = field(default_factory=threading.Event)


state = MonitorState()


# ---------------------------------------------------------------------------
# OCR helpers
# ---------------------------------------------------------------------------

POS_PATTERN = re.compile(
    r"[PpRr]os:\s*(.+?)\s*[kK]?m\S*\s+(.+?)\s*[kK]?m\S*\s+(.+?)\s*[kK]?m",
    re.IGNORECASE,
)
# Fallback when "Pos:" is outside the capture zone
POS_PATTERN_BARE = re.compile(
    r"([\d.+-]+)\s*[kK]?m\s*([\d.+-]+)\s*[kK]?m\s*([\d.+-]+)\s*[kK]?m",
    re.IGNORECASE,
)

_OCR_DIGIT_TR = str.maketrans("oOlISsBG}", "001155890")


def _clean_number(raw: str) -> float:
    s = raw.replace(",", ".").translate(_OCR_DIGIT_TR)
    s = re.sub(r"[^\d.+-]", "", s)
    parts = s.split(".")
    if len(parts) > 2:
        s = parts[0] + "." + "".join(parts[1:])
        parts = s.split(".")
    if len(parts) == 2:
        decimals = parts[1][:4]
        s = parts[0] + "." + decimals
    return float(s)


def parse_pos(text: str):
    text = text.replace(", ", ",").replace(". ", ".")
    match = POS_PATTERN.search(text) or POS_PATTERN_BARE.search(text)
    if match:
        try:
            x, y, z = [_clean_number(g) for g in match.groups()]
            return [round(x, 3), round(y, 3), round(z, 3)]
        except ValueError as e:
            log.warning("Parse error: %s", e)
            return None
    return None


_CAPTURE_ZONES = {
    (2560, 1440): (2231, 45, 329, 11),
}

_REF_RES = (2560, 1440)
_REF_ZONE = _CAPTURE_ZONES[_REF_RES]


def _get_capture_zone(mon_w, mon_h):
    zone = _CAPTURE_ZONES.get((mon_w, mon_h))
    if zone:
        return zone
    sx = mon_w / _REF_RES[0]
    sy = mon_h / _REF_RES[1]
    return (
        int(_REF_ZONE[0] * sx),
        int(_REF_ZONE[1] * sy),
        int(_REF_ZONE[2] * sx),
        int(_REF_ZONE[3] * sy),
    )


def _capture_pos():
    """Capture the HUD area and return parsed position, or None."""
    monitor_index = config.getint("screen", "monitor_index", fallback=1)
    with mss.mss() as sct:
        mon = sct.monitors[monitor_index]
        mon_w = mon["width"]
        mon_h = mon["height"]
        cap_left, cap_top, cap_w, cap_h = _get_capture_zone(mon_w, mon_h)
        region = {
            "top": cap_top + mon["top"],
            "left": cap_left + mon["left"],
            "width": cap_w,
            "height": cap_h,
        }
        capture = sct.grab(region)
        mss.tools.to_png(capture.rgb, capture.size, output=str(DATA_DIR / "capture.png"))

    img = cv2.imread(str(DATA_DIR / "capture.png"), cv2.IMREAD_GRAYSCALE)
    img = cv2.resize(img, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
    img = cv2.GaussianBlur(img, (3, 3), 0)
    _, thresh = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    processed = cv2.bitwise_not(thresh)
    cv2.imwrite(str(DATA_DIR / "debug_image.png"), processed)

    text = pytesseract.image_to_string(processed, config="--oem 3 --psm 7 -c tessedit_char_whitelist=0123456789.km-Pos: ")
    log.info("OCR raw: %r", text)
    return parse_pos(text)


def write_checkpoint(pos):
    with open(DATA_DIR / "checkpoints.txt", "a") as f:
        f.write(":".join(f"{k:.3f}" for k in pos) + "\n")


def calculate_distance(pos1, pos2):
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(pos1, pos2)))


# ---------------------------------------------------------------------------
# Server reachability ping
# ---------------------------------------------------------------------------

def check_server_reachable():
    try:
        res = requests.get(f"{config['server']['url']}/api/ping", timeout=3)
        with state.lock:
            state.server_reachable = res.status_code == 200
    except Exception:
        with state.lock:
            state.server_reachable = False


def _ping_loop():
    while True:
        check_server_reachable()
        time.sleep(5)


# ---------------------------------------------------------------------------
# Send position
# ---------------------------------------------------------------------------

def send_position(positions):
    try:
        res = requests.put(
            f"{config['server']['url']}/api/ocr/position",
            json={"x": positions[0], "y": positions[1], "z": positions[2]},
            headers={"x-token": config["auth"]["token"]},
            timeout=5,
        )
        with state.lock:
            state.last_send_status = res.status_code
            state.server_ok = res.status_code == 200
        log.info("send_position %s", res.status_code)
    except Exception as e:
        with state.lock:
            state.last_send_status = "error"
            state.server_ok = False
        log.warning("send_position failed: %s", e)


# ---------------------------------------------------------------------------
# Mode RACE loop
# ---------------------------------------------------------------------------

def run_race_loop():
    last_pos = None
    checkpoint_save = config["debug"].getboolean("checkpoint_save")
    checkpoint_save_distance = int(config["debug"]["checkpoint_save_distance"])
    delta_time_s = float(config["debug"]["delta_time_s"])

    log.info("RACE loop started")
    while True:
        with state.lock:
            if state.mode != "RACE":
                break

        if win32gui.FindWindow(None, "Star Citizen"):
            pos = _capture_pos()
            if pos:
                now = datetime.datetime.now(datetime.UTC).isoformat()
                with state.lock:
                    state.position = pos
                    state.last_ocr_at = now

                if not last_pos:
                    last_pos = pos
                    write_checkpoint(pos)
                else:
                    if calculate_distance(last_pos, pos) > checkpoint_save_distance and checkpoint_save:
                        write_checkpoint(pos)
                        last_pos = pos

                send_position(pos)

        time.sleep(delta_time_s)

    log.info("RACE loop stopped")


# ---------------------------------------------------------------------------
# Mode RECORD helpers
# ---------------------------------------------------------------------------

def _normalize(v):
    n = math.sqrt(sum(x ** 2 for x in v))
    return [x / n for x in v] if n > 0 else v


def _build_checkpoints(raw_trace, marks, circuit_type):
    checkpoints = []
    n = len(raw_trace)

    for mark in marks:
        i     = mark["trace_idx"]
        hint  = mark["type_hint"]
        prev  = raw_trace[max(0,   i - 1)]["position"]
        nxt   = raw_trace[min(n - 1, i + 1)]["position"]
        direction = _normalize([nxt[k] - prev[k] for k in range(3)])
        position  = raw_trace[i]["position"]

        if mark["order"] == 0:
            cp_type = "start-finish" if circuit_type == "LOOP" else "start"
            radius  = 150
        elif hint == "finish":
            cp_type = "finish"
            radius  = 150
        else:
            cp_type = "checkpoint"
            radius  = 100

        checkpoints.append({
            "order":     mark["order"],
            "position":  position,
            "direction": direction,
            "radius":    radius,
            "type":      cp_type,
        })

    if circuit_type == "LOOP" and len(checkpoints) >= 2:
        start_dir = checkpoints[0]["direction"]
        last      = checkpoints[-1]
        avg_dir   = _normalize([start_dir[k] + last["direction"][k] for k in range(3)])
        checkpoints[-1] = {
            **last,
            "position":  checkpoints[0]["position"],
            "direction": avg_dir,
            "type":      "start-finish",
            "radius":    150,
        }

    return checkpoints


def _filter_trace(raw_trace, max_jump=3000):
    """Keep the longest consecutive chain of points with jumps below max_jump."""
    if len(raw_trace) < 2:
        return list(raw_trace)
    best_start, best_len = 0, 1
    i = 0
    while i < len(raw_trace):
        start = i
        length = 1
        while i + 1 < len(raw_trace):
            prev = raw_trace[i]["position"]
            curr = raw_trace[i + 1]["position"]
            dist = math.sqrt(sum((a - b) ** 2 for a, b in zip(curr, prev)))
            if dist < max_jump:
                length += 1
                i += 1
            else:
                break
        if length > best_len:
            best_start, best_len = start, length
        i += 1
    return raw_trace[best_start:best_start + best_len]


def _export_svg(raw_trace, marks, filename):
    """Generate an SVG trace with start/finish markers and outlier filtering."""
    filtered = _filter_trace(raw_trace)
    if len(filtered) < 2:
        log.warning("Not enough points for SVG export.")
        return

    xs = [p["position"][0] for p in filtered]
    ys = [p["position"][1] for p in filtered]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    span_x = max_x - min_x or 1
    span_y = max_y - min_y or 1

    pad = 60
    w, h = 700, 700
    scale = min((w - 2 * pad) / span_x, (h - 2 * pad) / span_y)

    def tx(x):
        return pad + (x - min_x) * scale

    def ty(y):
        return h - pad - (y - min_y) * scale

    n = len(filtered)
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}">\n'
        f'  <rect width="{w}" height="{h}" rx="12" fill="#141218"/>\n'
        f'  <rect x="8" y="8" width="{w-16}" height="{h-16}" rx="8"'
        f' fill="#211f26" stroke="#4a4553" stroke-width="1"/>\n'
    )

    for i in range(1, n):
        frac = i / n
        r = int(255 * (1 - frac) + 255 * frac)
        g = int(179 * (1 - frac) + 194 * frac)
        b = int(176 * (1 - frac) + 119 * frac)
        x1, y1 = tx(filtered[i - 1]["position"][0]), ty(filtered[i - 1]["position"][1])
        x2, y2 = tx(filtered[i]["position"][0]), ty(filtered[i]["position"][1])
        svg += (
            f'  <line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}"'
            f' stroke="rgb({r},{g},{b})" stroke-width="2" stroke-linecap="round"/>\n'
        )

    for p in filtered:
        svg += (
            f'  <circle cx="{tx(p["position"][0]):.1f}"'
            f' cy="{ty(p["position"][1]):.1f}" r="2.5"'
            f' fill="#e6c277" opacity="0.6"/>\n'
        )

    sp = filtered[0]["position"]
    svg += (
        f'  <circle cx="{tx(sp[0]):.1f}" cy="{ty(sp[1]):.1f}"'
        f' r="6" fill="#4CAF50" stroke="#e6e1e6" stroke-width="1.5"/>\n'
        f'  <text x="{tx(sp[0]) + 10:.1f}" y="{ty(sp[1]) + 4:.1f}"'
        f' fill="#4CAF50" font-size="11" font-family="sans-serif">START</text>\n'
    )

    ep = filtered[-1]["position"]
    svg += (
        f'  <circle cx="{tx(ep[0]):.1f}" cy="{ty(ep[1]):.1f}"'
        f' r="6" fill="#F44336" stroke="#e6e1e6" stroke-width="1.5"/>\n'
        f'  <text x="{tx(ep[0]) + 10:.1f}" y="{ty(ep[1]) + 4:.1f}"'
        f' fill="#F44336" font-size="11" font-family="sans-serif">FINISH</text>\n'
    )

    for mark in marks:
        if mark["trace_idx"] < len(raw_trace):
            pos = raw_trace[mark["trace_idx"]]["position"]
            svg += (
                f'  <circle cx="{tx(pos[0]):.1f}" cy="{ty(pos[1]):.1f}"'
                f' r="5" fill="none" stroke="#FFC107" stroke-width="2"/>\n'
            )

    svg += "</svg>"

    with open(filename, "w", encoding="utf-8") as f:
        f.write(svg)
    log.info("SVG exported: %s (%d/%d points)", filename, len(filtered), len(raw_trace))


def _export_record():
    """Export JSON + SVG from current record state. Called after FINISH or CANCEL."""
    with state.lock:
        raw_trace = list(state.raw_trace)
        marks = list(state.marks)
        circuit_name = state.circuit_name
        circuit_type = state.circuit_type

    if not marks:
        log.info("Record cancelled, no marks — nothing exported.")
        return

    checkpoints = _build_checkpoints(raw_trace, marks, circuit_type)
    output = {
        "name":                circuit_name,
        "type":                circuit_type,
        "recordedBy":          "",
        "recordedAt":          datetime.datetime.now(datetime.UTC).isoformat(),
        "defaultBufferRadius": 500,
        "checkpoints":         checkpoints,
        "rawTrace":            raw_trace,
    }

    base_name = f"{circuit_name.replace(' ', '_')}_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
    json_path = DATA_DIR / f"{base_name}.json"
    svg_path = DATA_DIR / f"{base_name}.svg"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)
    log.info("Trace exported: %s", json_path)

    _export_svg(raw_trace, marks, str(svg_path))


# ---------------------------------------------------------------------------
# Mode RECORD loop
# ---------------------------------------------------------------------------

def run_record_loop():
    delta_time_s = float(config["debug"]["delta_time_s"])
    t0 = time.time()

    with state.lock:
        state.recording = False
        state.raw_trace = []
        state.marks = []
        state.finished = False

    def on_start():
        with state.lock:
            if not state.raw_trace:
                return
            state.marks.append({
                "order": len(state.marks),
                "trace_idx": len(state.raw_trace) - 1,
                "type_hint": "start",
            })
            state.recording = True
        log.info("[Ctrl+Num1] START marked")

    def on_checkpoint():
        with state.lock:
            if not state.recording or not state.raw_trace:
                return
            state.marks.append({
                "order": len(state.marks),
                "trace_idx": len(state.raw_trace) - 1,
                "type_hint": "checkpoint",
            })
        log.info("[Ctrl+Num2] CHECKPOINT marked")

    def on_finish():
        with state.lock:
            if not state.recording or not state.raw_trace:
                return
            state.marks.append({
                "order": len(state.marks),
                "trace_idx": len(state.raw_trace) - 1,
                "type_hint": "finish",
            })
            state.finished = True
        log.info("[Ctrl+Num3] FINISH marked")

    def on_cancel():
        with state.lock:
            state.finished = True
            state.marks = []
        log.info("[Ctrl+Num4] Record cancelled")

    keyboard.add_hotkey("ctrl+num 1", on_start)
    keyboard.add_hotkey("ctrl+num 2", on_checkpoint)
    keyboard.add_hotkey("ctrl+num 3", on_finish)
    keyboard.add_hotkey("ctrl+num 4", on_cancel)

    log.info("RECORD loop started")
    while True:
        with state.lock:
            if state.mode != "RECORD":
                break
            if state.finished:
                break

        if win32gui.FindWindow(None, "Star Citizen"):
            pos = _capture_pos()
            if pos:
                now = datetime.datetime.now(datetime.UTC).isoformat()
                with state.lock:
                    state.position = pos
                    state.last_ocr_at = now
                    state.raw_trace.append({"t": round(time.time() - t0, 2), "position": pos})

        time.sleep(delta_time_s)

    keyboard.remove_all_hotkeys()
    _export_record()
    log.info("RECORD loop stopped")


# ---------------------------------------------------------------------------
# Monitor thread — dispatches RACE or RECORD loop
# ---------------------------------------------------------------------------

def monitor_thread():
    while True:
        with state.lock:
            mode = state.mode

        if mode == "RACE":
            run_race_loop()
        elif mode == "RECORD":
            run_record_loop()
            # After record finishes, go back to RACE
            with state.lock:
                state.mode = "RACE"
                state.finished = False
        else:
            time.sleep(0.5)


# ---------------------------------------------------------------------------
# Flask UI server
# ---------------------------------------------------------------------------

def _ui_folder() -> str:
    if getattr(sys, "frozen", False):
        return str(Path(sys._MEIPASS) / "frontend" / "dist")
    return str(Path(__file__).parent / "frontend" / "dist")


flask_app = Flask(__name__, static_folder=_ui_folder(), static_url_path="")

PORT = 17432


@flask_app.route("/")
def index():
    return send_from_directory(_ui_folder(), "index.html")


@flask_app.route("/api/state")
def api_state():
    with state.lock:
        return jsonify({
            "mode": state.mode,
            "position": state.position,
            "last_ocr_at": state.last_ocr_at,
            "last_send_status": state.last_send_status,
            "server_ok": state.server_ok,
            "server_reachable": state.server_reachable,
            "recording": state.recording,
            "trace_count": len(state.raw_trace),
            "marks": state.marks,
            "finished": state.finished,
            "last_capture_test": state.last_capture_test,
        })


@flask_app.route("/api/mode", methods=["POST"])
def api_set_mode():
    data = request.get_json(force=True)
    new_mode = data.get("mode", "RACE")
    if new_mode not in ("RACE", "RECORD"):
        return jsonify({"error": "invalid mode"}), 400
    with state.lock:
        state.mode = new_mode
        state.finished = True   # break current loop so monitor_thread re-dispatches
        state.position = None
        state.last_ocr_at = None
        state.last_send_status = None
        if new_mode == "RECORD":
            state.recording = False
            state.raw_trace = []
            state.marks = []
    return jsonify({"ok": True})


@flask_app.route("/api/record/mark", methods=["POST"])
def api_record_mark():
    data = request.get_json(force=True)
    action = data.get("action")

    # Update circuit metadata if provided
    name = data.get("name")
    circuit_type = data.get("circuit_type")
    with state.lock:
        if name:
            state.circuit_name = name
        if circuit_type in ("LOOP", "POINT_TO_POINT"):
            state.circuit_type = circuit_type

    if action == "start":
        with state.lock:
            if not state.raw_trace:
                return jsonify({"error": "no position yet"}), 400
            state.marks.append({
                "order": len(state.marks),
                "trace_idx": len(state.raw_trace) - 1,
                "type_hint": "start",
            })
            state.recording = True

    elif action == "checkpoint":
        with state.lock:
            if not state.recording or not state.raw_trace:
                return jsonify({"error": "not recording"}), 400
            state.marks.append({
                "order": len(state.marks),
                "trace_idx": len(state.raw_trace) - 1,
                "type_hint": "checkpoint",
            })

    elif action == "finish":
        with state.lock:
            if not state.recording or not state.raw_trace:
                return jsonify({"error": "not recording"}), 400
            state.marks.append({
                "order": len(state.marks),
                "trace_idx": len(state.raw_trace) - 1,
                "type_hint": "finish",
            })
            state.finished = True

    elif action == "cancel":
        with state.lock:
            state.finished = True
            state.marks = []

    return jsonify({"ok": True})


@flask_app.route("/api/monitors")
def api_monitors():
    with mss.mss() as sct:
        monitors = [
            {"index": i, "width": m["width"], "height": m["height"]}
            for i, m in enumerate(sct.monitors[1:], start=1)
        ]
    return jsonify(monitors)


@flask_app.route("/api/screens")
def api_screens():
    with mss.mss() as sct:
        screens = [
            {"index": i, "width": m["width"], "height": m["height"], "left": m["left"], "top": m["top"]}
            for i, m in enumerate(sct.monitors[1:], start=1)
        ]
    return jsonify(screens)


@flask_app.route("/api/test-capture", methods=["POST"])
def api_test_capture():
    import base64
    try:
        monitor_index = config.getint("screen", "monitor_index", fallback=1)
        with mss.mss() as sct:
            mon = sct.monitors[monitor_index]
            mon_w, mon_h = mon["width"], mon["height"]
            cap_left, cap_top, cap_w, cap_h = _get_capture_zone(mon_w, mon_h)
            region = {
                "top": cap_top + mon["top"],
                "left": cap_left + mon["left"],
                "width": cap_w,
                "height": cap_h,
            }
            capture = sct.grab(region)
            mss.tools.to_png(capture.rgb, capture.size, output=str(DATA_DIR / "capture_test.png"))

        img = cv2.imread(str(DATA_DIR / "capture_test.png"), cv2.IMREAD_GRAYSCALE)
        img = cv2.resize(img, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
        img = cv2.GaussianBlur(img, (3, 3), 0)
        _, thresh = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
        processed = cv2.bitwise_not(thresh)
        cv2.imwrite(str(DATA_DIR / "capture_test_processed.png"), processed)

        ocr_text = pytesseract.image_to_string(processed, config="--oem 3 --psm 7 -c tessedit_char_whitelist=0123456789.km-Pos: ")
        parsed = parse_pos(ocr_text)

        with open(DATA_DIR / "capture_test.png", "rb") as f:
            image_b64 = base64.b64encode(f.read()).decode()

        result = {
            "ok": parsed is not None,
            "ocr_text": ocr_text.strip(),
            "position": parsed,
            "image_b64": image_b64,
            "captured_at": datetime.datetime.now(datetime.UTC).isoformat(),
        }
        with state.lock:
            state.last_capture_test = result
        return jsonify(result)
    except Exception as e:
        log.warning("test-capture failed: %s", e)
        result = {"ok": False, "ocr_text": "", "position": None, "image_b64": None, "captured_at": datetime.datetime.now(datetime.UTC).isoformat()}
        with state.lock:
            state.last_capture_test = result
        return jsonify(result), 500


@flask_app.route("/api/config", methods=["GET"])
def api_get_config():
    return jsonify({
        "token": config.get("auth", "token", fallback=""),
        "url": config.get("server", "url", fallback=""),
        "monitor_index": config.getint("screen", "monitor_index", fallback=1),
        "delta_time_s": config.getfloat("debug", "delta_time_s", fallback=1.0),
        "checkpoint_save": config.getboolean("debug", "checkpoint_save", fallback=False),
        "checkpoint_save_distance": config.getint("debug", "checkpoint_save_distance", fallback=150),
    })


@flask_app.route("/api/config", methods=["POST"])
def api_save_config():
    data = request.get_json(force=True)

    if "token" in data:
        config["auth"]["token"] = str(data["token"])
    if "url" in data:
        config["server"]["url"] = str(data["url"])
    if "monitor_index" in data:
        config["screen"]["monitor_index"] = str(int(data["monitor_index"]))
    if "delta_time_s" in data:
        config["debug"]["delta_time_s"] = str(float(data["delta_time_s"]))
    if "checkpoint_save" in data:
        config["debug"]["checkpoint_save"] = str(bool(data["checkpoint_save"]))
    if "checkpoint_save_distance" in data:
        config["debug"]["checkpoint_save_distance"] = str(int(data["checkpoint_save_distance"]))

    save_config()
    return jsonify({"ok": True})


def run_flask():
    import logging as _logging
    _logging.getLogger("werkzeug").setLevel(_logging.ERROR)
    flask_app.run(host="127.0.0.1", port=PORT, use_reloader=False, threaded=True)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    log.info("Starting Circus Racing Monitor on port %d", PORT)

    t_flask = threading.Thread(target=run_flask, daemon=True)
    t_flask.start()

    t_monitor = threading.Thread(target=monitor_thread, daemon=True)
    t_monitor.start()

    t_ping = threading.Thread(target=_ping_loop, daemon=True)
    t_ping.start()

    def _on_test_capture_hotkey():
        import base64
        try:
            monitor_index = config.getint("screen", "monitor_index", fallback=1)
            with mss.mss() as sct:
                mon = sct.monitors[monitor_index]
                mon_w, mon_h = mon["width"], mon["height"]
                cap_left, cap_top, cap_w, cap_h = _get_capture_zone(mon_w, mon_h)
                region = {
                    "top": cap_top + mon["top"],
                    "left": cap_left + mon["left"],
                    "width": cap_w,
                    "height": cap_h,
                }
                capture = sct.grab(region)
                mss.tools.to_png(capture.rgb, capture.size, output=str(DATA_DIR / "capture_test.png"))

            img = cv2.imread(str(DATA_DIR / "capture_test.png"), cv2.IMREAD_GRAYSCALE)
            img = cv2.resize(img, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
            img = cv2.GaussianBlur(img, (3, 3), 0)
            _, thresh = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
            processed = cv2.bitwise_not(thresh)

            ocr_text = pytesseract.image_to_string(processed, config="--oem 3 --psm 7 -c tessedit_char_whitelist=0123456789.km-Pos: ")
            parsed = parse_pos(ocr_text)

            with open(DATA_DIR / "capture_test.png", "rb") as f:
                image_b64 = base64.b64encode(f.read()).decode()

            result = {
                "ok": parsed is not None,
                "ocr_text": ocr_text.strip(),
                "position": parsed,
                "image_b64": image_b64,
                "captured_at": datetime.datetime.now(datetime.UTC).isoformat(),
            }
        except Exception as e:
            log.warning("Ctrl+Shift+T capture failed: %s", e)
            result = {"ok": False, "ocr_text": "", "position": None, "image_b64": None, "captured_at": datetime.datetime.now(datetime.UTC).isoformat()}

        with state.lock:
            state.last_capture_test = result
        log.info("[Ctrl+Shift+T] capture test: ok=%s", result["ok"])

    keyboard.add_hotkey("alt+t", _on_test_capture_hotkey)

    # Give Flask a moment to bind before opening the browser
    time.sleep(0.8)
    webbrowser.open(f"http://127.0.0.1:{PORT}")

    threading.Event().wait()


main()
