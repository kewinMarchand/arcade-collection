import { mountGameFrame } from '../../packages/ui/src/gameFrame.js';
import { clamp, overlaps, nextLane } from './game-logic.js';

const shell = mountGameFrame({
  mount: document.getElementById('shell-mount'),
  config: {
    title: 'Neon Drift',
    subtitle: 'Glisse entre les portails, évite les obstacles.',
    panels: [
      {
        side: 'left',
        id: 'hud',
        render: () => {
          const panel = document.createElement('div');
          panel.className = 'neon-panel';
          panel.dataset.testid = 'game-panel-left';
          const title = document.createElement('h2');
          title.className = 'neon-panel__title';
          title.textContent = 'Statut';
          const stats = document.createElement('div');
          stats.className = 'panel-stats';
          const stat = (label, id, value) => {
            const wrap = document.createElement('div');
            wrap.className = 'panel-stat';
            const small = document.createElement('small'); small.textContent = label;
            const strong = document.createElement('strong'); strong.id = id; strong.textContent = value;
            wrap.append(small, strong); return wrap;
          };
          stats.append(stat('SCORE', 'score', '0'), stat('RECORD', 'best', '0'), stat('ÉTAT', 'status', 'Prêt'));
          panel.append(title, stats);
          return panel;
        },
      },
      {
        side: 'right',
        id: 'actions',
        render: () => {
          const panel = document.createElement('div');
          panel.className = 'neon-panel';
          panel.dataset.testid = 'game-panel-right';
          const title = document.createElement('h2');
          title.className = 'neon-panel__title';
          title.textContent = 'Actions';
          const actions = document.createElement('div');
          actions.className = 'panel-actions';
          const b = (id, text, cls) => { const btn = document.createElement('button'); btn.id = id; btn.type = 'button'; btn.textContent = text; if (cls) btn.className = cls; return btn; };
          actions.append(b('pause', 'Pause'), b('restart', 'Recommencer'), b('new-game', 'Nouvelle partie', 'primary'));
          const help = document.createElement('p');
          help.className = 'help';
          help.textContent = '← → ou A / D : piloter · Espace : démarrer · P : pause';
          panel.append(title, actions, help);
          return panel;
        },
      },
    ],
    screen: {
      mount: (el) => {
        const canvas = document.createElement('canvas');
        canvas.id = 'game';
        canvas.width = 800;
        canvas.height = 520;
        canvas.setAttribute('aria-label', 'Circuit Neon Drift');
        el.appendChild(canvas);
      },
    },
  },
});

const canvas = shell.screen.querySelector('canvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.querySelector('#score');
const bestEl = document.querySelector('#best');
const statusEl = document.querySelector('#status');
const W = canvas.width, H = canvas.height, HORIZON = 148, keys = new Set();
let state = 'ready', lane = 2, carX = 0, score = 0, best = Number(localStorage.getItem('neonDriftBest')) || 0, items = [], elapsed = 0, last = 0, spawn = 0.7, shake = 0, particles = [];
bestEl.textContent = String(best);
carX = W * 0.5;
const BOTTOM = [W * 0.212, W * 0.356, W * 0.5, W * 0.644, W * 0.788];
const BOUND = [W * 0.284, W * 0.428, W * 0.572, W * 0.716];
const ease = (p) => Math.pow(clamp(p, 0, 1), 1.7);

function lanePos(l, p) {
  const t = ease(p);
  return { x: W / 2 + (BOTTOM[l] - W / 2) * t, y: HORIZON + (H - 26 - HORIZON) * t, s: 0.12 + 0.88 * t };
}

function start() {
  state = 'playing'; lane = 2; carX = BOTTOM[2]; score = 0; elapsed = 0; spawn = 0.7; shake = 0; items = []; particles = []; statusEl.textContent = 'En course';
}

function pause() {
  if (state === 'playing') { state = 'paused'; statusEl.textContent = 'Pause'; }
  else if (state === 'paused') { state = 'playing'; last = performance.now(); statusEl.textContent = 'En course'; }
  else if (state === 'ready') start();
}

function burst(x, y, color, n, up) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 180;
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (up ? 120 : 0), life: 0.4 + Math.random() * 0.35, color, s: 2 + Math.random() * 3 });
  }
}

