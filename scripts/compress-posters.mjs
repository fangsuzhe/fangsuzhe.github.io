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
const MAX_WIDTH = 420;
const WEBP_QUALITY = 76;

async function main() {
  const files = fs.readdirSync(POSTER_DIR).filter((f) => /^m_.*\.webp$/i.test(f));
  if (!files.length) {
    console.log('没有找到 m_*.webp');
    return;
  }

  let before = 0;
  let after = 0;
  let skipped = 0;

  for (const file of files) {
    const abs = path.join(POSTER_DIR, file);
    const stat = fs.statSync(abs);
    before += stat.size;

    const img = sharp(abs);
    const meta = await img.metadata();
    if (meta.width && meta.width <= MAX_WIDTH && stat.size < 90 * 1024) {
      after += stat.size;
      skipped++;
      continue;
    }

    const buf = await img
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY, effort: 4 })
      .toBuffer();

    fs.writeFileSync(abs, buf);
    after += buf.length;
    const pct = ((1 - buf.length / stat.size) * 100).toFixed(0);
    console.log(`${file}: ${(stat.size / 1024).toFixed(0)}KB → ${(buf.length / 1024).toFixed(0)}KB (${pct}%)`);
  }

  console.log(`\n共 ${files.length} 张，跳过 ${skipped} 张已足够小`);
  console.log(`总计 ${(before / 1024 / 1024).toFixed(2)}MB → ${(after / 1024 / 1024).toFixed(2)}MB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
