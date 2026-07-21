// Candles, drops, and the victory crystal.

// ---------------------------------------------------------------- candles & pickups
class Candle {
  constructor(def) {
    this.tx = def.tx; this.ty = def.ty;
    this.x = def.tx * TILE + 4;
    this.y = def.ty * TILE;
    this.w = 8; this.h = 14;
    this.drop = def.drop;
    this.broken = false;
    this.t = (def.tx * 13) % 16;
  }
  hitbox() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  smash() {
    this.broken = true;
    AudioSys.sfxCandle();
    game.addScore(10);
    game.stats.candles++;
    burst(this.x + 4, this.y + 4, ['#ffe080', '#ff9020', '#f8f8ff'], 8, 1.2, 0.05);
    let kind = this.drop;
    if (!kind) {
      const r = Math.random();
      kind = r < 0.40 ? 'heart' : r < 0.52 ? 'bigheart' : r < 0.66 ? 'gem'
        : r < 0.74 ? 'orb'
        : r < 0.82 ? SUB_KEYS[(Math.random() * SUB_KEYS.length) | 0]
        : r < 0.87 ? 'whip' : null;
    }
    if (kind === 'whip' && game.player.whipLvl >= 3) kind = 'bigheart';
    if (kind) game.pickups.push(new Pickup(this.x + 1, this.y + 2, kind));
    // a scavenger reads more into a broken candle than anyone else would
    if (game.player.skills.scavenger && Math.random() < 0.45) {
      game.pickups.push(new Pickup(this.x + 7, this.y + 2,
        Math.random() < 0.5 ? 'gem' : 'heart'));
    }
  }
  update() { this.t++; }
  draw(g, camX, camY) {
    if (this.broken) return;
    const dx = Math.floor(this.x - camX), dy = Math.floor(this.y - camY);
    g.drawImage(Sprites.candle.body, dx, dy + 4);
    const fl = ((this.t >> 3) & 1) ? Sprites.candle.flameA : Sprites.candle.flameB;
    g.drawImage(fl, dx, dy - 2);
    // pulsing warm glow
    glowOrb(g, dx + 4, dy + 1, 13 + ((this.t >> 3) & 1),
      '255,205,100', 0.20 + 0.05 * Math.sin(this.t * 0.19));
  }
}

const PICKUP_SIZES = {
  heart: [8, 7], bigheart: [10, 8], gem: [8, 7], orb: [8, 8], roast: [12, 7], scroll: [9, 9],
  chest: [12, 8], elixir: [8, 9], key: [10, 6],
  whip: [9, 9], knife: [9, 3], axe: [10, 10], holy: [7, 8],
  soulZ: [8, 8], soulB: [8, 8], soulM: [8, 8],
};

