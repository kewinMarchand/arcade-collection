import { mountGameFrame } from '../../packages/ui/src/gameFrame.js';

const $ = (s) => document.querySelector(s);

const shell = mountGameFrame({
  mount: document.getElementById('shell-mount'),
  config: {
    title: 'Neon Sorter',
    subtitle: 'Trie les modules identiques et expédie les conteneurs.',
    renderHeader: () => {
      const options = document.createElement('div');
      options.className = 'game-options';
      options.setAttribute('aria-label', 'Options de jeu');
      const sound = document.createElement('label');
      sound.className = 'option';
      const soundInput = document.createElement('input');
      soundInput.id = 'sound'; soundInput.className = 'toggle'; soundInput.type = 'checkbox';
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
          stats.append(stat('SCORE', 'score', '0'), stat('EXPÉDITIONS', 'ships', '0'), stat('NIVEAU', 'level', '1'), stat('ÉTAT', 'status', 'Prêt'));
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
          help.textContent = 'Clique un module exposé pour le placer dans la zone tampon (7 places). Trois modules identiques dans la tampon s\'expédient automatiquement. Ne laisse pas la tampon se remplir !';
          panel.append(title, actions, help); return panel;
        }
      }
    ],
    screen: {
      mount: (el) => {
        const canvas = document.createElement('canvas');
        canvas.id = 'game'; canvas.width = 900; canvas.height = 560; canvas.setAttribute('aria-label', 'Zone de jeu Neon Sorter');
        el.appendChild(canvas);
      }
    }
  }
});

const canvas = shell.screen.querySelector('canvas');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

function tone(freq = 440, dur = 0.07, type = 'sine', vol = 0.03) {
  const inp = $('#sound');
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

const TYPES = [
  { id: 0, name: 'Réacteur', color: '#69ffe1', accent: '#2ad1b6' },
  { id: 1, name: 'Cristal',  color: '#ffd36b', accent: '#ff9f2a' },
  { id: 2, name: 'Capsule',  color: '#ff6fae', accent: '#d43f83' },
  { id: 3, name: 'Drone',    color: '#8b8bff', accent: '#5b5bd6' },
  { id: 4, name: 'Noyau',    color: '#7cff7a', accent: '#39c93a' },
  { id: 5, name: 'Antenne',  color: '#ff9b5f', accent: '#d66a2f' },
];

let state = 'ready';
let score = 0, shipped = 0, level = 1;
let stacks = []; // each stack: array of type ids (top at end)
let buffer = []; // max 7
let particles = [], rings = [], floatTexts = [], stars = [];
let anims = []; // moving item animations
let last = 0, shake = 0, flash = 0;

function makeStars() {
  stars = Array.from({ length: 120 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() < 0.12 ? 2 : 1, a: 0.2 + Math.random() * 0.7, p: Math.random() * Math.PI * 2, sp: 0.5 + Math.random() * 1.2 }));
}

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

function setupLevel() {
  buffer = [];
  particles = []; rings = []; floatTexts = []; anims = []; shake = 0; flash = 0;
  const typeCount = Math.min(3 + level, TYPES.length);
  const groups = Math.min(6 + level, 12); // each group = 3 items of same type to be cleared
  const pool = [];
  for (let i = 0; i < groups; i++) {
    const t = i % typeCount;
    pool.push(t, t, t);
  }
  shuffle(pool);
  const stackCount = Math.min(8 + Math.floor(level/2), 12);
  stacks = Array.from({ length: stackCount }, () => []);
  // deal into stacks
  let idx = 0;
  while (idx < pool.length) {
    stacks[idx % stackCount].push(pool[idx++]);
  }
  // ensure not all empty weirdness; trim empties
  stacks = stacks.filter(s => s.length > 0);
}

function resetGame(full = true) {
  if (full) { score = 0; shipped = 0; level = 1; }
  state = 'ready';
  makeStars();
  setupLevel();
  updateHud();
  $('#status').textContent = 'Prêt';
}

