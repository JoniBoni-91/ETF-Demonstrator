// Prueft den Rechenkern aus app.js gegen unabhaengige Formeln.
// Aufruf: node tools/check_math.mjs
// Der Kern wird direkt aus app.js herausgeschnitten, damit wirklich der
// ausgelieferte Code geprueft wird und keine Kopie davon.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'app.js'), 'utf8');

const start = source.indexOf('const TAX = {');
const end = source.indexOf('/* ------------------------------------------------------------ Formatierung */');
if (start < 0 || end < 0) {
  console.error('FEHLER: Rechenkern in app.js nicht gefunden. Marker geaendert?');
  process.exit(1);
}
const { TAX_EFFECTIVE, simulate } = new Function(
  source.slice(start, end) + '\nreturn { TAX_EFFECTIVE, simulate };'
)();

let failed = 0;
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(b));
function check(name, ok, detail = '') {
  console.log((ok ? 'OK   ' : 'FEHL ') + name + (detail ? '  ' + detail : ''));
  if (!ok) failed++;
}

// 1. Effektiver Steuersatz: 25 % * 1,055 * 70 %
check('Steuersatz = 18,4625 %', near(TAX_EFFECTIVE, 0.184625, 1e-12),
  '-> ' + (TAX_EFFECTIVE * 100).toFixed(4) + ' %');

// 2. Monatszins ergibt hochgerechnet exakt die Jahresrendite
{
  const s = simulate({ rate: 250, ret: 0.07, infl: 0.02, years: 30 });
  check('(1 + Monatszins)^12 = 1 + Jahresrendite', near(Math.pow(1 + s.rm, 12), 1.07, 1e-12));
}

// 3. Depotwert gegen die geschlossene Rentenformel (vorschuessig)
//    V = rate * ((1+i)^n - 1) / i * (1+i)
for (const [rate, ret, years] of [[250, 0.07, 30], [500, 0.04, 10], [100, 0.09, 45], [1000, 0.02, 1]]) {
  const s = simulate({ rate, ret, infl: 0.02, years });
  const i = Math.pow(1 + ret, 1 / 12) - 1;
  const n = years * 12;
  const expected = rate * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
  check(`Depotwert ${rate} EUR / ${ret * 100} % / ${years} J`, near(s.last.nominal, expected, 1e-9),
    '-> ' + s.last.nominal.toFixed(2) + ' vs ' + expected.toFixed(2));
}

// 4. Eingezahlt, Gewinn, Steuer, Netto haengen konsistent zusammen
{
  const s = simulate({ rate: 250, ret: 0.07, infl: 0.02, years: 30 });
  const l = s.last;
  check('Eingezahlt = Sparrate * Monate', near(l.paid, 250 * 360));
  check('Gewinn = Depotwert - Eingezahlt', near(l.gain, l.nominal - l.paid));
  check('Steuer = Gewinn * Steuersatz', near(l.tax, l.gain * TAX_EFFECTIVE));
  check('Netto = Depotwert - Steuer', near(l.net, l.nominal - l.tax));
  check('Real = Depotwert / 1,02^30', near(l.real, l.nominal / Math.pow(1.02, 30)));
  check('netReal = Netto / 1,02^30', near(s.netReal, l.net / Math.pow(1.02, 30)));
  check('Anzahl Punkte = Monate + 1', s.points.length === 361);
}

// 5. Randfall Rendite 0 %: Depotwert = Einzahlungen, kein Gewinn, keine Steuer
{
  const s = simulate({ rate: 250, ret: 0, infl: 0.02, years: 20 });
  const l = s.last;
  check('Rendite 0 %: Depotwert = Eingezahlt', near(l.nominal, 250 * 240, 1e-9));
  check('Rendite 0 %: keine Steuer', l.tax === 0);
  check('Rendite 0 %: Netto = Depotwert', near(l.net, l.nominal));
}

// 6. Randfall negative Rendite: Verlust wird nicht besteuert
{
  const s = simulate({ rate: 250, ret: -0.05, infl: 0.02, years: 20 });
  const l = s.last;
  check('Negative Rendite: Gewinn < 0', l.gain < 0, '-> ' + l.gain.toFixed(2));
  check('Negative Rendite: Steuer = 0', l.tax === 0);
  check('Negative Rendite: Netto = Depotwert', near(l.net, l.nominal));
}

// 7. Randfall Inflation 0 %: real = nominal
{
  const s = simulate({ rate: 250, ret: 0.07, infl: 0, years: 30 });
  check('Inflation 0 %: real = nominal', near(s.last.real, s.last.nominal));
}

