// Central tunables and content registries. Adding content usually means
// adding an entry here plus (for weapons) a projectile class.

// internal render resolution
const VIEW_W = 960, VIEW_H = 540;

// physics
const GRAV = 0.22, MAX_FALL = 5.5;
const RUN_SPEED = 1.6;

// blade progression
const WHIP_LEN = [0, 26, 30, 35];
const WHIP_DMG = [0, 2, 3, 4];

// ---------------------------------------------------------------- main weapons
// Each is a different way to hold the night at arm's length. `len`/`dmg` are
// indexed by temper level (1-3); `active` is the frame window the blow lands in,
// `total` how long the whole swing locks you, `sfxAt` when it cracks.
const WEAPONS = {
  whip: {
    name: 'MOONFANG WHIP', short: 'WHIP',
    desc: 'LONG REACH. THE HUNT REMEMBERS IT',
    len: [0, 26, 30, 35], dmg: [0, 2, 3, 4],
    active: [6, 14], total: 22, sfxAt: 7,
    h: 26, crouchH: 15, color: '#e8e4d8', sfx: 'whip',
  },
  sword: {
    name: 'SILVER LONGSWORD', short: 'SWORD',
    desc: 'SHORT BUT SWIFT. STRIKES TWICE AS OFTEN',
    len: [0, 17, 19, 22], dmg: [0, 2, 3, 4],
    active: [4, 10], total: 13, sfxAt: 4,
    h: 28, crouchH: 16, color: '#cfe4f0', sfx: 'whip',
  },
  axe: {
    name: 'GRAVEDIGGER AXE', short: 'AXE',
    desc: 'SLOW, CRUEL, AND WIDE. CLEAVES ARMOUR',
    len: [0, 22, 25, 28], dmg: [0, 4, 6, 8],
    active: [9, 18], total: 32, sfxAt: 10,
    h: 38, crouchH: 22, color: '#e8a060', sfx: 'roar', pierce: 1,
  },
  spear: {
    name: 'CRYPT SPEAR', short: 'SPEAR',
    desc: 'THE LONGEST THRUST. NARROW AS A PRAYER',
    len: [0, 34, 39, 45], dmg: [0, 2, 2, 3],
    active: [5, 11], total: 17, sfxAt: 5,
    h: 12, crouchH: 10, color: '#d8d0b0', sfx: 'whip',
  },
  claws: {
    name: 'WOLFBONE CLAWS', short: 'CLAWS',
    desc: 'BARELY REACH. TEAR FASTER THAN THE EYE',
    len: [0, 13, 15, 17], dmg: [0, 2, 2, 3],
    active: [3, 8], total: 10, sfxAt: 3,
    h: 24, crouchH: 15, color: '#f0c0d0', sfx: 'whip', lifesteal: true,
  },
  scythe: {
    name: 'GRAVEWARDEN SCYTHE', short: 'SCYTHE',
    desc: 'FORGED ONLY. A WIDE, REAPING ARC',
    len: [0, 29, 33, 38], dmg: [0, 3, 4, 6],
    active: [7, 15], total: 25, sfxAt: 8,
    h: 34, crouchH: 20, color: '#a8e0c0', sfx: 'whip', craftOnly: true,
  },
  rapier: {
    name: 'SILVER RAPIER', short: 'RAPIER',
    desc: 'A NEEDLE. THREE THRUSTS TO ANOTHER BLADE\'S ONE',
    len: [0, 20, 23, 26], dmg: [0, 2, 2, 3],
    active: [3, 7], total: 9, sfxAt: 3,
    h: 14, crouchH: 10, color: '#e8f0ff',
  },
  greatsword: {
    name: 'CATHEDRAL GREATSWORD', short: 'GREAT',
    desc: 'ENORMOUS. SLOW AS A TOLLING BELL',
    len: [0, 26, 30, 34], dmg: [0, 5, 7, 10],
    active: [11, 21], total: 36, sfxAt: 12,
    h: 42, crouchH: 24, color: '#dfe4ee', pierce: 1,
  },
  flail: {
    name: 'PENITENT FLAIL', short: 'FLAIL',
    desc: 'THE HEAD SWINGS WIDE AND WILL NOT BE STOPPED',
    len: [0, 30, 34, 39], dmg: [0, 3, 4, 6],
    active: [8, 18], total: 27, sfxAt: 9,
    h: 32, crouchH: 20, color: '#c8b070',
  },
  halberd: {
    name: 'WARDEN HALBERD', short: 'HALBERD',
    desc: 'REACH AND WEIGHT BOTH. HEAVY TO CARRY',
    len: [0, 31, 35, 40], dmg: [0, 4, 5, 7],
    active: [9, 17], total: 28, sfxAt: 10,
    h: 30, crouchH: 18, color: '#b8bec8', pierce: 1,
  },
  daggers: {
    name: 'TWIN FANGS', short: 'FANGS',
    desc: 'TWO BLADES, FASTER THAN THOUGHT, BARELY REACHING',
    len: [0, 12, 14, 16], dmg: [0, 2, 2, 3],
    active: [2, 6], total: 8, sfxAt: 2,
    h: 22, crouchH: 14, color: '#f0c0d0', lifesteal: true,
  },
  moonchain: {
    name: 'MOONLIT CHAIN', short: 'CHAIN',
    desc: 'THE HEAD TRAVELS. FARTHEST REACH OF ANYTHING CARRIED',
    len: [0, 40, 46, 54], dmg: [0, 3, 4, 5],
    active: [7, 20], total: 27, sfxAt: 8,
    h: 20, crouchH: 13, color: '#cfd8ea', sfx: 'whip', travel: true,
  },
  warhammer: {
    name: 'RUIN HAMMER', short: 'HAMMER',
    desc: 'ENORMOUS. NOTHING IT TOUCHES KEEPS ITS SHAPE',
    len: [0, 24, 27, 31], dmg: [0, 7, 9, 13],
    active: [14, 24], total: 44, sfxAt: 15,
    h: 46, crouchH: 26, color: '#b0a08a', sfx: 'roar', pierce: 2, quake: true,
  },
  nodachi: {
    name: 'NIGHTFALL NODACHI', short: 'NODACHI',
    desc: 'A GREAT CURVED ARC. LONG AND UNHURRIED',
    len: [0, 33, 38, 44], dmg: [0, 4, 6, 8],
    active: [10, 20], total: 31, sfxAt: 11,
    h: 40, crouchH: 23, color: '#e0e8f4', pierce: 1,
  },
  kris: {
    name: 'SERPENT KRIS', short: 'KRIS',
    desc: 'A WAVED BLADE. FASTEST STEEL, AND IT LEAVES VENOM',
    len: [0, 15, 17, 19], dmg: [0, 2, 2, 3],
    active: [2, 5], total: 7, sfxAt: 2,
    h: 20, crouchH: 13, color: '#9ad86a', venom: true,
  },
  glaive: {
    name: 'MOONGLAIVE', short: 'GLAIVE',
    desc: 'SPUN OVERHEAD. CUTS BEHIND YOU AS WELL AS AHEAD',
    len: [0, 22, 25, 29], dmg: [0, 3, 4, 5],
    active: [8, 18], total: 26, sfxAt: 9,
    h: 34, crouchH: 20, color: '#c8e0f0', wide: true,
  },
  bonelash: {
    name: 'OSSUARY LASH', short: 'LASH',
    desc: 'VERTEBRAE ON A CORD. IT TRAVELS, AND IT DRINKS',
    len: [0, 34, 39, 45], dmg: [0, 2, 3, 4],
    active: [6, 18], total: 24, sfxAt: 7,
    h: 22, crouchH: 14, color: '#e8e0c8', sfx: 'whip', travel: true, lifesteal: true,
  },
  crozier: {
    name: 'INQUISITOR CROZIER', short: 'CROZIER',
    desc: 'FORGED ONLY. THE RESTLESS DEAD CANNOT ABIDE IT',
    len: [0, 27, 31, 36], dmg: [0, 3, 4, 6],
    active: [8, 17], total: 26, sfxAt: 9,
    h: 32, crouchH: 19, color: '#ffe9a8', craftOnly: true, holy: true,
  },
  frostbrand: {
    name: 'FROSTBRAND', short: 'FROST',
    desc: 'FORGED ONLY. WHAT IT CUTS STOPS MOVING',
    len: [0, 21, 24, 28], dmg: [0, 3, 4, 6],
    active: [5, 12], total: 16, sfxAt: 5,
    h: 28, crouchH: 17, color: '#a8e8ff', craftOnly: true, chills: true,
  },
  censer: {
    name: 'BURNING CENSER', short: 'CENSER',
    desc: 'FORGED ONLY. SETS THE AIR ALIGHT',
    len: [0, 24, 27, 31], dmg: [0, 2, 3, 5],
    active: [6, 16], total: 24, sfxAt: 7,
    h: 30, crouchH: 18, color: '#ffb060', sfx: 'whip', craftOnly: true, burns: true,
  },
  voidfang: {
    name: 'VOIDFANG', short: 'VOID',
    desc: 'FORGED ONLY. DRINKS THE FOE AND RETURNS THE WOUND',
    len: [0, 19, 22, 26], dmg: [0, 3, 5, 7],
    active: [5, 12], total: 18, sfxAt: 5,
    h: 26, crouchH: 16, color: '#7a5ac0', sfx: 'whip', craftOnly: true, lifesteal: true, shadow: true,
  },
  sunsplitter: {
    name: 'SUNSPLITTER', short: 'SUN',
    desc: 'FORGED ONLY. HOLY FLAME PIERCES EVERY WARD',
    len: [0, 24, 28, 33], dmg: [0, 4, 6, 9],
    active: [7, 15], total: 24, sfxAt: 8,
    h: 34, crouchH: 20, color: '#ffe888', sfx: 'whip', craftOnly: true, holy: true, burns: true,
  },
  twinfire: {
    name: 'TWINFIRE BLADES', short: 'TWIN',
    desc: 'TWO BURNING STEEL TONGUES. LASHES TWICE',
    len: [0, 16, 18, 21], dmg: [0, 2, 3, 3],
    active: [2, 8], total: 10, sfxAt: 3,
    h: 24, crouchH: 15, color: '#ff8040', sfx: 'whip', burns: true, doubletap: true,
  },
  stormglaive: {
    name: 'STORMCALLER GLAIVE', short: 'STORM',
    desc: 'FORGED ONLY. LIGHTNING LEAPS FROM EVERY CUT',
    len: [0, 24, 28, 33], dmg: [0, 3, 4, 6],
    active: [8, 18], total: 27, sfxAt: 9,
    h: 36, crouchH: 21, color: '#c08aff', sfx: 'whip', craftOnly: true, chain: true,
  },
  thornwhip: {
    name: 'THORNHEART WHIP', short: 'THORN',
    desc: 'FORGED ONLY. EACH LASH LEAVES VENOM AND DRINKS DEEP',
    len: [0, 28, 32, 37], dmg: [0, 2, 3, 4],
    active: [6, 14], total: 22, sfxAt: 7,
    h: 28, crouchH: 16, color: '#7ad860', sfx: 'whip', craftOnly: true, venom: true, lifesteal: true,
  },
  hearthammer: {
    name: 'HEARTHAMMER', short: 'HEART',
    desc: 'FORGED ONLY. THE GROUND BURNS WHERE IT FALLS',
    len: [0, 22, 25, 29], dmg: [0, 6, 9, 14],
    active: [12, 22], total: 40, sfxAt: 13,
    h: 44, crouchH: 25, color: '#ff6020', sfx: 'roar', craftOnly: true, quake: true, burns: true, pierce: 1,
  },
  frostbite: {
    name: 'FROSTBITE DAGGER', short: 'FROST',
    desc: 'A CRYSTAL BLADE. ENCASES WHAT IT TOUCHES',
    len: [0, 14, 16, 18], dmg: [0, 2, 2, 3],
    active: [2, 5], total: 8, sfxAt: 2,
    h: 18, crouchH: 12, color: '#90f0ff', chills: true,
  },
  shadowscythe: {
    name: 'SHADOW SCYTHE', short: 'SHADE',
    desc: 'FORGED ONLY. THE BLADE PASSES THROUGH ONE BODY TO THE NEXT',
    len: [0, 30, 35, 41], dmg: [0, 4, 5, 7],
    active: [7, 16], total: 26, sfxAt: 8,
    h: 36, crouchH: 21, color: '#5040a0', craftOnly: true, travel: true, shadow: true, pierce: 2,
  },
  bloodletter: {
    name: 'BLOOD LETTER', short: 'BLOOD',
    desc: 'FORGED ONLY. WOUNDS YOURSELF TO WOUND THEM TWICE OVER',
    len: [0, 20, 23, 27], dmg: [0, 8, 11, 16],
    active: [8, 16], total: 28, sfxAt: 9,
    h: 32, crouchH: 19, color: '#d02030', sfx: 'roar', craftOnly: true, bloodprice: 2,
  },
  lunarblade: {
    name: 'LUNARBLADE', short: 'LUNA',
    desc: 'FORGED ONLY. THE MOON ITSELF, BENT INTO A SINGLE EDGE',
    len: [0, 28, 33, 39], dmg: [0, 5, 7, 10],
    active: [7, 16], total: 22, sfxAt: 8,
    h: 34, crouchH: 20, color: '#d8e8ff', craftOnly: true, holy: true, chills: true, burns: true,
  },
};
const WEAPON_KEYS = Object.keys(WEAPONS);

