#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
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

CATEGORY_META = {
    "leucht": {
        "title": "Leuchtkunst",
        "order": 10,
        "subtitle": "Fluoreszente Acrylglas-Scheiben mit Punktmuster und Leuchtfarbe",
    },
    "objekt": {
        "title": "Objektkunst",
        "order": 20,
        "subtitle": "Eigenartige Formen, Materialspiel und überraschende Perspektiven",
    },
    "wohnen": {
        "title": "Wohnen & Deko",
        "order": 30,
        "subtitle": "Handgemachte Stücke für Zuhause – von Kerzen bis Ornamenten",
    },
    "kueche": {
        "title": "Küche & Genuss",
        "order": 40,
        "subtitle": "Praktisch, stilvoll und ein Gesprächsstarter am Tisch",
    },
    "sonstiges": {
        "title": "Sonstiges",
        "order": 50,
        "subtitle": "Alles, was nicht in die anderen Kategorien passt",
    },
}


@dataclass(frozen=True)
class Converter:
    kind: str
    argv_prefix: list[str]


def read_active_collection() -> str:
    try:
        value = ACTIVE_COLLECTION_FILE.read_text(encoding="utf-8").strip()
        return value or DEFAULT_COLLECTION
    except OSError:
        return DEFAULT_COLLECTION


def stable_sort_key(path: Path) -> tuple[str, str]:
    name = path.name
    return (name.lower(), name)


def humanize_slug(value: str) -> str:
    value = value.strip().replace("-", " ").replace("_", " ")
    value = re.sub(r"\s+", " ", value).strip()
    if not value:
        return ""

    def restore_umlauts(word: str) -> str:
        return (
            word.replace("ae", "ä")
            .replace("oe", "ö")
            .replace("ue", "ü")
            .replace("Ae", "Ä")
            .replace("Oe", "Ö")
            .replace("Ue", "Ü")
        )

    stopwords = {
        "und",
        "oder",
        "im",
        "in",
        "am",
        "an",
        "auf",
        "zu",
        "zum",
        "zur",
        "ins",
        "von",
        "mit",
        "ohne",
        "für",
        "das",
        "der",
        "die",
        "den",
        "des",
        "ein",
        "eine",
        "einem",
        "einen",
        "einer",
        "nicht",
        "als",
        "bei",
        "sowie",
    }

    words = [restore_umlauts(w) for w in value.split(" ")]
    out: list[str] = []
    for i, w in enumerate(words):
        lw = w.lower()
        if i != 0 and lw in stopwords:
            out.append(lw)
            continue
        out.append(w[:1].upper() + w[1:])
    return " ".join(out)


def is_supported_image(path: Path) -> bool:
    if not path.is_file():
        return False
    if path.name.startswith("."):
        return False
    if path.name.endswith(IGNORED_SUFFIX):
        return False
    return path.suffix.lower() in SUPPORTED_IMAGE_EXTS


def which_any(names: list[str]) -> str | None:
    for name in names:
        p = shutil.which(name)
        if p:
            return p
    return None


def detect_converter() -> Converter | None:
    # ImageMagick ist am flexibelsten (liest HEIC/PNG/JPG/... sofern unterstützt).
    magick = which_any(["magick"])
    if magick:
        return Converter(kind="imagemagick7", argv_prefix=[magick])
    convert = which_any(["convert"])
    if convert:
        return Converter(kind="imagemagick6", argv_prefix=[convert])

    ffmpeg = which_any(["ffmpeg"])
    if ffmpeg:
        return Converter(kind="ffmpeg", argv_prefix=[ffmpeg])

    # Spezialfall: nur HEIC/HEIF → JPG (kein Resize).
    heif_convert = which_any(["heif-convert"])
    if heif_convert:
        return Converter(kind="heif-convert", argv_prefix=[heif_convert])

    return None


def run(argv: list[str]) -> None:
    subprocess.run(argv, check=True)


