import { mountGameFrame } from '../../packages/ui/src/gameFrame.js';

const shell = mountGameFrame({
  mount: document.getElementById('shell-mount'),
  config: {
    title: 'Pong',
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
          panel.className = 'arcade-panel';
          panel.dataset.testid = 'game-panel-left';
          const title = document.createElement('h2');
          title.className = 'arcade-panel__title';
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
          panel.className = 'arcade-panel';
          panel.dataset.testid = 'game-panel-right';
          const title = document.createElement('h2');
          title.className = 'arcade-panel__title';
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
        canvas.setAttribute('aria-label', 'Jeu Pong');
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

let state = 'ready', scoreL = 0, scoreR = 0, last = 0, elapsed = 0;
let left = { y: H / 2 - PADDLE_H / 2, vy: 0, target: H / 2, flash: 0, hit: 0 };
let right = { y: H / 2 - PADDLE_H / 2, vy: 0, target: H / 2, flash: 0, hit: 0 };
let ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, r: 9, trail: [], spin: 0 };
let particles = [], rings = [], shake = 0, rally = 0, flashAlpha = 0, flashColor = '#7bffe5';
let stars = [];
let aiSpeed = 4.5;

const AI_SPEEDS = { easy: 3, arcade: 5.5, chaos: 8 };

function initStars() {
  stars = Array.from({ length: 140 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    size: Math.random() < 0.13 ? 2 : 1,
    speed: 6 + Math.random() * 28,
    alpha: 0.2 + Math.random() * 0.75,
    phase: Math.random() * Math.PI * 2,
  }));
}

function start() {
  scoreL = 0; scoreR = 0; rally = 0;
  scoreLEl.textContent = '0'; scoreREl.textContent = '0';
  resetBall(Math.random() < 0.5 ? 1 : -1);
  left.y = H / 2 - PADDLE_H / 2; right.y = H / 2 - PADDLE_H / 2;
  left.flash = 0; right.flash = 0; left.hit = 0; right.hit = 0;
  particles = []; rings = []; shake = 0; flashAlpha = 0;
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
  ball.spin = 0;
  rally = 0;
}

function ring(x, y, color, r0 = 6) {
  rings.push({ x, y, r: r0, life: 0.32, color });
}

function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 200;
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.35 + Math.random() * 0.35, maxLife: 0.7, color, s: 1.5 + Math.random() * 3.5, rot: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 10 });
  }
}

