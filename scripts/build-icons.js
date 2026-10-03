// Renderar icons/icon.svg till PNG-ikonerna som manifestet och iOS behöver, och icons/og.svg till delningsbilden
// (og.png, 1200 x 630). Typsnitten bäddas in så att texten i delningsbilden får rätt typsnitt. Kräver playwright.
// Körs med: node scripts/build-icons.js
const fs = require('fs');
const path = require('path');
const launch = require('./browser');
const dir = path.join(__dirname, '..', 'icons');
const fonts = path.join(__dirname, '..', 'fonts');
const font = (family, weight, file) => `@font-face{font-family:"${family}";font-weight:${weight};src:url(data:font/woff2;base64,${fs.readFileSync(path.join(fonts, file)).toString('base64')}) format("woff2")}`;
const fontCss = font('Bricolage Grotesque', '500 700', 'bricolage-grotesque-latin.woff2') + font('IBM Plex Mono', 500, 'ibm-plex-mono-500-latin.woff2');
const out = {
  'icon-192.png': ['icon.svg', 192, 192],
  'icon-512.png': ['icon.svg', 512, 512],
  'apple-touch-icon.png': ['icon.svg', 180, 180],
  'og.png': ['og.svg', 1200, 630],
};
(async () => {
  const b = await launch();
  for (const [name, [src, w, h]] of Object.entries(out)) {
    const svg = fs.readFileSync(path.join(dir, src), 'utf8');
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.setContent(`<style>${fontCss}html,body{margin:0}svg{display:block;width:${w}px;height:${h}px}</style>${svg}`);
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(dir, name) });
    await p.close();
    console.log(`${name} (${w}x${h})`);
  }
  await b.close();
})();
