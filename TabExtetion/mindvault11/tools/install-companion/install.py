#!/usr/bin/env python3
"""
MindVault — Full Windows Installer  (install.py)
Installs companion daemon + native messaging + opens extension pages.

USAGE:
    python tools/install-companion/install.py
    python tools/install-companion/install.py --auto-start
    python tools/install-companion/install.py --auto-start --force

REQUIREMENTS:
    Python 3.6+, Windows only (uses winreg + os.environ)
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

# ── Windows-only guard ────────────────────────────────────────────────────────
if sys.platform != "win32":
    print("ERROR: This installer is Windows-only.")
    sys.exit(1)

import winreg  # noqa: E402 — Windows-only import

# ── Colour helpers ────────────────────────────────────────────────────────────
# Use ANSI codes. Windows 10+ supports them in modern terminals.
# Fallback: just plain text if colours are not supported.
try:
    import ctypes
    ctypes.windll.kernel32.SetConsoleMode(
        ctypes.windll.kernel32.GetStdHandle(-11), 7
    )
except Exception:
    pass

CYAN    = "\033[96m"
GREEN   = "\033[92m"
YELLOW  = "\033[93m"
RED     = "\033[91m"
MAGENTA = "\033[95m"
GRAY    = "\033[90m"
WHITE   = "\033[97m"
RESET   = "\033[0m"


def step(msg):   print(f"  {CYAN}►{RESET} {msg}")
def ok(msg):     print(f"  {GREEN}✓{RESET} {msg}")
def warn(msg):   print(f"  {YELLOW}!{RESET} {msg}")
def fail(msg):   print(f"  {RED}✗{RESET} {msg}")
def info(msg):   print(f"    {GRAY}{msg}{RESET}")


# ── Constants ─────────────────────────────────────────────────────────────────
DAEMON_NAME   = "com.mindvault.companion"
TASK_NAME     = "MindVault Companion Daemon"
INSTALL_DIR   = Path(os.environ["LOCALAPPDATA"]) / "MindVault" / "bin"
DATA_DIR      = Path(os.environ["APPDATA"])      / "MindVault"
INSTALLED_BIN = INSTALL_DIR / "mvaultd.exe"
CR_MANIFEST   = Path(os.environ["LOCALAPPDATA"]) / "MindVault" / f"{DAEMON_NAME}.json"
FX_MANIFEST_D = Path(os.environ["APPDATA"])      / "Mozilla" / "NativeMessagingHosts"
FX_MANIFEST   = FX_MANIFEST_D / f"{DAEMON_NAME}.json"

# ── Browser definitions ───────────────────────────────────────────────────────
LOCALAPPDATA = Path(os.environ["LOCALAPPDATA"])
APPDATA      = Path(os.environ["APPDATA"])

BROWSERS = [
    {
        "name":    "Chrome",
        "exe":     LOCALAPPDATA / "Google/Chrome/Application/chrome.exe",
        "reg":     r"Software\Google\Chrome\NativeMessagingHosts",
        "url":     "chrome://extensions",
        "dist":    "dist",
        "is_fx":   False,
    },
    {
        "name":    "Chrome Beta",
        "exe":     LOCALAPPDATA / "Google/Chrome Beta/Application/chrome.exe",
        "reg":     r"Software\Google\Chrome Beta\NativeMessagingHosts",
        "url":     "chrome://extensions",
        "dist":    "dist",
        "is_fx":   False,
    },
    {
        "name":    "Chrome Dev",
        "exe":     LOCALAPPDATA / "Google/Chrome Dev/Application/chrome.exe",
        "reg":     r"Software\Google\Chrome Dev\NativeMessagingHosts",
        "url":     "chrome://extensions",
        "dist":    "dist",
        "is_fx":   False,
    },
    {
        "name":    "Chromium",
        "exe":     LOCALAPPDATA / "Chromium/Application/chrome.exe",
        "reg":     r"Software\Chromium\NativeMessagingHosts",
        "url":     "chrome://extensions",
        "dist":    "dist",
        "is_fx":   False,
    },
    {
        "name":    "Edge",
        "exe":     LOCALAPPDATA / "Microsoft/Edge/Application/msedge.exe",
        "reg":     r"Software\Microsoft\Edge\NativeMessagingHosts",
        "url":     "edge://extensions",
        "dist":    "dist",
        "is_fx":   False,
    },
    {
        "name":    "Edge Beta",
        "exe":     LOCALAPPDATA / "Microsoft/Edge Beta/Application/msedge.exe",
        "reg":     r"Software\Microsoft\Edge Beta\NativeMessagingHosts",
        "url":     "edge://extensions",
        "dist":    "dist",
        "is_fx":   False,
    },
    {
        "name":    "Brave",
        "exe":     LOCALAPPDATA / "BraveSoftware/Brave-Browser/Application/brave.exe",
        "reg":     r"Software\BraveSoftware\Brave-Browser\NativeMessagingHosts",
        "url":     "brave://extensions",
        "dist":    "dist",
        "is_fx":   False,
    },
    {
        "name":    "Opera",
        "exe":     APPDATA / "Opera Software/Opera Stable/opera.exe",
        "reg":     r"Software\Opera Software\NativeMessagingHosts",
        "url":     "opera://extensions",
        "dist":    "dist",
        "is_fx":   False,
    },
    {
        "name":    "Opera GX",
        "exe":     APPDATA / "Opera Software/Opera GX Stable/opera.exe",
        "reg":     r"Software\Opera Software\Opera GX Stable\NativeMessagingHosts",
        "url":     "opera://extensions",
        "dist":    "dist",
        "is_fx":   False,
    },
    {
        "name":    "Vivaldi",
        "exe":     LOCALAPPDATA / "Vivaldi/Application/vivaldi.exe",
        "reg":     r"Software\Vivaldi\NativeMessagingHosts",
        "url":     "vivaldi://extensions",
        "dist":    "dist",
        "is_fx":   False,
    },
    {
        "name":    "Firefox",
        "exe":     Path(r"C:\Program Files\Mozilla Firefox\firefox.exe"),
        "reg":     r"Software\Mozilla\NativeMessagingHosts",
        "url":     "about:debugging#/runtime/this-firefox",
        "dist":    "dist-firefox",
        "is_fx":   True,
    },
    {
        "name":    "Firefox ESR",
        "exe":     Path(r"C:\Program Files\Mozilla Firefox ESR\firefox.exe"),
        "reg":     r"Software\Mozilla\NativeMessagingHosts",
        "url":     "about:debugging#/runtime/this-firefox",
        "dist":    "dist-firefox",
        "is_fx":   True,
    },
]


# ── Registry helper ───────────────────────────────────────────────────────────
def reg_set_default(key_path: str, value: str) -> None:
    """Create HKCU key and set its default (unnamed) value."""
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, key_path) as key:
        winreg.SetValueEx(key, "", 0, winreg.REG_SZ, value)


def reg_delete_key(key_path: str) -> None:
    """Delete a HKCU registry key (best-effort)."""
    try:
        winreg.DeleteKey(winreg.HKEY_CURRENT_USER, key_path)
    except FileNotFoundError:
        pass


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="MindVault Windows Installer")
    parser.add_argument("--auto-start",    action="store_true", help="Register Task Scheduler logon job")
    parser.add_argument("--force",         action="store_true", help="Kill daemon without prompting")
    parser.add_argument("--no-extension",  action="store_true", help="Skip extension install steps")
    parser.add_argument("--binary-path",   default="",          help="Path to mvaultd.exe (overrides auto-detect)")
    parser.add_argument("--ext-dir",       default="",          help="Path to extension dist/ (overrides auto-detect)")
    args = parser.parse_args()

    print()
    print(f"  {MAGENTA}╔══════════════════════════════════════════════╗{RESET}")
    print(f"  {MAGENTA}║   MindVault — Full Windows Installer         ║{RESET}")
    print(f"  {MAGENTA}╚══════════════════════════════════════════════╝{RESET}")
    print()

    # ── Step 1: Locate mvaultd.exe ────────────────────────────────────────────
    step("[1/8] Locating mvaultd.exe...")
    script_dir = Path(__file__).resolve().parent
    repo_root  = script_dir.parent.parent

    src_bin = None
    if args.binary_path:
        src_bin = Path(args.binary_path)
    else:
        candidates = [
            repo_root / "companion" / "mvaultd.exe",
            repo_root / "companion" / "bin" / "mvaultd.exe",
            INSTALLED_BIN,
            Path("mvaultd.exe"),
        ]
        for c in candidates:
            if c.exists():
                src_bin = c
                break

    if not src_bin or not src_bin.exists():
        fail("mvaultd.exe not found. Build it first:")
        info("  cd companion")
        info("  go build ./cmd/mvaultd")
        info("Then retry or pass: --binary-path <path\\to\\mvaultd.exe>")
        sys.exit(1)
    ok(f"Binary: {src_bin}")

    # ── Step 2: Locate extension dist/ ───────────────────────────────────────
    ext_dir    = None
    ext_dir_ff = None
    if not args.no_extension:
        step("[2/8] Locating extension dist/ folder...")
        if args.ext_dir:
            ext_dir = Path(args.ext_dir)
        else:
            for c in [
                repo_root / "packages" / "extension" / "dist",
                repo_root / "dist",
            ]:
                if (c / "manifest.json").exists():
                    ext_dir = c
                    break
        if ext_dir:
            ok(f"Chrome/Edge dist : {ext_dir}")
            ff_candidate = ext_dir.parent / "dist-firefox"
            if (ff_candidate / "manifest.json").exists():
                ext_dir_ff = ff_candidate
                ok(f"Firefox dist     : {ext_dir_ff}")
            else:
                warn("Firefox dist-firefox/ not found")
                info("Run: npx vite build --config vite.config.firefox.ts")
        else:
            warn("Extension dist/ not found — companion-only install")
            info("Build: cd packages\\extension && npx vite build")

    # ── Step 3: Stop running daemon ───────────────────────────────────────────
    step("[3/8] Checking for running daemon...")
    result = subprocess.run(
        ["tasklist", "/FI", "IMAGENAME eq mvaultd.exe"],
        capture_output=True, text=True
    )
    daemon_running = "mvaultd.exe" in result.stdout.lower()

    if daemon_running:
        if not args.force:
            ans = input(f"  {YELLOW}! Daemon is running. Stop it and continue? [Y/n]:{RESET} ").strip()
            if ans.lower() == "n":
                print("Aborted.")
                sys.exit(0)
        subprocess.run(["taskkill", "/F", "/IM", "mvaultd.exe"],
                       capture_output=True)
        time.sleep(0.8)
        ok("Stopped previous daemon")
    else:
        ok("No daemon running")

    # ── Step 4: Create dirs + install binary ──────────────────────────────────
    step(f"[4/8] Installing binary to {INSTALL_DIR}...")
    INSTALL_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src_bin, INSTALLED_BIN)
    ok(f"Installed: {INSTALLED_BIN}")

    try:
        result = subprocess.run([str(INSTALLED_BIN), "--version"],
                                capture_output=True, text=True, timeout=5)
        ver = (result.stdout or result.stderr or "ok").strip()
        ok(f"Binary OK: {ver}")
    except Exception:
        warn("--version not supported (non-fatal)")

    # ── Step 5: Write native messaging manifests ──────────────────────────────
    step("[5/8] Writing native messaging manifests...")

    cr_manifest_data = {
        "name":            DAEMON_NAME,
        "description":     "MindVault Companion Daemon - SQLite mirror and REST API",
        "path":            str(INSTALLED_BIN),
        "type":            "stdio",
        "allowed_origins": ["chrome-extension://*/", "app://*"],
    }
    CR_MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    CR_MANIFEST.write_text(
        json.dumps(cr_manifest_data, indent=2), encoding="utf-8"
    )
    ok(f"Chromium manifest : {CR_MANIFEST}")

    fx_manifest_data = {
        "name":               DAEMON_NAME,
        "description":        "MindVault Companion Daemon - SQLite mirror and REST API",
        "path":               str(INSTALLED_BIN),
        "type":               "stdio",
        "allowed_extensions": ["mindvault@mindvault.app", "*"],
    }
    FX_MANIFEST_D.mkdir(parents=True, exist_ok=True)
    FX_MANIFEST.write_text(
        json.dumps(fx_manifest_data, indent=2), encoding="utf-8"
    )
    ok(f"Firefox  manifest : {FX_MANIFEST}")

    # ── Step 6: Browser detection + native messaging registry ────────────────
    step("[6/8] Detecting browsers and registering native messaging...")
    found_browsers = []
    skipped        = []

    for b in BROWSERS:
        if b["exe"].exists():
            manifest_path = str(FX_MANIFEST) if b["is_fx"] else str(CR_MANIFEST)
            reg_key = f"{b['reg']}\\{DAEMON_NAME}"
            try:
                reg_set_default(reg_key, manifest_path)
                ok(f"{b['name']} — registered")
                found_browsers.append(b)
            except Exception as e:
                warn(f"{b['name']} — registry failed: {e}")
        else:
            skipped.append(b["name"])

    if skipped:
        info(f"Not installed: {', '.join(skipped)}")

    # ── Step 7: Task Scheduler auto-start ────────────────────────────────────
    if args.auto_start:
        step("[7/8] Registering Task Scheduler auto-start job...")
        try:
            subprocess.run(
                ["schtasks", "/Delete", "/TN", TASK_NAME, "/F"],
                capture_output=True
            )
            subprocess.run(
                ["schtasks", "/Create", "/F",
                 "/TN", TASK_NAME,
                 "/TR", f'"{INSTALLED_BIN}"',
                 "/SC", "ONLOGON",
                 "/RL", "LIMITED"],
                check=True, capture_output=True
            )
            ok(f"Task '{TASK_NAME}' registered — daemon starts at every login")
        except subprocess.CalledProcessError as e:
            warn(f"Task Scheduler failed (non-fatal): {e}")
            info(f"Manual start: Start-Process '{INSTALLED_BIN}' -WindowStyle Hidden")
    else:
        info("[7/8] Auto-start: skipped (use --auto-start flag or Settings UI after install)")

    # ── Step 8: Start daemon + health check ───────────────────────────────────
    step("[8/8] Starting companion daemon...")
    subprocess.Popen(
        [str(INSTALLED_BIN)],
        creationflags=0x00000008,  # DETACHED_PROCESS
        close_fds=True,
    )
    time.sleep(2)

    result = subprocess.run(
        ["tasklist", "/FI", "IMAGENAME eq mvaultd.exe"],
        capture_output=True, text=True
    )
    if "mvaultd.exe" in result.stdout.lower():
        ok("Daemon is running")
    else:
        fail("Daemon did not start. Try manually:")
        info(f"  {INSTALLED_BIN}")
        sys.exit(1)

    try:
        import urllib.request
        resp = urllib.request.urlopen(
            "http://127.0.0.1:47821/health", timeout=5
        )
        body = resp.read().decode()
        ok(f"Health check OK: {body.strip()}")
    except Exception:
        warn("Health check timed out — daemon may still be initialising")
        info("Check: http://127.0.0.1:47821/health")

    token_file = Path(os.environ["LOCALAPPDATA"]) / "MindVault" / "token"
    if token_file.exists():
        tok = token_file.read_text(encoding="utf-8").strip()
        preview = tok[:12] + "..."
        ok(f"Auth token: {preview}  (saved at {token_file})")
    else:
        info(f"Auth token will be generated on first run at: {token_file}")

    # ── Extension install instructions ────────────────────────────────────────
    if not args.no_extension and found_browsers:
        print()
        print(f"  {CYAN}{'=' * 44}{RESET}")
        print(f"  {CYAN}Browser Extension — Manual Load Required{RESET}")
        print(f"  {CYAN}{'=' * 44}{RESET}")
        print()

        if not ext_dir:
            warn("Extension dist/ not found. Build first:")
            info("  cd packages\\extension && npx vite build")
        else:
            shown_urls = set()
            for b in found_browsers:
                if b["dist"] == "dist-firefox":
                    folder = str(ext_dir_ff) if ext_dir_ff else "(not built — run: npx vite build --config vite.config.firefox.ts)"
                else:
                    folder = str(ext_dir)

                print(f"  {WHITE}[{b['name']}]{RESET}")
                print(f"    Extensions page : {GRAY}{b['url']}{RESET}")
                print(f"    Load folder     : {YELLOW}{folder}{RESET}")
                if b["dist"] == "dist-firefox":
                    print(f"    How             : {GRAY}Load Temporary Add-on -> select manifest.json{RESET}")
                else:
                    print(f"    How             : {GRAY}Enable Developer Mode -> Load unpacked -> select folder{RESET}")
                print()

                if b["url"] not in shown_urls:
                    shown_urls.add(b["url"])
                    try:
                        subprocess.Popen([str(b["exe"]), b["url"]])
                        time.sleep(0.6)
                    except Exception:
                        pass

            ok("Extensions page opened in each detected browser")

    # ── Final summary ─────────────────────────────────────────────────────────
    print()
    print(f"  {MAGENTA}{'=' * 44}{RESET}")
    print(f"  {GREEN}Installation Complete!{RESET}")
    print(f"  {MAGENTA}{'=' * 44}{RESET}")
    print()
    print(f"  {WHITE}Companion binary  : {INSTALLED_BIN}{RESET}")
    print(f"  {WHITE}Data + database   : {DATA_DIR}{RESET}")
    print(f"  {WHITE}Auth token file   : {token_file}{RESET}")
    print(f"  {WHITE}Chromium manifest : {CR_MANIFEST}{RESET}")
    print(f"  {WHITE}Firefox manifest  : {FX_MANIFEST}{RESET}")
    if args.auto_start:
        print(f"  {WHITE}Auto-start        : Task Scheduler -> '{TASK_NAME}'{RESET}")
    else:
        print(f"  {GRAY}Auto-start        : Not configured (use --auto-start or Settings UI){RESET}")
    if found_browsers:
        names = ", ".join(b["name"] for b in found_browsers)
        print(f"  {GREEN}Native messaging  : {names}{RESET}")
    print()
    print(f"  {CYAN}Dashboard : http://127.0.0.1:47821/ui/{RESET}")
    print(f"  {CYAN}Health    : http://127.0.0.1:47821/health{RESET}")
    print()
    print(f"  {GRAY}Uninstall : python tools/install-companion/uninstall.py{RESET}")
    print()

    ans = input("  Open MindVault dashboard in browser now? [Y/n]: ").strip()
    if ans.lower() != "n":
        webbrowser.open("http://127.0.0.1:47821/ui/")


if __name__ == "__main__":
    main()
