import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const MOVIES_PATH = join(ROOT, "data", "movies.json");
const DOC_PATH = join(ROOT, "data", "movie-ratings-for-ai.md");

const movies = JSON.parse(readFileSync(MOVIES_PATH, "utf-8"));

if (!movies.some((m) => m.title === "卢旺达饭店")) {
  movies.unshift({
    id: "m_hotel_rwanda",
    createdAt: 1780675199700,
    title: "卢旺达饭店",
    director: "特瑞·乔治",
    year: "2004",
    watchDate: "2026-06-06",
    genre: "剧情, 传记, 历史, 战争",
    poster: "images/posters/m_hotel_rwanda.webp",
    rating: "6.0",
    review: "",
  });
  writeFileSync(MOVIES_PATH, JSON.stringify(movies, null, 2) + "\n", "utf-8");
  console.log("Added 卢旺达饭店");
}

const ratings = movies.map((m) => parseFloat(m.rating));
const ratingCounts = {};
for (const r of ratings) {
  ratingCounts[r] = (ratingCounts[r] || 0) + 1;
}
const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;

const lines = [
  "# 个人电影打分记录",
  "",
  "> 本文档由个人观影记录自动生成，供 AI 分析观影偏好使用。",
  "",
  "## 概览",
  "",
  `- 总观影数：${movies.length} 部`,
  `- 平均分：${avg.toFixed(2)} / 10`,
  `- 评分范围：${Math.min(...ratings)} ~ ${Math.max(...ratings)}`,
  "",
  "### 评分分布",
  "",
];

for (const r of Object.keys(ratingCounts).map(Number).sort((a, b) => b - a)) {
  const bar = "█".repeat(ratingCounts[r]);
  lines.push(`- ${r} 分：${ratingCounts[r]} 部 ${bar}`);
}
lines.push("");

const groups = [
  [9, 10, "9-10 分（极爱）"],
  [7, 8.99, "7-8 分（很喜欢）"],
  [5, 6.99, "5-6 分（一般/还行）"],
  [3, 4.99, "3-4 分（不太喜欢）"],
  [0, 2.99, "1-2 分（不喜欢）"],
];

lines.push("## 按评分分组", "");
for (const [lo, hi, label] of groups) {
  const group = movies
    .filter((m) => {
      const rating = parseFloat(m.rating);
      return rating >= lo && rating <= hi;
    })
    .sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating) || a.title.localeCompare(b.title, "zh"));

  lines.push(`### ${label}（${group.length} 部）`, "");
  for (const m of group) {
    const extras = [];
    if (m.bookmark) extras.push(`备注：${m.bookmark}`);
    if (m.review) extras.push(`短评：${m.review}`);
    const suffix = extras.length ? ` — ${extras.join(" | ")}` : "";
    lines.push(
      `- **${m.title}**（${m.year}）${parseFloat(m.rating)} 分 — ${m.director} / ${m.genre}${suffix}`
    );
  }
  lines.push("");
}

lines.push("## 完整列表（按观看日期倒序）", "");
for (const m of [...movies].sort((a, b) => (b.watchDate || "").localeCompare(a.watchDate || ""))) {
  const extras = [];
  if (m.bookmark) extras.push(`备注：${m.bookmark}`);
  if (m.review) extras.push(`短评：${m.review}`);
  const extra = extras.length ? ` | ${extras.join(" | ")}` : "";
  lines.push(
    `- ${m.watchDate || "未知"} | **${m.title}** | ${parseFloat(m.rating)} 分 | ${m.director} | ${m.year} | ${m.genre}${extra}`
  );
}

lines.push("", "## 完整列表（按评分倒序，同分按片名）", "");
for (const m of [...movies].sort(
  (a, b) => parseFloat(b.rating) - parseFloat(a.rating) || a.title.localeCompare(b.title, "zh")
)) {
  const extras = [];
  if (m.bookmark) extras.push(`备注：${m.bookmark}`);
  if (m.review) extras.push(`短评：${m.review}`);
  const extra = extras.length ? ` | ${extras.join(" | ")}` : "";
  lines.push(
    `- ${parseFloat(m.rating)} 分 | **${m.title}**（${m.year}）| ${m.director} | ${m.genre} | 观看：${m.watchDate || "未知"}${extra}`
  );
}

writeFileSync(DOC_PATH, lines.join("\n") + "\n", "utf-8");
console.log(`Generated ${DOC_PATH} (${movies.length} movies)`);
