# ETF-Demonstrator

Ein Rechner, der zeigt, was von einem ETF-Sparplan am Ende wirklich übrig
bleibt: **nominal, nach Abgeltungsteuer, und in heutiger Kaufkraft**. Dazu ein
historischer Rückblick mit den echten Jahresrenditen des MSCI World seit 1970
und ein Vergleich gegen Gold und den S&P 500.

Gedacht als **Erklärwerkzeug für Gespräche** — die Art Rechner, den man jemandem
hinstellt und an den Reglern dreht, während man erklärt. Deshalb steht unter
jedem Diagramm der Rechenweg im Klartext, mit den gerade eingegebenen Zahlen.

> **Keine Anlageberatung, kein Finanzprodukt.** Eine nachvollziehbare Rechnung,
> deren Annahmen und Auslassungen offen dokumentiert sind.

Läuft als PWA: im Browser keine externen Abhängigkeiten, kein Server, keine
Datenspeicherung, nach der Installation vollständig offline.

**Voraussetzungen:** Die App selbst braucht nichts außer einem Browser. Der
lokale Server braucht Python 3.9+, der Selbsttest Node 18+.

## Die drei Ansichten

**Planung** — der klassische Sparplanrechner. Sparrate, erwartete Rendite,
Inflation und Laufzeit einstellen. Das Diagramm zeigt fünf Linien: eingezahltes
Kapital, Depotwert nominal, Depotwert nach Steuern, Depotwert in heutiger
Kaufkraft und, gestrichelt, die Einzahlungen in heutiger Kaufkraft. Der Abstand
der beiden letzten zeigt, was real übrig bleibt gegenüber Geld, das nur auf dem
Konto liegt.

**Rückblick** — dieselbe Rechnung, aber statt einer konstanten Wunschrendite die
**echten Jahresrenditen des MSCI World von 1970 bis 2025**. Das Startjahr ist
wählbar; eine gepunktete Linie zeigt zum Vergleich, was eine gleichmäßige
Rendite ergeben hätte. Dazu die erzielte Rendite pro Jahr groß über dem
Diagramm, der größte zwischenzeitliche Rückschlag und die Krisenjahre des
gewählten Zeitraums mit kurzer Einordnung.

Der Punkt dieser Ansicht: dieselbe Strategie, dieselbe Sparrate, ein anderes
Jahrzehnt — und ein völlig anderes Ergebnis. Wer 1980 anfing, sah 30 Jahre lang
etwas ganz anderes als wer 1990 anfing.

**Vergleich** — eine Einmalanlage über einen frei wählbaren historischen
Zeitraum (eigenes Startkapital, eigene Laufzeit, eigenes Startjahr, unabhängig
von den beiden Sparplan-Reitern), wahlweise in ETF (MSCI World), physisches Gold
und S&P 500, beliebig kombinierbar. Jede Anlageklasse mit ihrer eigenen
Besteuerung — was bei Gold einen spürbaren Unterschied macht.

## Ausprobieren

**Online:** Jeder Push auf `main` geht über GitHub Actions automatisch nach
GitHub Pages: <https://joniboni-91.github.io/ETF-Demonstrator/>. Dort lässt
sich die App auch direkt als PWA installieren, auf dem iPhone über Teilen →
„Zum Home-Bildschirm“.

**Lokal:** `index.html` im Browser öffnen. Alle drei Ansichten,
Diagramme und Erklärtexte funktionieren sofort.

**Mit Service Worker und Installierbarkeit** (dafür braucht es einen Server, weil
Service Worker über `file://` nicht laufen):

```
python3 rehost_etf.py
```

Startet einen lokalen Server auf `http://localhost:8449`, nur für diesen
Rechner erreichbar. Nutzt ausschließlich die Python-Standardbibliothek. Über
`localhost` erlauben Browser den Service Worker auch ohne HTTPS, die PWA ist
damit vollständig testbar.

Das Skript kann auch einfach durch `python3 -m http.server` ersetzt werden —
allerdings liefert das `.webmanifest` mit falschem MIME-Typ aus und setzt kein
`no-cache` auf den Service Worker, was beim Entwickeln zu hartnäckig veralteten
Ständen führt. Genau dafür gibt es das Skript.

<details>
<summary>Auf dem iPhone installieren</summary>

Dafür braucht es HTTPS, und dafür ein Zertifikat, dem das iPhone vertraut. Das
Skript hat dafür einen zweiten Modus (`--serve-ca`, `--renew-cert`), der eine
lokale Zertifizierungsstelle verwaltet — der funktioniert aber nur in dem
Workspace, in dem dieses Projekt entstanden ist, und ist auf macOS zugeschnitten
(WLAN-IP-Ermittlung über `ipconfig getifaddr en0`). In diesem Repo ist diese
Infrastruktur bewusst nicht enthalten.

Wer die App aufs Handy bringen will, nimmt am einfachsten die GitHub-Pages-Fassung
oben oder hostet sie selbst irgendwo mit HTTPS — es sind nur statische Dateien.
</details>

## Stimmt die Rechnung?

```
node tools/check_math.mjs
```

