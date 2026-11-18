import { mountGameFrame } from '../../packages/ui/src/gameFrame.js';
import { createAudio } from '../../packages/shared/src/audio.js';
import { obstacleHits } from './game-logic.js';

const shell = mountGameFrame({
  mount: document.getElementById('shell-mount'),
  config: {
    title: 'Neon Runner',
    subtitle: 'Saute, glisse et tiens le rythme.',
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
          sel.id = id;
          sel.setAttribute('aria-label', label);
          sel.innerHTML = inner;
          wrap.appendChild(sel);
        } else {
          const input = document.createElement('input');
          input.id = id;
          input.className = 'toggle';
          input.type = 'checkbox';
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
          help.textContent = 'Espace / ↑ : sauter • ↓ : glisser • P : pause';
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
        canvas.setAttribute('aria-label', 'Parcours Neon Runner');
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
const difficultyInput = document.querySelector('#difficulty');
const bonusInput = document.querySelector('#bonus');
const soundInput = document.querySelector('#sound');
const audio = createAudio(() => soundInput && soundInput.checked);

const W = 800, H = 520, ground = 420;
const DIFF = {
  chill: { baseSpeed: 240, gain: 3, spawn: 1.25, spawnMin: 0.75 },
  arcade: { baseSpeed: 280, gain: 4, spawn: 1.1, spawnMin: 0.6 },
  chaos: { baseSpeed: 340, gain: 6, spawn: 0.9, spawnMin: 0.45 },
};

let state = 'ready', player = { y: ground - 48, vy: 0, slide: 0, angle: 0, squash: 1 }, obstacles = [], orbs = [], score = 0, best = Number(localStorage.getItem('prismRunnerBest')) || 0, last = 0, elapsed = 0, spawn = 1.2, orbSpawn = 2.2, shake = 0, particles = [], trail = [], scroll = 0, crouchHeld = false, pulses = [];
bestEl.textContent = String(best);

function start() {
  const d = DIFF[difficultyInput.value] || DIFF.arcade;
  state = 'playing'; player = { y: ground - 48, vy: 0, slide: 0, angle: 0, squash: 1 }; obstacles = []; orbs = []; score = 0; elapsed = 0; spawn = d.spawn * 0.7; orbSpawn = 1.8; shake = 0; particles = []; trail = []; pulses = []; statusEl.textContent = 'En course';
  audio.tone(520, 0.08, 'triangle', 0.03);
}

function pause() {
  if (state === 'playing') { state = 'paused'; statusEl.textContent = 'Pause'; }
  else if (state === 'paused') { state = 'playing'; last = performance.now(); statusEl.textContent = 'En course'; }
  else if (state === 'ready') start();
}

function jump() {
  if (state === 'ready') { start(); return; }
  if (state === 'over') { start(); return; }
  if (state === 'playing' && player.y >= ground - 48) {
    player.vy = -640;
    player.squash = 1.18;
    for (let i = 0; i < 8; i++) particles.push({ x: 120 + Math.random() * 40, y: ground - 4, vx: (Math.random() - 0.5) * 140, vy: -Math.random() * 110, life: 0.35, color: '#7bffe5', s: 2 + Math.random() * 2 });
    audio.tone(520, 0.06, 'square', 0.025);
  }
}

function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 180;
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.4 + Math.random() * 0.35, color, s: 2 + Math.random() * 3 });
  }
}

function ring(x, y, color) { pulses.push({ x, y, r: 6, life: 0.35, color }); }

function speedNow() {
  const d = DIFF[difficultyInput.value] || DIFF.arcade;
  return d.baseSpeed + Math.min(260, elapsed * d.gain);
}

