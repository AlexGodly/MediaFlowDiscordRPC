# MediaFlow Discord RPC — Option 2 v3

This edition does **not modify the hosted MediaFlow website**.

It contains:

- `extension/` — unpacked Chrome / Edge extension for `https://alexgodly.github.io/MediaFlow/`
- `tray/` — local Windows tray companion that talks to Discord Desktop RPC

## Important v3 fix

v3 fixes the Windows Discord IPC write format. Discord's pipe protocol expects each frame (8-byte header + JSON payload) to be written as one pipe message. The previous build wrote the header and JSON separately, which can let the local browser bridge work while Discord never accepts the RPC handshake/activity.

v3 also adds a live diagnostics page:

`http://127.0.0.1:17372/status`

It shows whether:

- the local bridge is running;
- the browser extension is connected;
- MediaFlow activity has actually reached the tray app;
- Discord IPC reached READY;
- a `SET_ACTIVITY` was sent;
- Discord returned an error.

## Install / update

1. **Exit the old MediaFlow RPC tray app first.** Right-click its tray icon → `Exit`. Only one copy can use port 17372.
2. Extract this v3 package.
3. Open `chrome://extensions/` or `edge://extensions/`.
4. Remove the old MediaFlow RPC extension, or use **Load unpacked** and select this package's `extension` folder. If you replace the files in-place, press **Reload** on the extension.
5. Run `tray\Run-MediaFlow-RPC.bat`.
6. Make sure Discord **desktop** is running.
7. Open MediaFlow normally: `https://alexgodly.github.io/MediaFlow/`
8. Refresh the MediaFlow tab once.
9. Open `http://127.0.0.1:17372/status`.

A healthy result should eventually show something like:

- `Extension connections: 1`
- `Details: Browsing Library` (or your current MediaFlow activity)
- `Discord ready: true`
- `Discord status: Presence sent to Discord`
- `Last SET_ACTIVITY at: ...`
- `Last Discord error: (none)`

## Discord application

Use the Application ID from your Discord Developer Portal application named **MediaFlow**.

Upload the included 1024x1024 image to **Rich Presence Assets** with the asset key exactly:

`mediaflow`

No bot token, client secret, OAuth login, or RPC buttons are used.

## If Discord still doesn't display it

Run `tray\Diagnose-MediaFlow-RPC.bat` or open `/status` and check which stage is failing.

If `/status` says `Discord ready: true` and a recent `Last SET_ACTIVITY` is shown with no Discord error, check Discord **User Settings → Activity Privacy** and make sure activity sharing is enabled. Discord can receive Rich Presence successfully while the client is configured not to display/share activities.
