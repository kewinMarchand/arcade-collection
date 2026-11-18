import { mountGameFrame } from '../../packages/ui/src/gameFrame.js';

const shell = mountGameFrame({
  mount: document.getElementById('shell-mount'),
  config: {
    title: 'Neon Pong',
    subtitle: 'Renvoyez la balle, marquez des points.',
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
          sel.id = id; sel.setAttribute('aria-label', label); sel.innerHTML = inner;
          wrap.appendChild(sel);
        } else {
          const input = document.createElement('input');
          input.id = id; input.className = 'toggle'; input.type = 'checkbox';
          // sound off by default
          wrap.append(` ${label} `, input);
        }
        return wrap;
      };
      options.append(
        mk('Mode', 'mode', 'select', '<option value="1p">1 joueur</option><option value="2p">2 joueurs</option>'),
        mk('IA', 'ai', 'select', '<option value="easy">Facile</option><option value="arcade" selected>Arcade</option><option value="chaos">Chaos</option>'),
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
          title.textContent = 'Score';
          const stats = document.createElement('div');
          stats.className = 'panel-stats';
          const stat = (label, id, value) => {
            const wrap = document.createElement('div');
            wrap.className = 'panel-stat';
            const small = document.createElement('small'); small.textContent = label;
            const strong = document.createElement('strong'); strong.id = id; strong.textContent = value;
            wrap.append(small, strong); return wrap;
          };
          stats.append(stat('JOUEUR', 'scoreL', '0'), stat('ADVERSAIRE', 'scoreR', '0'));
          panel.append(title, stats);
          const help = document.createElement('p');
          help.className = 'help';
          help.textContent = 'W/S ou ↑/↓ : palette gauche · I/K : palette droite (2 joueurs).';
          panel.append(help);
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
          panel.append(title, actions);
          return panel;
        },
      },
    ],
    screen: {
      mount: (el) => {
        const canvas = document.createElement('canvas');
        canvas.id = 'game';
        canvas.width = 800;
        canvas.height = 500;
        canvas.setAttribute('aria-label', 'Jeu Neon Pong');
        el.appendChild(canvas);
      },
    },
  },
});

const canvas = shell.screen.querySelector('canvas');
const ctx = canvas.getContext('2d');
const scoreLEl = document.querySelector('#scoreL');
const scoreREl = document.querySelector('#scoreR');
const modeInput = document.querySelector('#mode');
const aiInput = document.querySelector('#ai');
const soundInput = document.querySelector('#sound');
const audio = { tone: (f, d, t, v) => { if (!soundInput.checked) return; try { const c = new (window.AudioContext || window.webkitAudioContext)(); const o = c.createOscillator(), g = c.createGain(); o.type = t || 'sine'; o.frequency.value = f; g.gain.setValueAtTime(v || 0.03, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + d); o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + d); } catch {} } };

const W = canvas.width, H = canvas.height;
const PADDLE_H = 90, PADDLE_W = 14;
const WIN = 11;

let state = 'ready', scoreL = 0, scoreR = 0, last = 0;
let left = { y: H / 2 - PADDLE_H / 2, vy: 0, target: H / 2 };
let right = { y: H / 2 - PADDLE_H / 2, vy: 0, target: H / 2 };
let ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, r: 9, trail: [] };
let particles = [], shake = 0;
let aiSpeed = 4.5;

const AI_SPEEDS = { easy: 3, arcade: 5.5, chaos: 8 };

function start() {
  scoreL = 0; scoreR = 0;
  scoreLEl.textContent = '0'; scoreREl.textContent = '0';
  resetBall(Math.random() < 0.5 ? 1 : -1);
  left.y = H / 2 - PADDLE_H / 2; right.y = H / 2 - PADDLE_H / 2;
  state = 'playing';
  audio.tone(520, 0.1, 'triangle', 0.03);
}

function resetBall(dir) {
  ball.x = W / 2; ball.y = H / 2;
  const angle = (Math.random() * 0.6 - 0.3);
  const sp = 320;
  ball.vx = dir * sp * Math.cos(angle);
  ball.vy = sp * Math.sin(angle);
  ball.trail = [];
}

function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 180;
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.4 + Math.random() * 0.3, color, s: 2 + Math.random() * 3 });
  }
}

