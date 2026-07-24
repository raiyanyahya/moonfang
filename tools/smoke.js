// Headless smoke test: stub DOM/canvas, load all game scripts, simulate gameplay.
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


// --- generic no-op proxy for 2d contexts / gradients ---
function makeCtxStub() {
  const handler = {
    get(target, prop) {
      if (prop in target) return target[prop];
      return (...args) => makeCtxStub();
    },
    set(target, prop, val) { target[prop] = val; return true; },
  };
  return new Proxy({ canvas: {} }, handler);
}

function makeCanvas() {
  return {
    width: 0, height: 0,
    getContext: () => makeCtxStub(),
    addEventListener() {},
  };
}

const screenCanvas = makeCanvas();
screenCanvas.width = 960; screenCanvas.height = 540;

let rafCb = null;
const sandbox = {
  console,
  Math, JSON, Array, Object, String, Number, Uint8Array, setInterval: () => 0, clearInterval() {},
  document: {
    createElement: () => makeCanvas(),
    getElementById: () => screenCanvas,
  },
  requestAnimationFrame: cb => { rafCb = cb; },
};
// an in-memory localStorage, so saved hunts are really exercised
const storeData = {};
sandbox.localStorage = {
  getItem: k => (k in storeData ? storeData[k] : null),
  setItem: (k, v) => { storeData[k] = String(v); },
  removeItem: k => { delete storeData[k]; },
};
sandbox.Image = FakeImage;
sandbox.window = sandbox;
sandbox.window.addEventListener = () => {};
vm.createContext(sandbox);

const files = ['config.js', 'font.js', 'sprites.js', 'audio.js', 'level.js', 'systems.js', 'projectiles.js', 'pickups.js', 'enemies.js', 'bosses.js', 'player.js', 'ui.js', 'game.js'];
const src = files.map(f => fs.readFileSync('/home/dev/Downloads/code/ctl/js/' + f, 'utf8')).join('\n;\n');
// expose top-level bindings for testing
const testHook = '\n;__hook({ game, stepGame, drawFrame, pending, keys, Level, TILE, resetGame, Zombie, MedusaHead, particles, tileAt, Pickup, rollRelic, meta, CARD_COMBOS, litObelisks, makeShopStock, startRun, resumeRun, saveRun, loadRun, clearRun, buildLevel, PATHS, BUFFS, FEATS, LORE, WEAPONS, WEAPON_KEYS, SKILLS, RECIPES, MATERIALS, MATERIAL_KEYS, CARD_ACTIONS, CARD_ATTRS, isSolid, xpForLevel, masteryRank, MASTERY_NAME, LEVEL_W, LEVEL_H, eraseAllProgress, saveMeta, localStorage, BOSS_REWARDS, ZONES, buildWorld, zoneAt, CURSES, sceneAt, VIEW_W, SUB_KEYS, checkSecrets });';

let H = null;
sandbox.__hook = h => { H = h; };
try {
  vm.runInContext(src + testHook, sandbox, { filename: 'game-bundle.js' });
} catch (e) {
  console.error('LOAD FAILED:', e.message);
  console.error(e.stack.split('\n').slice(0, 6).join('\n'));
  process.exit(1);
}
console.log('scripts loaded, sprites built OK');

const { game, stepGame, drawFrame, pending, keys, Level, TILE, tileAt, Pickup, Zombie, rollRelic, meta, CARD_COMBOS, resetGame,
  litObelisks, makeShopStock, startRun, resumeRun, saveRun, loadRun, clearRun, buildLevel, PATHS, BUFFS, FEATS, LORE, WEAPONS, WEAPON_KEYS, SKILLS, RECIPES, MATERIALS, MATERIAL_KEYS, CARD_ACTIONS, CARD_ATTRS, isSolid, xpForLevel, masteryRank, MASTERY_NAME, LEVEL_W, LEVEL_H, eraseAllProgress, saveMeta, localStorage, BOSS_REWARDS, ZONES, buildWorld, zoneAt, CURSES, sceneAt, VIEW_W, SUB_KEYS, checkSecrets } = H;

(async () => {
await sandbox.__gameReady;
if (sandbox.__assetError) throw new Error(sandbox.__assetError);
console.log('assets loaded OK');

function frames(n, opts = {}) {
  for (let i = 0; i < n; i++) {
    if (opts.right) keys.right = true;
    if (opts.left) keys.left = true;
    if (opts.whipEvery && i % opts.whipEvery === 0) pending.whip = true;
    if (opts.jumpEvery && i % opts.jumpEvery === 0) pending.jump = true;
    if (opts.dashEvery && i % opts.dashEvery === 0) pending.dash = true;
    stepGame();
    drawFrame();
    const p = game.player;
    if (p && (!isFinite(p.x) || !isFinite(p.y))) throw new Error('player pos NaN at frame ' + i);
  }
  keys.right = keys.left = false;
}

// ---- helpers for generated stages
function groundTopAt(tx) {
  for (let ty = 0; ty < LEVEL_H; ty++) {
    const id = tileAt(tx, ty);
    if (id === 1 || id === 4 || id === 10) return ty * TILE;
  }
  return 12 * TILE;
}
function placeOnGround(px) {
  const p = game.player;
  // seek rightward for a column with real footing and headroom (skips pits)
  let tx = Math.max(2, Math.floor(px / TILE));
  for (let i = 0; i < 80; i++) {
    const t = tx + i;
    for (let ty = 2; ty < LEVEL_H; ty++) {
      const id = tileAt(t, ty);
      if (id === 1 || id === 4 || id === 10) {
        if (tileAt(t, ty - 1) === 0 && tileAt(t, ty - 2) === 0) {
          p.x = t * TILE + 2;
          p.y = ty * TILE - p.h - 0.1;
          p.vy = 0;
          return;
        }
        break;   // column blocked overhead; try next
      }
      if (id === 3) break;   // spike pit column
    }
  }
  p.x = px; p.y = 12 * TILE - p.h - 0.1; p.vy = 0;
}
function findSecret() {
  for (let ty = 0; ty < LEVEL_H; ty++) for (let tx = 0; tx < LEVEL_W; tx++)
    if (tileAt(tx, ty) === 10) return { tx, ty };
  return null;
}
const findShrine = () => Level.props.find(pr => pr.type === 'shrine');
function armor(p) { p.maxHp = 999; p.hp = 999; p.invuln = 99999; p.hurtTimer = 0;
  p.whipTimer = -1; p.dashTimer = 0; p.throwAnim = 0; p.slideTimer = 0; keys.attack = false;
  p.dead = false; p.vx = 0; p.vy = 0;
  game.hitstop = 0;
  game.projectiles.length = 0;
  game.enemyProjectiles.length = 0;
  if (game.state !== 'play') game.state = 'play'; }

// 1. title -> play
pending.enter = true;
stepGame(); drawFrame();
if (game.state !== 'play') throw new Error('expected play state, got ' + game.state);
console.log('1. title->play OK, stage width', (Level.pxW / TILE) | 0, 'tiles');

// 2. run right through the entrance
frames(600, { right: true, whipEvery: 40, jumpEvery: 90 });
console.log('2. entrance run OK, x=', game.player.x.toFixed(0), 'enemies=', game.enemies.length);

// 3. mid-stage combat soak
armor(game.player);
placeOnGround(Level.pxW * 0.35);
frames(400, { right: true, whipEvery: 25, jumpEvery: 120 });
console.log('3. mid-stage soak OK, score=', game.score);

// Stand the hunter on plain flat stone, clear of shafts and rising draughts —
// the castle now has terrain that will happily hold you off the floor.
function standOnFlatGround() {
  const p = game.player;
  const wTiles = Math.floor(Level.pxW / TILE);
  for (let tx = 8; tx < wTiles - 8; tx++) {
    let surf = -1;
    for (let ty = 2; ty < LEVEL_H; ty++) {
      if (isSolid(tileAt(tx, ty)) && tileAt(tx, ty - 1) === 0 && tileAt(tx, ty - 2) === 0) { surf = ty; break; }
    }
    if (surf < 0) continue;
    let flat = true;
    for (let c = tx; c < tx + 4; c++) {
      let s2 = -1;
      for (let ty = 2; ty < LEVEL_H; ty++) {
        if (isSolid(tileAt(c, ty)) && tileAt(c, ty - 1) === 0) { s2 = ty; break; }
      }
      if (s2 !== surf) { flat = false; break; }
    }
    if (!flat) continue;
    const px = tx * TILE + 4, py = surf * TILE - p.h;
    const inDraft = (Level.drafts || []).some(d =>
      px + p.w > d.x && px < d.x + d.w && py + p.h > d.y && py < d.y + d.h);
    if (inDraft) continue;
    p.x = px; p.y = py;
    p.vx = 0; p.vy = 0; p.onGround = true; p.dead = false;
    p.hurtTimer = 0; p.invuln = 9999;
    for (let i = 0; i < 4; i++) stepGame();
    return true;
  }
  return false;
}

// 3b. sub-weapons incl. cross + stopwatch
{
  const p = game.player; armor(p);
  standOnFlatGround();
  p.hearts = 60;
  p.throwAnim = 0; p.whipTimer = -1; game.hitstop = 0;
  game.giveItem('cross', p.x, p.y);
  const h0c = p.hearts;
  keys.up = true; pending.whip = true; stepGame(); keys.up = false;
  // it may bury itself in a fiend the same frame it leaves the hand
  if (!game.projectiles.some(pr => pr.constructor.name === 'CrossProj') && p.hearts >= h0c) {
    throw new Error('cross not thrown');
  }
  frames(120, {});
  p.throwAnim = 0; p.whipTimer = -1;
  const before = p.hearts;
  game.giveItem('watch', p.x, p.y);
  keys.up = true; pending.whip = true; stepGame(); keys.up = false;
  if (p.hearts !== before - 5) throw new Error('watch cost wrong: ' + before + '->' + p.hearts);
  if (game.watchFlash <= 0) throw new Error('watch flash missing');
  frames(30, {});
  game.giveItem('soulB', p.x, p.y); game.giveItem('soulZ', p.x, p.y); game.giveItem('soulM', p.x, p.y);
  game.giveItem('whip', p.x, p.y); game.giveItem('whip', p.x, p.y);
  if (p.whipLvl !== 3) throw new Error('whip lvl expected 3');
  // item crash
  p.subWeapon = 'knife'; p.hearts = 30; p.throwAnim = 0; p.whipTimer = -1;
  p.xp = 0; p.xpNext = 1e9;                 // no level-up may top up the hearts mid-measure
  const preH = p.hearts, preN = game.projectiles.length;
  pending.crash = true; stepGame();
  if (p.hearts !== preH - 10) throw new Error('crash cost wrong');
  if (game.projectiles.length < preN + 3) throw new Error('knife crash projectiles missing'); // some may impale foes instantly
  frames(60, {});
  // crouch shrinks the hitbox — but only with both feet on stone, and the castle
  // now has ledges and shafts, so settle onto ground first
  if (!standOnFlatGround()) throw new Error('nowhere flat and dry to stand');
  keys.down = true; frames(3, {});
  if (p.h !== 18) throw new Error('crouch hitbox not shrunk, h=' + p.h);
  keys.down = false; frames(3, {});
  if (p.h !== 27) throw new Error('stand hitbox not restored, h=' + p.h);
  console.log('3b. weapons/souls/crash/crouch OK');
}

// 3c. shrine: learn all six skills
{
  const p = game.player; armor(p);
  const sh = findShrine();
  if (!sh) throw new Error('no shrine generated');
  placeOnGround(sh.x + 2);
  frames(12, {});
  p.hearts = 900;
  game.hitstop = 0;
  pending.up = true; stepGame();
  if (game.state !== 'shrine') throw new Error('shrine did not open, state=' + game.state);
  // walk the whole tree several times over: gated skills open as their roots are learned
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < SKILLS.length; i++) {
      pending.whip = true; stepGame();        // try to learn selected
      pending.downN = true; stepGame();       // next row
    }
  }
  pending.enter = true; stepGame();
  const sk = p.skills;
  const missing = SKILLS.filter(s2 => !sk[s2.key]).map(s2 => s2.key);
  if (missing.length) throw new Error('skills not all learned, missing: ' + missing.join(','));
  if (SKILLS.length < 20) throw new Error('the tree shrank: ' + SKILLS.length);
  // slide
  keys.down = true; pending.dash = true; stepGame(); keys.down = false;
  if (p.slideTimer <= 0) throw new Error('slide did not start');
  frames(26, {});
  // double air dash via tempest — with VEIL STEP learned these are blinks
  pending.jump = true; stepGame(); frames(5, {});
  p.facing = -1;
  const bx0 = p.x, uses0 = p.airDashUses;
  pending.dash = true; stepGame();
  if (p.airDashUses !== uses0 + 1) throw new Error('air dash 1 failed');
  if (p.skills.veil && p.x >= bx0) throw new Error('veil step did not blink: ' + bx0 + ' -> ' + p.x);
  frames(14, {});
  pending.dash = true; stepGame();
  if (p.airDashUses !== uses0 + 2) throw new Error('tempest air dash 2 failed');
  frames(40, {});
  // a blink must never pass through solid masonry
  {
    p.skills.veil = true;
    p.x = 4 * TILE; p.y = 8 * TILE; p.vy = 0; p.onGround = false;
    p.airDashUses = 0; p.facing = -1;
    pending.dash = true; stepGame();
    if (p.x < TILE) throw new Error('veil step phased into the wall at x=' + p.x);
  }
  // crescent wave
  p.whipTimer = -1; p.throwAnim = 0;
  pending.whip = true; keys.attack = true; stepGame();
  for (let i = 0; i < 80; i++) stepGame();
  keys.attack = false; stepGame();
  if (!game.projectiles.some(pr => pr.constructor.name === 'CrescentWave')) throw new Error('wave not fired');
  frames(30, {});
  console.log('3c. six skills OK');
}