def convert_to_jpg(
    converter: Converter,
    input_path: Path,
    output_path: Path,
    *,
    max_edge: int,
    quality: int,
    overwrite: bool,
    dry_run: bool,
    auto_orient: bool = True,
) -> None:
    if output_path.exists() and not overwrite:
        return

    output_path.parent.mkdir(parents=True, exist_ok=True)

    if converter.kind in {"imagemagick7", "imagemagick6"}:
        # -auto-orient: anhand EXIF drehen
        # -strip: Metadaten entfernen
        # -resize: nur verkleinern (nie vergrößern) -> ">"
        auto_orient_args = ["-auto-orient"] if auto_orient else []
        argv = [
            *converter.argv_prefix,
            str(input_path),
            *auto_orient_args,
            "-strip",
            "-colorspace",
            "sRGB",
            "-resize",
            f"{max_edge}x{max_edge}>",
            "-interlace",
            "Plane",
            "-quality",
            str(quality),
            str(output_path),
        ]
    elif converter.kind == "ffmpeg":
        # qscale: kleinere Zahl = bessere Qualität (2..31).
        qscale = max(2, min(31, int(round((100 - quality) / 3)) + 2))
        vf = f"scale='min({max_edge},iw)':'min({max_edge},ih)':force_original_aspect_ratio=decrease"
        argv = [
            *converter.argv_prefix,
            "-y" if overwrite else "-n",
            "-i",
            str(input_path),
            "-vf",
            vf,
            "-q:v",
            str(qscale),
            str(output_path),
        ]
    elif converter.kind == "heif-convert":
        if input_path.suffix.lower() not in {".heic", ".heif"}:
            raise RuntimeError("heif-convert unterstützt nur HEIC/HEIF Eingaben.")
        # heif-convert kann nicht resizen; dafür bräuchtest du danach noch ein zweites Tool.
        argv = [
            *converter.argv_prefix,
            "-q",
            str(quality),
            str(input_path),
            str(output_path),
        ]
    else:
        raise RuntimeError(f"Unbekannter Converter: {converter.kind}")

    if dry_run:
        print("DRY-RUN:", " ".join(argv))
        return
    run(argv)


def has_tool(name: str) -> bool:
    return which_any([name]) is not None


def convert_heic_with_fallback(
    converter: Converter,
    input_path: Path,
    output_path: Path,
    *,
    max_edge: int,
    quality: int,
    overwrite: bool,
    dry_run: bool,
) -> None:
    """
    ImageMagick kann bei HEIC/HEIF auf manchen Systemen in Policy-Limits laufen.
    Wenn `heif-convert` vorhanden ist, decodieren wir zuerst damit nach JPEG und
    resizen/komprimieren anschließend (wenn möglich) mit ImageMagick/ffmpeg.
    """
    suffix = input_path.suffix.lower()
    if output_path.exists() and not overwrite:
        return
    if suffix not in {".heic", ".heif"}:
        convert_to_jpg(
            converter,
            input_path,
            output_path,
            max_edge=max_edge,
            quality=quality,
            overwrite=overwrite,
            dry_run=dry_run,
        )
        return

    heif_convert_path = which_any(["heif-convert"])
    if not heif_convert_path:
        convert_to_jpg(
            converter,
            input_path,
            output_path,
            max_edge=max_edge,
            quality=quality,
            overwrite=overwrite,
            dry_run=dry_run,
        )
        return

    tmp = output_path.with_name(output_path.stem + ".tmp.jpg")
    if dry_run:
        print("DRY-RUN:", f"{heif_convert_path} -q {quality} {input_path} {tmp}")
    else:
        tmp.parent.mkdir(parents=True, exist_ok=True)
        run([heif_convert_path, "-q", str(quality), str(input_path), str(tmp)])

    # Wenn unser Haupt-Converter ImageMagick/ffmpeg ist: resizen finalisieren.
    if converter.kind in {"imagemagick7", "imagemagick6", "ffmpeg"}:
        try:
            convert_to_jpg(
                converter,
                tmp,
                output_path,
                max_edge=max_edge,
                quality=quality,
                overwrite=True,
                dry_run=dry_run,
                # heif-convert liefert bereits "richtig" orientierte Pixel; ein zweites auto-orient kann sonst 90° verdrehen.
                auto_orient=False,
            )
        finally:
            if not dry_run:
                try:
                    tmp.unlink(missing_ok=True)
                except OSError:
                    pass
        return

    # Nur heif-convert verfügbar: keine Resize-Möglichkeit.
    if not dry_run:
        if output_path.exists() and not overwrite:
            try:
                tmp.unlink(missing_ok=True)
            except OSError:
                pass
            return
        tmp.replace(output_path)


