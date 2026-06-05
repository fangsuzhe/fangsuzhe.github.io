/* 公开主页 — 只读，按评分分区展示 */

const {
  $, RATING_TIERS, filterAndSort, calcStats, countByTier,
  renderGrid, renderGrouped, renderDetail, renderTastePanel, renderBestPanel,
  renderSpacePlaceholder, renderSpacePicksPage, renderSpaceRecordsPanel,
} = MovieShared;

const DEFAULT_MOVIE_SECTIONS = [
  { id: 'records', label: '观影记录' },
  { id: 'best', label: '最' },
  { id: 'taste', label: '观影口味' },
];

const DEFAULT_SPACE_SECTIONS = [
  { id: 'records', label: '记录' },
  { id: 'best', label: '最' },
];

const CONTENT_SPACES = ['drama', 'anime', 'text', 'music'];

let movies = [];
let spaceItemIndex = new Map();
let activeTier = 'all';
let siteConfig = {
  title: '个人空间',
  subtitle: '记录 · 分享 · 留存',
  defaultTab: 'movies',
  defaultSubTab: 'records',
  tabs: [{ id: 'movies', label: '电影空间', sections: DEFAULT_MOVIE_SECTIONS }],
  spaces: {},
};
let activeTab = 'movies';
let activeSubTabs = {
  movies: 'records',
  drama: 'records',
  anime: 'records',
  text: 'records',
  music: 'records',
};

const spaceTierState = {
  drama: 'all',
  anime: 'all',
  text: 'all',
  music: 'all',
};

const FILTER_LABELS = [
  { id: 'all', label: '全部' },
  ...RATING_TIERS.map((t) => ({ id: t.id, label: t.label })),
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
  bestContent: $('#bestContent'),
};

function getTabConfig(tabId) {
  return siteConfig.tabs.find((t) => t.id === tabId);
}

function getSpaceConfig(spaceId) {
  return siteConfig.spaces?.[spaceId] || {};
}

function buildSpaceItemIndex() {
  spaceItemIndex = new Map();
  CONTENT_SPACES.forEach((spaceId) => {
    const space = getSpaceConfig(spaceId);
    [...(space.items || []), ...(space.best || [])].forEach((item) => {
      if (item?.id && !spaceItemIndex.has(item.id)) {
        spaceItemIndex.set(item.id, item);
      }
    });
  });
}

function getSections(tabId) {
  if (tabId === 'movies') {
    const sections = getTabConfig('movies')?.sections;
    return Array.isArray(sections) && sections.length ? sections : DEFAULT_MOVIE_SECTIONS;
  }
  const space = getSpaceConfig(tabId);
  if (Array.isArray(space.sections) && space.sections.length) return space.sections;
  return DEFAULT_SPACE_SECTIONS;
}

function getDefaultSubTab(tabId) {
  if (tabId === 'movies') return siteConfig.defaultSubTab || 'records';
  return getSpaceConfig(tabId).defaultSubTab || 'records';
}

function initActiveSubTabs() {
  activeSubTabs.movies = getDefaultSubTab('movies');
  CONTENT_SPACES.forEach((id) => {
    activeSubTabs[id] = getDefaultSubTab(id);
  });
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
  const tabs = siteConfig.tabs;
  activeTab = siteConfig.defaultTab || tabs[0]?.id || 'movies';
  if (!tabs.some((t) => t.id === activeTab)) activeTab = tabs[0].id;

  els.siteTabs.innerHTML = tabs.map(({ id, label }) =>
    `<button type="button" class="site-tab${id === activeTab ? ' active' : ''}" data-tab="${id}">${label}</button>`
  ).join('');

  els.siteTabs.querySelectorAll('.site-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  renderSubTabs('movies');
  CONTENT_SPACES.forEach((id) => renderSubTabs(id));
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

function renderBest() {
  if (!els.bestContent) return;
  renderBestPanel(els.bestContent, siteConfig.best, movies, openDetail);
}

function renderContentSpaces() {
  CONTENT_SPACES.forEach((spaceId) => {
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

    renderSpacePicksPage($(`#${spaceId}_best`), 'best', space.best, kicker, openSpaceDetail);
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
    if (tab.id === 'movies' || CONTENT_SPACES.includes(tab.id)) return;
    if (!tab.message && !tab.icon) return;
    const container = $(`#space_${tab.id}`);
    if (container) renderSpacePlaceholder(container, tab);
  });
}

function renderFilterChips() {
  if (!els.ratingFilters) return;
  const counts = countByTier(movies);
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
    if (els.statPerfect) els.statPerfect.textContent = countByTier(movies)['10'] || 0;

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
        renderGrouped(list, els.movieList, openDetail);
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
    renderSiteTabs();
    renderTaste();
    renderBest();
    renderContentSpaces();
    renderPlaceholderSpaces();

    const params = new URLSearchParams(window.location.search);
    const tabFromUrl = params.get('tab');
    let subFromUrl = params.get('sub');
    if (subFromUrl === 'perfect') subFromUrl = 'records';

    if (tabFromUrl === 'taste') {
      activeTab = 'movies';
      activeSubTabs.movies = 'taste';
    } else if (tabFromUrl && siteConfig.tabs.some((t) => t.id === tabFromUrl)) {
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
