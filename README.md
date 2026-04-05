# Music Uploader

Lokale Desktop-App zum:

- Auswaehlen eines Ordners mit WAV-Dateien
- automatischen Generieren von Track-Titeln
- Anhaengen eines SEO-Suffixes je Musikrichtung
- Vorschau und Umbenennen der Dateien
- Vorbereiten eines DistroKid-Uploads

## Status

Erster lauffaehiger Grundstand:

- Ordnerauswahl
- WAV-Scan
- automatische Titelvorschlaege
- SEO-Profile
- Rename-Preview
- echtes Umbenennen auf Dateisystem
- Upload-Profil fuer DistroKid
- Export einer Upload-Manifestdatei
- Playwright-Grundlage fuer den Upload-Flow
- profilbasierte Album- und Tracktitel
- Titelgrenzen fuer stabile Dateinamen und sauberere Store-Metadaten

## Start

```bash
npm install
npm start
```

## Tests

```bash
npm test
npm run test:smoke
npm run lint
```

`npm run test:smoke` startet die echte Electron-App in einem versteckten Fenster und prueft den initialen Renderer-Flow.

## DistroKid

Stand 2026-04-04: Es wird aktuell von dieser App keine offizielle DistroKid-API verwendet. Der Upload wird deshalb als Browser-Automation vorbereitet.

Aktuell abgebildete Upload-Regeln:

- Track 1 nimmt den Titel aus der ersten WAV-Datei, Track 2 aus der zweiten usw.
- Jeder Track wird als instrumental behandelt
- Apple-Music-Credits werden fuer jeden Song vorbereitet
- Rolle `Synthesizer`: `Björn Richter`
- Rolle `Co-executive Producer`: `Björn Richter`
- Extras duerfen nicht aktiviert werden
- Gesamtbetrag muss `0,00 EUR` bleiben

## Profile

Die App enthaelt mehrere Musikprofile inklusive SEO-Text, Albumtitel-Bausteinen und Tracktitel-Bausteinen.

Neu enthalten:

- `432Hz Solfeggio Healing`
- `Neural Biohacking / Deep Work`

## Titelgrenzen

- Tracktitel werden auf `80` Zeichen begrenzt
- Albumtitel werden auf `90` Zeichen begrenzt
- Dateinamen enthalten nur noch Tracknummer und Tracktitel
- SEO-Texte bleiben in der App und im Manifest, nicht im Dateinamen

## Upload-Manifest

Die App kann ein JSON-Manifest erzeugen, das die komplette Reihenfolge und die DistroKid-Regeln enthaelt. Dieses Manifest wird unter `upload-manifest.json` im gewaehlten Musikordner gespeichert.

## Browser-Automation

Die Playwright-Schicht ist als erster technischer Stand enthalten. Vor echtem Vollbetrieb muessen die finalen Selektoren gegen den Live-Upload-Flow validiert werden, weil DistroKid Form-Aufbau und Texte aendern kann.

Der DistroKid-Runner startet Google Chrome sichtbar mit einem persistenten Profilordner unter `.codex-temp/distrokid-chrome-profile`. Damit kannst du dich im Browser manuell einloggen, zum Upload-Formular gehen und erst dann im Terminal mit `Enter` die Automation starten.

```bash
npm run distrokid:run -- "D:\pfad\zu\upload-manifest.json"
```

Optional kannst du einen eigenen Chrome-Profilordner setzen:

```bash
$env:MUSIC_UPLOADER_CHROME_PROFILE_DIR="D:\chrome-profiles\distrokid"
npm run distrokid:run -- "D:\pfad\zu\upload-manifest.json"
```
