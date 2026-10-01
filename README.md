# MediaFlow Discord RPC — Option 2 v11

This edition keeps the hosted MediaFlow website untouched. It uses the Chrome/Edge extension plus the local Windows tray companion.

## v11 fix — Dashboard cover no longer flickers

The v10 Dashboard could alternate between the recommended title cover and the MediaFlow logo. MediaFlow redraws the Dashboard in several DOM phases, and for a very short moment the recommendation cover `<img>` can be absent. v10 treated that transient frame as “no cover” and immediately sent `mediaflow` to Discord.

v11 keeps the last **confirmed cover URL for the same recommended title**. A temporary redraw can no longer replace it with the MediaFlow logo. The fallback logo is used only when the current title genuinely has no usable cover, exact-title recommendations are off, or the recommendation changes to a different title that has no cover.

### Dashboard

With exact-title recommendations enabled:

- `Watching <title> · Episode <progress>/<total>`
- or `Reading <title> · Chapter <progress>/<total>` / `Issue <progress>/<total>`
- `🔥 <streak> day streak · Level <level>`
- recommended title cover = large Discord image when available
- MediaFlow logo = fallback when no cover exists

All v10 behavior is otherwise preserved, including Library / Order / Batch Log counts, Old System presence, and hard tray Exit.

## Update from v10

1. Exit MediaFlow RPC from the tray.
2. Remove the old MediaFlow RPC extension from `chrome://extensions/` or `edge://extensions/`.
3. Extract v11.
4. Load unpacked → select the v11 `extension` folder.
5. Run `tray\Run-MediaFlow-RPC.bat`.
6. Hard-refresh MediaFlow with `Ctrl + Shift + R`.

You can verify the currently selected RPC artwork at `http://127.0.0.1:17372/status` under `Large image:`.
