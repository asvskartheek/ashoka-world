const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage(); p.on('pageerror', e => console.log('[ERR]', e.message));
  await p.goto(`http://localhost:8123/index.html?w=${process.argv[4]||724}&h=${process.argv[5]||543}`);
  await p.waitForFunction(() => window.__ready, null, { timeout: 0, polling: 500 });
  const variants = JSON.parse(process.argv[3]);
  for (const [i, code] of variants.entries()) {
    await p.evaluate(async ([s, code]) => { await window.renderShot(+s); eval(code); window.__dbg.comp.render(); }, [process.argv[2], code]);
    const d = await p.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
    fs.writeFileSync(`renders/dbg${i}.png`, Buffer.from(d.split(',')[1], 'base64'));
  }
  await b.close();
})();
