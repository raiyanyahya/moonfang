// HUD, menus, and title drawing.

function goldFrame(g, x, y, w, h) {
  g.fillStyle = '#8a6d2f';
  g.fillRect(x, y, w, 1); g.fillRect(x, y + h - 1, w, 1);
  g.fillRect(x, y, 1, h); g.fillRect(x + w - 1, y, 1, h);
  g.fillStyle = '#d8a848';
  g.fillRect(x, y, 2, 2); g.fillRect(x + w - 2, y, 2, 2);
  g.fillRect(x, y + h - 2, 2, 2); g.fillRect(x + w - 2, y + h - 2, 2, 2);
}

function drawHUD(g) {
  const p = game.player;

  // ---- the hunter's plate. One grid, four rows, nothing overlapping anything.
  const PX = 2, PY = 2, PW = 176, PH = 48;      // the plate
  const CX = 32;                                 // where the text column starts
  const R1 = 5, R2 = 16, R3 = 27, R4 = 38;       // row baselines

  g.fillStyle = 'rgba(8,6,15,0.62)';
  g.fillRect(PX, PY, PW, PH);
  goldFrame(g, PX, PY, PW, PH);
  g.drawImage(Sheets.heroIdle.R, 10, 8, 20, 20, PX + 3, PY + 5, 20, 20);
  g.fillStyle = '#8a6d2f';
  g.fillRect(PX + 26, PY + 4, 1, PH - 8);

  // row 1 — name and health
  drawTextShadow(g, 'PLAYER', CX, R1, '#cfc7ee', 1);
  {
    const bx = CX + 28, bw = PW - (bx - PX) - 8;
    g.fillStyle = '#0a0812'; g.fillRect(bx, R1, bw, 7);
    g.fillStyle = '#3a3448'; g.fillRect(bx + 1, R1 + 1, bw - 2, 5);
    const hpw = Math.max(0, Math.round((bw - 2) * p.hp / p.maxHpTotal()));
    g.fillStyle = '#c92c38'; g.fillRect(bx + 1, R1 + 1, hpw, 5);
    g.fillStyle = '#ff6a70'; g.fillRect(bx + 1, R1 + 1, hpw, 1);
    g.fillStyle = '#d8a848';
    g.fillRect(bx - 1, R1 + 2, 1, 3); g.fillRect(bx + bw, R1 + 2, 1, 3);
  }

  // row 2 — what you carry. Each cell has its own slot, so nothing shifts.
  {
    let cx = CX;
    const cell = (icon, text, colour, w) => {
      if (icon) g.drawImage(icon, cx, R2 - 1);
      drawTextShadow(g, text, cx + (icon ? 11 : 0), R2, colour, 1);
      cx += w;
    };
    cell(Sprites.heart, 'x' + String(p.hearts).padStart(2, '0'), '#cfc7ee', 34);
    cell(Sprites.key, 'x' + (p.keys || 0), p.keys > 0 ? '#ffe080' : '#4a4658', 30);
    cell(Sprites.gem, 'x' + (p.gems || 0), p.gems > 0 ? '#c060e0' : '#4a4658', 34);
    // essence keeps its little sigil rather than a sprite
    g.fillStyle = '#c07af0';
    g.fillRect(cx + 2, R2 + 1, 2, 2); g.fillRect(cx + 1, R2 + 2, 1, 1);
    g.fillRect(cx + 4, R2 + 2, 1, 1); g.fillRect(cx + 2, R2 + 3, 2, 1);
    drawTextShadow(g, String(meta.essence).padStart(3, '0'), cx + 9, R2, '#c07af0', 1);
  }

  // row 3 — the hunt hardens you: level, progress, weapon mastery
  {
    drawTextShadow(g, 'LV' + p.level, CX, R3, '#ffe080', 1);
    const bx = CX + 22, bw = 54;
    g.fillStyle = '#2a2438'; g.fillRect(bx, R3 + 2, bw, 3);
    const frac = Math.max(0, Math.min(1, p.xp / Math.max(1, p.xpNext)));
    g.fillStyle = '#8ad0f0'; g.fillRect(bx, R3 + 2, Math.round(bw * frac), 3);
    const mr = masteryRank(meta.mastery[p.weapon] || 0);
    for (let i = 0; i < 5; i++) {
      g.fillStyle = i < mr ? '#8ad0f0' : '#2a2438';
      g.fillRect(bx + bw + 6 + i * 5, R3 + 1, 3, 4);
    }
  }

  // row 4 — the weapon in hand, how far it is tempered, and the souls you hold
  {
    const wd = p.weaponDef ? p.weaponDef() : WEAPONS.whip;
    drawTextShadow(g, wd.short, CX, R4, '#c8a860', 1);
    const bx = CX + 40;
    for (let i = 0; i < 3; i++) {
      g.fillStyle = '#0a0812'; g.fillRect(bx + i * 8, R4, 7, 5);
      g.fillStyle = i < p.whipLvl ? '#d8a848' : '#3a3448';
      g.fillRect(bx + i * 8 + 1, R4 + 1, 5, 3);
    }
    let ix = bx + 30;
    if (p.extraJumps > 0) { g.drawImage(Sprites.iconWing, ix, R4 - 1); ix += 11; }
    if (p.maxHp > 16) { g.drawImage(Sprites.iconVessel, ix, R4 - 1); ix += 11; }
    if (p.gaze) { g.drawImage(Sprites.iconEye, ix, R4 - 1); ix += 11; }
  }

  // ---- the kit, on its own shelf under the plate
  {
    const owned = WEAPON_KEYS.filter(k => p.weapons && p.weapons[k]);
    if (owned.length > 1) {
      owned.forEach((k, i) => {
        const bx = PX + i * 13;
        const cur = k === p.weapon;
        g.fillStyle = cur ? 'rgba(216,168,72,0.30)' : 'rgba(8,6,15,0.62)';
        g.fillRect(bx, PY + PH + 2, 12, 14);
        if (cur) goldFrame(g, bx, PY + PH + 2, 12, 14);
        const ic = weaponIcon(k);
        if (ic) g.drawImage(ic, bx + Math.floor((12 - ic.width) / 2), PY + PH + 2);
        drawTextShadow(g, String(i + 1), bx + 4, PY + PH + 11, cur ? '#ffe080' : '#5c5678', 1);
      });
    }
  }

  // ---- sub-weapon and bound arcana, to the right of the plate
  const SX = PX + PW + 4;
  g.fillStyle = 'rgba(8,6,15,0.62)';
  g.fillRect(SX, PY, 22, 24);
  goldFrame(g, SX, PY, 22, 24);
  if (p.subWeapon) {
    if (p.subInfusion) {
      g.fillStyle = INFUSIONS[p.subInfusion].color + '44';
      g.fillRect(SX + 1, PY + 1, 20, 22);
    }
    const icon = SUBWEAPONS[p.subWeapon].icon();
    const cost = Math.max(1, SUBWEAPONS[p.subWeapon].cost - Math.min(2, Math.ceil(p.perkRank('thrift') / 2)));
    if (p.hearts < cost) g.globalAlpha = 0.35;
    g.drawImage(icon, SX + Math.floor((22 - icon.width) / 2), PY + 4);
    g.globalAlpha = 1;
    drawTextShadow(g, 'x' + cost, SX + 6, PY + 17, p.hearts < cost ? '#5c5678' : '#cfc7ee', 1);
  }
  const AX = SX + 26;
  g.fillStyle = 'rgba(8,6,15,0.62)';
  g.fillRect(AX, PY, 34, 24);
  goldFrame(g, AX, PY, 34, 24);
  if (p.cardAction) g.drawImage(cardIcon(p.cardAction), AX + 3, PY + 4);
  if (p.cardAttr) g.drawImage(cardIcon(p.cardAttr), AX + 18, PY + 4);

  const sc = String(game.score).padStart(6, '0');
  drawTextShadow(g, sc, VIEW_W - 4 - textWidth(sc, 1), 5, '#cfc7ee', 1);
  g.fillStyle = '#8a6d2f';
  g.fillRect(VIEW_W - 4 - textWidth(sc, 1), 12, textWidth(sc, 1), 1);

  // rush shows the clock; the hunt shows the road
  if (game.mode === 'rush') {
    drawTextCentered(g, fmtTime(game.rushT) + '   GUARDIAN ' + Math.min(3, game.rushIndex + 1) + '/3',
      VIEW_W / 2, 6, '#ffe080', 1);
    return;
  }
  drawTextShadow(g, 'S' + game.stage, VIEW_W / 2 - 70, 4, '#c8a860', 1);
  const pw = 110, px0 = (VIEW_W - pw) / 2;
  g.fillStyle = 'rgba(8,6,15,0.6)'; g.fillRect(px0 - 2, 4, pw + 8, 6);
  g.fillStyle = '#3a3448'; g.fillRect(px0, 6, pw, 2);
  const frac = Math.max(0, Math.min(1, p.x / (Level.boss.homeX)));
  g.fillStyle = '#8a6d2f'; g.fillRect(px0, 6, Math.round(pw * frac), 2);
  g.fillStyle = '#e8e4d8'; g.fillRect(px0 + Math.round(pw * frac) - 1, 4, 2, 6);
  g.fillStyle = '#8a2ce0'; g.fillRect(px0 + pw + 2, 4, 4, 5);

  if (game.volToastT > 0) {
    game.volToastT--;
    drawTextShadow(g, 'VOL ' + Math.round(game.volVal * 100),
      VIEW_W - 40, 16, '#8a83a8', 1);
  }

  // kill combo
  if (game.combo.n >= 3) {
    const flash = (game.time >> 3) & 1 ? '#ffe080' : '#f0ead8';
    drawTextCentered(g, 'COMBO x' + game.comboMult(), VIEW_W / 2, 14, flash, 1);
  }

  // active boons, counting down along the left edge
  {
    let by = 70;   // clear of the plate and the weapon shelf
    for (const bk in p.buffs) {
      const def = BUFFS[bk];
      const left = p.buffs[bk];
      const frac = Math.max(0, Math.min(1, left / def.dur));
      const blink = left < 90 && ((game.time >> 2) & 1);
      g.fillStyle = 'rgba(8,6,15,0.62)';
      g.fillRect(6, by, 74, 13);
      if (Sprites.buffs[bk]) g.drawImage(Sprites.buffs[bk], 8, by + 2);
      drawTextShadow(g, def.name, 20, by + 3, blink ? '#f8f8ff' : def.color, 1);
      g.fillStyle = '#2a2438';
      g.fillRect(8, by + 10, 68, 2);
      g.fillStyle = def.color;
      g.fillRect(8, by + 10, Math.round(68 * frac), 2);
      by += 16;
    }
  }

  // ore in the satchel, when you carry any
  {
    const carried = MATERIAL_KEYS.filter(k => (p.materials[k] || 0) > 0);
    if (carried.length) {
      const oy = VIEW_H - 14;
      let mx = VIEW_W - 8;
      for (let i = carried.length - 1; i >= 0; i--) {
        const mk = carried[i], md = MATERIALS[mk];
        const label = (p.materials[mk] || 0) + '';
        mx -= textWidth(label, 1) + 10;
        g.fillStyle = md.color;
        g.fillRect(mx, oy + 1, 4, 4);
        drawTextShadow(g, label, mx + 6, oy, '#cfc7ee', 1);
      }
      drawTextShadow(g, 'ORE', mx - 22, oy, '#5c5678', 1);
    }
  }

  // prompts for things worth standing next to
  if (game.state === 'play' && !game.bossActive) {
    let prompt = null;
    if (game.nearShrine) prompt = 'UP  PRAY';
    else if (game.nearForge) prompt = 'UP  RELICS    Q  CRAFT';
    else if (game.nearMerchant) prompt = 'UP  TRADE';
    else if (game.nearObelisk) prompt = 'UP  REST';
    if (prompt && ((game.time >> 4) & 1)) {
      drawTextCentered(g, prompt, VIEW_W / 2, VIEW_H - 40, '#ffe080', 1);
    }
  }

  // a deed earned: a quiet gold banner
  if (game.featQueue.length) {
    game.featT++;
    const k = game.featQueue[0];
    const f = FEATS[k];
    const t = game.featT;
    const slide = t < 12 ? (12 - t) * 6 : t > 150 ? (t - 150) * 6 : 0;
    const bw2 = 210, bx2 = VIEW_W - bw2 - 8 + slide;
    g.fillStyle = 'rgba(8,6,15,0.9)';
    g.fillRect(bx2, 42, bw2, 26);
    goldFrame(g, bx2, 42, bw2, 26);
    g.drawImage(Sprites.emblem, bx2 + 6, 48);
    drawTextShadow(g, 'DEED: ' + f.name, bx2 + 22, 47, '#ffe080', 1);
    drawTextShadow(g, f.desc, bx2 + 22, 57, '#8a83a8', 1);
    if (t > 170) { game.featQueue.shift(); game.featT = 0; }
  }

  if (game.bossActive && !game.boss.dead) {
    const bossName = game.boss.bossName || 'VESPERTILIO';
    const enraged = game.boss.enraged;
    const pct = Math.max(0, game.boss.hp / game.boss.maxHp);
    const phase = game.boss.phaseFor ? game.boss.phaseFor() : (game.boss.phase || 1);
    // boss name with phase indicator
    const nameStr = bossName + (phase > 1 ? '    PHASE ' + phase : '');
    const nameColor = enraged ? '#ff6a60' : '#e08a8a';
    drawTextCentered(g, nameStr, VIEW_W / 2, VIEW_H - 23, nameColor, 1);
    const bx = VIEW_W / 2 - 62;
    // wider, more dramatic HP bar with phase segments
    g.fillStyle = 'rgba(8,6,15,0.68)'; g.fillRect(bx, VIEW_H - 14, 124, 13);
    goldFrame(g, bx, VIEW_H - 14, 124, 13);
    g.fillStyle = '#1a1428'; g.fillRect(bx + 2, VIEW_H - 12, 120, 9);
    // phase separator lines
    if (phase >= 2) {
      g.fillStyle = '#3a3048';
      g.fillRect(bx + 2 + Math.round(120 / 3), VIEW_H - 12, 1, 9);
      if (phase >= 3) g.fillRect(bx + 2 + Math.round(120 * 2 / 3), VIEW_H - 12, 1, 9);
    }
    const bw = Math.max(0, Math.round(120 * pct));
    // gradient bar: deep purple to bright, or red when enraged
    const barBase = enraged ? '#c02030' : '#8a2ce0';
    const barHi = enraged ? '#ff4040' : '#c07af0';
    g.fillStyle = barBase; g.fillRect(bx + 2, VIEW_H - 12, bw, 9);
    // top highlight strip
    g.fillStyle = barHi + '80';
    g.fillRect(bx + 2, VIEW_H - 12, bw, 3);
    // secondary highlight
    g.fillStyle = barHi;
    g.fillRect(bx + 2, VIEW_H - 12, bw, 1);
    // enraged pulse
    if (enraged) {
      const pulse = 0.10 + 0.05 * Math.sin(game.time * 0.2);
      g.fillStyle = 'rgba(255,60,50,' + pulse.toFixed(3) + ')';
      g.fillRect(bx, VIEW_H - 14, 124, 13);
    }
  }
}