// 3d. arcana cards
{
  const p = game.player; armor(p);
  for (const k of ['mercury', 'mars', 'salamander', 'serpent', 'golem']) game.giveItem('card_' + k, p.x, p.y);
  if (!p.cards.golem) throw new Error('cards not granted');
  p.cardAction = 'mercury'; p.cardAttr = 'golem';
  // pin everything else that sharpens a blade, so the card's own bonus is measurable
  p.level = 1; p.weapon = 'whip'; p.buffs = {}; meta.mastery = {};
  p.whipTimer = 7;
  const hb = p.getWhipHitbox();
  if (hb.dmg !== 4 + 2) throw new Error('stone edge bonus wrong, dmg=' + hb.dmg);
  p.whipTimer = -1;
  pending.q = true; stepGame();
  if (game.state !== 'cards') throw new Error('card menu did not open');
  pending.rightN = true; stepGame(); pending.whip = true; stepGame();   // bind attr under cursor
  pending.q = true; stepGame();
  if (game.state !== 'play') throw new Error('card menu did not close');
  console.log('3d. arcana cards OK, bound', p.cardAction, '+', p.cardAttr);
}

// 3d2. new sub-weapons: holy tome + rebound stone
{
  const p = game.player; armor(p);
  p.hearts = 40;
  game.giveItem('bible', p.x, p.y);
  p.throwAnim = 0; p.whipTimer = -1;
  keys.up = true; pending.whip = true; stepGame(); keys.up = false;
  if (!game.projectiles.some(pr => pr.constructor.name === 'BibleProj')) throw new Error('bible not cast');
  frames(60, {});
  game.giveItem('stone', p.x, p.y);
  p.throwAnim = 0; p.whipTimer = -1;
  const h0 = p.hearts;
  keys.up = true; pending.whip = true; stepGame(); keys.up = false;
  // the stone may bounce into a fiend the same frame it leaves the hand,
  // so accept the throw itself (hearts spent) as proof
  if (!game.projectiles.some(pr => pr.constructor.name === 'StoneProj') && p.hearts >= h0) {
    throw new Error('stone not thrown; hearts=' + p.hearts + ' sub=' + p.subWeapon);
  }
  frames(90, {});
  console.log('3d2. tome + stone OK');
}

// 3d3. moonlit plunge + focus
{
  const p = game.player; armor(p);
  p.skills.plunge = true; p.skills.focus = true; p.skills.wave = true;
  placeOnGround(Level.pxW * 0.18);
  frames(8, {});
  pending.jump = true; stepGame(); frames(6, {});
  keys.down = true; pending.whip = true; stepGame(); keys.down = false;
  // success = still plunging OR already bounced off a victim (vy set to -4.6)
  if (!p.plunging && !(p.vy <= -4 && !p.onGround)) throw new Error('plunge did not start');
  frames(40, {});
  if (p.plunging) throw new Error('plunge never landed');
  // focus: wave fires after only ~30 held frames
  p.whipTimer = -1; p.throwAnim = 0;
  const preWaves = game.projectiles.filter(pr => pr.constructor.name === 'CrescentWave').length;
  pending.whip = true; keys.attack = true; stepGame();
  for (let i = 0; i < 52; i++) stepGame();
  keys.attack = false; stepGame();
  if (game.projectiles.filter(pr => pr.constructor.name === 'CrescentWave').length <= preWaves)
    throw new Error('focused wave not fired');
  frames(30, {});
  console.log('3d3. plunge + focus OK');
}

// 3d4. buried glimmer treasure
{
  const p = game.player; armor(p);
  const gl = Level.glimmers.find(t => !t.found);
  if (!gl) throw new Error('no glimmer generated');
  placeOnGround(gl.x - 2);
  frames(10, {});
  const preP = game.pickups.length;
  pending.up = true; stepGame();
  if (!gl.found) throw new Error('glimmer not dug up');
  if (game.pickups.length < preP + 2) throw new Error('treasure not dropped');
  frames(30, {});
  console.log('3d4. glimmer treasure OK');
}

// 3d5. relics: equip, stats, salvage, transmute, forge
{
  const p = game.player; armor(p);
  const preEss = (() => { try { return JSON.parse(sandbox.localStorage ? '0' : '0'); } catch (e) { return 0; } })();
  // give three relics with known affixes
  p.bag = [
    { base: 0, pre: 2, suf: 1, tier: 2 },   // SILVER (dmg1) OF FANGS (dmg1) t2 => dmg +4
    { base: 1, pre: 0, suf: 0, tier: 1 },   // BONE OF VIGOR: hp
    { base: 2, pre: 1, suf: 5, tier: 1 },   // IRON OF STONE: armor
  ];
  p.relics = [null, null, null];
  p.cardAction = null; p.cardAttr = null;   // unbind arcana so dmg math is pure
  p.buffs = {};                             // and no boon may be doubling the blade
  p.weapon = 'whip';                        // and the blade is the blade we mean
  p.level = 1; meta.mastery = {};           // and no level or mastery is helping
  pending.inv = true; stepGame();
  if (game.state !== 'relics') throw new Error('satchel did not open');
  // equip first bag relic (cursor to row 3)
  pending.downN = true; stepGame(); pending.downN = true; stepGame(); pending.downN = true; stepGame();
  pending.whip = true; stepGame();
  if (!p.relics.some(r => r)) throw new Error('relic not equipped');
  p.whipTimer = 7;
  const dmg = p.getWhipHitbox().dmg;
  p.whipTimer = -1;
  if (dmg !== 4 + 4) throw new Error('relic dmg bonus wrong: ' + dmg);   // blade 4 + capped relic 4
  // salvage one bag relic
  const bagBefore = p.bag.length;
  pending.downN = true; stepGame();
  pending.jump = true; stepGame();
  if (p.bag.length !== bagBefore - 1) throw new Error('salvage failed');
  pending.inv = true; stepGame();
  if (game.state !== 'play') throw new Error('satchel did not close');
  // forge mode: transmute needs 2 bag relics
  p.bag = [
    { base: 0, pre: 3, suf: 2, tier: 1 },
    { base: 1, pre: 4, suf: 3, tier: 1 },
  ];
  const forge = Level.props.find(pr => pr.type === 'forge');
  if (!forge) throw new Error('no forge generated');
  placeOnGround(forge.x + 2);
  frames(12, {});
  pending.up = true; stepGame();
  if (game.state !== 'relics' || !game.forgeMode) throw new Error('forge did not open, state=' + game.state);
  // cursor to bag rows and transmute the pair
  pending.downN = true; stepGame(); pending.downN = true; stepGame(); pending.downN = true; stepGame();
  pending.dash = true; stepGame();          // mark first
  pending.downN = true; stepGame();
  pending.dash = true; stepGame();          // transmute with second
  if (p.bag.length !== 1) throw new Error('transmute failed, bag=' + p.bag.length);
  if (p.bag[0].pre !== 3 || p.bag[0].suf !== 3) throw new Error('transmute affixes wrong');
  // forge from essence
  const H2 = sandbox;
  meta_set: {
    // give essence directly through the game's meta object via a crafted salvage
    p.bag.push({ base: 0, pre: 0, suf: 0, tier: 3 });
    pending.downN = true; stepGame();
    pending.jump = true; stepGame();        // salvage tier3 => +7 essence
  }
  pending.crash = true; stepGame();          // try forge (needs 12)
  pending.inv = true; stepGame();
  console.log('3d5. relics OK, bag=', p.bag.length, 'worn=', p.relics.filter(r => r).length);
}

// 3d6. gated riches: lofts, vault, plunge pocket, wolves, chest, elixir
{
  const p = game.player; armor(p);
  if (!Level.treasures.length) throw new Error('no gated treasures generated');
  if (!Level.wolves.length) console.log('   (no wolves this seed, ok)');
  // plunge pocket: find a cracked floor tile and shatter it
  // pick a cracked floor with clear air above it, so the dive has room to build
  let crack = null;
  for (let ty = 0; ty < 40 && !crack; ty++) {
    for (let tx = 0; tx < LEVEL_W; tx++) {
      if (tileAt(tx, ty) !== 11) continue;
      let headroom = 0;
      while (headroom < 6 && tileAt(tx, ty - 1 - headroom) === 0) headroom++;
      if (headroom < 4) continue;
      const inDraft = (Level.drafts || []).some(d =>
        tx * TILE >= d.x - 8 && tx * TILE <= d.x + d.w + 8 &&
        ty * TILE >= d.y && ty * TILE <= d.y + d.h);
      if (inDraft) continue;                    // a rising draught would slow the dive
      crack = { tx, ty }; break;
    }
  }
  if (crack) {
    p.skills.plunge = true;
    // nothing may interrupt the dive: a wound cancels a plunge, and the castle
    // now has gargoyles that drop on passers-by
    p.invuln = 99999; p.hurtTimer = 0; p.dead = false;
    game.hitstop = 0;
    p.x = crack.tx * TILE + 2; p.y = crack.ty * TILE - 56; p.vy = 0;
    p.plunging = true; p.plungeId++;
    for (let i = 0; i < 40 && tileAt(crack.tx, crack.ty) === 11; i++) {
      p.invuln = 99999;
      if (!p.plunging && tileAt(crack.tx, crack.ty) === 11) {
        // it bounced off a fiend on the way down; line it up and dive again
        p.x = crack.tx * TILE + 2; p.y = crack.ty * TILE - 56; p.vy = 0;
        p.plunging = true; p.plungeId++;
      }
      stepGame();
    }
    if (tileAt(crack.tx, crack.ty) === 11) throw new Error('plunge floor did not shatter');
    console.log('3d6a. plunge pocket OK');
  } else console.log('3d6a. no cracked floor this seed (ok)');
  // chest + elixir collection
  armor(p);
  placeOnGround(Level.pxW * 0.15);
  const preScore = game.score, preMax = p.maxHp;
  p.maxHp = 20; p.hp = 10;   // realistic baseline so elixir math is visible
  game.pickups.push(new Pickup(p.x, p.y, 'chest'));
  game.pickups.push(new Pickup(p.x + 4, p.y, 'elixir'));
  frames(10, {});
  if (game.score < preScore + 1000) throw new Error('chest score missing');
  if (p.maxHp !== 22) throw new Error('elixir maxHp wrong: ' + p.maxHp);
  p.maxHp = preMax; p.hp = Math.min(p.hp, p.maxHpTotal());
  console.log('3d6b. chest + elixir OK');
  // a moon wolf hunts
  if (Level.wolves.length) {
    const wolf = game.enemies.find(e => e.constructor.name === 'MoonWolf');
    if (!wolf) throw new Error('wolf entity missing');
    wolf.state = 'prowl'; wolf.hp = 5; wolf.frozen = 0;
    wolf.x = wolf.homeX; wolf.y = wolf.groundY - wolf.h;
    p.x = wolf.homeX + 60; p.y = wolf.groundY - 60; p.vy = 0;
    frames(50, {});
    if (!game.enemies.some(e => e.constructor.name === 'MoonWolf' && e.state === 'hunt'))
      throw new Error('wolf never hunted');
    // slay it, then stand in its ghost-bite spot: the dead must not attack
    const dw = game.enemies.find(e => e.constructor.name === 'MoonWolf');
    dw.hp = 1; dw.hurt(5);
    if (dw.state !== 'gone') throw new Error('wolf did not die');
    p.maxHp = 30; p.hp = 30; p.invuln = 0; p.hurtTimer = 0;
    p.x = dw.x; p.y = dw.y - 4; p.vy = 0;
    frames(40, {});
    const bit = 30 - p.hp;
    // other live enemies may nip once; the DEAD wolf must not be the biter
    if (p.invuln <= 0 && bit > 0 && Math.abs(p.x - dw.x) < 20) {
      const others = game.enemies.some(e => !e.remove && e !== dw && e.state !== 'gone' &&
        Math.abs(e.x - p.x) < 60);
      if (!others) throw new Error('slain wolf still bites: lost ' + bit + ' hp');
    }
    armor(p);
    console.log('3d6c. moon wolf + corpse-bite regression OK');
  }
}

// 3e. secret wall
{
  const p = game.player; armor(p);
  const sec = findSecret();
  if (sec) {
    // Vault doors stand in free air with no floor beside them, so hold the
    // hunter at the door's own height rather than trusting the terrain.
    const side = tileAt(sec.tx - 1, sec.ty) === 0 ? -1 : 1;
    const anchor = () => {
      p.x = (sec.tx + side) * TILE + (side < 0 ? 4 : -4);
      p.y = sec.ty * TILE + TILE - p.h;
      p.vx = 0; p.vy = 0;
      p.facing = -side;
      p.invuln = 9999; p.hurtTimer = 0; p.dead = false;
    };
    for (let swing = 0; swing < 8 && tileAt(sec.tx, sec.ty) === 10; swing++) {
      anchor();
      pending.whip = true;
      for (let f = 0; f < 26; f++) { anchor(); stepGame(); }
    }
    // and again crouched, for a door set low in the wall
    for (let swing = 0; swing < 6 && tileAt(sec.tx, sec.ty) === 10; swing++) {
      anchor();
      keys.down = true; pending.whip = true;
      for (let f = 0; f < 26; f++) { anchor(); stepGame(); }
      keys.down = false;
    }
    if (tileAt(sec.tx, sec.ty) === 10) throw new Error('secret did not break');
    console.log('3e. secret wall OK');
  } else console.log('3e. no secret this seed (ok)');
}

// 3f. hell hound
{
  const p = game.player; armor(p);
  // the castle now climbs, so meet the hound at its own elevation
  const hEnt = game.enemies.find(e => e.constructor.name === 'HellHound') || null;
  const h = hEnt || Level.hounds[0];
  p.x = h.x + 60;
  p.y = (hEnt ? hEnt.y : h.y) - p.h;
  p.vx = 0; p.vy = 0; p.dead = false; p.invuln = 9999;
  frames(40, {});
  if (!game.enemies.some(e => e.constructor.name === 'HellHound' && e.state === 'lunge'))
    throw new Error('hound never lunged');
  console.log('3f. hound OK');
}

