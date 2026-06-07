/**
 * 安全匹配海报：中文片名先查 Wikidata 英文名，再查 OMDb
 * 仅接受年份一致的 Amazon 海报链接（可外链，不会配错）
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const MOVIES_PATH = path.join(ROOT, 'data', 'movies.json');
const REPORT_PATH = path.join(ROOT, 'scripts', 'poster-report.json');
const OMDB_KEY = 'trilogy';
const UA = 'fangsuzhe-movie-site/1.0';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function titleVariants(title) {
  const variants = new Set([title.trim()]);
  variants.add(title.replace(/[。．·…：:#]/g, '').trim());
  return [...variants].filter(Boolean);
}

function isMostlyLatin(title) {
  const chars = title.replace(/\s/g, '');
  if (!chars) return false;
  const latin = (chars.match(/[A-Za-z0-9·:']/g) || []).length;
  return latin / chars.length >= 0.5;
}

async function fetchJson(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (err) {
      if (i === retries - 1) throw err;
      await sleep(1200 * (i + 1));
    }
  }
}

async function wikiEnglishTitle(title, year) {
  for (const label of titleVariants(title)) {
    const query = `
SELECT ?enLabel WHERE {
  ?item wdt:P31 wd:Q11424; wdt:P577 ?date; rdfs:label "${label.replace(/"/g, '\\"')}"@zh.
  FILTER(YEAR(?date) = ${year})
  ?item rdfs:label ?enLabel FILTER(LANG(?enLabel) = "en")
} LIMIT 1`;
    const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
    try {
      const data = await fetchJson(url);
      const en = data.results?.bindings?.[0]?.enLabel?.value;
      if (en) return en;
    } catch {
      /* continue */
    }
    await sleep(350);
  }
  return null;
}

async function omdbLookup(title, year) {
  const params = new URLSearchParams({ apikey: OMDB_KEY, t: title, y: String(year), type: 'movie' });
  const data = await fetchJson(`https://www.omdbapi.com/?${params}`);
  if (data.Response !== 'True' || !data.Poster || data.Poster === 'N/A') return null;
  if (String(data.Year).slice(0, 4) !== String(year)) return null;
  return { title: data.Title, year: data.Year, poster: data.Poster };
}

async function resolvePoster(movie) {
  const year = String(movie.year || '').trim();
  if (!year) return null;

  const queries = [];
  if (isMostlyLatin(movie.title)) {
    queries.push({ name: movie.title, via: 'latin' });
  } else {
    const en = await wikiEnglishTitle(movie.title, year);
    if (en) queries.push({ name: en, via: 'wikidata' });
  }

  for (const q of queries) {
    const hit = await omdbLookup(q.name, year);
    await sleep(250);
    if (hit) return { ...hit, via: q.via, query: q.name };
  }
  return null;
}

async function main() {
  const movies = JSON.parse(fs.readFileSync(MOVIES_PATH, 'utf8'));
  const report = { ok: [], fail: [], skip: [] };

  for (let i = 0; i < movies.length; i++) {
    const m = movies[i];
    process.stdout.write(`[${i + 1}/${movies.length}] ${m.title} … `);

    if (m.poster?.startsWith('images/movies/')) {
      const localPath = path.join(ROOT, m.poster);
      if (fs.existsSync(localPath)) {
        report.skip.push({ id: m.id, title: m.title });
        console.log('已有本地封面');
        continue;
      }
    }

    if (m.poster?.startsWith('http')) {
      report.skip.push({ id: m.id, title: m.title, poster: m.poster });
      console.log('已有外链封面');
      continue;
    }

    try {
      const hit = await resolvePoster(m);
      if (hit) {
        m.poster = hit.poster;
        report.ok.push({ id: m.id, title: m.title, matched: hit.title, via: hit.via, query: hit.query });
        console.log(`✓ ${hit.title} (${hit.via})`);
      } else {
        m.poster = '';
        report.fail.push({ id: m.id, title: m.title, year: m.year });
        console.log('未匹配');
      }
    } catch (err) {
      report.fail.push({ id: m.id, title: m.title, error: err.message });
      console.log(`错误: ${err.message}`);
    }

    if ((i + 1) % 25 === 0) {
      fs.writeFileSync(MOVIES_PATH, JSON.stringify(movies, null, 2) + '\n', 'utf8');
      fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
    }
  }

  fs.writeFileSync(MOVIES_PATH, JSON.stringify(movies, null, 2) + '\n', 'utf8');
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');

  const withPoster = movies.filter((m) => m.poster).length;
  console.log('\n=== 完成 ===');
  console.log(`有封面: ${withPoster}/${movies.length}`);
  console.log(`新增: ${report.ok.length}`);
  console.log(`失败: ${report.fail.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
