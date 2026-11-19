import { mountGameFrame } from '../../packages/ui/src/gameFrame.js';

const $ = (s) => document.querySelector(s);

const shell = mountGameFrame({
  mount: document.getElementById('shell-mount'),
  config: {
    title: 'Sorter',
    subtitle: 'Remplis les palettes de 3 éléments identiques.',
    renderHeader: () => {
      const options = document.createElement('div');
      options.className = 'game-options';
      options.setAttribute('aria-label', 'Options de jeu');
      const sound = document.createElement('label');
      sound.className = 'option';
      const soundInput = document.createElement('input');
      soundInput.id = 'sound'; soundInput.className = 'toggle'; soundInput.type = 'checkbox';
      sound.append(' Sons ', soundInput);
      options.append(sound);
      return options;
    },
    panels: [
      {
        side: 'left', id: 'hud',
        render: () => {
          const panel = document.createElement('div');
          panel.className = 'arcade-panel'; panel.dataset.testid = 'game-panel-left';
          const title = document.createElement('h2'); title.className = 'arcade-panel__title'; title.textContent = 'Statut';
          const stats = document.createElement('div'); stats.className = 'panel-stats';
          const stat = (label, id, value) => { const w = document.createElement('div'); w.className = 'panel-stat'; const s = document.createElement('small'); s.textContent = label; const v = document.createElement('strong'); v.id = id; v.textContent = value; w.append(s, v); return w; };
          stats.append(stat('SCORE', 'score', '0'), stat('PALETTES', 'ships', '0'), stat('NIVEAU', 'level', '1'), stat('ÉTAT', 'status', 'Prêt'));
          panel.append(title, stats); return panel;
        }
      },
      {
        side: 'right', id: 'actions',
        render: () => {
          const panel = document.createElement('div');
          panel.className = 'arcade-panel'; panel.dataset.testid = 'game-panel-right';
          const title = document.createElement('h2'); title.className = 'arcade-panel__title'; title.textContent = 'Actions';
          const actions = document.createElement('div'); actions.className = 'panel-actions';
          const b = (id, text, cls) => { const btn = document.createElement('button'); btn.id = id; btn.type = 'button'; btn.textContent = text; if (cls) btn.className = cls; return btn; };
          actions.append(b('pause', 'Pause'), b('restart', 'Recommencer'), b('new-game', 'Nouvelle partie', 'primary'));

          const rulesTitle = document.createElement('h3'); rulesTitle.className = 'arcade-panel__subtitle'; rulesTitle.textContent = 'Règles';
          const rules = document.createElement('p'); rules.className = 'help';
          rules.textContent = 'Clique un objet de la première rangée (visible) sur les étagères : il part vers le haut pour remplir une palette de 3 éléments identiques. Si aucune palette ne convient, il va dans un des 5 blocs de défausse. La rangée dessous est visible en transparence mais non sélectionnable.';

          const controlsTitle = document.createElement('h3'); controlsTitle.className = 'arcade-panel__subtitle'; controlsTitle.textContent = 'Contrôles';
          const controls = document.createElement('div'); controls.className = 'controls-legend';
          const row = (key, desc) => {
            const r = document.createElement('div'); r.className = 'control-row';
            const k = document.createElement('span'); k.className = 'control-keys';
            const kb = document.createElement('kbd'); kb.textContent = key; k.appendChild(kb);
            const d = document.createElement('span'); d.className = 'control-desc'; d.textContent = desc;
            r.append(k, d); return r;
          };
          controls.append(row('Clic', 'Sélectionner un objet (1re rangée)'), row('P', 'Pause / reprendre'), row('R', 'Recommencer'));

          panel.append(title, actions, rulesTitle, rules, controlsTitle, controls);
          return panel;
        }
      }
    ],
    screen: {
      mount: (el) => {
        const canvas = document.createElement('canvas');
        canvas.id = 'game'; canvas.width = 960; canvas.height = 620; canvas.setAttribute('aria-label', 'Zone de jeu Sorter');
        el.appendChild(canvas);
      }
    }
  }
});

const canvas = shell.screen.querySelector('canvas');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

function tone(freq = 440, dur = 0.07, type = 'sine', vol = 0.03) {
  const inp = $('#sound');
  if (!inp || !inp.checked) return;
  try {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const c = new C(); const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = vol;
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + dur);
    setTimeout(() => c.close && c.close(), (dur + 0.05) * 1000);
  } catch {}
}

