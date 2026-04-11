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


from flask import Flask, jsonify, request, send_from_directory, send_file


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
        "record_delta_time_s": "0.3",
        "checkpoint_save": "false",
        "checkpoint_save_distance": "150",
        "auto_checkpoint_spacing": "150",
    }
    config["hotkeys"] = {
        "test_capture": "alt+t",
        "record_start": "ctrl+num 1",
        "record_checkpoint": "ctrl+num 2",
        "record_finish": "ctrl+num 3",
        "record_cancel": "ctrl+num 4",
    }
    config["filters"] = {
        "speed_enabled": "true",
        "speed_max_ms": "3000.0",
        "iqr_enabled": "true",
        "iqr_multiplier": "1.5",
        "angular_enabled": "false",
        "angular_max_angle": "120.0",
        "rdp_enabled": "false",
        "rdp_tolerance": "1.0",
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
    record_t0: float = field(default_factory=time.time)
    pending_start_mark: bool = False  # place start mark at first successful OCR capture

    # Last Ctrl+Shift+T capture test result
    last_capture_test: Optional[dict] = None

    # Anchor position: if set, OCR points too far from it are rejected as gaps
    anchor_position: Optional[list] = None
    anchor_radius: float = 500000.0

    # Path of the last exported recording JSON (for download)
    last_export_path: Optional[Path] = None

    # Restart signal for mode switches
    restart_event: threading.Event = field(default_factory=threading.Event)


state = MonitorState()


# ---------------------------------------------------------------------------
# OCR helpers
# ---------------------------------------------------------------------------

# Matches exactly X.XXXXkm Y.XXXXkm Z.XXXXkm — km is the natural delimiter
POS_PATTERN = re.compile(
    r"(-?\d+\.\d{4})[kK]m(-?\d+\.\d{4})[kK]m(-?\d+\.\d{4})[kK]m",
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
        if len(parts[1]) != 4:
            raise ValueError(f"expected 4 decimals, got {len(parts[1])!r} in {raw!r}")
        s = parts[0] + "." + parts[1]
    else:
        raise ValueError(f"no decimal point in {raw!r}")
    return float(s)


def parse_pos(text: str):
    match = POS_PATTERN.search(text)
    if match:
        try:
            x, y, z = [float(g) * 1000 for g in match.groups()]
            return [round(x, 3), round(y, 3), round(z, 3)]
        except ValueError as e:
            log.warning("Parse error: %s", e)
            return None
    log.warning("No match for OCR text: %r", text.strip())
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
        img = np.array(capture)

    # Save debug PNG without blocking on disk read
    cv2.imwrite(str(DATA_DIR / "capture.png"), img)
    img = cv2.cvtColor(img, cv2.COLOR_BGRA2GRAY)
    img = cv2.resize(img, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
    img = cv2.GaussianBlur(img, (3, 3), 0)
    _, thresh = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    processed = cv2.bitwise_not(thresh)
    cv2.imwrite(str(DATA_DIR / "debug_image.png"), processed)

    text = pytesseract.image_to_string(processed, config="--oem 3 --psm 7 -c tessedit_char_whitelist=0123456789.km-RootPs:")
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


def _direction_at(trace, i):
    """Return normalized travel direction at trace index i, skipping stationary neighbours."""
    n = len(trace)
    position = trace[i]["position"]
    _MIN_DIST = 0.5
    prev = position
    for j in range(i - 1, -1, -1):
        if math.sqrt(sum((trace[j]["position"][k] - position[k]) ** 2 for k in range(3))) >= _MIN_DIST:
            prev = trace[j]["position"]
            break
    nxt = position
    for j in range(i + 1, n):
        if math.sqrt(sum((trace[j]["position"][k] - position[k]) ** 2 for k in range(3))) >= _MIN_DIST:
            nxt = trace[j]["position"]
            break
    return _normalize([nxt[k] - prev[k] for k in range(3)])


def _build_checkpoints(raw_trace, marks, circuit_type):
    checkpoints = []
    n = len(raw_trace)

    for mark in marks:
        i        = mark["trace_idx"]
        hint     = mark["type_hint"]
        position = raw_trace[i]["position"]
        direction = _direction_at(raw_trace, i)

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

    # Auto-generate evenly spaced intermediate checkpoints if none were marked manually.
    manual_checkpoints = [m for m in marks if m["type_hint"] == "checkpoint"]
    if not manual_checkpoints and len(raw_trace) >= 2:
        spacing = config.getfloat("debug", "auto_checkpoint_spacing", fallback=150.0)

        # Compute cumulative arc length along the trace
        arc = [0.0]
        for i in range(1, n):
            a = raw_trace[i - 1]["position"]
            b = raw_trace[i]["position"]
            arc.append(arc[-1] + math.sqrt(sum((b[k] - a[k]) ** 2 for k in range(3))))
        total_len = arc[-1]

        num_intervals = max(1, round(total_len / spacing))
        # Find start mark index to skip the start-finish zone
        start_idx = next((m["trace_idx"] for m in marks if m["type_hint"] == "start"), 0)

        inserted = 0
        for seg in range(1, num_intervals):
            target_dist = seg * (total_len / num_intervals)
            # Binary search for the trace index closest to target_dist
            lo, hi = 0, n - 1
            while lo < hi:
                mid = (lo + hi) // 2
                if arc[mid] < target_dist:
                    lo = mid + 1
                else:
                    hi = mid
            # Skip if too close to start or end
            if lo <= start_idx + 2 or lo >= n - 2:
                continue
            position = raw_trace[lo]["position"]
            checkpoints.insert(len(checkpoints) - 1 if circuit_type == "LOOP" else len(checkpoints), {
                "order":     0,  # reordered below
                "position":  position,
                "direction": _direction_at(raw_trace, lo),
                "radius":    100,
                "type":      "checkpoint",
            })
            inserted += 1

        # Reorder all checkpoints sequentially
        for idx, cp in enumerate(checkpoints):
            cp["order"] = idx
        if inserted:
            log.info("Auto-generated %d checkpoints (spacing ~%.0fm, total %.0fm)", inserted, total_len / num_intervals, total_len)

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


def _filter_trace(raw_trace, filter_cfg=None):
    """Filter outliers via speed check, IQR, angular coherence, then RDP simplification.

    filter_cfg overrides global config values for each filter stage.
    Gap entries (gap=True, position=None) are preserved as-is and skipped by all filter stages.
    """
    _MIN_SURVIVORS = 5

    def _cfg_bool(key, fallback):
        if filter_cfg and key in filter_cfg:
            v = filter_cfg[key]
            return v if isinstance(v, bool) else str(v).lower() == "true"
        return config.getboolean("filters", key, fallback=fallback)

    def _cfg_float(key, fallback):
        if filter_cfg and key in filter_cfg:
            return float(filter_cfg[key])
        return config.getfloat("filters", key, fallback=fallback)

    speed_enabled   = _cfg_bool("speed_enabled",   True)
    speed_max_ms    = _cfg_float("speed_max_ms",    3000.0)
    iqr_enabled     = _cfg_bool("iqr_enabled",      True)
    iqr_multiplier  = _cfg_float("iqr_multiplier",  1.5)
    angular_enabled = _cfg_bool("angular_enabled",  False)
    max_angle_deg   = _cfg_float("angular_max_angle", 120.0)
    rdp_enabled     = _cfg_bool("rdp_enabled",      False)
    rdp_tolerance   = _cfg_float("rdp_tolerance",   1.0)

    def _dist(a, b):
        return math.sqrt(sum((a["position"][k] - b["position"][k]) ** 2 for k in range(3)))

    # Separate gap entries so filters only operate on real positions
    real_pts = [p for p in raw_trace if not p.get("gap")]

    if len(real_pts) < _MIN_SURVIVORS:
        return list(raw_trace)

    # Step 1 — IQR filter: two passes per axis. Runs first because it handles dense
    # clusters of aberrant points that would defeat the bidirectional speed check.
    # Second pass tightens bounds on already-cleaned data to catch subtler errors.
    def _iqr_filter(pts):
        axes = [[p["position"][i] for p in pts] for i in range(3)]
        bounds = []
        for vals in axes:
            sv = sorted(vals)
            n = len(sv)
            q1, q3 = sv[n // 4], sv[(3 * n) // 4]
            iqr = q3 - q1
            bounds.append((q1 - iqr_multiplier * iqr, q3 + iqr_multiplier * iqr))
        return [p for p in pts if all(bounds[i][0] <= p["position"][i] <= bounds[i][1] for i in range(3))]

    if iqr_enabled:
        filtered = _iqr_filter(real_pts)
        if len(filtered) >= _MIN_SURVIVORS:
            filtered2 = _iqr_filter(filtered)
            if len(filtered2) >= _MIN_SURVIVORS:
                filtered = filtered2
        else:
            filtered = list(real_pts)
    else:
        filtered = list(real_pts)

    # Step 2 — Speed filter: iteratively remove points whose speed to both neighbours
    # exceeds the threshold. Runs after IQR so only residual outliers remain (e.g. a
    # single wrong digit that IQR bounds couldn't catch). Iterates until stable.
    if speed_enabled:
        def _speed_pass(pts):
            if len(pts) < 3:
                return list(pts)
            keep = [True] * len(pts)
            for i in range(1, len(pts) - 1):
                dt_prev = pts[i]["t"] - pts[i - 1]["t"]
                dt_next = pts[i + 1]["t"] - pts[i]["t"]
                if dt_prev <= 0 or dt_next <= 0:
                    continue
                v_prev = _dist(pts[i], pts[i - 1]) / dt_prev
                v_next = _dist(pts[i + 1], pts[i]) / dt_next
                if v_prev > speed_max_ms and v_next > speed_max_ms:
                    keep[i] = False
            return [p for p, k in zip(pts, keep) if k]

        prev_len = -1
        while len(filtered) != prev_len:
            prev_len = len(filtered)
            candidate = _speed_pass(filtered)
            if len(candidate) >= _MIN_SURVIVORS:
                filtered = candidate
            else:
                break

    # Step 3 — Angular filter: iteratively remove points creating a direction reversal
    if angular_enabled:
        cos_threshold = math.cos(math.radians(max_angle_deg))

        def _angular_pass(pts):
            if len(pts) < 3:
                return pts
            keep = [True] * len(pts)
            for i in range(1, len(pts) - 1):
                a = pts[i - 1]["position"]
                b = pts[i]["position"]
                c = pts[i + 1]["position"]
                ab = [b[j] - a[j] for j in range(3)]
                bc = [c[j] - b[j] for j in range(3)]
                mag_ab = math.sqrt(sum(v * v for v in ab))
                mag_bc = math.sqrt(sum(v * v for v in bc))
                if mag_ab < 1e-6 or mag_bc < 1e-6:
                    continue
                dot = sum(ab[j] * bc[j] for j in range(3)) / (mag_ab * mag_bc)
                if dot < cos_threshold:
                    keep[i] = False
            return [p for p, k in zip(pts, keep) if k]

        prev_len = -1
        while len(filtered) != prev_len:
            prev_len = len(filtered)
            filtered = _angular_pass(filtered)
            if len(filtered) < _MIN_SURVIVORS:
                filtered = _iqr_filter(real_pts) if iqr_enabled else list(real_pts)
                break

    # Step 4 — RDP simplification: reduce point count while preserving shape.
    # Uses Ramer-Douglas-Peucker on the XY plane (ignores altitude for simplification).
    if rdp_enabled and len(filtered) >= 3:
        def _rdp(pts, tolerance):
            if len(pts) <= 2:
                return list(pts)
            start, end = pts[0]["position"], pts[-1]["position"]
            dx, dy = end[0] - start[0], end[1] - start[1]
            seg_len = math.sqrt(dx * dx + dy * dy)
            max_dist, max_idx = 0.0, 0
            for i in range(1, len(pts) - 1):
                px, py = pts[i]["position"][0], pts[i]["position"][1]
                if seg_len < 1e-10:
                    d = math.sqrt((px - start[0]) ** 2 + (py - start[1]) ** 2)
                else:
                    d = abs(dy * px - dx * py + end[0] * start[1] - end[1] * start[0]) / seg_len
                if d > max_dist:
                    max_dist, max_idx = d, i
            if max_dist > tolerance:
                left  = _rdp(pts[:max_idx + 1], tolerance)
                right = _rdp(pts[max_idx:], tolerance)
                return left[:-1] + right
            return [pts[0], pts[-1]]

        simplified = _rdp(filtered, rdp_tolerance)
        if len(simplified) >= _MIN_SURVIVORS:
            filtered = simplified

    return filtered


def _export_svg(raw_trace, marks, filename, circuit_type="LOOP"):
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

    # Fit to a 500×500 viewBox with padding, transparent background
    pad = 40
    vw, vh = 500, 500
    scale = min((vw - 2 * pad) / span_x, (vh - 2 * pad) / span_y)

    def tx(x):
        return pad + (x - min_x) * scale

    def ty(y):
        return vh - pad - (y - min_y) * scale

    n = len(filtered)
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vw} {vh}">\n'

    # Trace
    for i in range(1, n):
        x1, y1 = tx(filtered[i - 1]["position"][0]), ty(filtered[i - 1]["position"][1])
        x2, y2 = tx(filtered[i]["position"][0]), ty(filtered[i]["position"][1])
        svg += (
            f'  <line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}"'
            f' stroke="#e5e5e5" stroke-width="2" stroke-linecap="round"/>\n'
        )

    # Intermediate checkpoint markers
    checkpoint_marks = [m for m in marks if m["type_hint"] == "checkpoint"]
    for mark in checkpoint_marks:
        if mark["trace_idx"] < len(raw_trace):
            pos = raw_trace[mark["trace_idx"]]["position"]
            svg += (
                f'  <circle cx="{tx(pos[0]):.1f}" cy="{ty(pos[1]):.1f}"'
                f' r="5" fill="#404040" stroke="#e5e5e5" stroke-width="1.5"/>\n'
            )

    sp = filtered[0]["position"]
    ep = filtered[-1]["position"]

    # LOOP closure line (before markers so markers render on top)
    if circuit_type == "LOOP":
        svg += (
            f'  <line x1="{tx(ep[0]):.1f}" y1="{ty(ep[1]):.1f}"'
            f' x2="{tx(sp[0]):.1f}" y2="{ty(sp[1]):.1f}"'
            f' stroke="#525252" stroke-width="1.5" stroke-dasharray="6,4" stroke-linecap="round"/>\n'
        )

    # Start/finish markers — single point if LOOP and positions are close, separate otherwise
    _SAME_THRESHOLD = 10.0
    dist_sf = math.sqrt(sum((sp[k] - ep[k]) ** 2 for k in range(3)))
    if circuit_type == "LOOP" and dist_sf < _SAME_THRESHOLD:
        svg += (
            f'  <circle cx="{tx(sp[0]):.1f}" cy="{ty(sp[1]):.1f}"'
            f' r="6" fill="#e5e5e5" stroke="#262626" stroke-width="1.5"/>\n'
        )
    else:
        svg += (
            f'  <circle cx="{tx(sp[0]):.1f}" cy="{ty(sp[1]):.1f}"'
            f' r="6" fill="#22c55e" stroke="#262626" stroke-width="1.5"/>\n'
            f'  <circle cx="{tx(ep[0]):.1f}" cy="{ty(ep[1]):.1f}"'
            f' r="6" fill="#ef4444" stroke="#262626" stroke-width="1.5"/>\n'
        )

    svg += "</svg>"

    with open(filename, "w", encoding="utf-8") as f:
        f.write(svg)
    log.info("SVG exported: %s (%d/%d points)", filename, len(filtered), len(raw_trace))


def _segment_crosses_gate(p1, p2, center, normal, radius):
    """Return True if segment [p1,p2] crosses the finite disk defined by center/normal/radius."""
    def dot(a, b): return sum(a[k] * b[k] for k in range(3))
    def sub(a, b): return [a[k] - b[k] for k in range(3)]
    d1 = dot(sub(p1, center), normal)
    d2 = dot(sub(p2, center), normal)
    if d1 * d2 > 0:
        return False
    if d1 == d2:
        return d1 == 0
    t = d1 / (d1 - d2)
    ix = p1[0] + t * (p2[0] - p1[0])
    iy = p1[1] + t * (p2[1] - p1[1])
    iz = p1[2] + t * (p2[2] - p1[2])
    dx, dy, dz = ix - center[0], iy - center[1], iz - center[2]
    return dx * dx + dy * dy + dz * dz <= radius * radius


def _truncate_loop_trace(raw_trace, marks, circuit_type):
    """For LOOP circuits, truncate raw_trace at the first re-crossing of the start gate (legacy 3D disk)."""
    if circuit_type != "LOOP" or len(marks) < 1:
        return raw_trace

    start_mark = next((m for m in marks if m["type_hint"] == "start"), None)
    if start_mark is None:
        return raw_trace

    start_idx = start_mark["trace_idx"]
    if start_idx >= len(raw_trace):
        return raw_trace

    start_pos = raw_trace[start_idx]["position"]

    _MIN_DIST = 0.5
    n = len(raw_trace)
    prev_pos = start_pos
    for j in range(start_idx - 1, -1, -1):
        d = math.sqrt(sum((raw_trace[j]["position"][k] - start_pos[k]) ** 2 for k in range(3)))
        if d >= _MIN_DIST:
            prev_pos = raw_trace[j]["position"]
            break
    nxt_pos = start_pos
    for j in range(start_idx + 1, n):
        d = math.sqrt(sum((raw_trace[j]["position"][k] - start_pos[k]) ** 2 for k in range(3)))
        if d >= _MIN_DIST:
            nxt_pos = raw_trace[j]["position"]
            break
    normal = _normalize([nxt_pos[k] - prev_pos[k] for k in range(3)])

    _SKIP_AFTER_START = 10
    search_from = start_idx + _SKIP_AFTER_START

    for i in range(search_from, n - 1):
        p1 = raw_trace[i]["position"]
        p2 = raw_trace[i + 1]["position"]
        if _segment_crosses_gate(p1, p2, start_pos, normal, 150):
            log.info("Loop closure detected at trace index %d — truncating %d trailing points", i, n - i - 1)
            return raw_trace[:i + 1]

    return raw_trace


def _truncate_loop_trace_v2(raw_trace, marks, circuit_type):
    """For LOOP circuits, truncate at first re-crossing of a 2D XZ perpendicular gate (more robust)."""
    if circuit_type != "LOOP" or len(marks) < 1:
        return raw_trace

    start_mark = next((m for m in marks if m["type_hint"] == "start"), None)
    if start_mark is None:
        return raw_trace

    start_idx = start_mark["trace_idx"]
    # Only consider real (non-gap) points for position lookups
    real_pts = [(i, p) for i, p in enumerate(raw_trace) if not p.get("gap") and p["position"] is not None]
    if not real_pts or start_idx >= len(raw_trace):
        return raw_trace

    start_pos = raw_trace[start_idx]["position"]
    sx, sz = start_pos[0], start_pos[2]

    # Compute travel direction in XZ at the start mark
    _MIN_DIST = 0.5
    dx, dz = 0.0, 1.0
    for _, p in reversed([(i, p) for i, p in real_pts if i < start_idx]):
        d = math.sqrt((p["position"][0] - sx) ** 2 + (p["position"][2] - sz) ** 2)
        if d >= _MIN_DIST:
            break
    for _, p in [(i, p) for i, p in real_pts if i > start_idx]:
        d = math.sqrt((p["position"][0] - sx) ** 2 + (p["position"][2] - sz) ** 2)
        if d >= _MIN_DIST:
            fwd = [p["position"][0] - sx, p["position"][2] - sz]
            mag = math.sqrt(fwd[0] ** 2 + fwd[1] ** 2)
            if mag > 1e-6:
                dx, dz = fwd[0] / mag, fwd[1] / mag
            break

    # Gate: perpendicular segment of half-width 80m centered on (sx, sz)
    # Perpendicular to (dx, dz) is (-dz, dx)
    _GATE_HALF_WIDTH = 80.0
    gx1 = sx + _GATE_HALF_WIDTH * (-dz)
    gz1 = sz + _GATE_HALF_WIDTH * dx
    gx2 = sx - _GATE_HALF_WIDTH * (-dz)
    gz2 = sz - _GATE_HALF_WIDTH * dx

    def _seg2d_intersect(ax, az, bx, bz, cx, cz, ex, ez):
        """Return True if segment AB intersects segment CE in 2D."""
        def cross2d(ux, uz, vx, vz):
            return ux * vz - uz * vx
        denom = cross2d(bx - ax, bz - az, ex - cx, ez - cz)
        if abs(denom) < 1e-10:
            return False
        t = cross2d(cx - ax, cz - az, ex - cx, ez - cz) / denom
        u = cross2d(cx - ax, cz - az, bx - ax, bz - az) / denom
        return 0.0 <= t <= 1.0 and 0.0 <= u <= 1.0

    _SKIP_AFTER_START = 10
    n = len(raw_trace)
    search_from = start_idx + _SKIP_AFTER_START

    for i in range(search_from, n - 1):
        p1 = raw_trace[i]
        p2 = raw_trace[i + 1]
        if p1.get("gap") or p2.get("gap"):
            continue
        ax, az = p1["position"][0], p1["position"][2]
        bx, bz = p2["position"][0], p2["position"][2]

        if not _seg2d_intersect(ax, az, bx, bz, gx1, gz1, gx2, gz2):
            continue

        # Verify forward crossing: travel direction must match initial direction
        travel_x, travel_z = bx - ax, bz - az
        if dx * travel_x + dz * travel_z < 0:
            continue  # backward crossing — skip

        log.info("Loop closure (v2) detected at trace index %d — truncating %d trailing points", i, n - i - 1)
        return raw_trace[:i + 1]

    log.info("Loop closure (v2): no gate crossing found, returning full trace")
    return raw_trace


def _export_record():
    """Export raw JSON + SVG from current record state. No filtering or checkpoint generation — that's the editor's job."""
    with state.lock:
        raw_trace = list(state.raw_trace)
        marks = list(state.marks)
        circuit_name = state.circuit_name
        circuit_type = state.circuit_type

    if not marks:
        log.info("Record: no marks — nothing exported.")
        return

    output = {
        "name":                circuit_name,
        "type":                circuit_type,
        "recordedBy":          "",
        "recordedAt":          datetime.datetime.now(datetime.UTC).isoformat(),
        "defaultBufferRadius": 500,
        "marks":               marks,
        "rawTrace":            raw_trace,
    }

    base_name = f"{circuit_name.replace(' ', '_')}_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
    json_path = DATA_DIR / f"{base_name}.json"
    svg_path = DATA_DIR / f"{base_name}.svg"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)
    log.info("Trace exported: %s (%d points, %d marks)", json_path, len(raw_trace), len(marks))

    with state.lock:
        state.last_export_path = json_path

    _export_svg(raw_trace, marks, str(svg_path), circuit_type=circuit_type)


# ---------------------------------------------------------------------------
# Mode RECORD loop
# ---------------------------------------------------------------------------

def run_record_loop():
    delta_time_s = config.getfloat("debug", "record_delta_time_s", fallback=0.5)

    with state.lock:
        state.recording = False  # capture starts only after user presses Start
        state.raw_trace = []
        state.marks = []
        state.finished = False
        state.record_t0 = time.time()
        state.pending_start_mark = False

    hk_start      = config.get("hotkeys", "record_start",       fallback="ctrl+num 1")
    hk_checkpoint = config.get("hotkeys", "record_checkpoint",  fallback="ctrl+num 2")
    hk_stop       = config.get("hotkeys", "record_finish",      fallback="ctrl+num 3")
    hk_cancel     = config.get("hotkeys", "record_cancel",      fallback="ctrl+num 4")

    def on_start():
        with state.lock:
            if state.recording:
                return  # already started
            state.recording = True
            state.raw_trace = []
            state.marks = []
            state.record_t0 = time.time()
            state.last_export_path = None
            state.pending_start_mark = True
        log.info("[%s] START — capture begins", hk_start)

    def on_checkpoint():
        with state.lock:
            if not state.recording or not state.raw_trace:
                return
            state.marks.append({
                "order": len(state.marks),
                "trace_idx": len(state.raw_trace) - 1,
                "type_hint": "checkpoint",
            })
        log.info("[%s] CHECKPOINT marked", hk_checkpoint)

    def on_stop():
        with state.lock:
            if not state.recording or not state.raw_trace:
                return
            state.marks.append({
                "order": len(state.marks),
                "trace_idx": len(state.raw_trace) - 1,
                "type_hint": "finish",
            })
            state.finished = True
            state.recording = False
        log.info("[%s] STOP marked", hk_stop)

    def on_cancel():
        with state.lock:
            state.finished = True
            state.recording = False
            state.marks = []
        log.info("[%s] Record cancelled", hk_cancel)

    keyboard.add_hotkey(hk_start,      on_start)
    keyboard.add_hotkey(hk_checkpoint, on_checkpoint)
    keyboard.add_hotkey(hk_stop,       on_stop)
    keyboard.add_hotkey(hk_cancel,     on_cancel)

    log.info("RECORD loop started")
    while True:
        with state.lock:
            if state.mode != "RECORD":
                break
            if state.finished:
                break

        pos = _capture_pos()
        wall_t = time.time()
        with state.lock:
            # Reject point if it falls outside the anchor radius
            if pos and state.anchor_position and calculate_distance(pos, state.anchor_position) > state.anchor_radius:
                log.debug("Point rejected by anchor filter: dist=%.1f > %.1f", calculate_distance(pos, state.anchor_position), state.anchor_radius)
                pos = None
            if pos:
                now = datetime.datetime.now(datetime.UTC).isoformat()
                state.position = pos
                state.last_ocr_at = now
                if state.recording:
                    state.raw_trace.append({"t": round(wall_t - state.record_t0, 2), "position": pos})
                    if state.pending_start_mark:
                        state.marks.append({
                            "order": 0,
                            "trace_idx": len(state.raw_trace) - 1,
                            "type_hint": "start",
                        })
                        state.pending_start_mark = False
            elif state.recording:
                # OCR failed during active recording — insert a gap marker
                state.raw_trace.append({"t": round(time.time() - state.record_t0, 2), "position": None, "gap": True})

        time.sleep(delta_time_s)

    keyboard.remove_all_hotkeys()
    _export_record()   # called exactly once per session
    log.info("RECORD loop stopped")


# ---------------------------------------------------------------------------
# Monitor thread — dispatches RACE or RECORD loop
# ---------------------------------------------------------------------------

def monitor_thread():
    while True:
        with state.lock:
            mode = state.mode
            finished = state.finished

        if mode == "RACE":
            run_race_loop()
        elif mode == "RECORD":
            if not finished:
                run_record_loop()
                # After the loop ends (stop or cancel), reset finished so the user can start again
                with state.lock:
                    if state.mode == "RECORD":
                        state.finished = False
            else:
                time.sleep(0.2)
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
            "has_export": state.last_export_path is not None and state.last_export_path.exists(),
            "last_export_name": state.last_export_path.stem if state.last_export_path and state.last_export_path.exists() else None,
            "last_capture_test": state.last_capture_test,
            "anchor_position": state.anchor_position,
            "anchor_radius": state.anchor_radius,
        })


