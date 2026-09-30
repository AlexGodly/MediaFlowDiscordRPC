# MediaFlow Discord RPC — Option 2 v7

This edition does **not modify the hosted MediaFlow website**. It uses:

`MediaFlow website -> Chrome/Edge extension -> localhost tray companion -> Discord desktop`

## What v7 fixes

- Fixes dynamic-page detection. The extension now reads the current rendered page **and captures MediaFlow navigation clicks**, so Library, Order, History, Batch Log, Statistics, Profile/About/Settings no longer get stuck as Dashboard.
- Fixes the Discord IPC write deadlock that could leave `Last SET_ACTIVITY at: never` even though Discord said `READY`. After the Discord READY handshake, one dedicated thread owns the Windows named-pipe writes.
- Fixes **Exit**. Clicking **Exit** removes the tray icon and force-terminates the JVM, so it does not remain in Task Manager.
- Adds a single-instance lock and startup cleanup for older `MediaFlowRPC.jar` processes.
- Adds `Kill-MediaFlow-RPC.bat` for one-time cleanup of old v6-or-earlier processes.
- `/status` now shows `Detected view`, `Detected heading`, and `View source`.

## Clean install (important after v6)

1. Run `tray\Kill-MediaFlow-RPC.bat` once.
2. In `chrome://extensions/` or `edge://extensions/`, remove every old **MediaFlow Discord RPC Bridge**.
3. Load unpacked: `extension` from this v7 folder.
4. Run `tray\Run-MediaFlow-RPC.bat`.
5. Open/refresh `https://alexgodly.github.io/MediaFlow/`.
6. Check `http://127.0.0.1:17372/status`.

A healthy result should show, for example:

```
Last MediaFlow activity: ...
Details: Browsing Library
Detected view: library
Detected heading: Library
Last SET_ACTIVITY at: ...
Discord status: Presence sent to Discord
```

## Presence mapping

- Dashboard: `Watching/Reading <recommended title>` and streak/level + Episode/Chapter/Issue progress when available.
- Library: `Browsing Library` + title count.
- Order: `Organizing Personal Order` + title count.
- Library History / History: `Checking History` + streak/level.
- Batch Log: `Logging batches` + title count.
- Statistics: `Checking stats` + streak/level.
- Profile / About / Settings / Old System: `In Settings` + streak/level.

No RPC buttons are added.

## Discord asset

Upload `tray\mediaflow-discord-1024.png` to the application's Rich Presence assets with the asset key exactly:

`mediaflow`
