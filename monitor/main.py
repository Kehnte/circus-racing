import time
import os
import re
import math
import sys
import json
import datetime
import configparser
from pathlib import Path

import mss
import mss.tools
from PIL import Image
import pytesseract

import requests
import keyboard

import win32gui


def _get_tesseract_cmd() -> str:
    """Return the full path to the tesseract executable.

    When packaged with PyInstaller, the tesseract distribution is bundled
    under the `tesseract/` directory inside the extracted runtime path.
    """
    if getattr(sys, "frozen", False):
        base = Path(sys._MEIPASS)
        tesseract_path = base / "tesseract" / "tesseract.exe"
        if tesseract_path.exists():
            tessdata = base / "tesseract" / "tessdata"
            if tessdata.exists():
                os.environ["TESSDATA_PREFIX"] = str(tessdata) + os.sep
            return str(tesseract_path)

    if "Tesseract" not in os.environ.get("PATH", "") and os.path.isdir("C:/Program Files/Tesseract-OCR"):
        print("tesseract.exe not found in PATH, but found in C:/Program Files/Tesseract-OCR. Using that.")
        return "C:/Program Files/Tesseract-OCR/tesseract.exe"

    return "tesseract/tesseract.exe"


pytesseract.pytesseract.tesseract_cmd = _get_tesseract_cmd()


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

    raise FileNotFoundError(
        "config.cfg not found. Copy config.example.cfg to config.cfg and adjust the values."
    )


config = _load_config()

base_url = config["server"]["url"]
checkpoint_save = config["debug"].getboolean("checkpoint_save")
checkpoint_save_distance = int(config["debug"]["checkpoint_save_distance"])

resolution_width = int(config["screen"]["resolution_width"])
resolution_height = int(config["screen"]["resolution_height"])

delta_time_s = float(config["debug"]["delta_time_s"])

last_pos = None


# ---------------------------------------------------------------------------
# OCR helpers
# ---------------------------------------------------------------------------

pattern = r"Pos:\s*([+-]?\d+(?:\.\d+)?)km\s+([+-]?\d+(?:\.\d+)?)km\s+([+-]?\d+(?:\.\d+)?)km"


def parse_pos(text: str):
    text = text.replace(',', '.')
    text = text.replace('. ', '.')
    match = re.search(pattern, text)
    if match:
        x, y, z = map(float, match.groups())
        return [x * 1000, y * 1000, z * 1000]
    print("Position not found")
    return None


def _capture_pos():
    """Capture the HUD area and return parsed position, or None."""
    with mss.mss() as sct:
        mon = sct.monitors[0]
        width  = 0.30 * resolution_width
        top    = 0.04 * resolution_height
        height = 0.03 * resolution_height
        monitor = {
            "top": int(top),
            "left": int(mon["width"] - width),
            "width": int(width),
            "height": int(height),
        }
        capture = sct.grab(monitor)
        mss.tools.to_png(capture.rgb, capture.size, output="capture.png")

    img = Image.open("capture.png")
    text = pytesseract.image_to_string(img, lang="eng", config="--psm 7")
    print(text)
    return parse_pos(text)


def write_checkpoint(pos):
    with open("checkpoints.txt", "a") as f:
        f.write(":".join(str(k) for k in pos) + "\n")


def calculate_distance(pos1, pos2):
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(pos1, pos2)))


def save_config():
    with open("config.cfg", "w") as f:
        config.write(f)


# ---------------------------------------------------------------------------
# Mode RACE
# ---------------------------------------------------------------------------

def run_race():
    global last_pos
    print("Circus Racing Monitor — Mode RACE")
    print("Lancez Star Citizen pour démarrer le suivi de positions")

    while True:
        active_win = win32gui.GetForegroundWindow()
        window_title = win32gui.GetWindowText(active_win)

        if window_title.strip() == "Star Citizen":
            t1 = time.time()
            pos = _capture_pos()
            print("duration", time.time() - t1)

            if pos:
                if not last_pos:
                    last_pos = pos
                    write_checkpoint(pos)
                else:
                    if calculate_distance(last_pos, pos) > checkpoint_save_distance and checkpoint_save:
                        write_checkpoint(pos)
                        last_pos = pos

                send_position(pos)

        time.sleep(delta_time_s)


