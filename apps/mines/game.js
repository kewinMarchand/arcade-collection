import { mountGameFrame } from '../../packages/ui/src/gameFrame.js';
import { createAudio } from '../../packages/shared/src/audio.js';
import { indexOf, countAdjacent } from './game-logic.js';

const shell = mountGameFrame({
  mount: document.getElementById('shell-mount'),
  config: {
    title: 'Neon Mines',
    subtitle: 'Révèle les cases, évite les mines.',
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
          stats.append(stat('RÉVÉLÉES', 'score', '0'), stat('RECORD', 'best', '-'), stat('MINES', 'mines-left', '12'), stat('ÉTAT', 'status', 'Prêt'));
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
          const help = document.createElement('p'); help.className = 'help'; help.textContent = 'Clic : révéler • Clic droit : drapeau • P : pause';
          panel.append(title, actions, help); return panel;
        },
      },
    ],
    screen: {
      mount: (el) => {
        const canvas = document.createElement('canvas');
        canvas.id = 'game'; canvas.width = 600; canvas.height = 600; canvas.setAttribute('aria-label', 'Grille de Neon Mines');
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

const W = 600, N = 10, CELL = 60;
const DIFF = { chill: 8, arcade: 12, chaos: 18 };
let mineCount = DIFF.arcade;

let mines = new Set(), revealed = new Set(), flags = new Set(), state = 'ready', first = true, score = 0, best = Number(localStorage.getItem('neonMinesBest')) || 0, last = 0, elapsed = 0, particles = [], pulses = [], shake = 0, stars = [];
$('#best').textContent = best || '-';
$('#mines-left').textContent = String(mineCount);

function setup() {
  const diff = difficultyInput?.value || 'arcade';
  mineCount = DIFF[diff] || 12;
  mines = new Set(); revealed = new Set(); flags = new Set(); state = 'ready'; first = true; score = 0; elapsed = 0; particles = []; pulses = []; shake = 0;
  stars = Array.from({ length: 90 }, () => ({
    x: Math.random() * W,
    y: Math.random() * W,
    r: Math.random() * 1.8 + 0.4,
    a: 0.25 + Math.random() * 0.75,
    tw: Math.random() * Math.PI * 2,
    sp: 0.15 + Math.random() * 0.45,
  }));
  $('#score').textContent = '0'; $('#mines-left').textContent = String(mineCount); $('#status').textContent = 'Prêt'; draw(0);
}

function placeMines(safeX, safeY) {
  while (mines.size < mineCount) {
    const x = Math.floor(Math.random() * N), y = Math.floor(Math.random() * N), i = indexOf(x, y, N);
    if ((x === safeX && y === safeY) || mines.has(i)) continue;
    mines.add(i);
  }
}

function burstCell(x, y, color, n = 14) {
  const px = x * CELL + CELL / 2, py = y * CELL + CELL / 2;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 180;
    particles.push({ x: px, y: py, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.35 + Math.random() * 0.4, color, s: 2 + Math.random() * 3 });
  }
  pulses.push({ x: px, y: py, r: 10, life: 0.4, color });
}

function reveal(x, y) {
  const i = indexOf(x, y, N);
  if (revealed.has(i) || flags.has(i) || state === 'paused' || state === 'over' || state === 'won') return;
  if (first) { placeMines(x, y); first = false; state = 'playing'; $('#status').textContent = 'En jeu'; }
  if (mines.has(i)) {
    revealed.add(i); burstCell(x, y, '#ff648f', 28); shake = 1;
    state = 'over'; $('#status').textContent = 'Mine !';
    audio.seq([[180, 0.15, 'sawtooth', 0.05, 0], [120, 0.25, 'sawtooth', 0.05, 0.08]]);
    draw(0); return;
  }
  const open = [i];
  while (open.length) {
    const k = open.pop();
    if (revealed.has(k) || flags.has(k)) continue;
    revealed.add(k);
    const px = k % N, py = Math.floor(k / N);
    burstCell(px, py, '#69ffe1', 6);
    audio.tone(260 + countAdjacent(mines, px, py, N, N) * 40, 0.04, 'triangle', 0.015);
    if (countAdjacent(mines, px, py, N, N) === 0) {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = px + dx, ny = py + dy;
        if (nx >= 0 && nx < N && ny >= 0 && ny < N) open.push(indexOf(nx, ny, N));
      }
    }
  }
  score = revealed.size; $('#score').textContent = String(score);
  if (score === N * N - mineCount) {
    state = 'won'; $('#status').textContent = 'Gagné';
    let timeBest = best;
    if (!timeBest || elapsed < timeBest) { timeBest = Math.floor(elapsed); localStorage.setItem('neonMinesBest', String(timeBest)); $('#best').textContent = timeBest + 's'; }
    if (bonusInput.checked) audio.seq([[520, 0.08, 'sine', 0.03, 0], [660, 0.1, 'sine', 0.03, 0.08], [880, 0.12, 'sine', 0.03, 0.16]]);
    else audio.tone(660, 0.2, 'triangle', 0.03);
  }
  draw(0);
}

