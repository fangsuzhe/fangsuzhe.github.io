/* 管理后台 — 仅主人可编辑，发布后访客才能看到 */

const {
  $, uid, ratingFromSlider, sliderFromRating,
  filterAndSort, calcStats, renderGrid, renderDetail, sha256,
  linesToList, listToLines,
} = MovieShared;

const CONFIG_KEY = 'movie-admin-config';
const SESSION_KEY = 'movie-admin-session';
const DATA_PATH = 'data/movies.json';
const SITE_PATH = 'data/site.json';
const DEFAULT_REPO = 'fangsuzhe/fangsuzhe.github.io';

let movies = [];
let siteConfig = {
  title: '个人空间',
  subtitle: '记录 · 分享 · 留存',
  defaultTab: 'movies',
  defaultSubTab: 'records',
  tabs: [
    {
      id: 'movies',
      label: '电影空间',
      sections: [
        { id: 'records', label: '观影记录' },
        { id: 'best', label: '最' },
        { id: 'taste', label: '观影口味' },
      ],
    },
    { id: 'drama', label: '剧空间' },
    { id: 'anime', label: '动漫空间' },
    { id: 'text', label: '文字空间' },
    { id: 'music', label: '音乐空间' },
    { id: 'actress', label: '女优空间' },
  ],
  spaces: {
    drama: {
      kicker: 'Drama Space',
      statLabel: '已看剧集',
      defaultSubTab: 'records',
      sections: [{ id: 'records', label: '记录' }, { id: 'best', label: '最' }],
      items: [
        { id: 'd_bcs', title: '风骚律师', rating: '10.0' },
        { id: 'd_breaking_bad', title: '绝命毒师', rating: '10.0' },
        { id: 'd_friends', title: '老友记', rating: '10.0' },
        { id: 'd_longmen', title: '龙门镖局', rating: '9.0' },
      ],
      best: [{ id: 'd_bcs', title: '风骚律师', rating: '10.0' }],
    },
    anime: {
      kicker: 'Anime Space',
      statLabel: '已看作品',
      defaultSubTab: 'records',
      sections: [{ id: 'records', label: '记录' }, { id: 'best', label: '最' }],
      items: [{ id: 'a_chainsaw', title: '炎拳', rating: '10.0' }],
      best: [{ id: 'a_chainsaw', title: '炎拳', rating: '10.0' }],
    },
    text: {
      kicker: 'Text Space',
      statLabel: '已读作品',
      defaultSubTab: 'records',
      sections: [{ id: 'records', label: '记录' }, { id: 'best', label: '最' }],
      items: [
        { id: 't_wanshou', title: '万寿寺', author: '王小波', rating: '10.0' },
        { id: 't_frog', title: '蛙', author: '莫言', rating: '10.0' },
        { id: 't_sandalwood', title: '檀香刑', author: '莫言', rating: '10.0' },
      ],
      best: [{ id: 't_wanshou', title: '万寿寺', author: '王小波', rating: '10.0' }],
    },
    music: {
      kicker: 'Music Space',
      statLabel: '已听作品',
      defaultSubTab: 'records',
      sections: [{ id: 'records', label: '记录' }, { id: 'best', label: '最' }],
      items: [{ id: 'mu_fishmans', title: 'fishmans', artist: 'fishmans', rating: '10.0' }],
      best: [{ id: 'mu_fishmans', title: 'fishmans', artist: 'fishmans', rating: '10.0' }],
    },
    actress: {
      kicker: 'Actress Space',
      statLabel: '已收录',
      defaultSubTab: 'records',
      sections: [{ id: 'records', label: '记录' }, { id: 'best', label: '最' }],
      items: [{ id: 'ac_miho', title: '北条麻妃', rating: '10.0' }],
      best: [{ id: 'ac_miho', title: '北条麻妃', rating: '10.0' }],
    },
  },
  best: {
    director: { name: '北野武' },
    movies: [{ id: 'm_hana_bi' }],
  },
  taste: {
    intro: '',
    favoriteDirectors: [],
    favoriteStyles: [],
    dislikes: [],
  },
};
let editingId = null;
let fileSha = null;
let siteFileSha = null;
let adminConfig = loadConfig();

