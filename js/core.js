/* =====================================================================
 * core.js — вычислительное ядро: полиномы, передаточные функции,
 * частотные характеристики, запасы устойчивости, билинейное
 * преобразование, tf2ss (как в MATLAB), ZOH-дискретизация,
 * гибридное (непрерывно-дискретное) моделирование структурных схем.
 * ===================================================================== */
(function (root) {
  'use strict';

  /* ---------- полиномы (коэффициенты от старшей степени, как в MATLAB) ---------- */
  function trim(p) {
    let i = 0;
    while (i < p.length - 1 && Math.abs(p[i]) === 0) i++;
    return p.slice(i);
  }
  function conv(a, b) {
    const r = new Array(a.length + b.length - 1).fill(0);
    for (let i = 0; i < a.length; i++)
      for (let j = 0; j < b.length; j++) r[i + j] += a[i] * b[j];
    return r;
  }
  function padd(a, b) {
    const n = Math.max(a.length, b.length);
    const r = new Array(n).fill(0);
    for (let i = 0; i < a.length; i++) r[n - a.length + i] += a[i];
    for (let i = 0; i < b.length; i++) r[n - b.length + i] += b[i];
    return r;
  }
  function pscale(a, k) { return a.map(v => v * k); }
  function polyval(p, x) { let r = 0; for (const c of p) r = r * x + c; return r; }
  function convMany(list) { return list.reduce((acc, p) => conv(acc, p), [1]); }
  function ppow(p, n) { let r = [1]; for (let i = 0; i < n; i++) r = conv(r, p); return r; }

  /* ---------- комплексные числа ---------- */
  const C = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1]],
    mul: (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]],
    div: (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; },
    abs: a => Math.hypot(a[0], a[1]),
    arg: a => Math.atan2(a[1], a[0])
  };
  function cpolyval(p, z) { let r = [0, 0]; for (const c of p) r = C.add(C.mul(r, z), [c, 0]); return r; }

  /* корни полинома (Durand–Kerner) */
  function roots(p) {
    p = trim(p);
    let n = p.length - 1;
    if (n < 1) return [];
    // нулевые корни
    let zeros = 0;
    while (n > 0 && Math.abs(p[n]) < 1e-300) { p = p.slice(0, n); n--; zeros++; }
    const out = [];
    for (let i = 0; i < zeros; i++) out.push([0, 0]);
    if (n < 1) return out;
    const a = p.map(v => v / p[0]);
    const R = 1 + Math.max(...a.slice(1).map(Math.abs));
    let z = [];
    for (let k = 0; k < n; k++) { const th = 2 * Math.PI * k / n + 0.4; z.push([R * 0.9 * Math.cos(th), R * 0.9 * Math.sin(th)]); }
    for (let it = 0; it < 2000; it++) {
      let maxd = 0;
      for (let i = 0; i < n; i++) {
        let den = [1, 0];
        for (let j = 0; j < n; j++) if (j !== i) den = C.mul(den, C.sub(z[i], z[j]));
        const num = cpolyval(a, z[i]);
        const d = C.div(num, den);
        z[i] = C.sub(z[i], d);
        maxd = Math.max(maxd, C.abs(d) / (1 + C.abs(z[i])));
      }
      if (maxd < 1e-14) break;
    }
    // полировка Ньютоном
    const da = a.slice(0, -1).map((c, i) => c * (n - i));
    z = z.map(zi => { for (let k = 0; k < 5; k++) { const f = cpolyval(a, zi), fp = cpolyval(da, zi); if (C.abs(fp) === 0) break; zi = C.sub(zi, C.div(f, fp)); } return zi; });
    z.forEach(zi => { if (Math.abs(zi[1]) < 1e-9 * (1 + Math.abs(zi[0]))) zi[1] = 0; });
    return out.concat(z);
  }

  /* ---------- передаточные функции ---------- */
  function tf(num, den) { return { num: trim(num.slice()), den: trim(den.slice()) }; }
  function series(...sys) { return sys.reduce((a, b) => tf(conv(a.num, b.num), conv(a.den, b.den))); }
  function parallel(a, b) { return tf(padd(conv(a.num, b.den), conv(b.num, a.den)), conv(a.den, b.den)); }
  function feedback(G, H, sign) {             // G/(1 ∓ G·H), sign=-1 — отрицательная ОС (по умолчанию)
    H = H || tf([1], [1]); sign = sign === undefined ? -1 : sign;
    const num = conv(G.num, H.den);
    const den = padd(conv(G.den, H.den), pscale(conv(G.num, H.num), -sign));
    return tf(num, den);
  }
  function tfdiv(a, b) { return tf(conv(a.num, b.den), conv(a.den, b.num)); }
  function freq(sys, w) { const s = [0, w]; return C.div(cpolyval(sys.num, s), cpolyval(sys.den, s)); }
  function dcgain(sys) { return polyval(sys.num, 0) / polyval(sys.den, 0); }
  /* сокращение общих корней (аналог minreal) */
  function minreal(sys, tol) {
    tol = tol || 1e-6;
    let zr = roots(sys.num), pr = roots(sys.den);
    const kz = trim(sys.num)[0], kp = trim(sys.den)[0];
    const usedP = new Array(pr.length).fill(false);
    const keepZ = [];
    for (const z of zr) {
      let found = -1;
      for (let j = 0; j < pr.length; j++) {
        if (usedP[j]) continue;
        const sc = Math.max(1, C.abs(z), C.abs(pr[j]));
        if (C.abs(C.sub(z, pr[j])) < tol * sc) { found = j; break; }
      }
      if (found >= 0) usedP[found] = true; else keepZ.push(z);
    }
    const keepP = pr.filter((_, j) => !usedP[j]);
    const num = pscale(polyFromRoots(keepZ), kz / kp);
    const den = polyFromRoots(keepP);
    return tf(num, den);
  }
  function polyFromRoots(rs) {
    let p = [[1, 0]];
    for (const r of rs) {
      const q = new Array(p.length + 1).fill(0).map(() => [0, 0]);
      for (let i = 0; i < p.length; i++) { q[i] = C.add(q[i], p[i]); q[i + 1] = C.sub(q[i + 1], C.mul(p[i], r)); }
      p = q;
    }
    return p.map(c => c[0]);
  }

  /* ---------- частотные характеристики ---------- */
  function logspace(a, b, n) { const r = []; for (let i = 0; i < n; i++) r.push(Math.pow(10, a + (b - a) * i / (n - 1))); return r; }
  function bodeData(fresp, w) {          // fresp: w -> complex
    const mag = [], ph = [], re = [], im = [];
    let prev = null, off = 0;
    for (const wi of w) {
      const H = fresp(wi);
      re.push(H[0]); im.push(H[1]);
      mag.push(20 * Math.log10(C.abs(H)));
      let p = C.arg(H) * 180 / Math.PI;
      if (prev !== null) { while (p + off - prev > 180) off -= 360; while (p + off - prev < -180) off += 360; }
      prev = p + off; ph.push(p + off);
    }
    return { w, mag, ph, re, im };
  }
  /* запасы устойчивости (как MATLAB margin): Gm (дБ), Pm (град), частоты */
  function margins(fresp, wmin, wmax) {
    wmin = wmin || 1e-3; wmax = wmax || 1e6;
    const w = logspace(Math.log10(wmin), Math.log10(wmax), 6000);
    const bd = bodeData(fresp, w);
    // сдвиг фазы к стартовому интервалу как в MATLAB (для минимально-фазовых систем фаза начинается с -90k)
    let res = { Gm: Infinity, Pm: Infinity, wcg: NaN, wcp: NaN };
    const magAt = x => 20 * Math.log10(C.abs(fresp(x)));
    // частота среза
    let bestPm = null;
    for (let i = 1; i < w.length; i++) {
      if ((bd.mag[i - 1] > 0) !== (bd.mag[i] > 0)) {
        let a = w[i - 1], b = w[i];
        for (let k = 0; k < 60; k++) { const m = Math.sqrt(a * b); if ((magAt(a) > 0) === (magAt(m) > 0)) a = m; else b = m; }
        const wc = Math.sqrt(a * b);
        const f = (wc - w[i - 1]) / (w[i] - w[i - 1]);
        const phc = bd.ph[i - 1] + f * (bd.ph[i] - bd.ph[i - 1]);
        let pm = ((phc + 180) % 360 + 360) % 360; if (pm > 180) pm -= 360;
        if (bestPm === null || Math.abs(pm) < Math.abs(bestPm.pm)) bestPm = { pm, wc };
      }
    }
    if (bestPm) { res.Pm = bestPm.pm; res.wcp = bestPm.wc; }
    // частота, где фаза = -180 + k*360
    let bestGm = null;
    for (let i = 1; i < w.length; i++) {
      const a0 = bd.ph[i - 1], b0 = bd.ph[i];
      const lo = Math.min(a0, b0), hi = Math.max(a0, b0);
      for (let k = -5; k <= 5; k++) {
        const target = -180 + 360 * k;
        if (target > lo && target <= hi) {
          const f = (target - a0) / (b0 - a0);
          const wp = Math.exp(Math.log(w[i - 1]) + f * (Math.log(w[i]) - Math.log(w[i - 1])));
          const gm = -magAt(wp);
          if (bestGm === null || Math.abs(gm) < Math.abs(bestGm.gm)) bestGm = { gm, wp };
        }
      }
    }
    if (bestGm) { res.Gm = bestGm.gm; res.wcg = bestGm.wp; }
    return res;
  }
  /* показатель колебательности M = max|Ф(jw)|/|Ф(0)| */
  function resonancePeak(fresp, w0) {
    const w = logspace(-3, 5, 4000);
    let m = 0, wm = 0;
    for (const wi of w) { const v = C.abs(fresp(wi)); if (v > m) { m = v; wm = wi; } }
    return { M: m / Math.abs(w0), wM: wm };
  }

  /* ---------- билинейное преобразование (MATLAB bilinear без предыскажения) ---------- */
  function bilinear(num, den, fs) {
    num = trim(num); den = trim(den);
    const n = Math.max(num.length, den.length) - 1;
    const pad = p => new Array(n + 1 - p.length).fill(0).concat(p);
    const N = pad(num), D = pad(den);
    const k = 2 * fs;
    let bz = new Array(n + 1).fill(0), az = new Array(n + 1).fill(0);
    for (let i = 0; i <= n; i++) {          // коэффициент при s^(n-i)
      const pw = n - i;
      const term = conv(ppow([1, -1], pw), ppow([1, 1], n - pw)).map(v => v * Math.pow(k, pw));
      bz = padd(bz, pscale(term, N[i]));
      az = padd(az, pscale(term, D[i]));
    }
    const a0 = az[0];
    return { num: bz.map(v => v / a0), den: az.map(v => v / a0) };
  }
  /* tf2ss — каноническая управляемая форма, как в MATLAB */
  function tf2ss(num, den) {
    den = trim(den); num = trim(num);
    const n = den.length - 1;
    const a0 = den[0];
    const d = den.map(v => v / a0);
    let b = num.map(v => v / a0);
    b = new Array(n + 1 - b.length).fill(0).concat(b);
    const A = [], B = [], Cm = [];
    for (let i = 0; i < n; i++) { A.push(new Array(n).fill(0)); B.push([0]); }
    if (n > 0) {
      for (let j = 0; j < n; j++) A[0][j] = -d[j + 1];
      for (let i = 1; i < n; i++) A[i][i - 1] = 1;
      B[0][0] = 1;
      const row = [];
      for (let j = 0; j < n; j++) row.push(b[j + 1] - b[0] * d[j + 1]);
      Cm.push(row);
    } else Cm.push([]);
    return { A, B, C: Cm, D: [[b[0]]] };
  }

  /* ---------- матрицы ---------- */
  function matmul(A, B) {
    const n = A.length, m = B[0].length, k = B.length;
    const R = []; for (let i = 0; i < n; i++) { R.push(new Array(m).fill(0)); for (let j = 0; j < m; j++) { let s = 0; for (let t = 0; t < k; t++) s += A[i][t] * B[t][j]; R[i][j] = s; } }
    return R;
  }
  function eye(n) { const I = []; for (let i = 0; i < n; i++) { I.push(new Array(n).fill(0)); I[i][i] = 1; } return I; }
  function madd(A, B, kb) { kb = kb === undefined ? 1 : kb; return A.map((r, i) => r.map((v, j) => v + kb * B[i][j])); }
  function mscale(A, k) { return A.map(r => r.map(v => v * k)); }
  function solve(A, B) {   // A X = B, Гаусс с выбором ведущего
    const n = A.length, m = B[0].length;
    const M = A.map((r, i) => r.concat(B[i]));
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      const pv = M[c][c];
      for (let j = c; j < n + m; j++) M[c][j] /= pv;
      for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; if (f) for (let j = c; j < n + m; j++) M[r][j] -= f * M[c][j]; }
    }
    return M.map(r => r.slice(n));
  }
  function expm(A) {
    const n = A.length;
    let norm = 0; for (const r of A) norm = Math.max(norm, r.reduce((s, v) => s + Math.abs(v), 0));
    let s = Math.max(0, Math.ceil(Math.log2(norm)) + 1);
    const As = mscale(A, 1 / Math.pow(2, s));
    // Паде 8/8
    const c = [1]; const q = 8;
    for (let k = 1; k <= q; k++) c.push(c[k - 1] * (q - k + 1) / (k * (2 * q - k + 1)));
    let X = eye(n), N = eye(n), D = eye(n);
    for (let k = 1; k <= q; k++) {
      X = matmul(As, X);
      N = madd(N, X, c[k]);
      D = madd(D, X, (k % 2 ? -1 : 1) * c[k]);
    }
    let E = solve(D, N);
    for (let k = 0; k < s; k++) E = matmul(E, E);
    return E;
  }
  /* непрерывная ПФ -> ss */
  function tf2ssObj(sys) { const r = tf2ss(sys.num, sys.den); return r; }
  /* c2d ZOH для ss */
  function c2dzoh(ss, T) {
    const n = ss.A.length;
    if (n === 0) return { A: [], B: [], C: [[]], D: ss.D, T };
    const M = [];
    for (let i = 0; i < n + 1; i++) M.push(new Array(n + 1).fill(0));
    for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) M[i][j] = ss.A[i][j] * T; M[i][n] = ss.B[i][0] * T; }
    const E = expm(M);
    const Ad = [], Bd = [];
    for (let i = 0; i < n; i++) { Ad.push(E[i].slice(0, n)); Bd.push([E[i][n]]); }
    return { A: Ad, B: Bd, C: ss.C, D: ss.D, T };
  }
  /* частотная характеристика ss в точке комплексной переменной z: C (zI-A)^-1 B + D */
  function ssEval(ss, z) {
    const n = ss.A.length;
    if (n === 0) return [ss.D[0][0], 0];
    // комплексная система (zI - A) x = B, записанная как вещественная размерности 2n
    const full = [], frhs = [];
    for (let i = 0; i < n; i++) {
      const r1 = new Array(2 * n).fill(0), r2 = new Array(2 * n).fill(0);
      for (let j = 0; j < n; j++) {
        const a = (i === j ? z[0] : 0) - ss.A[i][j], b = (i === j ? z[1] : 0);
        r1[j] = a; r1[n + j] = -b; r2[j] = b; r2[n + j] = a;
      }
      full.push(r1); frhs.push([ss.B[i][0]]);
      full.push(r2); frhs.push([0]);
    }
    // переупорядочим: строки 0..2n-1 соответствуют (re_i, im_i)
    const X = solve(full, frhs);
    let re = ss.D[0][0], im = 0;
    for (let j = 0; j < n; j++) { re += ss.C[0][j] * X[j][0]; im += ss.C[0][j] * X[n + j][0]; }
    return [re, im];
  }

  /* ---------- моделирование структурной схемы ----------
   * blocks: [{id, type, ...}]
   *  src:  {f: t=>v}
   *  gain: {in, k}
   *  sum:  {ins: [[id, sign], ...]}
   *  prod: {ins: [id1, id2]}
   *  tf:   {in, num, den}            — непрерывное звено (правильная дробь)
   *  dss:  {in, A, B, C, D, T}       — дискретное звено в пространстве состояний (выход фиксируется ZOH)
   *  zoh:  {in, T}                   — экстраполятор нулевого порядка
   */
  function simulate(blocks, opts) {
    let dtUser = opts.dt || 2e-4;
    const B = blocks.map(b => Object.assign({}, b));
    let fastest = 0;
    for (const b of B) if (b.type === 'tf') { for (const r of roots(b.den)) fastest = Math.max(fastest, C.abs(r)); }
    let dt = dtUser;
    if (fastest > 0) dt = Math.min(dt, 1 / (3 * fastest));
    for (let attempt = 0; attempt < 5; attempt++) {
      const r = simulateOnce(B, opts, dt);
      if (r) return r;
      dt /= 4;
    }
    throw new Error('Моделирование не сходится (система неустойчива или слишком жёсткая).');
  }
  function simulateOnce(blocksIn, opts, dt0) {
    const Tend = opts.Tend, rec = opts.record;
    const B = blocksIn.map(b => Object.assign({}, b));
    const idx = {}; B.forEach((b, k) => idx[b.id] = k);
    let nx = 0;
    for (const b of B) {
      if (b.type === 'tf') {
        const ss = tf2ss(b.num, b.den);
        b.A = ss.A; b.Bv = ss.B.map(r => r[0]); b.Cv = ss.C[0]; b.Dv = ss.D[0][0];
        b.n = ss.A.length; b.off = nx; nx += b.n;
      }
      if (b.type === 'dss') { b.x = new Array(b.A.length).fill(0); b.y = 0; }
      if (b.type === 'zoh') { b.y = 0; }
      b.k_in = b.in !== undefined ? idx[b.in] : -1;
      if (b.ins) b.k_ins = b.ins.map(q => Array.isArray(q) ? [idx[q[0]], q[1]] : [idx[q], 1]);
    }
    let dt = dt0;
    const periods = B.filter(b => b.type === 'dss' || b.type === 'zoh').map(b => b.T);
    if (periods.length) { const Tm = Math.min(...periods); const k = Math.max(1, Math.ceil(Tm / dt - 1e-9)); dt = Tm / k; }
    const nsteps = Math.round(Tend / dt);
    const recEvery = Math.max(1, Math.floor(nsteps / (opts.points || 3000)));
    // порядок алгебраических вычислений
    function order(sampleSet) {
      const known = new Array(B.length).fill(false), ord = [];
      B.forEach((b, k) => {
        if (b.type === 'src' || (b.type === 'tf' && b.Dv === 0) || ((b.type === 'dss' || b.type === 'zoh') && !sampleSet.has(k))) { known[k] = true; ord.push(k); }
      });
      let progress = true;
      while (progress) {
        progress = false;
        B.forEach((b, k) => {
          if (known[k]) return;
          let ok;
          if (b.k_ins) ok = b.k_ins.every(q => known[q[0]]); else ok = known[b.k_in];
          if (ok) { known[k] = true; ord.push(k); progress = true; }
        });
      }
      const miss = B.filter((b, k) => !known[k]).map(b => b.id);
      if (miss.length) throw new Error('Алгебраическая петля в схеме: ' + miss.join(', '));
      return ord;
    }
    const discreteIdx = []; B.forEach((b, k) => { if (b.type === 'dss' || b.type === 'zoh') discreteIdx.push(k); });
    const ordNormal = order(new Set());
    const ordSample = order(new Set(discreteIdx));
    const v = new Float64Array(B.length);
    function evalSig(x, t, ord, sample) {
      for (const k of ord) {
        const b = B[k];
        switch (b.type) {
          case 'src': v[k] = b.f(t); break;
          case 'gain': v[k] = b.k * v[b.k_in]; break;
          case 'sum': { let s = 0; for (const q of b.k_ins) s += q[1] * v[q[0]]; v[k] = s; break; }
          case 'prod': { let s = 1; for (const q of b.k_ins) s *= v[q[0]]; v[k] = s; break; }
          case 'tf': { let y = b.Dv !== 0 ? b.Dv * v[b.k_in] : 0; for (let j = 0; j < b.n; j++) y += b.Cv[j] * x[b.off + j]; v[k] = y; break; }
          case 'dss':
            if (sample) { const u = v[b.k_in]; let y = b.D[0][0] * u; for (let j = 0; j < b.x.length; j++) y += b.C[0][j] * b.x[j]; b._u = u; b.y = y; }
            v[k] = b.y; break;
          case 'zoh': if (sample) b.y = v[b.k_in]; v[k] = b.y; break;
        }
      }
    }
    const dx = new Float64Array(nx);
    function deriv(x, t, out) {
      evalSig(x, t, ordNormal, false);
      for (const b of B) if (b.type === 'tf') {
        const u = v[b.k_in];
        for (let i = 0; i < b.n; i++) { let s = b.Bv[i] * u; const Ai = b.A[i]; for (let j = 0; j < b.n; j++) s += Ai[j] * x[b.off + j]; out[b.off + i] = s; }
      }
    }
    let x = new Float64Array(nx);
    const k1 = new Float64Array(nx), k2 = new Float64Array(nx), k3 = new Float64Array(nx), k4 = new Float64Array(nx), xt = new Float64Array(nx);
    const out = { t: [] }; rec.forEach(r => out[r] = []);
    const recIdx = rec.map(r => idx[r]);
    const disc = discreteIdx.map(k => B[k]);
    for (let k = 0; k <= nsteps; k++) {
      const t = k * dt;
      let due = false;
      for (const b of disc) { const kk = Math.round(t / b.T); if (Math.abs(kk * b.T - t) < dt * 1e-6) { due = true; break; } }
      if (due) {
        evalSig(x, t, ordSample, true);
        for (const b of disc) if (b.type === 'dss') {
          const u = b._u, xn = [];
          for (let i = 0; i < b.x.length; i++) { let s = b.B[i][0] * u; for (let j = 0; j < b.x.length; j++) s += b.A[i][j] * b.x[j]; xn.push(s); }
          b.x = xn;
        }
      } else if (k % recEvery === 0) evalSig(x, t, ordNormal, false);
      if (k % recEvery === 0) { out.t.push(t); for (let r = 0; r < rec.length; r++) out[rec[r]].push(v[recIdx[r]]); }
      if (k === nsteps) break;
      deriv(x, t, k1);
      for (let i = 0; i < nx; i++) xt[i] = x[i] + 0.5 * dt * k1[i]; deriv(xt, t + dt / 2, k2);
      for (let i = 0; i < nx; i++) xt[i] = x[i] + 0.5 * dt * k2[i]; deriv(xt, t + dt / 2, k3);
      for (let i = 0; i < nx; i++) xt[i] = x[i] + dt * k3[i]; deriv(xt, t + dt, k4);
      let big = 0;
      for (let i = 0; i < nx; i++) { x[i] += dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]); const a = Math.abs(x[i]); if (a > big) big = a; }
      if (!(big < 1e15)) return null;
    }
    out.dt = dt;
    return out;
  }

  /* ---------- показатели переходного процесса ---------- */
  function stepInfo(t, y, opts) {
    opts = opts || {};
    const t0 = opts.t0 || 0, t1 = opts.t1 === undefined ? t[t.length - 1] : opts.t1;
    const idx = []; for (let i = 0; i < t.length; i++) if (t[i] >= t0 && t[i] <= t1) idx.push(i);
    const yinit = y[idx[0]];
    const yf = opts.yfinal !== undefined ? opts.yfinal : y[idx[idx.length - 1]];
    const span = yf - yinit;
    let ymax = -Infinity, tmax = 0;
    for (const i of idx) { const yy = (y[i] - yinit) * Math.sign(span || 1); if (yy > ymax) { ymax = yy; tmax = t[i]; } }
    const sigma = span !== 0 ? Math.max(0, (ymax - Math.abs(span)) / Math.abs(span) * 100) : 0;
    let tr = NaN;
    for (const i of idx) if ((y[i] - yinit) * Math.sign(span) >= Math.abs(span)) { tr = t[i] - t0; break; }
    let tr0 = NaN, tr1 = NaN;
    for (const i of idx) { const f = (y[i] - yinit) / span; if (isNaN(tr0) && f >= 0.1) tr0 = t[i]; if (isNaN(tr1) && f >= 0.9) { tr1 = t[i]; break; } }
    const band = (opts.band || 0.05) * Math.abs(span);
    let ts = 0;
    for (const i of idx) if (Math.abs(y[i] - yf) > band) ts = t[i] - t0;
    // число колебаний: максимумы вне зоны ±band выше установившегося значения
    let N = 0;
    for (let k = 1; k < idx.length - 1; k++) {
      const i = idx[k];
      const a = (y[idx[k - 1]] - yinit) * Math.sign(span), b = (y[i] - yinit) * Math.sign(span), c = (y[idx[k + 1]] - yinit) * Math.sign(span);
      if (b >= a && b > c && b - Math.abs(span) > band) N++;
    }
    return { yinit, yfinal: yf, ymax: yinit + ymax * Math.sign(span || 1), tpeak: tmax - t0, sigma, tr, t1090: tr1 - tr0, ts, N };
  }

  /* ---------- Нелдер–Мид ---------- */
  function nelderMead(f, x0, opts) {
    opts = opts || {};
    const n = x0.length, maxIt = opts.maxIt || 4000, tol = opts.tol || 1e-10;
    let simplex = [x0.slice()];
    for (let i = 0; i < n; i++) { const p = x0.slice(); p[i] = p[i] !== 0 ? p[i] * 1.15 : 0.1; simplex.push(p); }
    let vals = simplex.map(f);
    for (let it = 0; it < maxIt; it++) {
      const ord = vals.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]).map(p => p[1]);
      simplex = ord.map(i => simplex[i]); vals = ord.map(i => vals[i]);
      if (Math.abs(vals[n] - vals[0]) < tol * (1 + Math.abs(vals[0]))) break;
      const c = new Array(n).fill(0);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += simplex[i][j] / n;
      const xr = c.map((cj, j) => cj + (cj - simplex[n][j])); const fr = f(xr);
      if (fr < vals[0]) { const xe = c.map((cj, j) => cj + 2 * (cj - simplex[n][j])); const fe = f(xe); if (fe < fr) { simplex[n] = xe; vals[n] = fe; } else { simplex[n] = xr; vals[n] = fr; } }
      else if (fr < vals[n - 1]) { simplex[n] = xr; vals[n] = fr; }
      else {
        const xc = c.map((cj, j) => cj + 0.5 * (simplex[n][j] - cj)); const fc = f(xc);
        if (fc < vals[n]) { simplex[n] = xc; vals[n] = fc; }
        else { for (let i = 1; i <= n; i++) { simplex[i] = simplex[i].map((v, j) => simplex[0][j] + 0.5 * (v - simplex[0][j])); vals[i] = f(simplex[i]); } }
      }
    }
    return { x: simplex[0], f: vals[0] };
  }

  /* ---------- стандартные ряды ---------- */
  function nearestInSeries(value, base, decadeFn) {
    // base — значения внутри декады [100..1000), value > 0
    if (!(value > 0)) return value;
    const e = Math.floor(Math.log10(value)) - 2;
    let best = null;
    for (let d = e - 1; d <= e + 1; d++) for (const b of base) {
      const cand = b * Math.pow(10, d);
      const err = Math.abs(Math.log(cand / value));
      if (best === null || err < best.err - 1e-12) best = { v: cand, err };
    }
    return best.v;
  }
  function nearestInList(value, list) {
    let best = list[0], err = Infinity;
    for (const v of list) { const e = Math.abs(Math.log(v / value)); if (e < err) { err = e; best = v; } }
    return best;
  }

  const api = { trim, conv, padd, pscale, polyval, convMany, ppow, C, cpolyval, roots, tf, series, parallel, feedback, tfdiv, freq, dcgain, minreal, polyFromRoots,
    logspace, bodeData, margins, resonancePeak, bilinear, tf2ss, matmul, eye, expm, c2dzoh, ssEval, simulate, stepInfo, nelderMead, nearestInSeries, nearestInList, solve };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.NC = api;
})(typeof window !== 'undefined' ? window : globalThis);
