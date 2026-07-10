/* 公开主页 — 只读，按评分分区展示 */

const {
  $, escapeHtml, MOVIE_RATING_TIERS, filterAndSort, calcStats, countByTier,
  renderGrid, renderGrouped, renderDetail, renderTastePanel, renderBestPanel,
  renderSpacePlaceholder, renderSpaceBestPanel, renderSpaceRecordsPanel,
  renderCharactersPanel,
  renderNotesPanel,
  renderDiaryPanel,
  renderCodesPanel,
  renderDoujinPanel,
  renderLinksPanel,
  getBestItems,
  bindDeferredPosters,
} = MovieShared;

const DEFAULT_MOVIE_SECTIONS = [
  { id: 'records', label: '观影记录' },
  { id: 'best', label: '最' },
  { id: 'taste', label: '观影口味' },
  { id: 'notes', label: '要说的' },
];

const DEFAULT_SPACE_SECTIONS = [
  { id: 'records', label: '记录' },
  { id: 'best', label: '最' },
];

const HIDDEN_TAB_IDS = new Set(['idol', 'diary']);
const HIDDEN_MOVIE_SUB = 'notes';
const HIDDEN_ANIME_SUB = 'r18';
const HIDDEN_UNLOCK_CLICKS = 15;
const NOTES_UNLOCK_CLICKS = 10;
const ANIME_R18_UNLOCK_CLICKS = 10;
const HIDDEN_UNLOCK_KEY = 'site-hidden-unlocked';
const IDOL_UNLOCK_KEY = 'site-idol-unlocked';
const NOTES_UNLOCK_KEY = 'site-notes-unlocked';
const ANIME_R18_UNLOCK_KEY = 'site-anime-r18-unlocked';
const UNLOCK_CLICK_RESET_MS = 1500;

let hiddenSpacesUnlocked = false;
let notesUnlocked = false;
let animeR18Unlocked = false;
let hiddenUnlockClickCount = 0;
let hiddenUnlockClickTimer = null;
let notesClickCount = 0;
let notesClickTimer = null;
let animeR18ClickCount = 0;
let animeR18ClickTimer = null;

function loadHiddenUnlockState() {
  try {
    localStorage.removeItem(IDOL_UNLOCK_KEY);
    localStorage.removeItem(HIDDEN_UNLOCK_KEY);
    localStorage.removeItem(NOTES_UNLOCK_KEY);
    localStorage.removeItem(ANIME_R18_UNLOCK_KEY);
    hiddenSpacesUnlocked = sessionStorage.getItem(HIDDEN_UNLOCK_KEY) === '1'
      || sessionStorage.getItem(IDOL_UNLOCK_KEY) === '1';
    notesUnlocked = sessionStorage.getItem(NOTES_UNLOCK_KEY) === '1';
    animeR18Unlocked = sessionStorage.getItem(ANIME_R18_UNLOCK_KEY) === '1';
  } catch {
    hiddenSpacesUnlocked = false;
    notesUnlocked = false;
    animeR18Unlocked = false;
  }
}

function isHiddenTab(tabId) {
  return HIDDEN_TAB_IDS.has(tabId) && !hiddenSpacesUnlocked;
}

function isNotesSubHidden(subId) {
  return subId === HIDDEN_MOVIE_SUB && !notesUnlocked;
}

function isAnimeR18SubHidden(subId) {
  return subId === HIDDEN_ANIME_SUB && !animeR18Unlocked;
}

function isSpaceSubHidden(spaceId, subId) {
  if (spaceId === 'movies') return isNotesSubHidden(subId);
  if (spaceId === 'anime') return isAnimeR18SubHidden(subId);
  return false;
}

function getVisibleTabs() {
  return (siteConfig.tabs || []).filter((tab) => !isHiddenTab(tab.id));
}

function getContentSpaces() {
  return Object.keys(siteConfig.spaces || {}).filter((id) => !isHiddenTab(id));
}

