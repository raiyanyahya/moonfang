// Player and enemy projectiles.

// ---------------------------------------------------------------- sub-weapon projectiles
class KnifeProj {
  constructor(x, y, dir) {
    this.x = x; this.y = y - 1;
    this.w = 9; this.h = 3;
    this.dir = dir; this.dmg = 2;
    this.remove = false;
    this.hitSet = new Set();
  }
  hitbox() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  update() {
    this.x += this.dir * 4.2;
    const tipX = this.x + (this.dir > 0 ? this.w : 0);
    if (isSolid(tileAt(Math.floor(tipX / TILE), Math.floor((this.y + 1) / TILE)))) {
      burst(tipX, this.y + 1, ['#e8e4d8', '#8f8c9e'], 4, 1, 0.05);
      this.remove = true;
    }
  }
  onHit() { this.remove = true; }
  draw(g, camX, camY) {
    g.drawImage(this.dir > 0 ? Sprites.knife : Sprites.knifeL,
      Math.floor(this.x - camX), Math.floor(this.y - camY));
  }
}

class AxeProj {
  constructor(x, y, dir) {
    this.x = x; this.y = y - 6;
    this.w = 10; this.h = 10;
    this.vx = dir * 1.7; this.vy = -4.6;
    this.dmg = 4; this.t = 0;
    this.remove = false;
    this.hitSet = new Set();
  }
  hitbox() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  update() {
    this.t++;
    this.vy += 0.18;
    this.x += this.vx; this.y += this.vy;
    if (this.y > Level.pxH + 30) this.remove = true;
  }
  onHit() { /* axes pierce */ }
  draw(g, camX, camY) {
    g.drawImage(((this.t >> 2) & 1) ? Sprites.axe1 : Sprites.axe2,
      Math.floor(this.x - camX), Math.floor(this.y - camY));
  }
}

class HolyProj {
  constructor(x, y, dir) {
    this.x = x; this.y = y;
    this.w = 7; this.h = 8;
    this.vx = dir * 1.5; this.vy = -2.4;
    this.dmg = 1; this.t = 0;
    this.remove = false;
    this.hitSet = new Set();
  }
  hitbox() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  update() {
    this.t++;
    this.vy += 0.16;
    this.x += this.vx; this.y += this.vy;
    const ty = Math.floor((this.y + this.h) / TILE);
    const id = tileAt(Math.floor((this.x + 3) / TILE), ty);
    if (this.vy > 0 && (isSolid(id) || isPlatform(id))) {
      this.remove = true;
      AudioSys.sfxCandle();
      burst(this.x + 3, ty * TILE - 2, ['#50d8e8', '#f8f8ff'], 6, 1.2, 0.06);
      game.projectiles.push(new FirePool(this.x + 3, ty * TILE));
    }
    if (this.y > Level.pxH + 30) this.remove = true;
  }
  onHit() { this.remove = true; }
  draw(g, camX, camY) {
    g.drawImage(Sprites.holy, Math.floor(this.x - camX), Math.floor(this.y - camY));
  }
}

// Crescent Wave: charged blade of light that pierces everything in its path.
class CrescentWave {
  constructor(x, y, dir) {
    this.x = x; this.y = y - 12;
    this.w = 10; this.h = 26;
    this.dir = dir;
    this.vx = dir * 3.6;
    this.dmg = 4; this.t = 0;
    this.remove = false;
    this.hitSet = new Set();
  }
  hitbox() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  update() {
    this.t++;
    this.x += this.vx;
    if (this.t % 2 === 0) {
      spawnParticle(this.x + Math.random() * 8, this.y + Math.random() * this.h,
        -this.dir * 0.6, (Math.random() - 0.5) * 0.4,
        ['#ffe080', '#fff8e0'][(Math.random() * 2) | 0], 12, 0);
    }
    if (this.t > 80) this.remove = true;
  }
  onHit() { /* pierces */ }
  draw(g, camX, camY) {
    const x = Math.floor(this.x - camX), y = Math.floor(this.y - camY);
    g.fillStyle = 'rgba(255,224,128,0.18)';
    g.beginPath(); g.arc(x + 5, y + 13, 15, 0, 7); g.fill();
    const pts = [[2, -11], [4, -8], [6, -4], [7, 0], [6, 4], [4, 8], [2, 11]];
    for (const [ox, oy] of pts) {
      const px = x + (this.dir > 0 ? ox : 8 - ox);
      g.fillStyle = '#ffe080';
      g.fillRect(px, y + 13 + oy, 3, 3);
      g.fillStyle = '#fff8e0';
      g.fillRect(px + (this.dir > 0 ? 2 : 0), y + 13 + oy, 1, 3);
    }
  }
}

