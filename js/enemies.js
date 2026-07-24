// How far a beast travels between animation frames, so gaits match the ground.
const WOLF_STRIDE = 7;
const HOUND_STRIDE = 8;

// Lesser fiends of the castle.

// ---------------------------------------------------------------- enemies
function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

class Zombie {          // risen skeleton
  constructor(x, groundY) {
    this.w = 11; this.h = 30;
    this.x = x; this.y = groundY - this.h;
    this.vx = 0; this.vy = 0;
    this.dz = dangerAt(x);
    this.hp = scaleHp(6, this.dz);
    this.rise = 44;
    this.flash = 0;
    this.animT = 0;
    this.contactDmg = scaleDmg(3, this.dz);
    this.scoreVal = 100;
    this.remove = false;
    this.frozen = 0;
    this.fireCd = 0;
  }
  hitbox() { return { x: this.x, y: this.y + (this.rise > 0 ? this.h * this.rise / 44 : 0), w: this.w, h: this.h }; }
  hurt(dmg) {
    if (this.knight) dmg = Math.min(dmg, 2);   // ancient armor shrugs off heavy blows
    this.hp -= dmg; this.flash = 8;
    AudioSys.sfxHit();
    if (this.hp <= 0) this.die();
    return true;
  }
  die() {
    this.remove = true;
    flameBurst(this.x + this.w / 2, this.y + this.h / 2);
    AudioSys.sfxEnemyDie();
    game.addKillScore(this.scoreVal, this);
    game.maybeDrop(this.x + this.w / 2, this.y + 4, 0.2);
    game.dropSoul('zombie', this.x, this.y + 8, this.elite);
  }
  update(player) {
    if (this.flash > 0) this.flash--;
    if (this.fireCd > 0) this.fireCd--;
    if (this.frozen > 0) { this.frozen--; return; }
    this.animT++;
    if (this.rise > 0) {
      this.rise--;
      if (this.rise % 6 === 0) {
        spawnParticle(this.x + Math.random() * this.w, this.y + this.h - 2,
          (Math.random() - 0.5), -0.8, '#5a4a3a', 18, 0.08);
      }
      return;
    }
    const dir = player.x > this.x ? 1 : -1;
    this.vx = dir * 0.35;
    this.vy = Math.min(this.vy + GRAV, MAX_FALL);
    moveActor(this, this.vx, this.vy, true);
    if (this.y > Level.pxH + 40) this.remove = true;
  }
  draw(g, camX, camY) {
    const ax = this.x + this.w / 2 - camX;
    const ay = this.y + this.h - camY;
    const flip = this.vx < 0;
    if (this.rise > 0) {
      const f = Math.min(5, ((44 - this.rise) / 44 * 6) | 0);
      drawSheetFrame(g, Sheets.skelRise, f, ax, ay, flip, this.flash > 0);
    } else {
      const f = (this.animT >> 3) & 7;
      drawSheetFrame(g, Sheets.skelWalk, f, ax, ay, flip, this.flash > 0);
      if (this.knight) {
        g.globalAlpha = 0.45;
        g.drawImage(flip ? Sheets.skelWalk.DL : Sheets.skelWalk.DR,
          f * Sheets.skelWalk.fw, 0, Sheets.skelWalk.fw, Sheets.skelWalk.fh,
          Math.floor(ax - Sheets.skelWalk.ax), Math.floor(ay - Sheets.skelWalk.ay) - 1,
          Sheets.skelWalk.fw, Sheets.skelWalk.fh);
        g.globalAlpha = 1;
      }
      if (this.frozen > 0) {
        g.globalAlpha = 0.55;
        drawSheetFrame(g, Sheets.skelWalk, f, ax, ay, flip, true);
        g.globalAlpha = 1;
      }
    }
  }
}

class Bat {
  constructor(x, y) {
    this.homeX = x; this.homeY = y;
    this.x = x; this.y = y;
    this.w = 12; this.h = 8;
    this.dz = dangerAt(x);
    this.hp = scaleHp(3, this.dz);
    this.state = 'perch';       // perch | fly | gone
    this.t = 0;
    this.flash = 0;
    this.respawn = 0;
    this.contactDmg = scaleDmg(2, this.dz);
    this.scoreVal = 200;
    this.remove = false;        // permanent removal (boss minions)
    this.minion = false;
    this.vx = 0; this.baseY = y;
    this.frozen = 0;
    this.fireCd = 0;
  }
  hitbox() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  hurt(dmg) {
    if (this.state === 'gone') return false;
    this.hp -= dmg; this.flash = 6;
    AudioSys.sfxHit();
    if (this.hp <= 0) this.die();
    return true;
  }
  die() {
    flameBurst(this.x + this.w / 2, this.y + this.h / 2);
    AudioSys.sfxEnemyDie();
    game.addKillScore(this.scoreVal, this);
    game.maybeDrop(this.x + this.w / 2, this.y, 0.15);
    game.dropSoul('bat', this.x, this.y, this.elite);
    if (this.minion) this.remove = true;
    else { this.state = 'gone'; this.respawn = 480; }
  }
  update(player) {
    if (this.flash > 0) this.flash--;
    if (this.fireCd > 0) this.fireCd--;
    if (this.frozen > 0) { this.frozen--; return; }
    this.t++;
    if (this.state === 'gone') {
      if (--this.respawn <= 0) {
        // only respawn while player is far away
        if (Math.abs(player.x - this.homeX) > 200) {
          this.state = 'perch'; this.hp = scaleHp(3, this.dz);
          this.x = this.homeX; this.y = this.homeY;
        } else this.respawn = 60;
      }
      return;
    }
    if (this.state === 'perch') {
      if (Math.abs(player.x - this.x) < 76 && Math.abs(player.y - this.y) < 120) {
        this.state = 'fly';
        this.t = 0;
        const spd = this.blood ? 1.6 : 1.1;
        this.vx = player.x > this.x ? spd : -spd;
        this.baseY = this.y;
      }
      return;
    }
    // fly: swoop with sine, drift toward player's altitude
    this.x += this.vx;
    const targetY = player.y - 4;
    this.baseY += Math.sign(targetY - this.baseY) * 0.35;
    this.y = this.baseY + Math.sin(this.t * 0.08) * 18;
    // gently home horizontally
    if (this.t % 90 === 0) this.vx = player.x > this.x ? Math.abs(this.vx) : -Math.abs(this.vx);
    if (Math.abs(this.x - player.x) > 320) { this.state = 'gone'; this.respawn = 300; }
  }
  draw(g, camX, camY) {
    if (this.state === 'gone') return;
    let spr;
    if (this.state === 'perch') spr = this.blood ? Sprites.bat.red2 : Sprites.bat.down;
    else if (this.blood) spr = ((this.t >> 3) & 1) ? Sprites.bat.red1 : Sprites.bat.red2;
    else spr = ((this.t >> 3) & 1) ? Sprites.bat.up : Sprites.bat.down;
    if (this.flash > 0) spr = Sprites.bat.white;
    g.drawImage(spr, Math.floor(this.x - 2 - camX), Math.floor(this.y - 1 - camY));
    if (this.frozen > 0) {
      g.globalAlpha = 0.55;
      g.drawImage(Sprites.bat.white, Math.floor(this.x - 2 - camX), Math.floor(this.y - 1 - camY));
      g.globalAlpha = 1;
    }
  }
}