function update(dt) {
  shake = Math.max(0, shake - dt * 3);
  for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; if (p.life <= 0) particles.splice(i, 1); }
  if (state !== 'playing') return;

  const twoPlayer = modeInput.value === '2p';
  // left paddle (W/S or arrows)
  // controlled via keys set below
  left.vy = 0;
  if (keys.has('w') || keys.has('arrowup')) left.vy = -420;
  if (keys.has('s') || keys.has('arrowdown')) left.vy = 420;
  left.y = Math.max(0, Math.min(H - PADDLE_H, left.y + left.vy * dt));

  if (twoPlayer) {
    right.vy = 0;
    if (keys.has('i')) right.vy = -420;
    if (keys.has('k')) right.vy = 420;
    right.y = Math.max(0, Math.min(H - PADDLE_H, right.y + right.vy * dt));
  } else {
    // AI
    const aiSp = AI_SPEEDS[aiInput.value] || 5;
    const target = ball.y - PADDLE_H / 2;
    const diff = target - right.y;
    const maxMove = aiSp * 60 * dt;
    right.y += Math.max(-maxMove, Math.min(maxMove, diff * 0.12));
    right.y = Math.max(0, Math.min(H - PADDLE_H, right.y));
  }

  // ball
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  ball.trail.push({ x: ball.x, y: ball.y, a: 1 });
  if (ball.trail.length > 12) ball.trail.shift();
  for (const t of ball.trail) t.a -= 0.08;
  while (ball.trail.length && ball.trail[0].a <= 0) ball.trail.shift();

  // top/bottom walls
  if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); audio.tone(300, 0.04, 'square', 0.02); }
  if (ball.y + ball.r > H) { ball.y = H - ball.r; ball.vy = -Math.abs(ball.vy); audio.tone(300, 0.04, 'square', 0.02); }

  // paddle collisions
  const lp = { x: 20, y: left.y, w: PADDLE_W, h: PADDLE_H };
  const rp = { x: W - 20 - PADDLE_W, y: right.y, w: PADDLE_W, h: PADDLE_H };
  if (ball.x - ball.r < lp.x + lp.w && ball.y > lp.y && ball.y < lp.y + lp.h && ball.vx < 0) {
    ball.x = lp.x + lp.w + ball.r;
    const rel = (ball.y - (lp.y + lp.h / 2)) / (lp.h / 2);
    const sp = Math.hypot(ball.vx, ball.vy) * 1.05;
    ball.vx = sp * Math.cos(rel * 0.6);
    ball.vy = sp * Math.sin(rel * 0.6);
    burst(ball.x, ball.y, '#7bffe5', 8);
    audio.tone(520, 0.06, 'square', 0.025);
  }
  if (ball.x + ball.r > rp.x && ball.y > rp.y && ball.y < rp.y + rp.h && ball.vx > 0) {
    ball.x = rp.x - ball.r;
    const rel = (ball.y - (rp.y + rp.h / 2)) / (rp.h / 2);
    const sp = Math.hypot(ball.vx, ball.vy) * 1.05;
    ball.vx = -sp * Math.cos(rel * 0.6);
    ball.vy = sp * Math.sin(rel * 0.6);
    burst(ball.x, ball.y, '#ff6dbe', 8);
    audio.tone(620, 0.06, 'square', 0.025);
  }

  // score
  if (ball.x - ball.r < 0) {
    scoreR++; scoreREl.textContent = String(scoreR);
    burst(W / 2, H / 2, '#ff6dbe', 16);
    audio.tone(220, 0.2, 'sawtooth', 0.04);
    if (scoreR >= WIN) { state = 'over'; } else { resetBall(1); }
  }
  if (ball.x + ball.r > W) {
    scoreL++; scoreLEl.textContent = String(scoreL);
    burst(W / 2, H / 2, '#7bffe5', 16);
    audio.tone(660, 0.2, 'triangle', 0.04);
    if (scoreL >= WIN) { state = 'over'; } else { resetBall(-1); }
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#090b1c'; ctx.fillRect(0, 0, W, H);
  // center line
  ctx.strokeStyle = 'rgba(123,255,224,0.3)'; ctx.lineWidth = 2; ctx.setLineDash([10, 14]);
  ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke(); ctx.setLineDash([]);
  // trail
  for (const t of ball.trail) { ctx.globalAlpha = t.a * 0.5; ctx.fillStyle = '#8b8bff'; ctx.beginPath(); ctx.arc(t.x, t.y, 6, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
  // ball
  ctx.fillStyle = '#7bffe5'; ctx.shadowColor = '#7bffe5'; ctx.shadowBlur = 16; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  // paddles
  ctx.fillStyle = '#7bffe5'; ctx.shadowColor = '#7bffe5'; ctx.shadowBlur = 12; ctx.fillRect(20, left.y, PADDLE_W, PADDLE_H); ctx.shadowBlur = 0;
  ctx.fillStyle = '#ff6dbe'; ctx.shadowColor = '#ff6dbe'; ctx.shadowBlur = 12; ctx.fillRect(W - 20 - PADDLE_W, right.y, PADDLE_W, PADDLE_H); ctx.shadowBlur = 0;
  // particles
  for (const p of particles) { ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.s, p.s); }
  ctx.globalAlpha = 1;
  if (state !== 'playing') {
    ctx.fillStyle = 'rgba(6,20,18,0.75)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.fillStyle = '#7bffe5'; ctx.font = '800 36px system-ui';
    ctx.fillText(state === 'ready' ? 'NEON PONG' : state === 'paused' ? 'PAUSE' : (scoreL >= WIN ? 'VICTOIRE JOUEUR' : 'VICTOIRE ADVERSAIRE'), W / 2, H / 2);
    ctx.fillStyle = '#edfffa'; ctx.font = '16px system-ui';
    ctx.fillText(state === 'ready' ? 'Espace pour lancer' : state === 'paused' ? 'Clique sur Pause' : 'Clique ou Recommencer', W / 2, H / 2 + 36);
  }
}

const keys = new Set();
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if ([' ', 'arrowup', 'arrowdown'].includes(k)) e.preventDefault();
  if (k === ' ') { if (state === 'ready' || state === 'over') start(); else if (state === 'playing') { /* */ } }
  keys.add(k);
  if (k === 'p') { if (state === 'playing') { state = 'paused'; } else if (state === 'paused') { state = 'playing'; last = performance.now(); } }
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
canvas.addEventListener('pointerdown', () => { if (state === 'ready' || state === 'over') start(); });
document.querySelector('#pause').onclick = () => { if (state === 'playing') { state = 'paused'; } else if (state === 'paused') { state = 'playing'; last = performance.now(); } else if (state === 'ready' || state === 'over') start(); };
document.querySelector('#restart').onclick = start;
document.querySelector('#new-game').onclick = start;

function frame(t) { const dt = Math.min((t - last) / 1000 || 0, 0.04); last = t; update(dt); draw(); requestAnimationFrame(frame); }
last = performance.now();
requestAnimationFrame(frame);
start();