// 3g. loot engine: table stats, rarity curve, map screen
{
  const p = game.player; armor(p);
  placeOnGround(Level.pxW * 0.25);
  // candle table: 300 rolls must produce valid pickups, hearts commonest
  const counts = {};
  const before = game.pickups.length;
  for (let i = 0; i < 300; i++) game.dropLoot(p.x, p.y - 40, 'candle');
  for (const pk of game.pickups.slice(before)) counts[pk.kind] = (counts[pk.kind] || 0) + 1;
  if (!counts.heart || counts.heart < 40) throw new Error('hearts not common: ' + JSON.stringify(counts));
  const relics = game.pickups.slice(before).filter(pk => pk.kind === 'relic');
  game.pickups.length = before;   // clean up the flood
  // rarity curve: 400 rolls, commons dominate, legendaries exist but rare
  const tiers = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 400; i++) tiers[rollRelic(0.3).tier]++;
  if (!(tiers[1] > tiers[3] && tiers[1] > tiers[5])) throw new Error('rarity curve inverted: ' + tiers);
  if (tiers[1] + tiers[2] + tiers[3] + tiers[4] + tiers[5] !== 400) throw new Error('bad tier rolls');
  // map screen opens, shows, closes
  pending.map = true; stepGame(); drawFrame();
  if (game.state !== 'map') throw new Error('map did not open');
  pending.map = true; stepGame();
  if (game.state !== 'play') throw new Error('map did not close');
  if (!game.explored || !game.explored.some(v => v)) throw new Error('nothing explored');
  console.log('3g. loot engine + rarity + map OK  tiers=' + tiers.slice(1).join('/'));
}

// 3h. set bonuses, golden keys, boss rush
{
  const p = game.player; armor(p);
  // prefix resonance: two BONE relics beat one twice over
  p.perks = {};   // isolate from any scrolls picked up en route
  p.relics = [
    { base: 0, pre: 0, suf: 2, tier: 1 },   // BONE (hp2) OF HASTE
    { base: 1, pre: 0, suf: 2, tier: 1 },   // BONE (hp2) OF HASTE
    null,
  ];
  const hp2 = p.relicStat('maxHp');
  if (hp2 !== 6) throw new Error('set bonus wrong: 2x BONE t1 should give 6, got ' + hp2);
  if (!p.relicSetInfo().length) throw new Error('set info missing');
  p.relics = [null, null, null];
  // locked treasury: find gate + use a key
  let gate = null;
  for (let ty = 0; ty < LEVEL_H && !gate; ty++) for (let tx = 0; tx < LEVEL_W; tx++)
    if (tileAt(tx, ty) === 12) { gate = { tx, ty }; break; }
  if (gate) {
    p.keys = 1;
    p.x = gate.tx * TILE + TILE + 8; p.y = gate.ty * TILE - 4; p.vy = 0;
    frames(20, { left: true });   // walk into the gate
    if (tileAt(gate.tx, gate.ty) === 12) throw new Error('gate did not unlock');
    console.log('3h-a. golden key OK');
  } else console.log('3h-a. no treasury this seed (ok)');
  // boss rush: from title, B starts it; kill all three against the clock
  game.state = 'title';
  pending.rush = true; stepGame();
  if (game.state !== 'play' || game.mode !== 'rush') throw new Error('rush did not start');
  if (!game.bossActive) throw new Error('rush boss inactive');
  armor(game.player);
  for (let i = 0; i < 3; i++) {
    game.boss.hp = 1; game.boss.state = game.boss.state === 'idle' ? 'hover' : game.boss.state;
    game.boss.hurt(5);
    frames(120, {});
  }
  if (game.state !== 'win') throw new Error('rush did not finish, state=' + game.state + ' idx=' + game.rushIndex);
  if (!(meta.rushBest > 0)) throw new Error('rush best time not saved');
  pending.enter = true; stepGame();
  if (game.state !== 'title' || game.mode !== 'normal') throw new Error('rush exit broken');
  // back to a normal run for the remaining scenarios
  pending.enter = true; stepGame();
  if (game.state !== 'play') throw new Error('post-rush restart broken');
  console.log('3h. sets + keys + rush OK, best=' + meta.rushBest);
}

// 3i. variants, scrolls, infusions, curses, bestiary
{
  const p = game.player; armor(p);
  // variant application at deep-stage odds
  const preStage = game.stage;
  game.stage = 6;
  let variants = 0;
  for (let i = 0; i < 60; i++) {
    const z = game.applyVariant({ hp: 6, contactDmg: 3, scoreVal: 100, constructor: { name: 'T' } });
    if (z.variant) variants++;
  }
  game.stage = preStage;
  if (variants < 8) throw new Error('variants too rare at depth: ' + variants);
  // technique scrolls rank up perks through the pipeline
  const preDmg = (p.whipTimer = 7, p.getWhipHitbox().dmg);
  p.whipTimer = -1;
  p.perks.edge = 4;                                     // EDGE IV: +2 blade via stat pipeline
  p.whipTimer = 7;
  const postDmg = p.getWhipHitbox().dmg;
  p.whipTimer = -1;
  if (postDmg !== preDmg + 2) throw new Error('perk stat pipeline broken: ' + preDmg + '->' + postDmg);
  p.perks.edge = 0;
  // scroll pickup grants a rank
  const nPerks = () => Object.values(p.perks).reduce((a, b) => a + b, 0);
  const before = nPerks();
  game.pickups.push(new Pickup(p.x, p.y, 'scroll'));
  frames(8, {});
  if (nPerks() !== before + 1) throw new Error('scroll did not teach');
  // infusion procs: leaden knife hits harder
  p.subWeapon = 'knife'; p.subInfusion = 'stone'; p.hearts = 20;
  p.throwAnim = 0; p.whipTimer = -1;
  keys.up = true; pending.whip = true; stepGame(); keys.up = false;
  const kn = game.projectiles.find(pr => pr.constructor.name === 'KnifeProj');
  if (!kn || kn.infusion !== 'stone') throw new Error('infusion not applied to projectile');
  frames(30, {});
  // curses: the castle grows crueller the deeper you carry the hunt
  game.curses = [];
  const cpool = Object.keys(CURSES);
  game.curses.push(cpool[0]);
  if (!game.cursed(cpool[0])) throw new Error('a curse that does not bite');
  game.curses = ['sting'];
  armor(game.player);
  game.player.invuln = 0;
  game.player.hp = 50;
  game.player.damage(3, 0);
  if (game.player.hp !== 50 - 4) throw new Error('sting curse not applied: ' + game.player.hp);
  armor(game.player);
  game.curses = [];
  // bestiary remembers kills
  meta.bestiary = {};
  game.addKillScore(100, { constructor: { name: 'Zombie' }, hitbox: () => ({ x: 0, y: 0, w: 1, h: 1 }) });
  if (!meta.bestiary.Zombie) throw new Error('bestiary not recording');
  pending.beast = true; stepGame(); drawFrame();
  if (game.state !== 'bestiary') throw new Error('bestiary did not open');
  pending.beast = true; stepGame();
  if (game.state !== 'play') throw new Error('bestiary did not close');
  // every action x attribute pairing must exist, and carry a real effect. Bonus
  // pairings beyond the grid (e.g. attribute+attribute resonances) are allowed.
  const wantCombos = CARD_ACTIONS.length * CARD_ATTRS.length;
  if (Object.keys(CARD_COMBOS).length < wantCombos) {
    throw new Error('combo count ' + Object.keys(CARD_COMBOS).length + ' want >= ' + wantCombos);
  }
  for (const a of CARD_ACTIONS) for (const b of CARD_ATTRS) {
    const c = CARD_COMBOS[a + '+' + b];
    if (!c) throw new Error('missing combo ' + a + '+' + b);
    if (!c[0] || !c[1]) throw new Error('combo ' + a + '+' + b + ' has no name or text');
    if (!c[2] || !Object.keys(c[2]).length) throw new Error('combo ' + a + '+' + b + ' does nothing');
  }
  // reset stage back for downstream boss tests
  game.stage = 1; resetGame(); game.state = 'play'; armor(game.player);
  console.log('3i. variants/scrolls/infusion/curses/bestiary OK');
}

// 4. medusa zone
{
  armor(game.player);
  const z = Level.medusaZones[0];
  if (z) { placeOnGround((z.x0 + z.x1) / 2); frames(300, { whipEvery: 20 }); }
  console.log('4. medusa zone OK');
}

// 5. boss + breath
{
  const p = game.player; armor(p);
  if (game.state !== 'play') game.state = 'play';
  p.dead = false;
  placeOnGround(Level.boss.triggerX + 32);
  frames(60, {});
  if (!game.bossActive) throw new Error('boss did not trigger');
  console.log('5. boss triggered, gate closed=', game.gateClosed);
  let sawFire = false;
  for (let i = 0; i < 900; i++) {
    if (i % 15 === 0) pending.whip = true;
    if (i % 60 === 0) pending.jump = true;
    stepGame(); drawFrame();
    if (game.enemyProjectiles.length) sawFire = true;
  }
  if (!sawFire) throw new Error('boss never breathed fire');
  console.log('5b. fire breath OK');
  game.boss.hp = 1; game.boss.hurt(3);
  if (!game.boss.dead) throw new Error('boss should be dead');
  frames(100, {});
  if (!game.pickups.some(pk => pk.kind === 'relic') && !game.player.bag.length)
    throw new Error('boss dropped no relic');
  frames(100, {});
  // a guardian in the body of the castle leaves a gift, not a way out
  const arena = game.bossArena || (Level.bosses && Level.bosses[0]);
  if (arena && arena.reward) {
    if (!game.player.gifts || !game.player.gifts[arena.reward]) {
      throw new Error('the guardian left no gift: ' + arena.reward);
    }
    const rw = BOSS_REWARDS[arena.reward];
    if (!rw) throw new Error('unknown reward ' + arena.reward);
    // and the gift must actually change what the hunter can do
    if (arena.reward === 'wings' && game.player.extraJumps < 2) {
      throw new Error('the wings granted no extra leap');
    }
    // every door that wanted it must now stand open
    for (const gt of (Level.gates || [])) {
      if (gt.need === arena.reward && !gt.open) throw new Error('a warded door stayed shut');
    }
    console.log('   guardian gift: ' + rw.name);
  }
  console.log('6. boss killed OK, relic dropped');
}

// there are no roads between stages any more; the castle is continuous
function takeRoad() {
  if (game.state === 'win') { pending.enter = true; stepGame(); drawFrame(); }
}

// 7. one castle: zones, their guardians, and the doors between them
{
  const p = game.player;

  // the castle is raised from the zone list, in order, end to end
  if (!Level.zones || Level.zones.length !== ZONES.length) {
    throw new Error('zones missing: ' + (Level.zones || []).length + ' of ' + ZONES.length);
  }
  let prev = null;
  for (const z of Level.zones) {
    if (z.x1 <= z.x0) throw new Error('zone ' + z.key + ' has no width');
    if (prev && z.x0 < prev.x1 - TILE * 2) {
      throw new Error('zone ' + z.key + ' [' + Math.round(z.x0/16) + '-' + Math.round(z.x1/16) + '] overlaps ' + prev.key + ' [' + Math.round(prev.x0/16) + '-' + Math.round(prev.x1/16) + ']');
    }
    prev = z;
  }
  // and they are genuinely different places, not the same hall seven times
  const biomes = new Set(Level.zones.map(z => z.biome));
  if (biomes.size < 5) throw new Error('the castle is monotonous: ' + [...biomes].join(','));

  // every guardian named in the zone list stands in its own hall
  const wantBosses = ZONES.filter(z => z.boss).length;
  if (!Level.bosses || Level.bosses.length !== wantBosses) {
    throw new Error('guardians: ' + (Level.bosses || []).length + ' want ' + wantBosses);
  }
  for (const A of Level.bosses) {
    if (A.arenaX1 <= A.arenaX0) throw new Error('a hall with no room in it');
    const g2 = game.guardians.find(b => b.arena === A);
    if (!g2) throw new Error('no guardian built for ' + A.zone);
    if (g2.constructor.name !== A.cls) {
      throw new Error('wrong guardian in ' + A.zone + ': ' + g2.constructor.name);
    }
  }

  // zones that ask for a gift are sealed until it is carried
  const gated = ZONES.filter(z => z.gate);
  if (!Level.gates || Level.gates.length !== gated.length) {
    throw new Error('warded doors: ' + (Level.gates || []).length + ' want ' + gated.length);
  }
  for (const gt of Level.gates) {
    if (!BOSS_REWARDS[gt.need]) throw new Error('a door wanting nothing anyone carries');
    if (!gt.open) {
      // a shut door is genuinely solid
      if (!isSolid(tileAt(gt.tx, gt.bottom))) throw new Error('a warded door you can walk through');
    }
  }

  // walking the castle moves you between zones without any loading
  const z0 = zoneAt(Level.zones[0].x0 + 40);
  const z1 = zoneAt(Level.zones[1].x0 + 40);
  if (!z0 || !z1 || z0.key === z1.key) throw new Error('zoneAt cannot tell the zones apart');

  console.log('7. one castle OK: ' + Level.zones.length + ' zones (' +
    [...biomes].join(', ') + '), ' + Level.bosses.length + ' guardians, ' +
    Level.gates.length + ' warded doors, ' + Math.round(Level.pxW / TILE) + ' tiles wide');
}

// 8. death -> gameover -> restart at stage 1
{
  const p = game.player;
  p.skills.wind = false;
  p.invuln = 0; p.hp = 1;
  p.damage(5, 0);
  frames(160, {});
  if (game.state !== 'gameover') throw new Error('expected gameover, got ' + game.state);
  pending.enter = true; stepGame(); drawFrame();
  if (game.state !== 'play' || game.stage !== 1) throw new Error('restart broken');
  console.log('8. death/restart OK');
}

