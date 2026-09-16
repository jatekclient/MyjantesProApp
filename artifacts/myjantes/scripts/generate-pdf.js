const fs = require('node:fs');
const MarkdownIt = require('markdown-it');
const puppeteer = require('puppeteer');

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true
});

async function generate() {
  const mdContent = fs.readFileSync('APPLE_REVIEW_GUIDE.md', 'utf-8');
  const lines = mdContent.split('\n');
  let tocHtml = '<div class="toc"><h1>Table des matières</h1><ul>';
  let h1Count = 0;
  let h2Count = 0;
  const processedLines = lines.map(line => {
    if (line.startsWith('# ')) {
      h1Count++; h2Count = 0;
      const title = line.replace('# ', '').trim();
      const id = "section-" + h1Count;
      tocHtml += "<li><a href=\"#" + id + "\">" + h1Count + ". " + title + "</a></li>";
      return "<h1 id=\"" + id + "\">" + h1Count + ". " + title + "</h1>";
    } else if (line.startsWith('## ')) {
      h2Count++;
      const title = line.replace('## ', '').trim();
      const id = "section-" + h1Count + "-" + h2Count;
      tocHtml += "<li class=\"sub\"><a href=\"#" + id + "\">" + h1Count + "." + h2Count + " " + title + "</a></li>";
      return "<h2 id=\"" + id + "\">" + h1Count + "." + h2Count + " " + title + "</h2>";
    }
    return line;
  });
  tocHtml += '</ul></div>';
  const contentHtml = md.render(processedLines.join('\n'));
  const fullHtml = `<!DOCTYPE html><html><head><link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Rajdhani:wght@400;500;600;700&display=swap" rel="stylesheet"><style>:root { --bg: #0b0f18; --card: #111827; --accent: #7c9cff; --text: #ffffff; --code-bg: #0f1625; --border: rgba(124, 156, 255, 0.1); } * { box-sizing: border-box; } body { margin: 0; padding: 0; background: var(--bg); color: var(--text); font-family: 'Rajdhani', sans-serif; line-height: 1.6; } .page { padding: 20mm; min-height: 297mm; position: relative; page-break-after: always; } .cover { display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; height: 250mm; } .cover img { width: 120px; margin-bottom: 40px; border-radius: 24px; } .cover h1 { font-family: 'Orbitron', sans-serif; font-size: 32pt; color: var(--accent); margin: 0; letter-spacing: 2px; } .cover h2 { font-size: 18pt; opacity: 0.8; margin: 20px 0; font-weight: 500; } .cover .date { font-size: 14pt; opacity: 0.5; margin-top: 40px; } .toc h1 { font-family: 'Orbitron', sans-serif; color: var(--accent); margin-bottom: 30px; } .toc ul { list-style: none; padding: 0; } .toc li { margin-bottom: 12px; font-size: 14pt; font-weight: 600; } .toc li.sub { margin-left: 24px; font-weight: 400; opacity: 0.8; font-size: 12pt; } .toc a { color: var(--text); text-decoration: none; } .content h1 { font-family: 'Orbitron', sans-serif; color: var(--accent); border-bottom: 2px solid var(--accent); padding-bottom: 10px; margin-top: 40px; font-size: 22pt; } .content h2 { font-family: 'Orbitron', sans-serif; color: var(--text); margin-top: 30px; font-size: 16pt; opacity: 0.9; } .section-block { background: var(--card); border-radius: 16px; padding: 24px; margin-bottom: 24px; border: 1px solid var(--border); } table { width: 100%; border-collapse: separate; border-spacing: 0; margin: 20px 0; background: var(--code-bg); border-radius: 12px; overflow: hidden; border: 1px solid var(--border); } th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid var(--border); } th { background: rgba(124, 156, 255, 0.1); color: var(--accent); } pre { background: var(--code-bg); padding: 20px; border-radius: 12px; border: 1px solid var(--border); overflow-x: auto; } code { font-family: monospace; color: #a5b4fc; } img { max-width: 100%; height: auto; display: block; margin: 20px auto; border-radius: 12px; }</style></head><body><div class="page"><div class="cover"><img src="https://raw.githubusercontent.com/lastmytools/mytools-assets/main/logo.png" onerror="this.src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='"><h1>Guide de soumission Apple App Store</h1><h2>MyTools v1.0.0</h2><div class="date">06/03/2026</div></div></div><div class="page">${tocHtml}</div><div class="page content">${contentHtml}</div></body></html>`;
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
  await page.pdf({
    path: 'MyTools_Apple_Review_Guide.pdf',
    format: 'A4',
    margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' },
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div style="font-size: 8px; font-family: sans-serif; color: #7c9cff; width: 100%; padding: 0 20mm; display: flex; justify-content: space-between;"><span>MyTools Documentation</span><span>Apple App Store Submission Guide</span></div>',
    footerTemplate: '<div style="font-size: 8px; font-family: sans-serif; color: #7c9cff; width: 100%; padding: 0 20mm; display: flex; justify-content: space-between;"><span>MyTools v1.0.0</span><span style="flex: 1; text-align: center;">classification : publique</span><span>Page <span class="pageNumber"></span></span></div>'
  });
  await browser.close();
  console.log('PDF generated: MyTools_Apple_Review_Guide.pdf');
}
generate().catch(console.error);
