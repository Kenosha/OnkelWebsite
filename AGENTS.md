# OnkelWebsite – Projektregeln (Deutsch-only)

Ziel: Eine einfache, moderne, statische Website (ohne Build-Tools) für meinen Onkel, um seine handgemachten Kunst- & Handwerksarbeiten zu präsentieren.

## Seiten
- `index.html` (Startseite): Kurzvorstellung + Call-to-Action zur Galerie und Kontakt.
- `gallerie.html` (Galerie): Werke nach Kategorien/„Features“ mit automatisch wechselnden Bildansichten (Slider).
- `kontakt.html` (Kontakt): Kontaktmöglichkeiten (Text, optional Formular/`mailto:`).

## Sprache & Ton
- **Alle sichtbaren Texte sind auf Deutsch.**
- Kurz, freundlich, handwerklich/kunstbezogen.

## Galerie (aktuell)
Die Galerie enthält zuerst zwei Abschnitte:
1) **Portrait-Uhren**
   - Zwei Bildansichten nebeneinander (Desktop), automatisch wechselnd:
     - Feature 1: „Personalisierbar“
     - Feature 2: „Leuchtfarben“
2) **Paradoxe Gebilde**
   - Drei Bildansichten (Desktop nebeneinander), automatisch wechselnd:
     - „Uhren“
     - „Kerzenhalter“
     - „Deko“

## Bilder ablegen (ohne Code ändern)
Die Slider laden Bilder aus `assets/gallery/...` über ein Namensschema:
- Dateinamen: `01` bis `12` (z.B. `01.jpg`, `02.webp`, …)
- Unterstützte Endungen (Priorität): `avif`, `webp`, `jpg`, `jpeg`, `png`, `svg`
- Du kannst die mitgelieferten Platzhalter beibehalten; echte Bilder mit gleicher Nummer werden automatisch bevorzugt.

Ordnerstruktur:
- `assets/gallery/portrait-uhren/personalisierbar/`
- `assets/gallery/portrait-uhren/leuchtfarben/`
- `assets/gallery/paradoxe-gebilde/uhren/`
- `assets/gallery/paradoxe-gebilde/kerzenhalter/`
- `assets/gallery/paradoxe-gebilde/deko/`

## Technik
- Keine Frameworks, nur HTML/CSS/JS.
- Wiederverwendbare Styles in `assets/css/styles.css`.
- Galerie-Logik in `assets/js/gallerie.js`.

