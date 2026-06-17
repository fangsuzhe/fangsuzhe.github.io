/**
 * 批量压缩并统一为 webp（封面/海报类图片）
 * 用法：npm install && node scripts/compress-all-images.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const IMAGE_EXT = new Set(['.webp', '.jpg', '.jpeg', '.png']);
const SKIP_DIRS = new Set(['_source', '_out', '_trash']);

/** @type {{ dir: string, maxWidth: number, quality: number, match?: RegExp }[]} */
const TARGETS = [
  { dir: 'images/movies', maxWidth: 420, quality: 76, match: /^m_/i },
  { dir: 'images/drama', maxWidth: 420, quality: 76, match: /^d_/i },
  { dir: 'images/anime', maxWidth: 420, quality: 76, match: /^a_/i },
  { dir: 'images/text', maxWidth: 420, quality: 76, match: /^t_/i },
  { dir: 'images/music', maxWidth: 420, quality: 76, match: /^mu_/i },
  { dir: 'images/idol', maxWidth: 420, quality: 78, match: /^ac_/i },
  { dir: 'images/porn', maxWidth: 480, quality: 78, match: /^code_/i },
  { dir: 'images/doujin', maxWidth: 480, quality: 80, match: /^dj_/i },
  { dir: 'images/characters', maxWidth: 800, quality: 88, match: /^ch_/i },
  { dir: 'images/site', maxWidth: 1920, quality: 82 },
  { dir: 'images/brand', maxWidth: 256, quality: 85 },
];

function safeUnlink(abs, retries = 8) {
  if (!fs.existsSync(abs)) return;
  for (let i = 0; i < retries; i++) {
    try {
      fs.unlinkSync(abs);
      return;
    } catch (err) {
      if (err.code !== 'EBUSY' && err.code !== 'EPERM') throw err;
      if (i === retries - 1) throw err;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150);
    }
  }
}

function moveFile(src, dest) {
  try {
    fs.renameSync(src, dest);
  } catch (err) {
    if (err.code !== 'EBUSY' && err.code !== 'EPERM' && err.code !== 'EXDEV') throw err;
    fs.copyFileSync(src, dest);
    safeUnlink(src);
  }
}

function atomicReplace(tmpAbs, outAbs) {
  const bakAbs = `${outAbs}.bak`;
  safeUnlink(bakAbs);
  if (fs.existsSync(outAbs)) moveFile(outAbs, bakAbs);
  moveFile(tmpAbs, outAbs);
  safeUnlink(bakAbs);
}

function listRasterFiles(dirAbs) {
  if (!fs.existsSync(dirAbs)) return [];
  return fs.readdirSync(dirAbs).filter((name) => {
    const ext = path.extname(name).toLowerCase();
    return IMAGE_EXT.has(ext) && !name.startsWith('.');
  });
}

function groupByBase(files) {
  /** @type {Map<string, string[]>} */
  const map = new Map();
  for (const file of files) {
    const base = file.replace(/\.[^.]+$/, '');
    if (!map.has(base)) map.set(base, []);
    map.get(base).push(file);
  }
  return map;
}

async function pickBestSource(dirAbs, files) {
  let best = files[0];
  let bestScore = -1;
  for (const file of files) {
    const abs = path.join(dirAbs, file);
    const stat = fs.statSync(abs);
    const meta = await sharp(abs).metadata();
    const pixels = (meta.width || 0) * (meta.height || 0);
    const score = pixels * 10 + stat.size;
    if (score > bestScore) {
      bestScore = score;
      best = file;
    }
  }
  return best;
}

