import { mountGameFrame } from '../../packages/ui/src/gameFrame.js';
import { createAudio } from '../../packages/shared/src/audio.js';
import { nextCell, hitsWall, hitsSelf, opposite, freeCell } from './game-logic.js';

const shell = mountGameFrame({
  mount: document.getElementById('shell-mount'),
  config: {
    title: 'Neon Serpent',
    subtitle: 'Grandis sans te mordre.',
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
          stats.append(stat('SCORE', 'score', '0'), stat('RECORD', 'best', '0'), stat('VITESSE', 'speed', '1'), stat('ÉTAT', 'status', 'Prêt'));
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
          help.textContent = 'Flèches ou ZQSD : diriger • Espace : démarrer • P : pause';
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
        canvas.setAttribute('aria-label', 'Grille Neon Serpent');
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

const COLS = 20, ROWS = 20, CELL = 30, W = canvas.width, H = canvas.height;
const SEG = ['#69ffe1', '#56e7cf', '#73ffd8', '#97ffd0', '#b6ffe5', '#8fe8ff', '#7dd8ff', '#9debd6'];
const DIFF = {
  chill: { startTick: 0.17, minTick: 0.095, accel: 0.0003 },
  arcade: { startTick: 0.14, minTick: 0.075, accel: 0.0004 },
  chaos: { startTick: 0.11, minTick: 0.055, accel: 0.00055 },
};

let state = 'ready';
let dir = 'right';
let pending = null;
let snake = [];
let food = null;
let bonusFood = null;
let bonusTimer = 0;
let score = 0;
let best = Number(localStorage.getItem('neonSerpentBest')) || 0;
let tick = 0.14;
let acc = 0;
let last = 0;
let eatPulse = 0;
let shake = 0;
let flash = 0;
let particles = [];
let rings = [];
let headScale = 1;
let digesting = [];
let tailShrink = 0;
let stars = [];
$('#best').textContent = String(best);

function initStars() {
  stars = Array.from({ length: 150 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: Math.random() < 0.14 ? 2.2 : Math.random() * 1.5 + 0.35,
    a: 0.2 + Math.random() * 0.75,
    tw: Math.random() * Math.PI * 2,
    sp: 0.7 + Math.random() * 1.6,
    vy: 5 + Math.random() * 18,
    vx: (Math.random() - 0.5) * 5,
  }));
}

function spawnFood() { food = freeCell(snake, COLS, ROWS); }
function spawnBonus() {
  if (!bonusInput.checked) { bonusFood = null; return; }
  const taken = snake.concat(food ? [food] : []);
  bonusFood = freeCell(taken, COLS, ROWS);
  bonusTimer = 5.5;
}

function reset() {
  const d = DIFF[difficultyInput.value] || DIFF.arcade;
  snake = [{ x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }];
  dir = 'right'; pending = null; score = 0; tick = d.startTick; acc = 0; shake = 0; flash = 0; particles = []; rings = []; eatPulse = 0; headScale = 1; bonusFood = null; bonusTimer = 0;
  digesting = []; tailShrink = 0;
  initStars();
  spawnFood();
  $('#score').textContent = '0'; $('#speed').textContent = '1'; $('#status').textContent = 'Prêt';
}

function start() { if (state === 'playing') return; reset(); state = 'playing'; $('#status').textContent = 'En jeu'; audio.tone(480, 0.08, 'triangle', 0.03); }

function pause() {
  if (state === 'playing') { state = 'paused'; $('#status').textContent = 'Pause'; }
  else if (state === 'paused') { state = 'playing'; last = performance.now(); $('#status').textContent = 'En jeu'; }
  else if (state === 'ready') start();
}

function burst(x, y, color, n, power = 1) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (35 + Math.random() * 170) * power;
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.28 + Math.random() * 0.45, max: 0.73, color, s: 1.5 + Math.random() * 3.2, spin: Math.random() * 8, square: Math.random() < 0.45 });
  }
}
function ring(x, y, color, r0 = 8, life = 0.42) { rings.push({ x, y, r: r0, life, max: life, color, w: 2.5 }); }