class MedusaHead {      // fire skull
  constructor(x, y, dir) {
    this.x = x; this.y = y;
    this.baseY = y;
    this.dir = dir;
    this.w = 20; this.h = 20;
    this.dz = dangerAt(x);
    this.hp = scaleHp(3, this.dz);
    this.t = 0;
    this.flash = 0;
    this.contactDmg = scaleDmg(2, this.dz);
    this.scoreVal = 300;
    this.remove = false;
    this.frozen = 0;
    this.fireCd = 0;
  }
  hitbox() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  hurt(dmg) {
    this.hp -= dmg; this.flash = 6;
    AudioSys.sfxHit();
    if (this.hp <= 0) {
      this.remove = true;
      flameBurst(this.x + this.w / 2, this.y + this.h / 2);
      AudioSys.sfxEnemyDie();
      game.addKillScore(this.scoreVal, this);
      game.dropSoul('medusa', this.x, this.y, this.elite);
    }
    return true;
  }
  update() {
    if (this.flash > 0) this.flash--;
    if (this.fireCd > 0) this.fireCd--;
    if (this.frozen > 0) { this.frozen--; return; }
    this.t++;
    this.x += this.dir * 1.1;
    this.y = this.baseY + Math.sin(this.t * 0.07) * 24;
  }
  draw(g, camX, camY) {
    // fire skull rendered at half scale; native art faces left
    const sh = Sheets.fireSkull;
    const f = (this.t >> 2) % 8;
    const flip = this.dir > 0;
    const white = this.flash > 0;
    const src = white ? (flip ? sh.WL : sh.WR) : (flip ? sh.L : sh.R);
    const dx = Math.floor(this.x + this.w / 2 - sh.fw / 4 - camX);
    const dy = Math.floor(this.y + this.h / 2 - sh.fh / 4 - 4 - camY);
    g.drawImage(src, f * sh.fw, 0, sh.fw, sh.fh, dx, dy, sh.fw / 2, sh.fh / 2);
    if (this.frozen > 0) {
      g.globalAlpha = 0.55;
      g.drawImage(flip ? sh.WL : sh.WR, f * sh.fw, 0, sh.fw, sh.fh, dx, dy, sh.fw / 2, sh.fh / 2);
      g.globalAlpha = 1;
    }
  }
}

// A lean, sprinting hound that lunges when it catches your scent.
class HellHound {
  constructor(x, groundY) {
    this.homeX = x; this.groundY = groundY;
    this.w = 30; this.h = 17;
    this.x = x; this.y = groundY - this.h;
    this.vx = 0; this.vy = 0;
    this.dz = dangerAt(x);
    this.hp = scaleHp(5, this.dz);
    this.t = 0;
    this.flash = 0;
    this.frozen = 0; this.fireCd = 0;
    this.state = 'wait';    // wait | lunge | gone
    this.respawn = 0;
    this.contactDmg = scaleDmg(3, this.dz);
    this.scoreVal = 250;
    this.remove = false;
    this.dir = -1;
    this.stride = 0;
  }
  hitbox() { return { x: this.x + 4, y: this.y, w: this.w - 8, h: this.h }; }
  hurt(dmg) {
    if (this.state === 'gone') return false;
    this.hp -= dmg; this.flash = 6;
    AudioSys.sfxHit();
    if (this.hp <= 0) {
      flameBurst(this.x + this.w / 2, this.y + this.h / 2);
      AudioSys.sfxEnemyDie();
      game.addKillScore(this.scoreVal, this);
      game.maybeDrop(this.x + this.w / 2, this.y, 0.2);
      game.dropSoul('bat', this.x, this.y, this.elite);
      this.state = 'gone'; this.respawn = 700;
    }
    return true;
  }
  update(player) {
    if (this.flash > 0) this.flash--;
    if (this.fireCd > 0) this.fireCd--;
    if (this.frozen > 0) { this.frozen--; return; }
    this.t++;
    if (this.state === 'gone') {
      if (--this.respawn <= 0 && Math.abs(player.x - this.homeX) > VIEW_W) {
        this.state = 'wait'; this.hp = scaleHp(5, this.dz);
        this.x = this.homeX; this.y = this.groundY - this.h;
      }
      return;
    }
    if (this.state === 'wait') {
      if (Math.abs(player.x - this.x) < 170 &&
          Math.abs(player.y + player.h - (this.y + this.h)) < 60) {
        this.state = 'crouch'; this.t = 0;
        dustPuff(this.x + this.w / 2, this.y + this.h, 2);
        AudioSys.sfxHit();
      }
      return;
    }
    if (this.state === 'crouch') {
      // a beat of gathered muscle before it comes at you
      if ((this.t & 3) === 0) {
        burst(this.x + this.w / 2, this.y + this.h - 2, ['#c02535'], 1, 0.4, 0);
      }
      if (this.t > 16) {
        this.state = 'lunge';
        this.dir = player.x > this.x ? 1 : -1;
        AudioSys.sfxDash();
      }
      return;
    }
    // lunge: sprint at the hunter, turning at walls
    if ((this.t & 15) === 0) this.dir = player.x + player.w / 2 > this.x + this.w / 2 ? 1 : -1;
    this.vx = this.dir * 2.7;
    this.vy = Math.min(this.vy + GRAV, MAX_FALL);
    const px = this.x;
    const res = moveActor(this, this.vx, this.vy, true);
    this.stride += Math.abs(this.x - px);
    if (res.hitWall) this.dir = -this.dir;
    if (this.y > Level.pxH + 40) this.remove = true;
    if (Math.abs(player.x - this.x) > VIEW_W + 200) this.state = 'wait';
  }
  draw(g, camX, camY) {
    if (this.state === 'gone') return;
    const ax = this.x + this.w / 2 - camX, ay = this.y + this.h - camY;
    let sheet, f;
    if (this.state === 'crouch') {
      sheet = Sheets.houndIdle || Sheets.houndRun;
      f = 0;
    } else if (this.state === 'lunge' && this.vy < -1) {
      sheet = Sheets.houndJump;
      f = Math.floor(this.t / 7) % 5;
    } else if (this.state === 'wait') {
      sheet = Sheets.houndWalk;
      f = (this.t >> 3) % 6;
    } else {
      sheet = Sheets.houndRun;
      f = Math.floor(this.stride / HOUND_STRIDE) % 5;
    }
    drawSheetFrame(g, sheet, f, ax, ay, this.dir > 0, this.flash > 0);
    if (this.frozen > 0) {
      g.globalAlpha = 0.55;
      drawSheetFrame(g, sheet, f, ax, ay, this.dir > 0, true);
      g.globalAlpha = 1;
    }
  }
}