@flask_app.route("/api/mode", methods=["POST"])
def api_set_mode():
    data = request.get_json(force=True)
    new_mode = data.get("mode", "RACE")
    if new_mode not in ("RACE", "RECORD"):
        return jsonify({"error": "invalid mode"}), 400
    with state.lock:
        state.mode = new_mode
        # RACE: finished=True breaks the current RECORD loop.
        # RECORD: finished=False so monitor_thread launches run_record_loop immediately.
        state.finished = new_mode != "RECORD"
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
            if state.recording:
                return jsonify({"error": "already recording"}), 400
            if state.mode != "RECORD":
                return jsonify({"error": "not in RECORD mode"}), 400
            state.recording = True
            state.raw_trace = []
            state.marks = []
            state.record_t0 = time.time()
            state.last_export_path = None
            state.pending_start_mark = True

    elif action == "checkpoint":
        with state.lock:
            if not state.recording or not state.raw_trace:
                return jsonify({"error": "not recording"}), 400
            state.marks.append({
                "order": len(state.marks),
                "trace_idx": len(state.raw_trace) - 1,
                "type_hint": "checkpoint",
            })

    elif action == "stop":
        with state.lock:
            if not state.recording or not state.raw_trace:
                return jsonify({"error": "not recording"}), 400
            state.marks.append({
                "order": len(state.marks),
                "trace_idx": len(state.raw_trace) - 1,
                "type_hint": "finish",
            })
            state.finished = True
            state.recording = False
        # _export_record() will be called by run_record_loop() when it detects finished=True

    elif action == "cancel":
        with state.lock:
            state.finished = True
            state.recording = False
            state.marks = []
        # No export on cancel

    return jsonify({"ok": True})


