(() => {
  'use strict';

  if (window.__MEDIAFLOW_RPC_RELAY__) return;
  window.__MEDIAFLOW_RPC_RELAY__ = true;

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== 'mediaflow-rpc-page' || !data.payload) return;

    try {
      chrome.runtime.sendMessage({
        type: 'MEDIAFLOW_RPC_STATE',
        payload: data.payload
      });
    } catch (_) {}
  });

  window.postMessage({ source: 'mediaflow-rpc-relay', type: 'ready' }, '*');
})();
