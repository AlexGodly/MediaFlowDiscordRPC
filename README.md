# MediaFlow Discord RPC — Presence Studio

## v20.507 (initial dual-edition foundation)

**Personal:** [MediaFlow by Alex Godly](https://alexgodly.github.io/MediaFlow/) — version **507** baseline.  
**Public:** [MediaFlow Plus by Alex Godly](https://alexgodly.github.io/MediaFlowPlus/) — version **436** observed at development start.

The version convention is `v<RPC project version>.<Personal MediaFlow compatibility baseline>`.
Plus compatibility is tracked independently, not implied by the 507 suffix.

### Delivered foundation

- Chrome/Edge-compatible Manifest V3 extension targets both editions and standalone Chromium PWA tabs where content scripts are available.
- Browser extension arbitrates concurrent MediaFlow tabs and windows (foreground tab wins, followed by most recently active), with heartbeat and stale-tab expiry; closing one edition won't clear the other.
- Both editions are identified on the local bridge, with no Personal account-cache access while browsing Plus.
- Existing Discord local IPC connector and dynamic title-cover artwork remain the operational baseline, using a new MF5 bridge protocol to isolate old extension packets.
- The Windows tray now opens either edition website and provides real small-image configuration (MediaFlow logo, account avatar where detectable, custom URL/asset key, or none) with customizable hover text.
- Automated Windows app-image and extension packaging is configured by GitHub Actions.

### Install (development build)

1. Extract the Windows portable app-image ZIP and run its EXE from inside the extracted folder (no separate Java installation). **The EXE is not yet a single-file portable binary.**
2. Configure your Discord **Application ID** in the tray companion. No token or OAuth is required.
3. In Chrome/Edge/Brave, open the extensions page, enable Developer mode, and choose **Load unpacked**, selecting the extracted `extension` folder.
4. Open either MediaFlow website or the installed browser PWA.
5. Use the tray diagnostics screen to troubleshoot any connection problem.

Never enable multiple old extension versions simultaneously.

### Planned next work

The feature-complete **Presence Studio** UI (React/TypeScript), presets, rules, XP/streak visibility, local-image import and management, browser onboarding, PWA installer/launcher, dynamic activity names (subject to Discord support), and automatic compatibility updates are **not yet implemented** in this initial foundation. Until tested, treat this release as **Beta**, not Stable.

### Safety and privacy

No Discord buttons or clickable profile/image links are sent. The local RPC bridge listens on 127.0.0.1. Image URLs need to be reachable by Discord; selecting a local image must never upload it without explicit consent.

### Beta limitations

- The desktop UI is still the legacy tray/Swing shell, not yet the requested React/Tauri Presence Studio.
- Installed-PWA detection and guided browser-extension/PWA setup remain to be implemented.
- No dynamic Discord application-name override, independent XP bar rendering, custom local-image hosting, or automatic version-adapter updating is included yet.
- The Windows ZIP contains the executable **and its bundled runtime folder**; extract the entire ZIP before launching. It is not a single standalone EXE yet.
- Windows may show unsigned-app warnings; this project has no code-signing certificate.
- Replacing v12 requires upgrading both the companion and extension together because the new MF5 wire format is intentionally incompatible with old extension packets.