function updateHud() {
  $('#score').textContent = String(score);
  $('#ships').textContent = String(shipped);
  $('#level').textContent = String(level);
}

function addParticles(x, y, color, n = 14, sp = 160) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = sp * (0.4 + Math.random() * 0.8);
    particles.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s - 30*Math.random(), life: 0.35+Math.random()*0.45, max: 0.8, c: color, r: 2+Math.random()*3 });
  }
}
function addRing(x, y, color) { rings.push({ x, y, r: 8, life: 0.5, c: color }); }
function addFloat(x, y, text, color) { floatTexts.push({ x, y, text, color, life: 1.0, vy: -38 }); }

function stackLayout() {
  const cols = stacks.length;
  const margin = 40;
  const usable = W - margin*2;
  const spacing = Math.min(90, usable / Math.max(1, cols));
  const startX = W/2 - (spacing*(cols-1))/2;
  const baseY = 330;
  return stacks.map((s, i) => ({ x: startX + i*spacing, y: baseY, stack: s }));
}

function bufferSlots() {
  const n = 7; const w = 64; const gap = 12; const total = n*w + (n-1)*gap;
  const sx = W/2 - total/2; const y = 455;
  return Array.from({ length: n }, (_, i) => ({ x: sx + i*(w+gap), y, w, h: 54 }));
}

function hitStack(mx, my) {
  const layout = stackLayout();
  for (let i = layout.length - 1; i >= 0; i--) {
    const L = layout[i]; const s = L.stack; if (!s.length) continue;
    const topIdx = s.length - 1;
    const ix = L.x, iy = L.y - topIdx * 26;
    if (mx >= ix-28 && mx <= ix+28 && my >= iy-22 && my <= iy+22) return i;
  }
  return -1;
}

function tryPickupFromStack(i) {
  if (state === 'ready') { state = 'playing'; $('#status').textContent = 'En jeu'; }
  if (state !== 'playing') return;
  const s = stacks[i]; if (!s || !s.length) return;
  if (buffer.length >= 7) { shake = 0.25; flash = 1; tone(120, 0.12, 'sawtooth', 0.04); return; }
  const layout = stackLayout();
  const L = layout[i];
  const from = { x: L.x, y: L.y - (s.length - 1) * 26 };
  const type = s.pop();
  const slots = bufferSlots();
  const targetIndex = buffer.length;
  const to = { x: slots[targetIndex].x + slots[targetIndex].w/2, y: slots[targetIndex].y + slots[targetIndex].h/2 };
  anims.push({ type, x: from.x, y: from.y, tx: to.x, ty: to.y, t: 0, dur: 0.18, onDone: () => placeInBuffer(type, to) });
  addRing(from.x, from.y, TYPES[type].color);
  tone(320 + type*40, 0.05, 'triangle', 0.02);
}

function placeInBuffer(type, pos) {
  buffer.push(type);
  addParticles(pos.x, pos.y, TYPES[type].color, 8, 90);
  // check for triple
  let matched = true;
  while (matched) {
    matched = false;
    const counts = {};
    for (const t of buffer) counts[t] = (counts[t]||0)+1;
    for (const k in counts) {
      if (counts[k] >= 3) {
        matched = true;
        const t = Number(k);
        let removed = 0;
        const newBuf = [];
        for (const b of buffer) { if (b === t && removed < 3) removed++; else newBuf.push(b); }
        buffer = newBuf;
        shipped++; score += 30 + level*5; updateHud();
        const slots = bufferSlots();
        const cx = W/2, cy = slots[0].y - 30;
        addParticles(cx, cy, TYPES[t].color, 28, 220); addRing(cx, cy, TYPES[t].color); addRing(cx, cy, '#ffffff');
        addFloat(cx, cy - 10, `EXPÉDIÉ +${30+level*5}`, TYPES[t].color);
        shake = 0.18;
        tone(520, 0.08, 'sine', 0.03); tone(740, 0.1, 'sine', 0.03);
        break;
      }
    }
  }
  if (buffer.length >= 7) {
    state = 'over'; $('#status').textContent = 'Saturé';
    shake = 0.4; flash = 1; tone(140, 0.25, 'sawtooth', 0.05);
  }
  // win level
  const remaining = stacks.some(s => s.length > 0) || buffer.length > 0;
  if (!remaining && state === 'playing') {
    state = 'win';
    $('#status').textContent = 'Niveau terminé';
    score += 100; updateHud();
    addParticles(W/2, H/2, '#69ffe1', 40, 260); addRing(W/2, H/2, '#69ffe1');
    tone(660, 0.1, 'triangle', 0.03); tone(880, 0.16, 'triangle', 0.03);
    setTimeout(() => { level++; resetGame(false); state = 'playing'; $('#status').textContent = 'En jeu'; }, 1200);
  }
}

