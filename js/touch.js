// On-screen touch controls for phones/tablets.
// This is a pure INPUT SHIM — it only sets the same `keys` (held) and `pending`
// (one-shot, edge) flags that the keyboard/gamepad set in game.js. No game logic
// lives here, so the overlay can never desync from the real control scheme.
//
// keys.*    : left/right/up/down/attack  — held true while a button is down
// pending.* : jump/whip/dash/enter/leftN/rightN/up/downN/q/crash/inv/map — cleared
//             at the end of every stepGame(), so setting one = a single "keypress".
(function () {
  'use strict';
  if (!window.TOUCH) return;                 // desktop / fine-pointer: no overlay

  const resume = () => { try { AudioSys.resume(); } catch (e) {} };

  // Up is driven by two buttons (the d-pad Up and the SUB button, which is
  // "hold Up + Attack"). Ref-count so one releasing doesn't cancel the other.
  let upDpad = false, subTimer = null;
  const setUp = () => { keys.up = upDpad || subTimer !== null; };

  // --- button table -------------------------------------------------------
  // press/release mutate the shared input flags exactly like a key would.
  const B = [
    // d-pad: each also fires the matching `pending.*N` edge so menus navigate
    { id: 'up',    pad: 'dpad', col: 2, row: 1, glyph: '▲',
      press: () => { upDpad = true; pending.up = true; setUp(); },
      release: () => { upDpad = false; setUp(); } },
    { id: 'left',  pad: 'dpad', col: 1, row: 2, glyph: '◀',
      press: () => { keys.left = true; pending.leftN = true; },
      release: () => { keys.left = false; } },
    { id: 'right', pad: 'dpad', col: 3, row: 2, glyph: '▶',
      press: () => { keys.right = true; pending.rightN = true; },
      release: () => { keys.right = false; } },
    { id: 'down',  pad: 'dpad', col: 2, row: 3, glyph: '▼',
      press: () => { keys.down = true; pending.downN = true; },
      release: () => { keys.down = false; } },

    // actions (right thumb). JUMP + ATK sit on the bottom row for easy reach.
    { id: 'sub',   pad: 'act', col: 1, row: 1, glyph: 'SUB', kind: 'act sub',
      press: () => {                       // hold-Up + Attack, Castlevania style
        pending.whip = true; resume();
        if (subTimer) clearTimeout(subTimer);
        subTimer = setTimeout(() => { subTimer = null; setUp(); }, 150);
        setUp();
      } },
    { id: 'dash',  pad: 'act', col: 2, row: 1, glyph: 'DSH', kind: 'act dash',
      press: () => { pending.dash = true; } },
    { id: 'atk',   pad: 'act', col: 1, row: 2, glyph: 'ATK', kind: 'act atk',
      press: () => { keys.attack = true; pending.whip = true; resume(); },
      release: () => { keys.attack = false; } },
    { id: 'jump',  pad: 'act', col: 2, row: 2, glyph: 'JMP', kind: 'act jump',
      press: () => { pending.jump = true; resume(); } },

    // utility (top-right). START = enter (begin run / pause / confirm menus).
    { id: 'start', pad: 'util', glyph: '☰', title: 'Start / Pause',
      press: () => { pending.enter = true; resume(); } },
    { id: 'heal',  pad: 'util', glyph: '✚', kind: 'heal', title: 'Drink Flask',
      press: () => { pending.heal = true; } },
    { id: 'cards', pad: 'util', glyph: '✦', title: 'Arcana',
      press: () => { pending.q = true; } },
    { id: 'crash', pad: 'util', glyph: '✷', title: 'Item Crash',
      press: () => { pending.crash = true; } },
    { id: 'bag',   pad: 'util', glyph: '▤', title: 'Satchel',
      press: () => { pending.inv = true; } },
    { id: 'map',   pad: 'util', glyph: '❖', title: 'Map',
      press: () => { pending.map = true; } },
  ];

  // --- styles -------------------------------------------------------------
  const css = `
  #tc { position: fixed; inset: 0; z-index: 50; pointer-events: none;
        touch-action: none; -webkit-user-select: none; user-select: none;
        -webkit-tap-highlight-color: transparent;
        font-family: monospace; font-weight: bold; }
  #tc .grp { position: absolute; display: grid; gap: 8px;
             padding: 10px;
             padding-left: max(10px, env(safe-area-inset-left));
             padding-right: max(10px, env(safe-area-inset-right));
             padding-bottom: max(10px, env(safe-area-inset-bottom));
             padding-top: max(8px, env(safe-area-inset-top)); }
  #tc .dpad { left: 0; bottom: 0; grid-template-columns: repeat(3, auto); }
  #tc .act  { right: 0; bottom: 0; grid-template-columns: repeat(2, auto); }
  #tc .util { right: 0; top: 0; display: flex; gap: 6px; }
  #tc button {
    pointer-events: auto; touch-action: none; margin: 0;
    -webkit-appearance: none; appearance: none;
    color: rgba(230, 224, 255, 0.85); font-family: inherit; font-weight: bold;
    background: rgba(26, 20, 48, 0.18);
    border: 1.5px solid rgba(170, 145, 240, 0.32);
    border-radius: 14px;
    display: flex; align-items: center; justify-content: center;
    line-height: 1; text-shadow: 0 1px 3px rgba(0,0,0,.85);
    backdrop-filter: blur(1.5px); -webkit-backdrop-filter: blur(1.5px);
    transition: background .05s, border-color .05s;
  }
  #tc button:active, #tc button.on {
    background: rgba(130, 100, 225, 0.4);
    border-color: rgba(210, 190, 255, 0.7);
    color: #fff;
  }
  #tc .dir { width: clamp(46px, 12vmin, 84px); height: clamp(46px, 12vmin, 84px);
             font-size: clamp(16px, 4.4vmin, 30px); border-radius: 12px; }
  #tc .act button { width: clamp(56px, 15vmin, 104px); height: clamp(56px, 15vmin, 104px);
                    border-radius: 50%; font-size: clamp(13px, 3.2vmin, 22px); }
  #tc .act .jump { background: rgba(60, 130, 95, 0.22); border-color: rgba(120, 235, 170, 0.42); }
  #tc .act .atk  { background: rgba(160, 65, 75, 0.22);  border-color: rgba(255, 140, 150, 0.42); }
  #tc .util button { width: clamp(34px, 8vmin, 54px); height: clamp(34px, 8vmin, 54px);
                     font-size: clamp(15px, 3.6vmin, 24px); border-radius: 10px;
                     background: rgba(18, 14, 36, 0.2); }
  #tc .util .heal { background: rgba(60, 130, 95, 0.26); border-color: rgba(120, 235, 170, 0.5);
                    color: #d6ffe6; }
  /* portrait: the game is a 16:9 landscape title — ask the player to rotate */
  #tc-rotate { position: fixed; inset: 0; z-index: 60; display: none;
    background: #08060f; color: #b9b0e0; pointer-events: auto;
    flex-direction: column; align-items: center; justify-content: center;
    text-align: center; font-family: monospace; gap: 14px; padding: 24px; }
  #tc-rotate .icon { font-size: 64px; animation: tcSpin 2.4s ease-in-out infinite; }
  #tc-rotate b { color: #e8e0ff; font-size: 20px; letter-spacing: 1px; }
  @keyframes tcSpin { 0%,55% { transform: rotate(0deg); } 80%,100% { transform: rotate(90deg); } }
  @media (orientation: portrait) {
    html.touch #tc-rotate { display: flex; }
    html.touch #tc { display: none; }   /* hide the controls until rotated */
  }`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // --- build overlay ------------------------------------------------------
  const root = document.createElement('div');
  root.id = 'tc';
  const groups = {
    dpad: mkGroup('grp dpad'),
    act:  mkGroup('grp act'),
    util: mkGroup('grp util'),
  };
  function mkGroup(cls) { const d = document.createElement('div'); d.className = cls; root.appendChild(d); return d; }

  for (const b of B) {
    const el = document.createElement('button');
    el.textContent = b.glyph;
    el.className = b.pad === 'dpad' ? 'dir' : (b.kind || '');
    if (b.col) { el.style.gridColumn = b.col; el.style.gridRow = b.row; }
    if (b.title) el.setAttribute('aria-label', b.title);
    el.oncontextmenu = e => { e.preventDefault(); return false; };
    bind(el, b);
    (b.pad === 'act' ? groups.act : b.pad === 'util' ? groups.util : groups.dpad).appendChild(el);
  }

  // rotate-to-landscape hint
  const rot = document.createElement('div');
  rot.id = 'tc-rotate';
  rot.innerHTML = '<div class="icon">↻</div><b>ROTATE YOUR DEVICE</b>' +
                  '<div>Moonfang Castle plays in landscape.</div>';
  document.body.appendChild(rot);
  document.body.appendChild(root);

  // --- pointer wiring -----------------------------------------------------
  // Track active pointer ids per button so a stray second finger on the same
  // button doesn't double-fire, and lifting either finger still releases cleanly.
  function bind(el, b) {
    const ids = new Set();
    const down = e => {
      e.preventDefault();
      const first = ids.size === 0;
      ids.add(e.pointerId);
      if (first) { el.classList.add('on'); if (b.press) b.press(); }
    };
    const up = e => {
      if (!ids.has(e.pointerId)) return;
      ids.delete(e.pointerId);
      if (ids.size === 0) { el.classList.remove('on'); if (b.release) b.release(); }
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  // A rotation can flip the coarse-pointer/orientation state — keep the canvas sized.
  window.addEventListener('orientationchange', () => { if (window.fitCanvas) setTimeout(window.fitCanvas, 250); });
})();