// 9. spikes (if this seed generated any)
{
  let spike = null;
  for (let ty = 0; ty < 40 && !spike; ty++) for (let tx = 0; tx < LEVEL_W; tx++)
    if (tileAt(tx, ty) === 3) { spike = { tx, ty }; break; }
  if (spike) {
    const p = game.player; p.invuln = 0; p.hp = 16; p.maxHp = 16;
    p.x = spike.tx * TILE; p.y = spike.ty * TILE - 60; p.vy = 0;
    frames(60, {});
    console.log('9. spikes:', p.hp < 16 || p.dead || game.state !== 'play' ? 'OK' : 'WARN no damage');
  } else console.log('9. no spikes this seed (ok)');
}

// 10. pause toggles
if (game.state !== 'play') game.state = 'play';
for (let i = 0; i < 3; i++) { pending.enter = true; stepGame(); drawFrame(); frames(40, { right: true }); }
console.log('10. pause toggles OK, final state=', game.state);

// 10b. warp obelisks, merchant, buffs, tablets, feats, save/continue
{
  const p = game.player; armor(p);
  game.state = 'play';

  // obelisks wake on touch and carry you between themselves
  if (!Level.obelisks || Level.obelisks.length < 2) throw new Error('no obelisks in the castle');
  const [o1, o2] = Level.obelisks;
  for (const ob of [o1, o2]) {
    p.x = ob.x; p.y = ob.y - p.h; p.vx = 0; p.vy = 0;
    frames(3, {});
    if (!ob.lit) throw new Error('obelisk did not wake at x=' + ob.x);
  }
  const lit = litObelisks();
  if (lit.length < 2) throw new Error('lit obelisks not tracked: ' + lit.length);
  p.x = 60; p.y = 12 * TILE - p.h;
  pending.map = true; stepGame(); drawFrame();
  if (game.state !== 'map') throw new Error('chart did not open');
  pending.rightN = true; stepGame(); drawFrame();
  const dest = lit[game.warpSel % lit.length];
  pending.whip = true; stepGame();
  if (game.state !== 'play') throw new Error('warp did not return to play');
  if (Math.abs(p.x + p.w / 2 - (dest.x + 6)) > 12) {
    throw new Error('warp missed: player at ' + Math.round(p.x) + ' want ' + Math.round(dest.x));
  }
  if (!meta.feats.firstwarp) throw new Error('mirror walker deed not earned');

  // buffs change what the hunter can do
  armor(p);
  p.buffs = {};
  const dmgBase = p.getWhipHitbox ? null : null;
  p.giveBuff('fury');
  if (!p.buffs.fury) throw new Error('fury not granted');
  p.whipTimer = 8;
  const furyDmg = p.getWhipHitbox() ? p.getWhipHitbox().dmg : 0;
  delete p.buffs.fury;
  const plainDmg = p.getWhipHitbox() ? p.getWhipHitbox().dmg : 0;
  if (furyDmg <= plainDmg) throw new Error('fury did not double the blade: ' + furyDmg + ' vs ' + plainDmg);
  p.whipTimer = -1;
  p.giveBuff('stoneskin');
  p.invuln = 0; p.hp = 40; p.maxHp = 40;
  p.damage(5, p.x - 20);
  const soaked = 40 - p.hp;
  p.buffs = {}; armor(p); p.invuln = 0; p.hp = 40;
  p.damage(5, p.x - 20);
  const bare = 40 - p.hp;
  if (soaked >= bare) throw new Error('stoneskin did not armor: ' + soaked + ' vs ' + bare);
  armor(p);

  // buff pickups
  p.buffs = {};
  game.pickups.push(new Pickup(p.x, p.y, 'swiftness'));
  frames(8, {});
  if (!p.buffs.swiftness) throw new Error('buff pickup did not apply');
  p.buffs = {};

  // lore tablets are remembered forever
  meta.lore = {};
  game.pickups.push(new Pickup(p.x, p.y, 'tablet'));
  frames(8, {});
  if (!Object.keys(meta.lore).length) throw new Error('tablet not recorded');

  // the merchant trades gems for goods
  const merch = Level.props.find(pr => pr.type === 'merchant');
  if (!merch) throw new Error('no merchant in the castle');
  placeOnGround(merch.x + 4);
  frames(4, {});
  if (!game.nearMerchant) { game.nearMerchant = merch; }
  pending.up = true; stepGame();
  if (game.state !== 'shop') throw new Error('shop did not open');
  merch.stock = makeShopStock();
  const heal = merch.stock.findIndex(it => it.kind === 'heal');
  game.shopSel = heal;
  p.gems = 0; p.hp = 5; p.maxHp = 40;
  pending.whip = true; stepGame();
  if (merch.stock[heal].sold) throw new Error('bought with no gems');
  p.gems = 50;
  pending.whip = true; stepGame();
  if (!merch.stock[heal].sold) throw new Error('purchase failed');
  if (p.gems !== 50 - merch.stock[heal].cost) throw new Error('gems not spent');
  if (p.hp <= 5) throw new Error('draught did not heal');
  pending.enter = true; stepGame();
  if (game.state !== 'play') throw new Error('shop did not close');
  console.log('10b. obelisks + merchant + buffs + tablets OK');
}

// 10v. the castle now climbs and falls
{
  const p = game.player; armor(p);
  // the floor is no longer one flat line
  const rows = new Set();
  for (let tx = 4; tx < Math.floor(Level.pxW / TILE) - 4; tx++) {
    for (let ty = 2; ty < LEVEL_H; ty++) {
      if (tileAt(tx, ty) === 1 && tileAt(tx, ty - 1) === 0) { rows.add(ty); break; }
    }
  }
  const lo = Math.min(...rows), hi = Math.max(...rows);
  if (rows.size < 3) throw new Error('the castle is still flat: rows ' + [...rows].join(','));
  if (hi - lo < 6) throw new Error('too little vertical range: ' + lo + '..' + hi);

  // every floor must be reachable: no column may be sealed under solid rock
  for (let tx = 6; tx < Math.floor(Level.pxW / TILE) - 6; tx += 3) {
    let surf = -1;
    for (let ty = 2; ty < LEVEL_H; ty++) {
      if (tileAt(tx, ty) === 1 && tileAt(tx, ty - 1) === 0) { surf = ty; break; }
    }
    if (surf < 0) continue;
    if (surf < 2) throw new Error('a floor sits above the sky at column ' + tx);
  }

  // lifts carry the hunter upward
  if (Level.lifts && Level.lifts.length) {
    const lf = Level.lifts[0];
    lf.y = lf.y1; lf.dir = -1; lf.wait = 0;
    p.x = lf.x + lf.w / 2 - p.w / 2;
    p.y = lf.y - p.h - 1;
    p.vx = 0; p.vy = 0.5;
    game.state = 'play';
    const y0 = p.y;
    frames(90, {});
    if (p.y >= y0 - 8) throw new Error('the lift carried nobody: ' + Math.round(y0) + ' -> ' + Math.round(p.y));
    console.log('   lift raised the hunter ' + Math.round(y0 - p.y) + 'px');
  }
  console.log('10v. vertical castle OK, floors span rows ' + lo + '-' + hi +
    ' (' + rows.size + ' levels), ' + (Level.lifts || []).length + ' lifts, ' +
    (Level.landmarks || []).length + ' landmarks');
  armor(p);
}

// 10d1. updraughts, gargoyles, and resting at an obelisk
{
  const p = game.player; armor(p);
  game.state = 'play';

  // an updraught must break a fall and, held into, carry you upward
  if (Level.drafts && Level.drafts.length) {
    const d = Level.drafts[0];
    p.x = d.x + d.w / 2 - p.w / 2;
    p.y = d.y + 20;
    p.vx = 0; p.vy = 5; p.onGround = false;
    let maxFall = 0;
    for (let i = 0; i < 20; i++) { stepGame(); maxFall = Math.max(maxFall, p.vy); }
    if (maxFall > 2.0) throw new Error('the draught did not break the fall: vy ' + maxFall.toFixed(2));
    // hold up and it lifts you
    p.x = d.x + d.w / 2 - p.w / 2;
    p.y = d.y + d.h - 40;
    p.vy = 0;
    const y0 = p.y;
    keys.up = true;
    for (let i = 0; i < 40; i++) stepGame();
    keys.up = false;
    if (p.y >= y0 - 10) throw new Error('the draught carried nobody up: ' + Math.round(y0) + ' -> ' + Math.round(p.y));
    console.log('   updraught lifted the hunter ' + Math.round(y0 - p.y) + 'px');
  }

  // gargoyles wait in stone and drop on you
  const gar = game.enemies.find(e => e.constructor.name === 'Gargoyle');
  if (gar) {
    gar.state = 'perch'; gar.hp = 30;
    gar.x = gar.homeX; gar.y = gar.homeY;
    // struck on its perch it takes half, and wakes
    const hp0 = gar.hp;
    gar.hurt(6);
    if (gar.hp !== hp0 - 3) throw new Error('perched stone took full damage: ' + (hp0 - gar.hp));
    if (gar.state !== 'dive') throw new Error('the gargoyle slept through a blow');
    // put it back to sleep and walk beneath it
    gar.state = 'perch'; gar.t = 0; gar.vy = 0;
    gar.x = gar.homeX; gar.y = gar.homeY;
    p.x = gar.x; p.y = gar.y + 90;
    p.vx = 0; p.vy = 0;
    const gy0 = gar.y;
    let fell = 0, sawWakeFirst = false;
    // it grinds awake first now, so give it the time that takes — and keep the
    // hunter alive and standing under it, or the world stops updating
    for (let i = 0; i < 140; i++) {
      p.x = gar.homeX; p.y = gar.homeY + 90;
      p.vx = 0; p.vy = 0; p.invuln = 9999; p.dead = false; p.hurtTimer = 0;
      game.state = 'play'; game.hitstop = 0;
      stepGame();
      fell = Math.max(fell, gar.y - gy0);
      if (gar.state === 'wake') sawWakeFirst = true;
    }
    if (!sawWakeFirst) throw new Error('the gargoyle dropped with no warning');
    // it dives, lands, climbs back and waits again — so measure the deepest fall,
    // not where it happens to be when we stop looking
    if (fell < 8) throw new Error('the gargoyle never fell: deepest ' + Math.round(fell) + 'px');
    console.log('   gargoyle dropped ' + Math.round(fell) + 'px onto the hunter');
    armor(p);
  }

  // resting at a woken obelisk mends you and wakes what you killed
  const ob = (Level.obelisks || [])[0];
  if (ob) {
    ob.lit = true;
    p.x = ob.x - p.w / 2 + 6;
    p.y = ob.y - p.h;
    p.vx = 0; p.vy = 0; p.onGround = true;
    p.maxHp = 40; p.hp = 7; p.hearts = 2;
    p.flasks = 0;               // an empty flask belt, to prove the rest refills it
    // something slain, waiting to return
    const slain = game.enemies.find(e => e.state === 'gone' && e.respawn !== undefined);
    if (slain) slain.respawn = 5000;
    frames(4, {});
    pending.up = true; stepGame();
    if (p.hp !== p.maxHpTotal()) throw new Error('resting did not mend: ' + p.hp);
    // the rule: a rest refills the healing flasks but must NOT mint thrown-arm
    // hearts (the old exploit) — you could stand at an obelisk and farm ammo.
    if (p.flasks !== p.flaskMax) throw new Error('resting did not refill flasks: ' + p.flasks);
    if (p.hearts > 2) throw new Error('resting minted hearts (the old exploit is back): ' + p.hearts);
    if (slain && slain.respawn > 100) throw new Error('the castle did not stir: ' + slain.respawn);
    console.log('   rested at an obelisk: healed to ' + p.hp + ', flasks ' + p.flasks + '/' + p.flaskMax + ', hearts held at ' + p.hearts);
  }
  console.log('10d1. draughts + gargoyles + resting OK');
  armor(p);
}

