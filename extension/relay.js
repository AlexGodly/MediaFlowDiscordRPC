(() => {
  'use strict';

  if (window.__MEDIAFLOW_RPC_RELAY__) return;
  window.__MEDIAFLOW_RPC_RELAY__ = true;

  let hookReady = false;
  let injectAttempts = 0;

  function injectPageHook() {
    if (hookReady || injectAttempts >= 5) return;
    injectAttempts++;

    const old = document.getElementById('mediaflow-rpc-page-hook-loader');
    if (old) old.remove();

    const script = document.createElement('script');
    script.id = 'mediaflow-rpc-page-hook-loader';
    script.src = chrome.runtime.getURL('page-hook.js');
    script.async = false;
    script.dataset.attempt = String(injectAttempts);
    script.onload = () => script.remove();
    script.onerror = () => {
      script.remove();
      setTimeout(injectPageHook, 1000);
    };

    (document.head || document.documentElement).appendChild(script);
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== 'mediaflow-rpc-page') return;

    if (data.type === 'hook-ready') {
      hookReady = true;
      window.postMessage({ source: 'mediaflow-rpc-relay', type: 'ready' }, '*');
      return;
    }

    if (!data.payload) return;

    try {
      chrome.runtime.sendMessage({
        type: 'MEDIAFLOW_RPC_STATE',
        payload: data.payload
      });
    } catch (_) {}
  });

  injectPageHook();
  setTimeout(() => { if (!hookReady) injectPageHook(); }, 1200);
  setTimeout(() => { if (!hookReady) injectPageHook(); }, 3000);

  window.postMessage({ source: 'mediaflow-rpc-relay', type: 'ready' }, '*');
})();
