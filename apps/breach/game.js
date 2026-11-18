import * as THREE from 'https://esm.sh/three@0.160.0';
import { mountGameFrame } from '../../packages/ui/src/gameFrame.js';

(() => {
  let host;
  mountGameFrame({
    mount: document.getElementById('shell-mount'),
    config: {
      title: 'Neon Breach',
      subtitle: 'Infiltrez le secteur, neutralisez les aliens.',
      renderHeader: () => {
        const options = document.createElement('div');
        options.className = 'game-options';
        options.setAttribute('aria-label', 'Options de jeu');
        options.innerHTML = '<span class="option">FPS néon · MVP testable</span>';
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
            title.textContent = 'Briefing';
            const p = document.createElement('p');
            p.className = 'neon-panel__text';
            p.textContent = 'Sécurisez le secteur : éliminez tous les aliens. Récupérez les modules de réparation (vie) et les chargeurs.';
            const stats = document.createElement('div');
            stats.className = 'panel-stats';
            const mk = (label, id, value) => {
              const w = document.createElement('div'); w.className = 'panel-stat';
              const s = document.createElement('small'); s.textContent = label;
              const v = document.createElement('strong'); v.id = `panel-${id}`; v.textContent = value;
              w.append(s, v); return w;
            };
            stats.append(mk('SANTÉ', 'health', '100'), mk('MUNITIONS', 'ammo', '24'), mk('CIBLES', 'targets', '0'));
            panel.append(title, p, stats);
            return panel;
          }
        },
        {
          side: 'right',
          id: 'controls',
          render: () => {
            const panel = document.createElement('div');
            panel.className = 'neon-panel';
            panel.dataset.testid = 'game-panel-right';
            const title = document.createElement('h2');
            title.className = 'neon-panel__title';
            title.textContent = 'Commandes';
            const ul = document.createElement('ul');
            ul.className = 'neon-panel__list';
            for (const t of [
              'Clic / Entrée : capturer la souris et jouer',
              'ZQSD ou WASD / Flèches : se déplacer',
              'Souris : viser',
              'Clic gauche : tirer (boules rebondissantes)',
              'R : recharger',
              'Échap : libérer la souris (pause)'
            ]) { const li = document.createElement('li'); li.className = 'neon-panel__text'; li.textContent = t; ul.appendChild(li); }
            panel.append(title, ul);
            return panel;
          }
        }
      ],
      screen: {
        mount: (el) => {
          host = document.createElement('div');
          host.id = 'game-screen-host';
          host.innerHTML = `
            <div id="hud">
              <div id="hud-top">
                <div class="hud-box">
                  <span class="hud-label">Santé</span>
                  <span class="hud-value" id="hud-health">100</span>
                  <div id="health-bar-wrap"><div id="health-bar"></div></div>
                </div>
                <div class="hud-box" style="text-align:right">
                  <span class="hud-label">Aliens</span>
                  <span class="hud-value" id="hud-targets">0</span>
                </div>
              </div>
              <div id="crosshair" aria-hidden="true"></div>
              <div id="damage-flash"></div>
              <div id="hud-bottom">
                <div class="hud-box" id="ammo">Munitions <span id="hud-ammo">24</span> / <span id="hud-reserve">72</span></div>
                <div class="hud-box" id="objective">Objectif : éliminez tous les aliens du secteur.</div>
              </div>
            </div>
            <div id="overlay">
              <div class="card">
                <h2><em>Neon</em> Breach</h2>
                <p>FPS néon en vue subjective. Explorez le secteur, éliminez les aliens et récupérez des artefacts.</p>
                <div class="keys">
                  <div><kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> / flèches — déplacement</div>
                  <div><kbd>Souris</kbd> — viser</div>
                  <div><kbd>Clic</kbd> — tirer (boules rebondissantes)</div>
                  <div><kbd>R</kbd> — recharger · <kbd>Échap</kbd> — pause</div>
                </div>
                <button id="start-btn" type="button">Entrer dans le secteur</button>
                <div id="message"></div>
              </div>
            </div>`;
          el.appendChild(host);
        }
      },
      footer: () => {
        const wrap = document.createElement('div');
        wrap.className = 'game-footer';
        wrap.innerHTML = '<span class="neon-panel__text">Astuce : les projectiles rebondissent sur les murs — utilisez les ricochets.</span>';
        return wrap;
      }
    }
  });

  const overlay = host.querySelector('#overlay');
  const startBtn = host.querySelector('#start-btn');
  const msgEl = host.querySelector('#message');
  const hudHealth = host.querySelector('#hud-health');
  const hudTargets = host.querySelector('#hud-targets');
  const hudAmmo = host.querySelector('#hud-ammo');
  const hudReserve = host.querySelector('#hud-reserve');
  const healthBar = host.querySelector('#health-bar');
  const damageFlash = host.querySelector('#damage-flash');
  const objectiveEl = host.querySelector('#objective');
  const panelHealth = () => document.getElementById('panel-health');
  const panelAmmo = () => document.getElementById('panel-ammo');
  const panelTargets = () => document.getElementById('panel-targets');

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x02060a, 1);
  host.insertBefore(renderer.domElement, host.firstChild);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x02060a, 0.045);
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 120);
  camera.rotation.order = 'YXZ';
  camera.position.set(6, 1.6, 6);

  scene.add(new THREE.AmbientLight(0x3fd6ff, 0.35));
  scene.add(new THREE.HemisphereLight(0x2aa8ff, 0x041018, 0.45));

  const map = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1,0,0,0,0,0,3,1],
    [1,0,1,1,1,0,1,0,1,1,1,0,0,1],
    [1,0,0,0,1,0,0,0,0,0,1,0,0,1],
    [1,1,1,0,1,1,1,1,1,0,1,1,0,1],
    [1,0,0,0,0,0,0,3,1,0,0,0,0,1],
    [1,0,1,1,1,1,1,0,1,1,1,1,0,1],
    [1,0,0,0,0,0,1,0,0,0,0,1,0,1],
    [1,0,1,1,1,0,1,1,1,1,0,1,0,1],
    [1,4,0,0,1,0,0,0,0,1,0,0,0,1],
    [1,0,1,0,1,1,1,1,0,1,0,1,0,1],
    [1,0,1,0,0,0,3,1,0,0,0,1,4,1],
    [1,0,0,0,1,0,0,0,0,1,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ];
  const cell = 4;
  const worldOf = (x, z) => ({ x: x * cell + cell / 2, z: z * cell + cell / 2 });

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(map[0].length * cell, map.length * cell),
    new THREE.MeshStandardMaterial({ color: 0x07131d, metalness: 0.2, roughness: 0.8 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((map[0].length * cell) / 2, 0, (map.length * cell) / 2);
  scene.add(floor);

  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(map[0].length * cell, map.length * cell),
    new THREE.MeshStandardMaterial({ color: 0x040b12, emissive: 0x021018, roughness: 1 })
  );
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set((map[0].length * cell) / 2, 3.2, (map.length * cell) / 2);
  scene.add(ceil);

  const grid = new THREE.GridHelper(Math.max(map.length, map[0].length) * cell, Math.max(map.length, map[0].length), 0x134455, 0x0b2430);
  grid.position.set((map[0].length * cell) / 2, 0.01, (map.length * cell) / 2);
  scene.add(grid);

  function isWallAt(wx, wz) {
    const gx = Math.floor(wx / cell), gz = Math.floor(wz / cell);
    if (gz < 0 || gz >= map.length || gx < 0 || gx >= map[0].length) return true;
    return map[gz][gx] === 1;
  }

  const pickups = [];
  const enemies = [];
  const bullets = [];
  const sparks = [];

  function addLight(x, y, z, color, intensity, dist) {
    const l = new THREE.PointLight(color, intensity, dist, 2);
    l.position.set(x, y, z); scene.add(l);
  }

  function addNeonWall(x, z) {
    const p = worldOf(x, z);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x0a1e2a, emissive: 0x061824, emissiveIntensity: 0.55, metalness: 0.35, roughness: 0.5 });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(cell, 3.2, cell), baseMat);
    wall.position.set(p.x, 1.6, p.z);
    scene.add(wall);

    const edgeMat = new THREE.LineBasicMaterial({ color: 0x34f5d5, transparent: true, opacity: 0.45 });
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(cell, 3.2, cell)), edgeMat);
    edges.position.copy(wall.position);
    scene.add(edges);

    const neonMatA = new THREE.MeshBasicMaterial({ color: 0x3dffe0, transparent: true, opacity: 0.95 });
    const neonMatB = new THREE.MeshBasicMaterial({ color: 0x8b7bff, transparent: true, opacity: 0.75 });
    const strips = [
      { geo: new THREE.BoxGeometry(cell * 0.9, 0.06, 0.06), pos: [0, 1.05, cell / 2 + 0.03], mat: neonMatA },
      { geo: new THREE.BoxGeometry(cell * 0.9, 0.06, 0.06), pos: [0, 1.05, -cell / 2 - 0.03], mat: neonMatA },
      { geo: new THREE.BoxGeometry(0.06, 0.06, cell * 0.9), pos: [cell / 2 + 0.03, 1.05, 0], mat: neonMatA },
      { geo: new THREE.BoxGeometry(0.06, 0.06, cell * 0.9), pos: [-cell / 2 - 0.03, 1.05, 0], mat: neonMatA },
      { geo: new THREE.BoxGeometry(0.08, 2.2, 0.08), pos: [cell / 2 - 0.35, 1.4, cell / 2 - 0.35], mat: neonMatB },
      { geo: new THREE.BoxGeometry(0.08, 2.2, 0.08), pos: [-cell / 2 + 0.35, 1.4, -cell / 2 + 0.35], mat: neonMatB },
    ];
    for (const s of strips) {
      const m = new THREE.Mesh(s.geo, s.mat);
      m.position.set(p.x + s.pos[0], s.pos[1], p.z + s.pos[2]);
      scene.add(m);
    }
  }

  function makeAlien(colorHex, idx) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.85, metalness: 0.15, roughness: 0.35 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x10201c, emissive: 0x06120f, roughness: 0.8 });
    const white = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), mat);
    body.scale.set(1.25, 0.85, 1.0);
    g.add(body);

    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    dome.position.set(0, 0.08, 0.05);
    g.add(dome);

    const finGeo = new THREE.BoxGeometry(0.32, 0.12, 0.22);
    const finL = new THREE.Mesh(finGeo, mat); finL.position.set(-0.55, -0.02, 0); finL.rotation.z = 0.35; g.add(finL);
    const finR = new THREE.Mesh(finGeo, mat); finR.position.set(0.55, -0.02, 0); finR.rotation.z = -0.35; g.add(finR);

    const eyeGeo = new THREE.SphereGeometry(0.09, 10, 10);
    const eyeL = new THREE.Mesh(eyeGeo, dark); eyeL.position.set(-0.14, 0.02, 0.34); eyeL.scale.set(1, 1.25, 0.6); g.add(eyeL);
    const eyeR = new THREE.Mesh(eyeGeo, dark); eyeR.position.set(0.14, 0.02, 0.34); eyeR.scale.set(1, 1.25, 0.6); g.add(eyeR);
    const pupGeo = new THREE.SphereGeometry(0.03, 8, 8);
    const pupL = new THREE.Mesh(pupGeo, white); pupL.position.set(-0.13, 0.04, 0.39); g.add(pupL);
    const pupR = new THREE.Mesh(pupGeo, white); pupR.position.set(0.15, 0.04, 0.39); g.add(pupR);

    const footGeo = new THREE.BoxGeometry(0.12, 0.18, 0.1);
    const footL = new THREE.Mesh(footGeo, mat); footL.position.set(-0.18, -0.38, 0.05); g.add(footL);
    const footR = new THREE.Mesh(footGeo, mat); footR.position.set(0.18, -0.38, 0.05); g.add(footR);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.03, 8, 28), new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.55 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.05;
    g.add(ring);

    g.userData.kind = 'alien';
    g.userData.variant = idx % 5;
    return g;
  }

  function makeHealthPickup() {
    const g = new THREE.Group();
    const cyan = new THREE.MeshStandardMaterial({ color: 0x69ffe1, emissive: 0x2affd8, emissiveIntensity: 1.1, metalness: 0.25, roughness: 0.25 });
    const white = new THREE.MeshStandardMaterial({ color: 0xeaffff, emissive: 0x9dfff0, emissiveIntensity: 0.6, metalness: 0.1, roughness: 0.3 });
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.55, 4), cyan);
    body.rotation.x = Math.PI;
    body.rotation.y = Math.PI / 4;
    g.add(body);
    const wingGeo = new THREE.BoxGeometry(0.55, 0.06, 0.18);
    const wing = new THREE.Mesh(wingGeo, cyan);
    wing.position.y = -0.05;
    g.add(wing);
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), white);
    cockpit.position.set(0, 0.08, 0.08);
    g.add(cockpit);
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 0.14, 10), new THREE.MeshBasicMaterial({ color: 0x7bffe5 }));
    engine.position.y = -0.28;
    g.add(engine);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.025, 8, 24), new THREE.MeshBasicMaterial({ color: 0x69ffe1, transparent: true, opacity: 0.8 }));
    halo.rotation.x = Math.PI / 2;
    g.add(halo);
    g.scale.setScalar(1.05);
    return g;
  }

  function makeAmmoPickup() {
    const g = new THREE.Group();
    const gold = new THREE.MeshStandardMaterial({ color: 0xffd36b, emissive: 0xffa020, emissiveIntensity: 1.0, metalness: 0.35, roughness: 0.3 });
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.42, 12), gold);
    g.add(core);
    const cap1 = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.06, 12), new THREE.MeshStandardMaterial({ color: 0xfff0a8, emissive: 0xffc84a, emissiveIntensity: 0.7 }));
    cap1.position.y = 0.22; g.add(cap1);
    const cap2 = cap1.clone(); cap2.position.y = -0.22; g.add(cap2);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.03, 8, 24), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.85 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.02; g.add(ring);
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    crystal.position.y = 0.32; g.add(crystal);
    g.scale.setScalar(1.05);
    return g;
  }

  for (let z = 0; z < map.length; z++) {
    for (let x = 0; x < map[0].length; x++) {
      const t = map[z][x];
      const p = worldOf(x, z);
      if (t === 1) {
        addNeonWall(x, z);
      } else {
        if ((x + z) % 4 === 0) addLight(p.x, 2.7, p.z, 0x32ffd8, 0.55, 10);
        if (t === 3) {
          const m = makeHealthPickup();
          m.position.set(p.x, 1.1, p.z);
          scene.add(m);
          pickups.push({ mesh: m, type: 'health', amount: 35, baseY: 1.1, alive: true, light: null });
          addLight(p.x, 1.2, p.z, 0x2affd8, 0.5, 5);
        } else if (t === 4) {
          const m = makeAmmoPickup();
          m.position.set(p.x, 1.0, p.z);
          scene.add(m);
          pickups.push({ mesh: m, type: 'ammo', amount: 18, baseY: 1.0, alive: true, light: null });
          addLight(p.x, 1.1, p.z, 0xffb020, 0.45, 5);
        }
      }
    }
  }

  const alienColors = [0xff65b5, 0xffad5c, 0xffe36e, 0x79ffd0, 0x75caff];
  function spawnEnemy(x, z, idx) {
    const p = worldOf(x, z);
    const color = alienColors[idx % alienColors.length];
    const group = makeAlien(color, idx);
    group.position.set(p.x, 1.3, p.z);
    scene.add(group);
    const light = new THREE.PointLight(color, 0.7, 7, 2);
    light.position.copy(group.position);
    scene.add(light);
    enemies.push({ group, light, hp: 60, alive: true, cooldown: Math.random() * 1.2, t: Math.random() * 10, base: p, phase: Math.random() * Math.PI * 2, radius: 0.55 });
  }
  [[7,1],[12,1],[5,5],[10,7],[2,9],[12,11]].forEach((pos, i) => spawnEnemy(pos[0], pos[1], i));

  const state = {
    running: false, over: false, won: false,
    health: 100, ammo: 24, reserve: 72,
    yaw: Math.PI * 0.75, pitch: 0,
    keys: Object.create(null),
    lastShot: 0, reloading: false, reloadT: 0,
    damageT: 0, time: 0
  };

  function moveForward() { const k = state.keys; return k['z'] || k['w'] || k['arrowup'] || k['keyw'] || k['keyz']; }
  function moveBack() { const k = state.keys; return k['s'] || k['arrowdown'] || k['keys']; }
  function moveLeft() { const k = state.keys; return k['q'] || k['a'] || k['arrowleft'] || k['keya'] || k['keyq']; }
  function moveRight() { const k = state.keys; return k['d'] || k['arrowright'] || k['keyd']; }

  function syncHud() {
    const t = enemies.filter(e => e.alive).length;
    hudHealth.textContent = String(Math.max(0, Math.round(state.health)));
    hudTargets.textContent = String(t);
    hudAmmo.textContent = String(state.ammo);
    hudReserve.textContent = String(state.reserve);
    healthBar.style.width = `${Math.max(0, Math.min(100, state.health))}%`;
    const ph = panelHealth(), pa = panelAmmo(), pt = panelTargets();
    if (ph) ph.textContent = String(Math.max(0, Math.round(state.health)));
    if (pa) pa.textContent = `${state.ammo}/${state.reserve}`;
    if (pt) pt.textContent = String(t);
  }

  function resize() {
    const w = host.clientWidth || 900, h = host.clientHeight || 560;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  function setOverlay(show, title, text, button, msg = '') {
    overlay.classList.toggle('hidden', !show);
    overlay.querySelector('h2').innerHTML = title;
    overlay.querySelector('p').textContent = text;
    startBtn.textContent = button;
    msgEl.textContent = msg;
  }

  function clearBullets() {
    for (const b of bullets) scene.remove(b.mesh);
    bullets.length = 0;
  }

  function resetGame() {
    state.running = false; state.over = false; state.won = false;
    state.health = 100; state.ammo = 24; state.reserve = 72;
    state.yaw = Math.PI * 0.75; state.pitch = 0; state.reloading = false; state.reloadT = 0; state.damageT = 0;
    camera.position.set(6, 1.6, 6);
    camera.rotation.y = state.yaw; camera.rotation.x = state.pitch;
    camera.updateMatrixWorld();
    for (const e of enemies) { e.hp = 60; e.alive = true; e.group.visible = true; e.light.visible = true; e.cooldown = Math.random() * 1.2; e.group.position.set(e.base.x, 1.3, e.base.z); }
    for (const p of pickups) { p.alive = true; p.mesh.visible = true; }
    clearBullets();
    syncHud();
  }
  resetGame();

  function tryLock() { if (!state.over && !state.won) renderer.domElement.requestPointerLock?.(); }
  startBtn.addEventListener('click', () => { if (state.over || state.won) resetGame(); tryLock(); });
  host.addEventListener('click', (e) => { if (e.target === startBtn) return; if (document.pointerLockElement !== renderer.domElement && !state.over && !state.won) tryLock(); });

  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === renderer.domElement) {
      state.running = true; overlay.classList.add('hidden');
    } else {
      state.running = false;
      if (!state.over && !state.won) setOverlay(true, '<em>Pause</em>', 'La souris a été libérée. Cliquez pour reprendre.', 'Reprendre');
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== renderer.domElement || state.over || state.won) return;
    state.yaw -= e.movementX * 0.0022;
    state.pitch -= e.movementY * 0.0022;
    const lim = Math.PI / 2 - 0.05;
    state.pitch = Math.max(-lim, Math.min(lim, state.pitch));
  });

  const onKey = (v) => (e) => {
    const k = e.key.toLowerCase();
    const c = e.code ? e.code.toLowerCase() : '';
    state.keys[k] = v;
    if (c) state.keys[c] = v;
    if (v && (k === 'r' || c === 'keyr')) reload();
    if (v && e.key === 'Enter' && document.pointerLockElement !== renderer.domElement) { if (state.over || state.won) resetGame(); tryLock(); }
  };
  window.addEventListener('keydown', onKey(true));
  window.addEventListener('keyup', onKey(false));

  function reload() {
    if (state.reloading || state.ammo >= 24 || state.reserve <= 0) return;
    state.reloading = true; state.reloadT = 1.1;
    msgEl.textContent = 'Rechargement…';
    if (objectiveEl) objectiveEl.textContent = 'Rechargement…';
  }

  const tmpV = new THREE.Vector3();
  function shoot() {
    if (!state.running || state.over || state.won) return;
    if (state.reloading) return;
    const now = performance.now() / 1000;
    if (now - state.lastShot < 0.16) return;
    if (state.ammo <= 0) { reload(); return; }
    state.lastShot = now; state.ammo--; syncHud();
    muzzleFlash();
    camera.getWorldDirection(tmpV);
    const dir = tmpV.clone().normalize();
    const pos = camera.position.clone().add(dir.clone().multiplyScalar(0.7)).add(new THREE.Vector3(0, -0.05, 0));
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xbffff6, emissive: 0x69ffe1, emissiveIntensity: 1.6, metalness: 0.05, roughness: 0.15 })
    );
    mesh.position.copy(pos);
    scene.add(mesh);
    const vel = dir.multiplyScalar(20);
    bullets.push({ mesh, vel, life: 2.8, bounces: 5, radius: 0.14, squash: 0 });
    if (state.ammo === 0 && state.reserve > 0) reload();
  }
  window.addEventListener('mousedown', (e) => { if (e.button === 0) shoot(); });

  const flashLight = new THREE.PointLight(0x8ffff0, 0, 6, 2);
  flashLight.position.set(0.2, -0.15, -0.6);
  camera.add(flashLight);
  scene.add(camera);
  let flashT = 0;
  function muzzleFlash() { flashT = 0.06; flashLight.intensity = 2.2; }

  function spawnSparks(pos, color, n = 10) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), new THREE.MeshBasicMaterial({ color }));
      m.position.copy(pos);
      const v = new THREE.Vector3((Math.random() - 0.5) * 4, (Math.random() - 0.2) * 4, (Math.random() - 0.5) * 4);
      scene.add(m);
      sparks.push({ m, v, life: 0.4 + Math.random() * 0.3 });
    }
  }

  function killEnemy(e) {
    e.alive = false; e.group.visible = false; e.light.visible = false;
    spawnSparks(e.group.position.clone(), 0xff7ab0, 26);
    const left = enemies.filter(x => x.alive).length;
    syncHud();
    if (left === 0) win();
  }

  function damagePlayer(amount) {
    if (state.over || state.won) return;
    state.health -= amount; state.damageT = 0.25;
    damageFlash.style.opacity = '1';
    syncHud();
    if (state.health <= 0) lose();
  }

  function win() {
    state.won = true; state.running = false; document.exitPointerLock?.();
    setOverlay(true, '<em>Secteur sécurisé</em>', 'Tous les aliens ont été neutralisés. Mission accomplie.', 'Rejouer', `Santé restante : ${Math.max(0, Math.round(state.health))}`);
  }
  function lose() {
    state.over = true; state.running = false; document.exitPointerLock?.();
    setOverlay(true, 'Mission <em>échouée</em>', 'Vous avez été neutralisé par les aliens du secteur.', 'Réessayer', `Aliens restants : ${enemies.filter(e => e.alive).length}`);
  }

  for (const e of enemies) e.group.userData.enemyRef = e;

  function canMoveTo(nx, nz) {
    const r = 0.45;
    const pts = [[nx - r, nz - r], [nx + r, nz - r], [nx - r, nz + r], [nx + r, nz + r]];
    for (const [px, pz] of pts) if (isWallAt(px, pz)) return false;
    return true;
  }

  function hasLineOfSight(from, to) {
    const dir = to.clone().sub(from); const dist = dir.length();
    if (dist < 0.001) return true;
    dir.normalize();
    const steps = Math.ceil(dist / 0.25);
    for (let i = 1; i < steps; i++) {
      const p = from.clone().add(dir.clone().multiplyScalar((dist * i) / steps));
      if (isWallAt(p.x, p.z)) return false;
    }
    return true;
  }

  const clock = new THREE.Clock();
  function tick() {
    requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.05);
    state.time += dt;
    resizeNeededCheck();

    if (flashT > 0) { flashT -= dt; if (flashT <= 0) flashLight.intensity = 0; }
    if (state.damageT > 0) { state.damageT -= dt; if (state.damageT <= 0) damageFlash.style.opacity = '0'; }

    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.life -= dt;
      s.m.position.addScaledVector(s.v, dt);
      s.v.y -= 5 * dt;
      s.m.material.opacity = Math.max(0, s.life / 0.6);
      s.m.material.transparent = true;
      if (s.life <= 0) { scene.remove(s.m); sparks.splice(i, 1); }
    }

    for (const p of pickups) {
      if (!p.alive) continue;
      p.mesh.rotation.y += dt * 1.6;
      p.mesh.position.y = p.baseY + Math.sin(state.time * 2 + p.baseY) * 0.12;
      const dx = camera.position.x - p.mesh.position.x, dz = camera.position.z - p.mesh.position.z;
      if (dx * dx + dz * dz < 1.2) {
        if (p.type === 'health' && state.health < 100) { state.health = Math.min(100, state.health + p.amount); p.alive = false; p.mesh.visible = false; syncHud(); }
        else if (p.type === 'ammo') { state.reserve = Math.min(120, state.reserve + p.amount); p.alive = false; p.mesh.visible = false; syncHud(); }
      }
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.life -= dt;
      b.squash = Math.max(0, b.squash - dt * 8);
      b.vel.y -= 6.5 * dt;
      const prev = b.mesh.position.clone();
      b.mesh.position.addScaledVector(b.vel, dt);

      // floor/ceiling bounce
      if (b.mesh.position.y <= b.radius) {
        b.mesh.position.y = b.radius;
        if (b.vel.y < 0) { b.vel.y = -b.vel.y * 0.72; b.vel.x *= 0.94; b.vel.z *= 0.94; b.bounces--; b.squash = 1; }
      } else if (b.mesh.position.y >= 3.2 - b.radius) {
        b.mesh.position.y = 3.2 - b.radius;
        if (b.vel.y > 0) { b.vel.y = -b.vel.y * 0.72; b.bounces--; b.squash = 1; }
      }

      // wall bounces
      if (isWallAt(b.mesh.position.x, prev.z)) {
        b.mesh.position.x = prev.x;
        b.vel.x = -b.vel.x * 0.82; b.vel.y *= 0.96; b.vel.z *= 0.96; b.bounces--; b.squash = 1;
        spawnSparks(b.mesh.position.clone(), 0x69ffe1, 4);
      }
      if (isWallAt(b.mesh.position.x, b.mesh.position.z)) {
        b.mesh.position.z = prev.z;
        b.vel.z = -b.vel.z * 0.82; b.vel.y *= 0.96; b.vel.x *= 0.96; b.bounces--; b.squash = 1;
        spawnSparks(b.mesh.position.clone(), 0x69ffe1, 4);
      }

      const stretch = 1 + b.squash * 0.35;
      b.mesh.scale.set(1 / Math.sqrt(stretch), stretch, 1 / Math.sqrt(stretch));

      let hit = false;
      for (const e of enemies) {
        if (!e.alive) continue;
        const dx = b.mesh.position.x - e.group.position.x;
        const dy = b.mesh.position.y - e.group.position.y;
        const dz = b.mesh.position.z - e.group.position.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < b.radius + e.radius) {
          e.hp -= 34;
          spawnSparks(b.mesh.position.clone(), 0xff8fb0, 8);
          if (e.hp <= 0) killEnemy(e);
          hit = true;
          break;
        }
      }

      if (hit || b.life <= 0 || b.bounces < 0 || b.vel.length() < 1.5) {
        scene.remove(b.mesh);
        bullets.splice(i, 1);
      }
    }

    if (state.reloading) {
      state.reloadT -= dt;
      if (state.reloadT <= 0) {
        const need = 24 - state.ammo; const take = Math.min(need, state.reserve);
        state.ammo += take; state.reserve -= take; state.reloading = false; msgEl.textContent = '';
        if (objectiveEl) objectiveEl.textContent = state.won ? 'Secteur sécurisé.' : 'Objectif : éliminez tous les aliens du secteur.';
        syncHud();
      }
    }

    if (state.running && !state.over && !state.won) {
      const speed = 5.2;
      camera.rotation.order = 'YXZ';
      camera.rotation.y = state.yaw; camera.rotation.x = state.pitch;
      camera.updateMatrixWorld();
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward); forward.y = 0; if (forward.lengthSq() > 0) forward.normalize();
      const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
      let move = new THREE.Vector3();
      if (moveForward()) move.add(forward);
      if (moveBack()) move.sub(forward);
      if (moveLeft()) move.sub(right);
      if (moveRight()) move.add(right);
      if (move.lengthSq() > 0) {
        move.normalize().multiplyScalar(speed * dt);
        const nx = camera.position.x + move.x; const nz = camera.position.z + move.z;
        if (canMoveTo(nx, camera.position.z)) camera.position.x = nx;
        if (canMoveTo(camera.position.x, nz)) camera.position.z = nz;
      }

      const playerPos = camera.position.clone();
      for (const e of enemies) {
        if (!e.alive) continue;
        e.t += dt; e.cooldown -= dt;
        e.group.position.y = 1.3 + Math.sin(e.t * 2 + e.phase) * 0.12;
        e.light.position.copy(e.group.position);
        const toPlayer = playerPos.clone().sub(e.group.position); toPlayer.y = 0;
        const dist = toPlayer.length();
        if (dist < 18 && hasLineOfSight(e.group.position.clone().setY(1.3), playerPos.clone().setY(1.3))) {
          e.group.lookAt(playerPos.x, e.group.position.y, playerPos.z);
          if (dist > 4.5) {
            const step = toPlayer.normalize().multiplyScalar(1.6 * dt);
            const ex = e.group.position.x + step.x, ez = e.group.position.z + step.z;
            if (!isWallAt(ex, e.group.position.z)) e.group.position.x = ex;
            if (!isWallAt(e.group.position.x, ez)) e.group.position.z = ez;
          }
          if (e.cooldown <= 0 && dist < 16) {
            e.cooldown = 1.15 + Math.random() * 0.6;
            if (Math.random() < 0.55) { damagePlayer(8 + Math.random() * 6); spawnSparks(playerPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, -0.2, (Math.random() - 0.5) * 0.5)), 0xff5577, 6); }
          }
        } else {
          const ox = Math.sin(e.t * 0.7 + e.phase) * 0.4;
          const oz = Math.cos(e.t * 0.9 + e.phase) * 0.4;
          e.group.position.x += (e.base.x + ox - e.group.position.x) * dt * 0.8;
          e.group.position.z += (e.base.z + oz - e.group.position.z) * dt * 0.8;
          e.group.rotation.y += dt * 0.6;
        }
      }
    }

    renderer.render(scene, camera);
  }

  let lastW = 0, lastH = 0;
  function resizeNeededCheck() {
    const w = host.clientWidth, h = host.clientHeight;
    if (w && h && (w !== lastW || h !== lastH)) { lastW = w; lastH = h; resize(); }
  }

  syncHud();
  requestAnimationFrame(tick);
})();
