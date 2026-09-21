(() => {
  'use strict';

  /* ------------------------------------------------------------ Steuermodell
   * Abgeltungsteuer 25 %, darauf 5,5 % Solidaritaetszuschlag, davor 30 %
   * Teilfreistellung fuer Aktien-ETFs. Ergibt 18,4625 % auf den Gewinn.
   * Bewusst ohne Sparerpauschbetrag, Vorabpauschale und Kirchensteuer.
   */
  const TAX = { abgeltung: 0.25, soli: 0.055, teilfreistellung: 0.30 };
  const TAX_EFFECTIVE = TAX.abgeltung * (1 + TAX.soli) * (1 - TAX.teilfreistellung);
  const HISTORY_START = 1970;
  const HISTORY_END = 2025;

  const SERIES = [
    { key: 'paid',    label: 'Eingezahlt',                      cssVar: '--c-paid',    dash: [5, 4] },
    { key: 'nominal', label: 'Depotwert nominal',               cssVar: '--c-nominal', dash: [] },
    { key: 'net',     label: 'Depotwert nach Steuern',          cssVar: '--c-net',     dash: [] },
    { key: 'real',    label: 'Depotwert real (Kaufkraft heute)', cssVar: '--c-real',   dash: [] }
  ];
  const REFERENCE_SERIES = {
    key: 'reference', label: 'Konstanter Vergleich', cssVar: '--c-reference', dash: [2, 5]
  };
  const HISTORICAL_SERIES = [
    ...SERIES.slice(0, 3),
    { ...SERIES[3], label: 'Depotwert real (Kaufkraft am Start)' },
    REFERENCE_SERIES
  ];

  /* ------------------------------------------------------------- Simulation */

  // Vorschuessig: die Sparrate geht zu Monatsbeginn ein und verzinst sich im
  // selben Monat mit. Der Monatszins wird geometrisch aus der Jahresrendite
  // gezogen, damit zwoelf Monate exakt die Jahresrendite ergeben.
  function simulate(input) {
    const months = Math.round(input.years * 12);
    const rm = Math.pow(1 + input.ret, 1 / 12) - 1;
    const points = [{ month: 0, paid: 0, nominal: 0, gain: 0, tax: 0, net: 0, real: 0 }];

    let value = 0;
    for (let m = 1; m <= months; m++) {
      value = (value + input.rate) * (1 + rm);
      const paid = input.rate * m;
      const gain = value - paid;
      const tax = gain > 0 ? gain * TAX_EFFECTIVE : 0;
      points.push({
        month: m,
        paid,
        nominal: value,
        gain,
        tax,
        net: value - tax,
        real: value / Math.pow(1 + input.infl, m / 12)
      });
    }

    const last = points[points.length - 1];
    return {
      mode: 'planning', input, months, rm, points, last,
      netReal: last.net / Math.pow(1 + input.infl, input.years)
    };
  }

  function constantSavingsEnd(rate, months, monthlyReturn) {
    let value = 0;
    for (let m = 0; m < months; m++) value = (value + rate) * (1 + monthlyReturn);
    return value;
  }

  function savingsIrr(rate, months, target) {
    if (!(rate > 0) || !(target > 0) || months < 1) return 0;
    let low = -0.999999;
    let high = 1;
    for (let i = 0; i < 80; i++) {
      const middle = (low + high) / 2;
      if (constantSavingsEnd(rate, months, middle) < target) low = middle;
      else high = middle;
    }
    return Math.pow(1 + (low + high) / 2, 12) - 1;
  }

  function maxDrawdown(values) {
    let peak = 0;
    let worst = 0;
    for (const value of values) {
      if (value > peak) peak = value;
      if (peak > 0) worst = Math.min(worst, value / peak - 1);
    }
    return worst;
  }

  function simulateHistorical(input, returns = MSCI_WORLD_RETURN_PCT, inflation = DE_INFLATION_PCT) {
    const months = Math.round(input.years * 12);
    const referenceRm = Math.pow(1 + input.ret, 1 / 12) - 1;
    const points = [{
      month: 0, paid: 0, nominal: 0, gain: 0, tax: 0, net: 0, real: 0, reference: 0
    }];

    let value = 0;
    let reference = 0;
    let inflationFactor = 1;
    for (let m = 1; m <= months; m++) {
      const year = input.startYear + Math.floor((m - 1) / 12);
      const rm = Math.pow(1 + returns[year] / 100, 1 / 12) - 1;
      const im = Math.pow(1 + inflation[year] / 100, 1 / 12) - 1;
      value = (value + input.rate) * (1 + rm);
      reference = (reference + input.rate) * (1 + referenceRm);
      inflationFactor *= 1 + im;

      const paid = input.rate * m;
      const gain = value - paid;
      const tax = gain > 0 ? gain * TAX_EFFECTIVE : 0;
      points.push({
        month: m,
        paid,
        nominal: value,
        gain,
        tax,
        net: value - tax,
        real: value / inflationFactor,
        reference
      });
    }

    const last = points[points.length - 1];
    return {
      mode: 'historical', input, months, points, last,
      endYear: input.startYear + input.years - 1,
      referenceRm,
      referenceLast: last.reference,
      inflationFactor,
      netReal: last.net / inflationFactor,
      irr: savingsIrr(input.rate, months, last.nominal),
      maxDrawdown: maxDrawdown(points.map(point => point.nominal))
    };
  }

  /* ------------------------------------------------------------ Formatierung */

  const {
    MSCI_WORLD_RETURN_PCT, GOLD_RETURN_PCT, SP500_RETURN_PCT, DE_INFLATION_PCT, CRISES
  } = globalThis.ETF_HISTORICAL;

  /* ----------------------------------------------------- Anlagenvergleich */

  const ASSETS = [
    {
      key: 'etf', label: 'ETF (MSCI World)', cssVar: '--c-nominal',
      returns: MSCI_WORLD_RETURN_PCT,
      tax: gain => gain > 0 ? gain * TAX_EFFECTIVE : 0,
      taxNote: '18,4625 % auf den Gewinn (Teilfreistellung eingerechnet)',
      taxExplain: 'Beim ETF wird nur ein positiver Gewinn besteuert: 25 % Abgeltungsteuer plus ' +
        'Solidaritätszuschlag, nach 30 % Teilfreistellung effektiv 18,4625 %.'
    },
    {
      key: 'gold', label: 'Physisches Gold', cssVar: '--c-gold',
      returns: GOLD_RETURN_PCT,
      tax: () => 0,
      taxNote: 'steuerfrei nach mehr als einem Jahr Haltefrist (§ 23 EStG); gilt nicht für alle Gold-ETCs',
      taxExplain: 'Physisches Gold ist nach mehr als einem Jahr Haltefrist gemäß § 23 EStG steuerfrei. ' +
        'Vereinfacht behandelt die App deshalb jede wählbare Laufzeit ab einem Jahr als steuerfrei.'
    },
    {
      key: 'sp500', label: 'S&P 500', cssVar: '--c-sp500',
      returns: SP500_RETURN_PCT,
      tax: gain => gain > 0 ? gain * TAX_EFFECTIVE : 0,
      taxNote: '18,4625 % auf den Gewinn (Teilfreistellung eingerechnet)',
      taxExplain: 'Ein S&P-500-ETF ist wie der MSCI-World-ETF ein Aktienfonds mit über 51 % ' +
        'Aktienanteil: dieselbe Teilfreistellung, derselbe effektive Satz von 18,4625 % auf den Gewinn.'
    }
  ];

  function simulateComparison(input, assets = ASSETS, inflation = DE_INFLATION_PCT) {
    const states = assets.map(asset => ({ asset, factor: 1 }));
    const firstPoint = { month: 0, paid: input.capital };
    for (const state of states) firstPoint[state.asset.key] = input.capital;
    const points = [firstPoint];

    let inflationFactor = 1;
    for (let offset = 0; offset < input.years; offset++) {
      const year = input.startYear + offset;
      const point = { month: (offset + 1) * 12, paid: input.capital };
      inflationFactor *= 1 + inflation[year] / 100;
      for (const state of states) {
        state.factor *= 1 + state.asset.returns[year] / 100;
        const nominal = input.capital * state.factor;
        point[state.asset.key] = nominal - state.asset.tax(nominal - input.capital);
      }
      points.push(point);
    }

    const results = states.map(state => {
      const nominal = input.capital * state.factor;
      const gain = nominal - input.capital;
      const tax = state.asset.tax(gain);
      const net = nominal - tax;
      return {
        asset: state.asset,
        factor: state.factor,
        nominal,
        gain,
        tax,
        net,
        cagr: Math.pow(state.factor, 1 / input.years) - 1,
        netReal: net / inflationFactor
      };
    });

    return {
      mode: 'comparison', input, months: input.years * 12, points, results,
      activeAssets: assets,
      endYear: input.startYear + input.years - 1,
      inflationFactor
    };
  }

  const nfEuro = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const nf3 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const nf4 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

  const euro = v => nfEuro.format(Math.round(v)) + ' €';
  const pct = (v, d) => (d === 4 ? nf4 : d === 3 ? nf3 : nf2).format(v * 100) + ' %';
  const signedPctPoints = v => (v > 0 ? '+' : '') + nf1.format(v) + ' %';

  function euroShort(v) {
    const a = Math.abs(v);
    if (a >= 1e6) return nf2.format(v / 1e6).replace(',00', '') + ' Mio';
    if (a >= 1e4) return nfEuro.format(Math.round(v / 1000)) + ' T';
    return nfEuro.format(Math.round(v));
  }

  const num = v => '<span class="num">' + euro(v) + '</span>';

  /* ----------------------------------------------------------------- Canvas */

  const chart = document.querySelector('#chart');
  const readout = document.querySelector('#readout');
  let hoverMonth = null;

  const comparisonSeries = sim => sim.activeAssets.length
    ? [SERIES[0], ...sim.activeAssets.map(asset => ({
        key: asset.key,
        label: asset.label + ' nach Steuern',
        cssVar: asset.cssVar,
        dash: []
      }))]
    : [];
  const seriesFor = sim => sim.mode === 'historical'
    ? HISTORICAL_SERIES
    : sim.mode === 'comparison' ? comparisonSeries(sim) : SERIES;

  function colors(series) {
    const cs = getComputedStyle(document.documentElement);
    const out = {};
    for (const s of series) out[s.key] = cs.getPropertyValue(s.cssVar).trim();
    out.grid = cs.getPropertyValue('--grid').trim();
    out.muted = cs.getPropertyValue('--muted').trim();
    out.line = cs.getPropertyValue('--line').trim();
    return out;
  }

  function niceCeil(v) {
    if (!(v > 0)) return 1;
    const e = Math.pow(10, Math.floor(Math.log10(v)));
    const f = v / e;
    const n = f <= 1 ? 1 : f <= 1.5 ? 1.5 : f <= 2 ? 2 : f <= 2.5 ? 2.5
      : f <= 3 ? 3 : f <= 4 ? 4 : f <= 5 ? 5 : f <= 7.5 ? 7.5 : 10;
    return n * e;
  }

  function yearStep(years) {
    if (years <= 10) return 1;
    if (years <= 24) return 2;
    if (years <= 40) return 5;
    return 10;
  }

  function drawChart(sim) {
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 3);
    const rect = chart.getBoundingClientRect();
    if (rect.width < 2) return;
    chart.width = Math.round(rect.width * dpr);
    chart.height = Math.round(rect.height * dpr);

    const ctx = chart.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const series = seriesFor(sim);
    const c = colors(series);
    const padL = 60, padR = 10, padT = 12, padB = 26;
    const w = rect.width - padL - padR;
    const h = rect.height - padT - padB;
    if (w < 40 || h < 40) return;

    if (series.length === 0) {
      readout.hidden = true;
      return;
    }
    const peakValue = Math.max(...sim.points.flatMap(point => series.map(s => point[s.key])), 1);
    const yMax = niceCeil(Math.max(peakValue, 1) * 1.02);
    const x = m => padL + (m / Math.max(sim.months, 1)) * w;
    const y = v => padT + h - (v / yMax) * h;

    ctx.font = '11px -apple-system, system-ui, sans-serif';
    ctx.lineJoin = 'round';

    // Waagerechtes Raster mit Euro-Beschriftung
    ctx.strokeStyle = c.grid;
    ctx.fillStyle = c.muted;
    ctx.lineWidth = 1;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; i++) {
      const v = (yMax / 4) * i;
      const py = Math.round(y(v)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(padL, py);
      ctx.lineTo(padL + w, py);
      ctx.stroke();
      ctx.fillText(euroShort(v), padL - 8, py);
    }

    // Jahresbeschriftung unten
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const step = yearStep(sim.input.years);
    if (sim.mode === 'historical' || sim.mode === 'comparison') {
      for (let yr = 0; yr < sim.input.years; yr += step) {
        ctx.fillText(String(sim.input.startYear + yr), x(yr * 12), padT + h + 7);
      }
      if ((sim.input.years - 1) % step !== 0) {
        ctx.fillText(String(sim.endYear), x(sim.months), padT + h + 7);
      }
    } else {
      for (let yr = 0; yr <= sim.input.years; yr += step) {
        ctx.fillText(String(yr), x(yr * 12), padT + h + 7);
      }
      if (sim.input.years % step !== 0) {
        ctx.fillText(String(sim.input.years), x(sim.months), padT + h + 7);
      }
    }

    if (sim.mode === 'historical') {
      ctx.strokeStyle = c.line;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 5]);
      for (const crisis of CRISES) {
        if (crisis.y < sim.input.startYear || crisis.y > sim.endYear) continue;
        const px = Math.round(x((crisis.y - sim.input.startYear) * 12)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(px, padT);
        ctx.lineTo(px, padT + h);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // Linien
    ctx.lineWidth = 2;
    for (const s of series) {
      ctx.setLineDash(s.dash);
      ctx.strokeStyle = c[s.key];
      ctx.beginPath();
      for (let i = 0; i < sim.points.length; i++) {
        const p = sim.points[i];
        const px = x(p.month), py = y(p[s.key]);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Hover-Markierung
    if (hoverMonth !== null) {
      const pointIndex = sim.mode === 'comparison' ? Math.round(hoverMonth / 12) : hoverMonth;
      const p = sim.points[Math.min(pointIndex, sim.points.length - 1)];
      const px = Math.round(x(p.month)) + 0.5;
      ctx.strokeStyle = c.line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, padT);
      ctx.lineTo(px, padT + h);
      ctx.stroke();
      for (const s of series) {
        ctx.fillStyle = c[s.key];
        ctx.beginPath();
        ctx.arc(x(p.month), y(p[s.key]), 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      showReadout(sim, p, rect, x(p.month));
    } else {
      readout.hidden = true;
    }
  }

  function showReadout(sim, p, rect, px) {
    const years = p.month / 12;
    let label;
    if (sim.mode === 'historical' || sim.mode === 'comparison') {
      const year = sim.input.startYear + Math.max(0, Math.ceil(p.month / 12) - 1);
      label = p.month === 0
        ? 'Start ' + year
        : Number.isInteger(years) ? 'Ende ' + year : year + ', Monat ' + (p.month % 12);
    } else {
      label = Number.isInteger(years)
        ? 'Jahr ' + years
        : 'Jahr ' + Math.floor(years) + ', Monat ' + (p.month % 12);
    }
    readout.innerHTML =
      '<b>' + label + '</b>' +
      seriesFor(sim).map(s => '<span><i>' + s.label + ':</i> ' + euro(p[s.key]) + '</span>').join('');
    readout.hidden = false;
    if (px > rect.width / 2) {
      readout.style.left = '68px';
      readout.style.right = 'auto';
    } else {
      readout.style.left = 'auto';
      readout.style.right = '8px';
    }
  }

  function pointerToMonth(clientX, sim) {
    const rect = chart.getBoundingClientRect();
    const padL = 60, padR = 10;
    const w = rect.width - padL - padR;
    const frac = (clientX - rect.left - padL) / w;
    return Math.max(0, Math.min(sim.months, Math.round(frac * sim.months)));
  }

  /* ------------------------------------------------------------------ Ausgabe */

  function renderLegend(sim) {
    document.querySelector('#legend').innerHTML = seriesFor(sim)
      .map(s => '<li><span class="swatch ' + (s === REFERENCE_SERIES ? 'dotted' : '') +
                '" style="background:var(' + s.cssVar + ')"></span>' + s.label + '</li>')
      .join('');
  }

  function renderTiles(sim) {
    const l = sim.last;
    const tiles = [
      { k: 'Eingezahlt', v: euro(l.paid), n: euro(sim.input.rate) + ' &times; ' + sim.months + ' Monate' },
      { k: 'Depotwert vor Steuern', v: euro(l.nominal), n: 'davon Gewinn ' + euro(l.gain) },
      { k: 'Abgeltungsteuer', v: (l.tax > 0 ? '− ' : '') + euro(l.tax), n: pct(TAX_EFFECTIVE, 4) + ' vom Gewinn', cls: 'warn' },
      { k: 'Nach Steuern', v: euro(l.net), n: 'das steht auf dem Konto', cls: 'hero' },
      { k: sim.mode === 'historical' ? 'In Kaufkraft von ' + sim.input.startYear : 'In heutiger Kaufkraft',
        v: euro(sim.netReal), n: sim.mode === 'historical'
          ? 'nach Steuern und echten Inflationsraten'
          : 'nach Steuern und ' + pct(sim.input.infl) + ' Inflation', cls: 'hero' }
    ];
    if (sim.mode === 'historical') {
      tiles.push(
        { k: 'Erzielte Rendite p.a.', v: pct(sim.irr), n: 'interner Zinsfuß des Sparplans' },
        { k: 'Größter Rückschlag', v: pct(sim.maxDrawdown), n: 'vom vorherigen Depot-Höchststand', cls: 'warn' }
      );
    }
    document.querySelector('#tiles').innerHTML = tiles
      .map(t => '<div class="tile ' + (t.cls || '') + '"><span class="k">' + t.k +
                '</span><span class="v">' + t.v + '</span><span class="n">' + t.n + '</span></div>')
      .join('');
  }

  function renderComparisonTiles(sim) {
    const empty = sim.results.length === 0;
    document.querySelector('#compareEmptyResults').hidden = !empty;
    document.querySelector('#compareAssetResults').innerHTML = sim.results.map(result => {
      const asset = result.asset;
      const tiles = [
        { k: 'Endwert nominal', v: euro(result.nominal), n: 'davon Gewinn ' + euro(result.gain) },
        { k: 'Steuer', v: (result.tax > 0 ? '− ' : '') + euro(result.tax), n: asset.taxNote, cls: 'warn' },
        { k: 'Endwert nach Steuern', v: euro(result.net), n: 'Nominalwert abzüglich Steuer', cls: 'hero' },
        { k: 'Erzielte Rendite p.a.', v: pct(result.cagr), n: 'reine Anlage-Performance vor Steuern' },
        { k: 'Endwert in heutiger Kaufkraft', v: euro(result.netReal),
          n: 'nach Steuern und echten Inflationsraten', cls: 'hero' }
      ];
      return '<section class="compare-asset-group" style="--asset-color:var(' + asset.cssVar + ')">' +
        '<h3><span class="swatch" style="background:var(' + asset.cssVar + ')"></span>' + asset.label + '</h3>' +
        '<div class="tiles">' + tiles.map(tile =>
          '<div class="tile ' + (tile.cls || '') + '"><span class="k">' + tile.k +
          '</span><span class="v">' + tile.v + '</span><span class="n">' + tile.n + '</span></div>'
        ).join('') + '</div></section>';
    }).join('');
  }

  function renderBar(sim) {
    const l = sim.last;
    const bar = document.querySelector('#bar');
    const legend = document.querySelector('#barLegend');

    const parts = l.gain > 0
      ? [
          { label: 'Einzahlung', value: l.paid, cssVar: '--c-paid' },
          { label: 'Gewinn nach Steuern', value: l.gain - l.tax, cssVar: '--c-net' },
          { label: 'Steuer', value: l.tax, cssVar: '--c-tax' }
        ]
      : [
          { label: 'Verbliebener Depotwert', value: Math.max(l.nominal, 0), cssVar: '--c-net' },
          { label: 'Verlust', value: Math.max(l.paid - l.nominal, 0), cssVar: '--c-tax' }
        ];

    const total = parts.reduce((s, p) => s + p.value, 0) || 1;
    bar.innerHTML = parts
      .map(p => '<span style="width:' + (p.value / total * 100) + '%;background:var(' + p.cssVar + ')"></span>')
      .join('');
    legend.innerHTML = parts
      .map(p => '<li><span class="swatch" style="background:var(' + p.cssVar + ')"></span>' +
                p.label + ' &middot; ' + euro(p.value) + ' (' + Math.round(p.value / total * 100) + ' %)</li>')
      .join('');
  }

  function heroTier(irr) {
    if (irr < 0) return 'tier-bad';
    if (irr < 0.05) return 'tier-mid';
    return 'tier-good';
  }

  function renderHeroIrr(sim) {
    const hero = document.querySelector('#heroIrr');
    hero.hidden = sim.mode !== 'historical';
    if (hero.hidden) return;

    hero.classList.remove('tier-bad', 'tier-mid', 'tier-good');
    hero.classList.add(heroTier(sim.irr));
    document.querySelector('#heroIrrValue').textContent = pct(sim.irr);
  }

  function renderHistoricalDetails(sim) {
    const section = document.querySelector('#historicalResults');
    section.hidden = sim.mode !== 'historical';
    if (section.hidden) return;

    const crises = CRISES.filter(crisis => crisis.y >= sim.input.startYear && crisis.y <= sim.endYear);
    document.querySelector('#crisisList').innerHTML = crises.length
      ? crises.map(crisis =>
          '<article class="crisis"><h4><span>' + crisis.y + '</span> ' + crisis.n +
          ' <em>' + signedPctPoints(MSCI_WORLD_RETURN_PCT[crisis.y]) + '</em></h4><p>' + crisis.t + '</p></article>'
        ).join('')
      : '<p class="hint">In diesem Zeitraum liegt keines der markierten Krisenjahre. ' +
        'Wähle zum Beispiel 1973, 2000 oder 2008 als Startjahr.</p>';
  }

  function renderExplain(sim) {
    const i = sim.input, l = sim.last;
    const set = (id, html) => { document.querySelector('#' + id).innerHTML = html; };

    set('ex1',
      'Du hast ' + pct(i.ret) + ' Rendite pro Jahr angegeben. Daraus wird ein Monatszins von <span class="num">' +
      pct(sim.rm, 3) + '</span>. Nicht einfach ' + pct(i.ret) + ' geteilt durch zwölf, denn die Zinsen der ersten Monate ' +
      'verzinsen sich im selben Jahr schon mit. Gerechnet wird die zwölfte Wurzel: (1 + ' + pct(i.ret) + ')<sup>1/12</sup> − 1.');

    set('ex2',
      'Die Rechnung läuft Monat für Monat. Zu Monatsbeginn kommen ' + num(i.rate) +
      ' dazu, danach wächst der gesamte Bestand um den Monatszins – also auch das Geld, das schon länger drin liegt. ' +
      'Genau das ist der Zinseszins.');

    set('ex2b',
      'Nach ' + sim.months + ' Monaten (' + i.years + ' Jahre) sind ' + num(l.paid) +
      ' eingezahlt, im Depot stehen ' + num(l.nominal) + '.');

    set('ex3', l.gain > 0
      ? 'Gewinn ist alles, was über die eigenen Einzahlungen hinausgeht: ' + num(l.nominal) + ' − ' +
        num(l.paid) + ' = ' + num(l.gain) + '. Nur dieser Teil wird besteuert.'
      : 'Bei dieser Rendite liegt der Depotwert am Ende unter den Einzahlungen. Es gibt keinen Gewinn, ' +
        'also fällt auch keine Abgeltungsteuer an.');

    set('ex4', l.gain > 0
      ? num(l.gain) + ' Gewinn × ' + pct(TAX_EFFECTIVE, 4) + ' = <span class="num">' + euro(l.tax) +
        '</span> Steuer. Vom Depotwert ' + num(l.nominal) + ' bleiben damit ' + num(l.net) + ' übrig.'
      : 'Ohne Gewinn keine Steuer: es bleiben ' + num(l.net) + '.');

    const factor = Math.pow(1 + i.infl, i.years);
    set('ex5', i.infl > 0
      ? 'Bei ' + pct(i.infl) + ' Inflation pro Jahr kostet das, was heute 100 € kostet, in ' + i.years +
        ' Jahren rund <span class="num">' + nfEuro.format(Math.round(100 * factor)) + ' €</span>. ' +
        'Das Geld auf dem Konto wird also nicht weniger, es kauft nur weniger.'
      : 'Du hast 0 % Inflation angegeben. Dann entspricht jeder Betrag am Ende genau der heutigen Kaufkraft.');

    set('ex5b',
      'Der Depotwert von ' + num(l.nominal) + ' entspricht damit einer heutigen Kaufkraft von ' +
      num(l.real) + '. Genau das zeigt die orangefarbene Linie im Diagramm.');

    set('ex6',
      'Beides zusammen – Steuer abgezogen und in heutige Kaufkraft umgerechnet – ergibt <span class="num">' +
      euro(sim.netReal) + '</span>. Dem stehen ' + num(l.paid) + ' an eigenen Einzahlungen gegenüber' +
      (sim.netReal > l.paid
        ? ': real bleibt ein Plus von ' + num(sim.netReal - l.paid) + '.'
        : ': real bleibt ein Minus von ' + num(l.paid - sim.netReal) + '.'));
  }

  function renderHistoricalExplain(sim) {
    const i = sim.input, l = sim.last;
    const set = (id, html) => { document.querySelector('#' + id).innerHTML = html; };
    const delta = l.nominal - sim.referenceLast;
    const firstReturn = MSCI_WORLD_RETURN_PCT[i.startYear];

    set('histEx1',
      'Der Zeitraum reicht von <span class="num">' + i.startYear + '</span> bis <span class="num">' +
      sim.endYear + '</span>. Die Jahresrenditen stammen aus dem Scalable-Capital-Renditedreieck auf MSCI-Basis, ' +
      'die deutschen Inflationsraten vom Statistischen Bundesamt. Die MSCI-World-Reihe ist eine Net-Total-Return-Reihe ' +
      'in D-Mark beziehungsweise Euro: Dividenden, ausländische Quellensteuer und Wechselkurse sind enthalten.');

    set('histEx2',
      'Auch hier gehen jeden Monatsanfang ' + num(i.rate) + ' in den Sparplan. Für jedes Kalenderjahr wird dessen ' +
      'echte Jahresrendite gleichmäßig auf zwölf Monate verteilt. ' + i.startYear + ' sind das ' +
      '<span class="num">' + signedPctPoints(firstReturn) + '</span>. Die Linie zeigt deshalb den Jahresverlauf ' +
      'geglättet, nicht die täglichen Ausschläge. Der Absturz im März 2020 ist zum Beispiel nicht sichtbar, weil 2020 ' +
      'am Jahresende mit <span class="num">+6,3 %</span> schloss.');

    set('histEx3',
      'Aus ' + num(l.paid) + ' Einzahlungen wurden vor Steuern ' + num(l.nominal) + '. Für diesen Zahlungsstrom ' +
      'entspricht das einer erzielten Rendite von <span class="num">' + pct(sim.irr) + '</span> pro Jahr. ' +
      'Sie ist per internem Zinsfuß berechnet: Gesucht wird die konstante Monatsrendite, die mit denselben Einzahlungen ' +
      'genau denselben Endwert ergeben hätte.');

    set('histEx4',
      'Die gepunktete Linie rechnet denselben Sparplan jeden Monat mit der Vergleichsrendite von <span class="num">' +
      pct(i.ret) + '</span>. Sie endet bei ' + num(sim.referenceLast) + '. Die echte historische Reihe liegt damit ' +
      (delta >= 0 ? 'um ' + num(delta) + ' darüber.' : 'um ' + num(-delta) + ' darunter.') +
      ' Dieser Abstand zeigt, wie sehr Reihenfolge und Höhe der einzelnen Jahresrenditen das Ergebnis prägen.');

    set('histEx5',
      'Der größte Abstand zu einem vorherigen Depot-Höchststand betrug <span class="num">' +
      pct(sim.maxDrawdown) + '</span>. Auf einen positiven Gewinn werden wie in der Planung <span class="num">' +
      pct(TAX_EFFECTIVE, 4) + '</span> Steuer angewandt; nach dem vereinfachten Modell bleiben ' + num(l.net) + '. ' +
      'Die echten deutschen Jahresraten haben das Preisniveau im Zeitraum auf das <span class="num">' +
      nf2.format(sim.inflationFactor) + '-Fache</span> erhöht; in Kaufkraft von ' + i.startYear + ' sind das ' +
      num(sim.netReal) + '.');
  }

  function renderComparisonExplain(sim) {
    const empty = sim.results.length === 0;
    document.querySelector('#compareExplainEmpty').hidden = !empty;
    document.querySelector('#compareExplainContent').hidden = empty;
    if (empty) return;

    const i = sim.input;
    const set = (id, html) => { document.querySelector('#' + id).innerHTML = html; };
    set('compareEx1',
      'Das Startkapital von ' + num(i.capital) + ' wird einmalig zu Beginn von <span class="num">' +
      i.startYear + '</span> angelegt. Der Vergleich umfasst ' + i.years + ' volle Kalenderjahre bis Ende <span class="num">' +
      sim.endYear + '</span>. Für jede Anlage werden ihre Jahresrenditen in genau dieser Reihenfolge miteinander multipliziert.');

    set('compareEx2',
      'Weil es nur diesen einen Zahlungszeitpunkt gibt, folgt die durchschnittliche Jahresrendite direkt aus der ' +
      i.years + '. Wurzel des Gesamtfaktors. Anders als beim monatlichen Sparplan im Rückblick ist keine ' +
      'Bisektion für einen internen Zinsfuß nötig.');

    document.querySelector('#comparePerformanceExplain').innerHTML = sim.results.map(result =>
      '<p><strong>' + result.asset.label + ':</strong> Die Jahreswerte ergeben zusammen den Faktor <span class="num">' +
      nf2.format(result.factor) + '</span>. Aus ' + num(i.capital) + ' werden nominal ' + num(result.nominal) +
      '; daraus ergibt sich eine reine Anlage-Rendite von <span class="num">' + pct(result.cagr) + '</span> pro Jahr.</p>'
    ).join('');

    document.querySelector('#compareTaxExplain').innerHTML = sim.results.map(result => {
      const outcome = result.gain > 0
        ? ' Bei einem Gewinn von ' + num(result.gain) + ' fallen ' + num(result.tax) +
          ' Steuer an; nach Steuern bleiben ' + num(result.net) + '.'
        : ' Der Endwert liegt nicht über dem Startkapital, daher fallen ' + num(result.tax) +
          ' Steuer an; nach Steuern bleiben ' + num(result.net) + '.';
      return '<p><strong>' + result.asset.label + ':</strong> ' + result.asset.taxExplain + outcome + '</p>';
    }).join('');

    set('compareEx4',
      'Die echten deutschen Inflationsraten im Zeitraum erhöhen das Preisniveau auf das <span class="num">' +
      nf2.format(sim.inflationFactor) + '-Fache</span>. Deshalb wird der jeweilige Endwert nach Steuern durch diesen ' +
      'Faktor geteilt. So bleibt Anlage-Performance, Steuer und Kaufkraft als drei getrennte Wirkungen sichtbar.');
  }

  /* -------------------------------------------------------------- Eingaben */

  const fields = [
    { id: 'rate',   slider: 'rateSlider',   key: 'rate',  min: 0,  max: 5000, scale: 1 },
    { id: 'ret',    slider: 'retSlider',    key: 'ret',   min: -5, max: 20,   scale: 0.01 },
    { id: 'infl',   slider: 'inflSlider',   key: 'infl',  min: 0,  max: 15,   scale: 0.01 },
    { id: 'years',  slider: 'yearsSlider',  key: 'years', min: 1,  max: 60,   scale: 1 }
  ];
  const comparisonFields = [
    { id: 'compareCapital', slider: 'compareCapitalSlider', key: 'capital', min: 0, max: 500000 },
    { id: 'compareYears', slider: 'compareYearsSlider', key: 'years', min: 1, max: 56 }
  ];

  let mode = 'planning';
  let startYearSynced = true;
  let compareStartYearSynced = true;
  let current = null;

  function readInputs() {
    const out = {};
    for (const f of fields) {
      const el = document.querySelector('#' + f.id);
      let v = Number(String(el.value).replace(',', '.'));
      if (!Number.isFinite(v)) v = Number(el.defaultValue);
      v = Math.max(f.min, Math.min(f.max, v));
      out[f.key] = v * f.scale;
    }
    out.years = Math.max(1, Math.round(out.years));
    if (mode === 'historical') out.years = Math.min(HISTORY_END - HISTORY_START + 1, out.years);

    const startInput = document.querySelector('#startYear');
    let startYear = Number(startInput.value);
    if (!Number.isFinite(startYear)) startYear = HISTORY_END - out.years + 1;
    out.startYear = Math.max(HISTORY_START, Math.min(HISTORY_END - out.years + 1, Math.round(startYear)));
    return out;
  }

  function readComparisonInputs() {
    const out = {};
    for (const field of comparisonFields) {
      const el = document.querySelector('#' + field.id);
      let value = Number(String(el.value).replace(',', '.'));
      if (!Number.isFinite(value)) value = Number(el.defaultValue);
      out[field.key] = Math.max(field.min, Math.min(field.max, value));
    }
    out.years = Math.max(1, Math.min(56, Math.round(out.years)));

    const startInput = document.querySelector('#compareStartYear');
    let startYear = Number(startInput.value);
    if (!Number.isFinite(startYear)) startYear = HISTORY_END - out.years + 1;
    out.startYear = Math.max(HISTORY_START, Math.min(HISTORY_END - out.years + 1, Math.round(startYear)));
    return out;
  }

  const selectedAssets = () => ASSETS.filter(asset =>
    document.querySelector('#compareAsset-' + asset.key).checked
  );

  function render() {
    if (mode === 'comparison') {
      current = simulateComparison(readComparisonInputs(), selectedAssets());
    } else {
      const input = readInputs();
      current = mode === 'historical' ? simulateHistorical(input) : simulate(input);
    }
    renderHeroIrr(current);
    renderLegend(current);
    document.querySelector('#chartEmpty').hidden = mode !== 'comparison' || current.results.length > 0;
    document.querySelector('#savingsResults').hidden = mode === 'comparison';
    document.querySelector('#comparisonResults').hidden = mode !== 'comparison';
    if (mode === 'comparison') renderComparisonTiles(current);
    else {
      renderTiles(current);
      renderBar(current);
    }
    renderHistoricalDetails(current);
    if (mode === 'historical') renderHistoricalExplain(current);
    else if (mode === 'comparison') renderComparisonExplain(current);
    else renderExplain(current);
    drawChart(current);
  }

  function currentYears() {
    const input = document.querySelector('#years');
    let years = Math.round(Number(String(input.value).replace(',', '.')));
    if (!Number.isFinite(years)) years = Number(input.defaultValue);
    return Math.max(1, Math.min(mode === 'historical' ? 56 : 60, years));
  }

  function updateYearControl(inputId, sliderId, windowId, years, synced) {
    const input = document.querySelector('#' + inputId);
    const slider = document.querySelector('#' + sliderId);
    const max = HISTORY_END - Math.min(years, HISTORY_END - HISTORY_START + 1) + 1;
    input.max = slider.max = String(max);

    let value = synced ? max : Math.round(Number(input.value));
    if (!Number.isFinite(value)) value = max;
    value = Math.max(HISTORY_START, Math.min(max, value));
    input.value = slider.value = String(value);

    const windowPct = (max - HISTORY_START) / (HISTORY_END - HISTORY_START) * 100;
    document.querySelector('#' + windowId).style.width = windowPct + '%';
  }

  const updateStartYear = years =>
    updateYearControl('startYear', 'startYearSlider', 'yearScaleWindow', years, startYearSynced);
  const updateCompareStartYear = years =>
    updateYearControl(
      'compareStartYear', 'compareStartYearSlider', 'compareYearScaleWindow', years, compareStartYearSynced
    );

  function syncYearControls() {
    const input = document.querySelector('#years');
    const slider = document.querySelector('#yearsSlider');
    input.max = mode === 'historical' ? '56' : '60';
    slider.max = mode === 'historical' ? '56' : '50';

    const years = currentYears();
    // Leeres Feld nicht sofort auf 1 normalisieren, sonst laesst es sich nicht
    // neu eintippen. Das Klammern uebernimmt clampOnCommit beim Verlassen.
    if (input.value.trim() !== '') input.value = String(years);
    slider.value = String(Math.min(Number(slider.max), years));
    updateStartYear(years);
  }

  function currentCompareYears() {
    const input = document.querySelector('#compareYears');
    let years = Math.round(Number(String(input.value).replace(',', '.')));
    if (!Number.isFinite(years)) years = Number(input.defaultValue);
    return Math.max(1, Math.min(56, years));
  }

  function syncComparisonYearControls() {
    const input = document.querySelector('#compareYears');
    const slider = document.querySelector('#compareYearsSlider');
    const years = currentCompareYears();
    // Wie in syncYearControls: leeres Feld nicht sofort normalisieren.
    if (input.value.trim() !== '') input.value = String(years);
    slider.value = String(years);
    updateCompareStartYear(years);
  }

  function setMode(next) {
    if (next === mode) return;
    mode = next;
    for (const button of document.querySelectorAll('[data-mode]')) {
      const active = button.dataset.mode === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    }

    const historical = mode === 'historical';
    const comparison = mode === 'comparison';
    document.querySelector('#savingsInputs').hidden = comparison;
    document.querySelector('#comparisonInputs').hidden = !comparison;
    document.querySelector('#startYearField').hidden = !historical;
    document.querySelector('#inflControls').hidden = historical;
    document.querySelector('#historicalInflationHint').hidden = !historical;
    document.querySelector('#retLabelText').textContent = historical ? 'Vergleichsrendite' : 'Rendite';
    document.querySelector('#planningExplain').hidden = mode !== 'planning';
    document.querySelector('#historicalExplain').hidden = !historical;
    document.querySelector('#comparisonExplain').hidden = !comparison;
    document.querySelector('#resultTitle').textContent = comparison
      ? 'Am Ende des Vergleichszeitraums'
      : historical ? 'Am Ende des Zeitraums' : 'Am Ende der Laufzeit';
    document.querySelector('#resultSection').setAttribute('aria-label',
      comparison ? 'Ergebnisse am Ende des Vergleichszeitraums'
        : historical ? 'Ergebnis am Ende des historischen Zeitraums' : 'Ergebnis am Laufzeitende');
    document.querySelector('#retSlider').setAttribute('aria-label',
      historical ? 'Vergleichsrendite schieben' : 'Rendite schieben');
    chart.setAttribute('aria-label', comparison
      ? 'Vergleich der gewählten Einmalanlagen nach Steuern'
      : historical
        ? 'Historischer Verlauf des Sparplans mit Vergleichslinie und markierten Krisenjahren'
        : 'Verlauf von eingezahltem Kapital und Depotwert über die Laufzeit');
    hoverMonth = null;
    if (comparison) syncComparisonYearControls();
    else syncYearControls();
    render();
  }

  function renderAssetControls() {
    document.querySelector('#compareAssets').innerHTML = ASSETS.map(asset =>
      '<label class="asset-option" for="compareAsset-' + asset.key + '">' +
      '<input type="checkbox" id="compareAsset-' + asset.key + '" checked>' +
      '<span class="swatch" style="background:var(' + asset.cssVar + ')"></span>' + asset.label + '</label>'
    ).join('');
  }

  // Beim Verlassen des Feldes den Wert zeigen, mit dem wirklich gerechnet wird.
  // Erst beim Verlassen, nicht bei jedem Tastendruck: waehrend des Tippens waere
  // eine Zwischeneingabe wie "1" schon geklammert und das Feld unbedienbar.
  function clampOnCommit(input, field, maxFor) {
    input.addEventListener('change', () => {
      const raw = String(input.value).replace(',', '.').trim();
      if (raw === '') { input.value = input.defaultValue; render(); return; }
      let value = Number(raw);
      if (!Number.isFinite(value)) value = Number(input.defaultValue);
      if (field.key === 'years') value = Math.round(value);
      const max = maxFor ? maxFor() : field.max;
      const clamped = Math.max(field.min, Math.min(max, value));
      if (String(clamped) !== input.value) {
        input.value = String(clamped);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  }

  function bind() {
    for (const f of fields) {
      const input = document.querySelector('#' + f.id);
      const slider = document.querySelector('#' + f.slider);
      clampOnCommit(input, f, f.key === 'years' ? () => (mode === 'historical' ? 56 : 60) : null);
      input.addEventListener('input', () => {
        slider.value = String(Math.max(Number(slider.min), Math.min(Number(slider.max), Number(String(input.value).replace(',', '.')) || 0)));
        if (f.key === 'years') syncYearControls();
        render();
      });
      slider.addEventListener('input', () => {
        input.value = slider.value;
        if (f.key === 'years') syncYearControls();
        render();
      });
    }

    for (const field of comparisonFields) {
      const input = document.querySelector('#' + field.id);
      const slider = document.querySelector('#' + field.slider);
      clampOnCommit(input, field, null);
      input.addEventListener('input', () => {
        const value = Number(String(input.value).replace(',', '.')) || 0;
        slider.value = String(Math.max(Number(slider.min), Math.min(Number(slider.max), value)));
        if (field.key === 'years') syncComparisonYearControls();
        render();
      });
      slider.addEventListener('input', () => {
        input.value = slider.value;
        if (field.key === 'years') syncComparisonYearControls();
        render();
      });
    }

    const startInput = document.querySelector('#startYear');
    const startSlider = document.querySelector('#startYearSlider');
    startInput.addEventListener('input', () => {
      startYearSynced = false;
      startSlider.value = startInput.value;
      updateStartYear(currentYears());
      render();
    });
    startSlider.addEventListener('input', () => {
      startYearSynced = false;
      startInput.value = startSlider.value;
      updateStartYear(currentYears());
      render();
    });

    const compareStartInput = document.querySelector('#compareStartYear');
    const compareStartSlider = document.querySelector('#compareStartYearSlider');
    compareStartInput.addEventListener('input', () => {
      compareStartYearSynced = false;
      compareStartSlider.value = compareStartInput.value;
      updateCompareStartYear(currentCompareYears());
      render();
    });
    compareStartSlider.addEventListener('input', () => {
      compareStartYearSynced = false;
      compareStartInput.value = compareStartSlider.value;
      updateCompareStartYear(currentCompareYears());
      render();
    });

    for (const input of document.querySelectorAll('#compareAssets input[type=checkbox]')) {
      input.addEventListener('change', render);
    }

    for (const button of document.querySelectorAll('[data-mode]')) {
      button.addEventListener('click', () => setMode(button.dataset.mode));
    }

    const move = e => { if (current) { hoverMonth = pointerToMonth(e.clientX, current); drawChart(current); } };
    chart.addEventListener('pointermove', move);
    chart.addEventListener('pointerdown', move);
    chart.addEventListener('pointerleave', () => { hoverMonth = null; if (current) drawChart(current); });

    let resizeTimer = null;
    globalThis.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { if (current) drawChart(current); }, 120);
    });
    globalThis.matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', () => { if (current) drawChart(current); });
  }

  updateStartYear(currentYears());
  updateCompareStartYear(currentCompareYears());
  renderAssetControls();
  bind();
  render();
})();
