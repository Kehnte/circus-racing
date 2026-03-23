# -*- mode: python ; coding: utf-8 -*-

import os
from PyInstaller.utils.hooks import collect_submodules
from PyInstaller.utils.hooks import collect_data_files
from PyInstaller.utils.hooks import collect_dynamic_libs

block_cipher = None

# Ensure the config and checkpoint files are included, as well as the UI and tesseract runtime.
datas = [
    ("config.cfg", "."),
    ("config.example.cfg", "."),
    ("ui", "ui"),
]

# Include the full tesseract runtime (binaries + tessdata) if it exists in the repo.
if os.path.isdir("tesseract"):
    datas.append(("tesseract", "tesseract"))

hiddenimports = [
    "flask",
    "werkzeug",
    "werkzeug.serving",
    "werkzeug.debug",
    "click",
    "jinja2",
    "itsdangerous",
]

a = Analysis(
    ["main.py"],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="circus-racing-monitor",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    name="circus-racing-monitor",
)