function update(dt) {
  if (state !== 'playing') return;
  elapsed += dt;
  score = Math.floor(elapsed * 12);
  carX += (BOTTOM[lane] - carX) * Math.min(1, dt * 9);
  spawn -= dt;
  if (spawn <= 0) {
    items.push({ lane: Math.floor(Math.random() * 5), p: 0, kind: Math.random() < 0.72 ? 'rock' : 'orb', spin: Math.random() * Math.PI * 2, collected: false });
    spawn = Math.max(0.34, 0.9 - elapsed * 0.004);
  }
  const v = 0.42 + Math.min(0.32, elapsed * 0.008);
  for (const o of items) { o.p += v * dt; o.spin += dt * 2; }
  items = items.filter((o) => o.p < 1.06 && !o.collected);
  const car = { x: carX - 20, y: H - 95, w: 40, h: 55 };
  for (const o of items) {
    if (o.p < 0.8) continue;
    const pos = lanePos(o.lane, o.p);
    const size = o.kind === 'orb' ? 36 : 42;
    const box = { x: pos.x - (size * pos.s) / 2, y: pos.y - (size * pos.s) / 2, w: size * pos.s, h: size * pos.s };
    if (!overlaps(car, box)) continue;
    if (o.kind === 'orb') {
      o.collected = true; score += 50; burst(pos.x, pos.y, '#ffd36b', 12, true);
    } else {
      burst(carX, H - 70, '#ff648f', 18); burst(pos.x, pos.y, '#ff648f', 10); shake = 1; state = 'over'; statusEl.textContent = 'Terminé';
    }
  }
  scoreEl.textContent = String(score);
  if (score > best) { best = score; bestEl.textContent = String(best); localStorage.setItem('neonDriftBest', String(best)); }
}

function drawRoad() {
  ctx.fillStyle = '#0b1836'; ctx.fillRect(0, 0, W, HORIZON);
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON); sky.addColorStop(0, '#101c3b'); sky.addColorStop(1, '#0b1836'); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, HORIZON);
  ctx.fillStyle = '#060a18'; ctx.fillRect(0, HORIZON, W, H - HORIZON);
  const glow = ctx.createLinearGradient(0, HORIZON - 26, 0, HORIZON + 8); glow.addColorStop(0, 'rgba(255,101,189,0)'); glow.addColorStop(1, 'rgba(255,101,189,.5)'); ctx.fillStyle = glow; ctx.fillRect(0, HORIZON - 26, W, 34);
  ctx.strokeStyle = '#ff64bc'; ctx.shadowColor = '#ff64bc'; ctx.shadowBlur = 14; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(W * 0.08, HORIZON); ctx.lineTo(W * 0.14, H - 26); ctx.moveTo(W * 0.92, HORIZON); ctx.lineTo(W * 0.86, H - 26); ctx.stroke();
  ctx.strokeStyle = '#35d9cc'; ctx.shadowColor = '#35d9cc'; ctx.shadowBlur = 8; ctx.lineWidth = 2;
  const off = (elapsed * 1.1) % 0.14;
  for (const b of BOUND) {
    for (let p = off; p < 1; p += 0.14) {
      const a = lanePos(1, p), c = lanePos(1, Math.min(1, p + 0.06));
      const x1 = W / 2 + (b - W / 2) * ease(p), x2 = W / 2 + (b - W / 2) * ease(Math.min(1, p + 0.06));
      ctx.beginPath(); ctx.moveTo(x1, a.y); ctx.lineTo(x2, c.y); ctx.stroke();
    }
  }
  ctx.shadowBlur = 0;
}

