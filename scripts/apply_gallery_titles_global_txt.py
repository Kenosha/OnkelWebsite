#!/usr/bin/env python3
"""
Wendet eine globale Titel-Liste (Nummer -> Name) auf die lokalen _titles.txt Dateien an.

Eingabeformat (default): assets/gallery/<collection>/titles_global.txt

Beispiele:
  1 fore!
  18
  111-114 V

Regeln:
- Leere Titel (nur "18") -> Titel bleibt die Nummer.
- Nummern-Bereiche ("111-114") -> gleicher Titel für alle Nummern im Bereich.

Wichtig:
- Die Nummerierung basiert auf der aktuellen Anzeige-Reihenfolge in
  `assets/gallery/<collection>/processed/index.json`.
- Daher: erst einmal `python3 scripts/build_gallery_processed.py` laufen lassen,
  bevor du dieses Script benutzt (oder nachdem sich die Collection-Struktur geändert hat).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path


LINE_RE = re.compile(r"^(?P<range>\d+(?:\s*-\s*\d+)?)\s*(?P<title>.*)$")


def read_active_collection() -> str:
    p = Path("assets/gallery/_active_collection.txt")
    if not p.is_file():
        raise SystemExit("Fehler: assets/gallery/_active_collection.txt nicht gefunden.")
    value = p.read_text(encoding="utf-8").strip()
    if not value:
        raise SystemExit("Fehler: _active_collection.txt ist leer.")
    return value


def load_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise SystemExit(f"Fehler: Datei nicht gefunden: {path}")
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Fehler: Ungültiges JSON: {path} ({exc})")


def parse_global_titles(path: Path) -> dict[int, str]:
    if not path.is_file():
        raise SystemExit(f"Fehler: Datei nicht gefunden: {path}")

    mapping: dict[int, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue

        m = LINE_RE.match(line)
        if not m:
            raise SystemExit(f"Fehler: Ungültige Zeile: {path}: {raw!r}")

        range_part = m.group("range").replace(" ", "")
        title = m.group("title").strip()

        if "-" in range_part:
            a_s, b_s = range_part.split("-", 1)
            a = int(a_s)
            b = int(b_s)
            if b < a:
                raise SystemExit(f"Fehler: Ungültiger Bereich: {raw!r}")
            for n in range(a, b + 1):
                mapping[n] = title
        else:
            mapping[int(range_part)] = title

    return mapping


def write_titles_file(path: Path, entries: list[tuple[str, str]], dry_run: bool) -> None:
    lines: list[str] = [
        "# Format: <Dateiname> | <Bildname>",
        "# Den Bildnamen kannst du frei ändern. Den Dateinamen bitte unverändert lassen.",
    ]
    for filename, title in entries:
        lines.append(f"{filename} | {title}")
    content = "\n".join(lines) + "\n"
    if dry_run:
        return
    path.write_text(content, encoding="utf-8")


def iter_sources_in_display_order(processed_root: Path) -> list[Path]:
    """
    Returns list of original source Paths in the order they appear in processed/index.json.
    """
    index_path = processed_root / "index.json"
    index = load_json(index_path)

    sources: list[Path] = []
    for category in index.get("categories", []):
        for cls in category.get("classes", []):
            for set_entry in cls.get("sets", []):
                base = set_entry.get("base")
                if not isinstance(base, str) or not base:
                    continue
                set_json_path = Path(base) / "_set.json"
                set_json = load_json(set_json_path)
                set_sources = set_json.get("sources", [])
                if not isinstance(set_sources, list):
                    continue
                for src in set_sources:
                    if isinstance(src, str) and src:
                        sources.append(Path(src))
    return sources


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="Setzt Titel aus titles_global.txt in original/**/_titles.txt.")
    ap.add_argument(
        "--collection",
        default=None,
        help="Collection-Ordner, z.B. 2026_01_28 (Default: aus _active_collection.txt).",
    )
    ap.add_argument(
        "--input",
        default=None,
        help="Pfad zur globalen Titel-Liste (Default: assets/gallery/<collection>/titles_global.txt).",
    )
    ap.add_argument(
        "--start",
        type=int,
        default=1,
        help="Startnummer (Default: 1).",
    )
    ap.add_argument("--dry-run", action="store_true", help="Nur anzeigen, nichts schreiben.")
    args = ap.parse_args(argv)

    collection = args.collection or read_active_collection()
    input_path = Path(args.input) if args.input else Path("assets/gallery") / collection / "titles_global.txt"
    global_map = parse_global_titles(input_path)

    processed_root = Path("assets/gallery") / collection / "processed"
    if not processed_root.is_dir():
        print(f"Fehler: processed/ nicht gefunden: {processed_root}", file=sys.stderr)
        return 1

    ordered_sources = iter_sources_in_display_order(processed_root)
    if not ordered_sources:
        print(f"Keine Bilder gefunden (index.json / _set.json) unter {processed_root}", file=sys.stderr)
        return 1

    # Build: group_dir -> list[(filename, title)] in the encountered order.
    grouped: dict[Path, list[tuple[str, str]]] = defaultdict(list)
    n = int(args.start)
    changed_titles = 0
    for src in ordered_sources:
        group_dir = src.parent
        desired = global_map.get(n, "").strip()
        title = desired if desired else str(n)
        grouped[group_dir].append((src.name, title))
        if desired:
            changed_titles += 1
        n += 1

    changed_files = 0
    for group_dir, entries in sorted(grouped.items(), key=lambda kv: kv[0].as_posix()):
        tf = group_dir / "_titles.txt"
        if not args.dry_run:
            group_dir.mkdir(parents=True, exist_ok=True)
            write_titles_file(tf, entries, dry_run=False)
        changed_files += 1

    total = n - int(args.start)
    if args.dry_run:
        print(f"Dry-run: würde {total} Bilder in {changed_files} Dateien schreiben (davon {changed_titles} mit Titel-Text).")
    else:
        print(f"OK: {total} Bilder geschrieben in {changed_files} Dateien (davon {changed_titles} mit Titel-Text).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
