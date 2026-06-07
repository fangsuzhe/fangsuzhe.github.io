"""Extract Windows .ani cursor frames and build web-friendly assets."""
import json
import os
import struct
import sys
from io import BytesIO

try:
    from PIL import Image
except ImportError:
    print("Need Pillow: pip install pillow")
    sys.exit(1)

ROOT = os.path.join(os.path.dirname(__file__), "..")
SRC_DIR = os.path.join(ROOT, "images", "_source", "cursors-chiaki")
OUT_DIR = os.path.join(ROOT, "images", "cursors", "chiaki")

CUR_MAP = {
    "alternate.cur": "default.cur",
    "handwriting.cur": "pointer.cur",
    "cross.cur": "crosshair.cur",
    "help.cur": "help.cur",
    "unavailable.cur": "not-allowed.cur",
}

ANI_MAP = {
    "pointer.ani": "default",
    "link.ani": "pointer",
    "text.ani": "text",
}


def read_u32(data, off):
    return struct.unpack_from("<I", data, off)[0]


def parse_anih(data):
    fields = struct.unpack_from("<9I", data, 0)
    return {
        "cFrames": fields[1],
        "cSteps": fields[2],
        "cx": fields[3],
        "cy": fields[4],
        "jifRate": fields[7],
        "flags": fields[8],
    }


def iter_riff_chunks(data, start, end):
    off = start
    while off + 8 <= end:
        cid = data[off:off + 4].decode("ascii", errors="replace")
        size = read_u32(data, off + 4)
        payload_off = off + 8
        payload_end = payload_off + size
        yield cid, data[payload_off:payload_end]
        off = payload_end + (size & 1)


def extract_ani(path):
    with open(path, "rb") as f:
        data = f.read()

    if data[:4] != b"RIFF" or data[8:12] != b"ACON":
        raise ValueError(f"Not ACON: {path}")

    meta = {"rate": [], "sequence": [], "frames": []}
    frames = []

    for cid, payload in iter_riff_chunks(data, 12, len(data)):
        if cid == "anih":
            meta["anih"] = parse_anih(payload)
        elif cid == "rate":
            meta["rate"] = list(struct.unpack("<" + "I" * (len(payload) // 4), payload))
        elif cid == "seq ":
            meta["sequence"] = list(struct.unpack("<" + "I" * (len(payload) // 4), payload))
        elif cid == "LIST" and payload[:4] == b"fram":
            for sub_cid, sub_payload in iter_riff_chunks(payload, 4, len(payload)):
                if sub_cid in ("icon", "cur "):
                    frames.append(sub_payload)

    meta["frames"] = frames
    return meta


def frame_to_rgba(raw):
    bio = BytesIO(raw)
    img = Image.open(bio)
    return img.convert("RGBA")


def build_webp(frames_raw, out_path, durations_ms):
    images = [frame_to_rgba(raw) for raw in frames_raw]
    if not images:
        raise ValueError("no frames")

    max_w = max(im.width for im in images)
    max_h = max(im.height for im in images)
    canvas = []
    for im in images:
        layer = Image.new("RGBA", (max_w, max_h), (0, 0, 0, 0))
        layer.paste(im, ((max_w - im.width) // 2, (max_h - im.height) // 2), im)
        canvas.append(layer)

    durs = durations_ms[: len(canvas)]
    while len(durs) < len(canvas):
        durs.append(durs[-1] if durs else 100)

    canvas[0].save(
        out_path,
        save_all=True,
        append_images=canvas[1:],
        duration=durs,
        loop=0,
        lossless=False,
        quality=82,
        method=6,
    )
    return max_w, max_h


def ms_from_rate(rate, fallback_jif):
    if not rate:
        jif = fallback_jif or 10
        return max(16, int(jif * 1000 / 60))
    return max(16, int(rate * 1000 / 60))


def convert_ani(name, out_key):
    src = os.path.join(SRC_DIR, name)
    if not os.path.isfile(src):
        print(f"skip missing {name}")
        return None

    meta = extract_ani(src)
    frames = meta["frames"]
    anih = meta.get("anih") or {}
    seq = meta.get("sequence") or list(range(anih.get("cSteps", len(frames))))
    rate = meta.get("rate") or []

    ordered = []
    durations = []
    for i, idx in enumerate(seq):
        if idx >= len(frames):
            continue
        ordered.append(frames[idx])
        jif = rate[i] if i < len(rate) else (rate[-1] if rate else anih.get("jifRate", 10))
        durations.append(ms_from_rate(jif, anih.get("jifRate", 10)))

    out_webp = os.path.join(OUT_DIR, f"{out_key}.webp")
    w, h = build_webp(ordered, out_webp, durations)
    print(f"OK {name} -> {out_key}.webp ({len(ordered)} frames, {w}x{h})")
    return {"key": out_key, "width": w, "height": h, "frames": len(ordered)}


def copy_cur():
    for src_name, dst_name in CUR_MAP.items():
        src = os.path.join(SRC_DIR, src_name)
        dst = os.path.join(OUT_DIR, dst_name)
        if os.path.isfile(src):
            with open(src, "rb") as f:
                data = f.read()
            with open(dst, "wb") as f:
                f.write(data)
            print(f"OK {src_name} -> {dst_name}")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    copy_cur()

    manifest = {"hotspot": {"x": 0, "y": 0}, "variants": {}}
    for ani, key in ANI_MAP.items():
        info = convert_ani(ani, key)
        if info:
            manifest["variants"][key] = {
                "webp": f"images/cursors/chiaki/{key}.webp",
                "width": info["width"],
                "height": info["height"],
            }

    manifest_path = os.path.join(OUT_DIR, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print("manifest written")


if __name__ == "__main__":
    main()
