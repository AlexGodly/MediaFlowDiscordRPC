# MediaFlow Discord RPC — Option 2 v9

This edition keeps the hosted MediaFlow website untouched. It uses the browser extension + local Windows tray companion.

## v9 behavior

### Dashboard

MediaFlow's **Let MediaFlow choose the exact title** setting is detected from the live Dashboard UI.

When exact-title recommendations are OFF, Discord stays on the normal Dashboard presence:

- `On Dashboard`
- `MediaFlow 🔥 <streak> day streak · Level <level>`

When exact-title recommendations are ON and MediaFlow has an eligible recommended title:

- `Watching <title> · Episode <progress>/<total>` for episode-based video titles
- `Reading <title> · Chapter <progress>/<total>` for chapter-based reading titles
- `Reading <title> · Issue <progress>/<total>` for issue-based reading titles
- `MediaFlow 🔥 <streak> day streak · Level <level>` stays as the complete second line

Movies/non-progress units omit the Episode/Chapter/Issue portion.

Discord Rich Presence exposes only **two custom text lines underneath the application name** (`details` + `state`). Because of that platform limit, v9 keeps the streak/level as its own full line and places progress on the Watching/Reading line.

### Library

- `Browsing Library`
- `<total Library titles> titles`

This remains the complete Library size.

### Personal Order

- `Organizing Personal Order`
- `<ordered titles> titles`

This is now the number of titles actually present in Personal Order, not the whole Library.

### Batch Log

- `Logging batches`
- `<selected titles> titles`

Only Batch Log rows with an actual Library title selected count. Blank "Add title" rows do not.

### Old System

- `In Old System`
- `MediaFlow 🔥 <streak> day streak · Level <level>`

Old System is no longer reported as Settings.

### Other views

- History / Library History → `Checking History`
- Statistics → `Checking stats`
- Profile / About / Settings → `In Settings`

## Install / update

1. Exit the currently running MediaFlow RPC tray companion.
2. Remove the older MediaFlow RPC browser extension from `chrome://extensions/` or `edge://extensions/`.
3. Load unpacked and select this v9 `extension` folder.
4. Run `tray\Run-MediaFlow-RPC.bat`.
5. Hard-refresh MediaFlow with `Ctrl + Shift + R`.

v9 retains the working Discord IPC and hard Exit behavior from v7/v8.
