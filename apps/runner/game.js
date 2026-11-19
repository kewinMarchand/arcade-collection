import { mountGameFrame } from '../../packages/ui/src/gameFrame.js';
import { createAudio } from '../../packages/shared/src/audio.js';
import { obstacleHits } from './game-logic.js';

const shell = mountGameFrame({
  mount: document.getElementById('shell-mount'),
  config: {
    title: 'Neon Runner',
    subtitle: 'Saute, glisse et tiens le rythme.',
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
          stats.append(stat('SCORE', 'score', '0'), stat('RECORD', 'best', '0'), stat('ÉTAT', 'status', 'Prêt'));
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
          help.textContent = 'Espace / ↑ : sauter • ↓ : glisser • P : pause';
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
        canvas.setAttribute('aria-label', 'Parcours Neon Runner');
        el.appendChild(canvas);
      },
    },
  },
});

const canvas = shell.screen.querySelector('canvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.querySelector('#score');
const bestEl = document.querySelector('#best');
const statusEl = document.querySelector('#status');
const difficultyInput = document.querySelector('#difficulty');
const bonusInput = document.querySelector('#bonus');
const soundInput = document.querySelector('#sound');
const audio = createAudio(() => soundInput && soundInput.checked);

const W = 800, H = 520, ground = 420;
const DIFF = {
  chill: { baseSpeed: 240, gain: 3, spawn: 1.25, spawnMin: 0.75 },
  arcade: { baseSpeed: 280, gain: 4, spawn: 1.1, spawnMin: 0.6 },
  chaos: { baseSpeed: 340, gain: 6, spawn: 0.9, spawnMin: 0.45 },
};

let state = 'ready';
let player = { y: ground - 48, vy: 0, slide: 0, angle: 0, squash: 1, jumps: 0, airborne: false };
let obstacles = [];
let orbs = [];
let score = 0;
let best = Number(localStorage.getItem('prismRunnerBest')) || 0;
let last = 0;
let elapsed = 0;
let spawn = 1.2;
let orbSpawn = 2.2;
let shake = 0;
let flash = 0;
let particles = [];
let trail = [];
let scroll = 0;
let crouchHeld = false;
let pulses = [];
let level = 1;
bestEl.textContent = String(best);

function start() {
  const d = DIFF[difficultyInput.value] || DIFF.arcade;
  state = 'playing';
  player = { y: ground - 48, vy: 0, slide: 0, angle: 0, squash: 1, jumps: 0, airborne: false };
  obstacles = []; orbs = []; score = 0; elapsed = 0; spawn = d.spawn * 0.7; orbSpawn = 1.8; shake = 0; flash = 0; particles = []; trail = []; pulses = []; level = 1;
  statusEl.textContent = 'En course';
  audio.tone(520, 0.08, 'triangle', 0.03);
}

function pause() {
  if (state === 'playing') { state = 'paused'; statusEl.textContent = 'Pause'; }
  else if (state === 'paused') { state = 'playing'; last = performance.now(); statusEl.textContent = 'En course'; }
  else if (state === 'ready') start();
}

function burst(x, y, color, n, power = 1) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (45 + Math.random() * 190) * power;
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.28 + Math.random() * 0.45, max: 0.73, color, s: 1.5 + Math.random() * 3.2, spin: Math.random() * 8, square: Math.random() < 0.45 });
  }
}
function ring(x, y, color, r0 = 6, life = 0.35) { pulses.push({ x, y, r: r0, life, max: life, color, w: 2.5 }); }