// ---------------------------------------------------------------- sub-weapons
// Each entry fully describes a secondary weapon: pickup card, heart cost,
// normal throw, and its Item Crash. fire() may return false to refuse
// (nothing is spent). Positions: p is the player.
const SUBWEAPONS = {
  knife: {
    name: 'THROWING KNIFE', desc: 'UP+Z TO THROW. 1 HEART', cost: 1,
    icon: () => Sprites.knife,
    fire(p) {
      game.projectiles.push(new KnifeProj(
        p.facing > 0 ? p.x + p.w - 2 : p.x - 8, p.y + 6, p.facing));
    },
    crash(p, cx, cy) {
      for (let i = 0; i < 8; i++) {
        const d = i < 4 ? 1 : -1;
        game.projectiles.push(new KnifeProj(cx + d * (4 + (i % 4) * 9), cy - 10 + (i % 4) * 6, d));
      }
    },
  },
  axe: {
    name: 'BATTLE AXE', desc: 'ARCS OVERHEAD. 2 HEARTS', cost: 2,
    icon: () => Sprites.axe1,
    fire(p) {
      game.projectiles.push(new AxeProj(
        p.facing > 0 ? p.x + p.w - 2 : p.x - 8, p.y + 6, p.facing));
    },
    crash(p, cx, cy) {
      for (let i = 0; i < 5; i++) {
        const a = new AxeProj(cx - 5, cy - 6, i < 2 ? -1 : 1);
        a.vx = -2.4 + i * 1.2;
        a.vy = -5.2 - (i % 2);
        game.projectiles.push(a);
      }
    },
  },
  holy: {
    name: 'HOLY WATER', desc: 'BURNS THE GROUND. 3 HEARTS', cost: 3,
    icon: () => Sprites.holy,
    fire(p) {
      game.projectiles.push(new HolyProj(
        p.facing > 0 ? p.x + p.w - 2 : p.x - 8, p.y + 6, p.facing));
    },
    crash(p, cx, cy) {
      const ty = Math.floor((p.y + p.h + 4) / TILE);
      for (const dx of [-44, -12, 20, 52]) {
        game.projectiles.push(new FirePool(cx + dx, ty * TILE));
      }
    },
  },
  cross: {
    name: 'HOLY CROSS', desc: 'RETURNS TO YOUR HAND. 4 HEARTS', cost: 4,
    icon: () => Sprites.cross1,
    fire(p) {
      if (game.projectiles.some(pr => pr instanceof CrossProj && !pr.remove)) return false;
      game.projectiles.push(new CrossProj(
        p.facing > 0 ? p.x + p.w - 2 : p.x - 8, p.y + 6, p.facing));
    },
    crash(p, cx, cy) {
      for (const d of [1, -1]) {
        const c1 = new CrossProj(cx - 6, cy, d);
        const c2 = new CrossProj(cx - 6, cy - 14, d);
        c2.vx = d * 3;
        game.projectiles.push(c1, c2);
      }
    },
  },
  bible: {
    name: 'HOLY TOME', desc: 'ORBITS AND SHIELDS. 3 HEARTS', cost: 3,
    icon: () => Sprites.bible,
    fire(p) {
      if (game.projectiles.some(pr => pr instanceof BibleProj && !pr.remove)) return false;
      game.projectiles.push(new BibleProj(0));
    },
    crash(p, cx, cy) {
      for (const a of [0, 2.1, 4.2]) {
        const b = new BibleProj(a);
        b.life = 420; b.dmg = 3;
        game.projectiles.push(b);
      }
    },
  },
  stone: {
    name: 'REBOUND STONE', desc: 'SKIPS ALONG THE GROUND. 1 HEART', cost: 1,
    icon: () => Sprites.stone,
    fire(p) {
      game.projectiles.push(new StoneProj(
        p.facing > 0 ? p.x + p.w - 2 : p.x - 6, p.y + 6, p.facing));
    },
    crash(p, cx, cy) {
      for (let i = 0; i < 6; i++) {
        const st = new StoneProj(cx, cy - 6, i % 2 ? 1 : -1);
        st.vx *= 0.6 + (i >> 1) * 0.4;
        st.vy = -2 - (i >> 1);
        game.projectiles.push(st);
      }
    },
  },
  watch: {
    name: 'STOPWATCH', desc: 'STOPS ALL FIENDS. 5 HEARTS', cost: 5, quiet: true,
    icon: () => Sprites.watch,
    fire(p) {
      for (const e of game.enemies) {
        if (!e.remove && e.frozen !== undefined) e.frozen = Math.max(e.frozen, 200);
      }
      game.watchFlash = 24;
      game.addShake(2);
      AudioSys.sfxPetrify();
      AudioSys.sfxBell();
    },
    crash(p) {
      for (const e of game.enemies) {
        if (!e.remove && e.frozen !== undefined) {
          e.frozen = Math.max(e.frozen, 400);
          if (e.hurt) e.hurt(2);
        }
      }
      game.watchFlash = 40;
    },
  },
  harpoon: {
    name: 'BARBED HARPOON', desc: 'UP+Z. TWO HEAVY SHAFTS. 3 HEARTS', cost: 3,
    icon: () => Sprites.knife,
    fire(p) {
      for (let i = 0; i < 2; i++) {
        game.projectiles.push(new JavelinProj(
          p.facing > 0 ? p.x + p.w - 2 : p.x - 20, p.y + 3 + i * 7, p.facing));
      }
    },
    crash(p, cx, cy) {
      for (let i = 0; i < 7; i++) {
        game.projectiles.push(new JavelinProj(cx - 10, cy - 18 + i * 6, i % 2 ? 1 : -1));
      }
      game.addShake(5);
    },
  },
  bolas: {
    name: 'BONE BOLAS', desc: 'UP+Z. TWO WEIGHTS, SPINNING WIDE. 2 HEARTS', cost: 2,
    icon: () => Sprites.knife,
    fire(p) {
      for (const dy of [-3, 5]) {
        game.projectiles.push(new StoneProj(
          p.facing > 0 ? p.x + p.w - 2 : p.x - 8, p.y + 5 + dy, p.facing));
      }
    },
    crash(p, cx, cy) {
      for (let i = 0; i < 10; i++) {
        game.projectiles.push(new StoneProj(cx, cy - 20 + i * 5, i % 2 ? 1 : -1));
      }
    },
  },
  flare: {
    name: 'PITCH FLARE', desc: 'UP+Z. LOBBED, AND IT LEAVES FIRE. 3 HEARTS', cost: 3,
    icon: () => Sprites.knife,
    fire(p) {
      const b = new BombProj(p.facing > 0 ? p.x + p.w : p.x - 8, p.y + 4, p.facing);
      b.vy = -4.4; b.fuse = 44;
      game.projectiles.push(b);
    },
    crash(p, cx, cy) {
      const ty = Math.floor((p.y + p.h + 4) / TILE);
      for (let i = -3; i <= 3; i++) {
        game.projectiles.push(new FirePool(cx + i * 22, ty * TILE));
      }
      game.addShake(4);
    },
  },
  fang: {
    name: 'FANG FAN', desc: 'UP+Z. THREE TEETH IN A TIGHT SPREAD. 2 HEARTS', cost: 2,
    icon: () => Sprites.knife,
    fire(p) {
      for (const dy of [-4, 0, 4]) {
        const k = new KnifeProj(
          p.facing > 0 ? p.x + p.w - 2 : p.x - 8, p.y + 6 + dy, p.facing);
        k.vy = dy * 0.12;
        game.projectiles.push(k);
      }
    },
    crash(p, cx, cy) {
      for (let i = 0; i < 16; i++) {
        const k = new KnifeProj(cx, cy - 4, i % 2 ? 1 : -1);
        k.vy = (i - 8) * 0.22;
        game.projectiles.push(k);
      }
    },
  },
  javelin: {
    name: 'CRYPT JAVELIN', desc: 'UP+Z. RUNS THROUGH THREE BODIES. 3 HEARTS', cost: 3,
    icon: () => Sprites.weapons.spear,
    fire(p) {
      game.projectiles.push(new JavelinProj(
        p.facing > 0 ? p.x + p.w - 2 : p.x - 18, p.y + 8, p.facing));
    },
    crash(p, cx, cy) {
      for (let i = 0; i < 5; i++) {
        game.projectiles.push(new JavelinProj(cx - 10, cy - 20 + i * 10, p.facing));
      }
    },
  },
  bomb: {
    name: 'BLACK POWDER BOMB', desc: 'UP+Z. LOBBED, AND IT TAKES THE ROOM. 4 HEARTS', cost: 4,
    icon: () => Sprites.bomb,
    fire(p) {
      game.projectiles.push(new BombProj(p.x + p.w / 2 - 5, p.y + 4, p.facing));
    },
    crash(p, cx, cy) {
      for (let i = 0; i < 6; i++) {
        const b = new BombProj(cx - 5, cy - 10, i % 2 ? 1 : -1);
        b.vx *= 0.4 + i * 0.25;
        b.vy = -4 - i * 0.3;
        b.fuse = 40 + i * 8;
        game.projectiles.push(b);
      }
    },
  },
  chakram: {
    name: 'MOONSTEEL CHAKRAM', desc: 'UP+Z. FLIES OUT AND RETURNS. 3 HEARTS', cost: 3,
    icon: () => Sprites.chakram,
    fire(p) {
      game.projectiles.push(new ChakramProj(
        p.facing > 0 ? p.x + p.w : p.x - 12, p.y + 8, p.facing));
    },
    crash(p, cx, cy) {
      for (let i = 0; i < 4; i++) {
        const c = new ChakramProj(cx - 6, cy - 16 + i * 10, i % 2 ? 1 : -1);
        c.dmg = 4;
        game.projectiles.push(c);
      }
    },
  },
  shuriken: {
    name: 'FAN OF SHURIKEN', desc: 'UP+Z. THREE AT ONCE, SPREADING. 2 HEARTS', cost: 2,
    icon: () => Sprites.shuriken,
    fire(p) {
      for (const s of [-0.9, 0, 0.9]) {
        game.projectiles.push(new ShurikenProj(
          p.facing > 0 ? p.x + p.w - 2 : p.x - 8, p.y + 8, p.facing, s));
      }
    },
    crash(p, cx, cy) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const s = new ShurikenProj(cx - 4, cy - 4, 1, Math.sin(a) * 4);
        s.vx = Math.cos(a) * 4;
        game.projectiles.push(s);
      }
    },
  },
  voidshard: {
    name: 'VOID SHARD', desc: 'UP+Z. PHASES THROUGH EVERYTHING. 3 HEARTS', cost: 3,
    icon: () => Sprites.voidShard,
    fire(p) {
      game.projectiles.push(new VoidShardProj(
        p.facing > 0 ? p.x + p.w - 2 : p.x - 12, p.y + 8, p.facing));
    },
    crash(p, cx, cy) {
      for (let i = 0; i < 6; i++) {
        const v = new VoidShardProj(cx - 8, cy - 16 + i * 8, i % 2 ? 1 : -1);
        v.dmg = 5; v.pierce = 99;
        game.projectiles.push(v);
      }
    },
  },
  lightningorb: {
    name: 'LIGHTNING ORB', desc: 'UP+Z. CHAINS BETWEEN FOES. 3 HEARTS', cost: 3,
    icon: () => Sprites.lightningOrb,
    fire(p) {
      game.projectiles.push(new LightningOrbProj(
        p.facing > 0 ? p.x + p.w : p.x - 12, p.y + 6, p.facing));
    },
    crash(p, cx, cy) {
      for (let i = 0; i < 8; i++) {
        const orb = new LightningOrbProj(cx - 6, cy - 12 + i * 5, i % 2 ? 1 : -1);
        orb.vy = (i - 4) * 0.6;
        game.projectiles.push(orb);
      }
      game.addShake(3);
    },
  },
  crystalshard: {
    name: 'CRYSTAL SHARD', desc: 'UP+Z. SPLITS ON IMPACT. 2 HEARTS', cost: 2,
    icon: () => Sprites.crystalShard,
    fire(p) {
      game.projectiles.push(new CrystalShardProj(
        p.facing > 0 ? p.x + p.w - 2 : p.x - 8, p.y + 7, p.facing));
    },
    crash(p, cx, cy) {
      for (let i = 0; i < 12; i++) {
        const cs = new CrystalShardProj(cx - 4, cy - 4, 1);
        cs.vx = Math.cos(i * Math.PI / 6) * 4;
        cs.vy = Math.sin(i * Math.PI / 6) * 4;
        game.projectiles.push(cs);
      }
    },
  },
  darkflame: {
    name: 'DARKFLAME VIAL', desc: 'UP+Z. LOBBED. LEAVES VOID FIRE. 3 HEARTS', cost: 3,
    icon: () => Sprites.darkflame,
    fire(p) {
      const b = new BombProj(p.facing > 0 ? p.x + p.w : p.x - 8, p.y + 4, p.facing);
      b.vy = -3.8; b.fuse = 50; b.darkflame = true;
      game.projectiles.push(b);
    },
    crash(p, cx, cy) {
      const ty = Math.floor((p.y + p.h + 4) / TILE);
      for (let i = -4; i <= 4; i++) {
        const pool = new DarkFirePool(cx + i * 18, ty * TILE);
        pool.life = 200;
        game.projectiles.push(pool);
      }
      game.addShake(4);
    },
  },
};
const SUB_KEYS = Object.keys(SUBWEAPONS);

