import { mountGameFrame } from '../../packages/ui/src/gameFrame.js';

const $ = (s) => document.querySelector(s);

const shell = mountGameFrame({
  mount: document.getElementById('shell-mount'),
  config: {
    title: 'Neon Jumper',
    subtitle: 'Saute, collecte les noyaux et atteins le portail.',
    renderHeader: () => {
      const options = document.createElement('div');
      options.className = 'game-options';
      options.setAttribute('aria-label', 'Options de jeu');
      const sound = document.createElement('label');
      sound.className = 'option';
      const soundInput = document.createElement('input');
      soundInput.id = 'sound';
      soundInput.className = 'toggle';
      soundInput.type = 'checkbox';
      // sound off by default
      sound.append(' Sons ', soundInput);
      options.append(sound);
      return options;
    },
    panels: [
      {
        side: 'left', id: 'hud',
        render: () => {
          const panel = document.createElement('div');
          panel.className = 'neon-panel'; panel.dataset.testid = 'game-panel-left';
          const title = document.createElement('h2'); title.className = 'neon-panel__title'; title.textContent = 'Statut';
          const stats = document.createElement('div'); stats.className = 'panel-stats';
          const stat = (label, id, value) => { const w = document.createElement('div'); w.className = 'panel-stat'; const s = document.createElement('small'); s.textContent = label; const v = document.createElement('strong'); v.id = id; v.textContent = value; w.append(s, v); return w; };
          stats.append(stat('NOYAUX', 'score', '0'), stat('VIES', 'lives', '3'), stat('NIVEAU', 'level', '1'), stat('ÉTAT', 'status', 'Prêt'));
          panel.append(title, stats); return panel;
        }
      },
      {
        side: 'right', id: 'actions',
        render: () => {
          const panel = document.createElement('div');
          panel.className = 'neon-panel'; panel.dataset.testid = 'game-panel-right';
          const title = document.createElement('h2'); title.className = 'neon-panel__title'; title.textContent = 'Actions';
          const actions = document.createElement('div'); actions.className = 'panel-actions';
          const b = (id, text, cls) => { const btn = document.createElement('button'); btn.id = id; btn.type = 'button'; btn.textContent = text; if (cls) btn.className = cls; return btn; };
          actions.append(b('pause', 'Pause'), b('restart', 'Recommencer'), b('new-game', 'Nouvelle partie', 'primary'));
          const help = document.createElement('p'); help.className = 'help';
          help.textContent = '← → / Q D : bouger • ↑ / Z / W / Espace : sauter • P : pause • R : recommencer. Saute sur les drones pour les neutraliser.';
          panel.append(title, actions, help); return panel;
        }
      }
    ],
    screen: {
      mount: (el) => {
        const canvas = document.createElement('canvas');
        canvas.id = 'game'; canvas.width = 900; canvas.height = 560; canvas.setAttribute('aria-label', 'Zone de jeu Neon Jumper');
        el.appendChild(canvas);
      }
    }
  }
});

const canvas = shell.screen.querySelector('canvas');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

let soundOn = false;
const soundInput = () => $('#sound');
function tone(freq = 440, dur = 0.07, type = 'sine', vol = 0.03) {
  const inp = soundInput();
  if (!inp || !inp.checked) return;
  try {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const c = new C(); const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = vol;
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + dur);
    setTimeout(() => c.close && c.close(), (dur + 0.05) * 1000);
  } catch {}
}

const keys = new Set();
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (['arrowup','arrowdown','arrowleft','arrowright',' ','z','q','d','w'].includes(k)) e.preventDefault();
  keys.add(k);
  if (k === 'p') togglePause();
  if (k === 'r') resetGame();
  if ((k === ' ' || k === 'enter') && (state === 'ready' || state === 'over' || state === 'won')) startOrNext();
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
$('#pause').onclick = togglePause;
$('#restart').onclick = resetGame;
$('#new-game').onclick = () => { levelIndex = 0; resetGame(); };

let state = 'ready';
let levelIndex = 0;
let score = 0, lives = 3;
let player, platforms, enemies, coins, portal, particles, rings, shocks, floatTexts, stars;
let camShake = 0, flash = 0, elapsed = 0, last = 0;