function jump() {
  if (state === 'ready' || state === 'over') { start(); return; }
  if (state !== 'playing') return;
  if (player.y >= ground - 48) {
    player.vy = -640;
    player.squash = 1.18;
    player.jumps = 1;
    player.airborne = true;
    burst(140, ground - 4, '#7bffe5', 10, 0.8);
    ring(140, ground - 6, '#7bffe5', 8, 0.28);
    audio.tone(520, 0.06, 'square', 0.025);
  } else if (player.jumps < 2) {
    player.vy = -560;
    player.squash = 1.12;
    player.jumps = 2;
    burst(140, player.y + 24, '#ffd36b', 12, 0.9);
    ring(140, player.y + 24, '#ffd36b', 10, 0.3);
    audio.tone(760, 0.07, 'sine', 0.03);
  }
}

function speedNow() {
  const d = DIFF[difficultyInput.value] || DIFF.arcade;
  return d.baseSpeed + Math.min(260, elapsed * d.gain) + (level - 1) * 22;
}

function update(dt) {
  shake = Math.max(0, shake - dt * 2.6);
  flash = Math.max(0, flash - dt * 2.4);
  player.squash += (1 - player.squash) * Math.min(1, dt * 10);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 240 * dt; p.vx *= 0.985; p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = pulses.length - 1; i >= 0; i--) {
    pulses[i].r += 120 * dt;
    if ((pulses[i].life -= dt) <= 0) pulses.splice(i, 1);
  }
  if (state !== 'playing') return;

  const d = DIFF[difficultyInput.value] || DIFF.arcade;
  const sp = speedNow();
  elapsed += dt;
  score = Math.floor(elapsed * 10);
  const newLevel = Math.floor(score / 500) + 1;
  if (newLevel > level) {
    level = newLevel;
    shake = Math.max(shake, 0.7);
    flash = Math.max(flash, 0.18);
    ring(W / 2, H / 2, '#7bffe5', 12, 0.6);
    burst(W / 2, H / 2, '#7bffe5', 18, 1.1);
    audio.tone(520 + level * 40, 0.16, 'triangle', 0.03);
  }

  scroll += dt * sp;
  const wasAirborne = player.y < ground - 48;
  player.vy += 1500 * dt;
  player.y += player.vy * dt;

  if (player.y > ground - 48 && player.vy > 0) {
    const impactVy = player.vy;
    player.y = ground - 48;
    player.vy = 0;
    player.angle = 0;
    player.jumps = 0;
    if (player.airborne || wasAirborne || impactVy > 80) {
      // Landing impact animation (every landing)
      const hard = impactVy > 320;
      player.squash = hard ? 0.82 : 0.9;
      burst(140, ground - 2, hard ? '#8b8bff' : '#7bffe5', hard ? 12 : 7, hard ? 1 : 0.65);
      ring(140, ground - 4, hard ? '#8b8bff' : '#7bffe5', hard ? 9 : 6, hard ? 0.32 : 0.22);
      audio.tone(hard ? 220 : 300, 0.035, 'triangle', hard ? 0.02 : 0.012);
      if (hard) shake = Math.max(shake, 0.12);
      player.airborne = false;
    }
  }

  if (player.y < ground - 48) { player.angle += dt * 7; player.airborne = true; }
  player.slide = crouchHeld ? 0.5 : Math.max(0, player.slide - dt);

  spawn -= dt;
  if (spawn <= 0) {
    const r = Math.random();
    const type = r < 0.34 ? 'high' : r < 0.67 ? 'low' : 'wall';
    const dims = type === 'high' ? { y: ground - 96, w: 36, h: 54 } : type === 'wall' ? { y: ground - 92, w: 26, h: 54 } : { y: ground - 36, w: 50, h: 36 };
    obstacles.push({ x: W + 40, y: dims.y, w: dims.w, h: dims.h, type, seed: Math.random() * Math.PI * 2 });
    spawn = Math.max(d.spawnMin, d.spawn - elapsed * 0.004) + Math.random() * 0.35;
  }

  if (bonusInput.checked) {
    orbSpawn -= dt;
    if (orbSpawn <= 0) {
      orbs.push({ x: W + 40, y: ground - (Math.random() < 0.5 ? 120 : 70), r: 12, phase: Math.random() * Math.PI * 2 });
      orbSpawn = 2.2 + Math.random() * 1.8;
    }
  } else {
    orbs = [];
  }

  for (const o of obstacles) o.x -= sp * dt;
  for (const o of orbs) o.x -= sp * dt;
  obstacles = obstacles.filter((o) => o.x > -80);
  orbs = orbs.filter((o) => o.x > -40);

  const box = { x: 118, y: player.y + (player.slide ? 20 : 0), w: player.slide ? 62 : 42, h: player.slide ? 27 : 48 };
  if (obstacles.some((o) => obstacleHits(box, o))) {
    burst(140, player.y + 24, '#ff6dbe', 28, 1.2);
    ring(140, player.y + 24, '#ff6dbe', 12, 0.45);
    ring(140, player.y + 24, '#ffffff', 6, 0.25);
    shake = 1.1; flash = 0.4; player.squash = 0.7;
    state = 'over'; statusEl.textContent = 'Terminé';
    audio.seq([[200, 0.12, 'sawtooth', 0.05, 0], [140, 0.2, 'sawtooth', 0.04, 0.06]]);
  }

  for (let i = orbs.length - 1; i >= 0; i--) {
    const o = orbs[i];
    const dx = (box.x + box.w / 2) - o.x, dy = (box.y + box.h / 2) - o.y;
    if (Math.hypot(dx, dy) < o.r + 22) {
      orbs.splice(i, 1);
      score += 40;
      player.squash = 1.1;
      burst(o.x, o.y, '#ffd36b', 14, 1);
      ring(o.x, o.y, '#ffd36b', 10, 0.35);
      ring(o.x, o.y, '#ffffff', 4, 0.2);
      flash = Math.max(flash, 0.08);
      audio.tone(760, 0.07, 'sine', 0.03);
    }
  }

  scoreEl.textContent = String(score);
  if (score > best) { best = score; bestEl.textContent = String(best); localStorage.setItem('prismRunnerBest', String(best)); }
}

