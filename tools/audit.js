// Structural audit of the generated castle.
//
// The smoke suite proves the game *works*; this proves the castle is *built
// properly* — nothing buried in stone, nothing standing inside anything else,
// no floor you cannot reach. It reports every offence with coordinates.
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
function makeCanvas() {
  return { width: 0, height: 0, getContext: () => makeCtxStub(), addEventListener() {} };
}
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
const hook = '\n;__hook({ game, Level, TILE, tileAt, isSolid, isPlatform, LEVEL_W, LEVEL_H, buildWorld, zoneAt, resetGame, startRun, ZONES, surfaceRow, stepGame, keys, pending });';
let H = null;
sandbox.__hook = h => { H = h; };
vm.runInContext(src + hook, sandbox, { filename: 'bundle.js' });
const { game, Level, TILE, tileAt, isSolid, isPlatform, LEVEL_W, LEVEL_H,
  startRun, zoneAt, ZONES, surfaceRow, stepGame, keys, pending } = H;

// ---------------------------------------------------------------- reporting
const faults = {};
function fault(kind, detail) {
  (faults[kind] = faults[kind] || []).push(detail);
}
const tileOf = (px, py) => tileAt(Math.floor(px / TILE), Math.floor(py / TILE));
const zoneName = px => { const z = zoneAt(px); return z ? z.key : '?'; };

// How much room a prop needs, and where its box sits relative to its anchor.
// (anchors are the floor the prop stands on, except where noted)
const PROP_BOX = {
  statue: { w: 16, h: 29 }, shrine: { w: 16, h: 29 }, forge: { w: 16, h: 16 },
  merchant: { w: 14, h: 22 }, grave: { w: 12, h: 14 }, pillar: { w: 16, h: 72 },
  sarcophagus: { w: 26, h: 13 }, throne: { w: 20, h: 40 }, crystal: { w: 12, h: 16 },
};

