# Bilder verarbeiten (assets/gallery/<YYYY_MM_DD>/original → assets/gallery/<YYYY_MM_DD>/processed)

Browser unterstützen **HEIC/HEIF** nicht zuverlässig. Für die Website ist daher **JPG** (oder WebP/AVIF) am einfachsten.

Dieses Repo enthält ein Script, das aus `assets/gallery/<YYYY_MM_DD>/original/` eine Website-fertige Struktur unter `assets/gallery/<YYYY_MM_DD>/processed/` baut:

- Bilder werden als `001.jpg`, `002.jpg`, … gespeichert
- Sets/Caption-Gruppen bleiben zusammen
- Bilder werden verkleinert und komprimiert

Welche Collection aktiv ist, steht in `assets/gallery/_active_collection.txt`.

## Voraussetzungen

Du brauchst einen Konverter auf deinem Rechner.

Empfohlen (funktioniert auch für gemischte Formate): **ImageMagick**.

- macOS (Homebrew): `brew install imagemagick`
- Debian/Ubuntu: `sudo apt install imagemagick`

Wenn du hauptsächlich **HEIC/HEIF** hast, reicht oft auch:

- Debian/Ubuntu: `sudo apt install libheif-examples` (liefert `heif-convert`)

### Wenn ImageMagick „time limit exceeded“ meldet

Manche ImageMagick-Setups haben strenge Sicherheits-/Ressourcenlimits für HEIC/HEIF.
In dem Fall installiere `heif-convert` (siehe oben) – das Script nutzt es automatisch als Fallback für HEIC/HEIF.

## Nutzung

Im Projekt-Ordner:

```bash
python3 scripts/build_gallery_processed.py
```

Optional:

- Trockenlauf: `python3 scripts/build_gallery_processed.py --dry-run`
- Qualität: `python3 scripts/build_gallery_processed.py --quality 85`
- Max. Kante: `python3 scripts/build_gallery_processed.py --max-edge 1600`
- Andere Collection: `python3 scripts/build_gallery_processed.py --collection 2026_01_28`

## Wichtiger Hinweis zur Galerie

Die Galerie lädt den generierten Index aus:

`assets/gallery/<YYYY_MM_DD>/processed/index.json`
