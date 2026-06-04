/* 公共工具 — 展示页与管理页共用 */

const MovieShared = (() => {
  const $ = (sel, root = document) => root.querySelector(sel);

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

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function escapeAttr(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;');
  }

  function renderTags(genre) {
    if (!genre) return '';
    return genre.split(/[,，、]/).map((t) => t.trim()).filter(Boolean)
      .map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('');
  }

  function posterHtml(poster, cls = '') {
    if (poster) {
      return `<img class="${cls}" src="${escapeAttr(poster)}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'poster-placeholder\\'>🎬</div>'">`;
    }
    return `<div class="poster-placeholder">🎬</div>`;
  }

  const RATING_TIERS = [
    { id: '10', label: '10 · 击碎我的' },
    { id: '9',  label: '9 · 极致的' },
    { id: '8',  label: '8 分' },
    { id: '7',  label: '7 分' },
    { id: '6',  label: '6 分' },
    { id: '5',  label: '5 分' },
    { id: '4',  label: '4 分' },
    { id: '3',  label: '3 分' },
    { id: '2',  label: '2 分' },
    { id: '1',  label: '1 分' },
    { id: '0',  label: '0 分' },
  ];

  function getScore(movie) {
    return parseFloat(movie.rating) || 0;
  }

  function matchRatingTier(movie, tierId) {
    if (!tierId || tierId === 'all') return true;
    const s = getScore(movie);
    if (tierId === '10') return s >= 10;
    const n = parseInt(tierId, 10);
    if (!Number.isNaN(n)) return s >= n && s < n + 1;
    return true;
  }

  function countByTier(movies) {
    const counts = { all: movies.length };
    RATING_TIERS.forEach((t) => {
      counts[t.id] = movies.filter((m) => matchRatingTier(m, t.id)).length;
    });
    return counts;
  }

  function filterAndSort(movies, query, sort, tierId = 'all') {
    const q = query.trim().toLowerCase();
    let list = [...movies];

    if (tierId && tierId !== 'all') {
      list = list.filter((m) => matchRatingTier(m, tierId));
    }

    if (q) {
      list = list.filter((m) =>
        [m.title, m.director, m.genre, m.review, m.year]
          .filter(Boolean)
          .some((f) => String(f).toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => {
      switch (sort) {
        case 'rating-desc': return getScore(b) - getScore(a);
        case 'rating-asc':  return getScore(a) - getScore(b);
        case 'title-asc':   return a.title.localeCompare(b.title, 'zh-CN');
        case 'watch-desc':  return (b.watchDate || '').localeCompare(a.watchDate || '');
        default:            return b.createdAt - a.createdAt;
      }
    });

    return list;
  }

  function groupByTier(movies) {
    return RATING_TIERS
      .map((tier) => ({
        tier,
        movies: movies.filter((m) => matchRatingTier(m, tier.id)),
      }))
      .filter((g) => g.movies.length > 0);
  }

  function calcStats(movies) {
    if (!movies.length) return { total: 0, avg: '—', best: '—' };
    const scores = movies.map((m) => parseFloat(m.rating));
    return {
      total: movies.length,
      avg: (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1),
      best: Math.max(...scores).toFixed(1),
    };
  }

  function renderMovieCard(m, i = 0) {
    const meta = [m.year, m.director].filter(Boolean).join(' · ');
    const score = getScore(m);
    const hasPoster = m.poster && m.poster.trim();

    if (hasPoster) {
      return `
        <article class="movie-card" data-id="${m.id}" style="animation-delay:${Math.min(i * 0.05, 0.5)}s">
          <div class="poster-wrap">
            ${posterHtml(m.poster)}
            <span class="rating-badge rating-badge--${tierClass(score)}" style="color:${ratingColor(m.rating)}">${m.rating}</span>
          </div>
          <div class="card-body">
            <h3 class="card-title">${escapeHtml(m.title)}</h3>
            ${meta ? `<p class="card-meta">${escapeHtml(meta)}</p>` : ''}
            ${m.review ? `<p class="card-review">${escapeHtml(m.review)}</p>` : ''}
            ${m.genre ? `<div class="card-tags">${renderTags(m.genre)}</div>` : ''}
          </div>
        </article>`;
    }

    return `
      <article class="movie-card movie-card--text" data-id="${m.id}" style="animation-delay:${Math.min(i * 0.05, 0.5)}s">
        <div class="card-body">
          <div class="card-head">
            <h3 class="card-title">${escapeHtml(m.title)}</h3>
            <span class="rating-pill rating-pill--${tierClass(score)}" style="color:${ratingColor(m.rating)}">${m.rating}</span>
          </div>
          ${meta ? `<p class="card-meta">${escapeHtml(meta)}</p>` : ''}
          ${m.review ? `<p class="card-review">${escapeHtml(m.review)}</p>` : ''}
          ${m.genre ? `<div class="card-tags">${renderTags(m.genre)}</div>` : ''}
        </div>
      </article>`;
  }

  function tierClass(score) {
    const s = parseFloat(score) || 0;
    if (s >= 10) return '10';
    return String(Math.floor(s));
  }

  function bindCardClicks(container, onCardClick) {
    container.querySelectorAll('.movie-card').forEach((card) => {
      card.addEventListener('click', () => onCardClick(card.dataset.id));
    });
  }

  function renderGrid(movies, gridEl, onCardClick) {
    gridEl.innerHTML = movies.map((m, i) => renderMovieCard(m, i)).join('');
    bindCardClicks(gridEl, onCardClick);
  }

  function renderGrouped(movies, containerEl, onCardClick) {
    const groups = groupByTier(movies);
    containerEl.innerHTML = groups.map(({ tier, movies: list }) => `
      <section class="rating-section" data-tier="${tier.id}">
        <div class="section-header">
          <div class="section-title-wrap">
            <span class="section-dot section-dot--${tier.id}"></span>
            <h2 class="section-title">${tier.label}</h2>
          </div>
          <span class="section-count">${list.length} 部</span>
        </div>
        <div class="movie-grid">
          ${list.map((m, i) => renderMovieCard(m, i)).join('')}
        </div>
      </section>
    `).join('');
    bindCardClicks(containerEl, onCardClick);
  }

  function renderDetail(m, detailContentEl, options = {}) {
    const { showEdit = false, onEdit } = options;
    const metaParts = [];
    if (m.year) metaParts.push(m.year);
    if (m.director) metaParts.push(m.director);
    if (m.watchDate) metaParts.push('观看于 ' + formatDate(m.watchDate));

    detailContentEl.innerHTML = `
      ${m.poster
        ? `<img class="detail-poster" src="${escapeAttr(m.poster)}" alt="" onerror="this.remove()">`
        : ''}
      <div class="detail-inner${m.poster ? '' : ' detail-inner--no-poster'}">
        <h2>${escapeHtml(m.title)}</h2>
        ${metaParts.length ? `<p class="detail-meta">${escapeHtml(metaParts.join(' · '))}</p>` : ''}
        <div class="detail-rating">★ ${m.rating} <span style="font-size:0.85rem;font-weight:400;opacity:0.7">/ 10</span></div>
        ${m.genre ? `<div class="card-tags" style="margin-bottom:1rem">${renderTags(m.genre)}</div>` : ''}
        ${m.review ? `<p class="detail-review">${escapeHtml(m.review)}</p>` : ''}
        ${showEdit ? `<div class="detail-actions"><button class="btn btn-ghost" id="detailEdit">编辑</button></div>` : ''}
      </div>`;

    if (showEdit && onEdit) {
      $('#detailEdit', detailContentEl)?.addEventListener('click', onEdit);
    }
  }

  async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  return {
    $, uid, ratingFromSlider, sliderFromRating, ratingColor, formatDate,
    escapeHtml, escapeAttr, renderTags, posterHtml,
    RATING_TIERS, getScore, matchRatingTier, countByTier, groupByTier,
    filterAndSort, calcStats, renderGrid, renderGrouped, renderDetail, sha256,
  };
})();
