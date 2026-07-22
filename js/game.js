// Game orchestration: input, state machine, spawning, combat, camera, loop.

// Main game: loop, input, states, camera, spawning, collision, HUD.

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// ---------------------------------------------------------------- input
const keys = {};
const pending = { jump: false, whip: false, dash: false, enter: false, up: false, downN: false, leftN: false, rightN: false, q: false, crash: false, inv: false, map: false, rush: false, beast: false, feats: false, daily: false, cont: false, weap: -1, markSpot: false, erase: false };

const KEYMAP = {
  ArrowLeft: 'left', a: 'left',
  ArrowRight: 'right', d: 'right',
  ArrowUp: 'up', w: 'up',
  ArrowDown: 'down', s: 'down',
};

window.addEventListener('keydown', e => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
  AudioSys.resume();
  if (KEYMAP[k]) keys[KEYMAP[k]] = true;
  if (k === 'z' || k === 'j') keys.attack = true;
  if (!e.repeat) {
    if (k === 'x' || k === 'k' || k === ' ') pending.jump = true;
    if (k === 'z' || k === 'j') pending.whip = true;
    if (k === 'c' || k === 'l') pending.dash = true;
    if (k === 'Enter') pending.enter = true;
    if (k === 'ArrowUp' || k === 'w') pending.up = true;
    if (k === 'ArrowDown' || k === 's') pending.downN = true;
    if (k === 'ArrowLeft' || k === 'a') pending.leftN = true;
    if (k === 'ArrowRight' || k === 'd') pending.rightN = true;
    if (k === 'q') pending.q = true;
    if (k === 'e') pending.crash = true;
    if (k === 'i') pending.inv = true;
    if (k === 'v' || e.key === 'Tab') { pending.map = true; e.preventDefault(); }
    if (k === 'b') pending.rush = true;
    if (k === 'n') pending.beast = true;
    if (k >= '1' && k <= '9') pending.weap = k.charCodeAt(0) - 49;   // one key per weapon, all seven
    if (k === 'f') pending.feats = true;
    if (k === 'g') pending.markSpot = true;
    if (e.key === 'Delete') pending.erase = true;
    if (k === 'y') pending.daily = true;
    if (k === 'r') pending.cont = true;
    if (e.key === 'F3') { game.debug = !game.debug; e.preventDefault(); }
    if (k === 'm') AudioSys.toggleMusic();
    if (k === '[' || k === ']') {
      game.volVal = AudioSys.setVolume(k === '[' ? -0.1 : 0.1);
      game.volToastT = 90;
    }
  }
});
window.addEventListener('keyup', e => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (KEYMAP[k]) keys[KEYMAP[k]] = false;
  if (k === 'z' || k === 'j') keys.attack = false;
});

// ---------------------------------------------------------------- gamepad
const gpState = { left: false, right: false, up: false, down: false, attack: false };
let gpPrev = {};
function pollGamepad() {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
  const gp = navigator.getGamepads()[0];
  if (!gp) return;
  const b = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
  const edge = (name, on) => {
    const was = gpPrev[name];
    gpPrev[name] = on;
    return on && !was;
  };
  gpState.left = b(14) || gp.axes[0] < -0.4;
  gpState.right = b(15) || gp.axes[0] > 0.4;
  gpState.down = b(13) || gp.axes[1] > 0.5;
  gpState.up = b(12) || gp.axes[1] < -0.5;
  gpState.attack = b(2);
  if (edge('jump', b(0))) { pending.jump = true; AudioSys.resume(); }
  if (edge('attack', b(2))) pending.whip = true;
  if (edge('dash', b(1))) pending.dash = true;
  if (edge('start', b(9))) pending.enter = true;
  if (edge('cards', b(4) || b(3))) pending.q = true;
  if (edge('crash', b(5))) pending.crash = true;
  if (edge('inv', b(6) || b(7))) pending.inv = true;
  if (edge('map', b(8))) pending.map = true;
  if (edge('upEdge', gpState.up)) pending.up = true;
  if (edge('downEdge', gpState.down)) pending.downN = true;
  if (edge('leftEdge', gpState.left)) pending.leftN = true;
  if (edge('rightEdge', gpState.right)) pending.rightN = true;
}

// ---------------------------------------------------------------- game state
const game = {
  state: 'title',        // title | play | pause | dying | gameover | win
  time: 0,
  score: 0,
  hitstop: 0,
  shake: 0,
  camX: 0, camY: 0,
  player: null,
  enemies: [],
  candles: [],
  pickups: [],
  boss: null,
  bossActive: false,
  bossPrevState: 'idle',
  bossPrevDead: false,
  gateClosed: false,
  gateAnim: 0,
  victoryOrb: null,
  zoneTimers: [],
  medusaTimers: [],
  stageBanner: 0,
  dyingT: 0,
  projectiles: [],
  enemyProjectiles: [],
  secretHits: {},
  secretSwing: {},
  oreHits: {},
  oreSwing: {},
  familiar: null,
  stats: { kills: 0, candles: 0, items: 0, souls: 0 },
  card: null,          // {icon, title, desc, t}
  shrineSel: 0,
  nearShrine: null,
  stage: 1,
  mode: 'normal',      // normal | rush
  rushIndex: 0,
  rushT: 0,
  watchFlash: 0,
  crashCd: 0,
  crashFlash: 0,
  vampQ: 0,
  cardSel: { col: 0, row: 0 },
  relicSel: 0,
  craftSel: 0,
  forgeMode: false,
  forgeMark: -1,

  marks: [],            // the hunter's own scratches on the chart
  combo: { n: 0, t: 0 },
  curses: [],
  path: null,           // the road chosen at the crossroads
  pathSel: 0,
  pathOffer: [],
  warpSel: 0,
  featT: 0,
  featQueue: [],
  loreSeen: [],
  daily: false,
  bossHitless: true,
  cursed(k) { return this.curses.indexOf(k) >= 0; },

  // roll an elemental variant onto a freshly spawned fiend
  applyVariant(e) {
    const chance = Math.min(0.5, 0.08 + (this.stage - 1) * 0.07);
    if (Math.random() < chance) {
      const v = ENEMY_VARIANTS[1 + ((Math.random() * (ENEMY_VARIANTS.length - 1)) | 0)];
      e.variant = v;
      e.hp = Math.ceil(e.hp * v.hpMul);
      e.contactDmg += v.dmgAdd;
      e.scoreVal = Math.round(e.scoreVal * v.scoreMul);
      if (v.shield) e.shieldHits = v.shield;
    }
    if (this.cursed('ironfoes')) e.hp += 2;
    return e;
  },

  bestKey(e) {
    let k = e.constructor.name;
    if (e.knight) k = 'ZombieK';
    if (e.blood) k = 'BatB';
    return k;
  },

  // last rites: bestiary count + whatever the variant leaves behind
  recordKill(e) {
    if (!e) return;
    const key = this.bestKey(e) + (e.variant ? ':' + e.variant.key : '');
    meta.bestiary = meta.bestiary || {};
    meta.bestiary[key] = (meta.bestiary[key] || 0) + 1;
    const v = e.variant;
    if (!v) return;
    const hb = e.hitbox ? e.hitbox() : { x: e.x, y: e.y, w: 10, h: 10 };
    const cx = hb.x + hb.w / 2, cy = hb.y + hb.h / 2;
    spawnFloater(cx, cy - 14, v.name, v.color);
    if (v.explodes) {
      for (const vx of [-1.4, 1.4]) {
        this.enemyProjectiles.push(new EnemyFireball(cx - 7, cy - 6, vx, -2.2));
      }
    }
    if (v.firepool) this.projectiles.push(new FirePool(cx, Math.ceil((cy + 8) / TILE) * TILE));
    if (v.gilded) {
      for (let i = 0; i < 3; i++) this.pickups.push(new Pickup(cx - 8 + i * 8, cy - 6, 'gem'));
    }
    if (v.chills) {
      for (const o of this.enemies) {
        if (!o.remove && o !== e && o.frozen !== undefined &&
            Math.abs(o.x - cx) < 60 && Math.abs(o.y - cy) < 50) o.frozen = Math.max(o.frozen, 60);
      }
      burstRing(cx, cy, '#6ab0f0');
    }
  },

  addScore(n) { this.score += n; },
  comboMult() { return 1 + Math.min(3, (this.combo.n / 3) | 0); },
  addKillScore(n, e) {
    this.recordKill(e);
    const greed = 1 + 0.2 * Math.min(4, this.player ? this.player.relicStat('greed') : 0);
    this.score += Math.round(n * this.comboMult() * greed);
    this.stats.kills++;
    this.combo.n++;
    this.combo.t = 200 + 40 * (this.player ? this.player.perkRank('momentum') : 0);
    if (this.player && this.player.relicStat('vamp') > 0 &&
        Math.random() < 0.1 * Math.min(4, this.player.relicStat('vamp'))) {
      this.player.heal(1);
      spawnFloater(this.player.x + 4, this.player.y - 8, '+1', '#e04858');
    }
    if (this.player && e && !this.player.dead) {
      // deeper fiends teach more; bosses teach a great deal
      this.player.gainXp(Math.max(1, Math.round(n / 40)));
      // second wind: the first kill in a scene closes one wound
      if (this.player.skills.secondwind && !this.windThisScene &&
          this.player.hp < this.player.maxHpTotal()) {
        this.windThisScene = true;
        this.player.heal(1);
        spawnFloater(this.player.x + 4, this.player.y - 14, 'SECOND WIND', '#8ad0a0');
      }
    }
  },
  makeElite(e) {
    if (this.stage < 2 || Math.random() > 0.1) return e;
    e.elite = true;
    e.hp = Math.ceil(e.hp * 2.5);
    e.contactDmg += 1;
    e.scoreVal *= 3;
    return e;
  },
  addShake(n) { this.shake = Math.max(this.shake, n); },
  // One entry point for every drop in the game. Sources roll a weighted
  // table; luck relics tilt the odds toward the precious rows.
  dropLoot(x, y, tableName, ctx) {
    const table = LOOT_TABLES[tableName];
    if (!table) return;
    const luck = 1 + 0.25 * Math.min(4, this.player ? this.player.relicStat('luck') : 0);
    let sum = 0;
    const rows = table.map(([kind, wt]) => {
      const w = wt * (PRECIOUS[kind] ? luck : 1);
      sum += w;
      return [kind, w];
    });
    let r = Math.random() * sum, kind = null;
    for (const [k, w] of rows) { r -= w; if (r <= 0) { kind = k; break; } }
    if (!kind) return;
    if (kind === 'heart' && this.cursed('miser') && Math.random() < 0.5) return;
    if (kind === 'sub') {
      kind = SUB_KEYS[(Math.random() * SUB_KEYS.length) | 0];
    } else if (kind === 'soul') {
      const fam = ctx && ctx.family;
      kind = fam === 'zombie' ? 'soulZ' : fam === 'bat' ? 'soulB' : fam === 'medusa' ? 'soulM'
        : ['soulZ', 'soulB', 'soulM'][(Math.random() * 3) | 0];
    } else if (kind === 'card') {
      const pool = CARD_ACTIONS.concat(CARD_ATTRS).filter(k => !this.player.cards[k]);
      kind = pool.length ? 'card_' + pool[(Math.random() * pool.length) | 0] : 'gem';
    } else if (kind === 'relic') {
      this.dropRelic(x, y, ((ctx && ctx.bias) || 0) + this.stage * 0.12);
      return;
    } else if (kind === 'buff') {
      kind = BUFF_KEYS[(Math.random() * BUFF_KEYS.length) | 0];
    } else if (kind === 'weapon') {
      const pool = WEAPON_KEYS.filter(k => !this.player.weapons[k]);
      if (!pool.length) { kind = 'gem'; }
      else kind = 'weap_' + pool[(Math.random() * pool.length) | 0];
    }
    this.pickups.push(new Pickup(x, y - 4, kind));
  },

  // legacy entry points kept thin so every caller funnels through dropLoot
  maybeDrop(x, y) { this.dropLoot(x, y, 'enemy'); },
  dropRelic(x, y, bias) {
    const relic = rollRelic(bias || 0);
    this.pickups.push(new Pickup(x, y - 4, 'relic', relic));
    if (relic.tier >= 4) {
      spawnFloater(x, y - 16, RARITY[relic.tier].name + '!', RARITY[relic.tier].color);
      burst(x, y - 6, [RARITY[relic.tier].color, '#f8f8ff'], 12, 1.4, -0.02);
    }
  },
  dropSoul(family, x, y, forced) {
    this.dropLoot(x, y, forced ? 'elite' : 'enemy', { family });
  },

  giveRelic(r) {
    const p = this.player;
    if (p.bag.length >= 8) {
      meta.essence += r.tier * 2;
      saveMeta();
      spawnFloater(p.x + p.w / 2, p.y - 10, 'SATCHEL FULL +' + (r.tier * 2) + ' ESSENCE', '#c07af0');
      AudioSys.sfxPickup();
      return;
    }
    p.bag.push(r);
    this.stats.items++;
    this.showCard(relicIcon(r), relicName(r), relicStatsText(r) + '   PRESS I');
    AudioSys.sfxSoul();
  },

  // feats: quiet, permanent marks of what the hunter has done
  feat(key) {
    if (!FEATS[key] || meta.feats[key]) return;
    meta.feats[key] = 1;
    meta.essence += 5;
    saveMeta();
    this.featQueue.push(key);
    AudioSys.sfxItem();
  },
  checkFeats() {
    const p = this.player;
    if (!p) return;
    if (this.stats.kills >= 1) this.feat('firstblood');
    if (meta.kills + this.stats.kills >= 100) this.feat('centurion');
    if (meta.kills + this.stats.kills >= 1000) this.feat('legion');
    if (this.comboMult() >= 4) this.feat('comboiv');
    if (CARD_ACTIONS.concat(CARD_ATTRS).every(k => p.cards[k])) this.feat('allcards');
    if (p.whipLvl >= 3) this.feat('blade3');
    if (p.maxHp > 20 && p.extraJumps >= 1 && p.gaze) this.feat('allsouls');
    if (this.stage >= 4) this.feat('deep4');
    if (this.stage >= 7) this.feat('deep7');
    if (p.bag.length >= 8) this.feat('packrat');
    if (p.bag.concat(p.relics).some(r => r && r.tier >= 5)) this.feat('legendary');
    if (meta.glimmers >= 5) this.feat('digger');
    if (meta.walls >= 5) this.feat('mason');
    if (WEAPON_KEYS.filter(k => p.weapons[k]).length >= 4) this.feat('armory');
    if (Object.keys(meta.pairs || {}).length >= 10) this.feat('arcanist');
  },

  showCard(icon, title, desc) {
    this.card = { icon, title, desc, t: 150 };
  },

  giveItem(kind, x, y) {
    const p = this.player;
    if (kind.startsWith('weap_')) {
      const key = kind.slice(5);
      const def = WEAPONS[key];
      if (!def) return;
      const isNew = !p.weapons[key];
      p.weapons[key] = true;
      if (isNew) {
        meta.weapons[key] = 1;
        saveMeta();
        this.stats.items++;
        p.switchWeapon(key);
        this.showCard(weaponIcon(key), def.name, def.desc + '   PRESS 1-5');
        AudioSys.sfxItem();
        burst(x, y, ['#d8a848', '#f8f8ff'], 12, 1.4, -0.02);
      } else {
        this.addScore(400);
        AudioSys.sfxPickup();
      }
      return;
    }
    if (kind.startsWith('card_')) {
      const key = kind.slice(5);
      p.cards[key] = true;
      const isAction = key === 'mercury' || key === 'mars';
      if (isAction && !p.cardAction) p.cardAction = key;
      if (!isAction && !p.cardAttr) p.cardAttr = key;
      this.stats.items++;
      this.showCard(cardIcon(key), 'ARCANA: ' + CARD_NAME[key], 'PRESS Q TO BIND CARDS');
      AudioSys.sfxSoul();
      burst(x, y, ['#d8a848', '#f8f8ff'], 10, 1.2, -0.02);
      return;
    }
    if (kind === 'whip') {
      if (p.whipLvl < 3) {
        p.whipLvl++;
        this.stats.items++;
        this.showCard(Sprites.whipItem,
          p.whipLvl === 2 ? 'TEMPERED EDGE' : 'MOONFANG BLADE',
          p.whipLvl === 2 ? 'THE BLADE REACHES FARTHER' : 'BLESSED STEEL OF THE MOON');
        AudioSys.sfxItem();
      } else { this.addScore(500); AudioSys.sfxPickup(); }
    } else if (SUBWEAPONS[kind]) {
      if (p.subWeapon === kind) { this.addScore(200); AudioSys.sfxPickup(); return; }
      p.subWeapon = kind;
      this.stats.items++;
      const def = SUBWEAPONS[kind];
      this.showCard(def.icon(), def.name, def.desc);
      AudioSys.sfxItem();
    } else if (kind === 'soulZ') {
      p.maxHp += 4; p.heal(4);
      this.stats.souls++;
      this.showCard(Sprites.iconVessel, 'ROT VESSEL SOUL', 'MAX HEALTH +4');
      AudioSys.sfxSoul();
      burst(x, y, ['#6ab0f0', '#f8f8ff'], 10, 1.2, -0.02);
    } else if (kind === 'soulB') {
      if (p.extraJumps < 2) p.extraJumps++;
      this.stats.souls++;
      this.showCard(Sprites.iconWing, 'WING SOUL',
        p.extraJumps < 2 ? 'AIR JUMPS +1' : 'AIR JUMPS +1 (MAX)');
      AudioSys.sfxSoul();
      burst(x, y, ['#6ab0f0', '#f8f8ff'], 10, 1.2, -0.02);
    } else if (kind === 'soulM') {
      if (!p.gaze) {
        p.gaze = true;
        this.showCard(Sprites.iconEye, 'STONE GAZE SOUL', 'YOUR BLADE MAY PETRIFY');
      } else {
        this.addScore(500);
        this.showCard(Sprites.iconEye, 'STONE GAZE SOUL', 'ITS POWER ECHOES. +500');
      }
      this.stats.souls++;
      AudioSys.sfxSoul();
      burst(x, y, ['#6ab0f0', '#f8f8ff'], 10, 1.2, -0.02);
    }
  },
};