function update(dt) {
  elapsed += dt;
  shake = Math.max(0, shake - dt * 8);
  flashAlpha = Math.max(0, flashAlpha - dt * 2.5);
  left.flash = Math.max(0, left.flash - dt * 4);
  right.flash = Math.max(0, right.flash - dt * 4);
  left.hit = Math.max(0, left.hit - dt * 6);
  right.hit = Math.max(0, right.hit - dt * 6);
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
    r.r += 110 * dt;
    r.life -= dt;
    if (r.life <= 0) rings.splice(i, 1);
  }
  if (state !== 'playing') return;

  const twoPlayer = modeInput.value === '2p';
  // left paddle (W/S or arrows)
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
  ball.spin += dt * (2 + Math.hypot(ball.vx, ball.vy) * 0.01);
  ball.trail.push({ x: ball.x, y: ball.y, a: 1 });
  if (ball.trail.length > 14) ball.trail.shift();
  for (const t of ball.trail) t.a -= dt * 4.5;
  while (ball.trail.length && ball.trail[0].a <= 0) ball.trail.shift();

  // top/bottom walls
  if (ball.y - ball.r < 0) {
    ball.y = ball.r; ball.vy = Math.abs(ball.vy);
    ring(ball.x, ball.y, '#9befff', 4);
    burst(ball.x, ball.y, '#9befff', 6);
    shake = Math.max(shake, 2);
    audio.tone(300, 0.04, 'square', 0.02);
  }
  if (ball.y + ball.r > H) {
    ball.y = H - ball.r; ball.vy = -Math.abs(ball.vy);
    ring(ball.x, ball.y, '#9befff', 4);
    burst(ball.x, ball.y, '#9befff', 6);
    shake = Math.max(shake, 2);
    audio.tone(300, 0.04, 'square', 0.02);
  }

  // paddle collisions
  const lp = { x: 20, y: left.y, w: PADDLE_W, h: PADDLE_H };
  const rp = { x: W - 20 - PADDLE_W, y: right.y, w: PADDLE_W, h: PADDLE_H };
  if (ball.x - ball.r < lp.x + lp.w && ball.y > lp.y && ball.y < lp.y + lp.h && ball.vx < 0) {
    ball.x = lp.x + lp.w + ball.r;
    const rel = (ball.y - (lp.y + lp.h / 2)) / (lp.h / 2);
    const sp = Math.hypot(ball.vx, ball.vy) * 1.05;
    ball.vx = sp * Math.cos(rel * 0.6);
    ball.vy = sp * Math.sin(rel * 0.6);
    rally++;
    left.hit = 1; left.flash = 1;
    shake = Math.max(shake, 3);
    ring(ball.x, ball.y, '#7bffe5', 6);
    burst(ball.x, ball.y, '#7bffe5', 10);
    audio.tone(520, 0.06, 'square', 0.025);
  }
  if (ball.x + ball.r > rp.x && ball.y > rp.y && ball.y < rp.y + rp.h && ball.vx > 0) {
    ball.x = rp.x - ball.r;
    const rel = (ball.y - (rp.y + rp.h / 2)) / (rp.h / 2);
    const sp = Math.hypot(ball.vx, ball.vy) * 1.05;
    ball.vx = -sp * Math.cos(rel * 0.6);
    ball.vy = sp * Math.sin(rel * 0.6);
    rally++;
    right.hit = 1; right.flash = 1;
    shake = Math.max(shake, 3);
    ring(ball.x, ball.y, '#ff6dbe', 6);
    burst(ball.x, ball.y, '#ff6dbe', 10);
    audio.tone(620, 0.06, 'square', 0.025);
  }

  // score
  if (ball.x - ball.r < 0) {
    scoreR++; scoreREl.textContent = String(scoreR);
    burst(W - 30, ball.y, '#ff6dbe', 20);
    ring(W - 30, ball.y, '#ff6dbe', 10);
    shake = 8; flashAlpha = 0.35; flashColor = '#ff6dbe';
    audio.tone(220, 0.2, 'sawtooth', 0.04);
    if (scoreR >= WIN) { state = 'over'; } else { resetBall(1); }
  }
  if (ball.x + ball.r > W) {
    scoreL++; scoreLEl.textContent = String(scoreL);
    burst(30, ball.y, '#7bffe5', 20);
    ring(30, ball.y, '#7bffe5', 10);
    shake = 8; flashAlpha = 0.35; flashColor = '#7bffe5';
    audio.tone(660, 0.2, 'triangle', 0.04);
    if (scoreL >= WIN) { state = 'over'; } else { resetBall(-1); }
  }
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
  nebula(160 + Math.sin(elapsed * 0.17) * 45, 170, 240, '#00e0a51a');
  nebula(W - 180, 300 + Math.cos(elapsed * 0.13) * 30, 220, '#24b99b1c');
  ctx.save();
  ctx.strokeStyle = '#9bfff008'; ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 50) { ctx.beginPath(); ctx.moveTo(x, 20); ctx.lineTo(x, H - 20); ctx.stroke(); }
  for (let y = 20; y <= H - 20; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.restore();
  for (const s of stars) {
    ctx.globalAlpha = s.alpha * (0.7 + Math.sin(elapsed * 2 + s.phase) * 0.3);
    ctx.fillStyle = s.size > 1 ? '#baffeb' : '#f2fffc';
    ctx.fillRect(s.x, s.y, s.size, s.size);
    if (s.size > 1) { ctx.globalAlpha *= 0.35; ctx.fillRect(s.x - 3, s.y, 7, 1); }
  }
  ctx.globalAlpha = 1;
}