// Cross boomerang: flies out, spins back to the hand, hits on both passes.
class CrossProj {
  constructor(x, y, dir) {
    this.x = x; this.y = y - 6;
    this.w = 12; this.h = 12;
    this.dir = dir;
    this.vx = dir * 4.2;
    this.dmg = 3; this.t = 0;
    this.returning = false;
    this.remove = false;
    this.hitSet = new Set();
  }
  hitbox() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  update() {
    this.t++;
    const p = game.player;
    if (!this.returning) {
      this.vx -= this.dir * 0.14;
      if (Math.sign(this.vx) !== this.dir || this.vx === 0) {
        this.returning = true;
        this.hitSet.clear();     // the return pass cuts again
      }
      this.x += this.vx;
    } else {
      const tx = p.x + p.w / 2 - 6, ty = p.y + 8;
      const d = Math.max(1, Math.hypot(tx - this.x, ty - this.y));
      this.x += (tx - this.x) / d * 4.6;
      this.y += (ty - this.y) / d * 4.6;
      if (d < 10 || this.t > 240) this.remove = true;
    }
    if (this.t % 3 === 0) spawnParticle(this.x + 6, this.y + 6, 0, 0, '#d8a848', 8, 0);
  }
  onHit() { /* pierces */ }
  draw(g, camX, camY) {
    const spr = ((this.t >> 2) & 1) ? Sprites.cross1 : Sprites.cross2;
    g.drawImage(spr, Math.floor(this.x - camX), Math.floor(this.y - camY));
  }
}

class FirePool {
  constructor(cx, groundY) {
    this.x = cx - 11; this.y = groundY - 9;
    this.w = 22; this.h = 9;
    this.life = 120; this.t = 0;
    this.dmg = 1;
    this.remove = false;
    this.isFire = true;
  }
  hitbox() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  update() {
    this.t++;
    if (--this.life <= 0) this.remove = true;
    if (this.t % 4 === 0) {
      spawnParticle(this.x + Math.random() * this.w, this.y + 6,
        (Math.random() - 0.5) * 0.4, -0.6 - Math.random() * 0.5,
        ['#ff9020', '#ffd858', '#f8f8ff'][(Math.random() * 3) | 0], 16, -0.01);
    }
  }
  draw(g, camX, camY) {
    const fade = this.life < 30 && (this.life & 4);
    if (fade) return;
    for (let i = 0; i < 3; i++) {
      const fl = (((this.t >> 2) + i) & 1) ? Sprites.candle.flameA : Sprites.candle.flameB;
      g.drawImage(fl, Math.floor(this.x + i * 7 - camX), Math.floor(this.y + 3 - camY));
    }
    g.fillStyle = 'rgba(255,150,40,0.10)';
    g.beginPath(); g.arc(Math.floor(this.x + 11 - camX), Math.floor(this.y + 6 - camY), 13, 0, 7); g.fill();
  }
}