function drawMountain(offset, baseY, height, color, alpha) {
  ctx.fillStyle = color; ctx.globalAlpha = alpha; ctx.beginPath(); ctx.moveTo(-50, H);
  const seg = 160; const phase = -((scroll * offset) % seg);
  for (let x = phase - seg; x < W + seg; x += seg) {
    ctx.lineTo(x + seg / 2, baseY - height * (0.6 + 0.5 * Math.abs(Math.sin(x * 0.013 + offset * 7))));
    ctx.lineTo(x + seg, baseY);
  }
  ctx.lineTo(W + 50, H); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
}

function drawRunner(x, y, slide, squash, angle, t) {
  ctx.save();
  const sx = 1 / Math.sqrt(squash), sy = squash;
  ctx.translate(x, y);
  ctx.scale(sx, sy);
  const time = (t || 0) * 0.001;
  const bob = slide ? 0 : Math.sin(time * 12) * 1.5;

  if (slide) {
    // detailed slide module / hover board form
    ctx.translate(0, 10);
    ctx.shadowColor = '#7bffe5'; ctx.shadowBlur = 16;
    const body = ctx.createLinearGradient(-30, -10, 30, 12);
    body.addColorStop(0, '#dffff8'); body.addColorStop(0.35, '#62ffe0'); body.addColorStop(1, '#164c63');
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.roundRect(-30, -10, 60, 20, 8); ctx.fill();
    ctx.shadowBlur = 0; ctx.strokeStyle = '#ffffff55'; ctx.lineWidth = 1.2; ctx.stroke();
    // cockpit
    ctx.fillStyle = '#12343a'; ctx.beginPath(); ctx.ellipse(8, -2, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#bffdf0aa'; ctx.beginPath(); ctx.ellipse(10, -4, 4, 2.2, -0.4, 0, Math.PI * 2); ctx.fill();
    // thrusters / fins
    ctx.fillStyle = '#8b8bff'; ctx.fillRect(-34, -4, 6, 8); ctx.fillRect(26, -2, 8, 5);
    const ex = ctx.createLinearGradient(-30, 0, -44 - Math.sin(time * 30) * 4, 0);
    ex.addColorStop(0, '#7bffe5cc'); ex.addColorStop(1, '#7bffe500');
    ctx.fillStyle = ex; ctx.beginPath(); ctx.moveTo(-30, -3); ctx.lineTo(-42 - Math.sin(time * 30) * 4, 0); ctx.lineTo(-30, 3); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ffffff33'; ctx.beginPath(); ctx.moveTo(-10, -8); ctx.lineTo(-10, 8); ctx.moveTo(12, -8); ctx.lineTo(12, 8); ctx.stroke();
  } else {
    ctx.translate(0, bob);
    if (player.y < ground - 48) ctx.rotate(angle * 0.35);
    // mech runner module
    ctx.shadowColor = '#8b8bff'; ctx.shadowBlur = 18;
    const torso = ctx.createLinearGradient(-18, -20, 18, 22);
    torso.addColorStop(0, '#eafffb'); torso.addColorStop(0.3, '#62ffe0'); torso.addColorStop(0.65, '#8b8bff'); torso.addColorStop(1, '#2b1b5a');
    ctx.fillStyle = torso;
    ctx.beginPath();
    ctx.moveTo(16, -6); ctx.lineTo(8, -20); ctx.lineTo(-10, -18); ctx.lineTo(-18, -4);
    ctx.lineTo(-14, 14); ctx.lineTo(-4, 22); ctx.lineTo(10, 18); ctx.lineTo(18, 4); ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0; ctx.strokeStyle = '#ffffff55'; ctx.lineWidth = 1.4; ctx.stroke();
    // head/cockpit
    ctx.fillStyle = '#10263a'; ctx.beginPath(); ctx.roundRect(-2, -24, 16, 12, 5); ctx.fill();
    ctx.fillStyle = '#bffdf0'; ctx.globalAlpha = 0.85; ctx.fillRect(2, -21, 9, 4); ctx.globalAlpha = 1;
    // core
    ctx.fillStyle = '#ffd36b'; ctx.shadowColor = '#ffd36b'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    // limbs / thruster hints
    ctx.strokeStyle = '#dffcff'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    const leg = Math.sin(time * 14) * 4;
    ctx.beginPath(); ctx.moveTo(-4, 16); ctx.lineTo(-8 - leg, 28); ctx.moveTo(6, 15); ctx.lineTo(10 + leg, 28); ctx.stroke();
    ctx.strokeStyle = '#ff9fda'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-12, -2); ctx.lineTo(-20, 6); ctx.moveTo(12, -4); ctx.lineTo(20, 2); ctx.stroke();
    ctx.strokeStyle = '#ffffff33'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-8, -12); ctx.lineTo(-8, 10); ctx.moveTo(6, -14); ctx.lineTo(6, 10); ctx.stroke();
    // rear thruster
    const ex = ctx.createLinearGradient(-16, 4, -30 - Math.sin(time * 28) * 4, 4);
    ex.addColorStop(0, '#8b8bffcc'); ex.addColorStop(1, '#8b8bff00');
    ctx.fillStyle = ex; ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-28 - Math.sin(time * 28) * 4, 5); ctx.lineTo(-14, 10); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawOrb(o, t) {
  const time = (t || 0) * 0.001;
  const r = o.r * (1 + 0.1 * Math.sin(time * 8 + o.phase));
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.rotate(time * 2 + o.phase);
  ctx.shadowColor = '#ffd36b'; ctx.shadowBlur = 18;
  const core = ctx.createRadialGradient(-r * 0.2, -r * 0.25, r * 0.1, 0, 0, r);
  core.addColorStop(0, '#fffef0'); core.addColorStop(0.4, '#ffd36b'); core.addColorStop(1, '#6a4300');
  ctx.fillStyle = core; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0; ctx.strokeStyle = '#fff3c4'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, r * 1.45, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#ffd36baa'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-r * 1.8, 0); ctx.lineTo(r * 1.8, 0); ctx.moveTo(0, -r * 1.8); ctx.lineTo(0, r * 1.8); ctx.stroke();
  ctx.restore();
}

