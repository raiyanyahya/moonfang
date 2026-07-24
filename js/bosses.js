// Stage guardians.

// ---------------------------------------------------------------- boss
class GiantBat {        // the arch-demon Vespertilio
  constructor(def) {
    this.def = def;
    this.x = def.homeX; this.y = def.homeY;
    this.w = 48; this.h = 56;
    this.tide = def.variant === 'cistern';   // NEREZZA: a drowned, swarming aspect
    this.hp = Math.round((this.tide ? 120 : 90) + 42 * (def.danger || 0));
    this.maxHp = this.hp;
    this.bossName = def.bossName || 'VESPERTILIO';
    this.state = 'idle';
    this.t = 0;
    this.flash = 0;
    this.dead = false;
    this.deathT = 0;
    this.contactDmg = 4 + Math.floor((def.danger || 0) / 2);
    this.diveCount = 0;
    this.vx = 0; this.vy = 0;
    this.fireCd = 0;
    this.frozen = 0;   // boss is immune; field exists for uniform checks
  }
  hitbox() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  hurt(dmg) {
    if (this.dead || this.state === 'idle') return false;
    this.hp -= dmg; this.flash = 6;
    AudioSys.sfxHit();
    if (!this.enraged && this.hp <= this.maxHp / 2 && this.hp > 0) {
      this.enraged = true;
      AudioSys.sfxRoar();
      burstRing(this.x + this.w / 2, this.y + this.h / 2, '#e04040');
      game.addShake(4);
    }
    if (this.hp <= 0 && !this.dead) {
      this.dead = true;
      this.deathT = 0;
      AudioSys.sfxRoar();
      game.addKillScore(3000, this);
    }
    return true;
  }
  start() {
    if (this.state === 'idle') {
      this.state = 'hover';
      this.t = 0;
      AudioSys.sfxRoar();
      burstRing(this.x + this.w / 2, this.y + this.h / 2, '#c07af0');
    }
  }
  update(player) {
    if (this.flash > 0) this.flash--;
    if (this.fireCd > 0) this.fireCd--;
    this.t++;
    if (this.dead) {
      this.deathT++;
      this.y += 0.4;
      if (this.deathT % 5 === 0) {
        flameBurst(this.x + Math.random() * this.w, this.y + Math.random() * this.h);
      }
      return;
    }
    if (this.state === 'idle') return;

    const homeX = this.def.homeX, homeY = this.def.homeY;
    if (this.state === 'hover') {
      this.x = homeX + Math.sin(this.t * 0.03) * 46 - this.w / 2;
      this.y = homeY + Math.sin(this.t * 0.09) * 7;
      if (this.t > (this.enraged ? 88 : 130)) {
        this.diveCount++;
        if (this.diveCount % 4 === 0) { this.state = 'summon'; this.t = 0; }
        else if (this.diveCount % 4 === 3) { this.state = 'breath'; this.t = 0; }
        else { this.state = 'telegraph'; this.t = 0; }
      }
    } else if (this.state === 'summon') {
      if (this.t === 10) {
        AudioSys.sfxRoar();
        burstRing(this.x + this.w / 2, this.y + this.h / 2, this.tide ? '#50b0e8' : '#c07af0');
        const a0 = this.def.arenaX0, a1 = this.def.arenaX1;
        // NEREZZA calls a whole drowned swarm; the vesper, only a pair of shades
        const spots = this.tide
          ? [a0 + 12, a0 + (a1 - a0) * 0.38, a0 + (a1 - a0) * 0.62, a1 - 24]
          : [a0 + 12, a1 - 24];
        for (const bx of spots) {
          const b = new Bat(bx, this.y + 10);
          b.minion = true; b.state = 'fly'; b.hp = 2;
          b.vx = bx < player.x ? 1.2 : -1.2;
          b.baseY = this.y + 10;
          game.enemies.push(b);
        }
      }
      if (this.t > 50) { this.state = 'hover'; this.t = 60; }
    } else if (this.state === 'breath') {
      // rear back and spit arcing gouts at the hunter — NEREZZA spews a wide
      // three-fanged tidal volley, the vesper a single aimed gout.
      if (this.t === 10) AudioSys.sfxRoar();
      if (this.t === 22 || this.t === 34 || this.t === 46) {
        const sx = this.x + this.w / 2 - 7, sy = this.y + this.h - 14;
        const dx = player.x + player.w / 2 - (sx + 7);
        const T = 50 + (this.t - 22);
        const fan = this.tide ? [-0.9, 0, 0.9] : [0];
        for (const off of fan) {
          game.enemyProjectiles.push(new EnemyFireball(sx, sy, dx / T + off, -1.3 + (this.t - 22) * 0.015));
        }
      }
      if (this.t > 62) { this.state = 'hover'; this.t = 60; }
    } else if (this.state === 'telegraph') {
      this.x += (this.t & 2) ? 1 : -1;   // shudder
      if (this.t === 1) AudioSys.sfxHit();
      if (this.t > 22) {
        this.state = 'dive'; this.t = 0;
        const tx = player.x + player.w / 2 - this.w / 2;
        const ty = player.y - 6;
        const spd = this.enraged ? 4.3 : 3.4;
        const d = Math.max(1, Math.hypot(tx - this.x, ty - this.y));
        this.vx = (tx - this.x) / d * spd;
        this.vy = (ty - this.y) / d * spd;
      }
    } else if (this.state === 'dive') {
      this.x += this.vx;
      this.y += this.vy;
      if (this.y + this.h > (this.def.floorY || 12 * TILE) - 2 || this.t > 60 ||
          this.x < this.def.arenaX0 || this.x + this.w > this.def.arenaX1) {
        this.state = 'return'; this.t = 0;
      }
    } else if (this.state === 'return') {
      const dx = homeX - this.w / 2 - this.x, dy = homeY - this.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      this.x += dx / d * 1.7;
      this.y += dy / d * 1.7;
      if (d < 8) { this.state = 'hover'; this.t = 0; }
    }
  }
  draw(g, camX, camY) {
    if (this.dead && this.deathT > 60) return;
    const attacking = this.state === 'telegraph' || this.state === 'dive' ||
      this.state === 'summon' || this.state === 'breath';
    const sheet = attacking ? Sheets.demonAttack : Sheets.demonIdle;
    let f;
    if (this.state === 'telegraph') f = (this.t >> 2) % 3;
    else if (this.state === 'dive') f = 3 + ((this.t >> 2) % 2);
    else if (this.state === 'summon' || this.state === 'breath') f = 5 + ((this.t >> 2) % 3);
    else f = (this.t >> 3) % 6;
    const white = this.flash > 0 || (this.dead && (this.deathT & 2));
    const flip = game.player && game.player.x + game.player.w / 2 > this.x + this.w / 2;
    // NEREZZA drips with a drowned blue nimbus; the vesper wears none
    if (this.tide && !this.dead) {
      const hx = this.x + this.w / 2 - camX, hy = this.y + this.h / 2 - camY;
      g.fillStyle = 'rgba(60,150,220,0.10)';
      g.beginPath(); g.arc(hx, hy, 38 + Math.sin(this.t * 0.08) * 3, 0, 7); g.fill();
    }
    drawSheetFrame(g, sheet, f, this.x + this.w / 2 - camX, this.y + this.h - camY, flip, white);
  }
}