// 8. Monotonie bei positiver Rendite
{
  const s = simulate({ rate: 250, ret: 0.07, infl: 0.02, years: 30 });
  let mono = true;
  for (let k = 1; k < s.points.length; k++) if (s.points[k].nominal < s.points[k - 1].nominal) mono = false;
  check('Depotwert waechst monoton', mono);
}

const historicalSource = readFileSync(join(root, 'historical-data.js'), 'utf8');
const { MSCI_WORLD_RETURN_PCT, SP500_RETURN_PCT, DE_INFLATION_PCT } = new Function(
  historicalSource + '\nreturn globalThis.ETF_HISTORICAL;'
)();
const GOLD_RETURN_PCT = globalThis.ETF_HISTORICAL.GOLD_RETURN_PCT;
const { simulateHistorical, savingsIrr, maxDrawdown } = new Function(
  source.slice(start, end) + '\nreturn { simulateHistorical, savingsIrr, maxDrawdown };'
)();

// 9. Historische Daten gegen die Pruefsumme des Original-Renditedreiecks
{
  let factor = 1;
  for (let year = 1970; year <= 2024; year++) factor *= 1 + MSCI_WORLD_RETURN_PCT[year] / 100;
  const average = (Math.pow(factor, 1 / 55) - 1) * 100;
  check('MSCI World 1970-2024 geometrisch = 7,73 %', Math.abs(average - 7.73) <= 0.01,
    '-> ' + average.toFixed(4) + ' %');
}

// 10. Die IRR-Bisektion findet eine synthetische konstante Rendite wieder
{
  const returns = {};
  const inflation = {};
  for (let year = 2000; year < 2010; year++) {
    returns[year] = 7;
    inflation[year] = 0;
  }
  const s = simulateHistorical(
    { rate: 250, ret: 0.07, infl: 0, years: 10, startYear: 2000 }, returns, inflation
  );
  check('IRR einer konstanten 7-%-Reihe = 7 % p.a.', Math.abs(s.irr * 100 - 7) <= 0.05,
    '-> ' + (s.irr * 100).toFixed(4) + ' %');
}

// 11. Groesster Rueckschlag von 120 auf 90 entspricht -25 %
{
  const drawdown = maxDrawdown([100, 120, 90, 130]);
  check('Max-Drawdown [100, 120, 90, 130] = -25 %', near(drawdown, -0.25, 1e-12),
    '-> ' + (drawdown * 100).toFixed(2) + ' %');
}

// 12. Historischer Modus nutzt denselben effektiven Steuersatz
{
  const returns = {};
  const inflation = {};
  for (let year = 2000; year < 2010; year++) {
    returns[year] = 7;
    inflation[year] = 2;
  }
  const s = simulateHistorical(
    { rate: 250, ret: 0.07, infl: 0, years: 10, startYear: 2000 }, returns, inflation
  );
  const historicalUsesTaxConstant = source.slice(
    source.indexOf('function simulateHistorical'), end
  ).includes('gain * TAX_EFFECTIVE');
  const oneTaxConstant = (source.match(/const TAX_EFFECTIVE/g) || []).length === 1;
  check('Rueckblick: Steuer = Gewinn * TAX_EFFECTIVE',
    historicalUsesTaxConstant && oneTaxConstant && near(s.last.tax, s.last.gain * TAX_EFFECTIVE));
}

const comparisonStart = source.indexOf('const {\n    MSCI_WORLD_RETURN_PCT, GOLD_RETURN_PCT');
const comparisonEnd = source.indexOf('const nfEuro');
if (comparisonStart < 0 || comparisonEnd < 0) {
  console.error('FEHLER: Anlagen-Register in app.js nicht gefunden. Marker geaendert?');
  process.exit(1);
}
const { ASSETS, simulateComparison } = new Function(
  'const TAX_EFFECTIVE = ' + TAX_EFFECTIVE + ';\n' + source.slice(comparisonStart, comparisonEnd) +
  '\nreturn { ASSETS, simulateComparison };'
)();

// Goldpreis in USD je Feinunze: Jahresdurchschnitte der National Mining Association
// (1883-1994 World Gold Council/Timothy Green, 1995-2022 Kitco/London PM Fix,
// 2023-2024 gemittelte LBMA-Monatspreise), fuer 2025 LBMA-Jahresdurchschnitt von
// metalcharts.org (3.432 USD). Umrechnung mit Bundesbank-Jahresdurchschnittskursen:
// 1969-1998 DM (Abschnitt X.1), 1999-2025 Euro (Abschnitt X.2). Der DM-Wert 1998
// wurde vor der Rendite 1999 zum Fixkurs 1 Euro = 1,95583 DM umgerechnet. Die Reihe
// zeigt die Veraenderung dieser DM/Euro-Jahresdurchschnitte; deshalb ist ihr
// geometrisches Mittel von rund 6,15 % statt rund 7,66 % in reinen US-Dollar
// plausibel. Pruefsumme 6,1496 % bezieht sich auf die tatsaechlich verbauten,
// auf eine Nachkommastelle gerundeten Jahreswerte (nicht auf die ungerundeten
// Zwischenwerte der Herleitung, die 6,1548 % ergeben haetten).

