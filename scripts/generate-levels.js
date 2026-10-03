// Genererar 100 banor till levels.json: 75 st 6x6 och 25 st 8x8. Banorna ligger i svårighetsordning: först 6x6 (lätt, medel, svår),
// sedan 8x8, och inom varje nivå sorterat på lösarens poäng.
// Varje bana har exakt en lösning och går att lösa med ren logik. Körs med: node scripts/generate-levels.js
const fs = require('fs');
const path = require('path');
const { generateLevel } = require('../src/tango.js');

// [storlek, nivå (null = valfri), antal, maxExtra]
const plan = [
  [6, 1, 20, 14], [6, 2, 35, 6], [6, 3, 20, 2],
  [8, 2, 10, 6], [8, 3, 15, 2],
];
const levels = [];
for (const [n, tier, count, maxExtra] of plan) {
  const batch = [], seen = new Set();
  let seed = 70000 + n * 1000 + (tier || 0) * 100;
  let guard = 0;
  while (batch.length < count && guard++ < count * 400) {
    const lv = generateLevel({ n, tier, seed: seed++, maxAttempts: 200, maxExtra });
    if (!lv) continue;
    const key = [lv.given.join(''), lv.h.join(''), lv.v.join('')].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    batch.push(lv);
  }
  if (batch.length < count) throw new Error(`bara ${batch.length} av ${count} banor för ${n}x${n}, nivå ${tier}`);
  batch.sort((a, b) => a.score - b.score);
  levels.push(...batch);
  console.log(`${n}x${n} nivå ${tier == null ? 'alla' : tier}: ${batch.length} banor, poäng ${batch[0].score}..${batch[batch.length - 1].score}`);
}
const out = levels.map((lv, i) => ({ id: i + 1, n: lv.n, tier: lv.tier, score: lv.score, given: lv.given, h: lv.h, v: lv.v, solution: lv.solution }));
fs.writeFileSync(path.join(__dirname, '..', 'levels.json'), JSON.stringify(out));
console.log('skrev', out.length, 'banor');