// A restless spirit that seeps out of the dark, drifts through stone, and fades.
class Ghost {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.w = 24; this.h = 30;
    this.dz = dangerAt(x);
    this.hp = scaleHp(4, this.dz);
    this.t = 0;
    this.state = 'appear';   // appear | haunt | vanish
    this.flash = 0;
    this.frozen = 0; this.fireCd = 0;
    this.contactDmg = scaleDmg(3, this.dz);
    this.scoreVal = 350;
    this.remove = false;
  }
  hitbox() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  hurt(dmg) {
    if (this.state !== 'haunt') return false;
    this.hp -= dmg; this.flash = 6;
    AudioSys.sfxHit();
    if (this.hp <= 0) {
      this.remove = true;
      burst(this.x + this.w / 2, this.y + this.h / 2, ['#8ad0f0', '#f8f8ff', '#5a9df0'], 14, 1.4, -0.02);
      AudioSys.sfxEnemyDie();
      game.addKillScore(this.scoreVal, this);
      game.dropSoul('medusa', this.x, this.y, this.elite);
    }
    return true;
  }
  update(player) {
    if (this.flash > 0) this.flash--;
    if (this.fireCd > 0) this.fireCd--;
    if (this.frozen > 0) { this.frozen--; return; }
    this.t++;
    if (this.state === 'appear') {
      if (this.t > 40) { this.state = 'haunt'; this.t = 0; }
      return;
    }
    if (this.state === 'vanish') {
      if (this.t > 34) this.remove = true;
      return;
    }
    // haunt: drift through everything toward the hunter
    const dx = player.x + player.w / 2 - (this.x + this.w / 2);
    const dy = player.y + 8 - (this.y + this.h / 2);
    const d = Math.max(1, Math.hypot(dx, dy));
    this.x += dx / d * 0.55;
    this.y += dy / d * 0.45 + Math.sin(this.t * 0.05) * 0.3;
    if (this.t > 430) { this.state = 'vanish'; this.t = 0; }
  }
  draw(g, camX, camY) {
    const flip = game.player && game.player.x < this.x;
    const ax = this.x + this.w / 2 - camX, ay = this.y + this.h + 8 - camY;
    if (this.state === 'appear') {
      const f = Math.min(6, Math.floor(this.t / 40 * 7));
      drawSheetFrame(g, Sheets.ghostAppears, f, ax, ay, flip, this.flash > 0);
    } else if (this.state === 'vanish') {
      const f = Math.min(3, Math.floor(this.t / 34 * 4));
      drawSheetFrame(g, Sheets.ghostVanish, f, ax, ay, flip, this.flash > 0);
    } else {
      const f = (this.t >> 3) % 7;
      let alpha = 0.85;
      g.globalAlpha = alpha;
      drawSheetFrame(g, Sheets.ghostIdle, f, ax, ay, flip, this.flash > 0);
      g.globalAlpha = 1;
    }
    if (this.frozen > 0) {
      g.globalAlpha = 0.5;
      drawSheetFrame(g, Sheets.ghostIdle, (this.t >> 3) % 7, ax, ay, flip, true);
      g.globalAlpha = 1;
    }
  }
}


// A pale wolf that lopes in long pouncing arcs. Prowls ramparts and graves.
class MoonWolf {
  constructor(x, groundY) {
    this.homeX = x; this.groundY = groundY;
    this.w = 22; this.h = 15;
    this.x = x; this.y = groundY - this.h;
    this.vx = 0; this.vy = 0;
    this.dz = dangerAt(x);
    this.hp = scaleHp(4, this.dz);
    this.t = 0;
    this.flash = 0;
    this.frozen = 0; this.fireCd = 0;
    this.state = 'prowl';    // prowl | hunt | gone
    this.respawn = 0;
    this.jumpCd = 0;         // so it does not chain-jump against a wall
    this.contactDmg = scaleDmg(2, this.dz);
    this.scoreVal = 300;
    this.remove = false;
    this.dir = -1;
    this.onGround = false;
    this.stride = 0;         // ground covered, so the gait matches the speed
  }
  hitbox() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  hurt(dmg) {
    if (this.state === 'gone') return false;
    this.hp -= dmg; this.flash = 6;
    AudioSys.sfxHit();
    if (this.hp <= 0) {
      flameBurst(this.x + this.w / 2, this.y + this.h / 2);
      AudioSys.sfxEnemyDie();
      game.addKillScore(this.scoreVal, this);
      game.maybeDrop(this.x + this.w / 2, this.y, 0.25);
      game.dropSoul('bat', this.x, this.y, this.elite);
      this.state = 'gone'; this.respawn = 800;
    }
    return true;
  }
  update(player) {
    if (this.flash > 0) this.flash--;
    if (this.fireCd > 0) this.fireCd--;
    if (this.frozen > 0) { this.frozen--; return; }
    this.t++;
    if (this.state === 'gone') {
      if (--this.respawn <= 0 && Math.abs(player.x - this.homeX) > VIEW_W) {
        this.state = 'prowl'; this.hp = scaleHp(4, this.dz);
        this.x = this.homeX; this.y = this.groundY - this.h;
      }
      return;
    }
    if (this.state === 'prowl') {
      // slow pacing until the hunt begins
      if ((this.t % 90) === 0) this.dir = -this.dir;
      this.vx = this.dir * 0.4;
      if (Math.abs(player.x - this.x) < 190 &&
          Math.abs(player.y + player.h - (this.y + this.h)) < 70) {
        this.state = 'hunt';
        AudioSys.sfxDash();
      }
    } else {
      // hunt: lope toward the prey, leaping to pounce when close and vaulting
      // whatever stands in the way. A wolf that cannot climb a step reads as broken.
      this.dir = player.x + player.w / 2 > this.x + this.w / 2 ? 1 : -1;
      this.vx = this.dir * 2.4;
      if (this.jumpCd > 0) this.jumpCd--;
      const pounce = this.onGround && Math.abs(player.x - this.x) < 70 && (this.t % 30) === 0;
      // prey up on a ledge: spring for it rather than pacing helplessly below
      const chaseUp = this.onGround && (this.y + this.h) - (player.y + player.h) > 20 &&
        Math.abs(player.x + player.w / 2 - (this.x + this.w / 2)) < 130;
      if (this.jumpCd <= 0 && (pounce || chaseUp)) {
        this.vy = chaseUp ? -5.4 : -4;
        this.jumpCd = 22;
        dustPuff(this.x + this.w / 2, this.y + this.h, 3);
      }
      if (Math.abs(player.x - this.x) > VIEW_W + 200) this.state = 'prowl';
    }
    this.vy = Math.min(this.vy + GRAV, MAX_FALL);
    const px = this.x;
    const res = moveActor(this, this.vx, this.vy, true);
    this.onGround = res.onGround;
    // the paws keep pace with the ground: one frame every WOLF_STRIDE pixels
    if (this.onGround) this.stride += Math.abs(this.x - px);
    // blocked by a wall: a prowler turns back, but a hunter vaults it (once,
    // then a cooldown — so it clears the obstacle instead of buzzing against it)
    if (res.hitWall) {
      if (this.state === 'hunt') {
        if (this.onGround && this.jumpCd <= 0) { this.vy = -5.4; this.jumpCd = 20; }
      } else {
        this.dir = -this.dir;
      }
    }
    if (this.y > Level.pxH + 40) this.remove = true;
  }
  draw(g, camX, camY) {
    if (this.state === 'gone') return;
    // airborne: hold the outstretched leap frame instead of cycling
    const f = !this.onGround ? 1 : Math.floor(this.stride / WOLF_STRIDE) % 4;
    const ax = this.x + this.w / 2 - camX, ay = this.y + this.h - camY;
    // native art runs left; flip when heading right
    drawSheetFrame(g, Sheets.wolfRun, f, ax, ay, this.dir > 0, this.flash > 0);
    if (this.frozen > 0) {
      g.globalAlpha = 0.55;
      drawSheetFrame(g, Sheets.wolfRun, f, ax, ay, this.dir > 0, true);
      g.globalAlpha = 1;
    }
  }
}

