/* docx.js — минимальный генератор документов Word (.docx): абзацы, формулы OMML, таблицы, рисунки, колонтитул с номером страницы */
(function (root) {
  'use strict';
  const xe = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const NS = 'xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';

  function Doc(opt) {
    this.opt = Object.assign({ font: 'Times New Roman', size: 28, line: 360, indent: 709 }, opt || {});
    this.body = []; this.media = []; this.imgId = 0;
  }
  /* runs: строка, массив сегментов {t, b, i, sub, sup, font, size} или HTML (opts.html) */
  Doc.prototype.runs = function (segs, base) {
    base = base || {};
    if (typeof segs === 'string') segs = [{ t: segs }];
    return segs.map(s => {
      const o = Object.assign({}, base, s);
      if (o.br) return '<w:r><w:br/></w:r>';
      if (o.tab) return '<w:r><w:tab/></w:r>';
      let rpr = '';
      if (o.font) rpr += `<w:rFonts w:ascii="${o.font}" w:hAnsi="${o.font}" w:cs="${o.font}"/>`;
      if (o.b) rpr += '<w:b/><w:bCs/>';
      if (o.i) rpr += '<w:i/><w:iCs/>';
      if (o.color) rpr += `<w:color w:val="${o.color}"/>`;
      if (o.size) rpr += `<w:sz w:val="${o.size}"/><w:szCs w:val="${o.size}"/>`;
      if (o.sub) rpr += '<w:vertAlign w:val="subscript"/>';
      if (o.sup) rpr += '<w:vertAlign w:val="superscript"/>';
      return `<w:r>${rpr ? '<w:rPr>' + rpr + '</w:rPr>' : ''}<w:t xml:space="preserve">${xe(o.t)}</w:t></w:r>`;
    }).join('');
  };
  /* простой HTML (<b>, <i>, <sub>, <sup>, <br>) -> сегменты */
  Doc.prototype.htmlSegs = function (html) {
    const segs = [];
    html = String(html).replace(/·10\^(-?\d+)/g, (m, e) => '·10<sup>' + e.replace('-', '−') + '</sup>');
    const div = document.createElement('div'); div.innerHTML = html;
    const walk = (node, st) => {
      for (const n of node.childNodes) {
        if (n.nodeType === 3) { if (n.textContent) segs.push(Object.assign({ t: n.textContent }, st)); }
        else if (n.nodeType === 1) {
          const tg = n.tagName.toLowerCase();
          if (tg === 'br') { segs.push({ br: true }); continue; }
          const s2 = Object.assign({}, st);
          if (tg === 'b' || tg === 'strong') s2.b = true;
          if (tg === 'i' || tg === 'em') s2.i = true;
          if (tg === 'sub') s2.sub = true;
          if (tg === 'sup') s2.sup = true;
          walk(n, s2);
        }
      }
    };
    walk(div, {});
    // ГОСТ: обозначение величины (одиночная латинская буква) курсивом, если за ней следует индекс
    const out = [];
    for (let k = 0; k < segs.length; k++) {
      const sg = segs[k], nx = segs[k + 1];
      if (sg.t && !sg.sub && !sg.sup && nx && (nx.sub || nx.sup)) {
        const m = sg.t.match(/(^|[^A-Za-zА-Яа-яЁё])([A-Za-z])$/);
        if (m) { const head = sg.t.slice(0, sg.t.length - 1); if (head) out.push(Object.assign({}, sg, { t: head })); out.push(Object.assign({}, sg, { t: m[2], i: true })); continue; }
      }
      out.push(sg);
    }
    return out;
  };
  Doc.prototype.pPr = function (p) {
    p = p || {};
    let s = '';
    if (p.style) s += `<w:pStyle w:val="${p.style}"/>`;
    if (p.keepNext) s += '<w:keepNext/>';
    if (p.keepLines) s += '<w:keepLines/>';
    if (p.pageBreakBefore) s += '<w:pageBreakBefore/>';
    if (p.spacing) s += `<w:spacing${p.spacing.before !== undefined ? ` w:before="${p.spacing.before}"` : ''}${p.spacing.after !== undefined ? ` w:after="${p.spacing.after}"` : ''}${p.spacing.line !== undefined ? ` w:line="${p.spacing.line}" w:lineRule="auto"` : ''}/>`;
    if (p.indent !== undefined || p.left !== undefined) s += `<w:ind${p.left !== undefined ? ` w:left="${p.left}"` : ''}${p.indent !== undefined ? (p.indent >= 0 ? ` w:firstLine="${p.indent}"` : ` w:hanging="${-p.indent}"`) : ''}/>`;
    if (p.align) s += `<w:jc w:val="${p.align}"/>`;
    return s ? '<w:pPr>' + s + '</w:pPr>' : '';
  };
  Doc.prototype.p = function (content, p, base) {
    const inner = typeof content === 'string' || Array.isArray(content) ? this.runs(content, base) : (content.xml || '');
    this.body.push(`<w:p>${this.pPr(p)}${inner}</w:p>`); return this;
  };
  Doc.prototype.html = function (html, p, base) { return this.p(this.htmlSegs(html), p, base); };
  Doc.prototype.raw = function (xml) { this.body.push(xml); return this; };
  Doc.prototype.pageBreak = function () { this.body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>'); return this; };
  /* формула: omml = <m:oMath>…</m:oMath> */
  Doc.prototype.math = function (omml, p) {
    this.body.push(`<w:p>${this.pPr(Object.assign({ indent: 0, align: 'center', spacing: { before: 60, after: 60 } }, p || {}))}<m:oMathPara><m:oMathParaPr><m:jc m:val="center"/></m:oMathParaPr>${omml}</m:oMathPara></w:p>`); return this;
  };
  /* формула по центру с номером у правого края (ГОСТ 2.105): таблица без границ */
  Doc.prototype.mathNum = function (omml, num) {
    const nb = '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>';
    this.body.push(`<w:tbl><w:tblPr><w:tblW w:w="9354" w:type="dxa"/>${nb}<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="8454"/><w:gridCol w:w="900"/></w:tblGrid><w:tr><w:trPr><w:cantSplit/></w:trPr>` +
      `<w:tc><w:tcPr><w:tcW w:w="8454" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="60" w:after="60" w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/><w:jc w:val="center"/></w:pPr><m:oMathPara><m:oMathParaPr><m:jc m:val="center"/></m:oMathParaPr>${omml}</m:oMathPara></w:p></w:tc>` +
      `<w:tc><w:tcPr><w:tcW w:w="900" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/><w:jc w:val="right"/></w:pPr>${this.runs('(' + num + ')')}</w:p></w:tc></w:tr></w:tbl>`
      + '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="40" w:lineRule="exact"/><w:ind w:firstLine="0"/></w:pPr></w:p>');
    return this;
  };
  /* таблица: head — массив строк/HTML, rows — массив массивов */
  Doc.prototype.table = function (head, rows, opt) {
    opt = opt || {};
    const W = opt.width || 9354;                 // ширина текста, твипы
    const ncol = Math.max(head ? head.length : 0, ...rows.map(r => r.length));
    const cw = opt.cols || new Array(ncol).fill(Math.floor(W / ncol));
    const border = '<w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/></w:tblBorders>';
    let x = `<w:tbl><w:tblPr><w:tblW w:w="${cw.reduce((a, b) => a + b, 0)}" w:type="dxa"/><w:jc w:val="center"/>${border}<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${cw.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`;
    const cell = (c, k, hdr) => {
      const segs = (c && typeof c === 'object' && c.omml) ? null : this.htmlSegs(String(c === undefined || c === null ? '' : c));
      const content = segs ? this.runs(segs, { size: 24, b: hdr }) : '';
      const para = c && c.omml ? `<w:p><w:pPr><w:pStyle w:val="TableText"/></w:pPr>${c.omml}</w:p>` : `<w:p><w:pPr><w:pStyle w:val="TableText"/>${hdr ? '<w:jc w:val="center"/>' : ''}</w:pPr>${content}</w:p>`;
      return `<w:tc><w:tcPr><w:tcW w:w="${cw[k]}" w:type="dxa"/>${hdr ? '<w:shd w:val="clear" w:color="auto" w:fill="EDEFF2"/>' : ''}<w:vAlign w:val="center"/></w:tcPr>${para}</w:tc>`;
    };
    if (head) x += `<w:tr><w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>${head.map((c, k) => cell(c, k, true)).join('')}</w:tr>`;
    for (const r of rows) { const rr = r.slice(); while (rr.length < ncol) rr.push(''); x += `<w:tr><w:trPr><w:cantSplit/></w:trPr>${rr.map((c, k) => cell(c, k, false)).join('')}</w:tr>`; }
    x += '</w:tbl>';
    this.body.push(x);
    this.body.push('<w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:p>');
    return this;
  };
  /* рисунок: data — base64 (без префикса), type png|jpeg, ширина/высота в см */
  Doc.prototype.imageRun = function (data, type, wcm, hcm) {
    const id = ++this.imgId, rid = 'rIdImg' + id, name = `image${id}.${type === 'jpeg' ? 'jpeg' : 'png'}`;
    this.media.push({ rid, name, data });
    const cx = Math.round(wcm * 360000), cy = Math.round(hcm * 360000);
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${id}" name="Рисунок ${id}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  };
  Doc.prototype.image = function (data, type, wcm, hcm, p) {
    this.body.push(`<w:p>${this.pPr(Object.assign({ align: 'center', indent: 0, keepNext: true, spacing: { before: 240, after: 0, line: 240 } }, p || {}))}${this.imageRun(data, type, wcm, hcm)}</w:p>`); return this;
  };

  Doc.prototype.styles = function () {
    const o = this.opt;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${o.font}" w:eastAsia="${o.font}" w:hAnsi="${o.font}" w:cs="${o.font}"/><w:sz w:val="${o.size}"/><w:szCs w:val="${o.size}"/><w:lang w:val="ru-RU" w:eastAsia="en-US" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="${o.line}" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr>${o.readable ? '<w:keepLines/>' : ''}<w:widowControl/><w:spacing w:after="0" w:line="${o.line}" w:lineRule="auto"/><w:ind w:firstLine="${o.indent}"/><w:jc w:val="both"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:ind w:firstLine="0"/><w:jc w:val="center"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:bCs/><w:caps/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="80"/><w:jc w:val="left"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:bCs/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="160" w:after="60"/><w:jc w:val="left"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:bCs/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="caption"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="120" w:after="0" w:line="360" w:lineRule="auto"/><w:ind w:firstLine="0"/><w:jc w:val="center"/></w:pPr></w:style>
<w:style w:type="paragraph" w:customStyle="1" w:styleId="TableCaption"><w:name w:val="Table Caption"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="120" w:after="60" w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/><w:jc w:val="left"/></w:pPr></w:style>
<w:style w:type="paragraph" w:customStyle="1" w:styleId="TableText"><w:name w:val="Table Text"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/><w:jc w:val="left"/></w:pPr><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:customStyle="1" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/><w:jc w:val="left"/></w:pPr><w:rPr>${o.codePlain ? '<w:sz w:val="24"/><w:szCs w:val="24"/>' : '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/><w:sz w:val="20"/><w:szCs w:val="20"/>'}</w:rPr></w:style>
<w:style w:type="paragraph" w:customStyle="1" w:styleId="Note"><w:name w:val="Note"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="60" w:after="60" w:line="276" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>
<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
</w:styles>`;
  };
  Doc.prototype.build = async function (meta) {
    meta = meta || {};
    const zip = new JSZip();
    const hasJpeg = this.media.some(m => m.name.endsWith('.jpeg'));
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>${hasJpeg ? '<Default Extension="jpeg" ContentType="image/jpeg"/>' : ''}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);
    zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`);
    const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xe(meta.title || 'Отчёт')}</dc:title><dc:creator>${xe(meta.author || '')}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`);
    zip.file('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Office Word</Application></Properties>`);
    zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rIdFooter1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>${this.media.map(m => `<Relationship Id="${m.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${m.name}"/>`).join('')}</Relationships>`);
    zip.file('word/styles.xml', this.styles());
    zip.file('word/settings.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><w:defaultTabStop w:val="708"/><w:characterSpacingControl w:val="doNotCompress"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat><m:mathPr><m:mathFont m:val="Cambria Math"/><m:brkBin m:val="before"/><m:brkBinSub m:val="--"/><m:smallFrac m:val="0"/><m:dispDef/><m:lMargin m:val="0"/><m:rMargin m:val="0"/><m:defJc m:val="left"/><m:wrapIndent m:val="1440"/><m:intLim m:val="subSup"/><m:naryLim m:val="undOvr"/></m:mathPr></w:settings>`);
    zip.file('word/footer1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:ind w:firstLine="0"/><w:jc w:val="center"/></w:pPr><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>2</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`);
    for (const m of this.media) zip.file('word/media/' + m.name, m.data, { base64: true });
    const sect = `<w:sectPr><w:footerReference w:type="default" r:id="rIdFooter1"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="851" w:bottom="1134" w:left="1701" w:header="708" w:footer="708" w:gutter="0"/><w:cols w:space="708"/><w:titlePg/></w:sectPr>`;
    zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${NS}><w:body>${this.body.join('')}${sect}</w:body></w:document>`);
    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE' });
  };
  root.DOCX = { Doc };
})(typeof window !== 'undefined' ? window : globalThis);
