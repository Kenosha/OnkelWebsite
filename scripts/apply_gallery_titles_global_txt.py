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
"""

from __future__ import annotations

import argparse
import re
import sys
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


def parse_titles_file(path: Path) -> list[tuple[str, str, str]]:
    """
    Returns list of (raw_line, filename, title). Comments/blank lines are returned as (raw, "", "").
    """
    rows: list[tuple[str, str, str]] = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.rstrip("\n")
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "|" not in line:
            rows.append((line, "", ""))
            continue
        left, right = line.split("|", 1)
        filename = left.strip()
        title = right.strip()
        rows.append((line, filename, title))
    return rows


def write_titles_file(path: Path, rows: list[tuple[str, str, str]], dry_run: bool) -> None:
    out_lines: list[str] = []
    for raw, filename, title in rows:
        if not filename:
            out_lines.append(raw)
        else:
            out_lines.append(f"{filename} | {title}")
    content = "\n".join(out_lines) + "\n"
    if dry_run:
        return
    path.write_text(content, encoding="utf-8")


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
    ap.add_argument("--dry-run", action="store_true", help="Nur anzeigen, nichts schreiben.")
    args = ap.parse_args(argv)

    collection = args.collection or read_active_collection()
    input_path = Path(args.input) if args.input else Path("assets/gallery") / collection / "titles_global.txt"
    global_map = parse_global_titles(input_path)

    original_root = Path("assets/gallery") / collection / "original"
    title_files = sorted(original_root.rglob("_titles.txt"), key=lambda p: p.as_posix())
    if not title_files:
        print(f"Keine _titles.txt Dateien gefunden unter {original_root}", file=sys.stderr)
        return 1

    changed_files = 0
    changed_titles = 0

    for tf in title_files:
        rows = parse_titles_file(tf)
        updated = False
        new_rows: list[tuple[str, str, str]] = []
        for raw, filename, title in rows:
            if not filename:
                new_rows.append((raw, "", ""))
                continue

            # We expect current titles to be global numbers (strings).
            try:
                n = int(title)
            except ValueError:
                new_rows.append((raw, filename, title))
                continue

            new_title = global_map.get(n, "").strip()
            if not new_title:
                # Keep the number if empty/missing.
                new_rows.append((raw, filename, str(n)))
                continue

            if new_title != title:
                updated = True
                changed_titles += 1
            new_rows.append((raw, filename, new_title))

        if updated:
            changed_files += 1
            write_titles_file(tf, new_rows, dry_run=bool(args.dry_run))
        else:
            if not args.dry_run:
                # Still normalize (ensures file ends with newline etc.)? Not needed.
                pass

    if args.dry_run:
        print(f"Dry-run: würde {changed_titles} Titel in {changed_files} Dateien ändern.")
    else:
        print(f"OK: {changed_titles} Titel geändert in {changed_files} Dateien.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