const TYPES = [
  { id: 0, name: 'Module alien', color: '#ff648f', accent: '#ff648f' },
  { id: 1, name: 'Capsule',      color: '#61ffe0', accent: '#61ffe0' },
  { id: 2, name: 'Photon',       color: '#ffd36b', accent: '#ffd36b' },
  { id: 3, name: 'Cristal',      color: '#b58aff', accent: '#b58aff' },
  { id: 4, name: 'Drone',        color: '#8bffbd', accent: '#8bffbd' },
  { id: 5, name: 'Réacteur',     color: '#ff9f5e', accent: '#ff9f5e' },
];

let state = 'ready'; // ready | playing | paused | over | win
let score = 0, palettesDone = 0, level = 1;
let shelves = []; // columns: array of item types, index 0 = front (selectable), index 1 = behind (dimmed/locked), rest hidden
let palettes = []; // { type: number|null, items: number[] } size target 3
let discard = []; // array of item types, max 5
let particles = [], rings = [], floatTexts = [], stars = [], anims = [];
let last = 0, shake = 0, flash = 0, flashColor = '#ff648f';

function makeStars() {
  stars = Array.from({ length: 120 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() < 0.12 ? 2 : 1, a: 0.2 + Math.random() * 0.7, p: Math.random() * Math.PI * 2, sp: 0.5 + Math.random() * 1.2 }));
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function setupLevel() {
  palettes = Array.from({ length: 4 }, () => ({ type: null, items: [] }));
  discard = [];
  particles = []; rings = []; floatTexts = []; anims = []; shake = 0; flash = 0;

  const typeCount = Math.min(6, TYPES.length);
  const paletteGroups = 5 + Math.min(level, 4); // number of complete palettes to form
  const pool = [];
  for (let i = 0; i < paletteGroups; i++) {
    const t = i % typeCount;
    pool.push(t, t, t);
  }
  shuffle(pool);

  const colCount = Math.min(6 + Math.floor(level / 2), 9);
  shelves = Array.from({ length: colCount }, () => []);
  let idx = 0;
  // deal back-to-front so index 0 ends up being the front item
  while (idx < pool.length) {
    shelves[idx % colCount].push(pool[idx++]);
  }
  // reverse each column so [0]=front, [last]=back
  for (const col of shelves) col.reverse();
  shelves = shelves.filter(c => c.length > 0);
}

function resetGame(full = true) {
  if (full) { score = 0; palettesDone = 0; level = 1; }
  state = 'ready';
  makeStars();
  setupLevel();
  updateHud();
  const st = $('#status'); if (st) st.textContent = 'Prêt';
}

function updateHud() {
  const sc = $('#score'); if (sc) sc.textContent = String(score);
  const sh = $('#ships'); if (sh) sh.textContent = String(palettesDone);
  const lv = $('#level'); if (lv) lv.textContent = String(level);
}

function addParticles(x, y, color, n = 14, sp = 160) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = sp * (0.4 + Math.random() * 0.8);
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30 * Math.random(), life: 0.35 + Math.random() * 0.45, max: 0.8, c: color, r: 2 + Math.random() * 3 });
  }
}
function addRing(x, y, color) { rings.push({ x, y, r: 8, life: 0.5, c: color }); }
function addFloat(x, y, text, color) { floatTexts.push({ x, y, text, color, life: 1.0, vy: -38 }); }

// Layout helpers
function shelfLayout() {
  const cols = shelves.length;
  if (!cols) return [];
  const topY = 290;
  const shelfGapY = 74; // vertical distance between platform rows (depth layers)
  const itemOffsetY = -28; // item sits on platform
  const margin = 50;
  const usable = W - margin * 2;
  const spacingX = Math.min(105, usable / Math.max(1, cols));
  const startX = W / 2 - (spacingX * (cols - 1)) / 2;
  return shelves.map((col, i) => ({ x: startX + i * spacingX, baseY: topY, shelfGapY, itemOffsetY, col, i }));
}

function paletteSlots() {
  const n = palettes.length;
  const slotW = 150, slotH = 64, gap = 16;
  const total = n * slotW + (n - 1) * gap;
  const sx = W / 2 - total / 2 - 70;
  const y = 88;
  return Array.from({ length: n }, (_, i) => ({ x: sx + i * (slotW + gap), y, w: slotW, h: slotH }));
}

function discardSlots() {
  const n = 5;
  const w = 54, h = 54, gap = 10;
  const total = n * w + (n - 1) * gap;
  const sx = W / 2 - total / 2;
  const y = 168;
  return Array.from({ length: n }, (_, i) => ({ x: sx + i * (w + gap), y, w, h }));
}

