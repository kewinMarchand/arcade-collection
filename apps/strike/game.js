import { mountGameFrame } from '../../packages/ui/src/gameFrame.js';

const shell = mountGameFrame({
  mount: document.getElementById('shell-mount'),
  config: {
    title: 'Neon Strike',
    subtitle: 'Abattez les vaisseaux avant qu\'ils ne vous atteignent.',
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
          if (id === 'sound') input.checked = true;
          wrap.append(` ${label} `, input);
        }
        return wrap;
      };
      options.append(
        mk('Difficulté', 'difficulty', 'select', '<option value="chill">Chill</option><option value="arcade" selected>Arcade</option><option value="chaos">Chaos</option>'),
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
          stats.append(stat('SCORE', 'score', '0'), stat('VIES', 'lives', '3'), stat('VAGUE', 'wave', '1'), stat('BOUCLIER', 'shield', '0'));
          panel.append(title, stats);
          const help = document.createElement('p');
          help.className = 'help';
          help.textContent = 'Souris : viser · Clic : tirer · R : recharger · Espace : pause.';
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
        canvas.width = 900;
        canvas.height = 600;
        canvas.setAttribute('aria-label', 'Jeu Neon Strike');
        el.appendChild(canvas);
      },
    },
  },
});

const canvas = shell.screen.querySelector('canvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.querySelector('#score');
const livesEl = document.querySelector('#lives');
const waveEl = document.querySelector('#wave');
const shieldEl = document.querySelector('#shield');
const difficultyInput = document.querySelector('#difficulty');
const soundInput = document.querySelector('#sound');
const audio = { tone: (f, d, t, v) => { if (!soundInput.checked) return; try { const c = new (window.AudioContext || window.webkitAudioContext)(); const o = c.createOscillator(), g = c.createGain(); o.type = t || 'sine'; o.frequency.value = f; g.gain.setValueAtTime(v || 0.03, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + d); o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + d); } catch {} } };

const W = canvas.width, H = canvas.height;
const CX = W / 2, CY = H / 2;

// FIX 3: Increased speeds — chill 0.018, arcade 0.028, chaos 0.045
const DIFF = {
  chill:  { spawn: 1.6, speed: 0.018, hp: 1 },
  arcade: { spawn: 1.1, speed: 0.028, hp: 2 },
  chaos:  { spawn: 0.7, speed: 0.045, hp: 3 },
};

let state = 'ready', score = 0, lives = 3, wave = 1, shield = 0, ammo = 30, maxAmmo = 30, reloading = 0;
let enemies = [], bullets = [], particles = [], stars = [], last = 0, elapsed = 0, spawnTimer = 1.2, shake = 0;
let aimX = CX, aimY = CY;
let waveKills = 0, waveTarget = 8;
// FIX 5: flash timer for hit effect
let flashTimer = 0;

function initStars() {
  stars = Array.from({ length: 200 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 1.5 + 0.5, tw: Math.random() * Math.PI * 2 }));
}

function start() {
  score = 0; lives = 3; wave = 1; shield = 0; ammo = maxAmmo; reloading = 0;
  enemies = []; bullets = []; particles = []; elapsed = 0; spawnTimer = 1.2; shake = 0; waveKills = 0; waveTarget = 8;
  flashTimer = 0;
  state = 'playing';
  scoreEl.textContent = '0'; livesEl.textContent = '3'; waveEl.textContent = '1'; shieldEl.textContent = '0';
  audio.tone(520, 0.1, 'triangle', 0.03);
}

// FIX 2: Added missing burst() function
function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 180;
    particles.push({ x, y, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp, life: 0.4 + Math.random()*0.3, color, s: 2+Math.random()*3 });
  }
}

function spawnEnemy() {
  const d = DIFF[difficultyInput.value] || DIFF.arcade;

  // FIX 1: Spread spawn across full perspective zone, biased toward edges
  // Use sign-biased random to push values toward +/-0.9 and +/-0.6
  const edgeBias = () => {
    const v = Math.random();
    // bias toward edges: square-root makes values cluster near 1, then flip sign randomly
    return (Math.sqrt(v) * 0.9) * (Math.random() < 0.5 ? 1 : -1);
  };
  const x = edgeBias();
  const y = edgeBias() * (0.6 / 0.9); // scale to y range [-0.6, 0.6]

  const isBoss = waveKills > 0 && waveKills % (waveTarget * 2) === 0 && enemies.length === 0;

  // FIX 4: assign random shape (0, 1, 2) on spawn
  enemies.push({
    x, y, z: 1.0,
    hp: isBoss ? d.hp * 4 : d.hp,
    boss: isBoss,
    color: isBoss ? '#ff4d6d' : ['#7bffe5', '#ff6dbe', '#ffd36b', '#8b8bff'][Math.floor(Math.random() * 4)],
    // FIX 3: wider speed variance (0.6 + random * 0.8)
    speed: d.speed * (0.6 + Math.random() * 0.8),
    shape: Math.floor(Math.random() * 3),
    // FIX 4: trail - last 3 positions
    trail: [],
    spawnTime: performance.now(),
  });
}