// Tenebrae: a demon steed that tramples the arena and rears to hurl fire.
class NightmareBoss {
  constructor(def) {
    this.def = def;
    this.w = 74; this.h = 44;
    this.x = def.homeX - this.w / 2;
    this.y = (def.floorY !== undefined ? def.floorY : 12 * TILE) - this.h;
    this.pale = def.variant === 'gallery';   // THE PALE TWIN: a mirror-stepping aspect
    this.dmgBonus = Math.floor((def.danger || 0) / 2);
    this.hp = Math.round((this.pale ? 130 : 100) + 42 * (def.danger || 0));
    this.maxHp = this.hp;
    this.bossName = def.bossName || 'TENEBRAE';
    this.state = 'idle';
    this.t = 0; this.flash = 0;
    this.dead = false; this.deathT = 0;
    this.contactDmg = 4 + this.dmgBonus;
    this.dir = -1;
    this.gallops = 0;
    this.fireCd = 0; this.frozen = 0;   // immune; fields exist for uniform checks
  }
  hitbox() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  hurt(dmg) {
    if (this.dead || this.state === 'idle') return false;
    this.hp -= dmg; this.flash = 6;
    AudioSys.sfxHit();
    if (!this.enraged && this.hp <= this.maxHp / 2 && this.hp > 0) {
      this.enraged = true;
      AudioSys.sfxRoar();
      burstRing(this.x + this.w / 2, this.y + this.h / 2, '#e04040');
      game.addShake(4);
    }
    if (this.hp <= 0 && !this.dead) {
      this.dead = true; this.deathT = 0;
      AudioSys.sfxRoar();
      game.addKillScore(4000, this);
    }
    return true;
  }
  start() {
    if (this.state === 'idle') {
      this.state = 'pace'; this.t = 0;
      AudioSys.sfxRoar();
      burstRing(this.x + this.w / 2, this.y + this.h / 2, '#5ad0d0');
    }
  }
  update(player) {
    if (this.flash > 0) this.flash--;
    this.t++;
    if (this.dead) {
      this.deathT++;
      if (this.deathT % 5 === 0) {
        flameBurst(this.x + Math.random() * this.w, this.y + Math.random() * this.h);
      }
      return;
    }
    if (this.state === 'idle') return;
    const a0 = this.def.arenaX0 + 8, a1 = this.def.arenaX1 - 8;
    if (this.state === 'pace') {
      this.dir = player.x + player.w / 2 > this.x + this.w / 2 ? 1 : -1;
      this.x += this.dir * 0.5;
      this.contactDmg = 3 + this.dmgBonus;
      if (this.t > (this.enraged ? 70 : 110)) { this.state = 'telegraph'; this.t = 0; }
    } else if (this.state === 'telegraph') {
      this.x += (this.t & 2) ? 1 : -1;
      if (this.t === 1) AudioSys.sfxHit();
      // THE PALE TWIN mirror-steps mid-wind: it vanishes and re-forms across the
      // hall, so the charge comes from the side you did not brace for.
      if (this.pale && this.t === 14) {
        const b0 = this.def.arenaX0 + 8, b1 = this.def.arenaX1 - 8 - this.w;
        burst(this.x + this.w / 2, this.y + this.h / 2, ['#e8e0ff', '#a0b0d0'], 12, 1.4, 0);
        this.x = player.x + player.w / 2 > (b0 + b1) / 2 ? b0 : b1;
        burstRing(this.x + this.w / 2, this.y + this.h / 2, '#e8e0ff');
        AudioSys.sfxSoul();
      }
      if (this.t > 26) {
        this.state = 'gallop'; this.t = 0;
        this.dir = player.x + player.w / 2 > this.x + this.w / 2 ? 1 : -1;
        this.contactDmg = 5 + this.dmgBonus;
        AudioSys.sfxDash();
      }
    } else if (this.state === 'gallop') {
      this.x += this.dir * (this.enraged ? 5.4 : 4.4);
      if ((this.t & 3) === 0) dustPuff(this.x + this.w / 2 - this.dir * 20, this.y + this.h, 2);
      if (this.x < a0 || this.x + this.w > a1) {
        this.x = Math.max(a0, Math.min(a1 - this.w, this.x));
        this.gallops++;
        if (this.gallops % 3 === 0) { this.state = 'flames'; this.t = 0; }
        else { this.state = 'telegraph'; this.t = 0; }
      }
    } else if (this.state === 'flames') {
      this.contactDmg = 3 + this.dmgBonus;
      if (this.t === 10) AudioSys.sfxRoar();
      if (this.t === 20 || this.t === 30 || this.t === 40 || this.t === 50) {
        const sx = this.x + this.w / 2;
        const aim = player.x + player.w / 2 - sx;
        game.enemyProjectiles.push(new EnemyFireball(
          sx - 7, this.y - 6, aim / 90 + (Math.random() - 0.5) * 1.2, -3.6));
      }
      if (this.t > 70) { this.state = 'pace'; this.t = 0; }
    }
  }
  draw(g, camX, camY) {
    if (this.dead && this.deathT > 60) return;
    const galloping = this.state === 'gallop';
    const sheet = galloping ? Sheets.nightmareGallop : Sheets.nightmareIdle;
    const f = (this.t >> (galloping ? 2 : 3)) % 4;
    const white = this.flash > 0 || (this.dead && (this.deathT & 2)) || (this.pale && !this.dead);
    // THE PALE TWIN is a thing of mirror-light: a lagging afterimage trails it,
    // and it renders bone-white where TENEBRAE is dark.
    if (this.pale && !this.dead) {
      g.globalAlpha = 0.28;
      drawSheetFrame(g, sheet, f, this.x + this.w / 2 - this.dir * 8 - camX, this.y + this.h - camY, this.dir > 0, true);
      g.globalAlpha = 1;
    }
    // native art faces left; flip when heading right
    drawSheetFrame(g, sheet, f, this.x + this.w / 2 - camX, this.y + this.h - camY, this.dir > 0, white);
    if (this.state === 'flames' && (this.t & 3) < 2) {
      g.fillStyle = this.pale ? 'rgba(200,200,232,0.14)' : 'rgba(90,208,208,0.14)';
      g.beginPath();
      g.arc(Math.floor(this.x + this.w / 2 - camX), Math.floor(this.y + 10 - camY), 26, 0, 7);
      g.fill();
    }
  }
}

