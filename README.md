# MediaFlow Discord RPC — Option 2 v6

This version does **not** modify the hosted MediaFlow site.

## What changed in v6

MediaFlow v172 keeps its live `S` application state inside a private IIFE closure. Earlier extension versions tried to read that variable from the page and therefore kept sending `clear` even though the tray and Discord connection were healthy.

v6 no longer tries to access MediaFlow's private JavaScript closure. The browser extension now reads:

- the rendered MediaFlow page to identify the current view and visible recommendation metadata;
- MediaFlow's own `mf_cloud_cache_v1` / account recovery cache for Library count, the current task and title progress;
- the rendered sidebar for the exact visible day streak and level.

The extension then sends the finished Rich Presence text to the local tray companion over HTTP on `127.0.0.1:17372`.

## Install / upgrade

1. Exit any old MediaFlow RPC tray companion.
2. In `chrome://extensions/` or `edge://extensions/`, remove every older **MediaFlow Discord RPC Bridge** entry.
3. Extract this v6 package.
4. Run `tray\Run-MediaFlow-RPC.bat`.
5. Load the `extension` folder with **Load unpacked**.
6. Open or hard-refresh `https://alexgodly.github.io/MediaFlow/`.
7. Open `http://127.0.0.1:17372/status`.

A working v6 status should show `Last MediaFlow activity` and `Last SET_ACTIVITY at` with timestamps instead of `never`.

## Presence mapping

- Dashboard: `Watching/Reading <recommended title>` + streak, level and Episode/Chapter/Issue progress when available.
- Library: `Browsing Library` + total title count.
- Order: `Organizing Personal Order` + total title count.
- Library History / History: `Checking History` + streak and level.
- Batch Log: `Logging batches` + total title count.
- Statistics: `Checking stats` + streak and level.
- Profile settings / About / Settings / Old System: `In Settings` + streak and level.

No Discord buttons are added.

## Diagnostics

- Health: `http://127.0.0.1:17372/health`
- Full status: `http://127.0.0.1:17372/status`
- Log: `%APPDATA%\MediaFlow RPC\MediaFlowRPC.log`
