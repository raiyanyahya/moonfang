// Sprites: Gothicvania asset sheets (CC0 by Ansimuz) + small procedural pixel art.
// Character/enemy art is loaded from assets/ and sliced into anchored animation sheets.

const PAL = {
  o: '#14101c',
  W: '#e8e4d8',
  G: '#d8a848',
  S: '#f2c99c', s: '#c98d63', H: '#6b3416',
  R: '#a32c38', r: '#6e1b26',
  B: '#7a4a28', b: '#4a2c18',
  P: '#3a3a52',
  U: '#6a4a8a', u: '#46305e', E: '#e04040', M: '#2a1a34', F: '#e8e4d8',
  N: '#4a9a4a',
  Y: '#ffe080', O: '#ff9020',
  Q: '#e04858',
  C: '#50d8e8', c: '#2890b8',
  V: '#c060e0', v: '#8030a0',
  k: '#47121a',
  L: '#9a97a8', l: '#6f6c80', m: '#4a4858',
};

function makeSprite(name, rows) {
  const w = rows[0].length, h = rows.length;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].length !== w) {
      throw new Error(`sprite '${name}' row ${i} is ${rows[i].length} wide, expected ${w}`);
    }
  }
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch === '.' || ch === ' ') continue;
      const col = PAL[ch];
      if (!col) throw new Error(`sprite '${name}' unknown char '${ch}' at ${x},${y}`);
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  }
  return cv;
}

function flipH(src) {
  const cv = document.createElement('canvas');
  cv.width = src.width; cv.height = src.height;
  const g = cv.getContext('2d');
  g.translate(src.width, 0);
  g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  return cv;
}

function whiteCopy(src) {
  const cv = document.createElement('canvas');
  cv.width = src.width; cv.height = src.height;
  const g = cv.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#f8f8ff';
  g.fillRect(0, 0, cv.width, cv.height);
  return cv;
}

function darkCopy(src, color) {
  const cv = document.createElement('canvas');
  cv.width = src.width; cv.height = src.height;
  const g = cv.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color || '#191330';
  g.fillRect(0, 0, cv.width, cv.height);
  return cv;
}

// ---------------------------------------------------------------- asset sheets
const Assets = { img: {}, ready: false };

const ASSET_FILES = {
  heroIdle: 'assets/hero-idle.png',
  heroRun: 'assets/hero-run.png',
  heroAttack: 'assets/hero-attack.png',
  heroJump: 'assets/hero-jump.png',
  heroCrouch: 'assets/hero-crouch.png',
  heroCrouchSlash: 'assets/hero-crouch-slash.png',
  heroHurt: 'assets/hero-hurt.png',
  heroJumpAttack: 'assets/hero-jump-attack.png',
  skelRise: 'assets/skeleton-rise.png',
  skelWalk: 'assets/skeleton-walk.png',
  fireSkull: 'assets/fire-skull.png',
  demonIdle: 'assets/demon-idle.png',
  demonAttack: 'assets/demon-attack.png',
  bgSky: 'assets/bg-sky.png',
  bgClouds: 'assets/bg-clouds.png',
  bgMountains: 'assets/bg-mountains.png',
  bgFar: 'assets/bg-far-buildings.png',
  bgTown: 'assets/bg-town.png',
  houndRun: 'assets/hound-run.png',
  ghostIdle: 'assets/ghost-idle.png',
  nightmareIdle: 'assets/nightmare-idle.png',
  nightmareGallop: 'assets/nightmare-gallop.png',
  beastIdle: 'assets/beast-idle.png',
  wolfRun: 'assets/wolf-run.png',
  beastBreath: 'assets/beast-breath.png',
  fireball: 'assets/fireball.png',
  churchProps: 'assets/church-props.png',
  churchTiles: 'assets/church-tiles.png',
  churchColumn: 'assets/church-column.png',
  townProps: 'assets/town-props.png',
  oldmanIdle: 'assets/oldman-idle.png',
  // --- the second haul of CC0 Gothicvania art
  skelRobedWalk: 'assets/skeleton-robed-walk.png',
  skelRobedRise: 'assets/skeleton-robed-rise.png',
  hellCatWalk: 'assets/hell-cat-walk.png',
  ghostHalo: 'assets/ghost-halo.png',
  spiderWalk: 'assets/spider-walk.png',
  bogWalk: 'assets/bog-thing-walk.png',
  ghostShriek: 'assets/ghost-shriek.png',
  houndIdle: 'assets/hound-idle.png',
  dragonIdle: 'assets/dragon-idle.png',
  dragonBreath: 'assets/dragon-breath.png',
  fxDarkBolt: 'assets/fx-dark-bolt.png',
  fxLightning: 'assets/fx-lightning.png',
  fxSpark: 'assets/fx-spark.png',
  fxDeath: 'assets/fx-enemy-death.png',
  fxSoul: 'assets/fx-soul-burst.png',
  fxSlashRing: 'assets/fx-slash-ring.png',
  castlePanels: 'assets/castle-panels.png',
  bgInterior: 'assets/bg-interior.png',
  bgGraveyard: 'assets/bg-graveyard.png',
  bgGraveMountains: 'assets/bg-grave-mountains.png',
  bgSwamp: 'assets/bg-swamp.png',
  bgSwampMid: 'assets/bg-swamp-mid.png',
  bgSwampNear: 'assets/bg-swamp-near.png',
  bgRocky: 'assets/bg-rocky.png',
  caveWalls: 'assets/cave-walls.png',
  cemeteryProps: 'assets/cemetery-props.png',
  gothicProps: 'assets/gothic-props.png',
  horrorProps: 'assets/horror-props.png',
  swampTrees: 'assets/swamp-trees.png',
  propStalactite: 'assets/prop-stalactite.png',
  propCrystal: 'assets/prop-crystal.png',
};

