import { mountGameFrame } from '../../packages/ui/src/gameFrame.js';

const shell = mountGameFrame({
  mount: document.getElementById('shell-mount'),
  config: {
    title: 'Neon Maze',
    subtitle: 'Mangez les pastilles, échappez aux fantômes.',
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
          if (id === 'sound') input.checked = true;
          wrap.append(` ${label} `, input);
        }
        return wrap;
      };
      options.append(
        mk('Difficulté', 'difficulty', 'select', '<option value="chill">Chill</option><option value="arcade" selected>Arcade</option><option value="chaos">Chaos</option>'),
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
          stats.append(stat('SCORE', 'score', '0'), stat('VIES', 'lives', '3'), stat('NIVEAU', 'level', '1'), stat('PASTILLES', 'dots', '0'));
          panel.append(title, stats);
          return panel;
        },
      },
      {
        side: 'right',
        id: 'controls',
        render: () => {
          const panel = document.createElement('div');
          panel.className = 'neon-panel';
          panel.dataset.testid = 'game-panel-right';
          const title = document.createElement('h2');
          title.className = 'neon-panel__title';
          title.textContent = 'Commandes';
          const ul = document.createElement('ul');
          ul.className = 'neon-panel__list';
          const li = (text) => { const l = document.createElement('li'); l.className = 'neon-panel__text'; l.textContent = text; ul.appendChild(l); };
          li('Flèches / WASD : déplacement');
          li('Pastille : 10 pts');
          li('Super pastille : 50 pts + fantômes vulnérables');
          li('Fantôme mangé : 200 pts');
          panel.append(title, ul);
          return panel;
        },
      },
    ],
    screen: {
      mount: (el) => {
        const canvas = document.createElement('canvas');
        canvas.id = 'gameCanvas';
        canvas.width = 600;
        canvas.height = 600;
        canvas.setAttribute('aria-label', 'Jeu Neon Maze');
        el.appendChild(canvas);
      },
    },
    footer: () => {
      const wrap = document.createElement('div');
      wrap.className = 'game-footer';
      const below = document.createElement('div');
      below.className = 'below';
      const hint = document.createElement('p');
      hint.className = 'hint';
      hint.textContent = 'Mangez toutes les pastilles pour passer au niveau suivant. Évitez les fantômes !';
      below.appendChild(hint);
      wrap.appendChild(below);
      return wrap;
    },
  },
});

const canvas = shell.screen.querySelector('canvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.querySelector('#score');
const livesEl = document.querySelector('#lives');
const levelEl = document.querySelector('#level');
const dotsEl = document.querySelector('#dots');
const soundInput = document.querySelector('#sound');
const difficultyInput = document.querySelector('#difficulty');

const W = canvas.width, H = canvas.height;
const TILE = 30;
const COLS = 20, ROWS = 20;

// Maze layout: 1=wall, 0=dot, 2=power pellet, 3=empty
const BASE_MAZE = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,0,1,1,1,0,1,1,0,1,1,1,0,1,1,0,1],
  [1,2,1,1,0,1,1,1,0,1,1,0,1,1,1,0,1,1,2,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,0,1,0,1,1,1,1,1,1,0,1,0,1,1,0,1],
  [1,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,0,1],
  [1,1,1,1,0,1,1,1,0,1,1,0,1,1,1,0,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,0,1,1,1,0,1,1,0,1,1,1,0,1,1,1,1],
  [1,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,0,1],
  [1,0,1,1,0,1,0,1,1,1,1,1,1,0,1,0,1,1,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,0,1,1,1,0,1,1,0,1,1,1,0,1,1,0,1],
  [1,2,1,1,0,1,1,1,0,1,1,0,1,1,1,0,1,1,2,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,0,1,0,1,1,1,1,1,1,0,1,0,1,1,0,1],
  [1,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

let maze = [];
let dots = 0, totalDots = 0;
let player = { x: 1, y: 1, dir: {x:0,y:0}, nextDir: {x:0,y:0}, mouth: 0 };
let ghosts = [];
let score = 0, lives = 3, level = 1, state = 'ready';
let powerTimer = 0;
let lastTime = 0;
let particles = [];

// Scatter/chase cycle: alternate 20s chase and 7s scatter
let chaseMode = true;
let modeTimer = 20;

const GHOST_COLORS = ['#ff65b5', '#ffad5c', '#79ffd0', '#75caff'];
const GHOST_NAMES = ['Blinky', 'Pinky', 'Inky', 'Clyde'];

function audio() { try { return soundInput.checked; } catch { return true; } }
function tone(freq, dur, type='sine', vol=0.03) {
  if (!audio()) return;
  try {
    const c = new (window.AudioContext || window.webkitAudioContext)();
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + dur);
  } catch {}
}