function setDir(d) {
  if (state === 'ready') start();
  if (state !== 'playing') return;
  if (opposite(d, dir) && snake.length > 1) return;
  if (pending !== d) audio.tone(300, 0.02, 'square', 0.01);
  pending = d;
}

function cellCenter(cell) { return { x: cell.x * CELL + CELL / 2, y: cell.y * CELL + CELL / 2 }; }

function impactAt(cell, color, strong = false) {
  const { x, y } = cellCenter(cell);
  burst(x, y, color, strong ? 28 : 16, strong ? 1.2 : 1);
  ring(x, y, color, strong ? 10 : 8, strong ? 0.5 : 0.4);
  if (strong) { ring(x, y, '#ffffff', 4, 0.28); flash = Math.max(flash, 0.35); shake = Math.max(shake, 1); }
}

function update(dt) {
  shake = Math.max(0, shake - dt * 3.2);
  flash = Math.max(0, flash - dt * 2.2);
  eatPulse = Math.max(0, eatPulse - dt * 4);
  headScale += (1 - headScale) * Math.min(1, dt * 10);
  tailShrink = Math.max(0, tailShrink - dt * 2.4);

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.968; p.vy *= 0.968; p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    rings[i].r += 95 * dt;
    if ((rings[i].life -= dt) <= 0) rings.splice(i, 1);
  }

  if (bonusFood) {
    bonusTimer -= dt;
    if (bonusTimer <= 0) bonusFood = null;
  }
  for (const s of stars) {
    s.y += s.vy * dt;
    s.x += s.vx * dt;
    if (s.y > H + 4) { s.y = -4; s.x = Math.random() * W; }
    if (s.x < -4) s.x = W + 4;
    if (s.x > W + 4) s.x = -4;
  }

  if (state !== 'playing') return;
  acc += dt;
  if (acc < tick) return;
  acc = 0;
  if (pending) { dir = pending; pending = null; }

  const head = nextCell(snake[0], dir);
  const ate = food && head.x === food.x && head.y === food.y;
  const ateBonus = bonusFood && head.x === bonusFood.x && head.y === bonusFood.y;

  if (hitsWall(head, COLS, ROWS) || hitsSelf(snake, head, ate || ateBonus)) {
    const px = Math.max(0, Math.min(COLS - 1, head.x)) * CELL + CELL / 2;
    const py = Math.max(0, Math.min(ROWS - 1, head.y)) * CELL + CELL / 2;
    burst(px, py, '#ff6dbe', 34, 1.3);
    ring(px, py, '#ff6dbe', 12, 0.55);
    ring(px, py, '#ffffff', 6, 0.3);
    shake = 1.2; flash = 0.45; headScale = 0.72;
    state = 'over'; $('#status').textContent = 'Mordu !';
    audio.seq([[220, 0.12, 'sawtooth', 0.05, 0], [150, 0.2, 'sawtooth', 0.04, 0.07]]);
    if (score > best) { best = score; localStorage.setItem('neonSerpentBest', String(best)); $('#best').textContent = String(best); }
    return;
  }

  const d = DIFF[difficultyInput.value] || DIFF.arcade;
  if (ate || ateBonus) {
    const gain = ateBonus ? 40 : 10;
    score += gain; $('#score').textContent = String(score);
    impactAt(head, ateBonus ? '#69ffe1' : '#ffd36b', false);
    burst(cellCenter(head).x, cellCenter(head).y, '#ffffff', 6, 0.7);
    eatPulse = 1; headScale = 1.22;
    tick = Math.max(d.minTick, tick - d.accel * 20);
    $('#speed').textContent = String(1 + Math.floor(score / 60));
    audio.tone(ateBonus ? 880 : 640, 0.07, 'sine', 0.03);
    digesting.push({ progress: 0, color: ateBonus ? '#69ffe1' : '#ffd36b' });
    if (ate) spawnFood();
    if (ateBonus) bonusFood = null;
    if (ate && bonusInput.checked && !bonusFood && Math.random() < 0.28) spawnBonus();
  }

  snake.unshift(head);
  if (!ate && !ateBonus) snake.pop();

  for (let i = digesting.length - 1; i >= 0; i--) {
    digesting[i].progress += 1;
    if (digesting[i].progress >= snake.length - 1) {
      tailShrink = 1;
      const tail = snake[snake.length - 1];
      if (tail) {
        const tc = cellCenter(tail);
        ring(tc.x, tc.y, digesting[i].color, 9, 0.38);
        burst(tc.x, tc.y, digesting[i].color, 8, 0.7);
      }
      digesting.splice(i, 1);
    }
  }
}