function loadAssets() {
  return Promise.all(Object.entries(ASSET_FILES).map(([key, src]) =>
    new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => { Assets.img[key] = im; resolve(); };
      im.onerror = () => reject(new Error('failed to load ' + src));
      im.src = src;
    })
  )).then(() => { Assets.ready = true; });
}

// All character art is baked down to 3/4 size so figures stay small
// against the towering castle.
const SPRITE_SCALE = 0.75;

// Recolor the hero's crimson cloth to deep teal (suit color swap).
function recolorHero(img) {
  const cv = document.createElement('canvas');
  cv.width = img.width; cv.height = img.height;
  const g = cv.getContext('2d');
  g.drawImage(img, 0, 0);
  const im = g.getImageData(0, 0, cv.width, cv.height);
  const d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const r = d[i], gg = d[i + 1], b = d[i + 2];
    if (r > 70 && r > gg * 1.45 && r > b * 1.45) {
      d[i] = Math.round(gg * 0.55);
      d[i + 1] = Math.round(r * 0.72);
      d[i + 2] = Math.round(r * 0.68);
    }
  }
  g.putImageData(im, 0, 0);
  return cv;
}

// An animation sheet: R/L (mirrored per frame) + white flash copies + anchors.
// Anchor (ax, ay) is the point placed at the actor's feet-center; perFrame
// anchors override it for animations with baked vertical motion.
const Sheets = {};

function buildSheet(key, frames, ax, ay, perFrame) {
  const img = Assets.img[key];
  const sc = SPRITE_SCALE;
  const ofw = img.width / frames, ofh = img.height;
  const fw = Math.round(ofw * sc), fh = Math.round(ofh * sc);
  const cvR = document.createElement('canvas');
  cvR.width = fw * frames; cvR.height = fh;
  const gR = cvR.getContext('2d');
  gR.imageSmoothingEnabled = false;
  for (let f = 0; f < frames; f++) {
    gR.drawImage(img, f * ofw, 0, ofw, ofh, f * fw, 0, fw, fh);
  }
  const cvL = document.createElement('canvas');
  cvL.width = fw * frames; cvL.height = fh;
  const gL = cvL.getContext('2d');
  gL.imageSmoothingEnabled = false;
  for (let f = 0; f < frames; f++) {
    gL.save();
    gL.translate(f * fw + fw, 0);
    gL.scale(-1, 1);
    gL.drawImage(img, f * ofw, 0, ofw, ofh, 0, 0, fw, fh);
    gL.restore();
  }
  const sa = v => Math.round(v * sc);
  return {
    R: cvR, L: cvL, WR: whiteCopy(cvR), WL: whiteCopy(cvL),
    fw, fh, frames,
    ax: sa(ax), ay: sa(ay),
    perFrame: perFrame ? perFrame.map(a => [sa(a[0]), sa(a[1])]) : null,
  };
}

// Draw frame f with the anchor at (x, y) screen coords. flip = face left.
function drawSheetFrame(g, sheet, f, x, y, flip, white) {
  f = Math.max(0, Math.min(sheet.frames - 1, f | 0));
  const a = sheet.perFrame ? sheet.perFrame[f] : [sheet.ax, sheet.ay];
  const ax = flip ? sheet.fw - 1 - a[0] : a[0];
  const src = white ? (flip ? sheet.WL : sheet.WR) : (flip ? sheet.L : sheet.R);
  g.drawImage(src, f * sheet.fw, 0, sheet.fw, sheet.fh,
    Math.floor(x - ax), Math.floor(y - a[1]) - 1, sheet.fw, sheet.fh);
}