function syncHiddenTabsVisibility() {
  HIDDEN_TAB_IDS.forEach((tabId) => {
    document.querySelector(`.tab-panel[data-tab="${tabId}"]`)
      ?.classList.toggle('hidden', !hiddenSpacesUnlocked);
  });
}

function syncNotesVisibility() {
  document.getElementById('subPanelNotes')
    ?.classList.toggle('hidden', !notesUnlocked);
}

function syncAnimeR18Visibility() {
  document.getElementById('subPanelAnimeR18')
    ?.classList.toggle('hidden', !animeR18Unlocked);
}

function unlockHiddenSpaces() {
  if (hiddenSpacesUnlocked) return;
  hiddenSpacesUnlocked = true;
  try {
    sessionStorage.setItem(HIDDEN_UNLOCK_KEY, '1');
    sessionStorage.setItem(IDOL_UNLOCK_KEY, '1');
  } catch { /* ignore */ }
  ensureSpaceState();
  buildSpaceItemIndex();
  syncHiddenTabsVisibility();
  renderContentSpaces();
  renderDiary();
  renderSiteTabs();
}

function unlockNotes() {
  if (notesUnlocked) return;
  notesUnlocked = true;
  try { sessionStorage.setItem(NOTES_UNLOCK_KEY, '1'); } catch { /* ignore */ }
  syncNotesVisibility();
  renderSubTabs('movies');
}

function unlockAnimeR18() {
  if (animeR18Unlocked) return;
  animeR18Unlocked = true;
  try { sessionStorage.setItem(ANIME_R18_UNLOCK_KEY, '1'); } catch { /* ignore */ }
  syncAnimeR18Visibility();
  renderSubTabs('anime');
  renderContentSpaces();
}

function setupHiddenUnlock() {
  const avatar = $('#brandAvatar');
  if (!avatar) return;
  avatar.style.cursor = 'pointer';
  avatar.addEventListener('click', () => {
    if (hiddenSpacesUnlocked) return;
    hiddenUnlockClickCount += 1;
    clearTimeout(hiddenUnlockClickTimer);
    hiddenUnlockClickTimer = setTimeout(() => { hiddenUnlockClickCount = 0; }, UNLOCK_CLICK_RESET_MS);
    if (hiddenUnlockClickCount >= HIDDEN_UNLOCK_CLICKS) {
      hiddenUnlockClickCount = 0;
      clearTimeout(hiddenUnlockClickTimer);
      unlockHiddenSpaces();
    }
  });
}

function setupNotesUnlock() {
  const nav = els.siteTabs;
  if (!nav || nav.dataset.notesUnlockBound) return;
  nav.dataset.notesUnlockBound = '1';
  nav.addEventListener('click', (e) => {
    const tab = e.target.closest('.site-tab[data-tab="movies"]');
    if (!tab || notesUnlocked) return;
    notesClickCount += 1;
    clearTimeout(notesClickTimer);
    notesClickTimer = setTimeout(() => { notesClickCount = 0; }, UNLOCK_CLICK_RESET_MS);
    if (notesClickCount >= NOTES_UNLOCK_CLICKS) {
      notesClickCount = 0;
      clearTimeout(notesClickTimer);
      unlockNotes();
    }
  });
}

function setupAnimeR18Unlock() {
  const nav = els.siteTabs;
  if (!nav || nav.dataset.animeR18UnlockBound) return;
  nav.dataset.animeR18UnlockBound = '1';
  nav.addEventListener('click', (e) => {
    const tab = e.target.closest('.site-tab[data-tab="anime"]');
    if (!tab || animeR18Unlocked) return;
    animeR18ClickCount += 1;
    clearTimeout(animeR18ClickTimer);
    animeR18ClickTimer = setTimeout(() => { animeR18ClickCount = 0; }, UNLOCK_CLICK_RESET_MS);
    if (animeR18ClickCount >= ANIME_R18_UNLOCK_CLICKS) {
      animeR18ClickCount = 0;
      clearTimeout(animeR18ClickTimer);
      unlockAnimeR18();
    }
  });
}

