import { mountGameFrame } from '../../packages/ui/src/gameFrame.js';
import { createAudio } from '../../packages/shared/src/audio.js';

const shell = mountGameFrame({
  mount: document.getElementById('shell-mount'),
  config: {
    title: 'Neon Columns',
    subtitle: 'Aligne les symboles • Fais grimper le score',
    renderHeader: () => {
      const options = document.createElement('div');
      options.className = 'game-options';
      options.setAttribute('aria-label', 'Options de jeu');

      const difficulty = document.createElement('label');
      difficulty.className = 'option';
      difficulty.append('Difficulté ');
      const select = document.createElement('select');
      select.id = 'difficulty';
      select.setAttribute('aria-label', 'Difficulté');
      select.innerHTML = '<option value="chill">Chill</option><option value="arcade" selected>Arcade</option><option value="chaos">Chaos</option>';
      difficulty.appendChild(select);

      const bonus = document.createElement('label');
      bonus.className = 'option';
      const bonusInput = document.createElement('input');
      bonusInput.id = 'bonus';
      bonusInput.className = 'toggle';
      bonusInput.type = 'checkbox';
      bonusInput.checked = true;
      bonus.append(' Bonus ', bonusInput);

      const sound = document.createElement('label');
      sound.className = 'option';
      const soundInput = document.createElement('input');
      soundInput.id = 'sound';
      soundInput.className = 'toggle';
      soundInput.type = 'checkbox';
      sound.append(' Sons ', soundInput);

      options.append(difficulty, bonus, sound);
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
          help.textContent = '← → déplacer • ↓ accélérer • ↑ / X pivoter • Espace : chute • P : pause';

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
        canvas.height = 720;
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
const difficultyInput = $('#difficulty');
const bonusInput = $('#bonus');
const soundInput = $('#sound');
const audio = createAudio(() => soundInput && soundInput.checked);

const COLS = 8;
const ROWS = 12;
const colors = ['#ff648f', '#61ffe0', '#ffd36b', '#b58aff', '#8bffbd'];

const DIFF = {
  chill: { speed: 0.8, bonusMult: 1 },
  arcade: { speed: 0.65, bonusMult: 1.2 },
  chaos: { speed: 0.48, bonusMult: 1.5 },
};

let board;
let piece;
let nextPiece;
let score = 0;
let state = 'ready';
let timer = 0;
let last = 0;
let particles = [];
let pulses = [];
let shake = 0;
let flash = 0;
let comboText = '';
let comboTimer = 0;
let CELL = 40;
let offsetX = 0;
let offsetY = 0;
let stars = [];

function initStars() {
  stars = Array.from({ length: 150 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: Math.random() < 0.14 ? 2.3 : Math.random() * 1.5 + 0.35,
    a: 0.2 + Math.random() * 0.75,
    tw: Math.random() * Math.PI * 2,
    sp: 0.6 + Math.random() * 1.6,
    vy: 0.008 + Math.random() * 0.03,
    vx: (Math.random() - 0.5) * 0.012,
  }));
}

const empty = () => Array.from({ length: ROWS }, () => Array(COLS).fill(-1));
const newPiece = () => ({ col: 3, row: 0, gems: Array.from({ length: 3 }, () => Math.floor(Math.random() * colors.length)) });

function resizeCanvas() {
  const screen = shell.screen;
  if (!screen) return;
  const cs = getComputedStyle(screen);
  const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  const w = Math.max(200, Math.floor(screen.clientWidth - padX));
  const h = Math.max(240, Math.floor(screen.clientHeight - padY));
  canvas.width = w;
  canvas.height = h;
  CELL = h / ROWS;
  const boardW = COLS * CELL;
  offsetX = Math.floor((w - boardW) / 2);
  offsetY = 0;
}

function drawSymbol(targetCtx, x, y, r, colorIndex, color, glow = 10, t = 0) {
  targetCtx.save();
  targetCtx.translate(x, y);
  targetCtx.shadowColor = color;
  targetCtx.shadowBlur = glow;
  targetCtx.lineJoin = 'round';
  targetCtx.lineCap = 'round';
  const time = (t || 0) * 0.001;
  const pulse = 0.92 + 0.08 * Math.sin(time * 4 + colorIndex);

  if (colorIndex === 0) {
    // Alien module artifact
    const hull = targetCtx.createLinearGradient(0, -r, 0, r);
    hull.addColorStop(0, '#ffd6e8'); hull.addColorStop(0.35, color); hull.addColorStop(1, '#5a1030');
    targetCtx.fillStyle = hull; targetCtx.strokeStyle = '#ffffff44'; targetCtx.lineWidth = Math.max(1, r * 0.06);
    targetCtx.beginPath();
    targetCtx.moveTo(-r, -r * 0.1); targetCtx.lineTo(-r * 0.7, -r * 0.72); targetCtx.lineTo(-r * 0.18, -r * 0.88);
    targetCtx.lineTo(r * 0.18, -r * 0.88); targetCtx.lineTo(r * 0.7, -r * 0.62); targetCtx.lineTo(r, -r * 0.02);
    targetCtx.lineTo(r * 0.78, r * 0.42); targetCtx.lineTo(r * 0.42, r * 0.48); targetCtx.lineTo(r * 0.24, r * 0.86);
    targetCtx.lineTo(0, r * 0.52); targetCtx.lineTo(-r * 0.24, r * 0.86); targetCtx.lineTo(-r * 0.42, r * 0.42);
    targetCtx.lineTo(-r * 0.78, r * 0.34); targetCtx.closePath(); targetCtx.fill(); targetCtx.stroke();
    targetCtx.fillStyle = color; targetCtx.fillRect(-r * 1.12, -r * 0.22, r * 0.22, r * 0.48); targetCtx.fillRect(r * 0.9, -r * 0.22, r * 0.22, r * 0.48);
    targetCtx.shadowBlur = 0;
    targetCtx.fillStyle = '#170a14'; targetCtx.beginPath(); targetCtx.ellipse(-r * 0.28, -r * 0.04, r * 0.14, r * 0.2, -0.15, 0, Math.PI * 2); targetCtx.fill();
    targetCtx.beginPath(); targetCtx.ellipse(r * 0.28, -r * 0.04, r * 0.14, r * 0.2, 0.15, 0, Math.PI * 2); targetCtx.fill();
    targetCtx.fillStyle = '#fff'; targetCtx.globalAlpha = 0.9; targetCtx.fillRect(-r * 0.33, -r * 0.12, r * 0.05, r * 0.05); targetCtx.fillRect(r * 0.22, -r * 0.12, r * 0.05, r * 0.05); targetCtx.globalAlpha = 1;
    targetCtx.strokeStyle = '#ffffff33'; targetCtx.beginPath(); targetCtx.moveTo(-r * 0.15, -r * 0.55); targetCtx.lineTo(r * 0.15, -r * 0.55); targetCtx.stroke();
  } else if (colorIndex === 1) {
    // Capsule ship module
    const body = targetCtx.createLinearGradient(-r * 0.2, -r, r * 0.2, r);
    body.addColorStop(0, '#ffffff'); body.addColorStop(0.3, color); body.addColorStop(1, '#0f5f55');
    targetCtx.fillStyle = body; targetCtx.strokeStyle = '#ffffff55'; targetCtx.lineWidth = Math.max(1, r * 0.06);
    targetCtx.beginPath(); targetCtx.roundRect(-r * 0.78, -r * 0.88, r * 1.56, r * 1.76, r * 0.52); targetCtx.fill(); targetCtx.stroke();
    targetCtx.shadowBlur = 0;
    const cockpit = targetCtx.createRadialGradient(-r * 0.1, -r * 0.2, r * 0.05, 0, -r * 0.05, r * 0.42);
    cockpit.addColorStop(0, '#d9fff7'); cockpit.addColorStop(1, '#13453f');
    targetCtx.fillStyle = cockpit; targetCtx.beginPath(); targetCtx.ellipse(0, -r * 0.05, r * 0.34, r * 0.4, 0, 0, Math.PI * 2); targetCtx.fill();
    targetCtx.fillStyle = '#ffffff99'; targetCtx.beginPath(); targetCtx.ellipse(-r * 0.08, -r * 0.2, r * 0.1, r * 0.15, -0.3, 0, Math.PI * 2); targetCtx.fill();
    targetCtx.fillStyle = '#faffc4'; targetCtx.shadowColor = '#faffc4'; targetCtx.shadowBlur = 6 * pulse;
    targetCtx.fillRect(-r * 0.58, r * 0.22, r * 0.16, r * 0.3); targetCtx.fillRect(r * 0.42, r * 0.22, r * 0.16, r * 0.3);
    targetCtx.shadowBlur = 0; targetCtx.strokeStyle = '#ffffff33'; targetCtx.beginPath(); targetCtx.moveTo(-r * 0.45, -r * 0.55); targetCtx.lineTo(r * 0.45, -r * 0.55); targetCtx.stroke();
  } else if (colorIndex === 2) {
    // Photon core artifact
    const core = targetCtx.createRadialGradient(-r * 0.15, -r * 0.2, r * 0.1, 0, 0, r * 0.78);
    core.addColorStop(0, '#fffef0'); core.addColorStop(0.45, color); core.addColorStop(1, '#5a4300');
    targetCtx.fillStyle = core; targetCtx.beginPath(); targetCtx.arc(0, 0, r * 0.72 * pulse, 0, Math.PI * 2); targetCtx.fill();
    targetCtx.strokeStyle = color; targetCtx.lineWidth = Math.max(1.5, r * 0.11);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + time * 1.2;
      targetCtx.beginPath(); targetCtx.moveTo(Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.35); targetCtx.lineTo(Math.cos(a) * r, Math.sin(a) * r); targetCtx.stroke();
    }
    targetCtx.shadowBlur = 0; targetCtx.strokeStyle = '#ffffff66'; targetCtx.lineWidth = 1.2; targetCtx.beginPath(); targetCtx.arc(0, 0, r * 0.95, 0, Math.PI * 2); targetCtx.stroke();
    targetCtx.fillStyle = '#fffbe0'; targetCtx.beginPath(); targetCtx.arc(-r * 0.18, -r * 0.22, r * 0.16, 0, Math.PI * 2); targetCtx.fill();
  } else if (colorIndex === 3) {
    // Crystal reactor artifact
    const gem = targetCtx.createLinearGradient(-r * 0.3, -r, r * 0.4, r);
    gem.addColorStop(0, '#f3e8ff'); gem.addColorStop(0.4, color); gem.addColorStop(1, '#30145a');
    targetCtx.fillStyle = gem; targetCtx.strokeStyle = '#ffffff55'; targetCtx.lineWidth = Math.max(1, r * 0.06);
    targetCtx.beginPath(); targetCtx.moveTo(0, -r); targetCtx.lineTo(r * 0.78, -r * 0.15); targetCtx.lineTo(r * 0.55, r * 0.85);
    targetCtx.lineTo(-r * 0.55, r * 0.85); targetCtx.lineTo(-r * 0.78, -r * 0.15); targetCtx.closePath(); targetCtx.fill(); targetCtx.stroke();
    targetCtx.shadowBlur = 0; targetCtx.strokeStyle = '#ffffff55'; targetCtx.lineWidth = Math.max(1, r * 0.07);
    targetCtx.beginPath(); targetCtx.moveTo(0, -r); targetCtx.lineTo(0, r * 0.85); targetCtx.moveTo(-r * 0.78, -r * 0.15); targetCtx.lineTo(r * 0.78, -r * 0.15); targetCtx.stroke();
    targetCtx.fillStyle = '#ffffff66'; targetCtx.beginPath(); targetCtx.moveTo(-r * 0.08, -r * 0.82); targetCtx.lineTo(-r * 0.45, -r * 0.15); targetCtx.lineTo(-r * 0.08, -r * 0.15); targetCtx.closePath(); targetCtx.fill();
    targetCtx.fillStyle = color; targetCtx.globalAlpha = 0.7; targetCtx.fillRect(-r * 0.08, r * 0.35, r * 0.16, r * 0.2); targetCtx.globalAlpha = 1;
  } else {
    // Drone chevron artifact
    const body = targetCtx.createLinearGradient(0, -r, 0, r);
    body.addColorStop(0, '#eafff4'); body.addColorStop(0.4, color); body.addColorStop(1, '#0b4a35');
    targetCtx.fillStyle = body; targetCtx.strokeStyle = '#ffffff44'; targetCtx.lineWidth = Math.max(1, r * 0.06);
    targetCtx.beginPath(); targetCtx.moveTo(0, -r); targetCtx.lineTo(r * 0.95, -r * 0.15); targetCtx.lineTo(r * 0.55, r * 0.15);
    targetCtx.lineTo(r * 0.75, r * 0.85); targetCtx.lineTo(0, r * 0.35); targetCtx.lineTo(-r * 0.75, r * 0.85);
    targetCtx.lineTo(-r * 0.55, r * 0.15); targetCtx.lineTo(-r * 0.95, -r * 0.15); targetCtx.closePath(); targetCtx.fill(); targetCtx.stroke();
    targetCtx.shadowBlur = 0;
    targetCtx.fillStyle = '#0e2a1f'; targetCtx.beginPath(); targetCtx.arc(0, -r * 0.05, r * 0.22, 0, Math.PI * 2); targetCtx.fill();
    targetCtx.fillStyle = '#bfffe8'; targetCtx.globalAlpha = 0.9; targetCtx.beginPath(); targetCtx.arc(0, -r * 0.05, r * 0.1, 0, Math.PI * 2); targetCtx.fill(); targetCtx.globalAlpha = 1;
    targetCtx.fillStyle = '#ffffff88'; targetCtx.fillRect(-r * 0.04, -r * 0.58, r * 0.08, r * 0.22);
    targetCtx.strokeStyle = '#ffffff33'; targetCtx.beginPath(); targetCtx.moveTo(-r * 0.45, r * 0.05); targetCtx.lineTo(r * 0.45, r * 0.05); targetCtx.stroke();
  }

  targetCtx.restore();
}

function drawNext() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (!nextPiece) return;
  const cx = nextCanvas.width / 2;
  const startY = 20;
  const r = 14;
  nextPiece.gems.forEach((c, i) => {
    drawSymbol(nextCtx, cx, startY + i * 36, r, c, colors[c], 8, performance.now());
  });
}

function reset() {
  board = empty();
  piece = newPiece();
  nextPiece = newPiece();
  score = 0;
  state = 'ready';
  timer = 0;
  particles = [];
  pulses = [];
  shake = 0;
  flash = 0;
  comboText = '';
  comboTimer = 0;
  initStars();
  $('#score').textContent = '0';
  $('#status').textContent = 'Prêt';
  drawNext();
  draw(0);
}

function start() {
  reset();
  state = 'playing';
  $('#status').textContent = 'En jeu';
  audio.tone(520, 0.1, 'triangle', 0.03);
}

function pause() {
  if (state === 'playing') {
    state = 'paused';
    $('#status').textContent = 'Pause';
  } else if (state === 'paused') {
    state = 'playing';
    last = performance.now();
    $('#status').textContent = 'En jeu';
  } else if (state === 'ready' || state === 'over') {
    start();
  }
}

function can(col, row, gems = piece.gems) {
  return col >= 0 && col < COLS && gems.every((_, i) => row + i < ROWS && (row + i < 0 || board[row + i][col] === -1));
}

function move(dx) {
  if (state === 'playing' && can(piece.col + dx, piece.row)) {
    piece.col += dx;
    audio.tone(260, 0.03, 'square', 0.015);
  }
}

function rotate() {
  if (state !== 'playing') return;
  const g = piece.gems;
  piece.gems = [g[2], g[0], g[1]];
  audio.tone(420, 0.04, 'triangle', 0.02);
}

function cellCenterBoard(x, y) {
  return { cx: offsetX + x * CELL + CELL / 2, cy: offsetY + y * CELL + CELL / 2 };
}

function burstCell(x, y, color, n = 12, power = 1) {
  const { cx, cy } = cellCenterBoard(x, y);
  burst(cx, cy, color, n, power);
  pulses.push({ x: cx, y: cy, r: 8, life: 0.36, max: 0.36, color, w: 2.5 });
}

function burst(x, y, color, n = 12, power = 1) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (30 + Math.random() * 150) * power;
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.28 + Math.random() * 0.4, max: 0.68, color, s: 1.5 + Math.random() * 3.2, spin: Math.random() * 8, square: Math.random() < 0.45 });
  }
}
function ring(x, y, color, r0 = 8, life = 0.36) {
  pulses.push({ x, y, r: r0, life, max: life, color, w: 2.5 });
}