// A gargoyle: perches on sheer stone until you pass beneath, then falls on you
// like a dropped statue and climbs back to its ledge.
class Gargoyle {
  constructor(x, y) {
    this.homeX = x; this.homeY = y;
    this.x = x; this.y = y;
    this.w = 18; this.h = 20;
    this.dz = dangerAt(x);
    this.hp = scaleHp(6, this.dz);
    this.t = 0; this.flash = 0;
    this.frozen = 0; this.fireCd = 0;
    this.state = 'perch';     // perch | dive | climb | gone
    this.respawn = 0;
    this.contactDmg = scaleDmg(3, this.dz);
    this.scoreVal = 400;
    this.remove = false;
    this.vx = 0; this.vy = 0;
    this.dir = -1;
    this.stride = 0;
  }
  hitbox() { return { x: this.x + 2, y: this.y + 2, w: this.w - 4, h: this.h - 4 }; }
  hurt(dmg) {
    if (this.state === 'gone') return false;
    // stone-still on its perch, it shrugs off half of what you give it
    const taken = this.state === 'perch' ? Math.max(1, Math.floor(dmg / 2)) : dmg;
    this.hp -= taken; this.flash = 6;
    AudioSys.sfxHit();
    if (this.state === 'perch') {
      this.state = 'dive'; this.t = 0;     // and it wakes angry
      burst(this.x + this.w / 2, this.y + this.h / 2, ['#8f8c9e', '#5f5c70'], 6, 1.2, 0.05);
    }
    if (this.hp <= 0) {
      flameBurst(this.x + this.w / 2, this.y + this.h / 2);
      burst(this.x + this.w / 2, this.y + this.h / 2, ['#8f8c9e', '#3c3c50'], 14, 1.6, 0.06);
      AudioSys.sfxEnemyDie();
      game.addKillScore(this.scoreVal, this);
      game.maybeDrop(this.x + this.w / 2, this.y, 0.3);
      game.dropSoul('medusa', this.x, this.y, this.elite);
      this.state = 'gone'; this.respawn = 700;
    }
    return true;
  }
  update(player) {
    if (this.flash > 0) this.flash--;
    if (this.fireCd > 0) this.fireCd--;
    if (this.frozen > 0) { this.frozen--; return; }
    this.t++;
    if (this.state === 'gone') {
      if (--this.respawn <= 0 && Math.abs(player.x - this.homeX) > VIEW_W) {
        this.state = 'perch'; this.hp = scaleHp(6, this.dz);
        this.x = this.homeX; this.y = this.homeY;
      }
      return;
    }
    const px = player.x + player.w / 2;
    this.dir = px > this.x + this.w / 2 ? 1 : -1;
    if (this.state === 'perch') {
      // it waits, and it waits, until you are below it
      if (Math.abs(px - (this.x + this.w / 2)) < 90 &&
          player.y > this.y + 10 && player.y - this.y < 260) {
        this.state = 'wake'; this.t = 0;
        AudioSys.sfxRoar();
        dustPuff(this.x + this.w / 2, this.y + this.h, 3);
      }
      return;
    }
    if (this.state === 'wake') {
      // stone grinding on stone: a warning you can act on
      this.x += (this.t & 2) ? 0.4 : -0.4;
      if ((this.t & 3) === 0) {
        burst(this.x + this.w / 2, this.y + this.h, ['#8f8c9e', '#5f5c70'], 2, 0.5, 0.05);
      }
      if (this.t > 22) { this.state = 'dive'; this.t = 0; }
      return;
    }
    if (this.state === 'dive') {
      if (this.t < 12) return;                      // a moment of grinding stone
      this.vy = Math.min(this.vy + 0.34, 7);
      this.vx = this.dir * 1.1;
      const res = moveActor(this, this.vx, this.vy, true);
      if (res.onGround || res.hitCeil) {
        game.addShake(3);
        dustPuff(this.x + this.w / 2, this.y + this.h, 5);
        this.state = 'climb'; this.t = 0; this.vy = 0;
      }
      if (Math.abs(player.x - this.x) > VIEW_W + 200) { this.state = 'climb'; this.t = 0; }
      return;
    }
    // climb: crawl back up toward the perch it came from
    const dx = this.homeX - this.x, dy = this.homeY - this.y;
    const d = Math.max(1, Math.hypot(dx, dy));
    this.x += dx / d * 1.1;
    this.y += dy / d * 1.1;
    this.stride += 1.1;
    if (d < 6) { this.state = 'perch'; this.t = 0; this.x = this.homeX; this.y = this.homeY; }
  }
  draw(g, camX, camY) {
    if (this.state === 'gone') return;
    const dx = Math.floor(this.x - camX), dy = Math.floor(this.y - camY);
    const white = this.flash > 0;
    const stone = this.state === 'perch';
    const waking = this.state === 'wake';
    // a crouched stone body; wings spread when it falls
    const body = white ? '#f8f8ff' : stone ? '#6f6c80' : '#8f8c9e';
    const dark = white ? '#f8f8ff' : '#3c3c50';
    if (this.state === 'dive') {
      g.fillStyle = dark;
      g.fillRect(dx - 6, dy + 3, 6, 3);
      g.fillRect(dx + this.w, dy + 3, 6, 3);
      g.fillStyle = body;
      g.fillRect(dx - 4, dy + 2, 5, 2);
      g.fillRect(dx + this.w - 1, dy + 2, 5, 2);
    } else {
      g.fillStyle = dark;
      g.fillRect(dx - 3, dy + 1, 4, 8);
      g.fillRect(dx + this.w - 1, dy + 1, 4, 8);
    }
    g.fillStyle = body;
    g.fillRect(dx + 2, dy + 4, this.w - 4, this.h - 6);
    g.fillRect(dx + 4, dy + 1, this.w - 8, 4);
    g.fillStyle = dark;
    g.fillRect(dx + 3, dy + this.h - 3, 4, 3);
    g.fillRect(dx + this.w - 7, dy + this.h - 3, 4, 3);
    // horns, and eyes that light when it wakes
    g.fillRect(dx + 3, dy - 1, 2, 3);
    g.fillRect(dx + this.w - 5, dy - 1, 2, 3);
    g.fillStyle = stone ? '#4a4658' : waking ? ((game.time >> 1) & 1 ? '#ffe080' : '#ff9020')
      : ((game.time >> 2) & 1 ? '#ffb060' : '#e04040');
    g.fillRect(dx + 5, dy + 5, 2, 2);
    g.fillRect(dx + this.w - 7, dy + 5, 2, 2);
    if (this.frozen > 0) {
      g.globalAlpha = 0.5;
      g.fillStyle = '#8ad0f0';
      g.fillRect(dx, dy, this.w, this.h);
      g.globalAlpha = 1;
    }
  }
}