function initAssetSprites() {
  for (const k of Object.keys(ASSET_FILES)) {
    if (k.startsWith('hero')) Assets.img[k] = recolorHero(Assets.img[k]);
  }
  Sheets.heroIdle = buildSheet('heroIdle', 4, 16, 47);
  Sheets.heroRun = buildSheet('heroRun', 12, 33, 47);
  Sheets.heroAttack = buildSheet('heroAttack', 6, 43, 47);
  Sheets.heroJump = buildSheet('heroJump', 5, 0, 0,
    [[37, 75], [24, 66], [28, 47], [29, 41], [41, 59]]);
  Sheets.heroCrouch = buildSheet('heroCrouch', 3, 26, 47);
  Sheets.heroCrouchSlash = buildSheet('heroCrouchSlash', 4, 27, 31);
  Sheets.heroHurt = buildSheet('heroHurt', 3, 26, 47);
  Sheets.heroJumpAttack = buildSheet('heroJumpAttack', 6, 0, 0,
    [[43, 78], [30, 69], [34, 50], [35, 44], [34, 45], [29, 48]]);
  Sheets.skelRise = buildSheet('skelRise', 6, 22, 51);
  Sheets.skelWalk = buildSheet('skelWalk', 8, 22, 51);
  Sheets.fireSkull = buildSheet('fireSkull', 8, 44, 66);
  Sheets.demonIdle = buildSheet('demonIdle', 6, 84, 122);
  Sheets.demonAttack = buildSheet('demonAttack', 8, 100, 160);
  Sheets.houndRun = buildSheet('houndRun', 5, 33, 30);
  Sheets.fireball = buildSheet('fireball', 3, 9, 8);
  Sheets.ghostIdle = buildSheet('ghostIdle', 7, 32, 70);
  Sheets.nightmareIdle = buildSheet('nightmareIdle', 4, 64, 90);
  Sheets.nightmareGallop = buildSheet('nightmareGallop', 4, 72, 90);
  Sheets.beastIdle = buildSheet('beastIdle', 5, 33, 64);
  Sheets.beastBreath = buildSheet('beastBreath', 4, 32, 61);
  Sheets.wolfRun = buildSheet('wolfRun', 4, 28, 30);
  // --- the second haul. Anchors are (feet-centre) in source pixels.
  Sheets.skelRobedWalk = buildSheet('skelRobedWalk', 8, 16, 44);
  Sheets.skelRobedRise = buildSheet('skelRobedRise', 6, 16, 42);
  Sheets.hellCatWalk = buildSheet('hellCatWalk', 4, 42, 35);
  Sheets.ghostHalo = buildSheet('ghostHalo', 4, 17, 56);
  Sheets.spiderWalk = buildSheet('spiderWalk', 4, 14, 18);
  Sheets.bogWalk = buildSheet('bogWalk', 4, 12, 37);
  Sheets.ghostShriek = buildSheet('ghostShriek', 4, 32, 78);
  Sheets.houndIdle = buildSheet('houndIdle', 6, 32, 30);
  Sheets.dragonIdle = buildSheet('dragonIdle', 6, 72, 62);
  Sheets.dragonBreath = buildSheet('dragonBreath', 7, 72, 62);
  // effect strips, drawn centred rather than anchored at the feet
  Sheets.fxDarkBolt = buildSheet('fxDarkBolt', 12, 31, 41);
  Sheets.fxLightning = buildSheet('fxLightning', 11, 28, 63);
  Sheets.fxSpark = buildSheet('fxSpark', 8, 15, 15);
  Sheets.fxDeath = buildSheet('fxDeath', 5, 13, 24);
  Sheets.fxSoul = buildSheet('fxSoul', 6, 19, 24);
  Sheets.fxSlashRing = buildSheet('fxSlashRing', 6, 26, 24);
  // bone knight tint overlays + blood bat recolors
  Sheets.skelWalk.DR = darkCopy(Sheets.skelWalk.R, '#2a3a6a');
  Sheets.skelWalk.DL = darkCopy(Sheets.skelWalk.L, '#2a3a6a');
  Sheets.skelRise.DR = darkCopy(Sheets.skelRise.R, '#2a3a6a');
  Sheets.skelRise.DL = darkCopy(Sheets.skelRise.L, '#2a3a6a');
}

// ---------------------------------------------------------------- small pixel art
const BAT_UP = [
  '.oo..........oo.',
  'oUUo........oUUo',
  'oUUUo......oUUUo',
  '.oUUUooUUooUUUo.',
  '..oUUUUUUUUUUo..',
  '...oUUEUUEUUo...',
  '....oUUUUUUo....',
  '.....oUuUo......',
  '......ooo.......',
  '................',
];

const BAT_DOWN = [
  '................',
  '................',
  '....oUUUUUo.....',
  '..ooUUEUUEUoo...',
  '.oUUUUUUUUUUUo..',
  'oUUooUUuUUooUUo.',
  'oUo..oUuUo..oUo.',
  'oo....ooo....oo.',
  '................',
  '................',
];

const CANDLE_BODY = [
  '...WW...',
  '...WW...',
  '...WW...',
  '...WW...',
  '..oGGo..',
  '.oGGGGo.',
  '..oGGo..',
  '...oo...',
  '...oo...',
  '........',
  '........',
  '........',
];

const CANDLE_FLAME_A = [
  '...YY...',
  '..YOOY..',
  '..YOOY..',
  '...YY...',
];

const CANDLE_FLAME_B = [
  '..YY....',
  '.YOOY...',
  '..YOOY..',
  '...YY...',
];

const HEART = [
  '.oo..oo.',
  'oQQooQQo',
  'oQQQQQQo',
  '.oQQQQo.',
  '..oQQo..',
  '...oo...',
  '........',
];