// ---------------------------------------------------------------- best score
let hiScore = 0;
try { hiScore = parseInt(localStorage.getItem('moonfang-hi') || '0', 10) || 0; } catch (e) {}
function saveHiScore() {
  if (game.score > hiScore) {
    hiScore = game.score;
    try { localStorage.setItem('moonfang-hi', String(hiScore)); } catch (e) {}
  }
}

const RUSH_BOSSES = () => [GiantBat, NightmareBoss, HellBeastBoss];

function startRush() {
  game.mode = 'rush';
  game.stage = 1;
  game.rushIndex = 0;
  game.rushT = 0;
  buildRushLevel();
  particles.length = 0;
  game.player = new Player(60, 12 * TILE - 27);
  game.player.whipLvl = 2;
  game.player.hearts = 25;
  game.player.subWeapon = 'knife';
  game.player.skills.slide = true;
  game.player.skills.dash = true;
  game.enemies = [];
  game.candles = Level.candles.map(c => new Candle(c));
  game.pickups = [];
  game.projectiles = [];
  game.enemyProjectiles = [];
  game.boss = new GiantBat(Level.boss);
  game.bossActive = true;
  game.boss.start();
  game.bossPrevDead = false;
  game.gateClosed = false;
  game.gateAnim = 0;
  game.victoryOrb = null;
  game.score = 0;
  game.stats = { kills: 0, candles: 0, items: 0, souls: 0 };
  game.secretsFound = 0;
  game.zoneTimers = [];
  game.medusaTimers = [];
  game.stageBanner = 0;
  game.card = null;
  game.combo.n = 0; game.combo.t = 0;
  game.ghostTimer = 1e9;
  game.fadeT = 30;
  game.explored = new Uint8Array(LEVEL_W * LEVEL_H);
  game.secretHits = {}; game.secretSwing = {};
  game.oreHits = {}; game.oreSwing = {};
  floaters.length = 0;
  initMotes();
  weather.drops.length = 0; weather.flashT = 0; weather.bolt = null;
  weather.thunderIn = -1;
  game.camX = 0; game.camY = 64; game.camLead = 0;
  AudioSys.setBossTempo(true);
}

function fmtTime(frames) {
  const s = frames / 60;
  const m = (s / 60) | 0;
  return m + ':' + String((s % 60).toFixed(1)).padStart(4, '0');
}

function resetGame(nextStage) {
  game.mode = 'normal';
  if (!nextStage) game.curses = [];
  buildLevel(game.worldSeed || 1);
  particles.length = 0;
  const old = nextStage ? game.player : null;
  const startRow = (Level.zones && Level.zones[0]) ? Level.zones[0].row : 12;
  game.player = new Player(40, startRow * TILE - 27);
  if (old) {
    for (const k of ['hp', 'maxHp', 'hearts', 'whipLvl', 'subWeapon', 'extraJumps',
      'gaze', 'skills', 'cards', 'cardAction', 'cardAttr', 'windUsed', 'relics', 'bag', 'keys', 'perks', 'subInfusion', 'gems',
      'weapon', 'weapons', 'materials', 'level', 'xp', 'xpNext', 'gifts']) {
      game.player[k] = old[k];
    }
  } else {
    // blessings earned in past hunts
    for (const u of META_UNLOCKS) if (meta.bestStage >= u.stage) u.apply(game.player);
  }
  game.enemies = Level.bats.map(b => {
    const bat = new Bat(b.x, b.y);
    if (game.stage >= 2 && Math.random() < 0.25) { bat.blood = true; bat.hp += 1; }
    return game.applyVariant(game.makeElite(bat));
  })
    .concat(Level.hounds.map(h => game.applyVariant(game.makeElite(new HellHound(h.x, h.y)))))
    .concat(Level.wolves.map(w => game.applyVariant(game.makeElite(new MoonWolf(w.x, w.y)))))
    .concat((Level.gargoyles || []).map(gy => game.applyVariant(game.makeElite(new Gargoyle(gy.x, gy.y)))))
    .concat((Level.throwers || []).map(t2 => game.applyVariant(game.makeElite(new BoneThrower(t2.x, t2.y)))))
    .concat((Level.spiders || []).map(sp => game.applyVariant(game.makeElite(new Spider(sp.x, sp.y)))))
    .concat((Level.robedZombies || []).map(rz => game.applyVariant(game.makeElite(new RobedZombie(rz.x, rz.y)))))
    .concat((Level.hellCats || []).map(hc => game.applyVariant(game.makeElite(new HellCat(hc.x, hc.y)))))
    .concat((Level.bogThings || []).map(bt => game.applyVariant(game.makeElite(new BogThing(bt.x, bt.y)))))
    .concat((Level.wraiths || []).map(wr => game.applyVariant(game.makeElite(new Wraith(wr.x, wr.y)))))
    .concat((Level.plagueRats || []).map(pr => game.applyVariant(game.makeElite(new PlagueRat(pr.x, pr.y)))))
    .concat((Level.caveCrawlers || []).map(cc => game.applyVariant(game.makeElite(new CaveCrawler(cc.x, cc.y)))));
  game.candles = Level.candles.map(c => new Candle(c));
  game.pickups = [];
  // pre-placed treasure in gated corners of the castle
  for (const t of Level.treasures) {
    const pk = new Pickup(t.x, t.y, t.kind, t.data);
    pk.life = 1e9;
    pk.grounded = true;
    game.pickups.push(pk);
  }
      // one guardian per hall, each waiting in its own zone
      const BOSS_CLASS = { GiantBat, NightmareBoss, HellBeastBoss, FinalBoss, DragonGuardian };
      game.guardians = (Level.bosses || []).map(def => {
        const Cls = BOSS_CLASS[def.cls] || GiantBat;
    const b = new Cls(def);
    b.arena = def;
    b.reward = def.reward;
    return b;
  });
  game.boss = game.guardians[0] || null;
  game.bossHitless = true;
  game.bossActive = false;
  game.bossPrevState = 'idle';
  game.bossPrevDead = false;
  game.gateClosed = false;
  game.gateAnim = 0;
  game.victoryOrb = null;
  if (!nextStage) { game.score = 0; game.vampQ = 0; }
  game.zoneTimers = Level.zombieZones.map(() => 40);
  game.medusaTimers = Level.medusaZones.map(() => 60);
  game.stageBanner = 180;
  game.dyingT = 0;
  game.camX = 0; game.camY = 64; game.camLead = 0;
  game.projectiles = [];
  game.enemyProjectiles = [];
  game.secretHits = {};
  game.secretSwing = {};
  game.oreHits = {};
  game.oreSwing = {};
  game.marks = [];
  game.scene = null; game.sceneCut = 0; game.sceneNameT = 0; game.camSnap = true;
  if (!nextStage) game.stats = { kills: 0, candles: 0, items: 0, souls: 0 };
  game.card = null;
  game.watchFlash = 0;
  game.combo.n = 0; game.combo.t = 0;
  game.ghostTimer = 700;
  game.fadeT = 30;
  game.shrineSel = 0;
  game.nearShrine = null;
  game.explored = new Uint8Array(LEVEL_W * LEVEL_H);
  floaters.length = 0;
  initMotes();
  weather.drops.length = 0;
  weather.flashT = 0;
  weather.bolt = null;
  weather.nextStrike = 200;
  weather.thunderIn = -1;
  AudioSys.setBossTempo(false);
}

// ---------------------------------------------------------------- gate
function setGate(closed, arena) {
  const A = arena || game.bossArena || Level.boss;
  if (!A) return;
  game.gateClosed = closed;
  game.gateArena = A;
  const gx = A.gateTX;
  const base = Math.floor(A.arenaY !== undefined ? A.arenaY : (A.homeY / TILE) + 7);
  for (let ty = Math.max(0, base - 7); ty <= base; ty++) tset(gx, ty, closed ? 1 : 0);
}

function drawGate(g, camX, camY) {
  const A = game.gateArena || game.bossArena || Level.boss;
  if (!A) return;
  const gx = A.gateTX * TILE - camX;
  if (gx < -20 || gx > VIEW_W + 20) return;
  const base = Math.floor(A.homeY / TILE) + 7;
  const topY = (base - 7) * TILE - camY;
  const fullH = 7 * TILE;
  const h = game.gateClosed ? Math.min(fullH, game.gateAnim * 14) : Math.max(0, 10 - game.gateAnim * 6);
  if (h <= 0) return;
  g.fillStyle = '#1c1c2c';
  g.fillRect(gx, topY, TILE, h);
  g.fillStyle = '#56566a';
  for (let bx = 2; bx < TILE; bx += 4) g.fillRect(gx + bx, topY, 2, h);
  for (let by = 6; by < h; by += 12) { g.fillStyle = '#3c3c50'; g.fillRect(gx, topY + by, TILE, 2); }
  g.fillStyle = '#6a6a80';
  for (let bx = 2; bx < TILE; bx += 4) g.fillRect(gx + bx, topY + h - 4, 2, 4);
}

// ---------------------------------------------------------------- spawning
function updateSpawners() {
  const p = game.player;

  Level.zombieZones.forEach((z, i) => {
    const inZone = p.x > z.x0 - 80 && p.x < z.x1 + 80;
    if (!inZone) return;
    const alive = game.enemies.filter(e => e instanceof Zombie && e.zone === i && !e.remove).length;
    if (alive >= z.max + (game.cursed('swarm') ? 1 : 0)) return;
    if (--game.zoneTimers[i] > 0) return;
    game.zoneTimers[i] = 150 + Math.random() * 120;
    const cands = [game.camX - 24, game.camX + VIEW_W + 24]
      .filter(x => x > z.x0 && x < z.x1 && Math.abs(x - p.x) > 60);
    let x;
    if (cands.length) x = cands[(Math.random() * cands.length) | 0];
    else {
      x = z.x0 + Math.random() * (z.x1 - z.x0);
      if (Math.abs(x - p.x) < 70) return;
    }
    const zb = game.makeElite(new Zombie(x, z.groundY));
    if (game.stage >= 2 && !zb.elite && Math.random() < 0.2) {
      zb.knight = true;
      zb.hp = Math.ceil(zb.hp * 2);
      zb.scoreVal *= 2;
    }
    zb.zone = i;
    game.applyVariant(zb);
    game.enemies.push(zb);
  });

  Level.medusaZones.forEach((z, i) => {
    const inZone = p.x > z.x0 && p.x < z.x1;
    if (!inZone) return;
    if (--game.medusaTimers[i] > 0) return;
    game.medusaTimers[i] = 100 + Math.random() * 50;
    const count = game.enemies.filter(e => e instanceof MedusaHead && !e.remove).length;
    if (count >= 4) return;
    const ahead = Math.random() < 0.75;
    const sx = (p.facing > 0) === ahead ? game.camX + VIEW_W + 8 : game.camX - 14;
    const dir = sx > p.x ? -1 : 1;
    const sy = Math.max(40, Math.min(Level.pxH - 50, p.y - 6));
    game.enemies.push(game.applyVariant(game.makeElite(new MedusaHead(sx, sy, dir))));
  });
}