async function convertOne(dirAbs, base, sourceFile, variants, { maxWidth, quality }) {
  const srcAbs = path.join(dirAbs, sourceFile);
  const outAbs = path.join(dirAbs, `${base}.webp`);
  const tmpAbs = path.join(dirAbs, '_out', `${base}.webp`);
  const hasNonWebp = variants.some((f) => !/\.webp$/i.test(f));

  if (!hasNonWebp) {
    const before = fs.statSync(srcAbs).size;
    return { base, action: 'skip', before, after: before, source: sourceFile };
  }

  // 已有 webp：只删 jpg/png，避免 Windows 上覆盖被占用的 webp
  if (fs.existsSync(outAbs)) {
    const before = fs.statSync(outAbs).size;
    let cleaned = 0;
    for (const file of variants) {
      if (/\.webp$/i.test(file)) continue;
      try {
        safeUnlink(path.join(dirAbs, file));
        cleaned += 1;
      } catch (err) {
        if (err.code === 'EBUSY' || err.code === 'EPERM') {
          console.warn(`  [warn] ${file}: webp 已存在，但原文件被占用未能删除`);
        } else {
          throw err;
        }
      }
    }
    safeUnlink(`${outAbs}.bak`);
    return {
      base,
      action: cleaned ? 'cleanup' : 'skip',
      before,
      after: before,
      source: sourceFile,
      out: `${base}.webp`,
    };
  }

  fs.mkdirSync(path.dirname(tmpAbs), { recursive: true });
  const before = fs.statSync(srcAbs).size;
  const meta = await sharp(srcAbs).metadata();
  const needsResize = meta.width && meta.width > maxWidth;

  let pipeline = sharp(srcAbs);
  if (needsResize) {
    pipeline = pipeline.resize({ width: maxWidth, withoutEnlargement: true });
  }
  await pipeline.webp({ quality, effort: 4 }).toFile(tmpAbs);

  const after = fs.statSync(tmpAbs).size;
  moveFile(tmpAbs, outAbs);

  for (const file of variants) {
    if (/\.webp$/i.test(file)) continue;
    try {
      safeUnlink(path.join(dirAbs, file));
    } catch (err) {
      if (err.code === 'EBUSY' || err.code === 'EPERM') {
        console.warn(`  [warn] ${file}: 已生成 webp，但原文件被占用未能删除，请稍后手动删`);
      } else {
        throw err;
      }
    }
  }

  safeUnlink(`${outAbs}.bak`);
  return { base, action: 'convert', before, after, source: sourceFile, out: `${base}.webp` };
}

async function processTarget({ dir, maxWidth, quality, match }) {
  const dirAbs = path.join(ROOT, dir);
  const files = listRasterFiles(dirAbs).filter((f) => !match || match.test(f));
  const groups = groupByBase(files);
  const results = [];

  for (const [base, variants] of groups) {
    const source = await pickBestSource(dirAbs, variants);
    const result = await convertOne(dirAbs, base, source, variants, { maxWidth, quality });
    results.push(result);
  }

  const outDir = path.join(dirAbs, '_out');
  if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true });

  return results;
}

async function main() {
  if (!fs.existsSync(path.join(ROOT, 'node_modules', 'sharp'))) {
    console.error('请先运行: npm install');
    process.exit(1);
  }

  let totalBefore = 0;
  let totalAfter = 0;
  let converted = 0;
  let skipped = 0;

  for (const target of TARGETS) {
    const dirAbs = path.join(ROOT, target.dir);
    if (!fs.existsSync(dirAbs)) {
      console.log(`[skip] ${target.dir} 不存在`);
      continue;
    }

    console.log(`\n## ${target.dir}`);
    const results = await processTarget(target);

    for (const r of results) {
      totalBefore += r.before;
      totalAfter += r.after;
      if (r.action === 'skip') {
        skipped += 1;
        continue;
      }
      if (r.action === 'cleanup') {
        converted += 1;
        console.log(`  ${r.base}: 已有 webp，已清理原 jpg/png`);
        continue;
      }
      converted += 1;
      const pct = r.before ? ((1 - r.after / r.before) * 100).toFixed(0) : '0';
      console.log(`  ${r.base}: ${path.extname(r.source)} → webp, ${(r.before / 1024).toFixed(0)}KB → ${(r.after / 1024).toFixed(0)}KB (${pct}%)`);
    }
    console.log(`  共 ${results.length} 张，新转换 ${results.filter((r) => r.action === 'convert').length} 张，清理 ${results.filter((r) => r.action === 'cleanup').length} 张`);
  }

  console.log(`\n完成：转换 ${converted} 张，跳过 ${skipped} 张（已足够小）`);
  console.log(`体积：${(totalBefore / 1024 / 1024).toFixed(2)}MB → ${(totalAfter / 1024 / 1024).toFixed(2)}MB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