function makeStars() {
  stars = Array.from({ length: 120 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() < 0.12 ? 2 : 1, a: 0.2 + Math.random() * 0.7, p: Math.random() * Math.PI * 2, sp: 0.5 + Math.random() * 1.2 }));
}

function levelData(i) {
  const base = [
    {
      platforms: [
        { x: 0, y: 500, w: 900, h: 60 },
        { x: 80, y: 410, w: 180, h: 22 },
        { x: 330, y: 350, w: 180, h: 22 },
        { x: 590, y: 290, w: 180, h: 22 },
        { x: 360, y: 220, w: 160, h: 22 },
        { x: 120, y: 170, w: 150, h: 22 },
      ],
      coins: [[140,370],[380,310],[640,250],[420,180],[170,130],[720,460]],
      enemies: [{ x: 360, y: 474, dir: 1, min: 300, max: 520 }, { x: 620, y: 264, dir: -1, min: 590, max: 740 }],
      portal: { x: 150, y: 110 }
    },
    {
      platforms: [
        { x: 0, y: 500, w: 900, h: 60 },
        { x: 40, y: 420, w: 150, h: 22 },
        { x: 240, y: 360, w: 140, h: 22 },
        { x: 430, y: 300, w: 140, h: 22 },
        { x: 620, y: 240, w: 140, h: 22 },
        { x: 430, y: 170, w: 140, h: 22 },
        { x: 220, y: 120, w: 140, h: 22 },
      ],
      coins: [[90,380],[280,320],[470,260],[660,200],[470,130],[260,80],[760,460],[520,460]],
      enemies: [{ x: 200, y: 474, dir: 1, min: 120, max: 360 }, { x: 640, y: 214, dir: -1, min: 620, max: 740 }, { x: 450, y: 144, dir: 1, min: 430, max: 550 }],
      portal: { x: 250, y: 60 }
    },
    {
      platforms: [
        { x: 0, y: 500, w: 900, h: 60 },
        { x: 700, y: 430, w: 160, h: 22 },
        { x: 520, y: 360, w: 140, h: 22 },
        { x: 320, y: 300, w: 140, h: 22 },
        { x: 120, y: 240, w: 140, h: 22 },
        { x: 320, y: 170, w: 140, h: 22 },
        { x: 520, y: 120, w: 140, h: 22 },
        { x: 720, y: 70, w: 120, h: 22 },
      ],
      coins: [[760,390],[560,320],[360,260],[160,200],[360,130],[560,80],[760,30],[120,460],[260,460]],
      enemies: [{ x: 150, y: 474, dir: 1, min: 80, max: 350 }, { x: 540, y: 474, dir: -1, min: 420, max: 700 }, { x: 340, y: 144, dir: 1, min: 320, max: 440 }],
      portal: { x: 760, y: 10 }
    }
  ];
  return base[i % base.length];
}

function resetPlayer() {
  player = { x: 60, y: 440, w: 34, h: 42, vx: 0, vy: 0, onGround: false, face: 1, squash: 1, stretch: 1, inv: 0, blink: 0 };
}

function loadLevel() {
  const d = levelData(levelIndex);
  platforms = d.platforms.map(p => ({ ...p }));
  coins = d.coins.map(([x,y]) => ({ x, y, r: 12, got: false, t: Math.random()*Math.PI*2 }));
  enemies = d.enemies.map(e => ({ ...e, y: e.y - 26, w: 38, h: 26, alive: true, t: Math.random()*10, squash: 1 }));
  portal = { ...d.portal, w: 44, h: 54, t: 0, active: false };
  particles = []; rings = []; shocks = []; floatTexts = [];
  camShake = 0; flash = 0; elapsed = 0;
  resetPlayer();
  updateHud();
}

function resetGame() {
  score = 0; lives = 3; state = 'ready';
  makeStars();
  loadLevel();
  $('#status').textContent = 'Prêt';
  draw(0);
}

