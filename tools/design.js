// Design audit: the castle is built soundly (tools/audit.js proves that), but is
// it any good to walk through? This measures pacing, density, fairness and the
// difficulty curve, and complains when the numbers say the answer is no.
const fs = require('fs');
const vm = require('vm');
const { decodePNG } = require('./pngdec.js');

class FakeImage {
  constructor() { this.onload = null; this.onerror = null; }
  set src(v) {
    const d = decodePNG(fs.readFileSync('/home/dev/Downloads/code/ctl/' + v));
    this.width = d.width; this.height = d.height; this.data = d.data;
    this._src = v;
    if (this.onload) this.onload();
  }
  get src() { return this._src; }
}
function makeCtxStub() {
  return new Proxy({ canvas: {} }, {
    get(t, p) { return p in t ? t[p] : () => makeCtxStub(); },
    set(t, p, v) { t[p] = v; return true; },
  });
}
const makeCanvas = () => ({ width: 0, height: 0, getContext: () => makeCtxStub(), addEventListener() {} });
const screenCanvas = makeCanvas();
screenCanvas.width = 960; screenCanvas.height = 540;
const store = {};
const sandbox = {
  console, Math, JSON, Array, Object, String, Number, Uint8Array, Int16Array,
  setInterval: () => 0, clearInterval() {},
  document: { createElement: () => makeCanvas(), getElementById: () => screenCanvas },
  requestAnimationFrame: () => {},
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  },
};
sandbox.Image = FakeImage;
sandbox.window = sandbox;
sandbox.window.addEventListener = () => {};
vm.createContext(sandbox);

const files = ['config.js', 'font.js', 'sprites.js', 'audio.js', 'level.js', 'systems.js',
  'projectiles.js', 'pickups.js', 'enemies.js', 'bosses.js', 'player.js', 'ui.js', 'game.js'];
const src = files.map(f => fs.readFileSync('/home/dev/Downloads/code/ctl/js/' + f, 'utf8')).join('\n;\n');
const hook = '\n;__hook({ game, Level, TILE, tileAt, isSolid, isPlatform, LEVEL_W, LEVEL_H, startRun, zoneAt, ZONES, surfaceRow, RECIPES, MATERIALS });';
let H = null;
sandbox.__hook = h => { H = h; };
vm.runInContext(src + hook, sandbox, { filename: 'bundle.js' });
const { game, Level, TILE, tileAt, isSolid, isPlatform, LEVEL_W, LEVEL_H,
  startRun, zoneAt, ZONES, RECIPES, MATERIALS } = H;

const notes = {};
function note(kind, detail) { (notes[kind] = notes[kind] || []).push(detail); }

const SCREEN = 60;          // tiles visible across one screen, roughly

