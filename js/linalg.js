/* =====================================================================
 * linalg.js — матричная алгебра для моделей в пространстве состояний:
 * обращение, собственные значения, решение уравнения Риккати (LQR),
 * точная дискретизация (ZOH) многомерных систем.
 * ===================================================================== */
(function (root) {
  'use strict';
  const NC = root.NC || (typeof require !== 'undefined' ? require('./core.js') : null);

  const zeros = (n, m) => { const Z = []; for (let i = 0; i < n; i++) Z.push(new Array(m).fill(0)); return Z; };
  const eye = n => { const I = zeros(n, n); for (let i = 0; i < n; i++) I[i][i] = 1; return I; };
  const T = A => A[0].map((_, j) => A.map(r => r[j]));
  const mul = (A, B) => NC.matmul(A, B);
  const add = (A, B, k) => { k = k === undefined ? 1 : k; return A.map((r, i) => r.map((v, j) => v + k * B[i][j])); };
  const sc = (A, k) => A.map(r => r.map(v => v * k));
  const copy = A => A.map(r => r.slice());
  const norm1 = A => { let m = 0; for (let j = 0; j < A[0].length; j++) { let s = 0; for (let i = 0; i < A.length; i++) s += Math.abs(A[i][j]); m = Math.max(m, s); } return m; };
  /* блочная матрица: rows = [[A, B], [C, D]] */
  function block(rows) {
    const out = [];
    for (const br of rows) {
      const h = br[0].length;
      for (let i = 0; i < h; i++) { let r = []; for (const b of br) r = r.concat(b[i]); out.push(r); }
    }
    return out;
  }
  function blkdiag(...Ms) {
    const n = Ms.reduce((s, M) => s + M.length, 0), m = Ms.reduce((s, M) => s + M[0].length, 0);
    const Z = zeros(n, m); let r0 = 0, c0 = 0;
    for (const M of Ms) { M.forEach((r, i) => r.forEach((v, j) => Z[r0 + i][c0 + j] = v)); r0 += M.length; c0 += M[0].length; }
    return Z;
  }
  function inv(A) { return NC.solve(A, eye(A.length)); }
  /* A \ B (как в MATLAB) */
  function ldiv(A, B) { return NC.solve(A, B); }
  function det(A) {
    const n = A.length, M = copy(A); let d = 1;
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (M[p][c] === 0) return 0;
      if (p !== c) { [M[c], M[p]] = [M[p], M[c]]; d = -d; }
      d *= M[c][c];
      for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; for (let j = c; j < n; j++) M[r][j] -= f * M[c][j]; }
    }
    return d;
  }
  /* log|det| — для масштабирования в методе матричной функции знака */
  function logAbsDet(A) {
    const n = A.length, M = copy(A); let s = 0;
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (M[p][c] === 0) return -Infinity;
      if (p !== c) [M[c], M[p]] = [M[p], M[c]];
      s += Math.log(Math.abs(M[c][c]));
      for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; for (let j = c; j < n; j++) M[r][j] -= f * M[c][j]; }
    }
    return s;
  }

  /* ---------- собственные значения: приведение к форме Хессенберга + QR-алгоритм со сдвигами (hqr) ---------- */
  function eig(Ain) {
    const n = Ain.length;
    const a = copy(Ain);
    // балансировка не нужна для матриц малой размерности; приведение к Хессенбергу (метод отражений Гаусса, elmhes)
    for (let m = 1; m < n - 1; m++) {
      let x = 0, i = m;
      for (let j = m; j < n; j++) if (Math.abs(a[j][m - 1]) > Math.abs(x)) { x = a[j][m - 1]; i = j; }
      if (i !== m) {
        for (let j = m - 1; j < n; j++) [a[i][j], a[m][j]] = [a[m][j], a[i][j]];
        for (let j = 0; j < n; j++) [a[j][i], a[j][m]] = [a[j][m], a[j][i]];
      }
      if (x) {
        for (i = m + 1; i < n; i++) {
          let y = a[i][m - 1];
          if (y) { y /= x; a[i][m - 1] = y; for (let j = m; j < n; j++) a[i][j] -= y * a[m][j]; for (let j = 0; j < n; j++) a[j][m] += y * a[j][i]; }
        }
      }
    }
    for (let i = 2; i < n; i++) for (let j = 0; j < i - 1; j++) a[i][j] = 0;
    // hqr (Numerical Recipes), индексы с нуля
    const wr = new Array(n).fill(0), wi = new Array(n).fill(0);
    let anorm = 0;
    for (let i = 0; i < n; i++) for (let j = Math.max(i - 1, 0); j < n; j++) anorm += Math.abs(a[i][j]);
    let nn = n - 1, t = 0;
    while (nn >= 0) {
      let its = 0, l;
      do {
        for (l = nn; l >= 1; l--) {
          const s = Math.abs(a[l - 1][l - 1]) + Math.abs(a[l][l]);
          if (Math.abs(a[l][l - 1]) + (s === 0 ? anorm : s) === (s === 0 ? anorm : s)) { a[l][l - 1] = 0; break; }
        }
        const x = a[nn][nn];
        if (l === nn) { wr[nn] = x + t; wi[nn--] = 0; }
        else {
          const y = a[nn - 1][nn - 1], w = a[nn][nn - 1] * a[nn - 1][nn];
          if (l === nn - 1) {
            const p = 0.5 * (y - x), q = p * p + w, z = Math.sqrt(Math.abs(q));
            let xx = x + t;
            if (q >= 0) {
              const zz = p + (p >= 0 ? Math.abs(z) : -Math.abs(z));
              wr[nn - 1] = wr[nn] = xx + zz;
              if (zz) wr[nn] = xx - w / zz;
              wi[nn - 1] = wi[nn] = 0;
            } else { wr[nn - 1] = wr[nn] = xx + p; wi[nn - 1] = -(wi[nn] = z); }
            nn -= 2;
          } else {
            if (its === 60) throw new Error('eig: QR-алгоритм не сошёлся');
            let xx = x, yy = y, ww = w;
            if (its === 10 || its === 20) {
              t += xx;
              for (let i = 0; i <= nn; i++) a[i][i] -= xx;
              const s = Math.abs(a[nn][nn - 1]) + Math.abs(a[nn - 1][nn - 2]);
              yy = xx = 0.75 * s; ww = -0.4375 * s * s;
            }
            ++its;
            let m, p, q, r, z;
            for (m = nn - 2; m >= l; m--) {
              z = a[m][m]; r = xx - z; const s0 = yy - z;
              p = (r * s0 - ww) / a[m + 1][m] + a[m][m + 1]; q = a[m + 1][m + 1] - z - r - s0; r = a[m + 2][m + 1];
              const s = Math.abs(p) + Math.abs(q) + Math.abs(r);
              p /= s; q /= s; r /= s;
              if (m === l) break;
              const u = Math.abs(a[m][m - 1]) * (Math.abs(q) + Math.abs(r));
              const v = Math.abs(p) * (Math.abs(a[m - 1][m - 1]) + Math.abs(z) + Math.abs(a[m + 1][m + 1]));
              if (u + v === v) break;
            }
            for (let i = m + 2; i <= nn; i++) { a[i][i - 2] = 0; if (i !== m + 2) a[i][i - 3] = 0; }
            for (let k = m; k <= nn - 1; k++) {
              if (k !== m) {
                p = a[k][k - 1]; q = a[k + 1][k - 1]; r = 0;
                if (k !== nn - 1) r = a[k + 2][k - 1];
                xx = Math.abs(p) + Math.abs(q) + Math.abs(r);
                if (xx !== 0) { p /= xx; q /= xx; r /= xx; }
              }
              const s = (p >= 0 ? 1 : -1) * Math.sqrt(p * p + q * q + r * r);
              if (s !== 0) {
                if (k === m) { if (l !== m) a[k][k - 1] = -a[k][k - 1]; }
                else a[k][k - 1] = -s * xx;
                p += s; xx = p / s; yy = q / s; z = r / s; q /= p; r /= p;
                for (let j = k; j <= nn; j++) {
                  p = a[k][j] + q * a[k + 1][j];
                  if (k !== nn - 1) { p += r * a[k + 2][j]; a[k + 2][j] -= p * z; }
                  a[k + 1][j] -= p * yy; a[k][j] -= p * xx;
                }
                const mmin = nn < k + 3 ? nn : k + 3;
                for (let i = l; i <= mmin; i++) {
                  p = xx * a[i][k] + yy * a[i][k + 1];
                  if (k !== nn - 1) { p += z * a[i][k + 2]; a[i][k + 2] -= p * r; }
                  a[i][k + 1] -= p * q; a[i][k] -= p;
                }
              }
            }
          }
        }
      } while (l < nn - 1);
    }
    const out = wr.map((re, k) => [re, wi[k]]);
    // порядок: по убыванию вещественной части, затем по мнимой
    out.forEach(z => { if (Math.abs(z[0]) < 1e-11 * (1 + anorm)) z[0] = 0; if (Math.abs(z[1]) < 1e-11 * (1 + anorm)) z[1] = 0; });
    out.sort((p, q) => q[0] - p[0] || q[1] - p[1]);
    return out;
  }

  /* ---------- уравнение Риккати AᵀP + PA − PBR⁻¹BᵀP + Q = 0: метод матричной функции знака ---------- */
  function care(A, B, Q, R) {
    const n = A.length;
    const Ri = inv(R);
    const S = mul(mul(B, Ri), T(B));
    let Z = block([[A, sc(S, -1)], [sc(Q, -1), sc(T(A), -1)]]);
    const N2 = 2 * n;
    for (let it = 0; it < 200; it++) {
      const c = Math.exp(-logAbsDet(Z) / N2);
      const Zi = inv(Z);
      const Zn = add(sc(Z, 0.5 * c), Zi, 0.5 / c);
      const d = norm1(add(Zn, Z, -1)) / Math.max(1, norm1(Zn));
      Z = Zn;
      if (d < 1e-14) break;
    }
    const W11 = [], W12 = [], W21 = [], W22 = [];
    for (let i = 0; i < n; i++) { W11.push(Z[i].slice(0, n)); W12.push(Z[i].slice(n)); W21.push(Z[n + i].slice(0, n)); W22.push(Z[n + i].slice(n)); }
    const Mm = block([[W12], [add(W22, eye(n))]]);
    const Nm = sc(block([[add(W11, eye(n))], [W21]]), -1);
    const Mt = T(Mm);
    let P = NC.solve(mul(Mt, Mm), mul(Mt, Nm));
    P = sc(add(P, T(P)), 0.5);
    // уточнение итерацией Ньютона–Клейнмана (одна-две итерации для точности)
    for (let k = 0; k < 2; k++) {
      const K = mul(mul(Ri, T(B)), P);
      const Ac = add(A, mul(B, K), -1);
      const Qk = add(Q, mul(mul(T(K), R), K));
      const Pn = lyap(T(Ac), Qk);
      if (Pn) P = sc(add(Pn, T(Pn)), 0.5);
    }
    return P;
  }
  /* решение уравнения Ляпунова Xᵀ… : A X + X Aᵀ + Q = 0 (кронекеровская форма, малые n) */
  function lyap(A, Q) {
    const n = A.length, N = n * n;
    const M = zeros(N, N), b = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const r = i * n + j;
      for (let k = 0; k < n; k++) { M[r][k * n + j] += A[i][k]; M[r][i * n + k] += A[j][k]; }
      b.push([-Q[i][j]]);
    }
    try { const x = NC.solve(M, b); const X = zeros(n, n); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) X[i][j] = x[i * n + j][0]; return X.some(r => r.some(v => !isFinite(v))) ? null : X; }
    catch (e) { return null; }
  }
  function lqr(A, B, Q, R) {
    const P = care(A, B, Q, R);
    const K = mul(mul(inv(R), T(B)), P);
    const Ac = add(A, mul(B, K), -1);
    const res = add(add(add(mul(T(A), P), mul(P, A)), mul(mul(mul(P, B), inv(R)), mul(T(B), P)), -1), Q);
    return { K, P, Ac, poles: eig(Ac), residual: norm1(res) / Math.max(1, norm1(P)) };
  }
  /* точная дискретизация с экстраполятором нулевого порядка */
  function c2d(A, B, dt) {
    const n = A.length, m = B[0].length;
    const M = zeros(n + m, n + m);
    for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) M[i][j] = A[i][j] * dt; for (let j = 0; j < m; j++) M[i][n + j] = B[i][j] * dt; }
    const E = NC.expm(M);
    return { Ad: E.slice(0, n).map(r => r.slice(0, n)), Bd: E.slice(0, n).map(r => r.slice(n)) };
  }
  const mv = (A, x) => A.map(r => r.reduce((s, a, j) => s + a * x[j], 0));

  const api = { zeros, eye, T, mul, add, sc, copy, block, blkdiag, inv, ldiv, det, eig, care, lyap, lqr, c2d, mv, norm1 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.LA = api;
})(typeof window !== 'undefined' ? window : globalThis);