// ---------------------------------------------------------------- relics
// Generated equipment: base x prefix x suffix x tier = thousands of distinct
// relics. Stats stack across the hunter's three slots.
const RELIC_BASES = ['AMULET', 'RING', 'SIGIL', 'IDOL', 'FANG', 'TALISMAN', 'EYE', 'CROWN', 'VIAL', 'BELL', 'PHYLACTERY', 'RELIQUARY'];
const RELIC_PREFIX = [
  { name: 'BONE', stat: { maxHp: 2 } },
  { name: 'IRON', stat: { armor: 1 } },
  { name: 'SILVER', stat: { dmg: 1 } },
  { name: 'GOLDEN', stat: { greed: 1 } },
  { name: 'BLOODY', stat: { vamp: 1 } },
  { name: 'FROZEN', stat: { chill: 1 } },
  { name: 'BURNING', stat: { burn: 1 } },
  { name: 'CURSED', stat: { dmg: 2, maxHp: -2 } },
  { name: 'BLESSED', stat: { maxHp: 3 } },
  { name: 'MOONLIT', stat: { charge: 1 } },
  { name: 'SHADOWED', stat: { dmg: 1, vamp: 1 } },
  { name: 'RADIANT', stat: { maxHp: 1, dmg: 1 } },
  { name: 'DRAGON', stat: { burn: 2, dmg: 1 } },
  { name: 'VOID', stat: { vamp: 1, charge: 1 } },
];
const RELIC_SUFFIX = [
  { name: 'OF VIGOR', stat: { maxHp: 3 } },
  { name: 'OF FANGS', stat: { dmg: 1 } },
  { name: 'OF HASTE', stat: { speed: 1 } },
  { name: 'OF GREED', stat: { hearts: 1 } },
  { name: 'OF WINGS', stat: { jump: 1 } },
  { name: 'OF STONE', stat: { armor: 1 } },
  { name: 'OF EMBERS', stat: { burn: 1 } },
  { name: 'OF FROST', stat: { chill: 1 } },
  { name: 'OF FORTUNE', stat: { luck: 1 } },
  { name: 'OF THE MOON', stat: { charge: 1, dmg: 1 } },
  { name: 'OF THE VOID', stat: { dmg: 1, vamp: 1 } },
  { name: 'OF DAWN', stat: { maxHp: 1, dmg: 1, armor: 1 } },
  { name: 'OF DRAGONFIRE', stat: { burn: 2 } },
  { name: 'OF ECLIPSE', stat: { dmg: 2, maxHp: -1 } },
];
const RELIC_STAT_LABEL = {
  maxHp: 'HP', dmg: 'BLADE', armor: 'ARMOR', speed: 'HASTE', jump: 'LEAP',
  greed: 'GREED', vamp: 'LEECH', chill: 'FROST', burn: 'EMBER', luck: 'LUCK',
  hearts: 'HEARTS', charge: 'FOCUS',
};
// five grades of worth, common to legendary
const RARITY = [
  null,
  { name: 'COMMON', color: '#b8c0cc' },
  { name: 'UNCOMMON', color: '#5aa04a' },
  { name: 'RARE', color: '#4a90d0' },
  { name: 'EPIC', color: '#c07af0' },
  { name: 'LEGENDARY', color: '#ffd858' },
];
const TIER_COLOR = ['', ...RARITY.slice(1).map(r => r.color)];

// ---------------------------------------------------------------- loot tables
// Every drop source rolls one weighted table; luck relics tilt the scales
// toward the precious rows. 'sub'/'card'/'soul'/'relic' resolve dynamically.
const PRECIOUS = { relic: 1, card: 1, soul: 1, elixir: 1, whip: 1, scroll: 1, weapon: 1 };
const LOOT_TABLES = {
  candle: [
    ['buff', 4],
    ['heart', 40], ['bigheart', 12], ['gem', 14], ['orb', 8],
    ['sub', 8], ['whip', 5], ['elixir', 1], ['relic', 2], ['scroll', 3], [null, 7],
  ],
  enemy: [
    ['buff', 2],
    [null, 70], ['heart', 15], ['gem', 6], ['card', 3], ['soul', 4], ['relic', 2],
  ],
  elite: [
    ['buff', 4],
    ['weapon', 5],
    ['card', 26], ['soul', 22], ['relic', 27], ['scroll', 12], ['bigheart', 13],
  ],
  secret: [
    ['buff', 4],
    ['weapon', 10],
    ['roast', 40], ['soul', 20], ['card', 14], ['relic', 12], ['scroll', 8], ['elixir', 6],
  ],
  glimmer: [
    ['buff', 4],
    ['weapon', 8],
    ['gem', 26], ['bigheart', 22], ['card', 18], ['relic', 18], ['scroll', 11], ['elixir', 5],
  ],
};

function rollRelic(bias) {
  // bias (stage depth, boss kills, forge quality) raises the rarity curve
  const w = [50, 28, 14, 6, 2].map((v, i) => v * (1 + (bias || 0) * i * 0.8));
  let sum = 0;
  for (const v of w) sum += v;
  let r = Math.random() * sum, tier = 1;
  for (let i = 0; i < 5; i++) { r -= w[i]; if (r <= 0) { tier = i + 1; break; } }
  return {
    base: (Math.random() * RELIC_BASES.length) | 0,
    pre: (Math.random() * RELIC_PREFIX.length) | 0,
    suf: (Math.random() * RELIC_SUFFIX.length) | 0,
    tier,
  };
}

function relicName(r) {
  return RELIC_PREFIX[r.pre].name + ' ' + RELIC_BASES[r.base] + ' ' + RELIC_SUFFIX[r.suf].name;
}

function relicStats(r) {
  const out = {};
  for (const src of [RELIC_PREFIX[r.pre].stat, RELIC_SUFFIX[r.suf].stat]) {
    for (const k in src) out[k] = (out[k] || 0) + src[k] * r.tier;
  }
  return out;
}

function relicStatsText(r) {
  const st = relicStats(r);
  return Object.keys(st)
    .map(k => RELIC_STAT_LABEL[k] + (st[k] > 0 ? '+' : '') + st[k])
    .join('  ');
}

const relicIconCache = {};
function relicIcon(r) {
  const key = r.base + '-' + r.tier;
  if (relicIconCache[key]) return relicIconCache[key];
  const cv = document.createElement('canvas');
  cv.width = 12; cv.height = 12;
  const g = cv.getContext('2d');
  const c = TIER_COLOR[r.tier];
  g.fillStyle = '#0a0812';
  for (let i = 0; i < 6; i++) { g.fillRect(5 - i, i + 0, 2 + i * 2, 1); }
  for (let i = 0; i < 6; i++) { g.fillRect(5 - (5 - i), 6 + i, 2 + (5 - i) * 2, 1); }
  g.fillStyle = c;
  for (let i = 1; i < 5; i++) { g.fillRect(6 - i, i + 1, i * 2, 1); }
  for (let i = 1; i < 5; i++) { g.fillRect(6 - (5 - i), 6 + i - 1, (5 - i) * 2, 1); }
  drawText(g, RELIC_BASES[r.base][0], 4, 4, '#0a0812', 1);
  relicIconCache[key] = cv;
  return cv;
}


// ---------------------------------------------------------------- the castle
// One castle, not nine stages. Each zone is a place with its own stone, its own
// dead, and its own way in — and some of them will not open until you have
// taken something from a guardian.
// Fifteen places, raised end to end into one castle. `row` is the elevation the
// zone sits at — the castle climbs from the cellars to the spires and back —
// and `gate` names the guardian's gift the way onward demands.
const ZONES = [
  { key: 'wall', name: 'THE OUTER WALL', biome: 'castle', row: 40, w: 130,
    pool: ['ground', 'pits', 'hall', 'battlements'], danger: 0, tint: null },
  { key: 'cemetery', name: 'THE CEMETERY GATE', biome: 'graveyard', row: 44, w: 130,
    pool: ['graveyard', 'crypt', 'graveyard', 'crypt', 'pits'], danger: 1, tint: '#7a8a6a',
    boss: 'GiantBat', bossName: 'VESPERTILIO', reward: 'wings' },
  { key: 'chapel', name: 'THE BROKEN CHAPEL', biome: 'chapel', row: 34, w: 140,
    pool: ['nave', 'nave', 'hall', 'ascent'], danger: 2, tint: '#8a7ab0',
    gate: 'wings' },
  { key: 'belfry', name: 'THE HANGING BELFRY', biome: 'chapel', row: 20, w: 120,
    pool: ['ascent', 'nave', 'battlements', 'ascent'], danger: 2, tint: '#9a8ac0',
    gate: 'wings', branch: 'up' },
  { key: 'catacomb', name: 'THE CATACOMBS', biome: 'catacombs', row: 64, w: 140,
    pool: ['warren', 'warren', 'crypt', 'pits'], danger: 3, tint: '#6a7a8a',
    boss: 'NightmareBoss', bossName: 'TENEBRAE', reward: 'gallop', branch: 'down' },
  { key: 'ossuary', name: 'THE OSSUARY', biome: 'catacombs', row: 76, w: 130,
    pool: ['warren', 'crypt', 'warren', 'pits'], danger: 3, tint: '#5a6a7a',
    gate: 'gallop', branch: 'down' },
  { key: 'cistern', name: 'THE DROWNED CISTERN', biome: 'cistern', row: 70, w: 140,
    pool: ['cistern', 'cistern', 'warren', 'hall'], danger: 4, tint: '#5a90a8',
    boss: 'GiantBat', bossName: 'NEREZZA', reward: 'tide' },
  { key: 'clock', name: 'THE CLOCK RUIN', biome: 'clock', row: 24, w: 140,
    pool: ['gears', 'gears', 'ascent', 'hall'], danger: 4, tint: '#b09a6a',
    gate: 'tide', branch: 'up' },
  { key: 'foundry', name: 'THE BLACK FOUNDRY', biome: 'foundry', row: 48, w: 140,
    pool: ['foundry', 'foundry', 'gears', 'hall'], danger: 5, tint: '#c07a4a',
    boss: 'HellBeastBoss', bossName: 'FORGEMAW', reward: 'ember', branch: 'down' },
  { key: 'keep', name: 'THE BLOOD KEEP', biome: 'keep', row: 40, w: 150,
    pool: ['throne', 'throne', 'battlements', 'hall'], danger: 5, tint: '#a06a6a',
    gate: 'ember', boss: 'HellBeastBoss', bossName: 'MOLOCH', reward: 'maw' },
  { key: 'gallery', name: 'THE MIRROR GALLERY', biome: 'gallery', row: 32, w: 140,
    pool: ['gallery', 'gallery', 'hall', 'nave'], danger: 6, tint: '#b0a0d0',
    gate: 'maw', boss: 'NightmareBoss', bossName: 'THE PALE TWIN', reward: 'mist' },
  { key: 'spire', name: 'THE FROZEN SPIRE', biome: 'frost', row: 18, w: 140,
    pool: ['ascent', 'frostwalk', 'frostwalk', 'battlements'], danger: 6, tint: '#8ac0e0',
    gate: 'mist', branch: 'up' },
  { key: 'observatory', name: 'THE OBSERVATORY', biome: 'gallery', row: 16, w: 120,
    pool: ['gallery', 'moonbridge', 'ascent', 'hall'], danger: 7, tint: '#a0b0e0',
    gate: 'ember', branch: 'up' },
  { key: 'stormspires', name: 'THE STORM SPIRES', biome: 'sky', row: 10, w: 140,
    pool: ['skybridge', 'skyisland', 'battlements', 'skybridge'], danger: 7, tint: '#8ac8f0',
    gate: 'wings', branch: 'up' },
  { key: 'abyss', name: 'THE HUNGRY DARK', biome: 'catacombs', row: 80, w: 130,
    pool: ['pits', 'warren', 'cistern', 'pits'], danger: 7, tint: '#4a5a6a',
    gate: 'tide', branch: 'down' },
  { key: 'voidgate', name: 'THE VOID GATE', biome: 'void', row: 90, w: 130,
    pool: ['voidhall', 'voidhall', 'pits', 'warren'], danger: 8, tint: '#3a3050',
    gate: 'mist', branch: 'down' },
  { key: 'dragonroost', name: 'THE DRAGON ROOST', biome: 'foundry', row: 14, w: 140,
    pool: ['foundry', 'ascent', 'battlements', 'ascent'], danger: 8, tint: '#e08040',
    gate: 'ember', boss: 'DragonGuardian', bossName: 'VAELTHRAN THE EVERBURNING', reward: 'dragonfire', branch: 'up' },
  { key: 'sunken', name: 'THE SUNKEN DEPTHS', biome: 'void', row: 96, w: 140,
    pool: ['cistern', 'voidhall', 'cistern', 'pits'], danger: 8, tint: '#1a4060',
    gate: 'dragonfire', branch: 'down' },
  { key: 'heart', name: 'THE LUNAR HEART', biome: 'lunar', row: 28, w: 130,
    pool: ['moonbridge', 'moonbridge', 'hall', 'ascent'], danger: 8, tint: '#8ad0f0',
    gate: 'mist', boss: 'FinalBoss', bossName: 'THE MOONFANG', reward: null },
];