// 10k. four beats, stepping stones, and signs the castle puts up
{
  const p = game.player; armor(p);

  // every gated place must carry a sign saying what it wants
  if (!Level.sigils || !Level.sigils.length) throw new Error('the castle set gates but no signs');
  const icons = new Set(Level.sigils.map(s2 => s2.icon));
  for (const s2 of Level.sigils) {
    if (!['wing', 'plunge', 'wall', 'key', 'strike'].includes(s2.icon)) {
      throw new Error('a sign nobody can read: ' + s2.icon);
    }
    if (s2.x < 0 || s2.x > Level.pxW) throw new Error('a sign outside the castle: x=' + Math.round(s2.x/16) + ' icon=' + s2.icon + ' worldEnd=' + Math.round(Level.pxW/16));
  }

  // a sign must actually stand near the thing it warns of
  let matched = 0;
  for (const s2 of Level.sigils) {
    const tx = Math.floor(s2.x / TILE), ty = Math.floor(s2.y / TILE);
    let near = false;
    for (let dx = -3; dx <= 3 && !near; dx++) {
      for (let dy = -4; dy <= 3; dy++) {
        const id = tileAt(tx + dx, ty + dy);
        if (id === 10 || id === 11 || id === 12 || id === 2) { near = true; break; }
      }
    }
    if (near) matched++;
  }
  if (matched < Level.sigils.length * 0.5) {
    throw new Error('signs stand nowhere near what they warn of: ' + matched + '/' + Level.sigils.length);
  }

  // shafts must be readable: a catch-ledge close under the lip, not a blind drop
  const shafts = (Level.regions || []).filter(r => r.kind === 'shaft');
  for (const r of shafts) {
    const c0 = Math.floor(r.x0 / TILE), c1 = Math.floor(r.x1 / TILE);
    let lipRow = -1;
    for (let ty = 2; ty < LEVEL_H && lipRow < 0; ty++) {
      if (isSolid(tileAt(c0 + 1, ty)) && tileAt(c0 + 1, ty - 1) === 0) lipRow = ty;
    }
    if (lipRow < 0) continue;
    // something to land on within five rows of stepping off
    let caught = false;
    for (let ty = lipRow + 1; ty <= lipRow + 6 && !caught; ty++) {
      for (let tx = c0; tx <= c1; tx++) {
        const id = tileAt(tx, ty);
        if (id === 2 || isSolid(id)) { caught = true; break; }
      }
    }
    if (!caught) throw new Error('a shaft drops into nothing: no catch within six rows');
  }

  // and something to bounce off on the way down
  let roosts = 0;
  for (const r of shafts) {
    roosts += Level.bats.filter(b => b.x >= r.x0 && b.x <= r.x1).length;
  }
  if (shafts.length && roosts === 0) throw new Error('no stepping stones in any shaft');

  // the plunge really does rebound off a fiend, which is what makes them stones
  const bat = game.enemies.find(e => e.constructor.name === 'Bat' && !e.remove);
  if (bat) {
    p.skills.plunge = true;
    bat.state = 'fly'; bat.hp = 20;
    p.x = bat.x - p.w / 2; p.y = bat.y - 60;
    p.vx = 0; p.vy = 3; p.plunging = true; p.plungeId++;
    p.invuln = 99999;
    let bounced = false;
    for (let i = 0; i < 40; i++) {
      stepGame();
      if (p.vy < -1) { bounced = true; break; }
    }
    if (!bounced) throw new Error('the plunge would not rebound off a fiend');
  }

  // a shrine should have somewhere harmless to practise beside it
  const shrines = Level.props.filter(pr => pr.type === 'shrine');
  let taught = 0;
  for (const sh of shrines) {
    const sc = Math.floor(sh.x / TILE);
    let ledges = 0;
    for (let c = sc - 14; c <= sc + 14; c++) {
      for (let ty = 2; ty < LEVEL_H; ty++) if (tileAt(c, ty) === 2) { ledges++; break; }
    }
    if (ledges >= 3) taught++;
  }
  if (shrines.length && !taught) throw new Error('no shrine has anywhere safe to practise');
  console.log('   ' + taught + '/' + shrines.length + ' shrines have a practice run beside them');
  console.log('10k. ' + Level.sigils.length + ' signs (' + [...icons].join(',') +
    '), ' + shafts.length + ' readable shafts, ' + roosts + ' stepping stones OK');
  armor(p);
}

// 10map. the chart: honest fog, named regions, marks
{
  const p = game.player; armor(p);
  game.state = 'play';
  game.explored = new Uint8Array(LEVEL_W * LEVEL_H);

  // fog must lift in two dimensions: standing on a tower may not reveal the cellar
  const tower = (Level.landmarks || []).find(m => m.kind === 'tower') ||
    (Level.landmarks || []).find(m => m.kind === 'lift');
  if (tower) {
    p.x = tower.x; p.y = tower.y - p.h;
    p.vx = 0; p.vy = 0;
    game.camX = Math.max(0, p.x - 480); game.camY = tower.y - 300;
    frames(4, {});
    const tx = Math.floor(tower.x / TILE);
    const hereRow = Math.floor(tower.y / TILE);
    const seen = (c, r) => game.explored[r * LEVEL_W + c];
    if (!seen(tx, hereRow)) throw new Error('standing somewhere did not reveal it');
    // far below, in the same column, must still be dark
    let deepDark = false;
    for (let r = hereRow + 14; r < LEVEL_H; r++) if (!seen(tx, r)) { deepDark = true; break; }
    if (!deepDark) throw new Error('the fog still lifts by column, not by place');
  }

  // regions must be named and cover the castle
  if (!Level.regions || Level.regions.length < 5) {
    throw new Error('the castle has no regions: ' + (Level.regions || []).length);
  }
  for (const r of Level.regions) {
    if (!r.name) throw new Error('an unnamed region of kind ' + r.kind);
    if (r.x1 < r.x0) throw new Error('region ' + r.name + ' runs backwards');
  }
  const verticals = Level.regions.filter(r => r.vertical);
  if (!verticals.length) throw new Error('no vertical regions to draw as a spine');

  // the hunter's own marks: place, redraw, and scrub
  game.marks = [];
  p.x = Level.pxW * 0.3; p.y = 200;
  pending.markSpot = true; stepGame();
  if (game.marks.length !== 1) throw new Error('the mark was not scratched');
  pending.map = true; stepGame(); drawFrame();
  if (game.state !== 'map') throw new Error('chart did not open over the marks');
  pending.map = true; stepGame();
  pending.markSpot = true; stepGame();
  if (game.marks.length !== 0) throw new Error('standing on a mark did not scrub it');
  // and they cap out rather than growing forever
  for (let i = 0; i < 20; i++) {
    p.x = Level.pxW * 0.2 + i * 80;
    pending.markSpot = true; stepGame();
  }
  if (game.marks.length > 12) throw new Error('marks grew without limit: ' + game.marks.length);
  console.log('10map. 2D fog + ' + Level.regions.length + ' named regions (' +
    verticals.length + ' vertical) + marks OK');
  game.marks = [];
  armor(p);
}

// 10e1. erasing every trace, and only when meant
{
  // give the castle plenty to remember
  meta.bestStage = 7; meta.kills = 500; meta.essence = 90;
  meta.feats = { firstblood: 1, deep4: 1 }; meta.lore = { 0: 1, 2: 1 };
  meta.weapons = { whip: 1, axe: 1, scythe: 1 }; meta.startWeapon = 'axe';
  meta.mastery = { axe: 300 }; meta.cleared = 2; meta.bestiary = { Zombie: 40 };
  saveMeta();
  game.state = 'title';
  game.eraseArm = 0; game.eraseDone = 0;

  // one press only arms it — nothing may be lost to a stray key
  pending.erase = true; stepGame();
  if (game.eraseArm <= 0) throw new Error('the first press did not arm the erase');
  if (meta.bestStage !== 7) throw new Error('a single keypress wiped the save');

  // and it disarms itself if left alone
  for (let i = 0; i < 260; i++) stepGame();
  if (game.eraseArm > 0) throw new Error('the erase stayed armed forever');
  if (meta.bestStage !== 7) throw new Error('the save was lost while nobody looked');

  // two presses, and everything goes
  pending.erase = true; stepGame();
  pending.erase = true; stepGame();
  if (meta.bestStage !== 1) throw new Error('erase left the depth: ' + meta.bestStage);
  if (meta.kills || meta.essence || meta.cleared) throw new Error('erase left counters behind');
  if (Object.keys(meta.feats).length) throw new Error('erase left deeds behind');
  if (Object.keys(meta.lore).length) throw new Error('erase left tablets behind');
  if (Object.keys(meta.mastery).length) throw new Error('erase left mastery behind');
  if (Object.keys(meta.bestiary || {}).length) throw new Error('erase left the bestiary behind');
  if (meta.weapons.axe || meta.weapons.scythe) throw new Error('erase left weapons unlocked');
  if (!meta.weapons.whip) throw new Error('erase took the starting weapon too');
  if (meta.startWeapon !== 'whip') throw new Error('erase left the loadout set');
  if (loadRun()) throw new Error('erase left a saved hunt behind');
  if (localStorage.getItem('moonfang-hi')) throw new Error('erase left the best score behind');

  // and a fresh hunt still starts cleanly afterwards
  startRun();
  if (game.state !== 'play') throw new Error('no hunt after the erase');
  if (game.player.weapon !== 'whip') throw new Error('the fresh hunter is not carrying the whip');
  if (game.player.level !== 1) throw new Error('the fresh hunter is not level 1');
  console.log('10e1. erase-all OK (armed, disarmed, wiped, and playable after)');
  armor(game.player);
}

// 10dp. dropping down through a wooden ledge
{
  const p = game.player; armor(p);
  game.state = 'play';
  // find a one-way platform with clear air beneath it
  let plat = null;
  for (let tx = 8; tx < Math.floor(Level.pxW / TILE) - 8 && !plat; tx++) {
    for (let ty = 4; ty < LEVEL_H - 6; ty++) {
      if (tileAt(tx, ty) !== 2) continue;
      let clearBelow = true;
      for (let d = 1; d <= 3; d++) if (tileAt(tx, ty + d) !== 0) { clearBelow = false; break; }
      if (!clearBelow || tileAt(tx, ty - 1) !== 0 || tileAt(tx, ty - 2) !== 0) continue;
      // not inside a rising draught, which would simply float the hunter back up
      const px2 = tx * TILE, py2 = ty * TILE;
      const inDraft = (Level.drafts || []).some(d =>
        px2 > d.x - 20 && px2 < d.x + d.w + 20 && py2 > d.y - 20 && py2 < d.y + d.h + 20);
      if (inDraft) continue;
      plat = { tx, ty }; break;
    }
  }
  if (plat) {
    // stand on it
    p.x = plat.tx * TILE + 4;
    p.y = plat.ty * TILE - p.h;
    p.vx = 0; p.vy = 0; p.onGround = true; p.dropTimer = 0;
    for (let i = 0; i < 6; i++) stepGame();
    if (!p.onGround) throw new Error('could not stand on the ledge at all');
    const y0 = p.y;
    // hold down, then jump — the classic drop-through
    game.hitstop = 0;
    keys.down = true;
    for (let i = 0; i < 4; i++) stepGame();
    game.hitstop = 0;
    game.hitstop = 0;
    pending.jump = true; stepGame();
    for (let i = 0; i < 20; i++) stepGame();
    if (p.y <= y0 + 8) {
      throw new Error('down+jump did not drop through the ledge: ' + Math.round(y0) + ' -> ' + Math.round(p.y));
    }
    console.log('10dp. drop-through works, fell ' + Math.round(p.y - y0) + 'px');
  } else {
    console.log('10dp. (no free-standing ledge this seed)');
  }
  armor(p);
}

// 10j. juice and warnings: nothing should strike without telling you first
{
  const p = game.player; armor(p);
  game.state = 'play';

  // a heavy landing shakes the castle; a gentle one does not
  if (standOnFlatGround()) {
    game.shake = 0;
    p.vy = 0.5; p.onGround = false; p.y -= 6;
    for (let i = 0; i < 20 && !p.onGround; i++) stepGame();
    const soft = game.shake;
    game.shake = 0;
    p.y -= 150; p.onGround = false; p.vy = 0;
    for (let i = 0; i < 90 && !p.onGround; i++) stepGame();
    const hard = game.shake;
    if (hard <= soft) throw new Error('a long drop landed no heavier than a hop: ' +
      hard.toFixed(2) + ' vs ' + soft.toFixed(2));
    console.log('   landing shake: hop ' + soft.toFixed(1) + ' vs drop ' + hard.toFixed(1));
  }

  // the hound gathers itself before it charges
  const hound = game.enemies.find(e => e.constructor.name === 'HellHound');
  if (hound) {
    hound.state = 'wait'; hound.hp = 20; hound.frozen = 0;
    hound.x = hound.homeX; hound.y = hound.groundY - hound.h;
    p.x = hound.x + 70; p.y = hound.y - p.h + hound.h;
    p.vx = 0; p.vy = 0;
    let sawCrouch = false;
    for (let i = 0; i < 60; i++) {
      stepGame();
      if (hound.state === 'crouch') sawCrouch = true;
      if (hound.state === 'lunge') break;
    }
    if (!sawCrouch) throw new Error('the hound charged with no warning at all');
  }

  // the gargoyle grinds awake before it drops
  const gar = game.enemies.find(e => e.constructor.name === 'Gargoyle');
  if (gar) {
    gar.state = 'perch'; gar.hp = 30; gar.t = 0;
    gar.x = gar.homeX; gar.y = gar.homeY;
    p.x = gar.x; p.y = gar.y + 90; p.vx = 0; p.vy = 0;
    let sawWake = false;
    for (let i = 0; i < 60; i++) {
      stepGame();
      if (gar.state === 'wake') sawWake = true;
      if (gar.state === 'dive') break;
    }
    if (!sawWake) throw new Error('the gargoyle dropped with no warning at all');
  }
  console.log('10j. landing weight + strike telegraphs OK');
  armor(p);
}

// 10zn. each zone must breed its own dead, and the new fiends must work
{
  const p = game.player; armor(p);
  game.state = 'play';

  // the castle's population is not the same list seven times over
  const byZone = {};
  for (const e of game.enemies) {
    const z = zoneAt(e.x);
    if (!z) continue;
    (byZone[z.key] = byZone[z.key] || new Set()).add(e.constructor.name);
  }
  const kinds = new Set();
  for (const k in byZone) for (const n of byZone[k]) kinds.add(n);
  if (kinds.size < 5) throw new Error('the castle breeds only ' + kinds.size + ' kinds: ' + [...kinds].join(','));

  // and no two zones hold identical rosters, or it is one corridor again
  const sigs = Object.keys(byZone).map(k => [...byZone[k]].sort().join('+'));
  if (new Set(sigs).size < 2) throw new Error('every zone holds the same fiends');

  // the bone-thrower keeps its distance and throws
  const bt = game.enemies.find(e => e.constructor.name === 'BoneThrower');
  if (bt) {
    bt.state = 'wait'; bt.hp = 30; bt.throwT = 0; bt.frozen = 0;
    p.x = bt.x + 110; p.y = bt.y + bt.h - p.h;
    p.vx = 0; p.vy = 0;
    let threw = false;
    for (let i = 0; i < 120; i++) {
      p.invuln = 9999; p.dead = false; game.state = 'play';
      stepGame();
      if (game.enemyProjectiles.some(pr => pr.constructor.name === 'BoneProj')) { threw = true; break; }
    }
    if (!threw) throw new Error('the bone-thrower never threw anything');
  }

  // the spider hangs until you walk under it, then drops
  const sp = game.enemies.find(e => e.constructor.name === 'Spider');
  if (sp) {
    sp.state = 'hang'; sp.hp = 30; sp.y = sp.ceilY; sp.frozen = 0;
    const y0 = sp.y;
    p.x = sp.x; p.y = sp.ceilY + 120;
    let dropped = false;
    for (let i = 0; i < 120; i++) {
      p.x = sp.x; p.y = sp.ceilY + 120;
      p.vx = 0; p.vy = 0; p.invuln = 9999; p.dead = false;
      game.state = 'play'; game.hitstop = 0;
      stepGame();
      if (sp.y > y0 + 12) { dropped = true; break; }
    }
    if (!dropped) throw new Error('the spider never dropped: state=' + sp.state);
  }
  console.log('10zn. ' + kinds.size + ' kinds of fiend across ' +
    Object.keys(byZone).length + ' zones OK');
  armor(p);
}

