const STORAGE_KEY = 'my-movie-log-v1';

let movies = loadMovies();
let editingId = null;

const $ = (sel) => document.querySelector(sel);

const els = {
  grid: $('#movieGrid'),
  empty: $('#emptyState'),
  search: $('#searchInput'),
  sort: $('#sortSelect'),
  modal: $('#movieModal'),
  detailModal: $('#detailModal'),
  form: $('#movieForm'),
  modalTitle: $('#modalTitle'),
  ratingSlider: $('#inputRating'),
  ratingDisplay: $('#ratingDisplay'),
  btnDelete: $('#btnDelete'),
  statTotal: $('#statTotal'),
  statAvg: $('#statAvg'),
  statBest: $('#statBest'),
  importFile: $('#importFile'),
};

function loadMovies() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveMovies() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(movies));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function ratingFromSlider(val) {
  return (val / 10).toFixed(1);
}

function sliderFromRating(rating) {
  return Math.round(parseFloat(rating) * 10);
}

function ratingColor(score) {
  const s = parseFloat(score);
  if (s >= 9) return '#e8c068';
  if (s >= 7) return '#d4a853';
  if (s >= 5) return '#a89878';
  return '#8a8799';
}

function formatDate(str) {
  if (!str) return '';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
}

function getFilteredMovies() {
  const q = els.search.value.trim().toLowerCase();
  let list = [...movies];

  if (q) {
    list = list.filter((m) =>
      [m.title, m.director, m.genre, m.review, m.year]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(q))
    );
  }

  const sort = els.sort.value;
  list.sort((a, b) => {
    switch (sort) {
      case 'rating-desc': return parseFloat(b.rating) - parseFloat(a.rating);
      case 'rating-asc':  return parseFloat(a.rating) - parseFloat(b.rating);
      case 'title-asc':   return a.title.localeCompare(b.title, 'zh-CN');
      case 'watch-desc':  return (b.watchDate || '').localeCompare(a.watchDate || '');
      default:            return b.createdAt - a.createdAt;
    }
  });

  return list;
}

function updateStats() {
  els.statTotal.textContent = movies.length;
  if (movies.length === 0) {
    els.statAvg.textContent = '—';
    els.statBest.textContent = '—';
    return;
  }
  const scores = movies.map((m) => parseFloat(m.rating));
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const best = Math.max(...scores);
  els.statAvg.textContent = avg.toFixed(1);
  els.statBest.textContent = best.toFixed(1);
}

function posterHtml(poster, cls) {
  if (poster) {
    return `<img class="${cls}" src="${escapeAttr(poster)}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'poster-placeholder\\'>🎬</div>'">`;
  }
  return `<div class="poster-placeholder">🎬</div>`;
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;');
}

function renderTags(genre) {
  if (!genre) return '';
  return genre.split(/[,，、]/).map((t) => t.trim()).filter(Boolean)
    .map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('');
}

function render() {
  const list = getFilteredMovies();
  updateStats();

  els.empty.classList.toggle('visible', movies.length === 0);

  els.grid.innerHTML = list.map((m, i) => {
    const meta = [m.year, m.director].filter(Boolean).join(' · ');
    return `
      <article class="movie-card" data-id="${m.id}" style="animation-delay:${Math.min(i * 0.05, 0.5)}s">
        <div class="poster-wrap">
          ${posterHtml(m.poster, '')}
          <span class="rating-badge" style="color:${ratingColor(m.rating)}">${m.rating}</span>
        </div>
        <div class="card-body">
          <h3 class="card-title">${escapeHtml(m.title)}</h3>
          ${meta ? `<p class="card-meta">${escapeHtml(meta)}</p>` : ''}
          ${m.review ? `<p class="card-review">${escapeHtml(m.review)}</p>` : ''}
          ${m.genre ? `<div class="card-tags">${renderTags(m.genre)}</div>` : ''}
        </div>
      </article>`;
  }).join('');

  els.grid.querySelectorAll('.movie-card').forEach((card) => {
    card.addEventListener('click', () => openDetail(card.dataset.id));
  });
}

function openModal(id) {
  editingId = id || null;
  els.form.reset();
  els.btnDelete.classList.toggle('hidden', !editingId);
  els.modalTitle.textContent = editingId ? '编辑电影' : '添加电影';

  if (editingId) {
    const m = movies.find((x) => x.id === editingId);
    if (!m) return;
    $('#inputTitle').value = m.title;
    $('#inputDirector').value = m.director || '';
    $('#inputYear').value = m.year || '';
    $('#inputWatchDate').value = m.watchDate || '';
    $('#inputGenre').value = m.genre || '';
    $('#inputPoster').value = m.poster || '';
    $('#inputReview').value = m.review || '';
    els.ratingSlider.value = sliderFromRating(m.rating);
  } else {
    els.ratingSlider.value = 80;
    $('#inputWatchDate').value = new Date().toISOString().slice(0, 10);
  }

  els.ratingDisplay.textContent = ratingFromSlider(els.ratingSlider.value);
  els.modal.showModal();
}

function closeModal() {
  els.modal.close();
  editingId = null;
}