function drawCard(g) {
  const c = game.card;
  if (!c) return;
  if (c.t < 14 && (c.t & 2)) return;   // blink out
  const w = 152, x = (VIEW_W - 152) >> 1;
  const slide = Math.min(1, (150 - c.t) / 7);
  const y = 40 - Math.round((1 - slide) * 46);
  g.fillStyle = 'rgba(8,6,15,0.88)';
  g.fillRect(x, y, w, 27);
  goldFrame(g, x, y, w, 27);
  g.drawImage(c.icon,
    x + 5 + Math.floor((14 - c.icon.width) / 2),
    y + Math.floor((27 - c.icon.height) / 2));
  drawTextShadow(g, c.title, x + 24, y + 6, '#ffe080', 1);
  drawTextShadow(g, c.desc, x + 24, y + 16, '#8a83a8', 1);
}

// Keep the selected row inside a window of `vis` rows, and remember where the
// list was scrolled so it doesn't jump about as you move.
const scrollState = {};
function scrollWindow(id, sel, count, vis) {
  if (count <= vis) { scrollState[id] = 0; return 0; }
  let top = scrollState[id] || 0;
  if (sel < top) top = sel;
  if (sel >= top + vis) top = sel - vis + 1;
  top = Math.max(0, Math.min(count - vis, top));
  scrollState[id] = top;
  return top;
}

function drawScrollBar(g, x, y, h, top, vis, count) {
  if (count <= vis) return;
  g.fillStyle = '#1a1628';
  g.fillRect(x, y, 3, h);
  const kh = Math.max(8, Math.round(h * vis / count));
  const ky = y + Math.round((h - kh) * top / (count - vis));
  g.fillStyle = '#8a6d2f';
  g.fillRect(x, ky, 3, kh);
  g.fillStyle = '#d8a848';
  g.fillRect(x, ky, 3, 2);
}

function drawShrineMenu(g) {
  const vis = 9;
  const w = 320, h = 46 + vis * 21 + 26, x = (VIEW_W - w) >> 1, y = ((VIEW_H - h) >> 1) - 4;
  g.fillStyle = 'rgba(8,6,15,0.5)';
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  g.fillStyle = 'rgba(8,6,15,0.92)';
  g.fillRect(x, y, w, h);
  goldFrame(g, x, y, w, h);
  g.drawImage(Sprites.emblem, x + w / 2 - 6, y + 5);
  drawTextCentered(g, 'SHRINE OF THE HUNT', VIEW_W / 2, y + 19, '#ffe080', 1);
  const known = SKILLS.filter(sk => game.player.skills[sk.key]).length;
  drawTextCentered(g, 'HEARTS x' + game.player.hearts + '    LEARNED ' + known + '/' + SKILLS.length,
    VIEW_W / 2, y + 31, '#cfc7ee', 1);

  const top = scrollWindow('shrine', game.shrineSel, SKILLS.length, vis);
  for (let i = top; i < Math.min(SKILLS.length, top + vis); i++) {
    const sk = SKILLS[i];
    const ry = y + 46 + (i - top) * 21;
    const owned = game.player.skills[sk.key];
    const locked = sk.req && !game.player.skills[sk.req];
    const afford = game.player.hearts >= sk.cost && !locked;
    if (i === game.shrineSel) {
      g.fillStyle = 'rgba(216,168,72,0.14)';
      g.fillRect(x + 6, ry - 3, w - 16, 19);
      drawTextShadow(g, '-', x + 10, ry, '#ffe080', 1);
    }
    drawTextShadow(g, sk.name, x + 20, ry, owned ? '#8a83a8' : afford ? '#e8e4d8' : '#5c5678', 1);
    const tag = owned ? 'LEARNED' : locked ? 'SEALED' : sk.cost + ' HEARTS';
    drawTextShadow(g, tag, x + w - 22 - textWidth(tag, 1), ry,
      owned ? '#4a9a4a' : locked ? '#5c5678' : '#e08a8a', 1);
    const desc = locked ? 'REQUIRES ' + SKILLS.find(k => k.key === sk.req).name : sk.desc;
    drawTextShadow(g, desc, x + 20, ry + 9, '#5c5678', 1);
  }
  drawScrollBar(g, x + w - 12, y + 44, vis * 21 - 4, top, vis, SKILLS.length);
  drawTextCentered(g, 'UP/DOWN SCROLL    Z LEARN    ENTER LEAVE', VIEW_W / 2, y + h - 11, '#8a6d2f', 1);
}

