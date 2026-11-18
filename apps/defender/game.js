import { mountGameFrame } from '../../../packages/ui/src/gameFrame.js';
import { intercepted, crossesShield } from './game-logic.js';

const shell = mountGameFrame({
  mount: document.getElementById('shell-mount'),
  config: {
    title: 'Neon Defender',
    subtitle: 'Oriente le bouclier, protège le noyau.',
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
          stats.append(stat('SCORE', 'score', '0'), stat('RECORD', 'best', '0'), stat('VIES', 'lives', '3'), stat('ÉTAT', 'status', 'Prêt'));
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
          help.textContent = '← → ou A / D : tourner le bouclier · Souris : viser · Espace : démarrer · P : pause';
          panel.append(title, actions, help);
          return panel;
        },
      },
    ],
    screen: {
      mount: (el) => {
        const canvas = document.createElement('canvas');
        canvas.id = 'game';
        canvas.width = 800;
        canvas.height = 520;
        canvas.setAttribute('aria-label', 'Arène Neon Defender');
        el.appendChild(canvas);
      },
    },
  },
});

const canvas = shell.screen.querySelector('canvas');
const ctx = canvas.getContext('2d');
const $ = (s) => document.querySelector(s);
const scoreEl = $('#score'), bestEl = $('#best'), livesEl = $('#lives'), statusEl = $('#status');
const W = 800, H = 520, cx = W / 2, cy = H / 2, SHIELD_RADIUS = 108, CORE_RADIUS = 44, PHOTON_RADIUS = 8, SHIELD_HALF_ARC = 0.95;
let state = 'ready', angle = -Math.PI / 2, shots = [], score = 0, bonus = 0, lives = 3, best = Number(localStorage.getItem('pulseDefenderBest')) || 0, last = 0, elapsed = 0, spawn = 0.8, sparks = [], flashes = [], popups = [];

bestEl.textContent = String(best);

function blockEffect(a) {
  flashes.push({ a, life: 0.42 });
  const x = cx + Math.cos(a) * SHIELD_RADIUS, y = cy + Math.sin(a) * SHIELD_RADIUS;
  for (let k = 0; k < 14; k++) {
    const ang = a + Math.PI + (Math.random() - 0.5) * 2.2, sp = 50 + Math.random() * 160;
    sparks.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 0.3 + Math.random() * 0.35, color: Math.random() < 0.5 ? '#baffeb' : '#69ffe1', s: 2 + Math.random() * 2.5 });
  }
  popups.push({ a, life: 0.9 });
}

function start() {
  state = 'playing';
  angle = -Math.PI / 2;
  shots = [];
  score = 0;
  bonus = 0;
  lives = 3;
  elapsed = 0;
  spawn = 0.7;
  scoreEl.textContent = '0';
  livesEl.textContent = String(lives);
  statusEl.textContent = 'Défense';
}

function pause() {
  if (state === 'playing') { state = 'paused'; statusEl.textContent = 'Pause'; }
  else if (state === 'paused') { state = 'playing'; last = performance.now(); statusEl.textContent = 'Défense'; }
  else if (state === 'ready') start();
}

function update(dt) {
  for (const s of sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 0.97; s.vy *= 0.97; s.life -= dt; }
  for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].life <= 0) sparks.splice(i, 1);
  for (let i = flashes.length - 1; i >= 0; i--) if ((flashes[i].life -= dt) <= 0) flashes.splice(i, 1);
  for (let i = popups.length - 1; i >= 0; i--) if ((popups[i].life -= dt) <= 0) popups.splice(i, 1);
  if (state !== 'playing') return;

  elapsed += dt;
  spawn -= dt;

  if (spawn <= 0) {
    shots.push({ a: Math.random() * Math.PI * 2, r: 270, speed: 90 + Math.min(140, elapsed * 2) });
    spawn = Math.max(0.38, 1.05 - elapsed * 0.007);
  }

  for (let i = shots.length - 1; i >= 0; i--) {
    const p = shots[i];
    const previous = p.r;
    p.r -= p.speed * dt;

    const crossed = crossesShield(previous, p.r, SHIELD_RADIUS, PHOTON_RADIUS);
    if (crossed && intercepted(p.a, angle, SHIELD_HALF_ARC)) {
      bonus += 25;
      blockEffect(p.a);
      shots.splice(i, 1);
      continue;
    }

    if (crossed && !intercepted(p.a, angle, SHIELD_HALF_ARC)) {
      lives--;
      livesEl.textContent = String(lives);
      shots.splice(i, 1);
      if (lives <= 0) { state = 'over'; statusEl.textContent = 'Noyau perdu'; }
      continue;
    }

    if (p.r <= CORE_RADIUS + PHOTON_RADIUS) {
      lives--;
      livesEl.textContent = String(lives);
      shots.splice(i, 1);
      if (lives <= 0) { state = 'over'; statusEl.textContent = 'Noyau perdu'; }
    }
  }

  score = Math.floor(elapsed * 4) + bonus;
  scoreEl.textContent = String(score);
  if (score > best) {
    best = score;
    bestEl.textContent = String(best);
    localStorage.setItem('pulseDefenderBest', String(best));
  }
}

