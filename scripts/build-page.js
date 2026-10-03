// Bygger två utgåvor av samma spel från src/app.template.html, src/tango.js och levels.json:
//   dist/tango.html   en enda självständig sida (typsnitt från Google Fonts), samma sida som publiceras som artefakt
//   index.html        sajten: lokala typsnitt, PWA-taggar, delningsbild och service worker (sw.js, med en cacheversion)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const tpl = read('src', 'app.template.html');
const engine = read('src', 'tango.js');
const levels = JSON.parse(read('levels.json'));

// Versionen på startskärmen: datum för senaste commit och dess korta id, t.ex. "2026-10-03 · ea81d8c".
// "-dirty" betyder ocommittade ändringar (lokalt). Utan git blir det "utvecklingsversion".
let appVersion = 'utvecklingsversion';
try {
  const git = (a) => execSync('git ' + a, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  appVersion = `${git('log -1 --format=%cs')} · ${git('describe --always --dirty --abbrev=7')}`;
} catch (e) {}

// Motorn läggs i en egen funktion så att dess hjälpfunktioner inte krockar med spelets globala namn.
const fill = (html, head, fonts, sw) => html
  .replace('__HEAD__', () => head)
  .replace('__FONTS__', () => fonts)
  .replace('__SW__', () => sw)
  .replace('__ENGINE__', () => ';(function () {\n' + engine + '\n})();')
  .replace('__LEVELS__', () => JSON.stringify(levels))
  .replace('__APP_VERSION__', 'Version ' + appVersion);

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });

// 1. Artefakten: allt i en fil, typsnitt från Google Fonts.
const gfonts = [
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@500;700&family=IBM+Plex+Mono:wght@400;500&display=swap">',
].join('\n');
const artifact = fill(tpl, '', gfonts, '');
fs.writeFileSync(path.join(root, 'dist', 'tango.html'), artifact);
console.log(`dist/tango.html byggd med ${levels.length} banor, ${(artifact.length / 1024).toFixed(0)} kB`);

// 2. Sajten. Delningsbilden (og:image) kräver en fullständig adress. Utan SITE_URL blir den relativ, vilket räcker lokalt.
let site = process.env.SITE_URL || '';
if (site && !site.endsWith('/')) site += '/';
const localFonts = `<link rel="preload" href="fonts/bricolage-grotesque-latin.woff2" as="font" type="font/woff2" crossorigin>
<style>
/* Typsnitten ligger lokalt (latin-delmängd, OFL) så att appen fungerar offline. */
@font-face { font-family: "Bricolage Grotesque"; font-weight: 500 700; font-display: swap; src: url(fonts/bricolage-grotesque-latin.woff2) format("woff2"); }
@font-face { font-family: "IBM Plex Mono"; font-weight: 400; font-display: swap; src: url(fonts/ibm-plex-mono-400-latin.woff2) format("woff2"); }
@font-face { font-family: "IBM Plex Mono"; font-weight: 500; font-display: swap; src: url(fonts/ibm-plex-mono-500-latin.woff2) format("woff2"); }
html { padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }
[hidden] { display: none !important; }
</style>`;
const siteHead = `<meta name="description" content="Tango-pussel för mobil och webbläsare. Lika många solar och månar i varje rad och kolumn, aldrig tre lika i rad.">
<meta name="theme-color" content="#121414">
<meta property="og:type" content="website">
<meta property="og:locale" content="sv_SE">
<meta property="og:site_name" content="Tango">
<meta property="og:title" content="Tango: logikpussel">
<meta property="og:description" content="Sol och måne, lika många av varje. Spela i mobilen eller webbläsaren, även offline.">
<meta property="og:url" content="${site}">
<meta property="og:image" content="${site}icons/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Tango-loggan: ett bräde med två solar och två månar.">
<meta name="twitter:card" content="summary_large_image">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Tango">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">`;
const swRegister = `// Offline-stöd. Service workers kräver http(s), så när filen öppnas direkt från disk hoppas det över.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}`;
const index = fill(tpl, siteHead, localFonts, swRegister);
fs.writeFileSync(path.join(root, 'index.html'), index);
console.log(`index.html byggd, version ${appVersion}` + (site ? `, adress ${site}` : ', utan SITE_URL'));

// PNG-ikonerna kräver playwright (scripts/build-icons.js). Saknas de lokalt hoppas de över; i Actions byggs de alltid först.
const assets = ['index.html', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png']
  .concat(fs.readdirSync(path.join(root, 'fonts')).map((f) => 'fonts/' + f))
  .filter((a) => fs.existsSync(path.join(root, a)) || console.warn(`varning: ${a} saknas, kör node scripts/build-icons.js`));
const hash = crypto.createHash('sha256');
for (const a of assets) hash.update(a).update(fs.readFileSync(path.join(root, a)));
const version = hash.digest('hex').slice(0, 12);
const files = ['./'].concat(assets.filter((a) => a !== 'index.html'));
fs.writeFileSync(path.join(root, 'sw.js'), read('src', 'sw.template.js')
  .replace('__VERSION__', version).replace('__FILES__', JSON.stringify(files, null, 2)));
console.log(`sw.js byggd, version ${version}`);