// Moloch: a hulking hell-fiend whose breath sweeps the floor — crouch or slide under it.
class HellBeastBoss {
  constructor(def) {
    this.def = def;
    this.w = 44; this.h = 44;
    this.x = def.homeX - this.w / 2;
    this.y = (def.floorY !== undefined ? def.floorY : 12 * TILE) - this.h;
    this.ember = def.variant === 'foundry';   // FORGEMAW: it treads in fire it leaves behind
    this.dmgBonus = Math.floor((def.danger || 0) / 2);
    this.hp = Math.round((this.ember ? 130 : 110) + 44 * (def.danger || 0));
    this.maxHp = this.hp;
    this.bossName = def.bossName || 'MOLOCH';
    this.state = 'idle';
    this.t = 0; this.flash = 0;
    this.dead = false; this.deathT = 0;
    this.contactDmg = 4 + this.dmgBonus;
    this.dir = -1;
    this.attacks = 0;
    this.fireCd = 0; this.frozen = 0;   // immune; uniform fields
  }
  hitbox() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  jetBox() {
    if (this.state !== 'breath') return null;
    const len = this.enraged ? 150 : 120;
    const x = this.dir > 0 ? this.x + this.w - 4 : this.x + 4 - len;
    return { x, y: this.y + 6, w: len, h: 13 };
  }
  hurt(dmg) {
    if (this.dead || this.state === 'idle') return false;
    this.hp -= dmg; this.flash = 6;
    AudioSys.sfxHit();
    if (!this.enraged && this.hp <= this.maxHp / 2 && this.hp > 0) {
      this.enraged = true;
      AudioSys.sfxRoar();
      burstRing(this.x + this.w / 2, this.y + this.h / 2, '#e04040');
      game.addShake(4);
    }
    if (this.hp <= 0 && !this.dead) {
      this.dead = true; this.deathT = 0;
      AudioSys.sfxRoar();
      game.addKillScore(4500, this);
    }
    return true;
  }
  start() {
    if (this.state === 'idle') {
      this.state = 'stalk'; this.t = 0;
      AudioSys.sfxRoar();
      burstRing(this.x + this.w / 2, this.y + this.h / 2, '#e05030');
    }
  }
  update(player) {
    if (this.flash > 0) this.flash--;
    this.t++;
    if (this.dead) {
      this.deathT++;
      if (this.deathT % 4 === 0) {
        flameBurst(this.x + Math.random() * this.w, this.y + Math.random() * this.h);
      }
      return;
    }
    if (this.state === 'idle') return;
    const a0 = this.def.arenaX0 + 6, a1 = this.def.arenaX1 - 6;
    const groundY = (this.def.floorY || 12 * TILE) - this.h;

    if (this.state === 'stalk') {
      this.dir = player.x + player.w / 2 > this.x + this.w / 2 ? 1 : -1;
      this.x += this.dir * (this.enraged ? 0.9 : 0.6);
      this.x = Math.max(a0, Math.min(a1 - this.w, this.x));
      if (this.t > 100) {
        this.attacks++;
        this.state = this.attacks % 2 === 1 ? 'breathTele' : 'leap';
        this.t = 0;
        if (this.state === 'leap') {
          this.vy = -5;
          this.vx = (player.x > this.x ? 1 : -1) * 2.8;
          AudioSys.sfxDash();
        }
      }
    } else if (this.state === 'breathTele') {
      this.dir = player.x + player.w / 2 > this.x + this.w / 2 ? 1 : -1;
      if (this.t === 6) AudioSys.sfxHit();
      if (this.t > 24) { this.state = 'breath'; this.t = 0; AudioSys.sfxRoar(); }
    } else if (this.state === 'breath') {
      const jet = this.jetBox();
      // roaring flame carpet
      if ((this.t & 1) === 0) {
        const fx = jet.x + Math.random() * jet.w;
        spawnParticle(fx, jet.y + Math.random() * jet.h,
          this.dir * (1 + Math.random()), (Math.random() - 0.5) * 0.5,
          ['#ff9020', '#ffd858', '#e04040'][(Math.random() * 3) | 0], 12, -0.01);
      }
      if (!player.dead && overlap(jet, player.hitbox())) {
        player.damage(3 + this.dmgBonus, this.x + this.w / 2);
      }
      if (this.t > (this.enraged ? 100 : 70)) { this.state = 'stalk'; this.t = 0; }
    } else if (this.state === 'leap') {
      this.vy += GRAV * 1.4;
      this.x += this.vx;
      this.y += this.vy;
      this.x = Math.max(a0, Math.min(a1 - this.w, this.x));
      if (this.vy > 0 && this.y >= groundY) {
        this.y = groundY;
        this.state = 'stalk'; this.t = 0;
        dustPuff(this.x + 6, this.y + this.h, 5);
        dustPuff(this.x + this.w - 6, this.y + this.h, 5);
        game.addShake(3);
        AudioSys.sfxHit();
        // FORGEMAW's tread splashes molten iron: the ground it lands on burns.
        if (this.ember) {
          const fy = (this.def.floorY || 12 * TILE);
          game.projectiles.push(new FirePool(this.x + this.w / 2 - 14, fy));
          game.projectiles.push(new FirePool(this.x + this.w / 2 + 6, fy));
          burstRing(this.x + this.w / 2, fy, '#ff9020');
        }
      }
    }
  }
  draw(g, camX, camY) {
    if (this.dead && this.deathT > 60) return;
    const breathing = this.state === 'breathTele' || this.state === 'breath';
    const baseSheet = this.enraged ? (Sheets.beastBurn || Sheets.beastBreath) : (breathing ? Sheets.beastBreath : Sheets.beastIdle);
    let f;
    if (this.state === 'breathTele') f = (this.t >> 3) % 2;
    else if (this.state === 'breath') f = 2 + ((this.t >> 2) % 2);
    else f = (this.t >> 3) % (this.enraged ? 5 : 5);
    const white = this.flash > 0 || (this.dead && (this.deathT & 2));
    // native art faces left; flip when facing right
    drawSheetFrame(g, baseSheet, f, this.x + this.w / 2 - camX, this.y + this.h - camY, this.dir > 0, white);
    if (this.state === 'breathTele' && (this.t & 3) < 2) {
      g.fillStyle = 'rgba(255,120,40,0.18)';
      g.beginPath();
      g.arc(Math.floor(this.x + this.w / 2 + this.dir * 16 - camX), Math.floor(this.y + 12 - camY), 10, 0, 7);
      g.fill();
    }
    // enraged, or FORGEMAW at any time: a burning aura and drifting embers
    if ((this.enraged || this.ember) && !this.dead) {
      const hx = this.x + this.w / 2 - camX, hy = this.y + this.h / 2 - camY;
      g.fillStyle = this.ember ? 'rgba(255,110,30,0.10)' : 'rgba(255,80,20,0.08)';
      g.beginPath(); g.arc(hx, hy, 40, 0, 7); g.fill();
      if (this.ember && (this.t & 3) === 0) {
        spawnParticle(this.x + Math.random() * this.w, this.y + this.h - 4,
          (Math.random() - 0.5) * 0.4, -0.5 - Math.random() * 0.5, '#ffb050', 20, -0.02);
      }
    }
  }
}