const ORB = [
  '..oooo..',
  '.oCCCCo.',
  'oCWWCCCo',
  'oCWCCCCo',
  'oCCCCCco',
  'oCCCCcco',
  '.oCCcco.',
  '..oooo..',
];

const GEM = [
  '...oo...',
  '..oVVo..',
  '.oVWVVo.',
  '.oVVVvo.',
  '..oVvo..',
  '...oo...',
  '........',
];

const STATUE = [
  '......oooo......',
  '.....oLLLLo.....',
  '....oLLLLLLo....',
  '....oLlLLlLo....',
  '....olmmmmlo....',
  '....olmmmmlo....',
  '.....olmmlo.....',
  '....oLLLLLLo....',
  '...oLLLLLLLLo...',
  '...oLlLLLLlLo...',
  '..oLLlLLLLlLLo..',
  '..oLLlLmmLlLLo..',
  '..oLlLommolLLo..',
  '..oLlLLooLLlLo..',
  '..oLlLLLLLLlLo..',
  '..oLlLLLLLLlLo..',
  '..omlLLLLLLlmo..',
  '..omlLLLLLLlmo..',
  '..omllLLLLllmo..',
  '..oomlLLLLlmoo..',
  '...ommllllmmo...',
  '..oooooooooooo..',
  '.oLLLLLLLLLLLLo.',
  '.olLLLLLLLLLLlo.',
  '..oLLLLLLLLLLo..',
  '..ollllllllllo..',
  '.oLLLLLLLLLLLLo.',
  '.ommmmmmmmmmmmo.',
  '.oooooooooooooo.',
  '................',
];

const BANNER = [
  'oooooooooo',
  'orrrrrrrro',
  'orkrrrrkro',
  'orrrGGrrro',
  'orrGGGGrro',
  'orrGrrGrro',
  'orrGrrGrro',
  'orrGGGGrro',
  'orrrGGrrro',
  'orrrrrrrro',
  'okrrrrrrko',
  'okrrrrrrko',
  'orrrrrrrro',
  'okrrrrrrko',
  'okrrrrrrko',
  'orrkrrkrro',
  'orrroorrro',
  'orrro.orro',
  'okro...oro',
  'oro.....oo',
  'oo........',
  '..........',
];

const KEY = [
  '.oo.......',
  'oGGo.oooo.',
  'oGGoGGGGGo',
  '.oo...oGo.',
  '......oGo.',
  '......oo..',
];

const KNIFE = [
  '...oooo..',
  'oBGWWWWWo',
  '...oooo..',
];

const AXE1 = [
  '..ooo.....',
  '.oWWWoo...',
  '.oWWWWWo..',
  '..ooWWWo..',
  '....oBBo..',
  '....oBo...',
  '...oBo....',
  '...oBo....',
  '..oBo.....',
  '..oo......',
];

const AXE2 = [
  '......oo..',
  '....ooWWo.',
  '..oBoWWWo.',
  '.oBBoWWWWo',
  '..oBoWWWo.',
  '....ooWWo.',
  '......oo..',
  '..........',
  '..........',
  '..........',
];

const HOLY = [
  '..oWo..',
  '..oBo..',
  '.oCCCo.',
  'oCCWCCo',
  'oCCCCco',
  'oCCCcco',
  'oCcccco',
  '.ooooo.',
  '.......',
];

const BIG_HEART = [
  '.ooo..ooo.',
  'oQQQooQQQo',
  'oQQQQQQQQo',
  'oQWQQQQQQo',
  '.oQQQQQQo.',
  '..oQQQQo..',
  '...oQQo...',
  '....oo....',
  '..........',
];

const WHIP_ITEM = [
  '....W....',
  '...oWo...',
  '...oWo...',
  '...oWo...',
  '..oGGGo..',
  '...oBo...',
  '...oBo...',
  '...ooo...',
  '.........',
];

const CROSS1 = [
  '....oGGo....',
  '....oGGo....',
  '.oooGGGGooo.',
  'oGGGGGGGGGGo',
  'oGGGGWWGGGGo',
  'oGGGGGGGGGGo',
  '.oooGGGGooo.',
  '....oGGo....',
  '....oGGo....',
  '....oGGo....',
  '....oGGo....',
  '....oooo....',
];

const CROSS2 = [
  'oo........oo',
  'oGo......oGo',
  '.oGo....oGo.',
  '..oGo..oGo..',
  '...oGGGGo...',
  '....oGWGo...',
  '...oGGGGo...',
  '..oGo..oGo..',
  '.oGo....oGo.',
  'oGo......oGo',
  'oo........oo',
  '............',
];

const WATCH = [
  '....oo....',
  '...oGGo...',
  '..oGGGGo..',
  '.oGWWWWGo.',
  '.oGWoWWGo.',
  '.oGWoWWGo.',
  '.oGWWoWGo.',
  '.oGWWWWGo.',
  '..oGGGGo..',
  '...oooo...',
  '..........',
  '..........',
];

const ROAST = [
  '..oooooo....',
  '.oQBBBBQo...',
  'oQBSSSBBQoo.',
  'oBSSSSSBBoWo',
  'oBSSSSBBBoWo',
  '.oBBBBBQoo..',
  '..oooooo....',
  '............',
];

