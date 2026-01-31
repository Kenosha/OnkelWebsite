# Galerie-Bilder

Die Website lädt Galerie-Bilder aus einer datierten „Collection“:

- Originale: `assets/gallery/<YYYY_MM_DD>/original/...`
- Ausgabe für die Website: `assets/gallery/<YYYY_MM_DD>/processed/...`
- Generierter Index für die Galerie: `assets/gallery/<YYYY_MM_DD>/processed/index.json`
- Aktive Collection: `assets/gallery/_active_collection.txt`

Damit du auch Formate wie **HEIC/HEIF** bequem nutzen kannst, gibt es eine kleine Pipeline:

1) Lege deine **Originale** in `assets/gallery/<YYYY_MM_DD>/original/...` ab (beliebige Ordnerstruktur).
2) Das Script `scripts/build_gallery_processed.py` erzeugt `processed/` (Sets + `001.jpg`, `002.jpg`, …) und den Index.
3) Die Website lädt `processed/index.json` und zeigt die Bilder aus `processed/` an.

## Struktur

Die Galerie wird aus `original/` automatisiert aufgebaut:

`assets/gallery/<YYYY_MM_DD>/original/<kategorie>/<produktklasse>/<beschreibung>/...`

Beispiel:

`assets/gallery/2026_01_28/original/leucht/leuchtuhren/leuchtet_im_dunkeln/IMG_1234.HEIC`

Danach:

- `python3 scripts/build_gallery_processed.py`