let movies = [];
let spaceItemIndex = new Map();
let activeTier = 'all';
let siteConfig = {
  title: '我的精神家园',
  subtitle: '记录 · 分享 · 留存',
  defaultTab: 'movies',
  defaultSubTab: 'records',
  tabs: [{ id: 'movies', label: '电影空间', sections: DEFAULT_MOVIE_SECTIONS }],
  spaces: {},
};
let activeTab = 'movies';
let activeSubTabs = { movies: 'records' };

const spaceTierState = {};

const FILTER_LABELS = [
  { id: 'all', label: '全部' },
  ...MOVIE_RATING_TIERS.map((t) => ({ id: t.id, label: t.label })),
];

const els = {
  pageContent: $('#pageContent'),
  movieList: $('#movieList'),
  empty: $('#emptyState'),
  search: $('#searchInput'),
  sort: $('#sortSelect'),
  ratingFilters: $('#ratingFilters'),
  detailModal: $('#detailModal'),
  statTotal: $('#statTotal'),
  statPerfect: $('#statPerfect'),
  catalogTitle: $('#catalogTitle'),
  catalogCount: $('#catalogCount'),
  loading: $('#loadingState'),
  pageTitle: $('#pageTitle'),
  pageSubtitle: $('#pageSubtitle'),
  siteTabs: $('#siteTabs'),
  movieSubTabs: $('#movieSubTabs'),
  tasteContent: $('#tasteContent'),
  notesContent: $('#notesContent'),
  bestContent: $('#bestContent'),
};

function getTabConfig(tabId) {
  return siteConfig.tabs.find((t) => t.id === tabId);
}

function getSpaceConfig(spaceId) {
  return siteConfig.spaces?.[spaceId] || {};
}

function normalizeSiteConfig() {
  if (!siteConfig.spaces) siteConfig.spaces = {};

  // 旧 id「actress」易被广告拦截扩展屏蔽，统一迁移为 idol
  if (siteConfig.spaces.actress && !siteConfig.spaces.idol) {
    siteConfig.spaces.idol = siteConfig.spaces.actress;
    delete siteConfig.spaces.actress;
  }
  if (Array.isArray(siteConfig.tabs)) {
    siteConfig.tabs = siteConfig.tabs.map((tab) =>
      tab.id === 'actress' ? { ...tab, id: 'idol' } : tab
    );
  }
  if (siteConfig.defaultTab === 'actress') siteConfig.defaultTab = 'idol';
}

function ensureSpaceState() {
  getContentSpaces().forEach((id) => {
    if (!(id in activeSubTabs)) activeSubTabs[id] = getDefaultSubTab(id);
    if (!(id in spaceTierState)) spaceTierState[id] = 'all';
  });
}