const SOUL = [
  '....C...',
  '...CC...',
  '..CWWC..',
  '..CWWC..',
  '.CWWWWC.',
  '.CWWWWc.',
  '..CWWc..',
  '...cc...',
];

const ICON_WING = [
  'oo......',
  'oWWo....',
  'oWWWWo..',
  '.oWWWWWo',
  '..oWWWWo',
  '....oooo',
  '........',
  '........',
];

const ICON_VESSEL = [
  '.oGGGGo.',
  '.oQQQQo.',
  '..oQQo..',
  '...oo...',
  '...oo...',
  '..oGGo..',
  '.oGGGGo.',
  '........',
];

const ICON_EYE = [
  '........',
  '..oooo..',
  '.oWWWWo.',
  'oWWNNWWo',
  '.oWWWWo.',
  '..oooo..',
  '........',
  '........',
];

const BIBLE = [
  '.oooooooo.',
  'oGGGGGGGGo',
  'oGGGWWGGGo',
  'oGWWWWWWGo',
  'oGGGWWGGGo',
  'oGGGWWGGGo',
  'oGGGGGGGGo',
  '.oooooooo.',
];

const STONE = [
  '..ooo..',
  '.oLLLo.',
  'oLLlLLo',
  'oLlLLLo',
  '.oLLlo.',
  '..ooo..',
];

const CHEST = [
  '.oooooooooo.',
  'oBBBBBBBBBBo',
  'oBGGGGGGGGBo',
  'oooooooooooo',
  'oBBBBGGBBBBo',
  'oBBBBGGBBBBo',
  'oBBBBBBBBBBo',
  '.oooooooooo.',
  '............',
  '............',
];

const ELIXIR = [
  '...oo...',
  '..oWWo..',
  '..oBBo..',
  '.oVVVVo.',
  'oVWVVVvo',
  'oVVVVVvo',
  'oVVVvvvo',
  '.oVVvvo.',
  '..oooo..',
  '........',
];

const SUB_BOMB = [
  '....YO..',
  '...OY...',
  '..MMMM..',
  '.MMMMMM.',
  'MMMmmMMM',
  'MMmmmMMM',
  '.MMMMMM.',
  '..MMMM..',
];
const SUB_CHAKRAM = [
  '..LLLL..',
  '.LLmmLL.',
  'LLm..mLL',
  'Lm....mL',
  'Lm....mL',
  'LLm..mLL',
  '.LLmmLL.',
  '..LLLL..',
];
const SUB_SHURIKEN = [
  '...L....',
  '..LLL...',
  '.LLmLL..',
  'LLLmLLL.',
  '.LLmLL..',
  '..LLL...',
  '...L....',
  '........',
];

const WEAP_SWORD = [
  '....W...',
  '...WLW..',
  '...WLW..',
  '...WLW..',
  '...WLW..',
  '...WLW..',
  '..WWLWW.',
  '..GGGGG.',
  '....B...',
  '....B...',
  '...GGG..',
  '........',
];
const WEAP_AXE = [
  '........',
  '..WWWW..',
  '.WWLLWW.',
  'WWLLLLW.',
  'WWLLLW..',
  '.WWLW.B.',
  '..WW.B..',
  '.....B..',
  '....B...',
  '....B...',
  '...B....',
  '...B....',
];
const WEAP_SPEAR = [
  '.....W..',
  '....WLW.',
  '....WLW.',
  '.....W..',
  '....GGG.',
  '.....B..',
  '....B...',
  '....B...',
  '...B....',
  '...B....',
  '..B.....',
  '..B.....',
];
const WEAP_CLAWS = [
  '........',
  '.W....W.',
  '.LW..WL.',
  '.LW..WL.',
  '..LWWL..',
  '..LWWL..',
  '..sssss.',
  '.sHHHHs.',
  '.sHssHs.',
  '..sHHs..',
  '...ss...',
  '........',
];

