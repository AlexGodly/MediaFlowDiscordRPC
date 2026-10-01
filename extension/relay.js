(() => {
  'use strict';

  if (window.__MEDIAFLOW_RPC_RELAY_V11__) return;
  window.__MEDIAFLOW_RPC_RELAY_V11__ = true;

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
  let rememberedLibraryCount = 0;
  const LIBRARY_COUNT_STORAGE_KEY = 'mediaflowRpcLiveLibraryCountV11';

  // v11: keep the last confirmed cover for the current recommendation. MediaFlow
  // can briefly redraw the Dashboard in multiple DOM phases; during that tiny
  // window the cover <img> is absent even though the recommended title has not
  // changed. Without this sticky value Discord alternates between the title
  // cover and the fallback MediaFlow logo.
  let stickyDashboardCoverTitle = '';
  let stickyDashboardCoverUrl = '';

  try {
    chrome.storage.local.get([LIBRARY_COUNT_STORAGE_KEY]).then(data => {
      const n = Number(data?.[LIBRARY_COUNT_STORAGE_KEY]);
      if (Number.isFinite(n) && n >= 0) rememberedLibraryCount = n;
    }).catch(() => {});
  } catch (_) {}

  const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const num = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  function parseJSON(raw) {
    try { return JSON.parse(raw); } catch (_) { return null; }
  }

  function selectCacheRaw() {
    // v9: choose the newest valid recovery snapshot instead of blindly trusting
    // the legacy key. On very large libraries an old legacy snapshot can remain
    // after localStorage quota errors, while the account-scoped cache may still
    // contain newer task/settings/progress data.
    let bestRaw = null;
    let bestAt = -1;

    try {
      const legacyRaw = localStorage.getItem(LEGACY_CACHE_KEY);
      if (legacyRaw) {
        const legacy = parseJSON(legacyRaw);
        if (legacy && typeof legacy === 'object') {
          const at = num(legacy.savedAt, 0);
          bestRaw = legacyRaw;
          bestAt = at;
        }
      }
    } catch (_) {}

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
    if (t === 'oldsystem' || t.includes('old system')) return 'oldsystem';
    if (t.includes('profile') || t.includes('setting') || t.includes('about')) return 'settings';
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
    if (root.querySelector('.v153-old-system')) { lastDetectedHeading='Old System'; lastDetectedSource='old-system-marker'; return 'oldsystem'; }

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
    return `🔥 ${streak.toLocaleString()} day streak · Level ${level.toLocaleString()}`;
  }

  function rememberLibraryCount(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return 0;
    rememberedLibraryCount = Math.floor(n);
    try { chrome.storage.local.set({ [LIBRARY_COUNT_STORAGE_KEY]: rememberedLibraryCount }).catch(() => {}); } catch (_) {}
    return rememberedLibraryCount;
  }

  function liveLibraryCountFromDOM() {
    const root = document.getElementById('view-root');
    if (!root) return null;

    // Library page: this is generated directly from S.library.length.
    for (const el of root.querySelectorAll('.section-label')) {
      const m = clean(el.textContent).match(/^TITLES\s*\(([\d,]+)\)/i);
      if (m) return Number(m[1].replace(/,/g, ''));
    }

    // Profile hero exposes the complete Library count.
    for (const el of root.querySelectorAll('.profile-stat-hero .pill')) {
      const m = clean(el.textContent).match(/^([\d,]+)\s+titles?$/i);
      if (m) return Number(m[1].replace(/,/g, ''));
    }

    // Statistics -> Library Health -> Library titles.
    for (const row of root.querySelectorAll('.record-row')) {
      const key = clean(row.querySelector('.k')?.textContent);
      if (!/^Library titles$/i.test(key)) continue;
      const m = clean(row.querySelector('.v')?.textContent).match(/([\d,]+)/);
      if (m) return Number(m[1].replace(/,/g, ''));
    }

    // Order can reveal the exact total without private state when its picker is
    // unfiltered: un-ordered matches + already ordered titles = full Library.
    if (root.querySelector('.v138-order-view')) {
      const search = clean(root.querySelector('.v138-picker-search')?.value || '');
      const catSummary = clean(root.querySelector('.v140-order-filterbar .v66-cat-filter > summary')?.textContent);
      const selects = [...root.querySelectorAll('.v140-order-filterbar select')];
      const status = selects.find(x => /status/i.test(x.getAttribute('aria-label') || ''))?.value || 'all';
      const priority = selects.find(x => /priority/i.test(x.getAttribute('aria-label') || ''))?.value || 'all';
      const allCats = !catSummary || /All categories/i.test(catSummary);
      if (!search && allCats && status === 'all' && priority === 'all') {
        const matchText = clean(root.querySelector('.v140-order-matchline')?.textContent);
        const mm = matchText.match(/^([\d,]+)\s+matches?/i);
        const orderedText = clean(root.querySelector('.v138-order-summary b')?.textContent);
        const om = orderedText.match(/([\d,]+)/);
        if (mm && om) {
          const matches = Number(mm[1].replace(/,/g, ''));
          const ordered = Number(om[1].replace(/,/g, ''));
          if (Number.isFinite(matches) && Number.isFinite(ordered)) return matches + ordered;
        }
      }
    }

    return null;
  }

  function libraryCount(state) {
    // v8: ALWAYS trust a count rendered by the live MediaFlow UI before any
    // recovery cache. Large libraries can exceed localStorage quota, leaving an
    // old mf_cloud_cache_v1 snapshot behind (for example, only 4 titles).
    const live = liveLibraryCountFromDOM();
    if (Number.isFinite(live) && live >= 0) return rememberLibraryCount(live);

    // Carry the last verified live count across dynamic pages such as Batch Log.
    if (rememberedLibraryCount > 0) return rememberedLibraryCount;

    // Cache is now only a last-resort fallback, never the authoritative source.
    if (Array.isArray(state?.library)) return state.library.length;
    return 0;
  }

  function orderCountFromDOM() {
    const root = document.getElementById('view-root');
    if (!root) return 0;
    const summary = root.querySelector('.v138-order-summary');
    if (!summary) return 0;
    const bold = clean(summary.querySelector('b')?.textContent);
    const m = bold.match(/[\d,]+/);
    return m ? Math.max(0, Number(m[0].replace(/,/g, '')) || 0) : 0;
  }

  function batchCountFromDOM() {
    const root = document.getElementById('view-root');
    if (!root) return 0;

    // Count only rows where a Library title has actually been selected. Blank
    // "Add title" rows are not titles being logged yet.
    return root.querySelectorAll('.batch-log-list .batch-selected-title').length;
  }

  function titleCountText(count) {
    const n = Math.max(0, Number(count) || 0);
    return `${n.toLocaleString()} ${n === 1 ? 'title' : 'titles'}`;
  }

  function exactRecommendationFromDOM() {
    const hero = document.querySelector('#view-root .hero');
    if (!hero) return { enabled: false, title: '', hero: null };

    const note = hero.querySelector('.hero-note');
    const noteText = clean(note?.textContent);

    // This text is rendered by MediaFlow only while the exact-title option is OFF.
    if (/you choose the titles/i.test(noteText)) return { enabled: false, title: '', hero };

    // This is rendered while the option is ON but no eligible title exists.
    if (/no eligible title found/i.test(noteText)) return { enabled: true, title: '', hero };

    // Both the plain and cover-forward recommendation cards contain this label.
    if (/mediaflow recommends/i.test(noteText)) {
      const title = clean(note?.querySelector('b')?.textContent);
      return { enabled: true, title, hero };
    }

    return { enabled: false, title: '', hero };
  }

  function taskFromStateOrDOM(state) {
    const exact = exactRecommendationFromDOM();
    if (!exact.enabled || !exact.title) return null;

    const amountText = clean(exact.hero?.querySelector('.hero-amount')?.textContent).toLowerCase();
    let unit = '';
    if (/episodes?/.test(amountText)) unit = 'episodes';
    else if (/chapters?/.test(amountText)) unit = 'chapters';
    else if (/issues?/.test(amountText)) unit = 'issues';
    else if (/movies?/.test(amountText)) unit = 'movies';

    // Use the cached task only as metadata assistance (library id/unit), never as
    // proof that exact recommendations are enabled. The live Dashboard DOM is
    // authoritative for the setting and title.
    const cachedTask = state?.currentTask || null;
    return {
      title: exact.title,
      unit: unit || clean(cachedTask?.unit || ''),
      libraryId: cachedTask?.title && clean(cachedTask.title).toLowerCase() === exact.title.toLowerCase()
        ? cachedTask.libraryId
        : null
    };
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

  function safeExternalImageUrl(value) {
    const raw = clean(value);
    if (!/^https?:\/\//i.test(raw)) return '';
    try {
      const u = new URL(raw, location.href);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
      return u.href;
    } catch (_) {
      return '';
    }
  }

  function recommendedCoverUrl(task, item) {
    // Prefer the exact image MediaFlow is currently rendering for the
    // recommendation. This is live and cannot be confused with an old cache.
    const hero = document.querySelector('#view-root .hero');
    const img = hero?.querySelector('.hero-note.v50-title-feature img.v50-cover, .hero-note img.v50-cover');
    const live = safeExternalImageUrl(img?.currentSrc || img?.src || img?.getAttribute('src'));
    if (live) return live;

    // If the recommendation has a cover URL but the image card has not painted
    // yet, the title-matched Library record is a safe fallback.
    const cached = safeExternalImageUrl(item?.coverUrl);
    return cached || '';
  }

  function stableRecommendedCoverUrl(task, item) {
    const titleKey = clean(task?.title).toLowerCase();
    if (!titleKey) {
      stickyDashboardCoverTitle = '';
      stickyDashboardCoverUrl = '';
      return '';
    }

    // A different recommendation must never inherit the previous title's art.
    if (stickyDashboardCoverTitle && stickyDashboardCoverTitle !== titleKey) {
      stickyDashboardCoverTitle = '';
      stickyDashboardCoverUrl = '';
    }

    const current = recommendedCoverUrl(task, item);
    if (current) {
      stickyDashboardCoverTitle = titleKey;
      stickyDashboardCoverUrl = current;
      return current;
    }

    // MediaFlow frequently rebuilds #view-root in stages. If the same title was
    // already confirmed to have a cover, keep using it through those transient
    // no-image frames instead of telling Discord to switch back to `mediaflow`.
    if (stickyDashboardCoverTitle === titleKey && stickyDashboardCoverUrl) {
      return stickyDashboardCoverUrl;
    }

    return '';
  }

  function dashboardPresence(state) {
    const task = taskFromStateOrDOM(state);

    // Exact-title recommendations are OFF (or there is no eligible recommended
    // title): keep the normal Dashboard presence and clear any old sticky art.
    if (!task) {
      stickyDashboardCoverTitle = '';
      stickyDashboardCoverUrl = '';
      return { details: 'On Dashboard', state: streakLevelLine(state), largeImage: 'mediaflow', largeText: 'MediaFlow' };
    }

    const item = libraryItemFor(task);
    const unit = clean(task.unit || item?.unit || '');
    const title = clean(task.title || item?.title || '');
    if (!title) return { details: 'On Dashboard', state: streakLevelLine(state), largeImage: 'mediaflow', largeText: 'MediaFlow' };

    let details = `${readingUnit(unit) ? 'Reading' : 'Watching'} ${title}`;
    const word = progressWord(unit);
    if (word && item) {
      const progress = Math.max(0, num(item.progress, 0));
      const total = Math.max(0, num(item.total, 0));
      if (total > 0) details += ` · ${word} ${progress.toLocaleString()}/${total.toLocaleString()}`;
    }

    // Use the recommended title's live cover URL as the large RPC artwork when
    // available. Discord supports external URLs here. If MediaFlow has no cover,
    // fall back to the application's uploaded `mediaflow` asset.
    const cover = stableRecommendedCoverUrl(task, item);
    return {
      details,
      state: streakLevelLine(state),
      largeImage: cover || 'mediaflow',
      largeText: cover ? title : 'MediaFlow'
    };
  }

  function buildPresence() {
    const root = document.getElementById('view-root');
    if (!root) return { kind: 'clear' };

    const state = readCachedState();
    const view = detectView();
    const debug = { view, heading: lastDetectedHeading, source: lastDetectedSource };
    const libraryTotal = libraryCount(state);
    const libraryCountText = titleCountText(libraryTotal);

    switch (view) {
      case 'dashboard': {
        const p = dashboardPresence(state);
        return { kind: 'presence', ...p, ...debug };
      }
      case 'library':
        return { kind: 'presence', details: 'Browsing Library', state: libraryCountText, largeImage: 'mediaflow', largeText: 'MediaFlow', ...debug };
      case 'order':
        return { kind: 'presence', details: 'Organizing Personal Order', state: titleCountText(orderCountFromDOM()), largeImage: 'mediaflow', largeText: 'MediaFlow', ...debug };
      case 'libraryhistory':
      case 'history':
        return { kind: 'presence', details: 'Checking History', state: streakLevelLine(state), largeImage: 'mediaflow', largeText: 'MediaFlow', ...debug };
      case 'batch':
        return { kind: 'presence', details: 'Logging batches', state: titleCountText(batchCountFromDOM()), largeImage: 'mediaflow', largeText: 'MediaFlow', ...debug };
      case 'stats':
        return { kind: 'presence', details: 'Checking stats', state: streakLevelLine(state), largeImage: 'mediaflow', largeText: 'MediaFlow', ...debug };
      case 'oldsystem':
        return { kind: 'presence', details: 'In Old System', state: streakLevelLine(state), largeImage: 'mediaflow', largeText: 'MediaFlow', ...debug };
      case 'settings':
        return { kind: 'presence', details: 'In Settings', state: streakLevelLine(state), largeImage: 'mediaflow', largeText: 'MediaFlow', ...debug };
      default:
        return { kind: 'presence', details: 'Using MediaFlow', state: streakLevelLine(state), largeImage: 'mediaflow', largeText: 'MediaFlow', ...debug };
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