function drawCardsMenu(g) {
  const vis = 7;
  const w = 400, h = 46 + vis * 24 + 62, x = (VIEW_W - w) >> 1, y = ((VIEW_H - h) >> 1) - 6;
  g.fillStyle = 'rgba(8,6,15,0.5)';
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  g.fillStyle = 'rgba(8,6,15,0.93)';
  g.fillRect(x, y, w, h);
  goldFrame(g, x, y, w, h);
  const p = game.player, sel = game.cardSel;
  const ownedN = CARD_ACTIONS.concat(CARD_ATTRS).filter(k => p.cards[k]).length;
  drawTextCentered(g, 'ARCANA BINDING', VIEW_W / 2, y + 8, '#ffe080', 1);
  drawTextCentered(g, ownedN + ' OF ' + (CARD_ACTIONS.length + CARD_ATTRS.length) +
    ' CARDS    ' + (CARD_ACTIONS.length * CARD_ATTRS.length) + ' PAIRINGS',
    VIEW_W / 2, y + 20, '#5c5678', 1);
  const cols = [
    { title: 'ACTION', list: CARD_ACTIONS, cx: x + 22, equipped: p.cardAction, id: 'cardA' },
    { title: 'ATTRIBUTE', list: CARD_ATTRS, cx: x + 210, equipped: p.cardAttr, id: 'cardB' },
  ];
  cols.forEach((col, ci) => {
    drawTextShadow(g, col.title, col.cx, y + 34, '#8a6d2f', 1);
    const rowSel = ci === sel.col ? Math.min(sel.row, col.list.length - 1) : -1;
    const top = scrollWindow(col.id, Math.max(0, rowSel), col.list.length, vis);
    for (let ri = top; ri < Math.min(col.list.length, top + vis); ri++) {
      const key = col.list[ri];
      const ry = y + 46 + (ri - top) * 24;
      const owned = p.cards[key];
      if (ri === rowSel) {
        g.fillStyle = 'rgba(216,168,72,0.14)';
        g.fillRect(col.cx - 6, ry - 3, 168, 22);
      }
      if (owned) g.drawImage(cardIcon(key), col.cx, ry);
      else {
        g.fillStyle = '#1a1626'; g.fillRect(col.cx, ry, 12, 16);
        drawText(g, '?', col.cx + 4, ry + 5, '#3a3448', 1);
      }
      drawTextShadow(g, owned ? CARD_NAME[key] : 'UNKNOWN', col.cx + 18, ry + 1,
        owned ? '#e8e4d8' : '#3a3448', 1);
      if (col.equipped === key) drawTextShadow(g, 'BOUND', col.cx + 18, ry + 10, '#4a9a4a', 1);
    }
    drawScrollBar(g, col.cx + 172, y + 44, vis * 24 - 6, top, vis, col.list.length);
  });
  // ---- what the cursor is resting on, paired against what you already hold.
  // You should be able to read a pairing before committing to it.
  const hovered = (sel.col === 0 ? CARD_ACTIONS : CARD_ATTRS)[
    Math.min(sel.row, (sel.col === 0 ? CARD_ACTIONS : CARD_ATTRS).length - 1)];
  const previewAction = sel.col === 0 ? hovered : p.cardAction;
  const previewAttr = sel.col === 1 ? hovered : p.cardAttr;
  const bound = p.cardAction && p.cardAttr ? CARD_COMBOS[p.cardAction + '+' + p.cardAttr] : null;
  const preview = previewAction && previewAttr
    ? CARD_COMBOS[previewAction + '+' + previewAttr] : null;
  const isBound = preview && bound && previewAction === p.cardAction && previewAttr === p.cardAttr;

  if (!p.cards[hovered]) {
    drawTextCentered(g, CARD_NAME[hovered] + ' — NOT YET FOUND', VIEW_W / 2, y + h - 41, '#5c5678', 1);
    drawTextCentered(g, 'ITS PAIRINGS ARE UNKNOWN TO YOU', VIEW_W / 2, y + h - 30, '#3a3448', 1);
  } else if (preview) {
    const tag = isBound ? 'BOUND' : 'WOULD MAKE';
    drawTextCentered(g, tag, VIEW_W / 2, y + h - 50, isBound ? '#4a9a4a' : '#8a6d2f', 1);
    drawTextCentered(g, preview[0], VIEW_W / 2, y + h - 39, isBound ? '#ffe080' : '#e8e4d8', 1);
    drawTextCentered(g, preview[1], VIEW_W / 2, y + h - 28, '#8a83a8', 1);
  } else {
    const half = previewAction || previewAttr;
    drawTextCentered(g, CARD_NAME[hovered], VIEW_W / 2, y + h - 44, '#e8e4d8', 1);
    drawTextCentered(g, half ? 'BIND ' + (sel.col === 0 ? 'AN ATTRIBUTE' : 'AN ACTION') + ' TO SEE THE PAIRING'
      : 'BIND ONE ACTION AND ONE ATTRIBUTE', VIEW_W / 2, y + h - 32, '#5c5678', 1);
  }
  drawTextCentered(g, 'ARROWS MOVE   Z BIND   Q CLOSE', VIEW_W / 2, y + h - 11, '#8a6d2f', 1);
}


const CY = (VIEW_H - 270) >> 1;   // recenters 270-designed layouts

function drawTitle(g) {
  const pan = (game.time * 0.4) % (Level.pxW - VIEW_W);
  drawBackground(g, pan, 40, game.time, true);
  drawTiles(g, pan, 40);
  g.fillStyle = 'rgba(8,6,15,0.45)';
  g.fillRect(0, 0, VIEW_W, VIEW_H);

  // bats crossing the moon
  for (let k = 0; k < 3; k++) {
    const bx = VIEW_W + 60 - ((game.time * (0.8 + k * 0.25) + k * 170) % (VIEW_W + 120));
    const by = 22 + k * 16 + Math.sin(game.time * 0.05 + k * 2) * 6;
    const spr = ((game.time >> 3) + k) & 1 ? Sprites.bat.dark1 : Sprites.bat.dark2;
    g.drawImage(spr, Math.floor(bx), Math.floor(by));
  }

  g.drawImage(Sprites.emblem, VIEW_W / 2 - 6, CY + 18);
  drawTextCentered(g, 'MOONFANG', VIEW_W / 2, CY + 40, '#c92c38', 3);
  drawTextCentered(g, 'CASTLE', VIEW_W / 2, CY + 64, '#e8e4d8', 3);
  g.fillStyle = '#8a6d2f';
  g.fillRect(VIEW_W / 2 - 70, CY + 88, 140, 1);
  g.fillStyle = '#d8a848';
  g.fillRect(VIEW_W / 2 - 72, CY + 87, 3, 3); g.fillRect(VIEW_W / 2 + 69, CY + 87, 3, 3);
  drawTextCentered(g, 'A NIGHT OF THE HUNTER', VIEW_W / 2, CY + 94, '#c8a860', 1);

  if ((game.time >> 5) & 1) {
    drawTextCentered(g, loadRun() ? 'ENTER  NEW HUNT       R  CONTINUE' : 'PRESS ENTER',
      VIEW_W / 2, CY + 122, '#ffe080', 1);
  }
  drawTextCentered(g, 'Z ATTACK  X JUMP  C BACKDASH', VIEW_W / 2, CY + 162, '#5c5678', 1);
  drawTextCentered(g, 'UP+Z SUB-WEAPON  DOWN+X DROP DOWN', VIEW_W / 2, CY + 174, '#5c5678', 1);
  drawTextCentered(g, 'NINE STAGES STAND BETWEEN YOU AND THE MOONFANG', VIEW_W / 2, CY + 186, '#5c5678', 1);
  // the loadout: which weapon you begin the hunt holding
  {
    const owned = WEAPON_KEYS.filter(k => meta.weapons[k]);
    const bw = 34, total = owned.length * bw;
    const bx0 = VIEW_W / 2 - total / 2;
    drawTextCentered(g, 'LOADOUT   1-' + owned.length + '  CHOOSE', VIEW_W / 2, CY + 200, '#5c5678', 1);
    owned.forEach((k, i) => {
      const bx = bx0 + i * bw;
      const sel = k === meta.startWeapon;
      g.fillStyle = sel ? 'rgba(216,168,72,0.22)' : 'rgba(8,6,15,0.7)';
      g.fillRect(bx, CY + 210, bw - 4, 26);
      if (sel) goldFrame(g, bx, CY + 210, bw - 4, 26);
      const ic = weaponIcon(k);
      if (ic) g.drawImage(ic, bx + (bw - 4) / 2 - ic.width / 2, CY + 212);
      drawTextCentered(g, String(i + 1), bx + (bw - 4) / 2, CY + 227, sel ? '#ffe080' : '#5c5678', 1);
    });
    const cur = WEAPONS[meta.startWeapon];
    drawTextCentered(g, cur.name + '  -  ' + cur.desc, VIEW_W / 2, CY + 240, '#c8a860', 1);
  }

  if ((game.time >> 5) & 1) {
    drawTextCentered(g, 'B  BOSS RUSH' + (meta.rushBest ? '   BEST ' + fmtTime(meta.rushBest) : '') +
      '     N  BESTIARY     F  DEEDS', VIEW_W / 2, CY + 134, '#c07af0', 1);
    drawTextCentered(g, 'Y  DAILY CASTLE' + (meta.dailyBest ? '   BEST ' + meta.dailyBest : ''),
      VIEW_W / 2, CY + 146, '#5ad06a', 1);
  }
  if (game.eraseArm > 0) {
    g.fillStyle = 'rgba(120,20,28,0.30)';
    g.fillRect(0, CY + 200, VIEW_W, 34);
    drawTextCentered(g, 'ERASE EVERYTHING THE CASTLE REMEMBERS?', VIEW_W / 2, CY + 208, '#e04858', 1);
    drawTextCentered(g, 'PRESS DELETE AGAIN TO CONFIRM', VIEW_W / 2, CY + 222,
      ((game.time >> 3) & 1) ? '#ffe080' : '#8a6d2f', 1);
  } else if (game.eraseDone > 0) {
    drawTextCentered(g, 'ALL RECORD OF YOU IS GONE', VIEW_W / 2, CY + 212, '#8ad0f0', 1);
  } else if ((game.time >> 6) & 1) {
    drawTextCentered(g, 'DELETE  ERASE ALL PROGRESS', VIEW_W / 2, CY + 212, '#4a4658', 1);
  }

  drawTextCentered(g, 'BEST ' + String(hiScore).padStart(6, '0') +
    '   DEEPEST STAGE ' + meta.bestStage, VIEW_W / 2, CY + 108, '#8a83a8', 1);
  const bl = META_UNLOCKS.filter(u => meta.bestStage >= u.stage).map(u => u.label).join(' ');
  if (bl) drawTextCentered(g, 'BLESSINGS: ' + bl, VIEW_W / 2, CY + 188, '#4a9a4a', 1);
  drawFog(g, pan, 40, game.time);
  drawVignette(g);
}