function openDetail(id) {
  const m = movies.find((x) => x.id === id);
  if (!m) return;

  const metaParts = [];
  if (m.year) metaParts.push(m.year);
  if (m.director) metaParts.push(m.director);
  if (m.watchDate) metaParts.push('观看于 ' + formatDate(m.watchDate));

  $('#detailContent').innerHTML = `
    ${m.poster
      ? `<img class="detail-poster" src="${escapeAttr(m.poster)}" alt="" onerror="this.outerHTML='<div class=\\'detail-poster-placeholder\\'>🎬</div>'">`
      : `<div class="detail-poster-placeholder">🎬</div>`}
    <div class="detail-inner">
      <h2>${escapeHtml(m.title)}</h2>
      ${metaParts.length ? `<p class="detail-meta">${escapeHtml(metaParts.join(' · '))}</p>` : ''}
      <div class="detail-rating">★ ${m.rating} <span style="font-size:0.85rem;font-weight:400;opacity:0.7">/ 10</span></div>
      ${m.genre ? `<div class="card-tags" style="margin-bottom:1rem">${renderTags(m.genre)}</div>` : ''}
      ${m.review ? `<p class="detail-review">${escapeHtml(m.review)}</p>` : '<p class="detail-review" style="opacity:0.5">暂无短评</p>'}
      <div class="detail-actions">
        <button class="btn btn-ghost" id="detailEdit">编辑</button>
      </div>
    </div>`;

  els.detailModal.showModal();

  $('#detailEdit').addEventListener('click', () => {
    els.detailModal.close();
    openModal(id);
  });
}

function handleSubmit(e) {
  e.preventDefault();

  const title = $('#inputTitle').value.trim();
  if (!title) return;

  const data = {
    title,
    director: $('#inputDirector').value.trim(),
    year: $('#inputYear').value.trim(),
    watchDate: $('#inputWatchDate').value,
    genre: $('#inputGenre').value.trim(),
    poster: $('#inputPoster').value.trim(),
    rating: ratingFromSlider(els.ratingSlider.value),
    review: $('#inputReview').value.trim(),
  };

  if (editingId) {
    const idx = movies.findIndex((x) => x.id === editingId);
    if (idx !== -1) {
      movies[idx] = { ...movies[idx], ...data };
    }
  } else {
    movies.unshift({ id: uid(), createdAt: Date.now(), ...data });
  }

  saveMovies();
  closeModal();
  render();
}

function handleDelete() {
  if (!editingId || !confirm('确定删除这条记录？')) return;
  movies = movies.filter((x) => x.id !== editingId);
  saveMovies();
  closeModal();
  render();
}

function exportData() {
  const blob = new Blob([JSON.stringify(movies, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `观影记录_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data)) throw new Error('格式错误');
      if (data.length && !data[0].title) throw new Error('格式错误');

      const action = movies.length
        ? confirm('导入将覆盖现有数据，确定继续？\n（建议先导出备份）')
        : true;
      if (!action) return;

      movies = data.map((m) => ({
        id: m.id || uid(),
        createdAt: m.createdAt || Date.now(),
        title: m.title,
        director: m.director || '',
        year: m.year || '',
        watchDate: m.watchDate || '',
        genre: m.genre || '',
        poster: m.poster || '',
        rating: m.rating || '8.0',
        review: m.review || '',
      }));

      saveMovies();
      render();
      alert(`成功导入 ${movies.length} 条记录`);
    } catch {
      alert('导入失败，请检查 JSON 文件格式');
    }
  };
  reader.readAsText(file);
}

// Events
$('#btnAdd').addEventListener('click', () => openModal());
$('#btnAddEmpty').addEventListener('click', () => openModal());
$('#btnCancel').addEventListener('click', closeModal);
$('#btnCloseModal').addEventListener('click', closeModal);
$('#btnCloseDetail').addEventListener('click', () => els.detailModal.close());
els.btnDelete.addEventListener('click', handleDelete);
els.form.addEventListener('submit', handleSubmit);
els.search.addEventListener('input', render);
els.sort.addEventListener('change', render);
els.ratingSlider.addEventListener('input', () => {
  els.ratingDisplay.textContent = ratingFromSlider(els.ratingSlider.value);
});
$('#btnExport').addEventListener('click', exportData);
$('#btnImport').addEventListener('click', () => els.importFile.click());
els.importFile.addEventListener('change', (e) => {
  if (e.target.files[0]) importData(e.target.files[0]);
  e.target.value = '';
});

els.modal.addEventListener('click', (e) => {
  if (e.target === els.modal) closeModal();
});
els.detailModal.addEventListener('click', (e) => {
  if (e.target === els.detailModal) els.detailModal.close();
});

// 首次加载：若无数据则注入示例
if (movies.length === 0) {
  movies = [
    {
      id: uid(), createdAt: Date.now(),
      title: '肖申克的救赎',
      director: '弗兰克·德拉邦特',
      year: '1994',
      watchDate: '2025-03-15',
      genre: '剧情, 犯罪',
      poster: 'https://img9.doubanio.com/view/photo/s_ratio_poster/public/p480747492.jpg',
      rating: '9.7',
      review: '希望是美好的，也许是人间至善，而美好之物永不消逝。',
    },
    {
      id: uid(), createdAt: Date.now() - 1,
      title: '千与千寻',
      director: '宫崎骏',
      year: '2001',
      watchDate: '2025-04-02',
      genre: '动画, 奇幻',
      poster: 'https://img1.doubanio.com/view/photo/s_ratio_poster/public/p449265906.jpg',
      rating: '9.4',
      review: '不管前方的路有多苦，只要走的方向正确，都比站在原地更接近幸福。',
    },
    {
      id: uid(), createdAt: Date.now() - 2,
      title: '盗梦空间',
      director: '克里斯托弗·诺兰',
      year: '2010',
      watchDate: '2025-05-20',
      genre: '科幻, 悬疑',
      poster: 'https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2616355133.jpg',
      rating: '9.0',
      review: '你在等一趟火车，它会把你带到远方。你明白你在为什么而活着。',
    },
  ];
  saveMovies();
}

render();
