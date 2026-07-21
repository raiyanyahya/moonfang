// Shared runtime systems: particles and floating combat text.

// ---------------------------------------------------------------- particles
const particles = [];

function spawnParticle(x, y, vx, vy, color, life, grav) {
  if (particles.length > 450) particles.shift();   // engine guard: cap the pool
  particles.push({ x, y, vx, vy, color, life, t: 0, grav: grav || 0 });
}

function burst(x, y, colors, n, spread, grav) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 0.4 + Math.random() * (spread || 1.6);
    spawnParticle(x, y, Math.cos(a) * s, Math.sin(a) * s - 0.6,
      colors[(Math.random() * colors.length) | 0], 20 + Math.random() * 20, grav === undefined ? 0.06 : grav);
  }
}

function flameBurst(x, y) {
  burst(x, y, ['#ff9020', '#ffd858', '#e04040', '#f8f8ff'], 14, 1.4, -0.02);
  // ash drifting up
  for (let i = 0; i < 5; i++) {
    spawnParticle(x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 8,
      (Math.random() - 0.5) * 0.4, -0.4 - Math.random() * 0.5, '#3a3644', 40, -0.005);
  }
}

const BLOOD_RED = ['#8a1622', '#5e0f18', '#c02535'];
const BLOOD_GREEN = ['#3f7a34', '#2a5424', '#5aa04a'];

function bloodBurst(x, y, dir, colors) {
  colors = colors || BLOOD_RED;
  for (let i = 0; i < 7; i++) {
    spawnParticle(x, y,
      dir * (0.4 + Math.random() * 1.6) + (Math.random() - 0.5) * 0.6,
      -0.5 - Math.random() * 1.4,
      colors[(Math.random() * colors.length) | 0], 24 + Math.random() * 14, 0.14);
  }
}

function burstRing(x, y, color) {
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    spawnParticle(x + Math.cos(a) * 5, y + Math.sin(a) * 5,
      Math.cos(a) * 1.9, Math.sin(a) * 1.9, color || '#c07af0', 18, 0);
  }
}

function dustPuff(x, y, n) {
  for (let i = 0; i < (n || 3); i++) {
    spawnParticle(x + (Math.random() - 0.5) * 6, y - Math.random() * 2,
      (Math.random() - 0.5) * 0.7, -0.2 - Math.random() * 0.3, '#57536e', 14 + Math.random() * 8, -0.01);
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.t++;
    p.x += p.vx; p.y += p.vy;
    p.vy += p.grav;
    if (p.t >= p.life) particles.splice(i, 1);
  }
}

function drawParticles(g, camX, camY) {
  for (const p of particles) {
    g.fillStyle = p.color;
    const s = p.t > p.life * 0.6 ? 1 : 2;
    g.fillRect(Math.floor(p.x - camX), Math.floor(p.y - camY), s, s);
  }
}


// floating damage numbers / text
const floaters = [];
function spawnFloater(x, y, txt, color) {
  floaters.push({ x, y, txt, color: color || '#f0f0ff', t: 0 });
}
function updateFloaters() {
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.t++;
    f.y -= 0.4;
    if (f.t > 42) floaters.splice(i, 1);
  }
}
function drawFloaters(g, camX, camY) {
  for (const f of floaters) {
    if (f.t > 32 && (f.t & 2)) continue;
    drawTextShadow(g, f.txt, Math.floor(f.x - camX - textWidth(f.txt, 1) / 2), Math.floor(f.y - camY), f.color, 1);
  }
}


// '#rrggbb' -> 'r,g,b' for building rgba() strings
function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
}