function startOrNext() {
  if (state === 'won') { levelIndex = 0; score = 0; lives = 3; }
  if (state === 'over') { levelIndex = 0; score = 0; lives = 3; loadLevel(); }
  state = 'playing';
  $('#status').textContent = 'En jeu';
}

function togglePause() {
  if (state === 'playing') { state = 'paused'; $('#status').textContent = 'Pause'; }
  else if (state === 'paused') { state = 'playing'; $('#status').textContent = 'En jeu'; last = performance.now(); }
}

function updateHud() {
  $('#score').textContent = String(score);
  $('#lives').textContent = String(lives);
  $('#level').textContent = String(levelIndex + 1);
}

function addParticles(x, y, color, n = 12, sp = 160) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = sp * (0.4 + Math.random() * 0.8);
    particles.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s - 40*Math.random(), life: 0.3+Math.random()*0.4, max: 0.7, c: color, r: 2+Math.random()*3 });
  }
}
function addRing(x, y, color) { rings.push({ x, y, r: 6, life: 0.45, c: color }); }
function addShock(x, y, color) { shocks.push({ x, y, r: 4, life: 0.5, c: color }); }
function addFloat(x, y, text, color) { floatTexts.push({ x, y, text, color, life: 0.9, vy: -40 }); }

function rects(a,b){ return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y; }

function update(dt) {
  if (state !== 'playing') return;
  elapsed += dt;
  const left = keys.has('arrowleft') || keys.has('q') || keys.has('a');
  const right = keys.has('arrowright') || keys.has('d');
  const jump = keys.has('arrowup') || keys.has('z') || keys.has('w') || keys.has(' ');
  const accel = 1400, maxV = 260, friction = 0.82, gravity = 1500, jumpV = -560;
  if (left) { player.vx -= accel * dt; player.face = -1; }
  if (right) { player.vx += accel * dt; player.face = 1; }
  if (!left && !right) player.vx *= Math.pow(friction, dt * 60);
  player.vx = Math.max(-maxV, Math.min(maxV, player.vx));
  if (jump && player.onGround) {
    player.vy = jumpV; player.onGround = false; player.stretch = 1.25; player.squash = 0.8;
    addParticles(player.x + player.w/2, player.y + player.h, '#69ffe1', 10, 120); addRing(player.x + player.w/2, player.y + player.h, '#69ffe1');
    tone(420, 0.07, 'triangle', 0.02);
  }
  player.vy += gravity * dt;
  player.x += player.vx * dt;
  // horizontal collisions
  for (const p of platforms) {
    if (rects(player, p)) {
      if (player.vx > 0) player.x = p.x - player.w;
      else if (player.vx < 0) player.x = p.x + p.w;
      player.vx = 0;
    }
  }
  player.y += player.vy * dt;
  player.onGround = false;
  for (const p of platforms) {
    if (rects(player, p)) {
      if (player.vy > 0 && (player.y + player.h - player.vy * dt) <= p.y + 6) {
        player.y = p.y - player.h; player.vy = 0; player.onGround = true;
        if (Math.abs(player.vy) > 50 || true) { player.squash = 1.18; player.stretch = 0.86; addParticles(player.x + player.w/2, p.y, '#9dfff0', 6, 80); }
      } else if (player.vy < 0) {
        player.y = p.y + p.h; player.vy = 0; addRing(player.x + player.w/2, p.y + p.h, '#69ffe1');
      }
    }
  }
  player.squash += (1 - player.squash) * Math.min(1, dt * 10);
  player.stretch += (1 - player.stretch) * Math.min(1, dt * 10);
  if (player.inv > 0) { player.inv -= dt; player.blink += dt; }
  player.x = Math.max(0, Math.min(W - player.w, player.x));
  if (player.y > H + 40) { hurt(); }

  for (const c of coins) {
    if (c.got) continue;
    c.t += dt;
    const dx = (player.x + player.w/2) - c.x, dy = (player.y + player.h/2) - c.y;
    if (dx*dx + dy*dy < (c.r + 18)*(c.r + 18)) {
      c.got = true; score += 10; updateHud();
      addParticles(c.x, c.y, '#ffd36b', 14, 140); addRing(c.x, c.y, '#ffd36b'); addFloat(c.x, c.y - 10, '+10', '#ffd36b');
      tone(760, 0.06, 'sine', 0.02);
    }
  }

  for (const e of enemies) {
    if (!e.alive) continue;
    e.t += dt;
    e.x += e.dir * 70 * dt;
    if (e.x < e.min) { e.x = e.min; e.dir = 1; }
    if (e.x > e.max) { e.x = e.max; e.dir = -1; }
    e.squash += (1 - e.squash) * Math.min(1, dt * 8);
    const eb = { x: e.x, y: e.y, w: e.w, h: e.h };
    if (rects(player, eb) && player.inv <= 0) {
      const prevBottom = (player.y - player.vy * dt) + player.h;
      if (player.vy > 0 && prevBottom <= e.y + 10) {
        e.alive = false; player.vy = jumpV * 0.55; score += 25; updateHud();
        addParticles(e.x + e.w/2, e.y + e.h/2, '#ff6fae', 22, 220); addRing(e.x + e.w/2, e.y + e.h/2, '#ff6fae'); addShock(e.x + e.w/2, e.y + e.h/2, '#ff9fce');
        addFloat(e.x + e.w/2, e.y - 8, 'STOMP +25', '#ff9fce');
        camShake = 0.25; tone(220, 0.12, 'square', 0.03);
      } else {
        hurt();
      }
    }
  }

  portal.t += dt;
  portal.active = enemies.every(e => !e.alive) && coins.every(c => c.got);
  if (portal.active && rects(player, { x: portal.x, y: portal.y, w: portal.w, h: portal.h })) {
    state = 'levelclear';
    addParticles(portal.x + portal.w/2, portal.y + portal.h/2, '#69ffe1', 30, 200); addShock(portal.x + portal.w/2, portal.y + portal.h/2, '#69ffe1');
    tone(660, 0.12, 'triangle', 0.03); tone(880, 0.18, 'triangle', 0.03);
    setTimeout(() => {
      levelIndex++;
      if (levelIndex >= 3) { state = 'won'; $('#status').textContent = 'Victoire'; }
      else { state = 'playing'; $('#status').textContent = 'En jeu'; loadLevel(); }
    }, 900);
  }

  camShake = Math.max(0, camShake - dt);
  flash = Math.max(0, flash - dt * 2);
  updateFx(dt);
}

