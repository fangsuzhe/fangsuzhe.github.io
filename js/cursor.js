/* 七海千秋自定义鼠标 — 跟随式光标，支持动画 WebP */
const SiteCursor = (() => {
  const SELECTOR_POINTER = 'a, button, .site-tab, .sub-tab, .filter-chip, .movie-card, .pick-card, .bgm-toggle, label, summary, [role="button"]';
  const SELECTOR_TEXT = 'input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable="true"]';
  const SELECTOR_DISABLED = '[disabled], .filter-chip:disabled';

  let enabled = false;
  let el = null;
  let layers = {};
  let hotspots = {};
  let active = 'default';
  let x = -9999;
  let y = -9999;
  let raf = 0;

  function canUse() {
    if (window.matchMedia('(pointer: coarse)').matches) return false;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    return true;
  }

  function asset(path) {
    return typeof SiteAssets !== 'undefined' ? SiteAssets.cdnUrl(path) : path;
  }

  function setVariant(name) {
    if (!enabled || active === name || !layers[name]) return;
    active = name;
    Object.entries(layers).forEach(([key, node]) => {
      node.hidden = key !== name;
    });
    applyTransform();
  }

  function applyTransform() {
    if (!el) return;
    const spot = hotspots[active] || hotspots.default || { x: 0, y: 0 };
    el.style.transform = `translate3d(${x - spot.x}px, ${y - spot.y}px, 0)`;
  }

  function detectVariant(target) {
    if (!(target instanceof Element)) return 'default';
    if (target.closest(SELECTOR_DISABLED)) return 'not-allowed';
    if (target.closest(SELECTOR_TEXT)) return 'text';
    if (target.closest(SELECTOR_POINTER)) return 'pointer';
    return 'default';
  }

  function onMove(e) {
    x = e.clientX;
    y = e.clientY;
    if (!raf) {
      raf = requestAnimationFrame(() => {
        applyTransform();
        raf = 0;
      });
    }
    const hit = document.elementFromPoint(x, y);
    if (hit?.closest('.site-cursor')) return;
    setVariant(detectVariant(hit));
  }

  function mountCursor() {
    if (!el) return;
    const openDialog = document.querySelector('dialog[open]');
    if (openDialog) {
      openDialog.appendChild(el);
      el.classList.add('site-cursor--in-dialog');
    } else {
      document.body.appendChild(el);
      el.classList.remove('site-cursor--in-dialog');
    }
  }

  function bindDialogLayer() {
    document.querySelectorAll('dialog').forEach((dialog) => {
      dialog.addEventListener('toggle', mountCursor);
    });
  }

  function buildLayer(name, src, ext = 'webp') {
    const img = document.createElement('img');
    img.src = asset(src);
    img.alt = '';
    img.draggable = false;
    img.decoding = 'async';
    img.hidden = name !== 'default';
    layers[name] = img;
    el.appendChild(img);
  }

  function init(config = {}) {
    if (!canUse() || !config?.enabled) return;

    const base = (config.basePath || 'images/cursors/chiaki').replace(/\/$/, '');
    hotspots = {
      default: { x: 30, y: 0 },
      pointer: { x: 0, y: 0 },
      text: { x: 16, y: 16 },
      'not-allowed': { x: 0, y: 0 },
      ...(config.hotspots || {}),
    };

    el = document.createElement('div');
    el.className = 'site-cursor';
    el.setAttribute('aria-hidden', 'true');

    buildLayer('default', `${base}/default.webp`);
    buildLayer('pointer', `${base}/pointer.webp`);
    buildLayer('text', `${base}/text.webp`);

    const staticImg = document.createElement('img');
    staticImg.src = asset(`${base}/not-allowed.png`);
    staticImg.alt = '';
    staticImg.draggable = false;
    staticImg.hidden = true;
    layers['not-allowed'] = staticImg;
    el.appendChild(staticImg);

    document.body.appendChild(el);
    document.documentElement.classList.add('custom-cursor');
    enabled = true;

    bindDialogLayer();
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseover', onMove, { passive: true });
    document.addEventListener('mouseleave', () => {
      el.style.transform = 'translate3d(-9999px, -9999px, 0)';
    });
  }

  return { init, canUse };
})();