function hitShelf(mx, my) {
  const layout = shelfLayout();
  for (let li = 0; li < layout.length; li++) {
    const L = layout[li];
    if (!L.col.length) continue;
    // front item is row 0 (selectable)
    const ix = L.x;
    const iy = L.baseY + L.itemOffsetY;
    if (mx >= ix - 28 && mx <= ix + 28 && my >= iy - 24 && my <= iy + 24) return li;
  }
  return -1;
}

function findTargetFor(type) {
  // 1) palette with same type and space
  for (let i = 0; i < palettes.length; i++) {
    const p = palettes[i];
    if (p.type === type && p.items.length < 3) return { kind: 'palette', index: i };
  }
  // 2) empty palette
  for (let i = 0; i < palettes.length; i++) {
    const p = palettes[i];
    if (p.type === null && p.items.length === 0) return { kind: 'palette', index: i };
  }
  // 3) discard
  if (discard.length < 5) return { kind: 'discard', index: discard.length };
  return null;
}

function targetPosition(target) {
  if (target.kind === 'palette') {
    const sl = paletteSlots()[target.index];
    const p = palettes[target.index];
    const slotCount = p.items.length; // position for next item
    const innerPad = 18;
    const step = (sl.w - innerPad * 2) / 2;
    return { x: sl.x + innerPad + step * slotCount, y: sl.y + sl.h / 2 };
  } else {
    const sl = discardSlots()[target.index];
    return { x: sl.x + sl.w / 2, y: sl.y + sl.h / 2 };
  }
}

function tryPickup(colIndex) {
  if (state === 'ready') { state = 'playing'; const st = $('#status'); if (st) st.textContent = 'En jeu'; }
  if (state !== 'playing') return;
  const col = shelves[colIndex];
  if (!col || !col.length) return;

  const type = col[0];
  const target = findTargetFor(type);
  if (!target) {
    shake = 0.35; flash = 1; flashColor = '#ff648f';
    tone(120, 0.14, 'sawtooth', 0.045);
    addFloat(W / 2, H / 2, 'Plus de place !', '#ff719c');
    // lose if cannot place
    state = 'over'; const st = $('#status'); if (st) st.textContent = 'Bloqué';
    return;
  }

  const layout = shelfLayout()[colIndex];
  const from = { x: layout.x, y: layout.baseY + layout.itemOffsetY };
  col.shift(); // remove front item, next becomes front

  // reserve target slot logically for animation duration
  const to = targetPosition(target);
  if (target.kind === 'palette') {
    const p = palettes[target.index];
    if (p.type === null) p.type = type;
    p.items.push(type);
  } else {
    discard.push(type);
  }

  anims.push({ type, x: from.x, y: from.y, tx: to.x, ty: to.y, t: 0, dur: 0.22, target });
  addRing(from.x, from.y, TYPES[type].color);
  tone(320 + type * 40, 0.05, 'triangle', 0.02);
}

function onItemArrived(anim) {
  const t = anim.target;
  const pos = { x: anim.tx, y: anim.ty };
  addParticles(pos.x, pos.y, TYPES[anim.type].color, 8, 90);

  if (t.kind === 'palette') {
    const p = palettes[t.index];
    if (p.items.length >= 3) {
      // palette completed
      palettesDone++; score += 40 + level * 8; updateHud();
      const ps = paletteSlots()[t.index];
      const cx = ps.x + ps.w / 2, cy = ps.y + ps.h / 2;
      addParticles(cx, cy, TYPES[anim.type].color, 30, 220);
      addRing(cx, cy, TYPES[anim.type].color); addRing(cx, cy, '#ffffff');
      addFloat(cx, cy - 20, `PALETTE +${40 + level * 8}`, TYPES[anim.type].color);
      shake = 0.18; flash = 0.5; flashColor = '#69ffe1';
      tone(520, 0.08, 'sine', 0.03); tone(740, 0.1, 'sine', 0.03);
      // clear palette after short visual persistence handled by resetting
      p.type = null; p.items = [];
    } else {
      tone(420 + p.items.length * 60, 0.05, 'sine', 0.018);
    }
  } else {
    // discard placement
    addRing(pos.x, pos.y, '#a9bab8');
  }

  checkEndConditions();
}