const OBELISK_DARK = [
  '....LLLL....',
  '...LLllLL...',
  '..LLllllLL..',
  '..LllllllL..',
  '..LllmmllL..',
  '..LlmllmlL..',
  '..LllmmllL..',
  '..LlllmllL..',
  '..LllmmllL..',
  '..LllllllL..',
  '..LllmlllL..',
  '..LllllllL..',
  '..LlllmllL..',
  '..LllllllL..',
  '..LllllllL..',
  '..LmllllmL..',
  '..LllllllL..',
  '.LLllllllLL.',
  '.LllllllllL.',
  '.LmllllllmL.',
  'LLllllllllLL',
  'LllllllllllL',
  'LmmllllllmmL',
  'LLLLLLLLLLLL',
];
const OBELISK_LIT = [
  '....LLLL....',
  '...LLllLL...',
  '..LLllllLL..',
  '..LllllllL..',
  '..LllCCllL..',
  '..LlCllClL..',
  '..LllCCllL..',
  '..LlllCllL..',
  '..LllCCllL..',
  '..LllllllL..',
  '..LllmlllL..',
  '..LllllllL..',
  '..LlllmllL..',
  '..LllllllL..',
  '..LllllllL..',
  '..LmllllmL..',
  '..LllllllL..',
  '.LLllllllLL.',
  '.LllllllllL.',
  '.LmllllllmL.',
  'LLllllllllLL',
  'LllllllllllL',
  'LmmllllllmmL',
  'LLLLLLLLLLLL',
];
const MERCHANT_ART = [
  '.....MMMM.....',
  '....MMMMMM....',
  '...MMbbbbMM...',
  '...MbbbbbbM...',
  '...MbMMMMbM...',
  '...MbbbbbbM...',
  '..MbbbbbbbbM..',
  '..MbbbbbbbbM..',
  '..MbbbbbbbbM..',
  '..Mbbbbbbbb.Y.',
  '..Mbbbbbbbb.O.',
  '..Mbbbbbbbb.Y.',
  '..MbbGGGGbbM..',
  '..MbbbbbbbbM..',
  '..MbbbbbbbbM..',
  '..MbbbbbbbbM..',
  '..MbbbbbbbbM..',
  '...MbbbbbbM...',
  '...MbbbbbbM...',
  '..MMbbbbbbMM..',
  '..MbbbbbbbbM..',
  '..MMMMMMMMMM..',
];
const TABLET_ART = [
  '.LLLLLLLL.',
  'LLllllllLL',
  'LllllllllL',
  'LlmmlmmllL',
  'LllllllllL',
  'LlmlmmmllL',
  'LllllllllL',
  'LlmmmlmllL',
  'LllllllllL',
  'LlmlmmlllL',
  'LLllllllLL',
  '.LLLLLLLL.',
];

const FORGE = [
  '................',
  '....oooooo......',
  '...oLLLLLLo.....',
  '...oLmOOmLo.....',
  '....oooooo......',
  '.....oLLo.......',
  '.....oLLo.......',
  '....oLLLLo......',
  '...oLLLLLLo.....',
  '..oooooooooo....',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];

const GRAVE1 = [
  '...oooooo...',
  '..oLLLLLLo..',
  '..oLLmmLLo..',
  '..oLmmmmLo..',
  '..oLLmmLLo..',
  '..oLLmmLLo..',
  '..oLLLLLLo..',
  '..olLLLLlo..',
  '..olLLLLlo..',
  '.oLLLLLLLLo.',
  '.oooooooooo.',
];

const GRAVE2 = [
  '....oooo....',
  '...oLLLLo...',
  '..oLLLLLLo..',
  '..oLlLLLLo..',
  '..oLLmLLLo..',
  '..oLLLmLLo..',
  '..olLLLLlo..',
  '.oLLLLLLLLo.',
  '.oooooooooo.',
];

const EMBLEM = [
  '.....G.....',
  '....GGG....',
  '.....G.....',
  '..G..G..G..',
  '...G.G.G...',
  'GG..GGG..GG',
  '...G.G.G...',
  '..G..G..G..',
  '.....G.....',
  '....GGG....',
  '.....G.....',
];

// ---------------------------------------------------------------- tile atlas
const TILE = 16;