// ---------------------------------------------------------------- combat
function handleCombat() {
  const p = game.player;
  const whip = p.getWhipHitbox();

  const targets = game.enemies.slice();
  if (game.bossActive && !game.boss.dead) targets.push(game.boss);

  if (whip) {
    for (const e of targets) {
      if (e.remove || e.markSwing === p.swingId) continue;
      if (e instanceof Zombie && e.rise > 20) continue;
      if (e instanceof RobedZombie && e.rise > 20) continue;
      if (e instanceof Bat && e.state === 'gone') continue;
      if (e instanceof HellCat && e.state === 'gone') continue;
      if (e instanceof BogThing && e.state === 'gone') continue;
      if (overlap(whip, e.hitbox())) {
        e.markSwing = p.swingId;
        let dealt = whip.dmg;
        // what the weapon itself does, quite apart from any arcana
        const wd = whip.wd;
        if (wd && wd.holy && (e instanceof Zombie || e instanceof Ghost ||
            e instanceof BoneThrower || e instanceof RobedZombie ||
            e instanceof Wraith)) dealt += 3;
        // warded variants shrug off the first blows
        if (e.shieldHits > 0) {
          e.shieldHits--;
          if (!p.skills.ironjaw) dealt = 1;
          burstRing(e.hitbox().x + 6, e.hitbox().y + 6, '#b8c0cc');
        }
        // cruelty: critical strikes
        if (p.perkRank('cruelty') && Math.random() < 0.05 * p.perkRank('cruelty')) {
          dealt *= 2;
          spawnFloater(e.hitbox().x + 6, e.hitbox().y - 12, 'CRIT', '#ffe080');
        }
        // sanctified logic lives on the infusion; holy arcana bonus vs undead
        if (e.hurt(dealt)) {
          if ((e instanceof Zombie && !e.knight) || e instanceof HellHound) e.x += p.facing * 4;
          game.hitstop = 2;
          const hb = e.hitbox();
          const hx = Math.max(whip.x, hb.x) + 2;
          // elemental hit FX: the weapon's nature shows in the sparks it throws
          if (wd && wd.burns) fireHit(hx, whip.y + 3);
          else if (wd && wd.chills) frostHit(hx, whip.y + 3);
          else if (wd && wd.holy) holyHit(hx, whip.y + 3);
          else if (wd && wd.venom) venomHit(hx, whip.y + 3);
          else if (wd && (wd.shadow || wd.short === 'VOID')) voidHit(hx, whip.y + 3);
          else if (wd && wd.chain) shockHit(hx, whip.y + 3);
          else burst(hx, whip.y + 3, ['#f8f8ff', '#ffe080'], 5, 1.2, 0);
          bloodBurst(hx, whip.y + 3, p.facing, e instanceof MedusaHead ? BLOOD_GREEN : BLOOD_RED);
          spawnFloater(hb.x + hb.w / 2, hb.y - 6, String(whip.dmg));
          if (wd && wd.chills && e !== game.boss && e.frozen !== undefined && e.hp > 0) {
            e.frozen = Math.max(e.frozen, 40);
            frostHit(hb.x + 6, hb.y + 6);
          }
          if (wd && wd.venom && e.hp > 0) e.poisoned = Math.max(e.poisoned || 0, 200);
          if (wd && wd.quake) {
            // the ground answers: everything near the blow is shaken loose
            game.addShake(5);
            burstRing(hb.x + hb.w / 2, hb.y + hb.h, '#c8b090');
            for (const o of targets) {
              if (o === e || o.remove || !o.hitbox || !o.hurt) continue;
              const ob = o.hitbox();
              if (Math.hypot(ob.x - hb.x, ob.y - hb.y) < 46) o.hurt(Math.ceil(dealt / 2));
            }
          }
          if (p.cardFx('freeze') && e !== game.boss && e.frozen !== undefined && e.hp > 0) {
            e.frozen = Math.max(e.frozen, 25);
          }
          if (p.cardFx('petrify') && e !== game.boss && e.frozen !== undefined && e.hp > 0 &&
              Math.random() < 0.22) {
            e.frozen = Math.max(e.frozen, 70);
            burstRing(hb.x + hb.w / 2, hb.y + hb.h / 2, '#b8c0cc');
          }
          if (p.cardFx('poison') && e.hp > 0) {
            e.poisoned = Math.max(e.poisoned || 0, 240);
          }
          if (p.cardFx('lifesteal')) {
            p.slashHits = (p.slashHits || 0) + 1;
            if (p.slashHits % p.cardFx('lifesteal') === 0) {
              p.heal(1);
              spawnFloater(p.x + p.w / 2, p.y - 8, '+1', '#8ad0a0');
            }
          }
          if (p.relicStat('chill') > 0 && e !== game.boss && e.frozen !== undefined && e.hp > 0 &&
              Math.random() < 0.1 * Math.min(4, p.relicStat('chill'))) {
            e.frozen = Math.max(e.frozen, 20);
          }
          if (p.relicStat('burn') > 0 && e.hp > 0 &&
              Math.random() < 0.12 * Math.min(4, p.relicStat('burn'))) {
            e.hurt(1);
            burst(hx, whip.y + 3, ['#ff9020', '#ffd858'], 4, 1, 0);
          }
          if (p.cardFx('burn') || (p.weaponDef().burns && e.hp > 0)) {
            burst(hx, whip.y + 3, ['#ff9020', '#ffd858'], 3, 1, 0);
            if (e.hp > 0 && (game.time & 7) === 0) e.hurt(1);
          }
          // storm edge: lightning leaps to a second fiend
          if (p.cardFx('chain')) {
            const other = targets.find(o => o !== e && !o.remove && o.hitbox &&
              Math.abs(o.hitbox().x - hb.x) < 90 && Math.abs(o.hitbox().y - hb.y) < 60);
            if (other && other.hurt) {
              other.hurt(1);
              const ob = other.hitbox();
              spawnFloater(ob.x + ob.w / 2, ob.y - 6, '1', '#c07af0');
              burstRing(ob.x + ob.w / 2, ob.y + ob.h / 2, '#c07af0');
            }
          }
          // moon edge: every third slash looses a small wave
          if (p.cardFx('waveEvery')) {
            p.slashCount = (p.slashCount || 0) + 1;
            if (p.slashCount % p.cardFx('waveEvery') === 0) {
              const wv = new CrescentWave(p.x + p.w / 2 + p.facing * 8, p.y + 12, p.facing);
              wv.dmg = 2;
              game.projectiles.push(wv);
            }
          }
          // stone gaze: whip strikes may petrify lesser creatures
          if (p.gaze && e !== game.boss && e.hp > 0 && Math.random() < 0.2) {
            e.frozen = 80;
            spawnFloater(hb.x + hb.w / 2, hb.y - 13, 'PETRIFY', '#ffe080');
            AudioSys.sfxPetrify();
            burstRing(hb.x + hb.w / 2, hb.y + hb.h / 2, '#b8c0cc');
          }
          // blood price: the weapon drinks from its wielder
          if (wd && wd.bloodprice && !p.swingPaid) {
            p.swingPaid = true;
            if (p.hp > 1) p.hp -= wd.bloodprice;
            spawnFloater(p.x + p.w / 2, p.y - 8, 'BLOOD PRICE', '#d02030');
          }
          // storm chain: weapon's own lightning leaps
          if (wd && wd.chain) {
            const other = targets.find(o => o !== e && !o.remove && o.hitbox &&
              Math.abs(o.hitbox().x - hb.x) < 90 && Math.abs(o.hitbox().y - hb.y) < 60);
            if (other && other.hurt) {
              other.hurt(1);
              const ob = other.hitbox();
              spawnFloater(ob.x + ob.w / 2, ob.y - 6, '1', '#c07af0');
              burstRing(ob.x + ob.w / 2, ob.y + ob.h / 2, '#c07af0');
            }
          }
          // double tap: the twin blades hit twice
          if (wd && wd.doubletap && !e.markDoubleTap) {
            e.markDoubleTap = true;
            if (e.hurt(Math.ceil(dealt * 0.6))) {
              spawnFloater(hb.x + hb.w / 2, hb.y - 10, String(Math.ceil(dealt * 0.6)));
              burst(hb.x + 6, hb.y + 6, ['#ff8040'], 3, 0.8, 0);
            }
          }
        }
      }
    }
    for (const c of game.candles) {
      if (!c.broken && overlap(whip, c.hitbox())) c.smash();
    }
    // hidden masonry cracks under the blade
    const tx0 = Math.floor(whip.x / TILE), tx1 = Math.floor((whip.x + whip.w) / TILE);
    const ty0 = Math.floor(whip.y / TILE), ty1 = Math.floor((whip.y + whip.h) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const tid = tileAt(tx, ty);
      // ore veins: strike them out of the wall. Heavy weapons bite deeper.
      if (tid === 13) {
        const okey = tx + ',' + ty;
        if (game.oreSwing[okey] === p.swingId) continue;
        game.oreSwing[okey] = p.swingId;
        const wd = p.weaponDef();
        const bite = (wd.short === 'AXE' || wd.short === 'SCYTHE' ? 2 : 1) +
          (p.skills.prospector ? 1 : 0) + (p.skills.forgehand ? 1 : 0);
        game.oreHits[okey] = (game.oreHits[okey] || 0) + bite;
        if (!Level.oreKind) Level.oreKind = {};
        if (!Level.oreKind[okey]) Level.oreKind[okey] = veinRoll(game.stage);
        const mat = MATERIALS[Level.oreKind[okey]];
        burst(tx * TILE + 8, ty * TILE + 8, [mat.color, '#8f8c9e'], 5, 1.2, 0.08);
        AudioSys.sfxHit();
        if (game.oreHits[okey] >= 3) {
          tset(tx, ty, 0);
          const yield2 = 1 + (Math.random() < 0.35 ? 1 : 0) + (p.skills.prospector ? 1 : 0) +
            (p.skills.forgehand ? 1 : 0);
          p.materials[Level.oreKind[okey]] = (p.materials[Level.oreKind[okey]] || 0) + yield2;
          burst(tx * TILE + 8, ty * TILE + 8, [mat.color, '#f8f8ff'], 16, 1.8, 0.05);
          spawnFloater(tx * TILE + 8, ty * TILE - 4, '+' + yield2 + ' ' + mat.short, mat.color);
          game.addShake(2);
          AudioSys.sfxItem();
          game.stats.ore = (game.stats.ore || 0) + yield2;
          meta.ore = (meta.ore || 0) + yield2;
          saveMeta();
          game.feat('miner');
        }
        continue;
      }
      if (tid !== 10) continue;
      // some walls are thin rather than false: no blade opens them, only the mist
      const mistDoor = (Level.secrets || []).find(sc =>
        sc.kind === 'mist' && sc.entrance.tx === tx && Math.abs(sc.entrance.ty - ty) <= 1);
      if (mistDoor) {
        if (!p.skills.mist) {
          if ((game.time & 15) === 0) {
            spawnFloater(tx * TILE + 8, ty * TILE - 4, 'IT WILL NOT BREAK', '#8a83a8');
          }
          continue;
        }
        for (let dy = mistDoor.ty0; dy <= mistDoor.ty1 + 1; dy++) {
          if (tileAt(tx, dy) === 10) tset(tx, dy, 0);
        }
        burstRing(tx * TILE + 8, ty * TILE + 8, '#c0b0f0');
        AudioSys.sfxCandle();
        spawnFloater(tx * TILE + 8, ty * TILE - 4, 'THE MIST PARTS', '#c0b0f0');
        continue;
      }
      const key = tx + ',' + ty;
      if (game.secretSwing[key] === p.swingId) continue;
      game.secretSwing[key] = p.swingId;
      game.secretHits[key] = (game.secretHits[key] || 0) + 1;
      burst(tx * TILE + 8, ty * TILE + 8, ['#52526e', '#8f8c9e'], 5, 1.2, 0.08);
      AudioSys.sfxHit();
      if (game.secretHits[key] >= 3) {
        tset(tx, ty, 0);
        burst(tx * TILE + 8, ty * TILE + 8, ['#52526e', '#8f8c9e', '#3e3e58'], 16, 1.8, 0.08);
        game.addShake(3);
        AudioSys.sfxCandle();
        game.dropLoot(tx * TILE + 8, ty * TILE + 8, 'secret');
        spawnFloater(tx * TILE + 8, ty * TILE - 4, 'SECRET', '#ffe080');
        game.stats.items++;
        meta.walls = (meta.walls || 0) + 1; saveMeta();
      }
    }
  }

  // moonlit plunge: crash down onto fiends and rebound
  const plunge = p.getPlungeHitbox();
  if (plunge) {
    for (const e of targets) {
      if (e.remove || e.markPlunge === p.plungeId) continue;
      if (e instanceof Zombie && e.rise > 20) continue;
      if (e instanceof RobedZombie && e.rise > 20) continue;
      if (e instanceof Bat && e.state === 'gone') continue;
      if (e instanceof HellHound && e.state === 'gone') continue;
      if (e instanceof HellCat && e.state === 'gone') continue;
      if (e instanceof BogThing && e.state === 'gone') continue;
      if (overlap(plunge, e.hitbox())) {
        e.markPlunge = p.plungeId;
        if (e.hurt(plunge.dmg)) {
          const hb = e.hitbox();
          bloodBurst(hb.x + hb.w / 2, hb.y + 4, 0);
          spawnFloater(hb.x + hb.w / 2, hb.y - 6, String(plunge.dmg));
          game.hitstop = 3;
          p.vy = -4.6;          // rebound off the kill
          p.plunging = false;
        }
      }
    }
  }

  // hunter slide kick
  const slide = p.getSlideHitbox();
  if (slide) {
    for (const e of targets) {
      if (e.remove || e.markSlide === p.slideId) continue;
      if (e instanceof Zombie && e.rise > 20) continue;
      if (e instanceof RobedZombie && e.rise > 20) continue;
      if (e instanceof Bat && e.state === 'gone') continue;
      if (e instanceof HellCat && e.state === 'gone') continue;
      if (e instanceof BogThing && e.state === 'gone') continue;
      if (overlap(slide, e.hitbox())) {
        e.markSlide = p.slideId;
        if (e.hurt(slide.dmg)) {
          const hb = e.hitbox();
          bloodBurst(hb.x + hb.w / 2, hb.y + hb.h - 8, p.facing);
          spawnFloater(hb.x + hb.w / 2, hb.y - 6, String(slide.dmg));
          game.hitstop = 2;
        }
      }
    }
    for (const c of game.candles) {
      if (!c.broken && overlap(slide, c.hitbox())) c.smash();
    }
  }

  // contact damage (petrified enemies are harmless statues)
  const pb = p.hitbox();
  for (const e of targets) {
    if (e.remove || e.frozen > 0) continue;
    if (e.state === 'gone') continue;                       // the slain bite no more
    if (e instanceof Zombie && e.rise > 0) continue;
    if (e instanceof Bat && e.state === 'perch') continue;
    if (e instanceof Ghost && e.state !== 'haunt') continue; // half-formed shades can't touch you
    if (e instanceof Wraith && e.state !== 'haunt') continue;
    if (e instanceof RobedZombie && e.rise > 0) continue;
    if (e instanceof PlagueRat && e.state === 'idle') continue;
    if (e === game.boss && game.boss.dead) continue;
    if (overlap(pb, e.hitbox())) {
      if (p.invuln <= 0 && e.variant) {
        if (e.variant.poisons) p.poisonT = Math.max(p.poisonT, 210);
        if (e.variant.leech) e.hp = Math.min(e.hp + 2, 30);
      }
      if (p.cardFx('rShock') && e !== game.boss && e.hurt && p.invuln <= 0) {
        e.hurt(2);
        burstRing(p.x + p.w / 2, p.y + 8, '#c07af0');
      }
      if (e.blood && p.invuln <= 0 && p.hearts > 0) {
        p.hearts--;
        e.hp = Math.min(e.hp + 2, 10);
        spawnFloater(e.x + 6, e.y - 8, 'STOLE A HEART', '#e04858');
      }
      if ((p.cardFx('rBurn') || p.cardFx('thorns')) && e !== game.boss && e.fireCd <= 0) {
        e.fireCd = 30;
        if (e.hurt(2)) {
          const eb = e.hitbox();
          spawnFloater(eb.x + eb.w / 2, eb.y - 6, '2', '#ffb060');
        }
        if (e.remove || (e.hp !== undefined && e.hp <= 0)) continue;
      }
      p.damage(e.contactDmg, e.hitbox().x + e.hitbox().w / 2, e);
    }
  }

  // pickups
  for (const pk of game.pickups) {
    if (!pk.remove && overlap(pb, pk)) pk.collect(p);
  }

  if (game.victoryOrb && overlap(pb, game.victoryOrb)) {
    saveHiScore();
    AudioSys.stopMusic();
    AudioSys.sfxClear();
    if (game.mode === 'normal') {   // the orb only ever appears once, at the castle's end
      // the Moonfang is broken; dawn touches the castle
      game.state = 'ending';
      game.endT = 0;
      meta.cleared = (meta.cleared || 0) + 1;
      if (game.daily && meta.dailyDay === dailySeed()) {
        if (game.score > (meta.dailyBest || 0)) meta.dailyBest = game.score;
      }
      saveMeta();
      game.feat('trueclear');
      clearRun();
    } else {
      game.state = 'win';
      saveRun(game);
    }
  }
}

function handleProjectiles() {
  const targets = game.enemies.filter(e => !e.remove);
  if (game.bossActive && !game.boss.dead) targets.push(game.boss);
  for (const pr of game.projectiles) {
    if (pr.remove) continue;
    pr.update();
    if (pr.remove) continue;
    if (pr.x < game.camX - 60 || pr.x > game.camX + VIEW_W + 60) { pr.remove = true; continue; }
    const hb = pr.hitbox();

    if (pr.isFire) {
      for (const e of targets) {
        if (e.fireCd > 0) continue;
        if (e instanceof Zombie && e.rise > 20) continue;
        if (e instanceof RobedZombie && e.rise > 20) continue;
        if (e instanceof Bat && e.state === 'gone') continue;
        if (overlap(hb, e.hitbox())) {
          e.fireCd = 18;
          if (e.hurt(pr.dmg)) {
            const eb = e.hitbox();
            spawnFloater(eb.x + eb.w / 2, eb.y - 6, String(pr.dmg), '#ffb060');
          }
        }
      }
      continue;
    }

    for (const e of targets) {
      if (pr.hitSet.has(e)) continue;
      if (e instanceof Zombie && e.rise > 20) continue;
      if (e instanceof RobedZombie && e.rise > 20) continue;
      if (e instanceof Bat && e.state === 'gone') continue;
      if (overlap(hb, e.hitbox())) {
        pr.hitSet.add(e);
        let dealt = pr.dmg;
        const inf = pr.infusion;
        if (inf === 'stone') dealt += 2;
        if (inf === 'shadow') dealt += 1;
        if (inf === 'holy' && (e instanceof Zombie || e instanceof Ghost || e instanceof RobedZombie || e instanceof Wraith || e instanceof BoneThrower)) dealt += 2;
        if (inf === 'moon' && Math.random() < 0.2) {
          dealt *= 2;
          spawnFloater(e.hitbox().x + 6, e.hitbox().y - 12, 'TRUE STRIKE', '#d8d0f0');
        }
        if (e.shieldHits > 0) { e.shieldHits--; dealt = 1; }
        if (e.hurt(dealt)) {
          if (inf === 'fire') { e.fireCd = 0; burst(e.hitbox().x + 6, e.hitbox().y + 6, ['#ff9020', '#ffd858'], 4, 1, 0); if (e.hp > 0) e.hurt(1); }
          if (inf === 'frost' && e !== game.boss && e.frozen !== undefined) e.frozen = Math.max(e.frozen, 30);
          if (inf === 'venom' && e.hp > 0) { e.hurt(1); burst(e.hitbox().x + 6, e.hitbox().y + 6, ['#5aa04a'], 3, 0.8, 0.02); }
          if (inf === 'blood' && Math.random() < 0.3) game.player.heal(1);
          if (inf === 'shock') {
            const other = targets.find(o => o !== e && !o.remove && o.hitbox &&
              Math.abs(o.hitbox().x - hb.x) < 90);
            if (other && other.hurt) { other.hurt(1); burstRing(other.hitbox().x + 6, other.hitbox().y + 6, '#c07af0'); }
          }
          const eb = e.hitbox();
          spawnFloater(eb.x + eb.w / 2, eb.y - 6, String(dealt));
          bloodBurst(eb.x + eb.w / 2, eb.y + 6, Math.sign(pr.vx || pr.dir || 1),
            e instanceof MedusaHead ? BLOOD_GREEN : BLOOD_RED);
          game.hitstop = 2;
        }
        pr.onHit();
        if (pr.remove) break;
      }
    }
    if (!pr.remove) {
      for (const c of game.candles) {
        if (!c.broken && overlap(hb, c.hitbox())) {
          c.smash();
          if (pr instanceof KnifeProj) { pr.remove = true; break; }
        }
      }
    }
  }
  game.projectiles = game.projectiles.filter(pr => !pr.remove);
}

// ---------------------------------------------------------------- boss flow
function updateBossFlow() {
  const p = game.player;

  // the gauntlet keeps its own single hall and its own rules
  if (game.mode === 'rush') {
    if (!game.boss) return;
    if (game.gateClosed || game.gateAnim < 4) game.gateAnim++;
    game.boss.update(p);
    if (game.boss.dead && !game.bossPrevDead) {
      game.addShake(8);
      AudioSys.setBossTempo(false);
    }
    game.bossPrevDead = game.boss.dead;
    return;
  }

  if (!game.guardians || !game.guardians.length) return;

  // whichever hall the hunter has walked into
  for (const b of game.guardians) {
    const A = b.arena;
    if (b.dead || A.beaten) continue;
    if (!game.bossActive && p.x > A.triggerX && p.x < A.arenaX1 + 60) {
      game.boss = b;
      game.bossArena = A;
      game.bossActive = true;
      game.bossHitless = true;
      b.start();
      setGate(true, A);
      game.gateAnim = 0;
      game.addShake(5);
      AudioSys.setBossTempo(true);
      break;
    }
  }
  if (game.gateClosed || game.gateAnim < 4) game.gateAnim++;

  if (game.bossActive && game.boss) {
    const A = game.bossArena || game.boss.arena;
    game.boss.update(p);
    if (game.boss.dead && !game.bossPrevDead) {
      game.addShake(8);
      AudioSys.setBossTempo(false);
    }
    game.bossPrevDead = game.boss.dead;
    if (game.boss.dead && game.boss.deathT === 80) {
      setGate(false, A);
      game.gateAnim = 0;
      if (A) A.beaten = true;
      game.dropRelic(game.boss.x + game.boss.w / 2, game.boss.y + 10, 0.8 + (A ? A.zone.length : 0) * 0.1);
      for (const e of game.enemies) if (e.minion) e.remove = true;

      // What the guardian leaves behind: a way into somewhere you could not go.
      const rw = A && A.reward ? BOSS_REWARDS[A.reward] : null;
      if (rw) {
        rw.apply(p);
        p.gifts = p.gifts || {};
        p.gifts[A.reward] = true;
        game.showCard(Sprites.emblem, rw.name, rw.desc);
        burstRing(p.x + p.w / 2, p.y + p.h / 2, '#ffe080');
        AudioSys.sfxClear();
        game.feat('firstgift');
        // every warded door that wanted this now opens
        for (const gt of (Level.gates || [])) {
          if (gt.need === A.reward && !gt.open) openGate(gt);
        }
      } else if (game.mode === 'normal') {
        // the last guardian: the castle is yours
        game.victoryOrb = new VictoryOrb(A ? A.homeX + 14 : p.x, (A ? A.homeY : p.y) + 60);
      }
      game.bossActive = false;
      game.bossPrevDead = false;
    }
  }
}

// A warded door falls away when you carry what it asked for.
// ---------------------------------------------------------------- secrets
// A chamber counts as found the moment the hunter stands inside it. There is no
// prompt and no marker beforehand — the whole point is that you went looking.
function checkSecrets() {
  const list = Level.secrets;
  if (!list || !list.length) return;
  const p = game.player;
  if (!p || p.dead) return;
  const px = p.x + p.w / 2, py = p.y + p.h / 2;
  for (const sc of list) {
    if (sc.found) continue;
    if (px < sc.x0 || px > sc.x1 || py < sc.y0 || py > sc.y1) continue;
    sc.found = true;
    game.secretsFound = (game.secretsFound || 0) + 1;
    meta.secrets = (meta.secrets || 0) + 1;
    saveMeta();
    game.addScore(750);
    p.essence = (p.essence || 0);
    meta.essence = (meta.essence || 0) + 4;
    game.addShake(3);
    AudioSys.sfxClear();
    burstRing(px, py, '#ffe080');
    game.showCard(Sprites.emblem, 'SECRET FOUND: ' + sc.name,
      game.secretsFound + ' OF ' + list.length + ' IN THIS CASTLE   +4 ESSENCE');
    game.feat('secret');
    if (game.secretsFound >= 5) game.feat('secret5');
    if (game.secretsFound >= 15) game.feat('secret15');
  }
}