function drop() {
  if (state !== 'playing') return;
  let moved = 0;
  while (can(piece.col, piece.row + 1)) { piece.row++; moved++; }
  if (moved) audio.tone(180, 0.05, 'sawtooth', 0.02);
  lock();
}

function lock() {
  piece.gems.forEach((c, i) => {
    const y = piece.row + i;
    if (y >= 0) {
      board[y][piece.col] = c;
      burstCell(piece.col, y, colors[c], 8);
    }
  });
  shake = Math.max(shake, 0.18);
  flash = Math.max(flash, 0.08);
  audio.tone(160, 0.05, 'square', 0.02);
  piece = nextPiece;
  nextPiece = newPiece();
  drawNext();
  if (!can(piece.col, piece.row)) {
    state = 'over';
    $('#status').textContent = 'Terminé';
    const overX = offsetX + (piece.col + 0.5) * CELL;
    const overY = offsetY + (piece.row + 1) * CELL;
    burst(overX, overY, '#ff648f', 30, 1.2);
    ring(overX, overY, '#ff648f', 12, 0.55);
    shake = 0.6; flash = 0.35;
    audio.seq([[220, 0.15, 'sawtooth', 0.04, 0], [160, 0.2, 'sawtooth', 0.04, 0.08]]);
    return;
  }
  resolve();
  timer = 0;
}