function hurt() {
  if (player.inv > 0) return;
  lives--; updateHud();
  player.inv = 1.4; camShake = 0.35; flash = 1;
  addParticles(player.x + player.w/2, player.y + player.h/2, '#ff648f', 20, 200); addShock(player.x + player.w/2, player.y + player.h/2, '#ff648f');
  tone(160, 0.18, 'sawtooth', 0.04);
  if (lives <= 0) { state = 'over'; $('#status').textContent = 'Perdu'; }
  else { resetPlayer(); }
}

function updateFx(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 320 * dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.life -= dt; r.r += 140 * dt; if (r.life <= 0) rings.splice(i, 1); }
  for (let i = shocks.length - 1; i >= 0; i--) { const s = shocks[i]; s.life -= dt; s.r += 180 * dt; if (s.life <= 0) shocks.splice(i, 1); }
  for (let i = floatTexts.length - 1; i >= 0; i--) { const f = floatTexts[i]; f.life -= dt; f.y += f.vy * dt; if (f.life <= 0) floatTexts.splice(i, 1); }
}

function drawBackground(t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0c211d'); g.addColorStop(0.52, '#071713'); g.addColorStop(1, '#06100f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const neb = (x,y,r,c) => { const rg = ctx.createRadialGradient(x,y,0,x,y,r); rg.addColorStop(0,c); rg.addColorStop(1,'transparent'); ctx.fillStyle = rg; ctx.fillRect(x-r,y-r,r*2,r*2); };
  neb(180 + Math.sin(t*0.00017)*40, 180, 260, 'rgba(0,224,165,0.11)');
  neb(720, 260 + Math.cos(t*0.00013)*30, 240, 'rgba(36,185,155,0.12)');
  ctx.save(); ctx.strokeStyle = 'rgba(155,255,240,0.06)'; ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.restore();
  for (const s of stars) {
    const tw = 0.55 + 0.45 * Math.sin(t*0.002*s.sp + s.p);
    ctx.globalAlpha = s.a * tw;
    ctx.fillStyle = s.r > 1 ? '#baffeb' : '#f2fffc';
    ctx.fillRect(s.x, s.y, s.r, s.r);
  }
  ctx.globalAlpha = 1;
}