@flask_app.route("/api/record/last")
def api_record_last():
    with state.lock:
        path = state.last_export_path
    if not path or not path.exists():
        return jsonify({"error": "no export available"}), 404
    return send_file(str(path), as_attachment=True, download_name=path.name)


@flask_app.route("/api/record/last-json")
def api_record_last_json():
    """Return the last exported circuit JSON as a response body (for the editor)."""
    with state.lock:
        path = state.last_export_path
    if not path or not path.exists():
        return jsonify({"error": "no export available"}), 404
    with open(path, encoding="utf-8") as f:
        return jsonify(json.load(f))


@flask_app.route("/api/editor/export", methods=["POST"])
def api_editor_export():
    """Accept a circuit JSON body, write it to data/ with a timestamp, return the filename."""
    data = request.get_json(force=True)
    name = data.get("name", "Edited_Circuit")
    base = f"{name.replace(' ', '_')}_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
    path = DATA_DIR / f"{base}.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    log.info("Editor export: %s", path)
    return jsonify({"ok": True, "filename": path.name})


@flask_app.route("/api/editor/preview-filter", methods=["POST"])
def api_editor_preview_filter():
    """Run _filter_trace with custom filter_config and return the filtered trace."""
    data = request.get_json(force=True)
    raw_trace = data.get("raw_trace", [])
    filter_cfg = data.get("filter_config", {})
    filtered = _filter_trace(raw_trace, filter_cfg)
    return jsonify({"filtered": filtered})


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

        ocr_text = pytesseract.image_to_string(processed, config="--oem 3 --psm 7 -c tessedit_char_whitelist=0123456789.km-RootPs:")
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