// ---------------------------------------------------------------- the finale
// The Moonfang: the castle's dreaming heart, wearing a body of moonlight.
// Three phases; it grows crueller as it wanes.
class FinalBoss {
  constructor(def) {
    this.def = def;
    this.x = def.homeX; this.y = def.homeY;
    this.w = 48; this.h = 56;
    this.hp = Math.round(340 + 44 * (def.danger || 0));
    this.maxHp = this.hp;
    this.bossName = def.bossName || 'THE MOONFANG';
    this.state = 'idle';
    this.t = 0; this.flash = 0;
    this.dead = false; this.deathT = 0;
    this.contactDmg = 4;
    this.attackN = 0;
    this.divesLeft = 1;
    this.vx = 0; this.vy = 0;
    this.frozen = 0;
    this.phase = 1;
  }
  hitbox() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  phaseFor() { const f = this.hp / this.maxHp; return f > 2 / 3 ? 1 : f > 1 / 3 ? 2 : 3; }
  hurt(dmg) {
    if (this.dead || this.state === 'idle') return false;
    this.hp -= dmg; this.flash = 6;
    AudioSys.sfxHit();
    const ph = this.phaseFor();
    if (ph > this.phase) {
      this.phase = ph;
      AudioSys.sfxRoar();
      burstRing(this.x + this.w / 2, this.y + this.h / 2, '#50d8e8');
      game.addShake(6);
      // it sheds a pair of moonlit shades at each turning
      const a0 = this.def.arenaX0, a1 = this.def.arenaX1;
      for (const bx of [a0 + 12, a1 - 24]) {
        const b = new Bat(bx, this.y + 10);
        b.minion = true; b.state = 'fly'; b.hp = 2;
        b.vx = bx < game.player.x ? 1.4 : -1.4;
        b.baseY = this.y + 10;
        game.enemies.push(b);
      }
    }
    if (this.hp <= 0 && !this.dead) {
      this.dead = true; this.deathT = 0;
      AudioSys.sfxRoar();
      game.addKillScore(20000, this);
    }
    return true;
  }
  start() {
    if (this.state === 'idle') {
      this.state = 'hover'; this.t = 0;
      AudioSys.sfxRoar();
      burstRing(this.x + this.w / 2, this.y + this.h / 2, '#50d8e8');
    }
  }
  update(player) {
    if (this.flash > 0) this.flash--;
    this.t++;
    if (this.dead) {
      this.deathT++;
      this.y += 0.3;
      if (this.deathT % 4 === 0) {
        burst(this.x + Math.random() * this.w, this.y + Math.random() * this.h,
          ['#e8e4f8', '#50d8e8'], 3, 1.2, 0.01);
      }
      return;
    }
    if (this.state === 'idle') return;
    const homeX = this.def.homeX, homeY = this.def.homeY;
    const quick = this.phase === 3 ? 0.75 : 1;
    if (this.state === 'hover') {
      this.x = homeX + Math.sin(this.t * 0.035) * 60 - this.w / 2;
      this.y = homeY + Math.sin(this.t * 0.1) * 8;
      if (this.t > 90 * quick) {
        this.attackN++;
        const cyc = this.phase === 1 ? ['dive', 'breath', 'dive'] :
          this.phase === 2 ? ['dive', 'sweep', 'breath', 'dive'] :
          ['dive', 'sweep', 'breath', 'sweep', 'dive'];
        const pick = cyc[this.attackN % cyc.length];
        this.state = pick === 'dive' ? 'telegraph' : pick;
        this.divesLeft = this.phase === 3 ? 2 : 1;
        this.t = 0;
      }
    } else if (this.state === 'breath') {
      if (this.t === 8) AudioSys.sfxRoar();
      const shots = this.phase >= 2 ? [16, 26, 36, 46, 56] : [20, 32, 44];
      if (shots.indexOf(this.t) >= 0) {
        const sx = this.x + this.w / 2 - 7, sy = this.y + this.h - 14;
        const dx = player.x + player.w / 2 - (sx + 7);
        game.enemyProjectiles.push(new EnemyFireball(sx, sy, dx / 48, -1.2 + Math.random() * 0.3));
      }
      if (this.t > 64) { this.state = 'hover'; this.t = 40; }
    } else if (this.state === 'telegraph') {
      this.x += (this.t & 2) ? 1 : -1;
      if (this.t > 18 * quick + 4) {
        this.state = 'dive'; this.t = 0;
        const tx = player.x + player.w / 2 - this.w / 2;
        const ty = player.y - 6;
        const spd = this.phase === 3 ? 4.8 : 4.0;
        const d = Math.max(1, Math.hypot(tx - this.x, ty - this.y));
        this.vx = (tx - this.x) / d * spd;
        this.vy = (ty - this.y) / d * spd;
      }
    } else if (this.state === 'dive') {
      this.x += this.vx; this.y += this.vy;
      if ((this.t & 3) === 0) burst(this.x + this.w / 2, this.y + this.h / 2, ['#e8e4f8'], 1, 0.4, 0);
      if (this.y + this.h > (this.def.floorY || 12 * TILE) - 2 || this.t > 55 ||
          this.x < this.def.arenaX0 || this.x + this.w > this.def.arenaX1) {
        this.divesLeft--;
        if (this.divesLeft > 0) { this.state = 'telegraph'; this.t = 10; }
        else { this.state = 'return'; this.t = 0; }
      }
    } else if (this.state === 'sweep') {
      // drop low and scythe across the arena at head height; slide under or leap it
      if (this.t === 1) {
        this.sweepDir = player.x + player.w / 2 > this.x + this.w / 2 ? 1 : -1;
        AudioSys.sfxRoar();
      }
      if (this.t < 30) {
        const ex = this.sweepDir > 0 ? this.def.arenaX0 + 4 : this.def.arenaX1 - this.w - 4;
        this.x += (ex - this.x) * 0.12;
        this.y += (((this.def.floorY || 12 * TILE) - this.h - 26) - this.y) * 0.15;
      } else {
        this.x += this.sweepDir * (this.phase === 3 ? 5.2 : 4.2);
        if ((this.t & 2) === 0) {
          burst(this.x + (this.sweepDir > 0 ? 0 : this.w), this.y + this.h - 6, ['#50d8e8'], 1, 0.5, 0);
        }
        if ((this.x < this.def.arenaX0 + 2 && this.sweepDir < 0) ||
            (this.x + this.w > this.def.arenaX1 - 2 && this.sweepDir > 0) || this.t > 150) {
          this.state = 'return'; this.t = 0;
        }
      }
    } else if (this.state === 'return') {
      const dx = homeX - this.w / 2 - this.x, dy = homeY - this.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      this.x += dx / d * 2.0;
      this.y += dy / d * 2.0;
      if (d < 8) { this.state = 'hover'; this.t = 0; }
    }
  }
  draw(g, camX, camY) {
    if (this.dead && this.deathT > 70) return;
    const attacking = this.state !== 'hover' && this.state !== 'return' && this.state !== 'idle';
    const sheet = attacking ? Sheets.demonAttack : Sheets.demonIdle;
    let f;
    if (this.state === 'telegraph') f = (this.t >> 2) % 3;
    else if (this.state === 'dive' || this.state === 'sweep') f = 3 + ((this.t >> 2) % 2);
    else if (this.state === 'breath') f = 5 + ((this.t >> 2) % 3);
    else f = (this.t >> 3) % 6;
    const cx2 = this.x + this.w / 2 - camX, cy2 = this.y + this.h / 2 - camY;
    const pulse = 0.05 + 0.03 * Math.sin(this.t * 0.1);
    g.fillStyle = `rgba(80,216,232,${pulse.toFixed(3)})`;
    g.beginPath(); g.arc(cx2, cy2, 42, 0, 7); g.fill();
    // a body of moonlight: white always, save the instant it is struck
    const white = !(this.flash > 0);
    const flip = game.player && game.player.x + game.player.w / 2 > this.x + this.w / 2;
    drawSheetFrame(g, sheet, f, cx2, this.y + this.h - camY, flip, white);
  }
}

