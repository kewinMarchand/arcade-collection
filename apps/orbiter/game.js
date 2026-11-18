import { mountGameFrame } from '../../packages/ui/src/gameFrame.js';
import { safeLanding, padBonus, groundAt } from './game-logic.js';

const shell = mountGameFrame({
  mount: document.getElementById('shell-mount'),
  config: {
    title: 'Neon Orbiter',
    subtitle: 'Alunissez en douceur, manche après manche.',
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
          stats.append(stat('SCORE', 'score', '0'), stat('RECORD', 'best', '0'), stat('CARBURANT', 'fuel', '100%'), stat('ÉTAT', 'status', 'Prêt'));
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
          help.textContent = '↑ ou Z / Espace : poussée · ← → ou Q D : incliner · P : pause';
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
        canvas.setAttribute('aria-label', 'Descente Neon Orbiter');
        el.appendChild(canvas);
      },
    },
  },
});

const canvas = shell.screen.querySelector('canvas');
const ctx = canvas.getContext('2d');
const $ = (s) => document.querySelector(s);
const W = canvas.width, H = canvas.height;
let state = 'ready', round = 1, score = 0, bonus = 0, gravity = 60, best = Number(localStorage.getItem('neonOrbiterBest')) || 0, last = 0, elapsed = 0, shake = 0, terrain = [], pads = [], stars = [], particles = [], rings = [], banner = '', bannerTimer = 0, keys = new Set(), ship = { x: 110, y: 70, vx: 14, vy: 0, tilt: 0, fuel: 100 };
$('#best').textContent = String(best);

function makeStars() { stars = Array.from({ length: 80 }, () => ({ x: Math.random() * W, y: Math.random() * 300, s: Math.random() < 0.15 ? 2 : 1, tw: Math.random() * Math.PI * 2 })); }

function makeTerrain() {
  terrain = []; const n = 21;
  for (let i = 0; i <= n; i++) terrain.push({ x: i * 40, y: 400 + Math.random() * 80 });
  const specs = [{ seg: 3, m: 2 }, { seg: 2, m: 3 }, { seg: 1, m: 4 }], count = round >= 3 ? 3 : 2;
  pads = [];
  for (let k = 0; k < count; k++) {
    const spec = specs[k], idx = 1 + Math.floor(Math.random() * (n - 2 - spec.seg));
    for (let i = idx; i <= idx + spec.seg; i++) terrain[i].y = terrain[idx].y;
    pads.push({ x0: terrain[idx].x, x1: terrain[idx + spec.seg].x, y: terrain[idx].y, w: spec.seg * 40, m: spec.m });
  }
}

function reset() {
  round = 1; score = 0; bonus = 0; gravity = 60; elapsed = 0; shake = 0; particles = []; rings = []; banner = ''; bannerTimer = 0;
  ship = { x: 110, y: 70, vx: 14, vy: 0, tilt: 0, fuel: 100 };
  makeTerrain();
  $('#score').textContent = '0'; $('#fuel').textContent = '100%'; $('#status').textContent = 'Prêt';
}

function start() { if (state === 'playing') return; reset(); state = 'playing'; $('#status').textContent = 'Descente · Manche 1'; }

function pause() {
  if (state === 'playing') { state = 'paused'; $('#status').textContent = 'Pause'; }
  else if (state === 'paused') { state = 'playing'; last = performance.now(); $('#status').textContent = 'Descente · Manche ' + round; }
  else if (state === 'ready') start();
}

function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 50 + Math.random() * 190;
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.4 + Math.random() * 0.45, color, s: 2 + Math.random() * 3 });
  }
}

function crash(reason) {
  burst(ship.x, ship.y, '#ff6dbe', 26); burst(ship.x, ship.y, '#ff8c42', 14); shake = 1; state = 'over'; $('#status').textContent = reason;
  if (score > best) { best = score; localStorage.setItem('neonOrbiterBest', String(best)); $('#best').textContent = String(best); }
}