function drawRelicMenu(g) {
  const p = game.player;
  const w = 320, h = 226, x = (VIEW_W - w) >> 1, y = ((VIEW_H - h) >> 1) - 4;
  g.fillStyle = 'rgba(8,6,15,0.5)';
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  g.fillStyle = 'rgba(8,6,15,0.94)';
  g.fillRect(x, y, w, h);
  goldFrame(g, x, y, w, h);
  drawTextCentered(g, game.forgeMode ? 'THE FORGE' : 'RELIC SATCHEL', VIEW_W / 2, y + 8, '#ffe080', 1);
  drawTextCentered(g, 'ESSENCE ' + meta.essence, VIEW_W / 2, y + 18, '#c07af0', 1);

  const rows = [];
  for (let i = 0; i < 3; i++) rows.push({ label: 'WORN', r: p.relics[i] });
  for (let i = 0; i < p.bag.length; i++) rows.push({ label: 'BAG', r: p.bag[i], bagIdx: i });
  rows.forEach((row, i) => {
    const ry = y + 30 + i * 15;
    if (i === game.relicSel) {
      g.fillStyle = 'rgba(216,168,72,0.14)';
      g.fillRect(x + 6, ry - 2, w - 12, 14);
    }
    if (game.forgeMode && row.bagIdx === game.forgeMark) {
      g.fillStyle = 'rgba(255,140,50,0.22)';
      g.fillRect(x + 6, ry - 2, w - 12, 14);
    }
    drawTextShadow(g, row.label, x + 12, ry + 2, row.label === 'WORN' ? '#8a6d2f' : '#5c5678', 1);
    if (row.r) {
      g.drawImage(relicIcon(row.r), x + 38, ry);
      drawTextShadow(g, relicName(row.r), x + 54, ry + 2, TIER_COLOR[row.r.tier], 1);
    } else {
      drawTextShadow(g, '- EMPTY -', x + 54, ry + 2, '#3a3448', 1);
    }
  });

  const sel = rows[game.relicSel];
  if (sel && sel.r) {
    drawTextCentered(g, relicStatsText(sel.r), VIEW_W / 2, y + h - 34, '#8a83a8', 1);
  }
  const sets = p.relicSetInfo();
  if (sets.length) {
    drawTextCentered(g, 'RESONANCE: ' + sets.map(st => st.name + ' X' + st.n).join('  ') + '  +50% PREFIX POWER',
      VIEW_W / 2, y + h - 24, '#5aa04a', 1);
  }
  const help = game.forgeMode
    ? 'Z WEAR  X SALVAGE  C TRANSMUTE X2  E FORGE 12  Q INFUSE 8  I CLOSE'
    : 'Z WEAR OR STOW  X SALVAGE  I CLOSE';
  drawTextCentered(g, help, VIEW_W / 2, y + h - 12, '#8a6d2f', 1);
}


// The hunter's chart: everything you've seen of this stage, drawn small.
function drawMapScreen(g) {
  const tiles = Math.ceil(Level.pxW / TILE);
  // the castle is one huge place now; sample it down until it fits the chart
  const MAXW = 860;
  const step = Math.max(1, Math.ceil(tiles / MAXW));
  const sx = step > 1 ? 1 : Math.max(1, Math.min(3, Math.floor(MAXW / tiles)));
  const cols = Math.ceil(tiles / step);
  const rowH = LEVEL_H > 50 ? 2 : 3;
  const mw = cols * sx, mh = LEVEL_H * rowH;
  const w = mw + 34, h = mh + 96;
  const x = (VIEW_W - w) >> 1, y = ((VIEW_H - h) >> 1) - 6;
  const seen = (tx, ty) => game.explored && game.explored[ty * LEVEL_W + tx];

  g.fillStyle = 'rgba(8,6,15,0.6)';
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  g.fillStyle = 'rgba(8,6,15,0.94)';
  g.fillRect(x, y, w, h);
  goldFrame(g, x, y, w, h);
  drawTextCentered(g, "THE HUNTER'S CHART", VIEW_W / 2, y + 8, '#ffe080', 1);

  const mx = x + 17, my = y + 30;
  g.fillStyle = '#0c0a16';
  g.fillRect(mx - 2, my - 2, mw + 4, mh + 4);

  // ---- region bands: the castle's designed regions, tinted behind the stone
  const REGION_TINT = {
    ground: '#2a2438', pits: '#2a1e2e', hall: '#2c2842', ascent: '#331e28',
    graveyard: '#22301f', battlements: '#243044', tower: '#332a44',
    shaft: '#1e2438', lift: '#2e2a30', approach: '#3a2430', arena: '#3a1e2a',
  };
  let hovered = null;
  for (const r of (Level.regions || [])) {
    const rx0 = Math.floor(r.x0 / TILE), rx1 = Math.floor(r.x1 / TILE);
    let anySeen = false;
    for (let tx = rx0; tx <= rx1 && !anySeen; tx++) {
      for (let ty = 0; ty < LEVEL_H; ty++) if (seen(tx, ty)) { anySeen = true; break; }
    }
    if (!anySeen) continue;
    g.fillStyle = REGION_TINT[r.kind] || '#2a2438';
    g.fillRect(mx + Math.floor(rx0 / step) * sx, my, Math.max(1, Math.floor((rx1 - rx0) / step) * sx), mh);
    const p = game.player;
    if (p && p.x >= r.x0 && p.x <= r.x1) hovered = r;
  }

  // ---- the castle itself, only where the hunter has been
  for (let tx = 0; tx < tiles; tx += step) {
    for (let ty = 0; ty < LEVEL_H; ty++) {
      const id = tileAt(tx, ty);
      if (!id || !seen(tx, ty)) continue;
      g.fillStyle = id === 3 ? '#a04040'
        : id === 2 ? '#8a5a30'
        : id === 13 ? '#8ad0f0'
        : id === 12 ? '#d8a848'
        : id === 10 || id === 11 ? '#6a6488'
        : '#7a7498';
      g.fillRect(mx + Math.floor(tx / step) * sx, my + ty * rowH, sx, rowH);
    }
  }

  // ---- the vertical spine: towers, shafts and lifts drawn as routes, not stone
  for (const r of (Level.regions || [])) {
    if (!r.vertical) continue;
    const cx = Math.floor((r.x0 + r.x1) / 2 / TILE);
    let anySeen = false;
    for (let ty = 0; ty < LEVEL_H; ty++) if (seen(cx, ty)) { anySeen = true; break; }
    if (!anySeen) continue;
    const t0 = Math.min(r.top, r.bottom === undefined ? r.top : r.bottom);
    const t1 = Math.max(r.top, r.bottom === undefined ? r.top : r.bottom);
    const col = r.kind === 'shaft' ? '#6a7ad0' : r.kind === 'lift' ? '#b8c0cc' : '#c8a860';
    g.fillStyle = col;
    g.fillRect(mx + Math.floor(cx / step) * sx, my + t0 * rowH, Math.max(1, sx), (t1 - t0) * rowH + rowH);
    // an arrow head showing which way the route runs
    const down = r.kind === 'shaft';
    const ay = down ? my + t1 * rowH + rowH : my + t0 * rowH;
    for (let i = 0; i < 3; i++) {
      g.fillRect(mx + Math.floor(cx / step) * sx - i, ay + (down ? -i : i), Math.max(1, sx) + i * 2, 1);
    }
  }

  // ---- marks of note, at their true height
  const mark = (px, row, color, always) => {
    const tx = Math.floor(px / TILE);
    if (!always && !seen(tx, Math.max(0, Math.min(LEVEL_H - 1, row)))) return;
    g.fillStyle = color;
    g.fillRect(mx + Math.floor(tx / step) * sx - 1, my + row * rowH - 3, sx + 2, 4);
  };
  const rowOf = (o) => Math.max(1, Math.floor(o.y / TILE) - 1);
  for (const pr of Level.props) {
    if (pr.type === 'shrine') mark(pr.x, rowOf(pr), '#ffe080');
    if (pr.type === 'forge') mark(pr.x, rowOf(pr), '#ff9e50');
    if (pr.type === 'merchant') mark(pr.x, rowOf(pr), '#5ad06a');
  }
  const lit = litObelisks();
  for (const ob of (Level.obelisks || [])) mark(ob.x, rowOf(ob), ob.lit ? '#50d8e8' : '#2a4a58');
  for (const pk of game.pickups) {
    if (pk.life > 1e8 && !pk.remove) mark(pk.x, Math.floor(pk.y / TILE), '#c060e0');
  }
  // sealed chambers, but only the ones you have already stood inside — an
  // unfound secret drawn on the chart is not a secret
  for (const sc of (Level.secrets || [])) {
    if (sc.found) mark((sc.x0 + sc.x1) / 2, Math.max(1, sc.ty0), '#ffe080', true);
  }
  mark(Level.boss.homeX, Math.floor(Level.boss.homeY / TILE), '#8a2ce0',
    game.bossActive || seen(Math.floor(Level.boss.gateTX), 10));

  // ---- the frontier: where explored ground opens into the dark
  {
    let drawn = 0;
    for (let tx = 1; tx < tiles - 1 && drawn < 40; tx += step) {
      for (let ty = 1; ty < LEVEL_H - 1; ty++) {
        if (!seen(tx, ty) || tileAt(tx, ty) !== 0) continue;
        // open, explored, and touching open ground you have never seen
        let frontier = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = tx + dx, ny = ty + dy;
          if (nx < 0 || ny < 0 || nx >= tiles || ny >= LEVEL_H) continue;
          if (!seen(nx, ny) && tileAt(nx, ny) === 0) { frontier = true; break; }
        }
        if (!frontier) continue;
        const blink = 0.5 + 0.5 * Math.sin(game.time * 0.08 + tx);
        g.fillStyle = `rgba(255,224,128,${(0.3 + 0.45 * blink).toFixed(2)})`;
        g.fillRect(mx + Math.floor(tx / step) * sx, my + ty * rowH + 1, Math.max(1, sx), 2);
        drawn++;
        break;
      }
    }
  }

  // ---- the hunter's own marks
  for (const m of (game.marks || [])) {
    const tx = Math.floor(m.x / TILE), ty = Math.floor(m.y / TILE);
    g.fillStyle = '#f0ead8';
    const mxp = mx + Math.floor(tx / step) * sx - 2, myp = my + ty * rowH - 3;
    if (m.kind === 0) { g.fillRect(mxp, myp + 2, 5, 1); g.fillRect(mxp + 2, myp, 1, 5); }
    else if (m.kind === 1) { g.fillRect(mxp, myp, 5, 1); g.fillRect(mxp, myp + 4, 5, 1); g.fillRect(mxp, myp, 1, 5); g.fillRect(mxp + 4, myp, 1, 5); }
    else if (m.kind === 2) { g.fillRect(mxp + 2, myp, 1, 5); g.fillRect(mxp + 1, myp + 1, 3, 1); }
    else { g.fillRect(mxp, myp + 4, 5, 1); g.fillRect(mxp + 1, myp + 2, 3, 1); g.fillRect(mxp + 2, myp, 1, 1); }
  }

  // ---- the hunter
  if ((game.time >> 4) & 1) {
    const p = game.player;
    g.fillStyle = '#f8f8ff';
    g.fillRect(mx + Math.floor(p.x / TILE / step) * sx - 1, my + Math.floor(p.y / TILE) * rowH - 1, sx + 2, 5);
  }

  // ---- where you stand, and how much of it you have walked
  if (hovered) {
    const rx0 = Math.floor(hovered.x0 / TILE), rx1 = Math.floor(hovered.x1 / TILE);
    let known = 0, total = 0;
    for (let tx = rx0; tx <= rx1; tx++) {
      for (let ty = 2; ty < LEVEL_H; ty++) {
        if (tileAt(tx, ty) !== 0) continue;
        total++;
        if (seen(tx, ty)) known++;
      }
    }
    const pct = total ? Math.round(100 * known / total) : 100;
    drawTextCentered(g, hovered.name, VIEW_W / 2, y + 18, '#c8a860', 1);
    drawTextCentered(g, pct + '% WALKED', VIEW_W / 2, y + h - 46, '#5c5678', 1);
  }

  drawTextCentered(g, 'GOLD SHRINE  ORANGE FORGE  GREEN MERCHANT  CYAN OBELISK  PURPLE GUARDIAN',
    VIEW_W / 2, y + h - 34, '#5c5678', 1);
  if (lit.length) {
    const ob = lit[game.warpSel % lit.length];
    drawTextCentered(g, 'OBELISK ' + ((game.warpSel % lit.length) + 1) + '/' + lit.length +
      '   ' + Math.floor(ob.x / TILE) + 'M ALONG THE CASTLE', VIEW_W / 2, y + h - 23, '#50d8e8', 1);
    drawTextCentered(g, 'LEFT/RIGHT CHOOSE   Z WARP   G MARK   TAB CLOSE',
      VIEW_W / 2, y + h - 12, '#8a6d2f', 1);
  } else {
    drawTextCentered(g, 'GOLD FLECKS MARK WAYS YOU HAVE NOT WALKED', VIEW_W / 2, y + h - 23, '#5c5678', 1);
    drawTextCentered(g, 'G MARK THIS SPOT   TAB CLOSE', VIEW_W / 2, y + h - 12, '#8a6d2f', 1);
  }
}