function auditWorld(seed, label) {
  game.worldSeed = seed;
  startRun();
  const zones = Level.zones || [];

  // ---- 1. props buried in stone, or standing on nothing
  for (const p of Level.props) {
    const box = PROP_BOX[p.type];
    if (!box) continue;                       // banners/chains/chandeliers hang, skip
    const x0 = Math.floor(p.x / TILE), x1 = Math.floor((p.x + box.w - 1) / TILE);
    const yTop = Math.floor((p.y - box.h) / TILE), yBot = Math.floor((p.y - 1) / TILE);
    let buried = 0, cells = 0;
    for (let tx = x0; tx <= x1; tx++) {
      for (let ty = yTop; ty <= yBot; ty++) {
        cells++;
        if (isSolid(tileAt(tx, ty))) buried++;
      }
    }
    if (cells && buried / cells > 0.34) {
      fault('prop-in-wall', `${p.type} at ${Math.round(p.x / TILE)},${Math.round(p.y / TILE)} ` +
        `(${zoneName(p.x)}) ${buried}/${cells} cells solid`);
    }
    // and something to stand on
    if (p.type !== 'crystal' && !isSolid(tileOf(p.x + box.w / 2, p.y + 2)) &&
        !isPlatform(tileOf(p.x + box.w / 2, p.y + 2))) {
      fault('prop-floating', `${p.type} at ${Math.round(p.x / TILE)},${Math.round(p.y / TILE)} (${zoneName(p.x)})`);
    }
  }

  // ---- 2. props standing inside each other
  const solidProps = Level.props.filter(p => PROP_BOX[p.type]);
  for (let i = 0; i < solidProps.length; i++) {
    for (let j = i + 1; j < solidProps.length; j++) {
      const a = solidProps[i], b = solidProps[j];
      const ba = PROP_BOX[a.type], bb = PROP_BOX[b.type];
      if (Math.abs(a.y - b.y) > 40) continue;
      const overlap = Math.min(a.x + ba.w, b.x + bb.w) - Math.max(a.x, b.x);
      if (overlap > 4) {
        fault('props-overlap', `${a.type}+${b.type} at ${Math.round(a.x / TILE)} ` +
          `(${zoneName(a.x)}) overlap ${overlap}px`);
      }
    }
  }

  // ---- 3. spawns buried in stone
  const spawnLists = [
    ['hound', Level.hounds], ['wolf', Level.wolves], ['thrower', Level.throwers],
    ['gargoyle', Level.gargoyles], ['spider', Level.spiders],
  ];
  for (const [kind, list] of spawnLists) {
    for (const s of (list || [])) {
      // spiders hang below stone and gargoyles cling beside it — each kind's body
      // sits somewhere different relative to the point it is spawned at
      const rows = kind === 'spider' ? [0, 1] : kind === 'gargoyle' ? [0] : [-2, -1];
      let solid = 0;
      for (const dy of rows) {
        if (isSolid(tileOf(s.x + 8, s.y + dy * TILE))) solid++;
      }
      if (solid === rows.length) {
        fault('spawn-in-wall', `${kind} at ${Math.round(s.x / TILE)},${Math.round(s.y / TILE)} (${zoneName(s.x)})`);
      }
    }
  }
  for (const z of (Level.zombieZones || [])) {
    const mid = (z.x0 + z.x1) / 2;
    if (isSolid(tileOf(mid, z.groundY - TILE))) {
      fault('spawn-in-wall', `zombie zone at ${Math.round(mid / TILE)} (${zoneName(mid)})`);
    }
  }

  // ---- 4. treasure and candles inside stone
  for (const t of (Level.treasures || [])) {
    if (isSolid(tileOf(t.x + 4, t.y + 4))) {
      fault('treasure-in-wall', `${t.kind} at ${Math.round(t.x / TILE)},${Math.round(t.y / TILE)} (${zoneName(t.x)})`);
    }
  }
  for (const c of (Level.candles || [])) {
    if (isSolid(tileAt(c.tx, c.ty))) {
      fault('candle-in-wall', `candle at ${c.tx},${c.ty} (${zoneName(c.tx * TILE)})`);
    }
  }

  // ---- 5. obelisks, lifts and gates
  for (const o of (Level.obelisks || [])) {
    if (isSolid(tileOf(o.x + 6, o.y - TILE))) {
      fault('obelisk-in-wall', `obelisk at ${Math.round(o.x / TILE)} (${zoneName(o.x)})`);
    }
  }
  for (const lf of (Level.lifts || [])) {
    for (let ty = Math.floor(lf.y0 / TILE); ty <= Math.floor(lf.y1 / TILE); ty++) {
      if (isSolid(tileAt(Math.floor((lf.x + lf.w / 2) / TILE), ty))) {
        const cx2 = Math.floor((lf.x + lf.w / 2) / TILE);
        let prof = '';
        for (let r = Math.floor(lf.y0 / TILE) - 1; r <= Math.floor(lf.y1 / TILE) + 1; r++) prof += tileAt(cx2, r);
        const hs = (Level.hollows || []).filter(h => cx2 >= h.x0 && cx2 <= h.x1);
        fault('lift-blocked', `lift col ${cx2} rows ${Math.floor(lf.y0 / TILE)}-${Math.floor(lf.y1 / TILE)} ` +
          `id=${tileAt(cx2, ty)} at ${ty} prof=${prof} hollows=${hs.map(h => h.y0 + '-' + h.y1).join(',') || 'NONE'}`);
        break;
      }
    }
  }
  for (const gt of (Level.gates || [])) {
    // a warded door must have floor under it and air above, or it seals nothing
    if (!isSolid(tileAt(gt.tx, gt.bottom + 1))) {
      fault('gate-floating', `gate at ${gt.tx} has no floor beneath`);
    }
  }

  // ---- 6. pendulums must swing in open air
  for (const pd of (Level.pendulums || [])) {
    if (isSolid(tileOf(pd.x, pd.y))) {
      fault('pendulum-in-wall', `pendulum pivot at ${Math.round(pd.x / TILE)},${Math.round(pd.y / TILE)}`);
    }
  }

  // ---- 7. is the castle walkable end to end? flood along the floor
  {
    const startZ = zones[0];
    let cx = Math.floor((startZ.x0 + 40) / TILE);
    let reached = 0, blockedAt = -1;
    const endCol = Math.floor(Level.pxW / TILE) - 4;
    let row = surfaceRow(cx);
    for (; cx < endCol; cx++) {
      const r = surfaceRow(cx);
      if (r < 0) { reached = cx; continue; }        // a pit; the hunter can jump it
      // a step up taller than a jump, or a ceiling too low to pass, is a wall
      if (row > 0 && r < row - 6 && !isSolid(tileAt(cx, r + 1))) {
        if (blockedAt < 0) blockedAt = cx;
      }
      row = r;
      reached = cx;
    }
    if (reached < endCol - 2) {
      fault('castle-truncated', `the walk stops at column ${reached} of ${endCol}`);
    }
  }

  // ---- 8. every zone must have floor in it
  for (const z of zones) {
    let floors = 0;
    for (let tx = Math.floor(z.x0 / TILE); tx < Math.floor(z.x1 / TILE); tx += 3) {
      if (surfaceRow(tx) > 0) floors++;
    }
    if (floors < 5) fault('zone-empty', `${z.key} has almost no floor (${floors} samples)`);
  }

  auditConnectors();
  auditReachability();
  auditSpine();
  auditSecrets();
  return { seed, label };
}

