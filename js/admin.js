/* 管理后台 — 仅主人可编辑，发布后访客才能看到 */

const {
  $, uid, ratingFromSlider, sliderFromRating,
  filterAndSort, calcStats, renderGrid, renderDetail, sha256,
} = MovieShared;

const CONFIG_KEY = 'movie-admin-config';
const SESSION_KEY = 'movie-admin-session';
const DATA_PATH = 'data/movies.json';
const DEFAULT_REPO = 'fangsuzhe/fangsuzhe.github.io';

let movies = [];
let editingId = null;
let fileSha = null;
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
    setStatus(`已加载 ${movies.length} 部电影`, 'ok');
    render();
  } catch (err) {
    setStatus(err.message, 'error');
    // 降级：从本地 JSON 加载
    try {
      const local = await fetch(DATA_PATH);
      if (local.ok) {
        movies = await local.json();
        render();
      }
    } catch { /* ignore */ }
  }
}

async function publishToGitHub() {
  if (!adminConfig.githubToken) return alert('请先在设置中配置 GitHub Token');

  setStatus('正在发布…', 'info');
  $('#btnPublish').disabled = true;

  try {
    const repo = adminConfig.repo || DEFAULT_REPO;
    const branch = adminConfig.branch || 'main';
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(movies, null, 2))));

    const body = {
      message: `更新观影记录 (${new Date().toLocaleString('zh-CN')})`,
      content,
      branch,
    };
    if (fileSha) body.sha = fileSha;

    const res = await fetch(`https://api.github.com/repos/${repo}/contents/${DATA_PATH}`, {
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

    fileSha = result.content.sha;
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
    $('#inputWatchDate').value = m.watchDate || '';
    $('#inputGenre').value = m.genre || '';
    $('#inputPoster').value = m.poster || '';
    $('#inputBookmark').value = m.bookmark || '';
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
    watchDate: $('#inputWatchDate').value,
    genre: $('#inputGenre').value.trim(),
    poster: $('#inputPoster').value.trim(),
    rating: ratingFromSlider(els.ratingSlider.value),
    bookmark: $('#inputBookmark').value.trim(),
    review: $('#inputReview').value.trim(),
  };

  if (editingId) {
    const idx = movies.findIndex((x) => x.id === editingId);
    if (idx !== -1) movies[idx] = { ...movies[idx], ...data };
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
        watchDate: m.watchDate || '',
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
$('#btnLogout').addEventListener('click', logout);
$('#settingsForm').addEventListener('submit', saveSettings);
$('#btnCloseSettings').addEventListener('click', () => $('#settingsModal').close());

els.modal.addEventListener('click', (e) => { if (e.target === els.modal) closeModal(); });
els.detailModal.addEventListener('click', (e) => { if (e.target === els.detailModal) els.detailModal.close(); });

// Init
if (!adminConfig.passwordHash) {
  showSetupScreen();
} else if (isLoggedIn()) {
  showAdminApp();
  loadMoviesFromGitHub();
} else {
  showLoginScreen();
}
