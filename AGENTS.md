# OnkelWebsite – Projektregeln (Deutsch-only)

Ziel: Eine einfache, moderne, statische Website (ohne Build-Tools) für meinen Onkel, um seine handgemachten Kunst- & Handwerksarbeiten zu präsentieren.

Brand/Name: **Onkel's Kunsthandwerk**

## Seiten
- `index.html` (Startseite): Kurzvorstellung + Call-to-Action zur Galerie und Kontakt.
- `gallerie.html` (Galerie): Werke nach Kategorien/„Features“ mit automatisch wechselnden Bildansichten (Slider).
- `kontakt.html` (Kontakt): Kontaktmöglichkeiten (Text, optional Formular/`mailto:`).

## Kontakt (Empfohlen)
- Ein statisches Formular kann E‑Mails nicht “direkt” versenden; dafür braucht es ein Backend.
- Empfohlener Weg: Google Apps Script Web‑App + Google Sheet (Backup) + Mailversand.
- Setup-Doku: `docs/kontakt-google-apps-script.md`

## Sprache & Ton
- **Alle sichtbaren Texte sind auf Deutsch.**
- Kurz, freundlich, handwerklich/kunstbezogen.

## Galerie (aktuell)
Die Galerie ist in Kategorien organisiert:
1) **Leuchtkunst**
2) **Objektkunst**
3) **Wohnen & Deko**
4) **Küche & Genuss**
5) **Sonstiges**

## Bilder ablegen (ohne Code ändern)
Lege Bilder unter einer datierten Collection ab (aktive Collection steht in `assets/gallery/_active_collection.txt`):

- Quelle (Originale): `assets/gallery/<YYYY_MM_DD>/original/<kategorie>/<produktklasse>/<beschreibung>/...`
  - Beispiel: `assets/gallery/2026_01_28/original/leucht/leuchtuhren/leuchtet_im_dunkeln/IMG_1234.HEIC`
- Ausgabe für die Website: `assets/gallery/<YYYY_MM_DD>/processed/...` (Sets + `001.jpg`, `002.jpg`, …)
- Index für die Website: `assets/gallery/<YYYY_MM_DD>/processed/index.json`

Workflow:
1) Bilder nach `original/` kopieren
2) `python3 scripts/build_gallery_processed.py`

## Technik
- Keine Frameworks, nur HTML/CSS/JS.
- Wiederverwendbare Styles in `assets/css/styles.css`.
- Galerie-Logik in `assets/js/gallerie.js`.
