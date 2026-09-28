# 🎧 Vocab Beats – Englisch-Vokabeltrainer für Felix

Ein Vokabeltrainer im Stil von Duolingo, aber mit **den eigenen Vokabeln aus dem Schulbuch** – und mit
Tech-House-Beat: Jede richtige Antwort in Folge baut den Track weiter auf (Kick → Hi-Hats → Bass → Clap → **Drop**).
Ein Fehler lässt den Track kurz „absaufen“ und der Aufbau beginnt von vorn.
Es ist eine Web-App (PWA): Sie läuft in Safari und lässt sich auf dem iPhone wie eine normale App auf den
Home-Bildschirm legen. Danach funktioniert sie auch **ohne Internet**. Alle Daten bleiben auf dem Gerät.

## Funktionen

- **Lernen wie bei Duolingo**: kurze Lektionen („Tracks“) mit 10 Wörtern, Fortschrittsbalken, XP, Tagesziel,
  🔥-Serie (Tage in Folge), Konfetti 🎉
- **Tech-House-Beat** (124 BPM), live im Browser erzeugt – ohne Audiodateien. Lautstärke einstellbar, abschaltbar.
- **DJ-Ränge** von „Bedroom-DJ“ bis „DJ-Legende“ und **12 Trophäen** (Combos, Serien, gesammelte Wörter …)
- Club-Design in Neonfarben
- **Abwechslungsreiche Übungen**, die mit dem Können schwieriger werden:
  - Multiple Choice (Englisch → Deutsch und Deutsch → Englisch)
  - Hörverständnis: das Wort wird vorgelesen 🔊 (auch langsam 🐢)
  - Selbst eintippen (mit Toleranz für kleine Tippfehler, „to“ bei Verben und Artikel)
  - Paare finden
- **Wiederholung mit Karteikasten-System** (Leitner): Gewusste Wörter kommen nach 1, 2, 4, 7, 14 und 30 Tagen
  wieder, falsch beantwortete Wörter sofort noch einmal.
- **Vokabeln per Kamera erfassen** 📷: Vokabelliste fotografieren → Text wird erkannt (Tesseract-OCR) →
  prüfen, korrigieren und speichern. Englisch und Deutsch können auch getrennt fotografiert werden.
- Vokabeln von Hand eingeben, bearbeiten, nach Lektionen (Units) sortieren
- Aussprache britisch oder amerikanisch
- Sicherung exportieren/importieren (JSON), Import von Textlisten (`school = die Schule`)
- Hell- und Dunkelmodus

## Auf das iPhone bringen

Die App muss einmal über **https** erreichbar sein. Am einfachsten geht das kostenlos mit **GitHub Pages**:

1. Auf GitHub im Repository: **Settings → Pages**
2. Bei *Source* „Deploy from a branch“ wählen, den Branch (z. B. `main`) und den Ordner `/ (root)` einstellen,
   dann **Save**.
3. Nach 1–2 Minuten ist die App unter `https://<benutzername>.github.io/<repository>/` erreichbar.
4. Diese Adresse auf dem iPhone in **Safari** öffnen → **Teilen** ⬆︎ → **„Zum Home-Bildschirm“**.

> Hinweis: GitHub Pages ist für **öffentliche** Repositories kostenlos. Bei privaten Repositories braucht man
> GitHub Pro. Alternativ kann man den Ordner auch bei [Netlify Drop](https://app.netlify.com/drop) per
> Drag & Drop hochladen.

Die **Texterkennung** lädt beim ersten Foto einmalig Sprachdaten aus dem Internet (einige MB).
Danach klappt sie auch offline.

## Vokabeln aus dem Buch fotografieren (Lighthouse 1)

Die Erfassung ist auf das Layout von **English G Lighthouse 1 (Cornelsen)** abgestimmt:
Englisch mit Lautschrift | Deutsch | Beispielsatz. Die App erkennt die Spalten anhand der Wortpositionen,
wirft Lautschrift und Beispielsätze weg und hängt zweizeilige Übersetzungen richtig an.
Das funktioniert auch, wenn die Seite leicht schräg fotografiert ist.

1. **Erfassen** → Lektion eintragen (z. B. „Unit 2“) → **Foto machen**
2. Den **Rahmen um die Vokabelspalten ziehen**: ohne Bilder, ohne die Nachbarseite.
   Die Beispielsätze rechts dürfen mit drin sein.
3. **Text erkennen** → in der Vorschau prüfen, Fehler in den Textfeldern korrigieren,
   falsche Zeilen mit ✕ löschen → **Speichern**

Tipps: Buch flach hinlegen, gerade von oben und mit gutem Licht fotografieren. Pro Foto lieber eine halbe
Seite als eine ganze Doppelseite. Die Zahlenkästen (fifteen, sixteen …) werden nicht sauber erkannt,
diese Zeilen einfach löschen.

Die Texterkennung ist nicht perfekt: Umlaute oder einzelne Buchstaben sind manchmal falsch („far“ statt
„für“). Deshalb immer kurz über die Vorschau schauen. Alternativ geht die iPhone-Funktion
**„Text scannen“**: lange in ein Textfeld tippen → „Text scannen“.

Zum Ausprobieren ist ein Auszug aus **Lighthouse 1, Unit 1** schon als Beispiel-Lektion enthalten.

## Ton

Beat und Sprachausgabe sind nur zu hören, wenn der **Stummschalter** am iPhone aus ist. Der Beat wird
automatisch leiser, während ein Wort vorgelesen wird.

## Wichtig: Daten sichern

Die Vokabeln sind nur im Browser-Speicher des iPhones gespeichert. Wer die App löscht oder die
Safari-Websitedaten löscht, verliert sie. Deshalb ab und zu unter **Mehr → Sicherung exportieren** eine
Sicherung in der Dateien-App oder per AirDrop ablegen.

## Technik

Reines HTML/CSS/JavaScript ohne Build-Schritt:

| Datei | Inhalt |
|---|---|
| `index.html` | Grundgerüst |
| `js/app.js` | App-Logik (Ansichten, Lektionen, Speicherung, Kamera/OCR) |
| `js/answers.js` | Antwortprüfung und Zerlegen des erkannten Textes |
| `js/beat.js` | Beat-Engine (Web Audio) und Soundeffekte |
| `css/style.css` | Design |
| `sw.js` | Service Worker für den Offline-Betrieb |
| `manifest.webmanifest`, `icons/` | App-Name und -Icons für den Home-Bildschirm |

Lokal testen: `python3 -m http.server` im Ordner starten und `http://localhost:8000` öffnen.
Tests ausführen: `node --test tests/*.test.js`

Nach Änderungen an der App in `sw.js` die `VERSION` erhöhen, damit die installierte App das Update lädt.
