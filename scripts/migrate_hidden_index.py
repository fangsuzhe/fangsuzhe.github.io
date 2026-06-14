"""One-off migration: add hiddenIndex to movies.json (default 10000, 花火 = 1)."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MOVIES_PATH = ROOT / "data" / "movies.json"
DEFAULT = 10000

movies = json.loads(MOVIES_PATH.read_text(encoding="utf-8"))
for m in movies:
    if m.get("id") == "m_hana_bi":
        m["hiddenIndex"] = 1
    elif "hiddenIndex" not in m:
        m["hiddenIndex"] = DEFAULT

MOVIES_PATH.write_text(json.dumps(movies, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Updated {len(movies)} movies")