function drawBackground(time) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0c211d'); bg.addColorStop(0.52, '#071713'); bg.addColorStop(1, '#06100f');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  const nebula = (x, y, r, color) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color); g.addColorStop(1, 'transparent');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  nebula(150 + Math.sin(time * 0.18) * 45, 190, 260, '#00e0a51a');
  nebula(470 + Math.cos(time * 0.14) * 30, 360, 240, '#24b99b1c');
  nebula(320, 120 + Math.sin(time * 0.11) * 20, 180, '#69ffe10f');

  ctx.save();
  ctx.strokeStyle = '#9bfff008';
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.restore();

  for (const s of stars) {
    const tw = 0.55 + 0.45 * Math.sin(time * s.sp + s.tw);
    ctx.globalAlpha = Math.min(1, s.a * tw);
    ctx.fillStyle = s.r > 1.8 ? '#ffffff' : '#dffcff';
    ctx.shadowColor = '#7af7e0';
    ctx.shadowBlur = s.r > 1.6 ? 7 : 0;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
}

function dirAngle(d) {
  if (d === 'up') return -Math.PI / 2;
  if (d === 'down') return Math.PI / 2;
  if (d === 'left') return Math.PI;
  return 0;
}

function drawCore(x, y, r, color, time, spin = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(time * 1.6 * spin);
  ctx.shadowColor = color; ctx.shadowBlur = 18;
  const g = ctx.createRadialGradient(-r * 0.2, -r * 0.25, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, color); g.addColorStop(1, '#081612');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffffff88'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, r * 1.35, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = color + 'aa';
  ctx.beginPath(); ctx.moveTo(-r * 1.7, 0); ctx.lineTo(r * 1.7, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -r * 1.7); ctx.lineTo(0, r * 1.7); ctx.stroke();
  ctx.restore();
}