// What a guardian leaves behind. Each is a key to somewhere you could not go.
const BOSS_REWARDS = {
  wings: {
    name: 'WINGS OF THE VESPER', from: 'VESPERTILIO',
    desc: 'THE AIR HOLDS YOU. LEAP AGAIN, AND AGAIN',
    apply: p => { p.extraJumps = Math.max(p.extraJumps, 2); p.skills.dash = true; },
  },
  gallop: {
    name: 'SHADOW GALLOP', from: 'TENEBRAE',
    desc: 'THE DARK CARRIES YOU. THE PHANTOM STEP BECOMES A BLINK',
    apply: p => { p.skills.dash = true; p.skills.tempest = true; p.skills.veil = true; },
  },
  maw: {
    name: "MOLOCH'S MAW", from: 'MOLOCH',
    desc: 'HIS FIRE IS YOURS. CRACKED FLOORS GIVE WAY BENEATH YOU',
    apply: p => { p.skills.plunge = true; p.skills.skyfall = true; p.subWeapon = p.subWeapon || 'axe'; },
  },
  tide: {
    name: 'THE DROWNED BREATH', from: 'NEREZZA',
    desc: 'DEEP WATER NO LONGER DRAGS AT YOU. BLOOD CANNOT DRINK YOU',
    apply: p => { p.skills.tide = true; p.skills.swim = true; },
  },
  ember: {
    name: 'THE UNQUENCHED EMBER', from: 'FORGEMAW',
    desc: 'FIRE PASSES THROUGH YOU. FROZEN WARDS MELT AT A TOUCH',
    apply: p => { p.skills.ember = true; p.skills.forgehand = true; },
  },
  mist: {
    name: 'THE PALE MIST', from: 'THE PALE TWIN',
    desc: 'HOLD DOWN AND LEAP TO STEP THROUGH THIN STONE',
    apply: p => { p.skills.mist = true; p.skills.phase = true; },
  },
  dragonfire: {
    name: 'DRAGONFIRE HEART', from: 'VAELTHRAN',
    desc: 'THE EVERBURNING FIRE IS YOURS. PLUNGES LEAVE FIRE AND WAVES BURN BRIGHTER',
    apply: p => { p.skills.dragonfire = true; p.skills.pyre = true; p.subWeapon = p.subWeapon || 'darkflame'; },
  },
};

const STAGE_NAMES = [
  'THE OUTER WALL', 'THE CEMETERY GATE', 'THE BROKEN CLOISTER',
  'THE CLOCK RUINS', 'THE BLOOD KEEP', 'THE MOON SANCTUM',
  'THE HOLLOW CHOIR', 'THE BONE THRONE', 'THE LUNAR HEART',
];
const FINAL_STAGE = 9;


// ---------------------------------------------------------------- persistent meta
function freshMeta() {
  return {
    bestStage: 1, kills: 0, essence: 0,
    feats: {}, lore: {}, glimmers: 0, walls: 0,
    weapons: { whip: 1 }, startWeapon: 'whip',
    ore: 0, crafted: 0, pairs: {}, mastery: {},
    cleared: 0, dailyDay: 0, dailyBest: 0,
    bestiary: {}, rushBest: 0,
  };
}

let meta = {
  bestStage: 1, kills: 0, essence: 0,
  feats: {}, lore: {}, glimmers: 0, walls: 0,
  weapons: { whip: 1 },        // main weapons unlocked for future hunts
  ore: 0, crafted: 0, pairs: {},
  mastery: {},          // weapon key -> kills made with it
  startWeapon: 'whip',
  cleared: 0,            // times the Moonfang has fallen
  dailyDay: 0, dailyBest: 0,
};
try { meta = Object.assign(meta, JSON.parse(localStorage.getItem('moonfang-meta') || '{}')); } catch (e) {}
function saveMeta() {
  try { localStorage.setItem('moonfang-meta', JSON.stringify(meta)); } catch (e) {}
}

// Erase everything the castle remembers of you: the saved hunt, every deed,
// every unlocked weapon and mastery, the bestiary, the best score.
function eraseAllProgress() {
  const fresh = freshMeta();
  for (const k in meta) delete meta[k];
  Object.assign(meta, fresh);
  for (const key of ['moonfang-meta', 'moonfang-run', 'moonfang-hi']) {
    try { localStorage.removeItem(key); } catch (e) {}
  }
  saveMeta();
}
if (!meta.feats) meta.feats = {};
if (!meta.weapons) meta.weapons = { whip: 1 };
if (!meta.mastery) meta.mastery = {};
if (!meta.startWeapon || !WEAPONS[meta.startWeapon]) meta.startWeapon = 'whip';
if (!meta.lore) meta.lore = {};

// ---------------------------------------------------------------- run save
// A hunt survives closing the game: stage, path, and everything carried.
const SAVE_KEY = 'moonfang-run';
function saveRun(g) {
  if (!g.player || g.mode !== 'normal' || g.state !== 'play') return;
  const p = g.player;
  const data = {
    stage: g.stage, score: g.score, curses: g.curses, daily: g.daily,
    path: g.path ? g.path.key : null,
    stats: g.stats,
    p: {
      hp: p.hp, maxHp: p.maxHp, hearts: p.hearts, whipLvl: p.whipLvl,
      weapon: p.weapon, weapons: p.weapons, materials: p.materials, gifts: p.gifts,
      level: p.level, xp: p.xp,
      subWeapon: p.subWeapon, subInfusion: p.subInfusion, extraJumps: p.extraJumps,
      gaze: p.gaze, skills: p.skills, cards: p.cards, cardAction: p.cardAction,
      cardAttr: p.cardAttr, windUsed: p.windUsed, relics: p.relics, bag: p.bag,
      keys: p.keys, perks: p.perks, gems: p.gems,
    },
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) {}
}
function loadRun() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d && d.p && d.stage ? d : null;
  } catch (e) { return null; }
}
function clearRun() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
}

// today's castle, the same for every hunter
function dailySeed() {
  const now = new Date();
  return now.getUTCFullYear() * 10000 + (now.getUTCMonth() + 1) * 100 + now.getUTCDate();
}
const META_UNLOCKS = [
  { stage: 2, label: 'KNIFE', apply: p => { if (!p.subWeapon) p.subWeapon = 'knife'; } },
  { stage: 3, label: 'VIGOR', apply: p => { p.maxHp = 20; p.hp = 20; } },
  { stage: 4, label: 'HEARTS', apply: p => { p.hearts = Math.max(p.hearts, 15); } },
  { stage: 5, label: 'SLIDE', apply: p => { p.skills.slide = true; } },
];


// ---------------------------------------------------------------- arcana cards
const CARD_NAME = {
  mercury: 'MERCURY', mars: 'MARS', jupiter: 'JUPITER', saturn: 'SATURN',
  salamander: 'SALAMANDER', serpent: 'SERPENT', golem: 'GOLEM',
  tempest: 'TEMPEST', luna: 'LUNA', manticore: 'MANTICORE',
  cockatrice: 'COCKATRICE', griffin: 'GRIFFIN', unicorn: 'UNICORN', blackdog: 'BLACK DOG',
  basilisk: 'BASILISK', phoenix: 'PHOENIX', nebula: 'NEBULA',
};
const CARD_LETTER = {
  mercury: 'M', mars: 'X', jupiter: 'J', saturn: 'S',
  salamander: 'F', serpent: 'I', golem: 'G', tempest: 'T', luna: 'L',
  manticore: 'V', cockatrice: 'P', griffin: 'W', unicorn: 'H', blackdog: 'B',
  basilisk: 'K', phoenix: 'X', nebula: 'V',
};

const CARD_ACTIONS = ['mercury', 'mars', 'jupiter', 'saturn'];
const CARD_ATTRS = ['salamander', 'serpent', 'golem', 'tempest', 'luna',
  'manticore', 'cockatrice', 'griffin', 'unicorn', 'blackdog',
  'basilisk', 'phoenix', 'nebula'];

// Every pairing is a real effect. `fx` is read by the game through
// player.cardFx(key), so a new combo needs no new code path.
const CARD_COMBOS = {
  // MERCURY - the edge: what your weapon becomes
  'mercury+salamander': ['FLAME EDGE', 'BLADE +1, YOUR BLOWS SET FIRE', { dmg: 1, burn: 1 }],
  'mercury+serpent': ['FROST EDGE', 'YOUR BLADE CHILLS FOES SOLID', { freeze: 1 }],
  'mercury+golem': ['STONE EDGE', 'BLADE +2, BUT A SLOWER STRIDE', { dmg: 2, speed: -0.2 }],
  'mercury+tempest': ['STORM EDGE', 'HITS ARC LIGHTNING TO ANOTHER FOE', { chain: 1 }],
  'mercury+luna': ['MOON EDGE', 'EVERY 3RD SLASH LOOSES A WAVE', { waveEvery: 3 }],
  'mercury+manticore': ['VENOM EDGE', 'YOUR BLADE LEAVES POISON IN THE WOUND', { poison: 1 }],
  'mercury+cockatrice': ['GAZE EDGE', 'YOUR BLADE MAY TURN FLESH TO STONE', { petrify: 1 }],
  'mercury+griffin': ['GALE EDGE', 'YOU SWING A THIRD FASTER', { swing: -0.3 }],
  'mercury+unicorn': ['HOLY EDGE', 'EVERY 6TH BLOW MENDS YOU', { lifesteal: 6 }],
  'mercury+blackdog': ['GREED EDGE', 'THE SLAIN GIVE UP MORE GEMS', { gems: 2, luck: 1 }],

  // MARS - the mail: what touching you costs
  'mars+salamander': ['EMBER MAIL', 'FOES BURN AT YOUR TOUCH', { rBurn: 1, thorns: 1 }],
  'mars+serpent': ['FROST MAIL', 'ATTACKERS FREEZE SOLID', { rFreeze: 1 }],
  'mars+golem': ['STONE MAIL', 'DAMAGE TAKEN -1', { armor: 1 }],
  'mars+tempest': ['STORM MAIL', 'ATTACKERS ARE SHOCKED', { rShock: 1 }],
  'mars+luna': ['MOON MAIL', 'MERCY LINGERS FAR LONGER', { invuln: 0.45 }],
  'mars+manticore': ['VENOM MAIL', 'ATTACKERS TAKE YOUR POISON', { rPoison: 1, thorns: 1 }],
  'mars+cockatrice': ['BASILISK MAIL', 'ATTACKERS STIFFEN WHERE THEY STAND', { rPetrify: 1 }],
  'mars+griffin': ['GALE MAIL', 'AN EXTRA LEAP, AND A LIGHTER STEP', { airjump: 1, speed: 0.08 }],
  'mars+unicorn': ['SAINT MAIL', 'YOUR WOUNDS CLOSE SLOWLY ON THEIR OWN', { regen: 260 }],
  'mars+blackdog': ['BLOOD MAIL', 'WOUNDS TAKEN PAY YOU IN HEARTS', { bloodHearts: 3 }],

  // JUPITER - the ward: a power that hangs about you
  'jupiter+salamander': ['PYRE WARD', 'A RING OF FIRE BURNS WHAT COMES NEAR', { aura: 1, auraBurn: 1 }],
  'jupiter+serpent': ['RIME WARD', 'THE AIR ABOUT YOU CHILLS THE QUICK', { aura: 1, auraFreeze: 1 }],
  'jupiter+golem': ['BULWARK WARD', 'ARMOUR +1 AND FOOTING LIKE STONE', { armor: 1, noKnock: 1 }],
  'jupiter+tempest': ['TESLA WARD', 'BOLTS LEAP FROM YOU UNBIDDEN', { bolt: 120 }],
  'jupiter+luna': ['LUNAR WARD', 'A SHARD OF MOON CIRCLES AND STRIKES', { familiar: 'moon' }],
  'jupiter+manticore': ['MIASMA WARD', 'A CLOUD OF VENOM TRAILS YOU', { aura: 1, auraPoison: 1 }],
  'jupiter+cockatrice': ['MEDUSA WARD', 'YOUR GAZE STIFFENS THOSE WHO WATCH', { gazePetrify: 200 }],
  'jupiter+griffin': ['ZEPHYR WARD', 'SWIFTER, AND YOU FALL LIKE A FEATHER', { speed: 0.2, slowfall: 1 }],
  'jupiter+unicorn': ['GRACE WARD', 'MAX HEALTH +6 AND SLOW MENDING', { maxhp: 6, regen: 340 }],
  'jupiter+blackdog': ['HOUND WARD', 'A BLACK HOUND HUNTS AT YOUR HEEL', { familiar: 'hound' }],

  // SATURN - the rite: power bought with something
  'saturn+salamander': ['PYRE RITE', 'BLADE +3 WHILE YOU CARRY 10 HEARTS', { riteFire: 3 }],
  'saturn+serpent': ['WINTER RITE', 'BEING STRUCK FREEZES EVERYTHING NEAR', { riteFreeze: 1 }],
  'saturn+golem': ['EARTH RITE', 'ARMOUR +2, BUT YOU MOVE HEAVILY', { armor: 2, speed: -0.25 }],
  'saturn+tempest': ['THUNDER RITE', 'THE CRESCENT GATHERS TWICE AS FAST', { charge: 4 }],
  'saturn+luna': ['ECLIPSE RITE', 'HALF YOUR HEALTH. TWICE YOUR HARM', { eclipse: 1 }],
  'saturn+manticore': ['PLAGUE RITE', 'THE POISONED DEAD INFECT THEIR NEIGHBOURS', { plague: 1 }],
  'saturn+cockatrice': ['PETRIFY RITE', 'THE SLAIN STIFFEN THOSE BESIDE THEM', { petrifyKill: 1 }],
  'saturn+griffin': ['SKY RITE', 'TWO MORE LEAPS INTO THE DARK', { airjump: 2 }],
  'saturn+unicorn': ['SACRIFICE RITE', 'HEARTS SPEND THEMSELVES TO MEND YOU', { sacrifice: 1 }],
  'saturn+blackdog': ['AVARICE RITE', 'FORTUNE AND GEMS, BUT HEARTS ARE SCARCE', { luck: 3, gems: 3, miser: 1 }],

  // BASILISK and PHOENIX — the two cards found deepest
  'mercury+basilisk': ['BASILISK EDGE', 'YOUR BLADE PIERCES ANY WARD', { dmg: 1, sunder: 1 }],
  'mercury+phoenix': ['PHOENIX EDGE', 'BLADE +2, AND YOUR BLOWS BURN HOTTER', { dmg: 2, burn: 2 }],
  'mars+basilisk': ['BASILISK MAIL', 'WHAT STRIKES YOU IS SLOWED TO STONE', { rPetrify: 1, armor: 1 }],
  'mars+phoenix': ['PHOENIX MAIL', 'YOU RISE ONCE FROM A KILLING BLOW', { rebirth: 1 }],
  'jupiter+basilisk': ['BASILISK EYE', 'A STONE GAZE ANSWERS THE THROWN ARM', { subPetrify: 1 }],
  'jupiter+phoenix': ['PHOENIX FLIGHT', 'YOUR THROWN ARM RETURNS ALIGHT', { subBurn: 2, subReturn: 1 }],
  'saturn+basilisk': ['BASILISK COIL', 'A STONE SERPENT COILS AT YOUR HEEL', { familiar: 'basilisk' }],
  'saturn+phoenix': ['PHOENIX ROOST', 'A BURNING BIRD KEEPS PACE WITH YOU', { familiar: 'phoenix', aura: 'burn' }],

  // NEBULA — the card from the void: dark power at any price
  'mercury+nebula': ['VOID EDGE', 'BLADE +3, BUT EACH BLOW COSTS A HALF-HEART', { dmg: 3, voidToll: true }],
  'mars+nebula': ['VOID MAIL', 'WOUNDS TAKEN HEAL YOU, THEN BURN YOU LATER', { voidMail: true }],
  'jupiter+nebula': ['VOID WARD', 'A SPHERE OF NOTHING ERASES WHAT ENTERS', { voidAura: true }],
  'saturn+nebula': ['VOID RITE', 'BLADE +5. YOUR HEALTH SHRINKS BY THE MINUTE', { dmg: 5, voidRite: true }],
  'nebula+basilisk': ['VOID BASILISK', 'TWO SERPENTS OF NOTHING CIRCLE YOU', { familiar: 'voidbasilisk' }],
  'nebula+phoenix': ['DARK PHOENIX', 'YOU RISE TWICE, BUT THE SECOND TIME LEAVES A SCAR', { dmg: 3, darkRebirth: true }],
};
const cardIconCache = {};
function cardIcon(key) {
  if (cardIconCache[key]) return cardIconCache[key];
  const cv = document.createElement('canvas');
  cv.width = 12; cv.height = 16;
  const g = cv.getContext('2d');
  const isAction = CARD_ACTIONS.includes(key);
  g.fillStyle = '#0a0812'; g.fillRect(0, 0, 12, 16);
  g.fillStyle = isAction ? '#8a2c2c' : '#2c4a8a';
  g.fillRect(1, 1, 10, 14);
  g.fillStyle = '#d8a848';
  g.fillRect(0, 0, 12, 1); g.fillRect(0, 15, 12, 1);
  g.fillRect(0, 0, 1, 16); g.fillRect(11, 0, 1, 16);
  drawText(g, CARD_LETTER[key], 4, 5, '#f0ead8', 1);
  cardIconCache[key] = cv;
  return cv;
}


