/* =====================================================================
 * labs.js — расчёты лабораторной работы «Робот-балансир» по методичке
 * курса «Конструирование роботов и робототехнических систем»:
 * математическая модель (метод Лагранжа), модель в пространстве
 * состояний, системная модель с датчиками и ШИМ, LQR-регулятор.
 * ===================================================================== */
(function (root) {
  'use strict';
  const NC = root.NC || (typeof require !== 'undefined' ? require('./core.js') : null);
  const LA = root.LA || (typeof require !== 'undefined' ? require('./linalg.js') : null);
  const D = root.LABDATA || (typeof require !== 'undefined' ? require('./data.js') : null);
  const PI = Math.PI, R2D = 180 / PI, D2R = PI / 180;

  /* ---------- форматирование (как в утилите «Электропривод») ---------- */
  let DIG = -1;
  function fdec(x, N) {
    if (x === null || x === undefined || isNaN(x)) return '—';
    if (!isFinite(x)) return x > 0 ? '∞' : '−∞';
    if (x === 0) return '0';
    const ax = Math.abs(x);
    if (ax >= 1e6 || ax < 1e-4) return fnum(x, N + 1);
    let s = ax < Math.pow(10, 1 - N) ? x.toPrecision(2) : x.toFixed(N);
    s = parseFloat(s).toString();
    return s.replace('.', ',');
  }
  function fauto(x) {
    if (x === null || x === undefined || isNaN(x)) return '—';
    if (!isFinite(x)) return x > 0 ? '∞' : '−∞';
    if (x === 0) return '0';
    const ax = Math.abs(x);
    if (ax >= 1e6 || ax < 1e-4) return fnum(x, 4);
    const d = Math.floor(Math.log10(ax)) + 1;
    const s = d >= 4 ? String(Math.round(x)) : parseFloat(x.toPrecision(4)).toString();
    return s.replace('.', ',');
  }
  function fnum(x, sig) {
    if (!sig) return DIG < 0 ? fauto(x) : fdec(x, DIG);
    if (x === null || x === undefined || isNaN(x)) return '—';
    if (!isFinite(x)) return x > 0 ? '∞' : '−∞';
    if (x === 0) return '0';
    const ax = Math.abs(x);
    if (ax >= 1e5 || ax < 1e-4) {
      const e = Math.floor(Math.log10(ax));
      let m = x / Math.pow(10, e);
      let ms = parseFloat(m.toPrecision(sig)).toString();
      if (ms === '10' || ms === '-10') { m /= 10; ms = parseFloat(m.toPrecision(sig)).toString(); return ms.replace('.', ',') + '·10^' + (e + 1); }
      return ms.replace('.', ',') + '·10^' + e;
    }
    let s;
    if (ax >= 1000) { const d = Math.floor(Math.log10(ax)) + 1; s = d > sig ? String(Math.round(x / Math.pow(10, d - sig)) * Math.pow(10, d - sig)) : parseFloat(x.toFixed(sig - d)).toString(); }
    else s = parseFloat(x.toPrecision(sig)).toString();
    return s.replace('.', ',');
  }
  function n(x, sig) {
    const s = fnum(x, sig);
    if (s.indexOf('·10^') >= 0) { const [mm, e] = s.split('·10^'); return mm.replace(',', '{,}') + '\\cdot 10^{' + e + '}'; }
    return s.replace(',', '{,}').replace('−', '-');
  }
  function m(x) {
    if (!isFinite(x)) return x > 0 ? 'Inf' : '-Inf';
    if (x === 0) return '0';
    const s = parseFloat(x.toPrecision(10)).toString();
    return s.replace('e+', 'e');
  }
  function mvec(a) { return '[' + a.map(m).join(' ') + ']'; }
  function mmat(A) { return '[' + A.map(r => r.map(m).join(' ')).join('; ') + ']'; }
  /* матрица в LaTeX */
  function mtex(A, sig) {
    sig = sig || 4;
    return '\\begin{bmatrix}' + A.map(r => r.map(v => Math.abs(v) < 1e-14 ? '0' : n(v, sig)).join(' & ')).join(' \\\\ ') + '\\end{bmatrix}';
  }
  function vtex(names) { return '\\begin{bmatrix}' + names.join(' \\\\ ') + '\\end{bmatrix}'; }
  /* комплексное число в LaTeX: a ± jb */
  function ctex(z, sig) {
    sig = sig || 4;
    if (Math.abs(z[1]) < 1e-12) return n(z[0], sig);
    return n(z[0], sig) + (z[1] < 0 ? ' - ' : ' + ') + 'j\\,' + n(Math.abs(z[1]), sig);
  }
  function eigTex(ev, name) {
    // сопряжённые пары выводим одной строкой a ± jb
    const out = []; let k = 1;
    for (let i = 0; i < ev.length; i++) {
      const z = ev[i];
      if (z[1] > 0 && i + 1 < ev.length && Math.abs(ev[i + 1][1] + z[1]) < 1e-9 * (1 + Math.abs(z[1]))) {
        out.push(`${name}_{${k},${k + 1}} = ${n(z[0], 4)} \\pm j\\,${n(z[1], 4)}`); k += 2; i++;
      } else { out.push(`${name}_{${k}} = ${n(z[0], 4)}`); k++; }
    }
    return out.join(';\\quad ');
  }

  /* ---------- построитель отчёта ---------- */
  function Report() { this.items = []; }
  Report.prototype.h = function (t) { this.items.push({ k: 'h', t }); return this; };
  Report.prototype.p = function (t) { this.items.push({ k: 'p', t }); return this; };
  Report.prototype.note = function (t, kind) { this.items.push({ k: 'note', t, kind: kind || 'info' }); return this; };
  Report.prototype.eq = function (lhs, formula, subst, val, unit, sig) { this.items.push({ k: 'eq', lhs, formula, subst, val, unit: unit || '', sig: sig || 4 }); return this; };
  Report.prototype.tex = function (t, desc) { this.items.push({ k: 'tex', t, desc }); return this; };
  Report.prototype.check = function (tex, ok, text) { this.items.push({ k: 'check', tex, ok, t: text }); return this; };
  Report.prototype.table = function (head, rows, caption) { this.items.push({ k: 'table', head, rows, caption }); return this; };
  Report.prototype.code = function (t, lang, title) { this.items.push({ k: 'code', t, lang: lang || 'matlab', title }); return this; };
  Report.prototype.webOnly = function () { this.items[this.items.length - 1].web = true; return this; };
  Report.prototype.repOnly = function () { this.items[this.items.length - 1].repOnly = true; return this; };
  Report.prototype.rep = function (t) { this.items[this.items.length - 1].rep = t; return this; };
  Report.prototype.plot = function (id, title) { this.items.push({ k: 'plot', id, title }); return this; };
  Report.prototype.simres = function (id, title) { this.items.push({ k: 'simres', id, title }); return this; };
  Report.prototype.diagram = function (id, title) { this.items.push({ k: 'diagram', id, title }); return this; };

  /* ---------- исходные данные ---------- */
  const VKEYS = ['m', 'R', 'M', 'W', 'D', 'h', 'fw', 'fm', 'Jm', 'Rm', 'Kb', 'Kt', 'n'];
  function defaults() {
    const v = D.variants.find(x => x.no === 1);
    const d = { variant: 1 };
    VKEYS.forEach(k => d[k] = v[k]);
    return Object.assign(d, {
      g: 9.81, Upit: 12, PWMmax: 127, Psi0: 0.01, vref: 1, wref: 1, Tsim: 10, dt: 'auto', qw: 1, rw: 1, Uopen: 1,
      dec: -1, satOrder: 'pdf', kpwmRound: true
    });
  }
  function fromVariant(no) {
    const v = D.variants.find(x => x.no === +no) || D.variants[1];
    const d = defaults();
    d.variant = v.no; VKEYS.forEach(k => d[k] = v[k]);
    return d;
  }

  /* ---------- модель ---------- */
  function buildModel(P, g) {
    const { m: mw, R, M, W, h, fw, fm, Jm, Rm, Kb, Kt } = P, Dd = P.D, nn = P.n;
    const Jw = mw * R * R / 2, L = h / 2, Jpsi = M * L * L / 3, Jphi = M * (W * W + Dd * Dd) / 12;
    const alpha = nn * Kt / Rm, beta = nn * Kt * Kb / Rm + fm;
    const E11 = (2 * mw + M) * R * R + 2 * Jw + 2 * nn * nn * Jm, E12 = M * L * R - 2 * nn * nn * Jm, E22 = M * L * L + Jpsi + 2 * nn * nn * Jm;
    const E = [[E11, E12], [E12, E22]];
    const F = [[2 * (beta + fw), -2 * beta], [-2 * beta, 2 * beta]];
    const G = [[0, 0], [0, -M * g * L]];
    const H = [[alpha, alpha], [-alpha, -alpha]];
    const I = mw * W * W / 2 + Jphi + (Jw + nn * nn * Jm) * W * W / (2 * R * R);
    const J = W * W / (2 * R * R) * (beta + fw);
    const K = W / (2 * R) * alpha;
    const Ei = LA.inv(E), EG = LA.mul(Ei, G), EF = LA.mul(Ei, F), EH = LA.mul(Ei, H);
    const A1 = LA.block([[LA.zeros(2, 2), LA.eye(2)], [LA.sc(EG, -1), LA.sc(EF, -1)]]);
    const B1 = LA.block([[LA.zeros(2, 2)], [EH]]);
    const A2 = [[0, 1], [0, -J / I]], B2 = [[0, 0], [-K / I, K / I]];
    return { Jw, L, Jpsi, Jphi, alpha, beta, E11, E12, E22, E, F, G, H, I, J, K, Ei, EG, EF, EH, A1, B1, A2, B2, g };
  }
  function extend(md) {
    const A3 = LA.zeros(5, 5);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) A3[i + 1][j + 1] = md.A1[i][j];
    A3[0][1] = 1;
    const B3 = [[0, 0]].concat(md.B1);
    const A4 = LA.blkdiag(A3, md.A2), B4 = B3.concat(md.B2);
    return { A3, B3, A4, B4 };
  }

  /* =================================================================
   * ГЛАВНЫЙ РАСЧЁТ
   * ================================================================= */
  function compute(P) {
    DIG = P.dec === undefined || +P.dec < 0 ? -1 : Math.min(6, +P.dec);
    const R = { P };
    const g = Math.abs(P.g);
    const md = buildModel(P, g), mdn = buildModel(P, -g);
    const ex = extend(md);
    const KPWMx = P.PWMmax / P.Upit, KPWM = P.kpwmRound ? Math.round(KPWMx * 100) / 100 : KPWMx;
    const Q4 = LA.sc(LA.eye(4), P.qw), Q5 = LA.sc(LA.eye(5), P.qw), Q7 = LA.sc(LA.eye(7), P.qw), RR = LA.sc(LA.eye(2), P.rw);
    const l1 = LA.lqr(md.A1, md.B1, Q4, RR), l3 = LA.lqr(ex.A3, ex.B3, Q5, RR), l4 = LA.lqr(ex.A4, ex.B4, Q7, RR);
    const eig1 = LA.eig(md.A1), eig1n = LA.eig(mdn.A1), eig2 = LA.eig(md.A2);
    R.md = md; R.mdn = mdn; R.ex = ex; R.KPWM = KPWM; R.KPWMx = KPWMx;
    R.lqr = { s1: l1, s3: l3, s4: l4 };
    R.eig1 = eig1; R.eig1n = eig1n; R.eig2 = eig2;
    const lamU = Math.max(...eig1.map(z => z[0]));
    R.lamU = lamU;
    /* шаг моделирования: дискретное дифференцирование в контуре требует шага меньше постоянной времени быстрейшего полюса */
    R.pmax = Math.max(...[l1, l3, l4].map(l => Math.max(...l.poles.map(z => Math.hypot(z[0], z[1])))));
    R.dtAuto = [1e-3, 5e-4, 2e-4, 1e-4, 5e-5, 2e-5, 1e-5].find(d => d <= 0.3 / R.pmax) || 1e-5;
    R.dt = P.dt === 'auto' || !(+P.dt > 0) ? R.dtAuto : +P.dt;
    const osc = eig1n.find(z => z[1] > 1e-9);
    R.osc = osc ? { s: osc[0], w: osc[1], T: 2 * PI / osc[1], zeta: -osc[0] / Math.hypot(osc[0], osc[1]), tdec: 3 / Math.abs(osc[0]) } : null;
    const v0 = P.Uopen;
    R.thdSS = md.alpha * v0 / (md.beta + P.fw);
    R.psiSS = 2 * md.alpha * v0 * P.fw / ((md.beta + P.fw) * P.M * g * md.L);

    const f = fnum;
    /* ======================= ЭТАП 1. Математическая модель ======================= */
    const L1 = new Report();
    L1.h('1.1. Исходные данные' + (P.variant ? ' (вариант ' + P.variant + ')' : ' (пример из методички)')).webOnly();
    L1.table(['Параметр', 'Обозначение', 'Значение'], [
      ['Масса колеса', 'm', f(P.m) + ' кг'], ['Радиус колеса', 'R', f(P.R) + ' м'], ['Масса робота (корпуса)', 'M', f(P.M) + ' кг'],
      ['Ширина робота', 'W', f(P.W) + ' м'], ['Толщина робота', 'D', f(P.D) + ' м'], ['Высота робота', 'h', f(P.h) + ' м'],
      ['Коэффициент вязкого трения колесо–пол', 'f_w', f(P.fw)], ['Коэффициент вязкого трения в двигателе', 'f_m', f(P.fm)],
      ['Момент инерции ротора двигателя', 'J_m', f(P.Jm) + ' кг·м²'], ['Сопротивление обмотки двигателя', 'R_m', f(P.Rm) + ' Ом'],
      ['Коэффициент противо-ЭДС', 'K_b', f(P.Kb) + ' В·с/рад'], ['Коэффициент передачи по току', 'K_t', f(P.Kt) + ' Н·м/А'],
      ['Передаточное число редуктора', 'n', f(P.n)], ['Ускорение свободного падения', 'g', f(g) + ' м/с²']
    ]);
    L1.p('Двухколёсный робот-балансир рассматривается как двухколёсный перевёрнутый маятник (рис. 14–15 методички). Обобщённые координаты: θ — средний угол поворота левого и правого колёс, ψ — угол тангажа (наклона) корпуса, φ — угол рыскания (поворота) корпуса.');
    L1.h('1.2. Геометрия и моменты инерции');
    L1.p('Колесо считаем однородным диском, корпус — однородным параллелепипедом высотой h, центр масс которого находится на половине высоты:');
    L1.eq('J_w', '\\dfrac{mR^2}{2}', `\\dfrac{${n(P.m)}\\cdot ${n(P.R)}^2}{2}`, md.Jw, 'кг·м²');
    L1.eq('L', '\\dfrac{h}{2}', `\\dfrac{${n(P.h)}}{2}`, md.L, 'м');
    L1.eq('J_\\psi', '\\dfrac{ML^2}{3}', `\\dfrac{${n(P.M)}\\cdot ${n(md.L)}^2}{3}`, md.Jpsi, 'кг·м²');
    L1.eq('J_\\phi', '\\dfrac{M\\left(W^2+D^2\\right)}{12}', `\\dfrac{${n(P.M)}\\left(${n(P.W)}^2+${n(P.D)}^2\\right)}{12}`, md.Jphi, 'кг·м²');
    L1.h('1.3. Уравнения движения (метод Лагранжа)');
    L1.p('Положение робота задаём средним углом поворота колёс и углом направления движения:');
    L1.tex('\\theta=\\dfrac{1}{2}\\left(\\theta_l+\\theta_r\\right),\\qquad \\phi=\\dfrac{R}{W}\\left(\\theta_r-\\theta_l\\right)');
    L1.p('Поступательная T<sub>1</sub>, вращательная T<sub>2</sub> кинетическая и потенциальная U энергии образуют функцию Лагранжа L = T<sub>1</sub> + T<sub>2</sub> − U; уравнения Лагранжа по обобщённым координатам θ, ψ, φ:');
    L1.tex('\\dfrac{d}{dt}\\left(\\dfrac{\\partial L}{\\partial\\dot\\theta}\\right)-\\dfrac{\\partial L}{\\partial\\theta}=F_\\theta,\\quad \\dfrac{d}{dt}\\left(\\dfrac{\\partial L}{\\partial\\dot\\psi}\\right)-\\dfrac{\\partial L}{\\partial\\psi}=F_\\psi,\\quad \\dfrac{d}{dt}\\left(\\dfrac{\\partial L}{\\partial\\dot\\phi}\\right)-\\dfrac{\\partial L}{\\partial\\phi}=F_\\phi');
    L1.p('В результате получаем нелинейные уравнения движения робота:');
    L1.tex('\\left[(2m+M)R^2+2J_w+2n^2J_m\\right]\\ddot\\theta+\\left(MLR\\cos\\psi-2n^2J_m\\right)\\ddot\\psi-MLR\\dot\\psi^2\\sin\\psi=F_\\theta');
    L1.tex('\\left(MLR\\cos\\psi-2n^2J_m\\right)\\ddot\\theta+\\left(ML^2+J_\\psi+2n^2J_m\\right)\\ddot\\psi-MgL\\sin\\psi-ML^2\\dot\\phi^2\\sin\\psi\\cos\\psi=F_\\psi');
    L1.tex('\\left[\\dfrac{1}{2}mW^2+J_\\phi+\\dfrac{W^2}{2R^2}\\left(J_w+n^2J_m\\right)+ML^2\\sin^2\\psi\\right]\\ddot\\phi+2ML^2\\dot\\psi\\dot\\phi\\sin\\psi\\cos\\psi=F_\\phi');
    L1.h('1.4. Внешние моменты и параметры двигателя');
    L1.p('Момент на валу двигателя пропорционален питающему напряжению v; противо-ЭДС и вязкое трение в двигателе создают демпфирующий момент, со стороны пола действует сила трения, пропорциональная скорости:');
    L1.tex('F_m=\\alpha v-\\beta\\dot\\theta_m,\\qquad F_w=-f_w\\dot\\theta');
    L1.eq('\\alpha', '\\dfrac{nK_t}{R_m}', `\\dfrac{${n(P.n)}\\cdot ${n(P.Kt)}}{${n(P.Rm)}}`, md.alpha, 'Н·м/В');
    L1.eq('\\beta', '\\dfrac{nK_tK_b}{R_m}+f_m', `\\dfrac{${n(P.n)}\\cdot ${n(P.Kt)}\\cdot ${n(P.Kb)}}{${n(P.Rm)}}+${n(P.fm)}`, md.beta, 'Н·м·с/рад');
    L1.p('Суммарные обобщённые силы:');
    L1.tex('F_\\theta=F_{m_r}+F_{m_l}+F_{w_r}+F_{w_l},\\qquad F_\\psi=-F_{m_r}-F_{m_l},\\qquad F_\\phi=\\dfrac{W}{2R}\\left(F_{m_r}-F_{m_l}+F_{w_r}-F_{w_l}\\right)');
    L1.h('1.5. Линеаризованная модель');
    L1.p('Линеаризуем уравнения в точке равновесия: при ψ → 0 принимаем sin ψ → ψ, cos ψ → 1 и пренебрегаем членами второго порядка (ψ̇²). Уравнения продольного движения и наклона в матричной форме:');
    L1.tex('E\\begin{bmatrix}\\ddot\\theta\\\\ \\ddot\\psi\\end{bmatrix}+F\\begin{bmatrix}\\dot\\theta\\\\ \\dot\\psi\\end{bmatrix}+G\\begin{bmatrix}\\theta\\\\ \\psi\\end{bmatrix}=H\\begin{bmatrix}v_l\\\\ v_r\\end{bmatrix}');
    L1.eq('E_{11}', '(2m+M)R^2+2J_w+2n^2J_m', `(2\\cdot ${n(P.m)}+${n(P.M)})\\cdot ${n(P.R)}^2+2\\cdot ${n(md.Jw)}+2\\cdot ${n(P.n)}^2\\cdot ${n(P.Jm)}`, md.E11, 'кг·м²');
    L1.eq('E_{12}', 'MLR-2n^2J_m', `${n(P.M)}\\cdot ${n(md.L)}\\cdot ${n(P.R)}-2\\cdot ${n(P.n)}^2\\cdot ${n(P.Jm)}`, md.E12, 'кг·м²');
    L1.eq('E_{22}', 'ML^2+J_\\psi+2n^2J_m', `${n(P.M)}\\cdot ${n(md.L)}^2+${n(md.Jpsi)}+2\\cdot ${n(P.n)}^2\\cdot ${n(P.Jm)}`, md.E22, 'кг·м²');
    L1.eq('MgL', '', `${n(P.M)}\\cdot ${n(g)}\\cdot ${n(md.L)}`, P.M * g * md.L, 'Н·м');
    L1.p('Матричные коэффициенты линеаризованной модели:');
    L1.tex('E=\\begin{bmatrix}E_{11} & E_{12}\\\\ E_{12} & E_{22}\\end{bmatrix}=' + mtex(md.E), 'E');
    L1.tex('F=2\\begin{bmatrix}\\beta+f_w & -\\beta\\\\ -\\beta & \\beta\\end{bmatrix}=' + mtex(md.F), 'F');
    L1.tex('G=\\begin{bmatrix}0 & 0\\\\ 0 & -MgL\\end{bmatrix}=' + mtex(md.G), 'G');
    L1.tex('H=\\begin{bmatrix}\\alpha & \\alpha\\\\ -\\alpha & -\\alpha\\end{bmatrix}=' + mtex(md.H), 'H');
    L1.note('В формуле (28) методички в матрице F множитель напечатан как «s», а в матрице H нижний правый элемент — как «α». В листинге MATLAB той же методички F = 2[β+f<sub>w</sub> −β; −β β], H = [α α; −α −α]. Расчёт выполнен по листингу: с этими матрицами для примера методички получается приведённый в ней результат K<sub>lqr</sub> = [−0,7071 −39,46 −1,5731 −4,0596].', 'warn').webOnly();
    L1.h('1.6. Уравнение поворота');
    L1.p('Уравнение (27) содержит только угол рыскания φ; запишем его в виде:');
    L1.tex('I\\ddot\\phi+J\\dot\\phi=K\\left(v_r-v_l\\right)');
    L1.eq('I', '\\dfrac{1}{2}mW^2+J_\\phi+\\dfrac{W^2}{2R^2}\\left(J_w+n^2J_m\\right)', `\\dfrac{1}{2}\\cdot ${n(P.m)}\\cdot ${n(P.W)}^2+${n(md.Jphi)}+\\dfrac{${n(P.W)}^2}{2\\cdot ${n(P.R)}^2}\\left(${n(md.Jw)}+${n(P.n)}^2\\cdot ${n(P.Jm)}\\right)`, md.I, 'кг·м²');
    L1.eq('J', '\\dfrac{W^2}{2R^2}\\left(\\beta+f_w\\right)', `\\dfrac{${n(P.W)}^2}{2\\cdot ${n(P.R)}^2}\\left(${n(md.beta)}+${n(P.fw)}\\right)`, md.J, 'Н·м·с/рад');
    L1.eq('K', '\\dfrac{W}{2R}\\alpha', `\\dfrac{${n(P.W)}}{2\\cdot ${n(P.R)}}\\cdot ${n(md.alpha)}`, md.K, 'Н·м/В');

    /* ======================= ЭТАП 2. Пространство состояний ======================= */
    const L2 = new Report();
    L2.h('2.1. Метод пространства состояний');
    L2.p('Математическая модель динамической системы в пространстве состояний состоит из уравнения состояния (система дифференциальных уравнений первого порядка в нормальной форме Коши) и алгебраического уравнения выхода:');
    L2.tex('\\begin{cases}\\dot x(t)=Ax(t)+Bu(t)\\\\ y(t)=Cx(t)+Du(t)\\end{cases}');
    L2.p('Здесь x — вектор состояния, u — вектор управления, y — вектор выхода; A — матрица системы, B — матрица управления, C — матрица выхода, D — матрица прямой связи.');
    L2.h('2.2. Модель поворота робота');
    L2.p('Уравнение (29) второго порядка, поэтому система поворота имеет два состояния: x<sub>1</sub> = φ — угол поворота, x<sub>2</sub> = φ̇ — скорость поворота. Управляющие величины — напряжения на левом и правом двигателях u = [v<sub>l</sub>; v<sub>r</sub>], на выходе — y = [φ; φ̇]. Разрешим уравнение относительно старшей производной:');
    L2.tex('\\ddot\\phi=-\\dfrac{J}{I}\\dot\\phi+\\dfrac{K}{I}\\left(v_r-v_l\\right)');
    L2.eq('\\dfrac{J}{I}', '', `\\dfrac{${n(md.J)}}{${n(md.I)}}`, md.J / md.I, 'с⁻¹');
    L2.eq('\\dfrac{K}{I}', '', `\\dfrac{${n(md.K)}}{${n(md.I)}}`, md.K / md.I, 'рад/(В·с²)');
    L2.p('Матрицы модели поворота:');
    L2.tex('A_2=\\begin{bmatrix}0 & 1\\\\ 0 & -\\dfrac{J}{I}\\end{bmatrix}=' + mtex(md.A2) + ',\\quad B_2=\\begin{bmatrix}0 & 0\\\\ -\\dfrac{K}{I} & \\dfrac{K}{I}\\end{bmatrix}=' + mtex(md.B2), 'A2');
    L2.tex('C_2=\\begin{bmatrix}1 & 0\\\\ 0 & 1\\end{bmatrix},\\quad D_2=\\begin{bmatrix}0 & 0\\\\ 0 & 0\\end{bmatrix}');
    L2.h('2.3. Модель продольного движения и наклона');
    L2.p('Уравнение (28) содержит два уравнения второго порядка, поэтому вектор состояния содержит четыре переменные x = [θ; ψ; θ̇; ψ̇], вектор управления — две, u = [v<sub>l</sub>; v<sub>r</sub>]. Умножим уравнение (28) слева на обратную матрицу E<sup>−1</sup>:');
    L2.tex('\\begin{bmatrix}\\ddot\\theta\\\\ \\ddot\\psi\\end{bmatrix}=-E^{-1}G\\begin{bmatrix}\\theta\\\\ \\psi\\end{bmatrix}-E^{-1}F\\begin{bmatrix}\\dot\\theta\\\\ \\dot\\psi\\end{bmatrix}+E^{-1}H\\begin{bmatrix}v_l\\\\ v_r\\end{bmatrix}');
    L2.tex('E^{-1}=' + mtex(md.Ei), 'Einv');
    L2.tex('E^{-1}G=' + mtex(md.EG) + ',\\quad E^{-1}F=' + mtex(md.EF) + ',\\quad E^{-1}H=' + mtex(md.EH), 'EGFH');
    L2.p('Дополнив систему уравнениями ẋ<sub>1</sub> = x<sub>3</sub>, ẋ<sub>2</sub> = x<sub>4</sub>, получаем матрицы пространства состояний:');
    L2.tex('A_1=\\begin{bmatrix}0_{2\\times2} & I_{2\\times2}\\\\ -E^{-1}G & -E^{-1}F\\end{bmatrix}=' + mtex(md.A1), 'A1');
    L2.tex('B_1=\\begin{bmatrix}0_{2\\times2}\\\\ E^{-1}H\\end{bmatrix}=' + mtex(md.B1) + ',\\quad C_1=I_{4\\times4},\\quad D_1=0_{4\\times2}', 'B1');
    L2.note('В итоговой записи методички указано C = [1], D = [0]; в листинге MATLAB это C1 = eye(4), D1 = zeros(4, 2) — выход равен вектору состояния.').webOnly();
    L2.p('В итоге модель робота-балансира в пространстве состояний — две системы: s1 (4 состояния: θ, ψ, θ̇, ψ̇) и s2 (2 состояния: φ, φ̇), у обеих по два входа v<sub>l</sub>, v<sub>r</sub>; всего 2 входа, 6 состояний, 6 выходов и 8 матриц.');
    L2.h('2.4. Анализ устойчивости модели');
    L2.p('Собственные значения матрицы A<sub>1</sub> (корни характеристического уравнения det(sI − A<sub>1</sub>) = 0):');
    L2.tex(eigTex(eig1, '\\lambda'), 'eig1');
    L2.check(`\\lambda_{max}=${n(lamU)}\\ \\text{с}^{-1}>0`, false, 'Есть корень с положительной вещественной частью — модель неустойчива: без регулятора робот падает, графики уходят в бесконечность.');
    L2.p('Нулевой корень соответствует координате θ: положение робота не влияет на его динамику (интегрирующее звено). Для проверки модели «подвесим» робота за колёса, как маятник, — сменим знак ускорения свободного падения (g → −g). Собственные значения:');
    L2.tex(eigTex(eig1n, '\\lambda'), 'eig1n');
    const stab2 = eig1n.every(z => z[0] <= 1e-9);
    L2.check(`\\max\\operatorname{Re}\\lambda=${n(Math.max(...eig1n.map(z => z[0])))}\\le 0`, stab2, stab2 ? 'Все корни в левой полуплоскости (кроме нулевого, соответствующего θ) — «подвешенный» робот ведёт себя как маятник с затуханием, модель адекватна.' : 'Есть корни в правой полуплоскости — проверьте исходные данные.');
    if (R.osc) {
      L2.p('Комплексно-сопряжённая пара корней −σ ± jω определяет затухающие колебания маятника:');
      L2.eq('T', '\\dfrac{2\\pi}{\\omega}', `\\dfrac{2\\pi}{${n(R.osc.w)}}`, R.osc.T, 'с');
      L2.eq('\\zeta', '\\dfrac{\\sigma}{\\sqrt{\\sigma^2+\\omega^2}}', `\\dfrac{${n(-R.osc.s)}}{\\sqrt{${n(-R.osc.s)}^2+${n(R.osc.w)}^2}}`, R.osc.zeta, '');
    } else L2.p('Комплексных корней нет — «подвешенный» робот возвращается в нижнее положение апериодически, без колебаний.');
    L2.p('Корни модели поворота: ' + eig2.map(z => fnum(z[0])).join(' и ') + ' с⁻¹ — нулевой корень соответствует углу φ, отрицательный — затуханию скорости поворота.');
    L2.h('2.5. Модель Simulink');
    L2.p('Модель собирается из блоков State-Space (Continuous), Mux и Demux (Commonly Used Blocks), Scope и Constant. В блок State-Space вписываются матрицы A1, B1, C1, D1, во второй блок — A2, B2, C2, D2. На оба двигателя подаётся постоянное напряжение ' + f(v0) + ' В (блок Constant).');
    L2.diagram('d_lr2', 'Модель робота-балансира в пространстве состояний (рис. 19)');
    L2.plot('lr2_up', 'Реакция модели при g = ' + f(g) + ' м/с²: координаты неограниченно растут');
    L2.p('Для проверки модели в скрипте parametrs_Rob.m ставим знак «−» перед 9,81 и повторяем моделирование:');
    L2.plot('lr2_dn', 'Реакция «подвешенного» робота (g = −' + f(g) + ' м/с²) на напряжение ' + f(v0) + ' В (рис. 20)');
    L2.p('Установившиеся значения при постоянном напряжении v на обоих двигателях найдём из уравнения (28), положив θ̈ = ψ̈ = ψ̇ = 0:');
    L2.eq('\\dot\\theta_{уст}', '\\dfrac{\\alpha v}{\\beta+f_w}', `\\dfrac{${n(md.alpha)}\\cdot ${n(v0)}}{${n(md.beta)}+${n(P.fw)}}`, R.thdSS, 'рад/с');
    L2.eq('\\psi_{уст}', '\\dfrac{2\\alpha v f_w}{\\left(\\beta+f_w\\right)MgL}', `\\dfrac{2\\cdot ${n(md.alpha)}\\cdot ${n(v0)}\\cdot ${n(P.fw)}}{\\left(${n(md.beta)}+${n(P.fw)}\\right)\\cdot ${n(P.M * g * md.L)}}`, R.psiSS, 'рад');
    L2.simres('sr_lr2', 'Сравнение моделирования с расчётом');
    L2.p('Так как напряжения на двигателях одинаковы, v<sub>r</sub> − v<sub>l</sub> = 0 и угол поворота φ остаётся равным нулю — робот движется прямолинейно.');

    /* ======================= ЭТАП 3. Системная модель ======================= */
    const L3 = new Report();
    L3.h('3.1. Структура системной модели');
    L3.p('Системная модель связывает модель робота и систему управления. Для поддержания баланса нужно знать угол отклонения от вертикали и углы поворота двигателей: на роботе установлены двигатели постоянного тока с энкодерами и гироскоп. Скорость вращения двигателей задаётся скважностью ШИМ.');
    L3.p('На вход модели поступает сигнал ШИМ, который преобразуется в напряжение; напряжение подаётся на модель робота-балансира, на выходе — показания датчика наклона (гироскоп) и углов поворота двигателей (энкодеры).');
    L3.diagram('d_lr3_sys', 'Системная модель: контроллер и объект управления (рис. 29)');
    L3.h('3.2. Широтно-импульсная модуляция');
    L3.table(['Скважность ШИМ', 'Коэффициент энкодера', 'Коэффициент гироскопа'], [['−' + f(P.PWMmax) + '…' + f(P.PWMmax), '1°', '1°/с']], 'Параметры датчиков и ШИМ');
    L3.p(`Коэффициент перевода напряжения в значения ШИМ при напряжении питания U<sub>пит</sub> = ${f(P.Upit)} В:`);
    L3.eq('K_{PWM}', '\\dfrac{' + P.PWMmax + '}{U_{пит}}', `\\dfrac{${n(P.PWMmax)}}{${n(P.Upit)}}`, KPWMx, '', 6);
    if (P.kpwmRound && Math.abs(KPWM - KPWMx) > 1e-12) L3.p(`Принимаем K<sub>PWM</sub> = ${f(KPWM, 6)} (как в методичке — с точностью до 0,01).`);
    L3.eq('\\Delta v', '\\dfrac{1}{K_{PWM}}', `\\dfrac{1}{${n(KPWM, 6)}}`, 1 / KPWM, 'В');
    L3.p('Δv — шаг квантования напряжения: изменение ШИМ на единицу меняет напряжение на двигателе на эту величину.');
    L3.p(P.satOrder === 'pwm'
      ? `Подсистема Real_in переводит ШИМ в напряжение: блок Round квантует сигнал по уровню, Saturation ограничивает скважность пределами −${f(P.PWMmax)}…${f(P.PWMmax)}, Gain 1/K<sub>PWM</sub> переводит значения в вольты.`
      : `Подсистема Real_in переводит ШИМ в напряжение: блок Round квантует сигнал по уровню, Gain 1/K<sub>PWM</sub> переводит значения в вольты, Saturation с пределами −${f(P.PWMmax)}…${f(P.PWMmax)} учитывает ограничение ШИМ.`);
    if (P.satOrder !== 'pwm') L3.note(`В методичке блок Saturation стоит после Gain 1/K<sub>PWM</sub>, поэтому ограничивает уже напряжение пределами ±${f(P.PWMmax)} В и фактически не срабатывает. Если нужно ограничение по питанию (±${f(P.Upit)} В), переключите порядок блоков в разделе «Методика» на вкладке «Данные».`, 'warn').webOnly();
    L3.h('3.3. Датчики');
    L3.p('Углы поворота валов двигателей связаны с углами поворота колёс и наклоном корпуса (энкодер закреплён на корпусе):');
    L3.tex('\\theta_{m\\,l,r}=\\theta_{l,r}-\\psi');
    L3.p('Из уравнений (6) и этой связи выводим показания датчиков:');
    L3.tex('enc_l=\\theta_{ml}=\\theta-\\dfrac{W}{2R}\\phi-\\psi,\\qquad enc_r=\\theta_{mr}=\\theta+\\dfrac{W}{2R}\\phi-\\psi,\\qquad gyro=\\dot\\psi', 'enc');
    L3.eq('\\dfrac{W}{2R}', '', `\\dfrac{${n(P.W)}}{2\\cdot ${n(P.R)}}`, P.W / (2 * P.R), '');
    L3.p('Подставим компоненты вектора выхода y = [θ; ψ; θ̇; ψ̇; φ; φ̇] и переведём радианы в градусы:');
    L3.tex('enc_l=y_1-\\dfrac{W}{2R}y_5-y_2,\\qquad enc_r=y_1+\\dfrac{W}{2R}y_5-y_2,\\qquad gyro=y_4', 'ency');
    L3.p('Выражение записывается в блок MATLAB Function (User-Defined Functions); R и W объявляются параметрами блока в Model Explorer:');
    L3.code(`function [enc_l, enc_r, gyro] = fcn(y, R, W)
enc_l = rad2deg(y(1) - W/R/2*y(5) - y(2));
enc_r = rad2deg(y(1) + W/R/2*y(5) - y(2));
gyro  = rad2deg(y(4));`, 'matlab', 'MATLAB Function (fcn)');
    L3.h('3.4. Идеальная и реальная модели');
    L3.p('Чтобы при отладке работать с идеальным объектом, неидеальности отключаемы: подсистема Real_in преобразуется в вариантную (Variant Subsystem), внутри неё создаётся копия Ideal_in без блоков Round и Saturation. Ideal_in — вариант по умолчанию (default), для Real_in задаётся условие real_model == 1. Переменная real_model хранится в скрипте config.m.');
    L3.p('Аналогично на выходе объекта подсистема Real_out квантует показания датчиков блоком Round: энкодеры выдают целое число градусов (int32), гироскоп — целое число градусов в секунду.');
    L3.note('Методичка предлагает получить Real_out копированием Real_in с удалением насыщения; при этом в копии остаётся Gain 1/K<sub>PWM</sub>, который к показаниям датчиков отношения не имеет и уменьшает их в K<sub>PWM</sub> раз. В утилите и в генерируемой модели Real_out — только квантование Round.', 'warn').webOnly();
    L3.h('3.5. Шины данных');
    L3.p('Передача данных между подсистемами организуется шинами (Bus Editor): шина Ctl — управляющие воздействия, шина Data — показания датчиков.');
    L3.table(['Шина', 'Элемент', 'Размерность', 'Назначение'], [['Ctl', 'PWM', '2', 'скважность ШИМ левого и правого двигателей'], ['Data', 'enc', '2', 'углы поворота валов двигателей, град'], ['Data', 'gyro', '1', 'угловая скорость наклона корпуса, град/с']], 'Состав шин данных');
    L3.p('Шины сохраняются в файл bus_data.mat; скрипт preload.m загружает их. В свойствах модели (Model Properties → Callbacks) в PreLoadFcn записываются preload и config, в InitFcn — Rob_SM.');
    L3.h('3.6. Подсистема Plant');
    L3.diagram('d_lr3_plant', 'Подсистема Plant: ШИМ → модель робота → датчики (рис. 27, 38)');
    L3.h('3.7. Моделирование');
    L3.p(`Проверка проводится с отрицательным ускорением свободного падения («подвешенный» робот). Контроллер пока передаёт задание U = ${f(v0)} на выход Ctl без изменений, поэтому на двигатели подаётся ${f(v0)}/K<sub>PWM</sub> = ${f(v0 / KPWM)} В.`);
    L3.plot('lr3_enc', 'Показания энкодеров enc_l, enc_r (рис. 39)');
    L3.plot('lr3_gyro', 'Показания гироскопа: идеальная и реальная модели (рис. 39)');
    L3.simres('sr_lr3', 'Результаты моделирования системной модели');

    /* ======================= ЭТАП 4. LQR ======================= */
    const L4 = new Report();
    L4.h('4.1. Линейно-квадратичный регулятор');
    L4.p('Основные характеристики системы управления — устойчивость и качество регулирования. Робот будет стоять, только если контроллер обеспечивает устойчивость всей системы. Для данной системы применяется линейно-квадратичный регулятор (Linear Quadratic Regulator, LQR) — оптимальный регулятор, минимизирующий квадратичный функционал качества:');
    L4.tex('J=\\int_0^{\\infty}\\left(x^{\\mathsf T}Qx+u^{\\mathsf T}Ru\\right)dt\\ \\to\\ \\min,\\qquad u=-Kx', 'lqrJ');
    L4.p('Матрица коэффициентов регулятора K = R<sup>−1</sup>B<sup>T</sup>P, где P — решение алгебраического уравнения Риккати:');
    L4.tex('A^{\\mathsf T}P+PA-PBR^{-1}B^{\\mathsf T}P+Q=0', 'riccati');
    L4.p(`Весовые матрицы приняты единичными${P.qw !== 1 || P.rw !== 1 ? ', умноженными на ' + f(P.qw) + ' и ' + f(P.rw) : ''}: Q = ${P.qw !== 1 ? f(P.qw) + '·' : ''}eye(n), R = ${P.rw !== 1 ? f(P.rw) + '·' : ''}eye(2). Регулятор синтезируется командой lqr в скрипте control.m.`);
    L4.h('4.2. Оценка вектора состояния по датчикам');
    L4.p('Состояние робота восстанавливается по показаниям энкодеров и гироскопа (подсистема get_states):');
    L4.tex('\\theta=\\dfrac{1}{2}\\left(\\theta_{ml}+\\theta_{mr}\\right)+\\psi,\\qquad \\psi=\\int\\dot\\psi\\,dt,\\qquad \\dot\\theta=\\dfrac{d\\theta}{dt},\\qquad \\phi=\\dfrac{R}{W}\\left(\\theta_{mr}-\\theta_{ml}\\right),\\qquad \\dot\\phi=\\dfrac{d\\phi}{dt}', 'states');
    L4.diagram('d_lr4_gs', 'Подсистема get_states (рис. 52)');
    L4.p('Уставка сравнивается с оценкой состояния, ошибка умножается на матрицу коэффициентов регулятора K и на коэффициент ШИМ — на выходе получается управляющее воздействие Ctl:');
    L4.diagram('d_lr4_ctrl', 'Подсистема Control (рис. 45)');
    L4.h('4.3. Регулятор по модели наклона s1');
    L4.p(`Синтезируем регулятор по модели s1 (x = [θ; ψ; θ̇; ψ̇]) при Q = eye(4), R = eye(2):`);
    L4.tex('K_{lqr}=' + mtex(l1.K), 'K4');
    L4.p('Полюса замкнутой системы — собственные значения матрицы A<sub>1</sub> − B<sub>1</sub>K<sub>lqr</sub>:');
    L4.tex(eigTex(l1.poles, 'p'), 'poles');
    const st1 = l1.poles.every(z => z[0] < 0);
    L4.check(`\\max\\operatorname{Re}p=${n(Math.max(...l1.poles.map(z => z[0])))}<0`, st1, st1 ? 'Замкнутая система устойчива.' : 'Замкнутая система неустойчива.');
    L4.p(`Для проверки системы управления в блоке State-Space подсистемы Plant задаём начальное состояние [0 Psi0 0 0] — начальный наклон робота Psi0 = ${f(P.Psi0)} рад (${f(P.Psi0 * R2D)}°).`);
    L4.p(`Моделирование выполняется с фиксированным шагом Δt = ${f(R.dt)} с (решатель ode4): в контуре есть блоки дифференцирования (Derivative), и шаг должен быть заметно меньше постоянной времени самого быстрого полюса замкнутой системы 1/|p|<sub>max</sub> = ${f(1 / R.pmax)} с.`);
    L4.plot('lr4_s1', 'Переходные процессы с регулятором по модели s1 (рис. 47)');
    L4.simres('sr_lr4_1', 'Результаты моделирования: регулятор по модели s1');
    L4.h('4.4. Регулятор с интегратором');
    L4.p('Чтобы устранить статическую ошибку по углу θ, включим в регулятор интегрирование: добавим к модели состояние θ<sub>int</sub> = ∫θ dt (скрипт Rob_SM.m: s0 = ss(1/tf(\'s\')), s3 = append(s0, s1), s3.A(1,2) = 1, s3(:,1) = []). Вектор состояния x = [θ<sub>int</sub>; θ; ψ; θ̇; ψ̇]:');
    L4.tex('A_3=' + mtex(ex.A3) + ',\\quad B_3=' + mtex(ex.B3), 'A3');
    L4.p('Регулятор при Q = eye(5), R = eye(2):');
    L4.tex('K_{lqr}=' + mtex(l3.K), 'K5');
    L4.tex(eigTex(l3.poles, 'p'), 'poles');
    L4.p('В подсистему get_states добавляется интегратор угла θ, в Bus Selector сигнал theta_int ставится на первое место, в задающий вектор добавляется пятый элемент (нулевой).');
    L4.plot('lr4_s3', 'Переходные процессы с интегратором в регуляторе (рис. 51)');
    L4.simres('sr_lr4_3', 'Результаты моделирования: регулятор с интегратором');
    L4.h('4.5. Управление движением робота');
    L4.p('Добавим возможность управления: система s4 объединяет s3 и модель поворота s2 (s4 = append(s3, s2); s4.B(end,[1 2]) = s4.B(end,[3 4]); s4(:,[3 4]) = []). Вектор состояния x = [θ<sub>int</sub>; θ; ψ; θ̇; ψ̇; φ; φ̇]:');
    L4.tex('A_4=' + mtex(ex.A4, 4), 'A4');
    L4.tex('B_4=' + mtex(ex.B4), 'B4');
    L4.p('Регулятор при Q = eye(7), R = eye(2):');
    L4.tex('K_{lqr}=' + mtex(l4.K), 'K7');
    L4.tex(eigTex(l4.poles, 'p'), 'poles');
    L4.p(`В get_states добавляются угол поворота φ = R/W(θ<sub>r</sub> − θ<sub>l</sub>) и его производная. Задаём скорости θ̇ = ${f(P.vref)} рад/с и φ̇ = ${f(P.wref)} рад/с, углы отклонения робота — нулевыми (иначе робот упадёт):`);
    L4.tex(`x_{зад}=\\begin{bmatrix}\\theta_{int}\\\\ \\theta\\\\ \\psi\\\\ \\dot\\theta\\\\ \\dot\\psi\\\\ \\phi\\\\ \\dot\\phi\\end{bmatrix}=\\begin{bmatrix}${n(P.vref)}\\,t^2/2\\\\ ${n(P.vref)}\\,t\\\\ 0\\\\ ${n(P.vref)}\\\\ 0\\\\ ${n(P.wref)}\\,t\\\\ ${n(P.wref)}\\end{bmatrix}`, 'ref');
    L4.plot('lr4_s4', 'Управление движением: идеальные датчики (рис. 52)');
    L4.simres('sr_lr4_4', 'Результаты моделирования: управление движением');
    L4.p('Промоделируем систему с неидеальными датчиками и квантованием ШИМ: в скрипте config.m задаём real_model = 1.');
    L4.plot('lr4_s4r', 'Управление движением с неидеальными датчиками (рис. 52)');
    L4.simres('sr_lr4_4r', 'Результаты моделирования: неидеальные датчики');

    /* ======================= Контрольные вопросы ======================= */
    const L5 = new Report();
    QUESTIONS.forEach((q, k) => { L5.h((k + 1) + '. ' + q.q); q.a(R).forEach(t => typeof t === 'string' ? L5.p(t) : L5.tex(t.tex)); });

    R.L1 = L1; R.L2 = L2; R.L3 = L3; R.L4 = L4; R.L5 = L5;
    return R;
  }

  /* ---------- контрольные вопросы ---------- */
  const QUESTIONS = [
    { q: 'Что такое маятник?', a: () => [
      'Маятник — твёрдое тело (или материальная точка на нити), совершающее колебания под действием силы тяжести около неподвижной точки или оси подвеса, расположенной выше центра масс. Различают математический маятник (точечная масса на невесомой нерастяжимой нити) и физический (твёрдое тело произвольной формы).',
      'Робот-балансир — перевёрнутый маятник: его центр масс находится выше оси колёс, поэтому верхнее положение равновесия неустойчиво. Если сменить знак g, модель описывает обычный («подвешенный») маятник с устойчивым нижним положением — так в работе проверяется адекватность модели.'] },
    { q: 'Что такое колебательное движение?', a: () => [
      'Колебательное движение — движение, при котором состояние системы (координата, скорость) повторяется во времени точно или приблизительно, а тело многократно проходит положение равновесия в противоположных направлениях. Колебания характеризуются амплитудой, периодом (частотой) и фазой; гармонические колебания описываются законом x(t) = A·sin(ωt + φ<sub>0</sub>).'] },
    { q: 'Что называют свободным колебанием?', a: () => [
      'Свободные (собственные) колебания — колебания, происходящие только за счёт первоначально сообщённой системе энергии, без внешних периодических воздействий. Их частота определяется параметрами самой системы. В реальных системах из-за трения свободные колебания затухают — как у «подвешенного» робота в работе: колебания угла ψ затухают за счёт противо-ЭДС и вязкого трения в двигателях.'] },
    { q: 'Что такое автоколебания?', a: () => [
      'Автоколебания — незатухающие колебания в нелинейной системе, поддерживаемые внешним источником энергии, который сам не обладает периодичностью. Амплитуда и частота автоколебаний определяются свойствами системы, а не начальными условиями (часы с маятником, смычок скрипки, автоколебания в релейных системах управления).',
      'В системе управления роботом автоколебания (предельный цикл) могут возникать из-за нелинейностей — квантования сигналов датчиков и ШИМ, насыщения; при неидеальных датчиках угол ψ колеблется около нуля с малой амплитудой.'] },
    { q: 'Что такое метод пространства состояний?', a: () => [
      'Метод пространства состояний — способ описания динамической системы набором переменных состояния, связанных дифференциальными уравнениями первого порядка в векторно-матричной форме:',
      { tex: '\\dot x=Ax+Bu,\\qquad y=Cx+Du' },
      'Состояние системы в любой момент времени задаётся вектором x; A — матрица системы, B — матрица управления, C — матрица выхода, D — матрица прямой связи. В отличие от передаточных функций метод применим к многомерным системам (несколько входов и выходов) и учитывает ненулевые начальные условия. Для робота-балансира: x = [θ; ψ; θ̇; ψ̇], u = [v<sub>l</sub>; v<sub>r</sub>].'] },
    { q: 'Второй закон Ньютона для вращающегося тела', a: () => [
      'Угловое ускорение тела прямо пропорционально сумме моментов внешних сил относительно оси вращения и обратно пропорционально моменту инерции тела относительно этой оси:',
      { tex: 'J\\varepsilon=J\\dfrac{d\\omega}{dt}=\\sum M_i' },
      'В общем виде — производная момента импульса равна моменту внешних сил: dL/dt = M. Из этого закона (через уравнения Лагранжа) получены уравнения движения робота: например, для поворота I·φ̈ + J·φ̇ = K(v<sub>r</sub> − v<sub>l</sub>).'] },
    { q: 'Вектор управления', a: R => [
      'Вектор управления u — совокупность входных воздействий, с помощью которых управляют системой. В уравнении состояния он входит через матрицу управления B, определяющую реакцию системы на управление.',
      'Для робота-балансира вектор управления — напряжения на левом и правом двигателях u = [v<sub>l</sub>; v<sub>r</sub>]; в системной модели они формируются из сигнала ШИМ: v = PWM/K<sub>PWM</sub>' + (R ? ' (K<sub>PWM</sub> = ' + fnum(R.KPWM, 6) + ').' : '.')] },
    { q: 'Вектор выхода', a: () => [
      'Вектор выхода y — совокупность выходных (наблюдаемых, измеряемых) переменных системы, определяемых уравнением выхода y = Cx + Du. Выходами могут быть как физически измеряемые величины, так и абстрактные (производные, скорости).',
      'В модели робота y<sub>1</sub> = [θ; ψ; θ̇; ψ̇], y<sub>2</sub> = [φ; φ̇] (C — единичные матрицы). Реально измеряются лишь показания энкодеров и гироскопа (enc<sub>l</sub>, enc<sub>r</sub>, gyro), по которым подсистема get_states восстанавливает вектор состояния.'] }
  ];

  /* =================================================================
   * МОДЕЛИРОВАНИЕ (ленивые вычисления)
   * ================================================================= */
  function every(N, pts) { return Math.max(1, Math.floor(N / (pts || 2000))); }
  /* разомкнутая модель (рис. 19): постоянное напряжение на обоих двигателях */
  function simOpen(R, sign) {
    const P = R.P, md = sign > 0 ? R.md : R.mdn;
    const v = P.Uopen;
    const Tend = sign > 0 ? Math.min(P.Tsim, Math.max(0.3, 8 / Math.max(R.lamU, 1e-3))) : P.Tsim;
    const N = 2000, dt = Tend / N;
    const d1 = LA.c2d(md.A1, md.B1, dt), d2 = LA.c2d(md.A2, md.B2, dt);
    let x1 = [0, 0, 0, 0], x2 = [0, 0];
    const o = { t: [], th: [], psi: [], thd: [], psid: [], phi: [], phid: [] };
    for (let k = 0; k <= N; k++) {
      o.t.push(k * dt); o.th.push(x1[0]); o.psi.push(x1[1]); o.thd.push(x1[2]); o.psid.push(x1[3]); o.phi.push(x2[0]); o.phid.push(x2[1]);
      const u = [v, v];
      x1 = LA.mv(d1.Ad, x1).map((s, i) => s + d1.Bd[i][0] * u[0] + d1.Bd[i][1] * u[1]);
      x2 = LA.mv(d2.Ad, x2).map((s, i) => s + d2.Bd[i][0] * u[0] + d2.Bd[i][1] * u[1]);
    }
    return o;
  }
  /* системная модель: ШИМ → Real_in → модель → датчики → Real_out → контроллер
   * mode: 0 — разомкнутая (Ctl = U), 1 — LQR по s1, 2 — LQR с интегратором (s3), 3 — с управлением движением (s4) */
  function simSys(R, mode, real) {
    const P = R.P, md = mode === 0 ? R.mdn : R.md;
    const dt = R.dt, Tend = P.Tsim, N = Math.round(Tend / dt);
    const d1 = LA.c2d(md.A1, md.B1, dt), d2 = LA.c2d(md.A2, md.B2, dt);
    const K = mode === 1 ? R.lqr.s1.K : mode === 2 ? R.lqr.s3.K : mode === 3 ? R.lqr.s4.K : null;
    const KP = R.KPWM, lim = P.PWMmax, k2 = P.W / (2 * P.R);
    const sat = x => Math.max(-lim, Math.min(lim, x));
    const toV = c => !real ? c / KP : (P.satOrder === 'pwm' ? sat(Math.round(c)) / KP : sat(Math.round(c) / KP));
    let x1 = [0, mode === 0 ? 0 : P.Psi0, 0, 0], x2 = [0, 0];
    let psiE = 0, thInt = 0, prevTh = null, prevPhi = null;
    const rec = every(N, 2500);
    const o = { t: [], th: [], psi: [], thd: [], psid: [], phi: [], phid: [], vl: [], vr: [], encl: [], encr: [], gyro: [], psiE: [], thE: [], fell: false };
    for (let k = 0; k <= N; k++) {
      const t = k * dt;
      // датчики
      let encl = R2D * (x1[0] - k2 * x2[0] - x1[1]), encr = R2D * (x1[0] + k2 * x2[0] - x1[1]), gyro = R2D * x1[3];
      if (real) { encl = Math.round(encl); encr = Math.round(encr); gyro = Math.round(gyro); }
      // контроллер
      let ctl = [P.Uopen, P.Uopen];
      let thE = 0;
      if (mode > 0) {
        const psidE = gyro * D2R;
        thE = 0.5 * (encl + encr) * D2R + psiE;
        const phiE = P.R / P.W * (encr - encl) * D2R;
        const thdE = prevTh === null ? 0 : (thE - prevTh) / dt, phidE = prevPhi === null ? 0 : (phiE - prevPhi) / dt;
        prevTh = thE; prevPhi = phiE;
        let X, ref;
        if (mode === 1) { X = [thE, psiE, thdE, psidE]; ref = [0, 0, 0, 0]; }
        else if (mode === 2) { X = [thInt, thE, psiE, thdE, psidE]; ref = [0, 0, 0, 0, 0]; }
        else { X = [thInt, thE, psiE, thdE, psidE, phiE, phidE]; ref = [P.vref * t * t / 2, P.vref * t, 0, P.vref, 0, P.wref * t, P.wref]; }
        const e = ref.map((r, i) => r - X[i]);
        ctl = K.map(row => KP * row.reduce((s, kk, j) => s + kk * e[j], 0));
        psiE += psidE * dt; thInt += thE * dt;
      }
      const V = ctl.map(toV);
      if (k % rec === 0) {
        o.t.push(t); o.th.push(x1[0]); o.psi.push(x1[1]); o.thd.push(x1[2]); o.psid.push(x1[3]); o.phi.push(x2[0]); o.phid.push(x2[1]);
        o.vl.push(V[0]); o.vr.push(V[1]); o.encl.push(encl); o.encr.push(encr); o.gyro.push(gyro); o.psiE.push(psiE); o.thE.push(thE);
      }
      if (!isFinite(x1[1]) || Math.abs(x1[1]) > PI / 2) { o.fell = true; o.tFell = t; break; }
      x1 = LA.mv(d1.Ad, x1).map((s, i) => s + d1.Bd[i][0] * V[0] + d1.Bd[i][1] * V[1]);
      x2 = LA.mv(d2.Ad, x2).map((s, i) => s + d2.Bd[i][0] * V[0] + d2.Bd[i][1] * V[1]);
    }
    return o;
  }
  /* показатели процессов */
  function tail(a, frac) { const k0 = Math.floor(a.length * (1 - (frac || 0.1))); const s = a.slice(k0); return s.reduce((x, y) => x + y, 0) / s.length; }
  function maxAbs(a) { return a.reduce((m0, v) => Math.max(m0, Math.abs(v)), 0); }
  function settle(t, y, yf, band) { let ts = 0; for (let i = 0; i < y.length; i++) if (Math.abs(y[i] - yf) > band) ts = t[i]; return ts; }
  function stats(R, o, mode) {
    const P = R.P;
    const psiF = tail(o.psi), thF = tail(o.th), thdF = tail(o.thd), phidF = tail(o.phid);
    const band = Math.max(0.05 * Math.abs(P.Psi0), 1e-5);
    return {
      psiMax: maxAbs(o.psi), psiF, thF, thdF, phidF, phiEnd: o.phi[o.phi.length - 1], thEnd: o.th[o.th.length - 1], tEnd: o.t[o.t.length - 1],
      tsPsi: settle(o.t, o.psi, psiF, band), vMax: Math.max(maxAbs(o.vl), maxAbs(o.vr)),
      psiRms: Math.sqrt(o.psi.slice(Math.floor(o.psi.length / 2)).reduce((s, v) => s + (v - psiF) ** 2, 0) / Math.ceil(o.psi.length / 2)),
      tsThd: mode === 3 ? settle(o.t, o.thd, P.vref, 0.05 * Math.abs(P.vref || 1)) : NaN,
      fell: o.fell, tFell: o.tFell
    };
  }

  const api = { compute, defaults, fromVariant, fnum, fdec, fauto, n, m, mvec, mmat, mtex, eigTex, ctex, simOpen, simSys, stats, buildModel, VKEYS, QUESTIONS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.LABS = api;
})(typeof window !== 'undefined' ? window : globalThis);
