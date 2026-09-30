(() => {
  'use strict';

  if (window.__MEDIAFLOW_RPC_RELAY_V7__) return;
  window.__MEDIAFLOW_RPC_RELAY_V7__ = true;

  const LEGACY_CACHE_KEY = 'mf_cloud_cache_v1';
  const ACCOUNT_CACHE_PREFIX = 'mf_cloud_cache_v2_';

  let lastSignature = '';
  let lastSentAt = 0;
  let cachedRaw = null;
  let cachedState = null;
  let cachedLibraryById = new Map();
  let cachedLibraryByTitle = new Map();
  let publishTimer = null;
  let navViewHint = '';
  let navViewHintAt = 0;
  let lastDetectedHeading = '';
  let lastDetectedSource = '';

  const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const num = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  function parseJSON(raw) {
    try { return JSON.parse(raw); } catch (_) { return null; }
  }

  function selectCacheRaw() {
    // MediaFlow v172 writes the complete current snapshot to this compatibility
    // cache on normal saves/startup. Prefer it because it has no wrapper.
    try {
      const legacy = localStorage.getItem(LEGACY_CACHE_KEY);
      if (legacy) return legacy;
    } catch (_) {}

    // Fallback to the account-scoped safety cache if the legacy key is absent.
    let bestRaw = null;
    let bestAt = -1;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(ACCOUNT_CACHE_PREFIX)) continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const wrapped = parseJSON(raw);
        if (!wrapped || wrapped.__mediaflowCacheV2 !== 1 || !wrapped.state) continue;
        const at = num(wrapped.cachedAt || wrapped.state?.savedAt, 0);
        if (at >= bestAt) {
          bestAt = at;
          bestRaw = JSON.stringify(wrapped.state);
        }
      }
    } catch (_) {}
    return bestRaw;
  }

  function rebuildLibraryIndexes(state) {
    cachedLibraryById = new Map();
    cachedLibraryByTitle = new Map();
    const rows = Array.isArray(state?.library) ? state.library : [];
    for (const item of rows) {
      if (!item) continue;
      if (item.id != null) cachedLibraryById.set(String(item.id), item);
      const t = clean(item.title).toLowerCase();
      if (t && !cachedLibraryByTitle.has(t)) cachedLibraryByTitle.set(t, item);
    }
  }

  function readCachedState() {
    const raw = selectCacheRaw();
    if (!raw) return cachedState;
    if (raw === cachedRaw && cachedState) return cachedState;

    const parsed = parseJSON(raw);
    if (!parsed || typeof parsed !== 'object') return cachedState;

    cachedRaw = raw;
    cachedState = parsed;
    rebuildLibraryIndexes(parsed);
    return cachedState;
  }

  function mapViewText(value) {
    const t = clean(value).toLowerCase();
    if (!t) return '';
    if (t.includes('library history')) return 'libraryhistory';
    if (t === 'today' || t === 'dashboard' || t.includes('dashboard')) return 'dashboard';
    if (t === 'library' || t.startsWith('library ')) return 'library';
    if (t === 'history' || (t.includes('history') && !t.includes('library'))) return 'history';
    if (t.includes('batch')) return 'batch';
    if (t.includes('statistic') || t === 'stats' || t.includes('stats')) return 'stats';
    if (t === 'order' || t.includes('personal order')) return 'order';
    if (t.includes('profile') || t.includes('setting') || t.includes('about') || t.includes('old system')) return 'settings';
    return '';
  }

  function visibleText(el) {
    if (!el) return '';
    try {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return '';
    } catch (_) {}
    return clean(el.textContent);
  }

  function detectView() {
    const root = document.getElementById('view-root');
    if (!root) { lastDetectedHeading=''; lastDetectedSource='no-root'; return ''; }

    // Strong page-specific markers first. These are not affected by sidebar
    // re-ordering or the active-nav class and therefore work with dynamic pages.
    if (root.querySelector('.v138-order-view')) { lastDetectedHeading='Order'; lastDetectedSource='order-marker'; return 'order'; }
    if (root.querySelector('.v161-about-hero, .v161-about-grid, .v161-faq')) { lastDetectedHeading='About'; lastDetectedSource='about-marker'; return 'settings'; }
    if (root.querySelector('.v153-old-system')) { lastDetectedHeading='Old System'; lastDetectedSource='old-system-marker'; return 'settings'; }

    const candidates = [
      ...root.querySelectorAll('.view-head .view-title, .view-head h1, .view-head h2'),
      ...root.querySelectorAll(':scope > .fade-in > .view-title, :scope > .fade-in > h1')
    ];
    for (const el of candidates) {
      const text = visibleText(el);
      const mapped = mapViewText(text);
      if (mapped) {
        lastDetectedHeading = text;
        lastDetectedSource = 'dom-heading';
        return mapped;
      }
    }

    // Extra DOM markers for pages whose heading can briefly disappear during
    // a MediaFlow rerender.
    if (root.querySelector('.lib-toolbar, .mf-batchbar .mf-select')) { lastDetectedHeading='Library'; lastDetectedSource='library-marker'; return 'library'; }
    if (root.querySelector('.batch-log-list, .batch-log-meta')) { lastDetectedHeading='Batch Log'; lastDetectedSource='batch-marker'; return 'batch'; }
    if (root.querySelector('.stats-level-card, .sat-grid, .record-list .record-row')) { lastDetectedHeading='Statistics'; lastDetectedSource='stats-marker'; return 'stats'; }
    if (root.querySelector('.mf-activity') && /library\s+history/i.test(clean(root.textContent))) { lastDetectedHeading='Library History'; lastDetectedSource='library-history-marker'; return 'libraryhistory'; }
    if (root.querySelector('.profile-card, #profile-name, #profile-email')) { lastDetectedHeading='Profile Settings'; lastDetectedSource='profile-marker'; return 'settings'; }

    // A navigation click is captured before MediaFlow redraws the dynamic page.
    // Keep that hint briefly so a transient empty #view-root cannot fall back
    // to Dashboard.
    if (navViewHint && Date.now() - navViewHintAt < 2500) {
      lastDetectedHeading = navViewHint;
      lastDetectedSource = 'navigation-click';
      return navViewHint;
    }

    const active = document.querySelector('.nav-item.active, .mobile-more-item.active, .mtab.active');
    const activeText = visibleText(active);
    const activeMapped = mapViewText(activeText);
    if (activeMapped) {
      lastDetectedHeading = activeText;
      lastDetectedSource = 'active-nav';
      return activeMapped;
    }

    lastDetectedHeading = '';
    lastDetectedSource = 'fallback';
    return 'dashboard';
  }

  function readMetaFromDOM() {
    let level = 1;
    let streak = 0;

    const levelText = clean(document.querySelector('.sidebar-foot .level-num')?.textContent);
    const lm = levelText.match(/(?:lv\.?|level)\s*(\d[\d,]*)/i);
    if (lm) level = Math.max(1, Number(lm[1].replace(/,/g, '')) || 1);

    const labels = [...document.querySelectorAll('.sidebar-foot .k')];
    const streakLabel = labels.find(el => /day\s*streak/i.test(clean(el.textContent)));
    const streakText = clean(streakLabel?.nextElementSibling?.textContent);
    const sm = streakText.match(/(\d[\d,]*)/);
    if (sm) streak = Math.max(0, Number(sm[1].replace(/,/g, '')) || 0);

    return { streak, level };
  }

  function isoDateFromSession(s) {
    const raw = clean(s?.date);
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const ts = num(s?.timestamp, 0);
    if (ts > 0) {
      const d = new Date(ts);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    return '';
  }

  function fallbackStreakFromState(state) {
    const days = new Set();
    for (const s of (Array.isArray(state?.sessions) ? state.sessions : [])) {
      if (!s || s.status === 'skipped') continue;
      const key = isoDateFromSession(s);
      if (key) days.add(key);
    }
    const today = new Date().toISOString().slice(0, 10);
    if (!days.has(today)) return 0;
    let streak = 0;
    let cur = new Date(`${today}T12:00:00Z`);
    while (true) {
      const key = cur.toISOString().slice(0, 10);
      if (!days.has(key)) break;
      streak++;
      cur.setUTCDate(cur.getUTCDate() - 1);
    }
    return streak;
  }

  function readMeta(state) {
    const dom = readMetaFromDOM();
    if (dom.level > 1 || dom.streak > 0) return dom;
    return { streak: fallbackStreakFromState(state), level: dom.level || 1 };
  }

  function streakLevelLine(state) {
    const { streak, level } = readMeta(state);
    return `MediaFlow 🔥 ${streak.toLocaleString()} day streak · Level ${level.toLocaleString()}`;
  }

  function libraryCount(state) {
    if (Array.isArray(state?.library)) return state.library.length;

    // Visible Library fallback if a huge local safety cache could not be stored.
    const root = document.getElementById('view-root');
    const labels = root ? [...root.querySelectorAll('.section-label')] : [];
    for (const el of labels) {
      const m = clean(el.textContent).match(/^TITLES\s*\(([\d,]+)\)/i);
      if (m) return Number(m[1].replace(/,/g, '')) || 0;
    }

    // Profile / Statistics also expose the Library total in the DOM.
    const bodyText = clean(root?.textContent);
    let m = bodyText.match(/([\d,]+)\s+Library titles/i);
    if (!m) m = bodyText.match(/Library titles\s+([\d,]+)/i);
    return m ? (Number(m[1].replace(/,/g, '')) || 0) : 0;
  }

  function taskFromStateOrDOM(state) {
    const task = state?.currentTask || null;
    if (task && state?.sessionActive) return task;

    const hero = document.querySelector('#view-root .hero');
    if (!hero) return null;
    if (/start a session/i.test(clean(hero.textContent))) return null;

    const title = clean(hero.querySelector('.hero-note b')?.textContent);
    const amountText = clean(hero.querySelector('.hero-amount')?.textContent).toLowerCase();
    let unit = '';
    if (/episodes?/.test(amountText)) unit = 'episodes';
    else if (/chapters?/.test(amountText)) unit = 'chapters';
    else if (/issues?/.test(amountText)) unit = 'issues';
    else if (/movies?/.test(amountText)) unit = 'movies';
    return title ? { title, unit } : null;
  }

  function libraryItemFor(task) {
    if (!task) return null;
    if (task.libraryId != null) {
      const hit = cachedLibraryById.get(String(task.libraryId));
      if (hit) return hit;
    }
    const wanted = clean(task.title).toLowerCase();
    return wanted ? (cachedLibraryByTitle.get(wanted) || null) : null;
  }

  function progressWord(unit) {
    const u = clean(unit).toLowerCase();
    if (u === 'episodes' || u === 'episode') return 'Episode';
    if (u === 'chapters' || u === 'chapter') return 'Chapter';
    if (u === 'issues' || u === 'issue') return 'Issue';
    return '';
  }

  function readingUnit(unit) {
    const u = clean(unit).toLowerCase();
    return ['chapters', 'chapter', 'issues', 'issue', 'pages', 'page'].includes(u);
  }

  function dashboardPresence(state) {
    const task = taskFromStateOrDOM(state);
    if (!task) return { details: 'On Dashboard', state: streakLevelLine(state) };

    const item = libraryItemFor(task);
    const unit = clean(task.unit || '');
    const title = clean(task.title || item?.title || '');
    if (!title) return { details: 'On Dashboard', state: streakLevelLine(state) };

    const details = `${readingUnit(unit) ? 'Reading' : 'Watching'} ${title}`;
    let stateLine = streakLevelLine(state);
    const word = progressWord(unit);
    if (word && item) {
      const progress = Math.max(0, num(item.progress, 0));
      const total = Math.max(0, num(item.total, 0));
      if (total > 0) stateLine += ` · ${word} ${progress.toLocaleString()}/${total.toLocaleString()}`;
    }
    return { details, state: stateLine };
  }

  function buildPresence() {
    const root = document.getElementById('view-root');
    if (!root) return { kind: 'clear' };

    const state = readCachedState();
    const view = detectView();
    const debug = { view, heading: lastDetectedHeading, source: lastDetectedSource };
    const count = libraryCount(state);
    const countText = count > 0 ? `${count.toLocaleString()} titles` : 'MediaFlow Library';

    switch (view) {
      case 'dashboard': {
        const p = dashboardPresence(state);
        return { kind: 'presence', ...p, ...debug };
      }
      case 'library':
        return { kind: 'presence', details: 'Browsing Library', state: countText, ...debug };
      case 'order':
        return { kind: 'presence', details: 'Organizing Personal Order', state: countText, ...debug };
      case 'libraryhistory':
      case 'history':
        return { kind: 'presence', details: 'Checking History', state: streakLevelLine(state), ...debug };
      case 'batch':
        return { kind: 'presence', details: 'Logging batches', state: countText, ...debug };
      case 'stats':
        return { kind: 'presence', details: 'Checking stats', state: streakLevelLine(state), ...debug };
      case 'settings':
        return { kind: 'presence', details: 'In Settings', state: streakLevelLine(state), ...debug };
      default:
        return { kind: 'presence', details: 'Using MediaFlow', state: streakLevelLine(state), ...debug };
    }
  }

  function forward(payload) {
    try {
      chrome.runtime.sendMessage({ type: 'MEDIAFLOW_RPC_STATE', payload }).catch(() => {});
    } catch (_) {}
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
    forward(payload);
  }

  function schedulePublish() {
    clearTimeout(publishTimer);
    publishTimer = setTimeout(() => publish(true), 120);
  }

  // Capture MediaFlow's dynamic navigation before its click handler redraws
  // #view-root. Parsing the inline setView/mobileNav target is more reliable
  // than trusting the active class because MediaFlow allows navigation re-ordering.
  document.addEventListener('click', (event) => {
    const el = event.target?.closest?.('.nav-item, .mtab, .mobile-more-item');
    if (!el) return;
    const onclick = el.getAttribute('onclick') || '';
    const match = onclick.match(/(?:setView|mobileNav)\(\s*['"]([^'"]+)['"]\s*\)/i);
    const raw = match?.[1] || visibleText(el);
    const mapped = mapViewText(raw);
    if (!mapped) return;
    navViewHint = mapped;
    navViewHintAt = Date.now();
    setTimeout(() => publish(true), 40);
    setTimeout(() => publish(true), 250);
    setTimeout(() => publish(true), 700);
  }, true);

  // MediaFlow redraws #view-root whenever the active page or recommendation
  // changes. Observe the rendered UI instead of relying on its private closure.
  const observer = new MutationObserver(schedulePublish);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  publish(true);
  setInterval(() => publish(false), 1000);
  window.addEventListener('focus', () => publish(true), { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) publish(true);
  }, { passive: true });
  window.addEventListener('pagehide', () => forward({ kind: 'clear' }), { capture: true });
})();
