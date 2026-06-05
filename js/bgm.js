/* 背景音乐 — 音频同样走 jsDelivr CDN */
const SiteBgm = (() => {
  const STORAGE_KEY = 'site-bgm-on';
  let audio = null;
  let btn = null;
  let label = '';

  function isPlaying() {
    return audio && !audio.paused && !audio.ended;
  }

  function syncButton() {
    if (!btn) return;
    const playing = isPlaying();
    btn.classList.toggle('is-playing', playing);
    btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
    btn.setAttribute('aria-label', playing ? `暂停：${label}` : `播放：${label}`);
    btn.title = playing ? '暂停背景音乐' : '播放背景音乐';
  }

  function persist(on) {
    try {
      localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
    } catch { /* ignore */ }
  }

  function wasEnabled() {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }

  async function play() {
    if (!audio) return false;
    try {
      await audio.play();
      persist(true);
      syncButton();
      return true;
    } catch {
      syncButton();
      return false;
    }
  }

  function pause() {
    if (!audio) return;
    audio.pause();
    persist(false);
    syncButton();
  }

  async function toggle() {
    if (isPlaying()) {
      pause();
      return;
    }
    await play();
  }

  function bindResumeOnInteraction() {
    const resume = () => {
      if (!wasEnabled() || isPlaying()) return;
      play();
    };
    document.addEventListener('pointerdown', resume, { once: true, passive: true });
    document.addEventListener('keydown', resume, { once: true });
  }

  function createButton(config) {
    if (btn) return;
    label = config.title || '背景音乐';

    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bgm-toggle';
    btn.innerHTML = `
      <span class="bgm-toggle-icon bgm-toggle-icon--play" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </span>
      <span class="bgm-toggle-icon bgm-toggle-icon--pause" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>
      </span>
      <span class="bgm-toggle-text">BGM</span>`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggle();
    });

    document.body.appendChild(btn);
    syncButton();
  }

  function init(config) {
    if (!config?.src || typeof SiteAssets === 'undefined') return;

    const url = SiteAssets.cdnUrl(config.src);
    audio = new Audio(url);
    audio.loop = config.loop !== false;
    audio.volume = typeof config.volume === 'number' ? config.volume : 0.35;
    audio.preload = 'auto';

    audio.addEventListener('play', syncButton);
    audio.addEventListener('pause', syncButton);
    audio.addEventListener('ended', syncButton);

    createButton(config);

    if (wasEnabled()) {
      play().then((ok) => {
        if (!ok) bindResumeOnInteraction();
      });
    }
  }

  return { init, play, pause, toggle, isPlaying };
})();