// ---------------------------------------------------------------- shrine skills
// Three branches: the body (movement), the blade (offence), the vigil (survival).
// `req` gates the deeper ones, so the tree has to be walked, not skimmed.
const SKILLS = [
  // --- the body
  { key: 'slide', name: 'HUNTER SLIDE', desc: 'DOWN+C  LOW SLIDING KICK', cost: 8 },
  { key: 'dash', name: 'PHANTOM STEP', desc: 'C IN AIR  DASH THROUGH THE DARK', cost: 12 },
  { key: 'tempest', name: 'TEMPEST STEP', desc: 'A SECOND PHANTOM STEP', cost: 20, req: 'dash' },
  { key: 'veil', name: 'VEIL STEP', desc: 'PHANTOM STEP BECOMES A BLINK', cost: 24, req: 'tempest' },
  { key: 'swiftfoot', name: 'SWIFT FOOT', desc: 'YOU RUN A TENTH FASTER', cost: 10 },
  { key: 'highjump', name: 'HIGH LEAP', desc: 'YOUR JUMPS CARRY HIGHER', cost: 12 },
  { key: 'lowform', name: 'LOW FORM', desc: 'SLIDES CARRY YOU FARTHER', cost: 10, req: 'slide' },
  { key: 'featherfall', name: 'FEATHER FALL', desc: 'YOU FALL GENTLY, AND LAND SOFT', cost: 14, req: 'highjump' },
  { key: 'wallcling', name: 'WALL CLING', desc: 'CATCH AND SLIDE DOWN SHEER STONE', cost: 16 },
  { key: 'walljump', name: 'WALL LEAP', desc: 'KICK OFF WALLS TO CLIMB CHIMNEYS', cost: 22, req: 'wallcling' },

  // --- the blade
  { key: 'wave', name: 'CRESCENT WAVE', desc: 'HOLD Z, RELEASE THE LIGHT', cost: 18 },
  { key: 'focus', name: 'FOCUS', desc: 'CRESCENT CHARGES SWIFTER', cost: 12, req: 'wave' },
  { key: 'moonlit', name: 'MOONLIT ARC', desc: 'THE CRESCENT CUTS WIDER AND DEEPER', cost: 22, req: 'focus' },
  { key: 'plunge', name: 'MOONLIT PLUNGE', desc: 'DOWN+Z IN AIR  CRASH DOWN', cost: 15 },
  { key: 'skyfall', name: 'SKYFALL', desc: 'THE PLUNGE LANDS FAR HARDER', cost: 18, req: 'plunge' },
  { key: 'reaper', name: 'REAPER', desc: 'BLADE +2 AGAINST THE NEARLY DEAD', cost: 20 },
  { key: 'lastlight', name: 'LAST LIGHT', desc: 'BLADE +3 WHILE YOUR OWN BLOOD IS LOW', cost: 22, req: 'reaper' },
  { key: 'quickdraw', name: 'QUICK DRAW', desc: 'SUB-WEAPONS COST ONE HEART LESS', cost: 14 },
  { key: 'echo', name: 'ECHOING THROW', desc: 'SUB-WEAPONS PIERCE ONE FOE MORE', cost: 20, req: 'quickdraw' },
  { key: 'tempo', name: 'TEMPO', desc: 'YOUR COMBO FADES FAR SLOWER', cost: 12 },

  // --- the vigil
  { key: 'wind', name: 'SECOND WIND', desc: 'REFUSE DEATH ONCE PER HUNT', cost: 14 },
  { key: 'vamp', name: 'VAMPIRIC EDGE', desc: 'EVERY 4TH KILL RESTORES HEALTH', cost: 16 },
  { key: 'ironheart', name: 'IRON HEART', desc: 'MAX HEALTH +6', cost: 16 },
  { key: 'stalwart', name: 'STALWART', desc: 'DAMAGE TAKEN -1', cost: 24, req: 'ironheart' },
  { key: 'ghostwalk', name: 'GHOST WALK', desc: 'MERCY AFTER A WOUND LASTS LONGER', cost: 14 },
  { key: 'keeneye', name: 'KEEN EYE', desc: 'FORTUNE FAVOURS YOUR SEARCHING', cost: 14 },
  { key: 'windfall', name: 'WINDFALL', desc: 'CANDLES GIVE UP MORE HEARTS', cost: 12 },
  { key: 'prospector', name: 'PROSPECTOR', desc: 'ORE VEINS YIELD MORE, AND BREAK EASIER', cost: 16 },
  { key: 'forgeborn', name: 'FORGEBORN', desc: 'THE FORGE ASKS LESS ESSENCE OF YOU', cost: 18, req: 'prospector' },
  { key: 'farsight', name: 'FAR SIGHT', desc: 'THE CHART REMEMBERS WHAT YOU HAVE NOT SEEN', cost: 16 },
  { key: 'cartograph', name: 'CARTOGRAPHER', desc: 'OBELISKS WAKE FROM FARTHER OFF', cost: 12, req: 'farsight' },
  // --- the second book, opened by what the guardians leave behind
  { key: 'tide', name: 'DROWNED BREATH', desc: 'DEEP WATER NO LONGER DRAGS AT YOU', cost: 0 },
  { key: 'swim', name: 'STILL SWIMMER', desc: 'YOU MOVE FREELY THROUGH FLOOD', cost: 14, req: 'tide' },
  { key: 'ember', name: 'UNQUENCHED EMBER', desc: 'FIRE PASSES THROUGH YOU', cost: 0 },
  { key: 'forgehand', name: 'FORGE HAND', desc: 'ORE COMES AWAY IN HALF THE BLOWS', cost: 16, req: 'ember' },
  { key: 'mist', name: 'PALE MIST', desc: 'DOWN + LEAP STEPS THROUGH THIN STONE', cost: 0 },
  { key: 'phase', name: 'PHASE WALK', desc: 'THE MIST HOLDS A BEAT LONGER', cost: 20, req: 'mist' },
  { key: 'ironjaw', name: 'IRON JAW', desc: 'ARMOURED FOES NO LONGER CAP YOUR DAMAGE', cost: 18 },
  { key: 'longarm', name: 'LONG ARM', desc: 'EVERY WEAPON REACHES A LITTLE FARTHER', cost: 16 },
  { key: 'quickdraw', name: 'QUICK DRAW', desc: 'SWAPPING WEAPONS COSTS NO BEAT', cost: 12 },
  { key: 'scavenger', name: 'SCAVENGER', desc: 'BROKEN CANDLES GIVE UP MORE', cost: 14 },
  { key: 'cartographer', name: 'CARTOGRAPHER', desc: 'THE CHART REMEMBERS FARTHER THAN YOU SEE', cost: 12 },
  { key: 'secondwind', name: 'SECOND WIND', desc: 'ONCE A SCENE, A KILL MENDS ONE WOUND', cost: 22 },
  // --- the third book: dragonfire, void, and the deep
  { key: 'dragonfire', name: 'DRAGONFIRE HEART', desc: 'EVERBURNING. FIRE CANNOT TOUCH YOU', cost: 0 },
  { key: 'pyre', name: 'FUNERAL PYRE', desc: 'PLUNGES LEAVE FIRE WHERE THEY LAND', cost: 18, req: 'dragonfire' },
  { key: 'meteor', name: 'METEOR STRIKE', desc: 'PLUNGES FROM HIGH ABOVE SHATTER THE WHOLE ROOM', cost: 26, req: 'pyre' },
  { key: 'shadowmeld', name: 'SHADOW MELD', desc: 'AFTER EVERY KILL: BRIEF AND TERRIBLE UNSEEN', cost: 20, req: 'dash' },
  { key: 'combustion', name: 'COMBUSTION', desc: 'THE SLAIN BURST, AND THE LIVING BURN', cost: 22, req: 'shadowmeld' },
  { key: 'soulharvest', name: 'SOUL HARVEST', desc: 'EVERY SOUL GIVES TWO MORE HEALTH', cost: 20, req: 'vamp' },
  { key: 'twinfang', name: 'TWIN FANG', desc: 'THE VAMPIRIC EDGE MENDS EVERY SECOND KILL', cost: 26, req: 'soulharvest' },
  { key: 'voidbless', name: 'VOID BLESSING', desc: 'THE DARK DOES NOT HUNGER FOR YOUR HEARTS', cost: 22, req: 'shadowmeld' },
  { key: 'starlight', name: 'STARLIGHT PATH', desc: 'ON SKY BRIDGES, YOU FALL HALF AS FAST', cost: 18, req: 'featherfall' },
  { key: 'deepbreath', name: 'DEEP BREATH', desc: 'THE BLACK WATER CANNOT DROWN YOU', cost: 20, req: 'swim' },
];


// ---------------------------------------------------------------- enemy variants
// species x variant = the bestiary. Deeper stages breed stranger fiends.
const ENEMY_VARIANTS = [
  { key: '', name: '', color: null, hpMul: 1, dmgAdd: 0, scoreMul: 1 },
  { key: 'frost', name: 'FROSTBOUND', color: '#6ab0f0', hpMul: 1.2, dmgAdd: 0, scoreMul: 2, chills: true },
  { key: 'ember', name: 'EMBERBORN', color: '#ff9020', hpMul: 1.2, dmgAdd: 1, scoreMul: 2, firepool: true },
  { key: 'venom', name: 'VENOMOUS', color: '#5aa04a', hpMul: 1.1, dmgAdd: 0, scoreMul: 2, poisons: true },
  { key: 'gilded', name: 'GILDED', color: '#ffd858', hpMul: 1.4, dmgAdd: 0, scoreMul: 4, gilded: true },
  { key: 'shadow', name: 'SHADOWED', color: '#5c5678', hpMul: 1, dmgAdd: 1, scoreMul: 2, shadow: true },
  { key: 'blood', name: 'BLOODSWORN', color: '#c02535', hpMul: 1.3, dmgAdd: 0, scoreMul: 2, leech: true },
  { key: 'regen', name: 'UNDYING', color: '#8ad0a0', hpMul: 1.3, dmgAdd: 0, scoreMul: 3, regen: true },
  { key: 'shield', name: 'WARDED', color: '#b8c0cc', hpMul: 1, dmgAdd: 0, scoreMul: 3, shield: 3 },
  { key: 'burst', name: 'VOLATILE', color: '#e04040', hpMul: 0.9, dmgAdd: 0, scoreMul: 2, explodes: true },
  { key: 'storm', name: 'STORMTOUCHED', color: '#c07af0', hpMul: 1.2, dmgAdd: 1, scoreMul: 3, shocks: true },
];

