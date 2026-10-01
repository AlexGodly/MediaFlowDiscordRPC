'use strict';

const PRESENCE_URL = 'http://127.0.0.1:17372/presence';
const MEDIAFLOW_PREFIX = 'https://alexgodly.github.io/MediaFlow/';
const lastByTab = new Map();

function utf8Base64(value) {
  const bytes = new TextEncoder().encode(String(value ?? ''));
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function wireFor(payload) {
  if (!payload || payload.kind !== 'presence') return 'MF4|C';
  return `MF4|P|${utf8Base64(payload.details)}|${utf8Base64(payload.state)}|${utf8Base64(payload.view || '')}|${utf8Base64(payload.heading || '')}|${utf8Base64(payload.source || '')}|${utf8Base64(payload.largeImage || 'mediaflow')}|${utf8Base64(payload.largeText || 'MediaFlow')}`;
}

async function postWire(wire) {
  try {
    const response = await fetch(PRESENCE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: wire,
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(`Bridge HTTP ${response.status}`);
    return true;
  } catch (error) {
    console.warn('MediaFlow RPC bridge unavailable:', error);
    return false;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'MEDIAFLOW_RPC_STATE' || !sender.tab?.id) return;

  const tabId = sender.tab.id;
  const payload = message.payload || { kind: 'clear' };
  const wire = wireFor(payload);
  lastByTab.set(tabId, { wire, at: Date.now() });

  postWire(wire).then(ok => sendResponse({ ok })).catch(() => sendResponse({ ok: false }));
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (!lastByTab.delete(tabId)) return;
  chrome.tabs.query({ url: 'https://alexgodly.github.io/MediaFlow/*' }).then((tabs) => {
    if (!tabs.length) postWire('MF4|C');
  }).catch(() => postWire('MF4|C'));
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!changeInfo.url || changeInfo.url.startsWith(MEDIAFLOW_PREFIX)) return;
  if (lastByTab.delete(tabId)) postWire('MF4|C');
});
