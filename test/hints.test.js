// Följer Tips-knappen steg för steg på alla banor och kontrollerar att varje bana blir löst utan fel förslag.
// Kräver playwright och en byggd dist/tango.html. Körs med: node test/hints.test.js
const launch = require('../scripts/browser');
(async () => {
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 400, height: 760 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + require('path').join(__dirname, '..', 'dist', 'tango.html'));
  const res = await p.evaluate(() => {
    const out = { levels: 0, solved: 0, bad: [], maxSteps: 0, look: 0, longest: 0, samples: [] };
    for (let li = 0; li < LEVELS.length; li++) {
      load(li); out.levels++;
      let steps = 0, fail = null;
      while (!finished && steps < 200) {
        steps++;
        document.getElementById('hint').click();
        const h = hint;
        if (!h.cells.size) { fail = 'ingen tips'; break; }
        if (h.kind !== 'place') { fail = 'oväntat ' + h.kind; break; }
        const i = [...h.cells][0];
        if (h.value !== lv.solution[i]) { fail = 'fel symbol foreslagen'; break; }
        if (!h.text) { fail = 'saknar text'; break; }
        if (h.text.startsWith('Om den markerade')) { out.look++; out.longest = Math.max(out.longest, h.why.size); if (out.samples.length < 3 && h.why.size >= 3) out.samples.push(h.text); }
        const next = marks.slice(); next[i] = h.value;
        setMarks(next);
      }
      if (finished) out.solved++; else out.bad.push([LEVELS[li].id, fail || 'ej klar']);
      out.maxSteps = Math.max(out.maxSteps, steps);
    }
    return out;
  });
  console.log(JSON.stringify(res, null, 1), errs.join('|'));
  if (res.solved !== res.levels || errs.length) process.exitCode = 1;
  await b.close();
})();