const BESTIARY_SPECIES = [
  { key: 'Zombie', name: 'RISEN SKELETON', sheet: 'skelWalk', lore: 'THE CASTLE NEVER BURIES ITS DEAD' },
  { key: 'ZombieK', name: 'BONE KNIGHT', sheet: 'skelWalk', lore: 'ARMOR OLDER THAN ITS BONES' },
  { key: 'Bat', name: 'CAVE BAT', sheet: null, lore: 'IT HEARD YOU BREATHING' },
  { key: 'BatB', name: 'BLOOD BAT', sheet: null, lore: 'IT TITHES IN HEARTS' },
  { key: 'MedusaHead', name: 'FIRE SKULL', sheet: 'fireSkull', lore: 'GRIEF SET ALIGHT' },
  { key: 'HellHound', name: 'HELL HOUND', sheet: 'houndRun', lore: 'IT REMEMBERS EVERY SCENT' },
  { key: 'MoonWolf', name: 'MOON WOLF', sheet: 'wolfRun', lore: 'THE PALE PACK HUNTS ALONE' },
  { key: 'Ghost', name: 'RESTLESS SHADE', sheet: 'ghostIdle', lore: 'IT ONLY WANTS COMPANY' },
  { key: 'GiantBat', name: 'VESPERTILIO', sheet: 'demonIdle', lore: 'FIRST GUARDIAN OF THE DEEP' },
  { key: 'NightmareBoss', name: 'TENEBRAE', sheet: 'nightmareIdle', lore: 'THE NIGHT GIVEN HOOVES' },
  { key: 'HellBeastBoss', name: 'MOLOCH', sheet: 'beastIdle', lore: 'HUNGER THAT LEARNED TO WALK' },
  { key: 'Gargoyle', name: 'GARGOYLE', sheet: null, lore: 'STONE THAT WAITS FOR YOU TO PASS BENEATH' },
  { key: 'RobedZombie', name: 'ACOLYTE BONE', sheet: 'skelRobedWalk', lore: 'IT WRITES PRAYERS IN THE DUST' },
  { key: 'HellCat', name: 'HELL CAT', sheet: 'hellCatWalk', lore: 'IT WATCHED YOU BEFORE YOU SAW IT' },
  { key: 'BogThing', name: 'BOG WRETCH', sheet: 'bogWalk', lore: 'THE SWAMP WORE IT LIKE A SHROUD' },
  { key: 'Wraith', name: 'SHRIEKING WRAITH', sheet: 'ghostShriek', lore: 'IT SCREAMS ONLY ONCE. YOU WILL HEAR IT' },
  { key: 'PlagueRat', name: 'PLAGUE RAT', sheet: null, lore: 'THEY CAME WITH THE FLOOD AND NEVER LEFT' },
  { key: 'CaveCrawler', name: 'CAVE CRAWLER', sheet: null, lore: 'THE WALLS THEMSELVES HAVE TEETH' },
  { key: 'DragonGuardian', name: 'VAELTHRAN', sheet: 'dragonIdle', lore: 'A DRAGON OLDER THAN THE CASTLE' },
];

// ---------------------------------------------------------------- sub-weapon infusions
// Oils worked at the forge: 7 weapons x 10 infusions = 70 armaments.
const INFUSIONS = {
  fire: { name: 'FLAME', color: '#ff9020', desc: 'BURNS FOR EXTRA WOUNDS' },
  frost: { name: 'FROST', color: '#6ab0f0', desc: 'CHILLS WHAT IT STRIKES' },
  venom: { name: 'VENOM', color: '#5aa04a', desc: 'POISON LINGERS IN THE WOUND' },
  shock: { name: 'STORM', color: '#c07af0', desc: 'LIGHTNING ARCS TO ANOTHER FOE' },
  holy: { name: 'SANCTIFIED', color: '#ffe080', desc: 'BONES AND SHADES FEAR IT' },
  shadow: { name: 'UMBRAL', color: '#5c5678', desc: 'STRIKES FROM DARKNESS, +1 WOUND' },
  blood: { name: 'SANGUINE', color: '#c02535', desc: 'DRINKS LIFE FOR ITS BEARER' },
  stone: { name: 'LEADEN', color: '#b8c0cc', desc: 'HEAVY, BRUTAL, +2 WOUNDS' },
  moon: { name: 'LUNAR', color: '#d8d0f0', desc: 'SOMETIMES STRIKES TRUE, X2' },
  wind: { name: 'GALE', color: '#8ad0a0', desc: 'FLIES SWIFT AND FAR' },
};

// ---------------------------------------------------------------- techniques
// Scroll-taught passives, each mastered through four ranks.
// 'stat' techniques feed the same pipeline as relic affixes.
const PERKS = {
  vigor: { name: 'VIGOR', stat: 'maxHp', per: 1, desc: 'MAX HEALTH' },
  edge: { name: 'EDGE', stat: 'dmg', per: 0.5, desc: 'BLADE POWER' },
  stonehide: { name: 'STONEHIDE', stat: 'armor', per: 0.34, desc: 'DAMAGE RESISTED' },
  stride: { name: 'STRIDE', stat: 'speed', per: 0.5, desc: 'SWIFTER FEET' },
  spring: { name: 'SPRING', stat: 'jump', per: 0.5, desc: 'HIGHER LEAPS' },
  fortune: { name: 'FORTUNE', stat: 'luck', per: 0.5, desc: 'KINDER DROPS' },
  avarice: { name: 'AVARICE', stat: 'greed', per: 0.5, desc: 'RICHER KILLS' },
  clarity: { name: 'CLARITY', stat: 'charge', per: 0.5, desc: 'FASTER FOCUS' },
  thirst: { name: 'THIRST', stat: 'vamp', per: 0.5, desc: 'KILLS MAY HEAL' },
  rime: { name: 'RIME', stat: 'chill', per: 0.5, desc: 'BLOWS MAY CHILL' },
  cinder: { name: 'CINDER', stat: 'burn', per: 0.5, desc: 'BLOWS MAY BURN' },
  bounty: { name: 'BOUNTY', stat: 'hearts', per: 0.5, desc: 'FULLER HEARTS' },
  cruelty: { name: 'CRUELTY', hook: 'crit', desc: 'CRITICAL STRIKES' },
  thrift: { name: 'THRIFT', hook: 'subcost', desc: 'CHEAPER THROWS' },
  wrath: { name: 'WRATH', hook: 'crashcost', desc: 'CHEAPER CRASHES' },
  drawing: { name: 'DRAWING', hook: 'magnet', desc: 'TREASURE COMES TO YOU' },
  momentum: { name: 'MOMENTUM', hook: 'combo', desc: 'COMBOS LINGER' },
  refinement: { name: 'REFINEMENT', hook: 'essence', desc: 'RICHER SALVAGE' },
  lowform: { name: 'LOW FORM', hook: 'slide', desc: 'LONGER SLIDES' },
  skyfall: { name: 'SKYFALL', hook: 'plunge', desc: 'HEAVIER PLUNGES' },
  moonlight: { name: 'MOONLIGHT', hook: 'wave', desc: 'BRIGHTER WAVES' },
  surefoot: { name: 'SUREFOOT', hook: 'coyote', desc: 'FORGIVING LEDGES' },
  lapidary: { name: 'LAPIDARY', hook: 'gems', desc: 'GEMS WORTH MORE' },
  gourmand: { name: 'GOURMAND', hook: 'roast', desc: 'MEALS THAT LAST' },
};
const PERK_KEYS = Object.keys(PERKS);
const RANK_NUM = ['', 'I', 'II', 'III', 'IV'];

// ---------------------------------------------------------------- NG+ curses
// From stage 4 on, each descent brands the hunt with another curse.
const CURSES = {
  bloodtax: { name: 'BLOOD TAX', desc: 'MAX HEALTH -4' },
  swarm: { name: 'THE SWARM', desc: 'THE DEAD RISE THICKER' },
  ironfoes: { name: 'IRON FOES', desc: 'ALL FIENDS HARDENED' },
  miser: { name: "MISER'S MOON", desc: 'HEARTS FALL SELDOM' },
  gloom: { name: 'THE GLOOM', desc: 'THE DARK PRESSES CLOSE' },
  sting: { name: 'CRUEL STING', desc: 'ALL WOUNDS CUT DEEPER' },
};

// ---------------------------------------------------------------- power-up buffs
// Short-lived boons that drop from candles and the strange dead.
const BUFFS = {
  fury: { name: 'FURY', color: '#e04040', dur: 600, desc: 'ALL WOUNDS DOUBLED' },
  stoneskin: { name: 'STONESKIN', color: '#b8c0cc', dur: 600, desc: 'ARMOR OF THE MOUNTAIN' },
  swiftness: { name: 'SWIFTNESS', color: '#8ad0a0', dur: 600, desc: 'WIND IN YOUR HEELS' },
  moonveil: { name: 'MOONVEIL', color: '#d8d0f0', dur: 300, desc: 'BRIEFLY UNTOUCHABLE' },
};
const BUFF_KEYS = Object.keys(BUFFS);

// ---------------------------------------------------------------- the crossroads
// Between stages the hunter chooses the road down.
const PATHS = [
  { key: 'cemetery', name: 'THE CEMETERY ROAD', desc: 'THE DEAD WALK THICK. FORTUNE SMILES', bias: 'graveyard', mods: { luck: true } },
  { key: 'rampart', name: 'THE RAMPART WAY', desc: 'STORMS RAGE. HEARTS FALL FREELY', bias: 'battlements', mods: { hearts: true } },
  { key: 'cloister', name: 'THE DEEP CLOISTER', desc: 'CATACOMBS. CRUEL, BUT RICH IN RELICS', bias: 'catacombs', mods: { hp: true, epic: true } },
  { key: 'procession', name: 'THE GREAT PROCESSION', desc: 'ENDLESS HALLS, HIDDEN VAULTS', bias: 'hall', mods: { secrets: true } },
];

// ---------------------------------------------------------------- feats
const FEATS = {
  firstblood: { name: 'FIRST BLOOD', desc: 'SLAY YOUR FIRST FIEND' },
  centurion: { name: 'CENTURION', desc: 'SLAY 100 FIENDS IN ALL' },
  legion: { name: 'BANE OF THE LEGION', desc: 'SLAY 1000 FIENDS IN ALL' },
  comboiv: { name: 'RELENTLESS', desc: 'HOLD A X4 COMBO' },
  allcards: { name: 'FULL ARCANA', desc: 'OWN ALL SEVEN CARDS AT ONCE' },
  blade3: { name: 'MOONFANG BLADE', desc: 'PERFECT THE BLADE' },
  allsouls: { name: 'TRIUNE SOUL', desc: 'CARRY ALL THREE SOULS AT ONCE' },
  rushclear: { name: 'GAUNTLET RUNNER', desc: 'CLEAR THE BOSS RUSH' },
  deep4: { name: 'DELVER', desc: 'REACH STAGE 4' },
  deep7: { name: 'ABYSS WALKER', desc: 'REACH STAGE 7' },
  trueclear: { name: 'DAWNBRINGER', desc: 'FELL THE MOONFANG' },
  nohit: { name: 'UNTOUCHED', desc: 'SLAY A GUARDIAN UNSCATHED' },
  lockpick: { name: 'TREASURER', desc: 'OPEN A LOCKED TREASURY' },
  digger: { name: 'GRAVE ROBBER', desc: 'DIG UP 5 GLIMMERS IN ALL' },
  miner: { name: 'MINER', desc: 'STRIKE ORE FROM THE CASTLE WALLS' },
  secret: { name: 'WALL TAPPER', desc: 'FIND A CHAMBER SOMEBODY WALLED UP' },
  secret5: { name: 'THE MASON\'S SHAME', desc: 'FIND FIVE SEALED CHAMBERS IN ONE HUNT' },
  secret15: { name: 'NOTHING STAYS BURIED', desc: 'FIND FIFTEEN IN ONE HUNT' },
  smith: { name: 'SMITH', desc: 'FORGE SOMETHING AT THE ANVIL' },
  armory: { name: 'ARMORY', desc: 'CARRY FOUR MAIN WEAPONS AT ONCE' },
  arcanist: { name: 'ARCANIST', desc: 'BIND TEN DIFFERENT ARCANA PAIRS' },
  mason: { name: 'WALL BREAKER', desc: 'SHATTER 5 SECRET WALLS IN ALL' },
  firstwarp: { name: 'MIRROR WALKER', desc: 'PASS THROUGH AN OBELISK' },
  packrat: { name: 'RELIQUARY', desc: 'CARRY 8 RELICS AT ONCE' },
  legendary: { name: 'MYTH KEEPER', desc: 'HOLD A LEGENDARY RELIC' },
  firstcrash: { name: 'WRATH UNLEASHED', desc: 'PERFORM AN ITEM CRASH' },
  survivor: { name: 'DEATHLESS', desc: 'SURVIVE BY SECOND WIND' },
  dragonbane: { name: 'DRAGONBANE', desc: 'SLAY THE EVERBURNING' },
  voidtouched: { name: 'VOID TOUCHED', desc: 'BIND A NEBULA CARD' },
  skydancer: { name: 'SKY DANCER', desc: 'REACH THE STORM SPIRES' },
  deepdelver: { name: 'DEEP DELVER', desc: 'REACH THE SUNKEN DEPTHS' },
  soulthief: { name: 'SOUL THIEF', desc: 'CARRY ALL FOUR SOULS AT ONCE' },
  armory5: { name: 'WALKING ARMORY', desc: 'CARRY FIVE WEAPONS AT ONCE' },
  masterblade: { name: 'MASTER BLADE', desc: 'REACH PEERLESS MASTERY WITH ANY WEAPON' },
  allcraft: { name: 'MASTER CRAFTER', desc: 'FORGE 50 ITEMS IN ALL' },
  trueending: { name: 'TRUE ENDING', desc: 'FELL THE MOONFANG WITH ALL GIFTS' },
};