function loadConfig() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG_KEY)) || {};
  } catch {
    return {};
  }
}

function saveConfig(cfg) {
  adminConfig = cfg;
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

function isLoggedIn() {
  return sessionStorage.getItem(SESSION_KEY) === 'ok';
}

function login() {
  sessionStorage.setItem(SESSION_KEY, 'ok');
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  showLoginScreen();
}

const els = {
  loginScreen: $('#loginScreen'),
  setupScreen: $('#setupScreen'),
  adminApp: $('#adminApp'),
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
  publishStatus: $('#publishStatus'),
  importFile: $('#importFile'),
};

function showLoginScreen() {
  els.loginScreen.classList.remove('hidden');
  els.setupScreen.classList.add('hidden');
  els.adminApp.classList.add('hidden');
}

function showSetupScreen() {
  els.loginScreen.classList.add('hidden');
  els.setupScreen.classList.remove('hidden');
  els.adminApp.classList.add('hidden');
}

function showAdminApp() {
  els.loginScreen.classList.add('hidden');
  els.setupScreen.classList.add('hidden');
  els.adminApp.classList.remove('hidden');
}

async function verifyPassword(pwd) {
  const hash = await sha256(pwd);
  return hash === adminConfig.passwordHash;
}

async function handleSetup(e) {
  e.preventDefault();
  const pwd = $('#setupPassword').value;
  const confirm = $('#setupPasswordConfirm').value;
  const token = $('#setupToken').value.trim();
  const repo = $('#setupRepo').value.trim() || DEFAULT_REPO;

  if (pwd.length < 4) return alert('密码至少 4 位');
  if (pwd !== confirm) return alert('两次密码不一致');
  if (!token) return alert('请填写 GitHub Token，否则无法发布到网站');

  saveConfig({
    passwordHash: await sha256(pwd),
    githubToken: token,
    repo,
    branch: 'main',
  });

  login();
  showAdminApp();
  await loadMoviesFromGitHub();
}

async function handleLogin(e) {
  e.preventDefault();
  const pwd = $('#loginPassword').value;
  if (await verifyPassword(pwd)) {
    login();
    showAdminApp();
    await loadMoviesFromGitHub();
  } else {
    alert('密码错误');
  }
}

async function loadMoviesFromGitHub() {
  setStatus('正在加载…', 'info');
  try {
    await Promise.all([loadMoviesFile(), loadSiteFile()]);
    setStatus(`已加载 ${movies.length} 部电影`, 'ok');
    render();
  } catch (err) {
    setStatus(err.message, 'error');
    try {
      const [localMovies, localSite] = await Promise.all([
        fetch(DATA_PATH),
        fetch(SITE_PATH),
      ]);
      if (localMovies.ok) movies = await localMovies.json();
      if (localSite.ok) siteConfig = { ...siteConfig, ...(await localSite.json()) };
      render();
    } catch { /* ignore */ }
  }
}

async function loadMoviesFile() {
  const repo = adminConfig.repo || DEFAULT_REPO;
  const branch = adminConfig.branch || 'main';
  const url = `https://api.github.com/repos/${repo}/contents/${DATA_PATH}?ref=${branch}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${adminConfig.githubToken}`, Accept: 'application/vnd.github+json' },
  });

  if (!res.ok) throw new Error('加载失败，请检查 Token 和仓库名是否正确');

  const data = await res.json();
  fileSha = data.sha;
  movies = JSON.parse(atob(data.content.replace(/\n/g, '')));
}

async function loadSiteFile() {
  const repo = adminConfig.repo || DEFAULT_REPO;
  const branch = adminConfig.branch || 'main';
  const url = `https://api.github.com/repos/${repo}/contents/${SITE_PATH}?ref=${branch}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${adminConfig.githubToken}`, Accept: 'application/vnd.github+json' },
  });

  if (!res.ok) return;

  const data = await res.json();
  siteFileSha = data.sha;
  siteConfig = { ...siteConfig, ...JSON.parse(atob(data.content.replace(/\n/g, ''))) };
}

