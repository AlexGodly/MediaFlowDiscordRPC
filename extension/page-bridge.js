(() => {
  'use strict';

  if (window.__MEDIAFLOW_RPC_PAGE_BRIDGE__) return;
  window.__MEDIAFLOW_RPC_PAGE_BRIDGE__ = true;

  const SOURCE = 'mediaflow-rpc-page';
  let lastSignature = '';
  let lastSentAt = 0;
  let metaCache = { at: 0, streak: 0, level: 1 };

  const safeNumber = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  function readMeta() {
    const now = Date.now();
    if (now - metaCache.at < 4000) return metaCache;

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

  function libraryCount() {
    try {
      return Array.isArray(S?.library) ? S.library.length : 0;
    } catch (_) {
      return 0;
    }
  }

  function findRecommendedLibraryItem(task) {
    if (!task) return null;
    try {
      const rows = Array.isArray(S?.library) ? S.library : [];
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

  function dashboardPresence() {
    let active = false;
    let task = null;
    try {
      active = !!S?.sessionActive;
      task = S?.currentTask || null;
    } catch (_) {}

    if (!active || !task) {
      return {
        details: 'On Dashboard',
        state: streakLevelLine()
      };
    }

    const item = findRecommendedLibraryItem(task);
    const cat = categoryFor(task);
    const unit = clean(task.unit || cat?.unit || '');
    const title = clean(task.title || item?.title || '');

    if (!title) {
      return {
        details: 'On Dashboard',
        state: streakLevelLine()
      };
    }

    const verb = isReadingUnit(unit) ? 'Reading' : 'Watching';
    let state = streakLevelLine();

    const label = progressLabel(unit);
    if (label && item) {
      const progress = Math.max(0, safeNumber(item.progress, 0));
      const total = Math.max(0, safeNumber(item.total, 0));
      if (total > 0) {
        state += ` · ${label} ${progress.toLocaleString()}/${total.toLocaleString()}`;
      }
    }

    return {
      details: `${verb} ${title}`,
      state
    };
  }

  function buildPresence() {
    try {
      if (typeof S === 'undefined' || !S || S.loading || !Array.isArray(S.library) || !Array.isArray(S.sessions)) {
        return { kind: 'clear' };
      }

      const view = clean(S.view || 'dashboard').toLowerCase();
      const count = libraryCount().toLocaleString();

      switch (view) {
        case 'dashboard': {
          const p = dashboardPresence();
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
    } catch (_) {
      return { kind: 'clear' };
    }
  }

  function publish(force = false) {
    const payload = buildPresence();
    const signature = JSON.stringify(payload);
    const now = Date.now();

    if (!force && signature === lastSignature && now - lastSentAt < 10000) return;

    lastSignature = signature;
    lastSentAt = now;
    window.postMessage({ source: SOURCE, payload }, '*');
  }

  publish(true);
  setInterval(() => publish(false), 1000);

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data?.source === 'mediaflow-rpc-relay' && event.data?.type === 'ready') publish(true);
  });

  window.addEventListener('focus', () => publish(true), { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) publish(true);
  }, { passive: true });
})();
