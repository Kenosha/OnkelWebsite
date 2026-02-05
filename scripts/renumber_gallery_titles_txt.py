#!/usr/bin/env python3
"""
Vergibt fortlaufende, globale Bildnummern als provisorische Titel.

Warum?
- Sehr kurze Referenzen (z.B. "17") für Nachrichten/Kontakt.
- Nummern werden in `original/**/_titles.txt` geschrieben und beim Build in
  `processed/index.json` übernommen.

Ablauf:
1) Liest `assets/gallery/<collection>/processed/index.json` (Anzeige-Reihenfolge).
2) Öffnet pro Set die zugehörige `processed/**/_set.json` und nutzt deren `sources`.
3) Schreibt/überschreibt alle Einträge in `original/**/_titles.txt` als 1..N.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path


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


def parse_args(argv: list[str]) -> argparse.Namespace:
    ap = argparse.ArgumentParser(
        description="Schreibt globale, fortlaufende Bildnummern in original/**/_titles.txt.",
    )
    ap.add_argument(
        "--collection",
        help="Collection-Ordner, z.B. 2026_01_28 (Default: aus _active_collection.txt).",
        default=None,
    )
    ap.add_argument(
        "--start",
        type=int,
        default=1,
        help="Startnummer (Default: 1).",
    )
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="Nur anzeigen, was geschrieben würde.",
    )
    return ap.parse_args(argv)


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


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    collection = args.collection or read_active_collection()

    processed_root = Path("assets/gallery") / collection / "processed"
    index_path = processed_root / "index.json"
    index = load_json(index_path)

    # Map: group_dir -> list[(filename, title)] in the order encountered.
    grouped: dict[Path, list[tuple[str, str]]] = defaultdict(list)

    n = int(args.start)
    for category in index.get("categories", []):
        for cls in category.get("classes", []):
            for set_entry in cls.get("sets", []):
                base = set_entry.get("base")
                if not isinstance(base, str) or not base:
                    continue
                set_json_path = Path(base) / "_set.json"
                set_json = load_json(set_json_path)
                sources = set_json.get("sources", [])
                if not isinstance(sources, list):
                    continue

                for src in sources:
                    if not isinstance(src, str) or not src:
                        continue
                    src_path = Path(src)
                    group_dir = src_path.parent
                    grouped[group_dir].append((src_path.name, str(n)))
                    n += 1

    if not grouped:
        print("Keine Bilder gefunden (index.json / _set.json).", file=sys.stderr)
        return 1

    written_files = 0
    written_entries = 0

    # Deterministic file write order.
    for group_dir in sorted(grouped.keys(), key=lambda p: p.as_posix()):
        titles_path = group_dir / "_titles.txt"
        entries = grouped[group_dir]
        written_entries += len(entries)
        if args.dry_run:
            continue
        group_dir.mkdir(parents=True, exist_ok=True)
        write_titles_file(titles_path, entries, dry_run=False)
        written_files += 1

    total = n - int(args.start)
    if args.dry_run:
        print(f"Dry-run: würde {total} Bildtitel in {len(grouped)} Dateien schreiben.")
    else:
        print(f"OK: {total} Bilder nummeriert ({written_entries} Einträge) in {written_files} _titles.txt Dateien.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

