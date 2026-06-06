/**
 * 批量压缩 images/posters/m_*.webp（列表用，约 420px 宽）
 * 用法：npm install && node scripts/compress-posters.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const POSTER_DIR = path.join(ROOT, 'images', 'posters');
const OUT_DIR = path.join(POSTER_DIR, '_out');
const MAX_WIDTH = 420;
const WEBP_QUALITY = 76;

async function main() {
  const files = fs.readdirSync(POSTER_DIR).filter((f) => /^m_.*\.webp$/i.test(f));
  if (!files.length) {
    console.log('没有找到 m_*.webp');
    return;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  let before = 0;
  let after = 0;
  let skipped = 0;
  const toReplace = [];

  for (const file of files) {
    const abs = path.join(POSTER_DIR, file);
    const stat = fs.statSync(abs);
    before += stat.size;

    const meta = await sharp(abs).metadata();
    const out = path.join(OUT_DIR, file);

    if (meta.width && meta.width <= MAX_WIDTH && stat.size < 90 * 1024) {
      fs.copyFileSync(abs, out);
      after += stat.size;
      skipped++;
      toReplace.push(file);
      continue;
    }

    await sharp(abs)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY, effort: 4 })
      .toFile(out);

    const newSize = fs.statSync(out).size;
    after += newSize;
    toReplace.push(file);
    const pct = ((1 - newSize / stat.size) * 100).toFixed(0);
    console.log(`${file}: ${(stat.size / 1024).toFixed(0)}KB → ${(newSize / 1024).toFixed(0)}KB (${pct}%)`);
  }

  for (const file of toReplace) {
    const src = path.join(OUT_DIR, file);
    const dest = path.join(POSTER_DIR, file);
    fs.copyFileSync(src, dest);
  }

  fs.rmSync(OUT_DIR, { recursive: true, force: true });

  console.log(`\n共 ${files.length} 张，跳过 ${skipped} 张已足够小`);
  console.log(`总计 ${(before / 1024 / 1024).toFixed(2)}MB → ${(after / 1024 / 1024).toFixed(2)}MB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
