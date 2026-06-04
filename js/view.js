/* 公开主页 — 只读，按评分分区展示 */

const {
  $, RATING_TIERS, filterAndSort, calcStats, countByTier,
  renderGrid, renderGrouped, renderDetail,
} = MovieShared;

let movies = [];
let activeTier = 'all';
let siteConfig = { title: '观影片单', subtitle: '' };

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
};

async function loadPublicData() {
  const ts = Date.now();
  const [moviesRes, siteRes] = await Promise.all([
    fetch(`data/movies.json?t=${ts}`),
    fetch(`data/site.json?t=${ts}`),
  ]);

  if (!moviesRes.ok) throw new Error('无法加载片单数据');
  movies = await moviesRes.json();

  if (siteRes.ok) {
    siteConfig = await siteRes.json();
    document.title = siteConfig.title || document.title;
    if (els.pageTitle) els.pageTitle.textContent = siteConfig.title;
    if (els.pageSubtitle) {
      const sub = siteConfig.subtitle || '';
      els.pageSubtitle.textContent = sub;
      els.pageSubtitle.classList.toggle('hidden', !sub);
    }
  }
}

function renderFilterChips() {
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
  const query = els.search.value;
  const sort = els.sort.value;
  const list = filterAndSort(movies, query, sort, activeTier);
  const stats = calcStats(movies);

  els.statTotal.textContent = stats.total;
  els.statPerfect.textContent = countByTier(movies)['10'] || 0;

  const tierMeta = FILTER_LABELS.find((f) => f.id === activeTier);
  els.catalogTitle.textContent = tierMeta?.label || '全部影片';
  els.catalogCount.textContent = list.length ? `共 ${list.length} 部` : '';

  const showGrouped = activeTier === 'all' && !query.trim() && sort === 'rating-desc';

  if (list.length === 0) {
    els.movieList.innerHTML = '';
    els.empty.classList.add('visible');
  } else {
    els.empty.classList.remove('visible');
    if (showGrouped) {
      renderGrouped(list, els.movieList, openDetail);
    } else {
      els.movieList.innerHTML = '<div class="movie-grid" id="flatGrid"></div>';
      renderGrid(list, $('#flatGrid'), openDetail);
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

els.search.addEventListener('input', render);
els.sort.addEventListener('change', render);
$('#btnCloseDetail').addEventListener('click', () => els.detailModal.close());
els.detailModal.addEventListener('click', (e) => {
  if (e.target === els.detailModal) els.detailModal.close();
});

init();