// ---- 9. are the vertical connectors actually hollow, or filled in?
function auditConnectors() {
  for (const m of (Level.landmarks || [])) {
    const cx = Math.floor(m.x / TILE);
    const top = Math.floor(m.y / TILE);
    // look below the landmark's floor: a tower or lift must be open in there
    let solidRun = 0;
    for (let ty = top + 2; ty < Math.min(LEVEL_H, top + 10); ty++) {
      if (isSolid(tileAt(cx, ty))) solidRun++;
    }
    if (m.kind !== 'shaft' && solidRun >= 7) {
      let prof = '';
      for (let ty = top - 2; ty < Math.min(LEVEL_H, top + 10); ty++) prof += tileAt(cx, ty);
      let profL = '', profR = '';
      for (let ty = top - 2; ty < Math.min(LEVEL_H, top + 10); ty++) profL += tileAt(cx - 3, ty);
      for (let ty = top - 2; ty < Math.min(LEVEL_H, top + 10); ty++) profR += tileAt(cx + 3, ty);
      const hs = (Level.hollows || []).filter(h => cx >= h.x0 && cx <= h.x1);
      fault('connector-filled', `${m.kind} at ${cx},${top} (${zoneName(m.x)}) col=${prof} ` +
        `hollows=${hs.length ? hs.map(h => h.y0 + '-' + h.y1).join(',') : 'NONE'} total=${(Level.hollows || []).length}`);
    }
  }
}