// Boss breath projectile: an arcing gout of hellfire.
class EnemyFireball {
  constructor(x, y, vx, vy) {
    this.x = x; this.y = y;
    this.w = 14; this.h = 12;
    this.vx = vx; this.vy = vy;
    this.t = 0;
    this.remove = false;
    this.dmg = 3;
  }
  hitbox() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  update() {
    this.t++;
    this.vy += 0.06;
    this.x += this.vx; this.y += this.vy;
    if (this.t % 3 === 0) {
      spawnParticle(this.x + 7, this.y + 6, (Math.random() - 0.5) * 0.4, -0.3,
        ['#ff9020', '#ffd858'][(Math.random() * 2) | 0], 10, 0);
    }
    if (isSolid(tileAt(Math.floor((this.x + 7) / TILE), Math.floor((this.y + 10) / TILE)))) {
      burst(this.x + 7, this.y + 6, ['#ff9020', '#ffd858', '#e04040'], 8, 1.2, 0.02);
      this.remove = true;
    }
    if (this.t > 240 || this.y > Level.pxH + 40) this.remove = true;
  }
  draw(g, camX, camY) {
    drawSheetFrame(g, Sheets.fireball, (this.t >> 2) % 3,
      this.x + 7 - camX, this.y + 6 - camY, this.vx > 0, false);
    g.fillStyle = 'rgba(255,150,40,0.12)';
    g.beginPath();
    g.arc(Math.floor(this.x + 7 - camX), Math.floor(this.y + 6 - camY), 9, 0, 7);
    g.fill();
  }
}


// Holy Tome: circles the hunter, striking everything it sweeps past.
class BibleProj {
  constructor(angle0) {
    const p = game.player;
    this.angle = angle0 || 0;
    this.x = p.x; this.y = p.y;
    this.w = 10; this.h = 8;
    this.dmg = 2; this.t = 0;
    this.life = 280;
    this.remove = false;
    this.hitSet = new Set();
  }
  hitbox() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  update() {
    this.t++;
    const p = game.player;
    this.angle += 0.13;
    const r = Math.min(30, 8 + this.t * 0.5);
    this.x = p.x + p.w / 2 - 5 + Math.cos(this.angle) * r;
    this.y = p.y + p.h / 2 - 4 + Math.sin(this.angle) * r;
    if (this.t % 30 === 0) this.hitSet.clear();   // each orbit cuts anew
    if (this.t % 4 === 0) spawnParticle(this.x + 5, this.y + 4, 0, 0, '#ffe080', 8, 0);
    if (--this.life <= 0) this.remove = true;
  }
  onHit() { /* holy words cannot be stopped */ }
  draw(g, camX, camY) {
    g.drawImage(Sprites.bible, Math.floor(this.x - camX), Math.floor(this.y - camY));
  }
}

// Rebound Stone: skips along the ground, breaking after a few bounces or two hits.
class StoneProj {
  constructor(x, y, dir) {
    this.x = x; this.y = y;
    this.w = 7; this.h = 6;
    this.vx = dir * 3.2; this.vy = -2;
    this.dmg = 2; this.t = 0;
    this.bounces = 0; this.hits = 0;
    this.remove = false;
    this.hitSet = new Set();
  }
  hitbox() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  breakUp() {
    burst(this.x + 3, this.y + 3, ['#9a97a8', '#6f6c80'], 5, 1, 0.06);
    this.remove = true;
  }
  update() {
    this.t++;
    this.vy += 0.2;
    this.x += this.vx; this.y += this.vy;
    const tx = Math.floor((this.x + 3) / TILE);
    const tyBelow = Math.floor((this.y + this.h) / TILE);
    if (this.vy > 0 && isSolid(tileAt(tx, tyBelow))) {
      this.y = tyBelow * TILE - this.h;
      this.bounces++;
      if (this.bounces > 3) { this.breakUp(); return; }
      this.vy = -3.6 * Math.pow(0.85, this.bounces);
      dustPuff(this.x + 3, this.y + this.h, 1);
    }
    const edge = Math.floor((this.x + (this.vx > 0 ? this.w : 0)) / TILE);
    if (isSolid(tileAt(edge, Math.floor((this.y + 3) / TILE)))) { this.breakUp(); return; }
    if (this.y > Level.pxH + 30) this.remove = true;
  }
  onHit() { if (++this.hits >= 2) this.remove = true; }
  draw(g, camX, camY) {
    g.drawImage(Sprites.stone, Math.floor(this.x - camX), Math.floor(this.y - camY));
  }
}