// F3 diagnostics for development.
function drawDebugOverlay(g) {
  const p = game.player;
  const lines = [
    'FPS ' + (game.fps || 0),
    'ENT ' + game.enemies.length + '  PRJ ' + (game.projectiles.length + game.enemyProjectiles.length),
    'PTC ' + particles.length + '  PKP ' + game.pickups.length,
    p ? ('XY ' + (p.x | 0) + ',' + (p.y | 0) + '  ST ' + game.state) : game.state,
    'STAGE ' + game.stage + '  W ' + Math.ceil(Level.pxW / TILE),
  ];
  g.fillStyle = 'rgba(8,6,15,0.7)';
  g.fillRect(VIEW_W - 92, VIEW_H - 8 - lines.length * 9, 90, lines.length * 9 + 6);
  lines.forEach((l, i) => {
    drawText(g, l, VIEW_W - 88, VIEW_H - 6 - (lines.length - i) * 9, '#5aa04a', 1);
  });
}


// The bestiary: every fiend put down, remembered forever.
function drawBestiary(g) {
  const w = 380, h = 300, x = (VIEW_W - w) >> 1, y = (VIEW_H - h) >> 1;
  g.fillStyle = 'rgba(8,6,15,0.7)';
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  g.fillStyle = 'rgba(8,6,15,0.95)';
  g.fillRect(x, y, w, h);
  goldFrame(g, x, y, w, h);
  drawTextCentered(g, 'BESTIARY', VIEW_W / 2, y + 8, '#ffe080', 1);
  const book = meta.bestiary || {};
  const sel = game.beastSel || 0;
  BESTIARY_SPECIES.forEach((sp, i) => {
    const ry = y + 22 + i * 23;
    let kills = 0, variants = 0;
    for (const k in book) {
      if (k === sp.key || k.startsWith(sp.key + ':')) {
        kills += book[k];
        if (k.indexOf(':') >= 0) variants++;
      }
    }
    const known = kills > 0;
    if (i === sel) {
      g.fillStyle = 'rgba(216,168,72,0.14)';
      g.fillRect(x + 6, ry - 2, w - 12, 21);
    }
    if (sp.sheet && Sheets[sp.sheet] && known) {
      const sh = Sheets[sp.sheet];
      const scale = Math.min(1, 16 / sh.fh);
      g.drawImage(sh.R, 0, 0, sh.fw, sh.fh,
        x + 12, ry, Math.round(sh.fw * scale), Math.round(sh.fh * scale));
    } else if (known) {
      g.drawImage(Sprites.bat.down, x + 14, ry + 2);
    }
    drawTextShadow(g, known ? sp.name : '? ? ?', x + 46, ry + 2,
      known ? '#e8e4d8' : '#3a3448', 1);
    if (known) {
      const tag = 'SLAIN ' + kills + (variants ? '   FORMS ' + variants : '');
      drawTextShadow(g, tag, x + w - 14 - textWidth(tag, 1), ry + 2, '#8a83a8', 1);
      if (i === sel) drawTextShadow(g, sp.lore, x + 46, ry + 11, '#5c5678', 1);
    }
  });
  drawTextCentered(g, 'N CLOSE', VIEW_W / 2, y + h - 12, '#8a6d2f', 1);
}

// ---------------------------------------------------------------- the crossroads
function drawCrossroads(g) {
  g.fillStyle = 'rgba(6,4,12,0.88)';
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  drawTextCentered(g, 'THE CASTLE OPENS THREE ROADS', VIEW_W / 2, 54, '#ffe080', 1);
  drawTextCentered(g, 'CHOOSE YOUR DESCENT', VIEW_W / 2, 68, '#8a83a8', 1);
  const n = game.pathOffer.length;
  const cw = 240, gap = 16;
  const total = n * cw + (n - 1) * gap;
  const x0 = (VIEW_W - total) >> 1;
  const y = 100, h = 200;
  for (let i = 0; i < n; i++) {
    const p = game.pathOffer[i];
    const x = x0 + i * (cw + gap);
    const sel = i === game.pathSel;
    g.fillStyle = sel ? 'rgba(24,18,44,0.96)' : 'rgba(10,8,20,0.9)';
    g.fillRect(x, y, cw, h);
    goldFrame(g, x, y, cw, h);
    if (sel) {
      const a = 0.10 + 0.05 * Math.sin(game.time * 0.1);
      g.fillStyle = `rgba(216,168,72,${a.toFixed(3)})`;
      g.fillRect(x + 2, y + 2, cw - 4, h - 4);
    }
    g.drawImage(Sprites.emblem, x + cw / 2 - 6, y + 12);
    drawTextCentered(g, p.name, x + cw / 2, y + 34, sel ? '#ffe080' : '#8a83a8', 1);
    // wrap the flavour line
    const words = p.desc.split(' ');
    let line = '', ly = y + 58;
    for (const wd of words) {
      const t = line ? line + ' ' + wd : wd;
      if (textWidth(t, 1) > cw - 24) { drawTextCentered(g, line, x + cw / 2, ly, '#cfc7ee', 1); ly += 11; line = wd; }
      else line = t;
    }
    if (line) drawTextCentered(g, line, x + cw / 2, ly, '#cfc7ee', 1);
    const boons = [];
    if (p.mods.luck) boons.push('FORTUNE FAVOURS YOU');
    if (p.mods.hearts) boons.push('+15 HEARTS NOW');
    if (p.mods.hp) boons.push('+4 MAX HEALTH NOW');
    if (p.mods.epic) boons.push('RICHER RELICS');
    if (p.mods.secrets) boons.push('MORE SECRET WALLS');
    boons.forEach((b, k) => drawTextCentered(g, b, x + cw / 2, y + h - 44 + k * 11, '#5ad06a', 1));
    drawTextCentered(g, 'STAGE ' + (game.stage + 1), x + cw / 2, y + h - 16, '#8a6d2f', 1);
  }
  drawTextCentered(g, 'LEFT/RIGHT CHOOSE     ENTER TAKE THE ROAD', VIEW_W / 2, y + h + 28, '#8a6d2f', 1);
}

