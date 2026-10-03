'use strict';
// Tango-pussel: generator, unikhetskontroll och logiklösare med förklaringar (ger svårighetsgrad och Tips).
// Fungerar både i Node (require) och i webbläsaren (globalThis.TangoGen).
//
// Representation (n x n, n jämnt):
//   val[i]  : -1 tom, 0 sol, 1 måne           (i = rad * n + kolumn)
//   h[k]    : tecken mellan (r,c) och (r,c+1), k = r * (n-1) + c    0 inget, 1 = (lika), 2 x (olika)
//   v[k]    : tecken mellan (r,c) och (r+1,c), k = r * n + c        0 inget, 1 = (lika), 2 x (olika)

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(a, rnd) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Alla tecken som en lista { a, b, t } (a och b är rutor som ligger bredvid varandra).
function buildCons(n, h, v) {
  const out = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n - 1; c++) { const t = h[r * (n - 1) + c]; if (t) out.push({ a: r * n + c, b: r * n + c + 1, t }); }
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n; c++) { const t = v[r * n + c]; if (t) out.push({ a: r * n + c, b: (r + 1) * n + c, t }); }
  return out;
}

// Rad r och kolumn r som listor av rutor.
function lineCells(n, kind, k) {
  const o = [];
  for (let x = 0; x < n; x++) o.push(kind === 'r' ? k * n + x : x * n + k);
  return o;
}

// Slumpa en fullständig giltig bräda: lika många av varje i varje rad och kolumn, aldrig tre lika i rad.
function randomSolution(n, rnd) {
  const half = n / 2, N = n * n;
  const g = new Array(N).fill(-1);
  const rc = [new Array(n).fill(0), new Array(n).fill(0)], cc = [new Array(n).fill(0), new Array(n).fill(0)];
  function rec(i) {
    if (i === N) return true;
    const r = (i / n) | 0, c = i % n;
    const order = rnd() < 0.5 ? [0, 1] : [1, 0];
    for (const x of order) {
      if (rc[x][r] >= half || cc[x][c] >= half) continue;
      if (c >= 2 && g[i - 1] === x && g[i - 2] === x) continue;
      if (r >= 2 && g[i - n] === x && g[i - 2 * n] === x) continue;
      g[i] = x; rc[x][r]++; cc[x][c]++;
      if (rec(i + 1)) return true;
      g[i] = -1; rc[x][r]--; cc[x][c]--;
    }
    return false;
  }
  return rec(0) ? g : null;
}

// Räkna lösningar (stoppar vid limit). Banan är bara giltig om svaret är exakt 1.
function countSolutions(n, given, h, v, limit = 2) {
  const half = n / 2, N = n * n;
  const g = new Array(N).fill(-1);
  const rc = [new Array(n).fill(0), new Array(n).fill(0)], cc = [new Array(n).fill(0), new Array(n).fill(0)];
  let count = 0;
  function rec(i) {
    if (count >= limit) return;
    if (i === N) { count++; return; }
    const r = (i / n) | 0, c = i % n;
    for (let x = 0; x < 2; x++) {
      if (given[i] !== -1 && given[i] !== x) continue;
      if (rc[x][r] >= half || cc[x][c] >= half) continue;
      if (c >= 2 && g[i - 1] === x && g[i - 2] === x) continue;
      if (r >= 2 && g[i - n] === x && g[i - 2 * n] === x) continue;
      if (c >= 1) { const t = h[r * (n - 1) + c - 1]; if ((t === 1 && g[i - 1] !== x) || (t === 2 && g[i - 1] === x)) continue; }
      if (r >= 1) { const t = v[(r - 1) * n + c]; if ((t === 1 && g[i - n] !== x) || (t === 2 && g[i - n] === x)) continue; }
      g[i] = x; rc[x][r]++; cc[x][c]++;
      rec(i + 1);
      g[i] = -1; rc[x][r]--; cc[x][c]--;
    }
  }
  rec(0);
  return count;
}