// A bone-thrower: a skeleton that will not close with you, and lobs its own ribs.
class BoneThrower {
  constructor(x, groundY) {
    this.homeX = x; this.groundY = groundY;
    this.x = x; this.y = groundY - 26;
    this.w = 14; this.h = 26;
    this.dz = dangerAt(x);
    this.hp = scaleHp(6, this.dz);
    this.t = 0; this.flash = 0; this.frozen = 0; this.fireCd = 0;
    this.state = 'wait'; this.respawn = 0;
    this.contactDmg = scaleDmg(2, this.dz); this.scoreVal = 260;
    this.remove = false; this.dir = -1; this.throwT = 0;
    this.vx = 0; this.vy = 0;
  }
  hitbox() { return { x: this.x + 2, y: this.y, w: this.w - 4, h: this.h }; }
  hurt(dmg) {
    if (this.state === 'gone') return false;
    this.hp -= dmg; this.flash = 6;
    AudioSys.sfxHit();
    if (this.hp <= 0) {
      burst(this.x + this.w / 2, this.y + this.h / 2, ['#e8e4d8', '#8f8c9e'], 12, 1.5, 0.06);
      AudioSys.sfxEnemyDie();
      game.addKillScore(this.scoreVal, this);
      game.maybeDrop(this.x + this.w / 2, this.y, 0.2);
      game.dropSoul('zombie', this.x, this.y, this.elite);
      this.state = 'gone'; this.respawn = 620;
    }
    return true;
  }
  update(player) {
    if (this.flash > 0) this.flash--;
    if (this.fireCd > 0) this.fireCd--;
    if (this.frozen > 0) { this.frozen--; return; }
    this.t++;
    if (this.state === 'gone') {
      if (--this.respawn <= 0 && Math.abs(player.x - this.homeX) > VIEW_W) {
        this.state = 'wait'; this.hp = scaleHp(6, this.dz);
        this.x = this.homeX; this.y = this.groundY - this.h;
      }
      return;
    }
    const px = player.x + player.w / 2;
    this.dir = px > this.x + this.w / 2 ? 1 : -1;
    const dist = Math.abs(px - (this.x + this.w / 2));
    const level = Math.abs(player.y + player.h - (this.y + this.h)) < 70;

    // it keeps its distance: backs away when you close, throws when you do not
    this.vy = Math.min(this.vy + GRAV, MAX_FALL);
    if (level && dist < 70) this.vx = -this.dir * 0.7;
    else if (level && dist > 150) this.vx = this.dir * 0.5;
    else this.vx = 0;
    const res = moveActor(this, this.vx, this.vy, true);
    if (res.hitWall) this.vx = 0;
    if (this.y > Level.pxH + 40) this.remove = true;

    if (this.throwT > 0) this.throwT--;
    if (level && dist < 220 && this.throwT <= 0) {
      this.throwT = 90;
      game.enemyProjectiles.push(new BoneProj(this.x + this.w / 2, this.y + 8, this.dir * 2.2, -1.6));
      AudioSys.sfxWhip();
    }
  }
  draw(g, camX, camY) {
    if (this.state === 'gone') return;
    const f = this.throwT > 70 ? 3 : (this.t >> 4) % 4;
    const ax = this.x + this.w / 2 - camX, ay = this.y + this.h - camY;
    drawSheetFrame(g, Sheets.skelWalk, f, ax, ay, this.dir > 0, this.flash > 0);
    if (this.throwT > 70) {
      g.fillStyle = '#e8e4d8';
      g.fillRect(Math.round(ax + this.dir * 8) - 1, Math.round(ay - 20), 4, 2);
    }
  }
}

// A cellar spider: hangs from the stone until you pass under, drops on its thread.
class Spider {
  constructor(x, ceilY) {
    this.homeX = x; this.ceilY = ceilY;
    this.x = x; this.y = ceilY;
    this.w = 14; this.h = 12;
    this.dz = dangerAt(x);
    this.hp = scaleHp(4, this.dz);
    this.t = 0; this.flash = 0; this.frozen = 0; this.fireCd = 0;
    this.state = 'hang'; this.respawn = 0;
    this.contactDmg = scaleDmg(2, this.dz); this.scoreVal = 220;
    this.remove = false; this.vy = 0; this.dir = 1;
  }
  hitbox() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  hurt(dmg) {
    if (this.state === 'gone') return false;
    this.hp -= dmg; this.flash = 6;
    AudioSys.sfxHit();
    if (this.hp <= 0) {
      burst(this.x + this.w / 2, this.y + this.h / 2, ['#3a2a44', '#8a83a8'], 10, 1.4, 0.05);
      AudioSys.sfxEnemyDie();
      game.addKillScore(this.scoreVal, this);
      game.maybeDrop(this.x + this.w / 2, this.y, 0.2);
      this.state = 'gone'; this.respawn = 520;
    }
    return true;
  }
  update(player) {
    if (this.flash > 0) this.flash--;
    if (this.frozen > 0) { this.frozen--; return; }
    this.t++;
    if (this.state === 'gone') {
      if (--this.respawn <= 0 && Math.abs(player.x - this.homeX) > VIEW_W) {
        this.state = 'hang'; this.hp = scaleHp(4, this.dz);
        this.x = this.homeX; this.y = this.ceilY;
      }
      return;
    }
    const px = player.x + player.w / 2;
    if (this.state === 'hang') {
      this.y = this.ceilY + Math.sin(this.t * 0.05) * 2;
      if (Math.abs(px - (this.x + this.w / 2)) < 40 && player.y > this.y) {
        this.state = 'drop'; this.vy = 0; this.t = 0;
      }
      return;
    }
    if (this.state === 'drop') {
      this.vy = Math.min(this.vy + 0.22, 4.5);
      this.y += this.vy;
      const below = tileAt(Math.floor((this.x + this.w / 2) / TILE), Math.floor((this.y + this.h + 6) / TILE));
      if (isSolid(below) || this.y - this.ceilY > 150 || this.t > 150) {
        this.state = 'climb'; this.t = 0;
      }
      return;
    }
    this.y -= 1.1;
    if (this.y <= this.ceilY) { this.y = this.ceilY; this.state = 'hang'; this.t = 0; }
  }
  draw(g, camX, camY) {
    if (this.state === 'gone') return;
    const dx = Math.floor(this.x - camX), dy = Math.floor(this.y - camY);
    g.fillStyle = 'rgba(200,196,220,0.35)';
    const top = Math.floor(this.ceilY - camY) - 200;
    g.fillRect(dx + this.w / 2, top, 1, (this.y - camY) - top);
    const body = this.flash > 0 ? '#f8f8ff' : '#2a2438';
    const legs = this.flash > 0 ? '#f8f8ff' : '#4a4658';
    g.fillStyle = legs;
    const sway = Math.sin(this.t * 0.25) * 2;
    for (let i = -1; i <= 1; i += 2) {
      g.fillRect(dx + (i < 0 ? -3 : this.w), dy + 3, 3, 1);
      g.fillRect(dx + (i < 0 ? -4 : this.w + 1), dy + 4 + Math.round(sway), 1, 3);
      g.fillRect(dx + (i < 0 ? -2 : this.w - 1), dy + 7, 3, 1);
    }
    g.fillStyle = body;
    g.fillRect(dx + 2, dy + 2, this.w - 4, this.h - 4);
    g.fillRect(dx + 4, dy, this.w - 8, 3);
    g.fillStyle = this.flash > 0 ? '#f8f8ff' : '#e04040';
    g.fillRect(dx + 4, dy + 4, 2, 2);
    g.fillRect(dx + this.w - 6, dy + 4, 2, 2);
  }
}

