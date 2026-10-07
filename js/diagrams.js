/* diagrams.js — схемы моделей Simulink робота-балансира (SVG) с численными параметрами варианта */
(function (root) {
  'use strict';
  const CH = 7.1;   // ширина символа моноширинного шрифта 12px

  function num(x) {
    if (!isFinite(x)) return '?';
    const a = Math.abs(x);
    if (a !== 0 && (a < 1e-3 || a >= 1e5)) return x.toExponential(3).replace('e', 'e').replace('+', '');
    return (+x.toPrecision(4)).toString();
  }
  const SUP = { 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶' };
  function poly(p, v) {
    v = v || 's';
    const n = p.length - 1; let s = '';
    p.forEach((c, i) => {
      if (c === 0) return;
      const pw = n - i, a = Math.abs(c);
      const cs = (pw > 0 && Math.abs(a - 1) < 1e-12) ? '' : num(a);
      const term = cs + (pw > 0 ? v + (pw > 1 ? SUP[pw] || '^' + pw : '') : '');
      s += (s === '' ? (c < 0 ? '−' : '') : (c < 0 ? '−' : '+')) + term;
    });
    return s || '0';
  }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function Diagram() { this.els = []; this.nodes = {}; this.W = 0; this.H = 0; }
  // блок: content = {num, den} | {text} ; x,y — центр
  Diagram.prototype.block = function (id, x, y, content, opt) {
    opt = opt || {};
    let w, h;
    if (content.den !== undefined) { w = Math.max(content.num.length, content.den.length) * CH + 18; h = 44; }
    else { const lines = String(content.text).split('\n'); w = Math.max(...lines.map(l => l.length)) * CH + 18; h = 18 + lines.length * 15; }
    if (opt.w) w = Math.max(w, opt.w);
    const n = { id, x, y, w, h, content, opt, kind: 'block' };
    this.nodes[id] = n; this.els.push(n); this.fit(x + w / 2 + 10, y + h / 2 + (opt.cap ? 18 : 6)); return n;
  };
  // шина/мультиплексор Mux, Demux, Bus Creator — узкий залитый прямоугольник
  Diagram.prototype.bar = function (id, x, y1, y2) { const n = { id, x, y: (y1 + y2) / 2, w: 6, h: y2 - y1, content: { text: '' }, opt: { bar: true }, kind: 'block' }; this.nodes[id] = n; this.els.push(n); this.fit(x + 10, y2 + 6); return n; };
  Diagram.prototype.sum = function (id, x, y, signs) { const n = { id, x, y, r: 9, signs: signs || {}, kind: 'sum' }; this.nodes[id] = n; this.els.push(n); this.fit(x + 20, y + 20); return n; };
  Diagram.prototype.text = function (x, y, t, anchor, cls) { this.els.push({ kind: 'text', x, y, t, anchor: anchor || 'middle', cls: cls || '' }); this.fit(x + 40, y + 10); };
  Diagram.prototype.wire = function (pts, arrow) { this.els.push({ kind: 'wire', pts, arrow: arrow !== false }); pts.forEach(p => this.fit(p[0] + 10, p[1] + 10)); };
  Diagram.prototype.dot = function (x, y) { this.els.push({ kind: 'dot', x, y }); };
  // подписи для всплывающей подсказки: имя блока в модели Simulink
  Diagram.prototype.tag = function (map) { for (const [id, t] of Object.entries(map)) if (this.nodes[id]) this.nodes[id].sl = t; return this; };
  Diagram.prototype.fit = function (x, y) { this.W = Math.max(this.W, x); this.H = Math.max(this.H, y); };
  Diagram.prototype.port = function (id, side) {
    const n = this.nodes[id];
    if (n.kind === 'sum') return { l: [n.x - n.r, n.y], r: [n.x + n.r, n.y], t: [n.x, n.y - n.r], b: [n.x, n.y + n.r] }[side];
    return { l: [n.x - n.w / 2, n.y], r: [n.x + n.w / 2, n.y], t: [n.x, n.y - n.h / 2], b: [n.x, n.y + n.h / 2] }[side];
  };
  // последовательная цепочка блоков по горизонтали
  Diagram.prototype.chain = function (x0, y, items, gap) {
    gap = gap || 34; let x = x0; let prev = null;
    for (const it of items) {
      let n;
      if (it.sum) { n = this.sum(it.id, x + 9, y, it.signs); x += 18; }
      else {
        const tmp = it.content.den !== undefined ? Math.max(it.content.num.length, it.content.den.length) * CH + 18 : Math.max(...String(it.content.text).split('\n').map(l => l.length)) * CH + 18;
        const w = Math.max(tmp, (it.opt && it.opt.w) || 0);
        n = this.block(it.id, x + w / 2, y, it.content, it.opt); x += w;
      }
      if (prev) this.wire([this.port(prev.id, 'r'), this.port(n.id, 'l')]);
      if (it.labelBefore && prev) { const a = this.port(prev.id, 'r'), b = this.port(n.id, 'l'); this.text((a[0] + b[0]) / 2, y - 8, it.labelBefore, 'middle', 'sig'); }
      prev = n; x += gap;
    }
    return x - gap;
  };
  Diagram.prototype.svg = function (title) {
    const W = Math.ceil(this.W + 10), H = Math.ceil(this.H + 10);
    let s = `<svg class="ssdm" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(title || 'Структурная схема')}" xmlns="http://www.w3.org/2000/svg">`;
    s += `<defs><marker id="arr" viewBox="0 0 10 10" refX="9.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="arrowhead"/></marker></defs>`;
    for (const e of this.els) {
      if (e.kind === 'wire') s += `<polyline class="wire" points="${e.pts.map(p => p.join(',')).join(' ')}" ${e.arrow ? 'marker-end="url(#arr)"' : ''}/>`;
    }
    for (const e of this.els) {
      const tip = e.sl ? `<g class="hv" tabindex="0" data-tip="${esc(e.sl)}"><title>${esc(e.sl.replace('|', ' — '))}</title>` : '';
      if (tip) s += tip;
      if (e.kind === 'block') {
        const x = e.x - e.w / 2, y = e.y - e.h / 2;
        if (e.opt.bar) { s += `<rect class="bar" x="${x}" y="${y}" width="${e.w}" height="${e.h}"/>`; if (tip) s += '</g>'; continue; }
        s += `<rect class="blk${e.opt.accent ? ' acc' : ''}${e.opt.dashed ? ' dsh' : ''}" x="${x}" y="${y}" width="${e.w}" height="${e.h}" rx="2"/>`;
        if (e.content.den !== undefined) {
          s += `<text class="bt" x="${e.x}" y="${e.y - 6}" text-anchor="middle">${esc(e.content.num)}</text>`;
          s += `<line class="frac" x1="${x + 7}" x2="${x + e.w - 7}" y1="${e.y}" y2="${e.y}"/>`;
          s += `<text class="bt" x="${e.x}" y="${e.y + 15}" text-anchor="middle">${esc(e.content.den)}</text>`;
        } else {
          const lines = String(e.content.text).split('\n');
          lines.forEach((l, k) => { s += `<text class="bt" x="${e.x}" y="${e.y + 4 + (k - (lines.length - 1) / 2) * 15}" text-anchor="middle">${esc(l)}</text>`; });
        }
        if (e.opt.cap) s += `<text class="cap" x="${e.x}" y="${y + e.h + 13}" text-anchor="middle">${esc(e.opt.cap)}</text>`;
      } else if (e.kind === 'sum') {
        s += `<circle class="sum" cx="${e.x}" cy="${e.y}" r="${e.r}"/>`;
        s += `<line class="sumx" x1="${e.x - 6}" y1="${e.y - 6}" x2="${e.x + 6}" y2="${e.y + 6}"/><line class="sumx" x1="${e.x - 6}" y1="${e.y + 6}" x2="${e.x + 6}" y2="${e.y - 6}"/>`;
        const off = { l: [-15, -6], b: [-11, 21], t: [-11, -12], r: [13, -6] };
        for (const [side, sg] of Object.entries(e.signs)) { const o = off[side]; s += `<text class="sg" x="${e.x + o[0]}" y="${e.y + o[1]}">${sg === '-' ? '−' : '+'}</text>`; }
      } else if (e.kind === 'text') s += `<text class="lbl ${e.cls}" x="${e.x}" y="${e.y}" text-anchor="${e.anchor}">${esc(e.t)}</text>`;
      else if (e.kind === 'dot') s += `<circle class="dot" cx="${e.x}" cy="${e.y}" r="2.6"/>`;
      if (tip) s += '</g>';
    }
    return s + '</svg>';
  };

  const fx = (x, d) => (+x.toPrecision(d || 4)).toString().replace('.', ',');
  const sw = (d, x, y, t) => d.text(x, y, t, 'middle', 'sig');

  /* ---------------- рис. 19: модель в пространстве состояний ---------------- */
  function ss(R) {
    const d = new Diagram(), P = R.P;
    d.block('c', 40, 110, { text: fx(P.Uopen) }, { cap: 'Constant, В' });
    d.dot(86, 110);
    d.wire([d.port('c', 'r'), [86, 110]], false);
    d.bar('mux', 130, 88, 132);
    d.wire([[86, 110], [86, 100], [127, 100]]); d.wire([[86, 110], [86, 120], [127, 120]]);
    d.dot(165, 110); d.wire([[133, 110], [165, 110]], false);
    d.block('s1', 270, 50, { text: 'ẋ = A1·x + B1·u\ny = C1·x + D1·u' }, { accent: true, cap: 's1: θ, ψ, θ̇, ψ̇' });
    d.block('s2', 270, 175, { text: 'ẋ = A2·x + B2·u\ny = C2·x + D2·u' }, { accent: true, cap: 's2: φ, φ̇' });
    d.wire([[165, 110], [165, 50], d.port('s1', 'l')]); d.wire([[165, 110], [165, 175], d.port('s2', 'l')]);
    sw(d, 150, 102, 'u');
    d.bar('dm1', 400, 22, 78); d.bar('dm2', 400, 160, 190);
    d.wire([d.port('s1', 'r'), [397, 50]]); d.wire([d.port('s2', 'r'), [397, 175]]);
    d.block('sc1', 480, 50, { text: 'Scope' }, { cap: 'θ, ψ, θ̇, ψ̇' }); d.block('sc2', 480, 175, { text: 'Scope1' }, { cap: 'φ, φ̇' });
    [28, 43, 58, 72].forEach(y => d.wire([[403, y], [d.nodes.sc1.x - d.nodes.sc1.w / 2, y]]));
    [168, 182].forEach(y => d.wire([[403, y], [d.nodes.sc2.x - d.nodes.sc2.w / 2, y]]));
    return d.tag({ c: 'Constant|Напряжение на двигателях, В — подаётся на оба входа через Mux', mux: 'Mux|Mux, 2 входа — вектор управления u = [vl; vr]', s1: 'State-Space|A1, B1, C1, D1 — продольное движение и наклон', s2: 'State-Space1|A2, B2, C2, D2 — поворот', dm1: 'Demux|Demux, 4 выхода', dm2: 'Demux1|Demux, 2 выхода', sc1: 'Scope|Scope, 4 входа', sc2: 'Scope1|Scope, 2 входа' });
  }

  /* ---------------- рис. 29: системная модель ---------------- */
  function sys(R, withLqr) {
    const d = new Diagram();
    if (withLqr) { d.block('c', 50, 70, { text: 'ref' }, { cap: 'задающий вектор' }); d.wire([d.port('c', 'r'), [175, 70]]); sw(d, 140, 62, 'U'); }
    else {
      d.block('c', 36, 70, { text: fx(R.P.Uopen) }, { cap: 'Constant' });
      d.dot(76, 70); d.wire([d.port('c', 'r'), [76, 70]], false);
      d.bar('mux', 112, 54, 86); d.wire([[76, 70], [76, 62], [109, 62]]); d.wire([[76, 70], [76, 78], [109, 78]]);
      d.wire([[115, 70], [175, 70]]); sw(d, 145, 62, 'U');
    }
    d.block('ctl', 240, 85, { text: withLqr ? 'Controller\nget_states → K → K_PWM' : 'Controller\nU → Ctl' }, { w: 130 });
    const ctl = d.nodes.ctl; ctl.h = 64;
    d.wire([[ctl.x - ctl.w / 2 - 65, 70], [ctl.x - ctl.w / 2, 70]]);
    d.block('pl', 470, 85, { text: 'Plant\nReal_in → s1, s2 → датчики' }, { w: 190, accent: true });
    d.nodes.pl.h = 64;
    d.wire([d.port('ctl', 'r'), d.port('pl', 'l')]); sw(d, (ctl.x + ctl.w / 2 + d.nodes.pl.x - d.nodes.pl.w / 2) / 2, 78, 'Ctl (PWM)');
    const xr = d.nodes.pl.x + d.nodes.pl.w / 2 + 30;
    d.wire([d.port('pl', 'r'), [xr, 85], [xr, 170], [ctl.x - ctl.w / 2 - 20, 170], [ctl.x - ctl.w / 2 - 20, 100], [ctl.x - ctl.w / 2, 100]]);
    sw(d, (xr + ctl.x) / 2, 162, 'Data: enc, gyro');
    return d.tag({ ctl: 'Controller|Subsystem: входы U и Data, выход Ctl', pl: 'Plant|Subsystem: Real_in, State-Space, MATLAB Function, Real_out', mux: 'Mux|Mux, 2 входа', c: withLqr ? 'ref|Задающий вектор (Constant / Integrator → Mux)' : 'Constant|Задание ШИМ' });
  }

  /* ---------------- рис. 27/38: подсистема Plant ---------------- */
  function plant(R) {
    const d = new Diagram(), P = R.P, y = 110;
    d.text(10, y - 8, 'Ctl', 'start', 'sig'); d.wire([[10, y], [50, y]]);
    d.block('rin', 110, y, { text: 'Real_in / Ideal_in\nRound · 1/K_PWM · Sat' }, { w: 120, cap: '1/K_PWM = ' + fx(1 / R.KPWM) });
    d.nodes.rin.x = 50 + d.nodes.rin.w / 2;
    const xr = d.nodes.rin.x + d.nodes.rin.w / 2;
    d.dot(xr + 24, y); d.wire([[xr, y], [xr + 24, y]], false); sw(d, xr + 12, y - 8, 'V');
    const xs = xr + 24 + 100;
    d.block('s1', xs, 55, { text: 'ẋ = A1x + B1u\ny = C1x + D1u' }, { accent: true, cap: 'X0 = [0 Psi0 0 0]' });
    d.block('s2', xs, 170, { text: 'ẋ = A2x + B2u\ny = C2x + D2u' }, { accent: true });
    d.wire([[xr + 24, y], [xr + 24, 55], d.port('s1', 'l')]); d.wire([[xr + 24, y], [xr + 24, 170], d.port('s2', 'l')]);
    const xm = xs + d.nodes.s1.w / 2 + 40;
    d.bar('my', xm, 80, 140);
    d.wire([d.port('s1', 'r'), [xm - 20, 55], [xm - 20, 95], [xm - 3, 95]]); d.wire([d.port('s2', 'r'), [xm - 20, 170], [xm - 20, 125], [xm - 3, 125]]);
    d.block('fcn', xm + 95, y, { text: 'MATLAB Function\nfcn(y, R, W)' }, { cap: 'W/(2R) = ' + fx(P.W / (2 * P.R)) });
    d.wire([[xm + 3, y], d.port('fcn', 'l')]); sw(d, xm + 22, y - 8, 'y');
    const xf = d.nodes.fcn.x + d.nodes.fcn.w / 2;
    d.bar('md', xf + 40, 85, 135);
    [['enc_l', 95], ['enc_r', 110], ['gyro', 125]].forEach(([t, yy]) => d.wire([[xf, yy], [xf + 37, yy]]));
    d.block('rout', xf + 120, y, { text: 'Real_out\nRound' }, { cap: 'квантование 1°, 1°/с' });
    d.wire([[xf + 43, y], d.port('rout', 'l')]);
    const xo = d.nodes.rout.x + d.nodes.rout.w / 2;
    d.wire([[xo, y], [xo + 50, y]]); d.text(xo + 54, y - 8, 'Data', 'start', 'sig');
    return d.tag({ rin: 'Real_in|Variant Subsystem: Ideal_in (Gain 1/K_PWM) или Real_in (Round, Gain, Saturation)', s1: 'State-Space|A1, B1, C1, D1', s2: 'State-Space1|A2, B2, C2, D2', my: 'Mux|Mux, 2 входа — вектор выхода y (6)', fcn: 'MATLAB Function|enc_l, enc_r, gyro по формуле (37)', md: 'Mux|Mux, 3 входа (Bus Creator Data)', rout: 'Real_out|Variant Subsystem: квантование показаний датчиков' });
  }

  /* ---------------- рис. 52: подсистема get_states ---------------- */
  function getStates(R) {
    const d = new Diagram(), P = R.P;
    d.text(8, 162, 'Data', 'start', 'sig'); d.wire([[8, 170], [60, 170]]);
    d.bar('dm', 63, 100, 245);
    // энкодеры → θ
    d.sum('s1', 150, 110, { l: '+', b: '+' });
    d.wire([[66, 110], d.port('s1', 'l')]); sw(d, 92, 104, 'enc_l');
    d.dot(110, 110); d.dot(124, 140);
    d.wire([[66, 140], [150, 140], d.port('s1', 'b')]); sw(d, 92, 134, 'enc_r');
    d.block('g1', 245, 110, { text: '½·π/180' }, { cap: 'D2R, Gain 1/2' });
    d.wire([d.port('s1', 'r'), d.port('g1', 'l')]);
    d.sum('s2', 340, 110, { l: '+', b: '+' });
    d.wire([d.port('g1', 'r'), d.port('s2', 'l')]);
    d.dot(385, 110); d.wire([d.port('s2', 'r'), [385, 110]], false);
    const xb = 570;
    d.wire([[385, 110], [xb - 3, 110]]); d.text(xb - 8, 104, 'θ', 'end', 'sig');
    d.block('int1', 460, 50, { num: '1', den: 's' }); d.wire([[385, 110], [385, 50], d.port('int1', 'l')]); d.wire([d.port('int1', 'r'), [xb - 3, 50]]); d.text(xb - 8, 44, 'θint', 'end', 'sig');
    d.block('der1', 460, 170, { text: 'du/dt' }); d.wire([[385, 110], [385, 170], d.port('der1', 'l')]); d.wire([d.port('der1', 'r'), [xb - 3, 170]]); d.text(xb - 8, 164, 'θ̇', 'end', 'sig');
    // гироскоп → ψ, ψ̇
    d.block('g2', 175, 230, { text: 'π/180' }, { cap: 'D2R' });
    d.wire([[66, 230], d.port('g2', 'l')]); sw(d, 100, 224, 'gyro');
    d.dot(232, 230); d.wire([d.port('g2', 'r'), [232, 230]], false);
    d.block('int2', 285, 230, { num: '1', den: 's' }); d.wire([[232, 230], d.port('int2', 'l')]);
    d.dot(340, 230); d.wire([d.port('int2', 'r'), [340, 230]], false);
    d.wire([[340, 230], d.port('s2', 'b')]);
    d.wire([[340, 230], [xb - 3, 230]]); d.text(xb - 8, 224, 'ψ', 'end', 'sig');
    d.wire([[232, 230], [232, 285], [xb - 3, 285]]); d.text(xb - 8, 279, 'ψ̇', 'end', 'sig');
    // поворот φ
    d.sum('s3', 150, 340, { l: '-', b: '+' });
    d.wire([[110, 110], [110, 340], d.port('s3', 'l')]); d.wire([[124, 140], [124, 372], [150, 372], d.port('s3', 'b')]);
    d.block('g3', 245, 340, { text: 'R/W·π/180' }, { cap: 'R/W = ' + fx(P.R / P.W) });
    d.wire([d.port('s3', 'r'), d.port('g3', 'l')]);
    d.dot(330, 340); d.wire([d.port('g3', 'r'), [330, 340]], false);
    d.wire([[330, 340], [xb - 3, 340]]); d.text(xb - 8, 334, 'φ', 'end', 'sig');
    d.block('der2', 460, 395, { text: 'du/dt' }); d.wire([[330, 340], [330, 395], d.port('der2', 'l')]); d.wire([d.port('der2', 'r'), [xb - 3, 395]]); d.text(xb - 8, 389, 'φ̇', 'end', 'sig');
    d.bar('bc', xb, 30, 410);
    d.wire([[xb + 3, 220], [xb + 50, 220]]); d.text(xb + 54, 212, 'States', 'start', 'sig');
    return d.tag({ dm: 'Bus Selector|Сигналы enc (2) и gyro шины Data', s1: 'Sum of Elements|Сумма показаний энкодеров', g1: 'Degrees to Radians + Gain|Перевод в радианы и усреднение (½)', s2: 'Add|θ = ½(θml + θmr) + ψ', int1: 'Integrator|θint = ∫θ dt (для s3, s4)', der1: 'Derivative|θ̇ = dθ/dt', g2: 'Degrees to Radians1|ψ̇ в рад/с', int2: 'Integrator1|ψ = ∫ψ̇ dt', s3: 'Sum|θmr − θml', g3: 'Gain R/W|φ = R/W·(θmr − θml)', der2: 'Derivative1|φ̇ = dφ/dt', bc: 'Bus Creator|Шина States; Bus Selector задаёт порядок theta_int, theta, psi, theta_dot, psi_dot, phi, phi_dot' });
  }

  /* ---------------- рис. 45: подсистема Control ---------------- */
  function control(R) {
    const d = new Diagram(), y = 60;
    d.text(10, y - 8, 'ref', 'start', 'sig'); d.wire([[10, y], [190, y]]);
    d.sum('s', 199, y, { l: '+', b: '-' });
    d.text(10, 152, 'Data', 'start', 'sig');
    d.block('gs', 115, 160, { text: 'get_states' }, { dashed: true, w: 100 });
    d.wire([[10, 160], d.port('gs', 'l')]);
    d.bar('bv', 199, 145, 175);
    d.wire([d.port('gs', 'r'), [196, 160]]);
    d.wire([[199, 145], d.port('s', 'b')]); sw(d, 212, 120, 'X');
    d.block('k', 300, y, { text: 'Klqr·u' }, { accent: true, cap: 'Gain, Matrix(K*u)' });
    d.wire([d.port('s', 'r'), d.port('k', 'l')]); sw(d, 238, y - 8, 'e');
    d.block('kp', 420, y, { text: fx(R.KPWM, 6) }, { cap: 'K_PWM' });
    d.wire([d.port('k', 'r'), d.port('kp', 'l')]);
    d.wire([d.port('kp', 'r'), [510, y]]); d.text(514, y - 8, 'Ctl', 'start', 'sig');
    return d.tag({ s: 'Sum|«+−»: ошибка e = ref − X', gs: 'get_states|Подсистема оценки состояния', bv: 'Bus to Vector|Шина States → вектор X', k: 'Gain K|Klqr, Multiplication: Matrix(K*u)', kp: 'Gain K_PWM|Перевод напряжения в ШИМ' });
  }

  const api = { ss, sys, plant, getStates, control, num, poly };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.DIAG = api;
})(typeof window !== 'undefined' ? window : globalThis);
