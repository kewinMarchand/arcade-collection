import { mountGameFrame } from '../../../packages/ui/src/gameFrame.js';
import { nextCell, hitsWall, hitsSelf, opposite, freeCell } from './game-logic.js';

const shell = mountGameFrame({
  mount: document.getElementById('shell-mount'),
  config: {
    title: 'Neon Serpent',
    subtitle: 'Grandis sans te mordre.',
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
          help.textContent = 'Flèches ou ZQSD : diriger · Espace : démarrer · P : pause';
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
const COLS = 20, ROWS = 20, CELL = 30, W = canvas.width, H = canvas.height;
const SEG = ['#69ffe1', '#5cf2d6', '#8bffd8', '#a5ffd0', '#baffe0', '#8fe8ff', '#7dd8ff', '#9debd6'];
let state = 'ready', dir = 'right', pending = null, snake = [], food = null, score = 0, best = Number(localStorage.getItem('neonSerpentBest')) || 0, tick = 0.14, acc = 0, last = 0, eatPulse = 0, shake = 0, particles = [];
$('#best').textContent = String(best);

function spawnFood() { food = freeCell(snake, COLS, ROWS); }

function reset() {
  snake = [{ x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }];
  dir = 'right'; pending = null; score = 0; tick = 0.14; acc = 0; shake = 0; particles = []; eatPulse = 0;
  spawnFood();
  $('#score').textContent = '0'; $('#speed').textContent = '1'; $('#status').textContent = 'Prêt';
}

function start() { if (state === 'playing') return; reset(); state = 'playing'; $('#status').textContent = 'En jeu'; }

function pause() {
  if (state === 'playing') { state = 'paused'; $('#status').textContent = 'Pause'; }
  else if (state === 'paused') { state = 'playing'; last = performance.now(); $('#status').textContent = 'En jeu'; }
  else if (state === 'ready') start();
}

function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 140;
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.35 + Math.random() * 0.3, color, s: 2 + Math.random() * 2.5 });
  }
}

function setDir(d) {
  if (state === 'ready') start();
  if (state !== 'playing') return;
  if (opposite(d, dir) && snake.length > 1) return;
  pending = d;
}

function update(dt) {
  shake = Math.max(0, shake - dt * 3); eatPulse = Math.max(0, eatPulse - dt * 4);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.97; p.vy *= 0.97; p.life -= dt; if (p.life <= 0) particles.splice(i, 1);
  }
  if (state !== 'playing') return;
  acc += dt;
  if (acc < tick) return;
  acc = 0;
  if (pending) { dir = pending; pending = null; }
  const head = nextCell(snake[0], dir), ate = food && head.x === food.x && head.y === food.y;
  if (hitsWall(head, COLS, ROWS) || hitsSelf(snake, head, ate)) {
    burst(head.x * CELL + 15, head.y * CELL + 15, '#ff6dbe', 20); shake = 1; state = 'over'; $('#status').textContent = 'Mordu !';
    if (score > best) { best = score; localStorage.setItem('neonSerpentBest', String(best)); $('#best').textContent = String(best); }
    return;
  }
  if (ate) {
    score += 10; $('#score').textContent = String(score);
    burst(head.x * CELL + 15, head.y * CELL + 15, '#ffd36b', 14); eatPulse = 1;
    tick = Math.max(0.075, 0.14 - score * 0.0004); $('#speed').textContent = String(1 + Math.floor(score / 60));
    spawnFood();
  }
  snake.unshift(head);
  if (!ate) snake.pop();
}

function draw(t) {
  ctx.clearRect(0, 0, W, H); ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * 10 * shake, (Math.random() - 0.5) * 10 * shake);
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0c211d'); bg.addColorStop(1, '#06100f'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#69ffe112'; ctx.lineWidth = 1;
  for (let i = 1; i < COLS; i++) { ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, H); ctx.stroke(); }
  for (let i = 1; i < ROWS; i++) { ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(W, i * CELL); ctx.stroke(); }
  if (food) {
    const pulse = 1 + 0.15 * Math.sin(t * 0.008) + eatPulse * 0.4;
    ctx.fillStyle = '#ff6dbe'; ctx.shadowColor = '#ff6dbe'; ctx.shadowBlur = 18 + 8 * Math.sin(t * 0.008);
    ctx.beginPath(); ctx.arc(food.x * CELL + 15, food.y * CELL + 15, 8 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#ffdcec'; ctx.beginPath(); ctx.arc(food.x * CELL + 12, food.y * CELL + 12, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  snake.forEach((s, i) => {
    const col = i === 0 ? '#69ffe1' : SEG[i % SEG.length];
    ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = i === 0 ? 16 : 8;
    ctx.beginPath(); ctx.roundRect(s.x * CELL + 2, s.y * CELL + 2, CELL - 4, CELL - 4, i === 0 ? 9 : 7); ctx.fill();
    ctx.shadowBlur = 0;
    if (i === 0) {
      ctx.fillStyle = '#06231d';
      const ex = dir === 'left' ? -4 : dir === 'right' ? 4 : 0, ey = dir === 'up' ? -4 : dir === 'down' ? 4 : 0;
      const px = dir === 'up' || dir === 'down' ? 5 : 0, py = dir === 'left' || dir === 'right' ? 5 : 0;
      ctx.beginPath(); ctx.ellipse(s.x * CELL + 15 + ex + px, s.y * CELL + 15 + ey + py, 2.6, 2.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(s.x * CELL + 15 + ex - px, s.y * CELL + 15 + ey - py, 2.6, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    }
  });
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