function checkEndConditions() {
  if (state === 'over' || state === 'win') return;
  const remaining = shelves.some(c => c.length > 0) || anims.length > 0;
  if (!remaining && state === 'playing') {
    state = 'win';
    const st = $('#status'); if (st) st.textContent = 'Niveau terminé';
    score += 120; updateHud();
    addParticles(W / 2, H / 2, '#69ffe1', 45, 260); addRing(W / 2, H / 2, '#69ffe1');
    tone(660, 0.1, 'triangle', 0.03); tone(880, 0.16, 'triangle', 0.03);
    setTimeout(() => {
      if (state !== 'win') return;
      level++; resetGame(false); state = 'playing'; const st2 = $('#status'); if (st2) st2.textContent = 'En jeu';
    }, 1300);
    return;
  }
  // if still items but cannot place any front item? check if all front choices blocked
  if (state === 'playing' && discard.length >= 5) {
    let anyMove = false;
    for (const col of shelves) {
      if (!col.length) continue;
      if (findTargetFor(col[0])) { anyMove = true; break; }
    }
    if (!anyMove && shelves.some(c => c.length > 0)) {
      state = 'over'; const st = $('#status'); if (st) st.textContent = 'Bloqué';
      shake = 0.35; flash = 1; flashColor = '#ff648f'; tone(140, 0.25, 'sawtooth', 0.05);
    }
  }
}

canvas.addEventListener('click', (e) => {
  if (state === 'over' || state === 'win') { resetGame(true); return; }
  if (state === 'ready') { state = 'playing'; const st = $('#status'); if (st) st.textContent = 'En jeu'; }
  if (state === 'paused') return;
  if (anims.length) return; // avoid input during flight for clarity
  const r = canvas.getBoundingClientRect();
  const mx = (e.clientX - r.left) * W / r.width;
  const my = (e.clientY - r.top) * H / r.height;
  const si = hitShelf(mx, my);
  if (si !== -1) tryPickup(si);
});

window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === 'p') {
    if (state === 'playing') { state = 'paused'; const st = $('#status'); if (st) st.textContent = 'Pause'; }
    else if (state === 'paused') { state = 'playing'; const st = $('#status'); if (st) st.textContent = 'En jeu'; last = performance.now(); }
  }
  if (k === 'r') resetGame(true);
  if ((k === ' ' || k === 'enter') && (state === 'ready' || state === 'over' || state === 'win')) resetGame(true);
});
$('#pause').onclick = () => {
  if (state === 'playing') { state = 'paused'; const st = $('#status'); if (st) st.textContent = 'Pause'; }
  else if (state === 'paused') { state = 'playing'; const st = $('#status'); if (st) st.textContent = 'En jeu'; last = performance.now(); }
  else if (state === 'ready' || state === 'over' || state === 'win') { resetGame(true); state = 'playing'; const st = $('#status'); if (st) st.textContent = 'En jeu'; }
};
$('#restart').onclick = () => resetGame(true);
$('#new-game').onclick = () => resetGame(true);

function drawBackground(t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#081821'); g.addColorStop(0.5, '#071512'); g.addColorStop(1, '#06100f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const neb = (x, y, r, c) => { const rg = ctx.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, c); rg.addColorStop(1, 'transparent'); ctx.fillStyle = rg; ctx.fillRect(x - r, y - r, r * 2, r * 2); };
  neb(220 + Math.sin(t * 0.00017) * 30, 140, 280, 'rgba(0,224,165,0.10)');
  neb(760, 180 + Math.cos(t * 0.00013) * 20, 260, 'rgba(90,120,255,0.10)');
  neb(480, 520, 320, 'rgba(36,185,155,0.08)');
  ctx.save(); ctx.strokeStyle = 'rgba(155,255,240,0.05)'; ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.restore();
  for (const s of stars) {
    const tw = 0.55 + 0.45 * Math.sin(t * 0.002 * s.sp + s.p);
    ctx.globalAlpha = s.a * tw; ctx.fillStyle = s.r > 1 ? '#baffeb' : '#f2fffc'; ctx.fillRect(s.x, s.y, s.r, s.r);
  }
  ctx.globalAlpha = 1;
}

