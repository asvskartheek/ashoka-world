// usage: node render.js <shots comma> [w] [h] [outdir]
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const shots = (process.argv[2] || '1').split(','); const w = +process.argv[3] || 1448, h = +process.argv[4] || 1086; const out = process.argv[5] || 'renders';
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--max-old-space-size=6000'] });
  const p = await b.newPage({ viewport: { width: 800, height: 600 } });
  p.on('console', m => console.log('[page]', m.text())); p.on('pageerror', e => console.log('[ERR]', e.message));
  p.setDefaultTimeout(0);
  await p.goto(`http://localhost:8123/index.html?w=${w}&h=${h}`);
  await p.waitForFunction(() => window.__ready, null, { timeout: 0, polling: 500 });
  for (const s of shots) {
    await p.evaluate((s) => window.renderShot(+s), s);
    const data = await p.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
    fs.writeFileSync(`${out}/shot${s}.png`, Buffer.from(data.split(',')[1], 'base64')); console.log('saved', s);
  }
  await b.close();
})();
