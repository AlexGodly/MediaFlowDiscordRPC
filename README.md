# MediaFlow Discord RPC — Option 2 v8

This edition does **not modify the hosted MediaFlow website**.

## v8 fix — correct Library title count

v7 could display a stale count such as `4 titles` because it trusted MediaFlow's `mf_cloud_cache_v1` recovery snapshot before the live UI. Very large MediaFlow libraries can exceed browser localStorage quota, leaving an older small recovery snapshot behind.

v8 now:

- trusts the live Library / Statistics / Profile count first;
- derives the exact total from an unfiltered Order picker when possible;
- remembers the last verified live count and reuses it on Order / Batch Log;
- uses the MediaFlow recovery cache only as a final fallback.

## Install

1. Keep the v7/v8 tray companion; v8's tray build includes the same working Discord IPC and hard Exit fix.
2. Remove the previous MediaFlow extension from `chrome://extensions/` or `edge://extensions/`.
3. Load unpacked: this v8 `extension` folder.
4. Hard-refresh MediaFlow.
5. Visit **Library once** so v8 can immediately learn the authoritative live title total. After that Order and Batch Log reuse the verified count.

The tray **Exit** behavior and Discord RPC transport remain the working v7 implementation.