// ---------- Logiklösare ----------
// Varje steg är { kind: 'place', cells: [ruta], value, why: [rutor], text, tech, tier }.
// Teknikerna provas från billigast till dyrast:
//   Nivå 1: tecken (= och x), två lika i rad, ruta mellan två lika, raden har redan alla av ett slag
//   Nivå 2: pröva alla sätt att fylla en rad eller kolumn
//   Nivå 3: titta ett steg fram (om rutan vore si skulle något bli omöjligt)

const SYM = ['sol', 'måne'], ONE = ['en sol', 'en måne'], MANY = ['solar', 'månar'];

function lineName(kind, k) { return (kind === 'r' ? 'rad ' : 'kolumn ') + (k + 1); }

// Alla sätt att fylla en rad/kolumn, givet det som redan står där, antalet av varje, tre-i-rad och tecknen i raden.
function lineCompletions(n, cells, val, consIn, cap) {
  const half = n / 2, res = [], cur = new Array(n).fill(-1), cnt = [0, 0];
  function rec(p) {
    if (cap && res.length >= cap) return;
    if (p === n) { res.push(cur.slice()); return; }
    for (let x = 0; x < 2; x++) {
      const k = val[cells[p]];
      if (k !== -1 && k !== x) continue;
      if (cnt[x] >= half) continue;
      if (p >= 2 && cur[p - 1] === x && cur[p - 2] === x) continue;
      if (p >= 1 && consIn[p - 1]) { const t = consIn[p - 1]; if ((t === 1 && cur[p - 1] !== x) || (t === 2 && cur[p - 1] === x)) continue; }
      cur[p] = x; cnt[x]++;
      rec(p + 1);
      cnt[x]--; cur[p] = -1;
    }
  }
  rec(0);
  return res;
}

