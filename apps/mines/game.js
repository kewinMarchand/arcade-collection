import { mountGameFrame } from '../../packages/ui/src/gameFrame.js';
import { indexOf, countAdjacent } from './game-logic.js';

const shell = mountGameFrame({
  mount: document.getElementById('shell-mount'),
  config: {
    title: 'Neon Mines',
    subtitle: 'Révèle les cases, évite les mines.',
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
          stats.append(stat('RÉVÉLÉES', 'score', '0'), stat('RECORD', 'best', '-'), stat('MINES', 'mines-left', '12'), stat('ÉTAT', 'status', 'Prêt'));
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
          help.textContent = 'Clic : révéler · Clic droit : drapeau · P : pause';
          panel.append(title, actions, help);
          return panel;
        },
      },
    ],
    screen: {
      mount: (el) => {
        const canvas = document.createElement('canvas');
        canvas.id = 'game';
        canvas.width = 600;
        canvas.height = 600;
        canvas.setAttribute('aria-label', 'Grille de Neon Mines');
        el.appendChild(canvas);
      },
    },
  },
});

const canvas = shell.screen.querySelector('canvas');
const ctx = canvas.getContext('2d');
const $ = (s) => document.querySelector(s);
const W = 600, N = 10, CELL = 60, MINE_COUNT = 12;
let mines = new Set(), revealed = new Set(), flags = new Set(), state = 'ready', first = true, score = 0, best = Number(localStorage.getItem('neonMinesBest')) || 0, last = 0, elapsed = 0;
$('#best').textContent = best || '-';

function setup() {
  mines = new Set(); revealed = new Set(); flags = new Set(); state = 'ready'; first = true; score = 0; elapsed = 0;
  $('#score').textContent = '0'; $('#mines-left').textContent = String(MINE_COUNT); $('#status').textContent = 'Prêt'; draw();
}

function placeMines(safeX, safeY) {
  while (mines.size < MINE_COUNT) {
    const x = Math.floor(Math.random() * N), y = Math.floor(Math.random() * N), i = indexOf(x, y, N);
    if ((x === safeX && y === safeY) || mines.has(i)) continue;
    mines.add(i);
  }
}

function reveal(x, y) {
  const i = indexOf(x, y, N);
  if (revealed.has(i) || flags.has(i) || state === 'paused' || state === 'over' || state === 'won') return;
  if (first) { placeMines(x, y); first = false; state = 'playing'; $('#status').textContent = 'En jeu'; }
  if (mines.has(i)) { revealed.add(i); state = 'over'; $('#status').textContent = 'Mine !'; draw(); return; }
  const open = [i];
  while (open.length) {
    const k = open.pop();
    if (revealed.has(k) || flags.has(k)) continue;
    revealed.add(k);
    const px = k % N, py = Math.floor(k / N);
    if (countAdjacent(mines, px, py, N, N) === 0) {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = px + dx, ny = py + dy;
        if (nx >= 0 && nx < N && ny >= 0 && ny < N) open.push(indexOf(nx, ny, N));
      }
    }
  }
  score = revealed.size; $('#score').textContent = String(score);
  if (score === N * N - MINE_COUNT) {
    state = 'won'; $('#status').textContent = 'Gagné';
    if (!best || elapsed < best) { best = Math.floor(elapsed); localStorage.setItem('neonMinesBest', String(best)); $('#best').textContent = best + 's'; }
  }
  draw();
}

function draw() {
  ctx.clearRect(0, 0, W, W);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = indexOf(x, y, N), px = x * CELL, py = y * CELL;
    ctx.fillStyle = revealed.has(i) ? '#102923' : '#174139';
    ctx.strokeStyle = '#69ffe155'; ctx.lineWidth = 2;
    ctx.fillRect(px + 2, py + 2, CELL - 4, CELL - 4); ctx.strokeRect(px + 2, py + 2, CELL - 4, CELL - 4);
    if (flags.has(i)) {
      ctx.fillStyle = '#ffd36b'; ctx.font = 'bold 28px system-ui'; ctx.textAlign = 'center'; ctx.fillText('⚑', px + 30, py + 39);
    } else if (revealed.has(i)) {
      if (mines.has(i)) {
        ctx.fillStyle = '#ff648f'; ctx.beginPath(); ctx.arc(px + 30, py + 30, 13, 0, Math.PI * 2); ctx.fill();
      } else {
        const n = countAdjacent(mines, x, y, N, N);
        if (n) {
          ctx.fillStyle = ['', '#69ffe1', '#ffd36b', '#ff648f', '#b58aff', '#8bffbd', '#ff9d65', '#72bdff', '#fff'][n];
          ctx.font = 'bold 25px system-ui'; ctx.textAlign = 'center'; ctx.fillText(String(n), px + 30, py + 39);
        }
      }
    }
  }
  if (state === 'paused' || state === 'ready' || state === 'over' || state === 'won') {
    ctx.fillStyle = '#04100dc9'; ctx.fillRect(0, 0, W, W);
    ctx.fillStyle = '#69ffe1'; ctx.textAlign = 'center'; ctx.font = '800 30px system-ui';
    ctx.fillText(state === 'paused' ? 'PAUSE' : state === 'over' ? 'MINE !' : state === 'won' ? 'GRILLE SÉCURISÉE' : 'NEON MINES', W / 2, W / 2);
    ctx.fillStyle = '#edfffa'; ctx.font = '15px system-ui';
    ctx.fillText(state === 'ready' ? 'Révèle ta première case' : state === 'paused' ? 'Clique sur Pause pour reprendre' : 'Recommencer pour rejouer', W / 2, W / 2 + 32);
  }
}

function togglePause() {
  if (state === 'playing') { state = 'paused'; $('#status').textContent = 'Pause'; draw(); }
  else if (state === 'paused') { state = 'playing'; $('#status').textContent = 'En jeu'; last = performance.now(); draw(); }
  else if (state === 'ready') { state = 'playing'; $('#status').textContent = 'En jeu'; draw(); }
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
  if (flags.has(i)) flags.delete(i); else flags.add(i);
  $('#mines-left').textContent = String(MINE_COUNT - flags.size);
  draw();
});

$('#pause').onclick = togglePause;
$('#restart').onclick = setup;
$('#new-game').onclick = setup;
window.addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'p') togglePause(); });

function frame(t) {
  if (state === 'playing') { elapsed += (t - last) / 1000; $('#status').textContent = 'En jeu · ' + Math.floor(elapsed) + 's'; }
  last = t;
  requestAnimationFrame(frame);
}

setup();
requestAnimationFrame(frame);
