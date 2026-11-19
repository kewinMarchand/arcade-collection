import { mountGameFrame } from '../../packages/ui/src/gameFrame.js';

const shell = mountGameFrame({
  mount: document.getElementById('shell-mount'),
  config: {
    title: 'Neon Breaker',
    subtitle: 'Casse les briques • Garde la balle en jeu',
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

      const powerups = document.createElement('label');
      powerups.className = 'option';
      const powerupsInput = document.createElement('input');
      powerupsInput.id = 'powerups';
      powerupsInput.className = 'toggle';
      powerupsInput.type = 'checkbox';
      powerupsInput.checked = true;
      powerups.append(' Bonus ', powerupsInput);

      const sound = document.createElement('label');
      sound.className = 'option';
      const soundInput = document.createElement('input');
      soundInput.id = 'sound';
      soundInput.className = 'toggle';
      soundInput.type = 'checkbox';
      sound.append(' Sons ', soundInput);

      options.append(difficulty, powerups, sound);
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
            const small = document.createElement('small');
            small.textContent = label;
            const strong = document.createElement('strong');
            strong.id = id;
            strong.textContent = value;
            wrap.append(small, strong);
            return wrap;
          };
          stats.append(stat('SCORE', 'score', '0'), stat('VIES', 'lives', '3'), stat('ÉTAT', 'status', 'Prêt'));
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
          help.textContent = '← → ou A / D : déplacer • Espace ou clic : lancer • P : pause';

          panel.append(title, actions, help);
          return panel;
        },
      },
    ],
    screen: {
      mount: (el) => {
        const canvas = document.createElement('canvas');
        canvas.id = 'game';
        canvas.width = 900;
        canvas.height = 620;
        canvas.setAttribute('aria-label', 'Jeu de casse-briques Neon Breaker');
        el.appendChild(canvas);
      },
    },
  },
});

const canvas = shell.screen.querySelector('canvas');
const ctx = canvas.getContext('2d');
const $ = (s) => document.querySelector(s);
const W = canvas.width;
const H = canvas.height;
const soundInput = document.querySelector('#sound');
const difficultyInput = document.querySelector('#difficulty');
const powerupsInput = document.querySelector('#powerups');

let state = 'ready';
let score = 0;
let lives = 3;
let paddle = { x: W / 2, w: 120, squash: 1 };
let ball = { x: W / 2, y: H - 70, vx: 190, vy: -250, r: 8, stuck: true, sx: 1, sy: 1, trail: [] };
let bricks = [];
let keys = new Set();
let last = 0;
let particles = [];
let ghosts = [];
let ripples = [];
let rings = [];
let powerups = [];
let banner = '';
let bannerTimer = 0;
let level = 1;
let effects = { wide: 0 };
let shake = 0;
let audioContext;
let stars = [];

function initStars() {
  stars = Array.from({ length: 160 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: Math.random() < 0.13 ? 2.6 : Math.random() < 0.35 ? 1.9 : 1 + Math.random() * 0.8,
    a: 0.25 + Math.random() * 0.7,
    phase: Math.random() * Math.PI * 2,
    vy: 8 + Math.random() * 22,
    vx: (Math.random() - 0.5) * 6,
  }));
}

function ballSpeed() {
  const spd = { chill: 0.85, arcade: 1, chaos: 1.22 }[difficultyInput.value] || 1;
  return { vx: 190 * spd, vy: -250 * spd };
}

function tone(freq, duration = 0.07, type = 'square', volume = 0.03) {
  if (!soundInput.checked) return;
  try {
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioContext.currentTime);
    gain.gain.setValueAtTime(volume, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start();
    osc.stop(audioContext.currentTime + duration);
  } catch (_) {}
}

function reset() {
  score = 0;
  level = 1;
  lives = 3;
  paddle.x = W / 2;
  paddle.w = 120;
  paddle.squash = 1;
  effects.wide = 0;
  const s = ballSpeed();
  ball = { x: W / 2, y: H - 70, vx: s.vx, vy: s.vy, r: 8, stuck: true, sx: 1, sy: 1, trail: [] };
  bricks = [];
  particles = [];
  ghosts = [];
  ripples = [];
  rings = [];
  powerups = [];
  shake = 0;
  initStars();
  const rows = Math.min(5 + (level - 1), 8);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < 10; c++) {
      bricks.push({ x: 70 + c * 77, y: 70 + r * 30, w: 68, h: 22, color: r % 5, pulse: 0, scale: 1 });
    }
  }
  $('#score').textContent = '0';
  $('#lives').textContent = String(lives);
  $('#status').textContent = 'Prêt';
  state = 'ready';
}

