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

let mines = new Set(), revealed = new Set(), flags = new Set(), state = 'ready', first = true, score = 0, best = Number(localStorage.getItem('neonMinesBest')) || 0, last = 0, elapsed = 0, particles = [], pulses = [], shake = 0;
$('#best').textContent = best || '-';
$('#mines-left').textContent = String(mineCount);

function setup() {
  const diff = difficultyInput?.value || 'arcade';
  mineCount = DIFF[diff] || 12;
  mines = new Set(); revealed = new Set(); flags = new Set(); state = 'ready'; first = true; score = 0; elapsed = 0; particles = []; pulses = []; shake = 0;
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
  shake = Math.max(0, shake - 0.05);
  ctx.clearRect(0, 0, W, W);
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * 8 * shake, (Math.random() - 0.5) * 8 * shake);

  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = indexOf(x, y, N), px = x * CELL, py = y * CELL;
    const isRevealed = revealed.has(i);
    ctx.fillStyle = isRevealed ? '#102923' : '#174139';
    ctx.strokeStyle = '#69ffe155'; ctx.lineWidth = 2;
    ctx.fillRect(px + 2, py + 2, CELL - 4, CELL - 4); ctx.strokeRect(px + 2, py + 2, CELL - 4, CELL - 4);
    if (isRevealed) {
      const pulse = 1 + 0.03 * Math.sin((t || 0) * 0.005 + x + y);
      ctx.save();
      ctx.translate(px + CELL / 2, py + CELL / 2);
      ctx.scale(pulse, pulse);
      if (mines.has(i)) {
        ctx.fillStyle = '#ff648f';
        ctx.shadowColor = '#ff648f';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        const n = countAdjacent(mines, x, y, N, N);
        if (n) {
          ctx.fillStyle = ['', '#69ffe1', '#ffd36b', '#ff648f', '#b58aff', '#8bffbd', '#ff9d65', '#72bdff', '#fff'][n];
          ctx.font = 'bold 25px system-ui';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(n), 0, 1);
        }
      }
      ctx.restore();
    } else if (flags.has(i)) {
      ctx.fillStyle = '#ffd36b'; ctx.font = 'bold 28px system-ui'; ctx.textAlign = 'center'; ctx.fillText('⚑', px + 30, py + 39);
    }
  }

  for (const p of pulses) { ctx.globalAlpha = Math.max(0, p.life / 0.4); ctx.strokeStyle = p.color; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke(); }
  ctx.globalAlpha = 1;
  for (const p of particles) { ctx.globalAlpha = Math.min(1, p.life * 2.4); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.s, p.s); }
  ctx.globalAlpha = 1;
  ctx.restore();

  if (state === 'paused' || state === 'ready' || state === 'over' || state === 'won') {
    ctx.fillStyle = '#04100dc9'; ctx.fillRect(0, 0, W, W);
    ctx.fillStyle = '#69ffe1'; ctx.textAlign = 'center'; ctx.font = '800 30px system-ui';
    ctx.fillText(state === 'paused' ? 'PAUSE' : state === 'over' ? 'MINE !' : state === 'won' ? 'GRILLE SÉCURISÉE' : 'NEON MINES', W / 2, W / 2);
    ctx.fillStyle = '#edfffa'; ctx.font = '15px system-ui';
    ctx.fillText(state === 'ready' ? 'Révèle ta première case' : state === 'paused' ? 'Clique sur Pause pour reprendre' : 'Recommencer pour rejouer', W / 2, W / 2 + 32);
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