// ---------------------------------------------------------------- merchant
function drawShop(g) {
  const merch = game.nearMerchant;
  const stock = merch && merch.stock ? merch.stock : [];
  const w = 320, h = 62 + stock.length * 24, x = (VIEW_W - w) >> 1, y = ((VIEW_H - h) >> 1) - 8;
  g.fillStyle = 'rgba(8,6,15,0.55)';
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  g.fillStyle = 'rgba(8,6,15,0.94)';
  g.fillRect(x, y, w, h);
  goldFrame(g, x, y, w, h);
  g.drawImage(Sprites.merchant, x + w / 2 - 7, y + 4);
  drawTextCentered(g, 'THE WANDERING MERCHANT', VIEW_W / 2, y + 28, '#ffe080', 1);
  drawTextCentered(g, 'GEMS x' + game.player.gems, VIEW_W / 2, y + 40, '#c060e0', 1);
  stock.forEach((it, i) => {
    const ry = y + 56 + i * 24;
    const sel = i === game.shopSel;
    const afford = game.player.gems >= it.cost && !it.sold;
    if (sel) {
      g.fillStyle = 'rgba(216,168,72,0.14)';
      g.fillRect(x + 6, ry - 3, w - 12, 21);
      drawTextShadow(g, '-', x + 10, ry, '#ffe080', 1);
    }
    drawTextShadow(g, shopLabel(it), x + 20, ry,
      it.sold ? '#4a4658' : afford ? '#e8e4d8' : '#5c5678', 1);
    const tag = it.sold ? 'SOLD' : it.cost + ' GEMS';
    drawTextShadow(g, tag, x + w - 14 - textWidth(tag, 1), ry,
      it.sold ? '#4a9a4a' : afford ? '#ffe080' : '#e08a8a', 1);
    drawTextShadow(g, shopDesc(it).slice(0, 46), x + 20, ry + 10, '#5c5678', 1);
  });
  drawTextCentered(g, 'Z BUY     ENTER LEAVE', VIEW_W / 2, y + h - 11, '#8a6d2f', 1);
}

// ---------------------------------------------------------------- feats
function drawFeats(g) {
  g.fillStyle = 'rgba(6,4,12,0.93)';
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  const keys = Object.keys(FEATS);
  const cols = 2, colW = 400, rowH = 22;
  const rows = Math.ceil(keys.length / cols);
  const pw = cols * colW + 28, ph = rows * rowH + 30;
  const px = (VIEW_W - pw) >> 1, py = 74;

  g.drawImage(Sprites.emblem, VIEW_W / 2 - 6, 18);
  drawTextCentered(g, 'DEEDS OF THE HUNT', VIEW_W / 2, 36, '#ffe080', 1);
  const done = keys.filter(k => meta.feats[k]).length;
  drawTextCentered(g, done + ' OF ' + keys.length + ' EARNED    EACH PAYS 5 ESSENCE',
    VIEW_W / 2, 50, '#8a83a8', 1);

  g.fillStyle = 'rgba(10,8,20,0.9)';
  g.fillRect(px, py, pw, ph);
  goldFrame(g, px, py, pw, ph);
  keys.forEach((k, i) => {
    const col = Math.floor(i / rows), row = i % rows;
    const cx = px + 14 + col * colW;
    const cy = py + 14 + row * rowH;
    const got = !!meta.feats[k];
    if (got) {
      g.fillStyle = '#d8a848';
      g.fillRect(cx, cy + 1, 6, 6);
      g.fillStyle = '#ffe080';
      g.fillRect(cx + 1, cy + 2, 2, 2);
    } else {
      g.fillStyle = '#2a2438';
      g.fillRect(cx, cy + 1, 6, 6);
    }
    drawTextShadow(g, FEATS[k].name, cx + 13, cy, got ? '#ffe080' : '#4a4658', 1);
    drawTextShadow(g, got ? FEATS[k].desc : '???', cx + 13, cy + 9, got ? '#8a83a8' : '#33304a', 1);
  });

  // the wider record of the hunt
  const sy = py + ph + 16;
  const loreN = Object.keys(meta.lore || {}).length;
  const stats = [
    ['TABLETS RECOVERED', loreN + ' / ' + LORE.length, '#9a97a8'],
    ['DEEPEST STAGE', String(meta.bestStage), '#c8a860'],
    ['FIENDS SLAIN IN ALL', String(meta.kills), '#e08a8a'],
    ['MOONFANG FELLED', String(meta.cleared || 0), '#50d8e8'],
  ];
  if (meta.dailyBest) stats.push(["TODAY'S BEST", String(meta.dailyBest), '#5ad06a']);
  const sw = 200;
  const sx0 = (VIEW_W - stats.length * sw) / 2;
  stats.forEach(([label, val, col], i) => {
    const cx = sx0 + i * sw + sw / 2;
    drawTextCentered(g, label, cx, sy, '#5c5678', 1);
    drawTextCentered(g, val, cx, sy + 12, col, 1);
  });

  drawTextCentered(g, 'ENTER CLOSE', VIEW_W / 2, VIEW_H - 18, '#8a6d2f', 1);
}

// ---------------------------------------------------------------- dawn
function drawEnding(g) {
  const t = game.endT || 0;
  const k = Math.min(1, t / 420);          // how far the sun has climbed
  const horizon = VIEW_H - 130;

  // the sky bleeds from night to a cold rose morning
  const bands = 30;
  for (let i = 0; i < bands; i++) {
    const f = i / (bands - 1);             // 0 at the top, 1 at the horizon
    const warm = Math.pow(f, 2.2) * k;
    const r = Math.round(10 + 8 * f + 232 * warm);
    const gg = Math.round(8 + 6 * f + 150 * warm);
    const b = Math.round(20 + 18 * f + 90 * warm);
    g.fillStyle = `rgb(${r},${gg},${b})`;
    g.fillRect(0, Math.floor(i * horizon / bands), VIEW_W, Math.ceil(horizon / bands) + 1);
  }

  // seal the lower screen with the horizon's own colour so the world
  // below never shows through the gaps in the skyline
  {
    const warm = k;
    g.fillStyle = `rgb(${Math.round(18 + 232 * warm)},${Math.round(14 + 150 * warm)},${Math.round(38 + 90 * warm)})`;
    g.fillRect(0, horizon - 1, VIEW_W, VIEW_H - horizon + 1);
  }

  // last stars, fading as the light comes
  const starA = Math.max(0, 0.7 - k);
  for (let i = 0; i < 40; i++) {
    const sx = (i * 617) % VIEW_W;
    const sy = (i * 271) % (horizon - 30);
    const tw = starA * (0.5 + 0.5 * Math.sin(t * 0.03 + i));
    if (tw <= 0.02) continue;
    g.fillStyle = `rgba(230,226,255,${tw.toFixed(3)})`;
    g.fillRect(sx, sy, 1, 1);
  }

  // the sun itself, climbing out of the hills
  const sunY = horizon + 30 - k * 120;
  for (let ring = 5; ring >= 1; ring--) {
    g.fillStyle = `rgba(255,${170 + ring * 8},${90 + ring * 14},${(0.05 * k).toFixed(3)})`;
    g.beginPath(); g.arc(VIEW_W / 2, sunY, 30 + ring * 22, 0, 7); g.fill();
  }
  g.fillStyle = `rgba(255,236,200,${(0.35 + 0.6 * k).toFixed(3)})`;
  g.beginPath(); g.arc(VIEW_W / 2, sunY, 34, 0, 7); g.fill();
  g.fillStyle = `rgba(255,250,236,${(0.5 + 0.5 * k).toFixed(3)})`;
  g.beginPath(); g.arc(VIEW_W / 2, sunY, 24, 0, 7); g.fill();

  // the broken castle, black against the morning
  const skyline = (x0, w, h, spires) => {
    g.fillRect(x0, horizon - h, w, h + 130);
    for (let s = 0; s < spires; s++) {
      const sx = x0 + 6 + s * ((w - 12) / Math.max(1, spires - 1 || 1));
      g.fillRect(Math.round(sx) - 3, horizon - h - 16, 6, 18);
      g.fillRect(Math.round(sx) - 1, horizon - h - 24, 2, 10);
    }
  };
  g.fillStyle = '#100c1c';
  skyline(-20, 190, 60, 3);
  skyline(140, 110, 96, 2);
  skyline(238, 130, 44, 3);
  // the sun climbs through the gap the broken keep left behind
  g.fillStyle = '#0a0812';
  skyline(556, 200, 132, 4);         // the keep, tallest and nearest the sun
  g.fillStyle = '#100c1c';
  skyline(748, 120, 66, 2);
  skyline(852, 130, 100, 3);
  // battlement teeth along the near wall
  g.fillStyle = '#0a0812';
  g.fillRect(0, horizon + 26, VIEW_W, 140);
  for (let x = 0; x < VIEW_W; x += 24) g.fillRect(x, horizon + 14, 14, 14);

  // ground mist catching the new light
  g.fillStyle = `rgba(255,214,180,${(0.05 + 0.06 * k).toFixed(3)})`;
  g.fillRect(0, horizon + 4, VIEW_W, 12);

  // words, arriving one at a time
  if (t > 40) drawTextCentered(g, 'THE MOONFANG IS BROKEN', VIEW_W / 2, 60, '#ffe080', 2);
  if (t > 110) {
    drawTextCentered(g, 'THE CASTLE FALLS SILENT. THE MOON SETS AT LAST.',
      VIEW_W / 2, 100, '#e8dcc8', 1);
  }
  if (t > 175) drawTextCentered(g, 'BUT THE HUNT REMEMBERS ITS OWN.', VIEW_W / 2, 118, '#b8a8c8', 1);

  if (t > 240) {
    const rows = [
      ['SCORE', String(game.score)],
      ['FIENDS SLAIN', String(game.stats.kills)],
      ['TREASURES', String(game.stats.items)],
      ['SOULS TAKEN', String(game.stats.souls)],
      ['DEEDS EARNED', Object.keys(meta.feats || {}).length + '/' + Object.keys(FEATS).length],
      ['TIMES CLEARED', String(meta.cleared || 1)],
    ];
    const bx = VIEW_W / 2 - 110, by = 150;
    g.fillStyle = 'rgba(8,6,15,0.55)';
    g.fillRect(bx - 12, by - 10, 244, rows.length * 15 + 18);
    goldFrame(g, bx - 12, by - 10, 244, rows.length * 15 + 18);
    rows.forEach(([label, val], i) => {
      const ry = by + i * 15;
      drawTextShadow(g, label, bx, ry, '#8a83a8', 1);
      drawTextShadow(g, val, bx + 220 - textWidth(val, 1), ry, '#e8e4d8', 1);
    });
  }

  if (t > 380 && ((t >> 4) & 1)) {
    drawTextCentered(g, 'ENTER  RETURN TO THE GATE', VIEW_W / 2, VIEW_H - 24, '#ffe080', 1);
  }
}