canvas.addEventListener('click', (e) => {
  if (state === 'over' || state === 'win') { resetGame(true); return; }
  if (state === 'paused') return;
  const r = canvas.getBoundingClientRect();
  const mx = (e.clientX - r.left) * W / r.width;
  const my = (e.clientY - r.top) * H / r.height;
  const si = hitStack(mx, my);
  if (si !== -1) tryPickupFromStack(si);
});

window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === 'p') { if (state === 'playing') { state = 'paused'; $('#status').textContent = 'Pause'; } else if (state === 'paused') { state = 'playing'; $('#status').textContent = 'En jeu'; last = performance.now(); } }
  if (k === 'r') resetGame(true);
  if ((k === ' ' || k === 'enter') && state === 'ready') { state = 'playing'; $('#status').textContent = 'En jeu'; }
});
$('#pause').onclick = () => { if (state === 'playing') { state = 'paused'; $('#status').textContent = 'Pause'; } else if (state === 'paused') { state = 'playing'; $('#status').textContent = 'En jeu'; last = performance.now(); } };
$('#restart').onclick = () => resetGame(true);
$('#new-game').onclick = () => resetGame(true);

function drawBackground(t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0c211d'); g.addColorStop(0.52, '#071713'); g.addColorStop(1, '#06100f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const neb = (x,y,r,c) => { const rg = ctx.createRadialGradient(x,y,0,x,y,r); rg.addColorStop(0,c); rg.addColorStop(1,'transparent'); ctx.fillStyle = rg; ctx.fillRect(x-r,y-r,r*2,r*2); };
  neb(200 + Math.sin(t*0.00017)*30, 160, 260, 'rgba(0,224,165,0.11)');
  neb(700, 220 + Math.cos(t*0.00013)*20, 240, 'rgba(36,185,155,0.12)');
  ctx.save(); ctx.strokeStyle = 'rgba(155,255,240,0.06)'; ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.restore();
  for (const s of stars) {
    const tw = 0.55 + 0.45 * Math.sin(t*0.002*s.sp + s.p);
    ctx.globalAlpha = s.a * tw; ctx.fillStyle = s.r > 1 ? '#baffeb' : '#f2fffc'; ctx.fillRect(s.x, s.y, s.r, s.r);
  }
  ctx.globalAlpha = 1;
}

