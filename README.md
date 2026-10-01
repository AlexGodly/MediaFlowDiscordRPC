# MediaFlow Discord RPC — Option 2 v10

This edition keeps the hosted MediaFlow website untouched. It uses the Chrome/Edge extension plus the local Windows tray companion.

## v10 changes

### Cleaner streak / level line

Anywhere the RPC shows streak + level, the line is now exactly:

- `🔥 <streak> day streak · Level <level>`

The old `MediaFlow` prefix has been removed.

Examples:

- `🔥 18 day streak · Level 183`
- Old System: `In Old System` + the streak/level line
- History: `Checking History` + the streak/level line
- Statistics: `Checking stats` + the streak/level line
- Settings/Profile/About: `In Settings` + the streak/level line

### Dynamic Dashboard cover artwork

When **Let MediaFlow choose the exact title** is enabled and MediaFlow recommends a title:

- Discord uses that recommended title's MediaFlow cover URL as the **large Rich Presence image** when a usable public `http://` or `https://` cover exists.
- The image hover text is the recommended title name.
- If the recommended title has no usable cover, RPC falls back to the uploaded Discord asset key `mediaflow`.
- If exact-title recommendations are disabled, Dashboard also uses the normal MediaFlow logo.

Discord supports external image URLs in Rich Presence image fields, so covers do not have to be uploaded one-by-one to the Developer Portal.

### Dashboard text

When exact-title recommendations are OFF:

- `On Dashboard`
- `🔥 <streak> day streak · Level <level>`

When exact-title recommendations are ON and a title is recommended:

- `Watching <title> · Episode <progress>/<total>`
- `Reading <title> · Chapter <progress>/<total>`
- `Reading <title> · Issue <progress>/<total>`
- second line: `🔥 <streak> day streak · Level <level>`

Movies/non-progress units omit the Episode/Chapter/Issue portion.

### Page-specific counts

- Library → `Browsing Library` / complete Library title count
- Personal Order → `Organizing Personal Order` / titles currently ordered
- Batch Log → `Logging batches` / actual selected titles being logged (blank rows do not count)

### Other pages

- Library History / History → `Checking History`
- Statistics → `Checking stats`
- Old System → `In Old System`
- Profile / About / Settings → `In Settings`

## Install / update from v9

1. Right-click the existing MediaFlow RPC tray icon and choose **Exit**.
2. Remove the old MediaFlow RPC extension from `chrome://extensions/` or `edge://extensions/`.
3. Extract this v10 package.
4. Enable Developer mode and choose **Load unpacked** → select the v10 `extension` folder.
5. Run `tray\Run-MediaFlow-RPC.bat`.
6. Hard-refresh MediaFlow with `Ctrl + Shift + R`.

The tray companion still includes the hard-exit behavior from the working v7+ build, so **Exit** removes the tray icon and terminates the process.

## Cover troubleshooting

Open `http://127.0.0.1:17372/status` while Dashboard is recommending a title. The diagnostics now include `Large image:`.

- If it shows an `https://...` URL, the title cover was sent to Discord.
- If it shows `mediaflow`, the fallback MediaFlow logo is being used.
