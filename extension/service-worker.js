'use strict';
// MediaFlow Presence Studio v20.507 — unified Personal/Plus MV3 bridge.
// Selection is global across tabs and standalone browser PWA windows.
const PRESENCE_URL = 'http://127.0.0.1:17372/presence';
const PERSONAL = 'https://alexgodly.github.io/MediaFlow/';
const PLUS = 'https://alexgodly.github.io/MediaFlowPlus/';
const STALE_MS = 16000;
const PULSE_MS = 7000;
const lastByTab = new Map();
let lastWire = '';
let lastPosted = 0;
let revision = 0;

function editionFor(url) {
  if (typeof url !== 'string') return null;
  if (url.startsWith(PERSONAL)) return 'personal';
  if (url.startsWith(PLUS)) return 'plus';
  return null;
}
function utf8Base64(value) {
  const bytes = new TextEncoder().encode(String(value ?? ''));
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
function field(value, max = 2048) {
  return utf8Base64(String(value ?? '').slice(0, max));
}
function wireFor(entry) {
  if (!entry) return 'MF5|C';
  const p = entry.payload;
  return [
    'MF5', 'P', field(p.details, 150), field(p.state, 150),
    field(p.view, 80), field(p.heading, 150), field(p.source, 100),
    field(p.largeImage || 'mediaflow'), field(p.largeText || 'MediaFlow', 150),
    field(entry.edition, 16), field(p.smallImage || 'mediaflow'),
    field(p.smallText || 'MediaFlow', 150), field(p.username || '', 100), field(p.profileImage || '')
  ].join('|');
}
async function postWire(wire) {
  try {
    const response = await fetch(PRESENCE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      cache: 'no-store',
      body: wire
    });
    return response.ok;
  } catch (_) {
    return false; // companion may not be running; retry on next heartbeat
  }
}
async function selectAndSend() {
  const currentRevision = ++revision;
  const now = Date.now();
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({
      url: [PERSONAL + '*', PLUS + '*']
    });
  } catch (_) {}
  if (currentRevision !== revision) return;
  const byId = new Map(tabs.map(tab => [tab.id, tab]));
  for (const [id, value] of lastByTab) {
    if (!byId.has(id) || now - value.at > STALE_MS) lastByTab.delete(id);
  }
  let focusedWindowId = -1;
  try {
    const window = await chrome.windows.getLastFocused();
    if (window?.focused) focusedWindowId = window.id;
  } catch (_) {}
  if (currentRevision !== revision) return;
  const candidates = [...lastByTab.entries()].map(([id, value]) => ({
    ...value, tab: byId.get(id)
  })).filter(x => x.tab && editionFor(x.tab.url) === x.edition);
  candidates.sort((a, b) => {
    const aRank = a.tab.active && a.tab.windowId === focusedWindowId ? 2 : a.tab.active ? 1 : 0;
    const bRank = b.tab.active && b.tab.windowId === focusedWindowId ? 2 : b.tab.active ? 1 : 0;
    return bRank - aRank || b.at - a.at;
  });
  const wire = wireFor(candidates[0] || null);
  if (wire === lastWire && now - lastPosted < PULSE_MS) return;
  const ok = await postWire(wire);
  if (ok) { lastWire = wire; lastPosted = Date.now(); }
}
function refresh() { selectAndSend().catch(() => {}); }

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'MEDIAFLOW_RPC_STATE' || !Number.isInteger(sender.tab?.id)) return;
  const edition = editionFor(sender.tab.url);
  if (!edition) { sendResponse({ ok: false, error: 'Unsupported website' }); return; }
  const payload = message.payload || {};
  if (payload.kind === 'presence') {
    lastByTab.set(sender.tab.id, { edition, payload, at: Date.now() });
  } else {
    lastByTab.delete(sender.tab.id);
  }
  refresh();
  sendResponse({ ok: true });
});
chrome.tabs.onRemoved.addListener(tabId => { lastByTab.delete(tabId); refresh(); });
chrome.tabs.onUpdated.addListener((tabId, changes, tab) => {
  if (changes.url && !editionFor(changes.url)) lastByTab.delete(tabId);
  if (changes.url || changes.status === 'complete') refresh();
});
chrome.tabs.onActivated.addListener(refresh);
chrome.windows.onFocusChanged.addListener(refresh);
// A suspended MV3 worker restarts as content scripts send heartbeat packets.
