import { mountGameFrame } from '../../packages/ui/src/gameFrame.js';

const shell = mountGameFrame({
  mount: document.getElementById('shell-mount'),
  config: {
    title: 'Neon Breaker',
    subtitle: 'Casse les briques · Garde la balle en jeu',
    renderHeader: () => {
      const options = document.createElement('div');
      options.className = 'game-options';
      options.setAttribute('aria-label', 'Options de jeu');

      const difficulty = document.createElement('label');
      difficulty.className = 'option';
      difficulty.textContent = 'Difficulté ';
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
          help.textContent = '← → ou A / D : déplacer · Espace ou clic : lancer · P : pause';

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
let paddle = { x: W / 2, w: 120 };
let ball = { x: W / 2, y: H - 70, vx: 190, vy: -250, r: 8, stuck: true };
let bricks = [];
let keys = new Set();
let last = 0;
let particles = [];
let ghosts = [];
let ripples = [];
let powerups = [];
let banner = '';
let bannerTimer = 0;
let effects = { wide: 0 };
let audioContext;

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
  lives = 3;
  paddle.x = W / 2;
  paddle.w = 120;
  effects.wide = 0;
  const s = ballSpeed();
  ball = { x: W / 2, y: H - 70, vx: s.vx, vy: s.vy, r: 8, stuck: true };
  bricks = [];
  particles = [];
  ghosts = [];
  ripples = [];
  powerups = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 10; c++) {
      bricks.push({ x: 70 + c * 77, y: 70 + r * 30, w: 68, h: 22, color: r });
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

function update(dt) {
  bannerTimer = Math.max(0, bannerTimer - dt);
  effects.wide = Math.max(0, effects.wide - dt);
  const targetW = effects.wide > 0 ? 170 : 120;
  paddle.w += (targetW - paddle.w) * Math.min(1, dt * 10);

  if (state !== 'playing') return;

  const dir = (keys.has('arrowleft') || keys.has('a') ? -1 : 0) + (keys.has('arrowright') || keys.has('d') ? 1 : 0);
  paddle.x = Math.max(paddle.w / 2, Math.min(W - paddle.w / 2, paddle.x + dir * 470 * dt));

  if (ball.stuck) {
    ball.x = paddle.x;
    return;
  }

  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  if (ball.x < ball.r || ball.x > W - ball.r) {
    ball.vx *= -1;
    tone(220, 0.05);
  }
  if (ball.y < ball.r) {
    ball.vy = Math.abs(ball.vy);
    tone(220, 0.05);
  }
  if (ball.y > H - 48 && ball.y < H - 25 && ball.x > paddle.x - paddle.w / 2 && ball.x < paddle.x + paddle.w / 2) {
    ball.vy = -Math.abs(ball.vy);
    ball.vx += (ball.x - paddle.x) * 2.8;
    ripples.push({ x: ball.x, life: 0.35 });
    tone(330, 0.06);
  }

  for (let i = bricks.length - 1; i >= 0; i--) {
    const b = bricks[i];
    if (ball.x + ball.r > b.x && ball.x - ball.r < b.x + b.w && ball.y + ball.r > b.y && ball.y - ball.r < b.y + b.h) {
      const color = ['#ff6d9c', '#ffbd69', '#ffe36e', '#69ffe1', '#72bdff'][b.color];
      ghosts.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, w: b.w, h: b.h, color, life: 0.3 });
      for (let k = 0; k < 13; k++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 40 + Math.random() * 170;
        particles.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.35 + Math.random() * 0.35, color, s: 2 + Math.random() * 3 });
      }
      if (powerupsInput.checked && Math.random() < 0.18) {
        powerups.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, type: ['wide', 'slow', 'life'][Math.floor(Math.random() * 3)], vy: 110, phase: Math.random() * 6 });
      }
      bricks.splice(i, 1);
      ball.vy *= -1;
      score += 10;
      tone(420 + b.color * 90, 0.08, 'triangle', 0.02);
      break;
    }
  }

  if (ball.y > H) {
    lives--;
    $('#lives').textContent = String(lives);
    tone(110, 0.25, 'sawtooth', 0.045);
    if (lives <= 0) {
      state = 'over';
      $('#status').textContent = 'Terminé';
    } else {
      const s = ballSpeed();
      ball = { x: paddle.x, y: H - 70, vx: s.vx, vy: s.vy, r: 8, stuck: true };
      state = 'ready';
      $('#status').textContent = 'Lancer';
    }
  }

  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    p.y += p.vy * dt;
    p.phase += dt * 5;
    if (p.y > H + 20) {
      powerups.splice(i, 1);
      continue;
    }
    if (p.y > H - 46 && p.y < H - 20 && Math.abs(p.x - paddle.x) < paddle.w / 2 + 16) {
      if (p.type === 'wide') {
        effects.wide = 8;
        banner = 'PADDLE XL !';
        tone(520, 0.15, 'sine');
      } else if (p.type === 'slow') {
        ball.vx *= 0.8;
        ball.vy = Math.sign(ball.vy) * Math.max(150, Math.abs(ball.vy) * 0.75);
        banner = 'RALENTI !';
        tone(300, 0.15, 'sine');
      } else {
        lives++;
        $('#lives').textContent = String(lives);
        banner = '+1 VIE !';
        tone(880, 0.15, 'triangle');
      }
      bannerTimer = 1.3;
      for (let k = 0; k < 10; k++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 30 + Math.random() * 120;
        particles.push({ x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.3, color: '#b8ff68', s: 2 });
      }
      powerups.splice(i, 1);
    }
  }

  if (!bricks.length) {
    state = 'won';
    $('#status').textContent = 'Gagné';
  }
  $('#score').textContent = String(score);
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0c211d');
  g.addColorStop(1, '#06100f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  bricks.forEach((b) => {
    ctx.fillStyle = ['#ff6d9c', '#ffbd69', '#ffe36e', '#69ffe1', '#72bdff'][b.color];
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 9;
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 5);
    ctx.fill();
  });
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#69ffe1';
  ctx.shadowColor = '#69ffe1';
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.roundRect(paddle.x - paddle.w / 2, H - 42, paddle.w, 13, 7);
  ctx.fill();
  ctx.shadowBlur = 0;

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
    ctx.globalAlpha = Math.min(1, p.life * 2.2);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.s, p.s);
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#ffe36e';
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fill();

  for (const p of powerups) {
    const icon = p.type === 'wide' ? '↔' : p.type === 'slow' ? '⏱' : '♥';
    const color = p.type === 'wide' ? '#69ffe1' : p.type === 'slow' ? '#72bdff' : '#ff6d9c';
    ctx.save();
    ctx.translate(p.x, p.y + Math.sin(p.phase) * 4);
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

  if (state === 'ready' || state === 'paused' || state === 'over' || state === 'won') {
    ctx.fillStyle = '#04100ddc';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#69ffe1';
    ctx.font = '900 36px system-ui';
    const title = state === 'ready' ? 'NEON BREAKER' : state === 'paused' ? 'PAUSE' : state === 'won' ? 'NIVEAU TERMINÉ' : 'PARTIE TERMINÉE';
    ctx.fillText(title, W / 2, H / 2);
    ctx.fillStyle = '#edfffa';
    ctx.font = '16px system-ui';
    const hint = state === 'ready' ? 'Espace ou clic pour lancer' : state === 'paused' ? 'Clique sur Pause pour reprendre' : 'Recommencer pour rejouer';
    ctx.fillText(hint, W / 2, H / 2 + 35);
  }
}

function frame(t) {
  const dt = Math.min((t - last) / 1000 || 0, 0.025);
  last = t;
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 170 * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = ghosts.length - 1; i >= 0; i--) if ((ghosts[i].life -= dt) <= 0) ghosts.splice(i, 1);
  for (let i = ripples.length - 1; i >= 0; i--) if ((ripples[i].life -= dt) <= 0) ripples.splice(i, 1);
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