function initMaze() {
  maze = BASE_MAZE.map(row => row.slice());
  totalDots = 0;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (maze[y][x] === 0 || maze[y][x] === 2) totalDots++;
  }
  dots = totalDots;
  player = { x: 1, y: 1, dir: {x:0,y:0}, nextDir: {x:0,y:0}, mouth: 0 };
  ghosts = [
    { x: 4, y: 9, dir: {x:1,y:0}, color: GHOST_COLORS[0], name: GHOST_NAMES[0], vulnerable: 0, home: {x:4,y:9} },
    { x: 5, y: 9, dir: {x:-1,y:0}, color: GHOST_COLORS[1], name: GHOST_NAMES[1], vulnerable: 0, home: {x:5,y:9} },
    { x: 6, y: 9, dir: {x:1,y:0}, color: GHOST_COLORS[2], name: GHOST_NAMES[2], vulnerable: 0, home: {x:6,y:9} },
    { x: 7, y: 9, dir: {x:-1,y:0}, color: GHOST_COLORS[3], name: GHOST_NAMES[3], vulnerable: 0, home: {x:7,y:9} },
  ];
  powerTimer = 0;
  chaseMode = true; modeTimer = 20;
}

function start() {
  score = 0; lives = 3; level = 1;
  chaseMode = true; modeTimer = 20;
  initMaze();
  state = 'playing';
  scoreEl.textContent = '0'; livesEl.textContent = '3'; levelEl.textContent = '1'; dotsEl.textContent = totalDots;
}

function isWall(x, y) {
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return true;
  return maze[y][x] === 1;
}

function movePlayer(dt) {
  // try nextDir
  const nd = player.nextDir;
  const nx = player.x + nd.x, ny = player.y + nd.y;
  if (!isWall(nx, ny)) { player.dir = { ...nd }; }
  const d = player.dir;
  if (d.x === 0 && d.y === 0) return;
  // move with fractional (we use tile-based, move one tile per step)
  // Use accumulator for smooth movement
  if (!player.acc) player.acc = 0;
  player.acc += dt * 6;
  while (player.acc >= 1) {
    player.acc -= 1;
    const tx = player.x + d.x, ty = player.y + d.y;
    if (isWall(tx, ty)) { player.dir = {x:0,y:0}; break; }
    player.x = tx; player.y = ty;
    // eat
    if (maze[ty][tx] === 0) { maze[ty][tx] = 3; score += 10; dots--; scoreEl.textContent = score; dotsEl.textContent = dots; tone(660, 0.04, 'square', 0.02); }
    else if (maze[ty][tx] === 2) { maze[ty][tx] = 3; score += 50; dots--; powerTimer = 8; ghosts.forEach(g => g.vulnerable = 8); scoreEl.textContent = score; dotsEl.textContent = dots; tone(880, 0.15, 'triangle', 0.04); }
  }
  player.mouth = (player.mouth + dt * 8) % 1;
  if (dots <= 0) { level++; initMaze(); score += 100 * level; scoreEl.textContent = score; levelEl.textContent = level; dotsEl.textContent = totalDots; tone(660, 0.2, 'triangle', 0.04); }
}

// Scatter corners for each ghost (index matches ghosts array)
const SCATTER_TARGETS = [
  { x: COLS - 2, y: 1 },       // Blinky: top-right
  { x: 1,        y: 1 },       // Pinky:  top-left
  { x: COLS - 2, y: ROWS - 2 },// Inky:   bottom-right
  { x: 1,        y: ROWS - 2 },// Clyde:  bottom-left
];

