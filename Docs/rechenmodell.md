# Rechenmodell und Datenherkunft

Stand: 2026-09-21

Dieses Dokument beschreibt vollständig, wie der ETF-Demonstrator rechnet, woher
die historischen Zahlen stammen und was die Rechnung bewusst auslässt. Es ist
die Belegstelle zum Code: jede Formel hier entspricht einer Stelle in `app.js`,
jede Datenreihe einer Konstante in `historical-data.js`.

## Zweck

Eine kleine, abhängigkeitsfreie PWA, mit der man anderen anschaulich erklären
kann, was langfristiges Anlegen bedeutet. Die App ist ein
Erklärwerkzeug, kein Finanzprodukt und keine Anlageberatung. Drei Reiter stellen
eine konstante ETF-Planung, einen echten historischen ETF-Verlauf und den
historischen Vergleich einer Einmalanlage in ETF, Gold und S&P 500 nebeneinander.

## Eingaben

- Planung und Rückblick: Sparrate in Euro pro Monat und eine gemeinsame
  Laufzeit in Jahren. Im Rückblick wird die Laufzeit auf die 56 verfügbaren
  Datenjahre (1970-2025) begrenzt, in der Planung sind bis zu 60 Jahre möglich.
- Planung: angenommene Rendite und Inflation in Prozent pro Jahr.
- Rückblick: konstante Vergleichsrendite sowie ein Startjahr zwischen 1970
  und dem spätesten für die Laufzeit
  möglichen Jahr. Solange das Startjahr nicht manuell verändert wurde, endet
  das Fenster automatisch 2025 (`Startjahr = 2025 - Laufzeit + 1`).
- Vergleich: eigenes Startkapital als einmaliger Euro-Betrag, eigene Laufzeit
  von 1 bis 56 Jahren und eigenes Startjahr mit derselben Synchronisierung auf
  2025 wie im Rückblick. ETF, Gold und S&P 500 sind unabhängig per Checkbox
  wählbar und beim ersten Öffnen alle drei aktiv.

Planung und Rückblick haben kein Startkapital. Der Vergleich hat keine
Sparrate und verwendet seine Eingaben unabhängig von den beiden Sparplan-Reitern.
Im Rückblick und Vergleich werden echte deutsche Jahresraten für die Inflation
verwendet.

## Ausgaben

- Kurvendiagramm über die Laufzeit mit vier Linien:
  1. eingezahltes Kapital (kumulierte Sparraten)
  2. Depotwert nominal
  3. Depotwert nach Steuern (bei Verkauf zum jeweiligen Zeitpunkt)
  4. Depotwert real; in der Planung in heutiger Kaufkraft, im Rückblick in
     Kaufkraft des gewählten Startjahres
- Balken am Laufzeitende mit der Aufteilung Einzahlung / Gewinn nach Steuern / Steuer
- Ergebniskacheln mit den Endwerten
- Rückblick zusätzlich: gross und farbcodiert über dem Diagramm die erzielte
  Rendite p.a. (rot unter 0 Prozent, orange bis 5 Prozent, grün darüber, für
  den direkten Vorher-Nachher-Vergleich beim Drehen an Startjahr und Laufzeit),
  dazu gepunktete Referenzlinie, dieselbe Rendite als Kachel mit Erklärtext,
  größter Rückschlag und eine gefilterte Krisenliste
- Vergleich: eine flache Linie für das einmal eingezahlte Startkapital und je
  aktiver Anlage eine Linie für den Wert nach Steuern. Pro Anlage erscheinen
  eigene Kacheln für Endwert nominal, Steuer, Endwert nach Steuern, reine
  Anlage-Rendite p.a. (CAGR) und Endwert in heutiger Kaufkraft. Bei leerer
  Checkbox-Auswahl bleiben Diagramm und Kacheln leer und fordern zur Auswahl
  mindestens einer Anlage auf.
- Erklärblock unter dem Diagramm mit dem Rechenweg anhand der aktuell
  eingegebenen Zahlen sowie der Liste der bewussten Vereinfachungen

## Rechenmodell Planung

