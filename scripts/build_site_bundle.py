#!/usr/bin/env python3

from __future__ import annotations

import shutil
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "_site"
ACTIVE_COLLECTION_FILE = ROOT / "assets" / "gallery" / "_active_collection.txt"

TOP_LEVEL_FILES = [
    "index.html",
    "gallerie.html",
    "kontakt.html",
    "impressum.html",
    "datenschutz.html",
]

ASSET_DIRS = [
    "assets/css",
    "assets/js",
    "assets/images/landing",
]


def copy_file(rel_path: str) -> None:
    src = ROOT / rel_path
    if not src.is_file():
        return
    dst = OUT_DIR / rel_path
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


def copy_tree(rel_path: str) -> None:
    src = ROOT / rel_path
    if not src.is_dir():
        return
    dst = OUT_DIR / rel_path
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(src, dst, dirs_exist_ok=True)


def ensure_no_oversized_files(limit_bytes: int = 25 * 1024 * 1024) -> None:
    oversized: list[tuple[str, int]] = []
    for path in OUT_DIR.rglob("*"):
        if not path.is_file():
            continue
        size = path.stat().st_size
        if size > limit_bytes:
            oversized.append((str(path.relative_to(OUT_DIR)), size))
    if oversized:
        lines = ["Found oversized files in _site:"]
        for rel, size in oversized:
            lines.append(f"- {rel} ({size} bytes)")
        raise SystemExit("\n".join(lines))


def main() -> int:
    if not ACTIVE_COLLECTION_FILE.is_file():
        raise SystemExit("Missing assets/gallery/_active_collection.txt")

    collection = ACTIVE_COLLECTION_FILE.read_text(encoding="utf-8").strip()
    if not collection:
        raise SystemExit("assets/gallery/_active_collection.txt is empty")

    processed_rel = f"assets/gallery/{collection}/processed"

    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for rel_path in TOP_LEVEL_FILES:
        copy_file(rel_path)

    for rel_path in ASSET_DIRS:
        copy_tree(rel_path)

    copy_file("assets/gallery/_active_collection.txt")
    copy_tree(processed_rel)

    ensure_no_oversized_files()

    print(f"Built deploy bundle in {OUT_DIR}")
    print(f"Included active collection: {collection}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
