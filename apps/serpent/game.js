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
const SEG = ['#69ffe1', '#5cf2d6', '#8bffd8', '#a5ffd0', '#baffe0', '#8fe8ff', '#7dd8ff', '#9debd6'];
const DIFF = {
  chill: { startTick: 0.17, minTick: 0.095, accel: 0.0003 },
  arcade: { startTick: 0.14, minTick: 0.075, accel: 0.0004 },
  chaos: { startTick: 0.11, minTick: 0.055, accel: 0.00055 },
};

let state = 'ready', dir = 'right', pending = null, snake = [], food = null, bonusFood = null, bonusTimer = 0, score = 0, best = Number(localStorage.getItem('neonSerpentBest')) || 0, tick = 0.14, acc = 0, last = 0, eatPulse = 0, shake = 0, particles = [], rings = [], headScale = 1;
let digesting = [];
let tailShrink = 0;
let stars = [];
$('#best').textContent = String(best);

function initStars() {
  stars = Array.from({ length: 110 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: Math.random() < 0.12 ? 2.2 : Math.random() * 1.5 + 0.4,
    a: 0.25 + Math.random() * 0.65,
    tw: Math.random() * Math.PI * 2,
    sp: 0.6 + Math.random() * 1.4,
    vy: 6 + Math.random() * 16,
    vx: (Math.random() - 0.5) * 6,
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
  dir = 'right'; pending = null; score = 0; tick = d.startTick; acc = 0; shake = 0; particles = []; rings = []; eatPulse = 0; headScale = 1; bonusFood = null; bonusTimer = 0;
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

function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 160;
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.35 + Math.random() * 0.35, color, s: 2 + Math.random() * 2.5 });
  }
}
function ring(x, y, color) { rings.push({ x, y, r: 8, life: 0.4, color }); }

function setDir(d) {
  if (state === 'ready') start();
  if (state !== 'playing') return;
  if (opposite(d, dir) && snake.length > 1) return;
  if (pending !== d) audio.tone(300, 0.02, 'square', 0.01);
  pending = d;
}

function cellCenter(cell) { return { x: cell.x * CELL + CELL / 2, y: cell.y * CELL + CELL / 2 }; }

function update(dt) {
  shake = Math.max(0, shake - dt * 3); eatPulse = Math.max(0, eatPulse - dt * 4); headScale += (1 - headScale) * Math.min(1, dt * 10);
  tailShrink = Math.max(0, tailShrink - dt * 2.4);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.97; p.vy *= 0.97; p.life -= dt; if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = rings.length - 1; i >= 0; i--) { rings[i].r += 80 * dt; if ((rings[i].life -= dt) <= 0) rings.splice(i, 1); }

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
    const px = head.x * CELL + 15, py = head.y * CELL + 15;
    burst(px, py, '#ff6dbe', 24); ring(px, py, '#ff6dbe'); shake = 1; headScale = 0.7;
    state = 'over'; $('#status').textContent = 'Mordu !';
    audio.seq([[220, 0.12, 'sawtooth', 0.05, 0], [150, 0.2, 'sawtooth', 0.04, 0.07]]);
    if (score > best) { best = score; localStorage.setItem('neonSerpentBest', String(best)); $('#best').textContent = String(best); }
    return;
  }

  const d = DIFF[difficultyInput.value] || DIFF.arcade;
  if (ate || ateBonus) {
    const gain = ateBonus ? 40 : 10;
    const px = head.x * CELL + 15, py = head.y * CELL + 15;
    score += gain; $('#score').textContent = String(score);
    burst(px, py, ateBonus ? '#69ffe1' : '#ffd36b', 16); ring(px, py, ateBonus ? '#69ffe1' : '#ffd36b');
    eatPulse = 1; headScale = 1.18;
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
      if (tail) ring(tail.x * CELL + 15, tail.y * CELL + 15, digesting[i].color);
      digesting.splice(i, 1);
    }
  }
}