- Einzahlung monatlich, jeweils zum Monatsanfang (vorschüssig).
- Monatszins geometrisch aus der Jahresrendite: `rm = (1 + r)^(1/12) - 1`.
- Fortschreibung: `V_neu = (V_alt + Sparrate) * (1 + rm)`.
- Eingezahlt nach m Monaten: `Sparrate * m`.
- Gewinn: `Depotwert - Eingezahlt`.
- Steuer auf den Gewinn beim Verkauf:
  `Gewinn * (1 - 0,30 Teilfreistellung) * (0,25 Abgeltungsteuer * 1,055 Soli)`
  = `Gewinn * 0,1846250`. Bei negativem Gewinn fällt keine Steuer an.
- Kaufkraft: `Wert / (1 + Inflation)^Jahre`.

## Rechenmodell Rückblick

- Der Zeitraum umfasst volle Kalenderjahre und muss vollständig in 1970-2025
  liegen.
- Einzahlung wie in der Planung monatlich und jeweils zum Monatsanfang.
- Für jedes Kalenderjahr wird der Monatszins geometrisch aus seiner echten
  MSCI-World-Jahresrendite gebildet:
  `rm = (1 + Jahresrendite)^(1/12) - 1`.
- Die echte deutsche Jahresinflation wird ebenso auf Monatsraten umgerechnet.
  Der reale Wert ist der Depotwert geteilt durch den bis dahin aufgelaufenen
  Inflationsfaktor und damit in Kaufkraft des gewählten Startjahres angegeben.
- Steuerberechnung unverändert mit dem einzigen effektiven Satz `0,1846250`.
- Die erzielte Rendite p.a. wird per Bisektion bestimmt. Gesucht wird der
  konstante Monatszins, bei dem derselbe vorschüssige Sparplan exakt den
  historischen Endwert erreicht; danach wird er auf eine Jahresrate
  hochgerechnet.
- Der größte Rückschlag ist der größte relative Abstand des Depotwerts von
  seinem bis dahin erreichten Höchststand.
- Die gepunktete Referenzlinie nutzt denselben Sparplan und die eingestellte
  konstante Vergleichsrendite.

## Rechenmodell Vergleich

- Das Startkapital wird genau einmal zu Beginn des Startjahres angelegt. Für
  jede aktive Anlage werden die Jahresfaktoren im gewählten Zeitraum
  multipliziert:
  `Faktor = Produkt(1 + Jahresrendite / 100)`.
- Nominaler Endwert: `Startkapital * Faktor`.
- Gewinn: `nominaler Endwert - Startkapital`.
- Die Steuerfunktion kommt aus dem Anlagen-Register. Der Endwert nach Steuern
  ist `nominaler Endwert - Steuer`.
- Die durchschnittliche Jahresrendite ist die reine Anlage-Performance vor
  Steuern: `CAGR = Faktor^(1 / Jahre) - 1`. Gleichwertig gilt
  `Endwert = Startkapital * (1 + CAGR)^Jahre`. Weil es nur einen
  Zahlungszeitpunkt gibt, wird die Rendite direkt über die Wurzel berechnet;
  anders als beim Sparplan ist keine IRR-Bisektion nötig.
- Der Kaufkraftwert ist der Endwert nach Steuern geteilt durch das Produkt der
  echten deutschen Inflationsfaktoren im selben Zeitraum. Er steht damit in
  Preisen des **Startjahres**, nicht in heutigen Preisen: bei Endjahr 1999
  fehlen also 26 Jahre Inflation bis heute.
- ETF, Gold und S&P 500 stehen in `ASSETS` mit Schlüssel, Label, Farbe, Renditereihe,
  Steuerfunktion und Erklärtext. Weitere Vergleichsanlagen benötigen nur einen
  zusätzlichen Registereintrag und ihre geprüfte Datenreihe.

### Steuermodell je Vergleichsanlage

- ETF (MSCI World): derselbe einzige effektive Satz wie in Planung und
  Rückblick. Ein positiver Gewinn wird nach 30 Prozent Teilfreistellung mit
  `TAX_EFFECTIVE = 0,184625` belastet; bei einem Verlust ist die Steuer null.
- Physisches Gold: Nach mehr als einem Jahr Haltefrist ist ein Gewinn nach
  § 23 EStG als privates Veräußerungsgeschäft steuerfrei. Die App hat eine
  Mindestlaufzeit von einem Jahr und behandelt Gold deshalb durchgehend als
  steuerfrei. Das ist eine bewusste Vereinfachung auf Basis des heutigen
  Steuerrechts.
