// Level: tile grid built programmatically + collision queries + parallax background.
// Tile ids: 0 empty, 1 brick (solid), 2 wooden platform (one-way), 3 spikes, 4 foundation (solid)

const LEVEL_W = 4608;  // the whole castle, in one grid
const LEVEL_H = 100;

const Level = {
  grid: null,
  candles: [],
  zombieZones: [],
  bats: [],
  medusaZones: [],
  boss: null,
  pxW: LEVEL_W * TILE,
  pxH: LEVEL_H * TILE,
};

function tset(x, y, id) {
  if (x < 0 || y < 0 || x >= LEVEL_W || y >= LEVEL_H) return;
  Level.grid[y * LEVEL_W + x] = id;
}

function tileAt(tx, ty) {
  if (tx < 0 || tx >= LEVEL_W) return 1;      // side walls are solid
  if (ty < 0 || ty >= LEVEL_H) return 0;      // open sky above, open pit below
  return Level.grid[ty * LEVEL_W + tx];
}

const isSolid = id => id === 1 || id === 4 || id === 10 || id === 11 || id === 12 || id === 13 || id === 14;   // 10 secret, 11 cracked, 12 locked gate, 13 ore vein
const isPlatform = id => id === 2;
const isSpike = id => id === 3;
const isBlood = id => id === 15;

function rectFill(x0, y0, x1, y1, id) {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) tset(x, y, id);
}

function ground(x0, x1) {
  rectFill(x0, G, x1, G, 1);
  rectFill(x0, G + 1, x1, G + 1, 4);
  noteGround(x0, x1, G);
}

function platform(x, y, w) {
  for (let i = 0; i < w; i++) tset(x + i, y, 2);
}

function spikes(x0, x1) {
  rectFill(x0, G + 1, x1, G + 1, 3);
}

function candle(x, y, drop) {
  Level.candles.push({ tx: x, ty: y, drop: drop || null });
}

