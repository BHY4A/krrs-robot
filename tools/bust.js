'use strict';
/* Сброс кеша браузера: у каждого своего файла ?v= — по содержимому (первые 10 знаков SHA-1).
   Изменился файл — изменилась ссылка, браузер берёт новый без Ctrl+F5.
   - index.html: js/…, css/… с ?v=;
   - js/theory.js: встроенные методички docs/….pdf;
   - js/suite.js: SVER (версия общего styles/styles.css хаба) — по styles.css хаба, если он рядом
     (хаб: styles/styles.css в своём каталоге; утилита: ../bhy4a.github.io/styles/styles.css).
   Запуск перед каждым коммитом: node tools/bust.js */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const hash = fp => crypto.createHash('sha1').update(fs.readFileSync(fp)).digest('hex').slice(0, 10);
function edit(rel, fn) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return 0;
  const src = fs.readFileSync(p, 'utf8'), r = fn(src);
  if (r.out !== src) fs.writeFileSync(p, r.out);
  return r.n;
}
function bust() {
  const res = {};
  // 1. версия стилей хаба в suite.js
  const sty = [path.join(ROOT, 'styles/styles.css'), path.join(ROOT, '../bhy4a.github.io/styles/styles.css')].find(f => fs.existsSync(f));
  res['js/suite.js'] = !sty ? 0 : edit('js/suite.js', src => {
    const h = hash(sty);
    let n = 0;
    const out = src.replace(/(SVER = ')([^']*)(')/, (m, a, v, b) => { if (v !== h) n++; return a + h + b; });
    return { out, n };
  });
  // 2. методички docs/*.pdf в theory.js
  res['js/theory.js'] = edit('js/theory.js', src => {
    let n = 0;
    const out = src.replace(/(['"])(docs\/[^'"?#]+\.pdf)(?:\?v=[^'"]*)?\1/g, (m, q, f) => {
      const fp = path.join(ROOT, f);
      if (!fs.existsSync(fp)) return m;
      const r = `${q}${f}?v=${hash(fp)}${q}`;
      if (r !== m) n++;
      return r;
    });
    return { out, n };
  });
  // 3. ссылки в index.html (после 1 и 2 — они меняют suite.js и theory.js)
  res['index.html'] = edit('index.html', src => {
    let n = 0;
    const out = src.replace(/((?:src|href)=")([^"?#]+\.(?:js|css))\?v=([^"]*)"/g, (m, a, f, v) => {
      const fp = path.join(ROOT, f);
      if (!fs.existsSync(fp)) return m;
      const h = hash(fp);
      if (h !== v) n++;
      return `${a}${f}?v=${h}"`;
    });
    return { out, n };
  });
  return res;
}
module.exports = { bust };
if (require.main === module) {
  const r = bust();
  console.log(Object.keys(r).map(k => `${k}: обновлено ссылок — ${r[k]}`).join('\n'));
}