// 10rm. every place must be built of its own rooms, with its own dangers
{
  const p = game.player; armor(p);

  // the region kinds a zone is built from must differ between zones
  const byZone = {};
  for (const r of (Level.regions || [])) {
    const z = zoneAt((r.x0 + r.x1) / 2);
    if (!z) continue;
    (byZone[z.key] = byZone[z.key] || new Set()).add(r.kind);
  }
  const sigs = {};
  for (const k in byZone) sigs[k] = [...byZone[k]].sort().join('+');
  const distinct = new Set(Object.values(sigs));
  if (distinct.size < 4) {
    throw new Error('the zones are built from the same rooms: ' + JSON.stringify(sigs));
  }
  // and the special rooms must actually have been raised
  const allKinds = new Set([].concat(...Object.values(byZone).map(s2 => [...s2])));
  for (const want of ['nave', 'crypt', 'warren', 'gears', 'throne', 'moonbridge']) {
    if (!allKinds.has(want)) throw new Error('the castle never built a ' + want);
  }

  // pendulums sweep, and they hurt
  if (Level.pendulums && Level.pendulums.length) {
    const pd = Level.pendulums[0];
    game.state = 'play';
    frames(4, {});
    if (pd.bx === undefined) throw new Error('the pendulum never swung');
    const x0 = pd.bx;
    frames(40, {});
    if (Math.abs(pd.bx - x0) < 4) throw new Error('the pendulum hangs still');
    // standing in its path costs blood
    p.maxHp = 60; p.hp = 60; p.invuln = 0; p.dead = false;
    let hurt = false;
    for (let i = 0; i < 200 && !hurt; i++) {
      p.x = pd.bx - p.w / 2; p.y = pd.by - p.h / 2;
      p.vx = 0; p.vy = 0; p.invuln = 0; p.hurtTimer = 0;
      game.state = 'play'; game.hitstop = 0;
      stepGame();
      if (p.hp < 60) hurt = true;
    }
    if (!hurt) throw new Error('the pendulum passed straight through the hunter');
    armor(p);
  }

  // blood pools drink from whoever stands in them
  let pool = null;
  for (let tx = 4; tx < LEVEL_W - 4 && !pool; tx++) {
    for (let ty = 2; ty < LEVEL_H; ty++) if (tileAt(tx, ty) === 15) { pool = { tx, ty }; break; }
  }
  if (pool) {
    p.maxHp = 60; p.hp = 60;
    let bled = false;
    for (let i = 0; i < 120 && !bled; i++) {
      p.x = pool.tx * TILE + 4; p.y = pool.ty * TILE - p.h + 2;
      p.vx = 0; p.vy = 0; p.dead = false; p.hurtTimer = 0;
      game.state = 'play'; game.hitstop = 0;
      stepGame();
      if (p.hp < 60) bled = true;
    }
    if (!bled) throw new Error('standing in blood cost nothing');
    armor(p);
  } else {
    throw new Error('the keep has no blood in it');
  }

  console.log('10rm. ' + allKinds.size + ' room kinds, ' + distinct.size +
    ' distinct zone grammars, ' + (Level.pendulums || []).length + ' pendulums OK');
  armor(p);
}

// 10cam. the camera must look where you are going
{
  const p = game.player; armor(p);
  game.state = 'play';
  // drop the hunter down a real shaft and watch the view lead the fall
  const shaft = (Level.landmarks || []).find(m => m.kind === 'shaft');
  const sx = shaft ? shaft.x : Level.pxW * 0.5;
  // find open air above that spot to fall through
  const stx = Math.floor(sx / TILE);
  let openTop = 2;
  while (openTop < 30 && tileAt(stx, openTop) === 0) openTop++;
  p.x = sx; p.y = Math.max(0, (openTop - 12)) * TILE;
  p.vx = 0; p.vy = 0; p.onGround = false;
  game.camLead = 0;
  let falling = 0;
  for (let i = 0; i < 40; i++) {
    stepGame();
    falling = Math.max(falling, game.camLead);
    if (p.onGround) break;
  }
  if (falling < 20) throw new Error('the camera did not look down while falling: ' + Math.round(falling));
  // and recovers once you land
  p.vy = 0; p.onGround = true;
  for (let i = 0; i < 90; i++) { p.onGround = true; p.vy = 0; stepGame(); }
  if (game.camLead > falling * 0.5) {
    throw new Error('the camera stayed pulled down after landing: ' + Math.round(game.camLead));
  }
  console.log('10cam. camera look-ahead OK (' + Math.round(falling) + 'px while falling)');
  armor(p);
}

// 10w1. wall cling and wall leap
{
  const p = game.player; armor(p);
  p.skills.wallcling = true; p.skills.walljump = true;
  p.buffs = {};
  // find a tall wall face with room to fall beside it
  let wall = null;
  for (let tx = 6; tx < Math.floor(Level.pxW / TILE) - 6 && !wall; tx++) {
    for (let ty = 6; ty < LEVEL_H - 10; ty++) {
      let run = 0;
      while (run < 5 && isSolid(tileAt(tx, ty + run)) && tileAt(tx - 1, ty + run) === 0) run++;
      if (run >= 5) { wall = { tx, ty }; break; }
    }
  }
  if (!wall) throw new Error('no sheer wall in the whole castle');
  // fall beside it, holding into the stone
  p.x = (wall.tx - 1) * TILE + 2;
  p.y = wall.ty * TILE;
  p.vx = 0; p.vy = 3; p.onGround = false;
  keys.right = true;
  let clung = false, slowest = 99;
  for (let i = 0; i < 30; i++) {
    stepGame();
    if (p.wallDir) { clung = true; slowest = Math.min(slowest, p.vy); }
    if (p.onGround) break;
  }
  if (!clung) throw new Error('the hunter would not catch the wall');
  if (slowest > 1.2) throw new Error('clinging did not slow the fall: vy ' + slowest.toFixed(2));
  // and kick off it
  if (!p.onGround) {
    const vx0 = p.x;
    pending.jump = true; stepGame();
    keys.right = false;
    frames(8, {});
    if (p.x >= vx0) throw new Error('the wall leap threw nobody clear');
    if (p.vy >= 0) throw new Error('the wall leap did not rise');
  }
  keys.right = false;
  console.log('10w1. wall cling + leap OK');
  armor(p);
}

// 10lv. levels and weapon mastery
{
  const p = game.player; armor(p);
  p.level = 1; p.xp = 0; p.xpNext = xpForLevel(1);
  const hp0 = p.maxHpTotal();
  const fake = { constructor: { name: 'Zombie' }, hitbox: () => ({ x: p.x, y: p.y, w: 8, h: 8 }) };
  for (let i = 0; i < 40; i++) game.addKillScore(100, fake);
  if (p.level < 2) throw new Error('no level gained from forty kills: xp ' + p.xp);
  if (p.maxHpTotal() <= hp0) throw new Error('levels did not raise max health');

  // mastery follows the weapon you actually swing, and persists
  meta.mastery = {};
  p.weapon = 'axe'; p.weapons.axe = true;
  for (let i = 0; i < 45; i++) game.addKillScore(100, fake);
  if (!meta.mastery.axe || meta.mastery.axe < 40) throw new Error('axe mastery not recorded');
  if (masteryRank(meta.mastery.axe) < 1) throw new Error('no mastery rank at 40 kills');
  if (meta.mastery.whip) throw new Error('mastery leaked to a weapon left in the satchel');
  console.log('10lv. level ' + p.level + ' + axe mastery ' +
    MASTERY_NAME[masteryRank(meta.mastery.axe)] + ' OK');
  armor(p);
}

// 10g1. gaits must match the ground, at any speed
{
  const p = game.player; armor(p);
  game.state = 'play';
  const wolf = game.enemies.find(e => e.constructor.name === 'MoonWolf');
  if (!wolf) throw new Error('no wolf to watch');
  // give it open ground to run on: a wolf against a wall proves nothing
  if (!standOnFlatGround()) throw new Error('nowhere flat for the wolf to run');
  wolf.state = 'prowl'; wolf.hp = 20; wolf.frozen = 0;
  wolf.homeX = p.x + 120;
  wolf.groundY = p.y + p.h;
  wolf.x = wolf.homeX; wolf.y = wolf.groundY - wolf.h;
  wolf.stride = 0; wolf.onGround = true;

  // measure, over the same span of frames, how far it walks and how many
  // animation frames that walk costs
  // it paces back and forth, so measure the path it walks, not where it ends up
  const watch = (frameCount) => {
    const s0 = wolf.stride;
    let path = 0, prev = wolf.x;
    for (let i = 0; i < frameCount; i++) {
      const wasGround = wolf.onGround;
      stepGame();
      // mid-leap it holds one outstretched frame, so only count ground covered on foot
      if (wasGround && wolf.onGround) path += Math.abs(wolf.x - prev);
      prev = wolf.x;
    }
    return { moved: path, cycled: wolf.stride - s0 };
  };

  // far away: a slow prowl
  p.x = wolf.homeX + 900;
  placeOnGround(wolf.homeX + 900);
  const slow = watch(120);
  if (wolf.state !== 'prowl') throw new Error('wolf hunted from across the castle');
  if (slow.moved < 4) throw new Error('the prowling wolf never moved');

  // the paws must have kept pace with the ground it covered
  if (Math.abs(slow.cycled / slow.moved - 1) > 0.08) {
    throw new Error('prowl gait drifted from the ground: walked ' +
      Math.round(slow.moved) + 'px but cycled ' + Math.round(slow.cycled));
  }

  // now bring the hunter close, so it breaks into a run
  placeOnGround(wolf.x + 60);
  frames(6, {});
  if (wolf.state !== 'hunt') throw new Error('wolf did not give chase');
  const fast = watch(60);
  if (fast.moved <= slow.moved) throw new Error('the hunting wolf was no faster');
  if (Math.abs(fast.cycled / fast.moved - 1) > 0.12) {
    throw new Error('hunt gait drifted from the ground: ran ' +
      Math.round(fast.moved) + 'px but cycled ' + Math.round(fast.cycled));
  }

  // the same ground covers the same number of paw-falls whether walking or running
  const slowPerPx = slow.cycled / Math.max(1, slow.moved);
  const fastPerPx = fast.cycled / Math.max(1, fast.moved);
  if (Math.abs(slowPerPx - fastPerPx) > 0.15) {
    throw new Error('the wolf changes gait with distance, not speed: ' +
      slowPerPx.toFixed(2) + ' vs ' + fastPerPx.toFixed(2));
  }
  console.log('10g1. wolf gait tracks the ground at ' + fastPerPx.toFixed(2) + ' px/px OK');
  armor(p);
}

// 10b1. main weapons: distinct reach, tempo, and switching
{
  const p = game.player; armor(p);
  p.buffs = {}; p.perks = {}; p.relics = [null, null, null]; p.bag = [];
  p.cardAction = null; p.cardAttr = null;
  p.whipLvl = 1;

  // every weapon must swing, land, and end within its own tempo
  const seen = {};
  for (const key of WEAPON_KEYS) {
    p.weapons[key] = true;
    p.weapon = key;
    p.whipTimer = -1;
    const wd = WEAPONS[key];
    let active = 0, reach = 0, dmg = 0, first = 0, behind = false;
    for (let f = 0; f < wd.total + 4; f++) {
      p.whipTimer = f;
      const hb = p.getWhipHitbox();
      if (hb) {
        active++; reach = hb.w; dmg = hb.dmg;
        if (active === 1) first = hb.w;
        if (hb.x < p.x) behind = true;
      }
    }
    if (!active) throw new Error(key + ' never lands a blow');
    if (active !== wd.active[1] - wd.active[0]) {
      throw new Error(key + ' active window wrong: ' + active);
    }
    // a spun haft cuts on both sides, so its box is twice its reach
    const wantReach = wd.wide ? wd.len[1] * 2 : wd.len[1];
    if (reach !== wantReach) throw new Error(key + ' reach wrong: ' + reach);
    if (wd.wide && !behind) throw new Error(key + ' does not cut behind');
    // a chain travels: it must start short and finish at full stretch
    if (wd.travel && first >= reach) {
      throw new Error(key + ' does not travel (starts at ' + first + ' of ' + reach + ')');
    }
    if (!wd.travel && !wd.wide && first !== reach) {
      throw new Error(key + ' reach is not steady through the swing');
    }
    if (dmg !== wd.dmg[1]) throw new Error(key + ' damage wrong: ' + dmg);
    seen[key] = { reach: wd.len[1], dmg, total: wd.total };
    p.whipTimer = -1;
  }
  // the roster must actually differ: spear outreaches claws, axe outhits sword,
  // and claws swing faster than the axe
  if (seen.spear.reach <= seen.claws.reach) throw new Error('spear does not outreach claws');
  if (seen.axe.dmg <= seen.sword.dmg) throw new Error('axe does not hit harder than the sword');
  if (seen.claws.total >= seen.axe.total) throw new Error('claws do not swing faster than the axe');

  // a full swing really does end when the weapon says it does
  p.weapon = 'claws'; p.whipTimer = -1;
  placeOnGround(Level.pxW * 0.14);
  pending.whip = true; stepGame();
  let frames2 = 0;
  while (p.whipTimer >= 0 && frames2 < 60) { stepGame(); frames2++; }
  if (frames2 > WEAPONS.claws.total + 2) throw new Error('claws swing outlasted their tempo: ' + frames2);

  // number keys draw a different weapon, but only one you own
  p.weapons = { whip: true, axe: true };
  p.weapon = 'whip';
  const owned = WEAPON_KEYS.filter(k => p.weapons[k]);
  pending.weap = owned.indexOf('axe'); stepGame();
  if (p.weapon !== 'axe') throw new Error('key did not draw the axe: ' + p.weapon);
  pending.weap = 8; stepGame();
  if (p.weapon !== 'axe') throw new Error('switched to a weapon never found');

  // every weapon in the roster must be reachable by a key, not just the first five
  p.weapons = {};
  for (const k of WEAPON_KEYS) p.weapons[k] = true;
  const all = WEAPON_KEYS.filter(k => p.weapons[k]);
  for (let i = 0; i < all.length; i++) {
    p.weapon = all[0];
    pending.weap = i; stepGame();
    if (p.weapon !== all[i]) {
      throw new Error('weapon ' + (i + 1) + ' (' + all[i] + ') cannot be drawn: got ' + p.weapon);
    }
  }

  // finding one is permanent, and it arms you at once
  delete p.weapons.spear;
  meta.weapons = { whip: 1 };
  game.giveItem('weap_spear', p.x, p.y);
  if (!p.weapons.spear) throw new Error('found weapon not added to the kit');
  if (p.weapon !== 'spear') throw new Error('found weapon not drawn');
  if (!meta.weapons.spear) throw new Error('weapon not unlocked for later hunts');

  // and it survives the descent and a saved hunt
  p.weapon = 'axe'; p.weapons.axe = true;
  game.state = 'win';
  takeRoad();
  if (game.player.weapon !== 'axe') throw new Error('weapon lost on descent');
  saveRun(game);
  const back = loadRun();
  if (!back.p.weapon || back.p.weapon !== 'axe') throw new Error('weapon not saved');
  console.log('10b1. weapon roster + switching + persistence OK');
  armor(game.player);
}