function ensureSpacePanels() {
  const main = document.querySelector('.main');
  if (!main) return;

  getContentSpaces().forEach((spaceId) => {
    if (document.querySelector(`.tab-panel[data-tab="${spaceId}"]`)) return;

    const label = getTabConfig(spaceId)?.label || spaceId;
    const panel = document.createElement('div');
    panel.className = 'tab-panel';
    panel.dataset.tab = spaceId;
    panel.innerHTML = `
      <nav class="sub-tabs space-sub-tabs" data-space="${spaceId}" aria-label="${escapeHtml(label)}分区"></nav>
      <div class="sub-panel active" data-space="${spaceId}" data-sub="records">
        <div class="page-content space-records-page" id="${spaceId}_records"></div>
      </div>
      <div class="sub-panel" data-space="${spaceId}" data-sub="best">
        <div class="page-content picks-page" id="${spaceId}_best"></div>
      </div>`;
    const sections = getSections(spaceId);
    if (sections.some((s) => s.id === 'characters')) {
      panel.innerHTML += `
      <div class="sub-panel" data-space="${spaceId}" data-sub="characters">
        <div class="page-content characters-page" id="${spaceId}_characters"></div>
      </div>`;
    }
    if (sections.some((s) => s.id === 'codes')) {
      panel.innerHTML += `
      <div class="sub-panel" data-space="${spaceId}" data-sub="codes">
        <div class="page-content codes-page" id="${spaceId}_codes"></div>
      </div>`;
    }
    if (sections.some((s) => s.id === 'links')) {
      panel.innerHTML += `
      <div class="sub-panel" data-space="${spaceId}" data-sub="links">
        <div class="page-content links-page" id="${spaceId}_links"></div>
      </div>`;
    }
    if (sections.some((s) => s.id === 'r18')) {
      panel.innerHTML += `
      <div class="sub-panel hidden" data-space="${spaceId}" data-sub="r18" id="${spaceId}_r18_panel">
        <div class="page-content codes-page" id="${spaceId}_r18"></div>
      </div>`;
    }
    main.appendChild(panel);
  });

  // 移除已废弃的 actress 面板，避免空页签残留
  document.querySelector('.tab-panel[data-tab="actress"]')?.remove();
}

function buildSpaceItemIndex() {
  spaceItemIndex = new Map();
  getContentSpaces().forEach((spaceId) => {
    const space = getSpaceConfig(spaceId);
    [...(space.items || []), ...getBestItems(space.best)].forEach((item) => {
      if (item?.id && !spaceItemIndex.has(item.id)) {
        spaceItemIndex.set(item.id, item);
      }
    });
  });
}

function getSections(tabId) {
  if (tabId === 'diary') return [];
  if (tabId === 'movies') {
    const sections = getTabConfig('movies')?.sections;
    const list = Array.isArray(sections) && sections.length ? sections : DEFAULT_MOVIE_SECTIONS;
    return list.filter((s) => !isNotesSubHidden(s.id));
  }
  const space = getSpaceConfig(tabId);
  if (Array.isArray(space.sections) && space.sections.length) {
    return space.sections.filter((s) => !isSpaceSubHidden(tabId, s.id));
  }
  return DEFAULT_SPACE_SECTIONS;
}

function getDefaultSubTab(tabId) {
  if (tabId === 'movies') return siteConfig.defaultSubTab || 'records';
  return getSpaceConfig(tabId).defaultSubTab || 'records';
}

function initActiveSubTabs() {
  activeSubTabs.movies = getDefaultSubTab('movies');
  ensureSpaceState();
}

async function loadPublicData() {
  const ts = Date.now();
  const [moviesRes, siteRes] = await Promise.all([
    fetch(`data/movies.json?t=${ts}`),
    fetch(`data/site.json?t=${ts}`),
  ]);

  if (!moviesRes.ok) throw new Error('无法加载片单数据');
  const data = await moviesRes.json();
  if (!Array.isArray(data)) throw new Error('片单数据格式错误');
  movies = data;

  if (siteRes.ok) {
    siteConfig = { ...siteConfig, ...(await siteRes.json()) };
    if (!Array.isArray(siteConfig.tabs) || !siteConfig.tabs.length) {
      siteConfig.tabs = [{ id: 'movies', label: '电影空间', sections: DEFAULT_MOVIE_SECTIONS }];
    }
    const movieTab = getTabConfig('movies');
    if (movieTab && (!Array.isArray(movieTab.sections) || !movieTab.sections.length)) {
      movieTab.sections = DEFAULT_MOVIE_SECTIONS;
    }
    if (!siteConfig.spaces) siteConfig.spaces = {};
    normalizeSiteConfig();
    buildSpaceItemIndex();
    document.title = siteConfig.title || document.title;
    if (els.pageTitle) els.pageTitle.textContent = siteConfig.title;
    if (els.pageSubtitle) {
      const sub = siteConfig.subtitle || '';
      els.pageSubtitle.textContent = sub;
      els.pageSubtitle.classList.toggle('hidden', !sub);
    }
  }

  initActiveSubTabs();
}

