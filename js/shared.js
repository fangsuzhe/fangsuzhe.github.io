/* 公共工具 — 展示页与管理页共用 */

const MovieShared = (() => {
  const $ = (sel, root = document) => root.querySelector(sel);

  function cdnUrl(path) {
    if (typeof SiteAssets !== 'undefined') return SiteAssets.cdnUrl(path);
    return path;
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

  function defaultPosterPath(id) {
    if (!id || typeof id !== 'string') return '';
    const dirs = [
      ['m_', 'images/movies/'],
      ['d_', 'images/drama/'],
      ['a_', 'images/anime/'],
      ['ch_', 'images/characters/'],
      ['t_', 'images/text/'],
      ['mu_', 'images/music/'],
      ['ac_', 'images/idol/'],
    ];
    for (const [prefix, dir] of dirs) {
      if (id.startsWith(prefix)) return `${dir}${id}.webp`;
    }
    return '';
  }

  function resolvePoster(item) {
    if (!item) return '';
    if (typeof item === 'string') return item.trim();
    const explicit = String(item.poster || '').trim();
    if (explicit) return explicit;
    return defaultPosterPath(item.id);
  }

  function posterHtml(posterOrItem, cls = '') {
    const poster = resolvePoster(posterOrItem);
    if (poster) {
      const src = cdnUrl(poster);
      const ref = /^https?:\/\//i.test(poster) ? ' referrerpolicy="no-referrer"' : '';
      return `<img class="${cls}" src="${escapeAttr(src)}" alt="" loading="lazy" decoding="async"${ref} onerror="this.parentElement.innerHTML='<div class=\\'poster-placeholder\\'>🎬</div>'">`;
    }
    return `<div class="poster-placeholder">🎬</div>`;
  }

  const RATING_TIERS = [
    { id: '10', label: '10 分' },
    { id: '9',  label: '9 分' },
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

  const MOVIE_RATING_TIERS = [
    { id: '10', label: '10 · 击碎我的' },
    { id: '9',  label: '9 · 极致的' },
    { id: '8',  label: '8 · 非常好' },
    { id: '7',  label: '7 · 有点意思' },
    { id: '6',  label: '6 · 可以看看' },
    { id: '5',  label: '5 · 存在硬伤' },
    { id: '4',  label: '4 · 不好看' },
    { id: '3',  label: '3 · 是很不好看' },
    { id: '2',  label: '2 · 也许有优点' },
    { id: '1',  label: '1 · 比0分好' },
    { id: '0',  label: '0 · 浪费时间的垃圾' },
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

  function countByTier(movies, tiers = RATING_TIERS) {
    const counts = { all: movies.length };
    tiers.forEach((t) => {
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
        [m.title, m.director, m.genre, m.review, m.bookmark, m.year]
          .filter(Boolean)
          .some((f) => String(f).toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => {
      switch (sort) {
        case 'rating-desc': return getScore(b) - getScore(a);
        case 'rating-asc':  return getScore(a) - getScore(b);
        case 'title-asc':   return a.title.localeCompare(b.title, 'zh-CN');
        default:            return b.createdAt - a.createdAt;
      }
    });

    return list;
  }

  function groupByTier(movies, tiers = RATING_TIERS) {
    return tiers
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
    const poster = resolvePoster(m);
    const hasPoster = Boolean(poster);

    if (hasPoster) {
      return `
        <article class="movie-card" data-id="${m.id}" style="animation-delay:${Math.min(i * 0.05, 0.5)}s">
          <div class="poster-wrap">
            ${posterHtml(m)}
            <span class="rating-badge rating-badge--${tierClass(score)}" style="color:${ratingColor(m.rating)}">${m.rating}</span>
          </div>
          <div class="card-body">
            <h3 class="card-title">${escapeHtml(m.title)}</h3>
            ${meta ? `<p class="card-meta">${escapeHtml(meta)}</p>` : ''}
            ${m.bookmark ? `<p class="card-bookmark">${escapeHtml(m.bookmark)}</p>` : ''}
            ${m.review ? `<p class="card-review">${escapeHtml(m.review)}</p>` : ''}
            ${m.genre ? `<div class="card-tags">${renderTags(m.genre)}</div>` : ''}
          </div>
        </article>`;
    }

    return `
      <article class="movie-card movie-card--text" data-id="${m.id}" data-tier="${tierClass(score)}" style="animation-delay:${Math.min(i * 0.04, 0.48)}s">
        <div class="card-accent" aria-hidden="true"></div>
        <div class="card-body">
          <div class="card-head">
            <h3 class="card-title">${escapeHtml(m.title)}</h3>
            <span class="rating-pill rating-pill--${tierClass(score)}" style="color:${ratingColor(m.rating)}">${m.rating}</span>
          </div>
          ${meta ? `<p class="card-meta">${escapeHtml(meta)}</p>` : ''}
          ${m.bookmark ? `<p class="card-bookmark">${escapeHtml(m.bookmark)}</p>` : ''}
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

  function renderGrouped(movies, containerEl, onCardClick, tiers = RATING_TIERS) {
    const groups = groupByTier(movies, tiers);
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
    if (m.author) metaParts.push(m.author);
    if (m.artist) metaParts.push(m.artist);
    if (m.creator) metaParts.push(m.creator);

    const poster = resolvePoster(m);

    detailContentEl.innerHTML = `
      ${poster
        ? `<img class="detail-poster" src="${escapeAttr(cdnUrl(poster))}" alt=""${/^https?:\/\//i.test(poster) ? ' referrerpolicy="no-referrer"' : ''} loading="lazy" decoding="async" onerror="this.remove();this.nextElementSibling?.classList.add('detail-inner--no-poster')">`
        : ''}
      <div class="detail-inner${poster ? '' : ' detail-inner--no-poster'}">
        <h2>${escapeHtml(m.title)}</h2>
        ${metaParts.length ? `<p class="detail-meta">${escapeHtml(metaParts.join(' · '))}</p>` : ''}
        <div class="detail-rating">★ ${m.rating} <span style="font-size:0.85rem;font-weight:400;opacity:0.7">/ 10</span></div>
        ${m.genre ? `<div class="card-tags" style="margin-bottom:1rem">${renderTags(m.genre)}</div>` : ''}
        ${m.bookmark ? `
          <div class="detail-bookmark">
            <span class="detail-bookmark-label">书签</span>
            <blockquote class="detail-bookmark-text">${escapeHtml(m.bookmark)}</blockquote>
          </div>` : ''}
        ${m.review ? `
          <div class="detail-review-wrap">
            <span class="detail-review-label">短评</span>
            <p class="detail-review">${escapeHtml(m.review)}</p>
          </div>` : ''}
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

  function renderTastePanel(container, taste) {
    if (!container) return;
    const data = taste || {};
    const intro = data.intro || '';
    const favoriteDirectors = Array.isArray(data.favoriteDirectors) ? data.favoriteDirectors : [];
    const favoriteStyles = Array.isArray(data.favoriteStyles) ? data.favoriteStyles : [];
    const dislikes = Array.isArray(data.dislikes) ? data.dislikes : [];

    const renderTags = (items, variant) => {
      if (!items.length) return '<p class="taste-empty">暂无</p>';
      return `<div class="taste-tags taste-tags--${variant}">${items.map((item) =>
        `<span class="taste-tag">${escapeHtml(item)}</span>`
      ).join('')}</div>`;
    };

    const renderList = (items, listClass) => {
      if (!items.length) return '<p class="taste-empty">暂无</p>';
      return `<ul class="taste-list ${listClass}">${items.map((item) =>
        `<li>${escapeHtml(item)}</li>`
      ).join('')}</ul>`;
    };

    container.innerHTML = `
      <section class="taste-hero">
        <p class="catalog-kicker">Taste Profile</p>
        <h2 class="taste-title">观影口味</h2>
        ${intro ? `<p class="taste-intro">${escapeHtml(intro)}</p>` : ''}
      </section>
      <div class="taste-grid">
        <article class="taste-card taste-card--directors">
          <h3 class="taste-card-title">喜欢的导演</h3>
          ${renderTags(favoriteDirectors, 'gold')}
        </article>
        <article class="taste-card taste-card--styles">
          <h3 class="taste-card-title">喜欢的风格</h3>
          ${renderList(favoriteStyles, 'taste-list--styles')}
        </article>
        <article class="taste-card taste-card--dislikes">
          <h3 class="taste-card-title">讨厌的东西</h3>
          ${renderList(dislikes, 'taste-list--dislikes')}
        </article>
      </div>`;
  }

  function renderNotesPanel(container, notes) {
    if (!container) return;
    const list = (Array.isArray(notes) ? notes : [])
      .slice()
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0));

    const entriesHtml = list.length
      ? list.map((note, i) => `
          <article class="note-entry" style="animation-delay:${Math.min(i * 0.05, 0.35)}s">
            <time class="note-date" datetime="${escapeAttr(note.date || '')}">${escapeHtml(formatDate(note.date) || note.date || '')}</time>
            <p class="note-content">${escapeHtml(note.content || '')}</p>
          </article>`).join('')
      : '<p class="taste-empty">暂无</p>';

    container.innerHTML = `
      <section class="notes-hero">
        <p class="catalog-kicker">Movie Notes</p>
        <h2 class="notes-title">要说的</h2>
      </section>
      <div class="notes-list">${entriesHtml}</div>`;
  }

  function linesToList(text) {
    return String(text || '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function listToLines(list) {
    return (Array.isArray(list) ? list : []).join('\n');
  }

  function renderBestPanel(container, best, movies, onMovieClick) {
    if (!container) return;
    const config = best || {};
    const director = config.director || { name: '北野武' };
    const refs = Array.isArray(config.movies) ? config.movies : [{ id: 'm_hana_bi' }];
    const featured = refs
      .map((ref) => {
        const id = typeof ref === 'string' ? ref : ref.id;
        return movies.find((m) => m.id === id);
      })
      .filter(Boolean);

    const directorName = director.name || '北野武';

    container.innerHTML = `
      <section class="best-hero">
        <p class="catalog-kicker">The Best</p>
        <h2 class="best-title">最</h2>
      </section>
      <div class="best-layout">
        <article class="best-spotlight best-spotlight--director">
          <span class="best-spotlight-label">导演</span>
          <h3 class="best-spotlight-name">${escapeHtml(directorName)}</h3>
          ${director.note ? `<p class="best-spotlight-note">${escapeHtml(director.note)}</p>` : ''}
        </article>
        <div class="best-movies">
          ${featured.length ? featured.map((m) => {
            const meta = [m.year, m.director].filter(Boolean).join(' · ');
            return `
              <article class="best-movie-card" data-id="${m.id}" tabindex="0" role="button">
                <div class="best-movie-head">
                  <h3 class="best-movie-title">${escapeHtml(m.title)}</h3>
                  <span class="best-movie-rating">${escapeHtml(m.rating)}</span>
                </div>
                ${meta ? `<p class="best-movie-meta">${escapeHtml(meta)}</p>` : ''}
                ${m.genre ? `<div class="card-tags">${renderTags(m.genre)}</div>` : ''}
                ${m.bookmark ? `<blockquote class="best-movie-bookmark">${escapeHtml(m.bookmark)}</blockquote>` : ''}
              </article>`;
          }).join('') : '<p class="taste-empty">暂无</p>'}
        </div>
      </div>`;

    if (typeof onMovieClick === 'function') {
      container.querySelectorAll('.best-movie-card').forEach((card) => {
        const open = () => onMovieClick(card.dataset.id);
        card.addEventListener('click', open);
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            open();
          }
        });
      });
    }
  }

  function renderSpacePlaceholder(container, tab) {
    if (!container || !tab) return;
    const kicker = tab.kicker || 'Space';
    const icon = tab.icon || '◈';
    const message = tab.message || '筹备中…';

    container.innerHTML = `
      <section class="space-hero">
        <p class="catalog-kicker">${escapeHtml(kicker)}</p>
        <h2 class="space-title">${escapeHtml(tab.label || '')}</h2>
      </section>
      <div class="space-placeholder">
        <div class="space-placeholder-icon" aria-hidden="true">${icon}</div>
        <p class="space-placeholder-text">${escapeHtml(message)}</p>
      </div>`;
  }

  const PICK_SECTION_META = {
    best: { title: '最', kicker: 'The Best' },
  };

  function renderSpaceItemCard(item, i = 0) {
    const meta = [item.year, item.author, item.artist, item.creator, item.director].filter(Boolean).join(' · ');
    const score = getScore(item);
    const idAttr = item.id ? ` data-space-item="${escapeAttr(item.id)}"` : '';
    return `
      <article class="movie-card movie-card--text"${idAttr}${item.id ? ' tabindex="0" role="button"' : ''} style="animation-delay:${Math.min(i * 0.04, 0.48)}s">
        <div class="card-accent" aria-hidden="true" data-tier="${tierClass(score)}"></div>
        <div class="card-body">
          <div class="card-head">
            <h3 class="card-title">${escapeHtml(item.title || '')}</h3>
            <span class="rating-pill rating-pill--${tierClass(score)}" style="color:${ratingColor(item.rating)}">${escapeHtml(item.rating || '')}</span>
          </div>
          ${meta ? `<p class="card-meta">${escapeHtml(meta)}</p>` : ''}
          ${item.bookmark ? `<p class="card-bookmark">${escapeHtml(item.bookmark)}</p>` : ''}
        </div>
      </article>`;
  }

  function renderSpaceRecordsPanel(container, options = {}) {
    if (!container) return;
    const {
      items = [],
      kicker = '',
      statLabel = '已记录',
      activeTier = 'all',
      onTierChange,
      onItemClick,
    } = options;

    const FILTER_LABELS = [
      { id: 'all', label: '全部' },
      ...RATING_TIERS.map((t) => ({ id: t.id, label: t.label })),
    ];

    const counts = countByTier(items);
    const tierMeta = FILTER_LABELS.find((f) => f.id === activeTier);
    const filtered = activeTier === 'all'
      ? [...items].sort((a, b) => getScore(b) - getScore(a))
      : items.filter((item) => matchRatingTier(item, activeTier));
    const showGrouped = activeTier === 'all';

    const filterHtml = FILTER_LABELS.map(({ id, label }) => {
      const count = counts[id] ?? 0;
      const active = activeTier === id ? ' active' : '';
      const empty = count === 0 && id !== 'all' ? ' disabled' : '';
      return `<button type="button" class="filter-chip filter-chip--${id}${active}${empty}" data-tier="${id}" ${empty ? 'disabled' : ''}>
        <span class="filter-chip-label">${label}</span>
        <span class="filter-chip-count">${count}</span>
      </button>`;
    }).join('');

    let listHtml = '';
    if (!filtered.length) {
      listHtml = `
        <div class="empty-state visible">
          <div class="empty-icon">📂</div>
          <h2>没有符合条件的记录</h2>
          <p>试试切换评分档位</p>
        </div>`;
    } else if (showGrouped) {
      listHtml = groupByTier(items).map(({ tier, movies: list }) => `
        <section class="rating-section" data-tier="${tier.id}">
          <div class="section-header">
            <div class="section-title-wrap">
              <span class="section-dot section-dot--${tier.id}"></span>
              <h2 class="section-title">${tier.label}</h2>
            </div>
            <span class="section-count">${list.length} 条</span>
          </div>
          <div class="movie-grid">
            ${list.map((item, i) => renderSpaceItemCard(item, i)).join('')}
          </div>
        </section>
      `).join('');
    } else {
      listHtml = `<div class="movie-grid">${filtered.map((item, i) => renderSpaceItemCard(item, i)).join('')}</div>`;
    }

    container.innerHTML = `
      <section class="dashboard">
        <div class="dash-stats stats stats--two">
          <div class="stat-card">
            <span class="stat-label">${escapeHtml(statLabel)}</span>
            <span class="stat-num">${items.length}</span>
          </div>
          <div class="stat-card stat-card--highlight">
            <span class="stat-label">10 分</span>
            <span class="stat-num">${counts['10'] || 0}</span>
          </div>
        </div>
        <section class="filter-panel dash-panel">
          <div class="filter-panel-head">
            <div>
              <h2 class="panel-title">浏览与筛选</h2>
              <p class="panel-desc">按评分档位浏览</p>
            </div>
          </div>
          <div class="rating-filters-scroll">
            <div class="rating-filters space-rating-filters">${filterHtml}</div>
          </div>
        </section>
      </section>
      <section class="catalog">
        <div class="catalog-head">
          <div>
            <p class="catalog-kicker">${escapeHtml(kicker)}</p>
            <h2 class="catalog-title">${escapeHtml(tierMeta?.label || '全部')}</h2>
          </div>
          <span class="catalog-count">${filtered.length ? `共 ${filtered.length} 条` : ''}</span>
        </div>
        <div class="space-records-list">${listHtml}</div>
      </section>`;

    if (typeof onTierChange === 'function') {
      container.querySelectorAll('.space-rating-filters .filter-chip:not([disabled])').forEach((btn) => {
        btn.addEventListener('click', () => onTierChange(btn.dataset.tier));
      });
    }

    bindSpaceItemClicks(container, onItemClick);
  }

  function bindSpaceItemClicks(container, onItemClick) {
    if (!container || typeof onItemClick !== 'function') return;
    container.querySelectorAll('[data-space-item]').forEach((card) => {
      card.addEventListener('click', () => onItemClick(card.dataset.spaceItem));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onItemClick(card.dataset.spaceItem);
        }
      });
    });
  }

  function renderPickCard(item, featured = false) {
    const meta = [item.author, item.artist, item.creator, item.year, item.note].filter(Boolean).join(' · ');
    const idAttr = item.id ? ` data-space-item="${escapeAttr(item.id)}"` : '';
    return `
      <article class="pick-card pick-card--clickable${featured ? ' pick-card--featured' : ''}"${idAttr} tabindex="0" role="button">
        <div class="pick-card-head">
          <h3 class="pick-card-title">${escapeHtml(item.title || '')}</h3>
          ${item.rating ? `<span class="pick-card-rating">${escapeHtml(item.rating)}</span>` : ''}
        </div>
        ${meta ? `<p class="pick-card-meta">${escapeHtml(meta)}</p>` : ''}
        ${item.bookmark ? `<blockquote class="pick-card-bookmark">${escapeHtml(item.bookmark)}</blockquote>` : ''}
      </article>`;
  }

  function renderCharacterCard(ch, i = 0) {
    const poster = resolvePoster(ch);
    const initial = escapeHtml((ch.name || '?').charAt(0));
    const photoHtml = poster
      ? `<img class="character-card-photo" src="${escapeAttr(cdnUrl(poster))}" alt="${escapeAttr(ch.name || '')}" loading="lazy" decoding="async" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'character-card-photo character-card-photo--fallback',textContent:'${initial}'}))">`
      : `<div class="character-card-photo character-card-photo--fallback" aria-hidden="true">${initial}</div>`;

    const fields = [
      ['年龄', ch.age],
      ['职业', ch.occupation],
      ['生日', ch.birthday],
      ['星座', ch.zodiac],
    ].filter(([, v]) => v);

    return `
      <article class="character-card" style="animation-delay:${Math.min(i * 0.06, 0.5)}s">
        <div class="character-card-visual">${photoHtml}</div>
        <div class="character-card-body">
          <h3 class="character-card-name">${escapeHtml(ch.name || '')}</h3>
          ${ch.nameJp ? `<p class="character-card-name-jp">${escapeHtml(ch.nameJp)}</p>` : ''}
          ${ch.from ? `<p class="character-card-from">出自 · ${escapeHtml(ch.from)}</p>` : ''}
          ${fields.length ? `<dl class="character-card-meta">${fields.map(([k, v]) =>
            `<div class="character-card-row"><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`
          ).join('')}</dl>` : ''}
        </div>
      </article>`;
  }

  function renderCharactersPanel(container, options = {}) {
    if (!container) return;
    const { characters = [], kicker = 'Anime Space', title = '喜欢的角色' } = options;
    const list = Array.isArray(characters) ? characters : [];

    container.innerHTML = `
      <section class="characters-hero">
        <p class="catalog-kicker">${escapeHtml(kicker)}</p>
        <h2 class="characters-title">${escapeHtml(title)}</h2>
      </section>
      <div class="character-grid">
        ${list.length
          ? list.map((ch, i) => renderCharacterCard(ch, i)).join('')
          : '<p class="taste-empty">暂无</p>'}
      </div>`;
  }

  function renderSpacePicksPage(container, sectionId, items, spaceKicker, onItemClick) {
    if (!container) return;
    const meta = PICK_SECTION_META[sectionId] || { title: sectionId, kicker: '' };
    const list = Array.isArray(items) ? items : [];
    const featured = sectionId === 'best';

    container.innerHTML = `
      <section class="picks-hero">
        <p class="catalog-kicker">${escapeHtml(spaceKicker || meta.kicker)}</p>
        <h2 class="picks-title">${escapeHtml(meta.title)}</h2>
      </section>
      <div class="pick-list${featured ? ' pick-list--featured' : ''}">
        ${list.length
          ? list.map((item) => renderPickCard(item, featured)).join('')
          : '<p class="taste-empty">暂无</p>'}
      </div>`;

    bindSpaceItemClicks(container, onItemClick);
  }

  return {
    $, uid, ratingFromSlider, sliderFromRating, ratingColor, formatDate,
    escapeHtml, escapeAttr, renderTags, posterHtml, resolvePoster, defaultPosterPath,
    RATING_TIERS, MOVIE_RATING_TIERS, getScore, matchRatingTier, countByTier, groupByTier,
    filterAndSort, calcStats, renderGrid, renderGrouped, renderDetail,
    renderTastePanel, renderNotesPanel, renderBestPanel, renderSpacePlaceholder,
    renderSpacePicksPage, renderSpaceRecordsPanel, renderCharactersPanel, bindSpaceItemClicks,
    linesToList, listToLines, sha256,
  };
})();
