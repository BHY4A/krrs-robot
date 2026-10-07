/* report.js — генерация отчёта по лабораторной работе «Робот-балансир» в формате Word (.docx) */
(function (root) {
  'use strict';
  const LOGO = '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';

  const META = {
    title: 'Моделирование и синтез системы управления двухколёсного робота-балансира',
    goal: 'Построение математической модели двухколёсного робота-балансира, её представление в пространстве состояний, разработка системной модели с датчиками и широтно-импульсной модуляцией в среде MatLab Simulink и синтез линейно-квадратичного регулятора, обеспечивающего устойчивость робота и управление его движением.',
    tasks: ['Вывести уравнения движения робота-балансира методом Лагранжа и линеаризовать их в точке равновесия.',
      'Представить модель робота в пространстве состояний, проанализировать её устойчивость и проверить модель моделированием в MatLab Simulink.',
      'Разработать системную модель робота: преобразование ШИМ в напряжение, модели энкодеров и гироскопа, идеальную и реальную модели, шины данных.',
      'Синтезировать LQR-регулятор, обеспечивающий баланс робота; устранить статическую ошибку введением интегратора.',
      'Добавить управление скоростью движения и поворотом робота и исследовать систему с идеальными и неидеальными датчиками.'],
    stages: { lr1: 'Математическая модель робота-балансира', lr2: 'Модель в пространстве состояний', lr3: 'Системная модель робота', lr4: 'Система управления на основе LQR-регулятора' }
  };

  function titlePage(doc, T) {
    const c = { align: 'center', indent: 0, spacing: { line: 240 } };
    if (T.logo) doc.image(LOGO, 'jpeg', 1.0, 0.93, { spacing: { before: 0, after: 60, line: 240 }, keepNext: false });
    String(T.org || '').split('\n').forEach(l => doc.p(l, c));
    if (T.dept) String(T.dept).split('\n').forEach((l, k) => doc.p(l, Object.assign({}, c, k === 0 ? { spacing: { before: 240, line: 240 } } : {})));
    doc.p([{ t: 'ОТЧЁТ', b: true, size: 40 }], { align: 'center', indent: 0, spacing: { before: 1900, after: 120, line: 240 } });
    doc.p('по ' + (T.kind || 'лабораторной работе'), c);
    doc.p('«' + (T.title || META.title) + '»', Object.assign({}, c, { spacing: { before: 60, line: 240 } }), { b: true });
    doc.p('по дисциплине', Object.assign({}, c, { spacing: { before: 120, line: 240 } }));
    doc.p('«' + (T.discipline || '') + '»', c);
    const r = { align: 'right', indent: 0, spacing: { line: 240 } };
    doc.p('Выполнил:', Object.assign({}, r, { spacing: { before: 1600, line: 240 } }));
    if (T.group) doc.p('ст. гр. ' + T.group, r);
    doc.p(T.student || '______________', r);
    doc.p('Проверил:', Object.assign({}, r, { spacing: { before: 360, line: 240 } }));
    doc.p(T.teacher || '______________', r);
    doc.p((T.city || 'Казань') + ' ' + (T.year || new Date().getFullYear()), { align: 'center', indent: 0, spacing: { before: 1700, line: 240 } });
  }

  function inputList(doc, P, ctx) {
    const items = [
      ['m', P.m, 'кг', 'масса колеса'], ['R', P.R, 'м', 'радиус колеса'], ['M', P.M, 'кг', 'масса робота'],
      ['W', P.W, 'м', 'ширина робота'], ['D', P.D, 'м', 'толщина робота'], ['h', P.h, 'м', 'высота робота'],
      ['f_w', P.fw, '', 'коэффициент вязкого трения между колесом и полом'], ['f_m', P.fm, '', 'коэффициент вязкого трения в двигателе'],
      ['J_m', P.Jm, 'кг·м²', 'момент инерции ротора двигателя'], ['R_m', P.Rm, 'Ом', 'сопротивление обмотки двигателя'],
      ['K_b', P.Kb, 'В·с/рад', 'коэффициент противо-ЭДС'], ['K_t', P.Kt, 'Н·м/А', 'коэффициент передачи по току'],
      ['n', P.n, '', 'передаточное число редуктора']
    ];
    items.forEach(([sym, v, u, d], k) => {
      const om = ctx.omml(sym + '=' + ctx.L.n(+v) + (u ? '\\ \\text{' + u + '}' : ''), true);
      doc.raw(`<w:p>${doc.pPr({ indent: 709 })}${om}${doc.runs(' — ' + d + (k === items.length - 1 ? '.' : ';'))}</w:p>`);
    });
  }

  function addItems(doc, items, no, ctx, opt, cnt) {
    for (const it0 of items) {
      if (it0.web) continue;
      let it = it0;
      if (it0.rep !== undefined) it = Object.assign({}, it0, it0.k === 'note' ? { k: 'p', t: it0.rep } : { t: it0.rep });
      switch (it.k) {
        case 'h': doc.p(it.t.replace(/^(\d+(?:\.\d+)*)\.\s+/, '$1 ').replace(/\.$/, ''), { style: 'Heading3' }); break;
        case 'p': it.t.split(/<br\s*\/?>/).forEach(part => { const x = part.replace(/^\s*•\s*/, ''); if (x.trim()) doc.html(x, /:\s*$/.test(x) ? { keepNext: true } : undefined); }); break;
        case 'note': break;
        case 'tex': {
          const d = opt.explain && root.EXPLAIN ? EXPLAIN.texDesc(it.desc) : '';
          if (d) doc.html(symHtml(d.replace(/\.$/, ':')), { keepNext: true });
          emitMath(doc, it.t, ctx); break;
        }
        case 'eq': {
          let s = it.lhs;
          if (it.formula) s += '=' + it.formula;
          if (it.subst) s += '=' + it.subst;
          s += '=' + ctx.L.n(it.val, it.sig) + (it.unit ? '\\ \\text{' + it.unit + '}' : '');
          const d = opt.explain && root.EXPLAIN ? EXPLAIN.eqDesc(it.lhs) : '';
          if (d) doc.html(symHtml(d.replace(/\.$/, ':')), { keepNext: true });
          emitMath(doc, s, ctx); break;
        }
        case 'check':
          doc.raw(`<w:p>${doc.pPr({ indent: 709 })}${doc.runs('Проверка: ')}${ctx.omml(it.tex, true)}${doc.runs(' — ' + lc(it.t || (it.ok ? 'выполняется' : 'не выполняется')).replace(/\.?$/, '.'))}</w:p>`); break;
        case 'table': {
          const plain = c => String(c === undefined || c === null ? '' : c);
          if (it.head[0] === 'Параметр' && it.head[1] === 'Обозначение') break;
          const lead = it.caption ? it.caption.replace(/\.$/, '') + ':' : 'Получены следующие значения:';
          const lines = [];
          if (it.rows.length === 1) it.head.forEach((h, k) => lines.push(`${lc(plain(h))} — ${plain(it.rows[0][k])}`));
          else it.rows.forEach(r => lines.push(`${plain(r[0])}${r[1] ? ' (' + plain(r[1]) + ')' : ''}: ` + r.slice(2).map((v, k) => `${lc(plain(it.head[k + 2]))} — ${plain(v)}`).join(', ')));
          doc.p(lead, { keepNext: true });
          listOut(doc, lines);
          break;
        }
        case 'code':
          codeOut(doc, 'Листинг ' + no + '.' + (++cnt.lst) + ' — ' + (it.title || ''), it.t);
          doc.p('', {});
          break;
        case 'plot': case 'diagram': {
          const img = ctx.png[it.id];
          if (!img) break;
          const nn = no + '.' + (cnt.fig + 1);
          const ld = LEAD[it.id] || (it.k === 'diagram' ? 'Структурная схема модели представлена на рисунке {n}.' : 'Результат представлен на рисунке {n}.');
          doc.html(symHtml(ld.replace('{n}', nn)), { keepNext: true });
          const w = 16, h = Math.min(w * img.h / img.w, 12);
          doc.image(img.data, 'png', h === 12 ? 12 * img.w / img.h : w, h);
          doc.p('Рисунок ' + nn + ' — ' + it.title.replace(/\s*\(рис\. [\d., ]+\)/g, '').replace(/\.$/, ''), { style: 'Caption' });
          doc.p('', { indent: 0 });
          cnt.fig++;
          break;
        }
        case 'simres': {
          const rows = ctx.simRows(it.id);
          if (!rows || !rows.length) break;
          doc.p('По результатам моделирования получено:', { keepNext: true });
          listOut(doc, rows.map(r => `${lc(r[0])} — ${r[1]}${r[2] ? ' (' + r[2] + ')' : ''}`));
          break;
        }
      }
    }
  }

  function lc(t) { t = String(t); return /^[А-ЯЁ][а-яё]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t; }
  let READ = false;
  function keepIdx(k, n, max, head, tail) {
    if (k >= n - 1) return false;
    if (!READ) return false;
    if (n <= max) return true;
    return k < head - 1 || k >= n - tail - 1;
  }
  function listOut(doc, lines) {
    lines.forEach((l, k) => { l = String(l).replace(/[;.]\s*$/, ''); if (!/</.test(l)) l = symHtml(l); doc.html('– ' + l + (k === lines.length - 1 ? '.' : ';'), keepIdx(k, lines.length, 10, 3, 3) ? { keepNext: true } : undefined); });
  }
  function codeOut(doc, caption, src) {
    const ls = src.split('\n'); while (ls.length && !ls[ls.length - 1].trim()) ls.pop();
    doc.p(caption, { style: 'TableCaption' });
    ls.forEach((l, k) => doc.p(l.replace(/\t/g, '    ') || ' ', Object.assign({ style: 'Code' }, keepIdx(k, ls.length, 50, 6, 6) ? { keepNext: true } : {})));
  }
  const LEAD = {
    d_lr2: 'Модель робота-балансира в пространстве состояний, собранная в среде MatLab Simulink, представлена на рисунке {n}.',
    lr2_up: 'Результат моделирования при положительном ускорении свободного падения представлен на рисунке {n}: координаты робота неограниченно возрастают.',
    lr2_dn: 'При отрицательном ускорении свободного падения («подвешенный» робот) на графиках наблюдаются затухающие колебания (рисунок {n}).',
    d_lr3_sys: 'Системная модель, объединяющая контроллер и объект управления, представлена на рисунке {n}.',
    d_lr3_plant: 'Подсистема Plant с преобразованием ШИМ, моделью робота и датчиками представлена на рисунке {n}.',
    lr3_enc: 'Показания энкодеров, полученные моделированием системной модели, представлены на рисунке {n}.',
    lr3_gyro: 'Показания гироскопа для идеальной и реальной моделей приведены на рисунке {n}.',
    d_lr4_gs: 'Подсистема оценки вектора состояния get_states представлена на рисунке {n}.',
    d_lr4_ctrl: 'Подсистема регулятора Control представлена на рисунке {n}.',
    lr4_s1: 'Результаты моделирования системы с регулятором по модели s1 при начальном наклоне робота представлены на рисунке {n}.',
    lr4_s3: 'Результаты моделирования с интегратором в регуляторе представлены на рисунке {n}.',
    lr4_s4: 'Результаты моделирования управления движением робота представлены на рисунке {n}.',
    lr4_s4r: 'Результаты моделирования с неидеальными датчиками представлены на рисунке {n}.'
  };
  /* ---------- перенос длинных формул (ГОСТ 2.105) ---------- */
  const LIMIT = 560;
  function splitTop(t, ch) {
    const out = []; let depth = 0, cur = '', env = 0;
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (t.startsWith('\\begin{', i)) env++; if (t.startsWith('\\end{', i)) env--;
      if (c === '{') depth++; else if (c === '}') depth--;
      if (c === ch && depth === 0 && env === 0 && t[i - 1] !== '\\') { out.push(cur); cur = ''; } else cur += c;
    }
    out.push(cur); return out;
  }
  function fitMath(tex, ctx) {
    const W = x => ctx.measure(x);
    if (W(tex) <= LIMIT) return [{ t: tex }];
    // сначала — по запятым верхнего уровня (несколько матриц в строке), затем — по знаку «=»
    const byComma = tex.split(/,\\quad\s*/);
    if (byComma.length > 1) {
      const out = [];
      for (const part of byComma) out.push(...fitMath(part, ctx));
      return out;
    }
    const parts = splitTop(tex, '=');
    const lines = [];
    let cur = parts[0];
    for (let k = 1; k < parts.length; k++) {
      const cand = cur + '=' + parts[k];
      if (W(cand) <= LIMIT) cur = cand; else { lines.push(cur); cur = '=' + parts[k]; }
    }
    lines.push(cur);
    return lines.map(t => ({ t, size: W(t) > LIMIT ? Math.max(16, Math.floor(28 * LIMIT / W(t))) : 28 }));
  }
  function emitMath(doc, tex, ctx) {
    const lines = fitMath(tex, ctx);
    for (const l of lines) doc.math(ctx.omml(l.t, false, l.size || 28), l !== lines[lines.length - 1] ? { keepNext: true } : {});
  }
  function symHtml(t) {
    let s = t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    s = s.replace(/(^|[^A-Za-zА-Яа-яЁё0-9])([A-Za-z])_([A-Za-z\w]+)/g, (m0, a, l, ix) => a + '<i>' + l + '</i><sub>' + ix + '</sub>');
    return s;
  }
  /* ---------- выводы ---------- */
  function conclusions(R, S, f) {
    const P = R.P, md = R.md, out = [];
    out.push(`Методом Лагранжа получены и линеаризованы уравнения движения робота-балансира. Для варианта ${P.variant || '(пример методички)'}: J<sub>w</sub> = ${f(md.Jw)} кг·м², J<sub>ψ</sub> = ${f(md.Jpsi)} кг·м², J<sub>φ</sub> = ${f(md.Jphi)} кг·м², α = ${f(md.alpha)} Н·м/В, β = ${f(md.beta)} Н·м·с/рад; коэффициенты уравнения поворота I = ${f(md.I)} кг·м², J = ${f(md.J)} Н·м·с/рад, K = ${f(md.K)} Н·м/В.`);
    out.push(`Модель робота представлена в пространстве состояний двумя системами: s1 (θ, ψ, θ̇, ψ̇) и s2 (φ, φ̇). Матрица A<sub>1</sub> имеет положительное собственное значение λ = ${f(R.lamU)} с⁻¹ — без регулятора робот неустойчив и падает.${R.osc ? ` При смене знака g модель описывает маятник с затухающими колебаниями (период ${f(R.osc.T)} с, коэффициент демпфирования ${f(R.osc.zeta)}), что подтверждает адекватность модели.` : ''}`);
    out.push(`Разработана системная модель с преобразованием ШИМ в напряжение (K<sub>PWM</sub> = ${f(R.KPWM, 6)}), моделями энкодеров и гироскопа, вариантными подсистемами идеальной и реальной моделей и шинами данных Ctl и Data. Квантование показаний датчиков с шагом 1° и 1°/с приводит к ступенчатому характеру сигналов.`);
    const s1 = S.lqr1, s3 = S.lqr3, s4 = S.lqr4, s4r = S.lqr4r;
    const p1 = Math.max(...R.lqr.s1.poles.map(z => z[0]));
    out.push(`Синтезирован LQR-регулятор по модели s1: K<sub>lqr</sub> = [${R.lqr.s1.K[0].map(v => f(v)).join('; ')}] (обе строки${Math.abs(R.lqr.s1.K[0][0] - R.lqr.s1.K[1][0]) < 1e-9 ? ' одинаковы' : ''}); все полюса замкнутой системы в левой полуплоскости (наибольший ${f(p1)} с⁻¹).` + (s1 ? ` Робот возвращается в вертикальное положение из начального наклона ${f(P.Psi0)} рад за ${f(s1.st.tsPsi, 3)} с, однако остаётся статическая ошибка по углу поворота колёс θ = ${f(s1.st.thF, 3)} рад.` : ''));
    if (s3) out.push(`Введение интегратора угла θ (модель s3) устраняет статическую ошибку: к концу моделирования θ = ${f(s3.st.thF, 3)} рад; время установления угла наклона ${f(s3.st.tsPsi, 3)} с.`);
    if (s4) out.push(`Регулятор по модели s4 обеспечивает управление движением: установившиеся скорости θ̇ = ${f(s4.st.thdF, 4)} рад/с и φ̇ = ${f(s4.st.phidF, 4)} рад/с при заданных ${f(P.vref)} и ${f(P.wref)} рад/с, угол наклона корпуса остаётся близким к нулю.`);
    if (s4r) out.push(s4r.st.fell ? `С неидеальными датчиками и квантованием ШИМ робот теряет устойчивость (t = ${f(s4r.st.tFell, 3)} с) — требуется фильтрация производных или уменьшение коэффициентов регулятора.` : `С неидеальными датчиками и квантованием ШИМ система остаётся устойчивой: угол наклона колеблется около нуля (СКО ${f(s4r.st.psiRms * 180 / Math.PI, 3)}°), скорости θ̇ = ${f(s4r.st.thdF, 3)} рад/с и φ̇ = ${f(s4r.st.phidF, 3)} рад/с; на сигналах скоростей виден шум дифференцирования квантованных показаний.`);
    return out;
  }

  async function build(ctx, T, opt) {
    READ = opt.readable !== false;
    const doc = new DOCX.Doc({ readable: READ, codePlain: !!opt.codePlain });
    const P = ctx.S.P, R = ctx.S.R;
    titlePage(doc, T);
    doc.p('Цель работы', { style: 'Heading2', pageBreakBefore: true });
    doc.p(META.goal);
    doc.p('Задачи работы', { style: 'Heading2' });
    META.tasks.forEach((t, i) => doc.p((i + 1) + ') ' + t.charAt(0).toLowerCase() + t.slice(1).replace(/\.$/, i === META.tasks.length - 1 ? '.' : ';')));
    doc.p('Ход работы', { style: 'Heading2' });
    doc.p((P.variant ? 'Согласно варианту № ' + P.variant + ' системы исходных данных' : 'Для примера из методических указаний') + ' приняты следующие значения:', { keepNext: true });
    inputList(doc, P, ctx);
    ['lr1', 'lr2', 'lr3', 'lr4'].forEach(tab => {
      const no = tab.slice(2);
      doc.p(no + ' ' + META.stages[tab], { style: 'Heading2' });
      const cnt = { fig: 0, lst: 0 };
      addItems(doc, R['L' + no].items, no, ctx, opt, cnt);
      if (opt.listings) {
        const files = ctx.labFiles(tab).filter(x => x.lang === 'matlab');
        if (files.length) {
          doc.p('Программы MATLAB', { style: 'Heading3' });
          for (const fl of files) { codeOut(doc, 'Листинг ' + no + '.' + (++cnt.lst) + ' — ' + fl.path.split('/')[1], fl.gen()); doc.p('', {}); }
        }
      }
    });
    doc.p('Вывод', { style: 'Heading2' });
    conclusions(R, ctx.S.sims, ctx.L.fnum).forEach(t => doc.html(t));
    if (opt.questions) {
      doc.p('Ответы на контрольные вопросы', { style: 'Heading2', pageBreakBefore: true });
      ctx.L.QUESTIONS.forEach((q, k) => {
        doc.p((k + 1) + '. ' + q.q, { style: 'Heading3' });
        q.a(R).forEach(a => typeof a === 'string' ? doc.html(a) : emitMath(doc, a.tex, ctx));
      });
    }
    return doc.build({ title: 'Отчёт: робот-балансир' + (P.variant ? ', вариант ' + P.variant : ''), author: T.student || '' });
  }
  root.REPORT = { build, META, conclusions };
})(typeof window !== 'undefined' ? window : globalThis);
