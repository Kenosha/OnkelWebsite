# Kontaktformular mit Google Apps Script (Onkel's Kunsthandwerk)

Diese Website ist statisch (Cloudflare). Damit ein Formular E-Mails verschicken kann, braucht es ein Backend. Hier nutzen wir **Google Apps Script**:

- Formular sendet `POST` an eine Apps Script Web-App (`.../exec`)
- Script:
  - schreibt in ein Google Sheet (Backup/Übersicht)
  - verschickt eine E-Mail an den Empfaenger

## Was du einmalig einrichten musst

1) Neues Google Sheet anlegen (z.B. Name: `onkel_sheet`)
   - Sheet-ID aus der URL kopieren (zwischen `/d/` und `/edit`)

2) Neues Apps Script Projekt anlegen
   - `script.google.com` → **Neues Projekt**
   - Inhalt von `Code.gs` durch den Code unten ersetzen

3) Als Web-App deployen
   - **Bereitstellen** → **Neue Bereitstellung** → Typ **Web-App**
   - “Ausführen als”: dein Account
   - “Zugriff”: **Jeder**
   - Web-App URL kopieren (endet auf `/exec`)

4) `kontakt.html` verbinden
   - In `kontakt.html` beim Formular die `action` auf die `/exec`-URL setzen:
     - `kontakt.html:66`

## Mail-Regeln (statt "Spam erzwingen")

Du kannst nicht zuverlässig “direkt in den Spam‑Ordner” zustellen. Sinnvoll ist:

- Im Postfach des Onkels eine Regel/Filter anlegen (z.B. “Betreff enthält `[MÖGLICHER SPAM]`”)
- Dann automatisch in einen Ordner verschieben, labeln oder markieren.

## Code.gs (Vorlage)

```js
// --- KONFIG ---
const BUSINESS_NAME = "Onkel's Kunsthandwerk";
const SHEET_ID = "1dds3YeDOPBPjA__SI1O4fF6KnVLS-yNqM6hhdTbXLo0";
const SHEET_NAME = "Anfragen";
const TO_EMAIL = "orlando@matteo-orlando.de";
const SUBJECT_TX = "Kunsthandwerk: Neue Anfrage";
const RETURN_URL = "http://localhost:8000/kontakt.html";
const EMAIL_SUSPECTED_SPAM = true; // trotzdem mailen, selbst wenn Honeypot triggert

function doPost(e) {
  const p = e && e.parameter ? e.parameter : {};
  const now = new Date();
  const submissionId = Utilities.getUuid(); // optional (nur im Sheet)
  const name = (p.name || "").trim();
  const email = (p.email || "").trim();
  const telefon = (p.telefon || "").trim();
  const betreff = (p.betreff || "").trim();
  const nachricht = (p.nachricht || "").trim();

  const honeypot = (p.hp || "").trim();
  const suspectedSpam = honeypot !== "";

  if (!name || !email || !nachricht) return _error("Bitte fuelle Name, E-Mail und Nachricht aus.");

  const ip = (e && e.headers && e.headers["X-Forwarded-For"])
    ? String(e.headers["X-Forwarded-For"]).split(",")[0].trim()
    : "";
  const ua = (e && e.headers && e.headers["User-Agent"]) ? e.headers["User-Agent"] : "";

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow([
      "Zeitstempel","SubmissionID","Name","E-Mail","Telefon","Betreff","Nachricht/Wunsch",
      "VerdachtSpam","IP","UserAgent","EmailSent","EmailError"
    ]);
  }

  // Erst loggen (Backup)
  try {
    sh.appendRow([
      now, submissionId, name, email, telefon, betreff, nachricht,
      suspectedSpam ? "Ja" : "Nein", ip, ua, "", ""
    ]);
  } catch (err) {
    return _error("Konnte deine Nachricht gerade nicht speichern. Bitte versuche es erneut.");
  }

  const lines = [];
  if (suspectedSpam) lines.push("VERDACHT: SPAM", "");
  lines.push(`Neue Anfrage von ${name}.`, "");
  if (betreff) lines.push(`Betreff: ${betreff}`, "");
  lines.push("Nachricht / Wunsch:", nachricht, "", "Kontaktinformation:", `Telefon: ${telefon}`, `E-Mail: ${email}`);
  const body = lines.join("\\n");

  let emailSent = "Nein";
  let emailError = "";

  try {
    if (!suspectedSpam || (suspectedSpam && EMAIL_SUSPECTED_SPAM)) {
      MailApp.sendEmail({
        to: TO_EMAIL,
        subject: `${suspectedSpam ? "[MOEGLICHER SPAM] " : ""}${SUBJECT_TX}${betreff ? ` - ${betreff}` : ""}`,
        replyTo: email || TO_EMAIL,
        name: `${BUSINESS_NAME} - Website`,
        body,
        htmlBody: body.replace(/\\n/g, "<br>")
      });
      emailSent = "Ja";
    } else {
      emailSent = "Uebersprungen (Spamverdacht)";
    }
  } catch (err) {
    emailError = String(err && err.message ? err.message : err);
  }

  try {
    const lastRow = sh.getLastRow();
    sh.getRange(lastRow, 11, 1, 2).setValues([[emailSent, emailError]]);
  } catch (_) {}

  return _ok("Danke! Deine Nachricht ist angekommen.");
}

function _ok(msg) {
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta http-equiv="refresh" content="2; url=${RETURN_URL}">
<title>Danke</title>
<style>
  html,body{margin:0;height:100%;background:#0b0f17;color:rgba(255,255,255,0.92);font-family:ui-sans-serif,system-ui}
  .w{display:flex;align-items:center;justify-content:center;height:100%}
  .c{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);padding:24px 28px;border-radius:16px;max-width:560px;text-align:center}
  a{color:rgba(255,255,255,0.68);text-decoration:underline}
</style></head><body><div class="w"><div class="c">
<h1 style="margin:0 0 8px;font-size:20px;">${msg}</h1>
<p>Du wirst gleich zurueckgeleitet. Falls nicht: <a href="${RETURN_URL}">zurueck</a>.</p>
</div></div></body></html>`;
  return HtmlService.createHtmlOutput(html);
}

function _error(msg) {
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Fehler</title></head>
<body style="background:#0b0f17;color:rgba(255,255,255,0.92);font-family:ui-sans-serif,system-ui">
<div style="max-width:680px;margin:64px auto;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);padding:24px 28px;border-radius:16px;">
<h1 style="margin:0 0 8px;font-size:20px;">${msg}</h1>
<p><a href="${RETURN_URL}" style="color:rgba(255,255,255,0.68);text-decoration:underline">Zurueck zum Kontakt</a></p>
</div></body></html>`;
  return HtmlService.createHtmlOutput(html);
}
```