@flask_app.route("/api/anchor", methods=["POST"])
def api_anchor():
    data = request.get_json(force=True)
    pos = data.get("position")   # [x, y, z] or null to clear
    radius = data.get("radius")
    with state.lock:
        state.anchor_position = pos
        if radius is not None:
            state.anchor_radius = float(radius)
    return jsonify({"anchor_position": state.anchor_position, "anchor_radius": state.anchor_radius})


@flask_app.route("/api/config", methods=["GET"])
def api_get_config():
    return jsonify({
        "token": config.get("auth", "token", fallback=""),
        "url": config.get("server", "url", fallback=""),
        "monitor_index": config.getint("screen", "monitor_index", fallback=1),
        "delta_time_s": config.getfloat("debug", "delta_time_s", fallback=1.0),
        "record_delta_time_s": config.getfloat("debug", "record_delta_time_s", fallback=0.5),
        "checkpoint_save": config.getboolean("debug", "checkpoint_save", fallback=False),
        "checkpoint_save_distance": config.getint("debug", "checkpoint_save_distance", fallback=150),
        "auto_checkpoint_spacing": config.getfloat("debug", "auto_checkpoint_spacing", fallback=150.0),
        "hotkey_test_capture":      config.get("hotkeys", "test_capture",       fallback="alt+t"),
        "hotkey_record_start":      config.get("hotkeys", "record_start",       fallback="alt+num 1"),
        "hotkey_record_checkpoint": config.get("hotkeys", "record_checkpoint",  fallback="alt+num 2"),
        "hotkey_record_finish":     config.get("hotkeys", "record_finish",      fallback="alt+num 3"),
        "hotkey_record_cancel":     config.get("hotkeys", "record_cancel",      fallback="alt+num 4"),
        "filter_jump_enabled":      config.getboolean("filters", "jump_enabled",    fallback=True),
        "filter_jump_threshold":    config.getfloat("filters",   "jump_threshold",  fallback=500.0),
        "filter_iqr_enabled":       config.getboolean("filters", "iqr_enabled",     fallback=True),
        "filter_iqr_multiplier":    config.getfloat("filters",   "iqr_multiplier",  fallback=1.5),
        "filter_angular_enabled":   config.getboolean("filters", "angular_enabled", fallback=True),
        "filter_angular_max_angle": config.getfloat("filters",   "angular_max_angle", fallback=120.0),
        "filter_rolling_enabled":   config.getboolean("filters", "rolling_enabled", fallback=True),
        "filter_rolling_window":    config.getint("filters",     "rolling_window",  fallback=5),
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
    if "record_delta_time_s" in data:
        config["debug"]["record_delta_time_s"] = str(float(data["record_delta_time_s"]))
    if "checkpoint_save" in data:
        config["debug"]["checkpoint_save"] = str(bool(data["checkpoint_save"]))
    if "checkpoint_save_distance" in data:
        config["debug"]["checkpoint_save_distance"] = str(int(data["checkpoint_save_distance"]))
    if "auto_checkpoint_spacing" in data:
        config["debug"]["auto_checkpoint_spacing"] = str(float(data["auto_checkpoint_spacing"]))
    if not config.has_section("hotkeys"):
        config.add_section("hotkeys")
    for key in ("test_capture", "record_start", "record_checkpoint", "record_finish", "record_cancel"):
        payload_key = f"hotkey_{key}"
        if payload_key in data:
            config["hotkeys"][key] = str(data[payload_key])

    if not config.has_section("filters"):
        config.add_section("filters")
    _filter_bool_keys = ("jump_enabled", "iqr_enabled", "angular_enabled", "rolling_enabled")
    _filter_float_keys = ("jump_threshold", "iqr_multiplier", "angular_max_angle")
    _filter_int_keys = ("rolling_window",)
    for key in _filter_bool_keys:
        payload_key = f"filter_{key}"
        if payload_key in data:
            config["filters"][key] = str(bool(data[payload_key])).lower()
    for key in _filter_float_keys:
        payload_key = f"filter_{key}"
        if payload_key in data:
            config["filters"][key] = str(float(data[payload_key]))
    for key in _filter_int_keys:
        payload_key = f"filter_{key}"
        if payload_key in data:
            config["filters"][key] = str(int(data[payload_key]))

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

            ocr_text = pytesseract.image_to_string(processed, config="--oem 3 --psm 7 -c tessedit_char_whitelist=0123456789.km-RootPs:")
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

    hk_test_capture = config.get("hotkeys", "test_capture", fallback="alt+t")
    keyboard.add_hotkey(hk_test_capture, _on_test_capture_hotkey)

    # Give Flask a moment to bind before opening the browser
    time.sleep(0.8)
    webbrowser.open(f"http://127.0.0.1:{PORT}")

    threading.Event().wait()


main()