// ---------------------------------------------------------------- the crafting bench
// A wall of everything the forge can make, laid out as a matrix by category.
const recipeIconCache = {};
function recipeIcon(rec) {
  if (recipeIconCache[rec.key]) return recipeIconCache[rec.key];
  let ic = null;
  if (rec.kind === 'weapon') ic = weaponIcon(rec.weapon);
  else if (rec.kind === 'temper') ic = Sprites.whipItem;
  else if (rec.kind === 'cardKey') ic = cardIcon(rec.card);
  else if (rec.kind === 'phial') ic = Sprites.buffs[rec.buff];
  else if (rec.kind === 'elixir') ic = Sprites.elixir;
  else if (rec.kind === 'key') ic = Sprites.key;
  else if (rec.kind === 'hearts') ic = Sprites.heart;
  else if (rec.kind === 'gems') ic = Sprites.gem;
  else if (rec.kind === 'heal') ic = Sprites.roast;
  else if (rec.kind === 'relic') ic = null;   // drawn as a cut stone below
  else if (rec.kind === 'scroll') ic = null;  // drawn as a scroll below
  else if (rec.kind === 'sub') ic = Sprites.knife;
  else if (rec.kind === 'subKey') ic = SUBWEAPONS[rec.sub].icon();
  else if (rec.kind === 'reveal') ic = Sprites.iconEye;
  recipeIconCache[rec.key] = ic;
  return ic;
}

// things with no sprite of their own get one drawn on the spot
function drawRecipeGlyph(g, rec, cx, cy) {
  if (rec.kind === 'relic') {
    const tier = rec.bias >= 6 ? '#ffd858' : rec.bias >= 3 ? '#c060e0' : '#6ab0f0';
    g.fillStyle = tier;
    g.fillRect(cx - 3, cy - 5, 6, 2);
    g.fillRect(cx - 5, cy - 3, 10, 4);
    g.fillRect(cx - 3, cy + 1, 6, 3);
    g.fillRect(cx - 1, cy + 4, 2, 2);
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.fillRect(cx - 3, cy - 3, 2, 2);
  } else if (rec.kind === 'scroll') {
    g.fillStyle = '#d8d4c0';
    g.fillRect(cx - 5, cy - 5, 10, 11);
    g.fillStyle = '#8a8470';
    g.fillRect(cx - 5, cy - 6, 10, 2);
    g.fillRect(cx - 5, cy + 5, 10, 2);
    g.fillStyle = '#5c5678';
    g.fillRect(cx - 3, cy - 2, 6, 1);
    g.fillRect(cx - 3, cy, 6, 1);
    g.fillRect(cx - 3, cy + 2, 4, 1);
    if (rec.double) { g.fillStyle = '#d8a848'; g.fillRect(cx + 3, cy - 6, 3, 3); }
  } else if (rec.kind === 'infusion') {
    const col = INFUSIONS[rec.infusion].color;
    g.fillStyle = col;
    g.fillRect(cx - 4, cy - 5, 8, 3);
    g.fillRect(cx - 3, cy - 2, 6, 6);
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillRect(cx - 2, cy - 1, 2, 2);
  } else if (rec.kind === 'transmute') {
    const col = MATERIALS[rec.to].color;
    g.fillStyle = '#4a4658';
    g.fillRect(cx - 5, cy + 2, 10, 3);
    g.fillStyle = col;
    g.fillRect(cx - 3, cy - 5, 6, 6);
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fillRect(cx - 2, cy - 4, 2, 2);
  }
}

function drawCraftMenu(g) {
  const p = game.player;
  // group the recipes by category, in a fixed order
  const groups = RECIPE_CATS.map(c => ({ cat: c, list: RECIPES.filter(r => r.cat === c) }))
    .filter(gr => gr.list.length);
  const COLS = 12, CELL = 34, GAP = 3;

  // lay every cell out once, so the cursor and the drawing agree
  const cells = [];
  let gy = 74;
  for (const gr of groups) {
    gr.headerY = gy;
    gy += 13;
    gr.rows = Math.ceil(gr.list.length / COLS);
    gr.list.forEach((rec, i) => {
      const col = i % COLS, row = (i / COLS) | 0;
      cells.push({ rec, x: 0, y: gy + row * (CELL + GAP), col, row, group: gr });
    });
    gy += gr.rows * (CELL + GAP) + 8;
  }
  const gridW = COLS * CELL + (COLS - 1) * GAP;
  const gx = (VIEW_W - gridW) >> 1;
  for (const c of cells) c.x = gx + c.col * (CELL + GAP);

  game.craftSel = Math.max(0, Math.min(cells.length - 1, game.craftSel));
  const sel = cells[game.craftSel];

  // the whole screen is the forge
  g.fillStyle = 'rgba(6,4,12,0.95)';
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  g.drawImage(Sprites.forge, VIEW_W / 2 - 8, 6);
  drawTextCentered(g, 'THE FORGE', VIEW_W / 2, 26, '#ffe080', 1);
  drawTextCentered(g, RECIPES.length + ' THINGS MAY BE MADE HERE', VIEW_W / 2, 38, '#5c5678', 1);

  // what you have to spend
  {
    let mx = gx;
    for (const mk of MATERIAL_KEYS) {
      const n = p.materials[mk] || 0;
      g.fillStyle = n > 0 ? MATERIALS[mk].color : '#33304a';
      g.fillRect(mx, 52, 5, 5);
      drawTextShadow(g, MATERIALS[mk].short + ' ' + n, mx + 8, 52, n > 0 ? '#cfc7ee' : '#4a4658', 1);
      mx += 74;
    }
    const ess = 'ESSENCE ' + meta.essence;
    drawTextShadow(g, ess, gx + gridW - textWidth(ess, 1), 52, '#c07af0', 1);
  }

  // scroll the whole matrix if it runs past the panel
  const viewTop = 68, viewBot = VIEW_H - 84;
  let scroll = game.craftScroll || 0;
  if (sel.y - scroll < viewTop) scroll = sel.y - viewTop;
  if (sel.y + CELL - scroll > viewBot) scroll = sel.y + CELL - viewBot;
  scroll = Math.max(0, Math.min(Math.max(0, gy - viewBot), scroll));
  game.craftScroll = scroll;

  for (const gr of groups) {
    const hy = gr.headerY - scroll;
    if (hy > viewTop - 12 && hy < viewBot) {
      drawTextShadow(g, gr.cat, gx, hy, '#8a6d2f', 1);
      g.fillStyle = '#2a2438';
      g.fillRect(gx + textWidth(gr.cat, 1) + 6, hy + 3, gridW - textWidth(gr.cat, 1) - 6, 1);
    }
  }

  for (const c of cells) {
    const cy = c.y - scroll;
    if (cy + CELL < viewTop || cy > viewBot) continue;
    const ok = canCraft(c.rec);
    const isSel = c === sel;
    g.fillStyle = isSel ? 'rgba(216,168,72,0.22)' : ok ? 'rgba(20,16,34,0.9)' : 'rgba(12,10,20,0.8)';
    g.fillRect(c.x, cy, CELL, CELL);
    if (isSel) goldFrame(g, c.x, cy, CELL, CELL);
    else { g.fillStyle = ok ? '#2e2a44' : '#1c1a2a'; g.fillRect(c.x, cy, CELL, 1); g.fillRect(c.x, cy + CELL - 1, CELL, 1); }
    const ic = recipeIcon(c.rec);
    if (ic) {
      if (!ok) g.globalAlpha = 0.35;
      g.drawImage(ic, Math.round(c.x + (CELL - ic.width) / 2), Math.round(cy + (CELL - ic.height) / 2));
      g.globalAlpha = 1;
    } else {
      if (!ok) g.globalAlpha = 0.35;
      drawRecipeGlyph(g, c.rec, c.x + CELL / 2, cy + CELL / 2);
      g.globalAlpha = 1;
    }
    // a corner pip for things already owned, so the matrix reads at a glance
    if (!ok) {
      g.fillStyle = '#4a4658';
      g.fillRect(c.x + CELL - 5, cy + 2, 3, 3);
    }
  }

  // ---- the detail panel: everything about the thing under the cursor
  const dh = 74, dy = VIEW_H - dh;
  g.fillStyle = 'rgba(10,8,20,0.96)';
  g.fillRect(0, dy, VIEW_W, dh);
  g.fillStyle = '#8a6d2f';
  g.fillRect(0, dy, VIEW_W, 1);
  const rec = sel.rec;
  const ok = canCraft(rec);
  const ic = recipeIcon(rec);
  if (ic) g.drawImage(ic, gx + 6, dy + 12);
  else drawRecipeGlyph(g, rec, gx + 12, dy + 20);
  drawTextShadow(g, rec.name, gx + 26, dy + 10, ok ? '#ffe080' : '#8a83a8', 1);
  drawTextShadow(g, rec.desc, gx + 26, dy + 22, '#8a83a8', 1);

  // the price, and whether you can pay it
  let px2 = gx + 26;
  for (const mk of Object.keys(rec.cost)) {
    const need = rec.cost[mk], have = (p.materials[mk] || 0);
    const label = need + ' ' + MATERIALS[mk].short;
    g.fillStyle = have >= need ? MATERIALS[mk].color : '#5c4658';
    g.fillRect(px2, dy + 37, 4, 4);
    drawTextShadow(g, label, px2 + 7, dy + 36, have >= need ? '#cfc7ee' : '#6a5468', 1);
    px2 += textWidth(label, 1) + 22;
  }
  const cost = recipeCost(rec);
  drawTextShadow(g, cost + ' ESSENCE', px2 + 4, dy + 36,
    meta.essence >= cost ? '#c07af0' : '#6a3a6a', 1);

  const why = !ok ? (rec.kind === 'weapon' && p.weapons[rec.weapon] ? 'YOU ALREADY CARRY IT'
    : rec.kind === 'cardKey' && p.cards[rec.card] ? 'YOU ALREADY HOLD THIS ARCANA'
    : rec.kind === 'temper' && p.whipLvl >= 3 ? 'THIS WEAPON IS FULLY TEMPERED'
    : rec.kind === 'infusion' && !p.subWeapon ? 'YOU CARRY NO SUB-WEAPON TO INFUSE'
    : rec.kind === 'infusion' && p.subInfusion === rec.infusion ? 'ALREADY BEATEN INTO YOUR ARM'
    : 'YOU CANNOT PAY FOR IT') : null;
  if (why) drawTextShadow(g, why, gx + 26, dy + 50, '#e08a8a', 1);

  drawTextCentered(g, 'ARROWS MOVE    Z FORGE    ENTER LEAVE', VIEW_W / 2, VIEW_H - 12, '#8a6d2f', 1);
  game.craftCells = cells.length;
  game.craftCols = COLS;
  game.craftLayout = cells;
}

