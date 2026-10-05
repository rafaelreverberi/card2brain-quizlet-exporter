# Changelog

All notable changes to this project are documented here.

## [1.1.1] - 2026-10-05

### Fixed

- Export-Button erkennt den Kartei-Titel auch ohne das entfernte `itemprop`-Attribut.
- Eigene Button-Zeile auf Mobilgeräten und Fallback bei geänderter Toolbar.
- Exportdialog lässt sich auch ohne zugängliche Bootstrap-Instanz schliessen.
- Mehrfachklicks starten keine parallelen Exporte; AI-Logo-Beschriftungen gelangen nicht in den Kartentext.
- Karten-Endpunkte werden auf dieselbe Domain beschränkt.

### Verified

- Aktuelle öffentliche Verben-Kartei: 143 / 143 Karten im Browser geladen und als Quizlet-TXT heruntergeladen; erste, mittlere und letzte Karte geprüft.

## [1.1.0] - 2026-08-23

### Added

- Complete index-based export through Card2Brain's same-origin flip-card endpoint.
- Strict reported-versus-loaded count verification.
- Three-attempt request retry handling and fail-closed incomplete exports.
- Quizlet-ready clipboard and UTF-8 TXT output.
- Card2Brain-styled responsive UI and SPA navigation support.
- Public repository metadata and automatic userscript update URLs.