function ghostTarget(g, idx) {
  // Vulnerable: flee toward nearest corner away from player
  if (g.vulnerable > 0) {
    // Pick the corner farthest from the player as flee target
    const corners = [{x:1,y:1},{x:COLS-2,y:1},{x:1,y:ROWS-2},{x:COLS-2,y:ROWS-2}];
    let best = corners[0], bestD = -1;
    for (const c of corners) {
      const d = Math.hypot(c.x - player.x, c.y - player.y);
      if (d > bestD) { bestD = d; best = c; }
    }
    return best;
  }
  // Scatter mode: each ghost heads to its own corner
  if (!chaseMode) return SCATTER_TARGETS[idx];

  // Chase mode: individual personalities
  const blinky = ghosts[0];
  switch (idx) {
    case 0: // Blinky — directly targets player
      return { x: player.x, y: player.y };

    case 1: { // Pinky — 4 tiles ahead of player
      const ahead = 4;
      return { x: player.x + player.dir.x * ahead, y: player.y + player.dir.y * ahead };
    }

    case 2: { // Inky — vector from Blinky through (player + 2 ahead), doubled
      const pivotX = player.x + player.dir.x * 2;
      const pivotY = player.y + player.dir.y * 2;
      return {
        x: Math.round(pivotX + (pivotX - blinky.x)),
        y: Math.round(pivotY + (pivotY - blinky.y)),
      };
    }

    case 3: { // Clyde — chase if far (>8 tiles), else scatter to own corner
      const dist = Math.hypot(g.x - player.x, g.y - player.y);
      return dist > 8 ? { x: player.x, y: player.y } : SCATTER_TARGETS[3];
    }

    default:
      return { x: player.x, y: player.y };
  }
}

function moveGhosts(dt) {
  // Update scatter/chase cycle (not during power-up)
  if (powerTimer <= 0) {
    modeTimer -= dt;
    if (modeTimer <= 0) {
      chaseMode = !chaseMode;
      modeTimer = chaseMode ? 20 : 7;
    }
  }

  const speed = 0.5 + (level - 1) * 0.05;
  for (let idx = 0; idx < ghosts.length; idx++) {
    const g = ghosts[idx];
    if (g.vulnerable > 0) g.vulnerable -= dt;
    if (!g.acc) g.acc = 0;
    g.acc += dt * speed * 4;
    while (g.acc >= 1) {
      g.acc -= 1;
      const target = ghostTarget(g, idx);
      let best = null, bestScore = -Infinity;
      const dirs = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
      for (const d of dirs) {
        const nx = g.x + d.x, ny = g.y + d.y;
        if (isWall(nx, ny)) continue;
        // don't reverse (unless no other choice — handled by best staying null)
        if (d.x === -g.dir.x && d.y === -g.dir.y) continue;
        const dist = Math.hypot(nx - target.x, ny - target.y);
        // Always minimise distance to target (ghostTarget already picks flee corner when vulnerable)
        if (-dist > bestScore) { bestScore = -dist; best = d; }
      }
      // If all moves reversed, allow reversal as fallback
      if (!best) {
        for (const d of dirs) {
          const nx = g.x + d.x, ny = g.y + d.y;
          if (isWall(nx, ny)) continue;
          const dist = Math.hypot(nx - target.x, ny - target.y);
          if (-dist > bestScore) { bestScore = -dist; best = d; }
        }
      }
      if (best) { g.dir = best; g.x += best.x; g.y += best.y; }
    }
    // collision with player
    if (g.x === player.x && g.y === player.y) {
      if (g.vulnerable > 0) {
        score += 200; scoreEl.textContent = score; g.x = g.home.x; g.y = g.home.y; g.vulnerable = 0;
        tone(880, 0.15, 'triangle', 0.04);
      } else {
        lives--; livesEl.textContent = lives;
        if (lives <= 0) { state = 'over'; }
        else { player.x = 1; player.y = 1; player.dir = {x:0,y:0}; player.nextDir = {x:0,y:0}; }
        tone(180, 0.2, 'sawtooth', 0.04);
      }
    }
  }
  powerTimer = Math.max(0, powerTimer - dt);
}