function update(dt) {
  shake = Math.max(0, shake - dt * 2.5);
  player.squash += (1 - player.squash) * Math.min(1, dt * 10);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 220 * dt; p.life -= dt; if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = pulses.length - 1; i >= 0; i--) { pulses[i].r += 110 * dt; if ((pulses[i].life -= dt) <= 0) pulses.splice(i, 1); }
  if (state !== 'playing') return;

  const d = DIFF[difficultyInput.value] || DIFF.arcade;
  const sp = speedNow();
  elapsed += dt;
  score = Math.floor(elapsed * 10);
  scroll += dt * sp;
  player.vy += 1500 * dt;
  player.y += player.vy * dt;
  const landed = player.y > ground - 48 && player.vy > 0;
  if (landed) {
    player.y = ground - 48;
    if (player.vy > 320) {
      player.squash = 0.82;
      for (let i = 0; i < 8; i++) particles.push({ x: 120 + Math.random() * 40, y: ground - 2, vx: (Math.random() - 0.5) * 160, vy: -Math.random() * 70, life: 0.28, color: '#8b8bff', s: 2 });
      audio.tone(220, 0.04, 'triangle', 0.02);
    }
    player.vy = 0; player.angle = 0;
  }
  if (player.y < ground - 48) player.angle += dt * 7;
  player.slide = crouchHeld ? 0.5 : Math.max(0, player.slide - dt);

  spawn -= dt;
  if (spawn <= 0) {
    const type = Math.random() < 0.34 ? 'high' : 'low';
    obstacles.push({ x: W + 40, y: type === 'high' ? ground - 96 : ground - 34, w: type === 'high' ? 34 : 46, h: type === 'high' ? 52 : 34, type, seed: Math.random() * Math.PI * 2 });
    spawn = Math.max(d.spawnMin, d.spawn - elapsed * 0.004) + Math.random() * 0.35;
  }

  if (bonusInput.checked) {
    orbSpawn -= dt;
    if (orbSpawn <= 0) {
      orbs.push({ x: W + 40, y: ground - (Math.random() < 0.5 ? 120 : 70), r: 12, phase: Math.random() * Math.PI * 2 });
      orbSpawn = 2.2 + Math.random() * 1.8;
    }
  } else {
    orbs = [];
  }

  for (const o of obstacles) o.x -= sp * dt;
  for (const o of orbs) o.x -= sp * dt;
  obstacles = obstacles.filter((o) => o.x > -70);
  orbs = orbs.filter((o) => o.x > -40);

  const box = { x: 118, y: player.y + (player.slide ? 20 : 0), w: player.slide ? 62 : 42, h: player.slide ? 27 : 48 };
  if (obstacles.some((o) => obstacleHits(box, o))) {
    burst(140, player.y + 24, '#ff6dbe', 22); ring(140, player.y + 24, '#ff6dbe'); shake = 1; player.squash = 0.7;
    state = 'over'; statusEl.textContent = 'Terminé';
    audio.seq([[200, 0.12, 'sawtooth', 0.05, 0], [140, 0.2, 'sawtooth', 0.04, 0.06]]);
  }

  for (let i = orbs.length - 1; i >= 0; i--) {
    const o = orbs[i];
    const dx = (box.x + box.w / 2) - o.x, dy = (box.y + box.h / 2) - o.y;
    if (Math.hypot(dx, dy) < o.r + 22) {
      orbs.splice(i, 1);
      score += 40;
      player.squash = 1.1;
      burst(o.x, o.y, '#ffd36b', 12); ring(o.x, o.y, '#ffd36b');
      audio.tone(760, 0.07, 'sine', 0.03);
    }
  }

  scoreEl.textContent = String(score);
  if (score > best) { best = score; bestEl.textContent = String(best); localStorage.setItem('prismRunnerBest', String(best)); }
}

function drawMountain(offset, baseY, height, color, alpha) {
  ctx.fillStyle = color; ctx.globalAlpha = alpha; ctx.beginPath(); ctx.moveTo(-50, H);
  const seg = 160; const phase = -((scroll * offset) % seg);
  for (let x = phase - seg; x < W + seg; x += seg) {
    ctx.lineTo(x + seg / 2, baseY - height * (0.6 + 0.5 * Math.abs(Math.sin(x * 0.013 + offset * 7))));
    ctx.lineTo(x + seg, baseY);
  }
  ctx.lineTo(W + 50, H); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
}

function drawRunner(x, y, rx, ry, spin) {
  const g = ctx.createLinearGradient(x - rx, y - ry, x + rx, y + ry); g.addColorStop(0, '#62ffe0'); g.addColorStop(0.52, '#8b8bff'); g.addColorStop(1, '#ff6bbe');
  ctx.fillStyle = g; ctx.shadowColor = '#8b8bff'; ctx.shadowBlur = 18; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = '#efffff'; ctx.lineWidth = 2.5; ctx.stroke();
  const hx = x + Math.cos(spin) * rx * 0.45, hy = y + Math.sin(spin) * ry * 0.45; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(hx, hy, 3.5, 0, Math.PI * 2); ctx.fill();
}