def read_text_safe(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        return ""


def write_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


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


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Baut aus assets/gallery/<collection>/original eine Website-fertige Struktur unter processed/.\n"
            "Es werden Sets angelegt (set-01, set-02, ...) und Bilder als 001.jpg, 002.jpg, ... gespeichert."
        )
    )
    parser.add_argument(
        "--collection",
        default=read_active_collection(),
        help="Collection-Ordner, z.B. 2026_01_28 (Default: aus _active_collection.txt).",
    )
    parser.add_argument(
        "--clean",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Löscht assets/gallery/<collection>/processed vor dem Generieren (Default: true).",
    )
    parser.add_argument(
        "--quality",
        type=int,
        default=85,
        help="JPEG-Qualität 1..100 (Default: 85).",
    )
    parser.add_argument(
        "--max-edge",
        type=int,
        default=1600,
        help="Maximale Kantenlänge in Pixeln (Default: 1600).",
    )
    parser.add_argument(
        "--hold",
        type=int,
        default=4,
        help="Default 'hold' pro Set (wie viele Bildwechsel, bevor Set gewechselt wird).",
    )
    parser.add_argument(
        "--overwrite",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Bestehende JPGs überschreiben (Default: true).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Nur anzeigen, was getan würde.",
    )
    parser.add_argument(
        "--continue-on-error",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Bei Konvertierungsfehlern fortfahren (Default: true).",
    )
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    collection = str(args.collection).strip()
    if not collection:
        print("Fehler: --collection ist leer.", file=sys.stderr)
        return 2

    quality = int(args.quality)
    if quality < 1 or quality > 100:
        print("Fehler: --quality muss zwischen 1 und 100 liegen.", file=sys.stderr)
        return 2

    max_edge = int(args.max_edge)
    if max_edge < 200:
        print("Fehler: --max-edge ist zu klein.", file=sys.stderr)
        return 2

    base = Path("assets/gallery") / collection
    src_root = base / "original"
    dst_root = base / "processed"

    if not src_root.exists():
        print(f"Fehler: Quell-Ordner nicht gefunden: {src_root}", file=sys.stderr)
        return 2

    if args.clean and dst_root.exists():
        shutil.rmtree(dst_root)

    converter = detect_converter()
    if not converter and not args.dry_run:
        print(
            "Kein Konverter gefunden.\n\n"
            "Empfohlen (Ubuntu/Debian): sudo apt install imagemagick\n"
            "Alternativ (nur HEIC/HEIF): sudo apt install libheif-examples\n",
            file=sys.stderr,
        )
        return 3

    categories = [p for p in src_root.iterdir() if p.is_dir() and not p.name.startswith(".")]
    categories.sort(key=stable_sort_key)

    manifest_categories: list[dict] = []
    total_images = 0
    total_sets = 0
    total_classes = 0
    skipped_non_images = 0
    failures: list[str] = []

    for category_dir in categories:
        cat_meta = CATEGORY_META.get(category_dir.name, {})
        category_entry = {
            "id": category_dir.name,
            "title": cat_meta.get("title", humanize_slug(category_dir.name)),
            "subtitle": cat_meta.get("subtitle", ""),
            "order": int(cat_meta.get("order", 1000)),
            "classes": [],
        }

        class_dirs = [p for p in category_dir.iterdir() if p.is_dir() and not p.name.startswith(".")]
        class_dirs.sort(key=stable_sort_key)

        for idx_class, class_dir in enumerate(class_dirs, start=1):
            class_meta_path = class_dir / "_class.json"
            class_meta: dict | None = None
            if class_meta_path.is_file():
                try:
                    class_meta = json.loads(class_meta_path.read_text(encoding="utf-8"))
                except json.JSONDecodeError:
                    print(f"Warnung: Ungültiges JSON: {class_meta_path}", file=sys.stderr)

            class_entry = {
                "id": class_dir.name,
                "title": (class_meta or {}).get("title", humanize_slug(class_dir.name)),
                "subtitle": (class_meta or {}).get("subtitle", ""),
                "order": int((class_meta or {}).get("order", idx_class * 10)),
                "sets": [],
            }

            class_out_dir = dst_root / category_dir.name / class_dir.name
            write_json(
                class_out_dir / "_class.json",
                {
                    "title": class_entry["title"],
                    "subtitle": class_entry["subtitle"],
                    "order": class_entry["order"],
                    "source_dir": str(class_dir.as_posix()),
                },
            )

            group_dirs = [p for p in class_dir.iterdir() if p.is_dir() and not p.name.startswith(".")]
            group_dirs.sort(key=stable_sort_key)

            set_index = 0
            for group_dir in group_dirs:
                images = [p for p in group_dir.iterdir() if is_supported_image(p)]
                images = parse_order_file(group_dir, images)
                if not images:
                    # z.B. videos/ Ordner: zählen wir als "skipped non-images" (für Hinweis)
                    non_image_files = [
                        p
                        for p in group_dir.iterdir()
                        if p.is_file()
                        and not p.name.startswith(".")
                        and not p.name.endswith(IGNORED_SUFFIX)
                        and p.suffix.lower() not in SUPPORTED_IMAGE_EXTS
                    ]
                    skipped_non_images += len(non_image_files)
                    continue

                set_index += 1
                total_sets += 1

                caption = humanize_slug(group_dir.name)
                caption_txt = group_dir / "_caption.txt"
                if caption_txt.is_file():
                    override = read_text_safe(caption_txt).strip()
                    if override:
                        caption = override

                hold = int(args.hold)
                set_meta_path = group_dir / "_set.json"
                if set_meta_path.is_file():
                    try:
                        set_meta = json.loads(set_meta_path.read_text(encoding="utf-8"))
                        if isinstance(set_meta, dict):
                            if set_meta.get("caption"):
                                caption = str(set_meta["caption"])
                            if set_meta.get("hold") is not None:
                                hold = int(set_meta["hold"])
                    except json.JSONDecodeError:
                        print(f"Warnung: Ungültiges JSON: {set_meta_path}", file=sys.stderr)

                set_dir_rel = Path(category_dir.name) / class_dir.name / f"set-{set_index:02d}"
                set_out_dir = dst_root / set_dir_rel
                base_url = f"assets/gallery/{collection}/processed/{set_dir_rel.as_posix()}"

                jpg_urls: list[str] = []
                sources: list[str] = [str(p.as_posix()) for p in images]
                for idx_img, src in enumerate(images, start=1):
                    out_name = f"{idx_img:03d}.jpg"
                    out_path = set_out_dir / out_name
                    url = f"{base_url}/{out_name}"
                    jpg_urls.append(url)

                    if converter:
                        try:
                            convert_heic_with_fallback(
                                converter,
                                src,
                                out_path,
                                max_edge=max_edge,
                                quality=quality,
                                overwrite=bool(args.overwrite),
                                dry_run=bool(args.dry_run),
                            )
                        except (subprocess.CalledProcessError, RuntimeError) as exc:
                            msg = f"{src} -> {out_path} ({exc})"
                            failures.append(msg)
                            print(f"Fehler beim Konvertieren: {msg}", file=sys.stderr)
                            if not args.continue_on_error:
                                return 1

                total_images += len(images)
                class_entry["sets"].append(
                    {
                        "caption": caption,
                        "hold": hold,
                        "base": base_url,
                        "images": jpg_urls,
                    }
                )

                write_json(
                    set_out_dir / "_set.json",
                    {
                        "caption": caption,
                        "hold": hold,
                        "sources": sources,
                        "base": base_url,
                    },
                )

            if class_entry["sets"]:
                total_classes += 1
                category_entry["classes"].append(class_entry)

        if category_entry["classes"]:
            category_entry["classes"].sort(
                key=lambda c: (int(c.get("order", 1000)), str(c.get("title", "")))
            )
            manifest_categories.append(category_entry)

    manifest_categories.sort(key=lambda c: (int(c.get("order", 1000)), str(c.get("title", ""))))

    write_json(
        dst_root / "index.json",
        {
            "collection": collection,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "categories": manifest_categories,
            "stats": {
                "classes": total_classes,
                "sets": total_sets,
                "images": total_images,
                "skipped_non_images": skipped_non_images,
                "failures": len(failures),
            },
        },
    )

    if failures:
        print(
            f"Fertig mit Fehlern: {len(failures)} Dateien konnten nicht konvertiert werden.",
            file=sys.stderr,
        )
        for line in failures[:20]:
            print(f"- {line}", file=sys.stderr)
        if len(failures) > 20:
            print(f"... ({len(failures) - 20} weitere)", file=sys.stderr)

    print(
        f"Fertig: classes={total_classes}, sets={total_sets}, images={total_images}, "
        f"skipped_non_images={skipped_non_images}, converter={converter.kind if converter else 'keiner'}"
    )
    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