function openGate(gt) {
  gt.open = true;
  for (let ty = gt.top; ty <= gt.bottom; ty++) tset(gt.tx, ty, 0);
  burst(gt.x + 8, gt.y - 40, ['#ffe080', '#f8f8ff', '#8a6d2f'], 18, 1.8, 0.04);
  game.addShake(4);
  AudioSys.sfxCandle();
  spawnFloater(gt.x, gt.y - 60, 'THE WAY OPENS', '#ffe080');
}

// ---------------------------------------------------------------- ambient dust motes
const motes = [];
function initMotes() {
  motes.length = 0;
  for (let i = 0; i < 24; i++) {
    motes.push({
      x: Math.random() * (VIEW_W + 40), y: Math.random() * VIEW_H,
      phase: Math.random() * 7, speed: 0.5 + Math.random(),
    });
  }
}

function updateMotes() {
  for (const m of motes) {
    m.x += Math.sin(game.time * 0.01 + m.phase) * 0.12 - 0.04;
    m.y += 0.07 * m.speed;
    if (m.y > VIEW_H) { m.y = -2; m.x = Math.random() * (VIEW_W + 40); }
    if (m.x < -20) m.x += VIEW_W + 60;
    if (m.x > VIEW_W + 40) m.x -= VIEW_W + 60;
  }
}

function drawMotes(g) {
  for (const m of motes) {
    const sx = Math.floor(m.x), sy = Math.floor(m.y);
    if (sx < 0 || sx > VIEW_W - 1 || sy < 0 || sy > VIEW_H - 1) continue;
    g.fillStyle = ((m.phase * 7) | 0) % 3 ? 'rgba(120,115,175,0.45)' : 'rgba(190,185,235,0.5)';
    g.fillRect(sx, sy, 1, 1);
  }
}

// ---------------------------------------------------------------- storm over the battlements
const weather = { drops: [], flashT: 0, bolt: null, nextStrike: 300, thunderIn: -1 };
const ambientSpecks = [];  // biome-specific floating particles

function rainFactor() {
  const px = game.player ? game.player.x : -999;
  // rain in battlements, graveyard, sky zones — any place with open sky
  if (px >= Level.rainX0 - 120 && px <= Level.rainX1 + 120) {
    return Math.max(0, Math.min(1,
      (px - (Level.rainX0 - 120)) / 140,
      ((Level.rainX1 + 120) - px) / 140));
  }
  // also rain at any zone with exposed sky
  const z = typeof zoneAt === 'function' ? zoneAt(px) : null;
  if (z && (z.biome === 'graveyard' || z.biome === 'sky' || z.biome === 'frost')) {
    const zc = (z.x0 + z.x1) / 2;
    return Math.max(0, Math.min(1, 1 - Math.abs(px - zc) / ((z.x1 - z.x0) / 2 + 100)));
  }
  return 0;
}

function updateWeather() {
  const f = rainFactor();
  const want = Math.floor(85 * f);
  let spawn = 6;
  while (weather.drops.length < want && spawn-- > 0) {
    weather.drops.push({
      x: game.camX - 20 + Math.random() * (VIEW_W + 60),
      y: game.camY - 12 - Math.random() * 24,
      vy: 4.2 + Math.random() * 2.2,
    });
  }
  for (let i = weather.drops.length - 1; i >= 0; i--) {
    const d = weather.drops[i];
    d.x -= 1.1; d.y += d.vy;
    const solid = isSolid(tileAt(Math.floor(d.x / TILE), Math.floor(d.y / TILE)));
    if (solid || d.y > game.camY + VIEW_H + 15) {
      if (solid && Math.random() < 0.5) {
        spawnParticle(d.x, Math.floor(d.y / TILE) * TILE + 0.5,
          (Math.random() - 0.5) * 0.8, -0.7, '#9aa4cc', 8, 0.1);
      }
      weather.drops.splice(i, 1);
    }
  }

  if (f > 0.5 && --weather.nextStrike <= 0) {
    weather.nextStrike = 300 + Math.random() * 420;
    weather.flashT = 14;
    weather.thunderIn = 14;
    // jagged bolt from the sky down to the parapet
    const bx = game.camX + 30 + Math.random() * (VIEW_W - 80);
    let gy = game.camY + VIEW_H - 20;
    for (let ty = 0; ty < LEVEL_H; ty++) {
      if (isSolid(tileAt(Math.floor(bx / TILE), ty))) { gy = ty * TILE; break; }
    }
    const pts = [];
    let x = bx, y = game.camY - 6;
    while (y < gy) {
      pts.push([x, y]);
      y += 6 + Math.random() * 7;
      x += (Math.random() - 0.5) * 11;
    }
    pts.push([x, gy]);
    weather.bolt = pts;
    game.addShake(3);
  }
  if (weather.flashT > 0) weather.flashT--;
  if (weather.thunderIn > 0 && --weather.thunderIn === 0) AudioSys.sfxThunder();
}

function drawRain(g, camX, camY) {
  const z = typeof zoneAt === 'function' ? zoneAt(game.player ? game.player.x : 0) : null;
  const isSnow = z && z.biome === 'frost';
  for (const d of weather.drops) {
    const sx = Math.floor(d.x - camX), sy = Math.floor(d.y - camY);
    if (sx < -2 || sx > VIEW_W + 2 || sy < -6 || sy > VIEW_H + 2) continue;
    if (isSnow) {
      g.fillStyle = d.vy > 2 ? 'rgba(200,220,240,0.35)' : 'rgba(240,248,255,0.5)';
      g.fillRect(sx, sy, 2, 2);
      g.fillRect(sx + 1, sy - 1, 1, 1);
    } else {
      g.fillStyle = d.vy > 5.4 ? 'rgba(190,198,235,0.45)' : 'rgba(150,160,205,0.32)';
      g.fillRect(sx, sy, 1, 5);
      g.fillRect(sx + 1, sy - 2, 1, 2);
    }
  }
  // the bolt itself is visible only during the bright strobe
  if (weather.flashT > 8 && weather.bolt) {
    for (let i = 0; i < weather.bolt.length - 1; i++) {
      const [x0, y0] = weather.bolt[i], [x1, y1] = weather.bolt[i + 1];
      const steps = Math.max(1, Math.floor(Math.abs(y1 - y0) / 2));
      for (let s = 0; s <= steps; s++) {
        const xx = Math.floor(x0 + (x1 - x0) * s / steps - camX);
        const yy = Math.floor(y0 + (y1 - y0) * s / steps - camY);
        g.fillStyle = 'rgba(140,150,255,0.5)';
        g.fillRect(xx - 1, yy, 3, 2);
        g.fillStyle = '#f0f4ff';
        g.fillRect(xx, yy, 1, 2);
      }
    }
  }
}

function drawLightningFlash(g) {
  if (weather.flashT <= 0) return;
  const t = weather.flashT;
  // double strobe: bright, dip, bright again, fade
  const a = t > 11 ? 0.32 : t > 8 ? 0.06 : t > 5 ? 0.2 : 0.03 * t;
  g.fillStyle = `rgba(222,228,255,${a.toFixed(3)})`;
  g.fillRect(0, 0, VIEW_W, VIEW_H);
}

// Biome-specific ambient floating particles: embers in foundry, spores in catacombs,
// snowflakes in frost, void motes in void.
function updateAmbientSpecks() {
  const px = game.player ? game.player.x : -999;
  const z = typeof zoneAt === 'function' ? zoneAt(px) : null;
  const biome = z ? z.biome : null;
  let type = null, want = 0;
  if (biome === 'foundry') { type = 'ember'; want = 18; }
  else if (biome === 'catacombs' || biome === 'void') { type = 'spore'; want = 14; }
  else if (biome === 'frost') { type = 'snow'; want = 22; }
  else if (biome === 'sky') { type = 'cloud'; want = 10; }

  while (ambientSpecks.length < want && want > 0) {
    ambientSpecks.push({
      x: game.camX + Math.random() * (VIEW_W + 40),
      y: game.camY - 10 + Math.random() * (VIEW_H + 30),
      vy: type === 'ember' ? -0.6 - Math.random() * 0.5 : type === 'spore' ? -0.1 - Math.random() * 0.15 : type === 'snow' ? 0.3 + Math.random() * 0.4 : -0.15 - Math.random() * 0.2,
      vx: type === 'ember' ? (Math.random() - 0.5) * 0.5 : type === 'spore' ? Math.sin(Math.random() * 7) * 0.3 : type === 'snow' ? (Math.random() - 0.5) * 0.4 : (Math.random() - 0.5) * 0.2,
      life: type === 'ember' ? 60 + Math.random() * 40 : type === 'spore' ? 120 + Math.random() * 80 : type === 'snow' ? 90 + Math.random() * 60 : 80 + Math.random() * 40,
      type,
    });
  }
  for (let i = ambientSpecks.length - 1; i >= 0; i--) {
    const s = ambientSpecks[i];
    s.x += s.vx; s.y += s.vy;
    s.life--;
    if (s.life <= 0 || s.x < game.camX - 40 || s.x > game.camX + VIEW_W + 40 ||
        s.y < game.camY - 40 || s.y > game.camY + VIEW_H + 40) ambientSpecks.splice(i, 1);
    if (s.type === 'ember' && Math.random() < 0.1) s.vx += (Math.random() - 0.5) * 0.3;
  }
}

function drawAmbientSpecks(g, camX, camY) {
  for (const s of ambientSpecks) {
    const sx = Math.floor(s.x - camX), sy = Math.floor(s.y - camY);
    if (sx < 0 || sx > VIEW_W || sy < 0 || sy > VIEW_H) continue;
    const alpha = s.type === 'ember' ? 0.6 + Math.random() * 0.3 : s.type === 'spore' ? 0.4 + Math.random() * 0.2 : s.type === 'snow' ? 0.5 + Math.random() * 0.3 : 0.3 + Math.random() * 0.2;
    if (s.type === 'ember') {
      g.fillStyle = ['rgba(255,160,40,', 'rgba(255,220,80,', 'rgba(228,80,50,'][((game.time >> 2) + Math.floor(s.x)) % 3] + alpha.toFixed(2) + ')';
      g.fillRect(sx, sy, 2, 2);
    } else if (s.type === 'spore') {
      g.fillStyle = 'rgba(90,170,140,' + alpha.toFixed(2) + ')';
      g.fillRect(sx, sy, 1, 1);
    } else if (s.type === 'snow') {
      g.fillStyle = 'rgba(220,240,255,' + alpha.toFixed(2) + ')';
      g.fillRect(sx, sy, 2, 2);
      g.fillRect(sx + 1, sy - 1, 1, 1);
    } else {
      g.fillStyle = 'rgba(180,210,240,' + alpha.toFixed(2) + ')';
      g.fillRect(sx, sy, 2, 2);
    }
  }
}

// ---------------------------------------------------------------- camera
function updateCamera() {
  const p = game.player;
  let minX = 0, maxX = Level.pxW - VIEW_W;
  // the view is bounded by the scene you are standing in, not by the whole castle
  const sc = game.scene;
  if (sc) {
    minX = sc.x0;
    maxX = Math.max(sc.x0, sc.x1 - VIEW_W);
  }
  if (game.bossActive && game.gateClosed && game.bossArena) {
    minX = game.bossArena.arenaX0;
    maxX = game.bossArena.arenaX1 - VIEW_W;
  }
  const tx = Math.max(minX, Math.min(maxX, p.x + p.w / 2 - (VIEW_W / 2 - 6)));
  if (game.camSnap) { game.camX = tx; game.camSnap = false; }
  else game.camX += (tx - game.camX) * 0.18;

  // --- vertical camera. The two axes do not obey the same rules: horizontal
  // follow is constant, vertical is a dead-zone window that only resolves when
  // the hunter lands, so hopping up a chimney's ledges does not shove the view.
  let lead = 0;
  if (!p.onGround) {
    if (p.vy > 1.2) lead = Math.min(150, (p.vy - 1.2) * 34);        // plummeting: look down
    else if (p.vy < -1.5) lead = Math.max(-90, (p.vy + 1.5) * 26);  // rising: look up
  }
  game.camLead = game.camLead || 0;
  game.camLead += (lead - game.camLead) * (lead > game.camLead ? 0.06 : 0.03);
  if (p.wallDir) game.camLead += (-46 - game.camLead) * 0.05;       // eye up the climb

  const desired = p.y + p.h / 2 - Math.round(VIEW_H * 0.62) + game.camLead;
  const WINDOW = 54;          // roughly one tower ledge gap: small hops don't move it
  let ty = game.camY;
  let rate = 0.10;
  if (p.onGround || p.wallDir) {
    ty = desired;             // landing (or catching stone) resolves the view
    rate = 0.16;
  } else if (desired > game.camY + WINDOW) {
    ty = desired - WINDOW;
    // a long drop is a panic line: catch up fast so the floor arrives before you do
    rate = p.vy > 5 ? 0.30 : 0.12;
  } else if (desired < game.camY - WINDOW) {
    ty = desired + WINDOW;
    rate = 0.14;
  }
  ty = Math.max(-160, Math.min(Level.pxH - VIEW_H, ty));
  game.camY += (ty - game.camY) * rate;
}


// ---------------------------------------------------------------- update
// ---------------------------------------------------------------- crafting
function recipeCost(rec) {
  const p = game.player;
  const disc = p && p.skills.forgeborn ? 0.6 : 1;
  return Math.ceil(rec.essence * disc);
}

function canCraft(rec) {
  const p = game.player;
  if (!p) return false;
  if (meta.essence < recipeCost(rec)) return false;
  for (const m in rec.cost) if ((p.materials[m] || 0) < rec.cost[m]) return false;
  if (rec.kind === 'weapon' && p.weapons[rec.weapon]) return false;
  if (rec.kind === 'temper' && p.whipLvl >= 3) return false;
  if (rec.kind === 'cardKey' && p.cards[rec.card]) return false;
  if (rec.kind === 'infusion' && !p.subWeapon) return false;
  if (rec.kind === 'infusion' && p.subInfusion === rec.infusion) return false;
  if (rec.kind === 'sub' && SUB_KEYS.every(k => k === p.subWeapon)) return false;
  if (rec.kind === 'subKey' && p.subWeapon === rec.sub) return false;
  if (rec.kind === 'scroll') {
    if (PERK_KEYS.every(k => (p.perks[k] || 0) >= 4)) return false;
  }
  return true;
}

function craft(rec) {
  const p = game.player;
  if (!canCraft(rec)) { AudioSys.sfxHit(); return false; }
  for (const m in rec.cost) p.materials[m] -= rec.cost[m];
  meta.essence -= recipeCost(rec);
  meta.crafted = (meta.crafted || 0) + 1;
  saveMeta();
  game.feat('smith');
  burst(p.x + p.w / 2, p.y + 6, ['#ff9020', '#ffe080', '#f8f8ff'], 14, 1.6, -0.02);
  AudioSys.sfxCrash();
  if (rec.kind === 'weapon') {
    game.giveItem('weap_' + rec.weapon, p.x, p.y);
  } else if (rec.kind === 'temper') {
    p.whipLvl++;
    game.showCard(weaponIcon(p.weapon), 'TEMPERED  ' + WEAPONS[p.weapon].short,
      'YOUR WEAPON REACHES FARTHER AND BITES DEEPER');
  } else if (rec.kind === 'relic') {
    game.giveRelic(rollRelic(rec.bias + game.stage * 0.15));
  } else if (rec.kind === 'cardKey') {
    game.giveItem('card_' + rec.card, p.x, p.y);
  } else if (rec.kind === 'sub') {
    const pool = SUB_KEYS.filter(k => k !== p.subWeapon);
    game.giveItem(pool[(Math.random() * pool.length) | 0], p.x, p.y);
  } else if (rec.kind === 'subKey') {
    game.giveItem(rec.sub, p.x, p.y);
  } else if (rec.kind === 'infusion') {
    p.subInfusion = rec.infusion;
    const inf = INFUSIONS[rec.infusion];
    game.showCard(SUBWEAPONS[p.subWeapon].icon(), inf.name + ' INFUSION', inf.desc);
  } else if (rec.kind === 'scroll') {
    const times = rec.double ? 2 : 1;
    for (let i = 0; i < times; i++) {
      const pool = PERK_KEYS.filter(k => (p.perks[k] || 0) < 4);
      if (!pool.length) break;
      const k = pool[(Math.random() * pool.length) | 0];
      p.perks[k] = (p.perks[k] || 0) + 1;
      game.showCard(Sprites.whipItem, 'TECHNIQUE: ' + PERKS[k].name + ' ' + RANK_NUM[p.perks[k]], PERKS[k].desc);
    }
  } else if (rec.kind === 'elixir') {
    const n = rec.amount || 2;
    p.maxHp += n; p.hp = p.maxHpTotal();
    game.showCard(Sprites.elixir, 'ELIXIR', 'MAX HEALTH +' + n);
  } else if (rec.kind === 'heal') {
    p.heal(rec.amount || 12);
    spawnFloater(p.x + p.w / 2, p.y - 10, '+' + (rec.amount || 12), '#5ad06a');
  } else if (rec.kind === 'key') {
    p.keys += rec.amount || 1;
    game.showCard(Sprites.key, 'GOLDEN KEY', (rec.amount || 1) + ' GATE(S) WILL OPEN');
  } else if (rec.kind === 'gems') {
    p.gems += rec.amount || 25;
    spawnFloater(p.x + p.w / 2, p.y - 10, '+' + (rec.amount || 25) + ' GEMS', '#c060e0');
  } else if (rec.kind === 'reveal') {
    // the lantern: this whole floor is remembered at once
    const py = Math.floor((p.y + p.h / 2) / TILE);
    for (let ty = Math.max(0, py - 8); ty < Math.min(LEVEL_H, py + 8); ty++) {
      for (let tx = 0; tx < LEVEL_W; tx++) game.explored[ty * LEVEL_W + tx] = 1;
    }
    spawnFloater(p.x + p.w / 2, p.y - 10, 'THE FLOOR IS MAPPED', '#8ad0f0');
  } else if (rec.kind === 'transmute') {
    p.materials[rec.to] = (p.materials[rec.to] || 0) + 1;
    spawnFloater(p.x + p.w / 2, p.y - 10, '+1 ' + MATERIALS[rec.to].short, MATERIALS[rec.to].color);
  } else if (rec.kind === 'phial') {
    p.giveBuff(rec.buff || BUFF_KEYS[(Math.random() * BUFF_KEYS.length) | 0]);
  } else if (rec.kind === 'hearts') {
    p.hearts += rec.amount || 20;
    spawnFloater(p.x + p.w / 2, p.y - 10, '+' + (rec.amount || 20) + ' HEARTS', '#e04858');
  } else if (rec.kind === 'ore') {
    const n = rec.amount || 1;
    p.materials[rec.mat] = (p.materials[rec.mat] || 0) + n;
    spawnFloater(p.x + p.w / 2, p.y - 10, '+' + n + ' ' + MATERIALS[rec.mat].short,
      MATERIALS[rec.mat].color);
  } else if (rec.kind === 'voidrite') {
    for (const e of game.enemies) {
      if (!e.remove && e.frozen !== undefined) e.frozen = Math.max(e.frozen, 260);
    }
    spawnFloater(p.x + p.w / 2, p.y - 10, 'THE VOID ANSWERS', '#7a5ac0');
    burstRing(p.x + p.w / 2, p.y + 8, '#7a5ac0');
    game.watchFlash = 30;
  } else if (rec.kind === 'pyre') {
    for (const e of game.enemies) {
      if (e.remove || !e.hurt) continue;
      const eb = e.hitbox();
      if (Math.abs(eb.x - p.x) < 200) {
        e.hurt(6);
        burst(eb.x + eb.w / 2, eb.y + eb.h / 2, ['#ff6020', '#ffd858'], 8, 1.3, 0.02);
      }
    }
    if (game.boss && game.bossActive && !game.boss.dead && Math.abs(game.boss.x - p.x) < 200) {
      game.boss.hurt(10);
    }
    spawnFloater(p.x + p.w / 2, p.y - 10, 'FUNERAL PYRE!', '#ff6020');
    burstRing(p.x + p.w / 2, p.y + 8, '#ff6020');
    game.addShake(6);
  } else if (rec.kind === 'soulbind') {
    p.maxHp += 8; p.hp = p.maxHpTotal();
    p.hearts += 10;
    spawnFloater(p.x + p.w / 2, p.y - 10, 'SOUL BOUND', '#c07af0');
    burstRing(p.x + p.w / 2, p.y + 8, '#c07af0');
  }
  return true;
}

