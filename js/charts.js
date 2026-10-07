/* charts.js — графики в стиле фигур MATLAB (Plotly): одиночные и сетка как у Scope */
(function (root) {
  'use strict';
  const NC = root.NC;
  function tok(name, fb) {
    try { const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return v || fb; } catch (e) { return fb; }
  }
  function theme(forExport) {
    if (forExport) return { bg: '#ffffff', paper: '#ffffff', fg: '#1b232c', grid: '#d5dbe2', axis: '#3a4653', c: ['#0072BD', '#D95319', '#EDB120', '#7E2F8E', '#77AC30'], muted: '#5b6876', zone: 'rgba(192,57,43,0.10)', zoneLine: '#c0392b' };
    return {
      bg: tok('--plot-bg', '#fff'), paper: tok('--sheet', '#fff'), fg: tok('--fg', '#1b232c'), grid: tok('--grid', '#d9dee4'), axis: tok('--axis', '#3a4653'),
      c: [tok('--c1', '#0072BD'), tok('--c2', '#D95319'), tok('--c3', '#EDB120'), tok('--c4', '#7E2F8E'), tok('--c5', '#77AC30')],
      muted: tok('--muted', '#5b6876'), zone: tok('--zone', 'rgba(192,57,43,0.10)'), zoneLine: tok('--bad', '#c0392b')
    };
  }
  function axis(th, title, extra) {
    return Object.assign({
      title: { text: title, font: { size: 12, color: th.fg }, standoff: 6 }, showline: true, mirror: true, linecolor: th.axis, linewidth: 1,
      ticks: 'inside', exponentformat: 'power', tickcolor: th.axis, tickfont: { size: 11, color: th.fg }, gridcolor: th.grid, griddash: 'dot', zeroline: false, automargin: true
    }, extra || {});
  }
  function baseLayout(th, h) {
    return {
      height: h || 300, separators: ', ', margin: { l: 58, r: 14, t: 12, b: 46 }, paper_bgcolor: th.paper, plot_bgcolor: th.bg,
      font: { family: '"IBM Plex Sans", "Segoe UI", Roboto, Arial, sans-serif', size: 12, color: th.fg },
      showlegend: false, hovermode: 'x unified', hoverlabel: { font: { family: '"IBM Plex Mono", monospace', size: 11 } },
      legend: { orientation: 'h', x: 0, y: 1.02, yanchor: 'bottom', bgcolor: 'rgba(0,0,0,0)', font: { size: 11 } }
    };
  }
  function prep(el) { if (el) { const w = el.querySelector('.plot-wait'); if (w) w.remove(); } }
  const config = { responsive: true, displaylogo: false, modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d', 'toggleSpikelines'], toImageButtonOptions: { format: 'png', scale: 2 } };

  /* временной график: series = [{x, y, name, dash}] */
  function time(el, series, xl, yl, opt) {
    opt = opt || {};
    const th = theme(opt.export);
    const data = series.map((s, k) => { const tr = { x: s.x, y: s.y, name: s.name || '', type: 'scatter', mode: s.mode || 'lines', line: { color: s.color || th.c[k % th.c.length], width: s.width || 1.6, dash: s.dash || 'solid', shape: s.shape || 'linear' }, hovertemplate: (s.name ? s.name + ': ' : '') + '%{y:.5g}<extra></extra>' }; if (s.marker) tr.marker = s.marker; return tr; });
    const lay = baseLayout(th, opt.h);
    lay.xaxis = axis(th, xl, opt.xaxis); lay.yaxis = axis(th, yl, opt.yaxis);
    if (series.length > 1 || opt.legend) lay.showlegend = true, lay.margin.t = 30;
    if (opt.shapes) lay.shapes = opt.shapes.map(s => Object.assign({ line: { color: th.muted, width: 1, dash: 'dash' } }, s));
    if (opt.annotations) lay.annotations = opt.annotations.map(a => Object.assign({ font: { size: 11, color: th.fg }, bgcolor: th.paper, bordercolor: th.grid, borderpad: 3, showarrow: false }, a));
    prep(el); return Plotly.react(el, data, lay, config);
  }
  /* ЛАЧХ + ЛФЧХ: curves = [{w, mag, ph, name}], mg = margins */
  function bode(el, curves, mg, opt) {
    opt = opt || {};
    const th = theme(opt.export);
    const data = [];
    curves.forEach((c, k) => {
      const col = c.color || th.c[k % th.c.length];
      data.push({ x: c.w, y: c.mag, name: c.name || '', type: 'scatter', mode: 'lines', line: { color: col, width: 1.6, dash: c.dash || 'solid' }, xaxis: 'x', yaxis: 'y', hovertemplate: 'ω=%{x:.4g}<br>L=%{y:.3g} дБ<extra></extra>' });
      if (c.ph) data.push({ x: c.w, y: c.ph, name: c.name || '', showlegend: false, type: 'scatter', mode: 'lines', line: { color: col, width: 1.6, dash: c.dash || 'solid' }, xaxis: 'x2', yaxis: 'y2', hovertemplate: 'ω=%{x:.4g}<br>φ=%{y:.4g}°<extra></extra>' });
    });
    const lay = baseLayout(th, opt.h || 440);
    lay.hovermode = 'closest';
    const hasPh = curves.some(c => c.ph);
    lay.xaxis = axis(th, hasPh ? '' : (opt.xl || 'ω, с⁻¹'), { type: 'log', exponentformat: 'power', anchor: 'y', matches: hasPh ? 'x2' : undefined, showticklabels: !hasPh });
    lay.yaxis = axis(th, 'L(ω), дБ', { domain: hasPh ? [0.54, 1] : [0, 1] });
    if (hasPh) {
      lay.xaxis2 = axis(th, opt.xl || 'ω, с⁻¹', { type: 'log', exponentformat: 'power', anchor: 'y2' });
      lay.yaxis2 = axis(th, 'φ(ω), град', { domain: [0, 0.44], dtick: opt.phDtick || 90 });
    }
    lay.margin.t = curves.length > 1 ? 30 : 14; lay.showlegend = curves.length > 1;
    const shapes = [], ann = [];
    if (mg && hasPh) {
      shapes.push({ type: 'line', xref: 'paper', x0: 0, x1: 1, yref: 'y', y0: 0, y1: 0, line: { color: th.muted, width: 1, dash: 'dash' } });
      const ph0 = curves[0].ph;
      const base = ph0 ? Math.round((ph0[0] + 180) / 360) * 360 - 180 : -180;
      shapes.push({ type: 'line', xref: 'paper', x0: 0, x1: 1, yref: 'y2', y0: base, y1: base, line: { color: th.muted, width: 1, dash: 'dash' } });
      if (isFinite(mg.wcp)) {
        shapes.push({ type: 'line', xref: 'x2', x0: Math.log10(mg.wcp), x1: Math.log10(mg.wcp), yref: 'paper', y0: 0, y1: 1, line: { color: th.c[1], width: 1, dash: 'dot' } });
        ann.push({ xref: 'x2', yref: 'y2 domain', x: Math.log10(mg.wcp), y: 0.95, xanchor: 'left', text: ' θз = ' + mg.Pm.toFixed(1).replace('.', ',') + '° при ωс = ' + (+mg.wcp.toPrecision(4)).toString().replace('.', ','), showarrow: false });
      }
      if (isFinite(mg.wcg) && isFinite(mg.Gm)) {
        shapes.push({ type: 'line', xref: 'x', x0: Math.log10(mg.wcg), x1: Math.log10(mg.wcg), yref: 'paper', y0: 0, y1: 1, line: { color: th.c[3], width: 1, dash: 'dot' } });
        ann.push({ xref: 'x', yref: 'y domain', x: Math.log10(mg.wcg), y: 0.08, xanchor: 'left', text: ' Lз = ' + mg.Gm.toFixed(1).replace('.', ',') + ' дБ при ωπ = ' + (+mg.wcg.toPrecision(4)).toString().replace('.', ','), showarrow: false });
      }
    }
    if (opt.shapes) opt.shapes.forEach(s => shapes.push(s));
    if (opt.annotations) opt.annotations.forEach(a => ann.push(a));
    lay.shapes = shapes;
    lay.annotations = ann.map(a => Object.assign({ font: { size: 11, color: th.fg }, bgcolor: th.paper, bordercolor: th.grid, borderpad: 3 }, a));
    if (opt.yrange) lay.yaxis.range = opt.yrange;
    prep(el); return Plotly.react(el, data, lay, config);
  }
  function nyquist(el, re, im, opt) {
    opt = opt || {};
    const th = theme(opt.export);
    const circ = []; for (let k = 0; k <= 200; k++) { const a = 2 * Math.PI * k / 200; circ.push([Math.cos(a), Math.sin(a)]); }
    const data = [
      { x: circ.map(p => p[0]), y: circ.map(p => p[1]), type: 'scatter', mode: 'lines', line: { color: th.muted, width: 1, dash: 'dot' }, hoverinfo: 'skip', name: '|W| = 1' },
      { x: re, y: im, type: 'scatter', mode: 'lines', line: { color: th.c[0], width: 1.6 }, name: 'W(jω), ω > 0', hovertemplate: 'Re=%{x:.3g}<br>Im=%{y:.3g}<extra></extra>' },
      { x: re, y: im.map(v => -v), type: 'scatter', mode: 'lines', line: { color: th.c[0], width: 1, dash: 'dash' }, name: 'ω < 0', hoverinfo: 'skip' },
      { x: [-1], y: [0], type: 'scatter', mode: 'markers', marker: { color: th.zoneLine, size: 8, symbol: 'cross' }, name: '(−1; j0)' }
    ];
    // точки определения запасов (как маркеры MATLAB): пересечение с |W| = 1 и с отрицательной вещественной полуосью
    const pm = [], gm = [];
    for (let k = 1; k < re.length; k++) {
      const m0 = Math.hypot(re[k - 1], im[k - 1]), m1 = Math.hypot(re[k], im[k]);
      if (!pm.length && (m0 - 1) * (m1 - 1) <= 0) { const t = (1 - m0) / (m1 - m0 || 1); pm.push([re[k - 1] + t * (re[k] - re[k - 1]), im[k - 1] + t * (im[k] - im[k - 1])]); }
      if (!gm.length && im[k - 1] * im[k] < 0) { const t = im[k - 1] / (im[k - 1] - im[k]), x = re[k - 1] + t * (re[k] - re[k - 1]); if (x < 0 && x > -1) gm.push([x, 0]); }
    }
    const mk = pm.concat(gm);
    if (mk.length) data.push({ x: mk.map(p => p[0]), y: mk.map(p => p[1]), type: 'scatter', mode: 'markers', marker: { color: th.c[0], size: 7 }, name: 'запасы: ωс, ωπ', hovertemplate: 'Re=%{x:.3g}<br>Im=%{y:.3g}<extra></extra>' });
    const lay = baseLayout(th, opt.h || 380); lay.showlegend = true; lay.margin.t = 30; lay.hovermode = 'closest';
    // масштаб как у nyquist в MATLAB: окрестность точки (−1; j0) и начала координат, без равного масштаба осей
    lay.xaxis = axis(th, 'Re W', { range: opt.xr || [-1.6, 0.6] });
    lay.yaxis = axis(th, 'Im W', { range: opt.yr || [-5, 1.5] });
    prep(el); return Plotly.react(el, data, lay, config);
  }
  function stem(el, t, y, xl, yl, opt) {
    opt = opt || {};
    const th = theme(opt.export);
    const xs = [], ys = [];
    t.forEach((tt, k) => { xs.push(tt, tt, null); ys.push(0, y[k], null); });
    const data = [
      { x: xs, y: ys, type: 'scatter', mode: 'lines', line: { color: th.c[0], width: 1 }, hoverinfo: 'skip' },
      { x: t, y, type: 'scatter', mode: 'markers', marker: { color: th.c[0], size: 5, line: { color: th.c[0], width: 1 }, symbol: 'circle-open' }, hovertemplate: 'k·T0=%{x:.4g}<br>u=%{y:.5g}<extra></extra>' }
    ];
    const lay = baseLayout(th, opt.h || 280); lay.hovermode = 'closest';
    lay.xaxis = axis(th, xl); lay.yaxis = axis(th, yl);
    prep(el); return Plotly.react(el, data, lay, config);
  }
  /* ЛАЧХ с запретной областью */
  function forbidden(el, d, opt) {
    opt = opt || {};
    const th = theme(opt.export);
    const data = [];
    // запретная область
    data.push({ x: d.zone.x, y: d.zone.y, type: 'scatter', mode: 'lines', fill: 'toself', fillcolor: th.zone, line: { color: th.zoneLine, width: 1.2 }, name: 'Запретная область', hoverinfo: 'skip' });
    d.curves.forEach((c, k) => data.push({ x: c.w, y: c.mag, type: 'scatter', mode: 'lines', name: c.name, line: { color: th.c[k], width: 1.7, dash: c.dash || 'solid' }, hovertemplate: 'ω=%{x:.4g}<br>L=%{y:.3g} дБ<extra></extra>' }));
    data.push({ x: [d.Ak[0]], y: [d.Ak[1]], type: 'scatter', mode: 'markers+text', marker: { color: th.zoneLine, size: 8 }, text: ['Aк'], textposition: 'top right', name: 'Aк', textfont: { color: th.fg }, hovertemplate: 'ωк=%{x:.4g}<br>L=%{y:.3g} дБ<extra></extra>' });
    const lay = baseLayout(th, opt.h || 380); lay.showlegend = true; lay.margin.t = 30; lay.hovermode = 'closest';
    lay.xaxis = axis(th, 'ω, с⁻¹', { type: 'log', exponentformat: 'power' });
    lay.yaxis = axis(th, 'L(ω), дБ', { range: d.yr });
    lay.shapes = [{ type: 'line', xref: 'paper', x0: 0, x1: 1, yref: 'y', y0: 0, y1: 0, line: { color: th.muted, width: 1, dash: 'dash' } }];
    prep(el); return Plotly.react(el, data, lay, config);
  }


  /* сетка графиков как у осциллографа Simulink: panels = [{series: [{x, y, name, dash}], yl}], opt.cols */
  function grid(el, panels, opt) {
    opt = opt || {};
    const th = theme(opt.export);
    const cols = opt.cols || 2, rows = Math.ceil(panels.length / cols);
    const data = [];
    const lay = baseLayout(th, opt.h || Math.max(300, rows * 190 + 40));
    lay.grid = { rows, columns: cols, pattern: 'independent', xgap: 0.12, ygap: rows > 2 ? 0.16 : 0.2 };
    lay.hovermode = 'x unified';
    let legend = false;
    panels.forEach((p, i) => {
      const k = i + 1, xa = k === 1 ? 'x' : 'x' + k, ya = k === 1 ? 'y' : 'y' + k;
      p.series.forEach((s, j) => {
        if (s.name && p.series.length > 1) legend = true;
        data.push({ x: s.x, y: s.y, name: s.name || p.yl, type: 'scatter', mode: 'lines', xaxis: xa, yaxis: ya, showlegend: !!s.name && i === (opt.legendPanel || 0), legendgroup: s.name || '', line: { color: s.color || th.c[j % th.c.length], width: s.width || 1.5, dash: s.dash || 'solid', shape: s.shape || 'linear' }, hovertemplate: (s.name ? s.name + ': ' : '') + '%{y:.5g}<extra></extra>' });
      });
      lay[k === 1 ? 'xaxis' : 'xaxis' + k] = axis(th, i >= panels.length - cols ? (p.xl || 't, с') : '', { anchor: ya });
      lay[k === 1 ? 'yaxis' : 'yaxis' + k] = axis(th, p.yl, Object.assign({ anchor: xa }, p.yrange ? { range: p.yrange } : {}));
    });
    if (legend) { lay.showlegend = true; lay.margin.t = 34; }
    prep(el); return Plotly.react(el, data, lay, config);
  }

  const api = { time, grid, theme, config };
  root.CHARTS = api;
})(typeof window !== 'undefined' ? window : globalThis);
