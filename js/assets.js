/* 静态资源 CDN — jsDelivr 从 GitHub 仓库拉取，国内访问更快 */
const SiteAssets = (() => {
  const REPO_CDN = 'https://cdn.jsdelivr.net/gh/fangsuzhe/fangsuzhe.github.io@main';

  function useCdn() {
    const { protocol, hostname } = location;
    if (!protocol.startsWith('http')) return false;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return false;
    // GitHub Pages 上文件与页面同源部署，直接相对路径更快（少一跳 jsDelivr）
    if (hostname.endsWith('github.io')) return false;
    return true;
  }

  /** 本地相对路径 → CDN；http(s) 外链原样返回 */
  function cdnUrl(path) {
    if (!path) return path;
    if (/^https?:\/\//i.test(path) || path.startsWith('data:')) return path;
    const clean = String(path).replace(/^\//, '');
    return useCdn() ? `${REPO_CDN}/${clean}` : clean;
  }

  function preloadImage(path, type) {
    const href = cdnUrl(path);
    if (!href || document.querySelector(`link[rel="preload"][href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = href;
    if (type) link.type = type;
    document.head.appendChild(link);
  }

  function bindWallpaper(imgSelector, path = 'images/site/wallpaper.webp') {
    const img = document.querySelector(imgSelector);
    if (!img) return;
    const url = cdnUrl(path);
    preloadImage(path);
    img.src = url;
  }

  function bindBrandAvatar(imgSelector, path = 'images/brand/avatar.webp') {
    const img = document.querySelector(imgSelector);
    if (!img) return;
    const url = cdnUrl(path);
    preloadImage(path, 'image/webp');
    img.src = url;
  }

  return { REPO_CDN, cdnUrl, useCdn, preloadImage, bindWallpaper, bindBrandAvatar };
})();