// ---------------------------------------------------------------- merchant
function makeShopStock() {
  const p = game.player;
  const stock = [];
  const pick = arr => arr[(Math.random() * arr.length) | 0];
  // how deep the hunter has walked sets what the pedlar has bothered to carry
  const z = typeof zoneAt === 'function' ? zoneAt(p.x) : null;
  const deep = z ? z.danger : 0;

  // two thrown arms, never the one already in hand
  const subs = SUB_KEYS.filter(k => k !== p.subWeapon);
  for (let i = 0; i < 2 && subs.length; i++) {
    const k = subs.splice((Math.random() * subs.length) | 0, 1)[0];
    stock.push({ kind: 'sub', key: k, cost: 16 + deep * 2 });
  }
  // two relics, the second cut finer than the first
  stock.push({ kind: 'relic', data: rollRelic(1.2 + deep * 0.3), cost: 28 + deep * 4 });
  stock.push({ kind: 'relic', data: rollRelic(2.0 + deep * 0.35), cost: 46 + deep * 6 });
  // up to two weapons he has not sold you yet
  const unowned = WEAPON_KEYS.filter(k => !p.weapons[k] && !WEAPONS[k].craftOnly);
  for (let i = 0; i < 2 && unowned.length; i++) {
    const k = unowned.splice((Math.random() * unowned.length) | 0, 1)[0];
    stock.push({ kind: 'weapon', key: k, cost: 38 + deep * 5 });
  }
  // an ore he swears came from somewhere terrible
  const mats = MATERIAL_KEYS.filter(k => MATERIALS[k].depth <= deep + 1);
  if (mats.length) stock.push({ kind: 'ore', key: pick(mats), amount: 3, cost: 20 + deep * 3 });
  // a skill, if there is one he can teach
  const teach = SKILLS.filter(sk => !p.skills[sk.key] && (!sk.req || p.skills[sk.req]));
  if (teach.length) {
    const sk = pick(teach);
    stock.push({ kind: 'skill', key: sk.key, cost: 30 + sk.cost * 2 });
  }
  // and the everyday things
  stock.push({ kind: 'heal', cost: 12 });
  stock.push({ kind: 'hearts', cost: 10 });
  stock.push({ kind: 'buff', key: pick(BUFF_KEYS), cost: 15 });
  stock.push({ kind: 'key', cost: 22 });
  return stock;
}

function shopLabel(it) {
  if (it.kind === 'weapon') return WEAPONS[it.key].name;
  if (it.kind === 'ore') return (it.amount || 3) + 'x ' + MATERIALS[it.key].name;
  if (it.kind === 'skill') {
    const sk = SKILLS.find(q => q.key === it.key);
    return sk ? sk.name : 'A TECHNIQUE';
  }
  if (it.kind === 'key') return 'GOLDEN KEY';
  if (it.kind === 'sub') return SUBWEAPONS[it.key].name;
  if (it.kind === 'relic') return relicName(it.data);
  if (it.kind === 'heal') return 'HEALING DRAUGHT';
  if (it.kind === 'hearts') return '15 HEARTS';
  return BUFFS[it.key].name + ' PHIAL';
}
function shopDesc(it) {
  if (it.kind === 'weapon') return WEAPONS[it.key].desc;
  if (it.kind === 'ore') return 'ORE FOR THE FORGE';
  if (it.kind === 'skill') {
    const sk = SKILLS.find(q => q.key === it.key);
    return sk ? sk.desc : 'SOMETHING HE WAS TAUGHT';
  }
  if (it.kind === 'key') return 'OPENS ONE TREASURY GATE';
  if (it.kind === 'sub') return SUBWEAPONS[it.key].desc;
  if (it.kind === 'relic') return relicStatsText(it.data);
  if (it.kind === 'heal') return 'RESTORE 10 HEALTH';
  if (it.kind === 'hearts') return 'AMMUNITION FOR SUB-WEAPONS';
  return BUFFS[it.key].desc;
}
function buyItem(idx) {
  const merch = game.nearMerchant;
  if (!merch || !merch.stock) return;
  const it = merch.stock[idx];
  const p = game.player;
  if (!it || it.sold) return;
  if (p.gems < it.cost) {
    spawnFloater(p.x + p.w / 2, p.y - 10, 'NOT ENOUGH GEMS', '#e04858');
    return;
  }
  p.gems -= it.cost;
  it.sold = true;
  if (it.kind === 'weapon') game.giveItem('weap_' + it.key, p.x, p.y);
  else if (it.kind === 'sub') game.giveItem(it.key, p.x, p.y);
  else if (it.kind === 'relic') game.giveRelic(it.data);
  else if (it.kind === 'heal') { p.heal(10); spawnFloater(p.x + p.w / 2, p.y - 10, '+10', '#5ad06a'); }
  else if (it.kind === 'hearts') { p.hearts += 15; spawnFloater(p.x + p.w / 2, p.y - 10, '+15 HEARTS', '#e04858'); }
  else if (it.kind === 'key') { p.keys += 1; spawnFloater(p.x + p.w / 2, p.y - 10, '+1 KEY', '#d8a848'); }
  else if (it.kind === 'ore') {
    const n = it.amount || 3;
    p.materials[it.key] = (p.materials[it.key] || 0) + n;
    spawnFloater(p.x + p.w / 2, p.y - 10, '+' + n + ' ' + MATERIALS[it.key].short, MATERIALS[it.key].color);
  } else if (it.kind === 'skill') {
    const sk = SKILLS.find(q => q.key === it.key);
    p.skills[it.key] = true;
    if (sk) game.showCard(Sprites.emblem, sk.name, sk.desc);
  } else p.giveBuff(it.key);
  AudioSys.sfxItem();
}

// ---------------------------------------------------------------- the hunter's marks
// A procedural castle has no landmarks worth naming in advance, so the hunter
// keeps their own: four scratched shapes, placed and scrubbed at will.
function markSpot(x, y) {
  const near = game.marks.findIndex(m => Math.abs(m.x - x) < 40 && Math.abs(m.y - y) < 40);
  if (near >= 0) {
    game.marks.splice(near, 1);
    spawnFloater(x, y - 16, 'MARK SCRUBBED', '#5c5678');
    AudioSys.sfxPickup();
    return;
  }
  if (game.marks.length >= 12) game.marks.shift();
  const kind = game.marks.length ? (game.marks[game.marks.length - 1].kind + 1) % 4 : 0;
  game.marks.push({ x, y, kind });
  spawnFloater(x, y - 16, 'MARKED', '#f0ead8');
  AudioSys.sfxPickup();
}

// ---------------------------------------------------------------- warping
function litObelisks() {
  return (Level.obelisks || []).filter(o => o.lit);
}
function warpTo(ob) {
  const p = game.player;
  burstRing(p.x + p.w / 2, p.y + p.h / 2, '#50d8e8');
  p.x = ob.x - p.w / 2 + 6;
  p.y = ob.y - p.h;
  p.vx = 0; p.vy = 0;
  p.invuln = Math.max(p.invuln, 40);
  game.camX = Math.max(0, p.x - VIEW_W / 2);
  burstRing(p.x + p.w / 2, p.y + p.h / 2, '#50d8e8');
  AudioSys.sfxSoul();
  game.fadeT = 24;
}

// ---------------------------------------------------------------- the crossroads
function offerPaths() {
  const pool = PATHS.slice();
  const offer = [];
  const n = Math.min(3, pool.length);
  for (let i = 0; i < n; i++) offer.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]);
  game.pathOffer = offer;
  game.pathSel = 0;
}

function advanceStage() {
  game.stage++;
  if (game.stage >= 4) {
    const pool = Object.keys(CURSES).filter(k => !game.cursed(k));
    if (pool.length) game.curses.push(pool[(Math.random() * pool.length) | 0]);
  }
  if (game.stage > meta.bestStage) { meta.bestStage = game.stage; saveMeta(); }
  resetGame(true);
  game.state = 'play';
  saveRun(game);
  AudioSys.sfxBell(); AudioSys.startMusic();
  if (game.curses.length && game.stage >= 4) {
    const c = CURSES[game.curses[game.curses.length - 1]];
    game.showCard(Sprites.emblem, 'CURSE: ' + c.name, c.desc);
  }
  const unlocked = META_UNLOCKS.find(u => u.stage === game.stage);
  if (unlocked) game.showCard(Sprites.emblem, 'NEW DEPTH REACHED', 'FUTURE HUNTS BEGIN WITH ' + unlocked.label);
}

function startRun(opts) {
  opts = opts || {};
  game.mode = 'normal';
  game.stage = 1;
  game.curses = [];
  game.path = null;
  game.daily = !!opts.daily;
  if (opts.daily) srand(dailySeed());
  clearRun();
  resetGame();
  game.state = 'play';
  saveRun(game);
  AudioSys.sfxBell();
  AudioSys.startMusic();
}

function resumeRun() {
  const d = loadRun();
  if (!d) return false;
  game.mode = 'normal';
  game.stage = d.stage;
  game.curses = d.curses || [];
  game.daily = !!d.daily;
  game.path = d.path ? PATHS.find(pp => pp.key === d.path) || null : null;
  resetGame();
  const p = game.player;
  for (const k in d.p) if (d.p[k] !== undefined) p[k] = d.p[k];
  game.score = d.score || 0;
  game.stats = d.stats || game.stats;
  game.state = 'play';
  AudioSys.sfxBell();
  AudioSys.startMusic();
  return true;
}