// ---------------------------------------------------------------- lore tablets
const LORE = [
  'THE CASTLE WAS A PRAYER ONCE. SOMETHING ANSWERED.',
  'THE MOON DID NOT RISE. IT WAS BUILT.',
  'EVERY CANDLE IS A WATCHER WHO STAYED TOO LONG.',
  'THE SKELETONS DO NOT HATE YOU. THEY ENVY YOU.',
  'VESPERTILIO WAS THE FIRST TO KNEEL. HIS WINGS REMEMBER.',
  'TENEBRAE CARRIED THE LAST KING DOWN. IT STILL WAITS FOR HIM.',
  'MOLOCH EATS ONLY WHAT IS OFFERED. EVERYTHING IS OFFERED.',
  'THE FORGES BURN ON MARROW AND REGRET.',
  'THE OBELISKS ARE DOORS. THE MIRRORS ARE EYES.',
  'HEARTS ARE THE ONLY COIN THE CASTLE HONORS.',
  'THE BLOOD MOON IS NOT AN OMEN. IT IS A HARVEST.',
  'BENEATH THE DEEPEST STAIR, THE MOONFANG DREAMS OF TEETH.',
];

// ---------------------------------------------------------------- materials
// Struck out of ore veins in the masonry. The forge eats them.
const MATERIALS = {
  boneash:   { name: 'BONE ASH',   short: 'ASH',  color: '#d8d4c0', depth: 0 },
  moonsilver:{ name: 'MOONSILVER', short: 'SILV', color: '#b8d8f0', depth: 0 },
  obsidian:  { name: 'OBSIDIAN',   short: 'OBSD', color: '#6a5a8a', depth: 2 },
  bloodiron: { name: 'BLOOD IRON', short: 'IRON', color: '#c04050', depth: 3 },
  gravesalt: { name: 'GRAVE SALT', short: 'SALT', color: '#8ad0a0', depth: 5 },
  frostglass:{ name: 'FROSTGLASS', short: 'FRST', color: '#a8e8ff', depth: 6 },
  emberlode: { name: 'EMBERLODE',  short: 'EMBR', color: '#ff9040', depth: 6 },
  mirrorshard:{name: 'MIRRORSHARD',short: 'MIRR', color: '#d0c8f0', depth: 7 },
  voidstone: { name: 'VOIDSTONE',  short: 'VOID', color: '#4a3880', depth: 8 },
  dragonbone:{ name: 'DRAGONBONE', short: 'DRGN', color: '#e0c080', depth: 8 },
  stariron:  { name: 'STAR IRON',  short: 'STAR', color: '#c8e0ff', depth: 7 },
};
const MATERIAL_KEYS = Object.keys(MATERIALS);

// which materials a vein can yield at a given depth
function veinRoll(stage) {
  const pool = MATERIAL_KEYS.filter(k => stage >= MATERIALS[k].depth);
  return pool[(Math.random() * pool.length) | 0];
}

// ---------------------------------------------------------------- recipes
// Everything the forge can make. `cost` is materials; `essence` is the old currency.
const RECIPE_CATS = ['ARMS', 'INFUSIONS', 'ARCANA', 'RELICS', 'CHARMS', 'RITES', 'DRAUGHTS', 'ORE'];
const RECIPES = [
  // ---- ARMS
  { key: 'temper', cat: 'ARMS', name: 'TEMPER THE BLADE', desc: 'RAISE YOUR WEAPON ONE LEVEL',
    cost: { moonsilver: 2, boneash: 2 }, essence: 8, kind: 'temper' },
  { key: 'w_sword', cat: 'ARMS', name: 'SILVER LONGSWORD', desc: 'SHORT, SWIFT STEEL',
    cost: { moonsilver: 3, boneash: 2 }, essence: 6, kind: 'weapon', weapon: 'sword' },
  { key: 'w_spear', cat: 'ARMS', name: 'CRYPT SPEAR', desc: 'THE LONGEST THRUST',
    cost: { boneash: 4, obsidian: 1 }, essence: 6, kind: 'weapon', weapon: 'spear' },
  { key: 'w_axe', cat: 'ARMS', name: 'GRAVEDIGGER AXE', desc: 'SLOW AND CRUEL',
    cost: { bloodiron: 3, obsidian: 2 }, essence: 10, kind: 'weapon', weapon: 'axe' },
  { key: 'w_claws', cat: 'ARMS', name: 'WOLFBONE CLAWS', desc: 'TEAR FASTER THAN THE EYE',
    cost: { boneash: 3, gravesalt: 2 }, essence: 10, kind: 'weapon', weapon: 'claws' },
  { key: 'w_scythe', cat: 'ARMS', name: 'GRAVEWARDEN SCYTHE', desc: 'FORGED ONLY. A WIDE REAPING ARC',
    cost: { obsidian: 3, gravesalt: 3, moonsilver: 2 }, essence: 16, kind: 'weapon', weapon: 'scythe' },
  { key: 'w_censer', cat: 'ARMS', name: 'BURNING CENSER', desc: 'FORGED ONLY. SETS THE AIR ALIGHT',
    cost: { bloodiron: 3, obsidian: 3, boneash: 3 }, essence: 16, kind: 'weapon', weapon: 'censer' },
  { key: 'w_rapier', cat: 'ARMS', name: 'SILVER RAPIER', desc: 'THREE THRUSTS TO ANOTHER BLADE\'S ONE',
    cost: { moonsilver: 4, boneash: 1 }, essence: 8, kind: 'weapon', weapon: 'rapier' },
  { key: 'w_great', cat: 'ARMS', name: 'CATHEDRAL GREATSWORD', desc: 'ENORMOUS, AND SLOW AS A BELL',
    cost: { bloodiron: 5, obsidian: 3 }, essence: 20, kind: 'weapon', weapon: 'greatsword' },
  { key: 'w_flail', cat: 'ARMS', name: 'PENITENT FLAIL', desc: 'THE HEAD SWINGS WIDE',
    cost: { bloodiron: 3, boneash: 3 }, essence: 12, kind: 'weapon', weapon: 'flail' },
  { key: 'w_halberd', cat: 'ARMS', name: 'WARDEN HALBERD', desc: 'REACH AND WEIGHT BOTH',
    cost: { moonsilver: 3, bloodiron: 3, obsidian: 1 }, essence: 14, kind: 'weapon', weapon: 'halberd' },
  { key: 'w_daggers', cat: 'ARMS', name: 'TWIN FANGS', desc: 'FASTER THAN THOUGHT',
    cost: { gravesalt: 3, moonsilver: 2 }, essence: 12, kind: 'weapon', weapon: 'daggers' },
  { key: 'sub_any', cat: 'ARMS', name: 'CAST A SUB-WEAPON', desc: 'ANY THROWN ARM YOU DO NOT CARRY',
    cost: { boneash: 2, moonsilver: 1 }, essence: 5, kind: 'sub' },
  { key: 'hearts', cat: 'ARMS', name: 'HEART SHOT', desc: '20 HEARTS OF AMMUNITION',
    cost: { boneash: 2 }, essence: 3, kind: 'hearts' },

  // ---- RELICS
  { key: 'relic', cat: 'RELICS', name: 'FORGE A RELIC', desc: 'SHAPE A RELIC OF FINE MAKE',
    cost: { moonsilver: 2, obsidian: 2 }, essence: 12, kind: 'relic', bias: 1.6 },
  { key: 'relic2', cat: 'RELICS', name: 'GREAT RELIC', desc: 'THE FORGE STRAINS. RARER STILL',
    cost: { moonsilver: 4, obsidian: 3, bloodiron: 2 }, essence: 24, kind: 'relic', bias: 3.2 },
  { key: 'relic3', cat: 'RELICS', name: 'RELIC OF LEGEND', desc: 'ONCE IN A HUNT, IF THAT',
    cost: { moonsilver: 6, obsidian: 5, bloodiron: 4, gravesalt: 3 }, essence: 48, kind: 'relic', bias: 6 },
  { key: 'scroll', cat: 'RELICS', name: 'TECHNIQUE SCROLL', desc: 'TEACHES A TECHNIQUE YOU LACK',
    cost: { boneash: 3, gravesalt: 1 }, essence: 14, kind: 'scroll' },
  { key: 'scroll2', cat: 'RELICS', name: 'GREATER SCROLL', desc: 'TWO TECHNIQUES AT ONCE',
    cost: { boneash: 5, gravesalt: 3, moonsilver: 2 }, essence: 30, kind: 'scroll', double: true },

  // ---- DRAUGHTS
  { key: 'elixir', cat: 'DRAUGHTS', name: 'ELIXIR OF VIGOUR', desc: 'MAX HEALTH +2',
    cost: { moonsilver: 3, gravesalt: 1 }, essence: 10, kind: 'elixir' },
  { key: 'elixir2', cat: 'DRAUGHTS', name: 'GREAT ELIXIR', desc: 'MAX HEALTH +6',
    cost: { moonsilver: 7, gravesalt: 3 }, essence: 28, kind: 'elixir', amount: 6 },
  { key: 'roast', cat: 'DRAUGHTS', name: 'WALL ROAST', desc: 'MEND 12 WOUNDS AT ONCE',
    cost: { boneash: 2, gravesalt: 1 }, essence: 5, kind: 'heal', amount: 12 },
  { key: 'key', cat: 'DRAUGHTS', name: 'GOLDEN KEY', desc: 'OPENS ONE TREASURY GATE',
    cost: { bloodiron: 2 }, essence: 6, kind: 'key' },
  { key: 'key2', cat: 'DRAUGHTS', name: 'RING OF KEYS', desc: 'THREE GATES, THREE KEYS',
    cost: { bloodiron: 5 }, essence: 15, kind: 'key', amount: 3 },
  { key: 'gems', cat: 'DRAUGHTS', name: 'CUT GEMSTONES', desc: '25 GEMS FOR THE MERCHANT',
    cost: { obsidian: 2, moonsilver: 1 }, essence: 8, kind: 'gems', amount: 25 },
  { key: 'lantern', cat: 'DRAUGHTS', name: 'HUNTER\'S LANTERN', desc: 'THE CHART REMEMBERS THIS WHOLE FLOOR',
    cost: { moonsilver: 2, obsidian: 1 }, essence: 9, kind: 'reveal' },

  // ---- ARMS, the second rack
  { key: 'w_moonchain', cat: 'ARMS', name: 'MOONLIT CHAIN', desc: 'THE HEAD TRAVELS OUTWARD',
    cost: { moonsilver: 5, bloodiron: 2 }, essence: 14, kind: 'weapon', weapon: 'moonchain' },
  { key: 'w_warhammer', cat: 'ARMS', name: 'RUIN HAMMER', desc: 'THE GROUND ANSWERS EVERY BLOW',
    cost: { bloodiron: 6, obsidian: 3 }, essence: 20, kind: 'weapon', weapon: 'warhammer' },
  { key: 'w_nodachi', cat: 'ARMS', name: 'NIGHTFALL NODACHI', desc: 'A GREAT UNHURRIED ARC',
    cost: { moonsilver: 4, bloodiron: 3 }, essence: 16, kind: 'weapon', weapon: 'nodachi' },
  { key: 'w_kris', cat: 'ARMS', name: 'SERPENT KRIS', desc: 'FASTEST STEEL. IT LEAVES VENOM',
    cost: { obsidian: 3, gravesalt: 2 }, essence: 13, kind: 'weapon', weapon: 'kris' },
  { key: 'w_glaive', cat: 'ARMS', name: 'MOONGLAIVE', desc: 'IT CUTS BEHIND YOU TOO',
    cost: { moonsilver: 4, obsidian: 3 }, essence: 16, kind: 'weapon', weapon: 'glaive' },
  { key: 'w_bonelash', cat: 'ARMS', name: 'OSSUARY LASH', desc: 'IT TRAVELS, AND IT DRINKS',
    cost: { boneash: 6, gravesalt: 2 }, essence: 15, kind: 'weapon', weapon: 'bonelash' },
  { key: 'w_crozier', cat: 'ARMS', name: 'INQUISITOR CROZIER', desc: 'THE DEAD CANNOT ABIDE IT',
    cost: { moonsilver: 5, gravesalt: 3 }, essence: 18, kind: 'weapon', weapon: 'crozier' },
  { key: 'w_frostbrand', cat: 'ARMS', name: 'FROSTBRAND', desc: 'WHAT IT CUTS STOPS MOVING',
    cost: { frostglass: 4, moonsilver: 3 }, essence: 20, kind: 'weapon', weapon: 'frostbrand' },

  // ---- CHARMS: worn things, made rather than found
  { key: 'c_ward', cat: 'CHARMS', name: 'WARDING CHARM', desc: 'ARMOUR +2 WHILE IT HOLDS',
    cost: { obsidian: 2, gravesalt: 1 }, essence: 10, kind: 'relic', bias: 1.4 },
  { key: 'c_hunger', cat: 'CHARMS', name: 'CHARM OF HUNGER', desc: 'A RELIC BENT TOWARD THE BLADE',
    cost: { bloodiron: 3, boneash: 2 }, essence: 12, kind: 'relic', bias: 1.8 },
  { key: 'c_moon', cat: 'CHARMS', name: 'MOON-CUT CHARM', desc: 'A RELIC OF THE HIGHER SORT',
    cost: { moonsilver: 5, obsidian: 2 }, essence: 18, kind: 'relic', bias: 2.4 },
  { key: 'c_mirror', cat: 'CHARMS', name: 'MIRROR CHARM', desc: 'THE FINEST THE FORGE WILL GIVE',
    cost: { mirrorshard: 3, moonsilver: 4 }, essence: 26, kind: 'relic', bias: 3.0 },
  { key: 'c_ember', cat: 'CHARMS', name: 'EMBER CHARM', desc: 'A RELIC WITH FIRE IN IT',
    cost: { emberlode: 3, bloodiron: 2 }, essence: 22, kind: 'relic', bias: 2.6 },

  // ---- RITES: one-off workings, spent at once
  { key: 'r_mend', cat: 'RITES', name: 'RITE OF MENDING', desc: 'MEND EVERY WOUND YOU CARRY',
    cost: { gravesalt: 2, moonsilver: 2 }, essence: 14, kind: 'heal', amount: 99 },
  { key: 'r_hearts', cat: 'RITES', name: 'RITE OF PLENTY', desc: '40 HEARTS FOR THE THROWN ARM',
    cost: { boneash: 3, bloodiron: 1 }, essence: 9, kind: 'hearts', amount: 40 },
  { key: 'r_chart', cat: 'RITES', name: 'RITE OF SEEING', desc: 'THE WHOLE CASTLE, ON THE CHART',
    cost: { mirrorshard: 1, obsidian: 3 }, essence: 20, kind: 'reveal' },
  { key: 'r_ward', cat: 'RITES', name: 'RITE OF THE OPEN WAY', desc: 'THREE GATES, THREE KEYS',
    cost: { bloodiron: 4, emberlode: 1 }, essence: 16, kind: 'key', amount: 3 },
  { key: 'r_vigour', cat: 'RITES', name: 'RITE OF VIGOUR', desc: 'MAX HEALTH +10',
    cost: { gravesalt: 4, moonsilver: 6 }, essence: 34, kind: 'elixir', amount: 10 },

  // ---- ORE, the deeper seams
  { key: 'o_frost', cat: 'ORE', name: 'CHILL THE SEAM', desc: 'MAKE FROSTGLASS FROM SILVER',
    cost: { moonsilver: 4, obsidian: 2 }, essence: 12, kind: 'ore', mat: 'frostglass', amount: 2 },
  { key: 'o_ember', cat: 'ORE', name: 'BANK THE COALS', desc: 'MAKE EMBERLODE FROM IRON',
    cost: { bloodiron: 4, boneash: 3 }, essence: 12, kind: 'ore', mat: 'emberlode', amount: 2 },
  { key: 'o_mirror', cat: 'ORE', name: 'SILVER THE GLASS', desc: 'MAKE MIRRORSHARD',
    cost: { frostglass: 2, moonsilver: 4 }, essence: 18, kind: 'ore', mat: 'mirrorshard', amount: 2 },

  // ---- the third forge: void-forged arms and dragon-wrought steel
  { key: 'w_voidfang', cat: 'ARMS', name: 'VOIDFANG', desc: 'FORGED ONLY. DRINKS THE FOE',
    cost: { voidstone: 4, obsidian: 3 }, essence: 22, kind: 'weapon', weapon: 'voidfang' },
  { key: 'w_sunsplitter', cat: 'ARMS', name: 'SUNSPLITTER', desc: 'FORGED ONLY. HOLY FLAME',
    cost: { moonsilver: 5, emberlode: 3, gravesalt: 2 }, essence: 24, kind: 'weapon', weapon: 'sunsplitter' },
  { key: 'w_twinfire', cat: 'ARMS', name: 'TWINFIRE BLADES', desc: 'TWO BURNING STEEL TONGUES',
    cost: { emberlode: 3, bloodiron: 2 }, essence: 15, kind: 'weapon', weapon: 'twinfire' },
  { key: 'w_stormglaive', cat: 'ARMS', name: 'STORMCALLER GLAIVE', desc: 'FORGED ONLY. LIGHTNING LEAPS',
    cost: { voidstone: 3, moonsilver: 4, stariron: 2 }, essence: 26, kind: 'weapon', weapon: 'stormglaive' },
  { key: 'w_thornwhip', cat: 'ARMS', name: 'THORNHEART WHIP', desc: 'FORGED ONLY. VENOM AND LIFE',
    cost: { gravesalt: 4, boneash: 4, obsidian: 2 }, essence: 20, kind: 'weapon', weapon: 'thornwhip' },
  { key: 'w_hearthammer', cat: 'ARMS', name: 'HEARTHAMMER', desc: 'FORGED ONLY. THE GROUND BURNS',
    cost: { emberlode: 5, bloodiron: 4, dragonbone: 2 }, essence: 28, kind: 'weapon', weapon: 'hearthammer' },
  { key: 'w_frostbite', cat: 'ARMS', name: 'FROSTBITE DAGGER', desc: 'A CRYSTAL BLADE',
    cost: { frostglass: 4, moonsilver: 2 }, essence: 14, kind: 'weapon', weapon: 'frostbite' },
  { key: 'w_shadowscythe', cat: 'ARMS', name: 'SHADOW SCYTHE', desc: 'FORGED ONLY. PASSES THROUGH',
    cost: { voidstone: 4, obsidian: 3, boneash: 3 }, essence: 24, kind: 'weapon', weapon: 'shadowscythe' },
  { key: 'w_bloodletter', cat: 'ARMS', name: 'BLOOD LETTER', desc: 'FORGED ONLY. WOUNDS TWICE',
    cost: { bloodiron: 5, voidstone: 2, gravesalt: 3 }, essence: 30, kind: 'weapon', weapon: 'bloodletter' },
  { key: 'w_lunarblade', cat: 'ARMS', name: 'LUNARBLADE', desc: 'FORGED ONLY. THE MOON AS STEEL',
    cost: { moonsilver: 6, mirrorshard: 3, stariron: 2 }, essence: 32, kind: 'weapon', weapon: 'lunarblade' },
  { key: 'o_void', cat: 'ORE', name: 'TOUCH THE VOID', desc: 'MAKE VOIDSTONE FROM OBSIDIAN',
    cost: { obsidian: 5, mirrorshard: 1 }, essence: 16, kind: 'ore', mat: 'voidstone', amount: 2 },
  { key: 'o_dragon', cat: 'ORE', name: 'KINDLED BONE', desc: 'MAKE DRAGONBONE FROM EMBERLODE',
    cost: { emberlode: 4, bloodiron: 2 }, essence: 18, kind: 'ore', mat: 'dragonbone', amount: 1 },
  { key: 'o_star', cat: 'ORE', name: 'CATCH A STAR', desc: 'MAKE STAR IRON FROM MOONSILVER',
    cost: { moonsilver: 5, frostglass: 2 }, essence: 18, kind: 'ore', mat: 'stariron', amount: 2 },
  { key: 'c_dragon', cat: 'CHARMS', name: 'DRAGON CHARM', desc: 'A RELIC WITH DRAGONFIRE',
    cost: { dragonbone: 2, emberlode: 3 }, essence: 28, kind: 'relic', bias: 3.4 },
  { key: 'c_void', cat: 'CHARMS', name: 'VOID CHARM', desc: 'A RELIC FROM THE DARK BETWEEN',
    cost: { voidstone: 3, obsidian: 3 }, essence: 30, kind: 'relic', bias: 3.6 },
  { key: 'r_voidward', cat: 'RITES', name: 'RITE OF THE VOID', desc: 'ALL ENEMIES SLOWED FOR A SCENE',
    cost: { voidstone: 2, gravesalt: 3 }, essence: 20, kind: 'voidrite' },
  { key: 'r_pyre', cat: 'RITES', name: 'RITE OF THE FUNERAL PYRE', desc: 'MASSIVE FIRE DAMAGE TO ALL NEARBY',
    cost: { dragonbone: 1, emberlode: 3 }, essence: 24, kind: 'pyre' },
  { key: 'r_soulbind', cat: 'RITES', name: 'RITE OF SOUL BINDING', desc: 'MAX HEALTH +8, AND HEARTS +10',
    cost: { voidstone: 1, moonsilver: 4, gravesalt: 4 }, essence: 28, kind: 'soulbind' },
];