function start() {
  reset();
  state = 'playing';
  ball.stuck = false;
  $('#status').textContent = 'En jeu';
  tone(660, 0.12, 'triangle');
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

function ring(x, y, color) { rings.push({ x, y, r: 8, life: 0.4, color }); }

function update(dt) {
  bannerTimer = Math.max(0, bannerTimer - dt);
  effects.wide = Math.max(0, effects.wide - dt);
  shake = Math.max(0, shake - dt * 3);
  const targetW = effects.wide > 0 ? 170 : 120;
  paddle.w += (targetW - paddle.w) * Math.min(1, dt * 10);
  paddle.squash += (1 - paddle.squash) * Math.min(1, dt * 12);
  ball.sx += (1 - ball.sx) * Math.min(1, dt * 10);
  ball.sy += (1 - ball.sy) * Math.min(1, dt * 10);
  for (const b of bricks) { b.pulse = Math.max(0, b.pulse - dt * 4); b.scale += (1 - b.scale) * Math.min(1, dt * 12); }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 170 * dt; p.life -= dt; if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = ghosts.length - 1; i >= 0; i--) if ((ghosts[i].life -= dt) <= 0) ghosts.splice(i, 1);
  for (let i = ripples.length - 1; i >= 0; i--) if ((ripples[i].life -= dt) <= 0) ripples.splice(i, 1);
  for (let i = rings.length - 1; i >= 0; i--) { rings[i].r += 120 * dt; if ((rings[i].life -= dt) <= 0) rings.splice(i, 1); }
  for (const s of stars) {
    s.y += s.vy * dt;
    s.x += s.vx * dt;
    if (s.y > H + 4) { s.y = -4; s.x = Math.random() * W; }
    if (s.x < -4) s.x = W + 4;
    if (s.x > W + 4) s.x = -4;
  }

  if (state !== 'playing') return;

  const dir = (keys.has('arrowleft') || keys.has('a') ? -1 : 0) + (keys.has('arrowright') || keys.has('d') ? 1 : 0);
  paddle.x = Math.max(paddle.w / 2, Math.min(W - paddle.w / 2, paddle.x + dir * 470 * dt));

  if (ball.stuck) {
    ball.x = paddle.x;
    ball.trail = [];
    return;
  }

  ball.trail.push({ x: ball.x, y: ball.y, a: 1 });
  if (ball.trail.length > 10) ball.trail.shift();
  for (const t of ball.trail) t.a -= dt * 5;
  ball.trail = ball.trail.filter((t) => t.a > 0);

  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  if (ball.x < ball.r || ball.x > W - ball.r) {
    ball.vx *= -1; ball.sx = 0.75; ball.sy = 1.25; ring(ball.x, ball.y, '#69ffe1'); tone(220, 0.05);
  }
  if (ball.y < ball.r) {
    ball.vy = Math.abs(ball.vy); ball.sx = 1.25; ball.sy = 0.75; ring(ball.x, ball.y, '#69ffe1'); tone(220, 0.05);
  }
  if (ball.y > H - 48 && ball.y < H - 25 && ball.x > paddle.x - paddle.w / 2 && ball.x < paddle.x + paddle.w / 2) {
    ball.vy = -Math.abs(ball.vy);
    ball.vx += (ball.x - paddle.x) * 2.8;
    ball.sx = 1.25; ball.sy = 0.75;
    paddle.squash = 0.82;
    ripples.push({ x: ball.x, life: 0.35 }); ring(ball.x, H - 36, '#69ffe1');
    tone(330, 0.06);
  }

  for (let i = bricks.length - 1; i >= 0; i--) {
    const b = bricks[i];
    if (ball.x + ball.r > b.x && ball.x - ball.r < b.x + b.w && ball.y + ball.r > b.y && ball.y - ball.r < b.y + b.h) {
      const color = ['#ff6d9c', '#ffbd69', '#ffe36e', '#69ffe1', '#72bdff'][b.color];
      ghosts.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, w: b.w, h: b.h, color, life: 0.3 });
      for (let k = 0; k < 15; k++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 40 + Math.random() * 180;
        particles.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.35 + Math.random() * 0.35, color, s: 2 + Math.random() * 3 });
      }
      ring(b.x + b.w / 2, b.y + b.h / 2, color);
      shake = Math.max(shake, 0.12);
      if (powerupsInput.checked && Math.random() < 0.18) {
        powerups.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, type: ['wide', 'slow', 'life'][Math.floor(Math.random() * 3)], vy: 110, phase: Math.random() * 6 });
      }
      bricks.splice(i, 1);
      ball.vy *= -1; ball.sx = 1.2; ball.sy = 0.8;
      score += 10;
      tone(420 + b.color * 90, 0.08, 'triangle', 0.02);
      break;
    }
  }

  if (ball.y > H) {
    lives--;
    $('#lives').textContent = String(lives);
    shake = 0.4;
    ring(ball.x, H - 8, '#ff6d9c');
    burst(ball.x, H - 8, '#ff6d9c', 18);
    ripples.push({ x: ball.x, life: 0.45 });
    tone(110, 0.25, 'sawtooth', 0.045);
    if (lives <= 0) {
      state = 'over';
      $('#status').textContent = 'Terminé';
    } else {
      const s = ballSpeed();
      ball = { x: paddle.x, y: H - 70, vx: s.vx, vy: s.vy, r: 8, stuck: true, sx: 1, sy: 1, trail: [] };
      state = 'ready';
      $('#status').textContent = 'Lancer';
    }
  }

  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    p.y += p.vy * dt;
    p.phase += dt * 5;
    if (p.y > H + 20) { powerups.splice(i, 1); continue; }
    if (p.y > H - 46 && p.y < H - 20 && Math.abs(p.x - paddle.x) < paddle.w / 2 + 16) {
      if (p.type === 'wide') { effects.wide = 8; banner = 'PADDLE XL !'; tone(520, 0.15, 'sine'); }
      else if (p.type === 'slow') { ball.vx *= 0.8; ball.vy = Math.sign(ball.vy) * Math.max(150, Math.abs(ball.vy) * 0.75); banner = 'RALENTI !'; tone(300, 0.15, 'sine'); }
      else { lives++; $('#lives').textContent = String(lives); banner = '+1 VIE !'; tone(880, 0.15, 'triangle'); }
      bannerTimer = 1.3; paddle.squash = 1.15;
      burst(p.x, p.y, '#b8ff68', 12); ring(p.x, p.y, '#b8ff68');
      powerups.splice(i, 1);
    }
  }

  if (!bricks.length) {
    if (level >= 10) {
      state = 'won';
      $('#status').textContent = 'Gagné';
    } else {
      level++;
      const rows = Math.min(5 + (level - 1), 8);
      bricks = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < 10; c++) bricks.push({ x: 70 + c * 77, y: 70 + r * 30, w: 68, h: 22, color: r % 5, pulse: 0, scale: 1 });
      ball = { x: W / 2, y: H - 70, vx: ball.vx, vy: -Math.abs(ball.vy), r: 8, stuck: true, sx: 1, sy: 1, trail: [] };
      paddle.w = 120; effects.wide = 0;
      banner = `NIVEAU ${level}`; bannerTimer = 1.6;
      $('#status').textContent = `Niveau ${level}`;
      tone(520 + level * 40, 0.16, 'triangle', 0.03);
    }
  }
  $('#score').textContent = String(score);
}