function buildTileAtlas() {
  // 12 slots: 0 unused, 1-4 brick variants, 5 platform, 6 spikes, 7 foundation,
  // 8 skull-relief foundation, 9 cracked brick, 10 locked golden gate
  const cv = document.createElement('canvas');
  cv.width = TILE * 12; cv.height = TILE;
  const g = cv.getContext('2d');

  function brick(slot, base, mortar, hi, seed) {
    const ox = slot * TILE;
    g.fillStyle = base; g.fillRect(ox, 0, TILE, TILE);
    g.fillStyle = mortar;
    g.fillRect(ox, 7, TILE, 1);
    g.fillRect(ox, 15, TILE, 1);
    g.fillRect(ox + 3, 0, 1, 7);
    g.fillRect(ox + 11, 0, 1, 7);
    g.fillRect(ox + 7, 8, 1, 7);
    g.fillStyle = hi;
    g.fillRect(ox, 0, 3, 1); g.fillRect(ox + 4, 0, 7, 1); g.fillRect(ox + 12, 0, 4, 1);
    g.fillRect(ox, 8, 7, 1); g.fillRect(ox + 8, 8, 8, 1);
    let n = seed;
    for (let i = 0; i < 5; i++) {
      n = (n * 1103515245 + 12345) & 0x7fffffff;
      const x = n % TILE, y = (n >> 4) % TILE;
      g.fillStyle = (n & 1) ? mortar : hi;
      g.fillRect(ox + x, y, 1, 1);
    }
  }

  brick(1, '#3e3e58', '#262638', '#52526e', 3);
  brick(2, '#3b3b54', '#262638', '#4f4f6a', 17);
  brick(3, '#40405a', '#262638', '#545470', 29);
  brick(4, '#3c3c55', '#242436', '#50506c', 41);

  // moss creeping on variant 2
  g.fillStyle = '#3a5a40';
  [[2, 1, 2, 1], [5, 9, 3, 1], [6, 10, 1, 1], [12, 4, 2, 1], [1, 14, 3, 1], [13, 12, 2, 1]]
    .forEach(([x, y, w, h]) => g.fillRect(2 * TILE + x, y, w, h));
  g.fillStyle = '#4c7050';
  g.fillRect(2 * TILE + 2, 0, 1, 1); g.fillRect(2 * TILE + 5, 8, 1, 1);

  // 9: cracked brick
  {
    brick(9, '#3c3c56', '#262638', '#50506c', 53);
    const ox = 9 * TILE;
    g.fillStyle = '#20202f';
    [[8, 1], [9, 2], [9, 3], [10, 4], [9, 5], [8, 6], [4, 9], [5, 10], [5, 11], [4, 12], [3, 13], [12, 10], [13, 11]]
      .forEach(([x, y]) => g.fillRect(ox + x, y, 1, 1));
  }

  // 5: one-way wooden platform
  {
    const ox = 5 * TILE;
    g.fillStyle = '#8a5a30'; g.fillRect(ox, 0, TILE, 6);
    g.fillStyle = '#a87848'; g.fillRect(ox, 0, TILE, 1);
    g.fillStyle = '#5a3a20';
    g.fillRect(ox, 5, TILE, 1);
    g.fillRect(ox + 5, 1, 1, 4);
    g.fillRect(ox + 11, 1, 1, 4);
    g.fillStyle = '#3a2412';
    g.fillRect(ox + 1, 6, 2, 2); g.fillRect(ox + 13, 6, 2, 2);
  }

  // 6: spikes
  {
    const ox = 6 * TILE;
    g.fillStyle = '#1a1622'; g.fillRect(ox, 13, TILE, 3);
    for (let s = 0; s < 4; s++) {
      const bx = ox + s * 4;
      g.fillStyle = '#6a7484';
      g.fillRect(bx, 12, 4, 1);
      g.fillRect(bx + 1, 8, 2, 4);
      g.fillRect(bx + 1, 6, 1, 2);
      g.fillStyle = '#aab6c8';
      g.fillRect(bx + 2, 8, 1, 4);
      g.fillRect(bx + 2, 6, 1, 2);
      g.fillRect(bx + 2, 4, 1, 2);
    }
  }

  // 7: foundation stone
  function foundation(slot) {
    const ox = slot * TILE;
    g.fillStyle = '#30304a'; g.fillRect(ox, 0, TILE, TILE);
    g.fillStyle = '#1e1e30';
    g.fillRect(ox, 7, TILE, 1); g.fillRect(ox, 15, TILE, 1);
    g.fillRect(ox + 7, 0, 1, 7); g.fillRect(ox + 3, 8, 1, 7); g.fillRect(ox + 12, 8, 1, 7);
    g.fillStyle = '#404060';
    g.fillRect(ox, 0, 7, 1); g.fillRect(ox + 8, 0, 8, 1);
  }
  foundation(7);

  // 8: foundation with carved skull relief
  {
    foundation(8);
    const ox = 8 * TILE;
    g.fillStyle = '#404060';
    g.fillRect(ox + 4, 3, 8, 6);
    g.fillRect(ox + 5, 9, 6, 2);
    g.fillStyle = '#1a1a2c';
    g.fillRect(ox + 5, 5, 2, 2);
    g.fillRect(ox + 9, 5, 2, 2);
    g.fillRect(ox + 7, 7, 1, 1);
    g.fillRect(ox + 5, 10, 1, 1); g.fillRect(ox + 7, 10, 1, 1); g.fillRect(ox + 9, 10, 1, 1);
    g.fillStyle = '#4c4c70';
    g.fillRect(ox + 4, 3, 8, 1);
  }

  // 10: locked golden gate
  {
    const ox = 10 * TILE;
    g.fillStyle = '#171526'; g.fillRect(ox, 0, TILE, TILE);
    g.fillStyle = '#8a6d2f';
    for (let bx = 2; bx < TILE; bx += 4) g.fillRect(ox + bx, 0, 2, TILE);
    g.fillStyle = '#d8a848';
    g.fillRect(ox, 7, TILE, 2);
    g.fillRect(ox + 6, 5, 4, 6);
    g.fillStyle = '#171526';
    g.fillRect(ox + 7, 7, 2, 2);
  }

  return cv;
}

// ---------------------------------------------------------------- build all
const Sprites = {};