// A thrown rib, tumbling in an arc.
class BoneProj {
  constructor(x, y, vx, vy) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.w = 8; this.h = 4; this.t = 0; this.remove = false; this.dmg = 2;
  }
  hitbox() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  update() {
    this.t++;
    this.vy += 0.09;
    this.x += this.vx; this.y += this.vy;
    if (this.t > 240) this.remove = true;
    if (isSolid(tileAt(Math.floor((this.x + 4) / TILE), Math.floor((this.y + 2) / TILE)))) {
      burst(this.x + 4, this.y + 2, ['#e8e4d8'], 4, 0.9, 0.05);
      this.remove = true;
    }
  }
  draw(g, camX, camY) {
    const dx = Math.floor(this.x - camX), dy = Math.floor(this.y - camY);
    const spin = (this.t >> 2) & 3;
    g.fillStyle = '#e8e4d8';
    if (spin === 0 || spin === 2) { g.fillRect(dx, dy + 1, 8, 2); g.fillRect(dx, dy, 2, 4); g.fillRect(dx + 6, dy, 2, 4); }
    else { g.fillRect(dx + 3, dy - 2, 2, 8); g.fillRect(dx + 2, dy - 2, 4, 2); g.fillRect(dx + 2, dy + 4, 4, 2); }
  }
}

// A javelin: heavy, fast, and it does not stop at the first body.
class JavelinProj {
  constructor(x, y, dir) {
    this.x = x; this.y = y; this.vx = dir * 6.2; this.vy = 0;
    this.w = 20; this.h = 5; this.dmg = 5; this.t = 0;
    this.remove = false; this.pierce = 3; this.dir = dir;
    this.hitSet = new Set();
  }
  hitbox() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  update() {
    this.t++;
    this.x += this.vx;
    this.vy += 0.045;
    this.y += this.vy;
    if (this.t > 150) this.remove = true;
    if (isSolid(tileAt(Math.floor((this.x + this.w / 2) / TILE), Math.floor((this.y + 2) / TILE)))) {
      burst(this.x + this.w / 2, this.y + 2, ['#b8bec8', '#e8e4d8'], 5, 1, 0.05);
      this.remove = true;
    }
  }
  onHit() { if (--this.pierce <= 0) this.remove = true; }
  draw(g, camX, camY) {
    const dx = Math.floor(this.x - camX), dy = Math.floor(this.y - camY);
    g.fillStyle = '#7a5a3a';
    g.fillRect(dx + 2, dy + 2, this.w - 6, 2);
    g.fillStyle = '#dfe4ee';
    const tip = this.dir > 0 ? dx + this.w - 6 : dx;
    g.fillRect(tip, dy, 6, 4);
    g.fillStyle = '#f8f8ff';
    g.fillRect(this.dir > 0 ? tip + 4 : tip, dy + 1, 2, 2);
  }
}