33 Prüfungen, die den **tatsächlich ausgelieferten** Rechenkern aus `app.js`
herausschneiden und gegen unabhängige Formeln rechnen: die geschlossene
Rentenformel, die Randfälle (Rendite 0 %, negative Rendite, Inflation 0 %), den
internen Zinsfuß, den größten Rückschlag und die Steuerkonsistenz über alle
Anlageklassen.

Dazu für jede historische Datenreihe eine Prüfsumme: das geometrische Mittel der
verbauten Jahreswerte 1970–2024 gegen einen Referenzwert. **Was die Prüfsummen
leisten und was nicht:** Sie fangen grobe Übertragungsfehler — ein verrutschtes
Vorzeichen, eine vertauschte Ziffer. Sie fangen *keine* kleinen Abweichungen:
Die Toleranz von 0,01 Prozentpunkten auf den 55-Jahres-Durchschnitt lässt einen
Fehler von bis zu etwa einem halben Prozentpunkt in einem einzelnen Jahr
durchgehen. Und der jeweils jüngste Wert (2025) liegt außerhalb des geprüften
Fensters, weil es dafür noch kein veröffentlichtes Langfristmittel gibt.

## Woher die Zahlen kommen

Alle Reihen liegen in `historical-data.js`, jeweils **aus Sicht eines deutschen
Anlegers in DM beziehungsweise Euro**.

| Reihe | Quelle |
|---|---|
| MSCI World 1970–2025 | Net Total Return in DM/Euro, Renditedreieck von Scalable Capital auf MSCI-Basis, 2025 ergänzt |
| Gold 1970–2025 | USD-Jahresdurchschnitte der National Mining Association (World Gold Council / Kitco / LBMA) |
| S&P 500 1970–2025 | Total Return mit reinvestierten Dividenden. Anders als die MSCI-Reihe (Net Total Return, nach ausländischer Quellensteuer) vermutlich brutto gerechnet, liegt dadurch rund 0,3 Prozentpunkte pro Jahr zu hoch |
| Inflation Deutschland 1970–2025 | Statistisches Bundesamt |
| Wechselkurse | Deutsche Bundesbank, „Lange Zeitreihen" — DM bis 1998, Euro ab 1999, Übergang über den Fixkurs 1,95583 |

Die Umrechnung der in Dollar notierten Reihen enthält damit bewusst auch den
**Wechselkurseffekt** — genau das, was beim deutschen Anleger ankommt. Deshalb
liegen die Euro-Renditen spürbar unter den Dollar-Renditen: Gold etwa bringt
1970–2024 in Dollar rund 7,7 % pro Jahr, in Euro nur rund 6,1 %. Die Differenz
ist die langfristige Dollar-Abwertung.

Die vollständige Herleitung steht in [`Docs/rechenmodell.md`](Docs/rechenmodell.md).

## Was die Rechnung bewusst weglässt

- **Sparerpauschbetrag** (1.000 € Kapitalerträge pro Jahr steuerfrei) und
  **Vorabpauschale** — die tatsächliche Steuer fällt also etwas niedriger aus
- **Kirchensteuer**
- **Kosten**: Fondskosten (TER), Depot- und Ordergebühren
- **Unterjährige Schwankungen** — der Rückblick verteilt jeden Jahreswert
  gleichmäßig auf zwölf Monate. Der Corona-Einbruch im März 2020 ist deshalb
  im Diagramm nicht zu sehen, weil 2020 am Ende mit +6,3 % schloss. Die echten
  Ausschläge waren heftiger als die Kurve zeigt.
- **Künftige Steueränderungen** — gerechnet wird durchgehend mit heutigem Recht,
  auch für Zeiträume, in denen anderes Recht galt

Diese Liste steht auch in der App selbst, direkt unter dem Erklärtext.

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | Seitengerüst und der komplette sichtbare Erklärtext |
| `app.js` | Rechenkern aller drei Ansichten, Canvas-Diagramm, Live-Erklärungen |
| `historical-data.js` | Die historischen Datenreihen und Krisentexte |
| `style.css` | Gestaltung, hell und dunkel |
| `pwa.js` | Einstellungsmenü, Installation, Update-Knopf |
| `service-worker.js` | Offline-Cache mit Versionierung |
| `manifest.webmanifest`, `icons/` | PWA-Hülle |
| `rehost_etf.py` | Lokaler Server zum Ausprobieren |
| `tools/check_math.mjs` | Selbsttest des Rechenkerns |
| `.github/workflows/` | CI (Selbsttest, Syntax) und Veröffentlichung auf GitHub Pages |
| `Docs/rechenmodell.md` | Rechenmodell, Datenherkunft, Vereinfachungen im Detail |
| `LICENSE` | GNU General Public License v3 |

## Lizenz

GNU General Public License v3, siehe [`LICENSE`](LICENSE). Nutzen, ändern und
weitergeben ist erlaubt; wer eine veränderte Fassung weitergibt, muss sie
ebenfalls unter der GPLv3 offenlegen.

---

Historische Wertentwicklung ist kein verlässlicher Indikator für künftige
Entwicklungen.
