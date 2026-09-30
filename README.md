# MediaFlow Discord RPC — Browser Extension Edition

This is the **Option 2** setup. Your hosted MediaFlow website stays completely unchanged:

`https://alexgodly.github.io/MediaFlow/`

The system has two local parts:

1. **Browser extension** — reads the live MediaFlow state from the existing hosted page.
2. **MediaFlow RPC tray companion** — receives only the finished activity text over `127.0.0.1` and sends it to Discord Rich Presence.

No MediaFlow HTML replacement is required.

## RPC mapping

- Dashboard: `Watching/Reading <recommended title>` + streak, level, and Episode/Chapter/Issue progress when a known total exists.
- Library: `Browsing Library` + `<count> titles`.
- Order: `Organizing Personal Order` + `<count> titles`.
- Library History / History: `Checking History` + streak and level.
- Batch Log: `Logging batches` + `<count> titles`.
- Statistics: `Checking stats` + streak and level.
- Profile / About / Settings / Old System: `In Settings` + streak and level.
- No Discord RPC buttons are added.

Discord currently exposes two custom text lines beneath the application name, so Dashboard combines streak/level and progress on the second line.

## 1. Install the browser extension once

### Chrome

1. Open `chrome://extensions/`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select the `extension` folder from this package.

### Microsoft Edge

1. Open `edge://extensions/`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select the `extension` folder from this package.

The extension has no popup and no settings window. It only runs on:

`https://alexgodly.github.io/MediaFlow/*`

## 2. Run the tray companion

Open the `tray` folder and run:

`Run-MediaFlow-RPC.bat`

It uses `javaw`, so there is no console window. The companion lives in the Windows notification tray.

### First run only: Discord Application ID

The tray companion asks for a Discord Application ID. Create a Discord Developer application named **MediaFlow**, copy its Application ID, and paste it into the prompt.

Use `tray/mediaflow.png` as the Discord application's icon if you want the MediaFlow artwork to appear as the application image.

No bot token, client secret, OAuth login, or RPC buttons are used.

## Optional: build a normal portable Windows EXE

Run:

`tray/Build-Windows-EXE.bat`

A full JDK 17+ with `jpackage` is required. Your JDK 24 installation is suitable.

The finished program will be created at:

`tray/dist/MediaFlow RPC/MediaFlow RPC.exe`

The app image includes its own Java runtime, so once built you can run the EXE directly without the BAT/JAR workflow.

## Privacy / networking

- The extension reads MediaFlow state only on the exact GitHub Pages MediaFlow URL.
- It sends only the rendered RPC strings to the tray companion.
- Browser-to-tray traffic stays on loopback: `127.0.0.1:17372`.
- The tray companion talks to the locally running Discord desktop client through Discord IPC.
- There is no remote MediaFlow RPC server.

## Normal daily use

After the one-time extension install and Discord Application ID setup:

1. Launch Discord.
2. Launch the MediaFlow RPC tray companion.
3. Use `https://alexgodly.github.io/MediaFlow/` normally.

The Rich Presence follows MediaFlow automatically. Closing/navigating away from the MediaFlow tab clears it.