function renderSubTabs(tabId) {
  const nav = tabId === 'movies'
    ? els.movieSubTabs
    : document.querySelector(`.space-sub-tabs[data-space="${tabId}"]`);
  if (!nav) return;

  const sections = getSections(tabId);
  let active = activeSubTabs[tabId] || getDefaultSubTab(tabId);
  if (!sections.some((s) => s.id === active)) active = sections[0].id;
  activeSubTabs[tabId] = active;

  nav.innerHTML = sections.map(({ id, label }) =>
    `<button type="button" class="sub-tab${id === active ? ' active' : ''}" data-sub="${id}">${label}</button>`
  ).join('');

  nav.querySelectorAll('.sub-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchSubTab(tabId, btn.dataset.sub));
  });
}

function renderSiteTabs() {
  if (!els.siteTabs) return;
  const tabs = getVisibleTabs();
  if (isHiddenTab(activeTab)) {
    activeTab = siteConfig.defaultTab || 'movies';
  }
  if (!tabs.some((t) => t.id === activeTab)) {
    activeTab = siteConfig.defaultTab || tabs[0]?.id || 'movies';
  }

  els.siteTabs.innerHTML = tabs.map(({ id, label }) =>
    `<button type="button" class="site-tab${id === activeTab ? ' active' : ''}" data-tab="${id}">${label}</button>`
  ).join('');

  els.siteTabs.querySelectorAll('.site-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  renderSubTabs('movies');
  getContentSpaces().forEach((id) => renderSubTabs(id));
  switchTab(activeTab, false);
}

function switchTab(tabId, updateUrl = true) {
  if (!tabId) return;
  activeTab = tabId;

  els.siteTabs?.querySelectorAll('.site-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.tab === tabId);
  });

  const sections = getSections(tabId);
  if (sections.length) {
    switchSubTab(tabId, activeSubTabs[tabId] || getDefaultSubTab(tabId), updateUrl);
    return;
  }

  if (updateUrl) updateRouteUrl();
  if (tabId === 'diary') renderDiary();
}

function switchSubTab(tabId, subId, updateUrl = true) {
  if (!subId) return;
  const sections = getSections(tabId);
  if (!sections.some((s) => s.id === subId)) return;

  activeSubTabs[tabId] = subId;

  const panel = document.querySelector(`.tab-panel[data-tab="${tabId}"]`);
  if (panel) {
    panel.querySelectorAll('.sub-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.sub === subId);
    });
    panel.querySelectorAll('.sub-panel').forEach((subPanel) => {
      subPanel.classList.toggle('active', subPanel.dataset.sub === subId);
    });
    const activeSub = panel.querySelector('.sub-panel.active');
    if (activeSub) bindDeferredPosters(activeSub);
  }

  if (updateUrl) updateRouteUrl();
}

function updateRouteUrl() {
  const url = new URL(window.location.href);
  const defaultTab = siteConfig.defaultTab || 'movies';
  const defaultSub = getDefaultSubTab(activeTab);

  if (activeTab === defaultTab) url.searchParams.delete('tab');
  else url.searchParams.set('tab', activeTab);

  if (getSections(activeTab).length) {
    if (activeSubTabs[activeTab] === defaultSub) url.searchParams.delete('sub');
    else url.searchParams.set('sub', activeSubTabs[activeTab]);
  } else {
    url.searchParams.delete('sub');
  }

  history.replaceState(null, '', url);
}

function renderTaste() {
  if (!els.tasteContent) return;
  renderTastePanel(els.tasteContent, siteConfig.taste);
}

function renderNotes() {
  if (!els.notesContent) return;
  renderNotesPanel(els.notesContent, siteConfig.notes);
}