function makeSolver(n, h, v) {
  const half = n / 2, N = n * n;
  const cons = buildCons(n, h, v);
  const lines = [];
  for (let k = 0; k < n; k++) for (const kind of ['r', 'c']) {
    const cells = lineCells(n, kind, k);
    // tecken mellan intilliggande rutor i raden: consIn[p] mellan position p och p+1
    const consIn = [];
    for (let p = 0; p < n - 1; p++) consIn.push(kind === 'r' ? h[k * (n - 1) + p] : v[p * n + k]);
    lines.push({ kind, k, cells, consIn });
  }

  const cellName = (i) => `rad ${((i / n) | 0) + 1}, kolumn ${(i % n) + 1}`;
  // Finns något som redan är omöjligt? Svaret är en mening som fortsätter efter "Då ", eller null. Används av "titta ett steg fram".
  function brokenReason(val) {
    for (const L of lines) {
      const cnt = [0, 0];
      for (let p = 0; p < n; p++) {
        const x = val[L.cells[p]];
        if (x !== -1) cnt[x]++;
        if (p >= 2 && x !== -1 && val[L.cells[p - 1]] === x && val[L.cells[p - 2]] === x) return `blir det tre ${MANY[x]} i rad i ${lineName(L.kind, L.k)}`;
      }
      for (let x = 0; x < 2; x++) if (cnt[x] > half) return `får ${lineName(L.kind, L.k)} för många ${MANY[x]}`;
      if (lineCompletions(n, L.cells, val, L.consIn, 1).length === 0) return `går ${lineName(L.kind, L.k)} inte att fylla utan att bryta mot en regel`;
    }
    for (const c of cons) {
      const a = val[c.a], b = val[c.b];
      if (a !== -1 && b !== -1 && ((c.t === 1 && a !== b) || (c.t === 2 && a === b))) return `stämmer inte tecknet mellan ${cellName(c.a)} och ${cellName(c.b)}`;
    }
    return null;
  }
  const broken = (val) => brokenReason(val) !== null;

  function place(i, value, why, text, tech, tier) { return { kind: 'place', cells: [i], value, why, text, tech, tier }; }
  const placeTxt = (value) => `Placera ${ONE[value]} i den markerade rutan.`;

  function stepEdge(val) {
    for (const c of cons) {
      const a = val[c.a], b = val[c.b];
      if ((a === -1) === (b === -1)) continue;
      const known = a === -1 ? c.b : c.a, unk = a === -1 ? c.a : c.b, kv = val[known];
      const value = c.t === 1 ? kv : 1 - kv;
      const txt = c.t === 1
        ? `Rutorna har ett = mellan sig, så de är lika. ${placeTxt(value)}`
        : `Rutorna har ett x mellan sig, så de är olika. ${placeTxt(value)}`;
      return place(unk, value, [known], txt, 'edge', 1);
    }
    return null;
  }

  function stepPair(val) {
    for (const L of lines) for (let p = 0; p < n - 1; p++) {
      const x = val[L.cells[p]];
      if (x === -1 || val[L.cells[p + 1]] !== x) continue;
      for (const q of [p - 1, p + 2]) {
        if (q < 0 || q >= n || val[L.cells[q]] !== -1) continue;
        return place(L.cells[q], 1 - x, [L.cells[p], L.cells[p + 1]],
          `Två ${MANY[x]} bredvid varandra. Tre i rad är förbjudet, så rutan intill måste vara ${ONE[1 - x].replace('en ', 'en ')}. ${placeTxt(1 - x)}`, 'pair', 1);
      }
    }
    return null;
  }

  function stepSandwich(val) {
    for (const L of lines) for (let p = 0; p < n - 2; p++) {
      const x = val[L.cells[p]];
      if (x === -1 || val[L.cells[p + 2]] !== x || val[L.cells[p + 1]] !== -1) continue;
      return place(L.cells[p + 1], 1 - x, [L.cells[p], L.cells[p + 2]],
        `Rutan mellan två ${MANY[x]} kan inte vara ${ONE[x]}, då blir det tre i rad. ${placeTxt(1 - x)}`, 'sandwich', 1);
    }
    return null;
  }

  function stepCount(val) {
    for (const L of lines) for (let x = 0; x < 2; x++) {
      const own = [];
      let unk = -1;
      for (let p = 0; p < n; p++) { const i = L.cells[p]; if (val[i] === x) own.push(i); else if (val[i] === -1 && unk < 0) unk = i; }
      if (own.length === half && unk >= 0) {
        return place(unk, 1 - x, own,
          `${cap(lineName(L.kind, L.k))} har redan ${half} ${MANY[x]}. Resten måste vara ${MANY[1 - x]}. ${placeTxt(1 - x)}`, 'count', 1);
      }
    }
    return null;
  }

  function stepLine(val) {
    for (const L of lines) {
      let hasUnk = false;
      for (const i of L.cells) if (val[i] === -1) { hasUnk = true; break; }
      if (!hasUnk) continue;
      const comps = lineCompletions(n, L.cells, val, L.consIn, 0);
      if (!comps.length) continue;
      for (let p = 0; p < n; p++) {
        const i = L.cells[p];
        if (val[i] !== -1) continue;
        const x = comps[0][p];
        if (comps.every((s) => s[p] === x)) {
          return place(i, x, L.cells.filter((j) => j !== i),
            `Pröva alla sätt att fylla ${lineName(L.kind, L.k)} med ${half} solar och ${half} månar, utan tre lika i rad och med hänsyn till tecknen. Bara ${ONE[x]} fungerar i den markerade rutan. ${placeTxt(x)}`, 'line', 2);
        }
      }
    }
    return null;
  }

  // Följ de enkla teknikerna från ett antagande. Ger kedjan av tvingade rutor och varför det till slut går sönder,
  // eller null om det inte går sönder inom maxSteps steg.
  function propagate(val, maxSteps) {
    const chain = [];
    for (;;) {
      const reason = brokenReason(val);
      if (reason) return { chain, reason };
      if (chain.length >= maxSteps) return null;
      const s = stepEdge(val) || stepPair(val) || stepSandwich(val) || stepCount(val) || stepLine(val);
      if (!s) return null;
      val[s.cells[0]] = s.value;
      chain.push({ cell: s.cells[0], value: s.value, tech: s.tech });
    }
  }

  const TECH_SHORT = {
    edge: 'tecknet mellan rutorna', pair: 'två lika bredvid varandra', sandwich: 'mellan två lika',
    count: 'raden är redan full på det slaget', line: 'raden går bara att fylla på ett sätt',
  };

  // Titta ett steg fram: pröva en symbol i en tom ruta och se om det går sönder inom lookLimit tvingade steg.
  // Den kortaste kedjan väljs, och hela kedjan skrivs ut så att man kan följa den med ögonen.
  function stepLook(val, lookLimit) {
    let best = null;
    for (let i = 0; i < N && !(best && best.r.chain.length <= 1); i++) {
      if (val[i] !== -1) continue;
      for (let x = 0; x < 2; x++) {
        const t = val.slice(); t[i] = x;
        const r = propagate(t, best ? best.r.chain.length : lookLimit);
        if (r && (!best || r.chain.length < best.r.chain.length)) best = { i, x, r };
      }
    }
    if (!best) return null;
    const { i, x, r } = best;
    const parts = r.chain.map((c) => `${cellName(c.cell)} bli ${ONE[c.value]} (${TECH_SHORT[c.tech]})`);
    const text = `Om den markerade rutan vore ${ONE[x]}`
      + (parts.length ? ` måste ${parts.join(', sedan ')}. Då ${r.reason}.` : `, då ${r.reason}.`)
      + ` Rutan måste därför vara ${ONE[1 - x]}. ${placeTxt(1 - x)}`;
    return place(i, 1 - x, r.chain.map((c) => c.cell), text, 'look', 3);
  }

  function findStep(val, maxTier = 3, lookLimit = 4) {
    return stepEdge(val) || stepPair(val) || stepSandwich(val) || stepCount(val)
      || (maxTier >= 2 ? stepLine(val) : null) || (maxTier >= 3 ? stepLook(val, lookLimit) : null);
  }

  return { findStep, broken };
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

const WEIGHT = { edge: 1, pair: 1, sandwich: 1, count: 1, line: 4, look: 10 };

// maxTier 2 betyder att banan måste gå att lösa utan att pröva antaganden: bara reglerna och en rad eller kolumn i taget.
function logicSolve(n, given, h, v, maxTier = 2) {
  const S = makeSolver(n, h, v);
  const val = given.slice();
  const used = { edge: 0, pair: 0, sandwich: 0, count: 0, line: 0, look: 0 };
  let tier = 0, score = 0, steps = 0;
  for (let guard = 0; guard < n * n + 5; guard++) {
    if (!val.includes(-1)) break;
    const s = S.findStep(val, maxTier, 4);
    if (!s) break;
    val[s.cells[0]] = s.value; used[s.tech]++; tier = Math.max(tier, s.tier); score += WEIGHT[s.tech]; steps++;
  }
  return { solved: !val.includes(-1) && !S.broken(val), tier, score, used, steps, val };
}

// Nivå efter hur många gånger man måste pröva alla sätt att fylla en rad eller kolumn:
// 0 = Lätt (räcker med reglerna och tecknen), därefter Medel upp till gränsen, över den Svår.
const LINE_LIMIT = { 4: 1, 6: 4, 8: 8 };
function classify(n, res) {
  const line = res.used.line;
  return line === 0 ? 1 : line <= (LINE_LIMIT[n] || 4) ? 2 : 3;
}

// Rutorna som ett tecken sitter mellan.
function signCells(n, kind, i) {
  if (kind === 'h') { const r = Math.floor(i / (n - 1)), c = i % (n - 1); return [r * n + c, r * n + c + 1]; }
  return [i, i + n];
}

// Ett tecken får aldrig sitta intill en ifylld startruta: då är halva tecknet redan avslöjat och den andra rutan given.
function violations(n, given, h, v) {
  const out = [];
  for (const [kind, arr] of [['h', h], ['v', v]]) {
    for (let i = 0; i < arr.length; i++) {
      if (!arr[i]) continue;
      for (const cell of signCells(n, kind, i)) if (given[cell] !== -1) out.push({ kind, i, cell });
    }
  }
  return out;
}

// Genererar en bana: slumpa en lösning, börja med alla ledtrådar (rutor och tecken) och ta bort
// slumpvis så länge lösningen förblir unik. extra lägger tillbaka några ledtrådar (ger lättare banor).
function generateLevel(opts) {
  const { n, tier, seed, maxAttempts = 400, maxExtra = 6, keepGivens = 0.5 } = opts;
  const rnd = mulberry32(seed), N = n * n;
  for (let a = 1; a <= maxAttempts; a++) {
    const sol = randomSolution(n, rnd);
    if (!sol) continue;
    const given = sol.slice();
    const h = new Array(n * (n - 1)).fill(0), v = new Array((n - 1) * n).fill(0);
    for (let r = 0; r < n; r++) for (let c = 0; c < n - 1; c++) h[r * (n - 1) + c] = sol[r * n + c] === sol[r * n + c + 1] ? 1 : 2;
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n; c++) v[r * n + c] = sol[r * n + c] === sol[(r + 1) * n + c] ? 1 : 2;
    const clues = [];
    for (let i = 0; i < N; i++) clues.push({ k: 'g', i });
    for (let i = 0; i < h.length; i++) clues.push({ k: 'h', i });
    for (let i = 0; i < v.length; i++) clues.push({ k: 'v', i });
    shuffle(clues, rnd);
    // Rutor tas bort tidigare än tecken, så att banorna lever på tecknen. keepGivens styr hur många rutor som överlever.
    clues.sort((x, y) => (x.k === 'g' ? (rnd() < keepGivens ? 1 : 0) : 0.5) - (y.k === 'g' ? (rnd() < keepGivens ? 1 : 0) : 0.5));
    const removed = [];
    for (const c of clues) {
      const arr = c.k === 'g' ? given : c.k === 'h' ? h : v;
      const old = arr[c.i];
      arr[c.i] = c.k === 'g' ? -1 : 0;
      if (countSolutions(n, given, h, v, 2) !== 1) arr[c.i] = old; else removed.push({ c, old });
    }
    const extra = Math.floor(rnd() * (maxExtra + 1));
    shuffle(removed, rnd);
    for (let e = 0, added = 0; e < removed.length && added < extra; e++) {
      const { c, old } = removed[e];
      const arr = c.k === 'g' ? given : c.k === 'h' ? h : v;
      arr[c.i] = old;
      if (violations(n, given, h, v).length) arr[c.i] = c.k === 'g' ? -1 : 0; else added++; // ingen ledtråd som bryter regeln ovan
    }
    // Reparera kvarvarande par av tecken och startruta: ta bort tecknet, annars rutan, så länge lösningen förblir unik.
    let stuck = false;
    for (let guard = 0; guard < 60 && !stuck; guard++) {
      const bad = violations(n, given, h, v);
      if (!bad.length) break;
      const { kind, i, cell } = bad[0], arr = kind === 'h' ? h : v, t = arr[i];
      arr[i] = 0;
      if (countSolutions(n, given, h, v, 2) === 1) continue;
      arr[i] = t;
      const g0 = given[cell]; given[cell] = -1;
      if (countSolutions(n, given, h, v, 2) === 1) continue;
      given[cell] = g0; stuck = true;
    }
    if (stuck || violations(n, given, h, v).length) continue;
    const res = logicSolve(n, given, h, v);
    const level = classify(n, res);
    if (!res.solved || (tier != null && level !== tier)) continue;
    return { n, given, h, v, solution: sol, tier: level, score: res.score, used: res.used, attempts: a };
  }
  return null;
}

const api = { violations, classify, mulberry32, randomSolution, countSolutions, buildCons, lineCells, makeSolver, logicSolve, generateLevel, SYM, ONE, MANY };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.TangoGen = api;