function designAudit(seed) {
  game.worldSeed = seed;
  startRun();
  const zones = Level.zones;
  const wTiles = Math.floor(Level.pxW / TILE);

  // ---- what lives where
  const perZone = zones.map(z => {
    const c0 = Math.floor(z.x0 / TILE), c1 = Math.floor(z.x1 / TILE);
    const span = Math.max(1, c1 - c0);
    const inZone = (px) => px >= z.x0 && px <= z.x1;
    return {
      z, c0, c1, span,
      enemies: game.enemies.filter(e => inZone(e.x)).length,
      candles: Level.candles.filter(c => inZone(c.tx * TILE)).length,
      treasure: Level.treasures.filter(t => inZone(t.x)).length,
      props: Level.props.filter(p => inZone(p.x)).length,
      veins: (() => {
        let n = 0;
        for (let tx = c0; tx <= c1; tx++) for (let ty = 2; ty < LEVEL_H; ty++) if (tileAt(tx, ty) === 13) n++;
        return n;
      })(),
      hazards: (() => {
        let n = 0;
        for (let tx = c0; tx <= c1; tx++) for (let ty = 2; ty < LEVEL_H; ty++) {
          const id = tileAt(tx, ty);
          if (id === 3 || id === 15) n++;
        }
        return n + (Level.pendulums || []).filter(p => inZone(p.x)).length * 3;
      })(),
    };
  });

  // ---- 1. dead stretches: a long walk with nothing in it at all
  {
    const interest = new Set();
    const add = (px, r) => {
      const c = Math.floor(px / TILE);
      for (let d = -r; d <= r; d++) interest.add(c + d);
    };
    for (const c of Level.candles) add(c.tx * TILE, 2);
    for (const t of Level.treasures) add(t.x, 3);
    for (const p of Level.props) add(p.x, 3);
    for (const e of game.enemies) add(e.x, 4);
    for (const o of Level.obelisks) add(o.x, 4);
    let run = 0, worst = 0, worstAt = 0;
    for (let tx = 4; tx < wTiles - 4; tx++) {
      if (interest.has(tx)) { run = 0; continue; }
      run++;
      if (run > worst) { worst = run; worstAt = tx; }
    }
    if (worst > SCREEN) {
      const z = zoneAt(worstAt * TILE);
      note('empty-stretch', `${worst} tiles with nothing in them (${z ? z.key : '?'} near ${worstAt})`);
    }
  }

  // ---- 2. does danger actually rise as you go deeper?
  {
    const density = perZone.map(p => p.enemies / (p.span / SCREEN));
    for (let i = 1; i < density.length; i++) {
      // allow dips, but the end must be meaningfully harder than the start
      if (i === density.length - 1 && density[i] < density[0] * 1.2) {
        note('flat-difficulty', `last zone has ${density[i].toFixed(1)} fiends/screen vs ` +
          `${density[0].toFixed(1)} at the gate — the castle never gets harder`);
      }
    }
    for (const p of perZone) {
      const d = p.enemies / (p.span / SCREEN);
      if (d < 1.5) note('zone-too-empty', `${p.z.key}: only ${d.toFixed(1)} fiends per screen`);
      if (d > 14) note('zone-too-thick', `${p.z.key}: ${d.toFixed(1)} fiends per screen`);
    }
  }

  // ---- 3. reward should follow risk
  {
    const first = perZone[0], last = perZone[perZone.length - 1];
    const rate = (p) => p.treasure / (p.span / SCREEN);
    if (rate(last) < rate(first)) {
      note('reward-backwards', `the last zone pays ${rate(last).toFixed(1)} treasures/screen, ` +
        `the first ${rate(first).toFixed(1)}`);
    }
    for (const p of perZone) {
      if (p.treasure === 0) note('zone-unrewarded', `${p.z.key} holds no treasure at all`);
    }
  }

  // ---- 4. rest and services: how far between places to catch your breath
  {
    const rests = Level.obelisks.map(o => Math.floor(o.x / TILE)).sort((a, b) => a - b);
    let prev = 0, worst = 0;
    for (const r of rests.concat([wTiles])) { worst = Math.max(worst, r - prev); prev = r; }
    if (worst > SCREEN * 5) note('rest-too-far', `${worst} tiles between obelisks (${Math.round(worst / SCREEN)} screens)`);
    for (const kind of ['shrine', 'forge', 'merchant']) {
      const n = Level.props.filter(p => p.type === kind).length;
      if (n === 0) note('no-service', `the whole castle has no ${kind}`);
    }
  }

  // ---- 5. is the opening safe? nobody wants a fiend in their face at frame one
  {
    const startX = zones[0].x0 + 40;
    const near = game.enemies.filter(e => Math.abs(e.x - startX) < 8 * TILE).length;
    if (near > 0) note('hostile-start', `${near} fiend(s) within half a screen of the castle gate`);
    const hazardNear = (() => {
      const c0 = Math.floor(startX / TILE);
      for (let tx = c0 - 4; tx < c0 + 8; tx++) {
        for (let ty = 2; ty < LEVEL_H; ty++) {
          const id = tileAt(tx, ty);
          if (id === 3 || id === 15) return true;
        }
      }
      return false;
    })();
    if (hazardNear) note('hostile-start', 'spikes or blood within a few steps of the gate');
  }

  // ---- 6. can you afford what the forge sells?
  {
    const need = {};
    for (const r of RECIPES) {
      for (const m in r.cost) need[m] = Math.max(need[m] || 0, r.cost[m]);
    }
    let veins = 0;
    for (let tx = 2; tx < wTiles; tx++) for (let ty = 2; ty < LEVEL_H; ty++) if (tileAt(tx, ty) === 13) veins++;
    // each vein gives 1-3; the priciest recipes want ~6 of one metal
    if (veins < 24) note('ore-too-scarce', `only ${veins} ore seams in the whole castle`);
  }

  // ---- 7. hazards you cannot see coming, sitting on the walking line
  {
    let blind = 0;
    for (const z of zones) {
      const c0 = Math.floor(z.x0 / TILE) + 2, c1 = Math.floor(z.x1 / TILE) - 2;
      let cur = z.row;
      for (let cx = c0; cx <= c1; cx++) {
        let best = -1, bestD = 1e9;
        for (let r = 3; r < LEVEL_H - 3; r++) {
          const below = tileAt(cx, r + 1);
          if (!isSolid(below) && !isPlatform(below)) continue;
          if (isSolid(tileAt(cx, r)) || isSolid(tileAt(cx, r - 1))) continue;
          const d = Math.abs(r - cur);
          if (d < bestD) { bestD = d; best = r; }
        }
        if (best < 0 || bestD > 12) continue;
        cur = best;
        // a hazard the hunter walks straight into at head height
        if (tileAt(cx, cur) === 3 || tileAt(cx, cur - 1) === 3) blind++;
      }
    }
    if (blind > 6) note('blind-hazards', `${blind} spike tiles sit directly on the walking line`);
  }

  // ---- 8. the guardians' halls
  {
    for (const A of Level.bosses) {
      const c0 = Math.floor(A.arenaX0 / TILE), c1 = Math.floor(A.arenaX1 / TILE);
      const width = c1 - c0;
      if (width < 30) note('arena-cramped', `${A.zone}'s hall is only ${width} tiles wide`);
      // headroom above the floor for a flying guardian
      const mid = Math.floor((c0 + c1) / 2);
      let head = 0, hitSky = false;
      for (let ty = Math.floor(A.homeY / TILE); ty >= 0; ty--) {
        if (isSolid(tileAt(mid, ty))) break;
        head++;
        if (ty === 0) hitSky = true;      // open to the sky is all the room there is
      }
      if (hitSky) head = 99;
      if (head < 4) note('arena-cramped', `${A.zone}'s hall has ${head} rows of air above the guardian`);
      // and nothing to trip over in the middle of a duel
      let clutter = 0;
      for (let tx = c0 + 2; tx < c1 - 2; tx++) {
        for (let ty = Math.floor(A.homeY / TILE); ty < LEVEL_H; ty++) {
          if (isSolid(tileAt(tx, ty))) break;
          if (tileAt(tx, ty) === 2 || tileAt(tx, ty) === 3) { clutter++; break; }
        }
      }
      if (clutter > width * 0.25) note('arena-cluttered', `${A.zone}'s hall floor is ${Math.round(100 * clutter / width)}% obstacles`);
    }
  }

  return perZone;
}