// Every thrown arm can be cast to order — the forge is where you build a loadout.
const SUB_COST = {
  knife: { boneash: 2 }, axe: { boneash: 2, bloodiron: 1 }, holy: { moonsilver: 2 },
  cross: { moonsilver: 2, obsidian: 1 }, watch: { obsidian: 2, moonsilver: 1 },
  bible: { moonsilver: 2, gravesalt: 1 }, stone: { obsidian: 2 },
  javelin: { bloodiron: 2, boneash: 2 }, bomb: { bloodiron: 3, gravesalt: 1 },
  chakram: { moonsilver: 3, obsidian: 2 }, shuriken: { boneash: 3, moonsilver: 1 },
  harpoon: { bloodiron: 3, boneash: 2 }, bolas: { boneash: 3, obsidian: 1 },
  flare: { emberlode: 2, gravesalt: 1 }, fang: { boneash: 2, moonsilver: 2 },
  voidshard: { voidstone: 3, obsidian: 1 }, lightningorb: { stariron: 2, moonsilver: 2 },
  crystalshard: { frostglass: 3, moonsilver: 1 }, darkflame: { voidstone: 2, emberlode: 2 },
};
for (const sk of Object.keys(SUBWEAPONS)) {
  RECIPES.push({
    key: 'sub_' + sk, cat: 'ARMS', name: SUBWEAPONS[sk].name,
    desc: SUBWEAPONS[sk].desc.replace('UP+Z. ', '').replace('UP+Z TO THROW. ', ''),
    cost: SUB_COST[sk] || { boneash: 2 }, essence: 7,
    kind: 'subKey', sub: sk,
  });
}

// Every boon has its own phial, so the matrix rewards knowing what you want.
for (const bk of BUFF_KEYS) {
  RECIPES.push({
    key: 'phial_' + bk, cat: 'DRAUGHTS', name: BUFFS[bk].name + ' PHIAL',
    desc: BUFFS[bk].desc, cost: { gravesalt: 1, boneash: 1 }, essence: 4,
    kind: 'phial', buff: bk,
  });
}

// Every infusion can be beaten into the sub-weapon you carry.
for (const ik of Object.keys(INFUSIONS)) {
  const inf = INFUSIONS[ik];
  RECIPES.push({
    key: 'inf_' + ik, cat: 'INFUSIONS', name: inf.name + ' INFUSION',
    desc: inf.desc, cost: { obsidian: 2, moonsilver: 1 }, essence: 8,
    kind: 'infusion', infusion: ik,
  });
}

// Every arcana can be struck from silver, if you know which one you want.
for (const ck of CARD_ACTIONS.concat(CARD_ATTRS)) {
  const isAction = CARD_ACTIONS.includes(ck);
  RECIPES.push({
    key: 'card_' + ck, cat: 'ARCANA', name: CARD_NAME[ck],
    desc: isAction ? 'AN ACTION CARD' : 'AN ATTRIBUTE CARD',
    cost: isAction ? { moonsilver: 4, gravesalt: 2 } : { moonsilver: 3, gravesalt: 2 },
    essence: isAction ? 22 : 16, kind: 'cardKey', card: ck,
  });
}

// Ore begets ore: three of what you have for one of what you need.
for (const from of MATERIAL_KEYS) {
  for (const to of MATERIAL_KEYS) {
    if (from === to) continue;
    if (MATERIALS[to].depth <= MATERIALS[from].depth + 2) {
      RECIPES.push({
        key: 'tr_' + from + '_' + to, cat: 'ORE',
        name: MATERIALS[from].short + ' INTO ' + MATERIALS[to].short,
        desc: 'TRANSMUTE THREE INTO ONE',
        cost: { [from]: 3 }, essence: 2, kind: 'transmute', to,
      });
    }
  }
}

// ---------------------------------------------------------------- the hunt's toll
// Experience, in the old Castlevania manner: levels raise the floor of your
// power so a long hunt always moves forward, even between relic drops.
const XP_BASE = 26;
function xpForLevel(lv) { return Math.round(XP_BASE * Math.pow(lv, 1.45)); }

// Weapon mastery, in the Dead Cells / Aria manner: the weapon you actually
// swing gets better at being swung. Mastery is permanent across hunts.
const MASTERY_STEPS = [0, 40, 120, 280, 560, 1000];
function masteryRank(kills) {
  let r = 0;
  for (let i = 1; i < MASTERY_STEPS.length; i++) if (kills >= MASTERY_STEPS[i]) r = i;
  return r;
}
const MASTERY_NAME = ['UNTRIED', 'PRACTISED', 'KEEN', 'DEADLY', 'MASTERFUL', 'PEERLESS'];