function drawRock(pos, spin) {
  const r = 22 * pos.s;
  ctx.save(); ctx.translate(pos.x, pos.y); ctx.rotate(spin * 0.3);
  ctx.fillStyle = '#ff648f'; ctx.shadowColor = '#ff648f'; ctx.shadowBlur = 15;
  ctx.beginPath();
  const pts = [[0, -1], [0.7, -0.55], [1, 0.05], [0.55, 0.8], [-0.35, 0.95], [-0.9, 0.3], [-0.6, -0.5]];
  pts.forEach(([px, py], i) => { const X = px * r, Y = py * r; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffd7e6'; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.35, r * 0.16, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1; ctx.restore(); ctx.shadowBlur = 0;
}

function drawOrb(pos, t) {
  const r = 17 * pos.s * (1 + 0.08 * Math.sin(t * 0.006 + pos.spin));
  ctx.fillStyle = '#ffd36b'; ctx.shadowColor = '#ffd36b'; ctx.shadowBlur = 18; ctx.beginPath(); ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff3c4'; ctx.lineWidth = 2 * pos.s; ctx.beginPath(); ctx.arc(pos.x, pos.y, r * 1.45, 0, Math.PI * 2); ctx.stroke();
  ctx.shadowBlur = 0; ctx.fillStyle = '#fffbe8'; ctx.beginPath(); ctx.arc(pos.x - r * 0.3, pos.y - r * 0.3, r * 0.28, 0, Math.PI * 2); ctx.fill();
}

function drawCar(t) {
  const tilt = (BOTTOM[lane] - carX) * 0.012;
  ctx.save(); ctx.translate(carX, H - 64); ctx.rotate(tilt);
  const fl = 10 + Math.random() * 14;
  ctx.fillStyle = t % 160 < 80 ? '#7df3ff' : '#c9fbff'; ctx.shadowColor = '#7df3ff'; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.moveTo(-14, 18); ctx.quadraticCurveTo(-10, 18 + fl, -6, 18); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(6, 18); ctx.quadraticCurveTo(10, 18 + fl, 14, 18); ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  const body = ctx.createLinearGradient(0, -30, 0, 22); body.addColorStop(0, '#ffffff'); body.addColorStop(0.32, '#caffed'); body.addColorStop(0.72, '#48e2c3'); body.addColorStop(1, '#137d6d');
  ctx.fillStyle = body; ctx.shadowColor = '#69ffe1'; ctx.shadowBlur = 18; ctx.beginPath(); ctx.roundRect(-20, -26, 40, 46, 18); ctx.fill(); ctx.shadowBlur = 0;
  ctx.fillStyle = '#237d73'; ctx.beginPath(); ctx.ellipse(0, -8, 9, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c2fff1'; ctx.beginPath(); ctx.ellipse(0, -11, 5, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#faffc4'; ctx.shadowColor = '#ffdc72'; ctx.shadowBlur = 8; ctx.fillRect(-16, 6, 4, 7); ctx.fillRect(12, 6, 4, 7); ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffffffa8'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.roundRect(-18, -24, 36, 42, 16); ctx.stroke();
  ctx.restore();
}

function draw(t) {
  ctx.clearRect(0, 0, W, H); ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * 14 * shake, (Math.random() - 0.5) * 10 * shake);
  drawRoad();
  items.slice().sort((a, b) => a.p - b.p).forEach((o) => { const pos = lanePos(o.lane, o.p); o.kind === 'rock' ? drawRock(pos, o.spin) : drawOrb(pos, t); });
  drawCar(t);
  for (const p of particles) { ctx.globalAlpha = Math.min(1, p.life * 2.2); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.s, p.s); }
  ctx.globalAlpha = 1;
  if (state === 'playing' && elapsed > 2) {
    ctx.strokeStyle = 'rgba(125,243,255,.35)'; ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const y = HORIZON + ((elapsed * 420 + i * 137) % (H - HORIZON));
      const sp = 1 - (y - HORIZON) / (H - HORIZON);
      ctx.globalAlpha = 0.35 * (1 - sp);
      ctx.beginPath();
      ctx.moveTo(W * 0.5 + (BOTTOM[lane] - W * 0.5) * ease(Math.min(1, sp + 0.02)), y);
      ctx.lineTo(W * 0.5 + (BOTTOM[lane] - W * 0.5) * ease(Math.max(0, sp - 0.05)), y + 34);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1; ctx.restore();
  if (state !== 'playing') {
    ctx.fillStyle = '#04100ddc'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.fillStyle = '#69ffe1'; ctx.font = '800 32px system-ui';
    ctx.fillText(state === 'ready' ? 'NEON DRIFT' : state === 'paused' ? 'PAUSE' : 'IMPACT', W / 2, H / 2);
    ctx.fillStyle = '#edfffa'; ctx.font = '16px system-ui';
    ctx.fillText(state === 'ready' ? 'Appuie sur Espace ou Nouvelle partie' : state === 'paused' ? 'Clique sur Pause pour reprendre' : 'Clique ou Recommencer pour retenter', W / 2, H / 2 + 34);
  }
}

function frame(t) {
  const dt = Math.min((t - last) / 1000 || 0, 0.04);
  last = t;
  shake = Math.max(0, shake - dt * 2);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.life -= dt; if (p.life <= 0) particles.splice(i, 1);
  }
  update(dt); draw(t); requestAnimationFrame(frame);
}

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (['arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  if (k === 'arrowleft' || k === 'a') lane = nextLane(lane, -1);
  if (k === 'arrowright' || k === 'd') lane = nextLane(lane, 1);
  if (k === ' ' && state !== 'playing') start();
  if (k === 'p') pause();
});

document.querySelector('#pause').onclick = pause;
document.querySelector('#restart').onclick = start;
document.querySelector('#new-game').onclick = start;
canvas.addEventListener('pointerdown', (e) => {
  if (state === 'over') { start(); return; }
  const r = canvas.getBoundingClientRect();
  lane = nextLane(lane, e.clientX < r.left + r.width / 2 ? -1 : 1);
  if (state === 'ready') start();
});
last = performance.now();
requestAnimationFrame(frame);