// ---------------------------------------------------------------- stage generator
// Each stage is assembled from segment vocabulary with a seeded RNG, so every
// descent reshapes the castle while staying traversable.
let rngState = 1;
function srand(seed) { rngState = (seed >>> 0) || 1; }
function rnd() {
  rngState |= 0; rngState = (rngState + 0x6D2B79F5) | 0;
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const rc = arr => arr[Math.floor(rnd() * arr.length)];

let G = 12;              // the elevation the builder is currently working at
const G_BASE = 40;       // where every stage starts and where the arena sits
const G_MIN = 4, G_MAX = 92;

// The floor row of each column, recorded as the castle is built, so decorations
// placed afterwards can find the ground wherever it happens to be.
let groundRow = new Int16Array(LEVEL_W);
function noteGround(x0, x1, row) {
  for (let cx = Math.max(0, x0); cx <= Math.min(LEVEL_W - 1, x1); cx++) groundRow[cx] = row;
}
// The topmost standable row in a column, read from the grid itself rather than
// from bookkeeping — every builder writes tiles, but not all of them remember to
// record what they wrote.
function surfaceRow(cx) {
  if (cx < 0 || cx >= LEVEL_W) return -1;
  for (let ty = 1; ty < LEVEL_H; ty++) {
    if (!isSolid(Level.grid[ty * LEVEL_W + cx])) continue;
    if (Level.grid[(ty - 1) * LEVEL_W + cx] === 0) return ty;
  }
  return -1;
}

// nearest standable floor row, searching outward if that column is a pit
function gtop(cx) {
  for (let d = 0; d < 40; d++) {
    for (const c of [cx + d, cx - d]) {
      const r = surfaceRow(c);
      if (r > 0) return r;
    }
  }
  return G_BASE;
}

// Wipe the castle back to bare grid. Called once, before the zones are raised.
function resetWorld() {
  groundRow = new Int16Array(LEVEL_W);
  Level.grid = new Uint8Array(LEVEL_W * LEVEL_H);
  Level.candles = [];
  Level.zombieZones = [];
  Level.bats = [];
  Level.medusaZones = [];
  Level.hounds = [];
  Level.props = [];
  Level.rainX0 = -99999; Level.rainX1 = -99999;
  Level.graveyard = null;
  Level.glimmers = [];
  Level.treasures = [];
  Level.wolves = [];
  Level.obelisks = [];
  Level.lifts = [];
  Level.landmarks = [];
  Level.drafts = [];
  Level.gargoyles = [];
  Level.regions = [];
  Level.sigils = [];
  Level.zones = [];
  Level.throwers = [];
  Level.spiders = [];
  Level.pendulums = [];
  Level.hollows = [];   // shafts that later passes must not fill or floor
  Level.skyIslands = [];
  Level.secrets = [];
  Level.scenes = [];
  Level.bosses = [];
  Level.gates = [];
  Level.biome = 'castle';
}

// Raise one zone of the castle: a stretch of halls in its own stone, with its
// own guardian if it keeps one. Returns the column it ends at.
function buildZoneInto(zone, startX) {
  const stage = zone.danger + 1;          // the deeper the zone, the crueller
  G = zone.row;
  const path = null;
  const epicBoost = zone.danger * 0.25;

  let shrines = 0, secrets = 0;
  const secretCap = 2;
  // find solid ground with headroom near a column, for placing standing things
  function groundNear(cx) {
    for (let d = 0; d < 60; d++) {
      for (const c of [cx + d, cx - d]) {
        if (c <= 2 || c >= LEVEL_W - 2) continue;
        const r = groundRow[c];
        if (r > 0 && tileAt(c, r) === 1 && tileAt(c, r - 1) === 0 && tileAt(c, r - 2) === 0) return c;
      }
    }
    return null;
  }
  const drops = ['whip', rc(SUB_KEYS), 'orb'];
  const takeDrop = () => drops.length ? drops.shift() : null;
  const addCandle = (cx, standRow, forced) =>
    Level.candles.push({ tx: cx, ty: standRow - 2, drop: forced || null });
  const g2 = (x0, x1) => {
    rectFill(x0, G, x1, G, 1);
    rectFill(x0, G + 1, x1, G + 1, 4);
    noteGround(x0, x1, G);
  };

  let x = startX;
  if (startX <= 2) rectFill(0, 0, 1, G + 1, 1);   // the castle's outer wall

  function segGround(len) {
    g2(x, x + len);
    for (let cx = x + 2; cx < x + len - 1; cx += ri(4, 6)) {
      addCandle(cx, G, rnd() < 0.25 ? takeDrop() : null);
    }
    Level.zombieZones.push({
      x0: (x + 1) * TILE, x1: (x + len - 1) * TILE,
      groundY: G * TILE, max: 2 + Math.min(2, (stage / 2) | 0),
    });
    if (rnd() < 0.55 && shrines < 2) {
      shrines++;
      Level.props.push({ type: 'shrine', x: (x + ri(3, len - 3)) * TILE, y: G * TILE });
    } else {
      Level.props.push({ type: 'statue', x: (x + ri(3, len - 3)) * TILE, y: G * TILE });
    }
    if (rnd() < 0.5 && secrets < secretCap) { secrets++; tset(x + ri(2, len - 2), G, 10); }
    if (rnd() < 0.35 && Level.glimmers.length < 2) {
      Level.glimmers.push({ x: (x + ri(2, len - 2)) * TILE + 8, y: G * TILE, found: false });
    }
    x += len + 1;
  }

  function segPits(len) {
    let cx = x;
    const end = x + len;
    g2(cx, cx + 3); cx += 4;
    while (cx < end - 4) {
      const gap = ri(3, 4);
      spikes(cx, cx + gap - 1);
      if (rnd() < 0.7) platform(cx + ((gap / 2) | 0), 10, 2);
      if (rnd() < 0.6) Level.bats.push({ x: (cx + 1) * TILE, y: 8 * TILE });
      cx += gap;
      const ledge = ri(3, 5);
      g2(cx, Math.min(end, cx + ledge));
      if (rnd() < 0.5) addCandle(cx + 1, G, rnd() < 0.2 ? takeDrop() : null);
      cx += ledge;
    }
    g2(Math.max(x, cx - 1), end);
    x = end + 1;
  }

  function segHall(len) {
    g2(x, x + len);
    const d0 = x + 2, d1 = x + len - 3;
    const deck = G - 4;                        // the gallery, four rows up
    platform(d0, deck, d1 - d0);
    for (let cx = d0 + 2; cx < d1 - 1; cx += ri(5, 7)) addCandle(cx, deck);
    for (let cx = x + 2; cx < x + len - 1; cx += ri(4, 6)) {
      addCandle(cx, G, rnd() < 0.2 ? takeDrop() : null);
    }
    const dx = x + ri(4, len - 6);
    rectFill(dx, G - 2, dx + 2, G - 1, 1);     // a block to climb, and hide things in
    if (rnd() < 0.6 && secrets < secretCap) { secrets++; tset(dx + 1, G - 2, 10); }
    Level.zombieZones.push({
      x0: (x + 1) * TILE, x1: (x + len - 1) * TILE,
      groundY: G * TILE, max: 2 + Math.min(2, (stage / 2) | 0),
    });
    Level.medusaZones.push({ x0: x * TILE, x1: (x + len) * TILE });
    Level.props.push({ type: 'banner', x: (d0 + 2) * TILE, y: (deck - 4) * TILE + 6 });
    Level.props.push({ type: 'banner', x: (d1 - 3) * TILE, y: (deck - 4) * TILE + 6 });
    Level.props.push({ type: 'chain', x: (x + (len >> 1)) * TILE + 4, y: (deck - 4) * TILE + 6, len: 22 });
    Level.props.push({ type: 'statue', x: (x + ri(3, len - 3)) * TILE, y: G * TILE });
    x += len + 1;
  }

  function segAscent(len) {
    // a climb over a spiked floor — every row measured from this zone's own ground
    g2(x, x + 2);
    spikes(x + 3, x + len - 4);
    const rows = [G - 2, G - 4, G - 6, G - 4, G - 2];
    let px = x + 2;
    for (const r of rows) {
      if (px > x + len - 4) break;
      platform(px, Math.max(2, r), 3);
      if (rnd() < 0.6) addCandle(px + 1, Math.max(2, r));
      px += ri(3, 4);                          // close enough to actually leap
    }
    if (rnd() < 0.7) Level.bats.push({ x: (x + (len >> 1)) * TILE, y: Math.max(2, G - 8) * TILE });
    g2(x + len - 3, x + len);
    x += len + 1;
  }

  function segGraveyard(len) {
    g2(x, x + len);
    for (let cx = x + 2; cx < x + len - 1; cx += ri(3, 5)) {
      if (rnd() < 0.7) Level.props.push({ type: 'grave', x: cx * TILE, y: G * TILE, v: ri(0, 1) });
    }
    for (let cx = x + 3; cx < x + len - 2; cx += ri(5, 7)) addCandle(cx, G);
    Level.zombieZones.push({
      x0: (x + 1) * TILE, x1: (x + len - 1) * TILE,
      groundY: G * TILE, max: 3 + Math.min(2, (stage / 2) | 0),
    });
    Level.graveyard = { x0: x * TILE, x1: (x + len) * TILE };
    Level.wolves.push({ x: (x + ri(3, len - 3)) * TILE, y: G * TILE });
    if (rnd() < 0.4 && secrets < secretCap) { secrets++; tset(x + ri(2, len - 2), G, 10); }
    x += len + 1;
  }

  function segBattlements(len) {
    const top = Math.max(2, G - 5);         // the walkway, five rows above the path
    rectFill(x, G - 2, x + 1, G + 1, 1);    // entry steps
    rectFill(x + 2, G - 4, x + 3, G + 1, 1);
    const p0 = x + 4, p1 = x + len - 5;
    rectFill(p0, top, p1, G + 1, 1);
    rectFill(p0, top + 2, p1, G + 1, 4);
    noteGround(p0, p1, top);
    for (let cx = p0 + 1; cx <= p1 - 1; cx += 4) tset(cx, top - 1, 1);
    for (let cx = p0 + 2; cx < p1 - 1; cx += ri(6, 8)) {
      addCandle(cx, top, rnd() < 0.15 ? takeDrop() : null);
    }
    Level.medusaZones.push({ x0: p0 * TILE, x1: p1 * TILE });
    Level.hounds.push({ x: (p0 + ri(2, Math.max(3, p1 - p0 - 2))) * TILE, y: top * TILE });
    Level.wolves.push({ x: (p0 + ri(2, Math.max(3, p1 - p0 - 2))) * TILE, y: top * TILE });
    Level.rainX0 = (x - 4) * TILE;
    Level.rainX1 = (x + len + 4) * TILE;
    rectFill(p1 + 1, top + 2, p1 + 2, G + 1, 1);  // exit steps
    rectFill(p1 + 3, G - 1, p1 + 4, G + 1, 1);
    g2(p1 + 3, x + len);
    x += len + 1;
  }

  // ---- rooms that belong to one place and nowhere else ---------------------

  // CHAPEL: a nave. Tall pillars, rows of pews, a choir loft above the aisle.
  function segNave(len) {
    const top = Math.max(2, G - 13);
    g2(x, x + len);
    // the aisle walls — with doorways, or the nave is a tomb with you inside it
    rectFill(x, top, x, G + 1, 1);
    rectFill(x + len, top, x + len, G + 1, 1);
    rectFill(x, G - 3, x, G, 0);
    rectFill(x + len, G - 3, x + len, G, 0);
    // pillars down both sides, with arches between them
    // Pillars are scenery, not masonry — a solid column standing on the walking
    // floor is simply a wall, and a nave full of them is impassable.
    for (let cx = x + 4; cx < x + len - 3; cx += 7) {
      // the arch it carries, high overhead and well clear of the hunter's head
      tset(cx, G - 9, 1);
      tset(cx, G - 10, 1);
      Level.props.push({ type: 'pillar', x: cx * TILE, y: (G - 1) * TILE });
      if (rnd() < 0.5) Level.props.push({ type: 'chandelier', x: (cx + 3) * TILE, y: (top + 2) * TILE });
    }
    // pews: low platforms in rows along the floor
    for (let cx = x + 3; cx < x + len - 4; cx += 5) {
      platform(cx, G - 3, 3);
      if (rnd() < 0.4) addCandle(cx + 1, G - 3);
    }
    // the choir loft, high on one side, with something worth the climb
    const lx = x + ri(4, Math.max(5, len - 10));
    platform(lx, top + 4, 6);
    Level.treasures.push({
      x: (lx + 2) * TILE, y: (top + 3) * TILE + 6,
      kind: rnd() < 0.5 ? 'relic' : 'chest', data: null,
    });
    addCandle(lx + 4, top + 4);
    Level.sigils.push({ x: (x + 2) * TILE, y: G * TILE, icon: 'wing' });
    Level.medusaZones.push({ x0: x * TILE, x1: (x + len) * TILE });
    Level.zombieZones.push({
      x0: (x + 1) * TILE, x1: (x + len - 1) * TILE,
      groundY: G * TILE, max: 2 + Math.min(3, (stage / 2) | 0),
    });
    x += len + 1;
  }

  // GRAVEYARD: a sunken crypt. You drop in through a broken roof.
  function segCrypt(len) {
    g2(x, x + len);
    const floor = G + 5;
    // hollow the ground out beneath, leaving a roof with a hole in it
    rectFill(x + 2, G + 1, x + len - 2, floor, 0);
    rectFill(x + 2, floor + 1, x + len - 2, floor + 1, 1);
    noteGround(x + 2, x + len - 2, floor + 1);
    const hole = x + ri(3, Math.max(4, len - 4));
    tset(hole, G, 0);
    tset(hole + 1, G, 0);
    // sarcophagi along the crypt floor
    for (let cx = x + 3; cx < x + len - 3; cx += 5) {
      Level.props.push({ type: 'sarcophagus', x: cx * TILE, y: floor * TILE });
      if (rnd() < 0.5) addCandle(cx + 1, floor + 1);
    }
    Level.zombieZones.push({
      x0: (x + 2) * TILE, x1: (x + len - 2) * TILE,
      groundY: (floor + 1) * TILE, max: 3 + Math.min(3, (stage / 2) | 0),
    });
    Level.treasures.push({
      x: (x + len - 4) * TILE, y: floor * TILE + 4,
      kind: 'relic', data: rollRelic(1.2 + stage * 0.15),
    });
    for (let cx = x + 2; cx < x + len - 2; cx += 4) {
      if (rnd() < 0.6) Level.props.push({ type: 'grave', x: cx * TILE, y: G * TILE, v: ri(0, 1) });
    }
    // A stair back out, climbing to the very hole you fell through — anywhere
    // else and the crypt is a grave of your own.
    const hx = Math.max(x + 3, Math.min(x + len - 5, hole));
    tset(hx, G, 0); tset(hx + 1, G, 0);
    let stepRow = floor - 1, side = 0;
    while (stepRow > G) {
      const px = side ? hx - 3 : hx + 1;
      platform(Math.max(x + 2, Math.min(x + len - 4, px)), stepRow, 3);
      stepRow -= 2;
      side ^= 1;
    }
    // and a lip beside the hole above, to pull yourself onto
    platform(hx + 2, G - 1, 3);
    Level.graveyard = { x0: x * TILE, x1: (x + len) * TILE };
    x += len + 1;
  }

  // CATACOMBS: a warren. Low, cramped, and full of niches you must crouch into.
  function segWarren(len) {
    g2(x, x + len);
    // a ceiling pressed down close over the whole passage
    rectFill(x, G - 4, x + len, G - 4, 1);
    rectFill(x, G - 5, x + len, G - 5, 4);
    for (let cx = x + 2; cx < x + len - 1; cx += ri(3, 5)) {
      // alternating stalactite teeth and floor blocks: the way is never straight
      if (rnd() < 0.5) tset(cx, G - 3, 1);
      else { tset(cx, G - 1, 1); if (rnd() < 0.3) tset(cx, G - 2, 1); }
    }
    // bone niches carved into the wall, some holding something
    for (let cx = x + 3; cx < x + len - 3; cx += 6) {
      rectFill(cx, G - 3, cx + 1, G - 3, 0);
      if (rnd() < 0.45) {
        Level.treasures.push({ x: cx * TILE + 4, y: (G - 2) * TILE + 4, kind: rnd() < 0.4 ? 'relic' : 'heart' });
      }
      if (rnd() < 0.5) addCandle(cx, G);
    }
    Level.zombieZones.push({
      x0: (x + 1) * TILE, x1: (x + len - 1) * TILE,
      groundY: G * TILE, max: 2 + Math.min(3, (stage / 2) | 0),
    });
    x += len + 1;
  }

  // DROWNED CISTERN: flooded vaults. The water drags at you until you carry
  // the drowned breath, so the low course is a hazard and the arcade is the road.
  function segCistern(len) {
    g2(x, x + len);
    const top = Math.max(2, G - 12);
    rectFill(x, top, x, G + 1, 1);
    rectFill(x + len, top, x + len, G + 1, 1);
    rectFill(x, G - 3, x, G, 0);
    rectFill(x + len, G - 3, x + len, G, 0);
    // standing water lying in the low courses — patches, never the whole span,
    // or there is nothing left to walk on
    for (let cx = x + 3; cx < x + len - 4; cx += ri(7, 11)) {
      const pool = ri(3, 6);
      for (let i = 0; i < pool && cx + i < x + len - 2; i++) tset(cx + i, G, 15);
      noteGround(cx, cx + pool - 1, G);
    }
    noteGround(x, x + len, G);
    // an arcade of low arches you can run along above the water
    for (let cx = x + 4; cx < x + len - 4; cx += ri(7, 10)) {
      const wide = ri(3, 5), lift = ri(3, 5);
      platform(cx, G - lift, wide);
      if (rnd() < 0.6) addCandle(cx + 1, G - lift);
      // a pillar holding the arch up — scenery, never a wall across the floor
      Level.props.push({ type: 'pillar', x: (cx + wide) * TILE, y: (G - 1) * TILE });
      rectFill(cx - 1, top + 2, cx + wide + 1, top + 2, 1);
      if (rnd() < 0.4) {
        Level.treasures.push({ x: cx * TILE + 6, y: (G - lift - 2) * TILE, kind: rnd() < 0.4 ? 'relic' : 'gem' });
      }
      if (rnd() < 0.5) {
        Level.props.push({ type: 'chandelier', x: (cx + 1) * TILE, y: (top + 3) * TILE });
      }
    }
    Level.bats.push({ x: (x + (len >> 1)) * TILE, y: (top + 4) * TILE });
    Level.medusaZones.push({ x0: x * TILE, x1: (x + len) * TILE });
    x += len + 1;
  }

  // BLACK FOUNDRY: catwalks over the melt. Fire below, chains above.
  function segFoundry(len) {
    rectFill(x, G, x + 3, G + 1, 1);
    noteGround(x, x + 3, G);
    const top = Math.max(2, G - 13);
    rectFill(x, top, x, G + 1, 1);
    rectFill(x + len, top, x + len, G + 1, 1);
    rectFill(x, G - 3, x, G, 0);
    rectFill(x + len, G - 3, x + len, G, 0);
    // the crucible floor: a trough of fire you must cross above
    for (let cx = x + 4; cx < x + len - 3; cx++) tset(cx, G + 1, 3);
    let cx = x + 4;
    while (cx < x + len - 5) {
      const walk = ri(4, 7);
      platform(cx, G - 2, walk);
      if (rnd() < 0.55) addCandle(cx + 1, G - 2);
      // a hoist chain and a hanging crucible over the catwalk
      if (rnd() < 0.5) {
        Level.props.push({ type: 'chain', x: (cx + 2) * TILE, y: (top + 1) * TILE, len: ri(20, 46) });
      }
      if (rnd() < 0.45) {
        Level.props.push({ type: 'gear', x: (cx + 2) * TILE, y: (G - 8) * TILE, r: ri(9, 15) });
      }
      if (rnd() < 0.35) {
        Level.treasures.push({ x: (cx + 1) * TILE + 4, y: (G - 4) * TILE, kind: 'ore' });
      }
      cx += walk + ri(2, 4);
    }
    rectFill(x + len - 3, G, x + len, G + 1, 1);
    noteGround(x + len - 3, x + len, G);
    Level.throwers = Level.throwers || [];
    Level.throwers.push({ x: (x + (len >> 1)) * TILE, y: (G - 3) * TILE });
    x += len + 1;
  }

  // MIRROR GALLERY: a long hall of glass. What stands in the mirrors is not you.
  function segGallery(len) {
    g2(x, x + len);
    const top = Math.max(2, G - 12);
    rectFill(x, top, x, G + 1, 1);
    rectFill(x + len, top, x + len, G + 1, 1);
    rectFill(x, G - 3, x, G, 0);
    rectFill(x + len, G - 3, x + len, G, 0);
    rectFill(x + 1, top, x + len - 1, top, 1);
    // mirrors down the length of the hall, and a balcony facing them
    for (let cx = x + 3; cx < x + len - 3; cx += ri(5, 7)) {
      Level.props.push({ type: 'mirror', x: cx * TILE, y: (G - 1) * TILE, v: ri(0, 1) });
      if (rnd() < 0.5) addCandle(cx + 2, G);
    }
    const bal = ri(4, 6);
    for (let cx = x + 5; cx < x + len - 6; cx += ri(9, 13)) {
      platform(cx, G - bal, ri(4, 7));
      if (rnd() < 0.45) {
        Level.treasures.push({ x: cx * TILE + 6, y: (G - bal - 2) * TILE, kind: rnd() < 0.5 ? 'relic' : 'card' });
      }
    }
    // one pane is thin enough to step through, if you carry the mist
    const thin = x + ri(4, Math.max(5, len - 5));
    for (let ty = G - 4; ty <= G; ty++) tset(thin, ty, 10);
    Level.medusaZones.push({ x0: x * TILE, x1: (x + len) * TILE });
    Level.zombieZones.push({
      x0: (x + 1) * TILE, x1: (x + len - 1) * TILE,
      groundY: G * TILE, max: 2 + Math.min(3, (stage / 2) | 0),
    });
    x += len + 1;
  }

  // FROZEN SPIRE: open ledges above the cloud, ice underfoot.
  function segFrostwalk(len) {
    rectFill(x, G, x + 3, G + 1, 1);
    noteGround(x, x + 3, G);
    let cx = x + 4;
    while (cx < x + len - 4) {
      const gap = ri(3, 6);
      cx += gap;
      const ledge = ri(4, 8);
      rectFill(cx, G, cx + ledge, G, 1);
      rectFill(cx, G + 1, cx + ledge, G + 1, 4);
      noteGround(cx, cx + ledge, G);
      // an icicle bank hanging over the gap you just crossed
      if (rnd() < 0.6) {
        for (let i = 0; i < ri(2, 4); i++) tset(cx - gap + i + 1, G - 6, 3);
      }
      if (rnd() < 0.5) addCandle(cx + 1, G);
      if (rnd() < 0.4) {
        platform(cx + 1, G - ri(4, 6), ri(3, 5));
        if (rnd() < 0.5) {
          Level.treasures.push({ x: (cx + 2) * TILE, y: (G - 8) * TILE, kind: rnd() < 0.4 ? 'relic' : 'heart' });
        }
      }
      cx += ledge;
    }
    rectFill(x + len - 3, G, x + len, G + 1, 1);
    noteGround(x + len - 3, x + len, G);
    Level.bats.push({ x: (x + (len >> 1)) * TILE, y: (G - 9) * TILE });
    x += len + 1;
  }

  // CLOCK RUIN: gears and pendulums. Narrow beams over a long drop.
  function segGears(len) {
    // the floor is mostly gone: beams across a void
    rectFill(x, G, x + 2, G + 1, 1);
    noteGround(x, x + 2, G);
    let cx = x + 3;
    while (cx < x + len - 3) {
      const gap = ri(3, 5);
      cx += gap;
      const beam = ri(3, 5);
      platform(cx, G, beam);
      if (rnd() < 0.5) addCandle(cx + 1, G);
      // a cog turning above the beam, and a pendulum sweeping the gap
      if (rnd() < 0.55) {
        Level.props.push({ type: 'gear', x: (cx + 1) * TILE, y: (G - 7) * TILE, r: ri(10, 16) });
      }
      if (rnd() < 0.6) {
        const pivot = Math.max(3, G - 11);
        if (!isSolid(tileAt(cx - (gap >> 1), pivot))) Level.pendulums.push({
          x: (cx - (gap >> 1)) * TILE, y: pivot * TILE,
          len: ri(112, 150), amp: 0.85 + rnd() * 0.5, phase: rnd() * 7, speed: 0.018 + rnd() * 0.012,
        });
      }
      cx += beam;
    }
    rectFill(x + len - 2, G, x + len, G + 1, 1);
    noteGround(x + len - 2, x + len, G);
    // the clock face itself, hanging over the works
    Level.props.push({ type: 'gear', x: (x + (len >> 1)) * TILE, y: (G - 16) * TILE, r: 24 });
    Level.medusaZones.push({ x0: x * TILE, x1: (x + len) * TILE });
    x += len + 1;
  }

  // BLOOD KEEP: a throne hall. Wide, red, and standing in it costs you.
  function segThrone(len) {
    g2(x, x + len);
    const top = Math.max(2, G - 11);
    rectFill(x, top, x, G + 1, 1);
    rectFill(x + len, top, x + len, G + 1, 1);
    rectFill(x, G - 3, x, G, 0);
    rectFill(x + len, G - 3, x + len, G, 0);
    // pools of old blood sunk into the floor
    for (let cx = x + 4; cx < x + len - 4; cx += ri(6, 9)) {
      const w2 = ri(2, 4);
      for (let i = 0; i < w2; i++) { tset(cx + i, G, 15); }
      noteGround(cx, cx + w2 - 1, G);
    }
    // a gallery running above the hall, reachable only from the ends
    platform(x + 3, G - 6, len - 6);
    for (let cx = x + 5; cx < x + len - 4; cx += 6) addCandle(cx, G - 6);
    Level.props.push({ type: 'throne', x: (x + len - 6) * TILE, y: G * TILE });
    Level.props.push({ type: 'banner', x: (x + 4) * TILE, y: (top + 2) * TILE });
    Level.props.push({ type: 'banner', x: (x + len - 4) * TILE, y: (top + 2) * TILE });
    Level.treasures.push({
      x: (x + len - 6) * TILE + 4, y: (G - 1) * TILE,
      kind: 'relic', data: rollRelic(1.8 + stage * 0.15),
    });
    Level.zombieZones.push({
      x0: (x + 1) * TILE, x1: (x + len - 1) * TILE,
      groundY: G * TILE, max: 3 + Math.min(3, (stage / 2) | 0),
    });
    Level.hounds.push({ x: (x + (len >> 1)) * TILE, y: G * TILE });
    x += len + 1;
  }

  // LUNAR HEART: moonstone islands over nothing, and the wind between them.
  function segMoonbridge(len) {
    rectFill(x, G, x + 3, G + 1, 1);
    noteGround(x, x + 3, G);
    let cx = x + 4;
    while (cx < x + len - 4) {
      const gap = ri(4, 7);
      // the wind holds you up as you cross
      Level.drafts.push({
        x: cx * TILE, y: (G - 10) * TILE,
        w: gap * TILE, h: 16 * TILE, force: 0.34,
      });
      cx += gap;
      const isle = ri(3, 5);
      const rise = ri(-3, 1);
      rectFill(cx, G + rise, cx + isle, G + rise, 1);
      noteGround(cx, cx + isle, G + rise);
      if (rnd() < 0.6) addCandle(cx + 1, G + rise);
      if (rnd() < 0.35) {
        Level.treasures.push({ x: (cx + 1) * TILE + 4, y: (G + rise - 1) * TILE + 4, kind: 'relic' });
      }
      Level.props.push({ type: 'crystal', x: (cx + 2) * TILE, y: (G + rise) * TILE });
      if (rnd() < 0.5) Level.bats.push({ x: (cx - 1) * TILE, y: (G - 6) * TILE });
      cx += isle;
    }
    rectFill(x + len - 3, G, x + len, G + 1, 1);
    noteGround(x + len - 3, x + len, G);
    x += len + 1;
  }

  // ---- vertical connectors -------------------------------------------------
  // A tower: a chimney that lifts the path several rows. Built in four beats —
  // introduce the climb somewhere safe, develop it, twist it, then pay it off.
  function segTower(rise) {
    rise = Math.min(rise, G - G_MIN);
    if (rise < 3) { segGround(ri(10, 14)); return; }
    const w = 9;
    rectFill(x, G - rise - 3, x, G + 1, 1);
    rectFill(x + w, G - rise - 3, x + w, G + 1, 1);
    rectFill(x + 1, G - rise - 2, x + w - 1, G - 1, 0);
    // the interior only: the floors that cap the chimney are not part of it
    Level.hollows.push({ x0: x + 1, y0: G - rise + 2, x1: x + w - 1, y1: G - 1 });
    g2(x + 1, x + w - 1);

    const top = G - rise;
    const twist = rc(['ambush', 'gap', 'crumble']);
    let side = rnd() < 0.5 ? 0 : 1;
    let beat = 0;
    const rows = [];
    for (let r = G - 3; r > top; r -= 3) rows.push(r);

    rows.forEach((r, i) => {
      const frac = i / Math.max(1, rows.length - 1);
      const px = side ? x + 1 : x + w - 4;
      if (frac < 0.3) {
        // KI — the introduction: wide, close ledges. Nobody falls here.
        platform(px, r, 5);
        if (i === 0) addCandle(px + 2, r);
      } else if (frac < 0.62) {
        // SHO — development: the same idea, asking a little more
        platform(px, r, 4);
        if (rnd() < 0.5) addCandle(px + 1, r);
      } else if (frac < 0.85 && !beat) {
        // TEN — the turn: the climb stops being what it was
        beat = 1;
        if (twist === 'gap') {
          // no ledge at all: cling to the wall, or dash across
          Level.sigils.push({ x: (x + 1) * TILE, y: (r + 1) * TILE, icon: 'wall' });
        } else if (twist === 'ambush') {
          platform(px, r, 3);
          Level.gargoyles.push({ x: (side ? x + w - 3 : x + 1) * TILE, y: (r - 2) * TILE });
        } else {
          // a ledge that gives way when struck from above
          platform(px, r, 4);
          tset(px + 1, r, 11);
          tset(px + 2, r, 11);
        }
      } else {
        platform(px, r, 4);
        if (rnd() < 0.4) Level.bats.push({ x: (x + (w >> 1)) * TILE, y: (r - 2) * TILE });
      }
      side ^= 1;
    });

    // KETSU — the payoff: an alcove at the head of the climb
    rectFill(x + 1, top - 3, x + 3, top - 3, 1);
    Level.treasures.push({
      x: (x + 2) * TILE, y: (top - 4) * TILE + 6,
      kind: rnd() < 0.5 ? 'relic' : 'chest', data: null,
    });
    addCandle(x + 2, top - 3);

    Level.props.push({ type: 'chain', x: (x + (w >> 1)) * TILE, y: (top - 2) * TILE, len: rise * 16 });
    if (rnd() < 0.7) Level.gargoyles.push({ x: (x + 1) * TILE + 2, y: (top + 1) * TILE });

    const bottomG = G;
    G = top;
    rectFill(x + 1, G, x + w - 1, G, 1);
    rectFill(x + 1, G + 1, x + w - 1, G + 1, 4);
    noteGround(x + 1, x + w - 1, G);
    // doorways, or the chimney is a sealed box nobody can enter or leave
    rectFill(x, bottomG - 3, x, bottomG, 0);
    rectFill(x + w, G - 3, x + w, G, 0);
    Level.landmarks.push({ x: (x + (w >> 1)) * TILE, y: G * TILE, kind: 'tower' });
    x += w + 1;
  }

  // A shaft: a long drop, in the same four beats. The first ledge is always
  // visible from the lip, so the drop is a decision rather than a leap of faith.
  function segShaft(drop) {
    drop = Math.min(drop, G_MAX - G);
    if (drop < 3) { segGround(ri(10, 14)); return; }
    const w = 10;
    rectFill(x, G - 3, x, G + drop + 1, 1);
    rectFill(x + w, G - 3, x + w, G + drop + 1, 1);
    rectFill(x + 1, G, x + 2, G, 1);
    noteGround(x + 1, x + 2, G);
    Level.hollows.push({ x0: x + 1, y0: G + 1, x1: x + w - 1, y1: G + drop - 1 });

    const twist = rc(['roost', 'spikes', 'falsefloor']);
    const rows = [];
    for (let r = G + 3; r < G + drop; r += 3) rows.push(r);
    let side = 0;

    rows.forEach((r, i) => {
      const frac = i / Math.max(1, rows.length - 1);
      const px = side ? x + 1 : x + w - 5;
      if (frac < 0.3) {
        // KI — a wide catch right under the lip, plainly visible before you jump
        platform(px, r, 5);
        addCandle(px + 2, r);
      } else if (frac < 0.62) {
        platform(px, r, 4);
        if (rnd() < 0.45) addCandle(px + 1, r);
        if (rnd() < 0.4) {
          Level.treasures.push({ x: (px + 1) * TILE + 4, y: (r - 1) * TILE + 6,
            kind: rnd() < 0.4 ? 'relic' : 'heart', data: null });
        }
      } else if (frac < 0.85) {
        // TEN — the turn
        if (twist === 'roost') {
          // no ledge: a bat hangs here. Plunge onto it and rebound to the alcove.
          Level.bats.push({ x: (x + (w >> 1)) * TILE, y: r * TILE });
          const ax = side ? x + w - 4 : x + 1;
          rectFill(ax, r - 2, ax + 2, r - 2, 1);
          Level.treasures.push({
            x: (ax + 1) * TILE, y: (r - 3) * TILE + 6,
            kind: 'relic', data: rollRelic(1.4 + stage * 0.15),
          });
          Level.sigils.push({ x: (x + 2) * TILE, y: (r - 1) * TILE, icon: 'plunge' });
        } else if (twist === 'spikes') {
          platform(px, r, 4);
          tset(side ? x + w - 1 : x + 1, r, 3);
        } else {
          // a floor that is not one
          platform(px, r, 4);
          tset(px + 1, r, 11);
          tset(px + 2, r, 11);
        }
      } else {
        platform(px, r, 4);
      }
      side ^= 1;
    });

    // stepping stones for a controlled descent: always something to bounce off,
    // so a plunge down the well is a skill rather than a fall
    let stones = 0;
    for (let r = G + 4; r < G + drop - 1; r += 4) {
      Level.bats.push({ x: (x + 3 + ri(0, 3)) * TILE, y: r * TILE });
      stones++;
    }
    if (stones < 2) {
      Level.bats.push({ x: (x + 4) * TILE, y: (G + Math.max(2, drop >> 1)) * TILE });
    }

    if (rnd() < 0.55) {
      Level.drafts.push({
        x: (x + 2) * TILE, y: (G - 2) * TILE,
        w: TILE * (w - 3), h: (drop + 3) * TILE, force: 0.42,
      });
    }
    if (rnd() < 0.6) Level.gargoyles.push({ x: (x + w - 3) * TILE, y: (G + 2) * TILE });

    const lipG = G;
    G += drop;
    rectFill(x + 1, G, x + w - 1, G, 1);
    rectFill(x + 1, G + 1, x + w - 1, G + 1, 4);
    noteGround(x + 1, x + w - 1, G);
    rectFill(x, lipG - 3, x, lipG, 0);          // step in from the floor above
    rectFill(x + w, G - 3, x + w, G, 0);        // and walk out at the bottom
    if (rnd() < 0.5) tset(x + 1, G - 1, 3);
    // KETSU — the floor of the well is worth reaching
    Level.treasures.push({
      x: (x + w - 3) * TILE, y: (G - 1) * TILE + 6,
      kind: rnd() < 0.5 ? 'chest' : 'elixir', data: null,
    });
    Level.landmarks.push({ x: (x + (w >> 1)) * TILE, y: G * TILE, kind: 'shaft' });
    x += w + 1;
  }

  // A lift: a slow platform riding a tall hollow between two floors.
  function segLift(rise) {
    rise = Math.min(rise, G - G_MIN);
    if (rise < 4) { segTower(rise); return; }
    const w = 7;
    rectFill(x, G - rise - 3, x, G + 1, 1);
    rectFill(x + w, G - rise - 3, x + w, G + 1, 1);
    // hollow the shaft the whole way up: the deck must have somewhere to travel
    rectFill(x + 1, G - rise - 2, x + w - 1, G - 1, 0);
    Level.hollows.push({ x0: x + 1, y0: G - rise + 2, x1: x + w - 1, y1: G - 1, lift: true });
    // and the hatch: the deck must be able to rise through the upper floor
    Level.hollows.push({ x0: x + 2, y0: G - rise - 1, x1: x + 4, y1: G - rise + 1, lift: true });
    g2(x + 1, x + w - 1);
    Level.lifts.push({
      x: (x + 2) * TILE, y: (G - 1) * TILE, w: TILE * 3, h: 6,
      y0: (G - rise - 1) * TILE, y1: (G - 1) * TILE, dir: -1, speed: 0.55,
    });
    addCandle(x + 1, G);
    const bottomG = G;
    G -= rise;
    rectFill(x + 1, G, x + w - 1, G, 1);
    rectFill(x + 1, G + 1, x + w - 1, G + 1, 4);
    // a hatch in the upper floor, so the deck rises through it and you step off
    rectFill(x + 2, G, x + 4, G + 1, 0);
    noteGround(x + 1, x + 1, G);
    noteGround(x + 5, x + w - 1, G);
    rectFill(x, bottomG - 3, x, bottomG, 0);
    rectFill(x + w, G - 3, x + w, G, 0);
    Level.landmarks.push({ x: (x + (w >> 1)) * TILE, y: G * TILE, kind: 'lift' });
    x += w + 1;
  }

  // Name each stretch as it is built. The geometry may be random, but the
  // castle's regions are designed — that is what the chart shows the hunter.
  const REGION_NAMES = {
    ground: ['THE OUTER WARD', 'THE LONG APPROACH', 'THE BROKEN COURT', 'THE GREY WALK'],
    pits: ['THE SUNKEN SPAN', 'THE GAPING FLOOR', 'THE RENT STONE'],
    hall: ['THE PILLARED HALL', 'THE GALLERY OF SAINTS', 'THE VAULTED NAVE', 'THE LONG HALL'],
    ascent: ['THE SPIKED STAIR', 'THE PENITENT CLIMB', 'THE THORNED ASCENT'],
    graveyard: ['THE BONE GARDEN', 'THE QUIET FIELD', 'THE OSSUARY YARD'],
    battlements: ['THE STORM RAMPART', 'THE HIGH BATTLEMENT', 'THE RAIN WALK'],
    tower: ['THE BELL CHIMNEY', 'THE CROOKED TOWER', 'THE NARROW CLIMB'],
    shaft: ['THE DROP', 'THE THROAT', 'THE LONG FALL', 'THE WELL'],
    lift: ['THE CHAIN HOIST', 'THE COUNTERWEIGHT', 'THE SLOW ASCENT'],
    nave: ['THE SHATTERED NAVE', 'THE CHOIR OF ASHES', 'THE PILLARED PRAYER'],
    crypt: ['THE SUNKEN CRYPT', 'THE COLD VAULT', 'THE SLEEPING ROW'],
    warren: ['THE BONE WARREN', 'THE CRAWL', 'THE NARROW DARK'],
    gears: ['THE GREAT WORKS', 'THE PENDULUM SPAN', 'THE STOPPED HOUR'],
    throne: ['THE THRONE OF RUST', 'THE RED HALL', 'THE COURT OF THIRST'],
    moonbridge: ['THE MOONSTONE SPAN', 'THE PALE ISLANDS', 'THE LAST BRIDGE'],
    cistern: ['THE DROWNED ARCADE', 'THE STILL WATER', 'THE FLOODED VAULT', 'THE WEEPING CHANNEL'],
    foundry: ['THE CRUCIBLE WALK', 'THE MELT', 'THE HAMMER FLOOR', 'THE SLAG GALLERY'],
    gallery: ['THE HALL OF GLASS', 'THE SILVERED WALK', 'THE TWIN\'S GALLERY', 'THE FACING ROOM'],
    frostwalk: ['THE RIME LEDGE', 'THE WHITE CORNICE', 'THE FROZEN WALK', 'THE ICEFALL'],
    approach: ['THE GUARDIAN\'S ROAD'],
    arena: ['THE GUARDIAN\'S HALL'],
  };
  function openRegion(kind) {
    const pool = REGION_NAMES[kind] || REGION_NAMES.ground;
    Level.regions.push({
      x0: x * TILE, x1: x * TILE, kind,
      name: pool[ri(0, pool.length - 1)],
      top: G, vertical: kind === 'tower' || kind === 'shaft' || kind === 'lift',
    });
  }
  function closeRegionSafe() { if (Level.regions.length) closeRegion(); }
  function closeRegion() {
    const r = Level.regions[Level.regions.length - 1];
    if (r) { r.x1 = x * TILE; r.bottom = G; }
  }
  // wrap every builder so regions bookend themselves
  const withRegion = (kind, fn) => (...a) => { openRegion(kind); fn(...a); closeRegion(); };
  const segGroundR = withRegion('ground', segGround);
  const segPitsR = withRegion('pits', segPits);
  const segHallR = withRegion('hall', segHall);
  const segAscentR = withRegion('ascent', segAscent);
  const segGraveyardR = withRegion('graveyard', segGraveyard);
  const segBattlementsR = withRegion('battlements', segBattlements);
  const segTowerR = withRegion('tower', segTower);
  const segShaftR = withRegion('shaft', segShaft);
  const segLiftR = withRegion('lift', segLift);
  const segNaveR = withRegion('nave', segNave);
  const segCryptR = withRegion('crypt', segCrypt);
  const segWarrenR = withRegion('warren', segWarren);
  const segGearsR = withRegion('gears', segGears);
  const segThroneR = withRegion('throne', segThrone);
  const segMoonbridgeR = withRegion('moonbridge', segMoonbridge);
  const segCisternR = withRegion('cistern', segCistern);
  const segFoundryR = withRegion('foundry', segFoundry);
  const segGalleryR = withRegion('gallery', segGallery);
  const segFrostwalkR = withRegion('frostwalk', segFrostwalk);

  // ---- assemble the stage
  segGroundR(ri(14, 18));
  const pool = zone.pool;
  const n = Math.max(3, Math.round(zone.w / 26));
  const segs = [];
  for (let i = 0; i < n; i++) segs.push(pool[i % pool.length]);
  for (let i = segs.length - 1; i > 0; i--) {          // shuffle, so it is never a list
    const j = ri(0, i);
    const t = segs[i]; segs[i] = segs[j]; segs[j] = t;
  }
  let climbed = 0, madeLift = false;
  segs.forEach((t, si) => {
    if (t === 'ground') segGroundR(ri(14, 18));
    else if (t === 'pits') segPitsR(ri(14, 18));
    else if (t === 'hall') segHallR(ri(20, 26));
    else if (t === 'ascent') segAscentR(ri(16, 18));
    else if (t === 'graveyard') segGraveyardR(ri(16, 20));
    else if (t === 'nave') segNaveR(ri(24, 30));
    else if (t === 'crypt') segCryptR(ri(18, 24));
    else if (t === 'warren') segWarrenR(ri(18, 24));
    else if (t === 'gears') segGearsR(ri(22, 28));
    else if (t === 'throne') segThroneR(ri(24, 30));
    else if (t === 'moonbridge') segMoonbridgeR(ri(24, 30));
    else if (t === 'cistern') segCisternR(ri(22, 28));
    else if (t === 'foundry') segFoundryR(ri(22, 28));
    else if (t === 'gallery') segGalleryR(ri(24, 30));
    else if (t === 'frostwalk') segFrostwalkR(ri(20, 26));
    else segBattlementsR(ri(20, 24));

    // between halls the castle rises or falls away beneath you
    if (si < segs.length - 1) {
      const roomUp = G - G_MIN, roomDown = G_MAX - G;
      const r = rnd();
      // keep the castle folding up and down; a stage that only climbs is a stair
      const wantDown = G < G_BASE - 2 ? 0.75 : G > G_BASE + 4 ? 0.2 : 0.5;
      if (r < wantDown && roomDown >= 5) {
        segShaftR(ri(4, Math.min(10, roomDown)));
        climbed++;
      } else if (roomUp >= 5) {
        if (roomUp >= 6 && !madeLift && rnd() < 0.55) { segLiftR(ri(5, Math.min(9, roomUp))); madeLift = true; }
        else segTowerR(ri(4, Math.min(9, roomUp)));
        climbed++;
      }
    }
  });

  // the castle should always offer all three ways of changing height
  if (!madeLift && G - G_MIN >= 6) { segLiftR(ri(5, Math.min(8, G - G_MIN))); madeLift = true; }
  if (!Level.landmarks.some(m => m.kind === 'shaft') && G_MAX - G >= 5) {
    segShaftR(ri(4, Math.min(8, G_MAX - G)));
  }

  // return to the zone's own elevation before the guardian's hall — the arena
  // belongs to the place it is in, not to some shared base course
  const HOME = zone.row;
  if (G !== HOME) {
    const steps = Math.abs(G - HOME);
    const dir = G > HOME ? -1 : 1;
    for (let i = 0; i < steps; i++) {
      rectFill(x, G, x + 1, G + 1, 1);
      noteGround(x, x + 1, G);
      rectFill(x, G - 3, x + 1, G - 1, 0);      // headroom to walk the stair
      G += dir;
      x += 2;
    }
    G = HOME;
    g2(x, x + 3);
    x += 4;
  }

  // ---- gated riches: sky lofts, sealed vaults, plunge pockets
  const decoEnd = x - 4;

  // sky lofts: hover far above the path; only wings or phantom steps reach them
  const loftCount = ri(2, 3);
  for (let i = 0; i < loftCount; i++) {
    const lx = ri(26, Math.max(30, decoEnd - 6));
    const row = Math.max(1, gtop(lx) - rc([8, 9, 10]));
    if (tileAt(lx, row) !== 0 || tileAt(lx + 2, row) !== 0) continue;
    platform(lx, row, 3);
    addCandle(lx + 1, row);
    Level.sigils.push({ x: (lx + 1) * TILE, y: (row + 2) * TILE, icon: 'wing' });
    const rich = row <= 3;
    Level.treasures.push({
      x: (lx + 1) * TILE + 2, y: (row - 1) * TILE + 4,
      kind: rich ? 'relic' : 'chest',
      data: rich ? rollRelic(0.6 + stage * 0.15 + epicBoost) : null,
    });
    if (rich && rnd() < 0.5) {
      Level.treasures.push({ x: (lx + 2) * TILE + 2, y: (row - 1) * TILE + 4, kind: 'elixir' });
    }
  }

  // a sealed vault: hollow tower, its door hidden in the masonry
  {
    const vx = ri(30, Math.max(34, decoEnd - 10));
    const vg = gtop(vx);
    let clear = true;
    for (let cx = vx; cx <= vx + 4; cx++) if (tileAt(cx, vg) !== 1) clear = false;
    if (clear) {
      const vTop = vg - 4, vFloor = vg - 1;
      rectFill(vx, vTop, vx + 4, vFloor, 1);
      rectFill(vx + 1, vTop + 1, vx + 3, vFloor, 0);
      tset(vx, vFloor - 1, 10);
      tset(vx, vFloor, 10);
      Level.sigils.push({ x: (vx - 1) * TILE, y: vFloor * TILE, icon: 'strike' });
      Level.treasures.push({ x: (vx + 2) * TILE + 2, y: vFloor * TILE - 12, kind: 'chest' });
      Level.treasures.push({ x: (vx + 1) * TILE + 2, y: vFloor * TILE - 12, kind: 'tablet' });
      Level.treasures.push({
        x: (vx + 3) * TILE + 2, y: vFloor * TILE - 12,
        kind: 'relic', data: rollRelic(0.5 + stage * 0.15 + epicBoost),
      });
      addCandle(vx + 2, vFloor);
    }
  }

  // a locked treasury: golden gate, and its key hidden far away
  {
    const lx = ri(36, Math.max(40, decoEnd - 16));
    const lg = gtop(lx);
    let clear = true;
    for (let cx = lx; cx <= lx + 4; cx++) if (tileAt(cx, lg) !== 1) clear = false;
    if (clear) {
      const lTop = lg - 4, lFloor = lg - 1;
      rectFill(lx, lTop, lx + 4, lFloor, 1);
      rectFill(lx + 1, lTop + 1, lx + 3, lFloor, 0);
      tset(lx + 4, lFloor - 1, 12);
      tset(lx + 4, lFloor, 12);
      Level.sigils.push({ x: (lx + 5) * TILE, y: lFloor * TILE, icon: 'key' });
      Level.treasures.push({ x: (lx + 1) * TILE + 2, y: lFloor * TILE - 12, kind: 'chest' });
      Level.treasures.push({
        x: (lx + 2) * TILE + 2, y: lFloor * TILE - 12,
        kind: 'relic', data: rollRelic(0.9 + stage * 0.15 + epicBoost),
      });
      Level.treasures.push({ x: (lx + 3) * TILE + 2, y: lFloor * TILE - 12, kind: 'elixir' });
      addCandle(lx + 2, lFloor);
      // the key rests somewhere else entirely
      let kx = ri(8, Math.max(12, decoEnd - 4));
      let guard = 0;
      while (Math.abs(kx - lx) < 30 && guard++ < 20) kx = ri(8, Math.max(12, decoEnd - 4));
      Level.treasures.push({ x: kx * TILE + 4, y: (gtop(kx) - 1) * TILE + 6, kind: 'key' });
    }
  }

  // plunge pockets: cracked floors that only the Moonlit Plunge shatters
  const pockets = ri(1, 2);
  for (let i = 0; i < pockets; i++) {
    const px2 = ri(28, Math.max(32, decoEnd - 4));
    const pg = gtop(px2);
    if (tileAt(px2, pg) !== 1 || tileAt(px2, pg - 1) !== 0) continue;
    // never bore through a shaft the castle needs hollow
    if ((Level.hollows || []).some(h => px2 >= h.x0 - 1 && px2 <= h.x1 + 1)) continue;
    tset(px2, pg, 11);
    tset(px2, pg + 1, 0);
    Level.sigils.push({ x: px2 * TILE, y: (pg - 1) * TILE, icon: 'plunge' });
    // a small chamber, not a hole to the bottom of the world; the foundation
    // flood fills whatever is genuinely dead space below it
    for (let yy = pg + 2; yy < Math.min(LEVEL_H, pg + 5); yy++) tset(px2, yy, 4);
    Level.treasures.push({
      x: px2 * TILE + 2, y: (pg + 1) * TILE + 2,
      kind: rnd() < 0.5 ? 'elixir' : 'relic',
      data: null,
    });
  }

  // ---- ore veins: seams of strange metal, set in walls where a blade can reach
  {
    const spots = [];
    for (let cx = 4; cx < Math.max(12, decoEnd); cx++) {
      for (let cy = 3; cy <= G_MAX + 1; cy++) {
        if (tileAt(cx, cy) !== 1) continue;
        // a face the hunter can stand beside and strike, with room to stand
        // never in a working shaft: a seam there would jam the lift
        if ((Level.hollows || []).some(h => cx >= h.x0 - 1 && cx <= h.x1 + 1 &&
            cy >= h.y0 - 1 && cy <= h.y1 + 1)) continue;
        // a face you can stand beside: open air, with a floor right under it
        const standable = (c) => tileAt(c, cy) === 0 && isSolid(tileAt(c, cy + 1)) &&
          tileAt(c, cy - 1) === 0;
        const leftOpen = standable(cx - 1);
        const rightOpen = standable(cx + 1);
        if (!leftOpen && !rightOpen) continue;
        if (tileAt(cx, cy - 1) === 0 && cy === groundRow[cx]) continue;   // that's floor, not wall
        spots.push([cx, cy]);
      }
    }
    const veins = Math.min(spots.length, 5 + Math.min(6, stage));
    for (let i = 0; i < veins && spots.length; i++) {
      const [vx, vy] = spots.splice((rnd() * spots.length) | 0, 1)[0];
      tset(vx, vy, 13);
    }
    // if the castle grew no walls worth mining, cut a shallow seam beside the path
    if (veins < 3) {
      for (let i = 0; i < 3; i++) {
        const vx = ri(8, Math.max(12, decoEnd));
        const vg2 = gtop(vx);
        if (tileAt(vx, vg2) === 1 && tileAt(vx, vg2 - 1) === 0 && tileAt(vx + 1, vg2 - 1) === 0) {
          tset(vx, vg2 - 1, 13);
        }
      }
    }
  }

  // ---- warp obelisks: one near the doors, one mid-castle
  for (const target of [7, ((26 + decoEnd) >> 1)]) {
    const oc = groundNear(target);
    if (oc !== null) Level.obelisks.push({ x: oc * TILE + 2, y: gtop(oc) * TILE, lit: false });
  }
  // the wandering merchant sets up shop mid-stage
  {
    const mc = groundNear(ri(24, Math.max(28, decoEnd - 8)));
    if (mc !== null) Level.props.push({ type: 'merchant', x: mc * TILE, y: gtop(mc) * TILE });
  }
  if (!Level.treasures.some(t => t.kind === 'tablet')) {
    const tc = groundNear(ri(20, Math.max(24, decoEnd - 6)));
    if (tc !== null) Level.treasures.push({ x: tc * TILE + 4, y: (gtop(tc) - 1) * TILE + 6, kind: 'tablet' });
  }

  // ---- the guardian's road and hall, only where a zone keeps a guardian
  if (!zone.boss) {
    // a plain way out into the next zone
    g2(x, x + 8);
    closeRegionSafe();
    Level.zones.push({
      key: zone.key, name: zone.name, biome: zone.biome, tint: zone.tint,
      danger: zone.danger, x0: startX * TILE, x1: (x + 8) * TILE, row: zone.row,
      gate: zone.gate || null, boss: null,
    });
    return x + 8;
  }
  openRegion('approach');
  const ap = 14;
  g2(x, x + ap);
  addCandle(x + 3, G, takeDrop());
  addCandle(x + 7, G);
  addCandle(x + 11, G, 'orb');
  if (!Level.glimmers.length) {
    Level.glimmers.push({ x: (x + 8) * TILE + 8, y: G * TILE, found: false });
  }
  if (shrines === 0) Level.props.push({ type: 'shrine', x: (x + 5) * TILE, y: G * TILE });
  else Level.props.push({ type: 'statue', x: (x + 9) * TILE, y: G * TILE });
  Level.props.push({ type: 'forge', x: (x + 12) * TILE, y: G * TILE });
  Level.obelisks.push({ x: (x + 2) * TILE, y: G * TILE, lit: false });
  Level.hounds.push({ x: (x + 4) * TILE, y: G * TILE });
  Level.hounds.push({ x: (x + 10) * TILE, y: G * TILE });
  x += ap;
  const gate = x + 1;
  const a0 = gate + 1, a1 = a0 + 56;
  g2(x, a1);
  rectFill(a1 + 1, G - 6, a1 + 1, G + 1, 1);   // a pillar, not a seal
  for (let cx = a0 + 3; cx < a1 - 2; cx += 12) addCandle(cx, G, rnd() < 0.3 ? 'heart' : null);
  for (let cx = a0 + 5; cx < a1 - 3; cx += 13) {
    Level.props.push({ type: 'statue', x: cx * TILE, y: G * TILE });
  }
  Level.props.push({ type: 'banner', x: (a0 + 8) * TILE, y: 4 * TILE });
  Level.props.push({ type: 'banner', x: (a1 - 10) * TILE, y: 4 * TILE });
  Level.props.push({ type: 'chain', x: ((a0 + a1) >> 1) * TILE, y: 4 * TILE, len: 30 });
  closeRegion();
  Level.regions.push({
    x0: a0 * TILE, x1: (a1 + 2) * TILE, kind: 'arena',
    name: "THE GUARDIAN'S HALL", top: G, bottom: G, vertical: false,
  });
  // A guardian that flies needs sky to fly in: clear the hall's ceiling well
  // above where it hovers, or it fights with its back against the stone.
  rectFill(a0, Math.max(1, G - 16), a1, G - 1, 0);
  Level.hollows.push({ x0: a0, y0: Math.max(1, G - 16), x1: a1, y1: G - 1, soft: true });
  const arena = {
    zone: zone.key,
    cls: zone.boss,
    reward: zone.reward || null,
    floorY: G * TILE,          // where a guardian that walks must stand
    danger: zone.danger,       // how deep this hall is, for its guardian's strength
    beaten: false,
    triggerX: (gate + 4) * TILE,
    gateTX: gate,
    arenaX0: a0 * TILE,
    arenaX1: (a1 + 1) * TILE,
    homeX: ((a0 + a1) >> 1) * TILE,
    homeY: Math.max(2, G - 7) * TILE,
  };
  Level.bosses.push(arena);
  Level.zones.push({
    key: zone.key, name: zone.name, biome: zone.biome, tint: zone.tint,
    danger: zone.danger, x0: startX * TILE, x1: (a1 + 3) * TILE, row: zone.row,
    gate: zone.gate || null, boss: arena,
  });
  // the castle continues past the guardian's hall
  x = a1 + 3;

  return x;
}

// Finish the castle once every zone is raised: foundations, spawn snapping.
// ---------------------------------------------------------------- the castle
// One castle. The zones are raised end to end, and where a zone demands
// something a guardian carries, its door is sealed until you carry it.
function buildWorld(seed) {
  srand((seed >>> 0) || 12345);
  resetWorld();

  let x = 2;
  ZONES.forEach((zone, i) => {
    const zx = x;
    x = buildZoneInto(zone, zx);

    // a doorway between this zone and the next
    if (i < ZONES.length - 1) {
      const next = ZONES[i + 1];
      const rise = next.row - zone.row;
      G = zone.row;
      // A stair across the join, for the WHOLE difference in height. Capping it
      // left a cliff between zones that no hunter could climb, sealing off
      // everything past it.
      const dir = Math.sign(rise);
      const steps = Math.abs(rise);
      for (let sIdx = 0; sIdx < steps; sIdx++) {
        rectFill(x, G, x + 2, G + 1, 1);
        noteGround(x, x + 2, G);
        // climbing needs headroom; descending needs the ceiling kept clear too
        rectFill(x, G - 3, x + 2, G - 1, 0);
        G += dir;
        x += 2;
        // a torch every few steps, so the stair reads as a passage
        if (sIdx % 5 === 2) Level.candles.push({ tx: x, ty: G - 2, drop: null });
      }
      G = next.row;
      rectFill(x, G, x + 6, G, 1);
      rectFill(x, G + 1, x + 6, G + 1, 4);
      noteGround(x, x + 6, G);

      // if the next zone demands an ability, seal the way with a warded door
      if (next.gate) {
        const gx = x + 3;
        for (let ty = G - 5; ty <= G; ty++) tset(gx, ty, 14);   // 14 = warded door
        Level.gates.push({
          x: gx * TILE, y: G * TILE, tx: gx, top: G - 5, bottom: G,
          need: next.gate, open: false, zone: next.key,
        });
        Level.sigils.push({
          x: (gx - 2) * TILE, y: G * TILE,
          icon: next.gate === 'wings' ? 'wing' : next.gate === 'maw' ? 'plunge' : 'wall',
        });
      }
      x += 7;
    }
  });

  Level.pxW = Math.min(LEVEL_W - 4, x + 6) * TILE;
  for (const z of Level.zones) z.x1 = Math.min(z.x1, Level.pxW - TILE * 2);
  Level.pxH = LEVEL_H * TILE;
  // the first guardian's hall is where the old code expects to find "the" boss
  Level.boss = Level.bosses[0] || null;
  finishWorld();
  return Level;
}

// which zone a point in the castle belongs to
function zoneAt(px) {
  const zs = Level.zones || [];
  for (const z of zs) if (px >= z.x0 && px <= z.x1) return z;
  return zs[0] || null;
}

function finishWorld() {
  const addCandle = (cx, standRow, forced) =>
    Level.candles.push({ tx: cx, ty: standRow - 2, drop: forced || null });

  // ---- antepieces: beside every shrine, a harmless place to try what it taught.
  // The rule the research kept repeating: practise before it costs anything.
  for (const pr of Level.props) {
    if (pr.type !== 'shrine') continue;
    const sc = Math.floor(pr.x / TILE);
    const gr = gtop(sc);
    if (gr < 5) continue;
    // three forgiving ledges. Search both sides, a few offsets, a few heights.
    const clear = (c0, row, wide) => {
      for (let i = 0; i < wide; i++) {
        const c = c0 + i;
        if (c < 2 || c >= LEVEL_W - 2 || row < 2) return false;
        if (tileAt(c, row) !== 0 || tileAt(c, row - 1) !== 0 || tileAt(c, row - 2) !== 0) return false;
      }
      return true;
    };
    let built = false;
    outer:
    for (const dir of [1, -1]) {
      for (const off of [3, 5, 8, 11]) {
        for (const lift of [3, 4]) {
          const a = sc + dir * off;
          const b = sc + dir * (off + 4);
          const c = sc + dir * (off + 8);
          const lo = gr - lift, hi = gr - lift - 2;
          const A = dir > 0 ? a : a - 2, B = dir > 0 ? b : b - 2, C = dir > 0 ? c : c - 2;
          if (!clear(A, lo, 3) || !clear(B, hi, 3) || !clear(C, lo, 3)) continue;
          platform(A, lo, 3);
          platform(B, hi, 3);
          platform(C, lo, 3);
          addCandle(B + 1, hi);
          Level.treasures.push({ x: (B + 1) * TILE, y: (hi - 1) * TILE + 6, kind: 'heart' });
          Level.sigils.push({ x: (sc + dir * 2) * TILE, y: gr * TILE, icon: 'wing' });
          built = true;
          break outer;
        }
      }
    }
    if (!built) {
      // the ground was busy; hang a single practice ledge over the shrine itself
      if (clear(sc - 1, gr - 4, 3)) {
        platform(sc - 1, gr - 4, 3);
        Level.treasures.push({ x: sc * TILE, y: (gr - 5) * TILE + 6, kind: 'heart' });
      }
    }
  }

  // ---- each zone breeds its own dead. The same halls with the same skeletons
  // in them is what made the castle feel like one corridor.
  {
    Level.throwers = [];
    Level.spiders = [];
    for (const z of Level.zones) {
      const c0 = Math.floor(z.x0 / TILE), c1 = Math.floor(z.x1 / TILE);
      const span = Math.max(1, c1 - c0);
      // danger has to climb, or the last hall is no worse than the first
      const count = 3 + z.danger * 2;
      for (let i = 0; i < count; i++) {
        const cx = c0 + 4 + ((i * 37 + z.danger * 11) % Math.max(1, span - 8));
        const gr = gtop(cx);
        if (gr < 3 || gr >= LEVEL_H - 2) continue;
        if (z.biome === 'catacombs' || z.biome === 'chapel') {
          // something hangs from the vaulting: find a ceiling above the floor
          let ceil = -1;
          for (let ty = gr - 5; ty > 2; ty--) {
            if (isSolid(tileAt(cx, ty)) && tileAt(cx, ty + 1) === 0) { ceil = ty + 1; break; }
          }
          if (ceil > 0) Level.spiders.push({ x: cx * TILE, y: ceil * TILE });
          else Level.throwers.push({ x: cx * TILE, y: gr * TILE });
        } else if (z.biome === 'clock' || z.biome === 'keep' || z.biome === 'lunar') {
          Level.throwers.push({ x: cx * TILE, y: gr * TILE });
        } else if (z.biome === 'graveyard') {
          Level.wolves.push({ x: cx * TILE, y: gr * TILE });
        } else {
          Level.hounds.push({ x: cx * TILE, y: gr * TILE });
        }
      }
    }
  }

  // Deep foundations: the castle is solid stone wherever nobody could ever go.
  // Filling by column cannot work — a tower's hollow centre and a crypt's ceiling
  // both sit above open space — so flood the reachable air and fill the rest.
  {
    const W = LEVEL_W, H = LEVEL_H;
    const open = id => id === 0 || id === 2 || id === 3 || id === 10 ||
      id === 11 || id === 12 || id === 14 || id === 15;   // sealed doors still open one day
    const seen = new Uint8Array(W * H);
    const stack = [];
    const push = (x, y) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = y * W + x;
      if (seen[i] || !open(Level.grid[i])) return;
      seen[i] = 1; stack.push(i);
    };
    for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
    for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
    while (stack.length) {
      const i = stack.pop();
      const x = i % W, y = (i / W) | 0;
      push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
    }
    // a shaft the builders deliberately hollowed is never "unreachable rock",
    // even if the flood cannot find its way in from outside
    const inHollow = (x, y) => {
      for (const h of Level.hollows) {
        if (x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1) return true;
      }
      return false;
    };
    for (let i = 0; i < W * H; i++) {
      if (seen[i] || Level.grid[i] !== 0) continue;
      const x = i % W, y = (i / W) | 0;
      if (inHollow(x, y)) continue;
      Level.grid[i] = 4;
    }
  }

  // ---- no gap in the castle may be wider than a hunter can cross. Whatever the
  // builders left, this walks each zone's floor and drops a stepping stone into
  // anything too wide. A castle you cannot walk is not a castle.
  {
    const MAXGAP = 5;
    for (const z of Level.zones) {
      const c0 = Math.floor(z.x0 / TILE) + 1, c1 = Math.floor(z.x1 / TILE) - 1;
      // the standable row closest to where the walk currently is, so the pass
      // follows the castle up and down instead of hunting a fixed band
      const near = (cx, want) => {
        let best = -1, bestD = 1e9;
        for (let r = 2; r < LEVEL_H - 2; r++) {
          const below = tileAt(cx, r + 1);
          if (!isSolid(below) && !isPlatform(below)) continue;
          if (isSolid(tileAt(cx, r)) || isSolid(tileAt(cx, r - 1))) continue;
          const d = Math.abs(r - want);
          if (d < bestD) { bestD = d; best = r; }
        }
        return bestD <= 14 ? best : -1;
      };
      let gapStart = -1, lastRow = z.row;
      for (let cx = c0; cx <= c1; cx++) {
        const r = near(cx, lastRow);
        if (r < 0) { if (gapStart < 0) gapStart = cx; continue; }
        if (gapStart >= 0) {
          const width = cx - gapStart;
          if (width > MAXGAP) {
            // lay stones across it, spaced so each hop is short
            const row = Math.min(lastRow, r);
            for (let px = gapStart + 2; px < cx - 1; px += MAXGAP - 1) {
              if (px < 2 || px >= LEVEL_W - 3) continue;
              platform(px, Math.max(2, row), 3);
            }
          }
          gapStart = -1;
        }
        lastRow = r;
      }
    }
  }

  // ---- NO ONE-WAY TRAPS. Any floor a hunter can land on must have a way up
  // from it. This looks at every standable cell in the castle, asks whether a
  // leap from it reaches anywhere, and cuts a chimney where the answer is no.
  {
    const standable = (x, y) => {
      const below = tileAt(x, y + 1);
      if (!isSolid(below) && !isPlatform(below)) return false;
      return !isSolid(tileAt(x, y)) && !isSolid(tileAt(x, y - 1));
    };
    // can the hunter leap from (x,y) to any other footing?
    const hasEscape = (x, y) => {
      for (let dx = -6; dx <= 6; dx++) {
        for (let up = 1; up <= 5; up++) {
          const nx = x + dx, ny = y - up;
          if (nx < 2 || nx >= LEVEL_W - 2 || ny < 2) continue;
          if (!standable(nx, ny)) continue;
          // and nothing solid in the way overhead at either end
          let clear = true;
          for (let r = y - 1; r >= ny - 1 && clear; r--) if (isSolid(tileAt(x, r))) clear = false;
          for (let r = y - 1; r >= ny - 1 && clear; r--) if (isSolid(tileAt(nx, r))) clear = false;
          if (clear) return true;
        }
      }
      // or simply walk out sideways at the same level
      for (const dx of [-1, 1]) {
        let steps = 0;
        for (let nx = x + dx; nx > 2 && nx < LEVEL_W - 2 && steps < 24; nx += dx, steps++) {
          if (isSolid(tileAt(nx, y)) || isSolid(tileAt(nx, y - 1))) break;
          if (standable(nx, y) && hasUpAt(nx, y)) return true;
        }
      }
      return false;
    };
    // a cheap upward check used by the sideways walk, to avoid deep recursion
    function hasUpAt(x, y) {
      for (let dx = -4; dx <= 4; dx++) {
        for (let up = 1; up <= 5; up++) {
          const nx = x + dx, ny = y - up;
          if (nx < 2 || nx >= LEVEL_W - 2 || ny < 2) continue;
          if (!standable(nx, ny)) continue;
          let clear = true;
          for (let r = y - 1; r >= ny - 1 && clear; r--) {
            if (isSolid(tileAt(x, r)) || isSolid(tileAt(nx, r))) clear = false;
          }
          if (clear) return true;
        }
      }
      return false;
    }

    // What is inside a pocket decides its fate: if there is something worth
    // reaching down there, cut a way out; if it is bare rock, fill it in so
    // nobody falls into a hole that was never meant to be a room.
    const contentAt = new Set();
    for (const t of Level.treasures) contentAt.add(Math.floor(t.x / TILE) + ':' + Math.floor(t.y / TILE));
    for (const c of Level.candles) contentAt.add(c.tx + ':' + c.ty);
    for (const p of Level.props) contentAt.add(Math.floor(p.x / TILE) + ':' + Math.floor(p.y / TILE));

    let cut = 0, filled = 0;
    const done = new Set();
    for (let cx = 4; cx < Math.floor(Level.pxW / TILE) - 4; cx++) {
      for (let cy = 4; cy < LEVEL_H - 4; cy++) {
        if (!standable(cx, cy) || done.has(cx + ':' + cy)) continue;
        if (hasEscape(cx, cy)) continue;

        // gather the pocket: every open cell reachable from here without leaving it
        const cells = [];
        const seenC = new Set();
        const stack = [[cx, cy]];
        let hasContent = false, tooBig = false;
        while (stack.length && !tooBig) {
          const [x, y] = stack.pop();
          const k = x + ':' + y;
          if (seenC.has(k)) continue;
          if (x < 2 || y < 2 || x >= LEVEL_W - 2 || y >= LEVEL_H - 2) continue;
          if (isSolid(tileAt(x, y))) continue;
          seenC.add(k);
          cells.push([x, y]);
          if (contentAt.has(k)) hasContent = true;
          if (cells.length > 260) { tooBig = true; break; }
          stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
        for (const [x, y] of cells) done.add(x + ':' + y);

        if (tooBig || hasContent) {
          // worth reaching: cut a chimney upward until it breaks into open ground
          for (let r = cy - 1; r > 3; r--) {
            const id = tileAt(cx, r);
            if (id === 1 || id === 4) { tset(cx, r, 0); tset(cx + 1, r, 0); }
            if (standable(cx, r) || standable(cx + 1, r)) break;
          }
          // two steps, no more: enough to climb, not enough to look like litter
          for (const r of [cy - 3, cy - 6]) {
            if (r > 4 && !isSolid(tileAt(cx + 1, r)) && !isPlatform(tileAt(cx + 1, r))) {
              platform(cx + 1, r, 2);
            }
          }
          cut++;
        } else if (cells.some(([x, y]) => (Level.hollows || []).some(h =>
            x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1))) {
          // part of a room the castle meant to build — a guardian's hall, a
          // lift well — so leave it be
        } else {
          // a hole that leads nowhere and holds nothing is simply rock now
          for (const [x, y] of cells) tset(x, y, 4);
          filled++;
        }
        break;
      }
    }
  }

  // ---- THE SPINE. Whatever the builders did, one continuous walkable path must
  // run through every zone. This carves it: a corridor that follows the terrain
  // where the terrain allows, and cuts through where it does not.
  {
    for (const z of Level.zones) {
      const c0 = Math.floor(z.x0 / TILE) + 1, c1 = Math.floor(z.x1 / TILE) - 1;
      // find where the spine starts: the standable row nearest the zone's own level
      const standRow = (cx, want) => {
        let best = -1, bestD = 1e9;
        for (let r = 3; r < LEVEL_H - 3; r++) {
          const below = tileAt(cx, r + 1);
          if (!isSolid(below) && !isPlatform(below)) continue;
          if (isSolid(tileAt(cx, r)) || isSolid(tileAt(cx, r - 1)) || isSolid(tileAt(cx, r - 2))) continue;
          const d = Math.abs(r - want);
          if (d < bestD) { bestD = d; best = r; }
        }
        return { row: best, dist: bestD };
      };
      let cur = z.row;
      const first = standRow(c0, z.row);
      if (first.row > 0 && first.dist <= 10) cur = first.row;

      for (let cx = c0; cx <= c1; cx++) {
        // a tower, lift or well is a deliberate vertical passage: leave it be,
        // and pick the walk up again on its far side
        const inConnector = (Level.hollows || []).some(h => cx >= h.x0 - 1 && cx <= h.x1 + 1);
        if (inConnector) {
          const here = standRow(cx, cur);
          if (here.row > 0 && here.dist <= 12) cur = here.row;
          continue;
        }
        const found = standRow(cx, cur);
        // a step the hunter can take: up to four rows up, eight rows down
        if (found.row > 0 && found.row >= cur - 4 && found.row <= cur + 8) {
          cur = found.row;
          // keep the head clear even where the floor is fine
          for (let r = cur - 2; r <= cur - 1; r++) {
            const id = tileAt(cx, r);
            if (isSolid(id) && id !== 10 && id !== 12 && id !== 14) tset(cx, r, 0);
          }
          continue;
        }
        // footing exists but it is a wall's height above: climb it as a stair,
        // two rows a column, rather than tunnelling flat past it
        if (found.row > 0 && found.row < cur - 4 && found.row >= cur - 30) {
          cur = Math.max(found.row, cur - 2);
          for (let r = cur - 2; r <= cur; r++) {
            const id = tileAt(cx, r);
            if (id === 10 || id === 12 || id === 14 || id === 13) continue;
            tset(cx, r, 0);
          }
          const well2 = (Level.hollows || []).find(h =>
            cx >= h.x0 && cx <= h.x1 && cur + 1 >= h.y0 && cur + 1 <= h.y1);
          if (!isSolid(tileAt(cx, cur + 1)) && !isPlatform(tileAt(cx, cur + 1))) {
            // inside a well a board, outside it stone — a board survives the
            // pass that re-opens the connectors, and a rising deck ignores it
            if (!well2) { tset(cx, cur + 1, 1); noteGround(cx, cx, cur + 1); }
            else if (!well2.lift) tset(cx, cur + 1, 2);
          }
          continue;
        }
        // nothing walkable here: cut the corridor through
        for (let r = cur - 2; r <= cur; r++) {
          const id = tileAt(cx, r);
          if (id === 10 || id === 12 || id === 14 || id === 13) continue;   // leave doors and ore
          tset(cx, r, 0);
        }
        const well = (Level.hollows || []).find(h =>
          cx >= h.x0 && cx <= h.x1 && cur + 1 >= h.y0 && cur + 1 <= h.y1);
        if (!isSolid(tileAt(cx, cur + 1)) && !isPlatform(tileAt(cx, cur + 1))) {
          if (!well) { tset(cx, cur + 1, 1); noteGround(cx, cx, cur + 1); }
          else if (!well.lift) tset(cx, cur + 1, 2);
        }
      }
    }
  }

  // ---- SKYWARD. Above the castle's roof hang islands nothing walks to: they
  // are for whoever has taken wings from a guardian, and they keep the best of
  // what the castle has. Some are sealed behind a golden gate as well.
  {
    Level.skyIslands = [];
    for (const z of Level.zones) {
      if (z.danger < 1) continue;                   // the outer wall keeps its feet
      const c0 = Math.floor(z.x0 / TILE) + 20, c1 = Math.floor(z.x1 / TILE) - 20;
      if (c1 - c0 < 30) continue;
      const count = 1 + (z.danger > 3 ? 1 : 0);
      for (let n = 0; n < count; n++) {
        const cx = c0 + Math.floor((c1 - c0) * (0.3 + 0.45 * n)) + ri(-8, 8);
        // find the roof of the castle here, and rise well above it
        let roof = LEVEL_H;
        for (let ty = 2; ty < LEVEL_H; ty++) {
          if (isSolid(tileAt(cx, ty))) { roof = ty; break; }
        }
        const row = Math.max(3, Math.min(roof - 14, z.row - 18));
        if (row < 3 || row > LEVEL_H - 6) continue;
        // nothing may already be there
        let clear = true;
        for (let c = cx - 8; c <= cx + 8 && clear; c++) {
          for (let r = row - 4; r <= row + 3; r++) if (tileAt(c, r) !== 0) clear = false;
        }
        if (!clear) continue;

        const wide = ri(7, 11);
        rectFill(cx, row, cx + wide, row, 1);
        rectFill(cx, row + 1, cx + wide, row + 1, 4);
        noteGround(cx, cx + wide, row);
        Level.hollows.push({ x0: cx - 1, y0: row - 6, x1: cx + wide + 1, y1: row - 1, soft: true });

        // what it holds is worth the flight
        const locked = n === 1 || rnd() < 0.4;
        for (let i = 2; i < wide - 1; i += 3) {
          Level.treasures.push({
            x: (cx + i) * TILE + 4, y: (row - 1) * TILE + 4,
            kind: rnd() < 0.55 ? 'relic' : rc(['chest', 'elixir', 'weapon']),
            data: rnd() < 0.55 ? rollRelic(2.2 + z.danger * 0.3) : null,
          });
        }
        Level.candles.push({ tx: cx + 1, ty: row - 2, drop: null });
        Level.candles.push({ tx: cx + wide - 1, ty: row - 2, drop: null });
        Level.props.push({ type: 'crystal', x: (cx + (wide >> 1)) * TILE, y: row * TILE });

        if (locked) {
          // a shrine of stone around the hoard, opened with a golden key
          rectFill(cx - 1, row - 5, cx - 1, row - 1, 1);
          rectFill(cx + wide + 1, row - 5, cx + wide + 1, row - 1, 1);
          rectFill(cx - 1, row - 6, cx + wide + 1, row - 6, 1);
          tset(cx - 1, row - 1, 12);
          tset(cx - 1, row - 2, 12);
          Level.sigils.push({ x: (cx - 3) * TILE, y: row * TILE, icon: 'key' });
        } else {
          Level.sigils.push({ x: (cx - 2) * TILE, y: row * TILE, icon: 'wing' });
        }
        Level.skyIslands.push({ x: cx * TILE, y: row * TILE, w: wide * TILE, locked });
        Level.landmarks.push({ x: (cx + (wide >> 1)) * TILE, y: row * TILE, kind: 'sky' });
      }
    }
  }

  // ---- the castle gate is quiet. Nobody wants a fiend in their face at the
  // first frame, before they have even learned the controls.
  {
    const z0 = Level.zones[0];
    if (z0) {
      const safeX0 = z0.x0, safeX1 = z0.x0 + TILE * 14;
      const clearOf = (list) => list.filter(o => !(o.x >= safeX0 - TILE && o.x <= safeX1));
      Level.hounds = clearOf(Level.hounds);
      Level.wolves = clearOf(Level.wolves);
      Level.throwers = clearOf(Level.throwers);
      Level.gargoyles = clearOf(Level.gargoyles);
      Level.spiders = clearOf(Level.spiders);
      Level.bats = clearOf(Level.bats);
      Level.zombieZones = Level.zombieZones.filter(z => z.x1 < safeX0 || z.x0 > safeX1);
      // and no spikes underfoot on the way out of the gate
      for (let cx = Math.floor(safeX0 / TILE); cx <= Math.floor(safeX1 / TILE); cx++) {
        for (let cy = 2; cy < LEVEL_H; cy++) {
          if (tileAt(cx, cy) === 3 || tileAt(cx, cy) === 15) tset(cx, cy, 1);
        }
      }
    }
  }

  // ---- risk must be paid for. Deeper zones carry more, and finer, treasure.
  {
    for (const z of Level.zones) {
      const want = 6 + z.danger * 5;
      const have = Level.treasures.filter(t => t.x >= z.x0 && t.x <= z.x1);
      let short = want - have.length;
      if (short <= 0) continue;
      // hang the rest on ledges and floors through the zone
      const c0 = Math.floor(z.x0 / TILE) + 3, c1 = Math.floor(z.x1 / TILE) - 3;
      for (let cx = c0; cx <= c1 && short > 0; cx += 4) {
        // a ledge or floor with air above it, and nothing there already
        let row = -1;
        for (let ty = 3; ty < LEVEL_H - 3; ty++) {
          const id = tileAt(cx, ty);
          if ((isSolid(id) || isPlatform(id)) && tileAt(cx, ty - 1) === 0 && tileAt(cx, ty - 2) === 0) {
            row = ty; break;
          }
        }
        if (row < 0) continue;
        if (Level.treasures.some(t => Math.abs(t.x - cx * TILE) < TILE * 5)) continue;
        const deep = z.danger;
        Level.treasures.push({
          x: cx * TILE + 4, y: (row - 1) * TILE + 4,
          kind: rnd() < 0.35 + deep * 0.06 ? 'relic' : rc(['heart', 'chest', 'elixir', 'heart']),
          data: null,
        });
        short--;
      }
    }
  }

  // ---- somewhere to catch your breath: an obelisk in every zone
  {
    for (const z of Level.zones) {
      const has = Level.obelisks.some(o => o.x >= z.x0 && o.x <= z.x1);
      if (has) continue;
      const c0 = Math.floor(z.x0 / TILE) + 6, c1 = Math.floor(z.x1 / TILE) - 6;
      for (let cx = c0; cx < c1; cx += 3) {
        const r = surfaceRow(cx);
        if (r < 3 || isSolid(tileAt(cx, r - 1)) || isSolid(tileAt(cx, r - 2))) continue;
        Level.obelisks.push({ x: cx * TILE + 2, y: r * TILE, lit: false });
        break;
      }
    }
    // then close any gap longer than a couple of screens, wherever it falls
    const MAXGAP = 120;
    for (let pass = 0; pass < 6; pass++) {
      const cols = Level.obelisks.map(o => Math.floor(o.x / TILE)).sort((a, b) => a - b);
      const ends = [Math.floor(Level.zones[0].x0 / TILE)].concat(cols)
        .concat([Math.floor(Level.pxW / TILE)]);
      let placed = false;
      for (let i = 1; i < ends.length; i++) {
        if (ends[i] - ends[i - 1] <= MAXGAP) continue;
        const target = Math.floor((ends[i] + ends[i - 1]) / 2);
        for (let d = 0; d < 40; d++) {
          let done = false;
          for (const cx of [target + d, target - d]) {
            const r = surfaceRow(cx);
            if (r < 3 || isSolid(tileAt(cx, r - 1)) || isSolid(tileAt(cx, r - 2))) continue;
            Level.obelisks.push({ x: cx * TILE + 2, y: r * TILE, lit: false });
            done = true; placed = true; break;
          }
          if (done) break;
        }
      }
      if (!placed) break;
    }
  }

  // ---- ore enough to forge with, in every zone
  {
    for (const z of Level.zones) {
      const c0 = Math.floor(z.x0 / TILE) + 4, c1 = Math.floor(z.x1 / TILE) - 4;
      let veins = 0;
      for (let tx = c0; tx <= c1; tx++) for (let ty = 2; ty < LEVEL_H; ty++) if (tileAt(tx, ty) === 13) veins++;
      let want = 6 - veins;
      for (let cx = c0; cx <= c1 && want > 0; cx += 7) {
        for (let cy = 4; cy < LEVEL_H - 4; cy++) {
          if (tileAt(cx, cy) !== 1) continue;
          const standable = (c) => tileAt(c, cy) === 0 && isSolid(tileAt(c, cy + 1)) && tileAt(c, cy - 1) === 0;
          if (!standable(cx - 1) && !standable(cx + 1)) continue;
          if ((Level.hollows || []).some(h => cx >= h.x0 - 1 && cx <= h.x1 + 1)) continue;
          tset(cx, cy, 13);
          want--;
          break;
        }
      }
    }
  }

  // ---- gargoyles cling to wall faces with a long drop beneath them. Perched on
  // top of stone they would have nothing to fall through, which is the whole trick.
  {
    const perched = [];
    for (const gy of Level.gargoyles) {
      const tx0 = Math.max(2, Math.min(LEVEL_W - 3, Math.floor(gy.x / TILE)));
      let best = null;
      for (let d = 0; d < 30 && !best; d++) {
        for (const c of [tx0 + d, tx0 - d]) {
          if (c < 2 || c >= LEVEL_W - 2) continue;
          for (let ty = 4; ty < LEVEL_H - 10; ty++) {
            if (isSolid(tileAt(c, ty))) continue;                  // must be open air
            // its body is wider than one tile, so it needs a pair of open columns
            // with a wall beyond one of them, and a real drop under both
            const pairs = [];
            if (isSolid(tileAt(c - 1, ty)) && !isSolid(tileAt(c + 1, ty))) pairs.push(c);
            if (isSolid(tileAt(c + 1, ty)) && !isSolid(tileAt(c - 1, ty))) pairs.push(c - 1);
            let hit = null;
            for (const p0 of pairs) {
              let drop = 0;
              while (drop < 12 &&
                     !isSolid(tileAt(p0, ty + 1 + drop)) &&
                     !isSolid(tileAt(p0 + 1, ty + 1 + drop))) drop++;
              if (drop >= 5) { hit = p0; break; }
            }
            if (hit === null) continue;
            best = { x: hit * TILE, y: ty * TILE };
            break;
          }
          if (best) break;
        }
      }
      if (best) perched.push(best);
    }
    Level.gargoyles = perched;
  }

  // ---- the castle is lived in. Crates, barrels, a cart, a lamp, a well —
  // sparse set pieces that break up long identical runs of wall.
  {
    const KIT = {
      castle: ['crateStack', 'crate', 'barrel', 'wagon', 'lamp'],
      graveyard: ['lamp', 'crate', 'well'],
      chapel: ['lantern', 'crate', 'barrel'],
      catacombs: ['crate', 'barrel'],
      clock: ['crateStack', 'barrel', 'wagon', 'crate'],
      keep: ['lamp', 'lantern', 'crateStack', 'barrel'],
      lunar: [],
    };
    for (const z of Level.zones) {
      const kit = KIT[z.biome] || KIT.castle;
      if (!kit.length) continue;       // nothing of the world's furniture floats
      const t0 = Math.floor(z.x0 / TILE), t1 = Math.floor(z.x1 / TILE);
      for (let cx = t0 + 8; cx < t1 - 8; cx += ri(24, 44)) {
        if (rnd() < 0.3) continue;
        const r = surfaceRow(cx);
        if (r < 4 || r > LEVEL_H - 2) continue;
        if (isSolid(tileAt(cx, r - 1)) || isSolid(tileAt(cx, r - 2))) continue;
        Level.props.push({ type: 'furniture', kind: rc(kit), x: cx * TILE, y: r * TILE });
      }
    }
  }

  // ---- every spawn and every piece of furniture stands on the floor that is
  // actually beneath it. This must run AFTER the spine is carved, because the
  // carve moves ground about.
  {
    const snap = (px) => {
      const tx0 = Math.max(0, Math.min(LEVEL_W - 1, Math.floor(px / TILE)));
      for (let d = 0; d < 40; d++) {
        for (const c of [tx0 + d, tx0 - d]) {
          const r = surfaceRow(c);
          if (r > 1 && Level.grid[(r - 1) * LEVEL_W + c] === 0 &&
              Level.grid[(r - 2) * LEVEL_W + c] === 0) {
            return { x: c * TILE + (px % TILE), y: r * TILE };
          }
        }
      }
      return { x: px, y: G_BASE * TILE };
    };
    const put = (o) => { const s2 = snap(o.x); o.x = s2.x; o.y = s2.y; };
    for (const h of Level.hounds) put(h);
    for (const w of Level.wolves) put(w);
    for (const t of (Level.throwers || [])) put(t);
    for (const p of Level.props) {
      if (p.type === 'chain' || p.type === 'banner' || p.type === 'chandelier') continue;
      put(p);
    }
    for (const o of Level.obelisks) put(o);
    for (const gl of Level.glimmers) put(gl);

    // a zone's dead rise from its floor; drop any zone whose middle is walled in
    Level.zombieZones = Level.zombieZones.filter(z => {
      const s2 = snap((z.x0 + z.x1) / 2);
      const tx = Math.floor(s2.x / TILE), ty = Math.floor(s2.y / TILE);
      if (isSolid(tileAt(tx, ty - 1)) || isSolid(tileAt(tx, ty - 2))) return false;
      z.groundY = s2.y;
      const half = Math.max(48, (z.x1 - z.x0) / 2);
      z.x0 = s2.x - half; z.x1 = s2.x + half;
      return true;
    });

    // spiders hang from stone rather than standing on it, so they get their own
    Level.spiders = (Level.spiders || []).map(sp => {
      const tx0 = Math.max(2, Math.min(LEVEL_W - 3, Math.floor(sp.x / TILE)));
      for (let d = 0; d < 20; d++) {
        for (const c of [tx0 + d, tx0 - d]) {
          if (c < 2 || c >= LEVEL_W - 2) continue;
          for (let ty = 4; ty < LEVEL_H - 6; ty++) {
            if (!isSolid(tileAt(c, ty))) continue;
            if (tileAt(c, ty + 1) !== 0 || tileAt(c, ty + 2) !== 0) continue;
            return { x: c * TILE + 1, y: (ty + 1) * TILE };
          }
        }
      }
      return null;
    }).filter(Boolean);
  }

  // ---- SECRET CHAMBERS. Rooms sealed inside the rock: not pockets the generator
  // forgot about, but places somebody walled up on purpose. Each is carved off
  // the walking line — beside it, or under it — so nothing here can break the
  // walk, and each is registered as a soft hollow so no later pass fills it in.
  // The entrance is the whole point: three of the four kinds ask for something a
  // guardian carries, so the castle keeps giving you reasons to come back.
  {
    Level.secrets = [];
    const SECRET_NAMES = [
      'THE HOLLOW BEHIND', 'THE WALLED CELL', 'THE FORGOTTEN STORE',
      'THE MASON\'S MISTAKE', 'THE SEALED ALCOVE', 'THE DEBTOR\'S ROOM',
      'THE UNDERCROFT', 'THE QUIET CACHE', 'THE BRICKED CHOIR',
      'THE THIEF\'S REST', 'THE LAST TENANT', 'THE SUNKEN OFFICE',
    ];
    let nameIdx = 0;
    const takeName = () => SECRET_NAMES[nameIdx++ % SECRET_NAMES.length];

    const allSolid = (x0, y0, x1, y1) => {
      for (let cy = y0; cy <= y1; cy++) {
        for (let cx2 = x0; cx2 <= x1; cx2++) {
          const id = tileAt(cx2, cy);
          if (id !== 1 && id !== 4) return false;
        }
      }
      return true;
    };
    const clearOfHollows = (x0, y0, x1, y1) => !(Level.hollows || []).some(h =>
      x1 >= h.x0 - 1 && x0 <= h.x1 + 1 && y1 >= h.y0 - 1 && y0 <= h.y1 + 1);

    // what is worth walling up
    const stock = (rect, danger, kind) => {
      const cx0 = rect.x0, cy1 = rect.y1;
      const rich = kind !== 'crack';        // an ability-gated door pays better
      for (let i = 0; i < rect.x1 - rect.x0; i += 2) {
        if (rnd() < 0.45) continue;
        Level.treasures.push({
          x: (cx0 + i) * TILE + 4, y: cy1 * TILE + 4,
          kind: rnd() < (rich ? 0.6 : 0.4) ? 'relic'
            : rc(rich ? ['chest', 'elixir', 'weapon', 'card'] : ['chest', 'heart', 'ore']),
          data: null,
        });
      }
      Level.candles.push({ tx: cx0, ty: cy1 - 2, drop: rich ? 'orb' : null });
      Level.candles.push({ tx: rect.x1, ty: cy1 - 2, drop: null });
      if (rich && rnd() < 0.4) {
        Level.props.push({ type: 'crystal', x: ((cx0 + rect.x1) >> 1) * TILE, y: cy1 * TILE });
      }
    };

    for (const z of Level.zones) {
      const c0 = Math.floor(z.x0 / TILE) + 6, c1 = Math.floor(z.x1 / TILE) - 10;
      if (c1 <= c0) continue;
      // Rare enough that finding one is an event: roughly one every few
      // screens, weighted toward the deep zones where the loot justifies it.
      const want = 1 + (z.danger >= 4 ? 1 : 0) + (z.danger >= 7 ? 1 : 0);
      let made = 0, tries = 0;
      while (made < want && tries++ < 500) {
        const cx = ri(c0, c1);
        // The floor is the one the hunter stands on OUTSIDE the door, not the
        // one on top of the wall — asking surfaceRow about a wall column gives
        // you the parapet, and every room behind a wall then failed to place.
        const r = surfaceRow(cx - 1);
        if (r < 8 || r > LEVEL_H - 12) continue;
        // there must be somewhere to stand right outside the door
        if (!isSolid(tileAt(cx - 1, r)) || tileAt(cx - 1, r - 1) !== 0 ||
            tileAt(cx - 1, r - 2) !== 0) continue;

        const below = (tries % 4) === 0;     // a quarter of attempts go under the floor
        let rect, entrance, kind;
        if (below) {
          // a room under the floor, dropped into through a cracked slab
          if (!isSolid(tileAt(cx, r))) continue;      // a slab to crack
          const y0 = r + 2, y1 = r + 4, x0 = cx, x1 = cx + ri(4, 6);
          if (x1 >= LEVEL_W - 3) continue;
          if (!allSolid(x0, y0 - 1, x1, y1 + 1)) continue;
          if (!clearOfHollows(x0, y0, x1, y1)) continue;
          rectFill(x0, y0, x1, y1, 0);
          rectFill(x0, y1 + 1, x1, y1 + 1, 4);
          tset(cx, r, 11);                  // the slab that gives way
          rect = { x0, y0, x1, y1 };
          entrance = { tx: cx, ty: r };
          kind = 'plunge';
        } else {
          // A vault BUILT into the hall rather than carved out of it. There is
          // almost no thick stone at walking height anywhere in this castle
          // (measured: 16 wall faces in 3,700 standable columns, none of them
          // deep), so a room behind the wall has to bring its own wall. Masons
          // walled these up; the hunter takes them back.
          // nothing already standing here: walling an obelisk or a forge into a
          // secret room loses it for good
          const occupied = (x0c, x1c) => {
            const px0 = (x0c - 1) * TILE, px1 = (x1c + 2) * TILE;
            const hits = o => o && o.x >= px0 && o.x <= px1 &&
              Math.abs(o.y - r * TILE) < 7 * TILE;
            // spawns are already snapped to the floor by the time this runs, so
            // building over one walls a fiend into the masonry
            for (const list of [Level.obelisks, Level.glimmers, Level.landmarks,
              Level.hounds, Level.wolves, Level.throwers, Level.gargoyles,
              Level.spiders, Level.bats]) {
              if ((list || []).some(hits)) return true;
            }
            if ((Level.zombieZones || []).some(zz =>
              zz.x1 >= px0 && zz.x0 <= px1)) return true;
            return (Level.props || []).some(o => hits(o) &&
              (o.type === 'forge' || o.type === 'shrine' || o.type === 'throne'));
          };
          let W = -1;
          for (const wide of [7, 6, 5, 4]) {
            if (cx + wide + 2 >= LEVEL_W - 4) continue;
            let ok = true;
            // the column to the LEFT must stay open, or the door has no doorstep
            for (let x = cx - 1; x <= cx + wide + 2 && ok; x++) {
              if (!isSolid(tileAt(x, r))) ok = false;               // floor to build on
              for (let y = r - 5; y <= r - 1 && ok; y++) {
                if (tileAt(x, y) !== 0) ok = false;                 // and clear air to build in
              }
            }
            if (ok && clearOfHollows(cx - 1, r - 5, cx + wide + 2, r - 1) &&
                !occupied(cx, cx + wide)) { W = wide; break; }
          }
          if (W < 0) continue;
          const x0 = cx + 1, x1 = cx + W, y0 = r - 2, y1 = r - 1;
          // the masonry: two jambs, a lid, and the hollow between them
          rectFill(cx, r - 3, cx, r - 1, 1);
          rectFill(x1 + 1, r - 3, x1 + 1, r - 1, 1);
          rectFill(cx, r - 3, x1 + 1, r - 3, 1);
          rectFill(x0, y0, x1, y1, 0);
          const roll = rnd();
          kind = roll < 0.55 ? 'crack' : roll < 0.82 ? 'mist' : 'key';
          const doorId = kind === 'key' ? 12 : 10;
          tset(cx, y1, doorId);
          tset(cx, y0, doorId);
          rect = { x0, y0, x1, y1 };
          entrance = { tx: cx, ty: y1 };
        }

        Level.hollows.push({ x0: rect.x0, y0: rect.y0, x1: rect.x1, y1: rect.y1, soft: true });
        stock(rect, z.danger, kind);
        Level.secrets.push({
          x0: rect.x0 * TILE, y0: rect.y0 * TILE,
          x1: (rect.x1 + 1) * TILE, y1: (rect.y1 + 1) * TILE,
          tx0: rect.x0, ty0: rect.y0, tx1: rect.x1, ty1: rect.y1,
          entrance, kind, zone: z.key, name: takeName(), found: false,
        });
        // a mark on the wall outside, for anyone who knows to read it
        if (kind !== 'crack') {
          Level.sigils.push({
            x: (entrance.tx - 2) * TILE, y: r * TILE,
            icon: kind === 'plunge' ? 'plunge' : kind === 'key' ? 'key' : 'wall',
          });
        }
        made++;
      }
    }
  }

  // ---- SCENES. The castle is walked one scene at a time, in the old way: the
  // view holds still within a scene, and when you cross its edge the picture
  // cuts to the next. Scenes are grown from the rooms the builders named, so
  // each one is a place with a name rather than an arbitrary slice.
  {
    Level.scenes = [];
    const MIN = 62;                    // a scene is at least a screen wide
    const regions = (Level.regions || []).slice().sort((a, b) => a.x0 - b.x0);
    let cur = null;
    for (const r of regions) {
      if (r.x1 <= r.x0) continue;
      const zone = (Level.zones || []).find(z => r.x0 >= z.x0 && r.x0 <= z.x1);
      // a guardian's hall is always a scene of its own — you do not wander in
      const solo = r.kind === 'arena';
      if (cur && !solo && (cur.x1 - cur.x0) / TILE < MIN && cur.zone === (zone && zone.key)) {
        cur.x1 = Math.max(cur.x1, r.x1);
        cur.rooms.push(r.name);
        continue;
      }
      if (cur) Level.scenes.push(cur);
      cur = {
        x0: r.x0, x1: r.x1, zone: zone ? zone.key : '?',
        zoneName: zone ? zone.name : '', name: r.name, rooms: [r.name],
        arena: solo,
      };
      if (solo) { Level.scenes.push(cur); cur = null; }
    }
    if (cur) Level.scenes.push(cur);

    // Halls first: pin every guardian's scene to the ground its guardian stands
    // on, and let its neighbours give way. Everything else is fitted around them.
    Level.scenes.sort((a, b) => a.x0 - b.x0);
    for (const A of (Level.bosses || [])) {
      const mid = (A.arenaX0 + A.arenaX1) / 2;
      const sc = Level.scenes.find(sc2 => mid >= sc2.x0 && mid < sc2.x1)
        || Level.scenes[Level.scenes.length - 1];
      if (!sc) continue;
      sc.arena = true;
      sc.x0 = Math.min(sc.x0, A.arenaX0 - 6 * TILE);
      sc.x1 = Math.max(sc.x1, A.arenaX1 + 6 * TILE, sc.x0 + MIN * TILE);
    }
    for (let i = 1; i < Level.scenes.length; i++) {
      const prev = Level.scenes[i - 1], sc = Level.scenes[i];
      if (sc.x0 < prev.x1) {
        if (sc.arena) prev.x1 = sc.x0;      // a hall never yields its ground
        else sc.x0 = prev.x1;
      }
    }
    Level.scenes = Level.scenes.filter(sc => sc.x1 - sc.x0 > 4 * TILE);

    // Fold away anything narrower than the view, so the camera always has
    // something to clamp to — but never fold a hall, and never fold into one.
    for (let i = Level.scenes.length - 1; i >= 0; i--) {
      const sc = Level.scenes[i];
      if (sc.arena || sc.x1 - sc.x0 >= MIN * TILE) continue;
      const prev = i > 0 ? Level.scenes[i - 1] : null;
      const next = i + 1 < Level.scenes.length ? Level.scenes[i + 1] : null;
      if (prev && !prev.arena) { prev.x1 = sc.x1; Level.scenes.splice(i, 1); }
      else if (next) { next.x0 = sc.x0; Level.scenes.splice(i, 1); }
      else if (prev) { prev.x1 = sc.x1; Level.scenes.splice(i, 1); }
    }

    // close every remaining gap by stretching the scene on its left, which
    // cannot move a hall's entrance
    for (let i = 1; i < Level.scenes.length; i++) {
      Level.scenes[i - 1].x1 = Level.scenes[i].x0;
    }
    Level.scenes[0].x0 = 0;
    Level.scenes[Level.scenes.length - 1].x1 = Level.pxW;
    Level.scenes.forEach((sc, i) => { sc.index = i; });
  }

  // ---- last word on the shafts. Several passes lay stone after the connectors
  // are carved, and any one of them can seal a tower or a lift well. Rather than
  // police them all, re-open every hollow the builders declared, keeping the
  // ledges and hazards that were deliberately put inside it.
  for (const h of (Level.hollows || [])) {
    if (h.soft) continue;      // a room, not a shaft: leave what stands in it
    for (let ty = Math.max(0, h.y0); ty <= Math.min(LEVEL_H - 1, h.y1); ty++) {
      for (let tx = Math.max(0, h.x0); tx <= Math.min(LEVEL_W - 1, h.x1); tx++) {
        const id = Level.grid[ty * LEVEL_W + tx];
        // stone, foundations, hidden doors and ore seams all jam a working shaft
        if (id === 1 || id === 4 || id === 10 || id === 13) Level.grid[ty * LEVEL_W + tx] = 0;
      }
    }
  }

  // ---- tidy the furniture. Generators lay things down in passes and do not
  // know what the next pass will put on top; this is where that is settled.
  {
    // candles bedded in stone light nothing: lift them into open air, or drop them
    const openCandles = [];
    for (const c of Level.candles) {
      if (!isSolid(tileAt(c.tx, c.ty)) && !isPlatform(tileAt(c.tx, c.ty))) { openCandles.push(c); continue; }
      let placed = false;
      for (const [dx, dy] of [[0, -1], [0, -2], [-1, 0], [1, 0], [-1, -1], [1, -1], [0, -3]]) {
        const nx = c.tx + dx, ny = c.ty + dy;
        if (nx < 1 || ny < 1 || nx >= LEVEL_W - 1 || ny >= LEVEL_H - 1) continue;
        if (isSolid(tileAt(nx, ny)) || isPlatform(tileAt(nx, ny))) continue;
        c.tx = nx; c.ty = ny; openCandles.push(c); placed = true; break;
      }
      // if there is nowhere for it, it simply was never there
      if (!placed) continue;
    }
    Level.candles = openCandles;

    // treasure buried in stone can never be taken: float it up to the nearest air
    const freeTreasure = [];
    for (const t of Level.treasures) {
      let tx = Math.floor((t.x + 4) / TILE), ty = Math.floor((t.y + 4) / TILE);
      if (!isSolid(tileAt(tx, ty))) { freeTreasure.push(t); continue; }
      let moved = false;
      for (let up = 1; up <= 6; up++) {
        if (!isSolid(tileAt(tx, ty - up))) {
          t.y = (ty - up) * TILE + 4; freeTreasure.push(t); moved = true; break;
        }
      }
      if (!moved) {
        for (const dx of [-1, 1, -2, 2]) {
          if (!isSolid(tileAt(tx + dx, ty))) {
            t.x = (tx + dx) * TILE + 4; freeTreasure.push(t); moved = true; break;
          }
        }
      }
    }
    Level.treasures = freeTreasure;

    // furniture standing inside other furniture: keep the larger, drop the smaller
    const BOX = {
      statue: 16, shrine: 16, forge: 16, merchant: 14, grave: 12,
      pillar: 16, sarcophagus: 26, throne: 20, crystal: 12,
    };
    const RANK = {
      shrine: 6, forge: 6, merchant: 5, throne: 5, sarcophagus: 4,
      pillar: 4, statue: 2, crystal: 2, grave: 1,
    };
    const kept = [];
    for (const p of Level.props) {
      const w2 = BOX[p.type];
      if (!w2) { kept.push(p); continue; }
      // furniture half-swallowed by a wall is worse than no furniture
      {
        const cx0 = Math.floor(p.x / TILE), cx1 = Math.floor((p.x + w2 - 1) / TILE);
        let buried = 0, cells = 0;
        for (let c = cx0; c <= cx1; c++) {
          for (let r = Math.floor(p.y / TILE) - 1; r >= Math.floor(p.y / TILE) - 2; r--) {
            cells++;
            if (isSolid(tileAt(c, r))) buried++;
          }
        }
        if (cells && buried / cells > 0.34) continue;
      }
      let clash = -1;
      for (let i = 0; i < kept.length; i++) {
        const q = kept[i], w3 = BOX[q.type];
        if (!w3) continue;
        if (Math.abs(p.y - q.y) > 40) continue;
        // leave a little air between things, not just avoid overlap
        const gap = Math.max(p.x, q.x) - Math.min(p.x + w2, q.x + w3);
        if (gap < 4) { clash = i; break; }
      }
      if (clash < 0) { kept.push(p); continue; }
      const q = kept[clash];
      if ((RANK[p.type] || 0) > (RANK[q.type] || 0)) kept[clash] = p;   // the better thing wins
    }
    Level.props = kept;
  }

  // ---- THE LAST WALK. The spine is carved per zone and several passes run
  // after it — the joins between zones belong to no zone at all, and re-opening
  // the connectors strips stone. So walk the whole castle one final time, end to
  // end, and make sure a hunter can too. Nothing runs after this.
  {
    const stand = (cx, want) => {
      let best = -1, bestD = 1e9;
      for (let r = 3; r < LEVEL_H - 3; r++) {
        const below = tileAt(cx, r + 1);
        if (!isSolid(below) && !isPlatform(below)) continue;
        if (isSolid(tileAt(cx, r)) || isSolid(tileAt(cx, r - 1)) || isSolid(tileAt(cx, r - 2))) continue;
        const d = Math.abs(r - want);
        if (d < bestD) { bestD = d; best = r; }
      }
      return best;
    };
    const wellAt = (cx, r) => (Level.hollows || []).find(h =>
      cx >= h.x0 && cx <= h.x1 && r >= h.y0 && r <= h.y1);
    const lastCol = Math.floor(Level.pxW / TILE) - 2;
    let cur = stand(2, G_BASE);
    if (cur < 0) cur = G_BASE;
    for (let cx = 3; cx <= lastCol; cx++) {
      const inConnector = (Level.hollows || []).some(h => cx >= h.x0 - 1 && cx <= h.x1 + 1);
      const found = stand(cx, cur);
      if (inConnector) { if (found > 0) cur = found; continue; }
      if (found > 0 && found >= cur - 4 && found <= cur + 8) {
        cur = found;
        for (let r = cur - 2; r <= cur - 1; r++) {
          const id = tileAt(cx, r);
          if (isSolid(id) && id !== 10 && id !== 12 && id !== 14) tset(cx, r, 0);
        }
        continue;
      }
      // either a wall to climb or a void to bridge: either way, one step at a time
      cur = found > 0 && found < cur ? Math.max(found, cur - 2) : cur;
      for (let r = cur - 2; r <= cur; r++) {
        const id = tileAt(cx, r);
        if (id === 10 || id === 12 || id === 14 || id === 13) continue;
        tset(cx, r, 0);
      }
      const w = wellAt(cx, cur + 1);
      if (!isSolid(tileAt(cx, cur + 1)) && !isPlatform(tileAt(cx, cur + 1))) {
        if (!w) { tset(cx, cur + 1, 1); noteGround(cx, cx, cur + 1); }
        else if (!w.lift) tset(cx, cur + 1, 2);
      }
    }
  }
}

// A single long arena for the boss rush: no fiends, no gates, just guardians.
// The old entry point: there are no stages any more, only the one castle.
function buildLevel(seed) {
  return buildWorld(seed || 1);
}

function buildRushLevel() {
  Level.grid = new Uint8Array(LEVEL_W * LEVEL_H);
  Level.candles = [];
  Level.zombieZones = [];
  Level.bats = [];
  Level.medusaZones = [];
  Level.hounds = [];
  Level.wolves = [];
  Level.props = [];
  Level.treasures = [];
  Level.obelisks = [];
  Level.biome = 'castle';
  Level.glimmers = [];
  Level.rainX0 = -99999; Level.rainX1 = -99999;
  Level.graveyard = null;
  rectFill(0, 0, 1, 13, 1);
  rectFill(2, 12, 65, 12, 1);
  rectFill(2, 13, 65, 13, 4);
  rectFill(66, 0, 68, 13, 1);
  for (let cx = 6; cx <= 62; cx += 9) {
    Level.candles.push({ tx: cx, ty: 10, drop: 'heart' });
    Level.props.push({ type: cx % 18 < 9 ? 'statue' : 'banner', x: cx * TILE, y: (cx % 18 < 9 ? 12 : 4) * TILE });
  }
  Level.boss = {
    triggerX: -1,
    gateTX: 0,
    arenaX0: 2 * TILE,
    arenaX1: 66 * TILE,
    homeX: 34 * TILE,
    homeY: 5 * TILE,
  };
  for (let cx = 0; cx < LEVEL_W; cx++) {
    if (isSolid(Level.grid[13 * LEVEL_W + cx])) {
      for (let y = 14; y < LEVEL_H; y++) tset(cx, y, 4);
    }
  }
  Level.pxW = 69 * TILE;
}

// ---------------------------------------------------------------- collision
// Actor: {x, y, w, h, vx, vy, dropTimer}. Moves and resolves against tiles.
function moveActor(a, dx, dy, ignorePlatforms) {
  const res = { onGround: false, hitWall: false, hitCeil: false, onSpike: false };

  // horizontal
  a.x += dx;
  if (dx !== 0) {
    const dir = dx > 0 ? 1 : -1;
    const edge = dir > 0 ? a.x + a.w : a.x;
    const tx = Math.floor(edge / TILE);
    for (let sy = 0; sy < 3; sy++) {
      const py = a.y + 2 + sy * (a.h - 4) / 2;
      if (isSolid(tileAt(tx, Math.floor(py / TILE)))) {
        a.x = dir > 0 ? tx * TILE - a.w - 0.01 : (tx + 1) * TILE + 0.01;
        res.hitWall = true;
        break;
      }
    }
  }

  // vertical
  const oldBottom = a.y + a.h;
  a.y += dy;
  if (dy > 0) {
    const bottom = a.y + a.h;
    const ty = Math.floor(bottom / TILE);
    for (let sx = 0; sx < 3; sx++) {
      const px = a.x + 1 + sx * (a.w - 2) / 2;
      const id = tileAt(Math.floor(px / TILE), ty);
      const landSolid = isSolid(id);
      const landPlat = isPlatform(id) && !ignorePlatforms &&
        oldBottom <= ty * TILE + 4 && !(a.dropTimer > 0);
      if (landSolid || landPlat) {
        a.y = ty * TILE - a.h;
        a.vy = 0;
        res.onGround = true;
        break;
      }
    }
  } else if (dy < 0) {
    const ty = Math.floor(a.y / TILE);
    for (let sx = 0; sx < 3; sx++) {
      const px = a.x + 1 + sx * (a.w - 2) / 2;
      if (isSolid(tileAt(Math.floor(px / TILE), ty))) {
        a.y = (ty + 1) * TILE + 0.01;
        a.vy = 0;
        res.hitCeil = true;
        break;
      }
    }
  }

  // spikes: check lower half of hitbox
  const ty0 = Math.floor((a.y + a.h / 2) / TILE), ty1 = Math.floor((a.y + a.h - 1) / TILE);
  const tx0 = Math.floor((a.x + 1) / TILE), tx1 = Math.floor((a.x + a.w - 1) / TILE);
  for (let ty = ty0; ty <= ty1 && !res.onSpike; ty++)
    for (let tx = tx0; tx <= tx1; tx++)
      if (isSpike(tileAt(tx, ty)) && a.y + a.h > ty * TILE + 6) { res.onSpike = true; break; }

  return res;
}

function standingOnGround(a) {
  const ty = Math.floor((a.y + a.h + 1) / TILE);
  for (let sx = 0; sx < 3; sx++) {
    const px = a.x + 1 + sx * (a.w - 2) / 2;
    const id = tileAt(Math.floor(px / TILE), ty);
    if (isSolid(id)) return true;
    if (isPlatform(id) && a.y + a.h <= ty * TILE + 4) return true;
  }
  return false;
}

// ---------------------------------------------------------------- rendering
// Tile an image horizontally across the view at a parallax factor.
function tileLayer(g, img, camX, factor, y, drift) {
  const w = img.width;
  let x = (-(camX * factor + (drift || 0)) % w);
  if (x > 0) x -= w;
  for (; x < VIEW_W; x += w) {
    g.drawImage(img, Math.floor(x), Math.floor(y));
  }
}

// Deterministic 2D noise, so backdrop dressing stays nailed to the same world
// coordinates however the camera wanders.
function bhash(a, b) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// A light. Flat discs read as stickers, so stack four rings to fake falloff.
function glowOrb(g, x, y, r, col, peak) {
  const n = 6;
  const p = Math.max(0.02, Math.min(0.85, peak));
  const a = (1 - Math.pow(1 - p, 1 / n)).toFixed(3);
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(${col},${a})`;
    g.beginPath(); g.arc(x, y, r * Math.pow(1 - i / n, 0.75), 0, 7); g.fill();
  }
}

// A quad, since the software renderer only knows fillRect, arc and polygons.
function quad(g, ax, ay, bx, by, cx, cy, dx, dy) {
  g.beginPath();
  g.moveTo(ax, ay); g.lineTo(bx, by); g.lineTo(cx, cy); g.lineTo(dx, dy);
  g.fill();
}

// A cogwheel: hub, rim and teeth, turned by `rot` radians.
function cogwheel(g, cx, cy, r, teeth, rot, dark, light) {
  g.fillStyle = light;
  g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
  g.fillStyle = dark;
  g.beginPath(); g.arc(cx, cy, r - 5, 0, 7); g.fill();
  g.fillStyle = light;
  for (let i = 0; i < teeth; i++) {
    const a = rot + i * Math.PI * 2 / teeth, w = 0.13;
    const r0 = r - 1, r1 = r + 5;
    quad(g,
      cx + Math.cos(a - w) * r0, cy + Math.sin(a - w) * r0,
      cx + Math.cos(a - w) * r1, cy + Math.sin(a - w) * r1,
      cx + Math.cos(a + w) * r1, cy + Math.sin(a + w) * r1,
      cx + Math.cos(a + w) * r0, cy + Math.sin(a + w) * r0);
  }
  for (let i = 0; i < 6; i++) {     // spokes
    const a = rot + i * Math.PI / 3, w = 0.05;
    quad(g,
      cx + Math.cos(a - w) * 5, cy + Math.sin(a - w) * 5,
      cx + Math.cos(a - w) * (r - 4), cy + Math.sin(a - w) * (r - 4),
      cx + Math.cos(a + w) * (r - 4), cy + Math.sin(a + w) * (r - 4),
      cx + Math.cos(a + w) * 5, cy + Math.sin(a + w) * 5);
  }
  g.beginPath(); g.arc(cx, cy, 7, 0, 7); g.fill();
  g.fillStyle = dark;
  g.beginPath(); g.arc(cx, cy, 3, 0, 7); g.fill();
}

// ---------------------------------------------------------------- backdrops
// Every biome paints its own room. `hy` is the screen row where open sky ends
// and the built world begins — it rides the camera, so climbing a tower opens
// the sky up and descending a shaft closes it off.
function drawNightSky(g, camX, camY, time, hy, skyOnly, noTown) {
  const A = Assets.img;
  g.fillStyle = '#040c0c';
  g.fillRect(0, 0, VIEW_W, Math.max(0, Math.min(VIEW_H, hy + 2)));
  if (hy < -230) return;
  tileLayer(g, A.bgSky, camX, 0.01, hy - 224);

  // the moon; every third descent it bleeds
  const blood = typeof game !== 'undefined' && game.stage % 3 === 0;
  const mx = (skyOnly ? VIEW_W - 62 : VIEW_W - 72) - camX * 0.02;
  const my = Math.min(hy - 150, 30 + (hy - 400) * 0.1);
  g.fillStyle = blood ? 'rgba(255,120,100,0.10)' : 'rgba(230,225,255,0.07)';
  g.beginPath(); g.arc(mx, my, 24, 0, 7); g.fill();
  g.fillStyle = blood ? '#dc6a58' : '#efeadc';
  g.beginPath(); g.arc(mx, my, 15, 0, 7); g.fill();
  g.fillStyle = blood ? '#b64c40' : '#d5cfc0';
  g.beginPath(); g.arc(mx - 4, my - 3, 3, 0, 7); g.fill();
  g.beginPath(); g.arc(mx + 5, my + 4, 2, 0, 7); g.fill();
  g.beginPath(); g.arc(mx + 2, my - 6, 1.5, 0, 7); g.fill();

  tileLayer(g, A.bgClouds, camX, 0.03, hy - 230, time * 0.04);
  tileLayer(g, A.bgMountains, camX, 0.07, hy - 214);
  if (noTown) return;      // the cemetery keeps its own horizon
  tileLayer(g, A.bgFar, camX, 0.15, hy - 106);
  tileLayer(g, A.bgTown, camX, 0.3, hy - 105);
}

function drawGraveSky(g, camX, camY, time, hy, skyOnly) {
  drawNightSky(g, camX, camY, time, hy, skyOnly, true);
}

// The lunar heart hangs outside the world: no horizon, only stars.
function drawVoidSky(g, camX, camY, time, hy) {
  const grd = g.createLinearGradient(0, 0, 0, VIEW_H);
  grd.addColorStop(0, '#05040f');
  grd.addColorStop(0.6, '#0b0820');
  grd.addColorStop(1, '#140c26');
  g.fillStyle = grd;
  g.fillRect(0, 0, VIEW_W, VIEW_H);

  for (let layer = 0; layer < 2; layer++) {
    const f = layer ? 0.09 : 0.03, span = 1400;
    const ox = ((camX * f) % span + span) % span;
    for (let k = 0; k < 90; k++) {
      const h = bhash(k, layer * 31);
      let x = (h * span) - ox;
      if (x < -8) x += span;
      if (x > VIEW_W + 8) continue;
      const y = bhash(k, layer * 31 + 7) * VIEW_H - camY * f * 0.4;
      const yy = ((y % VIEW_H) + VIEW_H) % VIEW_H;
      const tw = 0.5 + 0.5 * Math.sin(time * 0.03 + k);
      g.fillStyle = layer
        ? `rgba(214,226,255,${(0.35 + 0.35 * tw).toFixed(2)})`
        : `rgba(150,166,220,${(0.18 + 0.14 * tw).toFixed(2)})`;
      g.fillRect(Math.floor(x), Math.floor(yy), layer ? 2 : 1, layer ? 2 : 1);
    }
  }

  // the moon itself, enormous and close
  const mx = VIEW_W * 0.68 - camX * 0.02, my = 150 - camY * 0.02;
  g.fillStyle = 'rgba(150,200,240,0.05)';
  g.beginPath(); g.arc(mx, my, 150, 0, 7); g.fill();
  g.fillStyle = 'rgba(180,214,246,0.08)';
  g.beginPath(); g.arc(mx, my, 112, 0, 7); g.fill();
  g.fillStyle = '#cdd8ea';
  g.beginPath(); g.arc(mx, my, 96, 0, 7); g.fill();
  g.fillStyle = '#b3c0d6';
  for (let k = 0; k < 9; k++) {
    const a = bhash(k, 5) * 7, d = bhash(k, 9) * 78;
    g.beginPath();
    g.arc(mx + Math.cos(a) * d, my + Math.sin(a) * d, 5 + bhash(k, 13) * 14, 0, 7);
    g.fill();
  }
  g.fillStyle = '#05040f';   // waning crescent bite
  g.beginPath(); g.arc(mx + 54, my - 26, 88, 0, 7); g.fill();

  // aurora ribbons drifting across the void
  for (let b = 0; b < 3; b++) {
    const base = 120 + b * 130 - camY * 0.05;
    g.fillStyle = `rgba(90,${170 + b * 20},${230 - b * 30},0.045)`;
    for (let x = 0; x < VIEW_W; x += 8) {
      const w = Math.sin((x + camX * 0.06) * 0.006 + time * 0.012 + b) * 34;
      g.fillRect(x, Math.floor(base + w), 8, 26 + b * 8);
    }
  }
}

// ---- the outer wall: cut stone, arrow slits, moonlight coming through
function wallCastle(g, camX, camY, time, hy) {
  const wallY = Math.max(-60, hy);
  g.fillStyle = 'rgba(26,23,46,0.94)';
  g.fillRect(0, wallY, VIEW_W, VIEW_H - wallY);
  g.fillStyle = 'rgba(34,30,58,0.9)';
  for (let px = -((camX * 0.5) % 48); px < VIEW_W; px += 48)
    g.fillRect(Math.floor(px), wallY, 3, VIEW_H - wallY);
  g.fillStyle = 'rgba(15,13,30,0.5)';
  g.fillRect(0, wallY + 8, VIEW_W, 1);
  g.fillRect(0, wallY + 60, VIEW_W, 1);
  // crenellated parapet running along the top of the wall
  g.fillStyle = 'rgba(20,18,36,0.95)';
  for (let px = -((camX * 0.5) % 32); px < VIEW_W; px += 32)
    g.fillRect(Math.floor(px), wallY - 10, 18, 11);

  const span = 4224;
  for (let k = 0; k < 44; k++) {
    let x = ((k * 96 + 30 - camX * 0.5) % span + span) % span;
    if (x > VIEW_W + 30) continue;
    const wy = wallY + 20;
    x = Math.floor(x);
    g.fillStyle = '#0b0a18';
    g.fillRect(x, wy, 14, 30);
    g.beginPath();
    g.moveTo(x, wy); g.lineTo(x + 7, wy - 8); g.lineTo(x + 14, wy); g.fill();
    g.fillStyle = k % 3 === 2 ? 'rgba(190,60,70,0.13)' : 'rgba(200,195,240,0.10)';
    g.fillRect(x + 2, wy + 2, 10, 25);
    g.fillStyle = 'rgba(11,10,24,0.9)';
    g.fillRect(x + 6, wy + 2, 1, 25);
    g.fillRect(x + 2, wy + 12, 10, 1);
    if (k % 3 !== 2) {
      g.fillStyle = 'rgba(190,182,240,0.05)';
      quad(g, x, wy, x + 14, wy, x + 14 - 26, wy + 84, x - 26, wy + 84);
      g.fillStyle = 'rgba(200,192,248,0.04)';
      quad(g, x + 4, wy, x + 10, wy, x + 10 - 26, wy + 84, x + 4 - 26, wy + 84);
    }
    // a banner hung between every other pair of slits
    if (k % 2 === 0) {
      const bx = x + 48, sway = Math.sin(time * 0.02 + k) * 2;
      g.fillStyle = 'rgba(70,26,38,0.85)';
      g.fillRect(bx, wy + 4, 12, 46);
      g.fillStyle = 'rgba(96,36,50,0.85)';
      g.fillRect(bx + Math.round(sway) + 1, wy + 30, 10, 18);
      g.fillStyle = 'rgba(150,120,52,0.7)';
      g.fillRect(bx - 1, wy + 2, 14, 3);
    }
  }
}

// ---- the cemetery: no wall at all, just the dead standing in rows
function wallGraveyard(g, camX, camY, time, hy) {
  if (hy > VIEW_H) return;
  const A = Assets.img;
  // the real cemetery horizon: far peaks, then a field of stones
  if (A.bgGraveMountains) tileLayer(g, A.bgGraveMountains, camX, 0.10, hy - 168);
  if (A.bgGraveyard) tileLayer(g, A.bgGraveyard, camX, 0.24, hy - 108);
  // far hills, filling in beneath them
  g.fillStyle = 'rgba(16,26,20,0.9)';
  for (let x = 0; x < VIEW_W; x += 16) {
    const h = 22 + Math.sin((x + camX * 0.08) * 0.004) * 16 +
      Math.sin((x + camX * 0.08) * 0.011) * 8;
    g.fillRect(x, Math.floor(hy - h), 16, VIEW_H - hy + h);
  }
  // bare trees, clawing
  const span = 1600, f = 0.22;
  for (let k = 0; k < 20; k++) {
    let x = ((bhash(k, 3) * span - camX * f) % span + span) % span;
    if (x > VIEW_W + 40) continue;
    const base = hy + 6 + bhash(k, 11) * 10, ht = 60 + bhash(k, 17) * 60;
    x = Math.floor(x);
    g.fillStyle = 'rgba(10,14,12,0.92)';
    g.fillRect(x, Math.floor(base - ht), 4, ht);
    for (let b = 0; b < 4; b++) {
      const by = base - ht + 8 + b * (ht / 5);
      const dir = b % 2 ? 1 : -1, len = 10 + bhash(k, b) * 16;
      quad(g, x + 2, by, x + 2 + dir * len, by - len * 0.7,
        x + 2 + dir * len, by - len * 0.7 + 3, x + 2, by + 3);
    }
  }
  // iron fence with spearpoints
  const fspan = 24, fox = ((camX * 0.42) % fspan + fspan) % fspan;
  const fy = hy + 26;
  if (fy < VIEW_H) {
    g.fillStyle = 'rgba(12,16,16,0.9)';
    for (let x = -fox; x < VIEW_W; x += fspan) {
      g.fillRect(Math.floor(x), fy - 26, 3, 30);
      quad(g, x, fy - 26, x + 1.5, fy - 34, x + 3, fy - 26, x + 3, fy - 24);
    }
    g.fillRect(0, fy - 20, VIEW_W, 3);
    g.fillRect(0, fy - 4, VIEW_W, 3);
  }
  // headstones and crosses in receding rows
  for (let row = 0; row < 2; row++) {
    const rf = 0.34 + row * 0.16, rspan = 900;
    const alpha = row ? 0.85 : 0.6;
    for (let k = 0; k < 26; k++) {
      let x = ((bhash(k, 40 + row) * rspan - camX * rf) % rspan + rspan) % rspan;
      if (x > VIEW_W + 20) continue;
      x = Math.floor(x);
      const y = hy + 34 + row * 20, sc = row ? 1 : 0.75;
      if (y > VIEW_H) continue;
      g.fillStyle = `rgba(${row ? 44 : 30},${row ? 48 : 34},${row ? 58 : 44},${alpha})`;
      const kind = Math.floor(bhash(k, 60 + row) * 3);
      if (kind === 0) {
        g.fillRect(x, y - 26 * sc, 14 * sc, 26 * sc);
        g.beginPath(); g.arc(x + 7 * sc, y - 26 * sc, 7 * sc, 0, 7); g.fill();
      } else if (kind === 1) {
        g.fillRect(x + 5 * sc, y - 30 * sc, 5 * sc, 30 * sc);
        g.fillRect(x, y - 24 * sc, 15 * sc, 5 * sc);
      } else {
        g.fillRect(x, y - 18 * sc, 18 * sc, 18 * sc);
        g.fillRect(x - 2 * sc, y - 22 * sc, 22 * sc, 5 * sc);
      }
    }
  }
  // ground mist
  for (let b = 0; b < 3; b++) {
    const y = hy + 40 + b * 16;
    if (y > VIEW_H) break;
    g.fillStyle = `rgba(140,170,150,${(0.035 - b * 0.008).toFixed(3)})`;
    for (let x = 0; x < VIEW_W; x += 12) {
      const w = Math.sin((x + camX * 0.2 + time * 0.5) * 0.01 + b) * 5;
      g.fillRect(x, Math.floor(y + w), 12, 16);
    }
  }
}

// ---- the chapel: a real cathedral wall, from the Gothicvania church pack
const CHURCH_PANELS = [[0, 160], [176, 128], [320, 128], [464, 80], [560, 64]];
function wallChapel(g, camX, camY, time, hy) {
  const top = Math.max(-40, hy);
  g.fillStyle = '#272638';
  g.fillRect(0, top, VIEW_W, VIEW_H - top);
  const img = Assets.img.churchProps;
  if (img) {
    let total = 0;
    for (const p of CHURCH_PANELS) total += p[1];
    const f = 0.45;
    const ox = ((camX * f) % total + total) % total;
    for (let y = top; y < VIEW_H; y += 192) {
      let x = -ox, i = 0;
      while (x < VIEW_W) {
        const [sx, w] = CHURCH_PANELS[i % CHURCH_PANELS.length];
        if (x + w > 0) g.drawImage(img, sx, 0, w, 192, Math.floor(x), Math.floor(y), w, 192);
        x += w; i++;
      }
    }
  }
  // a vaulted arcade in front of the wall, and coloured light falling from it
  const aspan = 168, aox = ((camX * 0.55) % aspan + aspan) % aspan;
  for (let x = -aox; x < VIEW_W; x += aspan) {
    const ax = Math.floor(x), ay = top + 30;
    if (ay > VIEW_H) break;
    g.fillStyle = 'rgba(20,19,32,0.55)';
    g.fillRect(ax, ay, 96, VIEW_H - ay);
    g.beginPath();
    g.moveTo(ax, ay); g.lineTo(ax + 48, ay - 40); g.lineTo(ax + 96, ay); g.fill();
    const k = Math.round((x + camX * 0.55) / aspan);
    // every fourth bay is broken open on the night outside — the eye needs
    // somewhere to rest, and it tells you how high up the chapel sits
    if (k % 4 === 2) {
      g.fillStyle = '#0a0c1c';
      g.fillRect(ax + 20, ay + 6, 56, 100);
      g.fillStyle = 'rgba(200,206,240,0.10)';
      g.beginPath(); g.arc(ax + 58, ay + 30, 11, 0, 7); g.fill();
      g.fillStyle = '#d5cfc0';
      g.beginPath(); g.arc(ax + 58, ay + 30, 6, 0, 7); g.fill();
      g.fillStyle = 'rgba(28,26,52,0.95)';   // distant towers against the sky
      for (let t = 0; t < 4; t++) {
        const th = 22 + bhash(k, t) * 40;
        g.fillRect(ax + 22 + t * 14, ay + 106 - th, 11, th);
      }
      g.fillStyle = 'rgba(190,182,240,0.05)';
      quad(g, ax + 20, ay + 6, ax + 76, ay + 6,
        ax + 76 - 44, ay + 200, ax + 20 - 44, ay + 200);
      continue;
    }
    const rose = k % 3 === 1;
    g.fillStyle = rose ? 'rgba(180,50,64,0.22)' : 'rgba(120,140,220,0.16)';
    g.fillRect(ax + 30, ay + 12, 36, 74);
    g.beginPath();
    g.moveTo(ax + 30, ay + 12); g.lineTo(ax + 48, ay - 12);
    g.lineTo(ax + 66, ay + 12); g.fill();
    g.fillStyle = 'rgba(16,15,28,0.85)';
    g.fillRect(ax + 47, ay + 8, 2, 78);
    g.fillRect(ax + 30, ay + 40, 36, 2);
    // the shaft of light this window throws on the floor
    g.fillStyle = rose ? 'rgba(200,70,84,0.045)' : 'rgba(160,176,240,0.05)';
    quad(g, ax + 30, ay + 12, ax + 66, ay + 12,
      ax + 66 - 40, ay + 190, ax + 30 - 40, ay + 190);
  }
  // hanging censers swinging on their chains
  const cspan = 336, cox = ((camX * 0.6) % cspan + cspan) % cspan;
  for (let x = -cox; x < VIEW_W; x += cspan) {
    const k = Math.round((x + camX * 0.6) / cspan);
    const sw = Math.sin(time * 0.017 + k) * 16;
    const cx = Math.floor(x + 84 + sw), cy = top + 12;
    if (cy > VIEW_H) break;
    g.fillStyle = 'rgba(60,56,74,0.8)';
    g.fillRect(cx, cy, 1, 54);
    g.fillStyle = 'rgba(150,120,52,0.75)';
    g.fillRect(cx - 5, cy + 54, 11, 9);
    glowOrb(g, cx, cy + 58, 22, '255,180,80', 0.26 + 0.10 * Math.sin(time * 0.06 + k));
  }
}

// ---- the catacombs: packed earth, bone niches, no sky whatsoever
function wallCatacombs(g, camX, camY, time, hy) {
  const grd = g.createLinearGradient(0, 0, 0, VIEW_H);
  grd.addColorStop(0, '#0d0a12');
  grd.addColorStop(0.45, '#191324');
  grd.addColorStop(1, '#221a26');
  g.fillStyle = grd;
  g.fillRect(0, 0, VIEW_W, VIEW_H);

  // strata: bands of packed earth, drifting with the camera
  const soff = camY * 0.35;
  for (let b = -1; b < 14; b++) {
    const y = Math.floor(b * 44 - (soff % 44));
    if (y > VIEW_H) break;
    g.fillStyle = b % 2 ? 'rgba(46,34,44,0.35)' : 'rgba(30,22,32,0.35)';
    g.fillRect(0, y, VIEW_W, 44);
    g.fillStyle = 'rgba(12,9,14,0.4)';
    for (let x = 0; x < VIEW_W; x += 48) {
      const j = Math.floor(bhash(b, x >> 4) * 5);
      g.fillRect(x, y + j, 48, 2);
    }
  }
  const cw = Assets.img.caveWalls;
  if (cw) {
    const y = Math.floor(-40 - camY * 0.3);
    for (let yy = y; yy < VIEW_H; yy += cw.height) tileLayer(g, cw, camX, 0.3, yy);
    g.fillStyle = 'rgba(8,6,12,0.42)';
    g.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  caveDepthLayers(g, camX, camY, time);
  // brick facing over the earth, so the wall is never a flat void
  const bw = 34, bh = 17, bf = 0.5;
  const bx0 = ((camX * bf) % bw + bw) % bw, by0 = ((camY * bf) % bh + bh) % bh;
  for (let y = -by0, ry = 0; y < VIEW_H; y += bh, ry++) {
    const stag = (ry & 1) ? bw / 2 : 0;
    for (let x = -bx0 - stag; x < VIEW_W; x += bw) {
      const v = bhash(Math.round((x + camX * bf) / bw), Math.round((y + camY * bf) / bh));
      g.fillStyle = `rgba(${52 + v * 16 | 0},${40 + v * 14 | 0},${48 + v * 14 | 0},0.20)`;
      g.fillRect(Math.floor(x) + 1, Math.floor(y) + 1, bw - 2, bh - 2);
    }
  }
  // bone niches: small arched alcoves, sparse enough to read as placed
  const nspan = 176, f = 0.5;
  const nox = ((camX * f) % nspan + nspan) % nspan;
  const rowH = 150, roy = ((camY * f) % rowH + rowH) % rowH;
  for (let ry = -roy; ry < VIEW_H; ry += rowH) {
    for (let x = -nox; x < VIEW_W; x += nspan) {
      const kx = Math.round((x + camX * f) / nspan), ky = Math.round((ry + camY * f) / rowH);
      if (bhash(kx, ky) < 0.55) continue;
      const ax = Math.floor(x), ay = Math.floor(ry) + 30;
      g.fillStyle = 'rgba(66,54,60,0.5)';    // carved surround, catching light
      g.fillRect(ax - 3, ay - 3, 44, 42);
      g.beginPath();
      g.moveTo(ax - 3, ay); g.lineTo(ax + 19, ay - 16); g.lineTo(ax + 41, ay); g.fill();
      g.fillStyle = 'rgba(26,20,28,0.6)';    // the recess itself
      g.fillRect(ax, ay, 38, 36);
      g.beginPath();
      g.moveTo(ax, ay + 1); g.lineTo(ax + 19, ay - 11); g.lineTo(ax + 38, ay + 1); g.fill();
      const rows = 1 + Math.floor(bhash(kx, ky + 5) * 2);
      for (let s = 0; s < rows * 3; s++) {
        const sx = ax + 5 + (s % 3) * 11, sy = ay + 22 - Math.floor(s / 3) * 12;
        g.fillStyle = 'rgba(158,148,134,0.75)';
        g.beginPath(); g.arc(sx + 4, sy + 4, 4, 0, 7); g.fill();
        g.fillStyle = 'rgba(10,8,10,0.95)';
        g.fillRect(sx + 2, sy + 3, 2, 2);
        g.fillRect(sx + 6, sy + 3, 2, 2);
      }
      g.fillStyle = 'rgba(84,70,76,0.6)';
      g.fillRect(ax - 4, ay + 36, 46, 3);
    }
  }
  // an occasional guttering sconce — one warm spot in a cold field
  const tspan = 268, tox = ((camX * 0.55) % tspan + tspan) % tspan;
  for (let x = -tox; x < VIEW_W; x += tspan) {
    const k = Math.round((x + camX * 0.55) / tspan);
    const ty = 130 + bhash(k, 77) * 220 - camY * 0.16;
    if (ty < -30 || ty > VIEW_H) continue;
    const ax = Math.floor(x), ay = Math.floor(ty);
    const fl = 0.5 + 0.5 * Math.sin(time * 0.11 + k * 3);
    g.fillStyle = 'rgba(48,40,44,0.9)';
    g.fillRect(ax, ay, 5, 12);
    g.fillRect(ax - 2, ay - 3, 9, 4);
    glowOrb(g, ax + 2, ay - 6, 34, '255,150,60', 0.16 + 0.08 * fl);
    g.fillStyle = '#ffab48';
    g.beginPath(); g.arc(ax + 2, ay - 7 - fl * 2, 4, 0, 7); g.fill();
  }
  // roots reaching down out of the ceiling
  const rspan = 74, rox = ((camX * 0.62) % rspan + rspan) % rspan;
  for (let x = -rox; x < VIEW_W; x += rspan) {
    const k = Math.round((x + camX * 0.62) / rspan);
    if (bhash(k, 91) < 0.5) continue;
    const len = 30 + bhash(k, 92) * 70, ax = Math.floor(x);
    g.fillStyle = 'rgba(28,20,16,0.75)';
    for (let i = 0; i < len; i += 4)
      g.fillRect(ax + Math.round(Math.sin(i * 0.09 + k) * 5), -20 + i, 3, 4);
  }
}

// ---- the clock ruin: gears turning behind everything
function wallClock(g, camX, camY, time, hy) {
  const top = Math.max(-40, hy);
  g.fillStyle = 'rgba(28,22,18,0.95)';
  g.fillRect(0, top, VIEW_W, VIEW_H - top);
  // plank wall
  g.fillStyle = 'rgba(38,29,22,0.9)';
  for (let x = -((camX * 0.4) % 26); x < VIEW_W; x += 26)
    g.fillRect(Math.floor(x), top, 22, VIEW_H - top);

  // great slow wheels, then a faster set in front
  const spanA = 420, oxA = ((camX * 0.16) % spanA + spanA) % spanA;
  for (let x = -oxA; x < VIEW_W + 200; x += spanA) {
    const k = Math.round((x + camX * 0.16) / spanA);
    const cy = top + 120 + bhash(k, 2) * 90 - camY * 0.05;
    cogwheel(g, Math.floor(x + 100), Math.floor(cy), 92, 18,
      time * 0.004 * (k % 2 ? 1 : -1), 'rgba(30,23,17,0.95)', 'rgba(74,58,34,0.95)');
  }
  const spanB = 250, oxB = ((camX * 0.38) % spanB + spanB) % spanB;
  for (let x = -oxB; x < VIEW_W + 120; x += spanB) {
    const k = Math.round((x + camX * 0.38) / spanB);
    const cy = top + 70 + bhash(k, 8) * 190 - camY * 0.12;
    cogwheel(g, Math.floor(x + 60), Math.floor(cy), 42, 12,
      -time * 0.012 * (k % 2 ? 1 : -1), 'rgba(36,27,18,0.95)', 'rgba(122,94,44,0.9)');
  }
  // the great pendulum
  const px = VIEW_W * 0.5 - camX * 0.22 % (VIEW_W * 2);
  const ang = Math.sin(time * 0.011) * 0.42;
  const ax = px + 300, ay = Math.max(top + 10, 10);
  const bx = ax + Math.sin(ang) * 330, by = ay + Math.cos(ang) * 330;
  g.fillStyle = 'rgba(20,15,10,0.85)';
  quad(g, ax - 3, ay, ax + 3, ay, bx + 3, by, bx - 3, by);
  g.fillStyle = 'rgba(140,108,48,0.85)';
  g.beginPath(); g.arc(bx, by, 26, 0, 7); g.fill();
  g.fillStyle = 'rgba(60,44,20,0.9)';
  g.beginPath(); g.arc(bx, by, 15, 0, 7); g.fill();
  // brass dust in the air
  g.fillStyle = 'rgba(210,170,80,0.05)';
  g.fillRect(0, top, VIEW_W, VIEW_H - top);
}

// ---- the blood keep: tapestries, braziers, iron
function wallKeep(g, camX, camY, time, hy) {
  const grd = g.createLinearGradient(0, 0, 0, VIEW_H);
  grd.addColorStop(0, '#150610');
  grd.addColorStop(0.5, '#28101a');
  grd.addColorStop(1, '#1a0a12');
  g.fillStyle = grd;
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  // the painted castle interior — chandeliers, stair, statuary — laid in first
  const cp = Assets.img.castlePanels;
  if (cp) {
    const y = Math.floor(90 - camY * 0.34);
    const src = [16, 0, 448, 160];
    const f = 0.4, ox = ((camX * f) % src[2] + src[2]) % src[2];
    for (let x = -ox; x < VIEW_W; x += src[2]) {
      g.drawImage(cp, src[0], src[1], src[2], src[3],
        Math.floor(x), y, src[2], src[3]);
    }
    g.fillStyle = 'rgba(30,4,12,0.5)';
    g.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  // masonry courses
  g.fillStyle = 'rgba(10,4,8,0.45)';
  for (let y = -((camY * 0.4) % 34); y < VIEW_H; y += 34) g.fillRect(0, Math.floor(y), VIEW_W, 2);
  g.fillStyle = 'rgba(58,20,30,0.5)';
  for (let x = -((camX * 0.4) % 58); x < VIEW_W; x += 58) g.fillRect(Math.floor(x), 0, 3, VIEW_H);

  // tall tapestries carrying the moon sigil
  const tspan = 196, tox = ((camX * 0.5) % tspan + tspan) % tspan;
  for (let x = -tox; x < VIEW_W; x += tspan) {
    const k = Math.round((x + camX * 0.5) / tspan);
    const ty = 20 + bhash(k, 3) * 40 - camY * 0.1;
    const ax = Math.floor(x + 40), ay = Math.floor(ty);
    g.fillStyle = 'rgba(66,14,24,0.55)';
    g.fillRect(ax, ay, 66, 210);
    g.fillStyle = 'rgba(48,8,16,0.5)';
    for (let i = 0; i < 4; i++) g.fillRect(ax + 6 + i * 16, ay, 3, 210);
    g.fillStyle = 'rgba(112,88,40,0.5)';
    g.fillRect(ax - 4, ay - 5, 74, 6);
    for (let i = 0; i < 5; i++) g.fillRect(ax + 4 + i * 15, ay + 210, 6, 8);
    g.fillStyle = 'rgba(150,126,62,0.34)';
    g.beginPath(); g.arc(ax + 33, ay + 74, 17, 0, 7); g.fill();
    g.fillStyle = 'rgba(58,12,20,0.9)';
    g.beginPath(); g.arc(ax + 41, ay + 68, 15, 0, 7); g.fill();
  }
  // iron braziers burning along the hall
  const bspan = 152, box = ((camX * 0.62) % bspan + bspan) % bspan;
  for (let x = -box; x < VIEW_W; x += bspan) {
    const k = Math.round((x + camX * 0.62) / bspan);
    const by = 250 + bhash(k, 21) * 90 - camY * 0.2;
    const ax = Math.floor(x), ay = Math.floor(by);
    if (ay < -40 || ay > VIEW_H + 40) continue;
    g.fillStyle = 'rgba(24,20,26,0.95)';
    g.fillRect(ax + 8, ay, 4, 46);
    g.fillRect(ax, ay - 8, 20, 9);
    const fl = 0.5 + 0.5 * Math.sin(time * 0.13 + k * 2);
    glowOrb(g, ax + 10, ay - 12, 40, '255,140,50', 0.20 + 0.10 * fl);
    g.fillStyle = '#ff9a30';
    g.beginPath(); g.arc(ax + 10, ay - 14 - fl * 3, 6, 0, 7); g.fill();
    g.fillStyle = '#ffd870';
    g.beginPath(); g.arc(ax + 10, ay - 12, 3, 0, 7); g.fill();
  }
  // hanging chains and an empty cage or two
  const cspan = 244, cox = ((camX * 0.7) % cspan + cspan) % cspan;
  for (let x = -cox; x < VIEW_W; x += cspan) {
    const k = Math.round((x + camX * 0.7) / cspan);
    const drop = 90 + bhash(k, 44) * 130 - camY * 0.16;
    const ax = Math.floor(x + 120);
    g.fillStyle = 'rgba(40,34,40,0.9)';
    for (let y = -20; y < drop; y += 6) g.fillRect(ax, Math.floor(y), 3, 4);
    if (bhash(k, 45) > 0.5 && drop < VIEW_H) {
      const cy = Math.floor(drop);
      g.fillStyle = 'rgba(34,28,34,0.9)';
      for (let i = 0; i < 5; i++) g.fillRect(ax - 12 + i * 6, cy, 2, 30);
      g.fillRect(ax - 14, cy, 32, 3);
      g.fillRect(ax - 14, cy + 28, 32, 3);
    }
  }
}

// ---- the lunar heart: nothing behind you but the void and drifting stone
function wallLunar(g, camX, camY, time, hy) {
  const span = 700, f = 0.24;
  const ox = ((camX * f) % span + span) % span;
  for (let x = -ox; x < VIEW_W + 200; x += span) {
    for (let n = 0; n < 3; n++) {
      const k = Math.round((x + camX * f) / span) * 3 + n;
      const ix = Math.floor(x + bhash(k, 1) * span);
      const iy = Math.floor(bhash(k, 2) * VIEW_H * 1.3 - 60 - camY * f * 0.5 +
        Math.sin(time * 0.008 + k) * 6);
      if (iy < -80 || iy > VIEW_H + 60) continue;
      const w = 90 + bhash(k, 3) * 150;
      g.fillStyle = 'rgba(24,22,44,0.9)';
      g.fillRect(ix, iy, w, 26);            // the moonstone cap
      // a ragged underside: teeth of uneven length, not one tidy cone
      for (let t = 0; t < 5; t++) {
        const tw = w / 5, tx = ix + t * tw;
        const len = 12 + bhash(k, 20 + t) * (t === 2 ? 66 : 34);
        quad(g, tx, iy + 24, tx + tw, iy + 24,
          tx + tw * 0.66, iy + 24 + len, tx + tw * 0.28, iy + 24 + len * 0.62);
      }
      g.fillStyle = 'rgba(58,60,102,0.8)';
      g.fillRect(ix, iy, w, 4);
      // a ruined column standing on the island
      if (bhash(k, 5) > 0.45) {
        const px = ix + Math.floor(w * 0.4), ph = 26 + bhash(k, 6) * 30;
        g.fillStyle = 'rgba(40,40,72,0.85)';
        g.fillRect(px, iy - ph, 10, ph);
        g.fillRect(px - 3, iy - ph, 16, 4);
      }
    }
  }
  // motes of light rising out of the dark
  for (let k = 0; k < 34; k++) {
    const sp = 1100;
    let x = ((bhash(k, 71) * sp - camX * 0.35) % sp + sp) % sp;
    if (x > VIEW_W) continue;
    const y = ((bhash(k, 72) * VIEW_H - time * (0.3 + bhash(k, 73)) - camY * 0.3)
      % VIEW_H + VIEW_H) % VIEW_H;
    g.fillStyle = `rgba(150,220,255,${(0.2 + 0.25 * Math.sin(time * 0.05 + k)).toFixed(2)})`;
    g.fillRect(Math.floor(x), Math.floor(y), 2, 2);
  }
}

// ---- the drowned cistern: brick vaults half full of still water
function wallCistern(g, camX, camY, time, hy) {
  const grd = g.createLinearGradient(0, 0, 0, VIEW_H);
  grd.addColorStop(0, '#08131a');
  grd.addColorStop(0.5, '#0e2430');
  grd.addColorStop(1, '#0a1a24');
  g.fillStyle = grd;
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  // brick barrel-vaults receding down the channel
  const vspan = 148, f = 0.42;
  const vox = ((camX * f) % vspan + vspan) % vspan;
  for (let d = 2; d >= 0; d--) {
    const inset = d * 16, sh = 0.18 + d * 0.1;
    g.fillStyle = `rgba(6,16,22,${sh.toFixed(2)})`;
    for (let x = -vox - inset; x < VIEW_W; x += vspan) {
      const ax = Math.floor(x), ay = Math.floor(120 - camY * f * 0.5) + d * 10;
      g.fillRect(ax + inset, ay, vspan - 24 - inset * 2, VIEW_H);
      g.beginPath();
      g.moveTo(ax + inset, ay);
      g.lineTo(ax + (vspan - 24) / 2, ay - 52 + d * 8);
      g.lineTo(ax + vspan - 24 - inset, ay); g.fill();
    }
  }
  // course lines, so the vault reads as brick and not as paint
  g.fillStyle = 'rgba(70,104,118,0.16)';
  for (let y = -((camY * f) % 15); y < VIEW_H; y += 15) g.fillRect(0, Math.floor(y), VIEW_W, 1);
  // the waterline, and what it gives back
  const wl = Math.floor(340 - camY * 0.5);
  if (wl < VIEW_H && wl > -80) {
    g.fillStyle = 'rgba(30,86,110,0.30)';
    g.fillRect(0, wl, VIEW_W, VIEW_H - wl);
    for (let b = 0; b < 5; b++) {
      const y = wl + 6 + b * 13;
      if (y > VIEW_H) break;
      g.fillStyle = `rgba(140,206,230,${(0.05 - b * 0.008).toFixed(3)})`;
      for (let x = 0; x < VIEW_W; x += 10) {
        const w = Math.sin((x + camX * 0.3) * 0.03 + time * 0.05 + b) * 3;
        g.fillRect(x, Math.floor(y + w), 8, 2);
      }
    }
    g.fillStyle = 'rgba(170,224,244,0.14)';
    g.fillRect(0, wl, VIEW_W, 1);
  }
  // drips falling out of the vault
  for (let k = 0; k < 26; k++) {
    const sp = 900;
    let x = ((bhash(k, 31) * sp - camX * 0.5) % sp + sp) % sp;
    if (x > VIEW_W) continue;
    const y = ((bhash(k, 32) * 400 + time * (1.4 + bhash(k, 33) * 2)) % 400) + 40 - camY * 0.4;
    if (y < 0 || y > VIEW_H) continue;
    g.fillStyle = 'rgba(160,214,236,0.35)';
    g.fillRect(Math.floor(x), Math.floor(y), 1, 4);
  }
}

// ---- the black foundry: the melt below, iron above
function wallFoundry(g, camX, camY, time, hy) {
  const grd = g.createLinearGradient(0, 0, 0, VIEW_H);
  grd.addColorStop(0, '#0e0805');
  grd.addColorStop(0.55, '#1e0f08');
  grd.addColorStop(1, '#3a1608');
  g.fillStyle = grd;
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  // riveted plate wall
  const pw = 62, ph = 40, f = 0.45;
  const px0 = ((camX * f) % pw + pw) % pw, py0 = ((camY * f) % ph + ph) % ph;
  for (let y = -py0; y < VIEW_H; y += ph) {
    for (let x = -px0; x < VIEW_W; x += pw) {
      g.fillStyle = 'rgba(48,28,18,0.35)';
      g.fillRect(Math.floor(x) + 1, Math.floor(y) + 1, pw - 2, ph - 2);
      g.fillStyle = 'rgba(96,58,30,0.30)';
      for (let r = 0; r < 4; r++) {
        g.fillRect(Math.floor(x) + 5 + (r % 2) * (pw - 14), Math.floor(y) + 5 + ((r >> 1) * (ph - 12)), 2, 2);
      }
    }
  }
  // furnace mouths, breathing
  const fspan = 224, fox = ((camX * 0.55) % fspan + fspan) % fspan;
  for (let x = -fox; x < VIEW_W; x += fspan) {
    const k = Math.round((x + camX * 0.55) / fspan);
    const fy = 210 + bhash(k, 12) * 120 - camY * 0.22;
    if (fy < -60 || fy > VIEW_H + 40) continue;
    const ax = Math.floor(x + 40), ay = Math.floor(fy);
    const beat = 0.5 + 0.5 * Math.sin(time * 0.04 + k * 2);
    g.fillStyle = 'rgba(18,10,6,0.9)';
    g.fillRect(ax - 6, ay - 6, 72, 60);
    g.fillStyle = '#5a1c06';
    g.fillRect(ax, ay, 60, 48);
    g.fillStyle = `rgb(${(180 + beat * 60) | 0},${(60 + beat * 50) | 0},20)`;
    g.fillRect(ax + 6, ay + 8, 48, 34);
    g.fillStyle = `rgba(255,${(190 + beat * 50) | 0},120,0.85)`;
    g.fillRect(ax + 16, ay + 16, 28, 18);
    glowOrb(g, ax + 30, ay + 24, 78, '255,120,30', 0.22 + 0.12 * beat);
    g.fillStyle = 'rgba(70,44,24,0.9)';       // the grate across its mouth
    for (let i = 0; i < 5; i++) g.fillRect(ax + 4 + i * 12, ay, 3, 48);
  }
  // the melt itself, glowing up from under the floor
  const meltY = Math.floor(430 - camY * 0.34);
  if (meltY < VIEW_H) {
    g.fillStyle = 'rgba(120,34,8,0.5)';
    g.fillRect(0, meltY, VIEW_W, VIEW_H - meltY);
    for (let x = 0; x < VIEW_W; x += 12) {
      const w = Math.sin((x + camX * 0.34) * 0.02 + time * 0.06) * 4;
      g.fillStyle = 'rgba(230,110,30,0.28)';
      g.fillRect(x, Math.floor(meltY + w), 12, 8);
    }
  }
  // sparks rising
  for (let k = 0; k < 30; k++) {
    const sp = 800;
    let x = ((bhash(k, 61) * sp - camX * 0.45) % sp + sp) % sp;
    if (x > VIEW_W) continue;
    const y = ((bhash(k, 62) * VIEW_H - time * (0.9 + bhash(k, 63) * 1.5) - camY * 0.3)
      % VIEW_H + VIEW_H) % VIEW_H;
    g.fillStyle = `rgba(255,${(150 + bhash(k, 64) * 90) | 0},60,${(0.3 + 0.3 * Math.sin(time * 0.09 + k)).toFixed(2)})`;
    g.fillRect(Math.floor(x), Math.floor(y), 2, 2);
  }
}

// ---- the mirror gallery: a hall that gives you back to yourself, wrongly
function wallGallery(g, camX, camY, time, hy) {
  const grd = g.createLinearGradient(0, 0, 0, VIEW_H);
  grd.addColorStop(0, '#100c1c');
  grd.addColorStop(0.5, '#1c1730');
  grd.addColorStop(1, '#151024');
  g.fillStyle = grd;
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  // a painted hall behind everything, pushed well back in value
  const bgi = Assets.img.bgInterior;
  if (bgi) {
    const y = Math.floor(70 - camY * 0.28);
    tileLayer(g, bgi, camX, 0.28, y);
    g.fillStyle = 'rgba(16,12,28,0.45)';
    g.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  // panelled wainscot and a picture rail
  g.fillStyle = 'rgba(44,36,68,0.5)';
  for (let x = -((camX * 0.45) % 74); x < VIEW_W; x += 74) g.fillRect(Math.floor(x), 0, 5, VIEW_H);
  g.fillStyle = 'rgba(120,100,54,0.28)';
  const rail = Math.floor(150 - camY * 0.3);
  g.fillRect(0, rail, VIEW_W, 3);
  g.fillRect(0, rail + 250, VIEW_W, 3);

  // tall gilt mirrors, each showing a room that is almost this one
  const mspan = 242, f = 0.5;
  const mox = ((camX * f) % mspan + mspan) % mspan;
  for (let x = -mox; x < VIEW_W; x += mspan) {
    const k = Math.round((x + camX * f) / mspan);
    const my = 214 - camY * 0.3 + bhash(k, 3) * 22;
    const ax = Math.floor(x + 40), ay = Math.floor(my);
    if (ay > VIEW_H) continue;
    const W = 58, Hh = 132;
    g.fillStyle = 'rgba(132,108,54,0.55)';       // the gilt frame, round-crowned
    g.fillRect(ax - 4, ay, W + 8, Hh + 6);
    g.beginPath(); g.arc(ax + W / 2, ay, W / 2 + 4, 0, 7); g.fill();
    g.fillStyle = 'rgba(24,22,44,0.95)';         // the glass
    g.fillRect(ax, ay, W, Hh);
    g.beginPath(); g.arc(ax + W / 2, ay, W / 2, 0, 7); g.fill();
    // what stands in it: a dim upright shape that breathes out of time
    const sway = Math.sin(time * 0.013 + k * 1.7) * 3;
    g.fillStyle = 'rgba(64,58,102,0.5)';
    g.fillRect(ax + 22 + sway, ay + 62, 14, 54);
    g.beginPath(); g.arc(ax + 29 + sway, ay + 57, 8, 0, 7); g.fill();
    g.fillStyle = 'rgba(150,140,210,0.13)';      // the sheen across the pane
    quad(g, ax + 6, ay + Hh - 4, ax + 24, ay + 4, ax + 36, ay + 4, ax + 18, ay + Hh - 4);
    g.fillStyle = 'rgba(196,182,240,0.09)';
    g.fillRect(ax, ay, W, 2);
  }
  // candelabra between the mirrors
  const cspan = 242, cox = ((camX * 0.58) % cspan + cspan) % cspan;
  for (let x = -cox; x < VIEW_W; x += cspan) {
    const k = Math.round((x + camX * 0.58) / cspan);
    const cy = 250 - camY * 0.34 + bhash(k, 9) * 40;
    if (cy < -20 || cy > VIEW_H) continue;
    const ax = Math.floor(x + 150), ay = Math.floor(cy);
    g.fillStyle = 'rgba(120,100,54,0.7)';
    g.fillRect(ax, ay, 3, 40);
    g.fillRect(ax - 10, ay, 24, 3);
    for (let i = 0; i < 3; i++) {
      const fx = ax - 9 + i * 11;
      g.fillStyle = '#ffd870';
      g.fillRect(fx, ay - 6, 2, 6);
      glowOrb(g, fx + 1, ay - 7, 20, '255,214,140',
        0.16 + 0.05 * Math.sin(time * 0.1 + i + k));
    }
  }
}

// ---- the frozen spire: sky, ice and falling snow
function wallFrost(g, camX, camY, time, hy) {
  const top = Math.max(-60, hy);
  // a cliff of blue ice rising out of the cloud
  g.fillStyle = 'rgba(26,44,64,0.85)';
  g.fillRect(0, top, VIEW_W, VIEW_H - top);
  const f = 0.4, span = 96;
  const ox = ((camX * f) % span + span) % span;
  for (let x = -ox; x < VIEW_W; x += span) {
    const k = Math.round((x + camX * f) / span);
    g.fillStyle = k % 2 ? 'rgba(40,66,92,0.6)' : 'rgba(32,54,78,0.6)';
    quad(g, x, top + 20 + bhash(k, 1) * 40, x + span, top + 20 + bhash(k + 1, 1) * 40,
      x + span, VIEW_H, x, VIEW_H);
    // rime running down the face
    g.fillStyle = 'rgba(176,214,240,0.10)';
    g.fillRect(Math.floor(x + span * 0.3), top + 30, 5, VIEW_H);
  }
  // frozen falls, hanging still
  const wspan = 260, wox = ((camX * 0.55) % wspan + wspan) % wspan;
  for (let x = -wox; x < VIEW_W; x += wspan) {
    const k = Math.round((x + camX * 0.55) / wspan);
    if (bhash(k, 44) < 0.4) continue;
    const ax = Math.floor(x + 60), ay = top + 30 - camY * 0.1;
    g.fillStyle = 'rgba(150,204,236,0.28)';
    g.fillRect(ax, ay, 34, VIEW_H);
    g.fillStyle = 'rgba(206,238,255,0.24)';
    g.fillRect(ax + 6, ay, 8, VIEW_H);
    g.fillRect(ax + 22, ay, 5, VIEW_H);
    for (let i = 0; i < 6; i++) {          // icicle teeth at the lip
      const ix = ax + i * 6;
      quad(g, ix, ay, ix + 5, ay, ix + 3, ay + 14 + bhash(k, i) * 20, ix + 1, ay + 10);
    }
  }
  // snow, falling across everything
  for (let k = 0; k < 70; k++) {
    const sp = 1300;
    let x = ((bhash(k, 81) * sp - camX * 0.3 + time * 0.5) % sp + sp) % sp;
    if (x > VIEW_W) continue;
    const y = ((bhash(k, 82) * VIEW_H + time * (0.5 + bhash(k, 83) * 1.1) - camY * 0.25)
      % VIEW_H + VIEW_H) % VIEW_H;
    const big = bhash(k, 84) > 0.7;
    g.fillStyle = `rgba(226,240,255,${big ? 0.5 : 0.28})`;
    g.fillRect(Math.floor(x), Math.floor(y), big ? 2 : 1, big ? 2 : 1);
  }
}

// One locked palette per region — a structural hue, a trim hue, a dark accent —
// and a veil that decides how far back the whole room sits.
const BACKDROP = {
  castle: { sky: drawNightSky, wall: wallCastle, air: null, veil: 'rgba(6,5,14,0.22)' },
  graveyard: { sky: drawGraveSky, wall: wallGraveyard, air: 'rgba(60,90,60,0.14)', veil: 'rgba(4,8,10,0.24)' },
  chapel: { sky: null, wall: wallChapel, air: 'rgba(110,80,180,0.10)', veil: 'rgba(8,6,18,0.40)' },
  catacombs: { sky: null, wall: wallCatacombs, air: 'rgba(70,86,104,0.08)', veil: 'rgba(6,4,10,0.34)' },
  clock: { sky: drawNightSky, wall: wallClock, air: 'rgba(190,150,60,0.10)', veil: 'rgba(10,6,4,0.34)' },
  keep: { sky: null, wall: wallKeep, air: 'rgba(150,30,40,0.12)', veil: 'rgba(10,2,6,0.34)' },
  lunar: { sky: drawVoidSky, wall: wallLunar, air: 'rgba(70,180,230,0.10)', veil: 'rgba(4,4,14,0.20)' },
  cistern: { sky: null, wall: wallCistern, air: 'rgba(40,130,160,0.10)', veil: 'rgba(2,10,16,0.32)' },
  foundry: { sky: null, wall: wallFoundry, air: 'rgba(200,90,30,0.10)', veil: 'rgba(10,4,2,0.30)' },
  gallery: { sky: null, wall: wallGallery, air: 'rgba(150,130,210,0.10)', veil: 'rgba(8,6,16,0.36)' },
  frost: { sky: drawGraveSky, wall: wallFrost, air: 'rgba(150,205,240,0.12)', veil: 'rgba(6,10,18,0.22)' },
};

function drawBackground(g, camX, camY, time, skyOnly, biome) {
  const bd = BACKDROP[biome] || BACKDROP.castle;

  if (skyOnly) {                       // the title screen: sky and nothing else
    drawNightSky(g, camX, camY, time, VIEW_H, true);
    return;
  }

  // Where the sky gives out. The zone's own floor sets it, halved so the
  // horizon drifts rather than tracking the camera one for one.
  const z = typeof zoneAt === 'function' ? zoneAt(camX + VIEW_W / 2) : null;
  const floorY = (z ? z.row : 30) * TILE;
  const hy = bd.sky ? Math.round(300 + (floorY - camY - 300) * 0.5) : -400;

  if (bd.sky) bd.sky(g, camX, camY, time, hy, false);
  else { g.fillStyle = '#07050a'; g.fillRect(0, 0, VIEW_W, VIEW_H); }
  bd.wall(g, camX, camY, time, hy);

  if (bd.air) {
    g.fillStyle = bd.air;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  // Everything behind the play plane is pushed down in value and contrast, so
  // the tiles you can actually stand on stay the brightest thing on screen.
  g.fillStyle = bd.veil || 'rgba(6,5,14,0.30)';
  g.fillRect(0, 0, VIEW_W, VIEW_H);
}

// ---------------------------------------------------------------- props & atmosphere
// Slices of the Gothicvania town prop sheet: [sx, sy, w, h].
const FURNITURE = {
  crateStack: [16, 12, 73, 68], crate: [16, 109, 39, 35],
  wagon: [109, 82, 93, 75], lantern: [123, 19, 35, 44],
  barrel: [172, 33, 24, 30], lamp: [223, 49, 35, 108],
  well: [269, 95, 65, 65],
};

function drawProps(g, camX, camY, time) {
  if (!Level.props) return;
  for (const p of Level.props) {
    const sx = Math.floor(p.x - camX), sy = Math.floor(p.y - camY);
    if (sx < -30 || sx > VIEW_W + 30) continue;
    if (p.type === 'mirror') {
      // a standing glass. What it gives back stands a beat behind you.
      g.fillStyle = '#6a5836';
      g.fillRect(sx - 2, sy - 46, 24, 48);
      g.fillStyle = '#1a1730';
      g.fillRect(sx, sy - 44, 20, 44);
      g.fillStyle = 'rgba(150,140,210,0.13)';
      quad(g, sx + 2, sy - 2, sx + 10, sy - 42, sx + 15, sy - 42, sx + 7, sy - 2);
      const pl = game && game.player;
      if (pl) {
        const near = Math.abs(pl.x + 8 - p.x) < 120;
        if (near) {
          const bob = Math.sin(time * 0.06 + p.x) * 1.5;
          g.fillStyle = 'rgba(120,200,190,0.30)';
          g.fillRect(sx + 6, sy - 26 + bob, 8, 20);
          g.beginPath(); g.arc(sx + 10, sy - 30 + bob, 5, 0, 7); g.fill();
        }
      }
      g.fillStyle = '#a08a4e';
      g.fillRect(sx - 2, sy - 48, 24, 3);
    } else if (p.type === 'furniture') {
      const f = FURNITURE[p.kind], img = Assets.img.townProps;
      if (f && img) {
        g.drawImage(img, f[0], f[1], f[2], f[3], sx - (f[2] >> 1), sy - f[3], f[2], f[3]);
        if (p.kind === 'lamp' || p.kind === 'lantern') {
          glowOrb(g, sx, sy - f[3] + 10, 26, '255,190,90',
            0.18 + 0.05 * Math.sin(time * 0.07 + p.x));
        }
      }
    } else if (p.type === 'statue') {
      g.drawImage(Sprites.statue, sx, sy - 29);
    } else if (p.type === 'forge') {
      glowOrb(g, sx + 8, sy - 8, 22, '255,140,50', 0.24 + 0.10 * Math.sin(time * 0.09));
      g.drawImage(Sprites.forge, sx, sy - 16);
      if ((time & 7) === 0) {
        spawnParticle(sx + 6 + Math.random() * 4, sy - 12,
          (Math.random() - 0.5) * 0.3, -0.5, '#ff9020', 14, -0.01);
      }
    } else if (p.type === 'grave') {
      const spr = p.v ? Sprites.grave2 : Sprites.grave1;
      g.drawImage(spr, sx, sy - spr.height);
    } else if (p.type === 'shrine') {
      // skill shrine: statue bathed in candlelight with a floating sigil
      glowOrb(g, sx + 8, sy - 16, 28, '255,215,110', 0.22 + 0.08 * Math.sin(time * 0.06));
      g.drawImage(Sprites.statue, sx, sy - 29);
      const bob = Math.round(Math.sin(time * 0.05) * 2);
      g.drawImage(Sprites.emblem, sx + 2, sy - 44 + bob);
      const fl = ((time >> 3) & 1) ? Sprites.candle.flameA : Sprites.candle.flameB;
      g.drawImage(fl, sx - 6, sy - 6);
      g.drawImage(fl, sx + 15, sy - 6);
    } else if (p.type === 'pillar') {
      // a carved column running up into the dark
      for (let i = 0; i < 8; i++) {
        g.fillStyle = i % 2 ? '#4a4658' : '#56526e';
        g.fillRect(sx + 1, sy - i * 8 - 8, 14, 8);
      }
      g.fillStyle = '#6f6c80';
      g.fillRect(sx - 1, sy - 68, 18, 4);
      g.fillRect(sx - 1, sy - 8, 18, 4);
      g.fillStyle = '#8f8c9e';
      g.fillRect(sx + 2, sy - 66, 12, 1);
    } else if (p.type === 'chandelier') {
      g.fillStyle = '#3c3c50';
      g.fillRect(sx + 7, sy - 40, 1, 40);
      g.fillStyle = '#6f6c80';
      g.fillRect(sx - 6, sy, 26, 2);
      g.fillRect(sx - 6, sy - 4, 2, 5);
      g.fillRect(sx + 18, sy - 4, 2, 5);
      const fl = ((time >> 3) & 1) ? Sprites.candle.flameA : Sprites.candle.flameB;
      g.drawImage(fl, sx - 7, sy - 10);
      g.drawImage(fl, sx + 17, sy - 10);
      glowOrb(g, sx + 7, sy, 32, '255,215,110', 0.18 + 0.08 * Math.sin(time * 0.07));
    } else if (p.type === 'sarcophagus') {
      g.fillStyle = '#3c3850';
      g.fillRect(sx - 2, sy - 10, 24, 10);
      g.fillStyle = '#56526e';
      g.fillRect(sx - 3, sy - 13, 26, 4);
      g.fillStyle = '#6f6c80';
      g.fillRect(sx + 6, sy - 9, 8, 1);
      g.fillRect(sx + 9, sy - 12, 2, 8);
      g.fillStyle = '#2a2438';
      g.fillRect(sx, sy - 8, 3, 6);
      g.fillRect(sx + 17, sy - 8, 3, 6);
    } else if (p.type === 'throne') {
      g.fillStyle = '#3a1a24';
      g.fillRect(sx, sy - 34, 20, 34);
      g.fillStyle = '#5a2430';
      g.fillRect(sx + 2, sy - 32, 16, 22);
      g.fillStyle = '#d8a848';
      g.fillRect(sx + 2, sy - 34, 16, 2);
      g.fillRect(sx, sy - 40, 3, 8); g.fillRect(sx + 17, sy - 40, 3, 8);
      g.fillStyle = '#a01828';
      g.fillRect(sx + 6, sy - 26, 8, 12);
    } else if (p.type === 'gear') {
      const r = p.r || 14;
      const a = time * 0.012 * (p.r > 18 ? 0.4 : 1);
      g.fillStyle = '#3c3850';
      g.beginPath(); g.arc(sx, sy, r, 0, 7); g.fill();
      g.fillStyle = '#56526e';
      g.beginPath(); g.arc(sx, sy, r - 3, 0, 7); g.fill();
      g.fillStyle = '#6f6c80';
      for (let i = 0; i < 8; i++) {
        const th = a + i * Math.PI / 4;
        g.fillRect(Math.round(sx + Math.cos(th) * r) - 2, Math.round(sy + Math.sin(th) * r) - 2, 4, 4);
      }
      g.fillStyle = '#2a2438';
      g.beginPath(); g.arc(sx, sy, Math.max(2, r * 0.3), 0, 7); g.fill();
    } else if (p.type === 'crystal') {
      const glow = 0.10 + 0.05 * Math.sin(time * 0.06 + p.x);
      g.fillStyle = `rgba(120,200,240,${glow.toFixed(3)})`;
      g.beginPath(); g.arc(sx + 4, sy - 10, 16, 0, 7); g.fill();
      g.fillStyle = '#8ad0f0';
      g.fillRect(sx + 2, sy - 16, 5, 16);
      g.fillRect(sx + 6, sy - 10, 4, 10);
      g.fillStyle = '#d8f0ff';
      g.fillRect(sx + 3, sy - 14, 2, 6);
      g.fillStyle = '#4a90b0';
      g.fillRect(sx + 1, sy - 3, 10, 3);
    } else if (p.type === 'merchant') {
      g.fillStyle = `rgba(255,190,80,${(0.06 + 0.03 * Math.sin(time * 0.07)).toFixed(3)})`;
      g.beginPath(); g.arc(sx + 7, sy - 12, 18, 0, 7); g.fill();
      g.drawImage(Sprites.merchant, sx, sy - 22);
    } else if (p.type === 'banner') {
      const sway = Math.round(Math.sin(time * 0.02 + p.x * 0.05));
      g.drawImage(Sprites.banner, sx + sway, sy);
    } else if (p.type === 'chain') {
      const sway = Math.sin(time * 0.015 + p.x * 0.11) * 1.5;
      for (let i = 0; i < p.len; i += 3) {
        const cx = sx + Math.round(sway * i / p.len);
        g.fillStyle = (i / 3) & 1 ? '#3c3c50' : '#56566a';
        g.fillRect(cx, sy + i, 2, 3);
      }
    }
  }
}

// Carved signs. The castle tells you what a place demands long before you can
// meet it — so the obstacle is remembered when the ability finally arrives.
function drawSigils(g, camX, camY, time) {
  if (!Level.sigils) return;
  for (const s of Level.sigils) {
    const sx = Math.floor(s.x - camX), sy = Math.floor(s.y - camY);
    if (sx < -24 || sx > VIEW_W + 24) continue;
    const pulse = 0.5 + 0.22 * Math.sin(time * 0.05 + s.x * 0.1);
    // the plaque
    g.fillStyle = 'rgba(12,10,22,0.8)';
    g.fillRect(sx - 1, sy - 15, 14, 15);
    g.fillStyle = '#3c3850';
    g.fillRect(sx, sy - 14, 12, 13);
    g.fillStyle = '#56526e';
    g.fillRect(sx, sy - 14, 12, 1);
    const c = `rgba(216,168,72,${pulse.toFixed(2)})`;
    g.fillStyle = c;
    if (s.icon === 'wing') {
      // a wing: this place is above you
      g.fillRect(sx + 2, sy - 9, 8, 1);
      g.fillRect(sx + 3, sy - 10, 2, 1); g.fillRect(sx + 7, sy - 10, 2, 1);
      g.fillRect(sx + 5, sy - 11, 2, 1);
      g.fillRect(sx + 4, sy - 7, 4, 1);
    } else if (s.icon === 'plunge') {
      // an arrow driven downward
      g.fillRect(sx + 5, sy - 12, 2, 7);
      g.fillRect(sx + 3, sy - 6, 6, 1);
      g.fillRect(sx + 4, sy - 5, 4, 1);
      g.fillRect(sx + 5, sy - 4, 2, 1);
    } else if (s.icon === 'wall') {
      // two walls and a rising step between them
      g.fillRect(sx + 2, sy - 12, 1, 9);
      g.fillRect(sx + 9, sy - 12, 1, 9);
      g.fillRect(sx + 4, sy - 6, 2, 2);
      g.fillRect(sx + 6, sy - 9, 2, 2);
    } else if (s.icon === 'key') {
      g.fillRect(sx + 4, sy - 12, 4, 4);
      g.fillRect(sx + 5, sy - 11, 2, 2);
      g.fillRect(sx + 5, sy - 8, 2, 5);
      g.fillRect(sx + 7, sy - 5, 2, 1);
    } else {
      // a struck wall: three cracks
      g.fillRect(sx + 3, sy - 11, 6, 1);
      g.fillRect(sx + 2, sy - 8, 8, 1);
      g.fillRect(sx + 4, sy - 5, 5, 1);
    }
  }
}

function drawObelisks(g, camX, camY, time) {
  if (!Level.obelisks) return;
  for (const ob of Level.obelisks) {
    const sx = Math.floor(ob.x - camX), sy = Math.floor(ob.y - camY);
    if (sx < -30 || sx > VIEW_W + 30) continue;
    if (ob.lit) {
      const pulse = 0.10 + 0.05 * Math.sin(time * 0.08 + ob.x);
      g.fillStyle = `rgba(80,216,232,${pulse.toFixed(3)})`;
      g.beginPath(); g.arc(sx + 6, sy - 14, 20, 0, 7); g.fill();
      g.drawImage(Sprites.obeliskLit, sx, sy - 24);
      if ((time & 15) === 0) {
        spawnParticle(sx + 3 + Math.random() * 6, sy - 18,
          (Math.random() - 0.5) * 0.2, -0.3, '#50d8e8', 20, 0);
      }
    } else {
      g.drawImage(Sprites.obeliskDark, sx, sy - 24);
    }
  }
}

// the catacombs know no sky
// The receding rock walls of a cavern. Left separate from the fill so the
// catacomb backdrop can lay its own earth under it.
function caveDepthLayers(g, camX, camY, time) {
  const cols = ['#0d0a16', '#110d1d', '#151024', '#1a142c'];
  for (let i = 0; i < 4; i++) {
    const par = 0.12 + i * 0.11;
    const base = 90 + i * 110 - camY * par * 0.5;
    g.fillStyle = cols[i];
    const off = -((camX * par) % 96);
    for (let bx = off - 96; bx < VIEW_W + 96; bx += 96) {
      for (let k = 0; k < 6; k++) {
        const h2 = 18 + (((Math.abs(bx + 9600) | 0) * 7 + k * 31 + i * 13) % 23);
        g.fillRect(bx + k * 16, base - h2, 16, h2 + 400);
      }
    }
  }
  // stalactites reaching down from the dark
  g.fillStyle = '#1f1830';
  const soff = -((camX * 0.5) % 48);
  for (let bx = soff - 48; bx < VIEW_W + 48; bx += 48) {
    const h2 = 26 + (((Math.abs(bx + 9600) | 0) * 13) % 27);
    const top = -camY * 0.5 - 30;
    g.fillRect(bx - 5, top, 10, h2 * 0.5);
    g.fillRect(bx - 3, top + h2 * 0.5, 6, h2 * 0.3);
    g.fillRect(bx - 1, top + h2 * 0.8, 2, h2 * 0.2);
  }
  // faint crystal glints
  for (let i = 0; i < 22; i++) {
    const sx = ((((i * 727 - camX * 0.35) % 1400) + 1400) % 1400) - 200;
    const sy = 40 + (i * 271) % (VIEW_H - 80);
    const tw = 0.18 + 0.14 * Math.sin(time * 0.05 + i * 1.7);
    g.fillStyle = `rgba(120,200,230,${tw.toFixed(2)})`;
    g.fillRect(sx, sy, 2, 2);
  }
}

function drawFog(g, camX, camY, time) {
  const bands = [
    { y: VIEW_H - 48, amp: 5, alpha: 0.055, speed: 0.35, h: 14 },
    { y: 72, amp: 8, alpha: 0.04, speed: 0.6, h: 11 },
  ];
  for (const b of bands) {
    g.fillStyle = `rgba(150,140,195,${b.alpha})`;
    for (let x = -40; x < VIEW_W + 40; x += 40) {
      const yy = b.y + Math.sin(time * 0.01 * b.speed + (camX + x) * 0.02) * b.amp - camY * 0.25;
      g.fillRect(x, Math.floor(yy), 42, b.h);
      g.fillRect(x + 8, Math.floor(yy) - 4, 30, 4);
    }
  }
  // low ground mist
  g.fillStyle = 'rgba(140,130,185,0.05)';
  g.fillRect(0, VIEW_H - 22, VIEW_W, 8);
  g.fillStyle = 'rgba(150,140,195,0.07)';
  g.fillRect(0, VIEW_H - 14, VIEW_W, 14);
}

let vignetteCv = null;
function drawVignette(g) {
  if (!vignetteCv) {
    vignetteCv = document.createElement('canvas');
    vignetteCv.width = VIEW_W; vignetteCv.height = VIEW_H;
    const v = vignetteCv.getContext('2d');
    v.fillStyle = 'rgba(5,3,12,0.016)';
    for (let i = 0; i < 14; i++) {
      v.fillRect(0, 0, VIEW_W, 14 - i);                    // top
      v.fillRect(0, VIEW_H - 14 + i, VIEW_W, 14 - i);      // bottom
      v.fillRect(0, 0, 18 - i, VIEW_H);                    // left
      v.fillRect(VIEW_W - 18 + i, 0, 18 - i, VIEW_H);      // right
    }
  }
  g.drawImage(vignetteCv, 0, 0);
}

// One tile of staging, in the material of its zone. Ends get brackets; anything
// hanging over open air gets a chain, so it reads as something somebody built.
const STAGING = {
  castle:    { top: '#a8763c', body: '#7a5228', dark: '#4a3520', trim: '#c99055' },
  graveyard: { top: '#8f8a72', body: '#6a6552', dark: '#403d33', trim: '#a8a288' },
  chapel:    { top: '#9a92b8', body: '#6f688c', dark: '#443f5c', trim: '#b6aed4' },
  catacombs: { top: '#d8d2bc', body: '#a49c86', dark: '#5c584a', trim: '#efe9d4' },
  clock:     { top: '#b09050', body: '#7d6438', dark: '#463823', trim: '#d8b468' },
  keep:      { top: '#9a5050', body: '#6e3434', dark: '#3f1e1e', trim: '#c06a6a' },
  lunar:     { top: '#9ad0e8', body: '#6a9ec0', dark: '#3c5c74', trim: '#c4ecff' },
  cistern:   { top: '#6fa8b8', body: '#487683', dark: '#26414c', trim: '#8fcede' },
  foundry:   { top: '#c07a3c', body: '#8a4f22', dark: '#472913', trim: '#e79c52' },
  gallery:   { top: '#c0b4dc', body: '#8c82ac', dark: '#4e4868', trim: '#e0d6f4' },
  frost:     { top: '#cfe8f8', body: '#93b8d4', dark: '#4e6a80', trim: '#ecf7ff' },
};

function drawStaging(g, dx, dy, biome, leftEnd, rightEnd, tx, ty, camY) {
  const c = STAGING[biome] || STAGING.castle;
  // the deck
  g.fillStyle = c.body;
  g.fillRect(dx, dy + 2, TILE, 6);
  g.fillStyle = c.top;
  g.fillRect(dx, dy + 2, TILE, 2);
  g.fillStyle = c.dark;
  g.fillRect(dx, dy + 7, TILE, 1);

  if (biome === 'catacombs') {
    // ribs laid across, rather than planks
    g.fillStyle = c.trim;
    for (let i = 1; i < TILE; i += 5) g.fillRect(dx + i, dy + 2, 2, 6);
    g.fillStyle = c.dark;
    g.fillRect(dx, dy + 4, TILE, 1);
  } else if (biome === 'clock' || biome === 'keep') {
    // riveted iron
    g.fillStyle = c.dark;
    g.fillRect(dx + 3, dy + 4, 1, 1); g.fillRect(dx + 11, dy + 4, 1, 1);
    g.fillStyle = c.trim;
    g.fillRect(dx + 2, dy + 3, 1, 1); g.fillRect(dx + 10, dy + 3, 1, 1);
    g.fillRect(dx, dy + 5, TILE, 1);
  } else if (biome === 'lunar') {
    // moonstone, faintly lit from within
    g.fillStyle = 'rgba(180,230,255,0.20)';
    g.fillRect(dx, dy + 1, TILE, 8);
    g.fillStyle = c.trim;
    g.fillRect(dx + 4, dy + 3, 3, 1);
  } else {
    // plank seams
    g.fillStyle = c.dark;
    g.fillRect(dx + 5, dy + 2, 1, 6);
    g.fillRect(dx + 12, dy + 2, 1, 6);
  }

  // brackets where the run ends
  if (leftEnd || rightEnd) {
    g.fillStyle = c.dark;
    if (leftEnd) { g.fillRect(dx + 1, dy + 8, 2, 3); g.fillRect(dx + 2, dy + 10, 2, 2); }
    if (rightEnd) { g.fillRect(dx + TILE - 3, dy + 8, 2, 3); g.fillRect(dx + TILE - 4, dy + 10, 2, 2); }
  }
  // and a chain where it hangs over nothing
  let openBelow = 0;
  while (openBelow < 7 && tileAt(tx, ty + 1 + openBelow) === 0) openBelow++;
  if (openBelow >= 6 && (leftEnd || rightEnd)) {
    const hx = leftEnd ? dx + 2 : dx + TILE - 3;
    g.fillStyle = c.dark;
    for (let cy2 = dy - 4; cy2 > dy - 64 && cy2 > -camY - 8; cy2 -= 5) g.fillRect(hx, cy2, 1, 3);
  }
}

function drawTiles(g, camX, camY) {
  const atlases = Sprites.tilesBiome || {};
  let zoneIdx = 0;
  const zs = Level.zones || [];
  // zones run left to right, so a walking cursor is enough — but it must be
  // advanced for every tile, including the ones drawn by hand
  const zoneFor = (px) => {
    while (zoneIdx > 0 && px < zs[zoneIdx].x0) zoneIdx--;
    while (zoneIdx < zs.length - 1 && px > zs[zoneIdx].x1) zoneIdx++;
    return zs[zoneIdx];
  };
  const atlasFor = (px) => {
    const z = zoneFor(px);
    return (z && atlases[z.biome]) || Sprites.tiles;
  };
  const tx0 = Math.max(0, Math.floor(camX / TILE));
  const tx1 = Math.min(LEVEL_W - 1, Math.floor((camX + VIEW_W) / TILE));
  const ty0 = Math.max(0, Math.floor(camY / TILE));
  const ty1 = Math.min(LEVEL_H - 1, Math.floor((camY + VIEW_H) / TILE));
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const id = Level.grid[ty * LEVEL_W + tx];
      if (id === 0) continue;
      const dx = tx * TILE - camX, dy = ty * TILE - camY;
      const hash = (tx * 31 + ty * 17) & 1023;
      let slot;
      if (id === 12) slot = 10;
      else if (id === 11) slot = 9;
      else if (id === 13) slot = 1 + ((tx * 7 + ty * 13) & 3);
      else if (id === 1 || id === 10) slot = (hash % 11 === 0) ? 9 : 1 + ((tx * 7 + ty * 13) & 3);
      else if (id === 2) slot = 5;
      else if (id === 3) slot = 6;
      else slot = (hash % 7 === 0) ? 8 : 7;
      if (id !== 2) g.drawImage(atlasFor(tx * TILE), slot * TILE, 0, TILE, TILE, dx, dy, TILE, TILE);

      // Staging belongs to the place it stands in: planks in the outer castle,
      // bone in the catacombs, iron in the works, moonstone at the heart.
      if (id === 2) {
        const zHere = zoneFor(tx * TILE);
        drawStaging(g, dx, dy, zHere ? zHere.biome : 'castle',
          tileAt(tx - 1, ty) !== 2, tileAt(tx + 1, ty) !== 2, tx, ty, camY);
      }

      // an ore vein: a socket of dark rock with bright metal bedded in it
      if (id === 13) {
        const okey = tx + ',' + ty;
        const hits = (game.oreHits && game.oreHits[okey]) || 0;
        const mat = MATERIALS[(Level.oreKind && Level.oreKind[okey]) || 'moonsilver'];
        const rgb = hexRgb(mat.color);
        const t2 = (game.time || 0);
        // hollow the stone out so the seam reads as something else
        g.fillStyle = 'rgba(10,8,18,0.75)';
        g.fillRect(dx + 2, dy + 2, TILE - 4, TILE - 4);
        g.fillStyle = 'rgba(40,34,58,0.9)';
        g.fillRect(dx + 3, dy + 3, TILE - 6, TILE - 6);
        // a soft glow, so it catches the eye across a dark hall
        const pulse = 0.16 + 0.08 * Math.sin(t2 * 0.05 + tx * 1.3);
        g.fillStyle = `rgba(${rgb},${pulse.toFixed(3)})`;
        g.beginPath(); g.arc(dx + 8, dy + 8, 11, 0, 7); g.fill();
        // the metal itself
        const flecks = [[4, 5, 3], [9, 4, 2], [6, 9, 3], [11, 10, 2], [3, 11, 2]];
        for (let i = 0; i < flecks.length - hits; i++) {
          const [ox, oy, sz] = flecks[i];
          const tw = 0.7 + 0.3 * Math.sin(t2 * 0.07 + i * 2 + tx);
          g.fillStyle = `rgba(${rgb},${tw.toFixed(2)})`;
          g.fillRect(dx + ox, dy + oy, sz, sz);
          g.fillStyle = 'rgba(255,255,255,0.55)';
          g.fillRect(dx + ox, dy + oy, 1, 1);
        }
        // cracks spreading with every blow
        if (hits > 0) {
          g.fillStyle = 'rgba(8,6,14,0.75)';
          for (let c = 0; c < hits; c++) {
            g.fillRect(dx + 3, dy + 5 + c * 4, TILE - 6, 1);
            g.fillRect(dx + 6 + c * 3, dy + 3, 1, TILE - 6);
          }
        }
      }

      // carved trim + moonlit cap on exposed solid tops
      if (isSolid(id) && !isSolid(tileAt(tx, ty - 1)) && !isPlatform(tileAt(tx, ty - 1))) {
        // the walkable edge is the brightest, flattest line in the room, with a
        // hard dark course under it — that contrast is what says "stand here"
        g.fillStyle = 'rgba(214,210,244,0.42)';
        g.fillRect(dx, dy, TILE, 1);
        g.fillStyle = 'rgba(148,144,190,0.20)';
        g.fillRect(dx, dy + 1, TILE, 1);
        g.fillStyle = 'rgba(8,6,16,0.55)';
        g.fillRect(dx, dy + 3, TILE, 1);
        // occasional bone litter on interior floors
        if (hash % 13 === 0) {
          g.fillStyle = '#8f8c9e';
          g.fillRect(dx + 4, dy - 2, 4, 2);
          g.fillRect(dx + 10, dy - 1, 3, 1);
          g.fillStyle = '#5f5c70';
          g.fillRect(dx + 5, dy - 1, 1, 1);
          g.fillRect(dx + 8, dy - 2, 1, 1);
        }
      }
    }
  }
}

// Which scene a point in the castle belongs to.
function sceneAt(px) {
  const list = Level.scenes || [];
  for (const sc of list) if (px >= sc.x0 && px < sc.x1) return sc;
  return list[list.length - 1] || null;
}
