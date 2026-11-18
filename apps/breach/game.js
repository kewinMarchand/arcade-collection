import * as THREE from 'https://esm.sh/three@0.160.0';
import { mountGameFrame } from '../../packages/ui/src/gameFrame.js';

(() => {
  let host;
  const shell = mountGameFrame({
    mount: document.getElementById('shell-mount'),
    config: {
      title: 'Neon Breach',
      subtitle: 'Infiltrez le secteur, neutralisez les sentinelles.',
      renderHeader: () => {
        const options = document.createElement('div');
        options.className = 'game-options';
        options.setAttribute('aria-label', 'Options de jeu');
        options.innerHTML = '<span class="option">FPS nÃ©on Â· MVP testable</span>';
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
            p.textContent = 'SÃ©curisez le secteur : Ã©liminez toutes les sentinelles. RÃ©cupÃ©rez les cellules dâ€™Ã©nergie (vie) et les chargeurs.';
            const stats = document.createElement('div');
            stats.className = 'panel-stats';
            const mk = (label, id, value) => {
              const w = document.createElement('div'); w.className = 'panel-stat';
              const s = document.createElement('small'); s.textContent = label;
              const v = document.createElement('strong'); v.id = `panel-${id}`; v.textContent = value;
              w.append(s, v); return w;
            };
            stats.append(mk('SANTÃ‰', 'health', '100'), mk('MUNITIONS', 'ammo', '24'), mk('CIBLES', 'targets', '0'));
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
              'Clic / EntrÃ©e : capturer la souris et jouer',
              'ZQSD ou WASD / FlÃ¨ches : se dÃ©placer',
              'Souris : viser',
              'Clic gauche : tirer',
              'R : recharger',
              'Ã‰chap : libÃ©rer la souris (pause)'
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
                  <span class="hud-label">SantÃ©</span>
                  <span class="hud-value" id="hud-health">100</span>
                  <div id="health-bar-wrap"><div id="health-bar"></div></div>
                </div>
                <div class="hud-box" style="text-align:right">
                  <span class="hud-label">Sentinelles</span>
                  <span class="hud-value" id="hud-targets">0</span>
                </div>
              </div>
              <div id="crosshair" aria-hidden="true"></div>
              <div id="damage-flash"></div>
              <div id="hud-bottom">
                <div class="hud-box" id="ammo">Munitions <span id="hud-ammo">24</span> / <span id="hud-reserve">72</span></div>
                <div class="hud-box" id="objective">Objectif : Ã©liminez toutes les sentinelles du secteur.</div>
              </div>
            </div>
            <div id="overlay">
              <div class="card">
                <h2><em>Neon</em> Breach</h2>
                <p>FPS nÃ©on en vue subjective. Explorez le secteur, Ã©liminez les sentinelles et rÃ©cupÃ©rez des ressources.</p>
                <div class="keys">
                  <div><kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> / flÃ¨ches â€” dÃ©placement</div>
                  <div><kbd>Souris</kbd> â€” viser</div>
                  <div><kbd>Clic</kbd> â€” tirer</div>
                  <div><kbd>R</kbd> â€” recharger Â· <kbd>Ã‰chap</kbd> â€” pause</div>
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
        wrap.innerHTML = '<span class="neon-panel__text">Astuce : gardez vos distances, visez au centre et surveillez vos munitions.</span>';
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

  const wallGeo = new THREE.BoxGeometry(cell, 3.2, cell);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x0b2230, emissive: 0x082a36, emissiveIntensity: 0.45, metalness: 0.35, roughness: 0.55 });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x34f5d5, transparent: true, opacity: 0.35 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(map[0].length * cell, map.length * cell), new THREE.MeshStandardMaterial({ color: 0x07131d, metalness: 0.2, roughness: 0.8 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set((map[0].length * cell) / 2, 0, (map.length * cell) / 2); scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(map[0].length * cell, map.length * cell), new THREE.MeshStandardMaterial({ color: 0x040b12, emissive: 0x021018, roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set((map[0].length * cell) / 2, 3.2, (map.length * cell) / 2); scene.add(ceil);
  const grid = new THREE.GridHelper(Math.max(map.length, map[0].length) * cell, Math.max(map.length, map[0].length), 0x134455, 0x0b2430);
  grid.position.set((map[0].length * cell) / 2, 0.01, (map.length * cell) / 2); scene.add(grid);

  function isWallAt(wx, wz) {
    const gx = Math.floor(wx / cell), gz = Math.floor(wz / cell);
    if (gz < 0 || gz >= map.length || gx < 0 || gx >= map[0].length) return true;
    return map[gz][gx] === 1;
  }

  const pickups = [];
  const enemies = [];
  function addLight(x, y, z, color, intensity, dist) {
    const l = new THREE.PointLight(color, intensity, dist, 2);
    l.position.set(x, y, z); scene.add(l);
  }

  for (let z = 0; z < map.length; z++) {
    for (let x = 0; x < map[0].length; x++) {
      const t = map[z][x];
      const p = worldOf(x, z);
      if (t === 1) {
        const w = new THREE.Mesh(wallGeo, wallMat.clone());
        w.position.set(p.x, 1.6, p.z); scene.add(w);
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(wallGeo), edgeMat);
        edges.position.copy(w.position); scene.add(edges);
      } else {
        if ((x + z) % 4 === 0) addLight(p.x, 2.7, p.z, 0x32ffd8, 0.55, 10);
        if (t === 3) {
          const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), new THREE.MeshStandardMaterial({ color: 0x69ffe1, emissive: 0x2affd8, emissiveIntensity: 1.2, metalness: 0.1, roughness: 0.2 }));
          m.position.set(p.x, 1.1, p.z); scene.add(m);
          pickups.push({ mesh: m, type: 'health', amount: 35, baseY: 1.1, alive: true });
          addLight(p.x, 1.2, p.z, 0x2affd8, 0.5, 5);
        } else if (t === 4) {
          const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.35), new THREE.MeshStandardMaterial({ color: 0xffd36a, emissive: 0xffa020, emissiveIntensity: 1.0, roughness: 0.35 }));
          m.position.set(p.x, 1.0, p.z); scene.add(m);
          pickups.push({ mesh: m, type: 'ammo', amount: 18, baseY: 1.0, alive: true });
          addLight(p.x, 1.1, p.z, 0xffb020, 0.45, 5);
        }
      }
    }
  }

  function spawnEnemy(x, z) {
    const p = worldOf(x, z);
    const group = new THREE.Group();
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), new THREE.MeshStandardMaterial({ color: 0xff4f78, emissive: 0xff2d60, emissiveIntensity: 1.1, metalness: 0.2, roughness: 0.25 }));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.05, 8, 32), new THREE.MeshBasicMaterial({ color: 0xff8ab0, transparent: true, opacity: 0.9 }));
    ring.rotation.x = Math.PI / 2;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    eye.position.set(0, 0, 0.52);
    group.add(core, ring, eye);
    group.position.set(p.x, 1.3, p.z);
    scene.add(group);
    const light = new THREE.PointLight(0xff3366, 0.7, 7, 2); light.position.copy(group.position); scene.add(light);
    enemies.push({ group, light, hp: 60, alive: true, cooldown: Math.random() * 1.2, t: Math.random() * 10, base: p, phase: Math.random() * Math.PI * 2 });
  }
  spawnEnemy(7, 1); spawnEnemy(12, 1); spawnEnemy(5, 5); spawnEnemy(10, 7); spawnEnemy(2, 9); spawnEnemy(12, 11);

  const state = {
    running: false, over: false, won: false,
    health: 100, ammo: 24, reserve: 72,
    yaw: Math.PI * 0.75, pitch: 0,
    keys: Object.create(null),
    lastShot: 0, reloading: false, reloadT: 0,
    damageT: 0, time: 0
  };

  function isMoveKey(k, c, names) { return names.includes(k) || names.includes(c); }
  function moveForward() { const k = state.keys; return k['z'] || k['w'] || k['arrowup'] || k['keyw'] || k['keyz'] || k['arrowup_code']; }
  function moveBack() { const k = state.keys; return k['s'] || k['arrowdown'] || k['keys'] || k['arrowdown_code']; }
  function moveLeft() { const k = state.keys; return k['q'] || k['a'] || k['arrowleft'] || k['keya'] || k['keyq'] || k['arrowleft_code']; }
  function moveRight() { const k = state.keys; return k['d'] || k['arrowright'] || k['keyd'] || k['arrowright_code']; }

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

  function resetGame() {
    state.running = false; state.over = false; state.won = false;
    state.health = 100; state.ammo = 24; state.reserve = 72;
    state.yaw = Math.PI * 0.75; state.pitch = 0; state.reloading = false; state.reloadT = 0; state.damageT = 0;
    camera.position.set(6, 1.6, 6);
    camera.rotation.y = state.yaw; camera.rotation.x = state.pitch;
    camera.updateMatrixWorld();
    for (const e of enemies) { e.hp = 60; e.alive = true; e.group.visible = true; e.light.visible = true; e.cooldown = Math.random() * 1.2; }
    for (const p of pickups) { p.alive = true; p.mesh.visible = true; }
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
      if (!state.over && !state.won) setOverlay(true, '<em>Pause</em>', 'La souris a Ã©tÃ© libÃ©rÃ©e. Cliquez pour reprendre.', 'Reprendre');
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
    msgEl.textContent = 'Rechargementâ€¦';
    if (objectiveEl) objectiveEl.textContent = 'Rechargementâ€¦';
  }

  const raycaster = new THREE.Raycaster();
  const tmpV = new THREE.Vector3();
  function shoot() {
    if (!state.running || state.over || state.won) return;
    if (state.reloading) return;
    const now = performance.now() / 1000;
    if (now - state.lastShot < 0.14) return;
    if (state.ammo <= 0) { reload(); return; }
    state.lastShot = now; state.ammo--; syncHud();
    muzzleFlash();
    camera.getWorldDirection(tmpV);
    raycaster.set(camera.position, tmpV);
    const targets = enemies.filter(e => e.alive).map(e => e.group);
    const hits = raycaster.intersectObjects(targets, true);
    if (hits.length) {
      let obj = hits[0].object;
      while (obj && !obj.userData.enemyRef && obj.parent) obj = obj.parent;
      const ref = obj && obj.userData.enemyRef ? obj.userData.enemyRef : enemies.find(e => e.group === obj || e.group.children.includes(hits[0].object));
      if (ref && ref.alive) {
        ref.hp -= 34;
        spawnSparks(hits[0].point, 0xff6b8f);
        if (ref.hp <= 0) killEnemy(ref);
      }
    } else {
      spawnSparks(camera.position.clone().add(tmpV.clone().multiplyScalar(8)), 0x69ffe1, 4);
    }
    if (state.ammo === 0 && state.reserve > 0) reload();
  }
  window.addEventListener('mousedown', (e) => { if (e.button === 0) shoot(); });

  const flashLight = new THREE.PointLight(0x8ffff0, 0, 6, 2);
  flashLight.position.set(0.2, -0.15, -0.6); camera.add(flashLight); scene.add(camera);
  let flashT = 0;
  function muzzleFlash() { flashT = 0.06; flashLight.intensity = 2.2; }

  const sparks = [];
  function spawnSparks(pos, color, n = 10) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), new THREE.MeshBasicMaterial({ color }));
      m.position.copy(pos);
      const v = new THREE.Vector3((Math.random()-0.5)*4, (Math.random()-0.2)*4, (Math.random()-0.5)*4);
      scene.add(m); sparks.push({ m, v, life: 0.4 + Math.random()*0.3 });
    }
  }

  function killEnemy(e) {
    e.alive = false; e.group.visible = false; e.light.visible = false;
    spawnSparks(e.group.position.clone(), 0xff5f88, 24);
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
    setOverlay(true, '<em>Secteur sÃ©curisÃ©</em>', 'Toutes les sentinelles ont Ã©tÃ© neutralisÃ©es. Mission accomplie.', 'Rejouer', `SantÃ© restante : ${Math.max(0, Math.round(state.health))}`);
  }
  function lose() {
    state.over = true; state.running = false; document.exitPointerLock?.();
    setOverlay(true, 'Mission <em>Ã©chouÃ©e</em>', 'Vous avez Ã©tÃ© neutralisÃ© par les sentinelles du secteur.', 'RÃ©essayer', `Sentinelles restantes : ${enemies.filter(e=>e.alive).length}`);
  }

  for (const e of enemies) e.group.userData.enemyRef = e;

  function canMoveTo(nx, nz) {
    const r = 0.45;
    const pts = [[nx-r,nz-r],[nx+r,nz-r],[nx-r,nz+r],[nx+r,nz+r]];
    for (const [px,pz] of pts) if (isWallAt(px,pz)) return false;
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
      const s = sparks[i]; s.life -= dt; s.m.position.addScaledVector(s.v, dt); s.v.y -= 5 * dt; s.m.material.opacity = Math.max(0, s.life / 0.6); s.m.material.transparent = true;
      if (s.life <= 0) { scene.remove(s.m); sparks.splice(i,1); }
    }

    for (const p of pickups) {
      if (!p.alive) continue;
      p.mesh.rotation.y += dt * 1.6; p.mesh.position.y = p.baseY + Math.sin(state.time * 2 + p.baseY) * 0.12;
      const dx = camera.position.x - p.mesh.position.x, dz = camera.position.z - p.mesh.position.z;
      if (dx*dx + dz*dz < 1.2) {
        if (p.type === 'health' && state.health < 100) { state.health = Math.min(100, state.health + p.amount); p.alive = false; p.mesh.visible = false; syncHud(); }
        else if (p.type === 'ammo') { state.reserve = Math.min(120, state.reserve + p.amount); p.alive = false; p.mesh.visible = false; syncHud(); }
      }
    }

    if (state.reloading) {
      state.reloadT -= dt;
      if (state.reloadT <= 0) {
        const need = 24 - state.ammo; const take = Math.min(need, state.reserve);
        state.ammo += take; state.reserve -= take; state.reloading = false; msgEl.textContent = '';
        if (objectiveEl) objectiveEl.textContent = state.won ? 'Secteur sÃ©curisÃ©.' : 'Objectif : Ã©liminez toutes les sentinelles du secteur.';
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
        e.group.rotation.y += dt * 0.8;
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
            if (Math.random() < 0.55) { damagePlayer(8 + Math.random() * 6); spawnSparks(playerPos.clone().add(new THREE.Vector3((Math.random()-0.5)*0.5, -0.2, (Math.random()-0.5)*0.5)), 0xff5577, 6); }
          }
        } else {
          const ox = Math.sin(e.t * 0.7 + e.phase) * 0.4;
          const oz = Math.cos(e.t * 0.9 + e.phase) * 0.4;
          e.group.position.x += (e.base.x + ox - e.group.position.x) * dt * 0.8;
          e.group.position.z += (e.base.z + oz - e.group.position.z) * dt * 0.8;
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
