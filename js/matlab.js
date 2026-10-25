/* =====================================================================
 * matlab.js — генерация файлов MATLAB (R2022) для работы «Робот-балансир»:
 * скрипты из методички (parametrs_Rob, Rob_SM, config, preload, control),
 * скрипты автоматического построения моделей Simulink и проверки.
 * ===================================================================== */
(function (root) {
  'use strict';
  const LABS = root.LABS || (typeof require !== 'undefined' ? require('./labs.js') : null);
  const m = LABS.m, mmat = LABS.mmat;
  /* схемы сайта (diagrams.js): модели строятся с теми же блоками и их положением */
  const DGM = () => root.DIAG || (typeof require !== 'undefined' ? require('./diagrams.js') : null);
  const KPOS = 1.5;
  /* позиции блоков схемы в координатах Simulink: масштаб KPOS, левый верхний угол — (30, 30) */
  function posOf(d, base) {
    let x0 = Infinity, y0 = Infinity;
    const db = base || d;   // base — схема, по которой выравнивать (одинаковые координаты во всех режимах)
    for (const id of db.order) { const p = db.pos(id); x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); }
    return id => '[' + d.pos(id).map((v, k) => Math.round(30 + (v - (k % 2 ? y0 : x0)) * KPOS)).join(' ') + ']';
  }

  function header(title, R, noClear) {
    return `%% ${title}
% ${R.P.variant ? 'Вариант ' + R.P.variant : 'Пример из методички'}. Файл сформирован веб-утилитой «Робот-балансир».
% Дисциплина «Конструирование роботов и робототехнических систем».
% Требуется MATLAB R2022 (Control System Toolbox, Simulink).
${noClear ? '' : 'clear; clc; close all;\n'}`;
  }

  /* ---------- parametrs_Rob.m (как в методичке) ---------- */
  function params(R, stage) {
    const P = R.P;
    let s = `%% parametrs_Rob.m — исходные данные робота-балансира
% ${P.variant ? 'Вариант ' + P.variant : 'Пример из методички'}. Сформировано веб-утилитой «Робот-балансир».
% g_sign = 1 — робот стоит (перевёрнутый маятник);
% g_sign = -1 — робот «подвешен» за колёса (маятник) — для проверки модели.
if ~exist('g_sign', 'var'), g_sign = 1; end
g = g_sign*${m(Math.abs(P.g))};   % ускорение силы тяжести [м/с^2]
m = ${m(P.m)};            % масса колеса, [кг]
R = ${m(P.R)};            % радиус колеса, [м]
Jw = m*R^2/2;           % момент инерции колеса, [кг*м^2]
M = ${m(P.M)};            % масса робота, [кг]
W = ${m(P.W)};            % ширина робота, [м]
D = ${m(P.D)};            % толщина робота, [м]
h = ${m(P.h)};            % высота робота, [м]
L = h/2;                % расстояние от центра масс робота до оси колеса, [м]
Jpsi = M*L^2/3;         % момент инерции (при наклоне), [кг*м^2]
Jphi = M*(W^2+D^2)/12;  % момент инерции (при повороте), [кг*м^2]
fw = ${m(P.fw)};           % коэффициент вязкого трения между колесом и полом
fm = ${m(P.fm)};           % коэффициент вязкого трения в моторе

% Параметры двигателя
Jm = ${m(P.Jm)};           % момент инерции ротора двигателя, [кг*м^2]
Rm = ${m(P.Rm)};           % сопротивление обмотки двигателя, [Ом]
Kb = ${m(P.Kb)};           % коэффициент противо-ЭДС, [В*с/рад]
Kt = ${m(P.Kt)};           % коэффициент передачи по току, [Н*м/А]
n = ${m(P.n)};             % коэффициент передачи редуктора
`;
    if (stage >= 3) s += `
% Параметры ШИМ и датчиков
U_pit = ${m(P.Upit)};          % напряжение питания, [В]
K_PWM = ${m(R.KPWM)};      % коэффициент ШИМ = ${m(P.PWMmax)}/U_pit
PWM_max = ${m(P.PWMmax)};       % предел скважности ШИМ
`;
    if (stage >= 4) s += `Psi0 = ${m(P.Psi0)};          % начальный наклон робота, [рад]
`;
    return s;
  }

  /* ---------- Rob_SM.m ---------- */
  /* level (этап 4): 1 — только s1, s2; 2 — + интегратор s3; 3 — + объединённая s4 */
  function robSM(R, stage, level) {
    if (level === undefined) level = 3;
    let s = `%% Rob_SM.m — модель робота-балансира в пространстве состояний
% Загрузка параметров
parametrs_Rob;

% Переменные модели
alpha = n*Kt/Rm;
beta = n*Kt*Kb/Rm + fm;
E = [(2*m+M)*R^2 + 2*Jw + 2*n^2*Jm,  M*L*R - 2*n^2*Jm;
     M*L*R - 2*n^2*Jm,               M*L^2 + Jpsi + 2*n^2*Jm];
F = 2*[beta+fw  -beta;
       -beta     beta];
G = [0  0;
     0  -M*g*L];
H = [alpha   alpha;
     -alpha  -alpha];
I = m*W^2/2 + Jphi + (Jw + n^2*Jm)*W^2/(2*R^2);
J = W^2/(2*R^2)*(beta + fw);
K = W/(2*R)*alpha;

% Матрицы пространства состояний
A1 = [0 0 1 0;
      0 0 0 1;
      -E\\G  -E\\F];
B1 = [0 0;
      0 0;
      E\\H];
C1 = eye(4);
D1 = zeros(4, 2);
A2 = [0  1;
      0  -J/I];
B2 = [0     0;
      -K/I  K/I];
C2 = eye(2);
D2 = zeros(2);

% Модель в пространстве состояний
s1 = ss(A1, B1, C1, D1);
s1.StateName = {'theta', 'psi', 'theta_dot', 'psi_dot'};
s1.InputName = {'Vl', 'Vr'};
s1.OutputName = {'theta', 'psi', 'theta_dot', 'psi_dot'};
s2 = ss(A2, B2, C2, D2);
s2.StateName = {'phi', 'phi_dot'};
s2.InputName = {'Vl', 'Vr'};
s2.OutputName = {'phi', 'phi_dot'};
`;
    if (stage >= 4 && level >= 2) s += `
% Интегратор угла theta (п. 4.4)
s0 = ss(1/tf('s'));
s0.StateName = 'theta_int';
s0.OutputName = 'theta_int';
s3 = append(s0, s1);
s3.A(1,2) = 1;
s3(:,1) = [];
`;
    if (stage >= 4 && level >= 3) s += `
% Объединение с моделью поворота (п. 4.5)
s4 = append(s3, s2);
s4.B(end, [1 2]) = s4.B(end, [3 4]);
s4(:, [3 4]) = [];
`;
    return s;
  }
  const config = (R, real) => `%% config.m — выбор модели: 0 — идеальная, 1 — с неидеальностями (квантование ШИМ и датчиков)
real_model = ${real ? 1 : 0};
`;
  const preload = R => `%% preload.m — шины данных Ctl и Data
% В методичке шины создаются в Bus Editor и сохраняются в bus_data.mat;
% если файла нет, он создаётся этим скриптом.
if exist('bus_data.mat', 'file')
    load('bus_data.mat');
else
    e = Simulink.BusElement; e.Name = 'PWM'; e.Dimensions = 2;
    Ctl = Simulink.Bus; Ctl.Elements = e;
    e1 = Simulink.BusElement; e1.Name = 'enc'; e1.Dimensions = 2;
    e2 = Simulink.BusElement; e2.Name = 'gyro'; e2.Dimensions = 1;
    Data = Simulink.Bus; Data.Elements = [e1 e2];
    save('bus_data.mat', 'Ctl', 'Data');
end
`;
  /* mode не задан — универсальный control.m (switch по lqr_mode); 1/2/3 — как на соответствующем шаге методички */
  function control(R, mode) {
    const P = R.P;
    const qw = P.qw !== 1 ? m(P.qw) + '*' : '', rw = P.rw !== 1 ? m(P.rw) + '*' : '';
    if (mode) {
      const sys = ['s1', 's3', 's4'][mode - 1], nx = [4, 5, 7][mode - 1], K = R.lqr[sys].K;
      const what = ['по модели наклона s1 (п. 4.3)', 'с интегратором, модель s3 (п. 4.4)', 'с управлением движением, модель s4 (п. 4.5)'][mode - 1];
      return `%% control.m — синтез LQR-регулятора ${what}
QQ = ${qw}eye(${nx});
RR = ${rw}eye(2);
Klqr = lqr(${sys}, QQ, RR);
% Ожидаемое значение (веб-утилита):
%   Klqr = ${mmat(K.map(r => r.map(v => +v.toPrecision(5))))}
`;
    }
    return `%% control.m — синтез LQR-регулятора
% lqr_mode: 1 — по модели s1 (4 состояния), 2 — с интегратором (s3, 5 состояний),
%           3 — с управлением движением (s4, 7 состояний)
if ~exist('lqr_mode', 'var'), lqr_mode = 3; end
switch lqr_mode
    case 1
        QQ = ${P.qw !== 1 ? m(P.qw) + '*' : ''}eye(4);
        RR = ${P.rw !== 1 ? m(P.rw) + '*' : ''}eye(2);
        Klqr = lqr(s1, QQ, RR);
    case 2
        QQ = ${P.qw !== 1 ? m(P.qw) + '*' : ''}eye(5);
        RR = ${P.rw !== 1 ? m(P.rw) + '*' : ''}eye(2);
        Klqr = lqr(s3, QQ, RR);
    otherwise
        QQ = ${P.qw !== 1 ? m(P.qw) + '*' : ''}eye(7);
        RR = ${P.rw !== 1 ? m(P.rw) + '*' : ''}eye(2);
        Klqr = lqr(s4, QQ, RR);
end
% Ожидаемые значения (веб-утилита):
%   lqr_mode = 1: Klqr = ${mmat(R.lqr.s1.K.map(r => r.map(v => +v.toPrecision(5))))}
%   lqr_mode = 2: Klqr = ${mmat(R.lqr.s3.K.map(r => r.map(v => +v.toPrecision(5))))}
%   lqr_mode = 3: Klqr = ${mmat(R.lqr.s4.K.map(r => r.map(v => +v.toPrecision(5))))}
`;
  }

  /* ---------- этап 1: расчёт ---------- */
  function raschet(R) {
    const P = R.P;
    const par = params(R, 1).split('\n').filter(l => !/^%%|^% g_sign|^% |^if ~exist/.test(l)).join('\n').replace(/g = g_sign\*/, 'g = ');
    return header('Этап 1. Математическая модель робота-балансира', R) + `
%% Исходные данные (как в parametrs_Rob.m)
${par}
%% Параметры двигателя в уравнениях движения
alpha = n*Kt/Rm;          fprintf('alpha = %.6g Н*м/В\\n', alpha);
beta  = n*Kt*Kb/Rm + fm;  fprintf('beta  = %.6g Н*м*с/рад\\n', beta);
fprintf('Jw = %.6g, L = %.6g, Jpsi = %.6g, Jphi = %.6g\\n', Jw, L, Jpsi, Jphi);

%% Матричные коэффициенты линеаризованной модели (28)
E = [(2*m+M)*R^2 + 2*Jw + 2*n^2*Jm,  M*L*R - 2*n^2*Jm;
     M*L*R - 2*n^2*Jm,               M*L^2 + Jpsi + 2*n^2*Jm]
F = 2*[beta+fw -beta; -beta beta]
G = [0 0; 0 -M*g*L]
H = [alpha alpha; -alpha -alpha]

%% Уравнение поворота (29): I*phi'' + J*phi' = K*(vr - vl)
I = m*W^2/2 + Jphi + (Jw + n^2*Jm)*W^2/(2*R^2);  fprintf('I = %.6g кг*м^2\\n', I);
J = W^2/(2*R^2)*(beta + fw);                    fprintf('J = %.6g Н*м*с/рад\\n', J);
K = W/(2*R)*alpha;                              fprintf('K = %.6g Н*м/В\\n', K);
`;
  }

  /* сохранение окна Figure в PNG (папка figures рядом со скриптом) */
  const savePngFn = `
function save_png(fh, name)
    % сохраняет окно Figure в figures/<name>.png (200 dpi)
    if ~exist('figures', 'dir'), mkdir('figures'); end
    f = fullfile('figures', [name '.png']);
    drawnow;
    try
        exportgraphics(fh, f, 'Resolution', 200);   % R2020a и новее
    catch
        set(fh, 'PaperPositionMode', 'auto');
        print(fh, f, '-dpng', '-r200');
    end
    fprintf('Рисунок сохранён: %s\\n', f);
end
`;
  const saveFlag = `save_figs = true;   % true — сохранять рисунки в PNG (папка figures); false — только показать
`;
  /* ---------- общие функции построения моделей ---------- */
  const helpers = `
%% ---- вспомогательные функции построения модели
function b(path, lib, pos, varargin)
    add_block(lib, path, 'Position', pos, varargin{:});
end
function l(sys, a, c)
    add_line(sys, a, c, 'autorouting', 'on');
end
function sub(path, pos)
    add_block('built-in/Subsystem', path, 'Position', pos);
end
` + savePngFn;
  /* подсистема перевода ШИМ в напряжение: Ideal (1/K_PWM) или Real (Round, Gain, Saturation) по real_model */
  function realIn(R) {
    const P = R.P, pdf = P.satOrder !== 'pwm', q = posOf(DGM().realIn(R)), o = posOf(DGM().realOut(R));
    return `
function make_real_in(p, pos)
    % рис. 22–25: вариантная подсистема Ideal_in / Real_in заменена переключателем Switch по real_model
    sub(p, pos);
    b([p '/Ctl'], 'simulink/Sources/In1', ${q('Ctl')});
    b([p '/Round'], 'simulink/Math Operations/Rounding Function', ${q('Round')}, 'Operator', 'round');
    b([p '/Gain'], 'simulink/Math Operations/Gain', ${q('Gain')}, 'Gain', '1/K_PWM');
    b([p '/Saturation'], 'simulink/Discontinuities/Saturation', ${q('Saturation')}, 'UpperLimit', 'PWM_max', 'LowerLimit', '-PWM_max');
    b([p '/real_model'], 'simulink/Sources/Constant', ${q('real_model')}, 'Value', 'real_model');
    b([p '/Ideal_in'], 'simulink/Math Operations/Gain', ${q('Ideal_in')}, 'Gain', '1/K_PWM');
    b([p '/Switch'], 'simulink/Signal Routing/Switch', ${q('Switch')}, 'Criteria', 'u2 > Threshold', 'Threshold', '0.5');
    b([p '/V'], 'simulink/Sinks/Out1', ${q('V')});
    l(p, 'Ctl/1', 'Round/1'); l(p, 'Ctl/1', 'Ideal_in/1');
${pdf ? `    l(p, 'Round/1', 'Gain/1'); l(p, 'Gain/1', 'Saturation/1'); l(p, 'Saturation/1', 'Switch/1');` : `    l(p, 'Round/1', 'Saturation/1'); l(p, 'Saturation/1', 'Gain/1'); l(p, 'Gain/1', 'Switch/1');`}
    l(p, 'real_model/1', 'Switch/2'); l(p, 'Ideal_in/1', 'Switch/3'); l(p, 'Switch/1', 'V/1');
end
function make_real_out(p, pos)
    sub(p, pos);
    b([p '/In'], 'simulink/Sources/In1', ${o('In')});
    b([p '/Round'], 'simulink/Math Operations/Rounding Function', ${o('Round')}, 'Operator', 'round');
    b([p '/real_model'], 'simulink/Sources/Constant', ${o('real_model')}, 'Value', 'real_model');
    b([p '/Switch'], 'simulink/Signal Routing/Switch', ${o('Switch')}, 'Criteria', 'u2 > Threshold', 'Threshold', '0.5');
    b([p '/Data'], 'simulink/Sinks/Out1', ${o('Data')});
    l(p, 'In/1', 'Round/1'); l(p, 'Round/1', 'Switch/1'); l(p, 'real_model/1', 'Switch/2'); l(p, 'In/1', 'Switch/3'); l(p, 'Switch/1', 'Data/1');
end
`;
  }
  function fcnBlock(P) {
    return `
function make_fcn(p, pos, Rw, Ww)
    % блок MATLAB Function: показания энкодеров и гироскопа (формула 37)
    code = sprintf(['function [enc_l, enc_r, gyro] = fcn(y)\\n' ...
        'R = %.10g; W = %.10g;\\n' ...
        'enc_l = (y(1) - W/R/2*y(5) - y(2))*180/pi;\\n' ...
        'enc_r = (y(1) + W/R/2*y(5) - y(2))*180/pi;\\n' ...
        'gyro = y(4)*180/pi;\\n'], Rw, Ww);
    try
        add_block('simulink/User-Defined Functions/MATLAB Function', p, 'Position', pos);
        ch = find(sfroot, '-isa', 'Stateflow.EMChart', 'Path', p);
        ch.Script = code;
    catch
        % запасной вариант без Stateflow API: то же преобразование матричным усилителем
        if getSimulinkBlockHandle(p) > 0, delete_block(p); end
        sub(p, pos);
        k = Ww/(2*Rw); C = 180/pi*[1 -1 0 0 -k 0; 1 -1 0 0 k 0; 0 0 0 1 0 0];
        b([p '/y'], 'simulink/Sources/In1', [20 58 50 72]);
        b([p '/Cenc'], 'simulink/Math Operations/Gain', [90 50 170 80], 'Gain', mat2str(C, 10), 'Multiplication', 'Matrix(K*u)');
        b([p '/Demux'], 'simulink/Signal Routing/Demux', [200 30 205 100], 'Outputs', '3');
        b([p '/enc_l'], 'simulink/Sinks/Out1', [250 33 280 47]);
        b([p '/enc_r'], 'simulink/Sinks/Out1', [250 58 280 72]);
        b([p '/gyro'], 'simulink/Sinks/Out1', [250 83 280 97]);
        l(p, 'y/1', 'Cenc/1'); l(p, 'Cenc/1', 'Demux/1');
        l(p, 'Demux/1', 'enc_l/1'); l(p, 'Demux/2', 'enc_r/1'); l(p, 'Demux/3', 'gyro/1');
    end
end
`;
  }
  /* подсистема Plant (рис. 27/38) */
  function plantCode(R, x0, pos) {
    const q = posOf(DGM().plant(R, x0));
    return `
%% Подсистема Plant: Real_in → State-Space → датчики → Real_out
p = [mdl '/Plant'];
sub(p, ${pos});
b([p '/Ctl'], 'simulink/Sources/In1', ${q('Ctl')});
make_real_in([p '/Real_in'], ${q('Real_in')});
b([p '/State-Space'], 'simulink/Continuous/State-Space', ${q('State-Space')}, 'A', 'A1', 'B', 'B1', 'C', 'C1', 'D', 'D1', 'InitialCondition', '${x0}');
b([p '/State-Space1'], 'simulink/Continuous/State-Space', ${q('State-Space1')}, 'A', 'A2', 'B', 'B2', 'C', 'C2', 'D', 'D2', 'InitialCondition', '[0 0]');
b([p '/Mux_y'], 'simulink/Signal Routing/Mux', ${q('Mux_y')}, 'Inputs', '2');
make_fcn([p '/fcn'], ${q('fcn')}, R, W);
b([p '/Mux_data'], 'simulink/Signal Routing/Mux', ${q('Mux_data')}, 'Inputs', '3');
make_real_out([p '/Real_out'], ${q('Real_out')});
b([p '/Data'], 'simulink/Sinks/Out1', ${q('Data')});
b([p '/y_out'], 'simulink/Sinks/To Workspace', ${q('y_out')}, 'VariableName', 'y_ws', 'SaveFormat', 'Structure With Time', 'MaxDataPoints', 'inf');
b([p '/data_out'], 'simulink/Sinks/To Workspace', ${q('data_out')}, 'VariableName', 'data_ws', 'SaveFormat', 'Structure With Time', 'MaxDataPoints', 'inf');
b([p '/v_out'], 'simulink/Sinks/To Workspace', ${q('v_out')}, 'VariableName', 'v_ws', 'SaveFormat', 'Structure With Time', 'MaxDataPoints', 'inf');
l(p, 'Ctl/1', 'Real_in/1');
l(p, 'Real_in/1', 'State-Space/1'); l(p, 'Real_in/1', 'State-Space1/1'); l(p, 'Real_in/1', 'v_out/1');
l(p, 'State-Space/1', 'Mux_y/1'); l(p, 'State-Space1/1', 'Mux_y/2');
l(p, 'Mux_y/1', 'fcn/1'); l(p, 'Mux_y/1', 'y_out/1');
l(p, 'fcn/1', 'Mux_data/1'); l(p, 'fcn/2', 'Mux_data/2'); l(p, 'fcn/3', 'Mux_data/3');
l(p, 'Mux_data/1', 'Real_out/1'); l(p, 'Real_out/1', 'Data/1'); l(p, 'Real_out/1', 'data_out/1');
`;
  }
  const newModel = name => `mdl = '${name}';
if bdIsLoaded(mdl), close_system(mdl, 0); end
if exist([mdl '.slx'], 'file'), delete([mdl '.slx']); end
new_system(mdl); open_system(mdl);
`;
  const plotStyle = `set(groot, 'defaultAxesXGrid', 'on', 'defaultAxesYGrid', 'on', 'defaultLineLineWidth', 1.2);
`;

  /* ---------- этап 2: модель рис. 19 ---------- */
  /* signs: какие расчёты выполнить — [1] (рис. 2.1), [-1] (рис. 2.2) или [1, -1] (весь этап) */
  function modelSS(R, signs) {
    const P = R.P, q = posOf(DGM().ss(R));
    signs = signs || [1, -1];
    const runs = signs.map(g => g > 0
      ? '%   g > 0 — робот стоит без регулятора (неустойчив, графики уходят в бесконечность) — рис. 2.1 на сайте;'
      : '%   g < 0 — робот «подвешен» за колёса (маятник с затуханием) — рис. 2.2 на сайте;').join('\n');
    return header('Этап 2. Модель робота-балансира в пространстве состояний (рис. 19)', R) + `% Нужны файлы parametrs_Rob.m и Rob_SM.m в той же папке.
% Скрипт строит модель Rob_ss.slx и моделирует её${signs.length > 1 ? ' дважды' : ''}:
${runs}
g_sign = 1; Rob_SM;
${saveFlag}Uopen = ${m(P.Uopen)};      % напряжение на двигателях, В (блок Constant)

${newModel('Rob_ss')}b([mdl '/Constant'], 'simulink/Sources/Constant', ${q('Constant')}, 'Value', 'Uopen');
b([mdl '/Mux'], 'simulink/Signal Routing/Mux', ${q('Mux')}, 'Inputs', '2');
b([mdl '/State-Space'], 'simulink/Continuous/State-Space', ${q('State-Space')}, 'A', 'A1', 'B', 'B1', 'C', 'C1', 'D', 'D1');
b([mdl '/State-Space1'], 'simulink/Continuous/State-Space', ${q('State-Space1')}, 'A', 'A2', 'B', 'B2', 'C', 'C2', 'D', 'D2');
b([mdl '/Demux'], 'simulink/Signal Routing/Demux', ${q('Demux')}, 'Outputs', '4');
b([mdl '/Demux1'], 'simulink/Signal Routing/Demux', ${q('Demux1')}, 'Outputs', '2');
b([mdl '/Scope'], 'simulink/Sinks/Scope', ${q('Scope')}, 'NumInputPorts', '4');
b([mdl '/Scope1'], 'simulink/Sinks/Scope', ${q('Scope1')}, 'NumInputPorts', '2');
b([mdl '/x1_out'], 'simulink/Sinks/To Workspace', ${q('x1_out')}, 'VariableName', 'x1_ws', 'SaveFormat', 'Structure With Time', 'MaxDataPoints', 'inf');
b([mdl '/x2_out'], 'simulink/Sinks/To Workspace', ${q('x2_out')}, 'VariableName', 'x2_ws', 'SaveFormat', 'Structure With Time', 'MaxDataPoints', 'inf');
l(mdl, 'Constant/1', 'Mux/1'); l(mdl, 'Constant/1', 'Mux/2');
l(mdl, 'Mux/1', 'State-Space/1'); l(mdl, 'Mux/1', 'State-Space1/1');
l(mdl, 'State-Space/1', 'Demux/1'); l(mdl, 'State-Space1/1', 'Demux1/1');
for k = 1:4, l(mdl, sprintf('Demux/%d', k), sprintf('Scope/%d', k)); end
for k = 1:2, l(mdl, sprintf('Demux1/%d', k), sprintf('Scope1/%d', k)); end
l(mdl, 'State-Space/1', 'x1_out/1'); l(mdl, 'State-Space1/1', 'x2_out/1');
set_param(mdl, 'InitFcn', 'Rob_SM', 'Solver', 'ode45', 'RelTol', '1e-6');
save_system(mdl);

${plotStyle}names = {'\\theta, рад', '\\psi, рад', 'd\\theta/dt, рад/с', 'd\\psi/dt, рад/с'};
fig_names = {'Рис. 2.1. Реакция модели при g > 0', 'Рис. 2.2. «Подвешенный» робот, g < 0'};
for g_sign = [${signs.join(' ')}]
    Rob_SM;
    T = ${m(Math.min(P.Tsim, Math.max(0.3, 8 / Math.max(R.lamU, 1e-3))))}; if g_sign < 0, T = ${m(P.Tsim)}; end
    set_param(mdl, 'StopTime', num2str(T));
    out = sim(mdl);
    x1 = out.get('x1_ws'); t = x1.time; X = x1.signals.values;
    % раскладка как на сайте: theta, psi / theta_dot, psi_dot
    fh = figure('Name', fig_names{1 + (g_sign < 0)}, 'NumberTitle', 'off', 'Position', [100 100 900 520]);
    for k = 1:4
        subplot(2, 2, k); plot(t, X(:, k)); ylabel(names{k});
        if k > 2, xlabel('t, c'); end
    end
    if save_figs, png_names = {'Ris_2_1_g_plus', 'Ris_2_2_g_minus'}; save_png(fh, png_names{1 + (g_sign < 0)}); end
    fprintf('g = %6.2f: собственные значения A1 = %s\\n', g, mat2str(eig(A1).', 5));
    if g_sign < 0
        fprintf('Установившаяся скорость theta'' = %.4g рад/с (расчёт: ${m(+R.thdSS.toPrecision(5))})\\n', X(end, 3));
    end
end
g_sign = 1;
` + helpers;
  }

  /* ---------- этап 3: системная модель ---------- */
  /* models: [0] — только идеальная модель; [0, 1] — идеальная и реальная (весь этап, рис. 3.1–3.2) */
  function modelSys(R, models) {
    const P = R.P, q = posOf(DGM().sys(R));
    models = models || [0, 1];
    return header('Этап 3. Системная модель робота (рис. 29, 38)', R) + `% Нужны parametrs_Rob.m, Rob_SM.m, config.m, preload.m в той же папке.
% Скрипт строит модель Rob_sys.slx: Controller (пока передаёт задание U на выход Ctl)
% и Plant (Real_in → State-Space → MATLAB Function → Real_out).
% Моделирование: ${models.length > 1 ? 'идеальная и реальная модели на одних графиках (рис. 3.1–3.2 на сайте)' : 'только идеальная модель (кривые «идеальная» на рис. 3.1–3.2 сайта)'}.
% Вариантные подсистемы методички заменены переключателем Switch по переменной real_model,
% шины Ctl и Data — мультиплексорами (для ручной сборки по методичке используйте preload.m).
g_sign = -1;          % проверка: робот «подвешен» за колёса
Rob_SM; preload; config;
${saveFlag}U0 = ${m(P.Uopen)};            % задание ШИМ (блок Constant)

${newModel('Rob_sys')}b([mdl '/Constant'], 'simulink/Sources/Constant', ${q('Constant')}, 'Value', 'U0');
b([mdl '/Mux'], 'simulink/Signal Routing/Mux', ${q('Mux')}, 'Inputs', '2');
% Controller: вход U (задание) и Data (датчики), выход Ctl
c = [mdl '/Controller'];
sub(c, ${q('Controller')});
b([c '/U'], 'simulink/Sources/In1', [20 48 50 62]);
b([c '/Data'], 'simulink/Sources/In1', [20 118 50 132]);
b([c '/Terminator'], 'simulink/Sinks/Terminator', [100 115 120 135]);
b([c '/Ctl'], 'simulink/Sinks/Out1', [200 48 230 62]);
l(c, 'U/1', 'Ctl/1'); l(c, 'Data/1', 'Terminator/1');
` + plantCode(R, '[0 0 0 0]', q('Plant')) + `
l(mdl, 'Constant/1', 'Mux/1'); l(mdl, 'Constant/1', 'Mux/2');
l(mdl, 'Mux/1', 'Controller/1'); l(mdl, 'Controller/1', 'Plant/1'); l(mdl, 'Plant/1', 'Controller/2');
set_param(mdl, 'PreLoadFcn', sprintf('preload\\nconfig'), 'InitFcn', 'Rob_SM');
set_param(mdl, 'Solver', 'ode4', 'FixedStep', '${m(R.dt)}', 'StopTime', '${m(P.Tsim)}');
save_system(mdl);

${plotStyle}models = [${models.join(' ')}];   % 0 — идеальная модель, 1 — с квантованием ШИМ и датчиков
res = struct('t', {}, 'Y', {});
for k = 1:numel(models)
    real_model = models(k);
    out = sim(mdl);
    d = out.get('data_ws'); t = d.time; Y = squeeze(d.signals.values);
    if size(Y, 1) == 3 && size(Y, 2) ~= 3, Y = Y.'; end
    res(k).t = t; res(k).Y = Y;
end
% графики как на сайте: идеальная — сплошная, реальная — ступенчатая пунктирная
leg = {'идеальная', 'реальная'}; leg = leg(models + 1);
ylab = {'enc_l, град', 'enc_r, град', 'gyro, град/с'};
sfx = ''; if numel(models) == 1, sfx = '_ideal'; end
fh = figure('Name', 'Рис. 3.1. Показания энкодеров enc_l, enc_r', 'NumberTitle', 'off', 'Position', [100 100 900 360]);
for j = 1:2
    subplot(1, 2, j); hold on;
    for k = 1:numel(models)
        if models(k) == 0, plot(res(k).t, res(k).Y(:, j)); else, stairs(res(k).t, res(k).Y(:, j), ':'); end
    end
    hold off; box on; ylabel(ylab{j}, 'Interpreter', 'none'); xlabel('t, c'); legend(leg, 'Location', 'best');
end
if save_figs, save_png(fh, ['Ris_3_1_enc' sfx]); end
fh = figure('Name', 'Рис. 3.2. Показания гироскопа', 'NumberTitle', 'off', 'Position', [100 100 900 400]); hold on;
for k = 1:numel(models)
    if models(k) == 0, plot(res(k).t, res(k).Y(:, 3)); else, stairs(res(k).t, res(k).Y(:, 3)); end
end
hold off; box on; ylabel(ylab{3}); xlabel('t, c'); legend(leg, 'Location', 'best');
if save_figs, save_png(fh, ['Ris_3_2_gyro' sfx]); end
real_model = 0; g_sign = 1;
` + helpers + realIn(R) + fcnBlock(P);
  }

  /* ---------- этап 4: модель с LQR ---------- */
  /* mode не задан — универсальный скрипт (lqr_mode можно задать заранее, по умолчанию 3);
   * 1/2/3 — режим зашит, как на соответствующем шаге методички */
  function modelLQR(R, mode) {
    const P = R.P, q = posOf(DGM().sysLqr(R)), c = posOf(DGM().control(R));
    const g3 = DGM().getStates(R, 3), gs = [1, 2, 3].map(k => posOf(DGM().getStates(R, k), g3)), g = gs[2];
    const pre = mode
      ? `clear; clc; close all;
% Нужны parametrs_Rob.m, Rob_SM.m, config.m, preload.m, control.m в той же папке.
lqr_mode = ${mode};   % 1 — регулятор по s1; 2 — с интегратором (s3); 3 — с управлением движением (s4)
% real_model (config.m): 0 — идеальные датчики, 1 — квантование ШИМ и датчиков.`
      : `clearvars -except lqr_mode; clc; close all;
% Нужны parametrs_Rob.m, Rob_SM.m, config.m, preload.m, control.m в той же папке.
% lqr_mode: 1 — регулятор по s1; 2 — с интегратором (s3); 3 — с управлением движением (s4).
% real_model (config.m): 0 — идеальные датчики, 1 — квантование ШИМ и датчиков.
if ~exist('lqr_mode', 'var'), lqr_mode = 3; end`;
    return header('Этап 4. Модель робота с LQR-регулятором (рис. 45, 52)', R, true) + pre + `
g_sign = 1;
Rob_SM; preload; config; control;
${saveFlag}vref = ${m(P.vref)};   % заданная скорость θ', рад/с
wref = ${m(P.wref)};   % заданная скорость поворота φ', рад/с
nx = size(Klqr, 2);

${newModel('Rob_lqr')}% Задающий вектор (рис. 51)
if lqr_mode == 3
    b([mdl '/v'], 'simulink/Sources/Constant', ${q('v')}, 'Value', 'vref');
    b([mdl '/w'], 'simulink/Sources/Constant', ${q('w')}, 'Value', 'wref');
    b([mdl '/zero'], 'simulink/Sources/Constant', ${q('zero')}, 'Value', '0');
    b([mdl '/Integrator'], 'simulink/Continuous/Integrator', ${q('Integrator')});
    b([mdl '/Integrator1'], 'simulink/Continuous/Integrator', ${q('Integrator1')});
    b([mdl '/Integrator2'], 'simulink/Continuous/Integrator', ${q('Integrator2')});
    b([mdl '/ref'], 'simulink/Signal Routing/Mux', ${q('ref')}, 'Inputs', '7');
    l(mdl, 'v/1', 'Integrator/1'); l(mdl, 'Integrator/1', 'Integrator1/1'); l(mdl, 'w/1', 'Integrator2/1');
    l(mdl, 'Integrator1/1', 'ref/1'); l(mdl, 'Integrator/1', 'ref/2'); l(mdl, 'zero/1', 'ref/3');
    l(mdl, 'v/1', 'ref/4'); l(mdl, 'zero/1', 'ref/5'); l(mdl, 'Integrator2/1', 'ref/6'); l(mdl, 'w/1', 'ref/7');
else
    b([mdl '/ref'], 'simulink/Sources/Constant', ${q('zero').replace(/\[(\d+) (\d+) (\d+) (\d+)\]/, (_, a, b, c2, d) => '[' + a + ' ' + b + ' ' + (+c2 + 50) + ' ' + d + ']')}, 'Value', sprintf('zeros(%d,1)', nx));
end

%% Подсистема Controller: get_states → (ref − X) → Klqr → K_PWM
c = [mdl '/Controller'];
sub(c, ${q('Controller')});
b([c '/U'], 'simulink/Sources/In1', ${c('U')});
b([c '/Data'], 'simulink/Sources/In1', ${c('Data')});
make_get_states([c '/get_states'], ${c('get_states')}, lqr_mode);
b([c '/Sum'], 'simulink/Math Operations/Sum', ${c('Sum')}, 'IconShape', 'round', 'Inputs', '|+-');
b([c '/K'], 'simulink/Math Operations/Gain', ${c('K')}, 'Gain', 'Klqr', 'Multiplication', 'Matrix(K*u)');
b([c '/K_PWM'], 'simulink/Math Operations/Gain', ${c('K_PWM')}, 'Gain', 'K_PWM');
b([c '/Ctl'], 'simulink/Sinks/Out1', ${c('Ctl')});
b([c '/x_out'], 'simulink/Sinks/To Workspace', ${c('x_out')}, 'VariableName', 'xest_ws', 'SaveFormat', 'Structure With Time', 'MaxDataPoints', 'inf');
l(c, 'U/1', 'Sum/1'); l(c, 'Data/1', 'get_states/1'); l(c, 'get_states/1', 'Sum/2'); l(c, 'get_states/1', 'x_out/1');
l(c, 'Sum/1', 'K/1'); l(c, 'K/1', 'K_PWM/1'); l(c, 'K_PWM/1', 'Ctl/1');
` + plantCode(R, '[0 Psi0 0 0]', q('Plant')) + `
l(mdl, 'ref/1', 'Controller/1'); l(mdl, 'Controller/1', 'Plant/1'); l(mdl, 'Plant/1', 'Controller/2');
set_param(mdl, 'PreLoadFcn', sprintf('preload\\nconfig'), 'InitFcn', sprintf('Rob_SM\\ncontrol'));
set_param(mdl, 'Solver', 'ode4', 'FixedStep', '${m(R.dt)}', 'StopTime', '${m(P.Tsim)}');
save_system(mdl);

out = sim(mdl);
y = out.get('y_ws'); t = y.time; Y = y.signals.values;
${plotStyle}names = {'\\theta, рад', '\\psi, рад', 'd\\theta/dt, рад/с', 'd\\psi/dt, рад/с', '\\phi, рад', 'd\\phi/dt, рад/с'};
order = [1 3 5 2 4 6];   % как на осциллографе методички: theta, theta_dot, phi / psi, psi_dot, phi_dot
fig_names = {'Рис. 4.1. Регулятор по модели s1', 'Рис. 4.2. Регулятор с интегратором', ...
    'Рис. 4.3. Управление движением: идеальные датчики', 'Рис. 4.4. Управление движением: неидеальные датчики'};
fig_no = lqr_mode + (lqr_mode == 3 && real_model == 1);
fh = figure('Name', sprintf('%s (lqr_mode = %d, real_model = %d)', fig_names{fig_no}, lqr_mode, real_model), 'NumberTitle', 'off', 'Position', [100 100 1000 560]);
for k = 1:6
    subplot(2, 3, k); plot(t, Y(:, order(k))); ylabel(names{order(k)});
    if k > 3, xlabel('t, c'); end
end
if save_figs, save_png(fh, sprintf('Ris_4_%d_lqr%d_real%d', fig_no, lqr_mode, real_model)); end
fprintf('Klqr = %s\\n', mat2str(Klqr, 5));
fprintf('psi(конец) = %.3g рад, theta''(конец) = %.4g рад/с, phi''(конец) = %.4g рад/с\\n', Y(end, 2), Y(end, 3), Y(end, 6));
` + helpers + realIn(R) + fcnBlock(P) + `
function make_get_states(p, pos, mode)
    % оценка вектора состояния по энкодерам и гироскопу (рис. 40, 49, 52);
    % шины методички: Bus Selector → Demux, Bus Creator States + Bus to Vector → Mux States
    sub(p, pos);
    b([p '/Data'], 'simulink/Sources/In1', ${g('Data')});
    b([p '/Demux'], 'simulink/Signal Routing/Demux', ${g('Demux')}, 'Outputs', '[2 1]');
    b([p '/D2R'], 'simulink/Math Operations/Gain', ${g('D2R')}, 'Gain', 'pi/180');
    b([p '/Sum of Elements'], 'simulink/Math Operations/Sum of Elements', ${g('Sum of Elements')});
    b([p '/Gain'], 'simulink/Math Operations/Gain', ${g('Gain')}, 'Gain', '1/2');
    b([p '/Add'], 'simulink/Math Operations/Add', ${g('Add')}, 'Inputs', '++');
    b([p '/D2R1'], 'simulink/Math Operations/Gain', ${g('D2R1')}, 'Gain', 'pi/180');
    b([p '/Integrator'], 'simulink/Continuous/Integrator', ${g('Integrator')});
    b([p '/Derivative'], 'simulink/Continuous/Derivative', ${g('Derivative')});
    l(p, 'Data/1', 'Demux/1');
    l(p, 'Demux/1', 'D2R/1'); l(p, 'D2R/1', 'Sum of Elements/1'); l(p, 'Sum of Elements/1', 'Gain/1');
    l(p, 'Demux/2', 'D2R1/1'); l(p, 'D2R1/1', 'Integrator/1');
    l(p, 'Gain/1', 'Add/1'); l(p, 'Integrator/1', 'Add/2'); l(p, 'Add/1', 'Derivative/1');
    n = 4 + (mode >= 2) + 2*(mode == 3);
    pos_states = {${gs.map(x => `'${x('States')}'`).join(', ')}};
    pos_x = {${gs.map(x => `'${x('X')}'`).join(', ')}};
    b([p '/States'], 'simulink/Signal Routing/Mux', str2num(pos_states{mode}), 'Inputs', num2str(n));
    k = 1;
    if mode >= 2
        b([p '/Integrator1'], 'simulink/Continuous/Integrator', ${g('Integrator1')});
        l(p, 'Add/1', 'Integrator1/1'); l(p, 'Integrator1/1', 'States/1'); k = 2;
    end
    l(p, 'Add/1', sprintf('States/%d', k));            % theta
    l(p, 'Integrator/1', sprintf('States/%d', k + 1)); % psi
    l(p, 'Derivative/1', sprintf('States/%d', k + 2)); % theta_dot
    l(p, 'D2R1/1', sprintf('States/%d', k + 3));       % psi_dot
    if mode == 3
        b([p '/Demux1'], 'simulink/Signal Routing/Demux', ${g('Demux1')}, 'Outputs', '2');
        b([p '/Sum'], 'simulink/Math Operations/Add', ${g('Sum')}, 'Inputs', '-+');
        b([p '/R_W'], 'simulink/Math Operations/Gain', ${g('R_W')}, 'Gain', 'R/W');
        b([p '/Derivative1'], 'simulink/Continuous/Derivative', ${g('Derivative1')});
        l(p, 'D2R/1', 'Demux1/1'); l(p, 'Demux1/1', 'Sum/1'); l(p, 'Demux1/2', 'Sum/2'); l(p, 'Sum/1', 'R_W/1');
        l(p, 'R_W/1', 'Derivative1/1'); l(p, 'R_W/1', 'States/6'); l(p, 'Derivative1/1', 'States/7');
    end
    b([p '/X'], 'simulink/Sinks/Out1', str2num(pos_x{mode}));
    l(p, 'States/1', 'X/1');
end
`;
  }

  /* ---------- проверка LQR без Simulink ---------- */
  function lqrCheck(R) {
    const P = R.P;
    return header('Этап 4. Проверка LQR-регуляторов без Simulink (обратная связь по полному вектору состояния)', R) + `% Нужны parametrs_Rob.m и Rob_SM.m в той же папке.
g_sign = 1; Rob_SM;
${saveFlag}T = 0:${m(R.dt)}:${m(P.Tsim)};
K1 = lqr(s1, ${P.qw !== 1 ? m(P.qw) + '*' : ''}eye(4), ${P.rw !== 1 ? m(P.rw) + '*' : ''}eye(2));
K3 = lqr(s3, ${P.qw !== 1 ? m(P.qw) + '*' : ''}eye(5), ${P.rw !== 1 ? m(P.rw) + '*' : ''}eye(2));
K4 = lqr(s4, ${P.qw !== 1 ? m(P.qw) + '*' : ''}eye(7), ${P.rw !== 1 ? m(P.rw) + '*' : ''}eye(2));
disp('K1 ='); disp(K1); disp('K3 ='); disp(K3); disp('K4 ='); disp(K4);
fprintf('Полюса A1-B1*K1: %s\\n', mat2str(eig(s1.A - s1.B*K1).', 5));
fprintf('Полюса A4-B4*K4: %s\\n', mat2str(eig(s4.A - s4.B*K4).', 5));

${plotStyle}% 1) начальный наклон Psi0, регулятор по s1
c1 = ss(s1.A - s1.B*K1, zeros(4, 1), eye(4), 0);
[y1, t1] = initial(c1, [0 Psi0 0 0], T(end));
% 2) с интегратором
c3 = ss(s3.A - s3.B*K3, zeros(5, 1), eye(5), 0);
[y3, t3] = initial(c3, [0 0 Psi0 0 0], T(end));
% 3) управление движением: x' = A4 x + B4 K4 (r - x)
r = [${m(P.vref)}*T.^2/2; ${m(P.vref)}*T; zeros(size(T)); ${m(P.vref)}*ones(size(T)); zeros(size(T)); ${m(P.wref)}*T; ${m(P.wref)}*ones(size(T))];
c4 = ss(s4.A - s4.B*K4, s4.B*K4, eye(7), 0);
y4 = lsim(c4, r.', T, [0 0 Psi0 0 0 0 0]);
fh = figure('Name', 'Этап 4: проверка без Simulink', 'NumberTitle', 'off', 'Position', [100 100 900 700]);
subplot(3, 1, 1); plot(t1, y1(:, 2), t3, y3(:, 3), '--'); ylabel('\\psi, рад'); legend('s1', 's3'); title('Начальный наклон Psi0');
subplot(3, 1, 2); plot(T, y4(:, 4), T, y4(:, 7), '--'); ylabel('рад/с'); legend('d\\theta/dt', 'd\\phi/dt'); title('Управление движением');
subplot(3, 1, 3); plot(T, y4(:, 3)); ylabel('\\psi, рад'); xlabel('t, c');
if save_figs, save_png(fh, 'Ris_4_check_bez_Simulink'); end
` + savePngFn;
  }

  /* ---------- README ---------- */
  function readme(R) {
    const P = R.P;
    return `РОБОТ-БАЛАНСИР: ЛАБОРАТОРНАЯ РАБОТА. ${P.variant ? 'ВАРИАНТ ' + P.variant : 'ПРИМЕР ИЗ МЕТОДИЧКИ'}
=====================================================
Дисциплина «Конструирование роботов и робототехнических систем».

Порядок работы в MATLAB R2022:
 1. Распакуйте архив и в MATLAB перейдите в папку нужного этапа
    (Current Folder). В каждой папке лежит полный набор скриптов этапа —
    так, как они получаются по ходу методички.
 2. parametrs_Rob.m — исходные данные варианта (как в методичке).
    Переменная g_sign: 1 — робот стоит; -1 — «подвешен» за колёса
    (вместо ручной правки знака перед 9,81).
 3. Rob_SM.m — модель в пространстве состояний (s1, s2; на этапе 4 —
    также s0, s3, s4). Запуск: Rob_SM, затем s1, s2 в Command Window.
 4. Rob_model_*.m — автоматически строят модель Simulink (.slx
    сохраняется рядом), запускают моделирование и строят графики.
    Готовую модель можно открыть и дорабатывать вручную.
 5. config.m — real_model = 0 (идеальная модель) или 1 (квантование
    ШИМ и датчиков); preload.m — шины Ctl и Data (bus_data.mat).
 6. control.m — синтез LQR (lqr_mode = 1, 2, 3).
 7. Рисунки сохраняются автоматически в PNG (200 dpi) в папку figures
    рядом со скриптами: Ris_2_2_g_minus.png и т. п. — номер как на сайте.
    Отключить: в начале скрипта Rob_model_*.m поставить save_figs = false.

Состав:
  Etap1_Model/rob_raschet.m        параметры модели, матрицы E, F, G, H, I, J, K
  Etap2_StateSpace/                parametrs_Rob, Rob_SM, Rob_model_ss (рис. 19–20)
  Etap3_SystemModel/               + config, preload, Rob_model_sys (рис. 29–39)
  Etap4_LQR/                       + control, Rob_model_lqr (рис. 45–52),
                                   Rob_lqr_check (проверка без Simulink)
  Po_shagam/                       те же файлы по шагам работы: в каждой папке —
                                   полный набор на этот момент и README.txt
                                   (что запустить и какой рисунок сайта получится)
  Otchet_Robot_*.docx              отчёт Word (ГОСТ 7.32/2.105)
  Report/                          полный расчёт (HTML), графики PNG, данные CSV

Особенности автоматически построенных моделей:
 * Вариантные подсистемы Real_in/Real_out заменены переключателем Switch
   по переменной real_model, шины — мультиплексорами Mux/Demux.
   Порядок сигналов: Ctl = [PWM_l; PWM_r], Data = [enc_l; enc_r; gyro].
 * Блок MATLAB Function создаётся через Stateflow API; если это
   невозможно, вместо него ставится подсистема с матричным Gain
   (то же преобразование, формула 37).
 * Решатель ode4 с фиксированным шагом ${m(R.dt)} с: в контуре есть блоки
   Derivative, шаг должен быть меньше 1/|p|max = ${m(+(1 / R.pmax).toPrecision(3))} с.
 * Real_in: ${P.satOrder === 'pwm' ? 'Round → Saturation (±PWM_max) → Gain 1/K_PWM' : 'Round → Gain 1/K_PWM → Saturation (±PWM_max), как в методичке'}.
`;
  }

  /* ---------- значения для блоков Simulink (подсказка на сайте) ---------- */
  function hints(R, tab) {
    const P = R.P, md = R.md, mx = A => mmat(A.map(r => r.map(v => +v.toPrecision(6)))), num = v => m(+v.toPrecision(8));
    const ss = (nm, A, B, C, Dd, x0, a, bb, c, d) => [[nm, 'A', a + ' = ' + mx(A)], [nm, 'B', bb + ' = ' + mx(B)], [nm, 'C', c + ' = ' + mx(C)], [nm, 'D', d + ' = ' + mx(Dd)], [nm, 'Initial conditions', x0]];
    const I4 = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]], Z42 = [[0, 0], [0, 0], [0, 0], [0, 0]], I2 = [[1, 0], [0, 1]], Z2 = [[0, 0], [0, 0]];
    if (tab === 'lr2') return [{ t: 'Rob_ss.slx — модель рис. 19', note: 'Значения матриц — при g > 0; для проверки маятником (g < 0) скрипт Rob_SM пересчитывает A1 автоматически.', rows: [
      ['Constant', 'Constant value', num(P.Uopen)], ['Mux', 'Number of inputs', '2'],
      ...ss('State-Space', md.A1, md.B1, I4, Z42, '0', 'A1', 'B1', 'C1', 'D1'),
      ...ss('State-Space1', md.A2, md.B2, I2, Z2, '0', 'A2', 'B2', 'C2', 'D2'),
      ['Demux', 'Number of outputs', '4'], ['Demux1', 'Number of outputs', '2'], ['Scope', 'Number of input ports', '4'], ['Scope1', 'Number of input ports', '2']] }];
    if (tab === 'lr3') return [{ t: 'Подсистема Real_in (рис. 22–25)', rows: [
      ['Round', 'Function', 'round'], ['Gain (1/K_PWM)', 'Gain', '1/K_PWM = ' + num(1 / R.KPWM)], ['Saturation', 'Upper / Lower limit', P.PWMmax + ' / −' + P.PWMmax],
      ['Variant Subsystem', 'Ideal_in', '(default)'], ['Variant Subsystem', 'Real_in', 'real_model==1'], ['config.m', 'real_model', '0']] },
    { t: 'Подсистема Plant (рис. 27, 38)', rows: [
      ...ss('State-Space', md.A1, md.B1, I4, Z42, '0', 'A1', 'B1', 'C1', 'D1').filter(r => r[1] !== 'C' && r[1] !== 'D'),
      ['MATLAB Function', 'Параметры (Model Explorer)', 'R = ' + num(P.R) + ', W = ' + num(P.W) + ' — Scope: Parameter'],
      ['Real_out', 'Function (Round)', 'round'], ['parametrs_Rob.m', 'K_PWM', num(R.KPWM)]] },
    { t: 'Шины и обратные вызовы (рис. 30–37)', rows: [
      ['Bus Ctl', 'PWM — Dimensions', '2'], ['Bus Data', 'enc — Dimensions', '2'], ['Bus Data', 'gyro — Dimensions', '1'],
      ['Model Properties', 'PreLoadFcn', 'preload\nconfig'], ['Model Properties', 'InitFcn', 'Rob_SM'], ['preload.m', 'команда', "load('bus_data.mat')"]] }];
    if (tab === 'lr4') {
      const k2 = P.R / P.W;
      return [{ t: 'Подсистема get_states (рис. 40, 49, 52)', rows: [
        ['D2R, D2R1 (Degrees to Radians)', 'энкодеры и гироскоп', 'pi/180 = ' + num(Math.PI / 180)], ['Sum of Elements', 'θml + θmr', '—'], ['Gain', '½ (среднее энкодеров)', '1/2'],
        ['Add', 'List of signs', '++ (θ = ½(θml + θmr) + ψ)'], ['Sum (s4)', 'List of signs', '−+ (θmr − θml)'], ['R_W (s4)', 'Gain', 'R/W = ' + num(k2)], ['Integrator', 'Initial condition', '0'], ['Bus Selector (s4)', 'порядок сигналов', 'theta_int, theta, psi, theta_dot, psi_dot, phi, phi_dot']] },
      { t: 'Подсистема Control (рис. 44–45)', rows: [
        ['Gain K (s1)', 'Gain, Matrix(K*u)', 'Klqr = ' + mx(R.lqr.s1.K)], ['Gain K (s3)', 'Gain, Matrix(K*u)', 'Klqr = ' + mx(R.lqr.s3.K)],
        ['Gain K (s4)', 'Gain, Matrix(K*u)', 'Klqr = ' + mx(R.lqr.s4.K)], ['Gain K_PWM', 'Gain', 'K_PWM = ' + num(R.KPWM)],
        ['Sum', 'List of signs', '|+- (Icon shape: round)'], ['State-Space (Plant)', 'Initial conditions', '[0 Psi0 0 0], Psi0 = ' + num(P.Psi0)],
        ['Model Properties', 'InitFcn', 'Rob_SM\ncontrol'], ['Configuration', 'Solver / Fixed step', 'ode4 / ' + num(R.dt)]] },
      { t: 'Задающий вектор (рис. 51)', rows: [
        ['Constant (θ̇)', 'Constant value', num(P.vref)], ['Constant (φ̇)', 'Constant value', num(P.wref)], ['Integrator, Integrator1', 'θ = v·t, θint = v·t²/2', 'Initial condition 0'],
        ['Integrator2', 'φ = w·t', 'Initial condition 0'], ['Mux', 'Number of inputs', '7']] }];
    }
    return [];
  }

  /* удаление комментариев из кода MATLAB: строки «% …», «%% …», блоки %{ … %}, хвосты после «...»;
   * текст в кавычках ('…', "…") не трогается, апостроф после имени/скобки — транспонирование, а не строка */
  function strip(src) {
    const out = [];
    let blk = 0;
    for (const line of String(src).split('\n')) {
      const t = line.trim();
      if (t === '%{') { blk++; continue; }
      if (blk) { if (t === '%}') blk--; continue; }
      let code = '', i = 0, cut = false;
      while (i < line.length) {
        const ch = line[i];
        if (ch === '%') { cut = true; break; }
        if (ch === '.' && line.startsWith('...', i)) { code += '...'; cut = true; break; }
        if (ch === '"' || (ch === "'" && !/[\w)\]}.'"]/.test(line[i - 1] || ''))) {
          let j = i + 1;
          while (j < line.length) { if (line[j] === ch) { if (line[j + 1] === ch) { j += 2; continue; } break; } j++; }
          code += line.slice(i, j + 1); i = j + 1; continue;
        }
        code += ch; i++;
      }
      code = code.replace(/\s+$/, '');
      if (cut && !code.trim()) continue;   // строка была только комментарием
      if (!code && (!out.length || out[out.length - 1] === '')) continue;   // без пустых строк подряд и в начале
      out.push(code);
    }
    while (out.length && out[out.length - 1] === '') out.pop();
    return out.join('\n') + (/\n$/.test(src) ? '\n' : '');
  }

  const api = { params, robSM, config, preload, control, raschet, modelSS, modelSys, modelLQR, lqrCheck, readme, hints, strip };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MATGEN = api;
})(typeof window !== 'undefined' ? window : globalThis);