// A bomb: lobbed, and what it does happens where it lands.
class BombProj {
  constructor(x, y, dir) {
    this.x = x; this.y = y; this.vx = dir * 3.1; this.vy = -3.2;
    this.w = 10; this.h = 10; this.dmg = 3; this.t = 0;
    this.remove = false; this.fuse = 70;
    this.hitSet = new Set();
  }
  hitbox() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  boom() {
    this.remove = true;
    const colors = this.darkflame ? ['#7a3ac0', '#c060e0', '#e8e4d8'] : ['#ff9020', '#ffd858', '#e8e4d8'];
    const ringColor = this.darkflame ? '#7a5ac0' : '#ff9020';
    burst(this.x + 5, this.y + 5, colors, 22, 2.4, 0.02);
    burstRing(this.x + 5, this.y + 5, ringColor);
    game.addShake(4);
    AudioSys.sfxCrash();
    if (this.darkflame) {
      for (const dx of [-20, 0, 20]) {
        game.projectiles.push(new DarkFirePool(this.x + dx, Math.floor((this.y + 10) / TILE) * TILE));
      }
    }
    for (const e of game.enemies) {
      if (e.remove || !e.hitbox || !e.hurt) continue;
      const eb = e.hitbox();
      const d = Math.hypot(eb.x + eb.w / 2 - this.x, eb.y + eb.h / 2 - this.y);
      if (d < 54) e.hurt(7);
    }
    if (game.boss && game.bossActive && !game.boss.dead) {
      const bb = game.boss.hitbox();
      if (Math.hypot(bb.x + bb.w / 2 - this.x, bb.y + bb.h / 2 - this.y) < 60) game.boss.hurt(6);
    }
  }
  update() {
    this.t++;
    this.vy = Math.min(this.vy + 0.19, 7);
    const px = this.x, py = this.y;
    this.x += this.vx; this.y += this.vy;
    const cx = Math.floor((this.x + 5) / TILE);
    if (isSolid(tileAt(cx, Math.floor((this.y + this.h) / TILE)))) {
      this.y = py; this.vy = -this.vy * 0.35; this.vx *= 0.6;
      if (Math.abs(this.vy) < 0.6) this.vy = 0;
    }
    if (isSolid(tileAt(Math.floor((this.x + (this.vx > 0 ? this.w : 0)) / TILE), Math.floor((this.y + 5) / TILE)))) {
      this.x = px; this.vx = -this.vx * 0.4;
    }
    if (--this.fuse <= 0) this.boom();
  }
  onHit() { this.boom(); }          // it goes off against whatever it touches
  draw(g, camX, camY) {
    const dx = Math.floor(this.x - camX), dy = Math.floor(this.y - camY);
    const hot = this.fuse < 24 && (this.t & 2);
    g.fillStyle = hot ? '#e04040' : '#2a2438';
    g.fillRect(dx + 1, dy + 2, 8, 8);
    g.fillStyle = '#4a4658';
    g.fillRect(dx + 2, dy + 3, 3, 3);
    g.fillStyle = (this.t & 3) < 2 ? '#ffd858' : '#ff9020';
    g.fillRect(dx + 5, dy - 2, 2, 3);
  }
}

// A chakram: it flies out, hangs, and comes back to the hand that threw it.
class ChakramProj {
  constructor(x, y, dir) {
    this.x = x; this.y = y; this.vx = dir * 5; this.vy = 0;
    this.w = 12; this.h = 12; this.dmg = 3; this.t = 0;
    this.remove = false; this.pierce = 99; this.dir = dir; this.back = false;
    this.hitSet = new Set();
  }
  hitbox() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  update() {
    this.t++;
    const p = game.player;
    if (!this.back) {
      this.x += this.vx;
      this.vx *= 0.965;
      if (Math.abs(this.vx) < 1.1 || this.t > 60) this.back = true;
    } else {
      // it knows the way home
      const tx = p.x + p.w / 2 - this.w / 2, ty = p.y + p.h / 2 - this.h / 2;
      const d = Math.max(1, Math.hypot(tx - this.x, ty - this.y));
      this.x += (tx - this.x) / d * 5.5;
      this.y += (ty - this.y) / d * 5.5;
      if (d < 12) this.remove = true;
    }
    if (this.t > 220) this.remove = true;
  }
  onHit() { /* it cuts through and comes home */ }
  draw(g, camX, camY) {
    const dx = Math.floor(this.x - camX) + 6, dy = Math.floor(this.y - camY) + 6;
    const a = this.t * 0.5;
    g.fillStyle = '#c8d4e8';
    for (let i = 0; i < 4; i++) {
      const th = a + i * Math.PI / 2;
      g.fillRect(Math.round(dx + Math.cos(th) * 6) - 2, Math.round(dy + Math.sin(th) * 6) - 2, 4, 4);
    }
    g.fillStyle = '#8a93a8';
    g.fillRect(dx - 2, dy - 2, 4, 4);
  }
}

