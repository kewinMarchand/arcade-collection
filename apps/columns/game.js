import { mountGameFrame } from '../../packages/ui/src/gameFrame.js';

const shell = mountGameFrame({
  mount: document.getElementById('shell-mount'),
  config: {
    title: 'Neon Columns',
    subtitle: 'Aligne les gemmes · Fais grimper le score',
    panels: [
      {
        side: 'left',
        id: 'hud',
        render: () => {
          const panel = document.createElement('div');
          panel.className = 'neon-panel';
          panel.dataset.testid = 'game-panel-left';

          const scoreTitle = document.createElement('h2');
          scoreTitle.className = 'neon-panel__title';
          scoreTitle.textContent = 'Score';

          const score = document.createElement('p');
          score.className = 'neon-panel__value';
          score.id = 'score';
          score.textContent = '0';

          const status = document.createElement('p');
          status.className = 'neon-panel__text';
          status.id = 'status';
          status.textContent = 'Prêt';

          const nextTitle = document.createElement('h2');
          nextTitle.className = 'neon-panel__title';
          nextTitle.textContent = 'Suivant';

          const previewWrap = document.createElement('div');
          previewWrap.className = 'next-preview';
          const nextCanvas = document.createElement('canvas');
          nextCanvas.id = 'next';
          nextCanvas.width = 80;
          nextCanvas.height = 120;
          nextCanvas.setAttribute('aria-label', 'Prochain élément');
          previewWrap.appendChild(nextCanvas);

          panel.append(scoreTitle, score, status, nextTitle, previewWrap);
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

          const pauseBtn = document.createElement('button');
          pauseBtn.id = 'pause';
          pauseBtn.type = 'button';
          pauseBtn.textContent = 'Pause';

          const restartBtn = document.createElement('button');
          restartBtn.id = 'restart';
          restartBtn.type = 'button';
          restartBtn.textContent = 'Recommencer';

          const newGameBtn = document.createElement('button');
          newGameBtn.id = 'new-game';
          newGameBtn.type = 'button';
          newGameBtn.className = 'primary';
          newGameBtn.textContent = 'Nouvelle partie';

          actions.append(pauseBtn, restartBtn, newGameBtn);

          const help = document.createElement('p');
          help.className = 'help';
          help.textContent = '← → déplacer · ↓ accélérer · ↑ / X pivoter · Espace : chute · P : pause';

          panel.append(title, actions, help);
          return panel;
        },
      },
    ],
    screen: {
      mount: (el) => {
        const canvas = document.createElement('canvas');
        canvas.id = 'game';
        canvas.width = 480;
        canvas.height = 650;
        canvas.setAttribute('aria-label', 'Plateau Neon Columns');
        el.appendChild(canvas);
      },
    },
  },
});

const canvas = shell.screen.querySelector('canvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextCtx = nextCanvas.getContext('2d');
const $ = (s) => document.querySelector(s);

const COLS = 8;
const ROWS = 12;
const CELL = 40;
const W = canvas.width;
const H = canvas.height;
const colors = ['#ff648f', '#61ffe0', '#ffd36b', '#b58aff', '#8bffbd'];

let board;
let piece;
let nextPiece;
let score = 0;
let state = 'ready';
let timer = 0;
let last = 0;

const empty = () => Array.from({ length: ROWS }, () => Array(COLS).fill(-1));
const newPiece = () => ({ col: 3, row: 0, gems: Array.from({ length: 3 }, () => Math.floor(Math.random() * colors.length)) });

function drawNext() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (!nextPiece) return;
  const cx = nextCanvas.width / 2;
  const startY = 18;
  const r = 14;
  nextPiece.gems.forEach((c, i) => {
    const y = startY + i * 32;
    nextCtx.fillStyle = colors[c];
    nextCtx.shadowColor = colors[c];
    nextCtx.shadowBlur = 10;
    nextCtx.beginPath();
    nextCtx.arc(cx, y, r, 0, Math.PI * 2);
    nextCtx.fill();
  });
  nextCtx.shadowBlur = 0;
}

function reset() {
  board = empty();
  piece = newPiece();
  nextPiece = newPiece();
  score = 0;
  state = 'ready';
  timer = 0;
  $('#score').textContent = '0';
  $('#status').textContent = 'Prêt';
  drawNext();
  draw();
}

function start() {
  reset();
  state = 'playing';
  $('#status').textContent = 'En jeu';
}

function pause() {
  if (state === 'playing') {
    state = 'paused';
    $('#status').textContent = 'Pause';
  } else if (state === 'paused') {
    state = 'playing';
    last = performance.now();
    $('#status').textContent = 'En jeu';
  } else if (state === 'ready') {
    start();
  }
}