function shoot() {
  if (state !== 'playing') return;
  if (ammo <= 0) { if (!reloading) { reloading = 1.2; audio.tone(180, 0.1, 'sawtooth', 0.03); } return; }
  ammo--;
  // FIX 2: store start and end of tracer line
  bullets.push({ x: aimX, y: aimY, fromX: CX, fromY: CY, life: 0.15 });
  // hit test: find the enemy closest to camera (smallest z) whose hitbox contains the aim
  let nearest = null, nearestZ = Infinity;
  for (const e of enemies) {
    const s = 1 - e.z;
    const ex = CX + e.x * s * 400;
    const ey = CY + e.y * s * 300;
    const size = s * 60 + 8;
    const dx = aimX - ex, dy = aimY - ey;
    if (Math.hypot(dx, dy) < size && e.z < nearestZ) { nearestZ = e.z; nearest = e; }
  }
  if (nearest) {
    nearest.hp--;
    // compute screen pos before potentially removing
    const hitX = sx(nearest), hitY = sy(nearest);
    burst(hitX, hitY, nearest.color, 12);
    audio.tone(660, 0.05, 'square', 0.02);
    // FIX 5: flash on hit
    flashTimer = 0.08;
    if (nearest.hp <= 0) {
      enemies.splice(enemies.indexOf(nearest), 1);
      score += nearest.boss ? 500 : 100;
      scoreEl.textContent = String(score);
      waveKills++;
      burst(hitX, hitY, nearest.color, 24);
      audio.tone(880, 0.12, 'triangle', 0.03);
      if (waveKills >= waveTarget) { wave++; waveKills = 0; waveTarget = Math.min(20, waveTarget + 2); waveEl.textContent = String(wave); audio.tone(660, 0.2, 'triangle', 0.04); }
    }
  } else {
    audio.tone(220, 0.04, 'square', 0.015);
  }
}

function sx(e) { return CX + e.x * (1 - e.z) * 400; }
function sy(e) { return CY + e.y * (1 - e.z) * 300; }

function update(dt) {
  elapsed += dt;
  shake = Math.max(0, shake - dt * 3);
  flashTimer = Math.max(0, flashTimer - dt);
  for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; if (p.life <= 0) particles.splice(i, 1); }
  for (let i = bullets.length - 1; i >= 0; i--) { bullets[i].life -= dt; if (bullets[i].life <= 0) bullets.splice(i, 1); }
  if (state !== 'playing') return;

  if (reloading > 0) { reloading -= dt; if (reloading <= 0) { reloading = 0; ammo = maxAmmo; } }

  const d = DIFF[difficultyInput.value] || DIFF.arcade;
  // spawn
  spawnTimer -= dt;
  if (spawnTimer <= 0 && enemies.length < 12) {
    spawnEnemy();
    spawnTimer = d.spawn * (0.7 + Math.random() * 0.6);
  }

  // move enemies toward camera
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    // FIX 4: store trail before moving
    const ex = sx(e), ey = sy(e);
    e.trail.push({ x: ex, y: ey });
    if (e.trail.length > 3) e.trail.shift();

    e.z -= e.speed * dt;
    if (e.z <= 0) {
      enemies.splice(i, 1);
      if (shield > 0) { shield--; shieldEl.textContent = String(shield); audio.tone(300, 0.1, 'sawtooth', 0.03); }
      else { lives--; livesEl.textContent = String(lives); audio.tone(180, 0.2, 'sawtooth', 0.04); shake = 1; if (lives <= 0) { state = 'over'; } }
    }
  }
}