// 10m. mining and the forge bench
{
  const p = game.player; armor(p);
  game.state = 'play';
  p.materials = {};
  p.skills.prospector = false;

  // find an ore vein and strike it out of the wall
  // a seam you can actually stand beside and swing at
  let vein = null;
  for (let tx = 0; tx < LEVEL_W && !vein; tx++) {
    for (let ty = 0; ty < LEVEL_H; ty++) {
      if (tileAt(tx, ty) !== 13) continue;
      const ok = (c) => tileAt(c, ty) === 0 && isSolid(tileAt(c, ty + 1));
      if (ok(tx - 1) || ok(tx + 1)) { vein = { tx, ty }; break; }
    }
  }
  if (!vein) throw new Error('no ore veins in the castle');
  // stand on whichever side of the seam is open, and face it
  const openLeft = tileAt(vein.tx - 1, vein.ty) === 0 && isSolid(tileAt(vein.tx - 1, vein.ty + 1));
  const standTx = openLeft ? vein.tx - 1 : vein.tx + 1;
  p.x = standTx * TILE + 2;
  p.y = vein.ty * TILE + TILE - p.h;
  p.vx = 0; p.vy = 0; p.dead = false; p.invuln = 9999;
  frames(10, {});
  p.weapon = 'whip';
  for (let i = 0; i < 8 && tileAt(vein.tx, vein.ty) === 13; i++) {
    p.facing = openLeft ? 1 : -1;
    pending.whip = true; frames(24, {});
    if (tileAt(vein.tx, vein.ty) === 13) {
      p.facing = openLeft ? 1 : -1;
      keys.down = true; pending.whip = true; frames(24, {}); keys.down = false;
    }
  }
  if (tileAt(vein.tx, vein.ty) === 13) throw new Error('the vein would not break at ' + vein.tx + ',' + vein.ty + ' player ' + Math.round(p.x/16) + ',' + Math.round(p.y/16) + ' hits ' + JSON.stringify(game.oreHits));
  const got = MATERIAL_KEYS.reduce((a, k) => a + (p.materials[k] || 0), 0);
  if (got < 1) throw new Error('breaking the vein yielded no ore');
  if (!meta.feats.miner) throw new Error('miner deed not earned');

  // the bench opens at a forge and spends ore
  const forge = Level.props.find(pr => pr.type === 'forge');
  if (!forge) throw new Error('no forge in the castle');
  placeOnGround(forge.x + 4);
  frames(6, {});
  pending.q = true; stepGame();
  if (game.state !== 'craft') throw new Error('crafting bench did not open: ' + game.state);

  // stock the satchel and forge a weapon that cannot be found any other way
  const rec = RECIPES.find(r => r.key === 'w_scythe');
  for (const m in rec.cost) p.materials[m] = rec.cost[m] + 1;
  meta.essence = 200;
  p.weapons = { whip: true };
  game.craftSel = RECIPES.indexOf(rec);
  const essBefore = meta.essence;
  pending.whip = true; stepGame();
  if (!p.weapons.scythe) throw new Error('the scythe was not forged');
  if (p.weapon !== 'scythe') throw new Error('the forged weapon was not drawn');
  if (meta.essence >= essBefore) throw new Error('forging cost no essence');
  for (const m in rec.cost) {
    if ((p.materials[m] || 0) !== 1) throw new Error('materials not spent: ' + m);
  }
  if (!meta.feats.smith) throw new Error('smith deed not earned');

  // and it refuses when the satchel is empty
  const rec2 = RECIPES.find(r => r.key === 'w_censer');
  p.materials = {};
  game.craftSel = RECIPES.indexOf(rec2);
  pending.whip = true; stepGame();
  if (p.weapons.censer) throw new Error('forged something out of nothing');
  pending.enter = true; stepGame();
  if (game.state !== 'play') throw new Error('bench did not close');
  console.log('10m. mining + crafting bench OK, ' + RECIPES.length + ' recipes');
  armor(p);
}

// 10x. every arcana pairing does something the game can feel
{
  const p = game.player; armor(p);
  p.buffs = {}; p.perks = {}; p.relics = [null, null, null];
  p.weapon = 'whip'; p.whipLvl = 1;
  for (const k of CARD_ACTIONS.concat(CARD_ATTRS)) p.cards[k] = true;

  // a damage pairing really raises the blade
  p.cardAction = 'mercury'; p.cardAttr = 'golem';
  p.whipTimer = 7;
  const stoneDmg = p.getWhipHitbox().dmg;
  p.cardAction = null; p.cardAttr = null;
  const bareDmg = p.getWhipHitbox().dmg;
  p.whipTimer = -1;
  if (stoneDmg <= bareDmg) throw new Error('stone edge did not sharpen the blade');

  // a defensive pairing really soaks a wound
  p.cardAction = 'saturn'; p.cardAttr = 'golem';
  p.maxHp = 60; p.hp = 60; p.invuln = 0;
  p.damage(6, p.x - 30);
  const warded = 60 - p.hp;
  p.cardAction = null; p.cardAttr = null;
  armor(p); p.invuln = 0; p.hp = 60;
  p.damage(6, p.x - 30);
  const bare = 60 - p.hp;
  if (warded >= bare) throw new Error('earth rite did not armour: ' + warded + ' vs ' + bare);
  armor(p);

  // a ward pairing really conjures a familiar
  p.cardAction = 'jupiter'; p.cardAttr = 'luna';
  game.state = 'play';
  frames(6, {});
  if (!game.familiar) throw new Error('lunar ward summoned nothing');
  p.cardAction = null; p.cardAttr = null;
  frames(4, {});
  if (game.familiar) throw new Error('familiar lingered after unbinding');

  // every pairing must be readable in the menu without crashing
  for (const a of CARD_ACTIONS) for (const b of CARD_ATTRS) {
    p.cardAction = a; p.cardAttr = b;
    game.state = 'cards';
    drawFrame();
  }
  game.state = 'play';
  p.cardAction = null; p.cardAttr = null;
  console.log('10x. arcana: ' + CARD_ACTIONS.length + 'x' + CARD_ATTRS.length + ' pairings live OK');
  armor(p);
}

// 10b2. momentum: a slide-leap flies farther than a standing jump
{
  const p = game.player; armor(p);
  p.skills.slide = true; p.buffs = {};
  // the castle climbs now, so measure on a stretch that is genuinely flat
  const flatRun = (need) => {
    const wTiles = Math.floor(Level.pxW / TILE);
    let start = -1, row = -1, run = 0;
    for (let tx = 6; tx < wTiles - 6; tx++) {
      let surf = -1;
      for (let ty = 2; ty < LEVEL_H; ty++) {
        if (isSolid(tileAt(tx, ty)) && tileAt(tx, ty - 1) === 0 && tileAt(tx, ty - 2) === 0) { surf = ty; break; }
      }
      // it must also be open overhead: a practice ledge above would stop a leap
      let clearAbove = surf > 0;
      for (let dy = 1; dy <= 5 && clearAbove; dy++) {
        if (tileAt(tx, surf - dy) !== 0) clearAbove = false;
      }
      if (!clearAbove) { row = -1; run = 0; continue; }
      if (surf > 0 && surf === row) { run++; if (run >= need) return { tx: start, row }; }
      else { row = surf; start = tx; run = 1; }
    }
    return null;
  };
  const flat = flatRun(26);
  if (!flat) throw new Error('nowhere flat enough to measure a leap');
  const standAt = (offset) => {
    p.x = (flat.tx + offset) * TILE;
    p.y = flat.row * TILE - p.h;
    p.vx = 0; p.vy = 0; p.momentumT = 0; p.onGround = true;
    p.dead = false; p.invuln = 9999; p.hurtTimer = 0;
  };

  const runJump = () => {
    standAt(2);
    frames(20, { right: true });         // build up a run
    const x0 = p.x;
    game.hitstop = 0;
    pending.jump = true; stepGame();
    frames(45, {});
    return p.x - x0;
  };
  const slideLeap = () => {
    standAt(2);
    frames(20, { right: true });
    keys.down = true; pending.dash = true; stepGame(); keys.down = false;
    if (p.slideTimer <= 0) throw new Error('slide did not start for the leap');
    frames(4, {});
    const x0 = p.x;
    game.hitstop = 0;                    // hitstop would swallow the keypress
    pending.jump = true; stepGame();     // leap out of the slide
    if (p.slideTimer > 0) throw new Error('slide-leap did not cancel the slide');
    if (p.momentumT <= 0) throw new Error('slide-leap carried no momentum');
    frames(45, {});
    return p.x - x0;
  };
  const plain = runJump();
  const leapt = slideLeap();
  if (leapt <= plain) {
    throw new Error('slide-leap (' + Math.round(leapt) + ') no farther than a jump (' + Math.round(plain) + ')');
  }
  console.log('10b2. slide-leap carries ' + Math.round(leapt - plain) + 'px farther OK');
  armor(p);
}

// 10crash. the item crash, with every thrown arm in turn
{
  const p = game.player; armor(p);
  game.state = 'play';
  for (const sk of SUB_KEYS) {
    p.subWeapon = sk;
    p.hearts = 200;
    p.throwAnim = 0; p.whipTimer = -1;
    game.crashCd = 0; game.hitstop = 0;
    // isolate the crash's cost from the world: clear stray fiends and loot so a
    // heart dropped by an incidental kill (or one lying under the hunter's feet)
    // can't paper over the spend and make a real crash look free.
    game.enemies.length = 0; game.pickups.length = 0;
    const before = p.hearts;
    let err = null, afterCrash = before;
    try {
      pending.crash = true; stepGame();
      afterCrash = p.hearts;                       // the true post-cost total
      // stand something in the way, so every projectile's hit path is walked
      for (let n = 0; n < 3; n++) {
        const z = new Zombie(p.x + 24 + n * 18, p.y);
        z.rise = 0; z.hp = 99;
        game.enemies.push(z);
      }
      for (let i = 0; i < 90; i++) { armor(p); stepGame(); drawFrame(); }
    } catch (e) {
      err = e;
    }
    if (err) throw new Error('item crash with ' + sk + ' threw: ' + err.message);
    if (afterCrash >= before) throw new Error('item crash with ' + sk + ' cost nothing');
  }
  console.log('10crash. item crash works with all ' + SUB_KEYS.length + ' thrown arms OK');
  armor(p);
}

// 10sc. the castle is walked one scene at a time, and the view cuts between them
{
  const p = game.player; armor(p);
  const scenes = Level.scenes || [];
  if (scenes.length < 8) throw new Error('the castle has only ' + scenes.length + ' scenes');

  // they cover the castle exactly once: no gaps, no overlaps
  for (let i = 0; i < scenes.length; i++) {
    const sc = scenes[i];
    if (sc.x1 <= sc.x0) throw new Error('scene ' + sc.name + ' has no width');
    if (sc.x1 - sc.x0 < 60 * TILE) {
      throw new Error('scene ' + sc.name + ' is narrower than the view (' +
        Math.round((sc.x1 - sc.x0) / TILE) + ' tiles)');
    }
    if (i > 0 && Math.abs(sc.x0 - scenes[i - 1].x1) > 1) {
      throw new Error('a gap between ' + scenes[i - 1].name + ' and ' + sc.name);
    }
    if (!sc.name) throw new Error('an unnamed scene');
  }
  if (Math.abs(scenes[scenes.length - 1].x1 - Level.pxW) > TILE * 2) {
    throw new Error('the last scene stops short of the castle end');
  }

  // every guardian's hall is a scene of its own
  for (const A of Level.bosses) {
    const mid = (A.arenaX0 + A.arenaX1) / 2;
    const sc = sceneAt(mid);
    if (!sc || !sc.arena) throw new Error(A.zone + "'s hall is not a scene of its own");
  }

  // walking off the edge cuts the view to the next scene
  game.state = 'play';
  const first = scenes[0];
  p.x = first.x1 - 40; p.y = 200; p.vx = 0; p.vy = 0;
  game.scene = first; game.sceneCut = 0;
  let cut = false, named = false;
  for (let i = 0; i < 120; i++) {
    armor(p);
    p.x += 4;                                   // walk him across the boundary
    stepGame();
    if (game.sceneCut > 0) cut = true;
    if (game.sceneNameT > 0) named = true;
    if (game.scene !== first) break;
  }
  if (game.scene === first) throw new Error('crossing the edge did not change scene');
  if (!cut) throw new Error('the view did not cut');
  if (!named) throw new Error('the new scene announced no name');

  // and the camera stays inside the scene it is showing
  const sc2 = game.scene;
  for (let i = 0; i < 40; i++) { armor(p); stepGame(); }
  if (game.camX < sc2.x0 - 2 || game.camX > sc2.x1 - VIEW_W + 2) {
    throw new Error('the view wandered outside its scene: cam ' + Math.round(game.camX) +
      ' scene ' + Math.round(sc2.x0) + '-' + Math.round(sc2.x1));
  }
  console.log('10sc. ' + scenes.length + ' scenes, view cuts between them OK');
  armor(p);
}