// A fan of shuriken: three at once, spreading.
class ShurikenProj {
  constructor(x, y, dir, spread) {
    this.x = x; this.y = y; this.vx = dir * 4.6; this.vy = spread;
    this.w = 8; this.h = 8; this.dmg = 2; this.t = 0; this.remove = false;
    this.hitSet = new Set();
  }
  hitbox() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  update() {
    this.t++;
    this.x += this.vx; this.y += this.vy;
    if (this.t > 110) this.remove = true;
    if (isSolid(tileAt(Math.floor((this.x + 4) / TILE), Math.floor((this.y + 4) / TILE)))) {
      burst(this.x + 4, this.y + 4, ['#b8bec8'], 3, 0.8, 0.04);
      this.remove = true;
    }
  }
  onHit() { this.remove = true; }
  draw(g, camX, camY) {
    const dx = Math.floor(this.x - camX) + 4, dy = Math.floor(this.y - camY) + 4;
    const a = this.t * 0.6;
    g.fillStyle = '#dfe4ee';
    for (let i = 0; i < 4; i++) {
      const th = a + i * Math.PI / 2;
      g.fillRect(Math.round(dx + Math.cos(th) * 4) - 1, Math.round(dy + Math.sin(th) * 4) - 1, 3, 3);
    }
  }
}

// Void Shard: a dark crystal that phases through enemies and terrain.
class VoidShardProj {
  constructor(x, y, dir) {
    this.x = x; this.y = y;
    this.w = 14; this.h = 10;
    this.dir = dir; this.dmg = 3; this.pierce = 4;
    this.remove = false; this.t = 0;
    this.hitSet = new Set();
  }
  hitbox() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  update() {
    this.t++;
    this.x += this.dir * 3.4;
    if (this.t % 3 === 0) spawnParticle(this.x + 7, this.y + 5, -this.dir * 0.4, (Math.random() - 0.5) * 0.3, '#7a5ac0', 10, 0);
    if (this.t > 110) this.remove = true;
  }
  onHit() { if (--this.pierce <= 0) this.remove = true; }
  draw(g, camX, camY) {
    const dx = Math.floor(this.x - camX), dy = Math.floor(this.y - camY);
    g.fillStyle = 'rgba(122,90,192,0.18)';
    g.beginPath(); g.arc(dx + 7, dy + 5, 8, 0, 7); g.fill();
    g.fillStyle = '#3a2050';
    g.fillRect(dx + 2, dy + 2, 10, 6);
    g.fillStyle = '#7a5ac0';
    g.fillRect(dx + 4, dy + 1, 6, 1);
    g.fillRect(dx + 4, dy + 8, 6, 1);
    g.fillRect(dx + 5, dy + 3, 4, 4);
    g.fillStyle = '#c0a8f0';
    g.fillRect(dx + 6, dy + 4, 2, 2);
  }
}

// Lightning Orb: travels straight, chains damage to nearby enemies on hit.
class LightningOrbProj {
  constructor(x, y, dir) {
    this.x = x; this.y = y;
    this.w = 12; this.h = 12;
    this.vx = dir * 3.8; this.vy = 0;
    this.dmg = 2; this.t = 0; this.remove = false;
    this.hitSet = new Set();
    this.lastChain = 0;
  }
  hitbox() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  update() {
    this.t++;
    this.x += this.vx; this.y += this.vy;
    if (this.t % 2 === 0) spawnParticle(this.x + 6, this.y + 6, -Math.sign(this.vx) * 0.5, (Math.random() - 0.5) * 0.5, '#c07af0', 8, 0);
    if (this.t > 100) this.remove = true;
    if (isSolid(tileAt(Math.floor((this.x + 6) / TILE), Math.floor((this.y + 6) / TILE)))) {
      burst(this.x + 6, this.y + 6, ['#c07af0', '#f8f8ff'], 8, 1.2, 0.03);
      this.remove = true;
    }
  }
  onHit(target) {
    burstRing(this.x + 6, this.y + 6, '#c07af0');
    // chain to up to 2 other nearby enemies
    const targets = game.enemies.filter(e => !e.remove && e !== target && !this.hitSet.has(e) && e.hurt &&
      Math.abs(e.hitbox().x - this.x) < 80 && Math.abs(e.hitbox().y - this.y) < 60);
    let chains = 0;
    for (const e of targets) {
      if (chains >= 2) break;
      this.hitSet.add(e);
      e.hurt(1);
      const eb = e.hitbox();
      spawnFloater(eb.x + eb.w / 2, eb.y - 6, '1', '#c07af0');
      chains++;
    }
    this.remove = true;
  }
  draw(g, camX, camY) {
    const dx = Math.floor(this.x - camX), dy = Math.floor(this.y - camY);
    g.fillStyle = 'rgba(192,122,240,0.16)';
    g.beginPath(); g.arc(dx + 6, dy + 6, 7 + Math.sin(this.t * 0.2), 0, 7); g.fill();
    g.fillStyle = '#c07af0';
    g.fillRect(dx + 4, dy + 4, 4, 4);
    g.fillStyle = '#f8f8ff';
    g.fillRect(dx + 5, dy + 5, 2, 2);
  }
}