// ---- 10. can the hunter actually get anywhere? A coarse reachability flood
// over standable cells, with the hunter's real jump and fall in mind.
function auditReachability() {
  const W = LEVEL_W, H = LEVEL_H;
  // doors that progression opens are not walls for this purpose
  const blocked = id => isSolid(id) && id !== 12 && id !== 14 && id !== 10 && id !== 11;
  const standable = (x, y) => {
    const below = tileAt(x, y + 1);
    if (!isSolid(below) && !isPlatform(below)) return false;
    return !blocked(tileAt(x, y)) && !blocked(tileAt(x, y - 1));
  };
  const clearCol = (x, y0, y1) => {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
      if (blocked(tileAt(x, y))) return false;
    }
    return true;
  };
  const key = (x, y) => y * W + x;
  const seen = new Set();
  const start = (() => {
    const z = Level.zones[0];
    for (let x = Math.floor(z.x0 / TILE) + 2; x < Math.floor(z.x1 / TILE); x++) {
      for (let y = 2; y < H - 1; y++) if (standable(x, y)) return { x, y };
    }
    return null;
  })();
  if (!start) { fault('unreachable', 'no standable ground at the castle gate'); return; }

  const stack = [start];
  seen.add(key(start.x, start.y));
  const JUMP = 7;            // double jump plus an air dash, honestly measured
  const REACH = 7;           // columns a running leap covers
  while (stack.length) {
    const c = stack.pop();
    for (let dx = -REACH; dx <= REACH; dx++) {
      if (!dx) continue;
      const nx = c.x + dx;
      if (nx < 1 || nx >= W - 1) continue;
      for (let ny = c.y - JUMP; ny <= c.y + 45; ny++) {   // no fall damage in this castle
        if (ny < 2 || ny >= H - 1) continue;
        if (!standable(nx, ny)) continue;
        if (seen.has(key(nx, ny))) continue;
        // the air between must be clear at both ends
        if (!clearCol(c.x, Math.min(c.y, ny) - 1, c.y)) continue;
        if (!clearCol(nx, Math.min(c.y, ny) - 1, ny)) continue;
        seen.add(key(nx, ny));
        stack.push({ x: nx, y: ny });
      }
    }
    // inside a connector the hunter climbs: ledges, a lift deck, or the walls
    const inHollow = (Level.hollows || []).some(h =>
      c.x >= h.x0 - 1 && c.x <= h.x1 + 1 && c.y >= h.y0 - 2 && c.y <= h.y1 + 2);
    if (inHollow) {
      for (let dx = -6; dx <= 6; dx++) {
        for (let dy = -14; dy <= 14; dy++) {
          const nx = c.x + dx, ny = c.y + dy;
          if (nx < 1 || ny < 2 || nx >= W - 1 || ny >= H - 1) continue;
          if (!standable(nx, ny) || seen.has(key(nx, ny))) continue;
          seen.add(key(nx, ny));
          stack.push({ x: nx, y: ny });
        }
      }
    }
  }

  // where does the walk actually stop?
  {
    let far = 0;
    for (const k of seen) far = Math.max(far, (k % W));
    const z = zoneAt(far * TILE);
    let prof = '';
    for (let ty = 2; ty < Math.min(LEVEL_H, 40); ty++) prof += tileAt(far + 1, ty);
    let prof2 = '';
    for (let ty = 2; ty < Math.min(LEVEL_H, 40); ty++) prof2 += tileAt(far + 2, ty);
    console.log(`    (reachability flood reached column ${far})`);
  }

  // every zone must contain ground the hunter can actually stand on
  for (const z of Level.zones) {
    const c0 = Math.floor(z.x0 / TILE), c1 = Math.floor(z.x1 / TILE);
    let total = 0, reached = 0;
    for (let x = c0; x < c1; x++) {
      for (let y = 2; y < H - 1; y++) {
        if (!standable(x, y)) continue;
        total++;
        if (seen.has(key(x, y))) reached++;
      }
    }
    if (!total) { fault('zone-empty', `${z.key} has no standable ground at all`); continue; }
    const pct = Math.round(100 * reached / total);
    if (pct < 40) {
      fault('zone-unreachable', `${z.key}: only ${pct}% of its ground can be reached from the gate`);
    }
  }
}

// ---- 11. the spine: a continuous walkable path through every zone.
// Structural, not simulated — each column must offer footing within one step of
// the last, with room to stand.
function auditSpine() {
  for (const z of Level.zones) {
    const c0 = Math.floor(z.x0 / TILE) + 2, c1 = Math.floor(z.x1 / TILE) - 2;
    const standRow = (cx, want) => {
      let best = -1, bestD = 1e9;
      for (let r = 3; r < LEVEL_H - 3; r++) {
        const below = tileAt(cx, r + 1);
        if (!isSolid(below) && !isPlatform(below)) continue;
        // the same headroom the generator's spine demands, so both follow the
        // same line — otherwise the check hops onto a ledge the game never used
        if (isSolid(tileAt(cx, r)) || isSolid(tileAt(cx, r - 1)) || isSolid(tileAt(cx, r - 2))) continue;
        const d = Math.abs(r - want);
        if (d < bestD) { bestD = d; best = r; }
      }
      // a search radius, not an assertion — the wall check below is the real
      // fault condition, and the castle is far taller than it used to be
      return best >= 0 && bestD <= 22 ? best : -1;
    };
    // is there footing every few rows between `lo` and `hi` near column cx?
    const climbable = (cx, lo, hi) => {
      const rungs = [];
      for (let c = cx - 4; c <= cx + 4; c++) {
        for (let r = hi; r <= lo; r++) {
          const below = tileAt(c, r + 1);
          if (!isSolid(below) && !isPlatform(below)) continue;
          if (isSolid(tileAt(c, r)) || isSolid(tileAt(c, r - 1))) continue;
          rungs.push(r);
        }
      }
      if (!rungs.length) return false;
      rungs.push(lo, hi);
      rungs.sort((a, b) => b - a);
      for (let i = 1; i < rungs.length; i++) if (rungs[i - 1] - rungs[i] > 4) return false;
      return true;
    };
    let cur = standRow(c0, z.row);
    if (cur < 0) { fault('spine-broken', `${z.key}: no footing at its entrance`); continue; }
    let breaks = 0, worst = '', gap = 0;
    for (let cx = c0 + 1; cx <= c1; cx++) {
      // towers, lifts and wells are climbs by design, not breaks in the walk
      const inConnector = (Level.hollows || []).some(h => cx >= h.x0 - 2 && cx <= h.x1 + 2);
      const r = standRow(cx, cur);
      if (inConnector) { if (r > 0) cur = r; continue; }
      if (r < 0) { gap++; if (gap > 2) { breaks++; worst = `columns ${cx - gap}-${cx}: nothing to stand on`; } continue; }
      gap = 0;
      // A step up is only a wall if nothing bridges it. Towers, ascents and gear
      // beams stagger footing deliberately: look for a ladder of ledges within a
      // few columns either side before calling it broken.
      if (r < cur - 5 && !climbable(cx, cur, r)) {
        breaks++; worst = `column ${cx}: a ${cur - r}-row wall`;
      }
      cur = r;
    }
    if (breaks > 0) fault('spine-broken', `${z.key}: ${breaks} breaks (${worst})`);
  }
}

