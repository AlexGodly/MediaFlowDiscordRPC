# MediaFlow Discord RPC — Presence Studio v20.507

Windows desktop companion for **MediaFlow by Alex Godly — Personal Edition (v507)** and **MediaFlow Plus by Alex Godly — Public Edition (v436)**.

**Version convention:** v<RPC-project version>.<Personal MediaFlow compatibility baseline>. Plus has its own independently tracked baseline.

## The new desktop application

The new `desktop/` application is built with **Electron, React, TypeScript, and Vite**, and is packaged as one **portable Windows EXE**; no Java installation or installer is required. The prior Java tray companion remains in `tray/` solely as a legacy fallback. **Do not run both together**: they share local bridge port 17372.

### Implemented

- Beautiful responsive desktop Studio, native system tray and Windows startup preference.
- Discord desktop IPC bridge via application ID. No bot token, Discord OAuth, buttons, or clickable media/profile URLs.
- Personal and Plus activity detection through a single Chrome/Edge/Brave MV3 extension, including active tab arbitration and edition priority rules.
- Automatic, Manual and Off modes; custom title, cover, activity type, state/details templates, variable display, title-first or MediaFlow-first naming preferences (subject to Discord client restrictions).
- Activity visibility rules, privacy settings, user name, level, XP, streak and profile image fields when available from the website.
- Custom small artwork: MediaFlow logo, profile avatar URL, custom online URL/asset key, or none. Large artwork: title cover, custom online URL/asset key, or none.
- Local file selection with managed image storage and local preview. **Discord cannot display a local file path**: hosting or an uploaded Discord application asset is required for actual Discord artwork.
- Separately customizable Personal and Plus message templates and mini-images.
- Presets, export/import settings, appearance themes, accent color, gradients, responsive layout, browser detection and PWA shortcut detection.
- Open either website/PWA from the Studio and tray. Guided PWA installation.
- Extension **bundled in the EXE** with **Prepare & Install Extension**: copies its files into a persistent folder and opens browser extension management; the user must still approve/Load unpacked because Chromium prohibits silent personal extension installation.
- Live preview, diagnostics, recently detected title picker, and update-check controls.

## First-run instructions

1. Download `MediaFlowPresenceStudio-v20.507-portable.exe` from [Releases](https://github.com/AlexGodly/MediaFlowDiscordRPC/releases/tag/20.507).
2. **Exit the old Java MediaFlow RPC** and disable/remove any older extension. Only one companion may use port 17372.
3. Double-click the portable EXE. Open **Settings** and enter your **Discord Application ID** (not a token or secret). Keep Discord desktop running.
4. Open **Editions & PWA**, select Chrome, Edge or Brave, then click **Prepare & Install Extension**.
5. In the browser's extensions page, turn on Developer mode and choose **Load unpacked**. Pick the prepared extension directory shown by Presence Studio.
6. Open MediaFlow Personal or MediaFlow Plus, in the website or installed PWA. Verify presence in **Activity Monitor**.
7. Customize visibility, activity name preference, artwork and templates in **Presence Studio**.

The application is **unsigned**. Windows SmartScreen may warn. Only download from the project's official GitHub release.

## Technical notes

- Settings are stored locally in Electron's userData folder. Content-script activity is delivered to `http://127.0.0.1:17372/presence` using the MF5 protocol.
- The local browser bridge restricts web origins; do not expose it outside loopback.
- Discord's native SET_ACTIVITY can use Watching/Playing/Listening/Competing types, but **Discord ultimately controls the application header and card rendering**. The display-name option is best-effort on this legacy IPC transport; it is not guaranteed to replace the Discord Developer application name.
- All images can be selected locally for previews, but files are **not silently uploaded to public hosting**.
- Web browsers control PWA installation prompts and unpacked-extension permissions. Presence Studio cannot override those controls.
- The library picker currently displays recently detected titles from this session. Full cloud library discovery is a separate integration task.
- Compatibility checks can detect version changes; **breaking MediaFlow changes may require new extension/adapter releases**. Future compatibility cannot be guaranteed automatically.
- Do not expect the optional account XP fields to be present if a particular MediaFlow page does not expose them through the current extension; manually set them in Manual mode when needed.

## Development

```bash
cd desktop
npm install
npm test
npm run build
npm run package
```

Windows GitHub Actions builds and validates a portable EXE and extension ZIP automatically. The release stays **Beta** until real Discord and Windows installation tests confirm all supported paths.
