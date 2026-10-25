/* slsvg.js — схемы в виде моделей MATLAB Simulink (SVG): блоки с пиктограммами Simulink,
 * подписи имён под блоками, ортогональные линии связи со стрелками и точками ветвления.
 * Общий файл утилит «Электропривод» и «Робот-балансир».
 *
 *   const d = new SLSVG.Diagram();
 *   d.add('Gain', 'gain', x, y, { val: '1.55' });          // x, y — центр блока
 *   d.add('Sum', 'sum', x, y, { ports: ['l', 'b'], signs: '+-' });
 *   d.ln('Gain', 1, 'Sum', 1);                              // выход 1 → вход 1
 *   d.ln('Gain', 1, 'Sum', 2, { from: [x0, y0], via: [[x1, y1]] });
 *   d.svg('Название');
 */
(function (root) {
  'use strict';
  const CH = 6.9;   // ширина символа шрифта 11,5px (моноширинный)
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  const tw = s => String(s).length * CH;

  /* размеры по умолчанию для типов блоков */
  function size(t, o) {
    const lines = o.text ? String(o.text).split('\n') : [];
    const lw = lines.length ? Math.max(...lines.map(tw)) : 0;
    switch (t) {
      case 'tf': case 'int': case 'deriv': return [Math.max(36, Math.max(tw(o.num), tw(o.den)) + 16), 40];
      case 'gain': return [Math.max(34, tw(o.val) + 26), Math.max(30, o.h || 0)];
      case 'sum': return [22, 22];
      case 'add': return [o.w || 26, o.h || Math.max(30, (o.nIn || (o.signs || '++').length) * 16)];
      case 'sumel': return [o.w || 30, o.h || 30];
      case 'step': case 'ramp': case 'clock': case 'zoh': case 'pulse': case 'prod': case 'sat': case 'scope': case 'term': case 'ground': case 'switch':
        return [o.w || (t === 'term' || t === 'ground' ? 20 : 32), o.h || (t === 'switch' ? 44 : t === 'term' || t === 'ground' ? 20 : 32)];
      case 'const': case 'display': case 'tows': case 'round': return [Math.max(t === 'display' ? 60 : 34, tw(o.val || o.text || '') + 16), 30];
      case 'mux': case 'demux': return [6, o.h || 40];
      case 'inport': case 'outport': return [30, 16];
      case 'ss': case 'dss': case 'fcn': case 'subsys': case 'box': return [Math.max(o.w || 0, lw + 18), Math.max(o.h || 0, 16 + lines.length * 14)];
      default: return [Math.max(40, lw + 18), 30];
    }
  }

  function Diagram() { this.b = {}; this.order = []; this.lines = []; this.texts = []; this.dots = []; }
  /* id — имя блока Simulink; t — тип; o: num/den/val/text, nIn/nOut, ports/signs (Sum), flip, name (подпись, false — скрыть), tip */
  Diagram.prototype.add = function (id, t, x, y, o) {
    o = Object.assign({}, o || {});
    const [w, h] = size(t, o);
    const nIn = o.nIn != null ? o.nIn : ({ step: 0, ramp: 0, clock: 0, const: 0, pulse: 0, inport: 0, ground: 0, sum: (o.ports || ['l', 'b']).length, add: (o.signs || '++').length, prod: 2, switch: 3, mux: o.n || 2 }[t] ?? 1);
    const nOut = o.nOut != null ? o.nOut : ({ scope: 0, display: 0, tows: 0, outport: 0, term: 0, demux: o.n || 2 }[t] ?? 1);
    const bk = { id, t, x, y, w: o.w || w, h: o.h || h, o, nIn, nOut };
    this.b[id] = bk; this.order.push(id); return bk;
  };
  Diagram.prototype.text = function (x, y, t, anchor, cls) { this.texts.push({ x, y, t, anchor: anchor || 'middle', cls: cls || 'sig' }); return this; };
  Diagram.prototype.dot = function (x, y) { this.dots.push([x, y]); return this; };
  /* координаты портов: вход k (1…n) и выход k */
  Diagram.prototype.inP = function (id, k) {
    const b = this.b[id]; k = k || 1;
    if (b.t === 'sum') {
      const side = (b.o.ports || ['l', 'b'])[k - 1], r = b.w / 2;
      const v = { l: [-r, 0, 'r'], r: [r, 0, 'l'], t: [0, -r, 'd'], b: [0, r, 'u'] }[side];
      return [b.x + v[0], b.y + v[1], v[2]];
    }
    const yk = b.y - b.h / 2 + b.h * (k - 0.5) / b.nIn;
    return b.o.flip ? [b.x + b.w / 2, yk, 'l'] : [b.x - b.w / 2, yk, 'r'];
  };
  Diagram.prototype.outP = function (id, k) {
    const b = this.b[id]; k = k || 1;
    const yk = b.y - b.h / 2 + b.h * (k - 0.5) / Math.max(1, b.nOut);
    const yy = b.t === 'sum' || b.nOut === 1 ? b.y : yk;
    return b.o.flip ? [b.x - b.w / 2, yy, 'l'] : [b.x + b.w / 2, yy, 'r'];
  };
  /* линия: от выхода src/sk к входу dst/dk; opt.from — начать от точки ветвления (рисуется точка), opt.via — промежуточные точки */
  Diagram.prototype.ln = function (src, sk, dst, dk, opt) {
    opt = opt || {};
    const p0 = opt.from ? opt.from.slice(0, 2) : this.outP(src, sk).slice(0, 2);
    const q = this.inP(dst, dk);
    if (opt.from && opt.dot !== false) this.dots.push(p0);
    const pts = [p0].concat(opt.via || []);
    const out = [p0];
    const p1 = [q[0], q[1]], dir = q[2];
    for (let k = 1; k < pts.length; k++) {
      const a = out[out.length - 1], b = pts[k];
      if (a[0] !== b[0] && a[1] !== b[1]) out.push(opt.vfirst ? [a[0], b[1]] : [b[0], a[1]]);
      out.push(b);
    }
    const a = out[out.length - 1];
    if (dir === 'r' || dir === 'l') {
      if (a[1] !== p1[1]) {
        if (pts.length === 1 && !opt.from && ((dir === 'r' && p1[0] > a[0]) || (dir === 'l' && p1[0] < a[0]))) { const mx = opt.mx != null ? opt.mx : (a[0] + p1[0]) / 2; out.push([mx, a[1]], [mx, p1[1]]); }
        else out.push([a[0], p1[1]]);
      }
    } else if (a[0] !== p1[0]) out.push([p1[0], a[1]]);
    out.push(p1);
    // убрать повторы и точки на одной прямой
    const clean = [];
    for (const p of out) {
      const l = clean[clean.length - 1];
      if (l && l[0] === p[0] && l[1] === p[1]) continue;
      if (clean.length >= 2) { const l2 = clean[clean.length - 2]; if ((l2[0] === l[0] && l[0] === p[0]) || (l2[1] === l[1] && l[1] === p[1])) clean.pop(); }
      clean.push(p);
    }
    this.lines.push({ src, sk, dst, dk, pts: clean, label: opt.label, lpos: opt.lpos, arrow: true });
    return this;
  };
  /* линия без блока-приёмника (выход схемы со стрелкой и подписью) */
  Diagram.prototype.wire = function (pts, label, lpos) { this.lines.push({ pts, label, lpos, arrow: true, free: true }); return this; };

  /* ---------- пиктограммы ---------- */
  function icon(b) {
    const x0 = b.x - b.w / 2, y0 = b.y - b.h / 2, w = b.w, h = b.h, cx = b.x, cy = b.y, o = b.o, f = o.flip;
    const R = (cls) => `<rect class="${cls || 'blk'}" x="${x0}" y="${y0}" width="${w}" height="${h}"/>`;
    const T = (s, x, y, cls, anc) => `<text class="${cls || 'bt'}" x="${x}" y="${y}" text-anchor="${anc || 'middle'}">${esc(s)}</text>`;
    const P = (d, cls) => `<path class="${cls || 'ic'}" d="${d}"/>`;
    const frac = (nm, dn) => T(nm, cx, cy - 5) + `<line class="frac" x1="${x0 + 6}" x2="${x0 + w - 6}" y1="${cy}" y2="${cy}"/>` + T(dn, cx, cy + 14);
    const lines = (txt, cls) => { const ls = String(txt).split('\n'); return ls.map((l, k) => T(l, cx, cy + 4 + (k - (ls.length - 1) / 2) * 14, cls)).join(''); };
    switch (b.t) {
      case 'tf': case 'int': case 'deriv': return R() + frac(o.num, o.den);
      case 'gain': {
        const pts = f ? `${x0 + w},${y0} ${x0 + w},${y0 + h} ${x0},${cy}` : `${x0},${y0} ${x0},${y0 + h} ${x0 + w},${cy}`;
        return `<polygon class="blk" points="${pts}"/>` + T(o.val, f ? cx + 5 : cx - 5, cy + 4, 'bt sm');
      }
      case 'sum': {
        let s = `<circle class="sum" cx="${cx}" cy="${cy}" r="${w / 2}"/>`;
        const ports = o.ports || ['l', 'b'], sg = (o.signs || '+-').replace(/\|/g, '');
        ports.forEach((side, k) => {
          const c = sg[k] === '-' ? '−' : '+';
          const off = { l: [-7, 1], r: [5, 1], t: [-1, -4], b: [-1, 9] }[side];
          const ox = side === 't' || side === 'b' ? (k % 2 ? -6 : 6) : 0;
          s += `<text class="sg" x="${cx + off[0] + ox - 3}" y="${cy + off[1] + 3}">${c}</text>`;
        });
        return s;
      }
      case 'step': return R() + P(`M${x0 + 6} ${cy + 8} H${cx} V${cy - 8} H${x0 + w - 6}`);
      case 'ramp': return R() + P(`M${x0 + 6} ${cy + 9} L${x0 + w - 6} ${cy - 9}`);
      case 'clock': return R() + `<circle class="ic" cx="${cx}" cy="${cy}" r="${Math.min(w, h) / 2 - 6}"/>` + P(`M${cx} ${cy} V${cy - 7} M${cx} ${cy} H${cx + 5}`);
      case 'pulse': return R() + P(`M${x0 + 5} ${cy + 7} H${x0 + 9} V${cy - 7} H${x0 + 14} V${cy + 7} H${x0 + 19} V${cy - 7} H${x0 + 24} V${cy + 7} H${x0 + w - 5}`);
      case 'zoh': return R() + P(`M${x0 + 5} ${cy + 8} H${x0 + 11} V${cy + 2} H${x0 + 17} V${cy - 4} H${x0 + 23} V${cy - 9} H${x0 + w - 5}`);
      case 'sat': return R() + P(`M${x0 + 5} ${cy + 7} H${cx - 6} L${cx + 6} ${cy - 7} H${x0 + w - 5}`) + P(`M${cx} ${y0 + 4} V${y0 + h - 4} M${x0 + 4} ${cy} H${x0 + w - 4}`, 'ic thin');
      case 'prod': return R() + T('×', cx, cy + 6, 'bt big');
      case 'sumel': return R() + T('Σ', cx, cy + 6, 'bt big');
      case 'add': return R() + String(o.signs || '++').split('').map((c, k) => T(c === '-' ? '−' : '+', x0 + 7, y0 + h * (k + 0.5) / b.nIn + 4, 'sg', 'middle')).join('');
      case 'switch': {
        const yi = k => y0 + h * (k - 0.5) / 3, xr = x0 + w;
        return R() + P(`M${x0} ${yi(1)} H${x0 + 9} M${x0} ${yi(3)} H${x0 + 9} M${x0 + 9} ${yi(1)} L${xr - 8} ${cy} H${xr}`) + `<circle class="ic" cx="${x0 + 9}" cy="${yi(3)}" r="1.8"/>` + T('>0', x0 + 13, yi(2) + 4, 'bt tiny', 'start');
      }
      case 'scope': return R() + `<rect class="ic" x="${x0 + 5}" y="${y0 + 6}" width="${w - 10}" height="${h - 14}"/>` + P(`M${x0 + 7} ${cy + 3} q4 -9 8 0 t8 0`, 'ic thin');
      case 'display': return R() + `<rect class="ic" x="${x0 + 4}" y="${y0 + 4}" width="${w - 8}" height="${h - 8}"/>` + T(o.val || '', cx, cy + 4, 'bt sm');
      case 'tows': return R() + T(o.val || 'simout', cx, cy + 4, 'bt sm');
      case 'const': case 'round': return R() + T(o.val || o.text, cx, cy + 4, 'bt sm');
      case 'mux': case 'demux': return `<rect class="bar" x="${x0}" y="${y0}" width="${w}" height="${h}"/>`;
      case 'inport': case 'outport': return `<rect class="blk" x="${x0}" y="${y0}" width="${w}" height="${h}" rx="8"/>` + T(o.val || '1', cx, cy + 4, 'bt sm');
      case 'term': return R() + P(`M${x0 + 4} ${y0 + 4} V${y0 + h - 4}`);
      case 'ground': return P(`M${cx} ${y0} V${cy} M${x0} ${cy} H${x0 + w} M${x0 + 4} ${cy + 4} H${x0 + w - 4} M${x0 + 7} ${cy + 8} H${x0 + w - 7}`);
      case 'subsys': case 'fcn': {
        let s = R(o.accent ? 'blk acc' : 'blk') + lines(o.text || '', 'bt sm');
        (o.inNames || []).forEach((t, k) => { s += T(t, x0 + 4, y0 + h * (k + 0.5) / b.nIn + 4, 'bt tiny', 'start'); });
        (o.outNames || []).forEach((t, k) => { s += T(t, x0 + w - 4, y0 + h * (k + 0.5) / b.nOut + 4, 'bt tiny', 'end'); });
        return s;
      }
      default: return R(o.accent ? 'blk acc' : 'blk') + lines(o.text || '', 'bt sm');
    }
  }

  Diagram.prototype.svg = function (title) {
    // габариты
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    const fit = (x, y) => { x1 = Math.min(x1, x); y1 = Math.min(y1, y); x2 = Math.max(x2, x); y2 = Math.max(y2, y); };
    const nameOf = b => b.o.name === false ? '' : (b.o.name || b.id);
    for (const id of this.order) {
      const b = this.b[id];
      fit(b.x - b.w / 2, b.y - b.h / 2); fit(b.x + b.w / 2, b.y + b.h / 2);
      const nm = nameOf(b); if (nm) { const nw = nm.length * 6.2; fit(b.x - nw / 2, b.y + b.h / 2 + 15); fit(b.x + nw / 2, b.y + b.h / 2 + 15); }
    }
    for (const l of this.lines) for (const p of l.pts) fit(p[0], p[1]);
    for (const t of this.texts) { const w = String(t.t).length * 7; fit(t.anchor === 'end' ? t.x - w : t.anchor === 'middle' ? t.x - w / 2 : t.x, t.y - 12); fit(t.anchor === 'start' ? t.x + w : t.anchor === 'middle' ? t.x + w / 2 : t.x, t.y + 4); }
    for (const l of this.lines) if (l.label) { const p = labelPos(l); const w = String(l.label).length * 7; fit(p[0] - w / 2, p[1] - 12); fit(p[0] + w / 2, p[1]); }
    const pad = 8, ox = pad - x1, oy = pad - y1;
    const W = Math.ceil(x2 - x1 + 2 * pad), H = Math.ceil(y2 - y1 + 2 * pad);
    let s = `<svg class="ssdm sl" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(title || 'Модель Simulink')}" xmlns="http://www.w3.org/2000/svg">`;
    s += `<defs><marker id="sla" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,1 L10,5 L0,9 z" class="arrowhead"/></marker></defs>`;
    s += `<g transform="translate(${ox.toFixed(1)},${oy.toFixed(1)})">`;
    for (const l of this.lines) s += `<polyline class="wire" points="${l.pts.map(p => p.join(',')).join(' ')}" marker-end="url(#sla)"/>`;
    for (const p of this.dots) s += `<circle class="dot" cx="${p[0]}" cy="${p[1]}" r="2.6"/>`;
    for (const l of this.lines) if (l.label) { const p = labelPos(l); s += `<text class="lbl sig" x="${p[0]}" y="${p[1]}" text-anchor="middle">${esc(l.label)}</text>`; }
    for (const id of this.order) {
      const b = this.b[id];
      const tip = b.o.tip ? `<g class="hv" tabindex="0" data-tip="${esc(id + '|' + b.o.tip)}"><title>${esc(id + ' — ' + b.o.tip)}</title>` : '<g>';
      s += tip + icon(b);
      const nm = nameOf(b);
      if (nm) s += `<text class="cap" x="${b.x}" y="${b.y + b.h / 2 + 12}" text-anchor="middle">${esc(nm)}</text>`;
      s += '</g>';
    }
    for (const t of this.texts) s += `<text class="lbl ${t.cls}" x="${t.x}" y="${t.y}" text-anchor="${t.anchor}">${esc(t.t)}</text>`;
    return s + '</g></svg>';
  };
  function labelPos(l) {
    if (l.lpos) return l.lpos;
    // середина самого длинного горизонтального участка
    let best = null, bl = -1;
    for (let k = 1; k < l.pts.length; k++) { const a = l.pts[k - 1], b = l.pts[k]; if (a[1] === b[1] && Math.abs(b[0] - a[0]) > bl) { bl = Math.abs(b[0] - a[0]); best = [(a[0] + b[0]) / 2, a[1] - 5]; } }
    return best || l.pts[0];
  }

  /* ---------- общее для MATLAB: позиции блоков [left top right bottom] ---------- */
  Diagram.prototype.pos = function (id) { const b = this.b[id]; return [b.x - b.w / 2, b.y - b.h / 2, b.x + b.w / 2, b.y + b.h / 2].map(v => Math.round(v)); };

  const api = { Diagram };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SLSVG = api;
})(typeof window !== 'undefined' ? window : globalThis);