function resolve() {
  let found = true;
  let chain = 0;
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
      chain++;
      const d = DIFF[difficultyInput.value] || DIFF.arcade;
      const mult = bonusInput.checked ? d.bonusMult * chain : 1;
      remove.forEach((key) => {
        const [x, y] = key.split(',').map(Number);
        burstCell(x, y, colors[board[y][x]], 12, 1 + chain * 0.08);
        board[y][x] = -1;
      });
      score += Math.floor(remove.size * 10 * mult);
      shake = Math.min(0.6, shake + 0.14);
      flash = Math.max(flash, 0.12 + chain * 0.03);
      if (chain > 1) { comboText = `COMBO x${chain}`; comboTimer = 1.1; }
      audio.tone(420 + chain * 80, 0.08, 'triangle', 0.03);
      for (let x = 0; x < COLS; x++) {
        const stack = board.map((row) => row[x]).filter((v) => v >= 0);
        for (let y = ROWS - 1; y >= 0; y--) board[y][x] = stack.pop() ?? -1;
      }
    }
  }
  $('#score').textContent = score;
}

function update(dt) {
  shake = Math.max(0, shake - dt * 2.6);
  flash = Math.max(0, flash - dt * 2.2);
  comboTimer = Math.max(0, comboTimer - dt);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 140 * dt; p.vx *= 0.98; p.vy *= 0.985; p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = pulses.length - 1; i >= 0; i--) {
    pulses[i].r += 100 * dt;
    if ((pulses[i].life -= dt) <= 0) pulses.splice(i, 1);
  }
  for (const s of stars) {
    s.y += s.vy * dt;
    s.x += s.vx * dt;
    if (s.y > 1.02) { s.y = -0.02; s.x = Math.random(); }
    if (s.x < -0.02) s.x = 1.02;
    if (s.x > 1.02) s.x = -0.02;
  }

  if (state !== 'playing') return;
  timer += dt;
  const d = DIFF[difficultyInput.value] || DIFF.arcade;
  if (timer > d.speed) {
    timer = 0;
    if (can(piece.col, piece.row + 1)) piece.row++;
    else lock();
  }
}