// A robed acolyte: rises slow, walks, and hurls a curse instead of a rib.
class RobedZombie {
  constructor(x, groundY) {
    this.homeX = x; this.groundY = groundY;
    this.x = x; this.y = groundY - 26;
    this.w = 14; this.h = 26;
    this.dz = dangerAt(x);
    this.hp = scaleHp(8, this.dz);
    this.t = 0; this.flash = 0; this.frozen = 0; this.fireCd = 0;
    this.state = 'wait'; this.respawn = 0;
    this.contactDmg = scaleDmg(2, this.dz); this.scoreVal = 280;
    this.remove = false; this.dir = -1; this.curseT = 0;
    this.vx = 0; this.vy = 0; this.rise = 44;
  }
  hitbox() { return { x: this.x + 2, y: this.y + (this.rise > 0 ? this.h * this.rise / 44 : 0), w: this.w - 4, h: this.h }; }
  hurt(dmg) {
    if (this.state === 'gone') return false;
    this.hp -= dmg; this.flash = 6;
    AudioSys.sfxHit();
    if (this.hp <= 0) {
      burst(this.x + this.w / 2, this.y + this.h / 2, ['#c0b0f0', '#4a3880', '#f8f8ff'], 14, 1.5, 0.05);
      AudioSys.sfxEnemyDie();
      game.addKillScore(this.scoreVal, this);
      game.maybeDrop(this.x + this.w / 2, this.y, 0.22);
      game.dropSoul('zombie', this.x, this.y, this.elite);
      this.state = 'gone'; this.respawn = 680;
    }
    return true;
  }
  update(player) {
    if (this.flash > 0) this.flash--;
    if (this.fireCd > 0) this.fireCd--;
    if (this.frozen > 0) { this.frozen--; return; }
    this.t++;
    if (this.rise > 0) { this.rise--; return; }
    if (this.state === 'gone') {
      if (--this.respawn <= 0 && Math.abs(player.x - this.homeX) > VIEW_W) {
        this.state = 'wait'; this.hp = scaleHp(8, this.dz);
        this.x = this.homeX; this.y = this.groundY - this.h; this.rise = 44;
      }
      return;
    }
    const px = player.x + player.w / 2;
    this.dir = px > this.x + this.w / 2 ? 1 : -1;
    const dist = Math.abs(px - (this.x + this.w / 2));
    const level = Math.abs(player.y + player.h - (this.y + this.h)) < 70;
    this.vy = Math.min(this.vy + GRAV, MAX_FALL);
    if (level && dist < 80) this.vx = -this.dir * 0.5;
    else if (level && dist > 140) this.vx = this.dir * 0.35;
    else this.vx = 0;
    moveActor(this, this.vx, this.vy, true);
    if (this.y > Level.pxH + 40) this.remove = true;
    if (this.curseT > 0) this.curseT--;
    if (level && dist < 200 && this.curseT <= 0) {
      this.curseT = 120;
      const sx = this.x + this.w / 2, sy = this.y + 6;
      game.enemyProjectiles.push(new EnemyFireball(sx - 7, sy, this.dir * 1.8, -2.8));
      burst(sx, sy, ['#7a5ac0', '#c0b0f0'], 5, 1, 0.03);
      AudioSys.sfxRoar();
    }
  }
  draw(g, camX, camY) {
    if (this.state === 'gone') return;
    if (this.rise > 0) {
      const f = Math.min(5, ((44 - this.rise) / 44 * 6) | 0);
      drawSheetFrame(g, Sheets.skelRobedRise, f, this.x + this.w / 2 - camX, this.y + this.h - camY, this.dir > 0, this.flash > 0);
    } else {
      const f = (this.t >> 3) & 7;
      drawSheetFrame(g, Sheets.skelRobedWalk, f, this.x + this.w / 2 - camX, this.y + this.h - camY, this.dir > 0, this.flash > 0);
    }
    if (this.frozen > 0) {
      g.globalAlpha = 0.55;
      drawSheetFrame(g, Sheets.skelRobedWalk, (this.t >> 3) & 7, this.x + this.w / 2 - camX, this.y + this.h - camY, this.dir > 0, true);
      g.globalAlpha = 1;
    }
  }
}

// A hell cat: fast, small, and it circles you before it strikes.
class HellCat {
  constructor(x, groundY) {
    this.homeX = x; this.groundY = groundY;
    this.w = 20; this.h = 14;
    this.x = x; this.y = groundY - this.h;
    this.vx = 0; this.vy = 0;
    this.dz = dangerAt(x);
    this.hp = scaleHp(4, this.dz);
    this.t = 0; this.flash = 0; this.frozen = 0; this.fireCd = 0;
    this.state = 'prowl'; this.respawn = 0;
    this.contactDmg = scaleDmg(2, this.dz); this.scoreVal = 220;
    this.remove = false; this.dir = -1; this.stride = 0;
    this.onGround = false;
  }
  hitbox() { return { x: this.x + 3, y: this.y + 1, w: this.w - 6, h: this.h - 1 }; }
  hurt(dmg) {
    if (this.state === 'gone') return false;
    this.hp -= dmg; this.flash = 6;
    AudioSys.sfxHit();
    if (this.hp <= 0) {
      burst(this.x + this.w / 2, this.y + this.h / 2, ['#c02535', '#6e1b26'], 10, 1.3, 0.05);
      AudioSys.sfxEnemyDie();
      game.addKillScore(this.scoreVal, this);
      game.maybeDrop(this.x + this.w / 2, this.y, 0.2);
      this.state = 'gone'; this.respawn = 600;
    }
    return true;
  }
  update(player) {
    if (this.flash > 0) this.flash--;
    if (this.fireCd > 0) this.fireCd--;
    if (this.frozen > 0) { this.frozen--; return; }
    this.t++;
    if (this.state === 'gone') {
      if (--this.respawn <= 0 && Math.abs(player.x - this.homeX) > VIEW_W) {
        this.state = 'prowl'; this.hp = scaleHp(4, this.dz);
        this.x = this.homeX; this.y = this.groundY - this.h;
      }
      return;
    }
    if (this.state === 'prowl') {
      if (Math.abs(player.x - this.x) < 160 && Math.abs(player.y - this.y) < 90) {
        this.state = 'hunt'; this.dir = player.x > this.x ? 1 : -1;
      }
      this.vx = 0;
      this.vy = Math.min(this.vy + GRAV, MAX_FALL);
      const res = moveActor(this, this.vx, this.vy, true);
      this.onGround = res.onGround;
      return;
    }
    this.dir = player.x + player.w / 2 > this.x + this.w / 2 ? 1 : -1;
    this.vx = this.dir * 3.2;
    if (this.t % 50 === 0 || (Math.abs(player.x - this.x) < 30 && this.onGround)) {
      this.vy = -4.8;
    }
    this.vy = Math.min(this.vy + GRAV, MAX_FALL);
    const px = this.x;
    const res = moveActor(this, this.vx, this.vy, true);
    this.onGround = res.onGround;
    if (this.onGround) this.stride += Math.abs(this.x - px);
    if (res.hitWall) this.dir = -this.dir;
    if (this.y > Level.pxH + 40) this.remove = true;
    if (Math.abs(player.x - this.x) > VIEW_W + 200) this.state = 'prowl';
  }
  draw(g, camX, camY) {
    if (this.state === 'gone') return;
    const f = this.onGround ? Math.floor(this.stride / 6) % 4 : 1;
    drawSheetFrame(g, Sheets.hellCatWalk, f, this.x + this.w / 2 - camX, this.y + this.h - camY, this.dir > 0, this.flash > 0);
  }
}

