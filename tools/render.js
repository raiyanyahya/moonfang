// Headless renderer: minimal software canvas 2D + PNG writer, to screenshot the game.
const fs = require('fs');
const vm = require('vm');
const { decodePNG } = require('./pngdec.js');
class FakeImage {
  constructor() { this.onload = null; this.onerror = null; }
  set src(v) {
    const d = decodePNG(require('fs').readFileSync('/home/dev/Downloads/code/ctl/' + v));
    this.width = d.width; this.height = d.height; this.data = d.data;
    this._src = v;
    if (this.onload) this.onload();
  }
  get src() { return this._src; }
}

const zlib = require('zlib');

// ---------------- color parsing ----------------
function parseColor(s) {
  if (typeof s !== 'string') return [0, 0, 0, 255];
  if (s[0] === '#') {
    if (s.length === 9) return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16), parseInt(s.slice(7, 9), 16)];
    if (s.length === 7) return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16), 255];
    if (s.length === 4) return [parseInt(s[1] + s[1], 16), parseInt(s[2] + s[2], 16), parseInt(s[3] + s[3], 16), 255];
  }
  const m = s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
  if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 255 : Math.round(+m[4] * 255)];
  return [255, 0, 255, 255];
}

// ---------------- software canvas ----------------
class Ctx {
  constructor(cv) {
    this.cv = cv;
    this.fillStyle = '#000';
    this.globalAlpha = 1;
    this.globalCompositeOperation = 'source-over';
    this.imageSmoothingEnabled = false;
    this._tx = 0; this._ty = 0; this._sx = 1; this._sy = 1;
    this._path = [];
  }
  translate(x, y) { this._tx += x * this._sx; this._ty += y * this._sy; }
  scale(x, y) { this._sx *= x; this._sy *= y; }
  save() { this._saved = [this._tx, this._ty, this._sx, this._sy]; }
  restore() { if (this._saved) [this._tx, this._ty, this._sx, this._sy] = this._saved; }

  _blend(x, y, r, g, b, a) {
    const cv = this.cv;
    a = a * this.globalAlpha;
    if (x < 0 || y < 0 || x >= cv.width || y >= cv.height) return;
    const i = (y * cv.width + x) * 4, d = cv.data;
    if (this.globalCompositeOperation === 'source-in') {
      if (d[i + 3] > 0) { d[i] = r; d[i + 1] = g; d[i + 2] = b; }
      return;
    }
    const al = a / 255, ia = 1 - al;
    d[i] = r * al + d[i] * ia;
    d[i + 1] = g * al + d[i + 1] * ia;
    d[i + 2] = b * al + d[i + 2] * ia;
    d[i + 3] = Math.min(255, a + d[i + 3] * ia);
  }