function drawPaddle(x, y, color, side, flash, hit) {
  const cx = x + PADDLE_W / 2;
  const cy = y + PADDLE_H / 2;
  const pulse = 1 + hit * 0.08;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1 / Math.sqrt(pulse), pulse);
  ctx.shadowColor = color;
  ctx.shadowBlur = 14 + flash * 10;
  const body = ctx.createLinearGradient(-PADDLE_W / 2, -PADDLE_H / 2, PADDLE_W / 2, PADDLE_H / 2);
  body.addColorStop(0, color);
  body.addColorStop(0.45, '#eafff8');
  body.addColorStop(1, color);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(-PADDLE_W / 2, -PADDLE_H / 2, PADDLE_W, PADDLE_H, 7);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffffff66';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(-PADDLE_W / 2 + 2, -PADDLE_H / 2 + 4, PADDLE_W - 4, PADDLE_H - 8, 5);
  ctx.stroke();
  ctx.fillStyle = '#ffffff55';
  ctx.fillRect(-PADDLE_W / 2 + 3, -PADDLE_H / 2 + 10, PADDLE_W - 6, 3);
  ctx.fillRect(-PADDLE_W / 2 + 3, PADDLE_H / 2 - 13, PADDLE_W - 6, 3);
  const coreY = Math.sin(elapsed * 4 + (side === 'left' ? 0 : 1.5)) * 8;
  ctx.fillStyle = '#0b2a24cc';
  ctx.beginPath();
  ctx.ellipse(0, coreY, 4.5, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = flash > 0.2 ? '#ffffff' : color;
  ctx.beginPath();
  ctx.arc(0, coreY, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBall() {
  ctx.save();
  ctx.translate(ball.x, ball.y);
  ctx.rotate(ball.spin);
  ctx.shadowColor = '#7bffe5';
  ctx.shadowBlur = 18;
  const core = ctx.createRadialGradient(-2, -2, 1, 0, 0, ball.r);
  core.addColorStop(0, '#ffffff');
  core.addColorStop(0.35, '#bffdf0');
  core.addColorStop(0.7, '#7bffe5');
  core.addColorStop(1, '#1ea88a');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, ball.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffffff88';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, ball.r - 2.2, 0, Math.PI * 1.4);
  ctx.stroke();
  ctx.strokeStyle = '#0c3d33aa';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-ball.r + 2, 0); ctx.lineTo(ball.r - 2, 0);
  ctx.moveTo(0, -ball.r + 2); ctx.lineTo(0, ball.r - 2);
  ctx.stroke();
  ctx.fillStyle = '#ffffffcc';
  ctx.beginPath();
  ctx.arc(-2.5, -2.5, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  drawBackground();
  // center line (styled)
  ctx.save();
  ctx.strokeStyle = 'rgba(123,255,224,0.22)'; ctx.lineWidth = 2; ctx.setLineDash([8, 14]);
  ctx.shadowColor = '#69ffe1'; ctx.shadowBlur = 6;
  ctx.beginPath(); ctx.moveTo(W / 2, 20); ctx.lineTo(W / 2, H - 20); ctx.stroke();
  ctx.setLineDash([]); ctx.restore();
  ctx.beginPath(); ctx.arc(W / 2, H / 2, 46, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(123,255,224,0.12)'; ctx.lineWidth = 1.5; ctx.stroke();
  // trail
  for (const t of ball.trail) {
    ctx.globalAlpha = Math.max(0, t.a * 0.45);
    ctx.fillStyle = '#8b8bff';
    ctx.beginPath(); ctx.arc(t.x, t.y, 5 * t.a + 1, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // rings
  for (const r of rings) {
    ctx.globalAlpha = Math.max(0, r.life / 0.32);
    ctx.strokeStyle = r.color; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  drawBall();
  drawPaddle(20, left.y, '#7bffe5', 'left', left.flash, left.hit);
  drawPaddle(W - 20 - PADDLE_W, right.y, '#ff6dbe', 'right', right.flash, right.hit);
  // particles
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, (p.life / (p.maxLife || 0.7)) * 0.95);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot || 0);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color; ctx.shadowBlur = 8;
    ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
    ctx.restore();
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  if (rally >= 3 && state === 'playing') {
    ctx.textAlign = 'center'; ctx.fillStyle = '#d9ff76'; ctx.font = '700 14px system-ui';
    ctx.fillText(`ÉCHANGE x${rally}`, W / 2, 28);
  }
  if (flashAlpha > 0) {
    ctx.globalAlpha = Math.min(0.45, flashAlpha);
    ctx.fillStyle = flashColor;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  if (state !== 'playing') {
    ctx.fillStyle = 'rgba(6,20,18,0.72)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.fillStyle = '#7bffe5'; ctx.shadowColor = '#7bffe5'; ctx.shadowBlur = 18; ctx.font = '800 36px system-ui';
    ctx.fillText(state === 'ready' ? 'PONG' : state === 'paused' ? 'PAUSE' : (scoreL >= WIN ? 'VICTOIRE JOUEUR' : 'VICTOIRE ADVERSAIRE'), W / 2, H / 2);
    ctx.shadowBlur = 0;
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
initStars();
last = performance.now();
requestAnimationFrame(frame);
start();