// A bog wretch: shambles from the mire, poisons on contact, and does not die easily.
class BogThing {
  constructor(x, groundY) {
    this.homeX = x; this.groundY = groundY;
    this.w = 16; this.h = 18;
    this.x = x; this.y = groundY - this.h;
    this.vx = 0; this.vy = 0;
    this.dz = dangerAt(x);
    this.hp = scaleHp(12, this.dz);
    this.t = 0; this.flash = 0; this.frozen = 0; this.fireCd = 0;
    this.state = 'wait'; this.respawn = 0;
    this.contactDmg = scaleDmg(2, this.dz); this.scoreVal = 350;
    this.remove = false; this.dir = -1;
    this.stride = 0; this.onGround = false;
    this.poisonRecharge = 0;
  }
  hitbox() { return { x: this.x + 1, y: this.y, w: this.w - 2, h: this.h }; }
  hurt(dmg) {
    if (this.state === 'gone') return false;
    this.hp -= dmg; this.flash = 6;
    AudioSys.sfxHit();
    if (this.hp <= 0) {
      burst(this.x + this.w / 2, this.y + this.h / 2, ['#3a6a3a', '#5aa04a', '#8ad0a0'], 16, 1.6, 0.06);
      AudioSys.sfxEnemyDie();
      game.addKillScore(this.scoreVal, this);
      game.maybeDrop(this.x + this.w / 2, this.y, 0.3);
      // leaves a poison pool behind
      game.projectiles.push(new FirePool(this.x + this.w / 2, Math.floor((this.y + this.h) / TILE) * TILE));
      this.state = 'gone'; this.respawn = 800;
    }
    return true;
  }
  update(player) {
    if (this.flash > 0) this.flash--;
    if (this.fireCd > 0) this.fireCd--;
    if (this.frozen > 0) { this.frozen--; return; }
    this.t++;
    if (this.poisonRecharge > 0) this.poisonRecharge--;
    if (this.state === 'gone') {
      if (--this.respawn <= 0 && Math.abs(player.x - this.homeX) > VIEW_W) {
        this.state = 'wait'; this.hp = scaleHp(12, this.dz);
        this.x = this.homeX; this.y = this.groundY - this.h;
      }
      return;
    }
    if (Math.abs(player.x - this.x) < 300 && Math.abs(player.y - this.y) < 100) {
      this.state = 'shamble';
    }
    if (this.state === 'wait') { this.vx = 0; return; }
    this.dir = player.x + player.w / 2 > this.x + this.w / 2 ? 1 : -1;
    this.vx = this.dir * 0.55;
    this.vy = Math.min(this.vy + GRAV, MAX_FALL);
    const px = this.x;
    const res = moveActor(this, this.vx, this.vy, true);
    this.onGround = res.onGround;
    if (this.onGround) this.stride += Math.abs(this.x - px);
    if (this.poisonRecharge <= 0 && Math.abs(player.x - this.x) < 80) {
      this.poisonRecharge = 80;
      for (let i = -2; i <= 2; i++) {
        game.enemyProjectiles.push(new EnemyFireball(this.x + this.w / 2 - 7 + i * 5, this.y + 2, this.dir * (1.5 + i * 0.4), -2.5));
      }
    }
    if (this.y > Level.pxH + 40) this.remove = true;
  }
  draw(g, camX, camY) {
    if (this.state === 'gone') return;
    const f = this.state === 'wait' ? 0 : Math.floor(this.stride / 7) % 4;
    drawSheetFrame(g, Sheets.bogWalk, f, this.x + this.w / 2 - camX, this.y + this.h - camY, this.dir > 0, this.flash > 0);
    if (this.frozen > 0) {
      g.globalAlpha = 0.55;
      drawSheetFrame(g, Sheets.bogWalk, f, this.x + this.w / 2 - camX, this.y + this.h - camY, this.dir > 0, true);
      g.globalAlpha = 1;
    }
  }
}

// A wailing wraith: phases through walls, screams to damage, and splits on death.
class Wraith {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.w = 28; this.h = 34;
    this.dz = dangerAt(x);
    this.hp = scaleHp(9, this.dz);
    this.t = 0; this.flash = 0; this.frozen = 0; this.fireCd = 0;
    this.state = 'appear'; this.remove = false;
    this.contactDmg = scaleDmg(3, this.dz); this.scoreVal = 450;
    this.screamT = 0;
  }
  hitbox() { return { x: this.x + 2, y: this.y + 4, w: this.w - 4, h: this.h - 6 }; }
  hurt(dmg) {
    if (this.state !== 'haunt') return false;
    this.hp -= dmg; this.flash = 6;
    AudioSys.sfxHit();
    if (this.hp <= 0) {
      if (!this.split) {
        this.remove = true;
        burst(this.x + this.w / 2, this.y + this.h / 2, ['#8a5ac0', '#f8f8ff', '#3a2050'], 18, 1.8, 0.04);
        AudioSys.sfxEnemyDie();
        game.addKillScore(this.scoreVal, this);
        // splits into two lesser ghosts
        for (const dx of [-8, 8]) {
          const g = new Ghost(this.x + dx, this.y);
          g.state = 'haunt'; g.t = 20; game.enemies.push(g);
        }
      } else {
        this.remove = true;
        burst(this.x + this.w / 2, this.y + this.h / 2, ['#a070e0', '#f8f8ff'], 10, 1.2, 0.03);
        AudioSys.sfxEnemyDie();
        game.addKillScore(Math.floor(this.scoreVal / 2), this);
      }
    }
    return true;
  }
  update(player) {
    if (this.flash > 0) this.flash--;
    if (this.fireCd > 0) this.fireCd--;
    if (this.frozen > 0) { this.frozen--; return; }
    this.t++;
    if (this.screamT > 0) this.screamT--;
    if (this.state === 'appear') {
      if (this.t > 50) { this.state = 'haunt'; this.t = 0; AudioSys.sfxRoar(); }
      return;
    }
    const dx = player.x + player.w / 2 - (this.x + this.w / 2);
    const dy = player.y + 8 - (this.y + this.h / 2);
    const d = Math.max(1, Math.hypot(dx, dy));
    this.x += dx / d * 0.7;
    this.y += dy / d * 0.55 + Math.sin(this.t * 0.06) * 0.4;
    if (this.screamT <= 0 && d < 160) {
      this.screamT = 100;
      AudioSys.sfxRoar();
      burstRing(this.x + this.w / 2, this.y + this.h / 2, '#8a5ac0');
      if (d < 80 && !player.dead) player.damage(2, this.x + this.w / 2, this);
    }
    if (this.t > 500) this.remove = true;
  }
  draw(g, camX, camY) {
    let f = (this.t >> 3) % 4;
    if (this.screamT > 80) f = 0;
    const alpha = this.state === 'appear' ? 0.85 * Math.min(1, this.t / 50) : 0.85;
    g.globalAlpha = alpha;
    drawSheetFrame(g, Sheets.ghostShriek, f, this.x + this.w / 2 - camX, this.y + this.h + 6 - camY, game.player && game.player.x < this.x, this.flash > 0);
    g.globalAlpha = 1;
    if (this.frozen > 0) {
      g.globalAlpha = 0.5;
      drawSheetFrame(g, Sheets.ghostShriek, f, this.x + this.w / 2 - camX, this.y + this.h + 6 - camY, game.player && game.player.x < this.x, true);
      g.globalAlpha = 1;
    }
  }
}