  _rectCoords(x, y, w, h) {
    let x0 = x * this._sx + this._tx, y0 = y * this._sy + this._ty;
    let x1 = (x + w) * this._sx + this._tx, y1 = (y + h) * this._sy + this._ty;
    if (x1 < x0) [x0, x1] = [x1, x0];
    if (y1 < y0) [y0, y1] = [y1, y0];
    return [Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1)];
  }

  fillRect(x, y, w, h) {
    const [x0, y0, x1, y1] = this._rectCoords(x, y, w, h);
    const grad = this.fillStyle && this.fillStyle._stops;
    for (let py = y0; py < y1; py++) {
      let rgba;
      if (grad) rgba = this.fillStyle._at((py - this.fillStyle.y0) / Math.max(1e-6, this.fillStyle.y1 - this.fillStyle.y0));
      else rgba = parseColor(this.fillStyle);
      for (let px = x0; px < x1; px++) this._blend(px, py, rgba[0], rgba[1], rgba[2], rgba[3]);
    }
  }

  clearRect(x, y, w, h) {
    const [x0, y0, x1, y1] = this._rectCoords(x, y, w, h);
    for (let py = y0; py < y1; py++)
      for (let px = x0; px < x1; px++) {
        if (px < 0 || py < 0 || px >= this.cv.width || py >= this.cv.height) continue;
        const i = (py * this.cv.width + px) * 4;
        this.cv.data[i] = this.cv.data[i + 1] = this.cv.data[i + 2] = this.cv.data[i + 3] = 0;
      }
  }

  createLinearGradient(x0, y0, x1, y1) {
    const g = {
      y0, y1, _stops: [],
      addColorStop(t, c) { this._stops.push([t, parseColor(c)]); this._stops.sort((a, b) => a[0] - b[0]); },
      _at(t) {
        const s = this._stops;
        if (!s.length) return [0, 0, 0, 255];
        t = Math.max(0, Math.min(1, t));
        if (t <= s[0][0]) return s[0][1];
        for (let i = 1; i < s.length; i++) {
          if (t <= s[i][0]) {
            const f = (t - s[i - 1][0]) / (s[i][0] - s[i - 1][0]);
            return s[i - 1][1].map((v, k) => v + (s[i][1][k] - v) * f);
          }
        }
        return s[s.length - 1][1];
      },
    };
    return g;
  }

  beginPath() { this._path = []; }
  arc(x, y, r) { this._path.push({ t: 'arc', x, y, r }); }
  moveTo(x, y) { this._path.push({ t: 'm', x, y }); }
  lineTo(x, y) { this._path.push({ t: 'l', x, y }); }
  fill() {
    const rgba = parseColor(this.fillStyle);
    const arcs = this._path.filter(p => p.t === 'arc');
    for (const a of arcs) {
      const cx = a.x * this._sx + this._tx, cy = a.y * this._sy + this._ty, r = a.r * this._sx;
      for (let py = Math.floor(cy - r); py <= cy + r; py++)
        for (let px = Math.floor(cx - r); px <= cx + r; px++)
          if ((px - cx) ** 2 + (py - cy) ** 2 <= r * r)
            this._blend(px, py, rgba[0], rgba[1], rgba[2], rgba[3]);
    }
    const pts = this._path.filter(p => p.t === 'm' || p.t === 'l')
      .map(p => [p.x * this._sx + this._tx, p.y * this._sy + this._ty]);
    if (pts.length >= 3) {
      const ys = pts.map(p => p[1]), xs = pts.map(p => p[0]);
      const y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
      const x0 = Math.floor(Math.min(...xs)), x1 = Math.ceil(Math.max(...xs));
      for (let py = y0; py <= y1; py++)
        for (let px = x0; px <= x1; px++) {
          let inside = false;
          for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const [xi, yi] = pts[i], [xj, yj] = pts[j];
            if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
          }
          if (inside) this._blend(px, py, rgba[0], rgba[1], rgba[2], rgba[3]);
        }
    }
  }

  getImageData(x, y, w, h) {
    const out = new Uint8ClampedArray(w * h * 4);
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
      const sx = x + px, sy = y + py;
      if (sx < 0 || sy < 0 || sx >= this.cv.width || sy >= this.cv.height) continue;
      const si = (sy * this.cv.width + sx) * 4, di = (py * w + px) * 4;
      out[di] = this.cv.data[si]; out[di+1] = this.cv.data[si+1];
      out[di+2] = this.cv.data[si+2]; out[di+3] = this.cv.data[si+3];
    }
    return { width: w, height: h, data: out };
  }

  putImageData(im, x, y) {
    for (let py = 0; py < im.height; py++) for (let px = 0; px < im.width; px++) {
      const dx = x + px, dy = y + py;
      if (dx < 0 || dy < 0 || dx >= this.cv.width || dy >= this.cv.height) continue;
      const di = (dy * this.cv.width + dx) * 4, si = (py * im.width + px) * 4;
      this.cv.data[di] = im.data[si]; this.cv.data[di+1] = im.data[si+1];
      this.cv.data[di+2] = im.data[si+2]; this.cv.data[di+3] = im.data[si+3];
    }
  }

  drawImage(img, ...args) {
    let sx = 0, sy = 0, sw = img.width, sh = img.height, dx, dy, dw, dh;
    if (args.length === 2) { [dx, dy] = args; dw = sw; dh = sh; }
    else if (args.length === 4) { [dx, dy, dw, dh] = args; }
    else { [sx, sy, sw, sh, dx, dy, dw, dh] = args; }
    // transform dest
    let X0 = dx * this._sx + this._tx, Y0 = dy * this._sy + this._ty;
    let X1 = (dx + dw) * this._sx + this._tx, Y1 = (dy + dh) * this._sy + this._ty;
    let flipX = false, flipY = false;
    if (X1 < X0) { [X0, X1] = [X1, X0]; flipX = true; }
    if (Y1 < Y0) { [Y0, Y1] = [Y1, Y0]; flipY = true; }
    const W = Math.round(X1 - X0), H = Math.round(Y1 - Y0);
    const bx = Math.round(X0), by = Math.round(Y0);
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        let u = px / W, v = py / H;
        if (flipX) u = 1 - u - 1e-9;
        if (flipY) v = 1 - v - 1e-9;
        const ix = Math.floor(sx + u * sw), iy = Math.floor(sy + v * sh);
        if (ix < 0 || iy < 0 || ix >= img.width || iy >= img.height) continue;
        const i = (iy * img.width + ix) * 4;
        const a = img.data[i + 3];
        if (a === 0) continue;
        this._blend(bx + px, by + py, img.data[i], img.data[i + 1], img.data[i + 2], a);
      }
    }
  }
}

class SoftCanvas {
  constructor() { this._w = 0; this._h = 0; this.data = new Uint8ClampedArray(0); }
  get width() { return this._w; }
  set width(v) { this._w = v; this.data = new Uint8ClampedArray(this._w * this._h * 4); }
  get height() { return this._h; }
  set height(v) { this._h = v; this.data = new Uint8ClampedArray(this._w * this._h * 4); }
  getContext() { if (!this._ctx) this._ctx = new Ctx(this); return this._ctx; }
  addEventListener() {}
}