function draw(t) {
  resizeCanvas();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * 10 * shake, (Math.random() - 0.5) * 10 * shake);

  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, '#0b1e19'); bg.addColorStop(0.5, '#071713'); bg.addColorStop(1, '#061713');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const time = (t || 0) * 0.001;
  const nebula = (x, y, r, color) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color); g.addColorStop(1, 'transparent');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  nebula(canvas.width * 0.2 + Math.sin(time * 0.18) * 35, canvas.height * 0.25, Math.max(180, canvas.width * 0.35), '#00e0a51a');
  nebula(canvas.width * 0.8, canvas.height * 0.6 + Math.cos(time * 0.14) * 25, Math.max(170, canvas.width * 0.32), '#24b99b18');

  ctx.save();
  ctx.strokeStyle = '#9bfff008';
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
  for (let y = 0; y <= canvas.height; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
  ctx.restore();

  for (const s of stars) {
    const tw = 0.55 + 0.45 * Math.sin(time * s.sp + s.tw);
    ctx.globalAlpha = Math.min(1, s.a * tw);
    ctx.fillStyle = s.r > 1.8 ? '#ffffff' : '#dffcff';
    ctx.shadowColor = '#7af7e0';
    ctx.shadowBlur = s.r > 1.6 ? 7 : 0;
    ctx.beginPath();
    ctx.arc(s.x * canvas.width, s.y * canvas.height, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  const boardW = COLS * CELL;
  const boardH = ROWS * CELL;

  // board frame glow
  ctx.save();
  ctx.shadowColor = '#69ffe1'; ctx.shadowBlur = 16; ctx.strokeStyle = '#69ffe144'; ctx.lineWidth = 2;
  ctx.strokeRect(offsetX - 3, offsetY - 3, boardW + 6, boardH + 6);
  ctx.restore();

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const px = offsetX + x * CELL;
      const py = offsetY + y * CELL;
      ctx.fillStyle = (x + y) % 2 === 0 ? '#ffffff06' : '#ffffff03';
      ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
      if (board && board[y][x] >= 0) {
        const c = board[y][x];
        const pulse = 1 + 0.04 * Math.sin((t || 0) * 0.004 + x + y);
        drawSymbol(ctx, px + CELL / 2, py + CELL / 2, CELL * 0.34 * pulse, c, colors[c], 11, t || 0);
      }
    }
  }

  if (piece && state !== 'over') {
    for (let i = 0; i < 3; i++) {
      const y = piece.row + i;
      if (y < 0 || y >= ROWS) continue;
      const px = offsetX + piece.col * CELL;
      const py = offsetY + y * CELL;
      const c = piece.gems[i];
      drawSymbol(ctx, px + CELL / 2, py + CELL / 2, CELL * 0.34, c, colors[c], 15, t || 0);
    }
  }

  for (const p of pulses) {
    ctx.globalAlpha = Math.max(0, p.life / (p.max || 0.35));
    ctx.strokeStyle = p.color; ctx.lineWidth = p.w || 2.5; ctx.shadowColor = p.color; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  for (const p of particles) {
    ctx.globalAlpha = Math.min(1, (p.life / (p.max || 0.6)) * 2.2);
    ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 8;
    if (p.square) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(((p.max || 0.6) - p.life) * (p.spin || 6)); ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s); ctx.restore(); }
    else { ctx.beginPath(); ctx.arc(p.x, p.y, p.s * 0.7, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;

  ctx.restore();

  if (flash > 0) {
    ctx.save(); ctx.globalAlpha = Math.min(0.3, flash); ctx.fillStyle = '#cafff1'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.restore();
  }

  if (comboTimer > 0 && state === 'playing') {
    ctx.save();
    ctx.globalAlpha = Math.min(1, comboTimer * 1.8);
    ctx.textAlign = 'center'; ctx.font = '900 26px system-ui'; ctx.fillStyle = '#d9ff76'; ctx.shadowColor = '#d9ff76'; ctx.shadowBlur = 16;
    ctx.fillText(comboText, canvas.width / 2, 48);
    ctx.restore();
  }

  if (state !== 'playing') {
    ctx.fillStyle = '#04100ddd';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#69ffe1';
    ctx.font = '800 28px system-ui';
    const title = state === 'ready' ? 'NEON COLUMNS' : state === 'paused' ? 'PAUSE' : 'PARTIE TERMINÉE';
    ctx.fillText(title, canvas.width / 2, canvas.height / 2);
    ctx.fillStyle = '#edfffa';
    ctx.font = '14px system-ui';
    const hint = state === 'ready' ? 'Entrée ou Nouvelle partie pour jouer' : state === 'paused' ? 'Appuie sur P pour reprendre' : 'Recommencer pour rejouer';
    ctx.fillText(hint, canvas.width / 2, canvas.height / 2 + 30);
  }
}

function frame(t) {
  const dt = Math.min((t - last) / 1000 || 0, 0.04);
  last = t;
  update(dt);
  draw(t);
  requestAnimationFrame(frame);
}

window.addEventListener('keydown', (e) => {
  const map = {
    ArrowLeft: () => move(-1),
    ArrowRight: () => move(1),
    ArrowDown: () => {
      if (state === 'playing' && can(piece.col, piece.row + 1)) {
        piece.row++;
        timer = 0;
      }
    },
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

if (typeof ResizeObserver !== 'undefined') {
  const ro = new ResizeObserver(() => resizeCanvas());
  ro.observe(shell.screen);
}
window.addEventListener('resize', resizeCanvas);

reset();
requestAnimationFrame(frame);