function initSprites() {
  Sprites.bat = {
    up: makeSprite('bat-up', BAT_UP),
    down: makeSprite('bat-down', BAT_DOWN),
  };
  Sprites.bat.white = whiteCopy(Sprites.bat.down);
  Sprites.bat.red1 = darkCopy(Sprites.bat.up, '#a02430');
  Sprites.bat.red2 = darkCopy(Sprites.bat.down, '#a02430');
  Sprites.bat.dark1 = darkCopy(Sprites.bat.up, '#191330');
  Sprites.bat.dark2 = darkCopy(Sprites.bat.down, '#191330');

  Sprites.candle = {
    body: makeSprite('candle', CANDLE_BODY),
    flameA: makeSprite('flameA', CANDLE_FLAME_A),
    flameB: makeSprite('flameB', CANDLE_FLAME_B),
  };

  Sprites.heart = makeSprite('heart', HEART);
  Sprites.orb = makeSprite('orb', ORB);
  Sprites.gem = makeSprite('gem', GEM);

  Sprites.statue = makeSprite('statue', STATUE);
  Sprites.banner = makeSprite('banner', BANNER);
  Sprites.emblem = makeSprite('emblem', EMBLEM);

  Sprites.key = makeSprite('key', KEY);
  Sprites.knife = makeSprite('knife', KNIFE);
  Sprites.knifeL = flipH(Sprites.knife);
  Sprites.axe1 = makeSprite('axe1', AXE1);
  Sprites.axe2 = makeSprite('axe2', AXE2);
  Sprites.holy = makeSprite('holy', HOLY);
  Sprites.bigHeart = makeSprite('bigheart', BIG_HEART);
  Sprites.whipItem = makeSprite('whipitem', WHIP_ITEM);
  Sprites.soul = makeSprite('soul', SOUL);
  Sprites.roast = makeSprite('roast', ROAST);
  Sprites.cross1 = makeSprite('cross1', CROSS1);
  Sprites.cross2 = makeSprite('cross2', CROSS2);
  Sprites.watch = makeSprite('watch', WATCH);
  Sprites.forge = makeSprite('forge', FORGE);
  Sprites.weapons = {
    whip: Sprites.whipItem,
    sword: makeSprite('weap-sword', WEAP_SWORD),
    axe: makeSprite('weap-axe', WEAP_AXE),
    spear: makeSprite('weap-spear', WEAP_SPEAR),
    claws: makeSprite('weap-claws', WEAP_CLAWS),
  };
  Sprites.bomb = makeSprite('sub-bomb', SUB_BOMB);
  Sprites.chakram = makeSprite('sub-chakram', SUB_CHAKRAM);
  Sprites.shuriken = makeSprite('sub-shuriken', SUB_SHURIKEN);
  Sprites.obeliskDark = makeSprite('obelisk-dark', OBELISK_DARK);
  Sprites.obeliskLit = makeSprite('obelisk-lit', OBELISK_LIT);
  Sprites.merchant = makeSprite('merchant', MERCHANT_ART);
  Sprites.tablet = makeSprite('tablet', TABLET_ART);
  Sprites.buffs = {};
  for (const bk of BUFF_KEYS) Sprites.buffs[bk] = darkCopy(Sprites.orb, BUFFS[bk].color);
  Sprites.chest = makeSprite('chest', CHEST);
  Sprites.elixir = makeSprite('elixir', ELIXIR);
  Sprites.bible = makeSprite('bible', BIBLE);
  Sprites.stone = makeSprite('stone', STONE);
  Sprites.grave1 = makeSprite('grave1', GRAVE1);
  Sprites.grave2 = makeSprite('grave2', GRAVE2);
  Sprites.iconWing = makeSprite('icon-wing', ICON_WING);
  Sprites.iconVessel = makeSprite('icon-vessel', ICON_VESSEL);
  Sprites.iconEye = makeSprite('icon-eye', ICON_EYE);

  Sprites.tiles = buildTileAtlas();
  buildBiomeAtlases();
}

// A zone's stone is its own. The same carved atlas, re-dyed per biome, so the
// castle reads as different places rather than one corridor repainted.
function tintAtlas(src, tint, dark) {
  const cv = document.createElement('canvas');
  cv.width = src.width; cv.height = src.height;
  const g = cv.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = tint;
  g.fillRect(0, 0, cv.width, cv.height);
  if (dark) {
    g.fillStyle = dark;
    g.fillRect(0, 0, cv.width, cv.height);
  }
  return cv;
}

function buildBiomeAtlases() {
  Sprites.tilesBiome = {
    castle: Sprites.tiles,
    graveyard: tintAtlas(Sprites.tiles, 'rgba(120,150,110,0.30)'),
    chapel: tintAtlas(Sprites.tiles, 'rgba(150,130,200,0.32)'),
    catacombs: tintAtlas(Sprites.tiles, 'rgba(90,110,130,0.34)', 'rgba(0,0,0,0.18)'),
    clock: tintAtlas(Sprites.tiles, 'rgba(200,170,90,0.30)'),
    keep: tintAtlas(Sprites.tiles, 'rgba(190,90,90,0.30)', 'rgba(20,0,0,0.10)'),
    lunar: tintAtlas(Sprites.tiles, 'rgba(120,200,240,0.34)'),
    cistern: tintAtlas(Sprites.tiles, 'rgba(70,150,180,0.34)', 'rgba(0,10,20,0.14)'),
    foundry: tintAtlas(Sprites.tiles, 'rgba(210,120,50,0.28)', 'rgba(20,6,0,0.16)'),
    gallery: tintAtlas(Sprites.tiles, 'rgba(180,165,220,0.30)'),
    frost: tintAtlas(Sprites.tiles, 'rgba(170,215,245,0.36)'),
  };
}

function weaponIcon(key) {
  return (Sprites.weapons && Sprites.weapons[key]) || Sprites.whipItem;
}
