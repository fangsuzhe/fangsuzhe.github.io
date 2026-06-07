/**
 * 从豆瓣搜索页精确匹配海报，下载到本地 images/movies/
 * 匹配规则：片名 + 年份，避免错配
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const MOVIES_PATH = path.join(ROOT, 'data', 'movies.json');
const POSTER_DIR = path.join(ROOT, 'images', 'movies');
const REPORT_PATH = path.join(ROOT, 'scripts', 'poster-report.json');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function normalizeTitle(str) {
  return String(str)
    .replace(/[。．·…：:#]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function titlesMatch(a, b) {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  return na.includes(nb) || nb.includes(na);
}

function titleVariants(title) {
  const variants = new Set([title.trim()]);
  variants.add(title.replace(/[。．·…：:#]/g, '').trim());
  return [...variants].filter(Boolean);
}

function extractYear(text) {
  const m = String(text).match(/\((\d{4})\)/);
  return m ? m[1] : '';
}

async function searchDouban(query, retries = 4) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(
      `https://search.douban.com/movie/subject_search?search_text=${encodeURIComponent(query)}`,
      { headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN' } }
    );
    if (!res.ok) throw new Error(`豆瓣搜索 HTTP ${res.status}`);
    const html = await res.text();
    const m = html.match(/window\.__DATA__\s*=\s*(\{[\s\S]*?\})\s*;/);
    if (m) {
      const data = JSON.parse(m[1]);
      const items = (data.items || []).map((item) => ({
        title: item.title,
        year: extractYear(item.title),
        poster: item.cover_url,
        id: item.id,
      }));
      if (items.length) return items;
    }
    await sleep(2000 * (attempt + 1));
  }
  return [];
}

function pickBestMatch(movie, items) {
  const year = String(movie.year || '').trim();
  const movies = items.filter((x) => x.poster && !x.poster.includes('movie_default'));

  const exact = movies.filter((x) => x.year === year && titlesMatch(x.title, movie.title));
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) {
    const strict = exact.find((x) => normalizeTitle(x.title).startsWith(normalizeTitle(movie.title)));
    return strict || exact[0];
  }
  return null;
}

async function findPoster(movie) {
  for (const q of titleVariants(movie.title)) {
    const items = await searchDouban(q);
    await sleep(1800);
    const match = pickBestMatch(movie, items);
    if (match) return match;
  }
  return null;
}

async function downloadPoster(url, dest) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Referer: 'https://movie.douban.com/' },
    });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length >= 1024) {
        fs.writeFileSync(dest, buf);
        return;
      }
    }
    await sleep(1500 * (attempt + 1));
  }
  throw new Error('下载失败');
}

async function main() {
  fs.mkdirSync(POSTER_DIR, { recursive: true });
  const movies = JSON.parse(fs.readFileSync(MOVIES_PATH, 'utf8'));
  const report = { ok: [], fail: [], skip: [] };

  for (let i = 0; i < movies.length; i++) {
    const m = movies[i];
    const relPath = `images/movies/${m.id}.jpg`;
    const absPath = path.join(ROOT, relPath);

    process.stdout.write(`[${i + 1}/${movies.length}] ${m.title} (${m.year}) … `);

    if (fs.existsSync(absPath)) {
      m.poster = relPath;
      report.skip.push({ id: m.id, title: m.title });
      console.log('已有本地封面');
      continue;
    }

    try {
      const found = await findPoster(m);
      if (!found) {
        report.fail.push({ id: m.id, title: m.title, year: m.year, director: m.director });
        m.poster = '';
        console.log('未匹配');
        continue;
      }

      await downloadPoster(found.poster, absPath);
      m.poster = relPath;
      report.ok.push({
        id: m.id,
        title: m.title,
        matched: found.title,
        year: found.year,
        doubanId: found.id,
      });
      console.log(`✓ ${found.title}`);
    } catch (err) {
      report.fail.push({ id: m.id, title: m.title, year: m.year, error: err.message });
      console.log(`错误: ${err.message}`);
    }

    if ((i + 1) % 10 === 0) {
      fs.writeFileSync(MOVIES_PATH, JSON.stringify(movies, null, 2) + '\n', 'utf8');
      fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
    }
  }

  fs.writeFileSync(MOVIES_PATH, JSON.stringify(movies, null, 2) + '\n', 'utf8');
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');

  const withPoster = movies.filter((m) => m.poster?.startsWith('images/movies/')).length;
  console.log('\n=== 完成 ===');
  console.log(`成功: ${report.ok.length}`);
  console.log(`跳过: ${report.skip.length}`);
  console.log(`失败: ${report.fail.length}`);
  console.log(`本地封面: ${withPoster}/${movies.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
