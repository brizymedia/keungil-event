// ebook.md → ebook.html → PDF (A5, 휴대폰·태블릿에서 읽기 좋은 크기)
//   npm install && npm run build
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { marked } from 'marked';
import { chromium } from 'playwright';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const raw = fs.readFileSync(path.join(DIR, 'ebook.md'), 'utf8');

const fm = {};
const body = raw.replace(/^---\n([\s\S]*?)\n---\n/, (_, block) => {
  for (const line of block.split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return '';
});

// 장(h1) 마다 id 를 붙여 목차를 만든다.
const chapters = [];
const renderer = new marked.Renderer();
renderer.heading = function ({ tokens, depth }) {
  const text = this.parser.parseInline(tokens);
  if (depth === 1) {
    const id = `ch${chapters.length + 1}`;
    chapters.push({ id, text });
    return `<h1 id="${id}">${text}</h1>\n`;
  }
  return `<h${depth}>${text}</h${depth}>\n`;
};
// 한글 조사 앞의 **굵게** 는 마크다운 규칙상 풀리지 않는 경우가 많아 미리 <strong> 으로 바꾼다(코드 블록 제외).
const bolded = body.split(/(```[\s\S]*?```)/).map((part, i) =>
  i % 2 ? part : part.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')).join('');
const content = marked.parse(bolded, { renderer, gfm: true });

const font = f => pathToFileURL(path.join(DIR, 'node_modules/@fontsource/noto-sans-kr', f)).href;
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<title>${esc(fm.title || 'ebook')}</title>
<link rel="stylesheet" href="${font('400.css')}">
<link rel="stylesheet" href="${font('700.css')}">
<link rel="stylesheet" href="${font('900.css')}">
<style>
  @page { size: A5; margin: 16mm 14mm 18mm; }
  @page :first { margin: 0; }
  :root { --ink:#1c1f24; --muted:#5b6470; --accent:#0f7b6c; --soft:#eef6f4; --line:#d9dee3; }
  * { box-sizing: border-box; }
  body { font-family: 'Noto Sans KR', sans-serif; color: var(--ink); font-size: 9.6pt; line-height: 1.72;
         word-break: keep-all; overflow-wrap: break-word; margin: 0; }
  .cover { height: 210mm; width: 148mm; padding: 26mm 16mm; display: flex; flex-direction: column;
           background: linear-gradient(160deg, #0b3d36 0%, #0f7b6c 60%, #1fa38f 100%); color: #fff; page-break-after: always; }
  .cover .kicker { font-size: 9pt; letter-spacing: .18em; opacity: .8; }
  .cover h1.title { font-weight: 900; font-size: 30pt; line-height: 1.25; margin: 14mm 0 6mm; border: 0; padding: 0; }
  .cover .sub { font-size: 12pt; line-height: 1.5; opacity: .92; }
  .cover .bar { width: 22mm; height: 2mm; background: #ffd166; margin: 10mm 0; }
  .cover .foot { margin-top: auto; font-size: 9pt; opacity: .85; display: flex; justify-content: space-between; }
  .toc { page-break-after: always; }
  .toc h2 { font-size: 15pt; margin: 0 0 6mm; }
  .toc ol { list-style: none; padding: 0; margin: 0; }
  .toc li { padding: 2.2mm 0; border-bottom: 1px dotted var(--line); font-size: 10pt; }
  .toc a { color: var(--ink); text-decoration: none; }
  h1 { page-break-before: always; font-size: 17pt; font-weight: 900; line-height: 1.35; margin: 0 0 6mm;
       padding-bottom: 3mm; border-bottom: 2.5px solid var(--accent); }
  h2 { font-size: 12.5pt; margin: 8mm 0 3mm; color: var(--accent); page-break-after: avoid; }
  h3 { font-size: 10.5pt; margin: 5mm 0 2mm; page-break-after: avoid; }
  p { margin: 0 0 3mm; }
  strong { font-weight: 700; }
  blockquote { margin: 4mm 0; padding: 3mm 4mm; background: var(--soft); border-left: 3px solid var(--accent);
               border-radius: 0 2mm 2mm 0; page-break-inside: avoid; }
  blockquote p:last-child { margin: 0; }
  table { width: 100%; border-collapse: collapse; margin: 3mm 0 5mm; font-size: 8.4pt; page-break-inside: avoid; }
  th { background: var(--accent); color: #fff; font-weight: 700; }
  th, td { padding: 1.6mm 2mm; border: 1px solid var(--line); vertical-align: top; text-align: left; }
  tr:nth-child(even) td { background: #f7f9fa; }
  pre { background: #1f2630; color: #e6edf3; padding: 3.5mm; border-radius: 2mm; font-size: 7.6pt; line-height: 1.55;
        white-space: pre-wrap; page-break-inside: avoid; }
  code { font-family: 'Noto Sans KR', ui-monospace, monospace; font-size: .92em; }
  :not(pre) > code { background: #eef1f4; padding: .2mm 1.2mm; border-radius: 1mm; }
  ul, ol { padding-left: 5mm; margin: 0 0 3mm; }
  li { margin: .8mm 0; }
  li input[type=checkbox] { margin-right: 1.5mm; }
  hr { display: none; }
</style></head><body>
<section class="cover">
  <div class="kicker">AI × THREADS AUTOMATION</div>
  <h1 class="title">${esc(fm.title || '')}</h1>
  <div class="sub">${esc(fm.subtitle || '')}</div>
  <div class="bar"></div>
  <div class="sub" style="font-size:10pt">AI 원고 · 공식 API 자동 발행 · 답글이 매출이 되는 퍼널<br>바로 쓰는 도구와 프롬프트 포함</div>
  <div class="foot"><span>${esc(fm.author || '')}</span><span>${esc(fm.version || '')}</span></div>
</section>
<section class="toc"><h2>목차</h2><ol>
${chapters.map(c => `<li><a href="#${c.id}">${c.text}</a></li>`).join('\n')}
</ol></section>
${content}
</body></html>`;

const htmlPath = path.join(DIR, 'ebook.html');
fs.writeFileSync(htmlPath, html);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
const pdfPath = path.join(DIR, `${(fm.title || 'ebook').replace(/\s+/g, '-')}.pdf`);
await page.pdf({
  path: pdfPath, format: 'A5', printBackground: true, displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: `<div style="width:100%;font-size:7pt;color:#8a939c;text-align:center;font-family:sans-serif">
    <span class="pageNumber"></span></div>`,
});
await browser.close();
console.log(`✓ ${path.relative(DIR, pdfPath)} (${chapters.length}개 장)`);
