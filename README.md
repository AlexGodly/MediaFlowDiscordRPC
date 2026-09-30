# MediaFlow Discord RPC — Option 2 v5

This version leaves the hosted MediaFlow website unchanged.

Architecture:

`MediaFlow website -> Chrome/Edge extension -> local HTTP relay -> tray companion -> Discord desktop IPC`

## What changed in v5

v5 removes the fragile long-lived Manifest V3 WebSocket dependency between the extension and the tray app.

The extension now:

- reads MediaFlow in Chrome's `MAIN` execution world;
- sends the finished presence state to the extension service worker;
- uses short local HTTP POST requests to `127.0.0.1:17372/presence`;
- does not need a persistent extension WebSocket connection.

The tray companion still supports the old WebSocket endpoint as a fallback, but v5 does not rely on it.

## IMPORTANT WHEN UPGRADING

1. Exit the old MediaFlow RPC tray process.
2. Remove every older **MediaFlow Discord RPC Bridge** unpacked extension.
3. Use the v5 tray companion and the v5 extension together.

## Setup

1. Run `tray/Run-MediaFlow-RPC.bat`.
2. Confirm `http://127.0.0.1:17372/health` says `MediaFlow RPC bridge is running`.
3. Open Chrome/Edge extensions, enable Developer mode, choose **Load unpacked**, and select this package's `extension` folder.
4. Open or hard-refresh `https://alexgodly.github.io/MediaFlow/`.
5. Open `http://127.0.0.1:17372/status`.

A healthy v5 status should show:

- `Relay transport: HTTP POST (v5)`
- `HTTP presence requests:` greater than 0
- `Last extension contact:` with a real timestamp
- `Last MediaFlow activity:` with a real timestamp
- populated `Details:` and `State:`
- `Discord ready: true`
- `Last SET_ACTIVITY at:` with a real timestamp

`Active legacy WebSocket clients: 0` is NORMAL in v5.

## RPC mapping

- Dashboard: `Watching/Reading <recommended title>` + streak/level + Episode/Chapter/Issue progress where available
- Library: `Browsing Library` + title count
- Order: `Organizing Personal Order` + title count
- Library History / History: `Checking History` + streak/level
- Batch Log: `Logging batches` + title count
- Statistics: `Checking stats` + streak/level
- Profile / About / Settings: `In Settings` + streak/level

No RPC buttons are added.