function stepGame() {
  game.time++;
  pollGamepad();

  if (pending.beast && game.state === 'title') {
    game.state = 'bestiary';
    game.beastSel = 0;
  }
  if (pending.rush && game.state === 'title') {
    startRush();
    game.state = 'play';
    AudioSys.sfxRoar();
    AudioSys.startMusic();
  }
  if (pending.feats && (game.state === 'title' || game.state === 'pause')) {
    game.featFrom = game.state;
    game.state = 'feats';
  }
  if (pending.weap >= 0 && game.state === 'title') {
    const owned = WEAPON_KEYS.filter(k => meta.weapons[k]);
    const pick = owned[pending.weap];
    if (pick) { meta.startWeapon = pick; saveMeta(); AudioSys.sfxPickup(); }
  }
  if (game.eraseArm > 0) game.eraseArm--;
  if (pending.erase && game.state === 'title') {
    if (game.eraseArm > 0) {
      eraseAllProgress();
      hiScore = 0;
      game.eraseArm = 0;
      game.eraseDone = 200;
      AudioSys.sfxRoar();
    } else {
      game.eraseArm = 240;      // four seconds to think better of it
      AudioSys.sfxHit();
    }
  }
  if (game.eraseDone > 0) game.eraseDone--;

  if (pending.daily && game.state === 'title') startRun({ daily: true });
  if (pending.cont && game.state === 'title') { if (!resumeRun()) startRun(); }
  if (pending.enter) {
    if (game.state === 'title') startRun();
    else if (game.state === 'play') game.state = 'pause';
    else if (game.state === 'pause') game.state = 'play';
    else if (game.state === 'gameover') startRun();
    else if (game.state === 'win' && game.mode === 'rush') {
      game.mode = 'normal';
      game.state = 'title';
    }
    else if (game.state === 'ending') {
      game.state = 'title';
      clearRun();
    }
    else if (game.state === 'win') {
      // there are no roads down any more; there is only the castle
      game.state = 'play';
    }
  }

  if (game.state === 'play') {
    if (game.hitstop > 0) { game.hitstop--; }
    else {
      const input = {
        left: keys.left || gpState.left, right: keys.right || gpState.right,
        down: keys.down || gpState.down,
        jumpPressed: pending.jump, whipPressed: pending.whip, dashPressed: pending.dash,
        attackHeld: keys.attack || gpState.attack,
      };
      const p = game.player;
      // Up + attack hurls the sub-weapon, spending hearts (classic Castlevania)
      if (pending.whip && (keys.up || gpState.up) && p.subWeapon && !p.dead && p.whipTimer < 0 &&
          p.throwAnim <= 0 && p.hurtTimer <= 0 && p.dashTimer <= 0 && !p.crouching) {
        const def = SUBWEAPONS[p.subWeapon];
        const active = game.projectiles.filter(pr => !pr.remove && !pr.isFire).length;
        const thrift = Math.min(2, Math.ceil(p.perkRank('thrift') / 2));
        const cost = Math.max(1, def.cost - thrift);
        const preN2 = game.projectiles.length;
        if (p.hearts >= cost && active < 2 && def.fire(p) !== false) {
          for (let i = preN2; i < game.projectiles.length; i++) {
            const pr = game.projectiles[i];
            pr.infusion = p.subInfusion;
            if (p.subInfusion === 'wind' && pr.vx) pr.vx *= 1.4;
          }
          p.hearts -= cost;
          p.throwAnim = 14;
          input.whipPressed = pending.whip = false;
          if (!def.quiet) AudioSys.sfxThrow();
        }
      }
      // Item Crash: 10 hearts unleash the sub-weapon's full wrath
      if (game.crashCd > 0) game.crashCd--;
      if (pending.crash && p.subWeapon && !p.dead && p.hurtTimer <= 0 && game.crashCd <= 0) {
        const crashCost = Math.max(5, 10 - p.perkRank('wrath'));
        if (p.hearts >= crashCost) {
          p.hearts -= crashCost;
          game.crashCd = 90;
          game.crashFlash = 18;
          game.feat('firstcrash');
          game.hitstop = 4;
          game.addShake(4);
          AudioSys.sfxCrash();
          const cx = p.x + p.w / 2, cy = p.y + 8;
          SUBWEAPONS[p.subWeapon].crash(p, cx, cy);
          spawnFloater(cx, p.y - 12, 'ITEM CRASH', '#ffe080');
        } else {
          AudioSys.sfxHit();
        }
      }

      if (input.whipPressed && p.whipTimer < 0 && !p.dead && p.hurtTimer <= 0 && p.dashTimer <= 0) {
        p.swingId = (p.swingId || 0) + 1;
      }
      p.update(input);

      // landing on a lift deck
      for (const lf of (Level.lifts || [])) {
        const feet = p.y + p.h;
        if (p.vy >= 0 && feet >= lf.y - 2 && feet <= lf.y + 10 &&
            p.x + p.w > lf.x && p.x < lf.x + lf.w) {
          p.y = lf.y - p.h;
          p.vy = 0;
          p.onGround = true;
          p.airJumps = 1 + p.extraJumps;
          p.airDashUses = 0;
        }
      }

      if (p.y > Level.pxH + 30 && !p.dead) { p.hp = 0; p.dead = true; }

      updateSpawners();
      for (const e of game.enemies) {
        if (e.remove) continue;
        if (e.variant && e.variant.regen && e.hp > 0 && (game.time % 60) === 0 &&
            e.hp < 30 && !(e.frozen > 0)) e.hp++;
        e.update(p);
        if (e instanceof MedusaHead &&
            (e.x < game.camX - 60 || e.x > game.camX + VIEW_W + 60)) e.remove = true;
      }
      game.enemies = game.enemies.filter(e => !e.remove);
      for (const c of game.candles) c.update();
      for (const pk of game.pickups) pk.update(p);
      game.pickups = game.pickups.filter(pk => !pk.remove);
      if (game.victoryOrb) game.victoryOrb.update();

      // skill shrines: stand close and press UP to pray
      game.nearShrine = null;
      if (p.onGround && !p.dead) {
        game.nearShrine = Level.props.find(pr => pr.type === 'shrine' &&
          Math.abs(p.x + p.w / 2 - (pr.x + 8)) < 28) || null;
        if (game.nearShrine && pending.up && p.whipTimer < 0 && p.hurtTimer <= 0) {
          game.state = 'shrine';
          game.shrineSel = 0;
          AudioSys.sfxPickup();
        }
        // something glimmers in the dirt...
        if (!game.nearShrine && pending.up && Level.glimmers) {
          const gl = Level.glimmers.find(t => !t.found && Math.abs(p.x + p.w / 2 - t.x) < 14);
          if (gl) {
            gl.found = true;
            game.stats.items++;
            meta.glimmers = (meta.glimmers || 0) + 1; saveMeta();
            dustPuff(gl.x, gl.y, 6);
            game.dropLoot(gl.x - 8, gl.y - 10, 'glimmer');
            game.dropLoot(gl.x + 4, gl.y - 12, 'glimmer');
            spawnFloater(gl.x, gl.y - 20, 'TREASURE', '#ffe080');
            AudioSys.sfxItem();
          }
        }
      }

      // warp obelisks: touch to wake them, then travel between them from the chart
      if (Level.obelisks) {
        for (const ob of Level.obelisks) {
          if (!ob.lit && Math.abs(p.x + p.w / 2 - (ob.x + 6)) < 20 &&
              Math.abs(p.y + p.h - ob.y) < 40) {
            ob.lit = true;
            spawnFloater(ob.x, ob.y - 32, 'OBELISK AWAKENED', '#50d8e8');
            burstRing(ob.x + 6, ob.y - 12, '#50d8e8');
            AudioSys.sfxSoul();
            game.feat('firstwarp');
          }
        }
      }

      // resting at a woken obelisk: mend yourself, and the castle stirs again
      const restOb = (Level.obelisks || []).find(ob => ob.lit &&
        Math.abs(p.x + p.w / 2 - (ob.x + 6)) < 22 && Math.abs(p.y + p.h - ob.y) < 30);
      game.nearObelisk = restOb || null;
      if (restOb && pending.up && p.onGround && !game.nearShrine && !game.nearForge) {
        p.hp = p.maxHpTotal();
        p.hearts += 10;
        p.buffs = {};
        spawnFloater(p.x + p.w / 2, p.y - 12, 'RESTED', '#50d8e8');
        burstRing(p.x + p.w / 2, p.y + 8, '#50d8e8');
        AudioSys.sfxSoul();
        game.fadeT = 20;
        // the dead do not stay dead while you catch your breath
        let woken = 0;
        for (const e of game.enemies) {
          if (e.state === 'gone' && e.respawn !== undefined) {
            e.respawn = 1; woken++;
          }
        }
        for (const z of game.zoneTimers.keys()) game.zoneTimers[z] = 30;
        if (woken) spawnFloater(p.x + p.w / 2, p.y - 24, 'THE CASTLE STIRS', '#e08a8a');
      }

      // the wandering merchant deals in gems
      const merch = Level.props.find(pr => pr.type === 'merchant' &&
        Math.abs(p.x + p.w / 2 - (pr.x + 7)) < 26);
      game.nearMerchant = merch || null;
      if (merch && pending.up && p.onGround && !game.nearShrine) {
        game.state = 'shop';
        game.shopSel = 0;
        if (!merch.stock) merch.stock = makeShopStock();
        AudioSys.sfxPickup();
      }

      // a restless spirit finds you in the dark
      if (--game.ghostTimer <= 0) {
        const inGrave = Level.graveyard &&
          p.x > Level.graveyard.x0 - 100 && p.x < Level.graveyard.x1 + 100;
        game.ghostTimer = (inGrave ? 320 : 800) + Math.random() * (inGrave ? 260 : 500);
        const alive = game.enemies.filter(e => e instanceof Ghost && !e.remove).length;
        if (alive < 1 + (game.stage > 2 ? 1 : 0) && !game.bossActive) {
          const side = Math.random() < 0.5 ? -20 : VIEW_W + 4;
          game.enemies.push(game.applyVariant(game.makeElite(new Ghost(game.camX + side, p.y - 20))));
        }
      }

      // a guardian felled without a scratch is worth remembering
      if (game.bossActive && p.hurtTimer === 17) game.bossHitless = false;
      if (game.boss && game.boss.dead && game.boss.deathT === 1 && game.bossHitless) {
        game.feat('nohit');
      }
      if (p.windUsed) game.feat('survivor');
      if ((game.time & 31) === 0) game.checkFeats();
      if ((game.time % 600) === 0) saveRun(game);

      // ---- scene changes. Cross the edge of a scene and the picture cuts to
      // the next: the castle is walked one place at a time, in the old way.
      if (typeof sceneAt === 'function') {
        const here = sceneAt(p.x + p.w / 2);
        if (here && here !== game.scene) {
          const from = game.scene;
          game.scene = here;
          game.windThisScene = false;               // second wind returns
          game.sceneCut = 16;                       // the wipe
          game.sceneDir = !from || here.x0 >= from.x0 ? 1 : -1;
          game.sceneNameT = 190;                    // its name, held a moment
          game.camSnap = true;
          // the place is fresh: whatever you left dead in it has come back
          let woken = 0;
          for (const e of game.enemies) {
            if (e.x < here.x0 - VIEW_W || e.x > here.x1 + VIEW_W) continue;
            if (e.state === 'gone' && e.respawn !== undefined) { e.respawn = 1; woken++; }
          }
          for (let zi = 0; zi < game.zoneTimers.length; zi++) {
            const z = Level.zombieZones[zi];
            if (z && z.x1 > here.x0 && z.x0 < here.x1) game.zoneTimers[zi] = 24;
          }
          AudioSys.sfxPickup();
        }
      }

      // ---- pendulums: the works are still running, and they do not stop for you
      for (const pd of (Level.pendulums || [])) {
        pd.phase += pd.speed;
        const a = Math.sin(pd.phase) * pd.amp - Math.PI / 2;
        pd.bx = pd.x + Math.cos(a) * pd.len;
        pd.by = pd.y - Math.sin(a) * pd.len * -1;
        if (Math.abs(p.x + p.w / 2 - pd.bx) < 14 && Math.abs(p.y + p.h / 2 - pd.by) < 16) {
          if (p.damage(3, pd.bx)) game.addShake(3);
        }
      }

      // ---- blood pools: the keep drinks from whoever stands in it
      {
        const fx = Math.floor((p.x + p.w / 2) / TILE);
        const fy = Math.floor((p.y + p.h - 2) / TILE);
        if (isBlood(tileAt(fx, fy)) || isBlood(tileAt(fx, fy + 1))) {
          p.inBlood = (p.inBlood || 0) + 1;
          p.vx *= 0.86;                       // it drags at your legs
          if (p.inBlood % 40 === 0) {
            p.invuln = 0;
            p.damage(1, p.x + p.w / 2 + 1);
          }
          if ((game.time & 7) === 0) {
            spawnParticle(p.x + p.w / 2 + (Math.random() - 0.5) * 8, p.y + p.h - 2,
              (Math.random() - 0.5) * 0.3, -0.4, '#a01828', 16, 0.02);
          }
        } else p.inBlood = 0;
      }

      // ---- updraughts: shafts that breathe, so a fall becomes a glide
      p.inDraft = false;
  for (const d of (Level.drafts || [])) {
        if (p.x + p.w < d.x || p.x > d.x + d.w) continue;
        if (p.y + p.h < d.y || p.y > d.y + d.h) continue;
        p.inDraft = true;
        // holding up rides it; holding down cuts through it and sinks
        const wantsDown = keys.down || gpState.down;
        const lift = wantsDown ? 0 : (keys.up || gpState.up) ? d.force * 1.9 : d.force;
        p.vy = Math.max(-3.2, p.vy - lift);
        if (!wantsDown && p.vy > 1.4) p.vy = 1.4;
        if (wantsDown && p.vy > 3.4) p.vy = 3.4;   // still slower than open air
        p.airJumps = Math.max(p.airJumps, 1);
        p.airDashUses = 0;
        if ((game.time & 3) === 0) {
          spawnParticle(d.x + Math.random() * d.w, d.y + d.h - Math.random() * 20,
            (Math.random() - 0.5) * 0.2, -1.4 - Math.random(), '#cfc7ee', 40, 0.005);
        }
      }

      // ---- lifts: slow platforms riding the castle's hollow shafts
      for (const lf of (Level.lifts || [])) {
        const prevY = lf.y;
        lf.y += lf.dir * lf.speed;
        if (lf.y <= lf.y0) { lf.y = lf.y0; lf.dir = 1; lf.wait = 60; }
        if (lf.y >= lf.y1) { lf.y = lf.y1; lf.dir = -1; lf.wait = 60; }
        if (lf.wait > 0) { lf.wait--; lf.y = prevY; continue; }
        const dy = lf.y - prevY;
        // anything standing on the deck rides with it
        const feet = p.y + p.h;
        if (p.vy >= 0 && feet >= prevY - 6 && feet <= prevY + 10 &&
            p.x + p.w > lf.x && p.x < lf.x + lf.w) {
          p.y += dy;
          p.onGround = true;
          p.coyote = 6;
          p.vy = Math.min(p.vy, 0);
          if (p.y + p.h > lf.y) p.y = lf.y - p.h;
        }
      }

      // ---- the wards: powers that hang about the hunter
      {
        const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
        // burning / chilling / venomous rings
        const aura = p.cardFx('aura');
        if (aura && (game.time & 15) === 0) {
          for (const e of game.enemies) {
            if (e.remove || e === game.boss || !e.hitbox) continue;
            const eb = e.hitbox();
            if (Math.hypot(eb.x + eb.w / 2 - cx, eb.y + eb.h / 2 - cy) > 46) continue;
            if (p.cardFx('auraBurn') && e.hurt) e.hurt(1);
            if (p.cardFx('auraFreeze') && e.frozen !== undefined) e.frozen = Math.max(e.frozen, 30);
            if (p.cardFx('auraPoison')) e.poisoned = Math.max(e.poisoned || 0, 200);
          }
        }
        if (aura && (game.time & 3) === 0) {
          const a = game.time * 0.06;
          const col = p.cardFx('auraBurn') ? '#ff9020' : p.cardFx('auraFreeze') ? '#8ad0f0' : '#5aa04a';
          spawnParticle(cx + Math.cos(a) * 40, cy + Math.sin(a) * 26, 0, -0.2, col, 16, 0);
        }
        // tesla ward: a bolt leaps out on its own
        const boltEvery = p.cardFx('bolt');
        if (boltEvery && game.time % boltEvery === 0) {
          const near = game.enemies.filter(e => !e.remove && e !== game.boss && e.hitbox &&
            Math.abs(e.hitbox().x - cx) < 150);
          const t2 = near[(Math.random() * near.length) | 0];
          if (t2 && t2.hurt) {
            t2.hurt(3);
            const tb = t2.hitbox();
            burstRing(tb.x + tb.w / 2, tb.y + tb.h / 2, '#c07af0');
            spawnFloater(tb.x + tb.w / 2, tb.y - 6, '3', '#c07af0');
          }
        }
        // medusa ward: your gaze stiffens what watches you
        const gazeEvery = p.cardFx('gazePetrify');
        if (gazeEvery && game.time % gazeEvery === 0) {
          for (const e of game.enemies) {
            if (e.remove || e === game.boss || e.frozen === undefined || !e.hitbox) continue;
            const eb = e.hitbox();
            if (Math.abs(eb.x - cx) < 120 && Math.sign(eb.x - cx) === p.facing) {
              e.frozen = Math.max(e.frozen, 90);
              burstRing(eb.x + eb.w / 2, eb.y + eb.h / 2, '#b8c0cc');
            }
          }
        }
        // familiars: a moon shard, or a black hound
        const fam = p.cardFx('familiar');
        if (fam) {
          if (!game.familiar) game.familiar = { x: cx, y: cy, t: 0, cd: 0 };
          const f = game.familiar;
          f.t++;
          if (fam === 'moon') {
            const a = f.t * 0.07;
            f.x = cx + Math.cos(a) * 34;
            f.y = cy + Math.sin(a) * 22;
          } else {
            f.x += ((cx - p.facing * 26) - f.x) * 0.08;
            f.y += ((p.y + p.h - 6) - f.y) * 0.12;
          }
          if (f.cd > 0) f.cd--;
          if (f.cd <= 0) {
            for (const e of game.enemies) {
              if (e.remove || !e.hitbox || !e.hurt) continue;
              const eb = e.hitbox();
              if (Math.abs(eb.x + eb.w / 2 - f.x) < 14 && Math.abs(eb.y + eb.h / 2 - f.y) < 16) {
                e.hurt(fam === 'moon' ? 2 : 3);
                burst(f.x, f.y, fam === 'moon' ? ['#d8d0f0', '#f8f8ff'] : ['#c02535', '#3a2a44'], 5, 1, 0);
                f.cd = 24;
                break;
              }
            }
          }
        } else if (game.familiar) game.familiar = null;

        // saint / grace ward: wounds close on their own
        const reg = p.cardFx('regen');
        if (reg && game.time % reg === 0 && p.hp < p.maxHpTotal()) {
          p.heal(1);
          spawnFloater(cx, p.y - 6, '+1', '#8ad0a0');
        }
        // sacrifice rite: hearts spend themselves to mend you
        if (p.cardFx('sacrifice') && game.time % 150 === 0 && p.hearts >= 3 &&
            p.hp < p.maxHpTotal()) {
          p.hearts -= 3;
          p.heal(2);
          spawnFloater(cx, p.y - 6, '+2', '#e04858');
        }
      }

      // poisoned fiends wither
      for (const e of game.enemies) {
        if (e.remove || !e.poisoned) continue;
        e.poisoned--;
        if (e.poisoned % 45 === 0 && e.hurt && e.hp > 1) {
          e.hurt(1);
          if (e.hitbox) {
            const eb = e.hitbox();
            burst(eb.x + eb.w / 2, eb.y + eb.h / 2, ['#5aa04a', '#2a5424'], 3, 0.7, 0.02);
          }
        }
      }

      // combo decay
      if (game.combo.t > 0 && (!p.skills.tempo || (game.time & 1)) && --game.combo.t === 0) game.combo.n = 0;
      if (p.hurtTimer === 17) { game.combo.n = 0; game.combo.t = 0; }

      // storm wind moans over the battlements
      if (rainFactor() > 0.3 && game.time % 160 === 0) AudioSys.sfxWind();

      // vampiric edge: kills feed the hunter
      if (p.skills.vamp) {
        const q = (game.stats.kills / 4) | 0;
        if (q > game.vampQ) {
          p.heal(q - game.vampQ);
          spawnFloater(p.x + p.w / 2, p.y - 8, '+1', '#e04858');
        }
        game.vampQ = q;
      }

      // 1-5 draw a different weapon from the hunter's kit
      if (pending.weap >= 0) {
        const owned = WEAPON_KEYS.filter(k => p.weapons[k]);
        const pick = owned[pending.weap];
        if (pick) p.switchWeapon(pick);
        else if (pending.weap < WEAPON_KEYS.length) {
          spawnFloater(p.x + p.w / 2, p.y - 10, 'NOT FOUND YET', '#5c5678');
        }
      }

      // scratch a mark on the chart where you stand — or scrub the one you're on
      if (pending.markSpot) markSpot(p.x + p.w / 2, p.y + p.h / 2);

      // arcana binding menu
      if (pending.q) { game.state = 'cards'; game.cardSel = { col: 0, row: 0 }; }
      // the hunter's chart (TAB/V) and the bestiary (N)
      if (pending.map) { game.state = 'map'; game.warpSel = 0; }
      if (pending.beast) { game.state = 'bestiary'; game.beastSel = 0; }
      // relic satchel (I) — or commune with a forge (UP nearby) to craft
      if (pending.inv) {
        game.state = 'relics'; game.forgeMode = false;
        game.relicSel = 0; game.forgeMark = -1;
      }
      const forge = Level.props.find(pr => pr.type === 'forge' &&
        Math.abs(p.x + p.w / 2 - (pr.x + 8)) < 26);
      game.nearForge = forge || null;
      if (forge && pending.q && p.onGround) {
        game.state = 'craft'; game.craftSel = 0; game.craftScroll = 0;
        AudioSys.sfxPickup();
      } else if (forge && pending.up && p.onGround && !game.nearShrine) {
        game.state = 'relics'; game.forgeMode = true;
        game.relicSel = 0; game.forgeMark = -1;
        AudioSys.sfxPickup();
      }

      // golden keys turn golden locks
      if (p.keys > 0) {
        outer:
        for (const [cx, cy] of [
          [p.x - 3, p.y + 6], [p.x + p.w + 3, p.y + 6],
          [p.x - 3, p.y + p.h - 4], [p.x + p.w + 3, p.y + p.h - 4],
        ]) {
          const tx = Math.floor(cx / TILE), ty = Math.floor(cy / TILE);
          if (tileAt(tx, ty) === 12) {
            p.keys--;
            game.feat('lockpick');
            for (let yy = 0; yy < LEVEL_H; yy++) {
              if (tileAt(tx, yy) === 12) {
                tset(tx, yy, 0);
                burst(tx * TILE + 8, yy * TILE + 8, ['#ffe080', '#d8a848'], 10, 1.4, 0.05);
              }
            }
            game.addShake(2);
            AudioSys.sfxItem();
            spawnFloater(tx * TILE + 8, p.y - 10, 'UNLOCKED', '#ffe080');
            break outer;
          }
        }
      }

      // chart the castle as it scrolls past
      // Fog lifts only where the hunter has actually been able to see — a column
      // is not a place. Climbing a tower must not reveal the cellar beneath it.
      if (game.explored) {
        const t0 = Math.max(0, Math.floor(game.camX / TILE));
        const t1 = Math.min(LEVEL_W - 1, Math.ceil((game.camX + VIEW_W) / TILE));
        const r0 = Math.max(0, Math.floor(game.camY / TILE));
        const r1 = Math.min(LEVEL_H - 1, Math.ceil((game.camY + VIEW_H) / TILE));
        for (let ty = r0; ty <= r1; ty++) {
          const row = ty * LEVEL_W;
          for (let tx = t0; tx <= t1; tx++) game.explored[row + tx] = 1;
        }
        // and a little farther around the hunter, for the dark just past the lamp
        const px = Math.floor((p.x + p.w / 2) / TILE), py = Math.floor((p.y + p.h / 2) / TILE);
        for (let dy = -5; dy <= 5; dy++) {
          for (let dx = -7; dx <= 7; dx++) {
            const tx = px + dx, ty = py + dy;
            if (tx < 0 || ty < 0 || tx >= LEVEL_W || ty >= LEVEL_H) continue;
            game.explored[ty * LEVEL_W + tx] = 1;
          }
        }
      }

      if (game.mode === 'rush') {
        game.rushT++;
        if (game.boss.dead && game.boss.deathT > 90) {
          game.rushIndex++;
          if (game.rushIndex >= 3) {
            game.state = 'win';
            game.feat('rushclear');
            if (!meta.rushBest || game.rushT < meta.rushBest) {
              meta.rushBest = game.rushT;
              saveMeta();
            }
            AudioSys.stopMusic();
            AudioSys.sfxClear();
          } else {
            game.boss = new (RUSH_BOSSES()[game.rushIndex])(Level.boss);
            game.boss.start();
            game.bossPrevDead = false;
            p.heal(8);
            p.hearts += 10;
            spawnFloater(p.x + p.w / 2, p.y - 14, 'NEXT GUARDIAN', '#c07af0');
          }
        }
      }

      updateBossFlow();
      checkSecrets();
      handleProjectiles();
      for (const ep of game.enemyProjectiles) {
        if (ep.remove) continue;
        ep.update();
        if (!ep.remove && !p.dead && overlap(ep.hitbox(), p.hitbox())) {
          if (p.damage(ep.dmg, ep.x + 7)) {
            burst(ep.x + 7, ep.y + 6, ['#ff9020', '#ffd858'], 8, 1.4, 0.02);
          }
          ep.remove = true;
        }
      }
      game.enemyProjectiles = game.enemyProjectiles.filter(ep => !ep.remove);
      handleCombat();
      updateFloaters();
      if (game.card && --game.card.t <= 0) game.card = null;
      updateParticles();
      updateMotes();
      updateAmbientSpecks();
      updateWeather();
      updateCamera();
      if (game.stageBanner > 0) game.stageBanner--;

      if (p.dead) {
        game.state = 'dying';
        game.dyingT = 0;
        game.card = null;
        AudioSys.stopMusic();
        AudioSys.sfxDeath();
      }
    }
  } else if (game.state === 'cards') {
    const sel = game.cardSel, p = game.player;
    if (pending.leftN) sel.col = 0;
    if (pending.rightN) sel.col = 1;
    const list = sel.col === 0 ? CARD_ACTIONS : CARD_ATTRS;
    if (pending.up) sel.row = (sel.row + list.length - 1) % list.length;
    if (pending.downN) sel.row = (sel.row + 1) % list.length;
    if (sel.row >= list.length) sel.row = list.length - 1;
    if (pending.whip) {
      const key = list[sel.row];
      if (p.cards[key]) {
        if (sel.col === 0) p.cardAction = p.cardAction === key ? null : key;
        else p.cardAttr = p.cardAttr === key ? null : key;
        if (p.cardAction && p.cardAttr) {
          if (!meta.pairs) meta.pairs = {};
          meta.pairs[p.cardAction + '+' + p.cardAttr] = 1;
          saveMeta();
        }
        AudioSys.sfxPickup();
      } else AudioSys.sfxHit();
    }
    if (pending.q || pending.enter || pending.dash) game.state = 'play';
  } else if (game.state === 'relics') {
    const p = game.player;
    const total = 3 + p.bag.length;
    if (pending.up) game.relicSel = (game.relicSel + total - 1) % total;
    if (pending.downN) game.relicSel = (game.relicSel + 1) % total;
    const sel = game.relicSel;
    if (pending.whip) {           // Z: equip / unequip
      if (sel < 3) {
        if (p.relics[sel] && p.bag.length < 8) {
          p.bag.push(p.relics[sel]); p.relics[sel] = null;
          AudioSys.sfxPickup();
        } else if (p.relics[sel]) AudioSys.sfxHit();
      } else {
        const r = p.bag[sel - 3];
        const slot = p.relics.indexOf(null);
        if (r && slot >= 0) {
          p.relics[slot] = r; p.bag.splice(sel - 3, 1);
          AudioSys.sfxItem();
        } else if (r) {
          const swap = p.relics[0];
          p.relics[0] = r; p.bag[sel - 3] = swap;
          AudioSys.sfxItem();
        }
      }
      p.hp = Math.min(p.hp, p.maxHpTotal());
      if (game.forgeMark >= p.bag.length) game.forgeMark = -1;
    }
    if (pending.jump && sel >= 3) {   // X: salvage into essence
      const r = p.bag[sel - 3];
      if (r) {
        p.bag.splice(sel - 3, 1);
        meta.essence += r.tier * 2 + 1 + p.perkRank('refinement');
        saveMeta();
        AudioSys.sfxCandle();
        if (game.relicSel >= 3 + p.bag.length) game.relicSel = Math.max(0, 3 + p.bag.length - 1);
        game.forgeMark = -1;
      }
    }
    if (pending.dash && game.forgeMode && sel >= 3) {   // C: transmute two into one
      const idx = sel - 3;
      if (game.forgeMark < 0) {
        if (p.bag[idx]) { game.forgeMark = idx; AudioSys.sfxPickup(); }
      } else if (game.forgeMark !== idx && p.bag[idx]) {
        const a = p.bag[game.forgeMark], b = p.bag[idx];
        const tier = Math.min(5, Math.max(a.tier, b.tier) +
          (a.tier === b.tier && Math.random() < 0.4 ? 1 : 0));
        const crafted = {
          base: (Math.random() * RELIC_BASES.length) | 0,
          pre: a.pre, suf: b.suf, tier,
        };
        p.bag = p.bag.filter((_, i) => i !== game.forgeMark && i !== idx);
        p.bag.push(crafted);
        game.forgeMark = -1;
        game.relicSel = 3 + p.bag.length - 1;
        game.showCard(relicIcon(crafted), relicName(crafted), relicStatsText(crafted));
        burst(p.x + p.w / 2, p.y + 6, ['#ff9020', '#ffe080', '#c07af0'], 12, 1.4, -0.02);
        AudioSys.sfxCrash();
      }
    }
    if (pending.crash && game.forgeMode) {   // E: forge a relic from essence
      if (meta.essence >= 12 && p.bag.length < 8) {
        meta.essence -= 12;
        saveMeta();
        const roll = Math.random();
        const crafted = rollRelic(roll < 0.15 ? 1.9 : roll < 0.6 ? 0.9 : 0.2);
        p.bag.push(crafted);
        game.relicSel = 3 + p.bag.length - 1;
        game.showCard(relicIcon(crafted), relicName(crafted), relicStatsText(crafted));
        AudioSys.sfxItem();
      } else AudioSys.sfxHit();
    }
    if (pending.q && game.forgeMode) {   // Q: work an infusion oil (8 essence)
      if (meta.essence >= 8 && p.subWeapon) {
        meta.essence -= 8;
        saveMeta();
        const oilKeys = Object.keys(INFUSIONS);
        p.subInfusion = oilKeys[(Math.random() * oilKeys.length) | 0];
        const inf = INFUSIONS[p.subInfusion];
        game.showCard(SUBWEAPONS[p.subWeapon].icon(),
          inf.name + ' ' + SUBWEAPONS[p.subWeapon].name, inf.desc);
        burst(p.x + p.w / 2, p.y + 6, [inf.color, '#f8f8ff'], 12, 1.4, -0.02);
        AudioSys.sfxCrash();
      } else AudioSys.sfxHit();
      pending.q = false;
    }
    if (pending.inv || pending.enter || pending.q) game.state = 'play';
  } else if (game.state === 'map') {
    if (pending.markSpot && game.player) {
      markSpot(game.player.x + game.player.w / 2, game.player.y + game.player.h / 2);
    }
    if (pending.map || pending.enter || pending.q) game.state = 'play';
    // warp between woken obelisks straight from the chart
    const lit = litObelisks();
    if (lit.length) {
      if (pending.leftN) game.warpSel = (game.warpSel + lit.length - 1) % lit.length;
      if (pending.rightN) game.warpSel = (game.warpSel + 1) % lit.length;
      if (pending.whip || pending.jump) {
        const ob = lit[game.warpSel % lit.length];
        if (ob) { warpTo(ob); game.state = 'play'; }
      }
    }
  } else if (game.state === 'bestiary') {
    if (pending.up) game.beastSel = Math.max(0, (game.beastSel || 0) - 1);
    if (pending.downN) game.beastSel = Math.min(BESTIARY_SPECIES.length - 1, (game.beastSel || 0) + 1);
    if (pending.beast || pending.enter || pending.q) {
      game.state = game.player ? 'play' : 'title';
    }
  } else if (game.state === 'shrine') {
    if (pending.up) game.shrineSel = (game.shrineSel + SKILLS.length - 1) % SKILLS.length;
    if (pending.downN) game.shrineSel = (game.shrineSel + 1) % SKILLS.length;
    if (pending.whip) {
      const sk = SKILLS[game.shrineSel];
      const p = game.player;
      if (!p.skills[sk.key] && p.hearts >= sk.cost && (!sk.req || p.skills[sk.req])) {
        p.hearts -= sk.cost;
        p.skills[sk.key] = true;
        game.stats.items++;
        game.showCard(Sprites.emblem, sk.name, sk.desc);
        AudioSys.sfxItem();
        burst(p.x + p.w / 2, p.y + 10, ['#ffe080', '#f8f8ff'], 12, 1.4, -0.02);
      } else {
        AudioSys.sfxHit();
      }
    }
    if (pending.enter || pending.dash) game.state = 'play';
  } else if (game.state === 'craft') {
    // the matrix is laid out by the drawing pass; move through it as a grid
    const cells = game.craftLayout || [];
    const cur = cells[game.craftSel];
    const moveTo = (pred) => {
      const hit = cells.findIndex(pred);
      if (hit >= 0) game.craftSel = hit;
    };
    if (cur) {
      if (pending.leftN) {
        if (game.craftSel > 0) game.craftSel--;
      }
      if (pending.rightN) {
        if (game.craftSel < cells.length - 1) game.craftSel++;
      }
      if (pending.up) {
        // the same column, one row up — across category headers if need be
        const above = cells.filter(c => c.y < cur.y);
        if (above.length) {
          const bestY = Math.max(...above.map(c => c.y));
          const row = above.filter(c => c.y === bestY);
          let best = row[0];
          for (const c of row) if (Math.abs(c.x - cur.x) < Math.abs(best.x - cur.x)) best = c;
          moveTo(c => c === best);
        }
      }
      if (pending.downN) {
        const below = cells.filter(c => c.y > cur.y);
        if (below.length) {
          const bestY = Math.min(...below.map(c => c.y));
          const row = below.filter(c => c.y === bestY);
          let best = row[0];
          for (const c of row) if (Math.abs(c.x - cur.x) < Math.abs(best.x - cur.x)) best = c;
          moveTo(c => c === best);
        }
      }
      if (pending.whip) craft(cur.rec);
    } else {
      if (pending.leftN || pending.up) game.craftSel = Math.max(0, game.craftSel - 1);
      if (pending.rightN || pending.downN) game.craftSel = Math.min(RECIPES.length - 1, game.craftSel + 1);
      if (pending.whip) craft(RECIPES[game.craftSel]);
    }
    if (pending.enter || pending.q || pending.dash) game.state = 'play';
  } else if (game.state === 'crossroads') {
    const n = game.pathOffer.length;
    game.pathT = (game.pathT || 0) + 1;
    if (pending.leftN) game.pathSel = (game.pathSel + n - 1) % n;
    if (pending.rightN) game.pathSel = (game.pathSel + 1) % n;
    // don't let the keypress that opened this screen also choose the road
    if (game.pathT > 6 && (pending.enter || pending.whip || pending.jump)) {
      game.path = game.pathOffer[game.pathSel];
      const p = game.player;
      if (game.path.mods.hp) { p.maxHp += 4; p.heal(4); }
      if (game.path.mods.hearts) p.hearts += 15;
      advanceStage();
    }
  } else if (game.state === 'shop') {
    const merch = game.nearMerchant;
    const stock = merch && merch.stock ? merch.stock : [];
    if (pending.leftN) game.shopSel = (game.shopSel + stock.length - 1) % Math.max(1, stock.length);
    if (pending.rightN) game.shopSel = (game.shopSel + 1) % Math.max(1, stock.length);
    if (pending.up) game.shopSel = (game.shopSel + stock.length - 1) % Math.max(1, stock.length);
    if (pending.downN) game.shopSel = (game.shopSel + 1) % Math.max(1, stock.length);
    if (pending.whip) buyItem(game.shopSel);
    if (pending.enter || pending.q || pending.dash) game.state = 'play';
  } else if (game.state === 'feats') {
    if (pending.enter || pending.q || pending.dash || pending.feats) {
      game.state = game.featFrom === 'pause' ? 'pause' : 'title';
    }
  } else if (game.state === 'ending') {
    game.endT = (game.endT || 0) + 1;
  } else if (game.state === 'dying') {
    game.dyingT++;
    updateParticles();
    if (game.dyingT === 40) {
      const p = game.player;
      burst(p.x + p.w / 2, Math.min(p.y + 10, game.camY + VIEW_H - 10),
        ['#e04858', '#a32c38', '#f8f8ff', '#ffe080'], 24, 2, 0.02);
    }
    if (game.dyingT > 140) { game.state = 'gameover'; saveHiScore(); meta.kills += game.stats.kills; saveMeta(); }
  } else if (game.state === 'win') {
    updateParticles();
    if (game.victoryOrb) game.victoryOrb.update();
  }

  if (game.watchFlash > 0) game.watchFlash--;
  if (game.crashFlash > 0) game.crashFlash--;
  if (game.fadeT > 0) game.fadeT--;
  if (game.sceneCut > 0) game.sceneCut--;
  if (game.sceneNameT > 0) game.sceneNameT--;
  if (game.shake > 0) game.shake *= 0.88;
  pending.jump = pending.whip = pending.dash = pending.enter = pending.up = pending.downN = pending.leftN = pending.rightN = pending.q = pending.crash = pending.inv = pending.map = pending.rush = pending.beast = false;
  pending.feats = pending.daily = pending.cont = false;
  pending.weap = -1;
  pending.markSpot = false;
  pending.erase = false;
}

