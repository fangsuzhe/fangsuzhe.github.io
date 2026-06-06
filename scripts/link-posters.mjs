/**
 * 扫描 images/posters/m_*.{webp,jpg,png} 并写入 movies.json 的 poster 字段
 * 用法：node scripts/link-posters.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const POSTER_DIR = path.join(ROOT, 'images', 'posters');
const MOVIES_PATH = path.join(ROOT, 'data', 'movies.json');
const EXTS = new Set(['.webp', '.jpg', '.jpeg', '.png']);

const movies = JSON.parse(fs.readFileSync(MOVIES_PATH, 'utf8'));
const byId = new Map(movies.map((m) => [m.id, m]));
const files = fs.readdirSync(POSTER_DIR).filter((f) => EXTS.has(path.extname(f).toLowerCase()) && /^m_/i.test(f));

let linked = 0;
for (const file of files) {
  const id = file.replace(/\.[^.]+$/, '');
  const movie = byId.get(id);
  if (!movie) {
    console.warn('无对应电影:', file);
    continue;
  }
  const rel = `images/posters/${file}`;
  if (movie.poster !== rel) {
    movie.poster = rel;
    linked++;
  }
}

fs.writeFileSync(MOVIES_PATH, `${JSON.stringify(movies, null, 2)}\n`);
console.log(`扫描 ${files.length} 张，更新 ${linked} 条，共 ${movies.filter((m) => m.poster).length}/${movies.length} 部有海报`);