function drawModule(x, y, type, scale = 1, highlight = false) {
  const t = TYPES[type]; const c = t.color; const a = t.accent;
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  if (highlight) { ctx.shadowColor = c; ctx.shadowBlur = 16; }
  // base container (detailed module crate/capsule, not a simple prism)
  const body = ctx.createLinearGradient(0, -18, 0, 18);
  body.addColorStop(0, '#1f3a46'); body.addColorStop(1, '#10232d');
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.roundRect(-22, -18, 44, 36, 8); ctx.fill();
  ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.stroke();
  // inner panel
  ctx.fillStyle = 'rgba(8,20,26,0.85)'; ctx.beginPath(); ctx.roundRect(-16, -12, 32, 24, 5); ctx.fill();
  // top hinge/bolts
  ctx.fillStyle = '#dffcff';
  for (const bx of [-14, 14]) { ctx.beginPath(); ctx.arc(bx, -14, 1.8, 0, Math.PI*2); ctx.fill(); }
  // type-specific detailed icon
  ctx.shadowColor = c; ctx.shadowBlur = 10;
  if (t.id === 0) { // reactor
    ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0,0,7,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0,0,3,0,Math.PI*2); ctx.fill();
    for (let i=0;i<3;i++){ const ang=i*Math.PI*2/3; ctx.beginPath(); ctx.moveTo(Math.cos(ang)*3,Math.sin(ang)*3); ctx.lineTo(Math.cos(ang)*9,Math.sin(ang)*9); ctx.stroke(); }
  } else if (t.id === 1) { // crystal
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0,-10); ctx.lineTo(8,-2); ctx.lineTo(5,9); ctx.lineTo(-5,9); ctx.lineTo(-8,-2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0,-10); ctx.lineTo(0,9); ctx.moveTo(-8,-2); ctx.lineTo(8,-2); ctx.stroke();
  } else if (t.id === 2) { // capsule
    const cg = ctx.createLinearGradient(-6,-8,6,8); cg.addColorStop(0,'#fff'); cg.addColorStop(1,c);
    ctx.fillStyle = cg; ctx.beginPath(); ctx.roundRect(-6,-9,12,18,6); ctx.fill();
    ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-6,0); ctx.lineTo(6,0); ctx.stroke();
  } else if (t.id === 3) { // drone
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0,-8); ctx.lineTo(10,0); ctx.lineTo(0,8); ctx.lineTo(-10,0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0,0,2.5,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-14,-4); ctx.lineTo(-10,0); ctx.lineTo(-14,4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(14,-4); ctx.lineTo(10,0); ctx.lineTo(14,4); ctx.stroke();
  } else if (t.id === 4) { // core
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0,0,8,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0,0,4,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-10,0); ctx.lineTo(10,0); ctx.moveTo(0,-10); ctx.lineTo(0,10); ctx.stroke();
  } else { // antenna
    ctx.strokeStyle = c; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0,8); ctx.lineTo(0,-6); ctx.stroke();
    ctx.beginPath(); ctx.arc(0,-8,3,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-8,-2); ctx.quadraticCurveTo(0,-10,8,-2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-6,3); ctx.quadraticCurveTo(0,-4,6,3); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0,-8,1.5,0,Math.PI*2); ctx.fill();
  }
  ctx.shadowBlur = 0;
  // bottom status light
  ctx.fillStyle = c; ctx.globalAlpha = 0.9; ctx.fillRect(-8, 14, 16, 2.5); ctx.globalAlpha = 1;
  ctx.restore();
}

