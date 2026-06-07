/**
 * 角色立绘：images/characters/ch_*.webp（约 800px 宽，比电影海报更清晰）
 * 用法：npm install && node scripts/compress-characters.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CHAR_DIR = path.join(ROOT, 'images', 'characters');
const OUT_DIR = path.join(CHAR_DIR, '_out');
const MAX_WIDTH = 800;
const WEBP_QUALITY = 88;

async function main() {
  const files = fs.readdirSync(CHAR_DIR).filter((f) => /^ch_.*\.webp$/i.test(f));
  if (!files.length) {
    console.log('没有找到 ch_*.webp');
    return;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  let before = 0;
  let after = 0;

  for (const file of files) {
    const abs = path.join(CHAR_DIR, file);
    const stat = fs.statSync(abs);
    before += stat.size;

    const meta = await sharp(abs).metadata();
    const out = path.join(OUT_DIR, file);
    const needsResize = meta.width && meta.width > MAX_WIDTH;

    if (!needsResize && stat.size < 180 * 1024) {
      await sharp(abs)
        .webp({ quality: WEBP_QUALITY, effort: 4 })
        .toFile(out);
    } else {
      let pipeline = sharp(abs);
      if (needsResize) {
        pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
      }
      await pipeline.webp({ quality: WEBP_QUALITY, effort: 4 }).toFile(out);
    }

    const newSize = fs.statSync(out).size;
    after += newSize;
    fs.copyFileSync(out, abs);
    console.log(`${file}: ${meta.width}px, ${(stat.size / 1024).toFixed(0)}KB → ${(newSize / 1024).toFixed(0)}KB`);
  }

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  console.log(`\n共 ${files.length} 张，${(before / 1024).toFixed(0)}KB → ${(after / 1024).toFixed(0)}KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
