# MediaFlow Discord RPC — Option 2 v12

This build keeps the working v11 dynamic cover behavior and fixes stale/legacy status packets.

## v12 changes

- Streak/level is always exactly `🔥 <streak> day streak · Level <level>` — no `MediaFlow` prefix.
- The tray companion now accepts only the v12 `MF4` bridge protocol. Old v7-v11 extension packets are ignored so an older unpacked extension cannot overwrite the current RPC.
- The tray also strips a legacy `MediaFlow ` prefix defensively before sending Rich Presence to Discord.
- Dashboard recommended-title cover remains sticky and falls back to the `mediaflow` Discord asset only when no cover is available.
- Existing page-specific Library / Order / Batch Log counts and Old System behavior are preserved.

## Update cleanly

1. Exit MediaFlow RPC from the tray.
2. Run `tray\Kill-MediaFlow-RPC.bat` once.
3. Remove all old `MediaFlow Discord RPC Bridge` entries from `chrome://extensions/`.
4. Load unpacked from this v12 `extension` folder.
5. Run `tray\Run-MediaFlow-RPC.bat`.
6. Hard-refresh MediaFlow (`Ctrl+Shift+R`).

If an old extension is accidentally left enabled, v12's tray ignores its old MF1/MF2/MF3 packets.
