import { mountGameFrame } from '../../packages/ui/src/gameFrame.js';
import { createAudio } from '../../packages/shared/src/audio.js';
import { safeLanding, groundAt } from './game-logic.js';

const shell = mountGameFrame({
  mount: document.getElementById('shell-mount'),
  config: {
    title: 'Neon Orbiter',
    subtitle: 'Alunissez en douceur, manche après manche.',
    renderHeader: () => {
      const options = document.createElement('div');
      options.className = 'game-options';
      options.setAttribute('aria-label', 'Options de jeu');
      const mk = (label, id, type = 'toggle', inner = '') => {
        const wrap = document.createElement('label');
        wrap.className = 'option';
        if (type === 'select') {
          wrap.append(`${label} `);
          const sel = document.createElement('select');
          sel.id = id; sel.setAttribute('aria-label', label); sel.innerHTML = inner; wrap.appendChild(sel);
        } else {
          const input = document.createElement('input');
          input.id = id; input.className = 'toggle'; input.type = 'checkbox';
          if (id === 'bonus') input.checked = true;
          wrap.append(` ${label} `, input);
        }
        return wrap;
      };
      options.append(
        mk('Difficulté', 'difficulty', 'select', '<option value="chill">Chill</option><option value="arcade" selected>Arcade</option><option value="chaos">Chaos</option>'),
        mk('Bonus', 'bonus'),
        mk('Sons', 'sound')
      );
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
          const stat = (label, id, value) => { const wrap = document.createElement('div'); wrap.className = 'panel-stat'; const small = document.createElement('small'); small.textContent = label; const strong = document.createElement('strong'); strong.id = id; strong.textContent = value; wrap.append(small, strong); return wrap; };
          stats.append(stat('SCORE', 'score', '0'), stat('RECORD', 'best', '0'), stat('CARBURANT', 'fuel', '100%'), stat('ÉTAT', 'status', 'Prêt'));
          panel.append(title, stats); return panel;
        },
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
          const help = document.createElement('p'); help.className = 'help'; help.textContent = '↑ ou Z / Espace : poussée • ← → ou Q D : incliner • P : pause';
          panel.append(title, actions, help); return panel;
        },
      },
    ],
    screen: {
      mount: (el) => {
        const canvas = document.createElement('canvas');
        canvas.id = 'game'; canvas.width = 800; canvas.height = 520; canvas.setAttribute('aria-label', 'Descente Neon Orbiter');
        el.appendChild(canvas);
      },
    },
  },
});

const canvas = shell.screen.querySelector('canvas');
const ctx = canvas.getContext('2d');
const $ = (s) => document.querySelector(s);
const difficultyInput = $('#difficulty');
const bonusInput = $('#bonus');
const soundInput = $('#sound');
const audio = createAudio(() => soundInput && soundInput.checked);

const W = canvas.width, H = canvas.height;
const DIFF = {
  chill: { gravity: 50, thrust: 160, fuel: 13, roundGain: 6 },
  arcade: { gravity: 60, thrust: 150, fuel: 11, roundGain: 8 },
  chaos: { gravity: 75, thrust: 145, fuel: 10, roundGain: 10 },
};

let state = 'ready', round = 1, score = 0, gravity = 60, best = Number(localStorage.getItem('neonOrbiterBest')) || 0, last = 0, elapsed = 0, shake = 0, terrain = [], pads = [], stars = [], particles = [], rings = [], banner = '', bannerTimer = 0, keys = new Set(), ship = { x: 110, y: 70, vx: 14, vy: 0, tilt: 0, fuel: 100 }, shipScale = 1;
$('#best').textContent = String(best);

function makeStars() {
  stars = Array.from({ length: 120 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    s: Math.random() < 0.15 ? 2.2 : 0.8 + Math.random() * 1.2,
    tw: Math.random() * Math.PI * 2,
    z: 0.3 + Math.random() * 0.7,
    vy: 4 + Math.random() * 10,
    vx: (Math.random() - 0.5) * 4,
  }));
}

function makeTerrain() {
  terrain = []; const n = 21;
  for (let i = 0; i <= n; i++) terrain.push({ x: i * 40, y: 400 + Math.random() * 80 });
  const specs = [{ seg: 3, m: 2 }, { seg: 2, m: 3 }, { seg: 1, m: 4 }];
  const count = round >= 3 ? 3 : 2;
  pads = [];
  for (let k = 0; k < count; k++) {
    const spec = specs[k], idx = 1 + Math.floor(Math.random() * (n - 2 - spec.seg));
    const baseY = terrain[idx].y;
    for (let i = idx; i <= idx + spec.seg; i++) terrain[i].y = baseY;
    const mult = spec.m * (bonusInput.checked ? 1 : 1);
    pads.push({ x0: terrain[idx].x, x1: terrain[idx + spec.seg].x, y: baseY, w: spec.seg * 40, m: mult });
  }
}

