import { mountGameFrame } from '../../packages/ui/src/gameFrame.js';
import { createAudio } from '../../packages/shared/src/audio.js';
import { indexOf, countAdjacent } from './game-logic.js';

const SIGNAL_COLORS = {
  1: '#69ffe1',
  2: '#7cff7a',
  3: '#ffd36b',
  4: '#ff9b5f',
  5: '#ff6fae',
  6: '#ff648f',
  7: '#b58aff',
  8: '#ffffff',
};

const shell = mountGameFrame({
  mount: document.getElementById('shell-mount'),
  config: {
    title: 'Neon Black Holes',
    subtitle: 'Explore les secteurs, repère les trous noirs.',
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
          stats.append(stat('SECTEURS', 'score', '0'), stat('RECORD', 'best', '-'), stat('TROUS NOIRS', 'mines-left', '12'), stat('ÉTAT', 'status', 'Prêt'));
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
          actions.append(b('pause', 'Pause'), b('restart', 'Recommencer'), b('new-game', 'Nouvelle mission', 'primary'));

          const controlsTitle = document.createElement('h3'); controlsTitle.className = 'neon-panel__subtitle'; controlsTitle.textContent = 'Contrôles';
          const controls = document.createElement('div'); controls.className = 'controls-legend';
          const control = (keys, desc) => {
            const row = document.createElement('div'); row.className = 'control-row';
            const keysWrap = document.createElement('span'); keysWrap.className = 'control-keys';
            keys.forEach((k) => { const kbd = document.createElement('kbd'); kbd.textContent = k; keysWrap.appendChild(kbd); });
            const label = document.createElement('span'); label.className = 'control-desc'; label.textContent = desc;
            row.append(keysWrap, label); return row;
          };
          controls.append(
            control(['Clic'], 'Scanner un secteur'),
            control(['Clic droit'], 'Poser / retirer un satellite balise'),
            control(['P'], 'Pause / reprendre'),
          );

          const legendTitle = document.createElement('h3'); legendTitle.className = 'neon-panel__subtitle'; legendTitle.textContent = 'Légende des indicateurs';
          const legend = document.createElement('div'); legend.className = 'indicator-legend';
          const legendItem = (color, text, isSwatch = true) => {
            const item = document.createElement('div'); item.className = 'legend-item';
            const swatch = document.createElement('span'); swatch.className = isSwatch ? 'legend-swatch' : 'legend-icon';
            swatch.style.setProperty('--swatch', color);
            const label = document.createElement('span'); label.textContent = text;
            item.append(swatch, label); return item;
          };
          legend.append(
            legendItem('#69ffe1', 'Balise posée', false),
            legendItem('#b58aff', 'Trou noir', false),
          );
          const colorsTitle = document.createElement('p'); colorsTitle.className = 'legend-note'; colorsTitle.textContent = 'Satellites = nombre de trous noirs voisins (couleur par niveau) :';
          const colors = document.createElement('div'); colors.className = 'legend-colors';
          [1,2,3,4,5,6,7,8].forEach((n) => {
            const item = document.createElement('div'); item.className = 'legend-color-item';
            const dot = document.createElement('span'); dot.className = 'legend-dot'; dot.style.setProperty('--swatch', SIGNAL_COLORS[n]); dot.textContent = String(n);
            item.appendChild(dot); colors.appendChild(item);
          });

          panel.append(title, actions, controlsTitle, controls, legendTitle, legend, colorsTitle, colors);
          return panel;
        },
      },
    ],
    screen: {
      mount: (el) => {
        const canvas = document.createElement('canvas');
        canvas.id = 'game'; canvas.width = 600; canvas.height = 600; canvas.setAttribute('aria-label', 'Carte des secteurs de Neon Black Holes');
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

const W = 600, N = 10, CELL = 44;
const GRID = N * CELL;
const OFFSET_X = Math.floor((W - GRID) / 2);
const OFFSET_Y = Math.floor((W - GRID) / 2);
const DIFF = { chill: 8, arcade: 12, chaos: 18 };
let mineCount = DIFF.arcade;

let mines = new Set(), revealed = new Set(), flags = new Set(), state = 'ready', first = true, score = 0, best = Number(localStorage.getItem('neonBlackHolesBest')) || 0, last = 0, elapsed = 0, particles = [], pulses = [], shockwaves = [], shake = 0, stars = [];
$('#best').textContent = best || '-';
$('#mines-left').textContent = String(mineCount);

function setup() {
  const diff = difficultyInput?.value || 'arcade';
  mineCount = DIFF[diff] || 12;
  mines = new Set(); revealed = new Set(); flags = new Set(); state = 'ready'; first = true; score = 0; elapsed = 0; particles = []; pulses = []; shockwaves = []; shake = 0;
  stars = Array.from({ length: 140 }, () => ({
    x: Math.random() * W,
    y: Math.random() * W,
    r: Math.random() < 0.12 ? 2.2 : Math.random() * 1.6 + 0.4,
    a: 0.3 + Math.random() * 0.7,
    tw: Math.random() * Math.PI * 2,
    sp: 0.5 + Math.random() * 1.2,
    vy: 4 + Math.random() * 10,
    vx: (Math.random() - 0.5) * 4,
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

function burstCell(x, y, color, n = 12) {
  const px = OFFSET_X + x * CELL + CELL / 2, py = OFFSET_Y + y * CELL + CELL / 2;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 30 + Math.random() * 140;
    particles.push({ x: px, y: py, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.35 + Math.random() * 0.4, color, s: 1.5 + Math.random() * 2.5, glow: true });
  }
  pulses.push({ x: px, y: py, r: 8, life: 0.45, color });
}

function blackHoleCollapse(x, y) {
  const px = OFFSET_X + x * CELL + CELL / 2, py = OFFSET_Y + y * CELL + CELL / 2;
  shockwaves.push({ x: px, y: py, r: 8, life: 0.9, color: '#b07cff' });
  shockwaves.push({ x: px, y: py, r: 4, life: 0.7, color: '#ff648f' });
  for (let i = 0; i < 36; i++) {
    const a = Math.random() * Math.PI * 2, sp = 20 + Math.random() * 160;
    particles.push({ x: px, y: py, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5 + Math.random() * 0.6, color: i % 2 ? '#b58aff' : '#ff648f', s: 1.5 + Math.random() * 3, glow: true, pull: true, px, py });
  }
}

function reveal(x, y) {
  const i = indexOf(x, y, N);
  if (revealed.has(i) || flags.has(i) || state === 'paused' || state === 'over' || state === 'won') return;
  if (first) { placeMines(x, y); first = false; state = 'playing'; $('#status').textContent = 'Scan en cours'; }
  if (mines.has(i)) {
    revealed.add(i); blackHoleCollapse(x, y); shake = 1;
    state = 'over'; $('#status').textContent = 'Trou noir !';
    audio.seq([[120, 0.18, 'sawtooth', 0.05, 0], [80, 0.3, 'sine', 0.05, 0.1]]);
    draw(0); return;
  }
  const open = [i];
  while (open.length) {
    const k = open.pop();
    if (revealed.has(k) || flags.has(k)) continue;
    revealed.add(k);
    const px = k % N, py = Math.floor(k / N);
    burstCell(px, py, '#69ffe1', 5);
    const n = countAdjacent(mines, px, py, N, N);
    audio.tone(240 + n * 45, 0.04, 'triangle', 0.012);
    if (n === 0) {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = px + dx, ny = py + dy;
        if (nx >= 0 && nx < N && ny >= 0 && ny < N) open.push(indexOf(nx, ny, N));
      }
    }
  }
  score = revealed.size; $('#score').textContent = String(score);
  if (score === N * N - mineCount) {
    state = 'won'; $('#status').textContent = 'Secteur sécurisé';
    let timeBest = best;
    if (!timeBest || elapsed < timeBest) { timeBest = Math.floor(elapsed); localStorage.setItem('neonBlackHolesBest', String(timeBest)); $('#best').textContent = timeBest + 's'; }
    if (bonusInput.checked) audio.seq([[520, 0.08, 'sine', 0.03, 0], [660, 0.1, 'sine', 0.03, 0.08], [880, 0.12, 'sine', 0.03, 0.16]]);
    else audio.tone(660, 0.2, 'triangle', 0.03);
  }
  draw(0);
}

function drawSatellite(ctx, s = 1, alpha = 1, accent = '#5b7cff') {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.scale(s, s);
  // body
  const body = ctx.createLinearGradient(-3, -2, 3, 2);
  body.addColorStop(0, '#eaffff'); body.addColorStop(1, '#9fdce6');
  ctx.fillStyle = body;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-3.2, -2.2, 6.4, 4.4, 1.2); else ctx.rect(-3.2, -2.2, 6.4, 4.4);
  ctx.fill();
  // panels
  ctx.fillStyle = accent;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 0.6;
  ctx.fillRect(-8.5, -1.6, 4.4, 3.2); ctx.strokeRect(-8.5, -1.6, 4.4, 3.2);
  ctx.fillRect(4.1, -1.6, 4.4, 3.2); ctx.strokeRect(4.1, -1.6, 4.4, 3.2);
  ctx.beginPath(); ctx.moveTo(-4.1, 0); ctx.lineTo(-3.2, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(3.2, 0); ctx.lineTo(4.1, 0); ctx.stroke();
  // antenna
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(0, -2.2); ctx.lineTo(0, -5.2); ctx.stroke();
  ctx.fillStyle = '#ffd36b'; ctx.beginPath(); ctx.arc(0, -5.5, 0.9, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawSignalCount(x, y, n, t) {
  // draw n small satellites arranged in a ring as visual count (color-coded by danger level)
  const r = 12.5;
  const color = SIGNAL_COLORS[n] || '#69ffe1';
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  for (let k = 0; k < n; k++) {
    const a = -Math.PI / 2 + (k / n) * Math.PI * 2 + Math.sin(t * 0.001 + k) * 0.08;
    const sx = x + Math.cos(a) * r;
    const sy = y + Math.sin(a) * r;
    const rot = a + Math.PI / 2;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(rot);
    drawSatellite(ctx, 0.62, 0.95, color);
    ctx.restore();
  }
  ctx.restore();
}

function drawBlackHole(cx, cy, t, active = true) {
  const pulse = active ? 1 + 0.05 * Math.sin(t * 0.004) : 1;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(pulse, pulse);
  // accretion glow
  const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 22);
  glow.addColorStop(0, 'rgba(20,0,40,0.0)');
  glow.addColorStop(0.45, 'rgba(120,60,255,0.25)');
  glow.addColorStop(0.75, 'rgba(255,100,160,0.18)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
  // rings
  ctx.save();
  ctx.rotate(t * 0.0015);
  ctx.strokeStyle = 'rgba(181,138,255,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, 0, 16, 6, 0.3, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,120,170,0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(0, 0, 13, 4.5, -0.5, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  // core
  const core = ctx.createRadialGradient(-1, -1, 1, 0, 0, 9);
  core.addColorStop(0, '#120018');
  core.addColorStop(0.6, '#050008');
  core.addColorStop(1, '#000000');
  ctx.fillStyle = core;
  ctx.shadowColor = '#b58aff';
  ctx.shadowBlur = active ? 16 : 6;
  ctx.beginPath(); ctx.arc(0, 0, 8.5, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(220,200,255,0.5)';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(0, 0, 9.5, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
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
    ctx.beginPath(); ctx.moveTo(OFFSET_X + p, OFFSET_Y); ctx.lineTo(OFFSET_X + p, OFFSET_Y + GRID); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(OFFSET_X, OFFSET_Y + p); ctx.lineTo(OFFSET_X + GRID, OFFSET_Y + p); ctx.stroke();
  }
  ctx.restore();

  // Board frame
  ctx.save();
  ctx.fillStyle = 'rgba(4, 14, 22, 0.35)';
  ctx.strokeStyle = 'rgba(105, 255, 225, 0.22)';
  ctx.lineWidth = 2;
  ctx.shadowColor = 'rgba(105, 255, 225, 0.12)';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.roundRect(OFFSET_X - 10, OFFSET_Y - 10, GRID + 20, GRID + 20, 14);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = indexOf(x, y, N), px = OFFSET_X + x * CELL, py = OFFSET_Y + y * CELL;
    const isRevealed = revealed.has(i);
    const cx = px + CELL / 2, cy = py + CELL / 2;
    const pad = 2;

    ctx.save();
    if (!isRevealed) {
      const g = ctx.createLinearGradient(px, py, px, py + CELL);
      g.addColorStop(0, 'rgba(15, 37, 64, 0.78)');
      g.addColorStop(1, 'rgba(8, 22, 41, 0.82)');
      ctx.fillStyle = g;
      ctx.strokeStyle = 'rgba(105, 255, 225, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = 'rgba(105, 255, 225, 0.18)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.roundRect(px + pad, py + pad, CELL - pad * 2, CELL - pad * 2, 8);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(180, 255, 245, 0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(px + pad + 3, py + pad + 3, CELL - pad * 2 - 6, CELL * 0.28, 6);
      ctx.stroke();
      ctx.fillStyle = 'rgba(220, 250, 255, 0.28)';
      ctx.fillRect(px + 8, py + 8, 2, 2);
      ctx.fillRect(px + CELL - 10, py + 8, 2, 2);
    } else {
      const g = ctx.createLinearGradient(px, py, px, py + CELL);
      g.addColorStop(0, 'rgba(7, 26, 31, 0.72)');
      g.addColorStop(1, 'rgba(4, 16, 21, 0.78)');
      ctx.fillStyle = g;
      ctx.strokeStyle = mines.has(i) ? 'rgba(181, 138, 255, 0.55)' : 'rgba(105, 255, 225, 0.22)';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = mines.has(i) ? 'rgba(181, 138, 255, 0.25)' : 'rgba(105, 255, 225, 0.1)';
      ctx.shadowBlur = mines.has(i) ? 14 : 6;
      ctx.beginPath();
      ctx.roundRect(px + pad, py + pad, CELL - pad * 2, CELL - pad * 2, 8);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.restore();

    if (isRevealed) {
      if (mines.has(i)) {
        drawBlackHole(cx, cy, time, true);
      } else {
        const n = countAdjacent(mines, x, y, N, N);
        if (n) drawSignalCount(cx, cy, n, time);
      }
    } else if (flags.has(i)) {
      const bob = Math.sin(time * 0.004 + x * 0.7 + y) * 1.2;
      ctx.save();
      ctx.translate(cx, cy + bob);
      ctx.shadowColor = '#69ffe1';
      ctx.shadowBlur = 10;
      drawSatellite(ctx, 1.25, 1, '#69ffe1');
      // base beacon ring
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(105,255,225,0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 12, 10, 3.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Pulses
  for (const p of pulses) {
    ctx.globalAlpha = Math.max(0, p.life / 0.45);
    ctx.strokeStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;

  for (const s of shockwaves) {
    ctx.globalAlpha = Math.max(0, s.life / 0.9);
    ctx.strokeStyle = s.color;
    ctx.shadowColor = s.color;
    ctx.shadowBlur = 16;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;

  // Particles
  for (const p of particles) {
    ctx.globalAlpha = Math.min(1, p.life * 2.2);
    ctx.fillStyle = p.color;
    if (p.glow) { ctx.shadowColor = p.color; ctx.shadowBlur = 8; }
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;

  ctx.restore();

  if (state === 'paused' || state === 'ready' || state === 'over' || state === 'won') {
    ctx.fillStyle = 'rgba(2, 8, 18, 0.78)';
    ctx.fillRect(0, 0, W, W);

    const overlayTime = performance.now() * 0.001;
    for (const s0 of stars) {
      const tw = 0.55 + 0.45 * Math.sin(overlayTime * s0.sp + s0.tw);
      ctx.globalAlpha = 0.35 + 0.55 * s0.a * tw;
      ctx.fillStyle = s0.r > 1.8 ? '#ffffff' : '#dffcff';
      ctx.shadowColor = '#8be9ff';
      ctx.shadowBlur = s0.r > 1.4 ? 8 : 4;
      ctx.beginPath();
      ctx.arc(s0.x, s0.y, s0.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    const title = state === 'paused' ? 'PAUSE' : state === 'over' ? 'TROU NOIR !' : state === 'won' ? 'SECTEUR SÉCURISÉ' : 'NEON BLACK HOLES';
    const sub = state === 'ready' ? 'Scanne ton premier secteur' : state === 'paused' ? 'Clique sur Pause pour reprendre' : 'Recommence pour une nouvelle mission';
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
  else if (state === 'paused') { state = 'playing'; $('#status').textContent = 'Scan en cours'; last = performance.now(); draw(0); }
  else if (state === 'ready') { state = 'playing'; $('#status').textContent = 'Scan en cours'; draw(0); }
  else { setup(); }
}

function cellFromEvent(e) {
  const r = canvas.getBoundingClientRect();
  const cx = (e.clientX - r.left) * W / r.width;
  const cy = (e.clientY - r.top) * W / r.height;
  const x = Math.floor((cx - OFFSET_X) / CELL);
  const y = Math.floor((cy - OFFSET_Y) / CELL);
  if (x < 0 || x >= N || y < 0 || y >= N) return null;
  return { x, y };
}

canvas.addEventListener('click', (e) => {
  if (state === 'over' || state === 'won') { setup(); return; }
  const cell = cellFromEvent(e);
  if (!cell) return;
  reveal(cell.x, cell.y);
});

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (state === 'paused' || state === 'over' || state === 'won') return;
  const cell = cellFromEvent(e);
  if (!cell) return;
  const i = indexOf(cell.x, cell.y, N);
  if (revealed.has(i)) return;
  if (flags.has(i)) flags.delete(i); else { flags.add(i); audio.tone(350, 0.03, 'square', 0.015); pulses.push({ x: OFFSET_X + cell.x * CELL + CELL / 2, y: OFFSET_Y + cell.y * CELL + CELL / 2, r: 6, life: 0.3, color: '#69ffe1' }); }
  $('#mines-left').textContent = String(mineCount - flags.size);
  draw(0);
});

$('#pause').onclick = togglePause;
$('#restart').onclick = setup;
$('#new-game').onclick = setup;
window.addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'p') togglePause(); });

function frame(t) {
  const dt = Math.min((t - last) / 1000 || 0, 0.05);
  if (state === 'playing') { elapsed += dt; $('#status').textContent = 'Scan en cours • ' + Math.floor(elapsed) + 's'; }
  last = t;
  for (const s of stars) {
    s.y += s.vy * dt;
    s.x += s.vx * dt;
    if (s.y > W + 4) { s.y = -4; s.x = Math.random() * W; }
    if (s.x < -4) s.x = W + 4;
    if (s.x > W + 4) s.x = -4;
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (p.pull) {
      const dx = p.px - p.x, dy = p.py - p.y;
      p.vx += dx * dt * 0.8; p.vy += dy * dt * 0.8;
    }
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * dt; p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = pulses.length - 1; i >= 0; i--) { pulses[i].r += 80 * dt; if ((pulses[i].life -= dt) <= 0) pulses.splice(i, 1); }
  for (let i = shockwaves.length - 1; i >= 0; i--) { shockwaves[i].r += 120 * dt; if ((shockwaves[i].life -= dt) <= 0) shockwaves.splice(i, 1); }
  draw(t);
  requestAnimationFrame(frame);
}

setup();
requestAnimationFrame(frame);
