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
- Existing v12 Discord local IPC connector and dynamic artwork behavior remain the operational baseline.
- Automated Windows app-image and extension packaging is configured by GitHub Actions.

### Install (development build)

1. Extract the Windows portable app-image ZIP and run its EXE from inside the extracted folder (no separate Java installation). **The EXE is not yet a single-file portable binary.**
2. Configure your Discord **Application ID** in the tray companion. No token or OAuth is required.
3. In Chrome/Edge/Brave, open the extensions page, enable Developer mode, and choose **Load unpacked**, selecting the extracted `extension` folder.
4. Open either MediaFlow website or the installed browser PWA.
5. Use the tray diagnostics screen to troubleshoot any connection problem.

Never enable multiple old extension versions simultaneously.

### Planned next work

The feature-complete **Presence Studio** UI (React/TypeScript), presets, rules, XP/streak visibility, user-selected local/remote artwork, browser onboarding, PWA installer/launcher, dynamic activity names (subject to Discord support), and automatic compatibility updates are **not yet implemented** in this initial foundation. Until tested, treat this release as **Beta**, not Stable.

### Safety and privacy

No Discord buttons or clickable profile/image links are sent. The local RPC bridge listens on 127.0.0.1. Image URLs need to be reachable by Discord; selecting a local image must never upload it without explicit consent.