function draw(t) {
  const time = t || 0;
  shake = Math.max(0, shake - 0.05);
  ctx.clearRect(0, 0, W, W);

  // Space background
  const bg = ctx.createLinearGradient(0, 0, 0, W);
  bg.addColorStop(0, '#040814');
  bg.addColorStop(0.45, '#071326');
  bg.addColorStop(1, '#02060f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, W);

  // Nebula glow
  const neb = (x, y, r, c) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, c);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  neb(W * 0.18, W * 0.22, 220, 'rgba(0, 210, 255, 0.10)');
  neb(W * 0.82, W * 0.78, 240, 'rgba(120, 80, 255, 0.12)');
  neb(W * 0.55, W * 0.15, 180, 'rgba(105, 255, 225, 0.07)');

  // Stars
  for (const s0 of stars) {
    const tw = 0.55 + 0.45 * Math.sin(time * 0.002 * s0.sp + s0.tw);
    ctx.globalAlpha = Math.min(1, s0.a * tw);
    ctx.fillStyle = '#dffcff';
    ctx.shadowColor = '#8be9ff';
    ctx.shadowBlur = s0.r > 1.4 ? 6 : 0;
    ctx.beginPath();
    ctx.arc(s0.x, s0.y, s0.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * 8 * shake, (Math.random() - 0.5) * 8 * shake);

  // Subtle scan grid
  ctx.save();
  ctx.strokeStyle = 'rgba(105, 255, 225, 0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= N; i++) {
    const p = i * CELL;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, W); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(W, p); ctx.stroke();
  }
  ctx.restore();

  const numColors = ['', '#69ffe1', '#ffd36b', '#ff648f', '#b58aff', '#8bffbd', '#ff9d65', '#72bdff', '#fff'];

  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = indexOf(x, y, N), px = x * CELL, py = y * CELL;
    const isRevealed = revealed.has(i);
    const cx = px + CELL / 2, cy = py + CELL / 2;
    const pad = 3;

    ctx.save();
    if (!isRevealed) {
      const g = ctx.createLinearGradient(px, py, px, py + CELL);
      g.addColorStop(0, '#0f2540');
      g.addColorStop(1, '#081629');
      ctx.fillStyle = g;
      ctx.strokeStyle = 'rgba(105, 255, 225, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = 'rgba(105, 255, 225, 0.18)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.roundRect(px + pad, py + pad, CELL - pad * 2, CELL - pad * 2, 8);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      // inner sheen
      ctx.strokeStyle = 'rgba(180, 255, 245, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(px + pad + 3, py + pad + 3, CELL - pad * 2 - 6, CELL * 0.28, 6);
      ctx.stroke();
      // tiny corner stars
      ctx.fillStyle = 'rgba(200, 245, 255, 0.18)';
      ctx.fillRect(px + 8, py + 8, 2, 2);
      ctx.fillRect(px + CELL - 10, py + 8, 2, 2);
    } else {
      const g = ctx.createLinearGradient(px, py, px, py + CELL);
      g.addColorStop(0, '#071a1f');
      g.addColorStop(1, '#041015');
      ctx.fillStyle = g;
      ctx.strokeStyle = mines.has(i) ? 'rgba(255, 100, 143, 0.55)' : 'rgba(105, 255, 225, 0.18)';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = mines.has(i) ? 'rgba(255, 100, 143, 0.25)' : 'rgba(105, 255, 225, 0.08)';
      ctx.shadowBlur = mines.has(i) ? 14 : 6;
      ctx.beginPath();
      ctx.roundRect(px + pad, py + pad, CELL - pad * 2, CELL - pad * 2, 8);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.restore();

    if (isRevealed) {
      const pulse = 1 + 0.03 * Math.sin(time * 0.005 + x + y);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(pulse, pulse);
      if (mines.has(i)) {
        // space mine: core + rotating spikes + rings
        const rot = time * 0.002 + (x + y);
        ctx.shadowColor = '#ff648f';
        ctx.shadowBlur = 18;
        ctx.strokeStyle = '#ff9ab8';
        ctx.lineWidth = 2.5;
        for (let k = 0; k < 8; k++) {
          const a = rot + (Math.PI * 2 * k) / 8;
          const r1 = 8, r2 = 16;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
          ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
          ctx.stroke();
          ctx.fillStyle = '#ffd1de';
          ctx.beginPath();
          ctx.arc(Math.cos(a) * r2, Math.sin(a) * r2, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
        const core = ctx.createRadialGradient(-2, -2, 1, 0, 0, 11);
        core.addColorStop(0, '#fff0f5');
        core.addColorStop(0.45, '#ff8fb0');
        core.addColorStop(1, '#ff3f74');
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255, 220, 235, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 14.5, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const n = countAdjacent(mines, x, y, N, N);
        if (n) {
          const col = numColors[n] || '#fff';
          ctx.fillStyle = col;
          ctx.shadowColor = col;
          ctx.shadowBlur = 14;
          ctx.font = '800 26px "Space Grotesk", system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(n), 0, 1);
          ctx.shadowBlur = 0;
        }
      }
      ctx.restore();
    } else if (flags.has(i)) {
      // neon flag beacon
      const bob = Math.sin(time * 0.004 + x * 0.7 + y) * 1.5;
      ctx.save();
      ctx.translate(cx, cy + bob);
      ctx.shadowColor = '#ffd36b';
      ctx.shadowBlur = 14;
      // pole
      ctx.strokeStyle = '#cfefff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-6, 14);
      ctx.lineTo(-6, -14);
      ctx.stroke();
      // pennant
      const pg = ctx.createLinearGradient(-6, -14, 14, -4);
      pg.addColorStop(0, '#fff3b0');
      pg.addColorStop(1, '#ff9b3d');
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.moveTo(-6, -14);
      ctx.lineTo(14, -6);
      ctx.lineTo(-6, 1);
      ctx.closePath();
      ctx.fill();
      // base glow
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255, 211, 107, 0.35)';
      ctx.beginPath();
      ctx.ellipse(-2, 15, 10, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Pulses
  for (const p of pulses) {
    ctx.globalAlpha = Math.max(0, p.life / 0.4);
    ctx.strokeStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  // Particles
  for (const p of particles) {
    ctx.globalAlpha = Math.min(1, p.life * 2.4);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  ctx.restore();

  if (state === 'paused' || state === 'ready' || state === 'over' || state === 'won') {
    ctx.fillStyle = 'rgba(2, 8, 18, 0.78)';
    ctx.fillRect(0, 0, W, W);
    const title = state === 'paused' ? 'PAUSE' : state === 'over' ? 'MINE !' : state === 'won' ? 'GRILLE SÉCURISÉE' : 'NEON MINES';
    const sub = state === 'ready' ? 'Révèle ta première case' : state === 'paused' ? 'Clique sur Pause pour reprendre' : 'Recommencer pour rejouer';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#69ffe1';
    ctx.shadowBlur = 22;
    ctx.fillStyle = '#69ffe1';
    ctx.font = '800 34px "Space Grotesk", system-ui, sans-serif';
    ctx.fillText(title, W / 2, W / 2 - 6);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#e8fbff';
    ctx.font = '15px "Space Grotesk", system-ui, sans-serif';
    ctx.fillText(sub, W / 2, W / 2 + 30);
  }
}

function togglePause() {
  if (state === 'playing') { state = 'paused'; $('#status').textContent = 'Pause'; draw(0); }
  else if (state === 'paused') { state = 'playing'; $('#status').textContent = 'En jeu'; last = performance.now(); draw(0); }
  else if (state === 'ready') { state = 'playing'; $('#status').textContent = 'En jeu'; draw(0); }
}

canvas.addEventListener('click', (e) => {
  if (state === 'over' || state === 'won') { setup(); return; }
  const r = canvas.getBoundingClientRect();
  const x = Math.floor(((e.clientX - r.left) * N) / r.width);
  const y = Math.floor(((e.clientY - r.top) * N) / r.height);
  reveal(x, y);
});

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (state === 'paused' || state === 'over' || state === 'won') return;
  const r = canvas.getBoundingClientRect();
  const x = Math.floor(((e.clientX - r.left) * N) / r.width);
  const y = Math.floor(((e.clientY - r.top) * N) / r.height);
  const i = indexOf(x, y, N);
  if (revealed.has(i)) return;
  if (flags.has(i)) flags.delete(i); else { flags.add(i); audio.tone(350, 0.03, 'square', 0.015); }
  $('#mines-left').textContent = String(mineCount - flags.size);
  draw(0);
});

$('#pause').onclick = togglePause;
$('#restart').onclick = setup;
$('#new-game').onclick = setup;
window.addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'p') togglePause(); });

function frame(t) {
  if (state === 'playing') { elapsed += (t - last) / 1000; last = t; $('#status').textContent = 'En jeu • ' + Math.floor(elapsed) + 's'; }
  else { last = t; }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.x += p.vx * (1/60); p.y += p.vy * (1/60); p.vy += 120 * (1/60); p.life -= 0.016; if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = pulses.length - 1; i >= 0; i--) { pulses[i].r += 80 * 0.016; if ((pulses[i].life -= 0.016) <= 0) pulses.splice(i, 1); }
  draw(t);
  requestAnimationFrame(frame);
}

setup();
requestAnimationFrame(frame);
