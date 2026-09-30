(() => {
  'use strict';

  if (window.__MEDIAFLOW_RPC_PAGE_READER_V5__) return;
  window.__MEDIAFLOW_RPC_PAGE_READER_V5__ = true;

  const SOURCE = 'mediaflow-rpc-page-v5';
  let lastSignature = '';
  let lastSentAt = 0;
  let metaCache = { at: 0, streak: 0, level: 1 };

  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const num = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  function stateRef() {
    try {
      // MediaFlow declares `let S = {...}` in its normal classic page script.
      // MAIN-world extension scripts share the page's global lexical environment,
      // so `S` is readable here even though it is intentionally not window.S.
      return (typeof S !== 'undefined') ? S : null;
    } catch (_) {
      return null;
    }
  }

  function readMeta() {
    const now = Date.now();
    if (now - metaCache.at < 1200) return metaCache;

    let streak = 0;
    let level = 1;
    try {
      if (typeof computeDayStreak === 'function') streak = Math.max(0, num(computeDayStreak(), 0));
    } catch (_) {}
    try {
      if (typeof mediaFlowLevelInfo === 'function') {
        const info = mediaFlowLevelInfo();
        level = Math.max(1, Math.round(num(info?.level, 1)));
      }
    } catch (_) {}

    metaCache = { at: now, streak, level };
    return metaCache;
  }

  function streakLevelLine() {
    const { streak, level } = readMeta();
    return `MediaFlow 🔥 ${streak.toLocaleString()} day streak · Level ${level.toLocaleString()}`;
  }

  function categoryFor(task) {
    try {
      if (typeof getCategory === 'function' && task?.categoryId) return getCategory(task.categoryId);
    } catch (_) {}
    return null;
  }

  function libraryItemFor(s, task) {
    const rows = Array.isArray(s?.library) ? s.library : [];
    if (!task) return null;
    if (task.libraryId) {
      const hit = rows.find(x => String(x?.id ?? '') === String(task.libraryId));
      if (hit) return hit;
    }
    const wanted = clean(task.title).toLowerCase();
    if (!wanted) return null;
    return rows.find(x => clean(x?.title).toLowerCase() === wanted) || null;
  }

  function progressWord(unit) {
    const u = clean(unit).toLowerCase();
    if (u === 'episodes' || u === 'episode') return 'Episode';
    if (u === 'chapters' || u === 'chapter') return 'Chapter';
    if (u === 'issues' || u === 'issue') return 'Issue';
    return '';
  }

  function isReading(unit) {
    const u = clean(unit).toLowerCase();
    return ['chapters', 'chapter', 'issues', 'issue', 'pages', 'page'].includes(u);
  }

  function dashboardPresence(s) {
    const task = s?.currentTask || null;
    if (!s?.sessionActive || !task) {
      return { details: 'On Dashboard', state: streakLevelLine() };
    }

    const item = libraryItemFor(s, task);
    const cat = categoryFor(task);
    const unit = clean(task.unit || cat?.unit || '');
    const title = clean(task.title || item?.title || '');
    if (!title) return { details: 'On Dashboard', state: streakLevelLine() };

    const details = `${isReading(unit) ? 'Reading' : 'Watching'} ${title}`;
    let state = streakLevelLine();
    const word = progressWord(unit);
    if (word && item) {
      const progress = Math.max(0, num(item.progress, 0));
      const total = Math.max(0, num(item.total, 0));
      if (total > 0) state += ` · ${word} ${progress.toLocaleString()}/${total.toLocaleString()}`;
    }
    return { details, state };
  }

  function buildPresence() {
    const s = stateRef();
    if (!s || s.loading || !Array.isArray(s.library) || !Array.isArray(s.sessions)) {
      return { kind: 'clear' };
    }

    const view = clean(s.view || 'dashboard').toLowerCase();
    const count = s.library.length.toLocaleString();

    switch (view) {
      case 'dashboard': {
        const p = dashboardPresence(s);
        return { kind: 'presence', ...p };
      }
      case 'library':
        return { kind: 'presence', details: 'Browsing Library', state: `${count} titles` };
      case 'order':
        return { kind: 'presence', details: 'Organizing Personal Order', state: `${count} titles` };
      case 'libraryhistory':
      case 'history':
        return { kind: 'presence', details: 'Checking History', state: streakLevelLine() };
      case 'batch':
        return { kind: 'presence', details: 'Logging batches', state: `${count} titles` };
      case 'stats':
        return { kind: 'presence', details: 'Checking stats', state: streakLevelLine() };
      case 'profile':
      case 'about':
      case 'settings':
      case 'oldsystem':
        return { kind: 'presence', details: 'In Settings', state: streakLevelLine() };
      default:
        return { kind: 'presence', details: 'Using MediaFlow', state: streakLevelLine() };
    }
  }

  function publish(force = false) {
    let payload;
    try { payload = buildPresence(); }
    catch (_) { payload = { kind: 'clear' }; }

    const signature = JSON.stringify(payload);
    const now = Date.now();
    if (!force && signature === lastSignature && now - lastSentAt < 5000) return;

    lastSignature = signature;
    lastSentAt = now;
    window.postMessage({ source: SOURCE, payload }, '*');
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data?.source === 'mediaflow-rpc-relay-v5' && event.data?.type === 'ready') publish(true);
  });

  publish(true);
  setInterval(() => publish(false), 1000);
  window.addEventListener('focus', () => publish(true), { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) publish(true);
  }, { passive: true });
})();