function drawObstacle(o, t) {
  const time = (t || 0) * 0.001;
  ctx.save();
  ctx.translate(o.x + o.w / 2, o.y + o.h / 2);
  if (o.type === 'low') {
    // spiked mine module
    const color = '#ff8fd1';
    ctx.shadowColor = color; ctx.shadowBlur = 16;
    const body = ctx.createLinearGradient(0, -o.h / 2, 0, o.h / 2);
    body.addColorStop(0, '#ffd7ef'); body.addColorStop(0.45, color); body.addColorStop(1, '#4a1030');
    ctx.fillStyle = body; ctx.strokeStyle = '#ffffff55'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-o.w / 2, o.h / 2);
    ctx.lineTo(-o.w * 0.22, -o.h * 0.1);
    ctx.lineTo(-o.w * 0.08, -o.h / 2);
    ctx.lineTo(o.w * 0.08, -o.h / 2);
    ctx.lineTo(o.w * 0.22, -o.h * 0.1);
    ctx.lineTo(o.w / 2, o.h / 2);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#2b0c1a'; ctx.beginPath(); ctx.arc(0, 0, o.w * 0.14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(0, 0, o.w * 0.05, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ffffff33'; ctx.beginPath(); ctx.moveTo(-o.w * 0.3, o.h * 0.15); ctx.lineTo(o.w * 0.3, o.h * 0.15); ctx.stroke();
  } else if (o.type === 'wall') {
    // energy pylon/gate module
    const color = '#ffd36b';
    ctx.shadowColor = color; ctx.shadowBlur = 16;
    const body = ctx.createLinearGradient(-o.w / 2, 0, o.w / 2, 0);
    body.addColorStop(0, '#6a4a00'); body.addColorStop(0.5, color); body.addColorStop(1, '#6a4a00');
    ctx.fillStyle = body; ctx.strokeStyle = '#ffffff55'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(-o.w / 2, -o.h / 2, o.w, o.h, 5); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff8d8'; ctx.globalAlpha = 0.5 + 0.3 * Math.sin(time * 8 + o.seed);
    ctx.fillRect(-o.w * 0.15, -o.h * 0.35, o.w * 0.3, o.h * 0.7);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#2a1d00'; ctx.lineWidth = 1; for (let yy = -o.h * 0.35; yy <= o.h * 0.35; yy += 8) { ctx.beginPath(); ctx.moveTo(-o.w * 0.35, yy); ctx.lineTo(o.w * 0.35, yy); ctx.stroke(); }
  } else {
    // hovering barrier drone
    const color = '#ff6dbd';
    const hover = Math.sin(time * 6 + o.seed) * 3;
    ctx.translate(0, hover);
    ctx.shadowColor = color; ctx.shadowBlur = 16;
    const body = ctx.createLinearGradient(-o.w / 2, -o.h / 2, o.w / 2, o.h / 2);
    body.addColorStop(0, '#ffd0ea'); body.addColorStop(0.4, color); body.addColorStop(1, '#4d1035');
    ctx.fillStyle = body; ctx.strokeStyle = '#ffffff55'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    const k = 6;
    ctx.moveTo(-o.w / 2, -o.h / 2 + k); ctx.lineTo(-o.w / 2 + k, -o.h / 2); ctx.lineTo(o.w / 2 - k, -o.h / 2); ctx.lineTo(o.w / 2, -o.h / 2 + k);
    ctx.lineTo(o.w / 2, o.h / 2 - k); ctx.lineTo(o.w / 2 - k, o.h / 2); ctx.lineTo(-o.w / 2 + k, o.h / 2); ctx.lineTo(-o.w / 2, o.h / 2 - k);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#180814'; ctx.beginPath(); ctx.ellipse(0, -o.h * 0.08, o.w * 0.16, o.h * 0.12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.8; ctx.fillRect(-o.w * 0.03, -o.h * 0.12, o.w * 0.06, o.h * 0.04); ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ffffff33'; ctx.beginPath(); ctx.moveTo(0, -o.h * 0.4); ctx.lineTo(0, o.h * 0.4); ctx.stroke();
    ctx.fillStyle = '#ff9fda'; ctx.fillRect(-o.w * 0.7, -o.h * 0.08, o.w * 0.18, o.h * 0.16); ctx.fillRect(o.w * 0.52, -o.h * 0.08, o.w * 0.18, o.h * 0.16);
  }
  ctx.restore();
}

