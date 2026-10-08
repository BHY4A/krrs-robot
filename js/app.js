/* app.js — интерфейс веб-утилиты «Робот-балансир» */
(function () {
  'use strict';
  const D = window.LABDATA, L = window.LABS, NC = window.NC, G = window.MATGEN, CH = window.CHARTS, DG = window.DIAG;
  const fnum = L.fnum;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const R2D = 180 / Math.PI;
  const NV = D.variants.length;              // варианты 0 (пример) … 28
  const VMAX = D.variants[NV - 1].no;
  const vLabel = no => no === 0 ? 'пр.' : String(no);

  const LABS_META = [
    { id: 'data', no: '0', short: 'Данные', t: 'Исходные данные', s: 'Вариант, параметры, отчёт' },
    { id: 'lr1', no: '1', short: 'Модель', t: 'Математическая модель', s: 'Лагранж, E, F, G, H, I, J, K' },
    { id: 'lr2', no: '2', short: 'Пр. сост.', t: 'Пространство состояний', s: 'A1…D2, устойчивость, рис. 19–20' },
    { id: 'lr3', no: '3', short: 'Системная', t: 'Системная модель', s: 'ШИМ, датчики, Real/Ideal, шины' },
    { id: 'lr4', no: '4', short: 'LQR', t: 'LQR-регулятор', s: 's1 → s3 → s4, реальные датчики' },
    { id: 'lr5', no: '5', short: 'Вопросы', t: 'Контрольные вопросы', s: 'Ответы для защиты' }
  ];
  const TITLES = {
    lr1: 'Математическая модель робота-балансира', lr2: 'Модель робота в пространстве состояний',
    lr3: 'Системная модель робота', lr4: 'Система управления: LQR-регулятор', lr5: 'Контрольные вопросы'
  };
  const TABS = ['lr1', 'lr2', 'lr3', 'lr4', 'lr5'];

  /* ---------------- состояние ---------------- */
  const S = { P: null, R: null, sims: {}, tab: 'data', err: null, T: null };
  const T_DEF = {
    org: 'МИНОБРНАУКИ РОССИИ\nФедеральное государственное бюджетное образовательное учреждение\nвысшего образования\n«Казанский национальный исследовательский технологический университет»\n(ФГБОУ ВО «КНИТУ»)',
    dept: '', discipline: 'Конструирование роботов и робототехнических систем', kind: 'лабораторной работе', title: '',
    group: '741-15', student: '', teacher: 'Малев Н. А.', city: 'Казань', year: String(new Date().getFullYear()),
    logo: true, explain: true, listings: false, readable: true, watermark: true, codePlain: true, questions: true
  };
  function loadT() { let t = null; try { t = JSON.parse(localStorage.getItem('rb-title') || 'null'); } catch (e) { t = null; } S.T = Object.assign({}, T_DEF, t || {}); }
  function saveT() { try { localStorage.setItem('rb-title', JSON.stringify(S.T)); } catch (e) { /* ignore */ } autoSave(); }
  function save() { try { localStorage.setItem('rb-state', JSON.stringify({ P: S.P, tab: S.tab })); } catch (e) { /* хранилище недоступно */ } autoSave(); }
  let autoTimer = null;
  function autoSave(now) {
    if (S.skipAuto) { S.skipAuto = false; return; }
    clearTimeout(autoTimer);
    const run = () => {
      if (!S.P || !S.T) return;
      try { localStorage.setItem('rb-autosave', JSON.stringify({ name: 'Автосохранение', at: Date.now(), tab: S.tab, P: S.P, T: S.T })); } catch (e) { return; }
      const row = $('#slot-auto'); if (row) row.outerHTML = autoRowHtml(), bindAuto();
    };
    if (now) run(); else autoTimer = setTimeout(run, 1200);
  }
  const clampV = v => Math.min(VMAX, Math.max(0, v | 0));
  function load() {
    let st = null;
    try { st = JSON.parse(localStorage.getItem('rb-state') || 'null'); } catch (e) { st = null; }
    const h = (location.hash || '').match(/^#v(\d+)(?:-(lr\d|data))?(?:&s=([\w-]+))?$/);
    if (h && h[3]) {
      const v = clampV(+h[1]);
      let diff = {}; try { diff = JSON.parse(decodeURIComponent(escape(atob(h[3].replace(/-/g, '+').replace(/_/g, '/'))))); } catch (e) { diff = {}; }
      S.P = Object.assign(L.fromVariant(v), diff); S.tab = h[2] || 'data'; S.shared = true;
    } else if (h) {
      const v = clampV(+h[1]);
      S.P = (st && st.P && st.P.variant === v) ? Object.assign(L.defaults(), st.P) : L.fromVariant(v);
      S.tab = h[2] || (st && st.tab) || 'data';
    } else if (st && st.P) { S.P = Object.assign(L.defaults(), st.P); S.tab = st.tab || 'data'; }
    else { S.P = L.fromVariant(1); S.tab = 'data'; }
    if (S.tab !== 'data' && !TABS.includes(S.tab)) S.tab = 'data';
  }
  function setHash() { try { history.replaceState(null, '', '#v' + S.P.variant + '-' + S.tab); } catch (e) { /* ignore */ } }

  function recompute() {
    try { S.R = L.compute(S.P); S.err = null; }
    catch (e) { console.error(e); S.err = e; }
    S.sims = {};
    save(); setHash();
    renderTop();
    renderTab();
  }

  /* ---------------- KaTeX ---------------- */
  function texify(s) { return String(s).replace(/_\{(max|min)\}/g, '_{\\mathrm{$1}}').replace(/([А-Яа-яЁё][А-Яа-яЁё.]*)/g, '\\text{$1}'); }
  function tex(s, display) {
    try { return katex.renderToString(texify(s), { displayMode: !!display, throwOnError: false, strict: 'ignore', output: 'html' }); }
    catch (e) { return '<code>' + esc(s) + '</code>'; }
  }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  const pw = v => String(v === undefined || v === null ? '' : v).replace(/·10\^(-?\d+)/g, (m, e) => '·10<sup>' + e.replace('-', '−') + '</sup>');
  function cell(c) { c = pw(c); return /[_^{\\]/.test(c) && !/</.test(c) ? tex(c.replace(/ψ/g, '\\psi').replace(/φ/g, '\\phi')) : c; }

  /* ---------------- шапка ---------------- */
  function renderTop() {
    const sel = $('#var-sel');
    if (sel.options.length !== NV) sel.innerHTML = D.variants.map(v => `<option value="${v.no}">${vLabel(v.no)}</option>`).join('');
    sel.value = S.P.variant;
    $$('nav.rail a').forEach(a => a.setAttribute('aria-current', a.dataset.tab === S.tab ? 'page' : 'false'));
    const R = S.R, P = S.P;
    const foot = $('#rail-foot');
    if (R && foot) foot.innerHTML = `<b>${P.variant ? 'Вариант ' + P.variant : 'Пример методички'}</b><br>M = ${fnum(P.M)} кг, h = ${fnum(P.h)} м<br>R = ${fnum(P.R)} м, W = ${fnum(P.W)} м, n = ${fnum(P.n)}<br>λ<sub>max</sub> = ${fnum(R.lamU)} с⁻¹ · K<sub>PWM</sub> = ${fnum(R.KPWM, 6)}`;
  }
  function stamp(no) {
    const R = S.R, P = S.P;
    return `<table class="stamp" aria-label="Штамп"><tr><td class="k">Работа</td><td class="v">${no ? 'Этап ' + no : 'Данные'}</td><td class="k">Лист</td><td class="v">${no || 0} / 5</td></tr>
      <tr><td class="k">Вариант</td><td class="v">${P.variant || 'пр.'}${isEdited() ? '*' : ''}</td><td class="k">n</td><td class="v">${fnum(P.n)}</td></tr>
      <tr><td class="k">Робот</td><td class="v" colspan="3">M = ${fnum(P.M)} кг, h = ${fnum(P.h)} м, R = ${fnum(P.R)} м</td></tr>
      <tr><td class="k">Двигатель</td><td class="v" colspan="3">Rm = ${fnum(P.Rm)} Ом, Kt = ${fnum(P.Kt)}, Kb = ${fnum(P.Kb)}</td></tr></table>`;
  }
  function isEdited() {
    const v = L.fromVariant(S.P.variant);
    return L.VKEYS.some(k => +v[k] !== +S.P[k]);
  }

  /* ---------------- вкладки ---------------- */
  function renderTab() {
    const main = $('#main');
    if (S.err) { main.innerHTML = `<div class="sheet"><div class="sheet-body"><div class="note bad" style="margin-top:20px">Ошибка расчёта: ${esc(S.err.message)}. Проверьте исходные данные.</div></div></div>`; return; }
    if (S.tab === 'data') renderData(main);
    else renderLab(main, S.tab);
    $$('nav.rail a').forEach(a => a.setAttribute('aria-current', a.dataset.tab === S.tab ? 'page' : 'false'));
    buildToc();
  }

  /* ---------- навигация по разделам текущей вкладки ---------- */
  function tocItems() {
    const out = [];
    $$('#main .sheet-body h2, #main .files').forEach((el, k) => {
      if (!el.id) el.id = 'sec-' + S.tab + '-' + k;
      const t = el.classList.contains('files') ? 'Файлы для MATLAB' : el.textContent.trim().replace(/\s+/g, ' ');
      const m = t.match(/^(\d+(?:\.\d+)?)\.?\s+(.*)$/);
      out.push({ id: el.id, no: m ? m[1] : '', t: m ? m[2] : t, el });
    });
    return out;
  }
  let tocList = [];
  function buildToc() {
    $$('.rail-toc').forEach(x => x.remove());
    tocList = tocItems();
    const fab = $('#toc-fab'); if (fab) fab.remove();
    const pop = $('#toc-pop'); if (pop) pop.remove();
    if (!tocList.length) return;
    const links = tocList.map(it => `<a href="#${it.id}" data-toc="${it.id}"><span class="tn">${it.no || (it.el.classList.contains('files') ? '↓' : '·')}</span><span>${esc(it.t)}</span></a>`).join('');
    const cur = $(`nav.rail a[data-tab="${S.tab}"]`);
    if (cur) cur.insertAdjacentHTML('afterend', `<div class="rail-toc" aria-label="Разделы">${links}</div>`);
    document.body.insertAdjacentHTML('beforeend', `<button class="toc-fab" id="toc-fab" aria-expanded="false" aria-controls="toc-pop"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M2 8h12M2 12h8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>Разделы</button><div class="toc-pop" id="toc-pop" hidden><div class="toc-pop-h">Разделы<button class="toc-top" data-top>↑ В начало</button></div>${links}</div>`);
    const f = $('#toc-fab'), p = $('#toc-pop');
    f.onclick = () => { const open = p.hidden; p.hidden = !open; f.setAttribute('aria-expanded', String(open)); };
    $('[data-top]', p).onclick = () => { window.scrollTo({ top: 0, behavior: 'smooth' }); p.hidden = true; f.setAttribute('aria-expanded', 'false'); };
    $$('[data-toc]').forEach(a => a.onclick = e => {
      e.preventDefault();
      const el = document.getElementById(a.dataset.toc); if (!el) return;
      const off = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--top-h')) || 64) + (window.innerWidth <= 960 ? 60 : 16);
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - off, behavior: 'smooth' });
      tocLock = a.dataset.toc; markToc(tocLock);
      p.hidden = true; f.setAttribute('aria-expanded', 'false');
    });
    spy();
  }
  let tocLock = null;
  ['wheel', 'touchmove', 'keydown', 'mousedown'].forEach(ev => window.addEventListener(ev, e => { if (tocLock && !(e.target.closest && e.target.closest('[data-toc]'))) { tocLock = null; } }, { passive: true }));
  function markToc(act) { $$('[data-toc]').forEach(a => a.classList.toggle('on', a.dataset.toc === act)); }
  function spy() {
    if (!tocList.length) return;
    if (tocLock) { markToc(tocLock); return; }
    const lim = window.innerWidth <= 960 ? 150 : 110;
    let act = tocList[0].id;
    for (const it of tocList) { if (it.el.getBoundingClientRect().top - lim <= 0) act = it.id; else break; }
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
      for (const it of tocList) { const r = it.el.getBoundingClientRect(); if (r.top < window.innerHeight * 0.6 && !it.el.classList.contains('files')) act = it.id; }
    }
    markToc(act);
    const on = $('.rail-toc a.on'), box = $('nav.rail');
    if (on && box && box.scrollHeight > box.clientHeight) { const r = on.getBoundingClientRect(), b = box.getBoundingClientRect(); if (r.top < b.top || r.bottom > b.bottom) on.scrollIntoView({ block: 'nearest' }); }
  }
  let spyRaf = 0;
  window.addEventListener('scroll', () => { if (!spyRaf) spyRaf = requestAnimationFrame(() => { spyRaf = 0; spy(); }); }, { passive: true });
  document.addEventListener('click', e => { const p = $('#toc-pop'); if (p && !p.hidden && !e.target.closest('#toc-pop, #toc-fab')) { p.hidden = true; const f = $('#toc-fab'); if (f) f.setAttribute('aria-expanded', 'false'); } });

  /* ---------- вкладка «Исходные данные» ---------- */
  const FIELDS = [
    ['m', 'm', 'Масса колеса', 'кг'], ['R', 'R', 'Радиус колеса', 'м'], ['M', 'M', 'Масса робота', 'кг'],
    ['W', 'W', 'Ширина робота', 'м'], ['D', 'D', 'Толщина робота', 'м'], ['h', 'h', 'Высота робота', 'м'],
    ['fw', 'f<sub>w</sub>', 'Вязкое трение колесо–пол', ''], ['fm', 'f<sub>m</sub>', 'Вязкое трение в моторе', ''],
    ['Jm', 'J<sub>m</sub>', 'Момент инерции ротора', 'кг·м²'], ['Rm', 'R<sub>m</sub>', 'Сопротивление обмотки', 'Ом'],
    ['Kb', 'K<sub>b</sub>', 'Коэффициент противо-ЭДС', 'В·с/рад'], ['Kt', 'K<sub>t</sub>', 'Коэф. передачи по току', 'Н·м/А'],
    ['n', 'n', 'Передаточное число редуктора', '']
  ];
  const ADV = [
    ['g', 'g', 'Ускорение свободного падения', 'м/с²'], ['Upit', 'U<sub>пит</sub>', 'Напряжение питания', 'В'], ['PWMmax', 'PWM<sub>max</sub>', 'Предел скважности ШИМ', ''],
    ['Uopen', 'U', 'Напряжение / ШИМ на этапах 2–3', ''], ['Psi0', 'ψ<sub>0</sub>', 'Начальный наклон робота', 'рад'],
    ['vref', 'θ̇<sub>зад</sub>', 'Заданная скорость колёс', 'рад/с'], ['wref', 'φ̇<sub>зад</sub>', 'Заданная скорость поворота', 'рад/с'],
    ['Tsim', 'T', 'Время моделирования', 'с'], ['dt', 'Δt', 'Шаг моделирования («auto» или число)', 'с'],
    ['qw', 'q', 'Множитель матрицы Q', ''], ['rw', 'r', 'Множитель матрицы R', '']
  ];
  function fld(key, sym, label, unit, val, changed, hint) {
    return `<div class="fld${changed ? ' changed' : ''}"><label for="f-${key}"><span>${label}</span><span class="sym">${sym}</span></label>
      <div class="inp${unit ? ' has-u' : ''}"><input id="f-${key}" data-key="${key}" inputmode="decimal" value="${esc(typeof val === 'number' ? String(val).replace('.', ',') : val)}" autocomplete="off">${unit ? `<span class="unit">${unit}</span>` : ''}</div>${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
  }
  function optRow(title, desc, ctl) {
    const key = (ctl.match(/data-t?key="(\w+)"/) || [])[1];
    const ex = key && PV[key] ? `<div class="opt-ex" data-pv="${key}">${exHtml(key)}</div>` : '';
    return `<div class="opt${ctl.startsWith('<div class="seg"') ? ' has-seg' : ''}"><div class="opt-t"><b>${title}</b>${desc ? `<span>${desc}</span>` : ''}</div><div class="opt-c">${ctl}</div>${ex}</div>`;
  }
  function exHtml(key) {
    const d = PV[key]();
    const box = (lbl, body, on) => `<div class="ex${on ? ' on' : ''}"><div class="ex-h">${lbl}${on ? '<span>сейчас</span>' : ''}</div><div class="ex-b">${body}</div></div>`;
    if (d.table) return `<div class="ex on ex-wide"><div class="ex-b">${d.table}</div></div>`;
    return box(d.la, d.a, !d.b_on) + box(d.lb, d.b, d.b_on) + (d.note ? `<p class="ex-note">${d.note}</p>` : '');
  }
  function altR(patch) { try { return L.compute(Object.assign({}, S.P, patch)); } catch (e) { return S.R; } }
  const F = t => `<div class="ex-f">${t}</div>`;
  const TX = t => `<p class="ex-p">${t}</p>`;
  const PV = {
    dec() {
      const md = S.R.md, cur = S.P.dec === undefined ? -1 : +S.P.dec;
      const w = k => k === 1 ? 'знак' : k < 5 ? 'знака' : 'знаков';
      const f = (x, k) => k < 0 ? L.fauto(x) : L.fdec(x, k);
      const cols = [['J<sub>w</sub>, кг·м²', md.Jw], ['α, Н·м/В', md.alpha], ['I, кг·м²', md.I], ['K<sub>lqr,12</sub>', S.R.lqr.s1.K[0][1]]];
      return { table: `<table class="ex-tbl"><thead><tr><th>Режим</th>${cols.map(c => `<th>${c[0]}</th>`).join('')}</tr></thead><tbody>${[-1, 1, 2, 3, 4, 5, 6].map(k => `<tr class="${k === cur ? 'on' : ''}"><td>${k < 0 ? 'Авто' : k + ' ' + w(k)}${k === cur ? ' <span>сейчас</span>' : ''}</td>${cols.map(c => `<td>${f(c[1], k)}</td>`).join('')}</tr>`).join('')}</tbody></table>` };
    },
    satOrder() {
      const on = S.P.satOrder === 'pwm', P = S.P;
      const body = pwm => F(pwm ? 'Round → Saturation (±' + P.PWMmax + ') → 1/K<sub>PWM</sub>' : 'Round → 1/K<sub>PWM</sub> → Saturation (±' + P.PWMmax + ')') + TX(pwm ? 'Напряжение ограничено ±' + fnum(P.Upit) + ' В — как у реального робота.' : 'Ограничение ±' + P.PWMmax + ' уже в вольтах: при U<sub>пит</sub> = ' + fnum(P.Upit) + ' В оно не срабатывает.');
      return { la: 'Как в методичке', a: body(false), lb: 'ШИМ до перевода в вольты', b: body(true), b_on: on, note: 'Влияет только на модель с неидеальностями (real_model = 1): с ограничением ±' + fnum(P.Upit) + ' В шум дифференцирования квантованных энкодеров может насыщать двигатели, и робот теряет устойчивость.' };
    },
    kpwmRound() {
      const on = !!S.P.kpwmRound, P = S.P, x = P.PWMmax / P.Upit;
      return { la: 'Точно', a: F('K<sub>PWM</sub> = ' + P.PWMmax + '/' + fnum(P.Upit) + ' = ' + fnum(x, 8)), lb: 'До 0,01 (как в методичке)', b: F('K<sub>PWM</sub> = ' + fnum(Math.round(x * 100) / 100, 6)), b_on: on };
    },
    logo() {
      const page = l => `<div class="ex-paper title">${l ? '<b class="ex-logo">КНИТУ</b>' : ''}<p>МИНОБРНАУКИ РОССИИ</p><p>Федеральное государственное бюджетное образовательное учреждение высшего образования</p><p>«Казанский национальный исследовательский технологический университет»</p></div>`;
      return { la: 'Без логотипа', a: page(false), lb: 'С логотипом', b: page(true), b_on: !!S.T.logo };
    },
    explain() {
      const page = e => `<div class="ex-paper">${e ? '<p>Коэффициент передачи двигателя от напряжения к моменту на колесе:</p>' : ''}<div class="ex-math">α = nK<sub>t</sub>/R<sub>m</sub> = ${fnum(S.R.md.alpha)} Н·м/В</div>${e ? '<p>Приведённый момент инерции робота при повороте:</p>' : ''}<div class="ex-math">I = mW²/2 + J<sub>φ</sub> + … = ${fnum(S.R.md.I)} кг·м²</div></div>`;
      return { la: 'Только формулы', a: page(false), lb: 'С пояснениями', b: page(true), b_on: !!S.T.explain };
    },
    listings() {
      const page = l => `<div class="ex-paper">${l ? '<p class="h">Программы MATLAB</p><p class="cap">Листинг 4.2 — control.m</p><pre>QQ = eye(7);\nRR = eye(2);\nKlqr = lqr(s4, QQ, RR);</pre>' : ''}<p class="h">Вывод</p><p>Синтезирован LQR-регулятор, робот сохраняет равновесие…</p></div>`;
      return { la: 'Без листингов', a: page(false), lb: 'С листингами', b: page(true), b_on: !!S.T.listings };
    },
    codePlain() {
      const code = 'enc_l = rad2deg(y(1) - W/R/2*y(5) - y(2));\ngyro  = rad2deg(y(4));';
      return { la: 'Courier New', a: `<div class="ex-paper"><pre class="mono">${code}</pre></div>`, lb: 'Times New Roman', b: `<div class="ex-paper"><pre class="serif">${code}</pre></div>`, b_on: !!S.T.codePlain };
    },
    watermark() {
      const fig = w => `<div class="ex-paper fig"><svg viewBox="0 0 300 110" preserveAspectRatio="none"><path d="M30 8V100H295" fill="none" stroke="#7d8996"/><path d="M30 20 L45 70 Q60 100 80 80 T120 62 T170 58 L295 58" fill="none" stroke="#0072BD" stroke-width="2"/></svg>${w ? '<div class="ex-wm"><b>Замените рисунком из MATLAB</b><span>Что вставить: переходные процессы с LQR.</span><span>Откуда: Rob_model_lqr.m — figure «Этап 4».</span></div>' : ''}<p class="cap">Рисунок 4.3 — Переходные процессы</p></div>`;
      return { la: 'Без подложки', a: fig(false), lb: 'С подложкой', b: fig(true), b_on: !!S.T.watermark };
    },
    readable() {
      const brk = '<div class="ex-brk"><span>разрыв страницы</span></div>';
      const off = `<div class="ex-paper"><p>…конец предыдущего расчёта.</p><p class="cap">Листинг 3.1 — MATLAB Function (fcn)</p><pre class="mono">function [enc_l, enc_r, gyro] = fcn(y, R, W)</pre>${brk}<pre class="mono">enc_l = rad2deg(…);\ngyro = rad2deg(y(4));</pre></div>`;
      const on = `<div class="ex-paper"><p>…конец предыдущего расчёта.</p><p class="gap">свободное место</p>${brk}<p class="cap">Листинг 3.1 — MATLAB Function (fcn)</p><pre class="mono">function [enc_l, enc_r, gyro] = fcn(y, R, W)\nenc_l = rad2deg(…);\ngyro = rad2deg(y(4));</pre></div>`;
      return { la: 'Обычный перенос', a: off, lb: 'Блок целиком', b: on, b_on: !!S.T.readable };
    },
    questions() {
      const page = q => `<div class="ex-paper"><p class="h">Вывод</p><p>…система остаётся устойчивой.</p>${q ? '<p class="h">Ответы на контрольные вопросы</p><p class="cap"><b>1. Что такое маятник?</b></p><p>Маятник — твёрдое тело, совершающее колебания…</p>' : ''}</div>`;
      return { la: 'Без ответов', a: page(false), lb: 'С ответами', b: page(true), b_on: !!S.T.questions };
    }
  };
  function refreshPv(key) { const el = $(`.opt-ex[data-pv="${key}"]`); if (el && PV[key]) el.innerHTML = exHtml(key); }
  function seg(scope, key, cur, opts, kind) {
    return `<div class="seg" role="radiogroup" data-scope="${scope}" data-key="${key}" data-kind="${kind}">${opts.map(([v, l]) => `<button type="button" role="radio" aria-checked="${String(v) === String(cur)}" data-val="${v}">${l}</button>`).join('')}</div>`;
  }
  function sw(key) { return `<label class="sw"><input type="checkbox" data-tkey="${key}" ${S.T[key] ? 'checked' : ''}><span class="track" aria-hidden="true"></span><span class="sr">вкл.</span></label>`; }
  /* ---------- подсказка над блоками схем ---------- */
  (function () {
    let tip = null;
    const show = (g, x, y) => {
      if (!tip) { tip = document.createElement('div'); tip.className = 'tipbox'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
      const [nm, d] = g.dataset.tip.split('|');
      tip.innerHTML = `<small>Блок в Simulink</small><b>${esc(nm)}</b>${d ? `<span>${esc(d)}</span>` : ''}`;
      tip.style.display = 'block';
      const w = tip.offsetWidth, h = tip.offsetHeight;
      tip.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x - w / 2)) + 'px';
      tip.style.top = (y - h - 12 < 8 ? y + 18 : y - h - 12) + 'px';
    };
    const hide = () => { if (tip) tip.style.display = 'none'; };
    document.addEventListener('mousemove', e => { const g = e.target.closest && e.target.closest('[data-tip]'); if (g) show(g, e.clientX, e.clientY); else hide(); });
    document.addEventListener('focusin', e => { const g = e.target.closest && e.target.closest('[data-tip]'); if (g) { const r = g.getBoundingClientRect(); show(g, r.left + r.width / 2, r.top); } });
    document.addEventListener('focusout', hide);
    window.addEventListener('scroll', hide, { passive: true });
  })();
  /* ---------- ссылка «поделиться» ---------- */
  function shareUrl() {
    const base = L.fromVariant(S.P.variant), diff = {};
    for (const k of Object.keys(S.P)) if (k !== 'variant' && JSON.stringify(S.P[k]) !== JSON.stringify(base[k])) diff[k] = S.P[k];
    let h = '#v' + S.P.variant + '-' + S.tab;
    if (Object.keys(diff).length) h += '&s=' + btoa(unescape(encodeURIComponent(JSON.stringify(diff)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return location.href.split('#')[0] + h;
  }
  function share() { copyText(shareUrl(), 'Ссылка скопирована: по ней откроется этот же расчёт'); }
  /* ---------- слоты сохранений ---------- */
  const SLOT_KEY = 'rb-slots', SLOT_N = 5;
  function getSlots() { let a = null; try { a = JSON.parse(localStorage.getItem(SLOT_KEY) || 'null'); } catch (e) { a = null; } a = Array.isArray(a) ? a : []; while (a.length < SLOT_N) a.push(null); return a.slice(0, SLOT_N); }
  function putSlots(a) { try { localStorage.setItem(SLOT_KEY, JSON.stringify(a)); return true; } catch (e) { toast('Браузер не разрешает сохранять данные на этой странице'); return false; } }
  function slotMeta(sl) {
    const d = new Date(sl.at), pad = x => String(x).padStart(2, '0');
    return `${sl.P.variant ? 'Вариант ' + sl.P.variant : 'Пример методички'}${sl.T && sl.T.student ? ' · ' + esc(sl.T.student) : ''} · ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function getAuto() { try { return JSON.parse(localStorage.getItem('rb-autosave') || 'null'); } catch (e) { return null; } }
  function autoRowHtml() {
    const sl = getAuto();
    return `<div class="opt slot auto" id="slot-auto"><div class="opt-t"><b><i class="slot-no">А</i>Автосохранение</b><span>${sl ? slotMeta(sl) + ' · обновляется само после каждого изменения; загрузка слота его не затирает' : 'Появится после первого изменения'}</span></div><div class="opt-c slot-act">${sl ? '<button class="btn primary" id="slot-auto-load">Загрузить</button>' : ''}</div></div>`;
  }
  function bindAuto() {
    const b = $('#slot-auto-load'); if (!b) return;
    b.onclick = () => { const sl = getAuto(); if (!sl) return; S.P = Object.assign(L.defaults(), sl.P); S.T = Object.assign({}, T_DEF, sl.T || {}); S.skipAuto = true; saveT(); S.skipAuto = true; recompute(); toast('Загружено автосохранение'); };
  }
  function slotsHtml() {
    return autoRowHtml() + getSlots().map((sl, k) => `<div class="opt slot${sl ? '' : ' empty'}"><div class="opt-t"><b><i class="slot-no">${k + 1}</i>${sl ? esc(sl.name) : 'Пустой слот'}</b><span>${sl ? slotMeta(sl) : 'Сохраните сюда текущее состояние'}</span></div><div class="opt-c slot-act">
      <button class="btn" data-slot-save="${k}">${sl ? 'Перезаписать' : 'Сохранить'}</button>${sl ? `<button class="btn primary" data-slot-load="${k}">Загрузить</button><button class="btn icon-x" data-slot-del="${k}" title="Удалить" aria-label="Удалить слот ${k + 1}">✕</button>` : ''}</div></div>`).join('');
  }
  function bindSlots() {
    const box = $('#slots'); if (!box) return;
    const redraw = () => { box.innerHTML = slotsHtml(); bindSlots(); };
    bindAuto();
    $$('[data-slot-save]', box).forEach(b => b.onclick = () => {
      const k = +b.dataset.slotSave, a = getSlots();
      const def = a[k] ? a[k].name : (S.P.variant ? 'Вариант ' + S.P.variant : 'Пример') + (S.T.student ? ' — ' + S.T.student : '');
      const name = prompt('Название сохранения', def); if (name === null) return;
      a[k] = { name: name.trim() || def, at: Date.now(), P: JSON.parse(JSON.stringify(S.P)), T: JSON.parse(JSON.stringify(S.T)) };
      if (putSlots(a)) { toast('Сохранено в слот ' + (k + 1)); redraw(); }
    });
    $$('[data-slot-load]', box).forEach(b => b.onclick = () => {
      const sl = getSlots()[+b.dataset.slotLoad]; if (!sl) return;
      autoSave(true);
      S.P = Object.assign(L.defaults(), sl.P); S.T = Object.assign({}, T_DEF, sl.T || {}); S.skipAuto = true; saveT();
      S.skipAuto = true; recompute(); toast('Загружено: ' + sl.name);
    });
    $$('[data-slot-del]', box).forEach(b => b.onclick = () => {
      const k = +b.dataset.slotDel, a = getSlots(); if (!a[k] || !confirm('Удалить сохранение «' + a[k].name + '»?')) return;
      a[k] = null; if (putSlots(a)) redraw();
    });
    const ex = $('#slots-exp'); if (ex) ex.onclick = () => downloadText('robot-balansir-sohraneniya.json', JSON.stringify({ app: 'rb-lab', ver: 1, current: { P: S.P, T: S.T }, slots: getSlots() }, null, 1));
    const im = $('#slots-imp-f'); if (im) im.onchange = () => {
      const f = im.files && im.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const j = JSON.parse(rd.result); if (!j || j.app !== 'rb-lab' || !Array.isArray(j.slots)) throw new Error('fmt');
          const a = getSlots(); let n = 0;
          j.slots.forEach(sl => { if (!sl || !sl.P) return; const k = a.findIndex(x => !x); if (k < 0) return; a[k] = sl; n++; });
          if (putSlots(a)) { toast(n ? 'Импортировано сохранений: ' + n : 'Нет свободных слотов или пустой файл'); redraw(); }
        } catch (e) { toast('Это не файл сохранений утилиты'); }
        im.value = '';
      };
      rd.readAsText(f);
    };
  }
  function renderData(main) {
    const P = S.P, R = S.R, V = L.fromVariant(P.variant), DEF = L.defaults();
    const vrows = D.variants.map(v => `<tr data-v="${v.no}" class="${v.no === P.variant ? 'on' : ''}"><td class="num">${v.no || 'пр.'}</td>${L.VKEYS.map(k => `<td class="num">${fnum(v[k])}</td>`).join('')}</tr>`).join('');
    main.innerHTML = `<article class="sheet">
      <header class="sheet-head"><div><div class="eyebrow">Система исходных данных · таблица «Варианты»</div><h1>${P.variant ? 'Вариант ' + P.variant : 'Пример из методички'}</h1>
        <p class="lead">Выберите вариант вверху страницы — все этапы работы пересчитаются автоматически. Любое значение можно изменить: изменённые поля подсвечиваются. Вариант «пр.» — пример из текста методички (для сверки: K<sub>lqr</sub> = [−0,7071 −39,46 −1,5731 −4,0596]).</p></div>
        ${stamp(0)}
      </header>
      <div class="sheet-body rep data-page">
        <section class="dsec">
          <h2>1. Параметры робота</h2>
          <div class="form-grid fg4">${FIELDS.map(f => fld(f[0], f[1], f[2], f[3], P[f[0]], +V[f[0]] !== +P[f[0]])).join('')}</div>
          <div class="dact"><button class="btn" id="reset-var">Сбросить к ${P.variant ? 'варианту ' + P.variant : 'примеру'}</button><button class="btn" id="go-lr1">Перейти к этапу 1 →</button></div>
          <details class="adv"><summary>Таблица вариантов — все ${VMAX} вариантов и пример (щелчок по строке выбирает вариант)</summary><div class="in"><div class="tbl var-table"><table><thead><tr><th class="num">№</th>${['m', 'R', 'M', 'W', 'D', 'h', 'fw', 'fm', 'Jm', 'Rm', 'Kb', 'Kt', 'n'].map(k => `<th class="num">${k}</th>`).join('')}</tr></thead><tbody>${vrows}</tbody></table></div></div></details>
        </section>
        <section class="dsec">
          <h2>2. Методика расчёта</h2>
          <p class="dlead">Как округлять и как устроена модель с неидеальностями. Значения по умолчанию воспроизводят методичку.</p>
          <div class="opts">
            ${optRow('Точность вывода чисел', '«Авто» — 4 значащие цифры, целая часть не округляется. Цифра — фиксированное число знаков после запятой. На сам расчёт не влияет.', seg('P', 'dec', P.dec === undefined ? -1 : +P.dec, [[-1, 'Авто'], [1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6']], 'num'))}
            ${optRow('Коэффициент ШИМ', 'В методичке K<sub>PWM</sub> = 127/12 записан как 10,58.', seg('P', 'kpwmRound', !!P.kpwmRound, [[false, 'Точно'], [true, 'До 0,01']], 'bool'))}
            ${optRow('Порядок блоков Real_in', 'Где стоит ограничение Saturation — до или после перевода ШИМ в вольты.', seg('P', 'satOrder', P.satOrder || 'pdf', [['pdf', 'Как в методичке'], ['pwm', 'ШИМ до вольт']], 'str'))}
          </div>
          <details class="adv"><summary>Константы модели и моделирования (g, ШИМ, ψ₀, уставки, шаг, веса LQR)</summary><div class="in"><div class="form-grid">${ADV.map(f => fld(f[0], f[1], f[2], f[3], P[f[0]], String(DEF[f[0]]) !== String(P[f[0]]))).join('')}</div>
            <p class="dhint">По умолчанию — значения методички: g = 9,81 м/с², U<sub>пит</sub> = 12 В, ШИМ ±127, ψ<sub>0</sub> = 0,01 рад, уставки скоростей 1 рад/с, Q = eye(n), R = eye(2). Шаг «auto» = ${fnum(R.dtAuto)} с — меньше постоянной времени быстрейшего полюса замкнутой системы (1/|p|<sub>max</sub> = ${fnum(1 / R.pmax)} с); он же задаётся решателю ode4 в генерируемой модели.</p></div></details>
        </section>
        <section class="dsec">
          <h2>3. Отчёт и файлы</h2>
          <h3>Титульный лист</h3>
          <div class="form-grid fg4">
            ${tfld('student', 'Студент (Ф. И. О.)', 'Иванов И. И.')}${tfld('group', 'Группа', '741-15')}${tfld('teacher', 'Проверил', 'Малев Н. А.')}${tfld('discipline', 'Дисциплина', '')}
            ${tfld('title', 'Тема работы', REPORT.META.title)}${tfld('dept', 'Институт / кафедра', 'необязательно')}${tfld('city', 'Город', 'Казань')}${tfld('year', 'Год', '')}
          </div>
          <div class="fld"><label for="t-org"><span>Шапка титульного листа (каждая строка — отдельный абзац)</span></label><textarea id="t-org" data-tkey="org" rows="5">${esc(S.T.org)}</textarea></div>
          <div class="opts">${optRow('Логотип КНИТУ', 'Над шапкой титульного листа.', sw('logo'))}</div>
          <h3>Содержание и оформление</h3>
          <div class="opts">
            ${optRow('Пояснения к формулам', 'Перед каждой формулой — что считается и зачем.', sw('explain'))}
            ${optRow('Листинги программ MATLAB', 'Скрипты этапа в конце его раздела.', sw('listings'))}
            ${optRow('Ответы на контрольные вопросы', 'Отдельный раздел в конце отчёта.', sw('questions'))}
            ${optRow('Шрифт программного кода', 'Листинги MATLAB.', seg('T', 'codePlain', !!S.T.codePlain, [[true, 'Times New Roman'], [false, 'Courier New']], 'bool'))}
            ${optRow('Подложка на рисунках', '«Замените рисунком из MATLAB» — что и откуда вставить.', sw('watermark'))}
            ${optRow('Улучшение читаемости', 'Не разрывать абзацы, списки, листинги и пояснение с формулой между страницами.', sw('readable'))}
          </div>
          <h3>Скачать</h3>
          <div class="dl-grid"><button class="btn primary dl-all" data-docx="all">${dlIcon()} Отчёт по работе, этапы 1–4 (.docx)</button></div>
          <div class="dact"><button class="btn" id="zip-all">${dlIcon()} Архив работы (.zip)</button></div>
          <p class="dhint">Архив: скрипты MATLAB по этапам (как в методичке и для автоматической сборки моделей Simulink), те же скрипты по шагам в папке Po_shagam (каждая папка — набор файлов, после запуска которого получается соответствующий рисунок сайта), отчёт Word, полный расчёт в HTML, графики PNG и данные CSV. Архив отдельного шага скачивается на странице этапа.</p>
        </section>
        <section class="dsec">
          <h2>4. Сохранения</h2>
          <p class="dlead">Текущее состояние запоминается автоматически и восстанавливается при следующем открытии сайта; отдельно ведётся автосохранение. Чтобы держать несколько наборов (например, свой вариант и вариант одногруппника), сохраните их в слоты.</p>
          <div class="opts slots" id="slots">${slotsHtml()}</div>
          <div class="dact"><button class="btn" id="share2">${LINK_ICON} Скопировать ссылку на расчёт</button><button class="btn" id="slots-exp">${dlIcon()} Экспорт в файл</button><label class="btn" for="slots-imp-f">Импорт из файла</label><input type="file" id="slots-imp-f" accept=".json,application/json" hidden></div>
          <p class="dhint">Ссылка содержит вариант и все ваши правки — по ней одногруппник откроет ровно этот расчёт; данные титульного листа в ссылку не попадают. Слоты хранятся только в этом браузере на этом устройстве; чтобы перенести их, сохраните файл экспорта.</p>
        </section>
      </div></article>`;
    bindSlots();
    $('#zip-all').onclick = e => zipAll(e.currentTarget);
    $('#share2').onclick = share;
    $$('#main input[data-key], #main select[data-key]').forEach(el => el.addEventListener('change', onField));
    $$('#main .seg button').forEach(b => b.onclick = () => {
      const g = b.parentElement, raw = b.dataset.val, v = g.dataset.kind === 'bool' ? raw === 'true' : g.dataset.kind === 'str' ? raw : +raw;
      $$('button', g).forEach(x => x.setAttribute('aria-checked', String(x === b)));
      if (g.dataset.scope === 'P') { S.P[g.dataset.key] = v; recompute(); } else { S.T[g.dataset.key] = v; saveT(); refreshPv(g.dataset.key); }
    });
    $('#reset-var').onclick = () => { S.P = L.fromVariant(S.P.variant); recompute(); };
    $('#go-lr1').onclick = () => go('lr1');
    $$('#main [data-tkey]').forEach(el => el.addEventListener('change', () => { S.T[el.dataset.tkey] = el.type === 'checkbox' ? el.checked : el.value; saveT(); refreshPv(el.dataset.tkey); }));
    $$('#main [data-docx]').forEach(b => b.onclick = () => makeDocx(b));
    $$('.var-table tr[data-v]').forEach(tr => tr.onclick = () => setVariant(+tr.dataset.v));
  }
  function tfld(key, label, ph) {
    return `<div class="fld"><label for="t-${key}"><span>${label}</span></label><input id="t-${key}" data-tkey="${key}" value="${esc(S.T[key] || '')}" placeholder="${esc(ph)}" autocomplete="off" class="txt"></div>`;
  }
  function onField(e) {
    const el = e.target, k = el.dataset.key;
    let v;
    const raw = el.value.trim().replace(',', '.');
    if (k === 'dt' && (raw === '' || /^(auto|авто)$/i.test(raw))) v = 'auto';
    else {
      v = parseFloat(raw);
      if (!isFinite(v)) { toast('Введите число'); el.value = S.P[k]; return; }
      const zeroOk = ['fw', 'fm', 'Jm', 'Psi0', 'vref', 'wref', 'Uopen'];
      if (v < 0 || (v === 0 && !zeroOk.includes(k))) { toast(zeroOk.includes(k) ? 'Значение не может быть отрицательным' : 'Значение должно быть положительным'); el.value = S.P[k]; return; }
      if (k === 'Psi0' && v > 0.5) { toast('Начальный наклон должен быть малым (линейная модель): не больше 0,5 рад'); el.value = S.P[k]; return; }
      if (k === 'Tsim' && v > 60) { toast('Время моделирования — не больше 60 с'); el.value = S.P[k]; return; }
      if (k === 'dt' && (v < 1e-5 || v > 0.01)) { toast('Шаг — от 0,00001 до 0,01 с'); el.value = S.P[k]; return; }
    }
    S.P[k] = v;
    recompute();
  }
  function setVariant(v) { v = clampV(v); const keep = {}; ['dec', 'satOrder', 'kpwmRound'].forEach(k => keep[k] = S.P[k]); S.P = Object.assign(L.fromVariant(v), keep); recompute(); }

  /* ---------- вкладки этапов ---------- */
  function kpis(tab) {
    const R = S.R, md = R.md, P = S.P;
    const k = (a, b, u) => `<div class="kpi"><div class="k">${a}</div><div class="v">${pw(b)}${u ? ' <small>' + u + '</small>' : ''}</div></div>`;
    switch (tab) {
      case 'lr1': return k('J<sub>w</sub>', fnum(md.Jw), 'кг·м²') + k('J<sub>ψ</sub>', fnum(md.Jpsi), 'кг·м²') + k('J<sub>φ</sub>', fnum(md.Jphi), 'кг·м²') + k('α', fnum(md.alpha), 'Н·м/В') + k('β', fnum(md.beta), 'Н·м·с/рад') + k('I / J / K', fnum(md.I) + ' / ' + fnum(md.J) + ' / ' + fnum(md.K));
      case 'lr2': return k('λ<sub>max</sub> (g > 0)', fnum(R.lamU), 'с⁻¹') + k('Устойчивость', 'нет — робот падает') + (R.osc ? k('Период (g < 0)', fnum(R.osc.T), 'с') + k('ζ (g < 0)', fnum(R.osc.zeta)) : '') + k('θ̇<sub>уст</sub> при ' + fnum(P.Uopen) + ' В', fnum(R.thdSS), 'рад/с');
      case 'lr3': return k('K<sub>PWM</sub>', fnum(R.KPWM, 6)) + k('Δv = 1/K<sub>PWM</sub>', fnum(1 / R.KPWM), 'В') + k('W/(2R)', fnum(P.W / (2 * P.R))) + k('Шаг энкодера / гироскопа', '1° / 1°/с') + k('Шаг моделирования', fnum(R.dt), 'с');
      case 'lr4': return k('K<sub>ψ</sub> (s1)', fnum(R.lqr.s1.K[0][1])) + k('K<sub>ψ̇</sub> (s1)', fnum(R.lqr.s1.K[0][3])) + k('max Re p (s1)', fnum(Math.max(...R.lqr.s1.poles.map(z => z[0]))), 'с⁻¹') + k('|p|<sub>max</sub>', fnum(R.pmax), 'с⁻¹') + k('ψ<sub>0</sub>', fnum(P.Psi0), 'рад') + k('Уставки θ̇ / φ̇', fnum(P.vref) + ' / ' + fnum(P.wref), 'рад/с');
    }
    return '';
  }
  function renderItems(items, tab) {
    let h = '', fig = 0; const seen = {};
    for (const it of items) {
      if (it.repOnly) continue;
      switch (it.k) {
        case 'h': h += `<h2>${esc(it.t)}</h2>`; break;
        case 'p': h += `<p>${pw(it.t)}</p>`; break;
        case 'note': h += `<div class="note ${it.kind}">${pw(it.t)}</div>`; break;
        case 'tex': h += calcCard(it.t, window.EXPLAIN ? EXPLAIN.texDesc(it.desc) : ''); break;
        case 'eq': {
          let s = it.lhs;
          if (it.formula) s += '=' + it.formula;
          if (it.subst) s += '=' + it.subst;
          s += '=' + L.n(it.val, it.sig) + (it.unit ? '\\ \\text{' + it.unit + '}' : '');
          const d = window.EXPLAIN ? EXPLAIN.eqDesc(it.lhs) : '';
          const n = seen[it.lhs] = (seen[it.lhs] || 0) + 1, ck = tab + '|' + it.lhs + '|' + n;
          CHKIDX[ck] = { tab, lhs: it.lhs, n, val: it.val, unit: it.unit || '', order: Object.keys(CHKIDX).length };
          h += calcCard(s, d, ck); break;
        }
        case 'check': h += `<div class="check ${it.ok ? '' : 'bad'}"><span class="mark">${it.ok ? '✓' : '!'}</span><div class="body">${tex(it.tex, false)}<div class="ct">${it.t || ''}</div></div></div>`; break;
        case 'table': h += `<div class="tbl"><table>${it.caption ? `<caption>${esc(it.caption)}</caption>` : ''}<thead><tr>${it.head.map(c => `<th>${cell(c)}</th>`).join('')}</tr></thead><tbody>${it.rows.map(r => `<tr>${r.map(c => `<td>${cell(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; break;
        case 'code': h += codeBlock(it.t, it.title, it.lang); break;
        case 'plot': fig++; h += `<figure class="fig"><div class="plot" id="p-${it.id}"><div class="plot-wait"><span><span class="spinner"></span>Моделирование…</span></div></div><figcaption><span><b>Рис. ${tab.slice(2)}.${fig}.</b> ${esc(it.title)}</span></figcaption></figure>`; break;
        case 'diagram': h += `<div class="diagram" id="d-${it.id}"><p class="dcap">${esc(it.title)}<span class="dhint-r">наведите на блок — его имя в Simulink</span></p>${diagramSvg(it.id)}</div>`; break;
        case 'simres': h += `<div class="tbl" id="s-${it.id}"><table><caption>${esc(it.title)}</caption><tbody><tr><td><span class="spinner"></span>Идёт моделирование…</td></tr></tbody></table></div>`; break;
      }
    }
    return h;
  }
  const LINK_ICON = '<svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M6.6 9.4a2.6 2.6 0 0 0 3.7 0l2.4-2.4a2.6 2.6 0 0 0-3.7-3.7l-.9.9M9.4 6.6a2.6 2.6 0 0 0-3.7 0L3.3 9a2.6 2.6 0 0 0 3.7 3.7l.9-.9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  let calcSeq = 0;
  const CALC = {};
  const ICON_COPY = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="5" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
  function calcCard(src, desc, ck) {
    const id = 'f' + (++calcSeq); CALC[id] = src;
    const chk = ck && CHK.on ? chkRow(ck) : '';
    return `<div class="calc"><div class="calc-math">${tex(src, true)}</div><div class="calc-tools"><button class="calc-btn" data-mml="${id}" title="Копировать формулу для Word (MathML)" aria-label="Копировать формулу для Word">${ICON_COPY}</button><button class="calc-btn tx" data-tex="${id}" title="Копировать как LaTeX" aria-label="Копировать как LaTeX">TeX</button></div>${desc ? `<div class="calc-desc">${esc(desc)}</div>` : ''}${chk}</div>`;
  }
  /* ---------- сверка с ручным расчётом ---------- */
  const CHKIDX = {};
  const CHK = (() => { let c = null; try { c = JSON.parse(localStorage.getItem('rb-check') || 'null'); } catch (e) { c = null; } return Object.assign({ on: false, vals: {} }, c || {}); })();
  function saveChk() { try { localStorage.setItem('rb-check', JSON.stringify(CHK)); } catch (e) { /* ignore */ } }
  const chkKey = ck => S.P.variant + '|' + ck;
  function chkRow(ck) {
    const v = CHK.vals[chkKey(ck)];
    return `<div class="chk-row" data-ck="${esc(ck)}"><label><span>Ваше значение</span><input inputmode="decimal" autocomplete="off" value="${v === undefined ? '' : esc(String(v).replace('.', ','))}" placeholder="из тетради">${CHKIDX[ck] && CHKIDX[ck].unit ? `<em>${esc(CHKIDX[ck].unit)}</em>` : ''}</label><div class="chk-v"></div></div>`;
  }
  const relDev = (u, v) => Math.abs(u - v) / Math.max(Math.abs(v), 1e-12);
  const TOL = 0.006;
  function verdict(ck, row) {
    const out = $('.chk-v', row), c = CHKIDX[ck];
    const raw = CHK.vals[chkKey(ck)];
    row.classList.remove('ok', 'warn', 'bad');
    if (raw === undefined || raw === '') { out.innerHTML = ''; return; }
    const u = +raw, v = c.val;
    if (!isFinite(u)) { out.textContent = 'Введите число'; row.classList.add('warn'); return; }
    const dv = relDev(u, v), pc = x => String(+(x * 100).toFixed(x < 0.01 ? 2 : 1)).replace('.', ',') + ' %';
    if (dv <= TOL) { row.classList.add('ok'); out.innerHTML = '✓ Совпадает' + (dv > 0.0005 ? ` (разница ${pc(dv)} — округление)` : ''); return; }
    if (relDev(-u, v) <= TOL) { row.classList.add('warn'); out.innerHTML = '≈ Совпадает по модулю, но знак противоположный — проверьте знак в формуле.'; return; }
    for (const k of [1e3, 1e-3, 1e6, 1e-6]) if (relDev(u * k, v) <= TOL) { row.classList.add('warn'); out.innerHTML = `≈ Совпадает с точностью до единиц измерения: проверьте приставку (×${k >= 1 ? fnum(k) : '1/' + fnum(1 / k)}) — утилита считает в ${esc(c.unit || 'основных единицах')}.`; return; }
    for (let k = 1; k <= 4; k++) {
      const e = Math.pow(10, Math.floor(Math.log10(Math.abs(v))) - k + 1), tr = Math.trunc(v / e) * e, rn = Math.round(v / e) * e;
      if (Math.abs(u - tr) < e * 1e-6 && Math.abs(tr - rn) > e * 0.5) { row.classList.add('warn'); out.innerHTML = `≈ Похоже, значение обрезано, а не округлено: ${fnum(v)} ≈ ${String(+rn.toPrecision(k)).replace('.', ',')}, а не ${String(+tr.toPrecision(k)).replace('.', ',')}.`; return; }
    }
    if (dv <= 0.025) { row.classList.add('warn'); out.innerHTML = `≈ Близко: расхождение ${pc(dv)} (утилита: ${fnum(v)}). Обычно так бывает при сильном округлении промежуточных величин.`; return; }
    const entered = Object.entries(CHKIDX).filter(([k, x]) => k !== ck && x.tab === c.tab && CHK.vals[chkKey(k)] !== undefined && CHK.vals[chkKey(k)] !== '');
    const prev = entered.filter(([k, x]) => x.order < c.order && relDev(+CHK.vals[chkKey(k)], x.val) > 0.025);
    row.classList.add('bad');
    out.innerHTML = `✗ Расхождение ${pc(dv)} (утилита: ${fnum(v)}). ` + (prev.length
      ? `Возможно, это следствие расхождения выше: ${prev.map(([, x]) => tex(x.lhs, false)).join(', ')}. Начните сверку с первого несовпадающего значения.`
      : 'Предыдущие значения совпадают — вероятна арифметическая ошибка в этой формуле. Сверьте подстановку чисел с формулой выше.');
  }
  function chkSummary() {
    const box = $('#chk-sum'); if (!box) return;
    const rows = $$('.chk-row'), n = rows.filter(r => CHK.vals[chkKey(r.dataset.ck)] !== undefined && CHK.vals[chkKey(r.dataset.ck)] !== '').length;
    const ok = rows.filter(r => r.classList.contains('ok')).length, w = rows.filter(r => r.classList.contains('warn')).length, b = rows.filter(r => r.classList.contains('bad')).length;
    box.innerHTML = n ? `Сверено: ${n} из ${rows.length} · <b class="c-ok">✓ ${ok}</b> · <b class="c-warn">≈ ${w}</b> · <b class="c-bad">✗ ${b}</b>` : 'Впишите свои значения в поля под формулами — утилита сравнит их и подскажет возможную причину расхождения.';
  }
  function bindChk(root) {
    const swc = $('#chk-on', root);
    if (swc) swc.onchange = () => { CHK.on = swc.checked; saveChk(); const y = window.scrollY; renderTab(); window.scrollTo(0, y); };
    const clr = $('#chk-clr', root);
    if (clr) clr.onclick = () => { const pre = S.P.variant + '|' + S.tab + '|'; Object.keys(CHK.vals).forEach(k => { if (k.startsWith(pre)) delete CHK.vals[k]; }); saveChk(); const y = window.scrollY; renderTab(); window.scrollTo(0, y); };
    if (!CHK.on) return;
    const rows = $$('.chk-row', root);
    rows.forEach(row => {
      const inp = $('input', row);
      inp.addEventListener('change', () => {
        const t = inp.value.trim().replace(/\s/g, '').replace(',', '.');
        const k = chkKey(row.dataset.ck);
        if (t === '') delete CHK.vals[k]; else CHK.vals[k] = t;
        saveChk(); verdict(row.dataset.ck, row);
        rows.filter(r => CHKIDX[r.dataset.ck].order > CHKIDX[row.dataset.ck].order && CHK.vals[chkKey(r.dataset.ck)] !== undefined).forEach(r => verdict(r.dataset.ck, r));
        chkSummary();
      });
    });
    rows.forEach(r => { if (CHK.vals[chkKey(r.dataset.ck)] !== undefined) verdict(r.dataset.ck, r); });
    chkSummary();
  }
  function mathml(src) {
    let h = katex.renderToString(texify(src), { displayMode: true, output: 'mathml', throwOnError: false, strict: 'ignore' });
    const a = h.indexOf('<math'), b = h.lastIndexOf('</math>');
    h = h.slice(a, b + 7);
    h = h.replace(/<annotation[\s\S]*?<\/annotation>/g, '').replace(/<\/?semantics>/g, '');
    h = h.replace(/^<math[^>]*>/, '<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">');
    h = h.replace(/<mi>([\u0370-\u03ff])<\/mi>/g, '<mi mathvariant="normal">$1</mi>');
    return h;
  }
  function bindCalc(root) {
    $$('[data-mml]', root).forEach(b => b.onclick = () => copyText(mathml(CALC[b.dataset.mml]), 'Формула скопирована — вставьте в Word (Ctrl+V)'));
    $$('[data-tex]', root).forEach(b => b.onclick = () => copyText(texify(CALC[b.dataset.tex]), 'LaTeX скопирован'));
  }
  function diagramSvg(id) {
    const R = S.R;
    try {
      if (id === 'd_lr2') return DG.ss(R).svg('Модель в пространстве состояний');
      if (id === 'd_lr3_sys') return DG.sys(R, false).svg('Системная модель');
      if (id === 'd_lr3_plant') return DG.plant(R).svg('Подсистема Plant');
      if (id === 'd_lr4_gs') return DG.getStates(R).svg('Подсистема get_states');
      if (id === 'd_lr4_ctrl') return DG.control(R).svg('Подсистема Control');
    } catch (e) { console.error(e); }
    return '';
  }

  function renderLab(main, tab) {
    const R = S.R, no = tab.slice(2);
    const rep = R['L' + no];
    const isQ = tab === 'lr5';
    main.innerHTML = `<article class="sheet">
      <header class="sheet-head"><div><div class="eyebrow">${isQ ? 'Подготовка к защите' : 'Лабораторная работа · этап ' + no}</div><h1>${esc(TITLES[tab])}</h1><p class="lead">${leadText(tab)}</p></div>${stamp(no)}</header>
      <div class="sheet-body rep${isQ ? ' qa' : ''}">${isQ ? '' : `<div class="kpis">${kpis(tab)}</div><p class="calc-hint">${ICON_COPY} у каждой формулы копирует её в формате MathML — в Word вставляется как редактируемое уравнение (Ctrl+V). Кнопка «TeX» копирует LaTeX.</p>`}
        ${tab === 'lr1' ? `<div class="opts chk-bar"><div class="opt"><div class="opt-t"><b>Сверка с ручным расчётом</b><span id="chk-sum">${CHK.on ? '' : 'Под каждой формулой появится поле для вашего значения: утилита сравнит его и подскажет возможную причину расхождения — округление, единицы, знак или ошибка в подстановке.'}</span></div><div class="opt-c" style="display:flex;gap:10px;align-items:center">${CHK.on ? '<button class="btn" id="chk-clr">Очистить</button>' : ''}<label class="sw"><input type="checkbox" id="chk-on" ${CHK.on ? 'checked' : ''}><span class="track" aria-hidden="true"></span><span class="sr">Сверка</span></label></div></div></div>` : ''}
        ${renderItems(rep.items, tab)}${isQ ? '' : simHints(tab) + filesPanel(tab)}
        <div style="display:flex;justify-content:space-between;gap:8px;margin-top:22px;flex-wrap:wrap">${+no > 1 ? `<button class="btn" data-go="lr${+no - 1}">← Этап ${+no - 1}</button>` : '<span></span>'}${+no < 5 ? `<button class="btn" data-go="lr${+no + 1}">${+no + 1 === 5 ? 'Контрольные вопросы' : 'Этап ' + (+no + 1)} →</button>` : ''}</div>
      </div></article>`;
    $$('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
    bindFiles(main);
    bindCalc(main);
    bindChk(main);
    runSims(tab);
  }
  function leadText(tab) {
    return {
      lr1: 'Робот-балансир как двухколёсный перевёрнутый маятник: моменты инерции, уравнения Лагранжа, параметры двигателя, матрицы E, F, G, H линеаризованной модели и коэффициенты уравнения поворота.',
      lr2: 'Матрицы A, B, C, D моделей наклона s1 и поворота s2, собственные значения и проверка модели «подвешенным» роботом в Simulink.',
      lr3: 'Связь модели с системой управления: ШИМ → напряжение, энкодеры и гироскоп, идеальная и реальная модели, шины данных Ctl и Data.',
      lr4: 'Синтез LQR-регулятора, оценка состояния по датчикам, интегратор для устранения статической ошибки и управление движением робота.',
      lr5: 'Ответы на контрольные вопросы методички с привязкой к расчётам вашего варианта.'
    }[tab];
  }

  /* ---------- моделирование ---------- */
  async function getSim(key) {
    if (S.sims[key]) return S.sims[key];
    await sleep(0);
    const R = S.R; let r;
    switch (key) {
      case 'open+': r = { o: L.simOpen(R, 1) }; break;
      case 'open-': r = { o: L.simOpen(R, -1) }; break;
      case 'sys0': r = { o: L.simSys(R, 0, false) }; break;
      case 'sys0r': r = { o: L.simSys(R, 0, true) }; break;
      case 'lqr1': r = { o: L.simSys(R, 1, false) }; r.st = L.stats(R, r.o, 1); break;
      case 'lqr3': r = { o: L.simSys(R, 2, false) }; r.st = L.stats(R, r.o, 2); break;
      case 'lqr4': r = { o: L.simSys(R, 3, false) }; r.st = L.stats(R, r.o, 3); break;
      case 'lqr4r': r = { o: L.simSys(R, 3, true) }; r.st = L.stats(R, r.o, 3); break;
    }
    S.sims[key] = r; return r;
  }
  const SIMKEYS = { lr2: ['open+', 'open-'], lr3: ['sys0', 'sys0r'], lr4: ['lqr1', 'lqr3', 'lqr4', 'lqr4r'] };
  function simTableHtml(cap, rows, head) {
    head = head || ['Показатель', 'Моделирование', 'Расчёт / требование'];
    return `<table>${cap ? '<caption>' + esc(cap) + '</caption>' : ''}<thead><tr>${head.map((h, k) => `<th${k ? ' class="num"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr><td>${r[0]}</td>${r.slice(1).map(c => `<td class="num">${pw(c || '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }
  function simTable(id, rows, head) {
    const el = $('#s-' + id); if (!el) return;
    const cap = el.querySelector('caption') ? el.querySelector('caption').textContent : '';
    el.innerHTML = simTableHtml(cap, rows, head);
  }
  const tailv = (a, fr) => { const k0 = Math.floor(a.length * (1 - (fr || 0.1))); const s = a.slice(k0); return s.reduce((x, y) => x + y, 0) / s.length; };
  function period(t, y) {
    const yf = tailv(y, 0.2), cr = [];
    for (let i = 1; i < y.length; i++) if ((y[i - 1] - yf) * (y[i] - yf) < 0) cr.push(t[i - 1] + (t[i] - t[i - 1]) * (yf - y[i - 1]) / (y[i] - y[i - 1]));
    if (cr.length < 3) return NaN;
    const n = Math.min(cr.length - 1, 8);
    return 2 * (cr[n] - cr[0]) / n;
  }
  function rowsSim(id) {
    const R = S.R, P = S.P, s = S.sims, f = fnum;
    if (id === 'sr_lr2') {
      const up = s['open+'], dn = s['open-']; if (!up || !dn) return null;
      const o = dn.o, Tm = period(o.t, o.psi);
      return [['Установившаяся скорость θ̇ (g < 0), рад/с', f(tailv(o.thd)), f(R.thdSS) + ' (αv/(β+f<sub>w</sub>))'],
        ['Угол наклона ψ<sub>уст</sub> (g < 0), рад', f(tailv(o.psi)), f(R.psiSS)],
        ['Период колебаний ψ (g < 0), с', isFinite(Tm) ? f(Tm, 3) : '—', R.osc ? f(R.osc.T, 3) + ' (2π/ω)' : 'колебаний нет'],
        ['Наибольшее отклонение |ψ|<sub>max</sub> (g < 0), рад', f(Math.max(...o.psi.map(Math.abs)), 3), ''],
        ['ψ в конце моделирования при g > 0 (t = ' + f(up.o.t[up.o.t.length - 1], 3) + ' с), рад', f(up.o.psi[up.o.psi.length - 1], 3), 'неограниченно растёт']];
    }
    if (id === 'sr_lr3') {
      const a = s.sys0, b = s.sys0r; if (!a || !b) return null;
      const lv = arr => new Set(arr.map(v => Math.round(v * 1000) / 1000)).size;
      return [['enc<sub>l</sub> в конце, град', f(a.o.encl[a.o.encl.length - 1]), f(b.o.encl[b.o.encl.length - 1])],
        ['enc<sub>r</sub> в конце, град', f(a.o.encr[a.o.encr.length - 1]), f(b.o.encr[b.o.encr.length - 1])],
        ['Наибольшее |gyro|, град/с', f(Math.max(...a.o.gyro.map(Math.abs)), 3), f(Math.max(...b.o.gyro.map(Math.abs)), 3)],
        ['Число различных уровней gyro', '—', String(lv(b.o.gyro))],
        ['Напряжение на двигателях, В', f(a.o.vl[a.o.vl.length - 1]), f(b.o.vl[b.o.vl.length - 1])]];
    }
    const key = { sr_lr4_1: 'lqr1', sr_lr4_3: 'lqr3', sr_lr4_4: 'lqr4', sr_lr4_4r: 'lqr4r' }[id];
    const r = s[key]; if (!r) return null;
    const st = r.st, mode3 = key === 'lqr4' || key === 'lqr4r';
    const rows = [];
    if (st.fell) rows.push(['<span class="fell">Робот упал</span>', 't = ' + f(st.tFell, 3) + ' с', 'система потеряла устойчивость']);
    rows.push(['Наибольший наклон |ψ|<sub>max</sub>, рад', f(st.psiMax, 3) + ' (' + f(st.psiMax * R2D, 3) + '°)', 'ψ<sub>0</sub> = ' + f(P.Psi0)]);
    rows.push(['Время установления ψ (±5 % от ψ<sub>0</sub>), с', st.fell ? '—' : f(st.tsPsi, 3), '']);
    rows.push(['Угол ψ в конце, рад', f(st.psiF, 3), '0']);
    if (!mode3) rows.push(['Угол колёс θ в конце (статическая ошибка), рад', f(st.thF, 3), '0']);
    if (mode3) {
      rows.push(['Скорость θ̇<sub>уст</sub>, рад/с', f(st.thdF, 4), f(P.vref)]);
      rows.push(['Скорость поворота φ̇<sub>уст</sub>, рад/с', f(st.phidF, 4), f(P.wref)]);
      rows.push(['Ошибка слежения θ − θ<sub>зад</sub> в конце, рад', f(st.thEnd - P.vref * st.tEnd, 3), '']);
      if (key === 'lqr4r') rows.push(['СКО угла наклона ψ (вторая половина), °', f(st.psiRms * R2D, 3), '']);
    }
    rows.push(['Наибольшее напряжение |v|<sub>max</sub>, В', f(st.vMax, 3), 'U<sub>пит</sub> = ' + f(P.Upit)]);
    return rows;
  }
  const HEAD3 = ['Показатель', 'Идеальная модель', 'Реальная модель'];
  async function runSims(tab) {
    const token = S.R;
    const alive = () => S.R === token && S.tab === tab;
    try {
      for (const k of SIMKEYS[tab] || []) { await getSim(k); if (!alive()) return; }
      drawTab(tab);
      for (const id of Object.keys(SIMRES)) if (SIMRES[id] === tab) simTable(id, rowsSim(id), id === 'sr_lr3' ? HEAD3 : undefined);
    } catch (e) {
      console.error(e);
      $$('.plot-wait').forEach(p => p.innerHTML = '<span>Ошибка моделирования: ' + esc(e.message) + '</span>');
    }
  }
  const SIMRES = { sr_lr2: 'lr2', sr_lr3: 'lr3', sr_lr4_1: 'lr4', sr_lr4_3: 'lr4', sr_lr4_4: 'lr4', sr_lr4_4r: 'lr4' };
  const PLOTS = { lr2: ['lr2_up', 'lr2_dn'], lr3: ['lr3_enc', 'lr3_gyro'], lr4: ['lr4_s1', 'lr4_s3', 'lr4_s4', 'lr4_s4r'] };
  function drawTab(tab) { for (const id of PLOTS[tab] || []) { const el = $('#p-' + id); if (el) drawById(id, el); } }
  function sixPanels(o, extra) {
    const p = (y, yl) => ({ series: [{ x: o.t, y }], yl });
    return [p(o.th, 'θ, рад'), p(o.thd, 'θ̇, рад/с'), p(o.phi, 'φ, рад'), p(o.psi, 'ψ, рад'), p(o.psid, 'ψ̇, рад/с'), p(o.phid, 'φ̇, рад/с')].concat(extra || []);
  }
  /* единая отрисовка рисунков: на странице, в PNG для отчёта и архива */
  function drawById(id, el, ex) {
    const s = S.sims; ex = ex || {};
    switch (id) {
      case 'lr2_up': case 'lr2_dn': {
        const o = s[id === 'lr2_up' ? 'open+' : 'open-'].o;
        const p = (y, yl) => ({ series: [{ x: o.t, y }], yl });
        return CH.grid(el, [p(o.th, 'θ, рад'), p(o.psi, 'ψ, рад'), p(o.thd, 'θ̇, рад/с'), p(o.psid, 'ψ̇, рад/с')], Object.assign({ cols: 2 }, ex));
      }
      case 'lr3_enc': {
        const a = s.sys0.o, b = s.sys0r.o;
        return CH.grid(el, [{ series: [{ x: a.t, y: a.encl, name: 'идеальная' }, { x: b.t, y: b.encl, name: 'реальная', dash: 'dot', shape: 'hv' }], yl: 'enc_l, град' }, { series: [{ x: a.t, y: a.encr, name: 'идеальная' }, { x: b.t, y: b.encr, name: 'реальная', dash: 'dot', shape: 'hv' }], yl: 'enc_r, град' }], Object.assign({ cols: 2, h: 300 }, ex));
      }
      case 'lr3_gyro': {
        const a = s.sys0.o, b = s.sys0r.o;
        return CH.time(el, [{ x: a.t, y: a.gyro, name: 'идеальная модель' }, { x: b.t, y: b.gyro, name: 'реальная модель (Round)', shape: 'hv' }], 't, с', 'gyro, град/с', Object.assign({ h: 320 }, ex));
      }
      case 'lr4_s1': return CH.grid(el, sixPanels(s.lqr1.o), Object.assign({ cols: 3 }, ex));
      case 'lr4_s3': return CH.grid(el, sixPanels(s.lqr3.o), Object.assign({ cols: 3 }, ex));
      case 'lr4_s4': return CH.grid(el, sixPanels(s.lqr4.o), Object.assign({ cols: 3 }, ex));
      case 'lr4_s4r': return CH.grid(el, sixPanels(s.lqr4r.o), Object.assign({ cols: 3 }, ex));
    }
  }

  /* ---------------- код и файлы ---------------- */
  function hl(src) {
    const e = esc(src);
    return e.split('\n').map(line => {
      let out = '', i = 0, inS = false, prev = '';
      while (i < line.length) {
        const ch = line[i];
        if (!inS && ch === '%') { out += '<span class="c">' + line.slice(i) + '</span>'; break; }
        if (ch === "'" && !inS && !/[\w)\]}.']/.test(prev)) { inS = true; out += '<span class="s">' + ch; }
        else if (ch === "'" && inS) { if (line[i + 1] === "'") { out += "''"; i += 2; continue; } inS = false; out += ch + '</span>'; }
        else out += ch;
        if (ch !== ' ') prev = ch; i++;
      }
      if (inS) out += '</span>';
      return out.replace(/\b(function|end|if|else|elseif|for|while|return|switch|case|otherwise|try|catch)\b(?![^<]*<\/span>)/g, '<span class="k">$1</span>');
    }).join('\n');
  }
  let codeSeq = 0;
  const CODE = {};
  function codeBlock(src, name) {
    const id = 'code' + (++codeSeq); CODE[id] = { src, name };
    return `<div class="code"><div class="code-head"><span class="fn">${esc(name)}</span><span class="acts"><button class="btn sm" data-copy="${id}">Копировать</button><button class="btn sm" data-dl="${id}">Скачать</button></span></div><pre class="src">${hl(src)}</pre></div>`;
  }
  const FOLDER = { lr1: 'Etap1_Model', lr2: 'Etap2_StateSpace', lr3: 'Etap3_SystemModel', lr4: 'Etap4_LQR' };
  function labFiles(tab) {
    const R = S.R, d = FOLDER[tab];
    const f = (name, desc, gen) => ({ path: d + '/' + name, desc, gen, lang: name.endsWith('.txt') ? 'txt' : 'matlab' });
    switch (tab) {
      case 'lr1': return [f('rob_raschet.m', 'Моменты инерции, α, β, матрицы E, F, G, H и коэффициенты I, J, K (вывод в Command Window)', () => G.raschet(R))];
      case 'lr2': return [f('parametrs_Rob.m', 'Исходные данные робота — как в методичке (g_sign = −1 — «подвешенный» робот)', () => G.params(R, 2)),
        f('Rob_SM.m', 'Переменные модели и матрицы пространства состояний, системы s1 и s2', () => G.robSM(R, 2)),
        f('Rob_model_ss.m', 'Строит модель рис. 19 (Rob_ss.slx), моделирует при g > 0 и g < 0, строит графики', () => G.modelSS(R))];
      case 'lr3': return [f('parametrs_Rob.m', 'Исходные данные + K_PWM', () => G.params(R, 3)), f('Rob_SM.m', 'Модель в пространстве состояний (s1, s2)', () => G.robSM(R, 3)),
        f('config.m', 'real_model = 0 — идеальная модель; 1 — с неидеальностями', () => G.config(R)), f('preload.m', 'Шины Ctl и Data (bus_data.mat)', () => G.preload(R)),
        f('Rob_model_sys.m', 'Строит системную модель Rob_sys.slx (Controller + Plant), моделирует идеальную и реальную', () => G.modelSys(R))];
      case 'lr4': return [f('parametrs_Rob.m', 'Исходные данные + K_PWM, Psi0', () => G.params(R, 4)), f('Rob_SM.m', 'Модель + интегратор s3 и объединённая модель s4', () => G.robSM(R, 4)),
        f('config.m', 'real_model = 0 / 1', () => G.config(R)), f('preload.m', 'Шины Ctl и Data', () => G.preload(R)),
        f('control.m', 'Синтез LQR: lqr_mode = 1 (s1), 2 (s3), 3 (s4)', () => G.control(R)),
        f('Rob_model_lqr.m', 'Строит модель с регулятором Rob_lqr.slx (get_states, Control, Plant) и моделирует', () => G.modelLQR(R)),
        f('Rob_lqr_check.m', 'Проверка регуляторов без Simulink: полюса, initial, lsim', () => G.lqrCheck(R))];
    }
    return [];
  }
  const ALLTABS = ['lr1', 'lr2', 'lr3', 'lr4'];
  /* ---------- шаги этапа: полный набор файлов на каждый момент работы ----------
   * run — что запустить; figs — рисунки сайта, которые увидит студент; files — состояние папки на этом шаге */
  function labSteps(tab) {
    const R = S.R, P = S.P, f = fnum;
    const F = (name, desc, gen) => ({ name, desc, gen });
    switch (tab) {
      case 'lr1': return [
        { key: 'raschet', title: 'Расчёт параметров модели', sec: '1.2–1.6', run: 'rob_raschet',
          result: 'В Command Window — Jw, α, β, матрицы E, F, G, H и коэффициенты I, J, K. Сверьте с формулами выше.',
          files: [F('rob_raschet.m', 'Моменты инерции, α, β, матрицы E, F, G, H и коэффициенты I, J, K', () => G.raschet(R))] }];
      case 'lr2': {
        const par = F('parametrs_Rob.m', 'Исходные данные робота (g_sign = −1 — «подвешенный» робот)', () => G.params(R, 2));
        const sm = F('Rob_SM.m', 'Матрицы пространства состояний, системы s1 и s2', () => G.robSM(R, 2));
        return [
          { key: 'model', title: 'Модель в пространстве состояний', sec: '2.2–2.4', run: 'Rob_SM; s1, s2, eig(A1)',
            result: 'Матрицы A1, B1, A2, B2 и собственные значения A1, как в разд. 2.3–2.4. Для «подвешенного» робота: g_sign = -1; Rob_SM; eig(A1).',
            files: [par, sm] },
          { key: 'g_plus', title: 'Модель Simulink: робот без регулятора, g > 0', sec: '2.5', run: 'Rob_model_ss', figs: ['lr2_up'],
            result: 'Модель Rob_ss.slx и окно с графиками θ, ψ, θ̇, ψ̇: координаты неограниченно растут — робот падает.',
            files: [par, sm, F('Rob_model_ss.m', 'Строит модель рис. 19 (Rob_ss.slx) и моделирует при g > 0', () => G.modelSS(R, [1]))] },
          { key: 'g_minus', title: 'Проверка модели: «подвешенный» робот, g < 0', sec: '2.5', run: 'Rob_model_ss', figs: ['lr2_dn'],
            result: `Затухающие колебания ψ; скорость θ̇ выходит на ${f(R.thdSS)} рад/с. Значения сравните с таблицей «Сравнение моделирования с расчётом».`,
            files: [par, sm, F('Rob_model_ss.m', 'Моделирует «подвешенного» робота (g < 0)', () => G.modelSS(R, [-1]))] }];
      }
      case 'lr3': {
        const base = [F('parametrs_Rob.m', 'Исходные данные + K_PWM', () => G.params(R, 3)), F('Rob_SM.m', 'Модель в пространстве состояний (s1, s2)', () => G.robSM(R, 3)),
          F('config.m', 'real_model = 0 — идеальная модель', () => G.config(R, 0)), F('preload.m', 'Шины Ctl и Data (bus_data.mat)', () => G.preload(R))];
        return [
          { key: 'ideal', title: 'Системная модель: идеальная', sec: '3.1–3.6', run: 'Rob_model_sys', figs: ['lr3_enc', 'lr3_gyro'], partial: true,
            result: 'Модель Rob_sys.slx (Controller + Plant) и графики энкодеров и гироскопа — кривые «идеальная».',
            files: base.concat(F('Rob_model_sys.m', 'Строит Rob_sys.slx и моделирует идеальную модель', () => G.modelSys(R, [0]))) },
          { key: 'real', title: 'Неидеальности: квантование ШИМ и датчиков', sec: '3.4, 3.7', run: 'Rob_model_sys', figs: ['lr3_enc', 'lr3_gyro'],
            result: 'Идеальная и реальная модели на одних графиках: у реальной показания ступенчатые (шаг 1° и 1°/с).',
            files: base.concat(F('Rob_model_sys.m', 'Моделирует идеальную и реальную модели, графики наложены', () => G.modelSys(R, [0, 1]))) }];
      }
      case 'lr4': {
        const par = F('parametrs_Rob.m', 'Исходные данные + K_PWM, Psi0', () => G.params(R, 4)), pre = F('preload.m', 'Шины Ctl и Data', () => G.preload(R));
        const cfg0 = F('config.m', 'real_model = 0 — идеальные датчики', () => G.config(R, 0));
        const sm = lv => F('Rob_SM.m', ['Модель s1, s2', 'Модель s1, s2 + интегратор s3', 'Модель + интегратор s3 и объединённая модель s4'][lv - 1], () => G.robSM(R, 4, lv));
        const ctl = md => F('control.m', 'Синтез LQR по модели ' + ['s1', 's3', 's4'][md - 1], () => G.control(R, md));
        const mdl = md => F('Rob_model_lqr.m', 'Строит Rob_lqr.slx (get_states, Control, Plant), lqr_mode = ' + md, () => G.modelLQR(R, md));
        return [
          { key: 's1', title: 'Регулятор по модели наклона s1', sec: '4.1–4.3', run: 'Rob_model_lqr', figs: ['lr4_s1'],
            result: `Начальный наклон ψ0 = ${f(P.Psi0)} рад гасится регулятором; в Command Window — Klqr и значения в конце моделирования.`,
            files: [par, sm(1), cfg0, pre, ctl(1), mdl(1)] },
          { key: 's3', title: 'Регулятор с интегратором', sec: '4.4', run: 'Rob_model_lqr', figs: ['lr4_s3'],
            result: 'Статическая ошибка по углу θ устранена.',
            files: [par, sm(2), cfg0, pre, ctl(2), mdl(2)] },
          { key: 's4', title: 'Управление движением', sec: '4.5', run: 'Rob_model_lqr', figs: ['lr4_s4'],
            result: `Робот едет со скоростью θ̇ = ${f(P.vref)} рад/с и поворачивает со скоростью φ̇ = ${f(P.wref)} рад/с, сохраняя равновесие.`,
            files: [par, sm(3), cfg0, pre, ctl(3), mdl(3)] },
          { key: 's4_real', title: 'Неидеальные датчики (real_model = 1)', sec: '4.5', run: 'Rob_model_lqr', figs: ['lr4_s4r'],
            result: 'То же движение с квантованием ШИМ и датчиков: появляются мелкие колебания ψ.',
            files: [par, sm(3), F('config.m', 'real_model = 1 — квантование ШИМ и датчиков', () => G.config(R, 1)), pre, ctl(3), mdl(3)] }];
      }
    }
    return [];
  }
  /* метки «новый» / «изменён» относительно предыдущего шага */
  function stepsMarked(tab) {
    const steps = labSteps(tab);
    let prev = null;
    for (const st of steps) {
      st.files.forEach(x => { x.src = x.gen(); });
      st.files = st.files.map(x => {
        const p = prev && prev.find(y => y.name === x.name);
        return Object.assign({}, x, { mark: !prev ? '' : !p ? 'new' : p.src !== x.src ? 'chg' : '' });
      });
      prev = st.files;
    }
    return steps;
  }
  function figNo(tab, id) {
    const rep = S.R['L' + tab.slice(2)];
    const k = rep.items.filter(it => it.k === 'plot' && !it.repOnly).findIndex(it => it.id === id);
    return k < 0 ? '' : tab.slice(2) + '.' + (k + 1);
  }
  const stepSlug = (tab, k, st) => 'Etap' + tab.slice(2) + '_shag' + (k + 1) + '_' + st.key;
  function stepReadme(tab, k, st) {
    const no = tab.slice(2), figs = (st.figs || []).map(id => 'Рис. ' + figNo(tab, id)).join(', ');
    const tag = { new: '  [новый]', chg: '  [изменён по сравнению с шагом ' + k + ']', '': '' };
    return `Этап ${no}, шаг ${k + 1}. ${st.title}
${S.P.variant ? 'Вариант ' + S.P.variant : 'Пример из методички'}. Разделы на сайте: ${st.sec}.

Что делать:
 1. Распакуйте папку и в MATLAB сделайте её текущей (Current Folder).
 2. Запустите в Command Window:  ${st.run}

Что получится${figs ? ' (на сайте — ' + figs + ')' : ''}:
 ${st.result}${figs ? `
 Рисунки автоматически сохраняются в PNG в папку figures рядом со скриптами
 (отключить: save_figs = false в начале ${st.run}.m).` : ''}

Файлы на этом шаге:
${st.files.map(x => '  ' + x.name.padEnd(18) + x.desc + tag[x.mark || '']).join('\n')}
`;
  }
  function addStepFiles(zip, tab, k, st, root) {
    const dir = root + stepSlug(tab, k, st) + '/';
    for (const x of st.files) zip.file(dir + x.name, x.src || x.gen());
    zip.file(dir + 'README.txt', stepReadme(tab, k, st));
  }
  /* ---------- подсказка: что вписать в блоки Simulink ---------- */
  let SIMHINT = {};
  function simHints(tab) {
    let hs = []; try { hs = G.hints(S.R, tab); } catch (e) { console.error(e); return ''; }
    if (!hs.length) return '';
    SIMHINT = {};
    const blocks = hs.map((x, mi) => {
      const rows = x.rows.map((r, ri) => { const id = 'sh' + mi + '_' + ri; const val = String(r[2]).replace(/^[^=]* = (?=\[|-?\d)/, ''); SIMHINT[id] = val; return `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td><div class="sv"><code>${esc(r[2]).replace(/\n/g, '<br>')}</code><button class="calc-btn" data-sh="${id}" title="Копировать" aria-label="Копировать значение">${ICON_COPY}</button></div></td></tr>`; }).join('');
      return `<details class="adv sh"><summary>${esc(x.t)}</summary><div class="in">${x.note ? `<p class="dhint">${esc(x.note)}</p>` : ''}<div class="tbl sh-tbl"><table><thead><tr><th>Блок</th><th>Параметр</th><th>Значение</th></tr></thead><tbody>${rows}</tbody></table></div></div></details>`;
    }).join('');
    return `<h2>Блоки модели Simulink</h2><p>Если собираете модель вручную по методичке, впишите в блоки эти значения (копируются кнопкой; копируется числовое значение). Скрипт <code>Rob_model_*.m</code> строит ту же модель автоматически.</p>${blocks}`;
  }
  /* файлы шагов и итоговые файлы этапа: FSET[ключ] = [{ name, desc, gen }] */
  let FSET = {}, STEPS = [];
  const MARK = { new: 'новый', chg: 'изменён' };
  function fileRows(set, files) {
    return files.map((f, k) => `<div class="file-row"><div><div class="fn">${esc(f.name)}${f.mark ? `<span class="fmark ${f.mark}">${MARK[f.mark]}</span>` : ''}</div><div class="fd">${esc(f.desc)}</div></div><div class="acts"><button class="btn sm" data-fview="${set}:${k}">Показать</button><button class="btn sm" data-fcopy="${set}:${k}">Копировать</button><button class="btn sm" data-fdl="${set}:${k}">Скачать</button></div><div class="file-view" hidden></div></div>`).join('');
  }
  function chips(files) {
    return `<div class="fchips">${files.map(f => `<span class="fchip${f.mark ? ' ' + f.mark : ''}" title="${esc(f.desc)}">${esc(f.name)}${f.mark ? `<em>${MARK[f.mark]}</em>` : ''}</span>`).join('')}</div>`;
  }
  function filesPanel(tab) {
    const steps = STEPS = stepsMarked(tab);
    const full = labFiles(tab).map(f => ({ name: f.path.split('/')[1], desc: f.desc, gen: f.gen }));
    FSET = { full };
    const last = steps[steps.length - 1];
    const sameAsLast = last && last.files.length === full.length && full.every(x => { const y = last.files.find(z => z.name === x.name); return y && y.src === x.gen(); });
    const items = steps.map((st, k) => {
      FSET['s' + k] = st.files;
      const figs = (st.figs || []).map(id => `<button class="fig-link" data-fig="${id}">Рис. ${figNo(tab, id)}</button>`).join(' ');
      return `<li class="step">
        <div class="step-top"><span class="step-no">${k + 1}</span><div class="step-t"><div class="step-sec">Разд. ${esc(st.sec)}</div><h4>${esc(st.title)}</h4></div><button class="btn primary sm" data-szip="${k}">${dlIcon()} Файлы шага (.zip)</button></div>
        <dl class="step-kv">
          <dt>Запустить</dt><dd><code class="run">${esc(st.run)}</code><button class="calc-btn" data-run="${k}" title="Копировать команду" aria-label="Копировать команду">${ICON_COPY}</button></dd>
          <dt>Результат</dt><dd>${figs ? figs + (st.partial ? ' (частично)' : '') + ' — ' : ''}${esc(st.result)}</dd>
          <dt>Файлы</dt><dd>${chips(st.files)}</dd>
        </dl>
        <details class="step-files"><summary>Файлы шага по отдельности</summary>${fileRows('s' + k, st.files)}</details>
      </li>`;
    }).join('');
    const fin = sameAsLast ? '' : `<div class="step-fin"><div class="step-top"><span class="step-no all" aria-hidden="true">✓</span><div class="step-t"><div class="step-sec">Итог</div><h4>Этап целиком</h4></div><button class="btn sm" data-zip="${tab}">${dlIcon()} ZIP этапа</button></div>
        <p class="fd">${tab === 'lr4' ? 'Универсальные версии файлов: режим регулятора задаётся переменной lqr_mode (1, 2, 3; по умолчанию 3), датчики — real_model в config.m; добавлена проверка без Simulink.' : 'Итоговые версии файлов: скрипт строит все рисунки этапа подряд.'} В архиве также README и отчёт Word.</p>
        ${chips(full)}
        <details class="step-files"><summary>Файлы этапа по отдельности</summary>${fileRows('full', full)}</details></div>`;
    return `<section class="files" aria-label="Файлы для MATLAB"><div class="files-head"><div><h3>Файлы для MATLAB по шагам</h3><p>Каждый шаг — полный набор файлов на этот момент работы. Распакуйте архив шага в отдельную папку, сделайте её текущей в MATLAB и запустите указанную команду: появятся те же графики, что на рисунке этой страницы, а их PNG сохранятся в папку <code>figures</code> (для отчёта).</p></div><span style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-docx="all">${dlIcon()} Отчёт Word</button>${sameAsLast ? `<button class="btn" data-zip="${tab}">${dlIcon()} ZIP этапа + отчёт</button>` : ''}</span></div>
      <ol class="steps">${items}</ol>${fin}</section>`;
  }
  async function zipStep(tab, k, btn) {
    const st = STEPS[k], zip = new JSZip(), root = varTag() + '/';
    addStepFiles(zip, tab, k, st, root);
    btn.disabled = true;
    const blob = await zip.generateAsync({ type: 'blob' });
    btn.disabled = false;
    downloadBlob(varTag() + '_' + stepSlug(tab, k, st) + '.zip', blob);
    toast('Архив шага ' + (k + 1) + ' сформирован');
  }
  function bindFiles(root) {
    const file = id => { const [s, k] = id.split(':'); return FSET[s][+k]; };
    $$('[data-copy]', root).forEach(b => b.onclick = () => copyText(CODE[b.dataset.copy].src));
    $$('[data-sh]', root).forEach(b => b.onclick = () => copyText(SIMHINT[b.dataset.sh], 'Значение скопировано'));
    $$('[data-dl]', root).forEach(b => b.onclick = () => downloadText(CODE[b.dataset.dl].name.replace(/\s*\(.*\)$/, '').replace(/\s+/g, '_') + '.m', CODE[b.dataset.dl].src));
    $$('[data-fcopy]', root).forEach(b => b.onclick = () => copyText(file(b.dataset.fcopy).gen()));
    $$('[data-fdl]', root).forEach(b => b.onclick = () => { const f = file(b.dataset.fdl); downloadText(f.name, f.gen()); });
    $$('[data-fview]', root).forEach(b => b.onclick = () => {
      const row = b.closest('.file-row'), v = row.querySelector('.file-view'), f = file(b.dataset.fview);
      if (v.hidden) { v.innerHTML = `<pre class="src">${hl(f.gen())}</pre>`; v.hidden = false; b.textContent = 'Скрыть'; }
      else { v.hidden = true; v.innerHTML = ''; b.textContent = 'Показать'; }
    });
    $$('[data-szip]', root).forEach(b => b.onclick = () => zipStep(S.tab, +b.dataset.szip, b));
    $$('[data-run]', root).forEach(b => b.onclick = () => copyText(STEPS[+b.dataset.run].run, 'Команда скопирована'));
    $$('[data-fig]', root).forEach(b => b.onclick = () => { const el = $('#p-' + b.dataset.fig); if (el) { const fg = el.closest('figure') || el; fg.scrollIntoView({ behavior: 'smooth', block: 'center' }); fg.classList.remove('flash'); void fg.offsetWidth; fg.classList.add('flash'); } });
    $$('[data-zip]', root).forEach(b => b.onclick = () => zipLab(b.dataset.zip, b));
    $$('[data-docx]', root).forEach(b => b.onclick = () => makeDocx(b));
  }
  function dlIcon() { return '<svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1v9m0 0L4.5 6.5M8 10l3.5-3.5M2 12v2.5h12V12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }

  function copyText(t, msg) {
    const done = () => toast(msg || 'Скопировано в буфер обмена');
    try { navigator.clipboard.writeText(t).then(done, () => fallbackCopy(t, done)); } catch (e) { fallbackCopy(t, done); }
  }
  function fallbackCopy(t, done) {
    const ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.top = '-1000px';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast('Не удалось скопировать — выделите текст вручную'); }
    ta.remove();
  }
  function downloadBlob(name, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }
  function downloadText(name, text) { downloadBlob(name, new Blob([text], { type: 'text/plain;charset=utf-8' })); toast('Файл ' + name + ' сохранён'); }

  /* ---------- ZIP ---------- */
  const varTag = () => S.P.variant ? 'Variant_' + S.P.variant : 'Primer';
  function addLabFiles(zip, tab, root) { for (const f of labFiles(tab)) zip.file(root + f.path, f.gen()); }
  async function zipLab(tab, btn) {
    const zip = new JSZip(), root = varTag() + '/';
    addLabFiles(zip, tab, root);
    zip.file(root + 'README.txt', G.readme(S.R));
    btn.disabled = true; const old = btn.innerHTML;
    try { zip.file(root + docxName(), await buildDocxBlob(t => { btn.innerHTML = '<span class="spinner"></span>' + t; })); } catch (e) { console.error(e); }
    btn.innerHTML = old;
    const blob = await zip.generateAsync({ type: 'blob' });
    btn.disabled = false;
    downloadBlob(varTag() + '_' + FOLDER[tab] + '.zip', blob);
    toast('Архив этапа сформирован');
  }
  async function zipAll(btn) {
    const R = S.R;
    btn.disabled = true; const old = btn.innerHTML;
    const prog = t => { btn.innerHTML = '<span class="spinner"></span>' + t; };
    try {
      const zip = new JSZip(), root = varTag() + '/';
      for (const t of ALLTABS) addLabFiles(zip, t, root);
      for (const t of ALLTABS) stepsMarked(t).forEach((st, k) => addStepFiles(zip, t, k, st, root + 'Po_shagam/'));
      zip.file(root + 'README.txt', G.readme(R));
      const keys = [].concat(SIMKEYS.lr2, SIMKEYS.lr3, SIMKEYS.lr4);
      for (let k = 0; k < keys.length; k++) { prog(' Моделирование ' + (k + 1) + '/' + keys.length); await getSim(keys[k]); await sleep(10); if (S.R !== R) throw new Error('Данные изменились во время экспорта'); }
      const ids = [].concat(PLOTS.lr2, PLOTS.lr3, PLOTS.lr4);
      for (let k = 0; k < ids.length; k++) { prog(' Графики ' + (k + 1) + '/' + ids.length); const im = await plotPng(ids[k]); zip.file(root + 'Report/img/' + ids[k] + '.png', im.data, { base64: true }); }
      prog(' Данные…');
      for (const [name, csv] of Object.entries(allCsv())) zip.file(root + 'Report/data/' + name + '.csv', csv);
      zip.file(root + 'Report/report.html', reportHtml(ids));
      prog(' Отчёт…');
      zip.file(root + docxName(), await buildDocxBlob());
      prog(' Упаковка…');
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      downloadBlob(varTag() + '_Robot.zip', blob);
      toast('Полный архив сформирован');
    } catch (e) { console.error(e); toast('Ошибка экспорта: ' + e.message); }
    btn.disabled = false; btn.innerHTML = old;
  }
  /* ---------- отчёт Word ---------- */
  const PNG_H = { lr2_up: 520, lr2_dn: 520, lr3_enc: 340, lr3_gyro: 380, lr4_s1: 560, lr4_s3: 560, lr4_s4: 560, lr4_s4r: 560 };
  async function plotPng(id) {
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-12000px;top:0;width:900px;';
    document.body.appendChild(host);
    const h = PNG_H[id] || 380;
    try {
      await drawById(id, host, { export: true, h });
      const url = await Plotly.toImage(host, { format: 'png', width: 900, height: h, scale: 2 });
      return { data: url.split(',')[1], w: 900, h };
    } finally { try { Plotly.purge(host); } catch (e) { /* ignore */ } host.remove(); }
  }
  const SVG_STYLE = '<style>.wire{fill:none;stroke:#000;stroke-width:1.2}.arrowhead{fill:#000}.blk{fill:#fff;stroke:#000;stroke-width:1.2}.blk.acc{fill:#fff;stroke:#000;stroke-width:1.6}.blk.dsh{stroke-dasharray:5 3;fill:#fff}.bar{fill:#000}.bt{font:12px "Times New Roman",serif;fill:#000}.frac{stroke:#000;stroke-width:1}.cap{font:10.5px "Times New Roman",serif;fill:#333}.sum{fill:#fff;stroke:#000;stroke-width:1.2}.sumx{stroke:#000;stroke-width:.8}.sg{font:600 12px "Times New Roman",serif;fill:#000}.lbl{font:italic 13px "Times New Roman",serif;fill:#000}.dot{fill:#000}</style>';
  function svgPng(id) {
    return new Promise((res, rej) => {
      let svg = diagramSvg(id);
      if (!svg) return res(null);
      const m = svg.match(/viewBox="0 0 (\d+) (\d+)"/); const w = +m[1], h = +m[2];
      svg = svg.replace(/(<svg[^>]*>)/, '$1' + SVG_STYLE);
      const img = new Image(), k = 3;
      img.onload = () => { const c = document.createElement('canvas'); c.width = w * k; c.height = h * k; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height); res({ data: c.toDataURL('image/png').split(',')[1], w, h }); };
      img.onerror = () => rej(new Error('Не удалось отрисовать схему ' + id));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }
  /* метка-заглушка на рисунках отчёта: что заменить снимком из MATLAB */
  function watermark(im, lines) {
    return new Promise((res) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
        const g = c.getContext('2d'); g.drawImage(img, 0, 0);
        const W = c.width, H = c.height, u = W / 900;
        g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(0, 0, W, H);
        const Lc = 34 * u, m = 10 * u;
        g.strokeStyle = '#5A3EA8'; g.lineWidth = 3 * u; g.lineCap = 'round';
        [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, sx, sy]) => { g.beginPath(); g.moveTo(x, y + sy * Lc); g.lineTo(x, y); g.lineTo(x + sx * Lc, y); g.stroke(); });
        const f1 = 22 * u, f2 = 15 * u, lh2 = f2 * 1.35, pad = 18 * u, gap = 8 * u, ic = 30 * u;
        const sans = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';
        const maxCard = W - 60 * u, maxText = maxCard - ic - pad * 2.8;
        g.font = `400 ${f2}px ${sans}`;
        const wrap = [];
        for (const para of lines.slice(1)) {
          let cur = '';
          for (const word of String(para).split(' ')) { const t = cur ? cur + ' ' + word : word; if (g.measureText(t).width > maxText && cur) { wrap.push(cur); cur = word; } else cur = t; }
          if (cur) wrap.push(cur);
        }
        const w2 = Math.max(0, ...wrap.map(l => g.measureText(l).width));
        g.font = `600 ${f1}px ${sans}`; const w1 = g.measureText(lines[0]).width;
        const cw = Math.min(maxCard, Math.max(w1, w2) + ic + pad * 2.8), ch = pad * 2 + f1 + gap + wrap.length * lh2;
        const x0 = (W - cw) / 2, y0 = Math.max(8 * u, (H - ch) / 2), r = 12 * u;
        g.save(); g.shadowColor = 'rgba(15,30,50,0.25)'; g.shadowBlur = 24 * u; g.shadowOffsetY = 6 * u;
        g.fillStyle = 'rgba(255,255,255,0.97)';
        g.beginPath(); g.moveTo(x0 + r, y0); g.arcTo(x0 + cw, y0, x0 + cw, y0 + ch, r); g.arcTo(x0 + cw, y0 + ch, x0, y0 + ch, r); g.arcTo(x0, y0 + ch, x0, y0, r); g.arcTo(x0, y0, x0 + cw, y0, r); g.closePath(); g.fill();
        g.restore();
        g.strokeStyle = 'rgba(90,62,168,0.25)'; g.lineWidth = 1.5 * u; g.stroke();
        const ix = x0 + pad, iy = y0 + pad;
        g.fillStyle = '#5A3EA8'; g.beginPath(); g.arc(ix + ic / 2, iy + ic / 2, ic / 2, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = 2.2 * u; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(ix + ic * 0.25, iy + ic * 0.68); g.lineTo(ix + ic * 0.45, iy + ic * 0.45); g.lineTo(ix + ic * 0.6, iy + ic * 0.6); g.lineTo(ix + ic * 0.76, iy + ic * 0.36); g.stroke();
        const tx = ix + ic + pad * 0.8;
        g.textBaseline = 'alphabetic'; g.textAlign = 'left';
        g.fillStyle = '#14202c'; g.font = `600 ${f1}px ${sans}`; g.fillText(lines[0], tx, y0 + pad + f1 * 0.85);
        g.fillStyle = '#4a5765'; g.font = `400 ${f2}px ${sans}`;
        wrap.forEach((l, k) => g.fillText(l, tx, y0 + pad + f1 + gap + k * lh2 + f2 * 0.9));
        res({ data: c.toDataURL('image/png').split(',')[1], w: im.w, h: im.h });
      };
      img.onerror = () => res(im);
      img.src = 'data:image/png;base64,' + im.data;
    });
  }
  function figSource(id) {
    return {
      d_lr2: 'модель Rob_ss.slx — её строит скрипт Rob_model_ss.m (папка Etap2_StateSpace); снимок окна модели Simulink',
      d_lr3_sys: 'модель Rob_sys.slx — скрипт Rob_model_sys.m (папка Etap3_SystemModel); снимок верхнего уровня модели',
      d_lr3_plant: 'модель Rob_sys.slx → подсистема Plant (двойной щелчок по блоку Plant)',
      d_lr4_gs: 'модель Rob_lqr.slx — скрипт Rob_model_lqr.m (папка Etap4_LQR) → Controller → get_states',
      d_lr4_ctrl: 'модель Rob_lqr.slx → подсистема Controller',
      lr2_up: 'скрипт Rob_model_ss.m → окно figure «Этап 2: g = 9.81» (или Scope модели Rob_ss.slx)',
      lr2_dn: 'скрипт Rob_model_ss.m → окно figure «Этап 2: g = -9.81» (или Scope модели)',
      lr3_enc: 'скрипт Rob_model_sys.m → окна figure «Этап 3: real_model = 0/1», верхний график',
      lr3_gyro: 'скрипт Rob_model_sys.m → окна figure «Этап 3: real_model = 0/1», нижний график',
      lr4_s1: 'скрипт Rob_model_lqr.m при lqr_mode = 1 → figure «Этап 4» (или Scope подсистемы Plant)',
      lr4_s3: 'скрипт Rob_model_lqr.m при lqr_mode = 2 → figure «Этап 4»',
      lr4_s4: 'скрипт Rob_model_lqr.m при lqr_mode = 3 → figure «Этап 4»',
      lr4_s4r: 'config.m: real_model = 1, затем Rob_model_lqr.m при lqr_mode = 3'
    }[id] || 'соответствующий скрипт MATLAB';
  }
  function omml(src, inline, size) {
    const h = katex.renderToString(texify(src), { displayMode: !inline, output: 'mathml', throwOnError: false, strict: 'ignore' });
    const a = h.indexOf('<math'), b = h.lastIndexOf('</math>');
    const mm = h.slice(a, b + 7).replace(/^<math[^>]*>/, '<math xmlns="http://www.w3.org/1998/Math/MathML">');
    return OMML.convert(mm, { size: size || 28 });
  }
  async function buildDocxBlob(prog) {
    for (const t of ALLTABS) for (const k of SIMKEYS[t] || []) { prog && prog('Моделирование…'); await getSim(k); await sleep(5); }
    const png = {};
    const ids = [];
    for (const t of ALLTABS) for (const it of S.R['L' + t.slice(2)].items) if (it.k === 'plot' || it.k === 'diagram') ids.push(it);
    for (let k = 0; k < ids.length; k++) {
      prog && prog('Рисунки ' + (k + 1) + '/' + ids.length);
      const it = ids[k];
      const im = it.k === 'diagram' ? await svgPng(it.id) : await plotPng(it.id);
      png[it.id] = im && S.T.watermark ? await watermark(im, [it.k === 'diagram' ? 'Замените схемой из MATLAB Simulink' : 'Замените рисунком из MATLAB', 'Что вставить: ' + it.title + '.', 'Откуда: ' + figSource(it.id)]) : im;
    }
    prog && prog('Сборка документа…');
    const meas = document.createElement('div'); meas.style.cssText = 'position:absolute;left:-20000px;top:0;visibility:hidden;white-space:nowrap;font-size:18.67px';
    document.body.appendChild(meas);
    const measure = t => { meas.innerHTML = katex.renderToString(texify(t), { displayMode: true, throwOnError: false, strict: 'ignore' }); const k = meas.querySelector('.katex'); return k ? k.getBoundingClientRect().width : 0; };
    const ctx = { S, L, omml, png, simRows: rowsSim, labFiles, measure };
    try { return await REPORT.build(ctx, S.T, { explain: S.T.explain, listings: S.T.listings, readable: S.T.readable, codePlain: S.T.codePlain, questions: S.T.questions }); } finally { meas.remove(); }
  }
  function docxName() { return 'Otchet_Robot_' + (S.P.variant ? 'var' + S.P.variant : 'primer') + '.docx'; }
  async function makeDocx(btn) {
    const old = btn.innerHTML; btn.disabled = true;
    try {
      const blob = await buildDocxBlob(t => { btn.innerHTML = '<span class="spinner"></span>' + t; });
      downloadBlob(docxName(), blob);
      toast('Отчёт ' + docxName() + ' сформирован');
    } catch (e) { console.error(e); toast('Ошибка формирования отчёта: ' + e.message); }
    btn.disabled = false; btn.innerHTML = old;
  }
  window.__docxTest = () => buildDocxBlob().then(b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result.split(',')[1]); f.readAsDataURL(b); }));
  function csvOf(cols) {
    const keys = Object.keys(cols); const n = cols[keys[0]].length;
    let s = keys.join(';') + '\n';
    for (let i = 0; i < n; i++) s += keys.map(k => (+cols[k][i]).toPrecision(8)).join(';') + '\n';
    return s;
  }
  function allCsv() {
    const s = S.sims, o = {};
    const st = r => ({ t: r.t, theta: r.th, psi: r.psi, theta_dot: r.thd, psi_dot: r.psid, phi: r.phi, phi_dot: r.phid });
    if (s['open+']) o.etap2_g_pos = csvOf(st(s['open+'].o));
    if (s['open-']) o.etap2_g_neg = csvOf(st(s['open-'].o));
    for (const [k, nm] of [['sys0', 'etap3_ideal'], ['sys0r', 'etap3_real']]) if (s[k]) o[nm] = csvOf({ t: s[k].o.t, enc_l: s[k].o.encl, enc_r: s[k].o.encr, gyro: s[k].o.gyro });
    for (const [k, nm] of [['lqr1', 'etap4_s1'], ['lqr3', 'etap4_s3'], ['lqr4', 'etap4_s4'], ['lqr4r', 'etap4_s4_real']]) if (s[k]) o[nm] = csvOf(Object.assign(st(s[k].o), { v_l: s[k].o.vl, v_r: s[k].o.vr }));
    return o;
  }
  function reportHtml(imgs) {
    const parts = [], R = S.R, P = S.P;
    for (const tab of TABS) {
      const no = tab.slice(2); let fig = 0;
      let h = `<section><h1>${no === '5' ? '' : 'Этап ' + no + '. '}${esc(TITLES[tab])}</h1>`;
      for (const it of R['L' + no].items) {
        if (it.k === 'plot') { fig++; h += imgs.includes(it.id) ? `<figure><img src="img/${it.id}.png" alt=""><figcaption>Рис. ${no}.${fig}. ${esc(it.title)}</figcaption></figure>` : ''; }
        else if (it.k === 'diagram') h += `<figure class="dg">${diagramSvg(it.id)}<figcaption>${esc(it.title)}</figcaption></figure>`;
        else if (it.k === 'simres') { const rows = rowsSim(it.id); if (rows) h += simTableHtml(it.title, rows, it.id === 'sr_lr3' ? HEAD3 : undefined); }
        else h += renderItems([it], tab);
      }
      parts.push(h + '</section>');
    }
    return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${P.variant ? 'Вариант ' + P.variant : 'Пример'} — робот-балансир</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<style>body{font:15px/1.5 "IBM Plex Sans","Segoe UI",Arial,sans-serif;color:#1a222b;max-width:1000px;margin:0 auto;padding:24px}
h1{font-size:22px;border-bottom:2px solid #1a222b;padding-bottom:6px;margin-top:48px}h2{font-size:17px;margin-top:26px}
table{border-collapse:collapse;margin:10px 0;font-size:13px}td,th{border:1px solid #aab4bf;padding:4px 8px;text-align:left}caption{text-align:left;font-weight:600;padding:4px 0}
.katex-display{text-align:left;margin:4px 0}.katex-display>.katex{text-align:left}
.check{padding:6px 10px;border:1px solid #9cc7ab;background:#eef8f1;margin:6px 0}.check.bad{border-color:#e0a49d;background:#fbeceb}.mark{font-weight:700;margin-right:8px}
.note{padding:6px 10px;border-left:3px solid #5a3ea8;background:#f1edfa;margin:8px 0}.note.warn{border-color:#9a6512;background:#fbf4e6}.note.bad{border-color:#b8352a;background:#fbeceb}
figure{margin:14px 0}figure img{max-width:100%;border:1px solid #ccd4dd}figcaption{font-size:13px;color:#5a6776}
pre{background:#f4f6f8;padding:10px;overflow:auto;font-size:12px}.code-head{font-family:monospace;font-size:12px;background:#e9edf1;padding:4px 8px}.acts,button{display:none!important}
svg.ssdm .wire{fill:none;stroke:#1a222b;stroke-width:1.2}svg.ssdm .arrowhead{fill:#1a222b}svg.ssdm .blk{fill:#fff;stroke:#1a222b;stroke-width:1.2}svg.ssdm .blk.acc{fill:#e7e1f6;stroke:#5a3ea8}svg.ssdm .blk.dsh{stroke-dasharray:5 3;fill:#f2f5f8}svg.ssdm .bar{fill:#1a222b}
svg.ssdm .bt{font:12px monospace;fill:#1a222b}svg.ssdm .frac{stroke:#1a222b}svg.ssdm .cap{font:10.5px sans-serif;fill:#5a6776}svg.ssdm .sum{fill:#fff;stroke:#1a222b}svg.ssdm .sumx{stroke:#1a222b;stroke-width:.8}svg.ssdm .sg{font:600 12px monospace;fill:#1a222b}svg.ssdm .lbl{font:italic 12.5px sans-serif;fill:#b4580c}svg.ssdm .dot{fill:#1a222b}
.calc{border:1.5px dashed #a9b4c0;background:#f3f5f8;padding:6px 12px;margin:8px 0;border-radius:6px}.calc-math{overflow-x:auto}.calc-tools{display:none}.calc-desc{font-size:13px;color:#5a6776;border-top:1px dashed #ccd4dd;padding-top:4px}.dg{overflow-x:auto}.fell{color:#b8352a;font-weight:600}
@media print{h1{page-break-before:always}section:first-child h1{page-break-before:avoid}pre{max-height:none}}</style></head><body>
<p><b>${P.variant ? 'Вариант ' + P.variant : 'Пример из методички'}</b> · ${L.VKEYS.map(k => k + ' = ' + fnum(P[k])).join(', ')}</p>
${parts.join('\n')}</body></html>`;
  }
  /* ---------------- прочее ---------------- */
  let toastT = null;
  function toast(t) {
    let el = $('#toast'); if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 2800);
  }
  function go(tab) { S.tab = tab; S.skipAuto = true; save(); setHash(); renderTab(); window.scrollTo({ top: 0 }); }
  function themeToggle() {
    const r = document.documentElement;
    const cur = r.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const nx = cur === 'dark' ? 'light' : 'dark';
    r.setAttribute('data-theme', nx);
    try { localStorage.setItem('suite-theme', nx); } catch (e) { /* ignore */ }
    if (S.tab !== 'data') renderTab();
  }

  function init() {
    try { const th = localStorage.getItem('suite-theme'); if (th) document.documentElement.setAttribute('data-theme', th); } catch (e) { /* ignore */ }
    $('#rail').innerHTML = LABS_META.map(m => `<a href="#" data-tab="${m.id}"><span class="no" data-short="${m.short}">${m.no === '0' ? '◦' : m.no === '5' ? '?' : m.no}</span><span class="t">${m.t}</span><span class="s">${m.s}</span></a>`).join('') + '<div class="rail-foot" id="rail-foot"></div>';
    $$('nav.rail a').forEach(a => a.onclick = e => { e.preventDefault(); go(a.dataset.tab); });
    $('#var-sel').onchange = e => setVariant(+e.target.value);
    $('#var-prev').onclick = () => setVariant(S.P.variant - 1);
    $('#var-next').onclick = () => setVariant(S.P.variant + 1);
    $('#share').onclick = share;
    $('#theme').onclick = themeToggle;
    const setTopH = () => document.documentElement.style.setProperty('--top-h', $('.top').offsetHeight + 'px');
    window.addEventListener('resize', setTopH); setTopH();
    load(); loadT();
    const au = getAuto();
    if (S.shared) { S.skipAuto = true; recompute(); toast('Открыт расчёт по ссылке'); }
    else if (au && au.P) {
      S.P = L.fromVariant(1); S.T = Object.assign({}, T_DEF); S.tab = 'data';
      S.skipAuto = true; recompute();
      askResume(au);
    } else { S.skipAuto = true; recompute(); }
  }
  function askResume(au) {
    const d = document.createElement('div');
    d.className = 'modal-back';
    d.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="rs-t"><h2 id="rs-t">Продолжить с того места?</h2>
      <p>Найдено автосохранение:</p><div class="modal-card"><b>${au.T && au.T.student ? esc(au.T.student) : 'Последняя работа'}</b><span>${slotMeta(au)}</span></div>
      <p class="dhint">«Начать заново» сбросит параметры и настройки к значениям по умолчанию. Автосохранение при этом не удаляется — к нему можно вернуться в разделе «Сохранения», пока вы не начнёте вносить изменения.</p>
      <div class="modal-act"><button class="btn" id="rs-new">Начать заново</button><button class="btn primary" id="rs-go">Продолжить</button></div></div>`;
    document.body.appendChild(d);
    const close = () => d.remove();
    $('#rs-go', d).onclick = () => {
      S.P = Object.assign(L.defaults(), au.P); S.T = Object.assign({}, T_DEF, au.T || {});
      if (au.tab) S.tab = au.tab;
      S.skipAuto = true; saveT(); S.skipAuto = true; close(); recompute();
    };
    $('#rs-new', d).onclick = () => { S.skipAuto = true; saveT(); close(); toast('Начато заново'); };
    setTimeout(() => $('#rs-go', d).focus(), 30);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