- S&P 500: wie ETF (MSCI World) ein Aktienfonds mit über 51 Prozent
  Aktienanteil, derselbe effektive Satz `TAX_EFFECTIVE = 0,184625`.

## Historische Daten

- MSCI World Net Total Return in D-Mark/Euro, 1970-2024: Renditedreieck von
  Scalable Capital auf MSCI-Basis; Dividenden, ausländische Quellensteuer und
  Wechselkurse sind enthalten. Die Reihe wurde um den Wert für 2025 ergänzt.
- Deutsche Inflationsraten 1970-2025: Statistisches Bundesamt; für 2025 der
  gerundete Jahresdurchschnitt.
- Die MSCI-, Gold- und S&P-500-Reihe, Inflation und Krisenannotation stehen
  unverändert in `historical-data.js`.
- Das Diagramm verteilt jeden Jahreswert gleichmäßig auf seine zwölf Monate.
  Unterjährige Ausschläge sind daher nicht sichtbar. Das gilt insbesondere
  für den Corona-Einbruch im März 2020, obwohl das Gesamtjahr mit 6,3 Prozent
  im Plus endete.

### Herkunft und Berechnung der Gold-Reihe

- Goldpreis in US-Dollar je Feinunze, Jahresdurchschnitt: Quelle National Mining
  Association, "Historical Gold Prices - 1833 to Present"
  (1883-1994 World Gold Council/Timothy Green; 1995-2022 Kitco.com auf Basis
  London PM Fix; 2023-2024 LBMA.org, Monatspreise gemittelt). 2025 wurde aus
  dem LBMA-Jahresdurchschnitt bei metalcharts.org ergänzt (3.432 USD, als
  vollständiger Jahreswert bestätigt, nicht nur ein Zwischenstand).
- Wechselkurs 1969-1998: Deutsche Bundesbank, "Lange Zeitreihen zur
  Wirtschaftsentwicklung in Deutschland", Abschnitt X.1 "Devisenkurse für die
  Deutsche Mark", Jahresdurchschnitte (1 DM = ... US-Dollar).
- Wechselkurs 1999-2025: dieselbe Bundesbank-Publikation, Abschnitt X.2
  "Euro-Referenzkurse", Jahresdurchschnitte (1 Euro = ... US-Dollar).
- Goldpreis in DM beziehungsweise Euro = Goldpreis in USD geteilt durch den
  jeweiligen Jahresdurchschnittskurs (USD je DM beziehungsweise USD je Euro).
  Am Währungsübergang 1998/1999 wurde der DM-Wert 1998 mit dem fixen Kurs
  1 Euro = 1,95583 DM in ein Euro-Äquivalent umgerechnet, bevor die Rendite
  für 1999 daraus gebildet wurde. Dadurch entsteht kein künstlicher
  Währungsumstellungs-Sprung.
- Die Jahresrendite ist die prozentuale Veränderung dieses DM/Euro-Goldpreises
  von Jahresdurchschnitt zu Jahresdurchschnitt, also dieselbe Methodik wie bei
  der MSCI-Reihe.
- Gegenprobe: Das geometrische Mittel der tatsächlich verbauten, auf eine
  Nachkommastelle gerundeten Jahreswerte 1970-2024 (55 Jahre) beträgt 6,1496
  Prozent p.a. in DM/Euro (ungerundete Zwischenwerte ergeben 6,1548 Prozent;
  die Rundung auf eine Nachkommastelle je Jahr, passend zum Stil der
  MSCI-Reihe, verschiebt das über 55 Jahre zusammengesetzte Mittel geringfügig).
  In reinem US-Dollar ohne Währungseffekt wären es rund 7,66 Prozent p.a. Der
  Unterschied stammt aus der langfristigen Dollar-Abwertung gegenüber DM/Euro
  seit 1970 und ist ein plausibler, erwarteter Effekt, keine Fehlerquelle.

### Herkunft und Berechnung der S&P-500-Reihe

- S&P 500 Total Return (mit reinvestierten Dividenden) in US-Dollar,
  Jahreswerte: Quelle us500.com Jahrestabelle.
- Umrechnung in DM beziehungsweise Euro nach demselben Verfahren wie bei Gold:
  ein synthetischer US-Dollar-Indexstand (Basis 1969 = 100) wird mit den
  Jahresrenditen fortgeschrieben, dann mit denselben
  Bundesbank-Jahresdurchschnittskursen (DM bis 1998, Euro ab 1999, Übergang
  1998/1999 über den Fixkurs 1,95583 überbrückt) in DM/Euro umgerechnet und
  daraus wieder eine Jahresrendite gebildet.
