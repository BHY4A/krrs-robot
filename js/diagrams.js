/* diagrams.js — схемы моделей Simulink робота-балансира (рис. 19, 22–24, 27, 29, 38, 40, 45, 51, 52).
 * Схемы рисуются общим модулем slsvg.js в виде моделей Simulink: каждый блок — отдельный блок модели
 * с тем же именем и параметрами, что строят скрипты *.m (matlab.js). */
(function (root) {
  'use strict';
  const SL = root.SLSVG || (typeof require !== 'undefined' ? require('./slsvg.js') : null);

  function num(x) {
    if (!isFinite(x)) return '?';
    const a = Math.abs(x);
    if (a !== 0 && (a < 1e-3 || a >= 1e5)) return x.toExponential(3).replace('+', '');
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
  const fx = (x, d) => (+x.toPrecision(d || 4)).toString().replace('.', ',');
  const SS = 'ẋ = Ax+Bu\ny = Cx+Du';
  const D = () => new SL.Diagram();

  /* ---------- подсказки: что ввести в окне параметров блока и откуда это значение ---------- */
  const T = (d, p) => ({ d, p: p || [] });
  const IN = (k, d) => T(d, [['Port number', String(k), '']]);
  const OUT = (k, d) => T(d, [['Port number', String(k), '']]);
  const MUX = (n, d) => T(d, [['Number of inputs', String(n), '']]);
  const DEMUX = (n, d) => T(d, [['Number of outputs', String(n), '']]);
  const TOWS = (v, d) => T(d, [['Variable name', v, ''], ['Save format', 'Structure With Time', 'нужно скриптам для графиков']]);
  const SSB = (k, d, x0) => T(d, [['A', 'A' + k, k === 1 ? 'матрица 4×4 продольного движения и наклона (Rob_SM.m)' : 'матрица 2×2 поворота (Rob_SM.m)'], ['B', 'B' + k, k === 1 ? '4×2: E\\H под нулями' : '2×2: ±K/I'], ['C', 'C' + k, k === 1 ? 'eye(4) — выход = вектор состояния' : 'eye(2)'], ['D', 'D' + k, k === 1 ? 'zeros(4, 2)' : 'zeros(2)']].concat(x0 ? [['Initial conditions', x0, x0 === '[0 0 0 0]' ? '' : 'Psi0 — начальный наклон, рад']] : []));
  const SWT = d => T(d, [['Criteria for passing first input', 'u2 > Threshold', ''], ['Threshold', '0.5', 'real_model = 1 → верхний вход, 0 → нижний']]);
  const INTG = d => T(d, [['Initial condition', '0', '']]);
  const DERIV = d => T(d, [['Coefficient c in s/(c·s+1)', 'inf', 'по умолчанию — чистая производная']]);
  const SUBS = d => T(d, []);

  /* блок по левому краю xl; возвращает правый край */
  function at(d, id, t, xl, y, o) { const b = d.add(id, t, 0, y, o); b.x = xl + b.w / 2; return xl + b.w; }

  /* ---------------- рис. 19: модель в пространстве состояний ---------------- */
  function ss(R) {
    const d = D(), P = R.P;
    d.add('Constant', 'const', 40, 112, { val: fx(P.Uopen), tip: T('напряжение на обоих двигателях (разомкнутая система)', [['Constant value', 'Uopen', 'Uopen = ' + fx(P.Uopen) + ' В (скрипт задаёт переменную)']]) });
    d.add('Mux', 'mux', 120, 112, { n: 2, h: 44, tip: MUX(2, 'вектор управления u = [vl; vr]: одно и то же напряжение на левый и правый двигатели') });
    d.add('State-Space', 'ss', 250, 50, { text: SS, tip: SSB(1, 'продольное движение и наклон: состояние θ, ψ, θ̇, ψ̇') });
    d.add('State-Space1', 'ss', 250, 180, { text: SS, tip: SSB(2, 'поворот: состояние φ, φ̇') });
    d.add('Demux', 'demux', 390, 50, { n: 4, h: 64, tip: DEMUX(4, 'разбор вектора состояния на θ, ψ, θ̇, ψ̇') });
    d.add('Demux1', 'demux', 390, 180, { n: 2, h: 40, tip: DEMUX(2, 'разбор на φ, φ̇') });
    d.add('Scope', 'scope', 480, 50, { nIn: 4, h: 64, tip: T('графики θ, ψ, θ̇, ψ̇', [['Number of input ports', '4', '']]) });
    d.add('Scope1', 'scope', 480, 180, { nIn: 2, h: 40, tip: T('графики φ, φ̇', [['Number of input ports', '2', '']]) });
    d.ln('Constant', 1, 'Mux', 1, { mx: 85 });
    d.ln('Constant', 1, 'Mux', 2, { from: [85, 112] });
    d.ln('Mux', 1, 'State-Space', 1, { mx: 160, label: 'u' });
    d.ln('Mux', 1, 'State-Space1', 1, { from: [160, 112] });
    d.ln('State-Space', 1, 'Demux', 1); d.ln('State-Space1', 1, 'Demux1', 1);
    ['θ', 'ψ', 'θ̇', 'ψ̇'].forEach((t, k) => d.ln('Demux', k + 1, 'Scope', k + 1, { label: t }));
    ['φ', 'φ̇'].forEach((t, k) => d.ln('Demux1', k + 1, 'Scope1', k + 1, { label: t }));
    // To Workspace — каждая ветка вниз от своего State-Space, без пересечений
    d.add('x1_out', 'tows', 480, 112, { val: 'x1_ws', tip: TOWS('x1_ws', 'θ, ψ, θ̇, ψ̇ для графиков скрипта') });
    d.add('x2_out', 'tows', 480, 245, { val: 'x2_ws', tip: TOWS('x2_ws', 'φ, φ̇ для графиков скрипта') });
    d.ln('State-Space', 1, 'x1_out', 1, { from: [340, 50], via: [[340, 112]] });
    d.ln('State-Space1', 1, 'x2_out', 1, { from: [340, 180], via: [[340, 245]] });
    return d;
  }

  /* ---------------- рис. 29: системная модель ---------------- */
  function sys(R) {
    const d = D();
    d.add('Constant', 'const', 40, 70, { val: fx(R.P.Uopen), tip: T('задание ШИМ на оба двигателя', [['Constant value', 'U0', 'U0 = ' + fx(R.P.Uopen) + ' (скрипт задаёт переменную)']]) });
    d.add('Mux', 'mux', 115, 70, { n: 2, h: 40, tip: MUX(2, 'шина Ctl: ШИМ левого и правого двигателей (вместо Bus Creator)') });
    d.add('Controller', 'subsys', 255, 85, { nIn: 2, nOut: 1, w: 110, h: 60, inNames: ['U', 'Data'], outNames: ['Ctl'], tip: SUBS('Subsystem: пока передаёт задание U на выход Ctl, вход Data — на Terminator') });
    d.add('Plant', 'subsys', 440, 85, { nIn: 1, nOut: 1, w: 110, h: 60, inNames: ['Ctl'], outNames: ['Data'], accent: true, tip: SUBS('Subsystem: Real_in → State-Space → MATLAB Function → Real_out (рис. 27)') });
    d.ln('Constant', 1, 'Mux', 1, { mx: 80 }); d.ln('Constant', 1, 'Mux', 2, { from: [80, 70] });
    d.ln('Mux', 1, 'Controller', 1, { label: 'U' });
    d.ln('Controller', 1, 'Plant', 1, { label: 'Ctl' });
    const xr = d.b.Plant.x + d.b.Plant.w / 2 + 25, xl = d.b.Controller.x - d.b.Controller.w / 2 - 25;
    d.ln('Plant', 1, 'Controller', 2, { via: [[xr, 85], [xr, 150], [xl, 150], [xl, d.inP('Controller', 2)[1]]], label: 'Data' });
    return d;
  }

  /* ---------------- рис. 22–25: подсистема Real_in (Ideal_in / Real_in по real_model) ---------------- */
  function realIn(R) {
    const d = D(), P = R.P, pwm = P.satOrder === 'pwm';
    const g = { val: '1/K_PWM', tip: T('перевод ШИМ в вольты', [['Gain', '1/K_PWM', '1/K_PWM = ' + fx(1 / R.KPWM) + ' В; K_PWM = PWM_max/U_pit = ' + fx(R.KPWM, 6)]]) };
    const st = { tip: T('ограничение ' + (pwm ? 'ШИМ' : 'напряжения') + ' по модулю', pwm ? [['Upper limit', 'PWM_max', 'PWM_max = ' + P.PWMmax], ['Lower limit', '-PWM_max', '']] : [['Upper limit', 'PWM_max', 'PWM_max = ' + P.PWMmax + ' (порядок блоков по настройке)'], ['Lower limit', '-PWM_max', '']]) };
    d.add('Switch', 'switch', 470, 110, { h: 96, tip: SWT('заменяет Variant Subsystem методички: при real_model = 1 проходит верхний вход (Real_in), иначе нижний (Ideal_in)') });
    const y1 = d.inP('Switch', 1)[1], y3 = d.inP('Switch', 3)[1];
    d.add('Ctl', 'inport', 30, y1, { val: '1', tip: IN(1, 'вход: ШИМ от регулятора (шина Ctl)') });
    let x = at(d, 'Round', 'round', 80, y1, { val: 'round', tip: T('ШИМ задаётся целым числом', [['Rounding function', 'round', '']]) });
    x = at(d, pwm ? 'Saturation' : 'Gain', pwm ? 'sat' : 'gain', x + 30, y1, pwm ? st : g);
    at(d, pwm ? 'Gain' : 'Saturation', pwm ? 'gain' : 'sat', x + 30, y1, pwm ? g : st);
    const a = pwm ? 'Saturation' : 'Gain', b = pwm ? 'Gain' : 'Saturation';
    d.add('real_model', 'const', 370, 110, { val: 'real_model', name: false, tip: T('переключатель модели', [['Constant value', 'real_model', '0 — идеальная модель, 1 — с квантованием (config.m)']]) });
    d.add('Ideal_in', 'gain', 230, y3, { val: '1/K_PWM', tip: T('идеальный перевод ШИМ в вольты: без округления и ограничения', [['Gain', '1/K_PWM', '1/K_PWM = ' + fx(1 / R.KPWM) + ' В']]) });
    d.add('V', 'outport', 545, 110, { val: '1', tip: OUT(1, 'напряжение на двигателях') });
    d.ln('Ctl', 1, 'Round', 1);
    d.ln('Round', 1, a, 1); d.ln(a, 1, b, 1); d.ln(b, 1, 'Switch', 1);
    d.ln('Ctl', 1, 'Ideal_in', 1, { from: [62, y1], via: [[62, y3]] });
    d.ln('real_model', 1, 'Switch', 2);
    d.ln('Ideal_in', 1, 'Switch', 3);
    d.ln('Switch', 1, 'V', 1, { label: 'V' });
    return d;
  }
  /* Real_out: квантование показаний датчиков */
  function realOut() {
    const d = D();
    d.add('Switch', 'switch', 320, 100, { h: 96, tip: SWT('при real_model = 1 — округлённые показания (верхний вход), иначе точные') });
    const y1 = d.inP('Switch', 1)[1], y3 = d.inP('Switch', 3)[1];
    d.add('In', 'inport', 30, y1, { val: '1', tip: IN(1, 'вход: показания датчиков enc_l, enc_r, gyro') });
    d.add('Round', 'round', 150, y1, { val: 'round', tip: T('энкодеры — целые градусы, гироскоп — целые град/с', [['Rounding function', 'round', '']]) });
    d.add('real_model', 'const', 225, 100, { val: 'real_model', name: false, tip: T('переключатель модели', [['Constant value', 'real_model', '0 — идеальная модель, 1 — с квантованием (config.m)']]) });
    d.add('Data', 'outport', 400, 100, { val: '1', tip: OUT(1, 'шина Data') });
    d.ln('In', 1, 'Round', 1);
    d.ln('Round', 1, 'Switch', 1);
    d.ln('In', 1, 'Switch', 3, { from: [70, y1], via: [[70, y3]] });
    d.ln('real_model', 1, 'Switch', 2);
    d.ln('Switch', 1, 'Data', 1, { label: 'Data' });
    return d;
  }

  /* ---------------- рис. 27/38: подсистема Plant ---------------- */
  function plant(R, x0) {
    const d = D(), P = R.P, y = 115;
    d.add('Ctl', 'inport', 30, y, { val: '1', tip: IN(1, 'шина Ctl: ШИМ двигателей') });
    let x = at(d, 'Real_in', 'subsys', 70, y, { w: 80, h: 44, inNames: ['Ctl'], outNames: ['V'], tip: SUBS('Subsystem Real_in: Ideal_in / Real_in (Round, Gain 1/K_PWM, Saturation), рис. 22–25') });
    const xv = x + 22;
    x = at(d, 'State-Space', 'ss', xv + 30, 55, { text: SS, tip: SSB(1, 'продольное движение и наклон', x0 || '[0 0 0 0]') });
    at(d, 'State-Space1', 'ss', xv + 30, 175, { text: SS, tip: SSB(2, 'поворот', '[0 0]') });
    d.add('Mux_y', 'mux', x + 40, y, { n: 2, h: 90, tip: MUX(2, 'вектор выхода y = [θ; ψ; θ̇; ψ̇; φ; φ̇]') });
    const xy = x + 62;
    x = at(d, 'fcn', 'fcn', x + 90, y, { nIn: 1, nOut: 3, h: 66, text: 'MATLAB\nFunction', inNames: ['y'], outNames: ['enc_l', 'enc_r', 'gyro'], tip: T('датчики по формуле (37): углы энкодеров и скорость гироскопа в градусах', [['код функции', 'enc_l = (θ − ψ − W/(2R)·φ)·180/pi …', 'R = ' + fx(P.R) + ' м, W = ' + fx(P.W) + ' м, W/(2R) = ' + fx(P.W / (2 * P.R))]]) });
    d.add('Mux_data', 'mux', x + 30, y, { n: 3, h: 66, tip: MUX(3, 'шина Data: enc_l, enc_r, gyro') });
    x = at(d, 'Real_out', 'subsys', x + 60, y, { w: 80, h: 44, inNames: ['In'], outNames: ['Data'], tip: SUBS('Subsystem Real_out: Round — квантование показаний при real_model = 1') });
    const xd = x + 22;
    d.add('Data', 'outport', x + 70, y, { val: '1', tip: OUT(1, 'шина Data') });
    d.ln('Ctl', 1, 'Real_in', 1);
    d.ln('Real_in', 1, 'State-Space', 1, { mx: xv, label: 'V' });
    d.ln('Real_in', 1, 'State-Space1', 1, { from: [xv, y] });
    d.ln('State-Space', 1, 'Mux_y', 1); d.ln('State-Space1', 1, 'Mux_y', 2);
    d.ln('Mux_y', 1, 'fcn', 1, { label: 'y' });
    [1, 2, 3].forEach(k => d.ln('fcn', k, 'Mux_data', k));
    d.ln('Mux_data', 1, 'Real_out', 1);
    d.ln('Real_out', 1, 'Data', 1, { label: 'Data' });
    d.add('v_out', 'tows', d.b['State-Space1'].x, 245, { val: 'v_ws', tip: TOWS('v_ws', 'напряжение на двигателях для графиков') });
    d.add('y_out', 'tows', d.b.fcn.x, 205, { val: 'y_ws', tip: TOWS('y_ws', 'вектор выхода y для графиков') });
    d.add('data_out', 'tows', xd + 60, 190, { val: 'data_ws', tip: TOWS('data_ws', 'показания датчиков для графиков') });
    d.ln('Real_in', 1, 'v_out', 1, { from: [xv, 175], via: [[xv, 245]] });
    d.ln('Mux_y', 1, 'y_out', 1, { from: [xy, y], via: [[xy, 205]] });
    d.ln('Real_out', 1, 'data_out', 1, { from: [xd, y], via: [[xd, 190]] });
    return d;
  }

  /* ---------------- рис. 40/49/52: подсистема get_states; mode: 1 — s1, 2 — с θint, 3 — с φ, φ̇ ----------------
   * Координаты блоков одинаковы во всех режимах (по ним же строится модель в matlab.js). */
  /* строки сигналов совпадают с входами States (шаг 50): θint 50, θ 100, ψ 150, θ̇ 200, ψ̇ 250, φ 300, φ̇ 350 */
  const GS = { yT: 50, yE: 92, yD: 200, yG: 225, yPs: 250, yP: 300, yPd: 350, xA: 432, xI: 360, xB: 222, xPd: 240, xR: 432 };
  const GS_IN = { theta_int: 50, theta: 100, psi: 150, theta_dot: 200, psi_dot: 250, phi: 300, phi_dot: 350 };
  function getStates(R, mode) {
    const d = D(), P = R.P, g = GS;
    mode = mode || 3;
    d.add('Data', 'inport', 30, (g.yE + g.yG) / 2, { val: '1', tip: IN(1, 'шина Data: enc_l, enc_r (градусы) и gyro (град/с)') });
    d.add('Demux', 'demux', 85, (g.yE + g.yG) / 2, { n: 2, h: 2 * (g.yG - g.yE), tip: T('заменяет Bus Selector шины Data: enc — два сигнала, gyro — один', [['Number of outputs', '[2 1]', 'размеры выходов: enc (2), gyro (1)']]) });
    d.add('D2R', 'gain', 180, g.yE, { val: 'pi/180', tip: T('градусы → радианы (блок Degrees to Radians методички)', [['Gain', 'pi/180', '']]) });
    d.add('Sum of Elements', 'sumel', 260, g.yE, { tip: T('сумма углов энкодеров θml + θmr', [['Icon shape', 'rectangular', ''], ['List of signs', '+', 'сумма элементов вектора']]) });
    d.add('Gain', 'gain', 318, g.yE, { val: '1/2', tip: T('среднее по двум колёсам ½(θml + θmr)', [['Gain', '1/2', '']]) });
    d.add('Add', 'add', 400, g.yE + 8, { signs: '++', tip: T('θ = ½(θml + θmr) + ψ: энкодеры меряют угол колеса относительно корпуса', [['List of signs', '++', '']]) });
    d.add('D2R1', 'gain', 180, g.yG, { val: 'pi/180', tip: T('ψ̇ в рад/с', [['Gain', 'pi/180', '']]) });
    d.add('Integrator', 'int', 290, g.yG, { num: '1', den: 's', tip: INTG('ψ = ∫ψ̇ dt') });
    d.add('Derivative', 'deriv', 490, g.yD, { num: 'Δu', den: 'Δt', tip: DERIV('θ̇ = dθ/dt') });
    const ord = [];
    if (mode >= 2) { d.add('Integrator1', 'int', 490, g.yT, { num: '1', den: 's', tip: INTG('θint = ∫θ dt (модели s3, s4)') }); ord.push(['theta_int', 'Integrator1', g.yT]); }
    ord.push(['theta', 'Add', g.yE + 8], ['theta_dot', 'Derivative', g.yD], ['psi', 'Integrator', g.yG], ['psi_dot', 'D2R1', g.yPs]);
    if (mode === 3) {
      d.add('Demux1', 'demux', 260, g.yP, { n: 2, h: 32, tip: DEMUX(2, 'θml, θmr в радианах') });
      d.add('Sum', 'add', 315, g.yP, { signs: '-+', tip: T('θmr − θml', [['List of signs', '-+', '']]) });
      d.add('R_W', 'gain', 385, g.yP, { val: 'R/W', tip: T('φ = R/W·(θmr − θml)', [['Gain', 'R/W', 'R/W = ' + fx(P.R) + '/' + fx(P.W) + ' = ' + fx(P.R / P.W)]]) });
      d.add('Derivative1', 'deriv', 490, g.yPd, { num: 'Δu', den: 'Δt', tip: DERIV('φ̇ = dφ/dt') });
      ord.push(['phi', 'R_W', g.yP], ['phi_dot', 'Derivative1', g.yPd]);
    }
    // порядок входов шины States: θint, θ, ψ, θ̇, ψ̇, φ, φ̇
    const busOrder = ['theta_int', 'theta', 'psi', 'theta_dot', 'psi_dot', 'phi', 'phi_dot'].filter(nm => ord.some(o => o[0] === nm));
    const n = busOrder.length, top = GS_IN[busOrder[0]] - 25, bot = GS_IN[busOrder[n - 1]] + 25;
    d.add('States', 'mux', 640, (top + bot) / 2, { n, h: bot - top, tip: T('вектор состояния: ' + busOrder.join(', ') + ' — заменяет Bus Creator States и Bus to Vector', [['Number of inputs', String(n), '']]) });
    d.add('X', 'outport', 700, (top + bot) / 2, { val: '1', tip: OUT(1, 'оценка вектора состояния X') });
    d.ln('Data', 1, 'Demux', 1);
    d.ln('Demux', 1, 'D2R', 1, { label: 'enc' });
    d.ln('Demux', 2, 'D2R1', 1, { label: 'gyro' });
    d.ln('D2R', 1, 'Sum of Elements', 1);
    d.ln('Sum of Elements', 1, 'Gain', 1);
    d.ln('Gain', 1, 'Add', 1);
    d.ln('D2R1', 1, 'Integrator', 1);
    d.ln('Integrator', 1, 'Add', 2, { from: [g.xI, g.yG], via: [[g.xI, d.inP('Add', 2)[1]]] });
    if (mode >= 2) d.ln('Add', 1, 'Integrator1', 1, { from: [g.xA, g.yE + 8], via: [[g.xA, g.yT]] });
    d.ln('Add', 1, 'Derivative', 1, { from: [g.xA, g.yE + 8], via: [[g.xA, g.yD]] });
    if (mode === 3) {
      d.ln('D2R', 1, 'Demux1', 1, { from: [g.xB, g.yE], via: [[g.xB, g.yP]] });
      d.ln('Demux1', 1, 'Sum', 1); d.ln('Demux1', 2, 'Sum', 2);
      d.ln('Sum', 1, 'R_W', 1);
      d.ln('R_W', 1, 'Derivative1', 1, { from: [g.xR, g.yP], via: [[g.xR, g.yPd]] });
    }
    // входы States: каждый сигнал идёт по своему вертикальному каналу; порядок каналов подбирается без пересечений
    const sig = busOrder.map((nm, k) => { const [, src, ys] = ord.find(o => o[0] === nm); return { nm, src, ys, yk: d.inP('States', k + 1)[1], k }; });
    const bent = sig.filter(s => s.ys !== s.yk), ch = bestChannels(bent);
    sig.forEach(s => {
      const i = bent.indexOf(s), xc = i < 0 ? 600 : 622 - (bent.length - 1 - ch[i]) * 10;   // каналы у самого States — подписям сигналов остаётся место
      const opt = { label: s.nm };
      if (s.src === 'D2R1') { opt.from = [g.xPd, g.yG]; opt.via = [[g.xPd, s.ys], [xc, s.ys], [xc, s.yk]]; }
      else opt.via = [[xc, s.ys], [xc, s.yk]];
      d.ln(s.src, 1, 'States', s.k + 1, opt);
    });
    d.ln('States', 1, 'X', 1, { label: 'X' });
    return d;
  }
  /* номер канала (0 — левый) для каждого сигнала: перебор перестановок, минимум пересечений */
  function bestChannels(sig) {
    const n = sig.length, idx = sig.map((s, i) => i);
    let best = null, bc = Infinity;
    const cross = c => {
      let k = 0;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const a = sig[i], b = sig[j], lo = Math.min(b.ys, b.yk), hi = Math.max(b.ys, b.yk);
        if (c[j] < c[i] && a.ys > lo && a.ys < hi) k++;   // горизонталь от источника a пересекает канал b левее
        if (c[j] > c[i] && a.yk > lo && a.yk < hi) k++;   // горизонталь к входу a пересекает канал b правее
      }
      return k;
    };
    const perm = (a, l) => {
      if (l === a.length) { const v = cross(a); if (v < bc) { bc = v; best = a.slice(); } return; }
      for (let i = l; i < a.length; i++) { [a[l], a[i]] = [a[i], a[l]]; perm(a, l + 1); [a[l], a[i]] = [a[i], a[l]]; if (bc === 0) return; }
    };
    perm(idx.slice(), 0);
    return best;
  }

  /* ---------------- рис. 45: подсистема Control ---------------- */
  function control(R) {
    const d = D(), y = 60;
    d.add('U', 'inport', 30, y, { val: '1', tip: IN(1, 'вектор уставки ref') });
    d.add('Data', 'inport', 30, 150, { val: '2', tip: IN(2, 'шина Data от датчиков') });
    d.add('get_states', 'subsys', 140, 150, { w: 90, h: 44, inNames: ['Data'], outNames: ['X'], tip: SUBS('Subsystem get_states: оценка вектора состояния по датчикам (рис. 40, 49, 52)') });
    d.add('Sum', 'sum', 250, y, { ports: ['l', 'b'], signs: '+-', tip: T('ошибка e = ref − X', [['Icon shape', 'round', ''], ['List of signs', '|+-', 'слева «+», снизу «−»']]) });
    d.add('K', 'gain', 335, y, { val: 'K*u', tip: T('регулятор LQR: u = Klqr·e', [['Gain', 'Klqr', 'матрица 2×' + (R.lqr.s4.K[0] || []).length + ' из lqr(s4, QQ, RR)'], ['Multiplication', 'Matrix(K*u)', 'матричное умножение']]) });
    d.add('K_PWM', 'gain', 440, y, { val: 'K_PWM', tip: T('перевод напряжения в ШИМ', [['Gain', 'K_PWM', 'K_PWM = PWM_max/U_pit = ' + fx(R.KPWM, 6)]]) });
    d.add('Ctl', 'outport', 530, y, { val: '1', tip: OUT(1, 'шина Ctl: ШИМ двигателей') });
    d.add('x_out', 'tows', 335, 205, { val: 'xest_ws', tip: TOWS('xest_ws', 'оценка вектора состояния для графиков') });
    d.ln('U', 1, 'Sum', 1, { label: 'ref' });
    d.ln('Data', 1, 'get_states', 1);
    d.ln('get_states', 1, 'Sum', 2, { label: 'X' });
    d.ln('get_states', 1, 'x_out', 1, { from: [250, 150], via: [[250, 205]] });
    d.ln('Sum', 1, 'K', 1, { label: 'e' });
    d.ln('K', 1, 'K_PWM', 1);
    d.ln('K_PWM', 1, 'Ctl', 1, { label: 'PWM' });
    return d;
  }

  /* ---------------- рис. 51: задающий вектор и системная модель с регулятором движения ---------------- */
  function sysLqr(R) {
    const d = D(), P = R.P;
    d.add('ref', 'mux', 250, 160, { n: 7, h: 300, tip: T('задающий вектор: θint, θ, ψ, θ̇, ψ̇, φ, φ̇ — порядок как у States', [['Number of inputs', '7', '']]) });
    const p = k => d.inP('ref', k)[1];
    d.add('v', 'const', 30, p(4), { val: fx(P.vref), tip: T('заданная скорость θ̇', [['Constant value', 'vref', 'vref = ' + fx(P.vref) + ' рад/с']]) });
    d.add('Integrator', 'int', 115, p(2), { num: '1', den: 's', tip: INTG('θз = ∫vref dt') });
    d.add('Integrator1', 'int', 185, p(1), { num: '1', den: 's', tip: INTG('θint,з = ∫θз dt') });
    d.add('zero', 'const', 170, p(3), { val: '0', tip: T('заданные ψ и ψ̇ — нули (иначе робот упадёт)', [['Constant value', '0', '']]) });
    d.add('w', 'const', 30, p(7), { val: fx(P.wref), tip: T('заданная скорость поворота φ̇', [['Constant value', 'wref', 'wref = ' + fx(P.wref) + ' рад/с']]) });
    d.add('Integrator2', 'int', 115, p(6), { num: '1', den: 's', tip: INTG('φз = ∫wref dt') });
    d.add('Controller', 'subsys', 390, 175, { nIn: 2, nOut: 1, w: 100, h: 60, inNames: ['U', 'Data'], outNames: ['Ctl'], tip: SUBS('Subsystem Control (рис. 45): get_states, Sum, K, K_PWM') });
    d.add('Plant', 'subsys', 555, 175, { nIn: 1, nOut: 1, w: 100, h: 60, inNames: ['Ctl'], outNames: ['Data'], accent: true, tip: SUBS('Subsystem Plant (рис. 38), начальное состояние State-Space [0 Psi0 0 0], Psi0 = ' + fx(P.Psi0) + ' рад') });
    d.ln('v', 1, 'ref', 4);
    d.ln('v', 1, 'Integrator', 1, { from: [70, p(4)], via: [[70, p(2)]] });
    d.ln('Integrator', 1, 'ref', 2);
    d.ln('Integrator', 1, 'Integrator1', 1, { from: [150, p(2)], via: [[150, p(1)]] });
    d.ln('Integrator1', 1, 'ref', 1);
    d.ln('zero', 1, 'ref', 3);
    d.ln('zero', 1, 'ref', 5, { from: [215, p(3)], via: [[215, p(5)]] });
    d.ln('w', 1, 'ref', 7);
    d.ln('w', 1, 'Integrator2', 1, { from: [70, p(7)], via: [[70, p(6)]] });
    d.ln('Integrator2', 1, 'ref', 6);
    d.ln('ref', 1, 'Controller', 1, { label: 'ref' });
    d.ln('Controller', 1, 'Plant', 1, { label: 'Ctl' });
    const xr = d.b.Plant.x + d.b.Plant.w / 2 + 25, xl = d.b.Controller.x - d.b.Controller.w / 2 - 25;
    d.ln('Plant', 1, 'Controller', 2, { via: [[xr, 175], [xr, 245], [xl, 245], [xl, d.inP('Controller', 2)[1]]], label: 'Data' });
    return d;
  }

  const api = { GS, ss, sys, realIn, realOut, plant, getStates, control, sysLqr, num, poly };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.DIAG = api;
})(typeof window !== 'undefined' ? window : globalThis);
