#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


ACTIVE_COLLECTION_FILE = Path("assets/gallery/_active_collection.txt")
DEFAULT_COLLECTION = "2026_01_28"

SUPPORTED_IMAGE_EXTS = {
    ".avif",
    ".webp",
    ".jpg",
    ".jpeg",
    ".png",
    ".heic",
    ".heif",
    ".tif",
    ".tiff",
    ".bmp",
    ".gif",
}

IGNORED_SUFFIX = ":Zone.Identifier"


def read_active_collection() -> str:
    try:
        value = ACTIVE_COLLECTION_FILE.read_text(encoding="utf-8").strip()
        return value or DEFAULT_COLLECTION
    except OSError:
        return DEFAULT_COLLECTION


def stable_sort_key(path: Path) -> tuple[str, str]:
    name = path.name
    return (name.lower(), name)


def read_text_safe(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        return ""


def is_supported_image(path: Path) -> bool:
    if not path.is_file():
        return False
    if path.name.startswith("."):
        return False
    if path.name.endswith(IGNORED_SUFFIX):
        return False
    return path.suffix.lower() in SUPPORTED_IMAGE_EXTS


def parse_order_file(group_dir: Path, image_files: list[Path]) -> list[Path]:
    order_path = group_dir / "_order.txt"
    if not order_path.is_file():
        return image_files

    wanted: list[str] = []
    for line in read_text_safe(order_path).splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        wanted.append(line)

    by_name = {p.name: p for p in image_files}
    ordered: list[Path] = []
    used: set[str] = set()
    for name in wanted:
        p = by_name.get(name)
        if not p:
            print(f"Warnung: _order.txt referenziert nicht vorhandene Datei: {group_dir}/{name}")
            continue
        ordered.append(p)
        used.add(p.name)

    rest = [p for p in image_files if p.name not in used]
    rest.sort(key=stable_sort_key)
    return ordered + rest


def slugify(value: str) -> str:
    s = value.strip()
    s = re.sub(r"\s+", "_", s)
    s = re.sub(r"[^a-zA-Z0-9_-]+", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    return s or "bild"


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Erzeugt pro Gruppe eine _titles.txt mit provisorischen Bildnamen.\n"
            "Diese Namen können später angepasst werden und erscheinen in der Lightbox."
        )
    )
    parser.add_argument(
        "--collection",
        default=read_active_collection(),
        help="Collection-Ordner, z.B. 2026_01_28 (Default: aus _active_collection.txt).",
    )
    parser.add_argument(
        "--overwrite",
        action=argparse.BooleanOptionalAction,
        default=False,
        help="Bestehende _titles.txt überschreiben (Default: false).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Nur anzeigen, was getan würde.",
    )
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    collection = str(args.collection).strip()
    if not collection:
        print("Fehler: --collection ist leer.", file=sys.stderr)
        return 2

    base = Path("assets/gallery") / collection
    src_root = base / "original"
    if not src_root.exists():
        print(f"Fehler: Quell-Ordner nicht gefunden: {src_root}", file=sys.stderr)
        return 2

    created = 0
    skipped = 0

    categories = [p for p in src_root.iterdir() if p.is_dir() and not p.name.startswith(".")]
    categories.sort(key=stable_sort_key)

    for category_dir in categories:
        class_dirs = [p for p in category_dir.iterdir() if p.is_dir() and not p.name.startswith(".")]
        class_dirs.sort(key=stable_sort_key)
        for class_dir in class_dirs:
            group_dirs = [p for p in class_dir.iterdir() if p.is_dir() and not p.name.startswith(".")]
            group_dirs.sort(key=stable_sort_key)
            for group_dir in group_dirs:
                images = [p for p in group_dir.iterdir() if is_supported_image(p)]
                images.sort(key=stable_sort_key)
                images = parse_order_file(group_dir, images)
                if not images:
                    continue

                out_path = group_dir / "_titles.txt"
                if out_path.exists() and not args.overwrite:
                    skipped += 1
                    continue

                group_slug = slugify(group_dir.name)
                lines = [
                    "# Format: <Dateiname> | <Bildname>",
                    "# Den Bildnamen kannst du frei ändern. Den Dateinamen bitte unverändert lassen.",
                ]
                for i, img in enumerate(images, start=1):
                    provisional = f"{group_slug}_{i:03d}"
                    lines.append(f"{img.name} | {provisional}")
                content = "\n".join(lines) + "\n"

                if args.dry_run:
                    print(f"DRY-RUN: would write {out_path} ({len(images)} entries)")
                else:
                    out_path.write_text(content, encoding="utf-8")
                created += 1

    print(f"Fertig: _titles.txt erstellt={created}, übersprungen={skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