function drawObstacle(o) {
  ctx.save(); ctx.translate(o.x + o.w / 2, o.y + o.h / 2);
  ctx.fillStyle = '#1b1140'; ctx.strokeStyle = '#ff6dbd'; ctx.shadowColor = '#ff6dbd'; ctx.shadowBlur = 14; ctx.lineWidth = 3; ctx.beginPath();
  if (o.type === 'low') {
    ctx.moveTo(-o.w / 2, o.h / 2); ctx.lineTo(-o.w / 6, -o.h / 2); ctx.lineTo(o.w / 6, -o.h / 2); ctx.lineTo(o.w / 2, o.h / 2);
  } else {
    const k = 6; ctx.moveTo(-o.w / 2, -o.h / 2 + k); ctx.lineTo(-o.w / 2 + k, -o.h / 2); ctx.lineTo(o.w / 2 - k, -o.h / 2); ctx.lineTo(o.w / 2, -o.h / 2 + k); ctx.lineTo(o.w / 2, o.h / 2 - k); ctx.lineTo(o.w / 2 - k, o.h / 2); ctx.lineTo(-o.w / 2 + k, o.h / 2); ctx.lineTo(-o.w / 2, o.h / 2 - k);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillRect(o.x + o.w * 0.3, o.y + o.h * 0.25, 2.5, o.h * 0.4);
}

function draw(t) {
  ctx.clearRect(0, 0, W, H); ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * 12 * shake, (Math.random() - 0.5) * 8 * shake);
  const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#20133c'); sky.addColorStop(1, '#090b1c'); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) { ctx.globalAlpha = 0.5; ctx.fillStyle = '#d5e0ff'; ctx.fillRect((i * 211 + 70 - scroll * 0.05) % W, (i * 97) % 200, 2, 2); }
  ctx.globalAlpha = 1;
  drawMountain(0.25, ground - 40, 150, '#241a4f', 0.9); drawMountain(0.55, ground - 8, 90, '#171233', 0.95);
  ctx.fillStyle = '#101a30'; ctx.fillRect(0, ground, W, H - ground);
  ctx.strokeStyle = '#2a3f66'; ctx.lineWidth = 1;
  for (let x = -(scroll % 60); x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, ground); ctx.lineTo(x - 40, H); ctx.stroke(); }
  ctx.strokeStyle = '#7bffe5'; ctx.shadowColor = '#7bffe5'; ctx.shadowBlur = 12; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, ground); ctx.lineTo(W, ground); ctx.stroke(); ctx.shadowBlur = 0;

  for (const o of orbs) {
    const r = o.r * (1 + 0.1 * Math.sin(t * 0.008 + o.phase));
    ctx.fillStyle = '#ffd36b'; ctx.shadowColor = '#ffd36b'; ctx.shadowBlur = 16; ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.strokeStyle = '#fff3c4'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(o.x, o.y, r * 1.5, 0, Math.PI * 2); ctx.stroke();
  }
  for (const o of obstacles) drawObstacle(o);

  for (const tr of trail) { ctx.globalAlpha = tr.a * 0.4; ctx.fillStyle = '#8b8bff'; ctx.beginPath(); ctx.arc(tr.x, tr.y + 24, 10, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;

  const px = 120, py = player.y;
  ctx.save();
  const sx = 1 / Math.sqrt(player.squash), sy = player.squash;
  if (player.slide) {
    ctx.translate(px + 31, py + 34); ctx.scale(sx, sy); drawRunner(0, 0, 31, 13, 0);
  } else {
    const st = player.y < ground - 48 ? 1 + Math.min(0.16, Math.abs(player.vy) / 2400) : 1;
    ctx.translate(px + 21, py + 24); ctx.scale(sx, sy); drawRunner(0, 0, 21, 21 * st, player.y < ground - 48 ? player.angle : 0);
  }
  ctx.restore();

  if (trail.length === 0 || Math.hypot(trail[trail.length - 1].x - px - 21, trail[trail.length - 1].y - py - 24) > 14) trail.push({ x: px + 21, y: py + 24, a: 1 });
  for (const tr of trail) tr.a -= 0.06;
  while (trail.length && trail[0].a <= 0) trail.shift();

  for (const p of pulses) { ctx.globalAlpha = Math.max(0, p.life / 0.35); ctx.strokeStyle = p.color; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke(); }
  ctx.globalAlpha = 1;
  for (const p of particles) { ctx.globalAlpha = Math.min(1, p.life * 2.4); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.s, p.s); }
  ctx.globalAlpha = 1; ctx.restore();

  if (state !== 'playing') {
    ctx.fillStyle = '#04100ddc'; ctx.fillRect(0, 0, W, H); ctx.textAlign = 'center'; ctx.fillStyle = '#c7a2ff'; ctx.font = '800 32px system-ui';
    ctx.fillText(state === 'ready' ? 'NEON RUNNER' : state === 'paused' ? 'PAUSE' : 'CHUTE !', W / 2, H / 2);
    ctx.fillStyle = '#edfffa'; ctx.font = '16px system-ui';
    ctx.fillText(state === 'ready' ? 'Espace ou clic pour courir' : state === 'paused' ? 'Clique sur Pause pour reprendre' : 'Clique ou Recommencer pour retenter', W / 2, H / 2 + 34);
  }
}

function frame(t) {
  const dt = Math.min((t - last) / 1000 || 0, 0.04);
  last = t;
  update(dt); draw(t); requestAnimationFrame(frame);
}

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if ([' ', 'arrowup', 'arrowdown'].includes(k)) e.preventDefault();
  if (k === ' ' || k === 'arrowup' || k === 'w') jump();
  if (k === 'arrowdown' || k === 's') { player.slide = 0.5; crouchHeld = true; }
  if (k === 'p') pause();
});

window.addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); if (k === 'arrowdown' || k === 's') crouchHeld = false; });
window.addEventListener('blur', () => { crouchHeld = false; });
canvas.addEventListener('pointerdown', jump);
document.querySelector('#pause').onclick = pause;
document.querySelector('#restart').onclick = start;
document.querySelector('#new-game').onclick = start;
last = performance.now();
requestAnimationFrame(frame);