// ---------------- PNG writer ----------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function savePNG(cv, path, scale) {
  scale = scale || 1;
  const W = cv.width * scale, H = cv.height * scale;
  const raw = Buffer.alloc(H * (W * 4 + 1));
  let o = 0;
  for (let y = 0; y < H; y++) {
    raw[o++] = 0;
    const sy = Math.floor(y / scale);
    for (let x = 0; x < W; x++) {
      const sx = Math.floor(x / scale);
      const i = (sy * cv.width + sx) * 4;
      raw[o++] = cv.data[i]; raw[o++] = cv.data[i + 1]; raw[o++] = cv.data[i + 2];
      raw[o++] = 255; // opaque output
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6; // RGBA8
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(path, png);
  console.log('saved', path, `${W}x${H}`);
}

// ---------------- load game ----------------
const screenCanvas = new SoftCanvas();
screenCanvas.width = 960; screenCanvas.height = 540;

const sandbox = {
  console, Math, JSON, Uint8Array, Uint8ClampedArray,
  setInterval: () => 0, clearInterval() {},
  document: {
    createElement: () => new SoftCanvas(),
    getElementById: () => screenCanvas,
  },
  requestAnimationFrame: () => {},
};
sandbox.Image = FakeImage;
sandbox.window = sandbox;
sandbox.window.addEventListener = () => {};
vm.createContext(sandbox);

const files = ['config.js', 'font.js', 'sprites.js', 'audio.js', 'level.js', 'systems.js', 'projectiles.js', 'pickups.js', 'enemies.js', 'bosses.js', 'player.js', 'ui.js', 'game.js'];
const src = files.map(f => fs.readFileSync('/home/dev/Downloads/code/ctl/js/' + f, 'utf8')).join('\n;\n');
let H_ = null;
sandbox.__hook = h => { H_ = h; };
vm.runInContext(src + '\n;__hook({ game, stepGame, drawFrame, pending, keys, TILE, Level, weather, tileAt, resetGame, meta, litObelisks, makeShopStock, offerPaths, buildLevel, PATHS, FEATS, BUFFS, Pickup, WEAPONS, WEAPON_KEYS, RECIPES, MATERIALS, MATERIAL_KEYS, CARD_ACTIONS, CARD_ATTRS, SKILLS, LEVEL_W, LEVEL_H, markSpot, openGate, zoneAt, sceneAt });', sandbox, { filename: 'bundle.js' });
const { game, stepGame, drawFrame, pending, keys, TILE, Level, weather, tileAt, resetGame, meta,
  litObelisks, makeShopStock, offerPaths, buildLevel, PATHS, FEATS, BUFFS, Pickup, WEAPONS, WEAPON_KEYS, RECIPES, MATERIALS, MATERIAL_KEYS, CARD_ACTIONS, CARD_ATTRS, SKILLS, LEVEL_W, LEVEL_H, markSpot, openGate, zoneAt, sceneAt } = H_;

(async () => {
await sandbox.__gameReady;
if (sandbox.__assetError) throw new Error(sandbox.__assetError);
const OUT = process.argv[2] || '.';
function frames(n, opts = {}) {
  for (let i = 0; i < n; i++) {
    keys.right = !!opts.right; keys.left = !!opts.left; keys.down = !!opts.down;
    if (opts.whipEvery && i % opts.whipEvery === 0) pending.whip = true;
    if (opts.jumpEvery && i % opts.jumpEvery === 0) pending.jump = true;
    stepGame();
  }
  keys.right = keys.left = keys.down = false;
}
function shot(name) {
  game.fadeT = 0;
  if (game.player && game.player.hurtTimer <= 0) game.player.invuln = 0;
  drawFrame();
  savePNG(screenCanvas, `${OUT}/${name}.png`, 2);
}
function gTop(tx) {
  for (let ty = 0; ty < 40; ty++) {
    const id = tileAt(tx, ty);
    if (id === 1 || id === 4 || id === 10) return ty * TILE;
  }
  return 12 * TILE;
}
const VIEW_W_ = 960, VIEW_H_ = 540;
const weaponMarks = [];
// A guardian fight locks the camera to its arena and paints its health bar over
// everything. Any shot taken after a boss sequence inherits both unless the fight
// is put away first — which is why every zone shot was framed on one arena.
function clearFight() {
  game.bossActive = false;
  game.gateClosed = false;
  game.bossArena = null;
  game.boss = null;
  game.hitstop = 0;
  game.shake = 0;
}

function place(px) {
  const p = game.player;
  p.x = px; p.y = gTop(Math.floor(px / TILE)) - p.h - 0.1; p.vy = 0;
  p.dead = false; p.hurtTimer = 0; p.invuln = 9999; p.whipTimer = -1; p.throwAnim = 0;
  if (game.state !== 'play') game.state = 'play';
  // The camera is clamped to the current SCENE, so teleporting the hunter without
  // moving the scene leaves the view stuck where it was — which is how every zone
  // shot ended up looking at the tower the script started in.
  if (typeof sceneAt === 'function') {
    const sc = sceneAt(px);
    if (sc) game.scene = sc;
  }
  game.sceneCut = 0; game.camSnap = true;
  game.camX = Math.max(0, Math.min(Level.pxW - VIEW_W_, px - VIEW_W_ / 2));
  game.camY = Math.max(0, p.y - VIEW_H_ * 0.55);
}

// 1. title
frames(80);
shot('1-title');

// 2. entrance: run + attack
pending.enter = true; stepGame();
frames(170, { right: true });
shot('2-run');
frames(20, { right: true });
pending.whip = true;
frames(9);
shot('2b-attack');

// 3. shrine menu
const sh = game.player && (() => Level.props.find(pr => pr.type === 'shrine'))();
if (sh) {
  game.player.hearts = 60;
  place(sh.x + 2);
  frames(20, {});
  pending.up = true; stepGame(); drawFrame();
  shot('3b-shrine-menu');
  pending.whip = true; stepGame();
  pending.enter = true; stepGame();
  game.player.invuln = 9999;
  frames(6, {});
  shot('3-shrine-hint');
}

// 4. arcana cards menu
for (const k of ['mercury', 'mars', 'salamander', 'serpent', 'golem']) game.giveItem('card_' + k, game.player.x, game.player.y);
game.player.cardAction = 'mercury'; game.player.cardAttr = 'salamander';
game.player.invuln = 9999;
frames(10, {});
pending.q = true; stepGame(); drawFrame();
if (game.state !== 'cards') console.error('WARN: cards menu state is', game.state);
shot('4-cards-menu');
pending.q = true; stepGame();

// 4b. relic satchel at the forge
{
  const p = game.player;
  p.bag = [
    { base: 0, pre: 8, suf: 0, tier: 3 },
    { base: 4, pre: 2, suf: 1, tier: 2 },
    { base: 7, pre: 9, suf: 9, tier: 3 },
    { base: 2, pre: 1, suf: 5, tier: 1 },
  ];
  p.relics = [{ base: 3, pre: 6, suf: 6, tier: 2 }, null, null];
  const forge = Level.props.find(pr => pr.type === 'forge');
  if (forge) {
    place(forge.x + 2);
    frames(16, {});
    shot('4b-forge-hint');
    pending.up = true; stepGame(); drawFrame();
    shot('4c-forge-menu');
    pending.inv = true; stepGame();
  }
}

// 4d. a sky loft hovering out of mortal reach
{
  const loft = Level.treasures.find(t => t.y < 6 * 16);
  if (loft) {
    place(loft.x - 30);
    game.player.extraJumps = 2;
    frames(20, {});
    pending.jump = true; stepGame(); frames(10, {});
    pending.jump = true; stepGame(); frames(8, {});
    shot('4d-sky-loft');
    frames(60, {});
  }
}

// 4e. the hunter's chart
place(Level.pxW * 0.5);
frames(30, { right: true });
pending.map = true; stepGame(); drawFrame();
shot('4e-map');
pending.map = true; stepGame();

// 4f. the locked treasury
{
  let gate = null;
  for (let ty = 0; ty < 40 && !gate; ty++) for (let tx = 0; tx < 340; tx++)
    if (tileAt(tx, ty) === 12) { gate = { tx, ty }; break; }
  if (gate) {
    game.player.keys = 1;
    place(gate.tx * TILE + 40);
    frames(20, {});
    shot('4f-locked-gate');
  }
}

// 5. storm on the battlements (if generated)
if (Level.rainX0 > 0) {
  place((Level.rainX0 + Level.rainX1) / 2);
  frames(140, { right: true });
  shot('5-rain');
  weather.nextStrike = 1;
  frames(4, {});
  shot('5b-lightning');
}

// 6. hound + approach
place(Level.hounds[Level.hounds.length - 1].x - 70);
frames(40, {});
shot('6-hound');

// 6b. the moon wolf mid-hunt
if (Level.wolves.length) {
  const wf = game.enemies.find(e => e.constructor.name === 'MoonWolf');
  if (wf) {
    wf.state = 'prowl'; wf.hp = 9; wf.frozen = 0;
    wf.x = wf.homeX; wf.y = wf.groundY - wf.h;
    place(wf.homeX + 70);
    frames(34, {});
    shot('6w-wolf');
  }
}

// 7. boss + breath
game.player.maxHp = 99; game.player.hp = 99;
place(Level.boss.triggerX + 32);
frames(140, { whipEvery: 25 });
shot('7-boss');
game.boss.state = 'breath'; game.boss.t = 0;
frames(32, {});
shot('7b-breath');

// 8b. the Nightmare (stage 2 boss)
game.stage = 2; resetGame(true); game.state = 'play';
game.player.maxHp = 99; game.player.hp = 99;
place(Level.boss.triggerX + 32);
frames(150, { whipEvery: 25, jumpEvery: 70 });
shot('9-nightmare');
game.boss.state = 'gallop'; game.boss.t = 0;
game.boss.dir = -1;
frames(14, {});
shot('9b-nightmare-gallop');
// 8c. Moloch under the blood moon (stage 3)
game.stage = 3; resetGame(true); game.state = 'play';
game.player.maxHp = 99; game.player.hp = 99;
place(Level.boss.triggerX + 32);
frames(130, { whipEvery: 30 });
game.boss.state = 'breathTele'; game.boss.t = 0;
frames(30, {});
game.boss.state = 'breath'; game.boss.t = 20;
keys.down = true; frames(10, {}); keys.down = false;
shot('9c-moloch-breath');
game.stage = 1;

// 8d. the bestiary, after a night of slaying
meta.bestiary = Object.assign(meta.bestiary || {}, {
  'Zombie': 23, 'Zombie:frost': 3, 'Zombie:gilded': 1,
  'ZombieK': 4, 'Bat': 11, 'BatB': 2, 'MedusaHead': 7,
  'HellHound': 4, 'MoonWolf': 2, 'Ghost': 2, 'GiantBat': 1, 'NightmareBoss': 1,
});
pending.beast = true; stepGame(); drawFrame();
shot('9d-bestiary');
pending.beast = true; stepGame();

// the late scenes are their own stage; leave no guardian holding the camera
game.stage = 1;
game.mode = 'normal';
resetGame();
game.bossActive = false;

// 10h1. the HUD carrying everything at once — the worst case for the layout
{
  const p = game.player;
  p.weapons = { whip: true, sword: true, axe: true, spear: true, claws: true, scythe: true, censer: true };
  p.weapon = 'scythe'; p.whipLvl = 3;
  p.maxHp = 60; p.hp = 47; p.hearts = 99; p.keys = 9; p.gems = 88;
  p.level = 47; p.xp = 30; p.xpNext = 60;
  p.extraJumps = 2; p.gaze = true;
  p.subWeapon = 'cross'; p.subInfusion = 'fire';
  p.cardAction = 'jupiter'; p.cardAttr = 'blackdog';
  p.cards.jupiter = true; p.cards.blackdog = true;
  meta.essence = 999;
  meta.mastery = { scythe: 1200 };
  p.buffs = {};
  p.giveBuff('fury'); p.giveBuff('stoneskin'); p.giveBuff('swiftness'); p.giveBuff('moonveil');
  game.score = 123456;
  place(Level.pxW * 0.3);
  frames(8, {});
  shot('10h1-hud-loaded');
  // and the empty case, where nothing is carried
  p.keys = 0; p.gems = 0; p.buffs = {}; p.extraJumps = 0; p.gaze = false;
  p.weapons = { whip: true }; p.weapon = 'whip'; p.whipLvl = 1;
  p.level = 1; p.xp = 0; p.maxHp = 16; p.hp = 16; p.hearts = 5;
  p.subWeapon = null; p.subInfusion = null;
  p.cardAction = null; p.cardAttr = null;
  meta.essence = 0; meta.mastery = {};
  frames(4, {});
  shot('10h2-hud-bare');
}

// 10cd. reading a pairing before you commit to it
{
  const p = game.player;
  for (const k of CARD_ACTIONS.concat(CARD_ATTRS)) p.cards[k] = true;
  p.cardAction = 'mercury'; p.cardAttr = 'salamander';
  game.state = 'cards';
  game.cardSel = { col: 1, row: 6 };        // hovering an attribute we have NOT bound
  drawFrame();
  shot('10cd-card-hover');
  game.cardSel = { col: 1, row: 0 };        // hovering the one that IS bound
  drawFrame();
  shot('10cd2-card-bound');
  game.state = 'play';
}

// 10s1. a shaft built in four beats, with signs and stepping stones
{
  const shaft = (Level.landmarks || []).find(m => m.kind === 'shaft');
  if (shaft) {
    place(shaft.x - 70);
    game.camY = Math.max(-160, shaft.y - 620);
    frames(30, {});
    shot('10s1-shaft-beats');
  }
  const sig = (Level.sigils || [])[0];
  if (sig) {
    place(sig.x - 40);
    frames(24, {});
    shot('10s2-sigil');
  }
  const shrine = Level.props.find(pr => pr.type === 'shrine');
  if (shrine) {
    place(shrine.x - 20);
    frames(24, {});
    shot('10s3-antepiece');
  }
}

// 10m1. the rebuilt chart, part-explored
{
  const p = game.player;
  game.explored = new Uint8Array(LEVEL_W * LEVEL_H);
  // walk a stretch of the castle so the fog lifts honestly
  place(Level.pxW * 0.18);
  frames(200, { right: true });
  place(Level.pxW * 0.42);
  frames(120, { right: true });
  game.marks = [];
  markSpot(p.x, p.y);
  markSpot(p.x - 300, p.y);
  pending.map = true; stepGame(); drawFrame();
  shot('10m1-chart-regions');
  pending.map = true; stepGame();
}

// 10v1. the castle climbing and falling away
{
  const marks = (Level.landmarks || []);
  const tower = marks.find(m => m.kind === 'tower');
  const shaft = marks.find(m => m.kind === 'shaft');
  const lift = marks.find(m => m.kind === 'lift');
  game.player.skills.wallcling = true;
  game.player.skills.walljump = true;
  if (tower) {
    place(tower.x - 40);
    game.camY = Math.max(-160, tower.y - 540 * 0.55);
    frames(30, {});
    shot('10v1-tower');
  }
  if (shaft) {
    place(shaft.x - 60);
    frames(30, {});
    shot('10v2-shaft');
  }
  if (lift) {
    place(lift.x - 30);
    frames(40, {});
    shot('10v3-lift');
  }
  // the chart, now showing a castle with height
  place(Level.pxW * 0.45);
  frames(20, { right: true });
  game.explored.fill(1);
  pending.map = true; stepGame(); drawFrame();
  shot('10v4-chart');
  pending.map = true; stepGame();
}

// 10sn. the moment the view cuts from one scene to the next
{
  const p = game.player;
  const scenes = Level.scenes || [];
  const from = scenes[1] || scenes[0];
  if (from) {
    place(from.x1 - 60);
    game.scene = from; game.sceneCut = 0; game.sceneNameT = 0;
    frames(10, {});
    // walk him over the edge and catch the wipe mid-sweep
    for (let i = 0; i < 60; i++) {
      p.x += 5; p.invuln = 9999;
      stepGame();
      if (game.sceneCut > 0 && game.sceneCut < 12) break;
    }
    drawFrame();
    shot('10sn-scene-cut');
    // and the name plate, once the curtain has passed
    for (let i = 0; i < 20; i++) { p.invuln = 9999; stepGame(); }
    shot('10sn2-scene-name');
  }
}

// 10sk. the sky above the castle
{
  const isle = (Level.skyIslands || [])[0];
  if (isle) {
    const p = game.player;
    p.gifts = { wings: true }; p.extraJumps = 2;
    p.x = isle.x + isle.w / 2; p.y = isle.y - p.h - 2;
    p.vx = 0; p.vy = 0; p.invuln = 9999;
    game.camX = Math.max(0, p.x - 480);
    game.camY = Math.max(-160, isle.y - 260);
    game.state = 'play';
    frames(20, {});
    shot('10sk-sky-island');
  }
}

// 10z. one castle, zone by zone — each should look like its own place.
// The midpoint of a zone lands inside a tower or a lift well as often as not,
// and a picture of a chimney says nothing about the room grammar. Pick real
// ROOMS instead — connectors are climbs and guardian halls get their own shots —
// then stand the hunter in one and let the game's own camera frame it. If he
// ends up in the air, that candidate was not a floor: try the next.
const NOT_A_ROOM = { tower: 1, shaft: 1, lift: 1, approach: 1, arena: 1 };

// Is there somewhere to stand in this column, near the room's own floor? Checked
// against the grid rather than by dropping the hunter, because a pit-heavy room
// can eat a dozen candidates and each one costs a simulated second.
function floorNear(px, wantRow) {
  const cx = Math.floor(px / TILE);
  for (let d = 0; d <= 14; d++) {
    for (const r of [wantRow + d, wantRow - d]) {
      if (r < 3 || r > LEVEL_H - 4) continue;
      const below = tileAt(cx, r + 1);
      if (below !== 1 && below !== 4 && below !== 2) continue;
      if (tileAt(cx, r) || tileAt(cx, r - 1) || tileAt(cx, r - 2)) continue;
      return true;
    }
  }
  return false;
}

function roomSpots(z) {
  const rooms = (Level.regions || []).filter(r =>
    !NOT_A_ROOM[r.kind] && !r.vertical &&
    r.x0 >= z.x0 && r.x1 <= z.x1 && r.x1 - r.x0 >= 16 * TILE);
  // A room that belongs to this zone's own grammar says the most about it —
  // a generic hall in the foundry shows nothing the outer wall would not.
  const own = {};
  for (const k of (z.pool || [])) own[k] = 1;
  rooms.sort((a2, b2) =>
    ((own[b2.kind] ? 1 : 0) - (own[a2.kind] ? 1 : 0)) ||
    ((b2.x1 - b2.x0) - (a2.x1 - a2.x0)));
  const out = [];
  for (const r of rooms.slice(0, 6)) {
    for (const frac of [0.5, 0.4, 0.6, 0.3, 0.7]) {
      const px = r.x0 + (r.x1 - r.x0) * frac;
      if (floorNear(px, r.top !== undefined ? r.top : z.row)) out.push(px);
    }
  }
  return out;
}

{
  const p = game.player;
  clearFight();
  p.skills.wallcling = true; p.skills.walljump = true;
  p.gifts = { wings: true, gallop: true, maw: true };
  for (const gt of (Level.gates || [])) {
    if (!gt.open) openGate(gt);
  }
  (Level.zones || []).forEach((z, i) => {
    const spots = roomSpots(z);
    spots.push((z.x0 + z.x1) / 2);            // the old midpoint, as a last resort
    let landed = false;
    for (const px of spots) {
      place(px);
      frames(26, {});
      if ((p.onGround || p.inFlood) && !p.dead) { landed = true; break; }
    }
    if (!landed) console.log('  (' + z.key + ': no room with a floor, shot as found)');
    if (process.env.SHOTDEBUG) {
      console.log('   ' + z.key + ' rooms=' + roomSpots(z).length +
        ' p=' + Math.round(p.x) + ',' + Math.round(p.y) +
        ' ground=' + p.onGround + ' cam=' + Math.round(game.camX) + ',' + Math.round(game.camY) +
        ' scene=' + (game.scene ? game.scene.name + ' [' + Math.round(game.scene.x0) + '-' + Math.round(game.scene.x1) + ']' : 'none'));
    }
    shot('10z' + i + '-zone-' + z.key);
  });
}

// 10sv. a sealed chamber: the masonry from outside, then the room behind it
{
  const p = game.player;
  clearFight();
  const sc = (Level.secrets || []).find(q => q.kind === 'crack') || (Level.secrets || [])[0];
  if (sc) {
    p.skills.mist = true;
    place((sc.entrance.tx - 3) * TILE);
    p.facing = 1;
    frames(30, {});
    shot('10sv-secret-sealed');
    // whip it down and step inside
    for (let i = 0; i < 90; i++) { pending.whip = true; frames(4, {}); }
    p.x = (sc.tx0 + 1) * TILE; p.y = sc.ty1 * TILE - p.h;
    p.vx = 0; p.vy = 0;
    frames(30, {});
    shot('10sv2-secret-open');
  }
}

// 10rr. the rooms that belong to one place only
{
  const p = game.player;
  clearFight();
  p.gifts = { wings: true, gallop: true, maw: true };
  const want = ['nave', 'crypt', 'warren', 'gears', 'throne', 'moonbridge',
    'cistern', 'foundry', 'gallery', 'frostwalk'];
  for (const kind of want) {
    const reg = (Level.regions || []).find(r2 => r2.kind === kind);
    if (!reg) continue;
    place((reg.x0 + reg.x1) / 2);
    game.camY = Math.max(-160, (reg.top || 20) * TILE - 300);
    frames(26, {});
    shot('10rr-' + kind);
  }
}

// 10pz. the pause screen, carrying everything
{
  const p = game.player;
  p.subWeapon = 'cross'; p.subInfusion = 'fire';
  p.cardAction = 'jupiter'; p.cardAttr = 'luna';
  p.cards.jupiter = true; p.cards.luna = true;
  for (const k of ['slide', 'dash', 'wave', 'plunge', 'wind', 'vamp', 'tempest', 'focus',
    'wallcling', 'walljump', 'ironheart', 'keeneye']) p.skills[k] = true;
  p.perks = { edge: 3, vigour: 2, thrift: 1 };
  p.materials = { boneash: 4, moonsilver: 2, obsidian: 1, bloodiron: 0, gravesalt: 3 };
  p.level = 12; p.xp = 40; p.xpNext = 120;
  meta.mastery = { whip: 300 };
  game.state = 'pause';
  drawFrame();
  shot('10pz-pause');
  game.state = 'play';
}

// 10c1. the crafting bench, stocked
{
  const p = game.player;
  p.materials = { boneash: 7, moonsilver: 5, obsidian: 4, bloodiron: 3, gravesalt: 2 };
  meta.essence = 84;
  p.weapons = { whip: true, sword: true };
  game.state = 'craft'; game.craftSel = 5; game.craftScroll = 0;
  drawFrame();
  shot('10c1-forge-bench');
  drawFrame();                 // the layout is built during the draw
  game.craftSel = 40;
  drawFrame(); drawFrame();
  shot('10c2-forge-bench-scrolled');
  game.state = 'play';
}

// 10c3. the shrine tree, deep enough to scroll
{
  const p = game.player;
  p.hearts = 120;
  for (const k of ['slide', 'dash', 'tempest', 'wave', 'focus', 'plunge']) p.skills[k] = true;
  game.state = 'shrine'; game.shrineSel = 2;
  drawFrame();
  shot('10c4-shrine-top');
  game.shrineSel = 20;
  drawFrame();
  shot('10c5-shrine-scrolled');
  game.state = 'play';
}

// 10c6. the arcana, now four actions by ten attributes
{
  const p = game.player;
  for (const k of CARD_ACTIONS.concat(CARD_ATTRS)) p.cards[k] = true;
  p.cardAction = 'jupiter'; p.cardAttr = 'blackdog';
  game.state = 'cards'; game.cardSel = { col: 1, row: 9 };
  drawFrame();
  shot('10c7-arcana');
  game.state = 'play';
  p.cardAction = null; p.cardAttr = null;
}

// 10c8. an ore vein set in the masonry
{
  let vein = null;
  for (let tx = 0; tx < 340 && !vein; tx++) {
    for (let ty = 0; ty < 40; ty++) {
      if (tileAt(tx, ty) !== 13) continue;
      if (tileAt(tx - 1, ty) === 0 || tileAt(tx + 1, ty) === 0) { vein = { tx, ty }; break; }
    }
  }
  if (vein) {
    const openLeft = tileAt(vein.tx - 1, vein.ty) === 0;
    place((openLeft ? vein.tx - 1 : vein.tx + 1) * TILE + 8);
    game.player.facing = openLeft ? 1 : -1;
    frames(20, {});
    game.oreHits[vein.tx + ',' + vein.ty] = 1;
    shot('10c9-ore-vein');
  }
}

// 10p. the wolf's prowl, four frames sampled as it paces
const wolfMarks = [];
{
  const wf = game.enemies.find(e => e.constructor.name === 'MoonWolf');
  if (wf) {
    wf.state = 'prowl'; wf.hp = 20; wf.frozen = 0;
    wf.x = wf.homeX; wf.y = wf.groundY - wf.h; wf.stride = 0; wf.dir = -1;
    place(wf.homeX + 120);
    game.player.invuln = 9999;
    for (let k = 0; k < 4; k++) {
      // advance until the gait reaches the next frame
      const want = k;
      let guard = 0;
      while (Math.floor(wf.stride / 7) % 4 !== want && guard++ < 400) stepGame();
      shot('10p-wolf-prowl-' + k);
      wolfMarks.push([Math.round(wf.x + wf.w / 2 - game.camX), Math.round(wf.y + wf.h - game.camY)]);
    }
  }
}

require('fs').writeFileSync(OUT + '/wolf-marks.json', JSON.stringify(wolfMarks));

// 10a. an obelisk woken in the dark
game.stage = 1;
game.mode = 'normal';
resetGame();
game.bossActive = false;
{
  const ob = (Level.obelisks || [])[1] || (Level.obelisks || [])[0];
  if (ob) {
    ob.lit = true;
    place(ob.x - 40);
    frames(30, {});
    shot('10a-obelisk');
  }
}

// 10w. the weapon roster, each mid-swing
{
  const p = game.player;
  p.weapons = { whip: true, sword: true, axe: true, spear: true, claws: true, scythe: true, censer: true };
  p.whipLvl = 3;
  for (const key of ['whip', 'sword', 'axe', 'spear', 'claws', 'scythe', 'censer']) {
    p.weapon = key;
    place(Level.pxW * 0.16);
    p.facing = 1;
    frames(6, {});
    const wd = WEAPONS[key];
    pending.whip = true; stepGame();
    // hold the shot at the middle of the blow
    const mid = Math.floor((wd.active[0] + wd.active[1]) / 2);
    while (game.player.whipTimer >= 0 && game.player.whipTimer < mid) stepGame();
    shot('10w-weapon-' + key);
    weaponMarks.push([Math.round(p.x + p.w / 2 - game.camX), Math.round(p.y + p.h / 2 - game.camY)]);
    frames(30, {});
  }
  p.weapon = 'whip';
}
require('fs').writeFileSync(OUT + '/weapon-marks.json', JSON.stringify(weaponMarks));


// 10b. the wandering merchant
{
  const merch = Level.props.find(pr => pr.type === 'merchant');
  if (merch) {
    place(merch.x - 30);
    frames(20, {});
    shot('10b-merchant-world');
    game.nearMerchant = merch;
    merch.stock = makeShopStock();
    game.player.gems = 42;
    game.state = 'shop'; game.shopSel = 1;
    drawFrame();
    shot('10c-shop');
    game.state = 'play';
  }
}

// 10d. boons burning down in the corner of the eye
{
  const p = game.player;
  p.buffs = {};
  p.giveBuff('fury'); p.giveBuff('stoneskin'); p.giveBuff('swiftness');
  p.gems = 42;
  frames(20, { right: true });
  shot('10d-buffs');
  p.buffs = {};
}

// 10e. the crossroads between stages
game.state = 'win';
offerPaths();
game.state = 'crossroads'; game.pathSel = 1; game.pathT = 30;
drawFrame();
shot('10e-crossroads');
game.state = 'play';

// 10f. the catacombs, where no sky reaches
{
  game.path = PATHS.find(pp => pp.key === 'cloister');
  game.stage = 3;
  resetGame();
  place(Level.pxW * 0.3);
  frames(40, { right: true });
  shot('10f-catacombs');
  game.path = null;
  game.stage = 1;
  resetGame();
}

// 10g. deeds of the hunt
meta.feats = { firstblood: 1, comboiv: 1, deep4: 1, lockpick: 1, firstwarp: 1, blade3: 1, digger: 1, firstcrash: 1 };
meta.lore = { 0: 1, 3: 1, 7: 1 };
meta.cleared = 1;
game.state = 'feats'; game.featFrom = 'title';
drawFrame();
shot('10g-feats');
game.state = 'play';

// 10h. the Moonfang, and the dawn it dies under
{
  game.stage = 9;
  resetGame();
  place(Level.boss.homeX - 40);
  game.bossActive = true;
  game.boss.start();
  game.boss.hp = game.boss.maxHp * 0.3;
  game.boss.phase = 3;
  frames(120, {});
  shot('10h-moonfang');
  game.boss.state = 'sweep'; game.boss.t = 40; game.boss.sweepDir = -1;
  frames(20, {});
  shot('10i-moonfang-sweep');
  game.state = 'ending'; game.endT = 300;
  drawFrame();
  shot('10j-dawn');
  game.state = 'play';
  game.stage = 1;
  resetGame();
}

// 8. game over
game.player.maxHp = 16; game.player.invuln = 0; game.player.hp = 1;
game.player.skills.wind = false;
game.player.damage(5, 0);
frames(150);
shot('8-gameover');
})().catch(e => { console.error('RENDER FAILED:', e.message, e.stack.split('\n')[1] || ''); process.exit(1); });