function update(dt) {
  if (state !== 'playing') return;
  movePlayer(dt);
  moveGhosts(dt);
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#061412'; ctx.fillRect(0, 0, W, H);
  // maze
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const t = maze[y][x];
    const px = x * TILE, py = y * TILE;
    if (t === 1) {
      ctx.fillStyle = '#1a2a4a'; ctx.fillRect(px, py, TILE, TILE);
      ctx.strokeStyle = '#3a5a8a'; ctx.lineWidth = 1; ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
    } else if (t === 0) {
      ctx.fillStyle = '#7bffe5'; ctx.beginPath(); ctx.arc(px + TILE/2, py + TILE/2, 2.5, 0, Math.PI * 2); ctx.fill();
    } else if (t === 2) {
      ctx.fillStyle = '#ffd36b'; ctx.shadowColor = '#ffd36b'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(px + TILE/2, py + TILE/2, 6, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    }
  }
  // player
  const px = player.x * TILE + TILE/2, py = player.y * TILE + TILE/2;
  ctx.fillStyle = '#7bffe5'; ctx.shadowColor = '#7bffe5'; ctx.shadowBlur = 12; ctx.beginPath();
  const mouth = 0.3 + Math.abs(Math.sin(player.mouth * Math.PI)) * 0.5;
  ctx.moveTo(px, py);
  ctx.arc(px, py, 11, mouth, Math.PI * 2 - mouth);
  ctx.lineTo(px, py); ctx.fill(); ctx.shadowBlur = 0;
  // ghosts
  for (const g of ghosts) {
    const gx = g.x * TILE + TILE/2, gy = g.y * TILE + TILE/2;
    ctx.fillStyle = g.vulnerable > 0 ? '#5a5a8a' : g.color;
    ctx.shadowColor = g.vulnerable > 0 ? '#888' : g.color; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(gx, gy, 11, Math.PI, 0); ctx.lineTo(gx + 11, gy + 11);
    for (let i = 0; i < 3; i++) ctx.lineTo(gx + 11 - (i + 1) * (22/3), gy + 6 + (i % 2 ? 0 : 5));
    ctx.lineTo(gx - 11, gy + 11); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(gx - 4, gy - 2, 3, 0, Math.PI * 2); ctx.arc(gx + 4, gy - 2, 3, 0, Math.PI * 2); ctx.fill();
  }
  // particles
  for (const p of particles) { ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 2, 2); }
  ctx.globalAlpha = 1;
  if (state !== 'playing') {
    ctx.fillStyle = 'rgba(6,20,18,0.75)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.fillStyle = '#7bffe5'; ctx.font = '800 32px system-ui';
    ctx.fillText(state === 'ready' ? 'NEON MAZE' : state === 'over' ? 'CAPTURE !' : 'NIVEAU TERMINE', W/2, H/2);
    ctx.fillStyle = '#edfffa'; ctx.font = '16px system-ui';
    ctx.fillText(state === 'ready' ? 'Fleches / WASD pour commencer' : 'Entree pour recommencer', W/2, H/2 + 34);
  }
}

let last = 0;
function frame(t) {
  const dt = Math.min((t - last) / 1000 || 0, 0.05);
  last = t;
  update(dt); draw();
  requestAnimationFrame(frame);
}

initMaze();
dotsEl.textContent = totalDots;

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (['arrowup','arrowdown','arrowleft','arrowright'].includes(k)) e.preventDefault();
  if (k === 'arrowup' || k === 'w') player.nextDir = {x:0,y:-1};
  if (k === 'arrowdown' || k === 's') player.nextDir = {x:0,y:1};
  if (k === 'arrowleft' || k === 'a') player.nextDir = {x:-1,y:0};
  if (k === 'arrowright' || k === 'd') player.nextDir = {x:1,y:0};
  if ((k === 'enter' || k === 'arrowup' || k === 'arrowdown' || k === 'arrowleft' || k === 'arrowright' || k === 'w' || k === 'a' || k === 's' || k === 'd') && state !== 'playing') start();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && state !== 'playing') start(); });
canvas.addEventListener('pointerdown', () => { if (state !== 'playing') start(); });

last = performance.now();
requestAnimationFrame(frame);