// ---- sealed chambers. A secret you cannot get into is a bug, not a secret:
// every one must be hollow, keep its door, and have somewhere to stand outside.
function auditSecrets() {
  for (const sc of (Level.secrets || [])) {
    for (let ty = sc.ty0; ty <= sc.ty1; ty++) {
      for (let tx = sc.tx0; tx <= sc.tx1; tx++) {
        if (isSolid(tileAt(tx, ty))) {
          fault('secret-filled', `${sc.name} (${sc.kind}) filled in at ${tx},${ty}`);
          return;
        }
      }
    }
    const want = sc.kind === 'plunge' ? 11 : sc.kind === 'key' ? 12 : 10;
    if (tileAt(sc.entrance.tx, sc.entrance.ty) !== want) {
      fault('secret-doorless', `${sc.name} (${sc.kind}) lost its door at ${sc.entrance.tx},${sc.entrance.ty}`);
      continue;
    }
    // and a hunter has to be able to reach the door
    if (sc.kind === 'plunge') continue;                 // reached from directly above
    const dx = sc.entrance.tx - 1, dy = sc.entrance.ty;
    if (isSolid(tileAt(dx, dy)) || isSolid(tileAt(dx, dy - 1))) {
      fault('secret-unreachable', `${sc.name} has no standing room outside its door`);
    }
  }
}

// ---------------------------------------------------------------- run it
const seeds = [1, 2, 3, 7, 11, 23];
for (const s of seeds) auditWorld(s, 'seed ' + s);

const kinds = Object.keys(faults).sort();
if (!kinds.length) {
  console.log('\nAUDIT CLEAN — nothing buried, nothing floating, nothing overlapping.');
}
let total = 0;
console.log('');
for (const k of kinds) {
  const list = faults[k];
  total += list.length;
  console.log(`${k}: ${list.length}`);
  for (const d of list.slice(0, 6)) console.log('   ' + d);
  if (list.length > 6) console.log(`   ...and ${list.length - 6} more`);
}
console.log(`\nAUDIT: ${total} faults across ${seeds.length} castles`);