// 13. Gold-Reihe gegen die unabhaengig bestimmte Pruefsumme
{
  let factor = 1;
  for (let year = 1970; year <= 2024; year++) factor *= 1 + GOLD_RETURN_PCT[year] / 100;
  const average = (Math.pow(factor, 1 / 55) - 1) * 100;
  check('Gold 1970-2024 geometrisch = 6,1496 %', Math.abs(average - 6.1496) <= 0.01,
    '-> ' + average.toFixed(4) + ' %');
}

// 14. Die direkte CAGR-Formel findet eine synthetische konstante Rendite wieder
{
  const returns = {};
  const inflation = {};
  for (let year = 2000; year < 2010; year++) {
    returns[year] = 5;
    inflation[year] = 0;
  }
  const asset = {
    key: 'synthetic', label: 'Synthetisch', cssVar: '--c-nominal', returns,
    tax: () => 0, taxNote: '', taxExplain: ''
  };
  const capital = 10000;
  const s = simulateComparison({ capital, years: 10, startYear: 2000 }, [asset], inflation);
  const result = s.results[0];
  check('Einmalanlage 5 %: Endwert = Startkapital * 1,05^10',
    near(result.nominal, capital * Math.pow(1.05, 10), 1e-12));
  check('CAGR einer konstanten 5-%-Reihe = 5 % p.a.',
    Math.abs(result.cagr * 100 - 5) <= 1e-10, '-> ' + (result.cagr * 100).toFixed(4) + ' %');
}

// 15. Jede Anlage kapselt ihre eigene Steuerregel im Register
{
  const etf = ASSETS.find(asset => asset.key === 'etf');
  const gold = ASSETS.find(asset => asset.key === 'gold');
  const sp500 = ASSETS.find(asset => asset.key === 'sp500');
  check('Gold: Steuer immer 0', gold.tax(1000) === 0 && gold.tax(-1000) === 0);
  check('ETF: positiver Gewinn * TAX_EFFECTIVE, Verlust steuerfrei',
    near(etf.tax(1000), 1000 * TAX_EFFECTIVE, 1e-12) && etf.tax(-1000) === 0);
  check('S&P 500: positiver Gewinn * TAX_EFFECTIVE, Verlust steuerfrei',
    near(sp500.tax(1000), 1000 * TAX_EFFECTIVE, 1e-12) && sp500.tax(-1000) === 0);
}

// 16. Das erweiterbare Register verweist auf die ausgelieferten Datenreihen
{
  check('Anlagen-Register enthaelt ETF, Gold und S&P 500 mit korrekten Reihen',
    ASSETS.length === 3 && ASSETS[0].key === 'etf' && ASSETS[1].key === 'gold' &&
    ASSETS[2].key === 'sp500' && ASSETS[0].returns === MSCI_WORLD_RETURN_PCT &&
    ASSETS[1].returns === GOLD_RETURN_PCT && ASSETS[2].returns === SP500_RETURN_PCT);
}

// S&P 500 Total Return (mit Dividenden) in USD, Quelle us500.com Jahrestabelle.
// Umrechnung nach demselben Verfahren wie bei Gold: synthetischer USD-Indexstand
// (Basis 1969=100) fortgeschrieben, dann mit den Bundesbank-Jahresdurchschnitts-
// kursen (DM bis 1998, Euro ab 1999, Uebergang zum Fixkurs 1,95583 gebrueckt) in
// DM/Euro umgerechnet. Pruefsumme bezieht sich auf die tatsaechlich verbauten,
// auf eine Nachkommastelle gerundeten Jahreswerte.

// 17. S&P-500-Reihe gegen die unabhaengig bestimmte Pruefsumme
{
  let factor = 1;
  for (let year = 1970; year <= 2024; year++) factor *= 1 + SP500_RETURN_PCT[year] / 100;
  const average = (Math.pow(factor, 1 / 55) - 1) * 100;
  check('S&P 500 1970-2024 geometrisch = 9,3974 %', Math.abs(average - 9.3974) <= 0.01,
    '-> ' + average.toFixed(4) + ' %');
}

console.log(failed === 0 ? '\nAlle Checks bestanden.' : `\n${failed} Check(s) fehlgeschlagen.`);
process.exit(failed === 0 ? 0 : 1);