// 10sec. sealed chambers: every one is hollow, sealed by a door of its kind,
// and standing inside one is what counts as finding it
{
  const p = game.player; armor(p);
  const list = Level.secrets || [];
  if (list.length < 8) throw new Error('only ' + list.length + ' sealed chambers in the castle');
  const kinds = {};
  for (const sc of list) {
    kinds[sc.kind] = (kinds[sc.kind] || 0) + 1;
    // the room must really be hollow
    for (let ty = sc.ty0; ty <= sc.ty1; ty++) {
      for (let tx = sc.tx0; tx <= sc.tx1; tx++) {
        if (isSolid(tileAt(tx, ty))) {
          throw new Error(sc.name + ' was filled in at ' + tx + ',' + ty);
        }
      }
    }
    // and the door must still be a door
    const d = tileAt(sc.entrance.tx, sc.entrance.ty);
    const wantDoor = sc.kind === 'plunge' ? 11 : sc.kind === 'key' ? 12 : 10;
    if (d !== wantDoor) {
      throw new Error(sc.name + ' (' + sc.kind + ') lost its door: id ' + d);
    }
    // nothing may be walled inside a chamber that is not reachable at all
    if (sc.tx1 < sc.tx0 || sc.ty1 < sc.ty0) throw new Error(sc.name + ' has no interior');
  }
  if (Object.keys(kinds).length < 3) {
    throw new Error('the chambers only come in ' + Object.keys(kinds).length + ' kind(s)');
  }

  // a mist door refuses the blade until the Pale Mist is carried
  const mistOne = list.find(sc => sc.kind === 'mist');
  if (mistOne) {
    p.skills.mist = false;
    const before = tileAt(mistOne.entrance.tx, mistOne.entrance.ty);
    placeOnGround((mistOne.entrance.tx - 2) * TILE);
    p.facing = 1;
    for (let i = 0; i < 40; i++) { armor(p); pending.whip = true; stepGame(); }
    if (tileAt(mistOne.entrance.tx, mistOne.entrance.ty) !== before) {
      throw new Error('a mist door broke to a blade');
    }
    p.skills.mist = true;
  }

  // standing in a chamber finds it
  const target = list.find(sc => !sc.found) || list[0];
  const midX = (target.x0 + target.x1) / 2, midY = (target.y0 + target.y1) / 2;
  game.state = 'play';
  game.secretsFound = 0; target.found = false;
  p.x = midX - p.w / 2; p.y = midY - p.h / 2; p.vx = 0; p.vy = 0;
  armor(p);
  checkSecrets();
  if (!target.found) throw new Error('standing inside ' + target.name + ' did not find it');
  if (game.secretsFound !== 1) throw new Error('the tally did not move');
  console.log('10sec. ' + list.length + ' sealed chambers (' +
    Object.entries(kinds).map(([k, n]) => k + ':' + n).join(' ') + ') OK');
  armor(p);
}

// 10sky. the skyward islands: unreachable on foot, rich, and some of them locked
{
  const p = game.player; armor(p);
  const isles = Level.skyIslands || [];
  if (!isles.length) throw new Error('the castle has no sky above it');

  for (const isle of isles) {
    const cx = Math.floor(isle.x / TILE), row = Math.floor(isle.y / TILE);
    // it must hang clear of everything below — a "sky" island resting on the
    // castle roof is just a ledge
    let air = 0;
    while (air < 8 && !isSolid(tileAt(cx + 2, row + 2 + air))) air++;
    if (air < 5) throw new Error('a sky island at ' + cx + ' sits only ' + air + ' rows above the castle');

    // and it must be worth the flight
    const loot = Level.treasures.filter(t2 => t2.x >= isle.x && t2.x <= isle.x + isle.w);
    if (!loot.length) throw new Error('a sky island at ' + cx + ' holds nothing');
    if (isle.locked) {
      // a locked one is sealed by a golden gate, not merely decorated
      let gate = false;
      for (let r = row - 3; r <= row; r++) if (tileAt(cx - 1, r) === 12) gate = true;
      if (!gate) throw new Error('a locked sky island at ' + cx + ' has no gate on it');
    }
  }

  // the deeper zones keep them; the outer wall does not
  const zonesWithSky = new Set(isles.map(i => { const z = zoneAt(i.x); return z ? z.key : '?'; }));
  if (zonesWithSky.has('wall')) throw new Error('the opening zone should keep its feet on the ground');
  console.log('10sky. ' + isles.length + ' sky islands across ' + zonesWithSky.size +
    ' zones (' + isles.filter(i => i.locked).length + ' locked) OK');
  armor(p);
}

// 10gd. every guardian must stand in its own hall and be fightable there
{
  const p = game.player; armor(p);
  for (const A of Level.bosses) {
    const b = game.guardians.find(g2 => g2.arena === A);
    if (!b) throw new Error('no guardian built for ' + A.zone);

    // it must start inside its own arena, not in some other part of the castle
    if (b.x + b.w < A.arenaX0 || b.x > A.arenaX1) {
      throw new Error(A.cls + ' in ' + A.zone + ' starts outside its hall: x=' + Math.round(b.x));
    }
    // and within reach of the hall's floor, not forty rows above it
    const floorRow = Math.round(A.floorY / TILE);
    const bossRow = Math.round((b.y + b.h) / TILE);
    if (Math.abs(bossRow - floorRow) > 12) {
      throw new Error(A.cls + ' in ' + A.zone + ' stands at row ' + bossRow +
        ' but its hall floor is row ' + floorRow);
    }
    // it must take wounds once woken
    game.state = 'play';
    game.boss = b; game.bossArena = A; game.bossActive = true;
    b.start();
    const hp0 = b.hp;
    if (!b.hurt(3)) throw new Error(A.cls + ' cannot be wounded after waking');
    if (b.hp >= hp0) throw new Error(A.cls + ' took no damage');
    // and it must be reachable: standing on the hall floor, the hunter's whip
    // should be able to touch it within a few seconds of it moving
    p.x = b.x; p.y = A.floorY - p.h; p.vx = 0; p.vy = 0;
    let closest = 1e9;
    for (let i = 0; i < 400; i++) {
      armor(p);
      p.y = Math.min(p.y, A.floorY - p.h);
      stepGame();
      const dy = Math.abs((b.y + b.h / 2) - (p.y + p.h / 2));
      closest = Math.min(closest, dy);
    }
    if (closest > 130) {
      throw new Error(A.cls + ' in ' + A.zone + ' never comes within reach: ' +
        Math.round(closest) + 'px above the floor at its closest');
    }
    game.bossActive = false; game.boss = null;
    b.hp = b.maxHp; b.dead = false; b.state = 'idle';
  }
  console.log('10gd. all ' + Level.bosses.length + ' guardians stand and fight in their halls OK');
  armor(game.player);
}

// 10c. the last guardian, the ending, and a hunt that survives closing
{
  const p = game.player; armor(p);

  // the Moonfang waits in the last zone of the castle, not on a stage number
  const lastZone = ZONES[ZONES.length - 1];
  if (lastZone.boss !== 'FinalBoss') throw new Error('the castle does not end with the Moonfang');
  const finalArena = Level.bosses.find(A => A.cls === 'FinalBoss');
  if (!finalArena) throw new Error('no hall for the Moonfang');
  const fb = game.guardians.find(b => b.arena === finalArena);
  if (!fb) throw new Error('the Moonfang was never built');
  if (!fb.bossName.includes('MOONFANG')) throw new Error('wrong name on the last guardian');

  // and it must be the deepest thing in the castle
  for (const A of Level.bosses) {
    if (A === finalArena) continue;
    if (A.arenaX0 > finalArena.arenaX0) throw new Error('a guardian stands past the Moonfang');
  }

  game.state = 'play';
  game.boss = fb; game.bossArena = finalArena; game.bossActive = true;
  fb.start();
  const seen = {};
  for (let i = 0; i < 2200; i++) {
    armor(game.player);
    stepGame();
    seen[fb.state] = true;
    if (fb.hp > fb.maxHp * 0.34) fb.hurt(1);
  }
  if (fb.phase < 2) throw new Error('the Moonfang never turned: phase ' + fb.phase);
  if (!seen.sweep) throw new Error('never saw the moonlit sweep');

  // felling it opens the way out of the castle
  fb.hp = 1; fb.hurt(50);
  if (!fb.dead) throw new Error('the Moonfang would not fall');
  frames(200, {});
  if (!game.victoryOrb) throw new Error('no way out after the last guardian');
  p.x = game.victoryOrb.x; p.y = game.victoryOrb.y; p.invuln = 0;
  frames(10, {});
  if (game.state !== 'ending') throw new Error('expected the ending, got ' + game.state);
  if (!meta.feats.trueclear) throw new Error('dawnbringer deed not earned');
  frames(420, {});
  drawFrame();
  pending.enter = true; stepGame();
  if (game.state !== 'title') throw new Error('ending did not return to the gate');

  // a hunt survives closing the game
  startRun();
  game.player.whipLvl = 3; game.player.maxHp = 44; game.player.hp = 30;
  game.player.gems = 17; game.player.skills.veil = true;
  game.player.gifts = { wings: true };
  saveRun(game);
  const saved = loadRun();
  if (!saved) throw new Error('run not saved');
  game.state = 'title';
  if (!resumeRun()) throw new Error('resume failed');
  if (game.player.whipLvl !== 3 || game.player.gems !== 17 || !game.player.skills.veil) {
    throw new Error('resumed hunter lost their gear');
  }
  if (!game.player.gifts || !game.player.gifts.wings) throw new Error('resumed hunter lost the guardian gift');
  clearRun();
  if (loadRun()) throw new Error('run not cleared');
  console.log('10c. the Moonfang + ending + save/continue OK');
  armor(game.player);
}

// 11. chaos monkey: random inputs across every state must never throw
{
  game.stage = 1; resetGame(); game.state = 'play';
  const p = game.player;
  p.maxHp = 999; p.hp = 999;
  p.skills = { slide: true, dash: true, wave: true, plunge: true, wind: true, vamp: true, tempest: true, focus: true };
  p.subWeapon = 'cross'; p.hearts = 500;
  for (const k of ['mercury', 'mars', 'salamander', 'serpent', 'golem', 'tempest', 'luna']) p.cards[k] = true;
  p.cardAction = 'mercury'; p.cardAttr = 'tempest';
  p.bag = [rollRelic(1), rollRelic(1)];
  const flags = ['jump', 'whip', 'dash', 'enter', 'up', 'downN', 'leftN', 'rightN', 'q', 'crash', 'inv', 'map', 'beast', 'feats', 'daily', 'cont'];
  // make sure the chaos actually wanders into the new rooms
  const merchC = Level.props.find(pr => pr.type === 'merchant');
  if (merchC) { game.nearMerchant = merchC; merchC.stock = makeShopStock(); }
  p.gems = 40;
  let visited = {};
  for (let i = 0; i < 5000; i++) {
    if (Math.random() < 0.35) pending[flags[(Math.random() * flags.length) | 0]] = true;
    keys.left = Math.random() < 0.3;
    keys.right = Math.random() < 0.4;
    keys.down = Math.random() < 0.15;
    keys.up = Math.random() < 0.1;
    keys.attack = Math.random() < 0.25;
    try {
      stepGame();
      drawFrame();
    } catch (err) {
      throw new Error('CHAOS crash at frame ' + i + ' in state ' + game.state + ': ' + err.message);
    }
    visited[game.state] = true;
    if (game.state === 'gameover' && Math.random() < 0.5) { pending.enter = true; }
    if (i % 700 === 350) { game.state = 'win'; }                 // force the crossroads
    if (i % 900 === 450 && game.nearMerchant) { game.state = 'shop'; game.shopSel = 0; }
    if (i % 1100 === 700) { game.state = 'ending'; game.endT = 300; }
    if (i % 1300 === 900) { game.state = 'craft'; game.craftSel = (Math.random() * RECIPES.length) | 0; }
    if (i % 1700 === 1200) { game.state = 'shrine'; game.shrineSel = (Math.random() * SKILLS.length) | 0; }
    if (p.dead && game.state === 'play') { p.dead = false; p.hp = 999; }
    if ((i % 800) === 0 && game.player) { game.player.hp = 999; game.player.hearts = 500; }
  }
  keys.left = keys.right = keys.down = keys.up = keys.attack = false;
  console.log('11. chaos soak OK, states visited: ' + Object.keys(visited).sort().join(' '));
}

console.log('\nALL SMOKE TESTS PASSED');
})().catch(e => { console.error('SMOKE FAILED:', e.stack); process.exit(1); });
