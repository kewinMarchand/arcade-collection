import { mountGameFrame } from '../../packages/ui/src/gameFrame.js';
import { createAudio } from '../../packages/shared/src/audio.js';
import { clamp, overlaps, nextLane } from './game-logic.js';

const shell = mountGameFrame({
  mount: document.getElementById('shell-mount'),
  config: {
    title: 'Drift',
    subtitle: 'Glisse entre les portails, évite les obstacles.',
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
          panel.className = 'arcade-panel';
          panel.dataset.testid = 'game-panel-left';
          const title = document.createElement('h2');
          title.className = 'arcade-panel__title';
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
          panel.className = 'arcade-panel';
          panel.dataset.testid = 'game-panel-right';
          const title = document.createElement('h2');
          title.className = 'arcade-panel__title';
          title.textContent = 'Actions';
          const actions = document.createElement('div');
          actions.className = 'panel-actions';
          const b = (id, text, cls) => { const btn = document.createElement('button'); btn.id = id; btn.type = 'button'; btn.textContent = text; if (cls) btn.className = cls; return btn; };
          actions.append(b('pause', 'Pause'), b('restart', 'Recommencer'), b('new-game', 'Nouvelle partie', 'primary'));
          const help = document.createElement('p');
          help.className = 'help';
          help.textContent = '← → ou A / D : piloter • Espace : démarrer • P : pause';
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
        canvas.setAttribute('aria-label', 'Circuit Drift');
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

const W = canvas.width, H = canvas.height, HORIZON = 148, keys = new Set();
const DIFF = {
  chill: { speed: 0.36, speedGain: 0.005, spawn: 1.0, spawnMin: 0.45, orb: 0.38 },
  arcade: { speed: 0.42, speedGain: 0.008, spawn: 0.9, spawnMin: 0.34, orb: 0.28 },
  chaos: { speed: 0.52, speedGain: 0.012, spawn: 0.72, spawnMin: 0.26, orb: 0.22 },
};

let state = 'ready', lane = 2, carX = 0, score = 0, best = Number(localStorage.getItem('ArcadeDriftBest')) || 0, items = [], elapsed = 0, last = 0, spawn = 0.7, shake = 0, particles = [], pulses = [], carSquash = 1, stars = [], screenFlash = 0;
bestEl.textContent = String(best);
carX = W * 0.5;

function initStars() {
  stars = Array.from({ length: 140 }, () => ({
    x: Math.random() * W,
    y: Math.random() * (HORIZON + 20),
    r: Math.random() < 0.12 ? 2.2 : Math.random() * 1.5 + 0.4,
    a: 0.3 + Math.random() * 0.7,
    tw: Math.random() * Math.PI * 2,
    sp: 0.5 + Math.random() * 1.4,
    vy: 4 + Math.random() * 10,
    vx: -6 + Math.random() * 12,
  }));
}
initStars();
const BOTTOM = [W * 0.212, W * 0.356, W * 0.5, W * 0.644, W * 0.788];
const BOUND = [W * 0.284, W * 0.428, W * 0.572, W * 0.716];
const ease = (p) => Math.pow(clamp(p, 0, 1), 1.7);

function lanePos(l, p) {
  const t = ease(p);
  return { x: W / 2 + (BOTTOM[l] - W / 2) * t, y: HORIZON + (H - 26 - HORIZON) * t, s: 0.12 + 0.88 * t };
}

function start() {
  const d = DIFF[difficultyInput.value] || DIFF.arcade;
  state = 'playing'; lane = 2; carX = BOTTOM[2]; score = 0; elapsed = 0; spawn = d.spawn; shake = 0; items = []; particles = []; pulses = []; carSquash = 1; screenFlash = 0;
  initStars();
  statusEl.textContent = 'En course';
  audio.tone(440, 0.08, 'triangle', 0.03);
}

function pause() {
  if (state === 'playing') { state = 'paused'; statusEl.textContent = 'Pause'; }
  else if (state === 'paused') { state = 'playing'; last = performance.now(); statusEl.textContent = 'En course'; }
  else start();
}

function burst(x, y, color, n, up) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 180;
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (up ? 120 : 0), life: 0.4 + Math.random() * 0.35, color, s: 2 + Math.random() * 3 });
  }
}

