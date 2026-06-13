import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const MOVIES_PATH = join(ROOT, "data", "movies.json");
const DOC_PATH = join(ROOT, "data", "movie-ratings-for-ai.md");

const movies = JSON.parse(readFileSync(MOVIES_PATH, "utf-8"));

function ratingOf(m) {
  return parseFloat(m.rating);
}

function sortByRatingThenTitle(a, b) {
  const dr = ratingOf(b) - ratingOf(a);
  if (dr !== 0) return dr;
  return a.title.localeCompare(b.title, "zh");
}

const ratings = movies.map(ratingOf);
const ratingCounts = {};
for (const r of ratings) {
  const key = Number.isInteger(r) ? r : r;
  ratingCounts[key] = (ratingCounts[key] || 0) + 1;
}
const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;

const genreCounts = {};
for (const m of movies) {
  const parts = String(m.genre || "")
    .split(/[,，、/]/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const g of parts) {
    genreCounts[g] = (genreCounts[g] || 0) + 1;
  }
}
const topGenres = Object.entries(genreCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 8);

const generatedAt = new Date().toISOString().slice(0, 10);

const lines = [
  "# 个人电影打分记录",
  "",
  "> 本文档由 `data/movies.json` 自动生成，供 AI 分析观影偏好使用。",
  "> 更新命令：`node scripts/gen_movie_ratings_doc.mjs`",
  "",
  `> 生成日期：${generatedAt}`,
  "",
  "## 概览",
  "",
  `- 总观影数：${movies.length} 部`,
  `- 平均分：${avg.toFixed(2)} / 10`,
  `- 评分范围：${Math.min(...ratings)} ~ ${Math.max(...ratings)}`,
  "",
  "### 常见类型（按出现次数）",
  "",
  ...topGenres.map(([g, n]) => `- ${g}：${n} 部`),
  "",
  "### 评分分布",
  "",
];

const maxBar = Math.max(...Object.values(ratingCounts));
for (const r of Object.keys(ratingCounts).map(Number).sort((a, b) => b - a)) {
  const count = ratingCounts[r];
  const barLen = Math.max(1, Math.round((count / maxBar) * 40));
  const bar = "█".repeat(barLen);
  lines.push(`- ${r} 分：${count} 部 ${bar}`);
}
lines.push("");

const groups = [
  [9, 10, "9-10 分（极爱）"],
  [7, 8.99, "7-8 分（很喜欢）"],
  [5, 6.99, "5-6 分（一般/还行）"],
  [3, 4.99, "3-4 分（不太喜欢）"],
  [0, 2.99, "0-2 分（不喜欢）"],
];

function formatMovieLine(m) {
  const bits = [`**${m.title}** ${ratingOf(m)} 分`];
  const year = String(m.year || "").trim();
  const director = String(m.director || "").trim();
  if (year || director) {
    bits.push(`（${[year, director].filter(Boolean).join(" · ")}）`);
  }
  const bookmark = String(m.bookmark || "").trim();
  const review = String(m.review || "").trim();
  if (bookmark) bits.push(`— 书签：${bookmark}`);
  if (review) bits.push(`— ${review}`);
  return `- ${bits.join(" ")}`;
}

lines.push("## 按评分分组", "");
for (const [lo, hi, label] of groups) {
  const group = movies
    .filter((m) => ratingOf(m) >= lo && ratingOf(m) <= hi)
    .sort(sortByRatingThenTitle);

  lines.push(`### ${label}（${group.length} 部）`, "");
  for (const m of group) {
    lines.push(formatMovieLine(m));
  }
  lines.push("");
}

const recent = [...movies]
  .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  .slice(0, 20);

lines.push("## 近期观看（最新 20 部）", "");
for (const m of recent) {
  const date = String(m.watchDate || "").trim();
  lines.push(`- ${formatMovieLine(m).slice(2)}${date ? ` · 观看 ${date}` : ""}`);
}
lines.push("");

const withNotes = movies.filter(
  (m) => String(m.bookmark || "").trim() || String(m.review || "").trim()
);
if (withNotes.length) {
  lines.push("## 有书签或短评的片子", "");
  for (const m of withNotes.sort(sortByRatingThenTitle)) {
    lines.push(formatMovieLine(m));
  }
  lines.push("");
}

writeFileSync(DOC_PATH, lines.join("\n") + "\n", "utf-8");
console.log(`Generated ${DOC_PATH} (${movies.length} movies)`);
