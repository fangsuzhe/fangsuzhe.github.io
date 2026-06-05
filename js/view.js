/* 公开主页 — 只读，按评分分区展示 */

const {
  $, RATING_TIERS, filterAndSort, calcStats, countByTier,
  renderGrid, renderGrouped, renderDetail, renderTastePanel, renderBestPanel,
} = MovieShared;

const DEFAULT_MOVIE_SECTIONS = [
  { id: 'records', label: '观影记录' },
  { id: 'best', label: '最' },
  { id: 'taste', label: '观影口味' },
];

let movies = [];
let activeTier = 'all';
let siteConfig = {
  title: '个人空间',
  subtitle: '记录 · 分享 · 留存',
  defaultTab: 'movies',
  defaultSubTab: 'records',
  tabs: [{ id: 'movies', label: '电影空间', sections: DEFAULT_MOVIE_SECTIONS }],
};
let activeTab = 'movies';
let activeSubTab = 'records';

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
  tabPanelMovies: $('#tabPanelMovies'),
  tasteContent: $('#tasteContent'),
  bestContent: $('#bestContent'),
};

function getMovieTab() {
  return siteConfig.tabs.find((t) => t.id === 'movies') || siteConfig.tabs[0];
}

function getMovieSections() {
  const sections = getMovieTab()?.sections;
  return Array.isArray(sections) && sections.length ? sections : DEFAULT_MOVIE_SECTIONS;
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
    const movieTab = getMovieTab();
    if (movieTab && (!Array.isArray(movieTab.sections) || !movieTab.sections.length)) {
      movieTab.sections = DEFAULT_MOVIE_SECTIONS;
    }
    document.title = siteConfig.title || document.title;
    if (els.pageTitle) els.pageTitle.textContent = siteConfig.title;
    if (els.pageSubtitle) {
      const sub = siteConfig.subtitle || '';
      els.pageSubtitle.textContent = sub;
      els.pageSubtitle.classList.toggle('hidden', !sub);
    }
  }
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

  renderMovieSubTabs();
  switchTab(activeTab, false);
}

function renderMovieSubTabs() {
  if (!els.movieSubTabs) return;
  const sections = getMovieSections();
  activeSubTab = siteConfig.defaultSubTab || sections[0]?.id || 'records';
  if (!sections.some((s) => s.id === activeSubTab)) activeSubTab = sections[0].id;

  els.movieSubTabs.innerHTML = sections.map(({ id, label }) =>
    `<button type="button" class="sub-tab${id === activeSubTab ? ' active' : ''}" data-sub="${id}">${label}</button>`
  ).join('');

  els.movieSubTabs.querySelectorAll('.sub-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchSubTab(btn.dataset.sub));
  });
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

  if (tabId === 'movies') {
    switchSubTab(activeSubTab, updateUrl);
    return;
  }

  if (updateUrl) updateRouteUrl();
}

function switchSubTab(subId, updateUrl = true) {
  if (!subId) return;
  const sections = getMovieSections();
  if (!sections.some((s) => s.id === subId)) return;

  activeSubTab = subId;

  els.movieSubTabs?.querySelectorAll('.sub-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.sub === subId);
  });

  document.querySelectorAll('.sub-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.sub === subId);
  });

  if (updateUrl) updateRouteUrl();
}

function updateRouteUrl() {
  const url = new URL(window.location.href);
  const defaultTab = siteConfig.defaultTab || 'movies';
  const defaultSub = siteConfig.defaultSubTab || 'records';

  if (activeTab === defaultTab) url.searchParams.delete('tab');
  else url.searchParams.set('tab', activeTab);

  if (activeTab === 'movies') {
    if (activeSubTab === defaultSub) url.searchParams.delete('sub');
    else url.searchParams.set('sub', activeSubTab);
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

    const params = new URLSearchParams(window.location.search);
    const tabFromUrl = params.get('tab');
    const subFromUrl = params.get('sub');

    if (tabFromUrl === 'taste') {
      activeTab = 'movies';
      activeSubTab = 'taste';
    } else if (tabFromUrl && siteConfig.tabs.some((t) => t.id === tabFromUrl)) {
      activeTab = tabFromUrl;
    }

    const sections = getMovieSections();
    if (subFromUrl && sections.some((s) => s.id === subFromUrl)) {
      activeSubTab = subFromUrl;
    }

    switchTab(activeTab, false);
    if (activeTab === 'movies') switchSubTab(activeSubTab, false);

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