// ---------------------------------------------------------------- drawing
function drawWorld(g) {
  const shX = game.shake > 0.5 ? (Math.random() - 0.5) * game.shake : 0;
  const shY = game.shake > 0.5 ? (Math.random() - 0.5) * game.shake : 0;
  const camX = Math.round(game.camX + shX), camY = Math.round(game.camY + shY);

  // the sky (or lack of it) belongs to the zone the hunter stands in
  const zone = typeof zoneAt === 'function' ? zoneAt(game.player ? game.player.x : camX) : null;
  const biome = zone ? zone.biome : 'castle';
  drawBackground(g, camX, camY, game.time, false, biome);
  drawProps(g, camX, camY, game.time);
  drawObelisks(g, camX, camY, game.time);
  drawSigils(g, camX, camY, game.time);
  // warded doors: sealed light across the way onward
  for (const gt of (Level.gates || [])) {
    if (gt.open) continue;
    const dx = gt.tx * TILE - camX;
    if (dx < -30 || dx > VIEW_W + 30) continue;
    const ty0 = gt.top * TILE - camY, hh = (gt.bottom - gt.top + 1) * TILE;
    g.fillStyle = '#1a1626';
    g.fillRect(dx, ty0, TILE, hh);
    const pulse = 0.35 + 0.2 * Math.sin(game.time * 0.06);
    g.fillStyle = `rgba(216,168,72,${pulse.toFixed(2)})`;
    for (let by = 0; by < hh; by += 8) g.fillRect(dx + 2, ty0 + by, TILE - 4, 3);
    g.fillStyle = '#d8a848';
    g.fillRect(dx, ty0, TILE, 2);
    g.fillRect(dx, ty0 + hh - 2, TILE, 2);
    // the sigil of what it wants, burning in the middle of the door
    const my = ty0 + hh / 2;
    g.fillStyle = `rgba(255,224,128,${(0.6 + 0.3 * Math.sin(game.time * 0.09)).toFixed(2)})`;
    if (gt.need === 'wings') {
      g.fillRect(dx + 3, my, 10, 2); g.fillRect(dx + 5, my - 3, 2, 3); g.fillRect(dx + 9, my - 3, 2, 3);
    } else if (gt.need === 'maw') {
      g.fillRect(dx + 7, my - 5, 2, 8); g.fillRect(dx + 4, my + 2, 8, 2); g.fillRect(dx + 6, my + 4, 4, 2);
    } else {
      g.fillRect(dx + 4, my - 4, 2, 9); g.fillRect(dx + 10, my - 4, 2, 9); g.fillRect(dx + 6, my, 4, 2);
    }
  }
  drawTiles(g, camX, camY);
  for (const pd of (Level.pendulums || [])) {
    const ax = Math.floor(pd.x - camX), ay = Math.floor(pd.y - camY);
    if (ax < -140 || ax > VIEW_W + 140) continue;
    const bx = Math.floor((pd.bx !== undefined ? pd.bx : pd.x) - camX);
    const by = Math.floor((pd.by !== undefined ? pd.by : pd.y + pd.len) - camY);
    // the rod
    const steps = Math.max(4, Math.round(pd.len / 6));
    for (let i = 0; i <= steps; i++) {
      const t2 = i / steps;
      g.fillStyle = i === steps ? '#8f8c9e' : '#56526e';
      g.fillRect(Math.round(ax + (bx - ax) * t2) - 1, Math.round(ay + (by - ay) * t2) - 1, 2, 2);
    }
    // the pivot, and the blade at the end
    g.fillStyle = '#3c3850';
    g.fillRect(ax - 3, ay - 3, 6, 6);
    g.fillStyle = '#d8a848';
    g.fillRect(ax - 1, ay - 1, 2, 2);
    g.fillStyle = '#b8c0cc';
    g.fillRect(bx - 9, by - 3, 18, 6);
    g.fillRect(bx - 6, by - 6, 12, 12);
    g.fillStyle = '#f0f4ff';
    g.fillRect(bx - 8, by - 2, 16, 2);
    g.fillStyle = '#5c5678';
    g.fillRect(bx - 2, by - 2, 4, 4);
  }
  for (const d of (Level.drafts || [])) {
    const dx = Math.floor(d.x - camX), dy = Math.floor(d.y - camY);
    if (dx > VIEW_W + 40 || dx + d.w < -40) continue;
    const a = 0.05 + 0.02 * Math.sin(game.time * 0.05);
    g.fillStyle = `rgba(200,195,240,${a.toFixed(3)})`;
    g.fillRect(dx, dy, d.w, d.h);
    // faint updraught lines streaming upward
    for (let i = 0; i < 5; i++) {
      const lx = dx + 6 + i * (d.w - 12) / 4;
      const off = (game.time * 2.2 + i * 37) % (d.h + 40);
      g.fillStyle = 'rgba(216,208,240,0.14)';
      g.fillRect(lx, dy + d.h - off, 1, 14);
    }
  }
  for (const lf of (Level.lifts || [])) {
    const lx = Math.floor(lf.x - camX), ly = Math.floor(lf.y - camY);
    if (lx < -80 || lx > VIEW_W + 80) continue;
    // the chain it hangs from, running up into the dark
    g.fillStyle = '#3c3c50';
    for (let cy = ly - 4; cy > ly - 400 && cy > -camY - 20; cy -= 6) {
      g.fillRect(lx + lf.w / 2 - 1, cy, 2, 3);
    }
    g.fillStyle = '#2a2438';
    g.fillRect(lx, ly, lf.w, lf.h);
    g.fillStyle = '#6f6c80';
    g.fillRect(lx, ly, lf.w, 2);
    g.fillStyle = '#8f8c9e';
    g.fillRect(lx + 1, ly, 3, 1); g.fillRect(lx + lf.w - 4, ly, 3, 1);
    g.fillStyle = '#d8a848';
    g.fillRect(lx + lf.w / 2 - 2, ly - 2, 4, 2);
  }
  drawMotes(g);
  // buried treasure betrays itself with the faintest sparkle
  if (Level.glimmers) {
    for (const gl of Level.glimmers) {
      if (gl.found) continue;
      if (((game.time + (gl.x | 0)) % 47) < 4) {
        g.fillStyle = '#fff8e0';
        g.fillRect(Math.floor(gl.x + ((game.time * 7 + gl.x) % 9) - 4 - camX),
          Math.floor(gl.y - 3 - ((game.time * 3) % 6) - camY), 1, 1);
      }
    }
  }
  for (const c of game.candles) c.draw(g, camX, camY);
  for (const pk of game.pickups) pk.draw(g, camX, camY);
  if (game.victoryOrb) game.victoryOrb.draw(g, camX, camY);
  for (const e of game.enemies) {
    if (e.variant && e.variant.shadow) g.globalAlpha = 0.6;
    e.draw(g, camX, camY);
    g.globalAlpha = 1;
    if (e.variant && !e.remove && e.state !== 'gone') {
      const hb = e.hitbox();
      g.fillStyle = e.variant.color + '1c';
      g.beginPath();
      g.arc(Math.floor(hb.x + hb.w / 2 - camX), Math.floor(hb.y + hb.h / 2 - camY),
        Math.max(hb.w, hb.h) * 0.45, 0, 7);
      g.fill();
    }
    if (e.elite && !e.remove && e.state !== 'gone') {
      const hb = e.hitbox();
      g.fillStyle = `rgba(192,122,240,${(0.08 + 0.04 * Math.sin(game.time * 0.15)).toFixed(3)})`;
      g.beginPath();
      g.arc(Math.floor(hb.x + hb.w / 2 - camX), Math.floor(hb.y + hb.h / 2 - camY),
        Math.max(hb.w, hb.h) * 0.55, 0, 7);
      g.fill();
    }
  }
  for (const pr of game.projectiles) pr.draw(g, camX, camY);
  for (const ep of game.enemyProjectiles) ep.draw(g, camX, camY);
  if (game.bossActive) {
    if (game.boss.enraged && !game.boss.dead) {
      const hb = game.boss.hitbox();
      g.fillStyle = `rgba(224,64,64,${(0.08 + 0.05 * Math.sin(game.time * 0.2)).toFixed(3)})`;
      g.beginPath();
      g.arc(Math.floor(hb.x + hb.w / 2 - camX), Math.floor(hb.y + hb.h / 2 - camY),
        Math.max(hb.w, hb.h) * 0.85, 0, 7);
      g.fill();
    }
    game.boss.draw(g, camX, camY);
  }
  if (game.state !== 'dying' || game.dyingT < 40) {
  if (game.state === 'dying') {
      const p = game.player;
      if (game.dyingT & 2) {
        drawSheetFrame(g, Sheets.heroHurt, 2,
          p.x + p.w / 2 - camX, p.y + p.h - camY, p.facing < 0, true);
      }
    } else {
      // weapon aura: special weapons cast a subtle glow around the hunter
      const p = game.player;
      const wd = p.weaponDef();
      if (wd && (wd.burns || wd.holy || wd.shadow || wd.short === 'VOID' || wd.short === 'LUNA' || wd.short === 'SUN')) {
        const auraColor = wd.burns ? '255,128,48' : wd.holy ? '255,224,128' : '122,90,192';
        const a = 0.06 + 0.03 * Math.sin(game.time * 0.12);
        g.fillStyle = 'rgba(' + auraColor + ',' + a.toFixed(4) + ')';
        g.beginPath();
        g.arc(Math.floor(p.x + p.w / 2 - camX), Math.floor(p.y + p.h / 2 - camY), 32, 0, 7);
        g.fill();
      }
      game.player.draw(g, camX, camY);
    }
  }
  // forge hint
  if (game.nearForge && game.state === 'play') {
    const bob = Math.round(Math.sin(game.time * 0.08) * 2);
    drawTextCentered(g, 'UP  FORGE',
      Math.floor(game.nearForge.x + 8 - camX),
      Math.floor(game.nearForge.y - 28 - camY) + bob, '#ff9e50', 1);
  }
  // prayer hint over a nearby shrine
  if (game.nearShrine && game.state === 'play') {
    const bob = Math.round(Math.sin(game.time * 0.08) * 2);
    drawTextCentered(g, 'UP  PRAY',
      Math.floor(game.nearShrine.x + 8 - camX),
      Math.floor(game.nearShrine.y - 56 - camY) + bob, '#ffe080', 1);
  }
  if (game.familiar && game.player) {
    const f = game.familiar;
    const moon = game.player.cardFx('familiar') === 'moon';
    const fx2 = Math.floor(f.x - camX), fy2 = Math.floor(f.y - camY);
    g.fillStyle = moon ? 'rgba(216,208,240,0.16)' : 'rgba(192,37,53,0.14)';
    g.beginPath(); g.arc(fx2, fy2, 12, 0, 7); g.fill();
    if (moon) {
      g.fillStyle = '#e8e4f8'; g.fillRect(fx2 - 3, fy2 - 3, 6, 6);
      g.fillStyle = '#b8b0d8'; g.fillRect(fx2 - 1, fy2 - 1, 3, 3);
    } else {
      g.drawImage(Sprites.bat.dark1 || Sprites.soul, fx2 - 5, fy2 - 4);
      g.fillStyle = '#c02535'; g.fillRect(fx2 - 4, fy2 - 2, 2, 2); g.fillRect(fx2 + 2, fy2 - 2, 2, 2);
    }
  }
  for (const m of (game.marks || [])) {
    const mx2 = Math.floor(m.x - camX), my2 = Math.floor(m.y - camY);
    if (mx2 < -20 || mx2 > VIEW_W + 20) continue;
    const a = 0.35 + 0.15 * Math.sin(game.time * 0.05 + m.x);
    g.fillStyle = `rgba(240,234,216,${a.toFixed(2)})`;
    if (m.kind === 0) { g.fillRect(mx2 - 4, my2, 9, 1); g.fillRect(mx2, my2 - 4, 1, 9); }
    else if (m.kind === 1) { g.fillRect(mx2 - 4, my2 - 4, 9, 1); g.fillRect(mx2 - 4, my2 + 4, 9, 1); g.fillRect(mx2 - 4, my2 - 4, 1, 9); g.fillRect(mx2 + 4, my2 - 4, 1, 9); }
    else if (m.kind === 2) { g.fillRect(mx2, my2 - 5, 1, 10); g.fillRect(mx2 - 2, my2 - 3, 5, 1); }
    else { g.fillRect(mx2 - 4, my2 + 4, 9, 1); g.fillRect(mx2 - 2, my2, 5, 1); g.fillRect(mx2, my2 - 4, 1, 1); }
  }
  drawParticles(g, camX, camY);
  drawFloaters(g, camX, camY);
  drawGate(g, camX, camY);
  drawRain(g, camX, camY);
  drawAmbientSpecks(g, camX, camY);
  drawFog(g, camX, camY, game.time);
  // color grading + vignette
  g.fillStyle = 'rgba(26,14,46,0.10)';
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  drawVignette(g);
  drawLightningFlash(g);
  if (game.watchFlash > 0) {
    g.fillStyle = `rgba(140,190,255,${(0.02 * game.watchFlash).toFixed(3)})`;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  if (game.crashFlash > 0) {
    g.fillStyle = `rgba(255,215,110,${(0.018 * game.crashFlash).toFixed(3)})`;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  if (game.stage % 3 === 0) {
    g.fillStyle = 'rgba(120,20,20,0.06)';   // the blood moon stains everything
    g.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  if (game.cursed('gloom')) {
    g.fillStyle = 'rgba(4,2,10,0.22)';
    g.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  // damage flash
  if (game.player && game.player.hurtTimer > 14) {
    g.fillStyle = 'rgba(190,30,40,0.16)';
    g.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  // low-health pulse: a red heartbeat at the edges of the screen
  if (game.player && game.player.hp <= game.player.maxHpTotal() * 0.3 && !game.player.dead) {
    const pct = game.player.hp / game.player.maxHpTotal();
    const pulse = 0.08 + 0.04 * Math.sin(game.time * 0.12) * (1 - pct);
    g.fillStyle = `rgba(180,20,30,${pulse.toFixed(4)})`;
    const edge = Math.round(VIEW_H * (0.4 - pct * 0.3));
    g.fillRect(0, 0, VIEW_W, edge);
    g.fillRect(0, VIEW_H - edge, VIEW_W, edge);
  }
  // poison green tinge when afflicted
  if (game.player && game.player.poisonT > 0) {
    const poisonAlpha = 0.04 + 0.02 * Math.sin(game.time * 0.09);
    g.fillStyle = `rgba(40,100,30,${poisonAlpha.toFixed(4)})`;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  // high combo golden glow
  if (game.combo.n >= 6) {
    const comboAlpha = 0.02 + 0.01 * Math.min(3, (game.combo.n - 3) / 3) * Math.sin(game.time * 0.08);
    g.fillStyle = `rgba(255,210,100,${comboAlpha.toFixed(4)})`;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

function drawFrame() {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);

  if (game.state === 'title') { drawTitle(ctx); return; }
  if (game.state === 'bestiary' && !game.player) {
    drawTitle(ctx);
    drawBestiary(ctx);
    return;
  }

  drawWorld(ctx);
  // full-screen ceremonies stand alone; no HUD over them
  const CEREMONY = ['crossroads', 'ending', 'feats', 'title', 'craft', 'bestiary', 'pause'];
  if (!CEREMONY.includes(game.state)) drawHUD(ctx);
  if (!CEREMONY.includes(game.state)) drawCard(ctx);

  if (game.stageBanner > 0 && game.state === 'play') {
    if (game.stageBanner > 30 || (game.stageBanner & 4)) {
      drawTextCentered(ctx, 'STAGE ' + game.stage, VIEW_W / 2, CY + 64, '#e8e4d8', 2);
      drawTextCentered(ctx, STAGE_NAMES[(game.stage - 1) % STAGE_NAMES.length], VIEW_W / 2, CY + 82, '#8a83a8', 1);
    }
  }

  if (game.state === 'pause') drawPauseScreen(ctx);

  if (game.state === 'shrine') drawShrineMenu(ctx);
  if (game.state === 'cards') drawCardsMenu(ctx);
  if (game.state === 'relics') drawRelicMenu(ctx);
  if (game.state === 'map') drawMapScreen(ctx);
  if (game.state === 'bestiary') drawBestiary(ctx);
  if (game.state === 'craft') drawCraftMenu(ctx);
  if (game.state === 'crossroads') drawCrossroads(ctx);
  if (game.state === 'shop') drawShop(ctx);
  if (game.state === 'feats') drawFeats(ctx);
  if (game.state === 'ending') drawEnding(ctx);
  if (!CEREMONY.includes(game.state)) drawSceneCut(ctx);
  if (game.debug) drawDebugOverlay(ctx);

  if (game.fadeT > 0 && game.state !== 'title') {
    ctx.fillStyle = `rgba(0,0,0,${(game.fadeT / 30).toFixed(3)})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  if (game.state === 'gameover') {
    ctx.fillStyle = 'rgba(8,6,15,0.78)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const s = game.stats;
    drawTextCentered(ctx, 'THE HUNT ENDS', VIEW_W / 2, CY + 54, '#c92c38', 2);
    ctx.fillStyle = '#8a6d2f'; ctx.fillRect(VIEW_W / 2 - 50, CY + 72, 100, 1);
    drawTextCentered(ctx, 'SCORE ' + String(game.score).padStart(6, '0'), VIEW_W / 2, CY + 80, '#e8e4d8', 1);
    drawTextCentered(ctx, 'KILLS ' + s.kills + '   CANDLES ' + s.candles, VIEW_W / 2, CY + 94, '#8a83a8', 1);
    drawTextCentered(ctx, 'SEALED CHAMBERS FOUND ' + (game.secretsFound || 0) + ' OF ' +
      ((Level.secrets || []).length), VIEW_W / 2, CY + 106, '#8a83a8', 1);
    drawTextCentered(ctx, 'ITEMS ' + s.items + '   SOULS ' + s.souls, VIEW_W / 2, CY + 104, '#8a83a8', 1);
    drawTextCentered(ctx, 'BEST ' + String(hiScore).padStart(6, '0') + '   ALL IS LOST WITH DEATH', VIEW_W / 2, CY + 118, '#5c5678', 1);
    if ((game.time >> 5) & 1) drawTextCentered(ctx, 'PRESS ENTER TO HUNT AGAIN', VIEW_W / 2, CY + 136, '#ffe080', 1);
  }

  if (game.state === 'win' && game.mode === 'rush') {
    ctx.fillStyle = 'rgba(8,6,15,0.65)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    drawTextCentered(ctx, 'BOSS RUSH COMPLETE', VIEW_W / 2, CY + 56, '#ffe080', 2);
    drawTextCentered(ctx, 'TIME ' + fmtTime(game.rushT), VIEW_W / 2, CY + 84, '#e8e4d8', 1);
    drawTextCentered(ctx, 'BEST ' + fmtTime(meta.rushBest || game.rushT), VIEW_W / 2, CY + 96, '#c07af0', 1);
    if ((game.time >> 5) & 1) drawTextCentered(ctx, 'PRESS ENTER', VIEW_W / 2, CY + 120, '#ffe080', 1);
  } else if (game.state === 'win') {
    ctx.fillStyle = 'rgba(8,6,15,0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const s = game.stats;
    drawTextCentered(ctx, 'STAGE ' + game.stage + ' CLEAR!', VIEW_W / 2, CY + 52, '#ffe080', 2);
    drawTextCentered(ctx, 'THE CASTLE RESHAPES ITSELF BELOW', VIEW_W / 2, CY + 76, '#8a83a8', 1);
    drawTextCentered(ctx, 'SCORE ' + String(game.score).padStart(6, '0'), VIEW_W / 2, CY + 94, '#e8e4d8', 1);
    drawTextCentered(ctx, 'KILLS ' + s.kills + '   ITEMS ' + s.items + '   SOULS ' + s.souls, VIEW_W / 2, CY + 106, '#e8e4d8', 1);
    if ((game.time >> 5) & 1) drawTextCentered(ctx, 'PRESS ENTER TO DESCEND', VIEW_W / 2, CY + 128, '#ffe080', 1);
  }
}

// ---------------------------------------------------------------- main loop
let lastT = 0, acc = 0, fpsAcc = 0, fpsN = 0;
function loop(t) {
  requestAnimationFrame(loop);
  if (!Assets.ready) {
    ctx.fillStyle = '#08060f';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    drawTextCentered(ctx, 'LOADING', VIEW_W / 2, VIEW_H / 2 - 4, '#8a83a8', 1);
    return;
  }
  if (!lastT) lastT = t;
  let dt = t - lastT;
  lastT = t;
  fpsAcc += dt; fpsN++;
  if (fpsAcc >= 500) {
    game.fps = Math.round(1000 / (fpsAcc / fpsN));
    fpsAcc = 0; fpsN = 0;
  }
  if (dt > 100) dt = 100;
  acc += dt;
  while (acc >= 1000 / 60) {
    stepGame();
    acc -= 1000 / 60;
  }
  drawFrame();
}

initSprites();
buildLevel();
window.__gameReady = loadAssets().then(() => {
  initAssetSprites();
}).catch(err => {
  console.error(err);
  window.__assetError = String(err);
});
requestAnimationFrame(loop);
