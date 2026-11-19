import { mountGameFrame } from '../../packages/ui/src/gameFrame.js';

const shell = mountGameFrame({
  mount: document.getElementById('shell-mount'),
  config: {
    title: 'Maze',
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
          // sound off by default
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
          panel.className = 'arcade-panel';
          panel.dataset.testid = 'game-panel-left';
          const title = document.createElement('h2');
          title.className = 'arcade-panel__title';
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
          panel.className = 'arcade-panel';
          panel.dataset.testid = 'game-panel-right';
          const title = document.createElement('h2');
          title.className = 'arcade-panel__title';
          title.textContent = 'Commandes';
          const ul = document.createElement('ul');
          ul.className = 'arcade-panel__list';
          const li = (text) => { const l = document.createElement('li'); l.className = 'arcade-panel__text'; l.textContent = text; ul.appendChild(l); };
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
        canvas.setAttribute('aria-label', 'Jeu Maze');
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
let player = { x: 1, y: 1, dir: {x:0,y:0}, nextDir: {x:0,y:0}, mouth: 0, acc: 0, bump: 0, bumpDir: {x:0,y:0} };
let ghosts = [];
let score = 0, lives = 3, level = 1, state = 'ready';
let powerTimer = 0;
let lastTime = 0;
let particles = [];
let rings = [];
let stars = [];
let elapsed = 0;
let shake = 0;
let flashAlpha = 0;
let flashColor = '#7bffe5';
let banner = '';
let bannerTimer = 0;
let ghostCombo = 0;

// Scatter/chase cycle: alternate 20s chase and 7s scatter
let chaseMode = true;
let modeTimer = 20;

function initStars() {
  stars = Array.from({ length: 150 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    size: Math.random() < 0.13 ? 2 : 1,
    speed: 5 + Math.random() * 22,
    alpha: 0.2 + Math.random() * 0.75,
    phase: Math.random() * Math.PI * 2,
  }));
}

function ring(x, y, color, r0 = 6) {
  rings.push({ x, y, r: r0, life: 0.35, color });
}

function burst(x, y, color, n = 10, spMin = 30, spMax = 140) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = spMin + Math.random() * (spMax - spMin);
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.3 + Math.random() * 0.35, maxLife: 0.65, color, s: 1.5 + Math.random() * 2.5, rot: Math.random() * Math.PI, spin: (Math.random() - 0.5) * 8 });
  }
}

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
  player = { x: 1, y: 1, dir: {x:0,y:0}, nextDir: {x:0,y:0}, mouth: 0, acc: 0, bump: 0, bumpDir: {x:0,y:0} };
  ghosts = [
    { x: 4, y: 9, dir: {x:1,y:0}, color: GHOST_COLORS[0], name: GHOST_NAMES[0], vulnerable: 0, home: {x:4,y:9}, acc: 0 },
    { x: 5, y: 9, dir: {x:-1,y:0}, color: GHOST_COLORS[1], name: GHOST_NAMES[1], vulnerable: 0, home: {x:5,y:9}, acc: 0 },
    { x: 6, y: 9, dir: {x:1,y:0}, color: GHOST_COLORS[2], name: GHOST_NAMES[2], vulnerable: 0, home: {x:6,y:9}, acc: 0 },
    { x: 7, y: 9, dir: {x:-1,y:0}, color: GHOST_COLORS[3], name: GHOST_NAMES[3], vulnerable: 0, home: {x:7,y:9}, acc: 0 },
  ];
  powerTimer = 0;
  chaseMode = true; modeTimer = 20;
  ghostCombo = 0;
}