// DragonGuardian: Vaelthran the Everburning — a three-phase dragon that guards
// the highest spire. Phase 1: air sweeps and fire breath. Phase 2: ground pursuit
// and lava pools. Phase 3: enraged, everything burns.
class DragonGuardian {
  constructor(def) {
    this.def = def;
    this.w = 80; this.h = 56;
    this.x = def.homeX - this.w / 2;
    this.y = def.homeY;
    this.hp = Math.round(210 + 52 * (def.danger || 0));
    this.maxHp = this.hp;
    this.bossName = def.bossName || 'VAELTHRAN';
    this.state = 'idle';
    this.t = 0; this.flash = 0;
    this.dead = false; this.deathT = 0;
    this.contactDmg = 5;
    this.dir = -1;
    this.phase = 1;
    this.fireCd = 0;
    this.attacks = 0;
  }
  hitbox() { return { x: this.x + 6, y: this.y + 4, w: this.w - 12, h: this.h - 8 }; }
  phaseFor() { const f = this.hp / this.maxHp; return f > 2 / 3 ? 1 : f > 1 / 3 ? 2 : 3; }
  hurt(dmg) {
    if (this.dead || this.state === 'idle') return false;
    this.hp -= dmg; this.flash = 6;
    AudioSys.sfxHit();
    const ph = this.phaseFor();
    if (ph > this.phase) {
      this.phase = ph;
      AudioSys.sfxRoar();
      burstRing(this.x + this.w / 2, this.y + this.h / 2, '#ff6020');
      game.addShake(7);
      if (this.phase >= 2) {
        for (const bx of [this.def.arenaX0 + 20, this.def.arenaX1 - 40]) {
          game.projectiles.push(new FirePool(bx, (this.def.floorY || 12 * TILE)));
        }
      }
    }
    if (this.hp <= 0 && !this.dead) {
      this.dead = true; this.deathT = 0;
      AudioSys.sfxRoar();
      game.addKillScore(8000, this);
    }
    return true;
  }
  start() {
    if (this.state === 'idle') {
      this.state = 'hover'; this.t = 0;
      AudioSys.sfxRoar();
      burstRing(this.x + this.w / 2, this.y + this.h / 2, '#ff6020');
    }
  }
  update(player) {
    if (this.flash > 0) this.flash--;
    if (this.fireCd > 0) this.fireCd--;
    this.t++;
    if (this.dead) {
      this.deathT++;
      if (this.deathT % 3 === 0) {
        const cx = this.x + Math.random() * this.w, cy = this.y + Math.random() * this.h;
        flameBurst(cx, cy);
        burst(cx, cy, ['#ff6020', '#ffd858', '#e04040'], 5, 1.5, 0.02);
      }
      return;
    }
    if (this.state === 'idle') return;
    const a0 = this.def.arenaX0 + 8, a1 = this.def.arenaX1 - 8;
    const floorY = this.def.floorY || 12 * TILE;
    const quick = this.phase === 3 ? 0.7 : 1;

    if (this.state === 'hover') {
      this.x = this.def.homeX + Math.sin(this.t * 0.025) * 70 - this.w / 2;
      this.y = this.def.homeY + Math.sin(this.t * 0.07) * 12;
      this.contactDmg = 4;
      if (this.t > 100 * quick) {
        this.attacks++;
        if (this.phase >= 2 && this.attacks % 4 === 0) { this.state = 'groundBreath'; this.dir = player.x > this.x ? 1 : -1; }
        else if (this.attacks % 3 === 0) { this.state = 'dive'; }
        else { this.state = 'breath'; }
        this.t = 0;
      }
    } else if (this.state === 'breath') {
      this.contactDmg = 4;
      const shots = this.phase >= 2 ? [12, 22, 32, 42, 52] : [14, 26, 38];
      if (shots.indexOf(this.t) >= 0) {
        const sx = this.x + this.w / 2 - 8;
        const sy = this.y + this.h - 16;
        const dx = player.x + player.w / 2 - (sx + 8);
        game.enemyProjectiles.push(new EnemyFireball(sx, sy, dx / 55, -1.8 + Math.random() * 0.4));
        if (this.phase >= 3) {
          game.enemyProjectiles.push(new EnemyFireball(sx + 10, sy, dx / 55 + 0.5, -2.2));
        }
      }
      if (this.t > 64 * quick) { this.state = 'hover'; this.t = 30; }
    } else if (this.state === 'dive') {
      if (this.t < 10) { this.x += (this.t & 2) ? 2 : -2; return; }
      const tx = player.x + player.w / 2 - this.w / 2;
      const ty = player.y - 30;
      const spd = this.phase >= 3 ? 5 : 3.8;
      const d = Math.max(1, Math.hypot(tx - this.x, ty - this.y));
      this.x += (tx - this.x) / d * spd;
      this.y += (ty - this.y) / d * spd;
      this.contactDmg = 6;
      if ((this.t & 3) === 0) {
        spawnParticle(this.x + this.w / 2, this.y + this.h, (Math.random() - 0.5) * 0.4, -0.8, '#ff6020', 12, 0);
      }
      if (this.y + this.h > floorY - 4 || this.t > 70 || this.x < a0 || this.x + this.w > a1) {
        game.addShake(4);
        dustPuff(this.x + this.w / 2, floorY, 8);
        burstRing(this.x + this.w / 2, floorY, '#ff9020');
        if (this.phase >= 2) {
          game.projectiles.push(new FirePool(this.x + this.w / 2 - 20, floorY));
          game.projectiles.push(new FirePool(this.x + this.w / 2 + 10, floorY));
        }
        this.y = floorY - this.h;
        this.state = 'groundBreath'; this.dir = player.x > this.x ? 1 : -1;
        this.t = 0;
      }
    } else if (this.state === 'groundBreath') {
      this.contactDmg = 5;
      this.dir = player.x + player.w / 2 > this.x + this.w / 2 ? 1 : -1;
      this.x = Math.max(a0, Math.min(a1 - this.w, this.x + this.dir * 1.2));
      if (this.t === 10) AudioSys.sfxRoar();
      if (this.t >= 24 && this.t < 90 && (this.t & 1) === 0) {
        // sweeping fire carpet from the dragon's maw
        const sx = this.dir > 0 ? this.x + this.w - 6 : this.x + 6;
        for (let lx = 0; lx < 120; lx += 8) {
          spawnParticle(sx + this.dir * lx, this.y + 14 + (Math.random() - 0.5) * 4,
            this.dir * (1.5 + Math.random()), (Math.random() - 0.5) * 0.4,
            ['#ff6020', '#ffd858', '#e04040'][Math.random() * 3 | 0], 14, 0);
        }
        if (Math.abs(player.x - this.x) < 150 && Math.abs(player.y - this.y) < 40 && !player.dead) {
          player.damage(2, this.x + this.dir * 60, this);
        }
      }
      if (this.t > 100) { this.state = 'hover'; this.t = 0; this.y = this.def.homeY; }
    }
  }
  draw(g, camX, camY) {
    if (this.dead && this.deathT > 70) return;
    const breathing = this.state === 'breath' || this.state === 'groundBreath';
    const sheet = breathing ? Sheets.dragonBreath : Sheets.dragonIdle;
    let f;
    if (breathing) f = (this.t >> 2) % 7;
    else if (this.state === 'dive' && this.t < 10) f = (this.t >> 2) % 2;
    else f = (this.t >> 3) % 6;
    const white = this.flash > 0 || (this.dead && (this.deathT & 3));
    const flip = game.player && game.player.x + game.player.w / 2 > this.x + this.w / 2;
    drawSheetFrame(g, sheet, f, this.x + this.w / 2 - camX, this.y + this.h - camY, flip, white);
    // everburning aura in phase 3
    if (this.phase >= 3 && !this.dead) {
      const hx = this.x + this.w / 2 - camX, hy = this.y + this.h / 2 - camY;
      g.fillStyle = 'rgba(255,96,32,0.08)';
      g.beginPath(); g.arc(hx, hy, 50, 0, 7); g.fill();
    }
  }
}