function draw(t) {
  ctx.clearRect(0, 0, W, H); ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * 12 * shake, (Math.random() - 0.5) * 8 * shake);
  const skies = [['#20133c','#090b1c'],['#1a2a4a','#0a1220'],['#3a1a2a','#120818'],['#1a3a2a','#081812']];
  const skyPair = skies[level % skies.length];
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, skyPair[0]); sky.addColorStop(1, skyPair[1]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

  const time = (t || 0) * 0.001;
  const nebula = (x, y, r, color) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color); g.addColorStop(1, 'transparent');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  nebula(180 + Math.sin(time * 0.17) * 40, 120, 260, '#7b5cff1a');
  nebula(620, 180 + Math.cos(time * 0.13) * 30, 240, '#00e0a518');

  ctx.save();
  ctx.strokeStyle = '#9bfff008'; ctx.lineWidth = 1;
  for (let x = -((scroll * 0.1) % 60); x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ground); ctx.stroke(); }
  for (let y = 0; y < ground; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.restore();

  for (let i = 0; i < 90; i++) {
    const sx = ((i * 137 + 40 - scroll * (0.03 + (i % 5) * 0.01)) % (W + 20) + W + 20) % (W + 20) - 10;
    const sy = (i * 79 + 18) % 220;
    const r = i % 7 === 0 ? 2.2 : i % 3 === 0 ? 1.6 : 1.1;
    const tw = 0.55 + 0.45 * Math.sin(time * 2 + i * 1.7);
    ctx.globalAlpha = (0.35 + (i % 4) * 0.12) * tw;
    ctx.fillStyle = r > 1.8 ? '#ffffff' : '#d5e0ff';
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  drawMountain(0.25, ground - 40, 150, '#241a4f', 0.9);
  drawMountain(0.55, ground - 8, 90, '#171233', 0.95);

  // ground base
  const groundGrad = ctx.createLinearGradient(0, ground, 0, H);
  groundGrad.addColorStop(0, '#13243e'); groundGrad.addColorStop(1, '#0a1220');
  ctx.fillStyle = groundGrad; ctx.fillRect(0, ground, W, H - ground);
  // ground tech grid/plating
  ctx.strokeStyle = '#2a3f66'; ctx.lineWidth = 1;
  for (let x = -(scroll % 60); x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, ground); ctx.lineTo(x - 40, H); ctx.stroke(); }
  for (let y = ground + 18; y < H; y += 22) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y - 6); ctx.stroke(); }
  ctx.fillStyle = '#1d3557';
  for (let x = -(scroll % 120); x < W; x += 120) { ctx.fillRect(x + 20, ground + 10, 26, 6); ctx.fillRect(x + 70, ground + 28, 18, 5); }
  ctx.strokeStyle = '#7bffe5'; ctx.shadowColor = '#7bffe5'; ctx.shadowBlur = 14; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, ground); ctx.lineTo(W, ground); ctx.stroke();
  ctx.shadowBlur = 0;
  // ground edge lights
  for (let x = -(scroll % 80); x < W; x += 80) { ctx.fillStyle = '#baffef'; ctx.fillRect(x, ground - 3, 18, 2); }

  ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(123,255,224,0.7)'; ctx.font = '700 11px ui-sans-serif,system-ui'; ctx.fillText('NIVEAU', W / 2, 22);
  ctx.fillStyle = '#eafff8'; ctx.font = '800 20px ui-sans-serif,system-ui'; ctx.fillText(String(level), W / 2, 44);

  for (const o of orbs) drawOrb(o, t);
  for (const o of obstacles) drawObstacle(o, t);

  for (const tr of trail) {
    ctx.globalAlpha = tr.a * 0.35;
    ctx.fillStyle = '#8b8bff'; ctx.shadowColor = '#8b8bff'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.ellipse(tr.x, tr.y + 18, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;

  const px = 140, py = player.y + 24;
  drawRunner(px, py, !!player.slide, player.squash, player.angle, t);

  if (trail.length === 0 || Math.hypot(trail[trail.length - 1].x - px, trail[trail.length - 1].y - py) > 14) trail.push({ x: px, y: py, a: 1 });
  for (const tr of trail) tr.a -= 0.06;
  while (trail.length && trail[0].a <= 0) trail.shift();

  for (const p of pulses) {
    ctx.globalAlpha = Math.max(0, p.life / (p.max || 0.35));
    ctx.strokeStyle = p.color; ctx.lineWidth = p.w || 2.5; ctx.shadowColor = p.color; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  for (const p of particles) {
    ctx.globalAlpha = Math.min(1, (p.life / (p.max || 0.6)) * 2.2);
    ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 8;
    if (p.square) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(((p.max || 0.6) - p.life) * (p.spin || 6)); ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s); ctx.restore(); }
    else { ctx.beginPath(); ctx.arc(p.x, p.y, p.s * 0.7, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  ctx.restore();

  if (flash > 0) {
    ctx.save(); ctx.globalAlpha = Math.min(0.35, flash); ctx.fillStyle = '#ffb8e2'; ctx.fillRect(0, 0, W, H); ctx.restore();
  }

  if (state !== 'playing') {
    ctx.fillStyle = '#04100ddc'; ctx.fillRect(0, 0, W, H); ctx.textAlign = 'center'; ctx.fillStyle = '#c7a2ff'; ctx.font = '800 32px system-ui';
    ctx.fillText(state === 'ready' ? 'NEON RUNNER' : state === 'paused' ? 'PAUSE' : 'CHUTE !', W / 2, H / 2);
    ctx.fillStyle = '#edfffa'; ctx.font = '16px system-ui';
    ctx.fillText(state === 'ready' ? 'Espace ou clic pour courir' : state === 'paused' ? 'Clique sur Pause pour reprendre' : `Niveau ${level} - Clique ou Recommencer pour retenter`, W / 2, H / 2 + 34);
  }
}

function frame(t) {
  const dt = Math.min((t - last) / 1000 || 0, 0.04);
  last = t;
  update(dt); draw(t); requestAnimationFrame(frame);
}

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if ([' ', 'arrowup', 'arrowdown'].includes(k)) e.preventDefault();
  if (k === ' ' || k === 'arrowup' || k === 'w') jump();
  if (k === 'arrowdown' || k === 's') { player.slide = 0.5; crouchHeld = true; }
  if (k === 'p') pause();
});

window.addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); if (k === 'arrowdown' || k === 's') crouchHeld = false; });
window.addEventListener('blur', () => { crouchHeld = false; });
canvas.addEventListener('pointerdown', jump);
document.querySelector('#pause').onclick = pause;
document.querySelector('#restart').onclick = start;
document.querySelector('#new-game').onclick = start;
last = performance.now();
requestAnimationFrame(frame);
