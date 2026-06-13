"""Generate data/movie-ratings-for-ai.md from data/movies.json (no Node required)."""
import json
from collections import Counter
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MOVIES_PATH = ROOT / "data" / "movies.json"
DOC_PATH = ROOT / "data" / "movie-ratings-for-ai.md"

movies = json.loads(MOVIES_PATH.read_text(encoding="utf-8"))


def rating_of(m):
    return float(m["rating"])


def sort_key(m):
    return (-rating_of(m), m["title"])


ratings = [rating_of(m) for m in movies]
rating_counts = Counter(ratings)
avg = sum(ratings) / len(ratings)

genre_counts = Counter()
for m in movies:
    for part in str(m.get("genre") or "").replace("、", ",").split(","):
        g = part.strip()
        if g:
            genre_counts[g] += 1

top_genres = genre_counts.most_common(8)
generated_at = date.today().isoformat()

lines = [
    "# 个人电影打分记录",
    "",
    "> 本文档由 `data/movies.json` 自动生成，供 AI 分析观影偏好使用。",
    "> 更新命令：`python scripts/gen_movie_ratings_doc.py` 或 `node scripts/gen_movie_ratings_doc.mjs`",
    "",
    f"> 生成日期：{generated_at}",
    "",
    "## 概览",
    "",
    f"- 总观影数：{len(movies)} 部",
    f"- 平均分：{avg:.2f} / 10",
    f"- 评分范围：{min(ratings)} ~ {max(ratings)}",
    "",
    "### 常见类型（按出现次数）",
    "",
]
for g, n in top_genres:
    lines.append(f"- {g}：{n} 部")
lines.append("")
lines.append("### 评分分布")
lines.append("")

max_bar = max(rating_counts.values())
for r in sorted(rating_counts.keys(), reverse=True):
    count = rating_counts[r]
    bar_len = max(1, round(count / max_bar * 40))
    lines.append(f"- {r:g} 分：{count} 部 {'█' * bar_len}")
lines.append("")

groups = [
    (9, 10, "9-10 分（极爱）"),
    (7, 8.99, "7-8 分（很喜欢）"),
    (5, 6.99, "5-6 分（一般/还行）"),
    (3, 4.99, "3-4 分（不太喜欢）"),
    (0, 2.99, "0-2 分（不喜欢）"),
]


def format_movie_line(m):
    bits = [f"**{m['title']}** {rating_of(m):g} 分"]
    year = str(m.get("year") or "").strip()
    director = str(m.get("director") or "").strip()
    if year or director:
        bits.append(f"（{' · '.join(x for x in [year, director] if x)}）")
    bookmark = str(m.get("bookmark") or "").strip()
    review = str(m.get("review") or "").strip()
    if bookmark:
        bits.append(f"— 书签：{bookmark}")
    if review:
        bits.append(f"— {review}")
    return "- " + " ".join(bits)


lines.append("## 按评分分组")
lines.append("")
for lo, hi, label in groups:
    group = [m for m in movies if lo <= rating_of(m) <= hi]
    group.sort(key=sort_key)
    lines.append(f"### {label}（{len(group)} 部）")
    lines.append("")
    for m in group:
        lines.append(format_movie_line(m))
    lines.append("")

recent = sorted(movies, key=lambda m: m.get("createdAt") or 0, reverse=True)[:20]
lines.append("## 近期观看（最新 20 部）")
lines.append("")
for m in recent:
    watch = str(m.get("watchDate") or "").strip()
    suffix = f" · 观看 {watch}" if watch else ""
    lines.append(format_movie_line(m) + suffix)
lines.append("")

with_notes = [
    m for m in movies
    if str(m.get("bookmark") or "").strip() or str(m.get("review") or "").strip()
]
if with_notes:
    lines.append("## 有书签或短评的片子")
    lines.append("")
    for m in sorted(with_notes, key=sort_key):
        lines.append(format_movie_line(m))
    lines.append("")

DOC_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"Generated {DOC_PATH} ({len(movies)} movies)")