async function publishFile(path, payload, sha, message) {
  const repo = adminConfig.repo || DEFAULT_REPO;
  const branch = adminConfig.branch || 'main';
  const body = {
    message,
    content: btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 2)))),
    branch,
  };
  if (sha) body.sha = sha;

  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${adminConfig.githubToken}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const result = await res.json();
  if (!res.ok) throw new Error(result.message || '发布失败');
  return result.content.sha;
}

async function publishToGitHub() {
  if (!adminConfig.githubToken) return alert('请先在设置中配置 GitHub Token');

  setStatus('正在发布…', 'info');
  $('#btnPublish').disabled = true;

  try {
    const stamp = new Date().toLocaleString('zh-CN');
    fileSha = await publishFile(
      DATA_PATH,
      movies,
      fileSha,
      `更新观影记录 (${stamp})`
    );
    siteFileSha = await publishFile(
      SITE_PATH,
      siteConfig,
      siteFileSha,
      `更新站点配置 (${stamp})`
    );
    setStatus('✓ 已发布！访客刷新主页即可看到更新（约 1 分钟内生效）', 'ok');
  } catch (err) {
    setStatus('发布失败：' + err.message, 'error');
  } finally {
    $('#btnPublish').disabled = false;
  }
}

function setStatus(msg, type) {
  els.publishStatus.textContent = msg;
  els.publishStatus.className = 'publish-status ' + (type || '');
}

function render() {
  const list = filterAndSort(movies, els.search.value, els.sort.value);
  const stats = calcStats(movies);

  els.statTotal.textContent = stats.total;
  els.statAvg.textContent = stats.avg;
  els.statBest.textContent = stats.best;
  els.empty.classList.toggle('visible', movies.length === 0);

  renderGrid(list, els.grid, openDetail);
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
    $('#inputGenre').value = m.genre || '';
    $('#inputPoster').value = m.poster || '';
    $('#inputBookmark').value = m.bookmark || '';
    $('#inputReview').value = m.review || '';
    els.ratingSlider.value = sliderFromRating(m.rating);
  } else {
    els.ratingSlider.value = 80;
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

  renderDetail(m, $('#detailContent'), {
    showEdit: true,
    onEdit: () => { els.detailModal.close(); openModal(id); },
  });
  els.detailModal.showModal();
}

function handleSubmit(e) {
  e.preventDefault();
  const title = $('#inputTitle').value.trim();
  if (!title) return;

  const data = {
    title,
    director: $('#inputDirector').value.trim(),
    year: $('#inputYear').value.trim(),
    genre: $('#inputGenre').value.trim(),
    poster: $('#inputPoster').value.trim(),
    rating: ratingFromSlider(els.ratingSlider.value),
    bookmark: $('#inputBookmark').value.trim(),
    review: $('#inputReview').value.trim(),
  };

  if (editingId) {
    const idx = movies.findIndex((x) => x.id === editingId);
    if (idx !== -1) {
      const { watchDate, ...rest } = movies[idx];
      movies[idx] = { ...rest, ...data };
    }
  } else {
    movies.unshift({ id: uid(), createdAt: Date.now(), ...data });
  }

  closeModal();
  render();
  setStatus('已保存到本地，记得点「发布更新」让访客看到', 'warn');
}

function handleDelete() {
  if (!editingId || !confirm('确定删除这条记录？')) return;
  movies = movies.filter((x) => x.id !== editingId);
  closeModal();
  render();
  setStatus('已删除，记得点「发布更新」', 'warn');
}