// ---------------------------------------------------------------- pause
// Everything the hunter needs to know, in the one place they can read it:
// what they are carrying, and every key the castle answers to.
function drawPauseScreen(g) {
  const p = game.player;
  g.fillStyle = 'rgba(6,4,12,0.90)';
  g.fillRect(0, 0, VIEW_W, VIEW_H);

  drawTextCentered(g, 'PAUSE', VIEW_W / 2, 22, '#e8e4d8', 2);
  drawTextCentered(g, 'STAGE ' + game.stage + '   ' +
    STAGE_NAMES[(game.stage - 1) % STAGE_NAMES.length], VIEW_W / 2, 46, '#c8a860', 1);
  drawTextCentered(g, 'SCORE ' + String(game.score).padStart(6, '0') +
    '    BEST ' + String(hiScore).padStart(6, '0'), VIEW_W / 2, 58, '#8a83a8', 1);

  // ---- left: the hunter as they stand
  const LX = 70, LW = 380, LH = 250;
  let y = 84;
  g.fillStyle = 'rgba(10,8,20,0.8)';
  g.fillRect(LX - 10, y - 12, LW, LH);
  goldFrame(g, LX - 10, y - 12, LW, LH);
  drawTextShadow(g, 'THE HUNTER', LX, y - 6, '#ffe080', 1);
  y += 12;

  const line = (label, value, colour) => {
    drawTextShadow(g, label, LX, y, '#5c5678', 1);
    drawTextShadow(g, value, LX + 92, y, colour || '#cfc7ee', 1);
    y += 12;
  };
  const wd = p.weaponDef ? p.weaponDef() : WEAPONS.whip;
  line('WEAPON', wd.name + '  ' + '+'.repeat(Math.max(0, p.whipLvl - 1)), '#c8a860');
  line('MASTERY', MASTERY_NAME[masteryRank(meta.mastery[p.weapon] || 0)], '#8ad0f0');
  line('LEVEL', 'LV' + p.level + '   ' + p.xp + '/' + p.xpNext + ' XP', '#ffe080');
  line('HEALTH', p.hp + ' / ' + p.maxHpTotal(), '#e08a8a');
  line('SUB-WEAPON', p.subWeapon ? SUBWEAPONS[p.subWeapon].name +
    (p.subInfusion ? '  (' + INFUSIONS[p.subInfusion].name + ')' : '') : 'NONE', '#cfc7ee');
  const combo = p.cardAction && p.cardAttr ? CARD_COMBOS[p.cardAction + '+' + p.cardAttr][0] : 'NONE BOUND';
  line('ARCANA', combo, '#c060e0');
  const relics = p.relics.filter(r => r).length;
  line('RELICS', relics + ' WORN, ' + p.bag.length + ' IN THE SATCHEL', '#cfc7ee');
  const perkN = Object.values(p.perks || {}).reduce((a, b) => a + b, 0);
  line('TECHNIQUES', perkN + ' RANKS LEARNED', '#8ad0a0');
  line('ORE', MATERIAL_KEYS.map(k => (p.materials[k] || 0)).join(' / '), '#b8d8f0');

  y += 4;
  const skills = SKILLS.filter(sk => p.skills[sk.key]);
  drawTextShadow(g, 'SKILLS  ' + skills.length + '/' + SKILLS.length, LX, y, '#5c5678', 1);
  y += 11;
  {
    let sx = LX, sy = y;
    for (const sk of skills) {
      const w2 = textWidth(sk.name, 1) + 10;
      if (sx + w2 > LX + LW - 24) { sx = LX; sy += 10; }
      drawTextShadow(g, sk.name, sx, sy, '#8a83a8', 1);
      sx += w2;
    }
    y = sy + 14;
  }
  if (game.curses.length) {
    drawTextShadow(g, 'CURSES  ' + game.curses.map(c => CURSES[c].name).join('  '),
      LX, y, '#e04040', 1);
  }

  // ---- right: every key the castle answers to
  const RX = VIEW_W - 400, RW = 350, RH = 300;
  let ry = 84;
  g.fillStyle = 'rgba(10,8,20,0.8)';
  g.fillRect(RX - 10, ry - 12, RW, RH);
  goldFrame(g, RX - 10, ry - 12, RW, RH);
  drawTextShadow(g, 'CONTROLS', RX, ry - 6, '#ffe080', 1);
  ry += 12;
  const key = (k, what) => {
    drawTextShadow(g, k, RX, ry, '#d8a848', 1);
    drawTextShadow(g, what, RX + 84, ry, '#8a83a8', 1);
    ry += 11;
  };
  key('LEFT / RIGHT', 'WALK');
  key('DOWN', 'CROUCH');
  key('DOWN + X', 'DROP THROUGH A LEDGE');
  key('X', 'JUMP  (AGAIN IN AIR)');
  key('Z', 'STRIKE');
  key('UP + Z', 'THROW THE SUB-WEAPON');
  key('DOWN + Z (AIR)', 'MOONLIT PLUNGE');
  key('HOLD Z', 'CHARGE THE CRESCENT');
  key('C', 'BACKDASH  /  DOWN+C SLIDE');
  key('C (AIR)', 'PHANTOM STEP');
  key('INTO A WALL', 'CLING;  X TO LEAP OFF');
  key('UP (IN A DRAUGHT)', 'RIDE IT;  DOWN TO SINK');
  ry += 6;
  key('UP', 'PRAY / TRADE / REST');
  key('Q AT A FORGE', 'THE FORGE MATRIX');
  key('1 - 9', 'DRAW A WEAPON');
  key('Q', 'ARCANA');
  key('I', 'SATCHEL');
  key('E', 'ITEM CRASH');
  key('TAB', 'CHART  (Z WARPS)');
  key('G', 'MARK THE CHART');
  key('N', 'BESTIARY');
  key('F', 'DEEDS');
  key('M', 'MUSIC     [ ]  VOLUME');
  key('F3', 'DEBUG OVERLAY');

  drawTextCentered(g, 'ENTER  RESUME THE HUNT', VIEW_W / 2, 410,
    ((game.time >> 4) & 1) ? '#ffe080' : '#8a6d2f', 1);
}

// ---------------------------------------------------------------- scene change
// The cut itself: a curtain of dark sweeping across in the direction you walked,
// and the name of the place you have entered, held for a moment afterwards.
function drawSceneCut(g) {
  if (game.sceneCut > 0) {
    const k = game.sceneCut / 16;                   // 1 -> 0
    const w = Math.round(VIEW_W * k);
    g.fillStyle = '#06040c';
    if (game.sceneDir > 0) g.fillRect(VIEW_W - w, 0, w, VIEW_H);
    else g.fillRect(0, 0, w, VIEW_H);
    // a lit edge running with it
    g.fillStyle = 'rgba(216,168,72,0.5)';
    const ex = game.sceneDir > 0 ? VIEW_W - w : w;
    g.fillRect(ex - 1, 0, 2, VIEW_H);
  }
  if (game.sceneNameT > 0 && game.scene) {
    const t = game.sceneNameT;
    const a = Math.min(1, Math.min(t, 190 - t) / 24);
    const sc = game.scene;
    const w = Math.max(textWidth(sc.name, 1), textWidth(sc.zoneName, 1)) + 40;
    const x = VIEW_W - w - 16, y = VIEW_H - 74;
    g.globalAlpha = a;
    g.fillStyle = 'rgba(8,6,15,0.78)';
    g.fillRect(x, y, w, 32);
    g.fillStyle = '#8a6d2f';
    g.fillRect(x, y, w, 1); g.fillRect(x, y + 31, w, 1);
    g.fillStyle = '#d8a848';
    g.fillRect(x, y, 2, 32); g.fillRect(x + w - 2, y, 2, 32);
    drawTextCentered(g, sc.zoneName, x + w / 2, y + 7, '#8a83a8', 1);
    drawTextCentered(g, sc.name, x + w / 2, y + 19, '#ffe080', 1);
    g.globalAlpha = 1;
  }
}
