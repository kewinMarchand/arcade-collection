import { mountGameFrame } from '../../packages/ui/src/gameFrame.js';
import { createAudio } from '../../packages/shared/src/audio.js';
import { intercepted, crossesShield } from './game-logic.js';

const shell = mountGameFrame({
  mount: document.getElementById('shell-mount'),
  config: {
    title: 'Neon Defender',
    subtitle: 'Pilote le vaisseau, oriente le bouclier, protège le noyau.',
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

      const bonus = document.createElement('label');
      bonus.className = 'option';
      const bonusInput = document.createElement('input');
      bonusInput.id = 'bonus';
      bonusInput.className = 'toggle';
      bonusInput.type = 'checkbox';
      bonusInput.checked = true;
      bonus.append(' Bonus ', bonusInput);

      const sound = document.createElement('label');
      sound.className = 'option';
      const soundInput = document.createElement('input');
      soundInput.id = 'sound';
      soundInput.className = 'toggle';
      soundInput.type = 'checkbox';
      sound.append(' Sons ', soundInput);

      options.append(difficulty, bonus, sound);
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
          stats.append(
            stat('SCORE', 'score', '0'),
            stat('RECORD', 'best', '0'),
            stat('VIES', 'lives', '3'),
            stat('ÉTAT', 'status', 'Prêt')
          );
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
          const b = (id, text, cls) => {
            const btn = document.createElement('button');
            btn.id = id;
            btn.type = 'button';
            btn.textContent = text;
            if (cls) btn.className = cls;
            return btn;
          };
          actions.append(b('pause', 'Pause'), b('restart', 'Recommencer'), b('new-game', 'Nouvelle partie', 'primary'));
          const help = document.createElement('p');
          help.className = 'help';
          help.textContent = '← → ou A / D : tourner le bouclier • Souris : viser • Espace : démarrer • P : pause';
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
const scoreEl = $('#score');
const bestEl = $('#best');
const livesEl = $('#lives');
const statusEl = $('#status');
const difficultyInput = $('#difficulty');
const bonusInput = $('#bonus');
const soundInput = $('#sound');
const audio = createAudio(() => soundInput && soundInput.checked);

const W = 800;
const H = 520;
const cx = W / 2;
const cy = H / 2;
const SHIELD_RADIUS = 108;
const CORE_RADIUS = 44;
const PHOTON_RADIUS = 8;
const SHIELD_HALF_ARC = 0.95;

const DIFF = {
  chill: { spawnBase: 1.05, spawnMin: 0.5, speedBase: 78, speedGain: 1.4 },
  arcade: { spawnBase: 0.85, spawnMin: 0.36, speedBase: 95, speedGain: 2.1 },
  chaos: { spawnBase: 0.62, spawnMin: 0.26, speedBase: 120, speedGain: 3.0 },
};

let state = 'ready';
let angle = -Math.PI / 2;
let shots = [];
let score = 0;
let bonus = 0;
let lives = 3;
let best = Number(localStorage.getItem('pulseDefenderBest')) || 0;
let last = 0;
let elapsed = 0;
let spawn = 0.8;
let sparks = [];
let flashes = [];
let popups = [];
let stars = [];
let shockwaves = [];
let shipHit = 0;
let shipScale = 1;
let thrust = 0;

bestEl.textContent = String(best);

function makeStars() {
  stars = Array.from({ length: 160 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    z: 0.2 + Math.random() * 1,
    r: Math.random() < 0.18 ? 2.4 : Math.random() < 0.4 ? 1.6 : 1,
    tw: Math.random() * Math.PI * 2,
  }));
}

function blockEffect(a) {
  flashes.push({ a, life: 0.42 });
  const x = cx + Math.cos(a) * SHIELD_RADIUS;
  const y = cy + Math.sin(a) * SHIELD_RADIUS;
  for (let k = 0; k < 16; k++) {
    const ang = a + Math.PI + (Math.random() - 0.5) * 2.2;
    const sp = 60 + Math.random() * 180;
    sparks.push({
      x,
      y,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp,
      life: 0.3 + Math.random() * 0.35,
      color: Math.random() < 0.5 ? '#baffeb' : '#69ffe1',
      s: 2 + Math.random() * 2.5,
    });
  }
  popups.push({ a, life: 0.9, text: bonusInput.checked ? '+25' : '+10' });
  shockwaves.push({ r: SHIELD_RADIUS - 6, life: 0.35, a });
  audio.tone(520 + Math.random() * 120, 0.06, 'triangle', 0.03);
}

function hitEffect() {
  shipHit = 0.45;
  shipScale = 0.82;
  for (let k = 0; k < 26; k++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = 40 + Math.random() * 220;
    sparks.push({
      x: cx,
      y: cy,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp,
      life: 0.35 + Math.random() * 0.5,
      color: Math.random() < 0.5 ? '#ff648f' : '#ffd36b',
      s: 2 + Math.random() * 3,
    });
  }
  shockwaves.push({ r: CORE_RADIUS, life: 0.5, a: 0, full: true });
  audio.seq([[180, 0.12, 'sawtooth', 0.05, 0], [120, 0.18, 'square', 0.04, 0.05]]);
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
  sparks = [];
  flashes = [];
  popups = [];
  shockwaves = [];
  shipHit = 0;
  shipScale = 1;
  scoreEl.textContent = '0';
  livesEl.textContent = String(lives);
  statusEl.textContent = 'Défense';
  audio.tone(660, 0.12, 'triangle', 0.03);
}

function pause() {
  if (state === 'playing') {
    state = 'paused';
    statusEl.textContent = 'Pause';
  } else if (state === 'paused') {
    state = 'playing';
    last = performance.now();
    statusEl.textContent = 'Défense';
  } else if (state === 'ready') {
    start();
  }
}

function update(dt) {
  // stars: impression d'avancer dans l'espace
  const speedMul = state === 'playing' ? 1.2 : 0.4;
  for (const s of stars) {
    s.y += (30 + 90 * s.z) * dt * speedMul;
    s.x += Math.sin(elapsed * 0.4 + s.tw) * 6 * dt * s.z;
    if (s.y > H + 4) {
      s.y = -4;
      s.x = Math.random() * W;
      s.z = 0.2 + Math.random() * 1;
    }
    if (s.x < -4) s.x = W + 4;
    if (s.x > W + 4) s.x = -4;
  }

  thrust = state === 'playing' ? Math.min(1, thrust + dt * 2) : Math.max(0, thrust - dt * 2);
  shipHit = Math.max(0, shipHit - dt);
  shipScale += (1 - shipScale) * Math.min(1, dt * 10);

  for (const s of sparks) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vx *= 0.97;
    s.vy *= 0.97;
    s.life -= dt;
  }
  for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].life <= 0) sparks.splice(i, 1);
  for (let i = flashes.length - 1; i >= 0; i--) if ((flashes[i].life -= dt) <= 0) flashes.splice(i, 1);
  for (let i = popups.length - 1; i >= 0; i--) if ((popups[i].life -= dt) <= 0) popups.splice(i, 1);
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    shockwaves[i].r += 120 * dt;
    if ((shockwaves[i].life -= dt) <= 0) shockwaves.splice(i, 1);
  }

  if (state !== 'playing') return;

  elapsed += dt;
  spawn -= dt;

  const d = DIFF[difficultyInput.value] || DIFF.arcade;
  if (spawn <= 0) {
    const edge = Math.random() * Math.PI * 2;
    shots.push({
      a: edge,
      r: 270,
      speed: d.speedBase + Math.min(140, elapsed * d.speedGain),
    });
    spawn = Math.max(d.spawnMin, d.spawnBase - elapsed * 0.006);
  }

  for (let i = shots.length - 1; i >= 0; i--) {
    const p = shots[i];
    const previous = p.r;
    p.r -= p.speed * dt;

    const crossed = crossesShield(previous, p.r, SHIELD_RADIUS, PHOTON_RADIUS);
    if (crossed && intercepted(p.a, angle, SHIELD_HALF_ARC)) {
      bonus += bonusInput.checked ? 25 : 10;
      blockEffect(p.a);
      shots.splice(i, 1);
      continue;
    }

    if (crossed && !intercepted(p.a, angle, SHIELD_HALF_ARC)) {
      lives--;
      livesEl.textContent = String(lives);
      hitEffect();
      shots.splice(i, 1);
      if (lives <= 0) {
        state = 'over';
        statusEl.textContent = 'Vaisseau détruit';
      }
      continue;
    }

    if (p.r <= CORE_RADIUS + PHOTON_RADIUS) {
      lives--;
      livesEl.textContent = String(lives);
      hitEffect();
      shots.splice(i, 1);
      if (lives <= 0) {
        state = 'over';
        statusEl.textContent = 'Vaisseau détruit';
      }
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

function drawShip(t) {
  const pulse = 1 + 0.03 * Math.sin(t * 0.006);
  const s = shipScale * pulse;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  if (shipHit > 0) ctx.globalAlpha = 0.85 + 0.15 * Math.sin(t * 0.05);

  // Engine flame / propulsion (impression d'avancer)
  const flame = (10 + Math.random() * 10) * (0.5 + thrust);
  const exhaust = ctx.createLinearGradient(0, 10, 0, 28 + flame);
  exhaust.addColorStop(0, '#fff3a0');
  exhaust.addColorStop(0.35, '#73ffe2cc');
  exhaust.addColorStop(1, '#00b99800');
  ctx.fillStyle = exhaust;
  ctx.shadowColor = '#69ffe1';
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.moveTo(-10, 12);
  ctx.lineTo(-6, 26 + flame);
  ctx.lineTo(0, 14);
  ctx.lineTo(6, 26 + flame);
  ctx.lineTo(10, 12);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // Hull (style invaders/drift)
  const body = ctx.createLinearGradient(0, -24, 0, 18);
  body.addColorStop(0, '#ffffff');
  body.addColorStop(0.32, '#caffed');
  body.addColorStop(0.72, '#48e2c3');
  body.addColorStop(1, '#137d6d');
  ctx.fillStyle = body;
  ctx.shadowColor = '#61ffe0';
  ctx.shadowBlur = 22;
  ctx.beginPath();
  ctx.roundRect(-22, -20, 44, 38, 16);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Wings
  ctx.fillStyle = '#1fa88f';
  ctx.beginPath();
  ctx.moveTo(-22, -2);
  ctx.lineTo(-34, 10);
  ctx.lineTo(-22, 12);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(22, -2);
  ctx.lineTo(34, 10);
  ctx.lineTo(22, 12);
  ctx.closePath();
  ctx.fill();

  // Cockpit
  ctx.fillStyle = '#237d73';
  ctx.beginPath();
  ctx.ellipse(0, -4, 9, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c2fff1';
  ctx.beginPath();
  ctx.ellipse(0, -7, 5, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Lights
  ctx.fillStyle = '#faffc4';
  ctx.shadowColor = '#ffdc72';
  ctx.shadowBlur = 8;
  ctx.fillRect(-17, 4, 4, 6);
  ctx.fillRect(13, 4, 4, 6);
  ctx.shadowBlur = 0;

  // Outline
  ctx.strokeStyle = '#ffffffa8';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.roundRect(-20, -18, 40, 34, 14);
  ctx.stroke();

  ctx.restore();
}

function draw(t) {
  ctx.clearRect(0, 0, W, H);

  // Space background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#061327');
  bg.addColorStop(0.55, '#071420');
  bg.addColorStop(1, '#040b14');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Nebula / depth
  const neb = (x, y, r, color) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  neb(W * 0.2, H * 0.25, 220, '#00e0a512');
  neb(W * 0.78, H * 0.7, 260, '#2468b920');

  // Starfield (motion = impression d'avancer)
  for (const s of stars) {
    const a = 0.3 + 0.55 * s.z + 0.25 * Math.sin(t * 0.003 + s.tw);
    ctx.globalAlpha = Math.min(1, a);
    ctx.fillStyle = s.z > 0.7 ? '#ffffff' : '#bff6ff';
    ctx.shadowColor = '#7af7e0';
    ctx.shadowBlur = s.r >= 2 ? 7 : 0;
    ctx.fillRect(s.x, s.y, s.r, s.r);
    if (s.z > 0.75) {
      ctx.shadowBlur = 0;
      ctx.globalAlpha = a * 0.35;
      ctx.fillRect(s.x, s.y - 7 * s.z, 1, 10 * s.z);
    }
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  // Orbit rings
  for (const r of [76, SHIELD_RADIUS, 260]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = r === SHIELD_RADIUS ? '#69ffe144' : '#69ffe122';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Shockwaves
  for (const w of shockwaves) {
    ctx.globalAlpha = Math.max(0, w.life / 0.5);
    ctx.strokeStyle = w.full ? '#ff648f' : '#69ffe1';
    ctx.lineWidth = w.full ? 3 : 2;
    if (w.full) {
      ctx.beginPath();
      ctx.arc(cx, cy, w.r, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, w.r, w.a - 0.5, w.a + 0.5);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  // Photons
  for (const p of shots) {
    const px = cx + Math.cos(p.a) * p.r;
    const py = cy + Math.sin(p.a) * p.r;
    const tx = cx + Math.cos(p.a) * (p.r + 22);
    const ty = cy + Math.sin(p.a) * (p.r + 22);
    const pulse = 1 + 0.12 * Math.sin(t * 0.012 + p.r * 0.05);

    // trailing energy tail (outward, opposite motion)
    const tail = ctx.createLinearGradient(px, py, tx, ty);
    tail.addColorStop(0, 'rgba(255,211,107,0.85)');
    tail.addColorStop(1, 'rgba(255,211,107,0)');
    ctx.strokeStyle = tail;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(tx, ty);
    ctx.stroke();

    // outer halo
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(p.a + t * 0.003);
    ctx.strokeStyle = 'rgba(255,243,196,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, (PHOTON_RADIUS + 6) * pulse, 0, Math.PI * 2);
    ctx.stroke();

    // flare cross
    ctx.shadowColor = '#ffd36b';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = 'rgba(255,249,220,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-PHOTON_RADIUS - 5, 0);
    ctx.lineTo(PHOTON_RADIUS + 5, 0);
    ctx.moveTo(0, -PHOTON_RADIUS - 5);
    ctx.lineTo(0, PHOTON_RADIUS + 5);
    ctx.stroke();

    // core
    const core = ctx.createRadialGradient(-2, -2, 1, 0, 0, PHOTON_RADIUS * pulse);
    core.addColorStop(0, '#fffbe8');
    core.addColorStop(0.45, '#ffe58a');
    core.addColorStop(1, '#ffbf3b');
    ctx.fillStyle = core;
    ctx.shadowColor = '#ffd36b';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(0, 0, PHOTON_RADIUS * pulse, 0, Math.PI * 2);
    ctx.fill();

    // inner highlight
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(-2.5, -2.5, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Ship at center
  drawShip(t);

  // Shield
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
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#eaffff88';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, SHIELD_RADIUS, -SHIELD_HALF_ARC * 0.85, SHIELD_HALF_ARC * 0.85);
  ctx.stroke();
  ctx.restore();

  // Shield flashes
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
    ctx.restore();
  }

  // Sparks
  for (const s of sparks) {
    ctx.globalAlpha = Math.min(1, s.life * 2.4);
    ctx.fillStyle = s.color;
    ctx.fillRect(s.x, s.y, s.s, s.s);
  }
  ctx.globalAlpha = 1;

  // Popups
  for (const p of popups) {
    const d = SHIELD_RADIUS + 30 + (0.9 - p.life) * 55;
    ctx.globalAlpha = Math.min(1, p.life * 1.6);
    ctx.fillStyle = '#d9ff76';
    ctx.shadowColor = '#d9ff76';
    ctx.shadowBlur = 12;
    ctx.font = '800 15px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(p.text, cx + Math.cos(p.a) * d, cy + Math.sin(p.a) * d);
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  if (state !== 'playing') {
    ctx.fillStyle = '#04100ddc';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#69ffe1';
    ctx.font = '800 32px system-ui';
    ctx.textAlign = 'center';
    const title = state === 'ready' ? 'Neon Defender' : state === 'paused' ? 'PAUSE' : 'VAISSEAU DÉTRUIT';
    ctx.fillText(title, cx, cy);
    ctx.fillStyle = '#edfffa';
    ctx.font = '16px system-ui';
    const hint = state === 'ready' ? 'Espace ou Nouvelle partie pour décoller' : state === 'paused' ? 'Clique sur Pause pour reprendre' : 'Recommencer pour retenter';
    ctx.fillText(hint, cx, cy + 34);
  }
}

function frame(t) {
  const dt = Math.min((t - last) / 1000 || 0, 0.04);
  last = t;
  update(dt);
  draw(t);
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
  if (state === 'over' || state === 'ready') start();
});

$('#pause').onclick = pause;
$('#restart').onclick = start;
$('#new-game').onclick = start;

makeStars();
last = performance.now();
requestAnimationFrame(frame);