function reset() {
  const d = DIFF[difficultyInput.value] || DIFF.arcade;
  round = 1; score = 0; gravity = d.gravity; elapsed = 0; shake = 0; particles = []; rings = []; banner = ''; bannerTimer = 0; shipScale = 1;
  ship = { x: 110, y: 70, vx: 14, vy: 0, tilt: 0, fuel: 100 };
  makeTerrain();
  $('#score').textContent = '0'; $('#fuel').textContent = '100%'; $('#status').textContent = 'Prêt';
}

function start() { if (state === 'playing') return; reset(); state = 'playing'; $('#status').textContent = 'Descente • Manche 1'; audio.tone(440, 0.1, 'triangle', 0.03); }

function pause() {
  if (state === 'playing') { state = 'paused'; $('#status').textContent = 'Pause'; }
  else if (state === 'paused') { state = 'playing'; last = performance.now(); $('#status').textContent = 'Descente • Manche ' + round; }
  else if (state === 'ready') start();
}

function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 50 + Math.random() * 200;
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.4 + Math.random() * 0.45, color, s: 2 + Math.random() * 3 });
  }
}

function crash(reason) {
  burst(ship.x, ship.y, '#ff6dbe', 30); burst(ship.x, ship.y, '#ff8c42', 16);
  rings.push({ x: ship.x, y: ship.y, life: 0.6, crash: true });
  shake = 1; shipScale = 0.6; state = 'over'; $('#status').textContent = reason;
  audio.seq([[200, 0.12, 'sawtooth', 0.05, 0], [120, 0.25, 'sawtooth', 0.05, 0.06]]);
  if (score > best) { best = score; localStorage.setItem('neonOrbiterBest', String(best)); $('#best').textContent = String(best); }
}

function update(dt) {
  elapsed += dt; shake = Math.max(0, shake - dt * 3); bannerTimer = Math.max(0, bannerTimer - dt); shipScale += (1 - shipScale) * Math.min(1, dt * 8);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt; p.life -= dt; if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = rings.length - 1; i >= 0; i--) { rings[i].r = (rings[i].r || 8) + 90 * dt; if ((rings[i].life -= dt) <= 0) rings.splice(i, 1); }
  for (const s of stars) {
    s.y += s.vy * dt;
    s.x += s.vx * dt;
    if (s.y > H + 4) { s.y = -4; s.x = Math.random() * W; }
    if (s.x < -4) s.x = W + 4;
    if (s.x > W + 4) s.x = -4;
  }

  if (state !== 'playing') return;
  const d = DIFF[difficultyInput.value] || DIFF.arcade;
  const main = (keys.has(' ') || keys.has('arrowup') || keys.has('z') || keys.has('w')) && ship.fuel > 0;
  const side = (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('q') || keys.has('a') ? 1 : 0);
  ship.vy += gravity * dt;
  if (main) {
    ship.vx += Math.sin(ship.tilt) * d.thrust * dt; ship.vy -= Math.cos(ship.tilt) * d.thrust * dt; ship.fuel = Math.max(0, ship.fuel - d.fuel * dt);
    if (Math.random() < 0.5) audio.tone(120 + Math.random() * 40, 0.03, 'sawtooth', 0.01);
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
      const pts = 50 * pad.m + (bonusInput.checked ? Math.round(ship.fuel * 0.5) : 0);
      score += pts; $('#score').textContent = String(score);
      banner = `ALUNISSAGE ×${pad.m} +${pts}`; bannerTimer = 1.6;
      shipScale = 0.85;
      rings.push({ x: (pad.x0 + pad.x1) / 2, y: pad.y, life: 0.8, r: 8 }); burst(ship.x, ship.y - 8, '#69ffe1', 18);
      audio.seq([[520, 0.08, 'sine', 0.03, 0], [720, 0.1, 'sine', 0.03, 0.06]]);
      if (score > best) { best = score; localStorage.setItem('neonOrbiterBest', String(best)); $('#best').textContent = String(best); }
      round++; gravity = Math.min(130, d.gravity + round * d.roundGain);
      ship = { x: 80 + Math.random() * 100, y: 70, vx: 12 + round * 2, vy: 0, tilt: 0, fuel: 100 };
      makeTerrain(); $('#status').textContent = 'Descente • Manche ' + round;
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
  for (const s of stars) {
    ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(s.tw + t * 0.002)) * s.z;
    ctx.fillStyle = s.s > 1.8 ? '#ffffff' : '#d5e9ff';
    ctx.shadowColor = '#7af7e0';
    ctx.shadowBlur = s.s > 1.6 ? 7 : 0;
    ctx.fillRect(s.x, s.y, s.s, s.s);
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

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

  for (const r of rings) {
    ctx.globalAlpha = Math.max(0, r.life / 0.8);
    ctx.strokeStyle = r.crash ? '#ff6dbe' : '#69ffe1'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    if (r.crash) ctx.arc(r.x, r.y, r.r || 8, 0, Math.PI * 2);
    else ctx.arc(r.x, r.y - 4, r.r || 8, Math.PI, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.save(); ctx.translate(ship.x, ship.y); ctx.rotate(ship.tilt); ctx.scale(shipScale, shipScale);
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
