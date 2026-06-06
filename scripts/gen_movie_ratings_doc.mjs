import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const MOVIES_PATH = join(ROOT, "data", "movies.json");
const DOC_PATH = join(ROOT, "data", "movie-ratings-for-ai.md");

const movies = JSON.parse(readFileSync(MOVIES_PATH, "utf-8"));

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
    lines.push(`- **${m.title}** ${parseFloat(m.rating)} 分`);
  }
  lines.push("");
}

lines.push("## 完整列表（按评分倒序，同分按片名）", "");
for (const m of [...movies].sort(
  (a, b) => parseFloat(b.rating) - parseFloat(a.rating) || a.title.localeCompare(b.title, "zh")
)) {
  lines.push(`- **${m.title}** ${parseFloat(m.rating)} 分`);
}

writeFileSync(DOC_PATH, lines.join("\n") + "\n", "utf-8");
console.log(`Generated ${DOC_PATH} (${movies.length} movies)`);