// A plague rat: small, fast, swarms, and its bite leaves poison.
class PlagueRat {
  constructor(x, groundY) {
    this.homeX = x; this.groundY = groundY;
    this.w = 10; this.h = 6;
    this.x = x; this.y = groundY - this.h;
    this.vx = 0; this.vy = 0;
    this.dz = dangerAt(x);
    this.hp = scaleHp(2, this.dz);
    this.t = 0; this.flash = 0; this.frozen = 0; this.fireCd = 0;
    this.state = 'idle'; this.respawn = 0;
    this.contactDmg = scaleDmg(1, this.dz); this.scoreVal = 120;
    this.remove = false; this.dir = -1;
    this.onGround = false;
  }
  hitbox() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  hurt(dmg) {
    if (this.state === 'gone') return false;
    this.hp -= dmg; this.flash = 6;
    AudioSys.sfxHit();
    if (this.hp <= 0) {
      this.remove = true;
      burst(this.x + this.w / 2, this.y + this.h / 2, ['#5a6030', '#8a9030'], 5, 0.8, 0.08);
      AudioSys.sfxEnemyDie();
      game.addKillScore(this.scoreVal, this);
      game.maybeDrop(this.x + this.w / 2, this.y, 0.1);
      // spawn another rat nearby on death for that true swarm feel
      if (Math.random() < 0.35) {
        const nr = new PlagueRat(this.x + (Math.random() - 0.5) * 60, this.groundY);
        nr.state = 'hunt';
        game.enemies.push(game.applyVariant(nr));
      }
    }
    return true;
  }
  update(player) {
    if (this.flash > 0) this.flash--;
    if (this.fireCd > 0) this.fireCd--;
    if (this.frozen > 0) { this.frozen--; return; }
    this.t++;
    if (this.state === 'gone') {
      if (--this.respawn <= 0 && Math.abs(player.x - this.homeX) > 200) {
        this.state = 'idle'; this.hp = scaleHp(2, this.dz);
        this.x = this.homeX; this.y = this.groundY - this.h;
      }
      return;
    }
    if (this.state === 'idle') {
      if (Math.abs(player.x - this.x) < 120) { this.state = 'hunt'; }
      return;
    }
    this.dir = player.x + player.w / 2 > this.x + this.w / 2 ? 1 : -1;
    this.vx = this.dir * 2.8;
    if ((this.t % 50) === 0 && this.onGround) this.vy = -3.5;
    this.vy = Math.min(this.vy + GRAV, MAX_FALL);
    const res = moveActor(this, this.vx, this.vy, true);
    this.onGround = res.onGround;
    if (res.hitWall) this.dir = -this.dir;
    if (this.y > Level.pxH + 40) this.remove = true;
  }
  draw(g, camX, camY) {
    if (this.state === 'gone') return;
    const dx = Math.floor(this.x - camX), dy = Math.floor(this.y - camY);
    g.fillStyle = this.flash > 0 ? '#f8f8ff' : '#4a4820';
    g.fillRect(dx + 1, dy + 1, 8, 4);
    g.fillStyle = this.flash > 0 ? '#f8f8ff' : '#6a6830';
    g.fillRect(dx + 2, dy, 4, 2);
    g.fillStyle = '#e04040';
    g.fillRect(dx + (this.dir > 0 ? 7 : 1), dy + 2, 2, 2);
    g.fillStyle = '#2a2810';
    g.fillRect(dx + 2, dy + 5, 6, 1);
    if (this.frozen > 0) {
      g.globalAlpha = 0.55;
      g.fillStyle = '#8ad0f0';
      g.fillRect(dx, dy, this.w, this.h);
      g.globalAlpha = 1;
    }
  }
}

// A cave crawler: clings to walls and ceilings, drops on you, and skitters.
class CaveCrawler {
  constructor(x, ceilY) {
    this.homeX = x; this.ceilY = ceilY;
    this.x = x; this.y = ceilY;
    this.w = 16; this.h = 10;
    this.dz = dangerAt(x);
    this.hp = scaleHp(5, this.dz);
    this.t = 0; this.flash = 0; this.frozen = 0; this.fireCd = 0;
    this.state = 'hang'; this.respawn = 0;
    this.contactDmg = scaleDmg(2, this.dz); this.scoreVal = 240;
    this.remove = false; this.vx = 0; this.vy = 0;
    this.dir = 1; this.onGround = false;
  }
  hitbox() { return { x: this.x + 1, y: this.y, w: this.w - 2, h: this.h }; }
  hurt(dmg) {
    if (this.state === 'gone') return false;
    this.hp -= dmg; this.flash = 6;
    AudioSys.sfxHit();
    if (this.hp <= 0) {
      burst(this.x + this.w / 2, this.y + this.h / 2, ['#5a4a3a', '#8a7a5a'], 8, 1.2, 0.06);
      AudioSys.sfxEnemyDie();
      game.addKillScore(this.scoreVal, this);
      game.maybeDrop(this.x + this.w / 2, this.y, 0.25);
      this.state = 'gone'; this.respawn = 550;
    }
    return true;
  }
  update(player) {
    if (this.flash > 0) this.flash--;
    if (this.frozen > 0) { this.frozen--; return; }
    this.t++;
    if (this.state === 'gone') {
      if (--this.respawn <= 0 && Math.abs(player.x - this.homeX) > VIEW_W) {
        this.state = 'hang'; this.hp = scaleHp(5, this.dz);
        this.x = this.homeX; this.y = this.ceilY;
      }
      return;
    }
    const px = player.x + player.w / 2;
    this.dir = px > this.x + this.w / 2 ? 1 : -1;
    if (this.state === 'hang') {
      this.y = this.ceilY + Math.sin(this.t * 0.04) * 2;
      if (Math.abs(px - (this.x + this.w / 2)) < 50 && player.y > this.y) {
        this.state = 'drop'; this.vy = 0;
      }
      return;
    }
    if (this.state === 'drop') {
      this.vy = Math.min(this.vy + 0.28, 5);
      const dropRes = moveActor(this, 0, this.vy, true);
      if (dropRes.onGround || this.y - this.ceilY > 150 || this.t > 130) {
        this.state = 'skitter'; this.t = 0; this.vy = 0;
        this.onGround = dropRes.onGround;
        if (this.y > Level.pxH) { this.state = 'hang'; this.y = this.ceilY; this.x = this.homeX; }
      }
      return;
    }
    // skitter: run along surfaces and walls
    this.vy = Math.min(this.vy + GRAV, MAX_FALL);
    this.vx = this.dir * 2.2;
    const res = moveActor(this, this.vx, this.vy, true);
    this.onGround = res.onGround;
    if (res.hitWall) this.dir = -this.dir;
    if (this.t > 200) { this.state = 'hang'; this.y = this.ceilY; this.x = this.homeX; }
    if (this.y > Level.pxH + 40) { this.x = this.homeX; this.y = this.ceilY; this.state = 'hang'; }
  }
  draw(g, camX, camY) {
    if (this.state === 'gone') return;
    const dx = Math.floor(this.x - camX), dy = Math.floor(this.y - camY);
    const body = this.flash > 0 ? '#f8f8ff' : '#3a2818';
    const legs = this.flash > 0 ? '#f8f8ff' : '#5a3828';
    g.fillStyle = legs;
    for (let i = -1; i <= 1; i += 2) {
      const twitch = Math.sin(this.t * 0.3 + i) * (this.state === 'skitter' ? 3 : 1);
      g.fillRect(dx + (i < 0 ? -2 : this.w), dy + 4 + Math.round(twitch), 4, 1);
      g.fillRect(dx + (i < 0 ? -2 : this.w), dy + 6, 3, 1);
    }
    g.fillStyle = body;
    g.fillRect(dx + 2, dy + 2, this.w - 4, this.h - 4);
    g.fillStyle = this.flash > 0 ? '#f8f8ff' : '#d04020';
    g.fillRect(dx + 4, dy + 3, 3, 3);
    g.fillRect(dx + this.w - 7, dy + 3, 3, 3);
  }
}