function update(dt) {
  elapsed += dt; shake = Math.max(0, shake - dt * 3); bannerTimer = Math.max(0, bannerTimer - dt);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt; p.life -= dt; if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = rings.length - 1; i >= 0; i--) if ((rings[i].life -= dt) <= 0) rings.splice(i, 1);
  if (state !== 'playing') return;
  const main = (keys.has(' ') || keys.has('arrowup') || keys.has('z') || keys.has('w')) && ship.fuel > 0;
  const side = (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('q') || keys.has('a') ? 1 : 0);
  ship.vy += gravity * dt;
  if (main) {
    ship.vx += Math.sin(ship.tilt) * 150 * dt; ship.vy -= Math.cos(ship.tilt) * 150 * dt; ship.fuel = Math.max(0, ship.fuel - 11 * dt);
    for (let k = 0; k < 2; k++) particles.push({ x: ship.x + Math.sin(ship.tilt) * -12 + (Math.random() - 0.5) * 6, y: ship.y + Math.cos(ship.tilt) * 12, vx: Math.sin(ship.tilt) * -80 + (Math.random() - 0.5) * 50, vy: Math.cos(ship.tilt) * 80, life: 0.25 + Math.random() * 0.2, color: Math.random() < 0.5 ? '#ffd166' : '#ff8c42', s: 2 + Math.random() * 2 });
  }
  if (side && ship.fuel > 0) { ship.tilt += side * 1.7 * dt; ship.vx += side * 36 * dt; ship.fuel = Math.max(0, ship.fuel - 4 * dt); }
  ship.tilt = Math.max(-0.9, Math.min(0.9, ship.tilt));
  ship.x += ship.vx * dt; ship.y += ship.vy * dt;
  if (ship.x < -20) ship.x = W + 20; if (ship.x > W + 20) ship.x = -20;
  $('#fuel').textContent = Math.round(ship.fuel) + '%';
  const g = groundAt(terrain, ship.x);
  if (ship.y + 15 >= g) {
    const pad = pads.find((p) => ship.x >= p.x0 + 6 && ship.x <= p.x1 - 6);
    if (pad && safeLanding({ vy: ship.vy, vx: ship.vx, tilt: ship.tilt })) {
      const pts = 50 * pad.m; score += pts; $('#score').textContent = String(score);
      banner = `ALUNISSAGE ×${pad.m} +${pts}`; bannerTimer = 1.6;
      rings.push({ x: (pad.x0 + pad.x1) / 2, y: pad.y, life: 0.8 }); burst(ship.x, ship.y - 8, '#69ffe1', 16);
      if (score > best) { best = score; localStorage.setItem('neonOrbiterBest', String(best)); $('#best').textContent = String(best); }
      round++; gravity = Math.min(125, 60 + round * 8); ship = { x: 80 + Math.random() * 100, y: 70, vx: 12 + round * 2, vy: 0, tilt: 0, fuel: 100 };
      makeTerrain(); $('#status').textContent = 'Descente · Manche ' + round;
    } else {
      const padNear = pads.find((p) => ship.x >= p.x0 - 10 && ship.x <= p.x1 + 10);
      crash(padNear ? 'Vitesse trop élevée !' : 'Écrasement !');
    }
  }
}