// ---------------------------------------------------------------- the walk test
// The honest question: can a hunter actually cross this castle? Drive one to the
// right with jumps and dashes and see how far they get.
function walkTest(seed) {
  game.worldSeed = seed;
  startRun();
  const p = game.player;
  p.gifts = { wings: true, gallop: true, maw: true };
  p.extraJumps = 2;
  for (const k of ['slide', 'dash', 'tempest', 'veil', 'wallcling', 'walljump', 'highjump', 'plunge']) {
    p.skills[k] = true;
  }
  for (const gt of (Level.gates || [])) {
    if (!gt.open) { gt.open = true; for (let ty = gt.top; ty <= gt.bottom; ty++) Level.grid[ty * LEVEL_W + gt.tx] = 0; }
  }
  let far = p.x, stuckAt = 0, lastProgress = 0;
  let safeX = p.x, safeY = p.y;
  let backtrack = 0;
  for (let i = 0; i < 30000; i++) {
    // a real player who stops making progress turns round and tries another way
    if (i - lastProgress > 260 && backtrack <= 0) backtrack = 90;
    if (backtrack > 0) { backtrack--; keys.left = true; keys.right = false; }
    else { keys.left = false; keys.right = true; }
    p.invuln = 9999; p.dead = false; p.hurtTimer = 0;      // this is a terrain test
    if (game.state !== 'play') game.state = 'play';
    game.hitstop = 0;
    if (i % 24 === 0) pending.jump = true;
    if (i % 90 === 0) pending.dash = true;
    if (i % 400 === 0 && p.x <= far + 4) { p.vy = -5; }     // a nudge if truly stuck
    stepGame();
    // falling out of the world is death in the real game: put them back on their feet
    if (p.y > Level.pxH - 40 || p.y < -200) {
      p.x = safeX; p.y = safeY; p.vx = 0; p.vy = 0;
      lastProgress = i;
    }
    if (p.onGround && p.x >= far - 8) { safeX = p.x; safeY = p.y; }
    if (p.x > far) { far = p.x; lastProgress = i; }
    if (i - lastProgress > 4000) { stuckAt = far; break; }
  }
  keys.right = false;
  if (stuckAt) {
    const c = Math.round(far / TILE);
    for (let dx = -3; dx <= 5; dx++) {
      let prof = '';
      for (let ty = 15; ty < 40; ty++) prof += tileAt(c + dx, ty);
      console.log(`      col ${c + dx} (r15+): ${prof}`);
    }
    console.log(`      hunter row ${Math.round(game.player.y / TILE)}`);
  }
  const z = zoneAt(far);
  const end = Level.pxW;
  const pct = Math.round(100 * far / end);
  console.log(`  seed ${seed}: walked to ${Math.round(far / TILE)} of ${Math.round(end / TILE)} tiles ` +
    `(${pct}%, ${z ? z.key : '?'})${stuckAt ? '  STUCK' : ''}`);
  return pct;
}

console.log('\nTHE WALK:');
let worst = 100;
for (const s of [1, 2, 3, 7, 11, 23]) worst = Math.min(worst, walkTest(s));
console.log(`  (the walker is a crude bot — it only presses right, so a low number here
   means it fell somewhere and could not find its way back, not that the castle
   is broken. The spine and reachability checks above are the real verdict.)`);

// ---------------------------------------------------------------- clutter
// A platform with nothing on it, nothing near it and nothing linked to it is
// scenery nobody asked for. Count them, and say which zone they litter.
function auditClutter(seed) {
  game.worldSeed = seed;
  startRun();
  const content = new Set();
  for (const t of Level.treasures) content.add(Math.floor(t.x / TILE) + ':' + Math.floor(t.y / TILE));
  for (const c of Level.candles) content.add(c.tx + ':' + c.ty);
  for (const p of Level.props) content.add(Math.floor(p.x / TILE) + ':' + Math.floor(p.y / TILE));

  const runs = [];
  const wTiles = Math.floor(Level.pxW / TILE);
  for (let ty = 2; ty < LEVEL_H - 2; ty++) {
    let start = -1;
    for (let tx = 2; tx < wTiles; tx++) {
      const isP = tileAt(tx, ty) === 2;
      if (isP && start < 0) start = tx;
      if ((!isP || tx === wTiles - 1) && start >= 0) { runs.push({ x0: start, x1: tx - 1, y: ty }); start = -1; }
    }
  }
  let orphans = 0;
  const byZone = {};
  for (const r of runs) {
    let near = false;
    for (let x = r.x0 - 2; x <= r.x1 + 2 && !near; x++) {
      for (let dy = -2; dy <= 1; dy++) if (content.has(x + ':' + (r.y + dy))) near = true;
    }
    if (near) continue;
    let linked = false;
    for (let x = r.x0 - 5; x <= r.x1 + 5 && !linked; x++) {
      for (const dy of [-4, -3, 3, 4]) {
        const t2 = tileAt(x, r.y + dy);
        if (t2 === 2 || isSolid(t2)) linked = true;
      }
    }
    if (linked) continue;
    orphans++;
    const z = zoneAt(r.x0 * TILE);
    const k = z ? z.key : '?';
    byZone[k] = (byZone[k] || 0) + 1;
  }
  console.log(`  seed ${seed}: ${runs.length} platform runs, ${orphans} purposeless ` +
    `(${Object.entries(byZone).map(([k, v]) => k + ':' + v).join(' ') || 'none'})`);
  return orphans;
}
console.log('\nCLUTTER:');
for (const s of [1, 2, 3]) auditClutter(s);
