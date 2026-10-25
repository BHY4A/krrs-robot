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

  /* ---------------- рис. 19: модель в пространстве состояний ---------------- */
  function ss(R) {
    const d = D(), P = R.P;
    d.add('Constant', 'const', 40, 112, { val: fx(P.Uopen), tip: 'Value = Uopen = ' + fx(P.Uopen) + ' В — напряжение на обоих двигателях' });
    d.add('Mux', 'mux', 120, 112, { n: 2, h: 44, tip: 'Number of inputs = 2: вектор управления u = [vl; vr]' });
    d.add('State-Space', 'ss', 250, 50, { text: SS, tip: 'A1, B1, C1, D1 — продольное движение и наклон: θ, ψ, θ̇, ψ̇' });
    d.add('State-Space1', 'ss', 250, 180, { text: SS, tip: 'A2, B2, C2, D2 — поворот: φ, φ̇' });
    d.add('Demux', 'demux', 380, 50, { n: 4, h: 64, tip: 'Number of outputs = 4' });
    d.add('Demux1', 'demux', 380, 180, { n: 2, h: 40, tip: 'Number of outputs = 2' });
    d.add('Scope', 'scope', 470, 50, { nIn: 4, h: 64, tip: 'Number of input ports = 4: θ, ψ, θ̇, ψ̇' });
    d.add('Scope1', 'scope', 470, 180, { nIn: 2, h: 40, tip: 'Number of input ports = 2: φ, φ̇' });
    d.ln('Constant', 1, 'Mux', 1, { mx: 82 });
    d.ln('Constant', 1, 'Mux', 2, { from: [82, 112] });
    d.ln('Mux', 1, 'State-Space', 1, { mx: 160, label: 'u' });
    d.ln('Mux', 1, 'State-Space1', 1, { from: [160, 112] });
    d.ln('State-Space', 1, 'Demux', 1); d.ln('State-Space1', 1, 'Demux1', 1);
    ['θ', 'ψ', 'θ̇', 'ψ̇'].forEach((t, k) => d.ln('Demux', k + 1, 'Scope', k + 1, { label: t }));
    ['φ', 'φ̇'].forEach((t, k) => d.ln('Demux1', k + 1, 'Scope1', k + 1, { label: t }));
    d.add('x1_out', 'tows', 470, 250, { val: 'x1_ws', tip: 'To Workspace: θ, ψ, θ̇, ψ̇ для графиков' });
    d.add('x2_out', 'tows', 470, 295, { val: 'x2_ws', tip: 'To Workspace: φ, φ̇' });
    d.ln('State-Space', 1, 'x1_out', 1, { from: [330, 50], via: [[330, 250]] });
    d.ln('State-Space1', 1, 'x2_out', 1, { from: [320, 180], via: [[320, 295]] });
    return d;
  }

  /* ---------------- рис. 29: системная модель ---------------- */
  function sys(R) {
    const d = D();
    d.add('Constant', 'const', 40, 70, { val: fx(R.P.Uopen), tip: 'Value = U0 — задание ШИМ на оба двигателя' });
    d.add('Mux', 'mux', 115, 70, { n: 2, h: 40, tip: 'Number of inputs = 2 (шина Ctl: PWM левого и правого двигателей)' });
    d.add('Controller', 'subsys', 250, 85, { nIn: 2, nOut: 1, w: 110, h: 60, inNames: ['U', 'Data'], outNames: ['Ctl'], tip: 'Subsystem: пока передаёт задание U на выход Ctl, вход Data — на Terminator' });
    d.add('Plant', 'subsys', 430, 85, { nIn: 1, nOut: 1, w: 110, h: 60, inNames: ['Ctl'], outNames: ['Data'], accent: true, tip: 'Subsystem: Real_in → State-Space → MATLAB Function → Real_out' });
    d.ln('Constant', 1, 'Mux', 1, { mx: 78 }); d.ln('Constant', 1, 'Mux', 2, { from: [78, 70] });
    d.ln('Mux', 1, 'Controller', 1, { label: 'U' });
    d.ln('Controller', 1, 'Plant', 1, { label: 'Ctl' });
    d.ln('Plant', 1, 'Controller', 2, { via: [[515, 85], [515, 150], [170, 150], [170, d.inP('Controller', 2)[1]]], label: 'Data' });
    return d;
  }

  /* ---------------- рис. 22–25: подсистема Real_in (Ideal_in / Real_in по real_model) ---------------- */
  function realIn(R) {
    const d = D(), P = R.P, pwm = P.satOrder === 'pwm';
    d.add('Switch', 'switch', 430, 110, { h: 90, tip: 'Switch, u2 > 0,5: заменяет Variant Subsystem методички — при real_model = 1 проходит верхний вход (Real_in), иначе нижний (Ideal_in)' });
    const y1 = d.inP('Switch', 1)[1], y3 = d.inP('Switch', 3)[1];
    d.add('Ctl', 'inport', 30, y1, { val: '1', tip: 'вход ШИМ' });
    d.add('Round', 'round', 110, y1, { val: 'round', tip: 'Rounding Function, Operator = round — ШИМ задаётся целым числом' });
    const a = pwm ? 'Saturation' : 'Gain', b = pwm ? 'Gain' : 'Saturation';
    d.add('Gain', 'gain', pwm ? 275 : 190, y1, { val: '1/K_PWM', tip: 'Gain = 1/K_PWM = ' + fx(1 / R.KPWM) + ' — перевод ШИМ в вольты' });
    d.add('Saturation', 'sat', pwm ? 190 : 275, y1, { tip: 'Upper/Lower limit = ±PWM_max = ±' + P.PWMmax });
    d.add('real_model', 'const', 362, 110, { val: 'real_model', name: false, tip: 'Constant real_model: 0 — идеальная модель, 1 — реальная' });
    d.add('Ideal_in', 'gain', 230, 185, { val: '1/K_PWM', tip: 'Gain = 1/K_PWM — идеальный перевод ШИМ в вольты (без округления и ограничения)' });
    d.add('V', 'outport', 510, 110, { val: '1', tip: 'напряжение на двигателях' });
    d.ln('Ctl', 1, 'Round', 1);
    d.ln('Round', 1, a, 1); d.ln(a, 1, b, 1); d.ln(b, 1, 'Switch', 1);
    d.ln('Ctl', 1, 'Ideal_in', 1, { from: [70, y1], via: [[70, 185]] });
    d.ln('real_model', 1, 'Switch', 2);
    d.ln('Ideal_in', 1, 'Switch', 3, { mx: 395 });
    d.ln('Switch', 1, 'V', 1, { label: 'V' });
    return d;
  }
  /* Real_out: квантование показаний датчиков */
  function realOut() {
    const d = D();
    d.add('Switch', 'switch', 300, 100, { h: 90, tip: 'Switch, u2 > 0,5: при real_model = 1 — округлённые показания (верхний вход)' });
    const y1 = d.inP('Switch', 1)[1], y3 = d.inP('Switch', 3)[1];
    d.add('In', 'inport', 30, y1, { val: '1' });
    d.add('Round', 'round', 140, y1, { val: 'round', tip: 'Rounding Function: энкодеры — целые градусы, гироскоп — целые град/с' });
    d.add('real_model', 'const', 210, 100, { val: 'real_model', name: false, tip: 'Constant real_model: 1 — реальная модель' });
    d.add('Data', 'outport', 380, 100, { val: '1' });
    d.ln('In', 1, 'Round', 1);
    d.ln('Round', 1, 'Switch', 1);
    d.ln('In', 1, 'Switch', 3, { from: [70, y1], via: [[70, y3 + 35], [262, y3 + 35]] });
    d.ln('real_model', 1, 'Switch', 2);
    d.ln('Switch', 1, 'Data', 1, { label: 'Data' });
    return d;
  }

  /* ---------------- рис. 27/38: подсистема Plant ---------------- */
  function plant(R, x0) {
    const d = D(), P = R.P, y = 115;
    d.add('Ctl', 'inport', 30, y, { val: '1' });
    d.add('Real_in', 'subsys', 115, y, { w: 80, h: 44, inNames: ['Ctl'], outNames: ['V'], tip: 'Subsystem: Ideal_in / Real_in (Round, Gain 1/K_PWM, Saturation)' });
    d.add('State-Space', 'ss', 270, 55, { text: SS, tip: 'A1, B1, C1, D1; Initial conditions = ' + (x0 || '[0 0 0 0]') });
    d.add('State-Space1', 'ss', 270, 175, { text: SS, tip: 'A2, B2, C2, D2; Initial conditions = [0 0]' });
    d.add('Mux_y', 'mux', 370, y, { n: 2, h: 90, tip: 'Mux, 2 входа: вектор выхода y = [θ; ψ; θ̇; ψ̇; φ; φ̇]' });
    d.add('fcn', 'fcn', 465, y, { nIn: 1, nOut: 3, w: 100, h: 66, text: 'MATLAB\nFunction', inNames: ['y'], outNames: ['enc_l', 'enc_r', 'gyro'], tip: 'MATLAB Function: формула (37); R = ' + fx(P.R) + ', W = ' + fx(P.W) + ' (W/(2R) = ' + fx(P.W / (2 * P.R)) + ')' });
    d.add('Mux_data', 'mux', 560, y, { n: 3, h: 66, tip: 'Mux, 3 входа (шина Data: enc, gyro)' });
    d.add('Real_out', 'subsys', 640, y, { w: 80, h: 44, inNames: ['In'], outNames: ['Data'], tip: 'Subsystem: Round — квантование показаний датчиков при real_model = 1' });
    d.add('Data', 'outport', 730, y, { val: '1' });
    d.ln('Ctl', 1, 'Real_in', 1);
    d.ln('Real_in', 1, 'State-Space', 1, { mx: 185, label: 'V' });
    d.ln('Real_in', 1, 'State-Space1', 1, { from: [185, y] });
    d.ln('State-Space', 1, 'Mux_y', 1); d.ln('State-Space1', 1, 'Mux_y', 2);
    d.ln('Mux_y', 1, 'fcn', 1, { label: 'y' });
    [1, 2, 3].forEach(k => d.ln('fcn', k, 'Mux_data', k));
    d.ln('Mux_data', 1, 'Real_out', 1);
    d.ln('Real_out', 1, 'Data', 1, { label: 'Data' });
    d.add('v_out', 'tows', 270, 245, { val: 'v_ws', tip: 'To Workspace: напряжение на двигателях' });
    d.add('y_out', 'tows', 465, 205, { val: 'y_ws', tip: 'To Workspace: вектор выхода y для графиков' });
    d.add('data_out', 'tows', 730, 180, { val: 'data_ws', tip: 'To Workspace: показания датчиков' });
    d.ln('Real_in', 1, 'v_out', 1, { from: [185, 175], via: [[185, 245]] });
    d.ln('Mux_y', 1, 'y_out', 1, { from: [395, y], via: [[395, 205]] });
    d.ln('Real_out', 1, 'data_out', 1, { from: [700, y], via: [[700, 180]] });
    return d;
  }

  /* ---------------- рис. 40/49/52: подсистема get_states; mode: 1 — s1, 2 — с θint, 3 — с φ, φ̇ ----------------
   * Координаты блоков одинаковы во всех режимах (по ним же строится модель в matlab.js). */
  const GS = { yT: 50, yE: 110, yD: 165, yG: 225, yP: 290, yPd: 340, xA: 425, xI: 352, xB: 200, xPd: 215, xR: 425 };
  function getStates(R, mode) {
    const d = D(), P = R.P, g = GS;
    mode = mode || 3;
    d.add('Data', 'inport', 30, 167, { val: '1' });
    d.add('Demux', 'demux', 85, 167, { n: 2, h: 80, tip: 'Demux, Outputs = [2 1]: enc (θml, θmr) и gyro — заменяет Bus Selector шины Data' });
    d.add('D2R', 'gain', 160, g.yE, { val: 'pi/180', tip: 'Gain = pi/180 — градусы → радианы (блок Degrees to Radians методички)' });
    d.add('Sum of Elements', 'sumel', 245, g.yE, { tip: 'Sum of Elements: θml + θmr' });
    d.add('Gain', 'gain', 310, g.yE, { val: '1/2', tip: 'Gain = 1/2: ½(θml + θmr)' });
    d.add('Add', 'add', 392, g.yE + 8, { signs: '++', tip: 'Add «++»: θ = ½(θml + θmr) + ψ (энкодеры меряют угол колеса относительно корпуса)' });
    d.add('D2R1', 'gain', 160, g.yG, { val: 'pi/180', tip: 'Gain = pi/180 — ψ̇ в рад/с' });
    d.add('Integrator', 'int', 265, g.yG, { num: '1', den: 's', tip: 'Integrator: ψ = ∫ψ̇ dt' });
    d.add('Derivative', 'deriv', 480, g.yD, { num: 'Δu', den: 'Δt', tip: 'Derivative: θ̇ = dθ/dt' });
    const ord = [];
    if (mode >= 2) { d.add('Integrator1', 'int', 480, g.yT, { num: '1', den: 's', tip: 'Integrator1: θint = ∫θ dt (модели s3, s4)' }); ord.push(['theta_int', 'Integrator1', g.yT]); }
    ord.push(['theta', 'Add', g.yE + 8], ['theta_dot', 'Derivative', g.yD], ['psi', 'Integrator', g.yG], ['psi_dot', 'D2R1', g.yG + 35]);
    if (mode === 3) {
      d.add('Demux1', 'demux', 245, g.yP, { n: 2, h: 36, tip: 'Demux, 2 выхода: θml, θmr в радианах' });
      d.add('Sum', 'add', 300, g.yP, { signs: '-+', tip: 'Add «−+»: θmr − θml' });
      d.add('R_W', 'gain', 375, g.yP, { val: 'R/W', tip: 'Gain = R/W = ' + fx(P.R / P.W) + ': φ = R/W·(θmr − θml)' });
      d.add('Derivative1', 'deriv', 480, g.yPd, { num: 'Δu', den: 'Δt', tip: 'Derivative1: φ̇ = dφ/dt' });
      ord.push(['phi', 'R_W', g.yP], ['phi_dot', 'Derivative1', g.yPd]);
    }
    // порядок входов шины States: θint, θ, ψ, θ̇, ψ̇, φ, φ̇
    const busOrder = ['theta_int', 'theta', 'psi', 'theta_dot', 'psi_dot', 'phi', 'phi_dot'].filter(nm => ord.some(o => o[0] === nm));
    const n = busOrder.length, top = mode >= 2 ? g.yT - 25 : g.yE - 25, bot = mode === 3 ? g.yPd + 25 : g.yG + 60;
    d.add('States', 'mux', 600, (top + bot) / 2, { n, h: bot - top, tip: 'Mux, ' + n + ' входов: ' + busOrder.join(', ') + ' — заменяет Bus Creator States и Bus to Vector' });
    d.add('X', 'outport', 660, (top + bot) / 2, { val: '1' });
    d.ln('Data', 1, 'Demux', 1);
    d.ln('Demux', 1, 'D2R', 1, { label: 'enc', mx: 110 });
    d.ln('Demux', 2, 'D2R1', 1, { label: 'gyro', mx: 110 });
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
    // входы States: каждый сигнал идёт по своему вертикальному каналу
    busOrder.forEach((nm, k) => {
      const [, src, ys] = ord.find(o => o[0] === nm), yk = d.inP('States', k + 1)[1], xc = 530 + k * 9;
      const opt = { label: nm, mx: xc };
      if (src === 'D2R1') { opt.from = [g.xPd, g.yG]; opt.via = [[g.xPd, ys], [xc, ys], [xc, yk]]; }
      else opt.via = [[xc, ys], [xc, yk]];
      d.ln(src, 1, 'States', k + 1, opt);
    });
    d.ln('States', 1, 'X', 1, { label: 'X' });
    return d;
  }

  /* ---------------- рис. 45: подсистема Control ---------------- */
  function control(R) {
    const d = D(), y = 60;
    d.add('U', 'inport', 30, y, { val: '1', tip: 'вектор уставки ref' });
    d.add('Data', 'inport', 30, 150, { val: '2' });
    d.add('get_states', 'subsys', 140, 150, { w: 90, h: 44, inNames: ['Data'], outNames: ['X'], tip: 'Subsystem: оценка вектора состояния по датчикам' });
    d.add('Sum', 'sum', 240, y, { ports: ['l', 'b'], signs: '+-', tip: 'Sum, Inputs = |+−: ошибка e = ref − X' });
    d.add('K', 'gain', 320, y, { val: 'K*u', w: 70, tip: 'Gain = Klqr, Multiplication = Matrix(K*u)' });
    d.add('K_PWM', 'gain', 430, y, { val: 'K_PWM', w: 70, tip: 'Gain = K_PWM = ' + fx(R.KPWM, 6) + ' — перевод напряжения в ШИМ' });
    d.add('Ctl', 'outport', 520, y, { val: '1' });
    d.add('x_out', 'tows', 320, 205, { val: 'xest_ws', tip: 'To Workspace: оценка вектора состояния для графиков' });
    d.ln('U', 1, 'Sum', 1, { label: 'ref' });
    d.ln('Data', 1, 'get_states', 1);
    d.ln('get_states', 1, 'Sum', 2, { label: 'X' });
    d.ln('get_states', 1, 'x_out', 1, { from: [240, 150], via: [[240, 205]] });
    d.ln('Sum', 1, 'K', 1, { label: 'e' });
    d.ln('K', 1, 'K_PWM', 1);
    d.ln('K_PWM', 1, 'Ctl', 1, { label: 'PWM' });
    return d;
  }

  /* ---------------- рис. 51: задающий вектор и системная модель с регулятором движения ---------------- */
  function sysLqr(R) {
    const d = D(), P = R.P;
    d.add('ref', 'mux', 250, 160, { n: 7, h: 300, tip: 'Mux, 7 входов: θint, θ, ψ, θ̇, ψ̇, φ, φ̇ — порядок как у States' });
    const p = k => d.inP('ref', k)[1];
    d.add('v', 'const', 30, p(4), { val: fx(P.vref), tip: 'Constant = vref: заданная скорость θ̇, рад/с' });
    d.add('Integrator', 'int', 115, p(2), { num: '1', den: 's', tip: 'θз = ∫vref dt' });
    d.add('Integrator1', 'int', 185, p(1), { num: '1', den: 's', tip: 'θint,з = ∫θз dt' });
    d.add('zero', 'const', 170, p(3), { val: '0', tip: 'Constant = 0: заданные ψ и ψ̇ (иначе робот упадёт)' });
    d.add('w', 'const', 30, p(7), { val: fx(P.wref), tip: 'Constant = wref: заданная скорость поворота φ̇, рад/с' });
    d.add('Integrator2', 'int', 115, p(6), { num: '1', den: 's', tip: 'φз = ∫wref dt' });
    d.add('Controller', 'subsys', 380, 160, { nIn: 2, nOut: 1, w: 100, h: 60, inNames: ['U', 'Data'], outNames: ['Ctl'], tip: 'Subsystem Control (рис. 45)' });
    d.add('Plant', 'subsys', 540, 160, { nIn: 1, nOut: 1, w: 100, h: 60, inNames: ['Ctl'], outNames: ['Data'], accent: true, tip: 'Subsystem Plant (рис. 38), начальное состояние [0 Psi0 0 0]' });
    d.ln('v', 1, 'ref', 4);
    d.ln('v', 1, 'Integrator', 1, { from: [65, p(4)], via: [[65, p(2)]] });
    d.ln('Integrator', 1, 'ref', 2);
    d.ln('Integrator', 1, 'Integrator1', 1, { from: [150, p(2)], via: [[150, p(1)]] });
    d.ln('Integrator1', 1, 'ref', 1);
    d.ln('zero', 1, 'ref', 3);
    d.ln('zero', 1, 'ref', 5, { from: [215, p(3)], via: [[215, p(5)]] });
    d.ln('w', 1, 'ref', 7);
    d.ln('w', 1, 'Integrator2', 1, { from: [65, p(7)], via: [[65, p(6)]] });
    d.ln('Integrator2', 1, 'ref', 6);
    d.ln('ref', 1, 'Controller', 1, { label: 'ref' });
    d.ln('Controller', 1, 'Plant', 1, { label: 'Ctl' });
    d.ln('Plant', 1, 'Controller', 2, { via: [[620, 160], [620, 235], [310, 235], [310, d.inP('Controller', 2)[1]]], label: 'Data' });
    return d;
  }

  const api = { GS, ss, sys, realIn, realOut, plant, getStates, control, sysLqr, num, poly };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.DIAG = api;
})(typeof window !== 'undefined' ? window : globalThis);
