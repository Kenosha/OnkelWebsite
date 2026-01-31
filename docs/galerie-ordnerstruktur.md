# Galerie – Ordnerstruktur & Beschreibungen (Quelle)

Ziel: Du legst Bilder + Texte **einmal** in einer klaren Ordnerstruktur ab. Ein Script kann daraus später automatisiert:

- Bilder konvertieren (z.B. HEIC → JPG),
- nach Cloudflare (z.B. R2) hochladen,
- und ein Manifest für die Website erzeugen (Reihenfolge, Gruppen, Captions).

## Grundidee

Es gibt 5 Hauptkategorien (entsprechen den Sections auf der Galerie-Seite):

- `leucht` (Leuchtkunst)
- `objekt` (Objektkunst)
- `wohnen` (Wohnen & Deko)
- `kueche` (Küche & Genuss)
- `sonstiges` (Sonstiges)

Darunter gibt es beliebig viele **Produktklassen** (jeweils ein Unterordner).

Innerhalb einer Produktklasse legst du **Caption-Gruppen** als Unterordner an (z.B. `personalisierbar/`, `stilvoll/`).
Diese Gruppen sorgen später dafür, dass:

- Bilder „beisammen“ bleiben (Rotation nur innerhalb einer Gruppe),
- die Beschreibung/Captions **nicht** bei jedem Bildwechsel springt,
- neue Bilder robust dazukommen (einfach in die passende Gruppe legen).

## Struktur (Quelle: `original/`)

Alles liegt unter einer datierten „Collection“:

`assets/gallery/<YYYY_MM_DD>/original/`

Welche Collection die Website aktuell nutzt, steht in:

`assets/gallery/_active_collection.txt`

Empfohlene Struktur (so ist es am einfachsten zu pflegen):

```text
assets/gallery/2026_01_28/original/
  leucht/
    leuchtuhren/
      leuchtet_im_dunkeln/
        IMG_1234.HEIC
        IMG_1235.HEIC
      bunt/
        IMG_9999.JPG
    leuchtbilder/
      auf_anfrage_das_perfekte_persoenliche_geschenk/
        IMG_0001.HEIC

  objekt/
    ketten/
      modular/
        IMG_0002.JPG
      einzigartig/
        IMG_0003.HEIC
    unmoegliche_objekte/
      ...

  wohnen/
    kerzenhalter/
      personalisierbar/
        IMG_0004.HEIC
    windlichter/
      ...

  kueche/
    flaschenhalter/
      ...
    korken/
      ...
    gabeln/
      ...

  sonstiges/
    <produktklasse>/
      ...
```

### Captions aus Ordnernamen

- Der Name des Gruppen-Ordners ist die Caption (z.B. `leuchtet_im_dunkeln` → „Leuchtet im Dunkeln“).
- Optional: Wenn du die Caption exakt festlegen willst, lege in den Gruppen-Ordner eine `_caption.txt` (eine Zeile Text).

### Dateien, die du vermeiden solltest

Beim Kopieren aus Windows können Dateien wie `*:Zone.Identifier` mitkommen. Die braucht man nicht; unser Script ignoriert sie, aber am besten gar nicht erst mitkopieren.

## Struktur (Ausgabe: `processed/`)

Aus `original/` erzeugt ein Script eine „kongruente“ Struktur unter:

`assets/gallery/<YYYY_MM_DD>/processed/`

Diese enthält:

- `index.json` (wird von der Website geladen)
- `set-XX/001.jpg`, `002.jpg`, … (Website-fertige Bilder)
- optional `_class.json` und `_set.json` (für Debug/Metadaten)

Generieren:

```bash
python3 scripts/build_gallery_processed.py
```

## Reihenfolge

- Innerhalb einer Gruppe wird aktuell alphabetisch nach Dateinamen sortiert.
- Wenn du eine bestimmte Reihenfolge willst: Dateien entsprechend umbenennen (z.B. `001_...`, `002_...`).

## Produktklasse: `_class.json`

Optional: Wenn du in `original/<kategorie>/<produktklasse>/` eine `_class.json` anlegst, wird sie beim Generieren übernommen.
Beispiel-Pfad: `assets/gallery/2026_01_28/original/leucht/leuchtuhren/_class.json`.

Beispiel:

```json
{
  "title": "Leuchtuhren",
  "subtitle": "Fluoreszente Acrylglas-Scheiben mit Punktmuster und Leuchtfarbe",
  "order": 10
}
```

Hinweise:
- `title` und `subtitle` sind die Texte, die in der Galerie angezeigt werden.
- `order` steuert die Reihenfolge der Produktklassen innerhalb einer Hauptkategorie (kleiner = früher).

## Set/Gruppe: `_set.json`

Liegt in jedem Set-Ordner unter `processed/` (z.B. `.../processed/leucht/leuchtuhren/set-01/_set.json`).

Beispiel:

```json
{
  "caption": "Punktmuster im Acrylglas – besonders stark unter UV-Licht",
  "hold": 4
}
```

Hinweise:
- `caption` bleibt stabil, während innerhalb des Sets rotiert wird.
- `hold` bedeutet „wie viele Bildwechsel in diesem Set“, bevor zum nächsten Set gewechselt wird.
  - Beispiel: `hold: 4` → 4 Wechsel innerhalb `set-01`, dann erst `set-02`.

## Robustheit bei neuen Bildern

Wenn du neue Bilder hast:

- Wenn sie zur gleichen Beschreibung gehören: einfach in den passenden Gruppen-Ordner in `original/` legen.
- Wenn sie eine neue Beschreibung brauchen: neuen Gruppen-Ordner anlegen (z.B. `neu_und_spannend/` oder mit `_caption.txt`).

Dann `python3 scripts/build_gallery_processed.py` erneut ausführen.

## Namensregeln (wichtig für spätere URLs)

Damit die späteren Cloudflare-URLs sauber bleiben:

- Ordnernamen bitte als „slug“: nur `a-z`, `0-9`, `-` (Bindestrich), keine Umlaute, keine Leerzeichen.
  - Beispiele: `teelicht-karussell`, `unmoegliche-objekte`, `kettengebilde`