def send_position(positions):
    res = requests.put(
        f"{base_url}/api/ocr/position",
        json={"x": positions[0], "y": positions[1], "z": positions[2]},
        headers={"x-token": config["auth"]["token"]},
    )
    print(res.status_code, res.text)


# ---------------------------------------------------------------------------
# Mode RECORD
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

    # Fermeture LOOP : le finish reprend la position du start, direction moyennée
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


def run_record():
    raw_trace = []   # list of {"t": float, "position": [x, y, z]}
    marks     = []   # list of {"order": int, "trace_idx": int, "type_hint": str}
    recording = False
    finished  = False

    print("=== MODE RECORD ===")
    print("Touches : [S] START  [C] CHECKPOINT  [F] FINISH  [Q] Annuler")
    circuit_name = input("Nom du circuit : ").strip() or "Circuit"
    circuit_type = input("Type [LOOP/POINT_TO_POINT] (défaut: LOOP) : ").strip().upper() or "LOOP"
    if circuit_type not in ("LOOP", "POINT_TO_POINT"):
        circuit_type = "LOOP"
    recorded_by = input("Ton pseudo (optionnel) : ").strip()

    def on_s(e):
        nonlocal recording
        if not raw_trace:
            print("[S] Pas encore de position — attends que Star Citizen soit actif.")
            return
        marks.append({"order": len(marks), "trace_idx": len(raw_trace) - 1, "type_hint": "start"})
        recording = True
        print(f"[S] START marqué à {raw_trace[-1]['position']}")

    def on_c(e):
        if not recording or not raw_trace:
            return
        marks.append({"order": len(marks), "trace_idx": len(raw_trace) - 1, "type_hint": "checkpoint"})
        print(f"[C] CHECKPOINT {len(marks) - 1} marqué")

    def on_f(e):
        nonlocal finished
        if not recording or not raw_trace:
            return
        marks.append({"order": len(marks), "trace_idx": len(raw_trace) - 1, "type_hint": "finish"})
        finished = True
        print("[F] FINISH marqué — export en cours...")

    def on_q(e):
        nonlocal finished
        finished = True
        marks.clear()
        print("[Q] Enregistrement annulé")

    keyboard.on_press_key("s", on_s)
    keyboard.on_press_key("c", on_c)
    keyboard.on_press_key("f", on_f)
    keyboard.on_press_key("q", on_q)

    t0 = time.time()
    while not finished:
        active_win = win32gui.GetForegroundWindow()
        if win32gui.GetWindowText(active_win).strip() == "Star Citizen":
            pos = _capture_pos()
            if pos:
                raw_trace.append({"t": round(time.time() - t0, 2), "position": pos})
        time.sleep(delta_time_s)

    keyboard.unhook_all()

    if not marks:
        print("Aucun checkpoint marqué, rien exporté.")
        return

    checkpoints = _build_checkpoints(raw_trace, marks, circuit_type)
    output = {
        "name":                circuit_name,
        "type":                circuit_type,
        "recordedBy":          recorded_by,
        "recordedAt":          datetime.datetime.utcnow().isoformat() + "Z",
        "defaultBufferRadius": 500,
        "checkpoints":         checkpoints,
        "rawTrace":            raw_trace,
    }

    fname = f"{circuit_name.replace(' ', '_')}_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(fname, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)
    print(f"Tracé exporté : {fname}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def run():
    mode = "record" if "--record" in sys.argv else None
    if mode is None:
        choice = input("Mode [1=RACE, 2=RECORD] : ").strip()
        mode = "record" if choice == "2" else "race"

    if mode == "record":
        run_record()
    else:
        run_race()


run()
