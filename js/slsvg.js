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
 *
 * Подсказка блока (o.tip): строка — назначение блока, или { d: назначение, p: [[поле окна параметров, что ввести, откуда значение]] }.
 * Подписи блоков и сигналов раскладываются так, чтобы не ложиться на линии и другие блоки (layout()).
 */
(function (root) {
  'use strict';
  const CH = 6.9;   // ширина символа моноширинного шрифта 11,5px
  const CHS = 6.3;  // то же, 10,5px (значение Gain)
  const CHT = 5.4;  // то же, 9px (имена портов подсистем)
  const CHC = 5.9;  // подпись блока, 10,5px
  const CHL = 6.6;  // подпись сигнала, курсив 11,5px
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  const tw = s => String(s).length * CH;
  const maxLen = a => (a || []).reduce((m, s) => Math.max(m, String(s).length), 0);

  /* библиотека Simulink по типу блока (для подсказки) */
  const LIB = {
    step: 'Sources/Step', ramp: 'Sources/Ramp', clock: 'Sources/Clock', const: 'Sources/Constant', pulse: 'Sources/Pulse Generator', ground: 'Sources/Ground', inport: 'Sources/In1',
    tf: 'Continuous/Transfer Fcn', int: 'Continuous/Integrator', deriv: 'Continuous/Derivative', ss: 'Continuous/State-Space',
    gain: 'Math Operations/Gain', sum: 'Math Operations/Sum', add: 'Math Operations/Add', sumel: 'Math Operations/Sum of Elements', prod: 'Math Operations/Product', round: 'Math Operations/Rounding Function',
    sat: 'Discontinuities/Saturation', dss: 'Discrete/Discrete State-Space', zoh: 'Discrete/Zero-Order Hold',
    switch: 'Signal Routing/Switch', mux: 'Signal Routing/Mux', demux: 'Signal Routing/Demux',
    scope: 'Sinks/Scope', display: 'Sinks/Display', tows: 'Sinks/To Workspace', term: 'Sinks/Terminator', outport: 'Sinks/Out1',
    subsys: 'Ports & Subsystems/Subsystem', fcn: 'User-Defined Functions/MATLAB Function'
  };

  /* размеры по умолчанию для типов блоков */
  function size(t, o) {
    const lines = o.text ? String(o.text).split('\n') : [];
    const lw = lines.length ? Math.max(...lines.map(tw)) : 0;
    switch (t) {
      case 'tf': case 'int': case 'deriv': return [Math.max(36, Math.max(tw(o.num), tw(o.den)) + 18), 40];
      // значение Gain должно целиком помещаться в треугольник: ширина ≈ 1,5 × (текст + поле)
      case 'gain': return [Math.max(36, Math.ceil(1.5 * (String(o.val).length * CHS + 8))), Math.max(30, o.h || 0)];
      case 'sum': return [24, 24];
      case 'add': return [o.w || 26, o.h || Math.max(30, (o.nIn || (o.signs || '++').length) * 16)];
      case 'sumel': return [o.w || 30, o.h || 30];
      case 'step': case 'ramp': case 'clock': case 'zoh': case 'pulse': case 'prod': case 'sat': case 'scope': case 'term': case 'ground': case 'switch':
        return [o.w || (t === 'term' || t === 'ground' ? 20 : 32), o.h || (t === 'switch' ? 42 : t === 'term' || t === 'ground' ? 20 : 32)];
      case 'const': case 'display': case 'tows': case 'round': return [Math.max(t === 'display' ? 60 : 34, tw(o.val || o.text || '') + 16), 30];
      case 'mux': case 'demux': return [6, o.h || 40];
      case 'inport': case 'outport': return [30, 16];
      case 'ss': case 'dss': case 'fcn': case 'subsys': case 'box': {
        // имена портов слева и справа не должны наезжать на текст в середине
        const side = Math.max(maxLen(o.inNames), maxLen(o.outNames)) * CHT;
        const w = lw + 18 + (side ? 2 * (side + 6) : 0);
        const n = Math.max(o.nIn || 1, o.nOut || 1, (o.inNames || []).length, (o.outNames || []).length);
        return [Math.max(o.w || 0, w), Math.max(o.h || 0, 16 + lines.length * 14, n * 16)];
      }
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
    const bk = { id, t, x, y, w: Math.max(o.w || 0, w), h: Math.max(o.h || 0, h), o, nIn, nOut };
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
  /* линия: от выхода src/sk к входу dst/dk; opt.from — начать от точки ветвления (рисуется точка), opt.via — промежуточные точки,
   * opt.mx — абсцисса вертикального участка, opt.label — подпись сигнала, opt.lpos — её точка */
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
        if (((pts.length === 1 && !opt.from) || opt.mx != null) && ((dir === 'r' && p1[0] > a[0]) || (dir === 'l' && p1[0] < a[0]))) { const mx = opt.mx != null ? opt.mx : (a[0] + p1[0]) / 2; out.push([mx, a[1]], [mx, p1[1]]); }
        else out.push([a[0], p1[1]]);
      }
    } else if (a[0] !== p1[0]) out.push([p1[0], a[1]]);
    out.push(p1);
    this.lines.push({ src, sk, dst, dk, pts: tidy(out), label: opt.label, lpos: opt.lpos, arrow: true });
    return this;
  };
  /* убрать повторы и точки на одной прямой */
  function tidy(out) {
    const clean = [];
    for (const p of out) {
      const l = clean[clean.length - 1];
      if (l && l[0] === p[0] && l[1] === p[1]) continue;
      if (clean.length >= 2) { const l2 = clean[clean.length - 2]; if ((l2[0] === l[0] && l[0] === p[0]) || (l2[1] === l[1] && l[1] === p[1])) clean.pop(); }
      clean.push(p);
    }
    return clean;
  }
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
      case 'tf': case 'int': case 'deriv': return R(o.accent ? 'blk acc' : 'blk') + frac(o.num, o.den);
      case 'gain': {
        const pts = f ? `${x0 + w},${y0} ${x0 + w},${y0 + h} ${x0},${cy}` : `${x0},${y0} ${x0},${y0 + h} ${x0 + w},${cy}`;
        // текст у широкой стороны треугольника
        const t = String(o.val).length * CHS, tx = f ? x0 + w - 4 - t / 2 : x0 + 4 + t / 2;
        return `<polygon class="blk" points="${pts}"/>` + T(o.val, tx, cy + 3.8, 'bt gv');
      }
      case 'sum': {
        const r = w / 2;
        let s = `<circle class="sum" cx="${cx}" cy="${cy}" r="${r}"/>`;
        const ports = o.ports || ['l', 'b'], sg = (o.signs || '+-').replace(/\|/g, '');
        // знак — внутри круга у своего входа, как в Simulink
        ports.forEach((side, k) => {
          const c = sg[k] === '-' ? '−' : '+';
          const p = { l: [cx - r + 5.5, cy + 3.5], r: [cx + r - 5.5, cy + 3.5], t: [cx, cy - r + 10], b: [cx, cy + r - 4] }[side];
          s += `<text class="sg" x="${p[0]}" y="${p[1]}" text-anchor="middle">${c}</text>`;
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
      case 'add': return R() + String(o.signs || '++').split('').map((c, k) => T(c === '-' ? '−' : '+', x0 + 7, y0 + h * (k + 0.5) / b.nIn + 3.5, 'sg', 'middle')).join('');
      case 'switch': {
        const yi = k => y0 + h * (k - 0.5) / 3, xr = x0 + w;
        return R() + P(`M${x0} ${yi(1)} H${x0 + 9} M${x0} ${yi(3)} H${x0 + 9} M${x0 + 9} ${yi(1)} L${xr - 8} ${cy} H${xr}`) + `<circle class="ic" cx="${x0 + 9}" cy="${yi(3)}" r="1.8"/>` + T('>0', x0 + 13, yi(2) + 4, 'bt tiny', 'start');
      }
      case 'scope': return R() + `<rect class="ic" x="${x0 + 5}" y="${cy - 9}" width="${w - 10}" height="16"/>` + P(`M${x0 + 7} ${cy + 2} q4 -9 8 0 t8 0`, 'ic thin');
      case 'display': return R() + `<rect class="ic" x="${x0 + 4}" y="${y0 + 4}" width="${w - 8}" height="${h - 8}"/>` + T(o.val || '', cx, cy + 4, 'bt sm');
      case 'tows': return R() + T(o.val || 'simout', cx, cy + 4, 'bt sm');
      case 'const': case 'round': return R() + T(o.val || o.text, cx, cy + 4, 'bt sm');
      case 'mux': case 'demux': return `<rect class="bar" x="${x0}" y="${y0}" width="${w}" height="${h}"/>`;
      case 'inport': case 'outport': return `<rect class="blk" x="${x0}" y="${y0}" width="${w}" height="${h}" rx="8"/>` + T(o.val || '1', cx, cy + 4, 'bt sm');
      case 'term': return R() + P(`M${x0 + 4} ${y0 + 4} V${y0 + h - 4}`);
      case 'ground': return P(`M${cx} ${y0} V${cy} M${x0} ${cy} H${x0 + w} M${x0 + 4} ${cy + 4} H${x0 + w - 4} M${x0 + 7} ${cy + 8} H${x0 + w - 7}`);
      default: {
        let s = R(o.accent ? 'blk acc' : 'blk') + lines(o.text || '', 'bt sm');
        (o.inNames || []).forEach((t, k) => { s += T(t, x0 + 4, y0 + h * (k + 0.5) / b.nIn + 3, 'bt tiny', 'start'); });
        (o.outNames || []).forEach((t, k) => { s += T(t, x0 + w - 4, y0 + h * (k + 0.5) / b.nOut + 3, 'bt tiny', 'end'); });
        return s;
      }
    }
  }

  /* ---------- раскладка подписей ---------- */
  const hit = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  function segBox(a, b, m) { return [Math.min(a[0], b[0]) - m, Math.min(a[1], b[1]) - m, Math.max(a[0], b[0]) + m, Math.max(a[1], b[1]) + m]; }
  /* занятые места: прямоугольники блоков, отрезки линий, уже поставленные подписи */
  Diagram.prototype.layout = function () {
    const nameOf = b => b.o.name === false ? '' : (b.o.name || b.id);
    const boxes = [], segs = [];
    for (const id of this.order) { const b = this.b[id]; boxes.push([b.x - b.w / 2, b.y - b.h / 2, b.x + b.w / 2, b.y + b.h / 2]); }
    for (const l of this.lines) for (let k = 1; k < l.pts.length; k++) segs.push(segBox(l.pts[k - 1], l.pts[k], 0.5));
    const taken = [];
    const cost = r => {
      let c = 0;
      for (const s of segs) if (hit(r, s)) c += 3;
      for (const b of boxes) if (hit(r, b)) c += 5;
      for (const t of taken) if (hit(r, t)) c += 6;
      return c;
    };
    const place = cands => { let best = null, bc = Infinity; cands.forEach((c, k) => { const v = cost(c.r) + k * 0.01; if (v < bc) { bc = v; best = c; } }); taken.push(best.r); return best; };
    // свободные тексты фиксированы
    for (const t of this.texts) { const w = String(t.t).length * CHL; const x = t.anchor === 'end' ? t.x - w : t.anchor === 'middle' ? t.x - w / 2 : t.x; taken.push([x, t.y - 11, x + w, t.y + 3]); }
    // подписи блоков: под блоком, над ним, справа, слева
    const caps = [];
    for (const id of this.order) {
      const b = this.b[id], nm = nameOf(b); if (!nm) continue;
      const w = nm.length * CHC, x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, y0 = b.y - b.h / 2, y1 = b.y + b.h / 2;
      const C = (x, y, anc) => ({ x, y, anc, r: anc === 'middle' ? [x - w / 2, y - 9, x + w / 2, y + 2] : anc === 'start' ? [x, y - 9, x + w, y + 2] : [x - w, y - 9, x, y + 2] });
      const c = place([C(b.x, y1 + 12, 'middle'), C(b.x, y0 - 4, 'middle'), C(x1 + 3, y1 + 10, 'start'), C(x0 - 3, y1 + 10, 'end'), C(x1 + 3, y0 - 2, 'start'), C(x0 - 3, y0 - 2, 'end'), C(b.x, y1 + 24, 'middle')]);
      caps.push({ id, t: nm, x: c.x, y: c.y, anc: c.anc, r: c.r });
    }
    // подписи сигналов: над или под горизонтальным участком, справа или слева от вертикального
    const labs = [];
    for (const l of this.lines) {
      if (!l.label) continue;
      const w = String(l.label).length * CHL;
      const C = (x, y) => ({ x, y, r: [x - w / 2, y - 10, x + w / 2, y + 2] });
      if (l.lpos) { const c = C(l.lpos[0], l.lpos[1]); taken.push(c.r); labs.push({ t: l.label, x: c.x, y: c.y }); continue; }
      const cands = [];
      const sg = [];
      for (let k = 1; k < l.pts.length; k++) sg.push([l.pts[k - 1], l.pts[k]]);
      sg.map((s, k) => ({ s, k, len: Math.abs(s[1][0] - s[0][0]) + Math.abs(s[1][1] - s[0][1]), hz: s[0][1] === s[1][1] }))
        .sort((a, b) => (b.hz - a.hz) || (b.len - a.len))
        .forEach(({ s, hz, len }) => {
          const [a, e] = s;
          if (hz) {
            if (len < w + 8) return;
            const xa = Math.min(a[0], e[0]) + w / 2 + 4, xb = Math.max(a[0], e[0]) - w / 2 - 8;
            for (const fr of [0.5, 0.25, 0.75, 0, 1]) { const x = xa + (xb - xa) * fr; cands.push(C(x, a[1] - 4), C(x, a[1] + 13)); }
          } else {
            if (len < 18) return;
            const ym = (a[1] + e[1]) / 2 + 4;
            cands.push(C(a[0] + w / 2 + 4, ym), C(a[0] - w / 2 - 4, ym));
          }
        });
      if (!cands.length) { const p = l.pts[0]; cands.push(C(p[0] + w / 2 + 4, p[1] - 4)); }
      const c = place(cands);
      labs.push({ t: l.label, x: c.x, y: c.y });
    }
    return { caps, labs };
  };

  /* текст подсказки блока: { n, lib, d, p } в JSON */
  function tipData(b) {
    const t = b.o.tip; if (!t) return null;
    const o = typeof t === 'string' ? { d: t } : t;
    return { n: b.id, lib: b.libPath || LIB[b.t] || '', d: o.d || '', p: o.p || [] };
  }

  Diagram.prototype.svg = function (title) {
    const L = this.layout();
    // габариты
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    const fit = r => { x1 = Math.min(x1, r[0]); y1 = Math.min(y1, r[1]); x2 = Math.max(x2, r[2]); y2 = Math.max(y2, r[3]); };
    for (const id of this.order) { const b = this.b[id]; fit([b.x - b.w / 2, b.y - b.h / 2, b.x + b.w / 2, b.y + b.h / 2]); }
    for (const l of this.lines) for (const p of l.pts) fit([p[0], p[1], p[0], p[1]]);
    for (const t of this.texts) { const w = String(t.t).length * CHL; const x = t.anchor === 'end' ? t.x - w : t.anchor === 'middle' ? t.x - w / 2 : t.x; fit([x, t.y - 12, x + w, t.y + 4]); }
    for (const c of L.caps) fit(c.r);
    for (const c of L.labs) { const w = String(c.t).length * CHL; fit([c.x - w / 2, c.y - 12, c.x + w / 2, c.y + 3]); }
    const pad = 10, ox = pad - x1, oy = pad - y1;
    const W = Math.ceil(x2 - x1 + 2 * pad), H = Math.ceil(y2 - y1 + 2 * pad);
    let s = `<svg class="ssdm sl" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="max-width:${W}px;min-width:${Math.min(W, 720)}px" role="img" aria-label="${esc(title || 'Модель Simulink')}" xmlns="http://www.w3.org/2000/svg">`;
    s += `<defs><marker id="sla" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,1 L10,5 L0,9 z" class="arrowhead"/></marker></defs>`;
    s += `<g transform="translate(${ox.toFixed(1)},${oy.toFixed(1)})">`;
    for (const d of this.wirePaths()) s += `<path class="wire" d="${d}" marker-end="url(#sla)"/>`;
    for (const p of this.dots) s += `<circle class="dot" cx="${p[0]}" cy="${p[1]}" r="2.6"/>`;
    for (const c of L.labs) s += `<text class="lbl sig" x="${c.x}" y="${c.y}" text-anchor="middle">${esc(c.t)}</text>`;
    const capOf = {}; for (const c of L.caps) capOf[c.id] = c;
    for (const id of this.order) {
      const b = this.b[id], td = tipData(b);
      s += td ? `<g class="hv" tabindex="0" aria-label="${esc(id)}" data-tip="${esc(JSON.stringify(td))}">` : '<g>';
      s += icon(b);
      const c = capOf[id];
      if (c) s += `<text class="cap" x="${c.x}" y="${c.y}" text-anchor="${c.anc}">${esc(c.t)}</text>`;
      s += '</g>';
    }
    for (const t of this.texts) s += `<text class="lbl ${t.cls}" x="${t.x}" y="${t.y}" text-anchor="${t.anchor}">${esc(t.t)}</text>`;
    return s + '</g></svg>';
  };

  /* пути линий; где горизонтальный участок пересекает чужую вертикаль — «мостик» над ней, чтобы было видно, что линии не соединены */
  Diagram.prototype.wirePaths = function () {
    const net = l => l.free ? l : l.src + '/' + l.sk, R = 4;
    const vert = [];
    for (const l of this.lines) for (let k = 1; k < l.pts.length; k++) { const a = l.pts[k - 1], b = l.pts[k]; if (a[0] === b[0]) vert.push({ x: a[0], y1: Math.min(a[1], b[1]), y2: Math.max(a[1], b[1]), n: net(l) }); }
    return this.lines.map(l => {
      let d = `M${l.pts[0][0]},${l.pts[0][1]}`;
      for (let k = 1; k < l.pts.length; k++) {
        const a = l.pts[k - 1], b = l.pts[k];
        if (a[1] === b[1]) {
          const dir = b[0] > a[0] ? 1 : -1, lo = Math.min(a[0], b[0]), hi = Math.max(a[0], b[0]);
          const xs = vert.filter(v => v.n !== net(l) && v.x > lo + R + 1 && v.x < hi - R - 1 && a[1] > v.y1 && a[1] < v.y2).map(v => v.x).sort((p, q) => (p - q) * dir);
          for (const x of xs) d += ` L${x - R * dir},${a[1]} A${R},${R} 0 0 ${dir > 0 ? 1 : 0} ${x + R * dir},${a[1]}`;
        }
        d += ` L${b[0]},${b[1]}`;
      }
      return d;
    });
  };

  /* ---------- общее для MATLAB: позиции блоков [left top right bottom] ---------- */
  Diagram.prototype.pos = function (id) { const b = this.b[id]; return [b.x - b.w / 2, b.y - b.h / 2, b.x + b.w / 2, b.y + b.h / 2].map(v => Math.round(v)); };

  /* ---------- проверка чертежа: пересечения линий, линии через блоки, наложения текста ---------- */
  Diagram.prototype.lint = function () {
    const out = [], L = this.layout(), segs = [];
    this.lines.forEach((l, i) => { for (let k = 1; k < l.pts.length; k++) segs.push({ a: l.pts[k - 1], b: l.pts[k], i, net: l.free ? 'free' + i : l.src + '/' + l.sk, last: k === l.pts.length - 1, first: k === 1, l }); });
    const bx = id => { const b = this.b[id]; return [b.x - b.w / 2, b.y - b.h / 2, b.x + b.w / 2, b.y + b.h / 2]; };
    // линия через чужой блок
    for (const s of segs) for (const id of this.order) {
      const r = bx(id), q = segBox(s.a, s.b, 0);
      const inner = [r[0] + 1, r[1] + 1, r[2] - 1, r[3] - 1];
      if (hit(q, inner)) out.push(`линия ${s.net}→${s.l.dst || ''} проходит через блок ${id}`);
    }
    // пересечения и наложения линий разных сигналов
    for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
      const s = segs[i], t = segs[j]; if (s.net === t.net) continue;
      const sh = s.a[1] === s.b[1], th = t.a[1] === t.b[1];
      if (sh !== th) {
        const h = sh ? s : t, v = sh ? t : s, y = h.a[1], x = v.a[0];
        if (x > Math.min(h.a[0], h.b[0]) && x < Math.max(h.a[0], h.b[0]) && y > Math.min(v.a[1], v.b[1]) && y < Math.max(v.a[1], v.b[1])) out.push(`пересечение ${s.net}→${s.l.dst || ''} и ${t.net}→${t.l.dst || ''} в (${x}, ${y})`);
      } else if (sh && s.a[1] === t.a[1]) {
        if (Math.min(Math.max(s.a[0], s.b[0]), Math.max(t.a[0], t.b[0])) - Math.max(Math.min(s.a[0], s.b[0]), Math.min(t.a[0], t.b[0])) > 0.5) out.push(`наложение ${s.net} и ${t.net} по y=${s.a[1]}`);
      } else if (!sh && s.a[0] === t.a[0]) {
        if (Math.min(Math.max(s.a[1], s.b[1]), Math.max(t.a[1], t.b[1])) - Math.max(Math.min(s.a[1], s.b[1]), Math.min(t.a[1], t.b[1])) > 0.5) out.push(`наложение ${s.net} и ${t.net} по x=${s.a[0]}`);
      }
    }
    // блоки друг на друге
    for (let i = 0; i < this.order.length; i++) for (let j = i + 1; j < this.order.length; j++) if (hit(bx(this.order[i]), bx(this.order[j]))) out.push(`блоки ${this.order[i]} и ${this.order[j]} перекрываются`);
    // подписи
    const texts = L.caps.map(c => ({ t: 'подпись ' + c.t, r: c.r })).concat(L.labs.map(c => { const w = String(c.t).length * CHL; return { t: 'сигнал ' + c.t, r: [c.x - w / 2, c.y - 10, c.x + w / 2, c.y + 2] }; }));
    for (const t of texts) {
      for (const s of segs) if (hit(t.r, segBox(s.a, s.b, 0.5))) { out.push(`${t.t} лежит на линии ${s.net}`); break; }
      for (const id of this.order) if (hit(t.r, bx(id))) { out.push(`${t.t} лежит на блоке ${id}`); break; }
    }
    for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) if (hit(texts[i].r, texts[j].r)) out.push(`${texts[i].t} и ${texts[j].t} накладываются`);
    // блоки без подсказки
    for (const id of this.order) if (!this.b[id].o.tip) out.push(`у блока ${id} нет подсказки`);
    return out;
  };

  const api = { Diagram, LIB };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SLSVG = api;
})(typeof window !== 'undefined' ? window : globalThis);
