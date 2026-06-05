/* 公开主页 — 只读，按评分分区展示 */

const {
  $, RATING_TIERS, filterAndSort, calcStats, countByTier,
  renderGrid, renderGrouped, renderDetail, renderTastePanel,
} = MovieShared;

let movies = [];
let activeTier = 'all';
let siteConfig = {
  title: '个人空间',
  subtitle: '记录 · 分享 · 留存',
  defaultTab: 'movies',
  tabs: [{ id: 'movies', label: '电影空间' }],
};
let activeTab = 'movies';

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
  tabPanelMovies: $('#tabPanelMovies'),
  tasteContent: $('#tasteContent'),
};

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
      siteConfig.tabs = [{ id: 'movies', label: '电影空间' }];
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

  if (updateUrl) {
    const url = new URL(window.location.href);
    if (tabId === (siteConfig.defaultTab || 'movies')) url.searchParams.delete('tab');
    else url.searchParams.set('tab', tabId);
    history.replaceState(null, '', url);
  }
}

function renderTaste() {
  if (!els.tasteContent) return;
  renderTastePanel(els.tasteContent, siteConfig.taste);
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

    const tabFromUrl = new URLSearchParams(window.location.search).get('tab');
    if (tabFromUrl && siteConfig.tabs.some((t) => t.id === tabFromUrl)) {
      switchTab(tabFromUrl, false);
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
