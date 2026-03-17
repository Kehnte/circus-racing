"""Build the Circus Racing Monitor executable using PyInstaller.

Usage:
    python build.py

The build script expects a `tesseract/` folder next to this file containing a Windows
Tesseract-OCR runtime (tesseract.exe + tessdata/). When present, it will be bundled
into the final executable and `main.py` will point pytesseract at the bundled binary.

If you do not have the runtime, download a Windows build of Tesseract (e.g. from
https://github.com/UB-Mannheim/tesseract/releases) and extract it into `tesseract/`.
"""

from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

BUILD_SPEC = "circus_racing_monitor.spec"


def _check_environment() -> int:
    try:
        import PyInstaller  # noqa: F401
    except ImportError:
        print("ERROR: PyInstaller must be installed. Run: python -m pip install pyinstaller")
        return 1

    if not Path(BUILD_SPEC).exists():
        print(f"ERROR: Spec file not found: {BUILD_SPEC}")
        return 1

    # Ensure the tesseract runtime is present so it gets bundled in the build.
    tesseract_dir = Path(__file__).parent / "tesseract"
    if not (tesseract_dir / "tesseract.exe").exists():
        print("WARNING: tesseract.exe not found in the tesseract/ folder.")
        print("         The built executable will rely on a system install of Tesseract.")
        print("         To bundle Tesseract, download a Windows build and extract it into tesseract/.\n")

    return 0


def main() -> int:
    shutil.copy("config.example.cfg", "config.cfg")

    # Ensure checkpoints.txt exists — required by the .spec as a bundled data file
    Path("checkpoints.txt").touch(exist_ok=True)

    ret = _check_environment()
    if ret != 0:
        return ret

    # Run PyInstaller using our spec file
    import PyInstaller.__main__

    args = [BUILD_SPEC, "--clean", "--noconfirm"]
    PyInstaller.__main__.run(args)

    print("\nBuild complete. Find the output under the dist/ directory.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