// Crystal Shard: fast, splits into three when it hits something.
class CrystalShardProj {
  constructor(x, y, dir) {
    this.x = x; this.y = y;
    this.w = 8; this.h = 6;
    this.vx = dir * 5.2; this.vy = 0;
    this.dmg = 2; this.t = 0; this.remove = false;
    this.hitSet = new Set();
  }
  hitbox() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  split() {
    this.remove = true;
    burst(this.x + 4, this.y + 3, ['#90f0ff', '#f8f8ff'], 6, 1, 0.04);
    AudioSys.sfxCandle();
    for (const s of [-0.8, 0, 0.8]) {
      const sh = new ShurikenProj(this.x, this.y, 1, s);
      sh.vx = this.vx * 0.5 + s * 2;
      sh.dmg = 1;
      game.projectiles.push(sh);
    }
  }
  update() {
    this.t++;
    this.x += this.vx; this.y += this.vy;
    if (this.t > 80) this.remove = true;
    if (isSolid(tileAt(Math.floor((this.x + 4) / TILE), Math.floor((this.y + 3) / TILE)))) {
      this.split();
    }
  }
  onHit() { this.split(); }
  draw(g, camX, camY) {
    const dx = Math.floor(this.x - camX), dy = Math.floor(this.y - camY);
    g.fillStyle = '#a8f0ff';
    g.fillRect(dx + 1, dy + 2, 6, 4);
    g.fillRect(dx + 3, dy, 2, 2);
    g.fillStyle = '#f8f8ff';
    g.fillRect(dx + 2, dy + 1, 1, 2);
    g.fillRect(dx + 5, dy + 1, 1, 2);
  }
}

// Dark Fire Pool: lingering voidflame that burns enemies who step in it.
class DarkFirePool {
  constructor(cx, groundY) {
    this.x = cx - 14; this.y = groundY - 10;
    this.w = 28; this.h = 10;
    this.life = 140; this.t = 0;
    this.dmg = 1;
    this.remove = false;
    this.isFire = true;
  }
  hitbox() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  update() {
    this.t++;
    if (--this.life <= 0) { this.remove = true; return; }
    if (this.t % 5 === 0) {
      spawnParticle(this.x + Math.random() * this.w, this.y + 5,
        (Math.random() - 0.5) * 0.3, -0.5 - Math.random() * 0.5,
        ['#7a3ac0', '#c060e0', '#f8f8ff'][Math.random() * 3 | 0], 14, -0.01);
    }
  }
  draw(g, camX, camY) {
    const fade = this.life < 30 && (this.life & 4);
    if (fade) return;
    g.fillStyle = 'rgba(122,58,192,0.10)';
    g.beginPath(); g.arc(Math.floor(this.x + 14 - camX), Math.floor(this.y + 6 - camY), 16, 0, 7); g.fill();
    for (let i = 0; i < 4; i++) {
      g.fillStyle = ((this.t >> 2) & 1) ? '#7a3ac0' : '#c060e0';
      g.fillRect(Math.floor(this.x + 2 + i * 7 - camX), Math.floor(this.y + 5 - camY), 4, 3);
    }
  }
}