function draw(t) {
  ctx.clearRect(0, 0, W, H); ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * 10 * shake, (Math.random() - 0.5) * 10 * shake);
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0c211d'); bg.addColorStop(1, '#06100f'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  const time = (t || 0) * 0.001;
  for (const s of stars) {
    const tw = 0.55 + 0.45 * Math.sin(time * s.sp + s.tw);
    ctx.globalAlpha = Math.min(1, s.a * tw);
    ctx.fillStyle = s.r > 1.8 ? '#ffffff' : '#dffcff';
    ctx.shadowColor = '#7af7e0';
    ctx.shadowBlur = s.r > 1.6 ? 7 : 0;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  ctx.strokeStyle = '#69ffe112'; ctx.lineWidth = 1;
  for (let i = 1; i < COLS; i++) { ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, H); ctx.stroke(); }
  for (let i = 1; i < ROWS; i++) { ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(W, i * CELL); ctx.stroke(); }

  if (food) {
    const pulse = 1 + 0.15 * Math.sin(t * 0.008) + eatPulse * 0.4;
    ctx.fillStyle = '#ff6dbe'; ctx.shadowColor = '#ff6dbe'; ctx.shadowBlur = 18 + 8 * Math.sin(t * 0.008);
    ctx.beginPath(); ctx.arc(food.x * CELL + 15, food.y * CELL + 15, 8 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#ffdcec'; ctx.beginPath(); ctx.arc(food.x * CELL + 12, food.y * CELL + 12, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  if (bonusFood) {
    const pulse = 1 + 0.2 * Math.sin(t * 0.012);
    ctx.fillStyle = '#69ffe1'; ctx.shadowColor = '#69ffe1'; ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.arc(bonusFood.x * CELL + 15, bonusFood.y * CELL + 15, 9 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.strokeStyle = '#ffffffaa'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bonusFood.x * CELL + 15, bonusFood.y * CELL + 15, 13, 0, Math.PI * 2); ctx.stroke();
  }

  snake.forEach((s, i) => {
    const col = i === 0 ? '#69ffe1' : SEG[i % SEG.length];
    let sc = i === 0 ? headScale : 1;
    if (i === snake.length - 1 && tailShrink > 0) sc *= 1 - 0.28 * tailShrink;
    const size = (CELL - 4) * sc;
    const off = (CELL - size) / 2;
    ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = i === 0 ? 16 : 8;
    ctx.beginPath(); ctx.roundRect(s.x * CELL + off, s.y * CELL + off, size, size, i === 0 ? 9 : 7); ctx.fill();
    ctx.shadowBlur = 0;
    if (i === 0) {
      ctx.fillStyle = '#06231d';
      const ex = dir === 'left' ? -4 : dir === 'right' ? 4 : 0, ey = dir === 'up' ? -4 : dir === 'down' ? 4 : 0;
      const px = dir === 'up' || dir === 'down' ? 5 : 0, py = dir === 'left' || dir === 'right' ? 5 : 0;
      ctx.beginPath(); ctx.ellipse(s.x * CELL + 15 + ex + px, s.y * CELL + 15 + ey + py, 2.6, 2.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(s.x * CELL + 15 + ex - px, s.y * CELL + 15 + ey - py, 2.6, 2.6, 0, 0, Math.PI * 2); ctx.fill();
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
    ctx.fillStyle = d.color;
    ctx.shadowColor = d.color;
    ctx.shadowBlur = 18;
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x - 1.5, y - 1.5, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (const r of rings) { ctx.globalAlpha = Math.max(0, r.life / 0.4); ctx.strokeStyle = r.color; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke(); }
  ctx.globalAlpha = 1;
  for (const p of particles) { ctx.globalAlpha = Math.min(1, p.life * 2.4); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.s, p.s); }
  ctx.globalAlpha = 1; ctx.restore();

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