- Gegenprobe: Das geometrische Mittel der tatsächlich verbauten, gerundeten
  Jahreswerte 1970-2024 (55 Jahre) beträgt 9,3974 Prozent p.a. in DM/Euro,
  gegenüber rund 10,95 Prozent p.a. in reinem US-Dollar ohne Währungseffekt -
  derselbe erwartete Abstand durch die langfristige Dollar-Abwertung wie bei
  Gold und MSCI World.

## Bewusst nicht abgebildet

- Sparerpauschbetrag (1.000 Euro pro Jahr)
- Vorabpauschale während der Laufzeit
- Kirchensteuer
- Fondskosten (TER), Depot- und Orderkosten
- Unterjährige Marktschwankungen; die Planung ist konstant, der Rückblick
  kennt nur geglättete Jahreswerte
- Künftige Steueränderungen

Diese Punkte stehen auch im Erklärblock der App selbst, damit beim Vorführen
niemand über eine unausgesprochene Annahme stolpert.

## Technik

- Reines Frontend, keine Abhängigkeiten, kein Server, keine Datenhaltung.
- Diagramm direkt auf einem Canvas gezeichnet.
- Das erweiterbare Anlagen-Register `ASSETS` in `app.js` steuert Auswahl,
  Berechnung, Farben, Steuerhinweise und Ausgabe des Vergleichs-Reiters.
- PWA-Hülle aus `manifest.webmanifest`, `service-worker.js` und `pwa.js`.
- Ein Einstellungsmenü bündelt Installation, Versionsanzeige und ein
  erzwungenes App-Shell-Update. Der Service Worker arbeitet im Normalbetrieb
  stale-while-revalidate: der Cache antwortet sofort, die Auffrischung läuft im
  Hintergrund. Bei Änderungen `CACHE_NAME` in `service-worker.js`
  hochzählen: der Update-Knopf holt den neuen Stand zwar auch ohne Bump (er
  leert die Caches und lädt das App-Shell mit `cache: 'reload'` neu), aber nur
  mit hochgezählter Version stimmt die angezeigte Versionsnummer und greift die
  normale Hintergrund-Auffrischung.
- Icons: `icons/icon.svg` als Quelle, daraus von Hand exportiert `icon-180.png`,
  `icon-192.png`, `icon-512.png` und `icon-maskable-512.png`.
- Lokales Ausliefern über `rehost_etf.py`, siehe `README.md`.

## Wie geprüft wird

`tools/check_math.mjs` schneidet den Rechenkern direkt aus `app.js` heraus und
rechnet ihn gegen unabhängige Formeln, damit wirklich der ausgelieferte Code
geprüft wird und keine Kopie davon. Insgesamt 33 Checks:

- **Planung**: gegen die geschlossene Rentenformel für vorschüssige Zahlungen,
  dazu die Randfälle Rendite 0 Prozent, negative Rendite und Inflation
  0 Prozent.
- **Rückblick**: Prüfsumme der MSCI-Reihe, interner Zinsfuss gegen eine
  synthetische Reihe mit bekanntem Ergebnis, größter Rückschlag gegen eine
  handgerechnete Wertereihe, Steuerkonsistenz.
- **Vergleich**: Prüfsummen der Gold- und S&P-500-Reihe, die direkte
  CAGR-Formel, alle drei Steuerfunktionen und die Referenzen im
  Anlagen-Register.

Die Prüfsummen der historischen Reihen sind der eigentliche Schutz gegen
Übertragungsfehler: Sie vergleichen das geometrische Mittel der tatsächlich
verbauten Jahreswerte mit dem Wert, den die Originalquelle für denselben
Zeitraum ausweist. Weicht ein einzelner Jahreswert ab, fällt das auf.

Wichtig dabei: Die Prüfsumme bezieht sich auf die **gerundeten** Werte, wie sie
in `historical-data.js` stehen, nicht auf die ungerundeten Zwischenwerte der
Herleitung. Bei Änderungen an den Daten also die Prüfsumme neu aus den
verbauten Werten bestimmen und nicht umgekehrt die Daten an eine erwartete
Prüfsumme anpassen.