class Pickup {
  constructor(x, y, kind, data) {
    this.data = data || null;
    this.x = x; this.y = y;
    this.kind = kind;
    const s = kind.startsWith('card_') ? [12, 16] : (PICKUP_SIZES[kind] || [8, 8]);
    this.w = s[0]; this.h = s[1];
    this.vy = -1.2;
    this.t = 0;
    this.soul = kind.startsWith('soul');
    this.isCard = kind.startsWith('card_');
    this.major = this.soul || this.isCard || kind === 'relic' || kind === 'chest' || kind === 'elixir' || kind === 'key' || kind === 'scroll' || !!SUBWEAPONS[kind] || kind === 'whip' || kind === 'tablet' || !!BUFFS[kind] || kind.startsWith('weap_');
    this.life = this.major ? 700 : 420;
    this.remove = false;
    this.grounded = this.soul;      // souls hover
  }
  update(player) {
    this.t++;
    // drops drift toward the hunter when close (roguelike vacuum)
    if (player && !player.dead) {
      const dx = player.x + player.w / 2 - (this.x + this.w / 2);
      const dy = player.y + player.h / 2 - (this.y + this.h / 2);
      const mr = 32 + 8 * player.perkRank('drawing');
      if (Math.abs(dx) < mr && Math.abs(dy) < mr - 2) {
        this.x += Math.max(-2.2, Math.min(2.2, dx * 0.13));
        this.y += Math.max(-2.2, Math.min(2.2, dy * 0.13));
        this.grounded = true;
      }
    }
    if (!this.grounded) {
      this.vy = Math.min(this.vy + 0.12, 3);
      const res = moveActor(this, 0, this.vy, false);
      if (res.onGround) this.grounded = true;
      if (this.y > Level.pxH + 20) this.remove = true;
    }
    if (this.soul && this.t % 5 === 0) {
      spawnParticle(this.x + Math.random() * 8, this.y + 8,
        (Math.random() - 0.5) * 0.3, -0.3, '#6ab0f0', 18, -0.01);
    }
    if (--this.life <= 0) this.remove = true;
  }
  collect(player) {
    if (this.kind === 'heart') { player.hearts++; game.addScore(100); AudioSys.sfxPickup(); }
    else if (this.kind === 'bigheart') { player.hearts += 5; game.addScore(200); AudioSys.sfxPickup(); }
    else if (this.kind === 'gem') {
      const v = 500 + 250 * player.perkRank('lapidary');
      game.addScore(v);
      player.gems += 3 + player.perkRank('lapidary');
      spawnFloater(this.x, this.y - 4, '+' + v, '#c060e0');
      AudioSys.sfxPickup();
    }
    else if (this.kind.startsWith('weap_')) {
      game.giveItem(this.kind, this.x, this.y);
    }
    else if (BUFFS[this.kind]) {
      player.giveBuff(this.kind);
    }
    else if (this.kind === 'tablet') {
      // a lore tablet: the castle remembers, and now so do you
      const unseen = LORE.map((_, i) => i).filter(i => !meta.lore[i]);
      const idx = unseen.length ? unseen[(Math.random() * unseen.length) | 0]
        : (Math.random() * LORE.length) | 0;
      meta.lore[idx] = 1;
      saveMeta();
      game.stats.items++;
      game.showCard(Sprites.tablet, 'STONE TABLET', LORE[idx]);
      burst(this.x + 5, this.y, ['#9a97a8', '#e8e4d8'], 10, 1.2, -0.02);
      AudioSys.sfxSoul();
    }
    else if (this.kind === 'orb') { player.heal(5); AudioSys.sfxOrb(); burst(this.x + 4, this.y, ['#50d8e8', '#f8f8ff'], 8, 1, -0.02); }
    else if (this.kind === 'key') {
      player.keys++;
      game.stats.items++;
      spawnFloater(this.x + 5, this.y - 6, 'GOLDEN KEY', '#ffe080');
      burst(this.x + 5, this.y, ['#ffe080', '#d8a848'], 10, 1.2, -0.02);
      AudioSys.sfxItem();
    }
    else if (this.kind === 'chest') {
      game.addScore(1000);
      spawnFloater(this.x + 6, this.y - 6, '+1000', '#ffe080');
      for (let i = 0; i < 3; i++) {
        game.pickups.push(new Pickup(this.x - 8 + i * 8, this.y - 10 - i * 3, 'heart'));
      }
      burst(this.x + 6, this.y, ['#ffe080', '#d8a848', '#f8f8ff'], 12, 1.4, 0.04);
      AudioSys.sfxItem();
    }
    else if (this.kind === 'elixir') {
      player.maxHp += 2;
      player.hp = player.maxHpTotal();
      spawnFloater(this.x + 4, this.y - 6, 'ELIXIR  MAX HP +2', '#c060e0');
      burst(this.x + 4, this.y, ['#c060e0', '#f8f8ff'], 10, 1.2, -0.02);
      AudioSys.sfxOrb();
    }
    else if (this.kind === 'relic') {
      game.giveRelic(this.data || rollRelic(game.stage * 0.2));
    }
    else if (this.kind === 'scroll') {
      const pool = PERK_KEYS.filter(k => (player.perks[k] || 0) < 4);
      if (pool.length) {
        const k = pool[(Math.random() * pool.length) | 0];
        player.perks[k] = (player.perks[k] || 0) + 1;
        const def = PERKS[k];
        game.stats.items++;
        game.showCard(Sprites.whipItem, 'TECHNIQUE: ' + def.name + ' ' + RANK_NUM[player.perks[k]], def.desc);
        AudioSys.sfxSoul();
      } else {
        game.addScore(500);
        AudioSys.sfxPickup();
      }
    }
    else if (this.kind === 'roast') {
      player.maxHp += player.perkRank('gourmand');
      player.hp = player.maxHpTotal();
      AudioSys.sfxOrb();
      spawnFloater(this.x + 6, this.y - 6, 'RESTORED', '#ffe080');
      burst(this.x + 6, this.y, ['#ffe080', '#f8f8ff', '#e04858'], 10, 1.2, -0.02);
    }
    else game.giveItem(this.kind, this.x, this.y);
    this.remove = true;
  }
  draw(g, camX, camY) {
    if (this.life < 90 && (this.life & 4)) return;
    if (this.kind === 'relic') {
      const dx = Math.floor(this.x - camX);
      const dy = Math.floor(this.y + (this.grounded ? Math.round(Math.sin(this.t * 0.08)) : 0) - camY);
      const r = this.data || { tier: 1, base: 0 };
      const a = 0.10 + 0.05 * Math.sin(this.t * 0.15);
      g.fillStyle = r.tier >= 3 ? `rgba(192,122,240,${a.toFixed(3)})` :
        r.tier === 2 ? `rgba(216,168,72,${a.toFixed(3)})` : `rgba(184,192,204,${a.toFixed(3)})`;
      g.beginPath(); g.arc(dx + 6, dy + 6, 10, 0, 7); g.fill();
      g.drawImage(relicIcon(r), dx, dy);
      return;
    }
    if (this.isCard) {
      const dx = Math.floor(this.x - camX), dy = Math.floor(this.y + (this.grounded ? Math.round(Math.sin(this.t * 0.08)) : 0) - camY);
      const a = 0.10 + 0.05 * Math.sin(this.t * 0.15);
      g.fillStyle = `rgba(216,168,72,${a.toFixed(3)})`;
      g.beginPath(); g.arc(dx + 6, dy + 8, 11, 0, 7); g.fill();
      g.drawImage(cardIcon(this.kind.slice(5)), dx, dy);
      return;
    }
    const spr = SUBWEAPONS[this.kind] ? SUBWEAPONS[this.kind].icon() :
      this.kind === 'heart' ? Sprites.heart :
      this.kind === 'bigheart' ? Sprites.bigHeart :
      this.kind === 'gem' ? Sprites.gem :
      this.kind === 'orb' ? Sprites.orb :
      this.kind === 'roast' ? Sprites.roast :
      this.kind === 'chest' ? Sprites.chest :
      this.kind === 'key' ? Sprites.key :
      this.kind === 'scroll' ? Sprites.whipItem :
      this.kind === 'elixir' ? Sprites.elixir :
      this.kind === 'whip' ? Sprites.whipItem :
      this.kind === 'tablet' ? Sprites.tablet :
      this.kind.startsWith('weap_') ? weaponIcon(this.kind.slice(5)) :
      Sprites.buffs[this.kind] ? Sprites.buffs[this.kind] : Sprites.soul;
    const bob = this.grounded ? Math.round(Math.sin(this.t * 0.08) * (this.soul ? 2 : 1)) : 0;
    const dx = Math.floor(this.x - camX), dy = Math.floor(this.y + bob - camY);
    if (this.major) {
      const a = 0.10 + 0.05 * Math.sin(this.t * 0.15);
      g.fillStyle = this.soul ? `rgba(90,160,240,${a.toFixed(3)})` : `rgba(216,168,72,${a.toFixed(3)})`;
      g.beginPath(); g.arc(dx + this.w / 2, dy + this.h / 2, 9, 0, 7); g.fill();
    }
    g.drawImage(spr, dx, dy);
  }
}


// victory crystal after boss
class VictoryOrb {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.w = 12; this.h = 12;
    this.t = 0;
  }
  update() {
    this.t++;
    if (this.t % 6 === 0) {
      spawnParticle(this.x + Math.random() * 12, this.y + Math.random() * 12,
        (Math.random() - 0.5) * 0.6, -0.5, ['#50d8e8', '#f8f8ff', '#ffe080'][(Math.random() * 3) | 0], 24, -0.01);
    }
  }
  draw(g, camX, camY) {
    const bob = Math.sin(this.t * 0.06) * 3;
    const dx = Math.floor(this.x - camX), dy = Math.floor(this.y + bob - camY);
    g.fillStyle = 'rgba(80,216,232,0.15)';
    g.beginPath(); g.arc(dx + 6, dy + 6, 10 + Math.sin(this.t * 0.1) * 2, 0, 7); g.fill();
    g.drawImage(Sprites.orb, dx, dy, 12, 12);
  }
}