function renderDiary() {
  const container = $('#diaryContent');
  if (!container) return;
  const tab = getTabConfig('diary');
  renderDiaryPanel(container, siteConfig.diaries, {
    kicker: 'Hidden Space',
    title: tab?.label || '隐藏空间',
  });
}

function renderBest() {
  if (!els.bestContent) return;
  renderBestPanel(els.bestContent, siteConfig.best, movies, openDetail);
}

function renderContentSpaces() {
  getContentSpaces().forEach((spaceId) => {
    const space = getSpaceConfig(spaceId);
    const items = space.items || [];
    const kicker = space.kicker || '';

    renderSpaceRecordsPanel($(`#${spaceId}_records`), {
      items,
      kicker,
      statLabel: space.statLabel || '已记录',
      activeTier: spaceTierState[spaceId] || 'all',
      onTierChange: (tierId) => {
        spaceTierState[spaceId] = tierId;
        renderContentSpaces();
      },
      onItemClick: openSpaceDetail,
    });

    renderSpaceBestPanel($(`#${spaceId}_best`), space.best, items, {
      spaceKicker: kicker,
      onItemClick: openSpaceDetail,
    });

    if (space.characters?.length || getSections(spaceId).some((s) => s.id === 'characters')) {
      renderCharactersPanel($(`#${spaceId}_characters`), {
        characters: space.characters || [],
        kicker,
      });
    }

    if (space.codes?.length || getSections(spaceId).some((s) => s.id === 'codes')) {
      renderCodesPanel($(`#${spaceId}_codes`), {
        codes: space.codes || [],
        kicker,
      });
    }

    if (space.links?.length || getSections(spaceId).some((s) => s.id === 'links')) {
      renderLinksPanel($(`#${spaceId}_links`), {
        links: space.links || [],
        kicker,
      });
    }

    if (space.doujins?.length || getSections(spaceId).some((s) => s.id === 'r18')) {
      renderDoujinPanel($(`#${spaceId}_r18`), {
        doujins: space.doujins || [],
        kicker,
        title: 'R18',
      });
    }
  });
}

function openSpaceDetail(id) {
  const item = spaceItemIndex.get(id);
  if (!item) return;
  renderDetail(item, $('#detailContent'), { showEdit: false });
  els.detailModal.showModal();
}

function renderPlaceholderSpaces() {
  (siteConfig.tabs || []).forEach((tab) => {
    if (tab.id === 'movies' || getContentSpaces().includes(tab.id)) return;
    if (!tab.message && !tab.icon) return;
    const container = $(`#space_${tab.id}`);
    if (container) renderSpacePlaceholder(container, tab);
  });
}

function renderFilterChips() {
  if (!els.ratingFilters) return;
  const counts = countByTier(movies, MOVIE_RATING_TIERS);
  els.ratingFilters.innerHTML = FILTER_LABELS.map(({ id, label }) => {
    const count = counts[id] ?? 0;
    const active = activeTier === id ? ' active' : '';
    const empty = count === 0 && id !== 'all' ? ' disabled' : '';
    return `<button type="button" class="filter-chip filter-chip--${id}${active}${empty}" data-tier="${id}" ${empty ? 'disabled' : ''}>
      <span class="filter-chip-label">${label}</span>
      <span class="filter-chip-count">${count}</span>
    </button>`;
  }).join('');

  els.ratingFilters.querySelectorAll('.filter-chip:not([disabled])').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTier = btn.dataset.tier;
      renderFilterChips();
      render();
    });
  });
}