function drawPlatform(p) {
  const r = 8;
  ctx.save();
  ctx.shadowColor = '#2fe8c8'; ctx.shadowBlur = 10;
  const g = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
  g.addColorStop(0, '#1b4250'); g.addColorStop(1, '#0e2430');
  ctx.fillStyle = g;
  ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(p.x, p.y, p.w, p.h, r); else ctx.rect(p.x, p.y, p.w, p.h); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(105,255,225,0.55)'; ctx.lineWidth = 2; ctx.stroke();
  // top glow strip
  ctx.fillStyle = 'rgba(105,255,225,0.85)'; ctx.fillRect(p.x + 8, p.y + 3, p.w - 16, 3);
  // panel lines/details
  ctx.strokeStyle = 'rgba(105,255,225,0.18)'; ctx.lineWidth = 1;
  for (let x = p.x + 18; x < p.x + p.w - 10; x += 26) { ctx.beginPath(); ctx.moveTo(x, p.y + 8); ctx.lineTo(x, p.y + p.h - 4); ctx.stroke(); }
  // bolts
  ctx.fillStyle = '#dffcff';
  for (const bx of [p.x + 10, p.x + p.w - 10]) { ctx.beginPath(); ctx.arc(bx, p.y + p.h/2, 2.2, 0, Math.PI*2); ctx.fill(); }
  ctx.restore();
}

function drawPlayer(p) {
  if (p.inv > 0 && Math.floor(p.blink * 12) % 2 === 0) return;
  ctx.save();
  ctx.translate(p.x + p.w/2, p.y + p.h);
  ctx.scale(p.squash * p.face, p.stretch);
  ctx.translate(0, -p.h/2);
  // thruster
  const flame = 6 + Math.sin(performance.now()*0.02) * 3 + (p.onGround ? 0 : 5);
  const eg = ctx.createLinearGradient(0, 12, 0, 22 + flame);
  eg.addColorStop(0, '#fff3a0'); eg.addColorStop(0.4, '#73ffe2cc'); eg.addColorStop(1, 'rgba(0,185,152,0)');
  ctx.fillStyle = eg; ctx.beginPath(); ctx.moveTo(-8, 14); ctx.lineTo(0, 22 + flame); ctx.lineTo(8, 14); ctx.closePath(); ctx.fill();
  // body hull
  ctx.shadowColor = '#69ffe1'; ctx.shadowBlur = 14;
  const bg = ctx.createLinearGradient(0, -18, 0, 16);
  bg.addColorStop(0, '#eaffff'); bg.addColorStop(0.4, '#7fffe5'); bg.addColorStop(1, '#1b8f7b');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(-14, -16, 28, 28, 10); ctx.fill();
  ctx.shadowBlur = 0;
  // chest panel
  ctx.fillStyle = 'rgba(8,30,28,0.7)'; ctx.beginPath(); ctx.roundRect(-8, -4, 16, 12, 4); ctx.fill();
  ctx.fillStyle = '#69ffe1'; ctx.fillRect(-5, -1, 10, 3);
  // dome/cockpit
  const cg = ctx.createRadialGradient(-2, -10, 2, 0, -8, 10);
  cg.addColorStop(0, '#ffffff'); cg.addColorStop(1, 'rgba(140,240,255,0.3)');
  ctx.fillStyle = cg; ctx.beginPath(); ctx.ellipse(0, -9, 9, 7, 0, Math.PI, 0); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(0, -9, 9, 7, 0, Math.PI, 0); ctx.stroke();
  // eye/visor light
  ctx.fillStyle = '#0a1f1d'; ctx.beginPath(); ctx.ellipse(4, -8, 2.2, 1.6, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#bafff3'; ctx.fillRect(3.2, -8.6, 1.2, 1.2);
  // side fins
  ctx.fillStyle = '#2dd6b8'; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-20, 8); ctx.lineTo(-12, 10); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(20, 8); ctx.lineTo(12, 10); ctx.closePath(); ctx.fill();
  // feet/landing pads
  ctx.fillStyle = '#184a42'; ctx.fillRect(-11, 14, 8, 4); ctx.fillRect(3, 14, 8, 4);
  ctx.fillStyle = '#69ffe1'; ctx.fillRect(-10, 17, 6, 2); ctx.fillRect(4, 17, 6, 2);
  ctx.restore();
}

