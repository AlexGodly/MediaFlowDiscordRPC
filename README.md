# MediaFlow Discord RPC — Option 2 v4

This version leaves the hosted MediaFlow website unchanged.

Architecture:

`MediaFlow website -> Chrome/Edge extension -> local tray bridge -> Discord desktop IPC`

## IMPORTANT WHEN UPGRADING

Remove/disable every older **MediaFlow Discord RPC Bridge** unpacked extension first. Then load only the `extension` folder from this v4 package. Different unpacked folders can remain installed as separate extensions, which causes duplicate local bridge connections.

## Setup

1. Exit any old MediaFlow RPC tray process.
2. Start `tray/Run-MediaFlow-RPC.bat`.
3. Confirm `http://127.0.0.1:17372/health` says the bridge is running.
4. In Chrome/Edge extensions, remove all previous MediaFlow RPC extensions.
5. Enable Developer mode, choose **Load unpacked**, and select this package's `extension` folder.
6. Open or hard-refresh `https://alexgodly.github.io/MediaFlow/`.
7. Check `http://127.0.0.1:17372/status`.

A healthy connection should show:

- `Extension connections: 1`
- `Last MediaFlow activity:` with a real timestamp
- `Details:` and `State:` populated
- `Discord ready: true`
- `Last SET_ACTIVITY at:` with a real timestamp

## Why v4 exists

MediaFlow stores its main runtime state in a top-level lexical `let S`. That state is not a `window.S` property. Earlier extension builds connected to the local bridge but could fail to read MediaFlow itself. v4 loads a real page-context hook (`page-hook.js`) through the extension's isolated relay, so it can read MediaFlow's live `S` state without modifying the hosted website.

## RPC mapping

- Dashboard: `Watching/Reading <recommended title>` + streak/level + progress where available
- Library: `Browsing Library` + title count
- Order: `Organizing Personal Order` + title count
- Library History / History: `Checking History` + streak/level
- Batch Log: `Logging batches` + title count
- Statistics: `Checking stats` + streak/level
- Profile / About / Settings: `In Settings` + streak/level

No RPC buttons are added.