// ---------------------------------------------------------------- run
const seeds = [1, 2, 3, 7, 11];
let table = null;
for (const s of seeds) table = designAudit(s);

console.log('\nLAST CASTLE, ZONE BY ZONE');
console.log('  zone        span  fiends/scr  treasure  candles  props  veins  hazards');
for (const p of table) {
  const perScr = (p.enemies / (p.span / SCREEN)).toFixed(1);
  console.log('  ' + p.z.key.padEnd(11) + String(p.span).padStart(5) +
    String(perScr).padStart(12) + String(p.treasure).padStart(10) +
    String(p.candles).padStart(9) + String(p.props).padStart(7) +
    String(p.veins).padStart(7) + String(p.hazards).padStart(9));
}

const kinds = Object.keys(notes).sort();
if (!kinds.length) {
  console.log('\nDESIGN CLEAN — pacing, density, reward and fairness all within bounds.');
} else {
  let total = 0;
  console.log('');
  for (const k of kinds) {
    const list = notes[k];
    total += list.length;
    console.log(`${k}: ${list.length}`);
    for (const d of list.slice(0, 4)) console.log('   ' + d);
    if (list.length > 4) console.log(`   ...and ${list.length - 4} more`);
  }
  console.log(`\nDESIGN: ${total} notes across ${seeds.length} castles`);
}
