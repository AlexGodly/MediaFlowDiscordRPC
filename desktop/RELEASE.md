# v20.507 — New desktop release

## Supported sources
- MediaFlow by Alex Godly — Personal Edition: v507 baseline
- MediaFlow Plus by Alex Godly — Public Edition: v437 baseline

## Desktop implementation
- A new React + TypeScript Presence Studio inside a portable Electron Windows executable (replacing the Java-first user experience).
- A native Windows tray menu, automatic/manual/off modes, and multi-edition browser activity selection.
- Live Discord IPC, editable Discord Application ID, custom title activity types, message templates, manual data entry, level/XP/streak visibility, elapsed timer and countdown.
- Large title artwork plus small overlay (MediaFlow logo, account avatar URL, custom image or disabled), local file picker and local previews.
- Separate Personal and Plus overrides, activity-page visibility rules, activity monitor, recent titles, presets, appearance themes, and settings import/export.
- Version-aware diagnostic baseline, startup preference, website/PWA launching, and guided extension preparation bundled into the portable EXE.

## Verification
- Node tests validate edition isolation, MF5 decoding, image selection, hidden states, templates and per-edition settings.
- Windows GitHub Actions compiles the React renderer and builds the executable. A successful CI build does **not** prove live Discord, PWA and extension functionality on an end-user Windows PC.

## Remaining limitations
- Chrome, Edge and Brave restrict silent installation of unpacked extensions and PWAs. Presence Studio prepares/guides installation but browser approval is still required.
- Local images do not automatically become public Discord artwork; no image is uploaded without explicit user approval.
- Discord may not honor activity-name overrides with legacy RPC. Visual card layout is decided by Discord.
- Full cloud library search is not implemented; the current Studio offers session-recent detected titles.
- Some activity, XP and avatar fields require site-side instrumentation to remain reliable across future MediaFlow updates.
- This is a **Beta** release while live Windows/Discord integration needs validation. 

## Presence fixes included in the updated build
- Library and Personal Order retain their real page-specific title counts instead of showing generic Watching text.
- Manual activity timestamps persist for the session; Personal and Plus override regression tests pass in CI.
- Release downloads include the portable EXE and browser extension ZIP only, excluding unpacked build helpers.

## Library and runtime compatibility follow-up
- Personal library metadata now streams in opt-in chunks from its account snapshot into a private local searchable catalogue (up to 120,000 titles).
- Plus library fallback uses only visible Plus DOM titles when its account snapshot cannot be safely distinguished from Personal on the shared origin; no cross-edition data is copied.
- Plus page source currently identifies v437 even though its VERSION file is stale at 436. The compatibility baseline has been corrected.

## Verification checkpoint

The desktop pipeline now also exercises the Discord Windows named-pipe handshake and outgoing Rich Presence frame using a local test fixture. It does not represent verification with a real logged-in Discord desktop user. The release remains Beta.

## v20.507 completion pass — October 19, 2026
- **Real MediaFlow catalog:** personal local-snapshot sync, isolated Plus visible-page sync, JSON/CSV export import for either edition, category/status filters, pagination, opt-in per-PC storage and deletion.
- **100,000-title stress test** passed in Windows CI. Title metadata only; no copied authentication secrets or Discord credentials.
- **Rule Studio:** independent Personal and Plus overrides, titles, statuses, categories, pages and priority-based rules; settings remain editable and persist.
- **Manual stats:** username, avatar, level, streak, XP and an optional text-based XP progress bar (Discord does not offer a native progress meter).
- **Windows Discord IPC handshake:** an automated fake Discord named-pipe service tests Rich Presence transmission without credentials, in addition to UI navigation and IPC smoke checks.
- **Detailed action detection:** expanded title detail/edit/log modal detection and real selected title artwork.
- **Security:** block ordinary website origins from writing to the local RPC bridge; authorize only browser-extension origins and native requests.
- **Compatibility:** website metadata version checks, official GitHub update download (checks published size and optional SHA-256), extension-folder maintenance.
- **Install:** single portable Windows EXE with bundled browser extension and guided PWA/extension install, with required browser approval.
- **Remaining external constraints:** browsers require installation approval; Discord controls app header and image layout; a local image requires an uploaded asset or HTTPS hosting for Discord to display; breaking MediaFlow changes may require adapter releases. Passing CI cannot substitute for real user-PC testing.
