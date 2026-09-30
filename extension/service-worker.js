'use strict';

const BRIDGE_URL = 'ws://127.0.0.1:17372/mediaflow';
const MEDIAFLOW_URL_PATTERN = 'https://alexgodly.github.io/MediaFlow/*';

let socket = null;
let keepAliveTimer = null;
let reconnectTimer = null;
let lastWireMessage = null;
const tabStates = new Map();

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
  if (!payload || payload.kind !== 'presence') return 'MF1|C';
  return `MF1|P|${utf8Base64(payload.details)}|${utf8Base64(payload.state)}`;
}

function newestPresence() {
  let best = null;
  for (const value of tabStates.values()) {
    if (!value || value.payload?.kind !== 'presence') continue;
    if (!best || value.at > best.at) best = value;
  }
  return best?.payload || null;
}

function desiredWireMessage() {
  const payload = newestPresence();
  return wireFor(payload || { kind: 'clear' });
}

function stopKeepAlive() {
  if (keepAliveTimer) clearInterval(keepAliveTimer);
  keepAliveTimer = null;
}

function startKeepAlive() {
  stopKeepAlive();
  keepAliveTimer = setInterval(() => {
    if (socket?.readyState === WebSocket.OPEN) {
      try { socket.send('MF1|K'); } catch (_) {}
    }
  }, 20000);
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    ensureSocket();
  }, 1500);
}

function ensureSocket() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

  try {
    socket = new WebSocket(BRIDGE_URL);
  } catch (_) {
    socket = null;
    scheduleReconnect();
    return;
  }

  socket.onopen = () => {
    startKeepAlive();
    const message = desiredWireMessage();
    lastWireMessage = message;
    try { socket.send(message); } catch (_) {}
  };

  socket.onclose = () => {
    stopKeepAlive();
    socket = null;
    scheduleReconnect();
  };

  socket.onerror = () => {
    try { socket?.close(); } catch (_) {}
  };
}

function pushDesiredState(force = false) {
  const message = desiredWireMessage();

  if (socket?.readyState === WebSocket.OPEN) {
    if (force || message !== lastWireMessage) {
      lastWireMessage = message;
      try { socket.send(message); } catch (_) {}
    }
    return;
  }

  lastWireMessage = message;
  ensureSocket();
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== 'MEDIAFLOW_RPC_STATE' || !sender.tab?.id) return;

  const tabId = sender.tab.id;
  const payload = message.payload || { kind: 'clear' };

  if (payload.kind === 'presence') {
    tabStates.set(tabId, { payload, at: Date.now() });
  } else {
    tabStates.delete(tabId);
  }

  pushDesiredState(true);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabStates.delete(tabId)) pushDesiredState(true);

  chrome.tabs.query({ url: MEDIAFLOW_URL_PATTERN }).then((tabs) => {
    if (!tabs.length) {
      tabStates.clear();
      pushDesiredState(true);
    }
  }).catch(() => {});
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!changeInfo.url) return;
  if (changeInfo.url.startsWith('https://alexgodly.github.io/MediaFlow/')) return;

  if (tabStates.delete(tabId)) pushDesiredState(true);
});

chrome.runtime.onStartup.addListener(() => ensureSocket());
chrome.runtime.onInstalled.addListener(() => ensureSocket());

ensureSocket();