function drawSegment(x, y, size, color, i, isTail, time) {
  const r = size / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = color; ctx.shadowBlur = i === 0 ? 0 : 10;
  const body = ctx.createLinearGradient(-r, -r, r, r);
  body.addColorStop(0, '#13352f'); body.addColorStop(0.45, color); body.addColorStop(1, '#0a211d');
  ctx.fillStyle = body;
  ctx.beginPath();
  if (isTail) {
    ctx.moveTo(-r * 0.9, -r * 0.55); ctx.lineTo(r * 0.25, -r * 0.75); ctx.lineTo(r * 0.95, 0);
    ctx.lineTo(r * 0.25, r * 0.75); ctx.lineTo(-r * 0.9, r * 0.55); ctx.closePath();
  } else {
    ctx.roundRect(-r, -r, size, size, r * 0.38);
  }
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffffff33'; ctx.lineWidth = 1.2; ctx.stroke();
  // tech panel lines
  ctx.strokeStyle = '#eafff61f'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-r * 0.55, -r * 0.65); ctx.lineTo(-r * 0.55, r * 0.65); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(r * 0.1, -r * 0.7); ctx.lineTo(r * 0.1, r * 0.7); ctx.stroke();
  // core light
  const pulse = 0.7 + 0.3 * Math.sin(time * 6 + i * 0.7);
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.35 + pulse * 0.35;
  ctx.beginPath(); ctx.arc(r * 0.35, 0, r * 0.16, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.beginPath(); ctx.arc(r * 0.35, 0, r * 0.09, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawHead(x, y, size, angle, time) {
  const r = size / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.shadowColor = '#69ffe1'; ctx.shadowBlur = 18;
  const hull = ctx.createLinearGradient(-r, -r, r, r);
  hull.addColorStop(0, '#dffff6'); hull.addColorStop(0.28, '#79ffe5'); hull.addColorStop(0.65, '#31bfa6'); hull.addColorStop(1, '#0f5a4d');
  ctx.fillStyle = hull;
  ctx.beginPath();
  ctx.moveTo(r * 0.95, 0);
  ctx.lineTo(r * 0.45, -r * 0.78);
  ctx.lineTo(-r * 0.8, -r * 0.72);
  ctx.lineTo(-r * 0.95, -r * 0.2);
  ctx.lineTo(-r * 0.95, r * 0.2);
  ctx.lineTo(-r * 0.8, r * 0.72);
  ctx.lineTo(r * 0.45, r * 0.78);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffffff55'; ctx.lineWidth = 1.3; ctx.stroke();
  // canopy
  const canopy = ctx.createLinearGradient(-r * 0.1, -r * 0.35, r * 0.5, r * 0.35);
  canopy.addColorStop(0, '#153d37'); canopy.addColorStop(1, '#69ffe1');
  ctx.fillStyle = canopy;
  ctx.beginPath(); ctx.ellipse(r * 0.12, 0, r * 0.38, r * 0.28, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#dffff8aa'; ctx.beginPath(); ctx.ellipse(r * 0.22, -r * 0.08, r * 0.12, r * 0.07, -0.4, 0, Math.PI * 2); ctx.fill();
  // eyes / sensors
  ctx.fillStyle = '#06231d';
  ctx.beginPath(); ctx.ellipse(r * 0.38, -r * 0.22, r * 0.09, r * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(r * 0.38, r * 0.22, r * 0.09, r * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.fillRect(r * 0.4, -r * 0.26, r * 0.04, r * 0.04); ctx.fillRect(r * 0.4, r * 0.18, r * 0.04, r * 0.04);
  // side fins / antenna
  ctx.strokeStyle = '#a9fff0'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-r * 0.35, -r * 0.72); ctx.lineTo(-r * 0.05, -r * 0.98); ctx.lineTo(r * 0.15, -r * 0.78); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-r * 0.35, r * 0.72); ctx.lineTo(-r * 0.05, r * 0.98); ctx.lineTo(r * 0.15, r * 0.78); ctx.stroke();
  // thruster glow
  const thr = 0.7 + 0.3 * Math.sin(time * 18);
  const ex = ctx.createLinearGradient(-r * 0.95, 0, -r * 1.45, 0);
  ex.addColorStop(0, '#8dffeacc'); ex.addColorStop(1, '#69ffe100');
  ctx.fillStyle = ex;
  ctx.beginPath(); ctx.moveTo(-r * 0.95, -r * 0.18); ctx.lineTo(-r * (1.25 + thr * 0.2), 0); ctx.lineTo(-r * 0.95, r * 0.18); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function draw(t) {
  ctx.clearRect(0, 0, W, H); ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * 12 * shake, (Math.random() - 0.5) * 12 * shake);
  const time = (t || 0) * 0.001;
  drawBackground(time);

  // gameplay grid (kept readable)
  ctx.strokeStyle = '#69ffe112'; ctx.lineWidth = 1;
  for (let i = 1; i < COLS; i++) { ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, H); ctx.stroke(); }
  for (let i = 1; i < ROWS; i++) { ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(W, i * CELL); ctx.stroke(); }
  ctx.strokeStyle = '#69ffe120'; ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

  if (food) {
    const c = cellCenter(food);
    const pulse = 1 + 0.12 * Math.sin(time * 7) + eatPulse * 0.35;
    drawCore(c.x, c.y, 6.2 * pulse, '#ffd36b', time, 1.2);
  }
  if (bonusFood) {
    const c = cellCenter(bonusFood);
    const pulse = 1 + 0.16 * Math.sin(time * 9);
    drawCore(c.x, c.y, 7.2 * pulse, '#69ffe1', time, -1.6);
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(time * 10);
    ctx.strokeStyle = '#69ffe1'; ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.arc(c.x, c.y, 13 + Math.sin(time * 8) * 1.5, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  snake.forEach((s, i) => {
    const isHead = i === 0;
    const isTail = i === snake.length - 1;
    const col = isHead ? '#69ffe1' : SEG[i % SEG.length];
    let sc = isHead ? headScale : 1;
    if (isTail && tailShrink > 0) sc *= 1 - 0.28 * tailShrink;
    const size = (CELL - 4) * sc;
    const cx = s.x * CELL + CELL / 2;
    const cy = s.y * CELL + CELL / 2;
    if (isHead) {
      drawHead(cx, cy, size, dirAngle(dir), time);
    } else {
      ctx.save();
      const ang = i < snake.length - 1 ? Math.atan2(snake[i + 1].y - s.y, snake[i + 1].x - s.x) : Math.atan2(s.y - snake[i - 1].y, s.x - snake[i - 1].x);
      ctx.translate(cx, cy); ctx.rotate(ang); ctx.translate(-cx, -cy);
      drawSegment(cx, cy, size, col, i, isTail, time);
      ctx.restore();
    }
  });

  for (const d of digesting) {
    const idx = Math.min(d.progress, snake.length - 1);
    const prev = snake[Math.max(0, idx - 1)] || snake[0];
    const curr = snake[idx] || snake[snake.length - 1];
    if (!prev || !curr) continue;
    const a = cellCenter(prev);
    const b = cellCenter(curr);
    const x = (a.x + b.x) / 2;
    const y = (a.y + b.y) / 2;
    const nearTail = idx >= snake.length - 2;
    const radius = nearTail ? 5.2 : 6.4;
    ctx.save();
    ctx.fillStyle = d.color; ctx.shadowColor = d.color; ctx.shadowBlur = 18; ctx.globalAlpha = 0.95;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.globalAlpha = 0.7; ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x - 1.5, y - 1.5, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  for (const r of rings) {
    ctx.globalAlpha = Math.max(0, r.life / r.max);
    ctx.strokeStyle = r.color; ctx.lineWidth = r.w || 2.5; ctx.shadowColor = r.color; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  for (const p of particles) {
    ctx.globalAlpha = Math.min(1, (p.life / p.max) * 2.2);
    ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 8;
    if (p.square) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate((p.max - p.life) * p.spin); ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s); ctx.restore(); }
    else { ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (0.5 + 0.5 * p.life / p.max), 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  ctx.restore();

  if (flash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.45, flash);
    ctx.fillStyle = '#ffb8e2';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  if (state !== 'playing') {
    ctx.fillStyle = '#04100ddc'; ctx.fillRect(0, 0, W, H); ctx.textAlign = 'center';
    ctx.fillStyle = '#69ffe1'; ctx.font = '800 32px system-ui';
    ctx.fillText(state === 'ready' ? 'NEON SERPENT' : state === 'paused' ? 'PAUSE' : 'MORDU !', W / 2, H / 2);
    ctx.fillStyle = '#edfffa'; ctx.font = '16px system-ui';
    ctx.fillText(state === 'ready' ? 'Espace ou une flèche pour jouer' : state === 'paused' ? 'Clique sur Pause pour reprendre' : 'Clique ou Recommencer pour retenter', W / 2, H / 2 + 34);
  }
}

function frame(t) { const dt = Math.min((t - last) / 1000 || 0, 0.04); last = t; update(dt); draw(t); requestAnimationFrame(frame); }

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k.startsWith('arrow') || k === ' ') e.preventDefault();
  const map = { arrowup: 'up', z: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', q: 'left', a: 'left', arrowright: 'right', d: 'right' };
  if (map[k]) setDir(map[k]);
  if (k === ' ' && state !== 'playing') start();
  if (k === 'p') pause();
});

canvas.addEventListener('pointerdown', () => { if (state === 'ready' || state === 'over') start(); });
$('#pause').onclick = pause; $('#restart').onclick = start; $('#new-game').onclick = start;
reset(); requestAnimationFrame(frame);