function aimAtPointer(e) {
  const r = canvas.getBoundingClientRect();
  const x = ((e.clientX - r.left) * W) / r.width - cx;
  const y = ((e.clientY - r.top) * H) / r.height - cy;
  if (Math.hypot(x, y) > 36) angle = Math.atan2(y, x);
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#061713';
  ctx.fillRect(0, 0, W, H);

  for (const r of [76, SHIELD_RADIUS, 260]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = r === SHIELD_RADIUS ? '#69ffe144' : '#69ffe122';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.fillStyle = '#ff648f';
  ctx.shadowColor = '#ff648f';
  ctx.shadowBlur = 22;
  ctx.beginPath();
  ctx.arc(cx, cy, CORE_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 13px system-ui';
  ctx.fillText('NOYAU', cx, cy + 5);

  for (const p of shots) {
    ctx.fillStyle = '#ffd36b';
    ctx.shadowColor = '#ffd36b';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(p.a) * p.r, cy + Math.sin(p.a) * p.r, PHOTON_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.shadowBlur = 0;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.strokeStyle = '#69ffe1';
  ctx.shadowColor = '#69ffe1';
  ctx.shadowBlur = 25;
  ctx.lineWidth = 20;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, SHIELD_RADIUS, -SHIELD_HALF_ARC, SHIELD_HALF_ARC);
  ctx.stroke();
  ctx.restore();
  ctx.shadowBlur = 0;

  for (const f of flashes) {
    const k = f.life / 0.42;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(f.a);
    ctx.strokeStyle = `rgba(234,255,250,${k})`;
    ctx.shadowColor = '#baffeb';
    ctx.shadowBlur = 30;
    ctx.lineWidth = 24;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, SHIELD_RADIUS, -0.32, 0.32);
    ctx.stroke();
    ctx.strokeStyle = `rgba(105,255,225,${k * 0.55})`;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, 0, SHIELD_RADIUS + (1 - k) * 46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  for (const s of sparks) {
    ctx.globalAlpha = Math.min(1, s.life * 2.4);
    ctx.fillStyle = s.color;
    ctx.fillRect(s.x, s.y, s.s, s.s);
  }
  ctx.globalAlpha = 1;
  for (const p of popups) {
    const d = SHIELD_RADIUS + 30 + (0.9 - p.life) * 55;
    ctx.globalAlpha = Math.min(1, p.life * 1.6);
    ctx.fillStyle = '#d9ff76';
    ctx.shadowColor = '#d9ff76';
    ctx.shadowBlur = 12;
    ctx.font = '800 15px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('+25', cx + Math.cos(p.a) * d, cy + Math.sin(p.a) * d);
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  if (state !== 'playing') {
    ctx.fillStyle = '#04100ddc';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#69ffe1';
    ctx.font = '800 32px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(state === 'ready' ? 'Neon Defender' : state === 'paused' ? 'PAUSE' : 'NOYAU PERDU', cx, cy);
    ctx.fillStyle = '#edfffa';
    ctx.font = '16px system-ui';
    ctx.fillText(state === 'ready' ? 'Espace ou Nouvelle partie pour jouer' : state === 'paused' ? 'Clique sur Pause pour reprendre' : 'Recommencer pour retenter', cx, cy + 34);
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
  const k = e.key.toLowerCase();
  if (['arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  if (k === 'arrowleft' || k === 'a') angle -= 0.12;
  if (k === 'arrowright' || k === 'd') angle += 0.12;
  if (k === ' ' && state !== 'playing') start();
  if (k === 'p') pause();
});

canvas.addEventListener('pointermove', aimAtPointer);
canvas.addEventListener('pointerdown', (e) => {
  aimAtPointer(e);
  if (state === 'over') start();
  if (state === 'ready') start();
});

$('#pause').onclick = pause;
$('#restart').onclick = start;
$('#new-game').onclick = start;

last = performance.now();
requestAnimationFrame(frame);