function draw(t) {
  ctx.save();
  if (shake > 0) ctx.translate((Math.random()-0.5)*10*shake, (Math.random()-0.5)*8*shake);
  drawBackground(t);

  // staging area label
  ctx.fillStyle = 'rgba(232,251,255,0.7)'; ctx.font = '600 14px "Space Grotesk", sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('Zone de tri — clique les modules exposés', W/2, 46);

  // stacks
  const layout = stackLayout();
  layout.forEach((L) => {
    const s = L.stack;
    // base pad
    ctx.save();
    ctx.fillStyle = 'rgba(105,255,225,0.08)'; ctx.strokeStyle = 'rgba(105,255,225,0.18)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(L.x, L.y + 24, 26, 8, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.restore();
    for (let j = 0; j < s.length; j++) {
      const isTop = j === s.length - 1;
      drawModule(L.x, L.y - j * 26, s[j], 1, isTop);
    }
  });

  // buffer label
  ctx.fillStyle = 'rgba(232,251,255,0.7)'; ctx.font = '600 14px "Space Grotesk", sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('Tampon d\'expédition (3 identiques = expédié)', W/2, 420);
  // buffer slots
  const slots = bufferSlots();
  slots.forEach((sl, i) => {
    ctx.save();
    ctx.fillStyle = 'rgba(10,30,36,0.7)'; ctx.strokeStyle = 'rgba(105,255,225,0.25)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(sl.x, sl.y, sl.w, sl.h, 10); ctx.fill(); ctx.stroke();
    // inner glow line
    ctx.strokeStyle = 'rgba(105,255,225,0.12)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(sl.x+4, sl.y+4, sl.w-8, sl.h-8, 7); ctx.stroke();
    ctx.restore();
    if (buffer[i] !== undefined) drawModule(sl.x + sl.w/2, sl.y + sl.h/2, buffer[i], 0.95, false);
  });

  // anims
  for (const a of anims) drawModule(a.x, a.y, a.type, 1, true);

  // particles
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.c; ctx.shadowColor = p.c; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.5 + p.life/p.max), 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  for (const r of rings) { ctx.globalAlpha = Math.max(0, r.life/0.5); ctx.strokeStyle = r.c; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI*2); ctx.stroke(); }
  ctx.globalAlpha = 1;
  for (const f of floatTexts) { ctx.globalAlpha = Math.max(0, f.life); ctx.fillStyle = f.color; ctx.font = '700 15px "Space Grotesk", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(f.text, f.x, f.y); }
  ctx.globalAlpha = 1;

  // overlays
  if (state !== 'playing') {
    ctx.fillStyle = 'rgba(2,8,12,0.72)'; ctx.fillRect(0,0,W,H);
    ctx.textAlign = 'center'; ctx.shadowColor = '#69ffe1'; ctx.shadowBlur = 18; ctx.fillStyle = '#69ffe1';
    ctx.font = '800 40px "Space Grotesk", sans-serif';
    let title = 'NEON SORTER', sub = 'Clique pour commencer à trier';
    if (state === 'paused') { title = 'PAUSE'; sub = 'P pour reprendre'; }
    else if (state === 'over') { title = 'TAMPON SATURÉ'; sub = 'Clique ou R pour recommencer'; ctx.fillStyle = '#ff719c'; ctx.shadowColor = '#ff719c'; }
    else if (state === 'win') { title = 'NIVEAU TERMINÉ'; sub = 'Préparation du niveau suivant...'; ctx.fillStyle = '#78ffd0'; ctx.shadowColor = '#78ffd0'; }
    ctx.fillText(title, W/2, H/2 - 10);
    ctx.shadowBlur = 0; ctx.fillStyle = '#e8fbff'; ctx.font = '16px "Space Grotesk", sans-serif';
    ctx.fillText(sub, W/2, H/2 + 28);
  }
  if (flash > 0) { ctx.globalAlpha = flash * 0.3; ctx.fillStyle = '#ff648f'; ctx.fillRect(0,0,W,H); ctx.globalAlpha = 1; }
  ctx.restore();
}

function update(dt) {
  for (let i = anims.length - 1; i >= 0; i--) {
    const a = anims[i]; a.t += dt; const p = Math.min(1, a.t / a.dur); const e = 1 - Math.pow(1-p, 3);
    a.x = a.x + (a.tx - a.x) * Math.min(1, dt * 12);
    a.y = a.y + (a.ty - a.y) * Math.min(1, dt * 12);
    if (p >= 1 || (Math.abs(a.x-a.tx)<1 && Math.abs(a.y-a.ty)<1)) { const done = a.onDone; anims.splice(i,1); if (done) done(); }
  }
  for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.life -= dt; p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 260*dt; if (p.life <= 0) particles.splice(i,1); }
  for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.life -= dt; r.r += 150*dt; if (r.life <= 0) rings.splice(i,1); }
  for (let i = floatTexts.length - 1; i >= 0; i--) { const f = floatTexts[i]; f.life -= dt; f.y += f.vy*dt; if (f.life <= 0) floatTexts.splice(i,1); }
  shake = Math.max(0, shake - dt); flash = Math.max(0, flash - dt * 2.5);
}

function loop(t) {
  const dt = Math.min((t - last) / 1000 || 0, 0.05); last = t;
  update(dt); draw(t); requestAnimationFrame(loop);
}

resetGame(true);
requestAnimationFrame(loop);