// FIX 4: Draw 3 distinct ship silhouettes
function drawShip(ctx, e, x, y, size, t) {
  const pulse = 0.7 + 0.3 * Math.sin(t * 3 + e.spawnTime * 0.001);
  ctx.shadowColor = e.color;
  ctx.shadowBlur = 18 * pulse;

  ctx.fillStyle = e.color;
  ctx.globalAlpha = 0.9;

  if (e.shape === 0) {
    // Classic delta-wing fighter
    ctx.beginPath();
    ctx.moveTo(0, -size * 1.1);
    ctx.lineTo(size * 1.1, size * 0.5);
    ctx.lineTo(size * 0.5, size * 0.8);
    ctx.lineTo(0, size * 0.4);
    ctx.lineTo(-size * 0.5, size * 0.8);
    ctx.lineTo(-size * 1.1, size * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    // fuselage
    ctx.beginPath();
    ctx.moveTo(0, -size * 1.2);
    ctx.lineTo(size * 0.3, size * 0.5);
    ctx.lineTo(0, size * 0.9);
    ctx.lineTo(-size * 0.3, size * 0.5);
    ctx.closePath();
    ctx.fill();

  } else if (e.shape === 1) {
    // Wide beetle / bomber shape
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.7);
    ctx.lineTo(size * 1.3, -size * 0.1);
    ctx.lineTo(size * 1.1, size * 0.7);
    ctx.lineTo(size * 0.4, size * 1.0);
    ctx.lineTo(0, size * 0.6);
    ctx.lineTo(-size * 0.4, size * 1.0);
    ctx.lineTo(-size * 1.1, size * 0.7);
    ctx.lineTo(-size * 1.3, -size * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    // cockpit dome
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.ellipse(0, -size * 0.1, size * 0.25, size * 0.35, 0, 0, Math.PI * 2); ctx.fill();

  } else {
    // Arrow / interceptor — narrow and aggressive
    ctx.beginPath();
    ctx.moveTo(0, -size * 1.4);
    ctx.lineTo(size * 0.6, size * 0.2);
    ctx.lineTo(size * 1.0, size * 0.6);
    ctx.lineTo(size * 0.3, size * 0.4);
    ctx.lineTo(0, size * 1.0);
    ctx.lineTo(-size * 0.3, size * 0.4);
    ctx.lineTo(-size * 1.0, size * 0.6);
    ctx.lineTo(-size * 0.6, size * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    // spine line
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -size * 1.4); ctx.lineTo(0, size * 1.0); ctx.stroke();
  }

  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  // Cockpit (shapes 0 and 2)
  if (e.shape !== 1) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.ellipse(0, -size * 0.1, size * 0.18, size * 0.25, 0, 0, Math.PI * 2); ctx.fill();
  }

  // Engine glow (pulsed)
  ctx.fillStyle = e.boss ? '#ff4d6d' : '#ffd36b';
  ctx.shadowColor = e.boss ? '#ff4d6d' : '#ffd36b'; ctx.shadowBlur = 14 * pulse;
  ctx.beginPath(); ctx.ellipse(0, size * 0.85, size * 0.22, size * 0.13, 0, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;

  // hp bar
  if (e.hp > 1) {
    const maxHp = e.boss ? 4 : (DIFF[difficultyInput.value] || DIFF.arcade).hp;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-size, -size - 8, size * 2, 4);
    ctx.fillStyle = e.color; ctx.fillRect(-size, -size - 8, size * 2 * (e.hp / (maxHp * (e.boss ? 4 : 1))), 4);
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * 16 * shake, (Math.random() - 0.5) * 12 * shake);

  // background
  const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, W * 0.7);
  g.addColorStop(0, '#1a1a3a'); g.addColorStop(1, '#06060f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // grid floor
  ctx.strokeStyle = 'rgba(123,255,224,0.15)'; ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    const y = CY + (H - CY) * t * 0.9;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  for (let i = -6; i <= 6; i++) {
    const x = CX + i * 80;
    ctx.beginPath(); ctx.moveTo(x, CY); ctx.lineTo(CX + (x - CX) * 4, H); ctx.stroke();
  }

  // stars
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 80; i++) {
    const starX = (i * 137 + 40) % W;
    const starY = (i * 79 + 18) % (H / 2);
    const r = i % 7 === 0 ? 1.8 : 1.0;
    ctx.globalAlpha = 0.3 + (i % 5) * 0.1;
    ctx.beginPath(); ctx.arc(starX, starY, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // enemies sorted by z (far to near)
  const sorted = enemies.slice().sort((a, b) => a.z - b.z);
  const t = elapsed;

  for (const e of sorted) {
    const s = 1 - e.z;
    const x = CX + e.x * s * 400;
    const y = CY + e.y * s * 300;
    const size = s * 60 + 8;

    // FIX 4: Draw trail / sillage behind enemy
    for (let ti = 0; ti < e.trail.length; ti++) {
      const tp = e.trail[ti];
      const alpha = (ti + 1) / (e.trail.length + 1) * 0.4;
      const tSize = size * (0.4 + ti * 0.15);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = e.color;
      ctx.shadowColor = e.color; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.ellipse(tp.x, tp.y, tSize * 0.35, tSize * 0.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    // Draw ship with shape variant
    ctx.save();
    ctx.translate(x, y);
    drawShip(ctx, e, x, y, size, t);
    ctx.restore();
  }

  // FIX 2: bullets — tracer line + dot
  for (const b of bullets) {
    const alpha = b.life / 0.15;
    ctx.globalAlpha = alpha;
    // tracer line from gun barrel (bottom-center of canvas) to aim
    ctx.strokeStyle = '#ffd36b'; ctx.lineWidth = 2; ctx.shadowColor = '#ffd36b'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.moveTo(b.fromX, b.fromY); ctx.lineTo(b.x, b.y); ctx.stroke();
    // bright dot at impact point
    ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;

  // particles
  for (const p of particles) {
    ctx.globalAlpha = Math.min(1, p.life * 2);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color; ctx.shadowBlur = 4;
    ctx.fillRect(p.x, p.y, p.s, p.s);
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;

  // FIX 5: white flash on hit
  if (flashTimer > 0) {
    ctx.globalAlpha = 0.15 * (flashTimer / 0.08);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  // reticle
  ctx.strokeStyle = '#7bffe5'; ctx.lineWidth = 2; ctx.shadowColor = '#7bffe5'; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.arc(aimX, aimY, 18, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(aimX - 26, aimY); ctx.lineTo(aimX - 10, aimY); ctx.moveTo(aimX + 10, aimY); ctx.lineTo(aimX + 26, aimY);
  ctx.moveTo(aimX, aimY - 26); ctx.lineTo(aimX, aimY - 10); ctx.moveTo(aimX, aimY + 10); ctx.lineTo(aimX, aimY + 26);
  ctx.stroke(); ctx.shadowBlur = 0;

  // ammo
  ctx.textAlign = 'left'; ctx.fillStyle = '#8db6aa'; ctx.font = '700 10px ui-sans-serif,system-ui';
  ctx.fillText('MUNITIONS', 20, H - 20);
  ctx.fillStyle = ammo > 5 ? '#eafff8' : '#ff6dbe'; ctx.font = '800 18px ui-sans-serif,system-ui';
  ctx.fillText(`${ammo}/${maxAmmo}${reloading > 0 ? ' (recharge...)' : ''}`, 20, H - 2);

  if (state !== 'playing') {
    ctx.fillStyle = 'rgba(6,6,15,0.8)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.fillStyle = '#7bffe5'; ctx.font = '800 40px system-ui';
    const title = state === 'ready' ? 'NEON STRIKE' : state === 'over' ? 'MISSION ECHOUEE' : state === 'paused' ? 'PAUSE' : 'VAGUE TERMINEE';
    ctx.fillText(title, CX, CY - 20);
    ctx.fillStyle = '#edfffa'; ctx.font = '16px system-ui';
    const hint = state === 'ready' ? 'Clique pour lancer' : state === 'paused' ? 'Espace, P ou clic pour reprendre' : 'Clique, Espace ou Recommencer';
    ctx.fillText(hint, CX, CY + 20);
  }

  ctx.restore();
}

const keys = new Set();
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'r') { if (ammo < maxAmmo && !reloading) { reloading = 1.2; audio.tone(220, 0.1, 'sawtooth', 0.03); } }
  if (k === ' ') {
    if (state === 'ready' || state === 'over') start();
    else if (state === 'paused') { state = 'playing'; last = performance.now(); }
    e.preventDefault();
  }
  if (k === 'p' || k === 'escape') {
    if (state === 'playing') { state = 'paused'; }
    else if (state === 'paused') { state = 'playing'; last = performance.now(); }
  }
});
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  aimX = (e.clientX - rect.left) * (W / rect.width);
  aimY = (e.clientY - rect.top) * (H / rect.height);
});
canvas.addEventListener('click', () => {
  if (state === 'ready' || state === 'over') start();
  else if (state === 'paused') { state = 'playing'; last = performance.now(); }
  else if (state === 'playing') shoot();
});
document.querySelector('#pause').onclick = () => { if (state === 'playing') state = 'paused'; else if (state === 'paused') { state = 'playing'; last = performance.now(); } else if (state === 'ready' || state === 'over') start(); };
document.querySelector('#restart').onclick = start;
document.querySelector('#new-game').onclick = start;

function frame(t) { const dt = Math.min((t - last) / 1000 || 0, 0.04); last = t; update(dt); draw(); requestAnimationFrame(frame); }
last = performance.now();
initStars();
requestAnimationFrame(frame);
start();
