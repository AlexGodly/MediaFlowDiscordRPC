(() => {
  'use strict';

  // IMPORTANT: This file is loaded through a real <script> element by relay.js.
  // That makes it execute in MediaFlow's page realm, where MediaFlow's top-level
  // lexical `let S` state is visible. We intentionally do not require any change
  // to the hosted MediaFlow site.
  if (window.__MEDIAFLOW_RPC_PAGE_HOOK__) return;
  window.__MEDIAFLOW_RPC_PAGE_HOOK__ = true;

  const SOURCE = 'mediaflow-rpc-page';
  let lastSignature = '';
  let lastSentAt = 0;
  let metaCache = { at: 0, streak: 0, level: 1 };

  const safeNumber = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  function stateRef() {
    try {
      // S is MediaFlow's top-level `let S`, defined by the site itself.
      // eslint-disable-next-line no-undef
      return (typeof S !== 'undefined') ? S : null;
    } catch (_) {
      return null;
    }
  }

  function readMeta() {
    const now = Date.now();
    if (now - metaCache.at < 1500) return metaCache;

    let streak = 0;
    let level = 1;

    try {
      if (typeof computeDayStreak === 'function') streak = Math.max(0, safeNumber(computeDayStreak(), 0));
    } catch (_) {}

    try {
      if (typeof mediaFlowLevelInfo === 'function') {
        const info = mediaFlowLevelInfo();
        level = Math.max(1, Math.round(safeNumber(info?.level, 1)));
      }
    } catch (_) {}

    metaCache = { at: now, streak, level };
    return metaCache;
  }

  function streakLevelLine() {
    const { streak, level } = readMeta();
    return `MediaFlow 🔥 ${streak.toLocaleString()} day streak · Level ${level.toLocaleString()}`;
  }

  function libraryCount(s) {
    return Array.isArray(s?.library) ? s.library.length : 0;
  }

  function findRecommendedLibraryItem(s, task) {
    if (!task) return null;
    try {
      const rows = Array.isArray(s?.library) ? s.library : [];
      if (task.libraryId) {
        const byId = rows.find((item) => String(item?.id ?? '') === String(task.libraryId));
        if (byId) return byId;
      }
      const wanted = clean(task.title).toLowerCase();
      if (!wanted) return null;
      return rows.find((item) => clean(item?.title).toLowerCase() === wanted) || null;
    } catch (_) {
      return null;
    }
  }

  function categoryFor(task) {
    try {
      if (typeof getCategory === 'function' && task?.categoryId) return getCategory(task.categoryId);
    } catch (_) {}
    return null;
  }

  function progressLabel(unit) {
    const u = clean(unit).toLowerCase();
    if (u === 'episodes' || u === 'episode') return 'Episode';
    if (u === 'chapters' || u === 'chapter') return 'Chapter';
    if (u === 'issues' || u === 'issue') return 'Issue';
    if (u === 'pages' || u === 'page') return 'Page';
    return '';
  }

  function isReadingUnit(unit) {
    const u = clean(unit).toLowerCase();
    return u === 'chapters' || u === 'chapter' || u === 'issues' || u === 'issue' || u === 'pages' || u === 'page';
  }

  function dashboardPresence(s) {
    const active = !!s?.sessionActive;
    const task = s?.currentTask || null;

    if (!active || !task) {
      return { details: 'On Dashboard', state: streakLevelLine() };
    }

    const item = findRecommendedLibraryItem(s, task);
    const cat = categoryFor(task);
    const unit = clean(task.unit || cat?.unit || '');
    const title = clean(task.title || item?.title || '');

    if (!title) return { details: 'On Dashboard', state: streakLevelLine() };

    const verb = isReadingUnit(unit) ? 'Reading' : 'Watching';
    let state = streakLevelLine();

    const label = progressLabel(unit);
    if (label && item) {
      const progress = Math.max(0, safeNumber(item.progress, 0));
      const total = Math.max(0, safeNumber(item.total, 0));
      if (total > 0) state += ` · ${label} ${progress.toLocaleString()}/${total.toLocaleString()}`;
    }

    return { details: `${verb} ${title}`, state };
  }

  function buildPresence() {
    const s = stateRef();

    if (!s || s.loading || !Array.isArray(s.library) || !Array.isArray(s.sessions)) {
      return { kind: 'clear', reason: !s ? 'state-unavailable' : 'state-loading' };
    }

    const view = clean(s.view || 'dashboard').toLowerCase();
    const count = libraryCount(s).toLocaleString();

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
    catch (_) { payload = { kind: 'clear', reason: 'reader-error' }; }

    const signature = JSON.stringify(payload);
    const now = Date.now();
    if (!force && signature === lastSignature && now - lastSentAt < 10000) return;

    lastSignature = signature;
    lastSentAt = now;
    window.postMessage({ source: SOURCE, payload }, '*');
  }

  // Tell the isolated relay that the page hook really executed.
  window.postMessage({ source: SOURCE, type: 'hook-ready' }, '*');

  publish(true);
  setInterval(() => publish(false), 750);

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data?.source === 'mediaflow-rpc-relay' && event.data?.type === 'ready') publish(true);
  });

  window.addEventListener('focus', () => publish(true), { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) publish(true);
  }, { passive: true });
})();
