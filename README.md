# Card2Brain → Quizlet Exporter

[![Validate userscript](https://github.com/rafaelreverberi/card2brain-quizlet-exporter/actions/workflows/validate.yml/badge.svg)](https://github.com/rafaelreverberi/card2brain-quizlet-exporter/actions/workflows/validate.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Ein Tampermonkey-Userscript, das **alle** textbasierten Lernkarten einer Card2Brain-Kartei im Quizlet-Importformat exportiert – nicht nur die gerade sichtbaren Karten.

## Installation

1. Installiere [Tampermonkey](https://www.tampermonkey.net/) in deinem Browser.
2. Klicke auf **[Userscript installieren](https://raw.githubusercontent.com/rafaelreverberi/card2brain-quizlet-exporter/main/card2brain-to-quizlet.user.js)**.
3. Bestätige die Installation in Tampermonkey.
4. Öffne eine Kartei auf `card2brain.ch` und klicke auf **Quizlet exportieren**.

Das Script bietet anschließend:

- **In Zwischenablage kopieren** für den direkten Quizlet-Import
- **TXT herunterladen** als UTF-8-Datei
- eine Vollständigkeitsprüfung wie `Gefunden: 143 / 143 Karten`

## Warum werden wirklich alle Karten geladen?

Card2Brain zeigt in seiner Listenansicht nur einen Teil einer Kartei. Der integrierte Flip-Viewer kann jedoch jede Kartenposition über einen internen, gleich-originigen Endpunkt laden. Das Script liest zuerst Card2Brains gemeldete Gesamtzahl und ruft dann jede Position von `0` bis `Gesamtzahl − 1` ab.

Bei jeder Antwort wird geprüft, ob Card2Brain exakt den angeforderten Index geliefert hat. Fehlgeschlagene Requests werden bis zu dreimal wiederholt; stimmt die Zahl danach nicht, wird **kein unvollständiger Export** erstellt. Absichtliche inhaltliche Duplikate bleiben erhalten, weil Karten nicht anhand ihres Textes dedupliziert werden.

## Getestet

| Kartei | Von Card2Brain gemeldet | Exportiert | Ergebnis |
| --- | ---: | ---: | --- |
| `20240711_verbes_lci1_18_5dWX` | 143 | 143 | PASS |
| `biologie_begriffe_aufbau_der_zelle` | 23 | 23 | PASS |

Bei der 143-Karten-Testkartei wurden zusätzlich geprüft:

- erste Karte: `être → sein`
- Karte 72: `répondre (à qn) → (jdm.) antworten`
- letzte Karte: `chanter → singen`

## Datenschutz und Sicherheit

- Alle Daten bleiben lokal im Browser.
- Es gibt keine Analytics, Tracker oder externen Server.
- Das Script liest keine Login-Daten.
- Requests gehen ausschließlich an die aktuell geöffnete Card2Brain-Domain.
- Bei öffentlichen Karteien funktioniert der Export ohne Anmeldung. Private Karteien funktionieren nur, wenn Card2Brain sie in der aktuellen Browsersitzung freigibt.
- Ein unvollständiger Export wird nicht stillschweigend angeboten.

## Einschränkungen

- Rein bild- oder audiobasierte Karten ohne Text können nicht sinnvoll nach Quizlet-TXT exportiert werden und führen zu einer klaren Fehlermeldung.
- Card2Brain kann interne Endpunkte zukünftig ändern. Bitte dann ein [Issue](https://github.com/rafaelreverberi/card2brain-quizlet-exporter/issues) mit der betroffenen Kartei erstellen.
- Das Projekt ist nicht mit Card2Brain oder Quizlet verbunden.

## Entwicklung

```bash
npm test
```

Der Test prüft JavaScript-Syntax, Userscript-Metadaten, minimale Berechtigungen und die sicherheitskritische Vollständigkeitslogik.

## Lizenz

[MIT](LICENSE) © Rafael Reverberi