function ring(x, y, color) { pulses.push({ x, y, r: 8, life: 0.4, color }); }

function moveLane(dir) {
  const next = nextLane(lane, dir);
  if (next !== lane) {
    lane = next;
    carSquash = 0.88;
    audio.tone(300 + next * 30, 0.03, 'square', 0.015);
  }
}

function update(dt) {
  carSquash += (1 - carSquash) * Math.min(1, dt * 12);
  shake = Math.max(0, shake - dt * 2.5);
  screenFlash = Math.max(0, screenFlash - dt * 2.2);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.life -= dt; if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = pulses.length - 1; i >= 0; i--) { pulses[i].r += 120 * dt; if ((pulses[i].life -= dt) <= 0) pulses.splice(i, 1); }
  for (const s of stars) {
    s.y += s.vy * dt;
    s.x += s.vx * dt;
    if (s.y > HORIZON + 10) { s.y = -4; s.x = Math.random() * W; }
    if (s.x < -4) s.x = W + 4;
    if (s.x > W + 4) s.x = -4;
  }

  if (state !== 'playing') return;
  const d = DIFF[difficultyInput.value] || DIFF.arcade;
  elapsed += dt;
  score = Math.floor(elapsed * 12);
  carX += (BOTTOM[lane] - carX) * Math.min(1, dt * 9);
  spawn -= dt;
  if (spawn <= 0) {
    const orbChance = bonusInput.checked ? d.orb : d.orb * 0.5;
    items.push({ lane: Math.floor(Math.random() * 5), p: 0, kind: Math.random() < (1 - orbChance) ? 'rock' : 'orb', spin: Math.random() * Math.PI * 2, collected: false });
    spawn = Math.max(d.spawnMin, d.spawn - elapsed * 0.003);
  }
  const v = d.speed + Math.min(0.28, elapsed * d.speedGain);
  for (const o of items) { o.p += v * dt; o.spin += dt * 2; }
  items = items.filter((o) => o.p < 1.06 && !o.collected);
  const car = { x: carX - 20, y: H - 95, w: 40, h: 55 };
  for (const o of items) {
    if (o.p < 0.8) continue;
    const pos = lanePos(o.lane, o.p);
    const size = o.kind === 'orb' ? 36 : 42;
    const box = { x: pos.x - (size * pos.s) / 2, y: pos.y - (size * pos.s) / 2, w: size * pos.s, h: size * pos.s };
    if (!overlaps(car, box)) continue;
    if (o.kind === 'orb') {
      o.collected = true;
      const gain = bonusInput.checked ? 50 : 30;
      score += gain;
      carSquash = 1.12;
      screenFlash = Math.max(screenFlash, 0.06);
      burst(pos.x, pos.y, '#ffd36b', 16, true); burst(pos.x, pos.y, '#fff3c4', 8, true); ring(pos.x, pos.y, '#ffeaa0');
      audio.tone(740, 0.08, 'sine', 0.03);
    } else {
      burst(carX, H - 70, '#ff648f', 24); burst(carX, H - 70, '#ffffff', 8); burst(pos.x, pos.y, '#ff648f', 14); ring(pos.x, pos.y, '#ff648f'); ring(carX, H - 70, '#ff648f');
      shake = 1; screenFlash = Math.max(screenFlash, 0.2); carSquash = 0.75; state = 'over'; statusEl.textContent = 'Terminé';
      audio.seq([[180, 0.12, 'sawtooth', 0.05, 0], [120, 0.2, 'sawtooth', 0.04, 0.06]]);
    }
  }
  scoreEl.textContent = String(score);
  if (score > best) { best = score; bestEl.textContent = String(best); localStorage.setItem('ArcadeDriftBest', String(best)); }
}