function burst(x, y, color, n) {
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 30 + Math.random() * 140;
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.35, color, s: 2 + Math.random() * 2 });
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * 10 * shake, (Math.random() - 0.5) * 10 * shake);

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0c211d');
  g.addColorStop(1, '#06100f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const time = performance.now() * 0.001;
  // Atmospheric layers and nebulas
  const neb = (x, y, r, c) => {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, c);
    rg.addColorStop(1, 'transparent');
    ctx.fillStyle = rg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  neb(W * 0.22 + Math.sin(time * 0.17) * 30, H * 0.18, 260, 'rgba(0, 224, 165, 0.1)');
  neb(W * 0.78, H * 0.28 + Math.cos(time * 0.13) * 20, 240, 'rgba(36, 185, 155, 0.08)');
  neb(W * 0.5, H * 0.75, 320, 'rgba(6, 40, 34, 0.18)');

  ctx.save();
  ctx.strokeStyle = '#9bfff008';
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 40); ctx.lineTo(x, H - 20); ctx.stroke(); }
  for (let y = 40; y <= H - 20; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.restore();

  for (const s of stars) {
    const tw = 0.7 + Math.sin(time * 2 + s.phase) * 0.3;
    ctx.globalAlpha = Math.max(0.12, s.a * tw);
    ctx.fillStyle = s.r > 2.1 ? '#ffffff' : '#eafff7';
    ctx.shadowColor = '#7af7e0';
    ctx.shadowBlur = s.r > 1.8 ? 8 : 3;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    if (s.r > 2.1) {
      ctx.globalAlpha *= 0.35;
      ctx.fillRect(s.x - 4, s.y, 8, 1);
      ctx.fillRect(s.x, s.y - 4, 1, 8);
    }
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  const haze = ctx.createLinearGradient(0, 0, 0, H);
  haze.addColorStop(0, 'rgba(6, 18, 16, 0.08)');
  haze.addColorStop(1, 'rgba(4, 12, 11, 0.18)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, W, H);

  bricks.forEach((b) => {
    const color = ['#ff6d9c', '#ffbd69', '#ffe36e', '#69ffe1', '#72bdff'][b.color];
    const s = b.scale;
    ctx.save();
    ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
    ctx.scale(s, 2 - s);
    ctx.shadowColor = color;
    ctx.shadowBlur = 9 + b.pulse * 8;
    const body = ctx.createLinearGradient(-b.w / 2, -b.h / 2, b.w / 2, b.h / 2);
    body.addColorStop(0, color);
    body.addColorStop(0.5, '#ffffff22');
    body.addColorStop(1, color);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.roundRect(-b.w / 2, -b.h / 2, b.w, b.h, 5);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffffff55';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#06141288';
    ctx.beginPath();
    ctx.roundRect(-b.w / 2 + 5, -b.h / 2 + 4, b.w - 10, b.h - 8, 3);
    ctx.fill();
    ctx.strokeStyle = color + '88';
    ctx.beginPath();
    ctx.moveTo(-b.w / 2 + 8, 0); ctx.lineTo(b.w / 2 - 8, 0);
    ctx.stroke();
    ctx.fillStyle = '#ffffffaa';
    ctx.fillRect(-b.w / 2 + 6, -b.h / 2 + 4, b.w * 0.28, 2);
    ctx.fillStyle = '#eafff8cc';
    ctx.beginPath(); ctx.arc(-b.w / 2 + 9, 0, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(b.w / 2 - 9, 0, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });

  // Paddle
  ctx.save();
  ctx.translate(paddle.x, H - 35.5);
  ctx.scale(1 / Math.sqrt(paddle.squash), paddle.squash);
  ctx.shadowColor = '#69ffe1';
  ctx.shadowBlur = 16;
  const padGrad = ctx.createLinearGradient(0, -8, 0, 8);
  padGrad.addColorStop(0, '#dffff7');
  padGrad.addColorStop(0.35, '#69ffe1');
  padGrad.addColorStop(1, '#147765');
  ctx.fillStyle = padGrad;
  ctx.beginPath();
  ctx.roundRect(-paddle.w / 2, -7, paddle.w, 14, 7);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffffff66';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.roundRect(-paddle.w / 2 + 2, -5, paddle.w - 4, 10, 6);
  ctx.stroke();
  ctx.fillStyle = '#06231dcc';
  ctx.beginPath();
  ctx.roundRect(-18, -3.5, 36, 7, 4);
  ctx.fill();
  ctx.strokeStyle = '#8affdf99';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#baffef';
  ctx.beginPath();
  ctx.arc(-10, 0, 2, 0, Math.PI * 2);
  ctx.arc(10, 0, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff55';
  ctx.fillRect(-paddle.w / 2 + 8, -5, paddle.w * 0.25, 2);
  ctx.restore();

  for (const gh of ghosts) {
    ctx.globalAlpha = gh.life / 0.3;
    ctx.strokeStyle = gh.color;
    ctx.lineWidth = 2;
    ctx.shadowColor = gh.color;
    ctx.shadowBlur = 12;
    const ex = gh.w + (1 - gh.life / 0.3) * 26;
    ctx.beginPath();
    ctx.roundRect(gh.x - ex / 2, gh.y - gh.h / 2, ex, gh.h, 5);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  for (const r of rings) {
    ctx.globalAlpha = Math.max(0, r.life / 0.4);
    ctx.strokeStyle = r.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  for (const r of ripples) {
    ctx.globalAlpha = r.life / 0.35;
    ctx.strokeStyle = '#69ffe1';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(r.x, H - 36, (1 - r.life / 0.35) * 46 + 12, 5 + (1 - r.life / 0.35) * 8, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  for (const p of particles) {
    ctx.globalAlpha = Math.min(1, p.life * 2.5);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.s, p.s);
  }
  ctx.globalAlpha = 1;

  // Ball trail
  for (const t of ball.trail) {
    ctx.globalAlpha = t.a * 0.35;
    ctx.fillStyle = '#ffe36e';
    ctx.beginPath();
    ctx.arc(t.x, t.y, ball.r * 0.7 * t.a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Ball (energy core)
  ctx.save();
  ctx.translate(ball.x, ball.y);
  ctx.scale(ball.sx, ball.sy);
  ctx.rotate(time * 3);
  ctx.shadowColor = '#ffe36e';
  ctx.shadowBlur = 16;
  const core = ctx.createRadialGradient(-2, -2, 1, 0, 0, ball.r);
  core.addColorStop(0, '#ffffff');
  core.addColorStop(0.35, '#fff4b0');
  core.addColorStop(0.7, '#ffe36e');
  core.addColorStop(1, '#d9a900');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, ball.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffffff99';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, 0, ball.r - 2, 0.2, Math.PI * 1.5);
  ctx.stroke();
  ctx.strokeStyle = '#8a650088';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-ball.r + 2, 0); ctx.lineTo(ball.r - 2, 0);
  ctx.moveTo(0, -ball.r + 2); ctx.lineTo(0, ball.r - 2);
  ctx.stroke();
  ctx.fillStyle = '#ffffffcc';
  ctx.beginPath();
  ctx.arc(-2.2, -2.4, 2.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  for (const p of powerups) {
    const icon = p.type === 'wide' ? '↔' : p.type === 'slow' ? '⏱' : '♥';
    const color = p.type === 'wide' ? '#69ffe1' : p.type === 'slow' ? '#72bdff' : '#ff6d9c';
    const pulse = 1 + 0.08 * Math.sin(p.phase);
    ctx.save();
    ctx.translate(p.x, p.y + Math.sin(p.phase) * 4);
    ctx.scale(pulse, pulse);
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#10241e';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-12, -12, 24, 24, 7);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, 0, 1);
    ctx.restore();
  }

  if (bannerTimer > 0 && state === 'playing') {
    ctx.globalAlpha = Math.min(1, bannerTimer * 2);
    ctx.textAlign = 'center';
    ctx.font = '900 22px system-ui';
    ctx.fillStyle = '#d9ff76';
    ctx.shadowColor = '#d9ff76';
    ctx.shadowBlur = 16;
    ctx.fillText(banner, W / 2, 40);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  ctx.restore();

  if (state === 'ready' || state === 'paused' || state === 'over' || state === 'won') {
    ctx.fillStyle = '#04100ddc';
    ctx.fillRect(0, 0, W, H);

    const overlayTime = performance.now() * 0.001;
    for (const s of stars) {
      const tw = 0.5 + 0.5 * Math.sin(overlayTime * s.sp + s.tw);
      ctx.globalAlpha = 0.3 + 0.6 * s.a * tw;
      ctx.fillStyle = s.r > 2.2 ? '#ffffff' : '#e6fffb';
      ctx.shadowColor = '#8fffe8';
      ctx.shadowBlur = s.r > 1.8 ? 10 : 5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    ctx.textAlign = 'center';
    ctx.fillStyle = '#69ffe1';
    ctx.font = '900 36px system-ui';
    const title = state === 'ready' ? 'NEON BREAKER' : state === 'paused' ? 'PAUSE' : state === 'won' ? 'NIVEAU TERMINÉ' : 'PARTIE TERMINÉE';
    ctx.fillText(title, W / 2, H / 2);
    ctx.fillStyle = '#edfffa';
    ctx.font = '16px system-ui';
    const hint = state === 'ready' ? 'Espace ou clic pour lancer' : state === 'paused' ? 'Clique sur Pause pour reprendre' : state === 'won' ? `Score final : ${score} - Niveau ${level}` : 'Recommencer pour rejouer';
    ctx.fillText(hint, W / 2, H / 2 + 35);
  }
}

function frame(t) {
  const dt = Math.min((t - last) / 1000 || 0, 0.025);
  last = t;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if ([' ', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  keys.add(k);
  if (k === 'p') pause();
  if (k === ' ' && state === 'ready') start();
});

window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

canvas.addEventListener('pointermove', (e) => {
  const r = canvas.getBoundingClientRect();
  paddle.x = ((e.clientX - r.left) * W) / r.width;
  if (ball.stuck) ball.x = paddle.x;
});

canvas.addEventListener('pointerdown', () => {
  if (state === 'ready' || state === 'over' || state === 'won') start();
});

$('#pause').onclick = pause;
$('#restart').onclick = start;
$('#new-game').onclick = start;

reset();
requestAnimationFrame(frame);