function drawEnemy(e) {
  if (!e.alive) return;
  const bob = Math.sin(e.t * 3) * 2;
  ctx.save();
  ctx.translate(e.x + e.w/2, e.y + e.h/2 + bob);
  ctx.scale(e.squash, 2 - e.squash);
  ctx.shadowColor = '#ff6fae'; ctx.shadowBlur = 14;
  // hull
  const g = ctx.createLinearGradient(0, -12, 0, 12);
  g.addColorStop(0, '#ff9fce'); g.addColorStop(1, '#c83d7a');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(18, -2); ctx.lineTo(14, 10); ctx.lineTo(-14, 10); ctx.lineTo(-18, -2); ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  // wings
  ctx.fillStyle = '#ff79b6'; ctx.fillRect(-22, -2, 6, 8); ctx.fillRect(16, -2, 6, 8);
  // cockpit
  ctx.fillStyle = 'rgba(255,240,250,0.9)'; ctx.beginPath(); ctx.ellipse(0, -3, 6, 4, 0, 0, Math.PI*2); ctx.fill();
  // eyes/sensors
  ctx.fillStyle = '#2a0012'; ctx.beginPath(); ctx.arc(-5, 2, 2.2, 0, Math.PI*2); ctx.arc(5, 2, 2.2, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillRect(-5.5, 1.2, 1, 1); ctx.fillRect(4.5, 1.2, 1, 1);
  // thruster
  ctx.fillStyle = '#ffd36b'; ctx.shadowColor = '#ffd36b'; ctx.shadowBlur = 8; ctx.beginPath(); ctx.ellipse(0, 12, 5, 2.5, 0, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawCoin(c, t) {
  if (c.got) return;
  const bob = Math.sin(t*0.004 + c.t) * 4;
  ctx.save();
  ctx.translate(c.x, c.y + bob);
  ctx.rotate(t*0.002);
  ctx.shadowColor = '#ffd36b'; ctx.shadowBlur = 16;
  const g = ctx.createRadialGradient(-3,-3,2,0,0,c.r);
  g.addColorStop(0, '#fff7c8'); g.addColorStop(0.5, '#ffd36b'); g.addColorStop(1, '#ff9f2a');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0,0,c.r,0,Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0,0,c.r-3,0,Math.PI*2); ctx.stroke();
  // core symbol
  ctx.fillStyle = '#7a4200'; ctx.beginPath(); ctx.moveTo(0,-5); ctx.lineTo(4,0); ctx.lineTo(0,5); ctx.lineTo(-4,0); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawPortal(p, t) {
  const cx = p.x + p.w/2, cy = p.y + p.h/2;
  const active = p.active;
  const col = active ? '#69ffe1' : '#5f7c86';
  ctx.save();
  ctx.translate(cx, cy);
  // base pad
  ctx.fillStyle = active ? 'rgba(105,255,225,0.18)' : 'rgba(90,120,130,0.12)';
  ctx.beginPath(); ctx.ellipse(0, p.h/2 - 2, 28, 8, 0, 0, Math.PI*2); ctx.fill();
  // frame
  ctx.shadowColor = col; ctx.shadowBlur = active ? 18 : 6;
  ctx.strokeStyle = col; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.roundRect(-p.w/2, -p.h/2, p.w, p.h, 12); ctx.stroke();
  // inner energy
  const ig = ctx.createLinearGradient(0, -p.h/2, 0, p.h/2);
  if (active) { ig.addColorStop(0, 'rgba(105,255,225,0.15)'); ig.addColorStop(0.5, 'rgba(105,255,225,0.5)'); ig.addColorStop(1, 'rgba(105,255,225,0.15)'); }
  else { ig.addColorStop(0, 'rgba(80,100,110,0.1)'); ig.addColorStop(1, 'rgba(80,100,110,0.2)'); }
  ctx.fillStyle = ig; ctx.beginPath(); ctx.roundRect(-p.w/2+5, -p.h/2+5, p.w-10, p.h-10, 8); ctx.fill();
  // swirl/scan
  if (active) {
    ctx.save(); ctx.beginPath(); ctx.roundRect(-p.w/2+6, -p.h/2+6, p.w-12, p.h-12, 7); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
    const y = ((t*0.08) % (p.h)) - p.h/2;
    ctx.beginPath(); ctx.moveTo(-p.w/2, y); ctx.lineTo(p.w/2, y+10); ctx.stroke();
    ctx.restore();
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff'; ctx.font = '700 11px "DM Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(active ? 'EXIT' : 'LOCK', 0, 0);
  ctx.restore();
}

function drawFx() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.c; ctx.shadowColor = p.c; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.5 + p.life/p.max), 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  for (const r of rings) {
    ctx.globalAlpha = Math.max(0, r.life / 0.45);
    ctx.strokeStyle = r.c; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI*2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const s of shocks) {
    ctx.globalAlpha = Math.max(0, s.life / 0.5) * 0.6;
    ctx.strokeStyle = s.c; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const f of floatTexts) {
    ctx.globalAlpha = Math.max(0, f.life / 0.9);
    ctx.fillStyle = f.color; ctx.font = '700 14px "Space Grotesk", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function drawOverlay(t) {
  if (state === 'playing') return;
  ctx.fillStyle = 'rgba(2,8,12,0.72)'; ctx.fillRect(0,0,W,H);
  ctx.textAlign = 'center';
  ctx.shadowColor = '#69ffe1'; ctx.shadowBlur = 18; ctx.fillStyle = '#69ffe1';
  ctx.font = '800 40px "Space Grotesk", sans-serif';
  let title = 'NEON JUMPER', sub = 'Espace / ↑ pour commencer';
  if (state === 'paused') { title = 'PAUSE'; sub = 'P pour reprendre'; }
  else if (state === 'over') { title = 'MISSION ÉCHOUÉE'; sub = 'Espace pour recommencer'; ctx.fillStyle = '#ff719c'; ctx.shadowColor = '#ff719c'; }
  else if (state === 'won') { title = 'SECTEUR TERMINÉ'; sub = 'Bravo ! Espace pour rejouer'; ctx.fillStyle = '#78ffd0'; ctx.shadowColor = '#78ffd0'; }
  else if (state === 'levelclear') { title = 'NIVEAU TERMINÉ'; sub = 'Portail franchi !'; ctx.fillStyle = '#78ffd0'; ctx.shadowColor = '#78ffd0'; }
  ctx.fillText(title, W/2, H/2 - 10);
  ctx.shadowBlur = 0; ctx.fillStyle = '#e8fbff'; ctx.font = '16px "Space Grotesk", sans-serif';
  ctx.fillText(sub, W/2, H/2 + 28);
}

function draw(t) {
  ctx.save();
  if (camShake > 0) ctx.translate((Math.random()-0.5)*10*camShake, (Math.random()-0.5)*8*camShake);
  drawBackground(t);
  for (const p of platforms) drawPlatform(p);
  drawPortal(portal, t);
  for (const c of coins) drawCoin(c, t);
  for (const e of enemies) drawEnemy(e);
  drawPlayer(player);
  drawFx();
  drawOverlay(t);
  if (flash > 0) { ctx.globalAlpha = flash * 0.35; ctx.fillStyle = '#ff648f'; ctx.fillRect(0,0,W,H); ctx.globalAlpha = 1; }
  ctx.restore();
}

function loop(t) {
  const dt = Math.min((t - last) / 1000 || 0, 0.05); last = t;
  update(dt);
  draw(t);
  requestAnimationFrame(loop);
}

resetGame();
requestAnimationFrame(loop);