function drawRoad() {
  ctx.fillStyle = '#0b1836'; ctx.fillRect(0, 0, W, HORIZON);
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON); sky.addColorStop(0, '#0d1833'); sky.addColorStop(0.6, '#0a1530'); sky.addColorStop(1, '#0b1836'); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, HORIZON);
  // Invaders-like decorative nebula + faint grid in sky
  const neb = (x, y, r, color) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color); g.addColorStop(1, 'transparent'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); };
  neb(W * 0.25, HORIZON * 0.45, 170, '#00e0a512'); neb(W * 0.75, HORIZON * 0.35, 150, '#6b7dff14');
  ctx.save(); ctx.strokeStyle = '#9bfff008'; ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HORIZON); ctx.stroke(); }
  for (let y = 0; y <= HORIZON; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.restore();

  const starTime = performance.now() * 0.001;
  for (const s of stars) {
    if (s.y > HORIZON + 10) continue;
    const tw = 0.5 + 0.5 * Math.sin(starTime * s.sp + s.tw);
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

  ctx.fillStyle = '#060a18'; ctx.fillRect(0, HORIZON, W, H - HORIZON);
  const glow = ctx.createLinearGradient(0, HORIZON - 26, 0, HORIZON + 8); glow.addColorStop(0, 'rgba(255,101,189,0)'); glow.addColorStop(1, 'rgba(255,101,189,.5)'); ctx.fillStyle = glow; ctx.fillRect(0, HORIZON - 26, W, 34);
  ctx.strokeStyle = '#ff64bc'; ctx.shadowColor = '#ff64bc'; ctx.shadowBlur = 14; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(W * 0.08, HORIZON); ctx.lineTo(W * 0.14, H - 26); ctx.moveTo(W * 0.92, HORIZON); ctx.lineTo(W * 0.86, H - 26); ctx.stroke();
  ctx.strokeStyle = '#35d9cc'; ctx.shadowColor = '#35d9cc'; ctx.shadowBlur = 8; ctx.lineWidth = 2;
  const off = (elapsed * 1.1) % 0.14;
  for (const b of BOUND) {
    for (let p = off; p < 1; p += 0.14) {
      const a = lanePos(1, p), c = lanePos(1, Math.min(1, p + 0.06));
      const x1 = W / 2 + (b - W / 2) * ease(p), x2 = W / 2 + (b - W / 2) * ease(Math.min(1, p + 0.06));
      ctx.beginPath(); ctx.moveTo(x1, a.y); ctx.lineTo(x2, c.y); ctx.stroke();
    }
  }
  ctx.shadowBlur = 0;
}

function drawRock(pos, spin) {
  const r = 22 * pos.s;
  ctx.save(); ctx.translate(pos.x, pos.y); ctx.rotate(spin * 0.35);
  // detailed hazard mine/drone (no simple prism)
  ctx.shadowColor = '#ff648f'; ctx.shadowBlur = 16;
  ctx.strokeStyle = '#ff9bbb'; ctx.lineWidth = 2 * pos.s;
  // outer ring
  ctx.beginPath(); ctx.arc(0, 0, r * 1.05, 0, Math.PI * 2); ctx.stroke();
  // spikes
  ctx.fillStyle = '#ff648f';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x1 = Math.cos(a) * r * 0.65, y1 = Math.sin(a) * r * 0.65;
    const x2 = Math.cos(a) * r * 1.18, y2 = Math.sin(a) * r * 1.18;
    const x3 = Math.cos(a + 0.18) * r * 0.72, y3 = Math.sin(a + 0.18) * r * 0.72;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.closePath(); ctx.fill();
  }
  // core body
  const core = ctx.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.1, 0, 0, r * 0.75);
  core.addColorStop(0, '#ffd7e6'); core.addColorStop(0.45, '#ff648f'); core.addColorStop(1, '#7a1238');
  ctx.fillStyle = core; ctx.beginPath(); ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2); ctx.fill();
  // inner tech markings
  ctx.shadowBlur = 0; ctx.strokeStyle = '#ffd7e688'; ctx.lineWidth = 1.5 * pos.s;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-r * 0.35, 0); ctx.lineTo(r * 0.35, 0); ctx.moveTo(0, -r * 0.35); ctx.lineTo(0, r * 0.35); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-r * 0.18, -r * 0.18, r * 0.1, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawOrb(pos, t) {
  const pulse = 1 + 0.08 * Math.sin(t * 0.006 + pos.spin);
  const r = 17 * pos.s * pulse;
  ctx.save(); ctx.translate(pos.x, pos.y); ctx.rotate(pos.spin * 0.6);
  // detailed energy core orb
  ctx.shadowColor = '#ffd36b'; ctx.shadowBlur = 18;
  ctx.strokeStyle = '#fff3c4'; ctx.lineWidth = 2.2 * pos.s;
  ctx.beginPath(); ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * 1.15, 0, Math.PI * 1.3); ctx.stroke();
  // segmented petals
  ctx.fillStyle = '#ffd36baa';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }
  const core = ctx.createRadialGradient(-r * 0.25, -r * 0.25, r * 0.1, 0, 0, r);
  core.addColorStop(0, '#fffbe8'); core.addColorStop(0.5, '#ffe58a'); core.addColorStop(1, '#ffbf3b');
  ctx.fillStyle = core; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffffffaa'; ctx.lineWidth = 1.4 * pos.s;
  ctx.beginPath(); ctx.moveTo(-r * 0.45, 0); ctx.lineTo(r * 0.45, 0); ctx.moveTo(0, -r * 0.45); ctx.lineTo(0, r * 0.45); ctx.stroke();
  ctx.fillStyle = '#fffbe8'; ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.3, r * 0.22, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawCar(t) {
  const tilt = (BOTTOM[lane] - carX) * 0.012;
  ctx.save(); ctx.translate(carX, H - 64); ctx.rotate(tilt);
  ctx.scale(1 / Math.sqrt(carSquash), carSquash);
  const fl = 10 + Math.random() * 14;
  // thruster flames
  ctx.fillStyle = t % 160 < 80 ? '#7df3ff' : '#c9fbff'; ctx.shadowColor = '#7df3ff'; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.moveTo(-14, 18); ctx.quadraticCurveTo(-10, 18 + fl, -6, 18); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(6, 18); ctx.quadraticCurveTo(10, 18 + fl, 14, 18); ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  // side fins / intakes
  ctx.fillStyle = '#1d8f7a'; ctx.shadowColor = '#69ffe1'; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.moveTo(-20, -2); ctx.lineTo(-28, 8); ctx.lineTo(-20, 12); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(20, -2); ctx.lineTo(28, 8); ctx.lineTo(20, 12); ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  // main hull (detailed tech racer)
  const body = ctx.createLinearGradient(0, -30, 0, 22); body.addColorStop(0, '#ffffff'); body.addColorStop(0.32, '#caffed'); body.addColorStop(0.72, '#48e2c3'); body.addColorStop(1, '#137d6d');
  ctx.fillStyle = body; ctx.shadowColor = '#69ffe1'; ctx.shadowBlur = 18; ctx.beginPath(); ctx.roundRect(-20, -26, 40, 46, 16); ctx.fill(); ctx.shadowBlur = 0;
  // panel lines / vents
  ctx.strokeStyle = '#0f5b4f55'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(20, 0); ctx.moveTo(0, -26); ctx.lineTo(0, 20); ctx.stroke();
  ctx.strokeStyle = '#0f5b4f88'; ctx.beginPath(); ctx.moveTo(-10, 10); ctx.lineTo(-4, 14); ctx.moveTo(10, 10); ctx.lineTo(4, 14); ctx.stroke();
  // cockpit
  ctx.fillStyle = '#237d73'; ctx.beginPath(); ctx.ellipse(0, -8, 9, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c2fff1'; ctx.beginPath(); ctx.ellipse(-1.5, -11, 4.5, 5.5, -0.2, 0, Math.PI * 2); ctx.fill();
  // headlights / status lights
  ctx.fillStyle = '#faffc4'; ctx.shadowColor = '#ffdc72'; ctx.shadowBlur = 8; ctx.fillRect(-16, 6, 4, 7); ctx.fillRect(12, 6, 4, 7); ctx.shadowBlur = 0;
  ctx.fillStyle = '#ff648f'; ctx.fillRect(-5, -20, 3, 3); ctx.fillRect(2, -20, 3, 3);
  ctx.strokeStyle = '#ffffffa8'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.roundRect(-18, -24, 36, 42, 14); ctx.stroke();
  ctx.restore();
}

function draw(t) {
  ctx.clearRect(0, 0, W, H); ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * 14 * shake, (Math.random() - 0.5) * 10 * shake);
  drawRoad();
  items.slice().sort((a, b) => a.p - b.p).forEach((o) => { const pos = lanePos(o.lane, o.p); o.kind === 'rock' ? drawRock(pos, o.spin) : drawOrb(pos, t); });
  drawCar(t);
  for (const p of pulses) { ctx.globalAlpha = Math.max(0, p.life / 0.4); ctx.strokeStyle = p.color; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke(); }
  ctx.globalAlpha = 1;
  for (const p of particles) { ctx.globalAlpha = Math.min(1, p.life * 2.2); ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 6; ctx.fillRect(p.x, p.y, p.s, p.s); }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  if (state === 'playing' && elapsed > 2) {
    ctx.strokeStyle = 'rgba(125,243,255,.35)'; ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const y = HORIZON + ((elapsed * 420 + i * 137) % (H - HORIZON));
      const sp = 1 - (y - HORIZON) / (H - HORIZON);
      ctx.globalAlpha = 0.35 * (1 - sp);
      ctx.beginPath();
      ctx.moveTo(W * 0.5 + (BOTTOM[lane] - W * 0.5) * ease(Math.min(1, sp + 0.02)), y);
      ctx.lineTo(W * 0.5 + (BOTTOM[lane] - W * 0.5) * ease(Math.max(0, sp - 0.05)), y + 34);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  if (screenFlash > 0) { ctx.globalAlpha = screenFlash; ctx.fillStyle = '#ffd6e8'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  ctx.restore();
  if (state !== 'playing') {
    ctx.fillStyle = '#04100ddc'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.fillStyle = '#69ffe1'; ctx.font = '800 32px system-ui';
    ctx.fillText(state === 'ready' ? 'DRIFT' : state === 'paused' ? 'PAUSE' : 'IMPACT', W / 2, H / 2);
    ctx.fillStyle = '#edfffa'; ctx.font = '16px system-ui';
    ctx.fillText(state === 'ready' ? 'Appuie sur Espace ou Nouvelle partie' : state === 'paused' ? 'Clique sur Pause pour reprendre' : 'Clique ou Recommencer pour retenter', W / 2, H / 2 + 34);
  }
}

function frame(t) {
  const dt = Math.min((t - last) / 1000 || 0, 0.04);
  last = t;
  update(dt); draw(t); requestAnimationFrame(frame);
}

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (['arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  if (k === 'arrowleft' || k === 'a') moveLane(-1);
  if (k === 'arrowright' || k === 'd') moveLane(1);
  if (k === ' ' && state !== 'playing') start();
  if (k === 'p') pause();
});

document.querySelector('#pause').onclick = pause;
document.querySelector('#restart').onclick = start;
document.querySelector('#new-game').onclick = start;
canvas.addEventListener('pointerdown', (e) => {
  if (state === 'over') { start(); return; }
  const r = canvas.getBoundingClientRect();
  moveLane(e.clientX < r.left + r.width / 2 ? -1 : 1);
  if (state === 'ready') start();
});
last = performance.now();
requestAnimationFrame(frame);