function render() {
  try {
    const query = els.search?.value ?? '';
    const sort = els.sort?.value ?? 'rating-desc';
    const list = filterAndSort(movies, query, sort, activeTier);
    const stats = calcStats(movies);

    if (els.statTotal) els.statTotal.textContent = stats.total;
    if (els.statPerfect) els.statPerfect.textContent = countByTier(movies, MOVIE_RATING_TIERS)['10'] || 0;

    const tierMeta = FILTER_LABELS.find((f) => f.id === activeTier);
    if (els.catalogTitle) els.catalogTitle.textContent = tierMeta?.label || '全部影片';
    if (els.catalogCount) els.catalogCount.textContent = list.length ? `共 ${list.length} 部` : '';

    const showGrouped = activeTier === 'all' && !query.trim() && sort === 'rating-desc';

    if (list.length === 0) {
      if (els.movieList) els.movieList.innerHTML = '';
      els.empty?.classList.add('visible');
    } else {
      els.empty?.classList.remove('visible');
      if (showGrouped) {
        renderGrouped(list, els.movieList, openDetail, MOVIE_RATING_TIERS);
      } else {
        els.movieList.innerHTML = '<div class="movie-grid" id="flatGrid"></div>';
        renderGrid(list, $('#flatGrid'), openDetail);
      }
    }
  } catch (err) {
    console.error('render failed:', err);
    if (els.movieList) {
      els.movieList.innerHTML = `<p style="color:var(--danger);padding:1rem">页面渲染出错：${err.message}。请强制刷新（Ctrl+F5）后再试。</p>`;
    }
  }
}

function openDetail(id) {
  const m = movies.find((x) => x.id === id);
  if (!m) return;
  renderDetail(m, $('#detailContent'), { showEdit: false });
  els.detailModal.showModal();
}

async function init() {
  try {
    await loadPublicData();
    loadHiddenUnlockState();
    ensureSpacePanels();
    syncHiddenTabsVisibility();
    syncNotesVisibility();
    syncAnimeR18Visibility();
    renderSiteTabs();
    renderTaste();
    renderNotes();
    renderDiary();
    renderBest();
    renderContentSpaces();
    renderPlaceholderSpaces();

    const params = new URLSearchParams(window.location.search);
    let tabFromUrl = params.get('tab');
    if (tabFromUrl === 'actress') tabFromUrl = 'idol';
    let subFromUrl = params.get('sub');
    if (subFromUrl === 'perfect') subFromUrl = 'records';

    if (tabFromUrl === 'taste') {
      activeTab = 'movies';
      activeSubTabs.movies = 'taste';
    } else if (tabFromUrl === 'notes') {
      activeTab = 'movies';
      if (notesUnlocked) activeSubTabs.movies = 'notes';
    } else if (subFromUrl === 'r18' && tabFromUrl === 'anime') {
      activeTab = 'anime';
      if (animeR18Unlocked) activeSubTabs.anime = 'r18';
    } else if (tabFromUrl && siteConfig.tabs.some((t) => t.id === tabFromUrl) && !isHiddenTab(tabFromUrl)) {
      activeTab = tabFromUrl;
    }

    if (subFromUrl && getSections(activeTab).some((s) => s.id === subFromUrl)) {
      activeSubTabs[activeTab] = subFromUrl;
    }

    switchTab(activeTab, false);

    if (siteConfig.bgm?.src && typeof SiteBgm !== 'undefined') {
      SiteBgm.init(siteConfig.bgm);
    }

    if (siteConfig.cursor?.enabled && typeof SiteCursor !== 'undefined') {
      SiteCursor.init(siteConfig.cursor);
    }

    els.loading.classList.add('hidden');
    els.pageContent.classList.remove('hidden');
    renderFilterChips();
    render();
    setupHiddenUnlock();
    setupNotesUnlock();
    setupAnimeR18Unlock();
  } catch (err) {
    els.loading.innerHTML = `
      <div class="empty-icon">⚠️</div>
      <h2>加载失败</h2>
      <p>${err.message}</p>`;
  }
}

els.search?.addEventListener('input', render);
els.sort?.addEventListener('change', render);
$('#btnCloseDetail')?.addEventListener('click', () => els.detailModal?.close());
els.detailModal?.addEventListener('click', (e) => {
  if (e.target === els.detailModal) els.detailModal.close();
});

init();