function exportData() {
  const blob = new Blob([JSON.stringify(movies, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `movies_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data) || (data.length && !data[0].title)) throw new Error();
      if (movies.length && !confirm('导入将覆盖当前列表，继续？')) return;
      movies = data.map((m) => ({
        id: m.id || uid(),
        createdAt: m.createdAt || Date.now(),
        title: m.title,
        director: m.director || '',
        year: m.year || '',
        genre: m.genre || '',
        poster: m.poster || '',
        rating: m.rating || '8.0',
        bookmark: m.bookmark || '',
        review: m.review || '',
      }));
      render();
      setStatus('已导入，记得点「发布更新」', 'warn');
    } catch {
      alert('导入失败，请检查 JSON 格式');
    }
  };
  reader.readAsText(file);
}

function openTasteModal() {
  const taste = siteConfig.taste || {};
  $('#inputTasteIntro').value = taste.intro || '';
  $('#inputFavoriteDirectors').value = listToLines(taste.favoriteDirectors);
  $('#inputFavoriteStyles').value = listToLines(taste.favoriteStyles);
  $('#inputDislikes').value = listToLines(taste.dislikes);
  $('#tasteModal').showModal();
}

function saveTaste(e) {
  e.preventDefault();
  siteConfig.taste = {
    intro: $('#inputTasteIntro').value.trim(),
    favoriteDirectors: linesToList($('#inputFavoriteDirectors').value),
    favoriteStyles: linesToList($('#inputFavoriteStyles').value),
    dislikes: linesToList($('#inputDislikes').value),
  };
  $('#tasteModal').close();
  setStatus('口味已保存到本地，记得点「发布更新」', 'ok');
}

function openSettings() {
  $('#settingsToken').value = adminConfig.githubToken || '';
  $('#settingsRepo').value = adminConfig.repo || DEFAULT_REPO;
  $('#settingsOldPwd').value = '';
  $('#settingsNewPwd').value = '';
  $('#settingsModal').showModal();
}

async function saveSettings(e) {
  e.preventDefault();
  const token = $('#settingsToken').value.trim();
  const repo = $('#settingsRepo').value.trim() || DEFAULT_REPO;
  const oldPwd = $('#settingsOldPwd').value;
  const newPwd = $('#settingsNewPwd').value;

  if (!token) return alert('GitHub Token 不能为空');

  const cfg = { ...adminConfig, githubToken: token, repo };

  if (newPwd) {
    if (!(await verifyPassword(oldPwd))) return alert('原密码错误');
    if (newPwd.length < 4) return alert('新密码至少 4 位');
    cfg.passwordHash = await sha256(newPwd);
  }

  saveConfig(cfg);
  $('#settingsModal').close();
  setStatus('设置已保存', 'ok');
}

// Events
$('#setupForm').addEventListener('submit', handleSetup);
$('#loginForm').addEventListener('submit', handleLogin);
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
$('#btnPublish').addEventListener('click', publishToGitHub);
$('#btnExport').addEventListener('click', exportData);
$('#btnImport').addEventListener('click', () => els.importFile.click());
els.importFile.addEventListener('change', (e) => {
  if (e.target.files[0]) importData(e.target.files[0]);
  e.target.value = '';
});
$('#btnSettings').addEventListener('click', openSettings);
$('#btnEditTaste').addEventListener('click', openTasteModal);
$('#tasteForm').addEventListener('submit', saveTaste);
$('#btnCloseTaste').addEventListener('click', () => $('#tasteModal').close());
$('#btnCloseTaste2').addEventListener('click', () => $('#tasteModal').close());
$('#btnLogout').addEventListener('click', logout);
$('#settingsForm').addEventListener('submit', saveSettings);
$('#btnCloseSettings').addEventListener('click', () => $('#settingsModal').close());

els.modal.addEventListener('click', (e) => { if (e.target === els.modal) closeModal(); });
els.detailModal.addEventListener('click', (e) => { if (e.target === els.detailModal) els.detailModal.close(); });
$('#tasteModal')?.addEventListener('click', (e) => { if (e.target === $('#tasteModal')) $('#tasteModal').close(); });

// Init
if (!adminConfig.passwordHash) {
  showSetupScreen();
} else if (isLoggedIn()) {
  showAdminApp();
  loadMoviesFromGitHub();
} else {
  showLoginScreen();
}