function start() {
  score = 0; lives = 3; level = 1;
  chaseMode = true; modeTimer = 20;
  initMaze();
  particles = []; rings = []; shake = 0; flashAlpha = 0; banner = ''; bannerTimer = 0;
  state = 'playing';
  scoreEl.textContent = '0'; livesEl.textContent = '3'; levelEl.textContent = '1'; dotsEl.textContent = String(totalDots);
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
  if (!player.acc) player.acc = 0;
  player.acc += dt * 6;
  while (player.acc >= 1) {
    player.acc -= 1;
    const tx = player.x + d.x, ty = player.y + d.y;
    if (isWall(tx, ty)) {
      const bx = player.x * TILE + TILE / 2 + d.x * (TILE * 0.45);
      const by = player.y * TILE + TILE / 2 + d.y * (TILE * 0.45);
      if (player.bump <= 0) {
        ring(bx, by, '#7ab0ff', 4);
        burst(bx, by, '#7ab0ff', 5, 20, 70);
      }
      player.bump = 0.18;
      player.bumpDir = { x: d.x, y: d.y };
      player.dir = { x: 0, y: 0 };
      break;
    }
    player.x = tx; player.y = ty;
    const cx = tx * TILE + TILE / 2;
    const cy = ty * TILE + TILE / 2;
    // eat
    if (maze[ty][tx] === 0) {
      maze[ty][tx] = 3; score += 10; dots--;
      scoreEl.textContent = String(score); dotsEl.textContent = String(dots);
      burst(cx, cy, '#7bffe5', 4, 15, 55);
      tone(660, 0.04, 'square', 0.02);
    } else if (maze[ty][tx] === 2) {
      maze[ty][tx] = 3; score += 50; dots--; powerTimer = 8; ghostCombo = 0;
      ghosts.forEach(g => g.vulnerable = 8);
      scoreEl.textContent = String(score); dotsEl.textContent = String(dots);
      ring(cx, cy, '#ffd36b', 8);
      burst(cx, cy, '#ffd36b', 14, 40, 160);
      shake = Math.max(shake, 3); flashAlpha = 0.18; flashColor = '#ffd36b';
      banner = 'MODE CHASSE !'; bannerTimer = 1.1;
      tone(880, 0.15, 'triangle', 0.04);
    }
  }
  player.mouth = (player.mouth + dt * 8) % 1;
  if (dots <= 0) {
    level++;
    score += 100 * level;
    scoreEl.textContent = String(score);
    shake = Math.max(shake, 5); flashAlpha = 0.3; flashColor = '#69ffe1';
    ring(W / 2, H / 2, '#69ffe1', 20);
    burst(W / 2, H / 2, '#69ffe1', 24, 40, 180);
    banner = `NIVEAU ${level}`; bannerTimer = 1.4;
    initMaze();
    levelEl.textContent = String(level);
    dotsEl.textContent = String(totalDots);
    tone(660, 0.2, 'triangle', 0.04);
  }
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
      const cx = g.x * TILE + TILE / 2;
      const cy = g.y * TILE + TILE / 2;
      if (g.vulnerable > 0) {
        ghostCombo++;
        const bonus = 200 * ghostCombo;
        score += bonus;
        scoreEl.textContent = String(score);
        ring(cx, cy, '#9befff', 10);
        burst(cx, cy, g.color, 16, 40, 170);
        shake = Math.max(shake, 4); flashAlpha = 0.15; flashColor = '#9befff';
        banner = `+${bonus}`; bannerTimer = 0.8;
        g.x = g.home.x; g.y = g.home.y; g.vulnerable = 0; g.acc = 0;
        tone(880, 0.15, 'triangle', 0.04);
      } else {
        lives--; livesEl.textContent = String(lives);
        ring(cx, cy, '#ff5f8f', 14);
        burst(cx, cy, '#ff5f8f', 22, 50, 190);
        burst(player.x * TILE + TILE / 2, player.y * TILE + TILE / 2, '#7bffe5', 14, 30, 140);
        shake = 10; flashAlpha = 0.28; flashColor = '#ff5f8f';
        if (lives <= 0) { state = 'over'; }
        else {
          player.x = 1; player.y = 1; player.dir = {x:0,y:0}; player.nextDir = {x:0,y:0}; player.acc = 0; player.bump = 0;
          banner = 'AÏE !'; bannerTimer = 0.9;
        }
        tone(180, 0.2, 'sawtooth', 0.04);
      }
    }
  }
  powerTimer = Math.max(0, powerTimer - dt);
  if (powerTimer <= 0) ghostCombo = 0;
}

function update(dt) {
  elapsed += dt;
  shake = Math.max(0, shake - dt * 18);
  flashAlpha = Math.max(0, flashAlpha - dt * 2.2);
  bannerTimer = Math.max(0, bannerTimer - dt);
  player.bump = Math.max(0, player.bump - dt * 2.5);
  for (const s of stars) {
    s.y += s.speed * dt;
    if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.985; p.vy *= 0.985;
    p.rot += (p.spin || 0) * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.r += 120 * dt;
    r.life -= dt;
    if (r.life <= 0) rings.splice(i, 1);
  }
  if (state !== 'playing') return;
  movePlayer(dt);
  moveGhosts(dt);
}

function drawBackground() {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0c211d'); bg.addColorStop(0.52, '#071713'); bg.addColorStop(1, '#06100f');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const nebula = (x, y, r, color) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color); g.addColorStop(1, 'transparent');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  nebula(140 + Math.sin(elapsed * 0.17) * 35, 160, 220, '#00e0a51a');
  nebula(W - 150, H - 180 + Math.cos(elapsed * 0.13) * 25, 210, '#24b99b1c');
  ctx.save();
  ctx.strokeStyle = '#9bfff008'; ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.restore();
  for (const s of stars) {
    ctx.globalAlpha = s.alpha * (0.7 + Math.sin(elapsed * 2 + s.phase) * 0.3);
    ctx.fillStyle = s.size > 1 ? '#baffeb' : '#f2fffc';
    ctx.fillRect(s.x, s.y, s.size, s.size);
    if (s.size > 1) { ctx.globalAlpha *= 0.35; ctx.fillRect(s.x - 3, s.y, 7, 1); }
  }
  ctx.globalAlpha = 1;
}

