// The hunter.

// ---------------------------------------------------------------- player

class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.w = 9; this.h = 27;
    this.vx = 0; this.vy = 0;
    this.facing = 1;
    this.hp = 16; this.maxHp = 16;
    this.hearts = 5;
    this.whipLvl = 1;
    this.weapon = (typeof meta !== 'undefined' && meta.startWeapon) || 'whip';
    this.weapons = { [this.weapon]: true };
    this.materials = {};        // ore struck from the walls
    this.gifts = {};            // what the guardians have left you
    this.level = 1;
    this.xp = 0;
    this.xpNext = xpForLevel(1);
    this.subWeapon = null;
    this.extraJumps = 0;   // wing souls
    this.gaze = false;     // stone gaze soul
    this.throwAnim = 0;
    this.onGround = false;
    this.airJumps = 0;
    this.crouching = false;
    this.whipTimer = -1;
    this.hurtTimer = 0;
    this.invuln = 0;
    this.dashTimer = 0;
    this.dropTimer = 0;
    this.walkAnim = 0;
    this.dead = false;
    this.trail = [];        // afterimages
    this.trailTimer = 0;
    this.idleT = 0;
    this.runPhase = -1;
    this.skidCd = 0;
    this.crouchT = 0;
    this.lastFrame = ['heroIdle', 0];
    this.coyote = 0;
    this.jumpBuf = 0;
    // learned shrine skills
    this.skills = { slide: false, dash: false, wave: false };
    this.slideTimer = 0;
    this.buffs = {};        // short-lived boons: key -> frames left
    this.gems = 0;          // merchant coin
    this.momentumT = 0;
    this.wallDir = 0;       // which way the wall you are clinging to lies
    this.wallT = 0;
    this.slideId = 0;
    this.airDashT = 0;
    this.airDashUses = 0;
    this.chargeT = 0;
    this.windUsed = false;      // Second Wind spent this run
    this.plunging = false;
    this.plungeId = 0;
    // arcana cards (Circle of the Moon style dual set-up)
    this.cards = { mercury: false, mars: false, salamander: false, serpent: false, golem: false };
    this.cardAction = null;
    this.cardAttr = null;
    // relic loadout: three worn slots + satchel
    this.relics = [null, null, null];
    this.bag = [];
    this.keys = 0;
    this.perks = {};          // technique scrolls: key -> rank 1..4
    this.subInfusion = null;  // forge oil applied to sub-weapons
    this.poisonT = 0;
    this.slashCount = 0;      // moon edge counter
  }

  perkRank(k) { return this.perks[k] || 0; }

  // Matching prefixes resonate: each duplicate boosts that prefix's power +50%.
  // Technique scrolls feed the same stat pipeline.
  relicStat(key) {
    let perkN = 0;
    for (const k in this.perks) {
      const def = PERKS[k];
      if (def && def.stat === key) perkN += def.per * this.perks[k];
    }
    const counts = {};
    for (const r of this.relics) if (r) counts[r.pre] = (counts[r.pre] || 0) + 1;
    let n = perkN;
    for (const r of this.relics) {
      if (!r) continue;
      const setMult = 1 + 0.5 * ((counts[r.pre] || 1) - 1);
      n += (RELIC_PREFIX[r.pre].stat[key] || 0) * r.tier * setMult;
      n += (RELIC_SUFFIX[r.suf].stat[key] || 0) * r.tier;
    }
    return Math.round(n);
  }

  relicSetInfo() {
    const counts = {};
    for (const r of this.relics) if (r) counts[r.pre] = (counts[r.pre] || 0) + 1;
    const sets = [];
    for (const pre in counts) {
      if (counts[pre] >= 2) sets.push({ name: RELIC_PREFIX[pre].name, n: counts[pre] });
    }
    return sets;
  }

  maxHpTotal() {
    const curse = (typeof game !== 'undefined' && game.cursed && game.cursed('bloodtax')) ? 4 : 0;
    const lv = 2 * (this.level - 1) + (this.skills.ironheart ? 6 : 0) + this.cardFx('maxhp');
    return Math.max(4, this.maxHp + lv + Math.min(12, this.relicStat('maxHp')) - curse);
  }

  combo(action, attr) { return this.cardAction === action && this.cardAttr === attr; }

  chargeNeed() { return Math.max(12, (this.skills.focus ? 24 : 45) - 5 * this.relicStat('charge')); }

  // Moonlit Plunge: crashing dive attack under the hunter.
  getPlungeHitbox() {
    if (!this.plunging) return null;
    return { x: this.x - 3, y: this.y + this.h - 6, w: this.w + 6, h: 14, dmg: 4 + Math.ceil(this.perkRank('skyfall') / 2) };
  }

  setCrouch(on) {
    if (on === this.crouching) return;
    if (on) {
      this.crouching = true; this.y += 9; this.h = 18;
    } else {
      const ny = this.y - 9;
      let blocked = false;
      for (let sx = 0; sx < 3; sx++) {
        const px = this.x + 1 + sx * (this.w - 2) / 2;
        if (isSolid(tileAt(Math.floor(px / TILE), Math.floor(ny / TILE)))) { blocked = true; break; }
      }
      if (!blocked) { this.crouching = false; this.y = ny; this.h = 27; }
    }
  }

  hitbox() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }

  // Sliding kick hitbox (Hunter Slide skill).
  getSlideHitbox() {
    if (this.slideTimer < 4 || this.slideTimer > 18) return null;
    const x = this.facing > 0 ? this.x + this.w - 3 : this.x - 14;
    return { x, y: this.y + this.h - 12, w: 17, h: 12, dmg: 3 };
  }

  weaponDef() { return WEAPONS[this.weapon] || WEAPONS.whip; }

  // The bound arcana pair, as raw effect data. Everything the cards do
  // flows through here, so a new combo is a data entry and nothing more.
  cardFx(key) {
    if (!this.cardAction || !this.cardAttr) return 0;
    const c = CARD_COMBOS[this.cardAction + '+' + this.cardAttr];
    if (!c || !c[2]) return 0;
    return c[2][key] || 0;
  }

  // Blade arc: a slash box in front of the hunter during the weapon's active frames.
  getWhipHitbox() {
    const wd = this.weaponDef();
    if (this.whipTimer < wd.active[0] || this.whipTimer >= wd.active[1]) return null;
    const reach = wd.len[this.whipLvl] + (this.skills.longarm ? 4 : 0);
    let dmg = wd.dmg[this.whipLvl] + Math.min(4, this.relicStat('dmg'));
    if (this.buffs.fury) dmg *= 2;
    dmg += this.cardFx('dmg');
    if (this.cardFx('riteFire') && this.hearts >= 10) dmg += this.cardFx('riteFire');
    if (this.cardFx('eclipse')) dmg *= 2;
    if (this.skills.lastlight && this.hp <= this.maxHpTotal() * 0.25) dmg += 3;
    dmg += Math.floor((this.level - 1) / 4);                       // the hunt hardens you
    dmg += Math.floor(masteryRank(meta.mastery[this.weapon] || 0) / 2);
    // A chain or a lash does not appear at full stretch — it travels. Scale the
    // reach across the active window so the head of it sweeps outward.
    let reachNow = reach;
    if (wd.travel) {
      const span = Math.max(1, wd.active[1] - wd.active[0]);
      const t = (this.whipTimer - wd.active[0] + 1) / span;
      reachNow = Math.max(6, Math.round(reach * (0.35 + 0.65 * Math.min(1, t * 1.35))));
    }
    const crouch = this.crouching;
    const h = crouch ? wd.crouchH : wd.h;
    const y = crouch ? this.y + this.h - wd.crouchH
      : this.y - 3 + (26 - wd.h) * (wd.short === 'SPEAR' ? 0.5 : 0);
    // a spinning haft cuts on both sides at once
    if (wd.wide) {
      return {
        x: this.x + this.w / 2 - reachNow, y, w: reachNow * 2, h,
        dmg, pierce: wd.pierce, wd,
      };
    }
    const x = this.facing > 0 ? this.x + this.w - 2 : this.x + 2 - reachNow;
    return { x, y, w: reachNow, h, dmg, pierce: wd.pierce, wd };
  }

  switchWeapon(key) {
    if (!WEAPONS[key] || !this.weapons[key] || this.weapon === key) return false;
    this.weapon = key;
    this.whipTimer = -1;
    this.chargeT = 0;
    spawnFloater(this.x + this.w / 2, this.y - 10, WEAPONS[key].short, '#ffe080');
    AudioSys.sfxPickup();
    return true;
  }

  damage(dmg, srcX, src) {
    if (this.invuln > 0 || this.dead) return false;
    const armor = Math.min(3, this.cardFx('armor') + this.relicStat('armor') +
      (this.skills.stalwart ? 1 : 0)) + (this.buffs.stoneskin ? 2 : 0);
    if (armor > 0) dmg = Math.max(1, dmg - armor);
    // the mail answers whoever touched you
    if (src && src !== game.boss && src.hp > 0) {
      if (this.cardFx('rFreeze') && src.frozen !== undefined) {
        src.frozen = Math.max(src.frozen, 60);
        burstRing(this.x + this.w / 2, this.y + 8, '#8ad0f0');
      }
      if (this.cardFx('rPetrify') && src.frozen !== undefined) {
        src.frozen = Math.max(src.frozen, 90);
        burstRing(this.x + this.w / 2, this.y + 8, '#b8c0cc');
      }
      if (this.cardFx('rBurn') && src.burn !== undefined) src.burn = Math.max(src.burn || 0, 120);
      if (this.cardFx('rPoison')) src.poisoned = Math.max(src.poisoned || 0, 200);
      if (this.cardFx('rShock') && src.hurt) src.hurt(2);
      const thorns = this.cardFx('thorns');
      if (thorns && src.hurt) src.hurt(thorns);
    }
    // winter rite: being struck freezes everything within reach
    if (this.cardFx('riteFreeze')) {
      for (const e of game.enemies) {
        if (e.remove || e === game.boss || e.frozen === undefined) continue;
        if (Math.abs(e.x - this.x) < 90) e.frozen = Math.max(e.frozen, 70);
      }
      burstRing(this.x + this.w / 2, this.y + 10, '#8ad0f0');
    }
    // blood mail: pain pays in hearts
    if (this.cardFx('bloodHearts')) {
      this.hearts += this.cardFx('bloodHearts');
      spawnFloater(this.x + this.w / 2, this.y - 16, '+' + this.cardFx('bloodHearts') + ' HEARTS', '#e04858');
    }
    if (typeof game !== 'undefined' && game.cursed && game.cursed('sting')) dmg += 1;
    this.hp -= dmg;
    this.hurtTimer = 18;
    this.invuln = Math.round(70 * (1 + this.cardFx('invuln') + (this.skills.ghostwalk ? 0.3 : 0)));
    this.vx = (this.x + this.w / 2 < srcX ? -1 : 1) * 1.8;
    this.vy = -3;
    if (this.crouching) { this.crouching = false; this.y -= 9; this.h = 27; }
    this.whipTimer = -1;
    bloodBurst(this.x + this.w / 2, this.y + 10, this.vx > 0 ? 1 : -1);
    spawnFloater(this.x + this.w / 2, this.y - 6, '-' + dmg, '#ff6a70');
    AudioSys.sfxHurt();
    this.plunging = false;
    if (this.hp <= 0) {
      if (this.skills.wind && !this.windUsed) {
        // Second Wind: refuse death once per run
        this.windUsed = true;
        this.hp = 1;
        this.invuln = 130;
        spawnFloater(this.x + this.w / 2, this.y - 14, 'SECOND WIND', '#ffe080');
        burstRing(this.x + this.w / 2, this.y + 10, '#ffe080');
        AudioSys.sfxSoul();
      } else {
        this.hp = 0; this.dead = true;
      }
    }
    return true;
  }

  heal(n) { this.hp = Math.min(this.maxHpTotal(), this.hp + n); }

  // Every fiend teaches you something, and teaches your weapon something too.
  gainXp(n) {
    this.xp += n;
    meta.mastery[this.weapon] = (meta.mastery[this.weapon] || 0) + 1;
    const before = masteryRank(meta.mastery[this.weapon] - 1);
    const after = masteryRank(meta.mastery[this.weapon]);
    if (after > before) {
      spawnFloater(this.x + this.w / 2, this.y - 22,
        WEAPONS[this.weapon].short + ': ' + MASTERY_NAME[after], '#8ad0f0');
      AudioSys.sfxItem();
      saveMeta();
    }
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = xpForLevel(this.level);
      this.hp = this.maxHpTotal();
      this.hearts += 3;
      spawnFloater(this.x + this.w / 2, this.y - 14, 'LEVEL ' + this.level, '#ffe080');
      burstRing(this.x + this.w / 2, this.y + this.h / 2, '#ffe080');
      AudioSys.sfxSoul();
      if (typeof game !== 'undefined') {
        game.showCard(Sprites.emblem, 'LEVEL ' + this.level,
          'MAX HEALTH +2   BLADE SHARPENS EVERY 4TH LEVEL');
      }
    }
  }

  giveBuff(key) {
    this.buffs[key] = BUFFS[key].dur;
    spawnFloater(this.x + this.w / 2, this.y - 10, BUFFS[key].name + '!', BUFFS[key].color);
    burstRing(this.x + this.w / 2, this.y + 10, BUFFS[key].color);
    AudioSys.sfxSoul();
  }

  update(input) {
    if (this.dead) return;
    if (this.poisonT > 0) {
      this.poisonT--;
      if (this.poisonT % 70 === 0 && this.hp > 1) {
        this.hp--;
        spawnFloater(this.x + this.w / 2, this.y - 6, '-1', '#5aa04a');
        burst(this.x + this.w / 2, this.y + 8, ['#5aa04a', '#2a5424'], 3, 0.8, 0.04);
      }
    }
    if (this.invuln > 0) this.invuln--;
    for (const bk in this.buffs) if (--this.buffs[bk] <= 0) delete this.buffs[bk];
    if (this.buffs.moonveil) this.invuln = Math.max(this.invuln, 2);
    if (this.momentumT > 0) this.momentumT--;
    if (this.dropTimer > 0) this.dropTimer--;
    if (this.throwAnim > 0) this.throwAnim--;
    if (this.whipTimer >= 0) {
      const wd = this.weaponDef();
      this.whipTimer++;
      if (this.whipTimer === wd.sfxAt) {
        if (wd.sfx === 'roar') AudioSys.sfxRoar(); else AudioSys.sfxWhip();
      }
      if (this.whipTimer >= wd.total) this.whipTimer = -1;
    }

    const controllable = this.hurtTimer <= 0 && this.dashTimer <= 0 && this.slideTimer <= 0;
    if (this.airDashT > 0) this.airDashT--;

    if (this.hurtTimer > 0) {
      this.hurtTimer--;
    } else if (this.dashTimer > 0) {
      this.dashTimer--;
      this.vx = -this.facing * 3;
      if (input.jumpPressed && this.onGround) {
        // back-hop: ride the dash into the air, keeping its speed
        this.dashTimer = 0;
        this.vy = -4.4;
        this.momentumT = 26;
        this.trailTimer = 10;
        AudioSys.sfxJump();
      } else if (this.dashTimer === 0) this.vx = 0;
    } else if (this.slideTimer > 0) {
      this.slideTimer--;
      this.vx = this.facing * 3.2;
      if (input.jumpPressed) {
        this.setCrouch(false);
        if (!this.crouching) {
          // slide-leap: the slide's whole speed goes with you
          this.slideTimer = 0;
          this.vy = -4.6;
          this.momentumT = 26;
          this.trailTimer = 10;
          AudioSys.sfxJump();
        }
      }
      if (this.slideTimer % 4 === 0) dustPuff(this.x + this.w / 2 - this.facing * 6, this.y + this.h, 2);
      if (this.slideTimer === 0) this.vx *= 0.3;
    } else {
      // ground whip locks horizontal movement, air whip doesn't
      const whipLock = this.whipTimer >= 0 && this.onGround;
      this.setCrouch(this.onGround && input.down && !whipLock ? true
        : (this.onGround && input.down ? this.crouching : false));

      let target = 0;
      const spd = RUN_SPEED *
        (1 + 0.05 * Math.min(4, this.relicStat('speed'))) *
        (this.buffs.swiftness ? 1.3 : 1) *
        (1 + this.cardFx('speed') + (this.skills.swiftfoot ? 0.1 : 0));
      if (!this.crouching && !whipLock) {
        if (input.left) { target = -spd; this.facing = -1; }
        if (input.right) { target = spd; this.facing = 1; }
      }
      // weighty acceleration / friction instead of instant velocity
      if (this.skidCd > 0) this.skidCd--;
      if (target !== 0 && Math.sign(this.vx) === -Math.sign(target) &&
          Math.abs(this.vx) > 0.9 && this.onGround && this.skidCd <= 0) {
        dustPuff(this.x + this.w / 2 - this.facing * 3, this.y + this.h, 4);
        this.skidCd = 12;
      }
      // a leap out of a slide or backdash carries its speed through the air
      const flying = this.momentumT > 0 && !this.onGround;
      const accel = !this.onGround ? (flying ? 0.07 : 0.16) : target !== 0 ? 0.24 : 0.34;
      if (flying && target === 0) {
        // no input mid-flight: keep the momentum you earned
      } else if (flying && Math.sign(target) === Math.sign(this.vx) && Math.abs(this.vx) > Math.abs(target)) {
        this.vx -= Math.sign(this.vx) * 0.02;      // bleed off slowly, never snap down
      } else if (target > this.vx) this.vx = Math.min(target, this.vx + accel);
      else if (target < this.vx) this.vx = Math.max(target, this.vx - accel);
      if (target === 0 && !flying && Math.abs(this.vx) < 0.12) this.vx = 0;

      // Moonlit Plunge: attack + down while airborne
      if (input.whipPressed && !this.onGround && input.down && this.skills.plunge &&
          !this.plunging && this.whipTimer < 0) {
        this.plunging = true;
        this.plungeId++;
        this.trailTimer = 14;
        input.whipPressed = false;
        AudioSys.sfxDash();
      }

      // ---- wall cling: catch sheer stone and slide down it slowly
      this.wallDir = 0;
      if (this.skills.wallcling && !this.onGround && this.vy > -0.5) {
        for (const d of [-1, 1]) {
          if (d === 1 ? !input.right : !input.left) continue;
          const ex = d > 0 ? this.x + this.w + 2 : this.x - 2;
          const tx = Math.floor(ex / TILE);
          let touching = 0;
          for (const py of [this.y + 4, this.y + this.h / 2, this.y + this.h - 4]) {
            if (isSolid(tileAt(tx, Math.floor(py / TILE)))) touching++;
          }
          if (touching >= 2) { this.wallDir = d; break; }
        }
      }
      if (this.wallDir) {
        this.wallT++;
        this.vy = Math.min(this.vy, 0.9);          // a slow scrape, not a fall
        this.facing = -this.wallDir;               // you face out from the stone
        this.airJumps = Math.max(this.airJumps, this.skills.walljump ? 1 : 0);
        this.airDashUses = 0;
        if ((this.wallT & 7) === 0) {
          dustPuff(this.x + this.w / 2 + this.wallDir * 6, this.y + this.h - 6, 1);
        }
      } else this.wallT = 0;

      if (input.jumpPressed) this.jumpBuf = 8;
      else if (this.jumpBuf > 0) this.jumpBuf--;
      if ((input.jumpPressed || this.jumpBuf > 0)) {
        if (this.crouching && input.down) {
          if (input.jumpPressed) {
            // drop through the ledge — and swallow the jump, or the buffer and
            // the coyote grace would throw you straight back up again
            this.dropTimer = 12;
            this.jumpBuf = 0;
            this.coyote = 0;
          }
        } else if (this.onGround || this.coyote > 0) {
          this.vy = -(4.75 + 0.12 * Math.min(4, this.relicStat('jump')) + (this.buffs.swiftness ? 0.45 : 0) + (this.skills.highjump ? 0.5 : 0));
          this.onGround = false; this.airJumps = 1 + this.extraJumps;
          this.coyote = 0; this.jumpBuf = 0;
          AudioSys.sfxJump();
        } else if (input.jumpPressed && this.wallDir && this.skills.walljump) {
          // wall leap: off the stone, up and away
          this.vy = -4.6;
          this.vx = -this.wallDir * 2.6;
          this.facing = -this.wallDir;
          this.momentumT = 20;
          this.trailTimer = 10;
          this.wallDir = 0;
          this.jumpBuf = 0;
          AudioSys.sfxJump();
          burst(this.x + this.w / 2, this.y + this.h / 2, ['#cfc7ee', '#8a83c8'], 5, 0.9, 0.02);
        } else if (input.jumpPressed && this.airJumps > 0) {
          this.airJumps--;
          this.vy = -(4.35 + 0.12 * Math.min(4, this.relicStat('jump')) + (this.buffs.swiftness ? 0.45 : 0) + (this.skills.highjump ? 0.5 : 0));
          this.trailTimer = 12;
          AudioSys.sfxJump();
          burst(this.x + this.w / 2, this.y + this.h, ['#8a83c8', '#cfc7ee'], 5, 0.8, 0.02);
        }
      }

      if (input.whipPressed && this.whipTimer < 0) {
        this.whipTimer = 0;
        this.swingPaid = false;
        this.swingId = (this.swingId || 0) + 1;
      }

      if (input.dashPressed && this.whipTimer < 0 && this.dashTimer <= 0 && this.slideTimer <= 0) {
        if (this.onGround && input.down && this.skills.slide) {
          // hunter slide: stays low the whole way through
          this.slideTimer = 20 + 2 * this.perkRank('lowform');
          this.slideId++;
          this.setCrouch(true);
          AudioSys.sfxDash();
        } else if (!this.onGround && this.skills.dash &&
                   this.airDashUses < (this.skills.tempest ? 2 : 1)) {
          this.airDashUses++;
          if (this.skills.veil) {
            // veil step: a blink through the world's skin (never through walls)
            let dist = 0;
            for (let d = 4; d <= 64; d += 4) {
              const nx = this.x + this.facing * d;
              const edge = this.facing > 0 ? nx + this.w : nx;
              const tx = Math.floor(edge / TILE);
              let blocked = false;
              for (const py of [this.y + 2, this.y + this.h / 2, this.y + this.h - 2]) {
                if (isSolid(tileAt(tx, Math.floor(py / TILE)))) { blocked = true; break; }
              }
              if (blocked) break;
              dist = d;
            }
            for (let i = 0; i < 8; i++) {
              burst(this.x + this.w / 2 + this.facing * (dist * i / 8),
                this.y + this.h / 2, ['#d8d0f0', '#8a83c8'], 1, 0.5, 0);
            }
            this.x += this.facing * dist;
            this.vy = Math.min(this.vy, 0.4);
            this.invuln = Math.max(this.invuln, 10);
            this.trailTimer = 10;
            AudioSys.sfxSoul();
          } else {
            // phantom step: air dash
            this.airDashT = 11;
            this.vy = 0;
            this.trailTimer = 12;
            AudioSys.sfxDash();
          }
        } else if (this.onGround && !input.down) {
          this.dashTimer = 14;
          this.invuln = Math.max(this.invuln, 10);
          AudioSys.sfxDash();
        }
      }

      // crescent wave: keep holding attack after a slash, release to unleash
      if (this.skills.wave && input.attackHeld && this.whipTimer < 0 && !this.crouching) {
        this.chargeT++;
        if (this.chargeT === this.chargeNeed()) AudioSys.sfxPickup();
        if (this.chargeT >= this.chargeNeed() && (this.idleT & 3) === 0) {
          spawnParticle(this.x + Math.random() * this.w, this.y + Math.random() * this.h,
            (Math.random() - 0.5) * 0.5, -0.5, '#ffe080', 14, -0.01);
        }
      } else if (!input.attackHeld) {
        if (this.chargeT >= this.chargeNeed() && this.skills.wave && this.whipTimer < 0) {
          {
          const wv = new CrescentWave(
            this.x + this.w / 2 + this.facing * 8, this.y + 12, this.facing);
          wv.dmg += Math.ceil(this.perkRank('moonlight') / 2);
          game.projectiles.push(wv);
        }
          this.throwAnim = 12;
          AudioSys.sfxWhip();
        }
        this.chargeT = 0;
      }
    }

    if (this.airDashT > 0) {
      this.vy = 0;
      this.vx = this.facing * 4.5;
    } else if (this.plunging) {
      this.vy = 6;
      this.vx *= 0.9;
    } else {
      this.vy = Math.min(this.vy + GRAV, MAX_FALL);
    }

    const wasGround = this.onGround;
    const preVy = this.vy;
    const res = moveActor(this, this.vx, this.vy);
    // a landing you can feel: the harder the fall, the heavier the arrival
    if (res.onGround && !wasGround) {
      const force = Math.min(1, Math.max(0, (preVy - 3.2) / 5));
      if (force > 0.02) {
        dustPuff(this.x + this.w / 2, this.y + this.h, 3 + Math.round(force * 7));
        game.addShake(1 + force * 4);
        if (force > 0.6) game.hitstop = Math.max(game.hitstop, 2);
        if (force > 0.35) AudioSys.sfxDash();
      }
    }
    this.onGround = res.onGround;
    if (this.onGround) {
      this.airJumps = 1 + this.extraJumps; this.airDashUses = 0;
      this.coyote = 7 + 2 * this.perkRank('surefoot');
      if (this.plunging) {
        // cracked masonry gives way beneath a plunge
        const fy = Math.floor((this.y + this.h + 2) / TILE);
        let broke = false;
        for (const fx of [Math.floor((this.x + 1) / TILE), Math.floor((this.x + this.w - 1) / TILE)]) {
          if (tileAt(fx, fy) === 11) {
            tset(fx, fy, 0);
            burst(fx * TILE + 8, fy * TILE + 8, ['#52526e', '#8f8c9e', '#3e3e58'], 14, 1.8, 0.08);
            broke = true;
          }
        }
        if (broke) {
          game.addShake(4);
          AudioSys.sfxCandle();
          spawnFloater(this.x + this.w / 2, this.y - 8, 'SHATTERED', '#ffe080');
          this.onGround = false;
          this.vy = 1.5;
        } else {
          this.plunging = false;
          dustPuff(this.x - 2, this.y + this.h, 4);
          dustPuff(this.x + this.w + 2, this.y + this.h, 4);
          game.addShake(2);
          AudioSys.sfxHit();
        }
        if (broke) this.plunging = false;
      }
    }
    else if (this.coyote > 0) this.coyote--;
    if (res.hitWall && this.airDashT > 0) this.airDashT = 0;
    if (res.hitWall && this.dashTimer > 0) this.dashTimer = 0;

    if (res.onSpike) this.damage(this.skills.ember && res.onFire ? 0 : 4,
      this.x + this.w / 2 + this.facing);

    // Standing water and old blood (tile 15). It pulls at your legs and drinks
    // from you, until a guardian gives you the breath to walk it.
    {
      const fx = Math.floor((this.x + this.w / 2) / TILE);
      const fy = Math.floor((this.y + this.h - 3) / TILE);
      this.inFlood = tileAt(fx, fy) === 15;
      if (this.inFlood && !this.skills.tide) {
        this.vx *= 0.62;
        if (this.vy > 1.4) this.vy = 1.4;
        this.floodT = (this.floodT || 0) + 1;
        if (this.floodT % 40 === 0) {
          this.damage(1, this.x + this.w / 2);
          burst(this.x + this.w / 2, this.y + this.h - 2, ['#8a2030', '#4a5a70'], 4, 0.7, 0.02);
        }
      } else if (this.inFlood && this.skills.swim) {
        // the drowned breath makes it a road rather than a trap
        if (this.vy > 0.9) this.vy = 0.9;
        if (keys.up) this.vy = -1.1;
        this.floodT = 0;
      } else {
        this.floodT = 0;
      }
    }

    if (!wasGround && this.onGround && preVy > 3) {
      dustPuff(this.x + this.w / 2, this.y + this.h, 5);
    }

    // animation distance accumulator: feet sync to ground actually covered
    if (controllable && Math.abs(this.vx) > 0.05 && this.onGround) {
      this.walkAnim += Math.abs(this.vx);
      const phase = ((this.walkAnim / 6) | 0) % 6;
      if ((phase === 0 || phase === 3) && phase !== this.runPhase) {
        dustPuff(this.x + this.w / 2 - this.facing * 4, this.y + this.h, 2);
      }
      this.runPhase = phase;
    } else if (this.onGround) { this.walkAnim = 0; this.runPhase = -1; }

    // afterimage trail during backdash / double jump
    this.idleT++;
    this.crouchT = this.crouching ? this.crouchT + 1 : 0;
    if (this.trailTimer > 0) this.trailTimer--;
    if ((this.dashTimer > 0 || this.trailTimer > 0) && (this.idleT & 1)) {
      const [sheet, f] = this.currentFrame();
      this.trail.push({
        x: this.x + this.w / 2, y: this.y + this.h,
        facing: this.facing, t: 0, sheet, f,
      });
      if (this.trail.length > 5) this.trail.shift();
    }
    for (let i = this.trail.length - 1; i >= 0; i--) {
      if (++this.trail[i].t > 12) this.trail.splice(i, 1);
    }
  }

  // Select the current animation sheet + frame from state.
  currentFrame() {
    const t = this.whipTimer;
    // stretch the six swing frames across however long this weapon takes
    const total = this.weaponDef().total;
    const attackFrame = tt => Math.min(5, Math.floor(tt / total * 6));
    if (this.hurtTimer > 0) {
      return ['heroHurt', Math.min(2, 2 - ((this.hurtTimer / 7) | 0))];
    }
    if (this.plunging) return ['heroJumpAttack', 3];
    if (this.dashTimer > 0) return ['heroHurt', 0];
    if (this.slideTimer > 0) return ['heroCrouchSlash', 2];
    if (this.airDashT > 0) return ['heroJump', 2];
    if (this.crouching) {
      if (t >= 0) {
        return ['heroCrouchSlash', Math.min(3, Math.floor(t / this.weaponDef().total * 4))];
      }
      return ['heroCrouch', Math.min(2, (this.crouchT / 5) | 0)];
    }
    if (!this.onGround) {
      if (t >= 0 || this.throwAnim > 0) {
        return ['heroJumpAttack', t >= 0 ? attackFrame(t) : 4];
      }
      const vy = this.vy;
      const f = vy < -2.5 ? 1 : vy < -0.5 ? 2 : vy < 1.5 ? 3 : 4;
      return ['heroJump', f];
    }
    if (t >= 0 || this.throwAnim > 0) {
      return ['heroAttack', t >= 0 ? attackFrame(t) : 4];
    }
    if (Math.abs(this.vx) > 0.2) {
      return ['heroRun', ((this.walkAnim / 5) | 0) % 12];
    }
    return ['heroIdle', ((this.idleT >> 4) & 3)];
  }

  draw(g, camX, camY) {
    if (this.dead) return;
    const flash = this.invuln > 0 && ((this.invuln >> 2) & 1) === 0 && this.hurtTimer > 0;
    const blink = this.invuln > 0 && this.hurtTimer <= 0 && ((this.invuln >> 2) & 1) === 0;

    // afterimages (drawn even while blinking)
    for (const tr of this.trail) {
      g.globalAlpha = 0.30 * (1 - tr.t / 12);
      drawSheetFrame(g, Sheets[tr.sheet], tr.f, tr.x - camX, tr.y - camY, tr.facing < 0, true);
    }
    g.globalAlpha = 1;
    if (blink) return;

    const [sheetKey, f] = this.currentFrame();
    const ax = this.x + this.w / 2 - camX;
    const ay = this.y + this.h - camY;
    drawSheetFrame(g, Sheets[sheetKey], f, ax, ay, this.facing < 0, flash);
    this.lastFrame = [sheetKey, f];

    // charged wave ready: golden aura
    if (this.chargeT >= this.chargeNeed()) {
      g.fillStyle = `rgba(255,215,110,${(0.10 + 0.05 * Math.sin(this.idleT * 0.3)).toFixed(3)})`;
      g.beginPath();
      g.arc(Math.floor(ax), Math.floor(ay - this.h / 2), 22, 0, 7);
      g.fill();
    }

    // ---- the weapon itself, in hand. Each one is a different silhouette, at
    // rest and through the blow, so you can see what you are carrying.
    const wd = this.weaponDef();
    const hb = this.getWhipHitbox();
    const rgb = hexRgb(wd.color);
    const cx2 = this.x + this.w / 2 - camX;
    const cy2 = this.y + this.h / 2 - camY - (this.crouching ? 2 : 4);

    // where the hands are: forward and slightly high, or trailing at rest
    const swinging = hb !== null || (this.whipTimer >= 0 && this.whipTimer < wd.total);
    const k = swinging && this.whipTimer >= 0
      ? Math.max(0, Math.min(1, (this.whipTimer - wd.active[0]) / Math.max(1, wd.active[1] - wd.active[0])))
      : 0;

    // the arc the weapon travels for this kind of arm
    const ARC = {
      WHIP: [-0.85, 0.95], SWORD: [-1.0, 0.75], AXE: [-1.45, 1.0],
      SCYTHE: [-1.3, 0.9], CENSER: [-1.1, 1.1], CLAWS: [-0.6, 0.5], SPEAR: [0, 0],
    };
    const arc = ARC[wd.short] || ARC.WHIP;
    const ang = swinging ? arc[0] + (arc[1] - arc[0]) * k : -0.55;
    const reach = (wd.len[this.whipLvl] || 20) * (swinging ? (0.55 + 0.45 * k) : 0.42);
    const hx = cx2 + this.facing * 5, hy = cy2 + (swinging ? 0 : 3);
    const tipX = hx + Math.cos(ang) * reach * this.facing;
    const tipY = hy + Math.sin(ang) * reach * 0.75;

    const solid = (x0, y0, x1, y1, w2, col) => {
      // a thick line, drawn as a run of squares — no rotation needed
      const steps = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 2));
      g.fillStyle = col;
      for (let i = 0; i <= steps; i++) {
        const t2 = i / steps;
        g.fillRect(Math.round(x0 + (x1 - x0) * t2 - w2 / 2),
          Math.round(y0 + (y1 - y0) * t2 - w2 / 2), w2, w2);
      }
    };

    if (wd.short === 'WHIP') {
      // a length of barbed cord, sagging when idle, snapping straight in the blow
      const seg = 7;
      let px2 = hx, py2 = hy;
      for (let i = 1; i <= seg; i++) {
        const t2 = i / seg;
        const sag = swinging ? 0 : Math.sin(t2 * Math.PI) * 5;
        const nx = hx + (tipX - hx) * t2;
        const ny = hy + (tipY - hy) * t2 + sag;
        g.fillStyle = i === seg ? '#d8a848' : `rgba(${rgb},${(0.85 - t2 * 0.25).toFixed(2)})`;
        g.fillRect(Math.round(nx) - 1, Math.round(ny) - 1, 2, 2);
        px2 = nx; py2 = ny;
      }
    } else if (wd.short === 'SPEAR') {
      // a long haft thrust straight out
      const ext = swinging ? (0.4 + 0.6 * Math.sin(Math.min(1, k) * Math.PI)) : 0.5;
      const len = (wd.len[this.whipLvl] || 30) * ext;
      const ex = hx + this.facing * len, ey = hy - (swinging ? 0 : 4);
      solid(hx - this.facing * 6, ey + 2, ex, ey, 2, '#7a5a3a');
      g.fillStyle = '#d8d0b0';
      g.fillRect(Math.round(ex) - 2, Math.round(ey) - 2, 5, 4);
      g.fillStyle = '#f8f8ff';
      g.fillRect(Math.round(ex) + (this.facing > 0 ? 2 : -2), Math.round(ey) - 1, 2, 2);
    } else if (wd.short === 'CLAWS') {
      // three short blades off the fist
      for (let i = -1; i <= 1; i++) {
        const a2 = ang + i * 0.28;
        const ex = hx + Math.cos(a2) * reach * 0.8 * this.facing;
        const ey = hy + Math.sin(a2) * reach * 0.6;
        solid(hx, hy, ex, ey, 2, `rgba(${rgb},0.95)`);
      }
    } else if (wd.short === 'AXE' || wd.short === 'SCYTHE') {
      // a long haft with a heavy head at the end
      solid(hx - this.facing * 5, hy + 4, tipX, tipY, 2, '#6a4a2a');
      const hw = wd.short === 'AXE' ? 6 : 8;
      const nx2 = Math.cos(ang + 1.57) * hw * this.facing, ny2 = Math.sin(ang + 1.57) * hw * 0.75;
      solid(tipX - nx2 * 0.5, tipY - ny2 * 0.5, tipX + nx2 * 0.5, tipY + ny2 * 0.5,
        wd.short === 'AXE' ? 4 : 3, `rgba(${rgb},0.95)`);
      if (wd.short === 'SCYTHE') {
        // the curve of the blade, trailing back along the arc
        for (let i = 1; i <= 3; i++) {
          const a2 = ang - i * 0.3;
          const ex = tipX + Math.cos(a2) * i * 3 * this.facing;
          const ey = tipY + Math.sin(a2) * i * 2.2;
          g.fillStyle = `rgba(${rgb},${(0.9 - i * 0.15).toFixed(2)})`;
          g.fillRect(Math.round(ex) - 1, Math.round(ey) - 1, 3, 3);
        }
      }
    } else if (wd.short === 'CENSER') {
      // a chain with a burning brazier on the end
      solid(hx, hy, tipX, tipY, 1, '#5c5678');
      g.fillStyle = '#3c3448';
      g.fillRect(Math.round(tipX) - 4, Math.round(tipY) - 3, 8, 7);
      g.fillStyle = '#d8a848';
      g.fillRect(Math.round(tipX) - 4, Math.round(tipY) - 4, 8, 2);
      const flick = (game.time >> 2) & 1;
      g.fillStyle = flick ? '#ff9020' : '#ffd858';
      g.fillRect(Math.round(tipX) - 2, Math.round(tipY) - 7, 4, 4);
      g.fillStyle = '#ffe080';
      g.fillRect(Math.round(tipX) - 1, Math.round(tipY) - 9, 2, 2);
      if ((game.time & 7) === 0) {
        spawnParticle(tipX + camX, tipY + camY - 8, (Math.random() - 0.5) * 0.3, -0.7,
          '#ff9020', 18, -0.01);
      }
    } else {
      // sword: a straight blade with a crossguard
      solid(hx, hy, tipX, tipY, 3, `rgba(${rgb},0.95)`);
      const gx2 = hx + (tipX - hx) * 0.18, gy2 = hy + (tipY - hy) * 0.18;
      const nx2 = Math.cos(ang + 1.57) * 4 * this.facing, ny2 = Math.sin(ang + 1.57) * 4;
      solid(gx2 - nx2, gy2 - ny2, gx2 + nx2, gy2 + ny2, 2, '#d8a848');
      g.fillStyle = '#f8f8ff';
      g.fillRect(Math.round(tipX) - 1, Math.round(tipY) - 1, 2, 2);
    }

    // ---- and the air it cuts, trailing behind the blow
    if (hb) {
      const span = Math.max(1, wd.active[1] - wd.active[0]);
      const kk = (this.whipTimer - wd.active[0]) / span;
      const sweep = (from, to, radius, dots, size, flat) => {
        const lead = from + (to - from) * kk;
        for (let i = 0; i < dots; i++) {
          const back = i / dots;
          const a2 = lead - (to - from) * back * 0.42;
          const r = radius * (0.72 + 0.28 * (1 - back));
          const alpha = 0.15 * (1 - back * 0.85) * (1 - kk * 0.35);
          if (alpha <= 0.02) continue;
          g.fillStyle = `rgba(${rgb},${alpha.toFixed(3)})`;
          g.fillRect(Math.round(cx2 + Math.cos(a2) * r * this.facing - size / 2),
            Math.round(cy2 + Math.sin(a2) * r * flat - size / 2), size, size);
        }
      };
      if (wd.short === 'SPEAR') {
        const ext = Math.sin(Math.min(1, kk) * Math.PI);
        const len = Math.round(hb.w * (0.35 + 0.65 * ext));
        const bx = this.facing > 0 ? cx2 + 4 : cx2 - 4 - len;
        g.fillStyle = `rgba(${rgb},${(0.18 * (1 - kk * 0.3)).toFixed(3)})`;
        g.fillRect(Math.round(bx), Math.round(cy2 - 1), len, 2);
      } else if (wd.short === 'CLAWS') {
        for (let i = 0; i < 3; i++) {
          const oy = -7 + i * 7;
          const w2 = Math.round(hb.w * (0.45 + 0.55 * kk));
          const bx = this.facing > 0 ? cx2 + 3 : cx2 - 3 - w2;
          g.fillStyle = `rgba(${rgb},${(0.20 * (1 - kk * 0.4)).toFixed(3)})`;
          g.fillRect(Math.round(bx), Math.round(cy2 + oy + kk * 5), w2, 2);
        }
      } else {
        const a3 = ARC[wd.short] || ARC.WHIP;
        sweep(a3[0], a3[1], hb.w * 0.82, 6, 2, 0.8);
      }
      // a bright mote at the tip on tempered steel
      if (this.whipLvl >= 2) {
        const tipX = this.facing > 0 ? hb.x + hb.w - 4 : hb.x + 2;
        g.fillStyle = this.whipLvl >= 3 ? 'rgba(255,224,128,0.65)' : 'rgba(248,248,255,0.5)';
        g.fillRect(Math.floor(tipX - camX), Math.floor(hb.y + hb.h / 2 - camY) - 2, 4, 4);
      }
    }
  }
}

