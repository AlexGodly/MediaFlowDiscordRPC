(() => {
  'use strict';

  if (window.__MEDIAFLOW_RPC_RELAY_V5__) return;
  window.__MEDIAFLOW_RPC_RELAY_V5__ = true;

  let lastPayload = null;

  function forward(payload) {
    lastPayload = payload || { kind: 'clear' };
    try {
      chrome.runtime.sendMessage({
        type: 'MEDIAFLOW_RPC_STATE',
        payload: lastPayload
      }).catch(() => {});
    } catch (_) {}
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== 'mediaflow-rpc-page-v5' || !data.payload) return;
    forward(data.payload);
  });

  // Ask the MAIN-world reader for an immediate snapshot once this relay is ready.
  window.postMessage({ source: 'mediaflow-rpc-relay-v5', type: 'ready' }, '*');

  // Best-effort clear when the MediaFlow tab navigates away or closes.
  window.addEventListener('pagehide', () => forward({ kind: 'clear' }), { capture: true });
})();