function drawMaze() {
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const t = maze[y][x];
    const px = x * TILE, py = y * TILE;
    const cx = px + TILE / 2, cy = py + TILE / 2;
    if (t === 1) {
      ctx.save();
      ctx.fillStyle = '#0d1f2a';
      ctx.shadowColor = '#1e4f78';
      ctx.shadowBlur = 6;
      ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
      ctx.shadowBlur = 0;
      const g = ctx.createLinearGradient(px, py, px + TILE, py + TILE);
      g.addColorStop(0, '#2a5b8f66'); g.addColorStop(1, '#10243788');
      ctx.fillStyle = g;
      ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
      ctx.strokeStyle = '#6ecbff55'; ctx.lineWidth = 1;
      ctx.strokeRect(px + 1.5, py + 1.5, TILE - 3, TILE - 3);
      ctx.strokeStyle = '#b9ecff22';
      ctx.beginPath();
      ctx.moveTo(px + 5, cy); ctx.lineTo(px + TILE - 5, cy);
      ctx.moveTo(cx, py + 5); ctx.lineTo(cx, py + TILE - 5);
      ctx.stroke();
      ctx.fillStyle = '#8fe7ff66';
      ctx.fillRect(px + 4, py + 4, 3, 3);
      ctx.fillRect(px + TILE - 7, py + 4, 3, 3);
      ctx.fillRect(px + 4, py + TILE - 7, 3, 3);
      ctx.fillRect(px + TILE - 7, py + TILE - 7, 3, 3);
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(4, 18, 16, 0.55)';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.strokeStyle = '#7bffe50a';
      ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
      if (t === 0) {
        ctx.save();
        ctx.shadowColor = '#7bffe5'; ctx.shadowBlur = 8;
        const core = ctx.createRadialGradient(cx - 1, cy - 1, 0.5, cx, cy, 3.2);
        core.addColorStop(0, '#ffffff'); core.addColorStop(1, '#7bffe5');
        ctx.fillStyle = core;
        ctx.beginPath(); ctx.arc(cx, cy, 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else if (t === 2) {
        const pulse = 1 + Math.sin(elapsed * 5 + x * 0.7 + y * 0.5) * 0.12;
        ctx.save();
        ctx.translate(cx, cy); ctx.scale(pulse, pulse);
        ctx.rotate(elapsed * 1.5);
        ctx.shadowColor = '#ffd36b'; ctx.shadowBlur = 14;
        const core = ctx.createRadialGradient(-2, -2, 1, 0, 0, 6.5);
        core.addColorStop(0, '#fff9d8'); core.addColorStop(0.5, '#ffd36b'); core.addColorStop(1, '#d48b00');
        ctx.fillStyle = core;
        ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff88'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(0, 0, 8.5, 0, Math.PI * 1.3); ctx.stroke();
        ctx.strokeStyle = '#fff0a855';
        ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(4, 0); ctx.moveTo(0, -4); ctx.lineTo(0, 4); ctx.stroke();
        ctx.restore();
      }
    }
  }
}

function drawPlayer() {
  const px = player.x * TILE + TILE / 2 + (player.bumpDir.x || 0) * player.bump * -4;
  const py = player.y * TILE + TILE / 2 + (player.bumpDir.y || 0) * player.bump * -4;
  const ang = player.dir.x === 1 ? 0 : player.dir.x === -1 ? Math.PI : player.dir.y === -1 ? -Math.PI / 2 : player.dir.y === 1 ? Math.PI / 2 : 0;
  const mouth = 0.18 + Math.abs(Math.sin(player.mouth * Math.PI)) * 0.42;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(ang);
  ctx.shadowColor = '#7bffe5'; ctx.shadowBlur = 14;
  const body = ctx.createRadialGradient(-3, -3, 1, 0, 0, 12);
  body.addColorStop(0, '#ffffff'); body.addColorStop(0.35, '#cafff1'); body.addColorStop(1, '#2fc9a8');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, 11, mouth, Math.PI * 2 - mouth);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffffff66'; ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.strokeStyle = '#0e4b3d88';
  ctx.beginPath(); ctx.arc(0, 0, 7.2, mouth + 0.2, Math.PI * 2 - mouth - 0.2); ctx.stroke();
  ctx.fillStyle = '#08372d';
  ctx.beginPath(); ctx.arc(1.5, -5, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(2.1, -5.5, 0.9, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawGhost(g, idx) {
  const gx = g.x * TILE + TILE / 2;
  const gy = g.y * TILE + TILE / 2;
  const bob = Math.sin(elapsed * 4 + idx) * 1.5;
  const vulnerable = g.vulnerable > 0;
  const blink = vulnerable && g.vulnerable < 2 && Math.floor(elapsed * 10) % 2 === 0;
  const color = vulnerable ? (blink ? '#e8f0ff' : '#5a6fd8') : g.color;
  ctx.save();
  ctx.translate(gx, gy + bob);
  ctx.shadowColor = vulnerable ? '#8aa0ff' : g.color;
  ctx.shadowBlur = 12;
  const body = ctx.createLinearGradient(0, -12, 0, 13);
  body.addColorStop(0, '#ffffff55'); body.addColorStop(0.2, color); body.addColorStop(1, vulnerable ? '#2a3470' : '#0d2a2a');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, -1, 11, Math.PI, 0);
  ctx.lineTo(11, 10);
  for (let i = 0; i < 4; i++) {
    const wx = 11 - (i + 1) * (22 / 4);
    const wy = 10 - (i % 2 === 0 ? 4 : 0);
    ctx.lineTo(wx, wy);
  }
  ctx.lineTo(-11, 10);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffffff55'; ctx.lineWidth = 1;
  ctx.stroke();
  if (!vulnerable) {
    ctx.fillStyle = '#ffffff22';
    ctx.beginPath(); ctx.roundRect(-6, -3, 12, 6, 3); ctx.fill();
  }
  // eyes
  if (vulnerable) {
    ctx.fillStyle = '#f4f7ff';
    ctx.fillRect(-6, -3, 4, 2); ctx.fillRect(2, -3, 4, 2);
    ctx.fillRect(-7, 3, 2, 2); ctx.fillRect(-3, 5, 2, 2); ctx.fillRect(1, 5, 2, 2); ctx.fillRect(5, 3, 2, 2);
  } else {
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(-4, -2, 3.2, 4, 0, 0, Math.PI * 2); ctx.ellipse(4, -2, 3.2, 4, 0, 0, Math.PI * 2); ctx.fill();
    const lookX = Math.max(-1, Math.min(1, g.dir.x || 0)) * 1.2;
    const lookY = Math.max(-1, Math.min(1, g.dir.y || 0)) * 1.2;
    ctx.fillStyle = '#17365f';
    ctx.beginPath(); ctx.arc(-4 + lookX, -2 + lookY, 1.6, 0, Math.PI * 2); ctx.arc(4 + lookX, -2 + lookY, 1.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  drawBackground();
  drawMaze();

  // rings
  for (const r of rings) {
    ctx.globalAlpha = Math.max(0, r.life / 0.35);
    ctx.strokeStyle = r.color; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  drawPlayer();
  ghosts.forEach((g, i) => drawGhost(g, i));

  // particles
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / (p.maxLife || 0.65));
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot || 0);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color; ctx.shadowBlur = 6;
    ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
    ctx.restore();
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;

  if (bannerTimer > 0 && state === 'playing') {
    ctx.globalAlpha = Math.min(1, bannerTimer * 2);
    ctx.textAlign = 'center';
    ctx.font = '900 22px system-ui';
    ctx.fillStyle = '#d9ff76';
    ctx.shadowColor = '#d9ff76'; ctx.shadowBlur = 16;
    ctx.fillText(banner, W / 2, 34);
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  }
  if (powerTimer > 0 && state === 'playing') {
    ctx.textAlign = 'center'; ctx.font = '700 12px system-ui'; ctx.fillStyle = '#9befff';
    ctx.fillText(`Fantômes vulnérables ${Math.ceil(powerTimer)}s`, W / 2, H - 10);
  }

  if (flashAlpha > 0) {
    ctx.globalAlpha = Math.min(0.4, flashAlpha);
    ctx.fillStyle = flashColor;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  if (state !== 'playing') {
    ctx.fillStyle = 'rgba(6,20,18,0.72)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.fillStyle = '#7bffe5'; ctx.shadowColor = '#7bffe5'; ctx.shadowBlur = 16; ctx.font = '800 32px system-ui';
    ctx.fillText(state === 'ready' ? 'MAZE' : state === 'over' ? 'CAPTURE !' : 'NIVEAU TERMINE', W / 2, H / 2);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#edfffa'; ctx.font = '16px system-ui';
    ctx.fillText(state === 'ready' ? 'Flèches / WASD pour commencer' : 'Entrée pour recommencer', W / 2, H / 2 + 34);
  }
}

let last = 0;
function frame(t) {
  const dt = Math.min((t - last) / 1000 || 0, 0.05);
  last = t;
  update(dt); draw();
  requestAnimationFrame(frame);
}

initStars();
initMaze();
dotsEl.textContent = String(totalDots);

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