function draw(t) {
  ctx.clearRect(0, 0, W, H); ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * 12 * shake, (Math.random() - 0.5) * 8 * shake);
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0c1a33'); bg.addColorStop(1, '#061013'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  for (const s of stars) { ctx.globalAlpha = 0.3 + 0.6 * Math.abs(Math.sin(s.tw + t * 0.002)); ctx.fillStyle = '#d5e9ff'; ctx.fillRect(s.x, s.y, s.s, s.s); }
  ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.moveTo(terrain[0].x, terrain[0].y);
  for (const p of terrain) ctx.lineTo(p.x, p.y);
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
  ctx.fillStyle = '#0a1524'; ctx.fill();
  ctx.strokeStyle = '#35d9cc'; ctx.shadowColor = '#35d9cc'; ctx.shadowBlur = 10; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(terrain[0].x, terrain[0].y); for (const p of terrain) ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.shadowBlur = 0;
  for (const p of pads) {
    const pulse = 0.6 + 0.4 * Math.sin(t * 0.006);
    ctx.strokeStyle = '#ffe36e'; ctx.shadowColor = '#ffe36e'; ctx.shadowBlur = 14 * pulse; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(p.x0, p.y); ctx.lineTo(p.x1, p.y); ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffe36e'; ctx.font = '800 14px system-ui'; ctx.textAlign = 'center'; ctx.fillText('×' + p.m, (p.x0 + p.x1) / 2, p.y - 12);
  }
  for (const r of rings) { ctx.globalAlpha = r.life; ctx.strokeStyle = '#69ffe1'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(r.x, r.y - 4, (0.8 - r.life) * 70 + 8, Math.PI, Math.PI * 2); ctx.stroke(); }
  ctx.globalAlpha = 1;
  ctx.save(); ctx.translate(ship.x, ship.y); ctx.rotate(ship.tilt);
  const main = (keys.has(' ') || keys.has('arrowup') || keys.has('z') || keys.has('w')) && ship.fuel > 0 && state === 'playing';
  if (main) {
    const fl = 12 + Math.random() * 10; const fg = ctx.createLinearGradient(0, 10, 0, 10 + fl); fg.addColorStop(0, '#fff3a0'); fg.addColorStop(1, '#ff8c4200');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(-5, 10); ctx.lineTo(0, 10 + fl); ctx.lineTo(5, 10); ctx.closePath(); ctx.fill();
  }
  const body = ctx.createLinearGradient(0, -14, 0, 10); body.addColorStop(0, '#ffffff'); body.addColorStop(0.5, '#caffed'); body.addColorStop(1, '#2bbfa3');
  ctx.fillStyle = body; ctx.shadowColor = '#69ffe1'; ctx.shadowBlur = 16; ctx.beginPath(); ctx.roundRect(-10, -13, 20, 24, 8); ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffffffb0'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.roundRect(-8, -11, 16, 20, 7); ctx.stroke();
  ctx.fillStyle = '#c2fff1'; ctx.beginPath(); ctx.ellipse(0, -3, 4, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#caffed'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-7, 9); ctx.lineTo(-12, 16); ctx.moveTo(7, 9); ctx.lineTo(12, 16); ctx.stroke();
  ctx.fillStyle = '#faffc4'; ctx.fillRect(-12, 14, 5, 2.5); ctx.fillRect(7, 14, 5, 2.5);
  ctx.restore();
  for (const p of particles) { ctx.globalAlpha = Math.min(1, p.life * 2.2); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.s, p.s); }
  ctx.globalAlpha = 1;
  if (bannerTimer > 0 && state === 'playing') {
    ctx.globalAlpha = Math.min(1, bannerTimer * 2); ctx.textAlign = 'center'; ctx.font = '900 24px system-ui'; ctx.fillStyle = '#d9ff76'; ctx.shadowColor = '#d9ff76'; ctx.shadowBlur = 18;
    ctx.fillText(banner, W / 2, 60); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  }
  ctx.restore();
  if (state !== 'playing') {
    ctx.fillStyle = '#04100ddc'; ctx.fillRect(0, 0, W, H); ctx.textAlign = 'center'; ctx.fillStyle = '#69ffe1'; ctx.font = '800 32px system-ui';
    ctx.fillText(state === 'ready' ? 'NEON ORBITER' : state === 'paused' ? 'PAUSE' : 'ÉCRASEMENT', W / 2, H / 2);
    ctx.fillStyle = '#edfffa'; ctx.font = '16px system-ui';
    ctx.fillText(state === 'ready' ? 'Espace pour entamer la descente' : state === 'paused' ? 'Clique sur Pause pour reprendre' : 'Clique ou Recommencer pour retenter', W / 2, H / 2 + 34);
  }
}

function frame(t) { const dt = Math.min((t - last) / 1000 || 0, 0.04); last = t; update(dt); draw(t); requestAnimationFrame(frame); }

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
  keys.add(k);
  if (k === ' ' && state !== 'playing') start();
  if (k === 'p') pause();
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());
canvas.addEventListener('pointerdown', () => { if (state === 'ready' || state === 'over') start(); });
$('#pause').onclick = pause; $('#restart').onclick = start; $('#new-game').onclick = start;
makeStars(); reset(); requestAnimationFrame(frame);