function can(col, row, gems = piece.gems) {
  return col >= 0 && col < COLS && gems.every((_, i) => row + i < ROWS && (row + i < 0 || board[row + i][col] === -1));
}

function move(dx) {
  if (state === 'playing' && can(piece.col + dx, piece.row)) piece.col += dx;
}

function rotate() {
  if (state !== 'playing') return;
  const g = piece.gems;
  piece.gems = [g[2], g[0], g[1]];
}

function drop() {
  if (state !== 'playing') return;
  while (can(piece.col, piece.row + 1)) piece.row++;
  lock();
}

function lock() {
  piece.gems.forEach((c, i) => {
    if (piece.row + i >= 0) board[piece.row + i][piece.col] = c;
  });
  piece = nextPiece;
  nextPiece = newPiece();
  drawNext();
  if (!can(piece.col, piece.row)) {
    state = 'over';
    $('#status').textContent = 'Terminé';
    return;
  }
  resolve();
  timer = 0;
}

function resolve() {
  let found = true;
  while (found) {
    found = false;
    const remove = new Set();
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = board[y][x];
        if (c < 0) continue;
        for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
          const cells = [[x, y]];
          for (let n = 1; n < 3; n++) {
            const nx = x + dx * n;
            const ny = y + dy * n;
            if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS || board[ny][nx] !== c) break;
            cells.push([nx, ny]);
          }
          if (cells.length === 3) cells.forEach(([a, b]) => remove.add(`${a},${b}`));
        }
      }
    }
    if (remove.size) {
      found = true;
      remove.forEach((key) => {
        const [x, y] = key.split(',').map(Number);
        board[y][x] = -1;
      });
      score += remove.size * 10;
      for (let x = 0; x < COLS; x++) {
        const stack = board.map((row) => row[x]).filter((v) => v >= 0);
        for (let y = ROWS - 1; y >= 0; y--) board[y][x] = stack.pop() ?? -1;
      }
    }
  }
  $('#score').textContent = score;
}

function update(dt) {
  if (state !== 'playing') return;
  timer += dt;
  if (timer > 0.65) {
    timer = 0;
    if (can(piece.col, piece.row + 1)) piece.row++;
    else lock();
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#061713';
  ctx.fillRect(0, 0, W, H);

  const offsetX = (W - COLS * CELL) / 2;
  const offsetY = H - ROWS * CELL;

  // grid
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const px = offsetX + x * CELL;
      const py = offsetY + y * CELL;
      ctx.fillStyle = '#ffffff08';
      ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
      if (board && board[y][x] >= 0) {
        ctx.fillStyle = colors[board[y][x]];
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(px + CELL / 2, py + CELL / 2, CELL * 0.34, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }

  // active piece
  if (piece && state !== 'over') {
    for (let i = 0; i < 3; i++) {
      const y = piece.row + i;
      if (y < 0 || y >= ROWS) continue;
      const px = offsetX + piece.col * CELL;
      const py = offsetY + y * CELL;
      ctx.fillStyle = colors[piece.gems[i]];
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(px + CELL / 2, py + CELL / 2, CELL * 0.34, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  if (state !== 'playing') {
    ctx.fillStyle = '#04100ddd';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#69ffe1';
    ctx.font = '800 28px system-ui';
    const title = state === 'ready' ? 'NEON COLUMNS' : state === 'paused' ? 'PAUSE' : 'PARTIE TERMINÉE';
    ctx.fillText(title, W / 2, H / 2);
    ctx.fillStyle = '#edfffa';
    ctx.font = '14px system-ui';
    const hint = state === 'ready' ? 'Entrée ou Nouvelle partie pour jouer' : state === 'paused' ? 'Appuie sur P pour reprendre' : 'Recommencer pour rejouer';
    ctx.fillText(hint, W / 2, H / 2 + 30);
  }
}

function frame(t) {
  const dt = Math.min((t - last) / 1000 || 0, 0.04);
  last = t;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

window.addEventListener('keydown', (e) => {
  const map = {
    ArrowLeft: () => move(-1),
    ArrowRight: () => move(1),
    ArrowDown: () => { if (can(piece.col, piece.row + 1)) piece.row++; },
    ArrowUp: rotate,
    x: rotate,
    X: rotate,
    ' ': drop,
    Enter: () => { if (state === 'ready') start(); },
    p: pause,
    P: pause,
  };
  if (map[e.key]) {
    e.preventDefault();
    map[e.key]();
  }
});

$('#pause').onclick = pause;
$('#restart').onclick = start;
$('#new-game').onclick = start;
canvas.addEventListener('pointerdown', () => {
  if (state === 'over' || state === 'ready') start();
});

reset();
requestAnimationFrame(frame);