function drawColumnsSymbol(x, y, r, colorIndex, color, glow = 10, t = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const time = (t || 0) * 0.001;
  const pulse = 0.92 + 0.08 * Math.sin(time * 4 + colorIndex);

  if (colorIndex === 0) {
    const hull = ctx.createLinearGradient(0, -r, 0, r);
    hull.addColorStop(0, '#ffd6e8'); hull.addColorStop(0.35, color); hull.addColorStop(1, '#5a1030');
    ctx.fillStyle = hull; ctx.strokeStyle = '#ffffff44'; ctx.lineWidth = Math.max(1, r * 0.06);
    ctx.beginPath();
    ctx.moveTo(-r, -r * 0.1); ctx.lineTo(-r * 0.7, -r * 0.72); ctx.lineTo(-r * 0.18, -r * 0.88);
    ctx.lineTo(r * 0.18, -r * 0.88); ctx.lineTo(r * 0.7, -r * 0.62); ctx.lineTo(r, -r * 0.02);
    ctx.lineTo(r * 0.78, r * 0.42); ctx.lineTo(r * 0.42, r * 0.48); ctx.lineTo(r * 0.24, r * 0.86);
    ctx.lineTo(0, r * 0.52); ctx.lineTo(-r * 0.24, r * 0.86); ctx.lineTo(-r * 0.42, r * 0.42);
    ctx.lineTo(-r * 0.78, r * 0.34); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = color; ctx.fillRect(-r * 1.12, -r * 0.22, r * 0.22, r * 0.48); ctx.fillRect(r * 0.9, -r * 0.22, r * 0.22, r * 0.48);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#170a14'; ctx.beginPath(); ctx.ellipse(-r * 0.28, -r * 0.04, r * 0.14, r * 0.2, -0.15, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r * 0.28, -r * 0.04, r * 0.14, r * 0.2, 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.9; ctx.fillRect(-r * 0.33, -r * 0.12, r * 0.05, r * 0.05); ctx.fillRect(r * 0.22, -r * 0.12, r * 0.05, r * 0.05); ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ffffff33'; ctx.beginPath(); ctx.moveTo(-r * 0.15, -r * 0.55); ctx.lineTo(r * 0.15, -r * 0.55); ctx.stroke();
  } else if (colorIndex === 1) {
    const body = ctx.createLinearGradient(-r * 0.2, -r, r * 0.2, r);
    body.addColorStop(0, '#ffffff'); body.addColorStop(0.3, color); body.addColorStop(1, '#0f5f55');
    ctx.fillStyle = body; ctx.strokeStyle = '#ffffff55'; ctx.lineWidth = Math.max(1, r * 0.06);
    ctx.beginPath(); ctx.roundRect(-r * 0.78, -r * 0.88, r * 1.56, r * 1.76, r * 0.52); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    const cockpit = ctx.createRadialGradient(-r * 0.1, -r * 0.2, r * 0.05, 0, -r * 0.05, r * 0.42);
    cockpit.addColorStop(0, '#d9fff7'); cockpit.addColorStop(1, '#13453f');
    ctx.fillStyle = cockpit; ctx.beginPath(); ctx.ellipse(0, -r * 0.05, r * 0.34, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff99'; ctx.beginPath(); ctx.ellipse(-r * 0.08, -r * 0.2, r * 0.1, r * 0.15, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#faffc4'; ctx.shadowColor = '#faffc4'; ctx.shadowBlur = 6 * pulse;
    ctx.fillRect(-r * 0.58, r * 0.22, r * 0.16, r * 0.3); ctx.fillRect(r * 0.42, r * 0.22, r * 0.16, r * 0.3);
    ctx.shadowBlur = 0; ctx.strokeStyle = '#ffffff33'; ctx.beginPath(); ctx.moveTo(-r * 0.45, -r * 0.55); ctx.lineTo(r * 0.45, -r * 0.55); ctx.stroke();
  } else if (colorIndex === 2) {
    const core = ctx.createRadialGradient(-r * 0.15, -r * 0.2, r * 0.1, 0, 0, r * 0.78);
    core.addColorStop(0, '#fffef0'); core.addColorStop(0.45, color); core.addColorStop(1, '#5a4300');
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(0, 0, r * 0.72 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.5, r * 0.11);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + time * 1.2;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.35); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.stroke();
    }
    ctx.shadowBlur = 0; ctx.strokeStyle = '#ffffff66'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, r * 0.95, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fffbe0'; ctx.beginPath(); ctx.arc(-r * 0.18, -r * 0.22, r * 0.16, 0, Math.PI * 2); ctx.fill();
  } else if (colorIndex === 3) {
    const gem = ctx.createLinearGradient(-r * 0.3, -r, r * 0.4, r);
    gem.addColorStop(0, '#f3e8ff'); gem.addColorStop(0.4, color); gem.addColorStop(1, '#30145a');
    ctx.fillStyle = gem; ctx.strokeStyle = '#ffffff55'; ctx.lineWidth = Math.max(1, r * 0.06);
    ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 0.78, -r * 0.15); ctx.lineTo(r * 0.55, r * 0.85);
    ctx.lineTo(-r * 0.55, r * 0.85); ctx.lineTo(-r * 0.78, -r * 0.15); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0; ctx.strokeStyle = '#ffffff55'; ctx.lineWidth = Math.max(1, r * 0.07);
    ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, r * 0.85); ctx.moveTo(-r * 0.78, -r * 0.15); ctx.lineTo(r * 0.78, -r * 0.15); ctx.stroke();
    ctx.fillStyle = '#ffffff66'; ctx.beginPath(); ctx.moveTo(-r * 0.08, -r * 0.82); ctx.lineTo(-r * 0.45, -r * 0.15); ctx.lineTo(-r * 0.08, -r * 0.15); ctx.closePath(); ctx.fill();
    ctx.fillStyle = color; ctx.globalAlpha = 0.7; ctx.fillRect(-r * 0.08, r * 0.35, r * 0.16, r * 0.2); ctx.globalAlpha = 1;
  } else if (colorIndex === 4) {
    const body = ctx.createLinearGradient(0, -r, 0, r);
    body.addColorStop(0, '#eafff4'); body.addColorStop(0.4, color); body.addColorStop(1, '#0b4a35');
    ctx.fillStyle = body; ctx.strokeStyle = '#ffffff44'; ctx.lineWidth = Math.max(1, r * 0.06);
    ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 0.95, -r * 0.15); ctx.lineTo(r * 0.55, r * 0.15);
    ctx.lineTo(r * 0.75, r * 0.85); ctx.lineTo(0, r * 0.35); ctx.lineTo(-r * 0.75, r * 0.85);
    ctx.lineTo(-r * 0.55, r * 0.15); ctx.lineTo(-r * 0.95, -r * 0.15); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0e2a1f'; ctx.beginPath(); ctx.arc(0, -r * 0.05, r * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#bfffe8'; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(0, -r * 0.05, r * 0.1, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff88'; ctx.fillRect(-r * 0.04, -r * 0.58, r * 0.08, r * 0.22);
    ctx.strokeStyle = '#ffffff33'; ctx.beginPath(); ctx.moveTo(-r * 0.45, r * 0.05); ctx.lineTo(r * 0.45, r * 0.05); ctx.stroke();
  } else {
    // Reactor / beacon symbol (6th type)
    const body = ctx.createLinearGradient(0, -r, 0, r);
    body.addColorStop(0, '#fff3e6'); body.addColorStop(0.35, color); body.addColorStop(1, '#5a2a10');
    ctx.fillStyle = body; ctx.strokeStyle = '#ffffff55'; ctx.lineWidth = Math.max(1, r * 0.06);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + i * (Math.PI * 2 / 6);
      const px = Math.cos(a) * r * 0.95, py = Math.sin(a) * r * 0.95;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    const core = ctx.createRadialGradient(-r * 0.1, -r * 0.15, r * 0.05, 0, 0, r * 0.45);
    core.addColorStop(0, '#fff7e6'); core.addColorStop(1, '#7a3a12');
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(0, 0, r * 0.42 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff88'; ctx.lineWidth = Math.max(1, r * 0.07);
    ctx.beginPath(); ctx.moveTo(0, -r * 0.7); ctx.lineTo(0, -r * 0.42); ctx.moveTo(0, r * 0.42); ctx.lineTo(0, r * 0.7);
    ctx.moveTo(-r * 0.6, 0); ctx.lineTo(-r * 0.42, 0); ctx.moveTo(r * 0.42, 0); ctx.lineTo(r * 0.6, 0); ctx.stroke();
    ctx.fillStyle = '#fff1cf'; ctx.beginPath(); ctx.arc(0, 0, r * 0.14, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawModule(x, y, type, scale = 1, opts = {}, t = 0) {
  const { highlight = false, alpha = 1, shadow = true } = opts;
  const tt = TYPES[type]; if (!tt) return;
  const c = tt.color;
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); ctx.globalAlpha = alpha;
  if (highlight && shadow) { ctx.shadowColor = c; ctx.shadowBlur = 18; }
  const body = ctx.createLinearGradient(0, -20, 0, 20);
  body.addColorStop(0, '#1e3945'); body.addColorStop(1, '#0e202a');
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.roundRect(-24, -20, 48, 40, 9); ctx.fill();
  ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = 'rgba(8,20,26,0.75)';
  ctx.beginPath(); ctx.roundRect(-18, -14, 36, 28, 6); ctx.fill();
  ctx.shadowBlur = 0;
  // draw Columns-style symbol as the item (from Columns)
  drawColumnsSymbol(0, 0, 11.5, tt.id, c, highlight ? 12 : 8, t);
  ctx.restore();
}

function drawShelfPlatform(x, y, w = 56) {
  ctx.save();
  const grad = ctx.createLinearGradient(x - w / 2, y, x + w / 2, y);
  grad.addColorStop(0, 'rgba(20,60,70,0.0)');
  grad.addColorStop(0.15, 'rgba(105,255,225,0.22)');
  grad.addColorStop(0.5, 'rgba(105,255,225,0.35)');
  grad.addColorStop(0.85, 'rgba(105,255,225,0.22)');
  grad.addColorStop(1, 'rgba(20,60,70,0.0)');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x + w / 2, y); ctx.stroke();
  ctx.fillStyle = 'rgba(105,255,225,0.08)';
  ctx.beginPath(); ctx.ellipse(x, y + 4, w * 0.42, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function draw(t) {
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * 10 * shake, (Math.random() - 0.5) * 8 * shake);
  drawBackground(t);

  // Top labels
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(232,251,255,0.78)'; ctx.font = '600 14px "Space Grotesk", sans-serif';
  const ps = paletteSlots();
  const palettesCx = ps.length ? (ps[0].x + ps[ps.length - 1].x + ps[ps.length - 1].w) / 2 : W / 2;
  ctx.fillText('Palettes à remplir (3 identiques)', palettesCx, 58);
  const ds = discardSlots();
  const discardCx = ds.length ? (ds[0].x + ds[ds.length - 1].x + ds[ds.length - 1].w) / 2 : W / 2;
  ctx.fillText('Défausse (5)', discardCx, 156);

  // Palette slots
  ps.forEach((sl, i) => {
    const p = palettes[i];
    const active = p.items.length > 0;
    ctx.save();
    ctx.fillStyle = 'rgba(8,24,30,0.72)';
    ctx.strokeStyle = active ? (TYPES[p.type]?.color || '#69ffe1') : 'rgba(105,255,225,0.28)';
    ctx.lineWidth = 2;
    ctx.shadowColor = active ? (TYPES[p.type]?.color || '#69ffe1') : 'transparent';
    ctx.shadowBlur = active ? 10 : 0;
    ctx.beginPath(); ctx.roundRect(sl.x, sl.y, sl.w, sl.h, 12); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(sl.x + 5, sl.y + 5, sl.w - 10, sl.h - 10, 9); ctx.stroke();
    // slot markers
    for (let k = 0; k < 3; k++) {
      const mx = sl.x + 18 + ((sl.w - 36) / 2) * k;
      const my = sl.y + sl.h / 2;
      if (p.items[k] === undefined) {
        ctx.strokeStyle = 'rgba(105,255,225,0.18)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(mx, my, 10, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.restore();
    p.items.forEach((type, k) => {
      const mx = sl.x + 18 + ((sl.w - 36) / 2) * k;
      const my = sl.y + sl.h / 2;
      drawModule(mx, my, type, 0.82, { alpha: 1, shadow: true }, t);
    });
  });

  // Discard slots
  ds.forEach((sl, i) => {
    const filled = discard[i] !== undefined;
    ctx.save();
    ctx.fillStyle = 'rgba(18,18,24,0.65)';
    ctx.strokeStyle = filled ? 'rgba(255,180,120,0.45)' : 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1.8;
    ctx.setLineDash(filled ? [] : [5, 4]);
    ctx.beginPath(); ctx.roundRect(sl.x, sl.y, sl.w, sl.h, 10); ctx.fill(); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    if (filled) drawModule(sl.x + sl.w / 2, sl.y + sl.h / 2, discard[i], 0.78, { alpha: 0.95 }, t);
  });

  // Shelves and items
  ctx.fillStyle = 'rgba(232,251,255,0.72)'; ctx.font = '600 14px "Space Grotesk", sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('Étagères — choisis un objet de la première rangée (il monte vers le haut)', W / 2, 250);

  const layout = shelfLayout();
  for (const L of layout) {
    // draw platforms for row 0 (front, selectable) and row 1 (behind, dimmed locked)
    // platform 0
    drawShelfPlatform(L.x, L.baseY, 58);
    // platform 1 (behind / below in stack depth, slightly lower visually)
    if (L.col.length > 1) {
      ctx.save(); ctx.globalAlpha = 0.45; drawShelfPlatform(L.x, L.baseY + L.shelfGapY, 58); ctx.restore();
    }

    // row behind (index 1) - semi-transparent, non-selectable
    if (L.col.length > 1) {
      drawModule(L.x, L.baseY + L.shelfGapY + L.itemOffsetY, L.col[1], 0.92, { alpha: 0.38, shadow: false }, t);
      // lock hint
      ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = '#e8fbff'; ctx.font = '700 10px "DM Mono", monospace'; ctx.textAlign = 'center';
      ctx.fillText('verrouillé', L.x, L.baseY + L.shelfGapY + L.itemOffsetY + 28); ctx.restore();
    }

    // front row (index 0) - visible and selectable
    if (L.col.length > 0) {
      const isHoverable = state === 'playing' && anims.length === 0;
      drawModule(L.x, L.baseY + L.itemOffsetY, L.col[0], 1, { highlight: isHoverable, alpha: 1, shadow: true }, t);
    }
  }

  // Animations
  for (const a of anims) drawModule(a.x, a.y, a.type, 1, { highlight: true, alpha: 1, shadow: true }, t);

  // Particles/rings/text
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.c; ctx.shadowColor = p.c; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.5 + p.life / p.max), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  for (const r of rings) { ctx.globalAlpha = Math.max(0, r.life / 0.5); ctx.strokeStyle = r.c; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke(); }
  ctx.globalAlpha = 1;
  for (const f of floatTexts) { ctx.globalAlpha = Math.max(0, f.life); ctx.fillStyle = f.color; ctx.font = '700 15px "Space Grotesk", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(f.text, f.x, f.y); }
  ctx.globalAlpha = 1;

  // overlays
  if (state !== 'playing') {
    ctx.fillStyle = 'rgba(2,8,12,0.72)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.shadowColor = '#69ffe1'; ctx.shadowBlur = 18; ctx.fillStyle = '#69ffe1';
    ctx.font = '800 40px "Space Grotesk", sans-serif';
    let title = 'SORTER', sub = 'Clique pour commencer — remplis des palettes de 3 éléments';
    if (state === 'paused') { title = 'PAUSE'; sub = 'P pour reprendre'; }
    else if (state === 'over') { title = 'BLOQUÉ'; sub = 'Plus de placement possible — clique ou R pour recommencer'; ctx.fillStyle = '#ff719c'; ctx.shadowColor = '#ff719c'; }
    else if (state === 'win') { title = 'NIVEAU TERMINÉ'; sub = 'Préparation du niveau suivant...'; ctx.fillStyle = '#78ffd0'; ctx.shadowColor = '#78ffd0'; }
    ctx.fillText(title, W / 2, H / 2 - 10);
    ctx.shadowBlur = 0; ctx.fillStyle = '#e8fbff'; ctx.font = '16px "Space Grotesk", sans-serif';
    ctx.fillText(sub, W / 2, H / 2 + 28);
  }
  if (flash > 0) { ctx.globalAlpha = flash * 0.28; ctx.fillStyle = flashColor; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  ctx.restore();
}

function update(dt) {
  for (let i = anims.length - 1; i >= 0; i--) {
    const a = anims[i]; a.t += dt;
    const speed = 12;
    a.x += (a.tx - a.x) * Math.min(1, dt * speed);
    a.y += (a.ty - a.y) * Math.min(1, dt * speed);
    const done = a.t >= a.dur || (Math.abs(a.x - a.tx) < 1.5 && Math.abs(a.y - a.ty) < 1.5);
    if (done) { const anim = a; anims.splice(i, 1); onItemArrived(anim); }
  }
  for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; if (p.life <= 0) particles.splice(i, 1); }
  for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.life -= dt; r.r += 150 * dt; if (r.life <= 0) rings.splice(i, 1); }
  for (let i = floatTexts.length - 1; i >= 0; i--) { const f = floatTexts[i]; f.life -= dt; f.y += f.vy * dt; if (f.life <= 0) floatTexts.splice(i, 1); }
  shake = Math.max(0, shake - dt * 1.2); flash = Math.max(0, flash - dt * 2.5);
}

function loop(t) {
  const dt = Math.min((t - last) / 1000 || 0, 0.05); last = t;
  update(dt); draw(t); requestAnimationFrame(loop);
}

resetGame(true);
requestAnimationFrame(loop);
