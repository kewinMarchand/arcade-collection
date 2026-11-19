import * as THREE from 'https://esm.sh/three@0.160.0';
import { mountGameFrame } from '../../packages/ui/src/gameFrame.js';

(() => {
  let host;
  mountGameFrame({
    mount: document.getElementById('shell-mount'),
    config: {
      title: 'Neon Breach',
      subtitle: 'Infiltrez le secteur, neutralisez les aliens, rejoignez la sortie.',
      renderHeader: () => {
        const options = document.createElement('div');
        options.className = 'game-options';
        options.setAttribute('aria-label', 'Options de jeu');
        options.innerHTML = '<span class="option">FPS néon · mini-carte · extraction</span>';
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
            p.textContent = 'Éliminez tous les drones aliens pour activer la porte de sortie, puis rejoignez-la pour extraire du secteur.';
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
              'Clic gauche : tirer (orbes de slime collantes)',
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
                <div class="hud-box minimap-box" style="text-align:right">
                  <span class="hud-label">Mini-carte</span>
                  <span class="hud-value" id="hud-targets">0</span><span class="hud-label" style="display:inline;margin-left:4px">aliens</span>
                  <div id="minimap-wrap"><canvas id="minimap" width="180" height="180" aria-label="Mini-carte"></canvas></div>
                </div>
              </div>
              <div id="crosshair" aria-hidden="true"></div>
              <div id="damage-flash"></div>
              <div id="hud-bottom">
                <div class="hud-box" id="ammo">Munitions <span id="hud-ammo">24</span> / <span id="hud-reserve">72</span></div>
                <div class="hud-box" id="objective">Objectif : éliminez tous les aliens pour activer la sortie.</div>
              </div>
            </div>
            <div id="overlay">
              <div class="card">
                <h2><em>Neon</em> Breach</h2>
                <p>FPS néon : éliminez les vaisseaux aliens, puis rejoignez la porte d'extraction pour terminer le niveau.</p>
                <div class="keys">
                  <div><kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> / flèches — déplacement</div>
                  <div><kbd>Souris</kbd> — viser</div>
                  <div><kbd>Clic</kbd> — tirer (slime collant)</div>
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
        wrap.innerHTML = '<span class="neon-panel__text">Mini-carte : ▲ vous · rouge aliens · or munitions · vert sortie active.</span>';
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
  const minimap = host.querySelector('#minimap');
  const mmCtx = minimap.getContext('2d');
  const panelHealth = () => document.getElementById('panel-health');
  const panelAmmo = () => document.getElementById('panel-ammo');
  const panelTargets = () => document.getElementById('panel-targets');

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x02060a, 1);
  host.insertBefore(renderer.domElement, host.firstChild);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x031017, 0.04);
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 120);
  camera.rotation.order = 'YXZ';
  camera.position.set(6, 1.6, 6);

  scene.add(new THREE.AmbientLight(0x49ddff, 0.42));
  scene.add(new THREE.HemisphereLight(0x35bfff, 0x041018, 0.55));

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
  const slimeSplats = [];
  const slimeDrips = [];

  const LIMITS = { splats: 28, drips: 40, sparks: 40 };
  const sharedBulletGeo = new THREE.SphereGeometry(0.14, 12, 12);
  const sharedBulletMat = new THREE.MeshStandardMaterial({ color: 0x9aff5c, emissive: 0x5cff2a, emissiveIntensity: 1.5, metalness: 0.0, roughness: 0.2, transparent: true, opacity: 0.95 });
  const sharedSparkGeo = new THREE.SphereGeometry(0.04, 6, 6);
  const sharedSplatGeo = new THREE.SphereGeometry(1, 10, 8); // scaled per splat
  const sharedDripGeo = new THREE.SphereGeometry(1, 7, 7); // scaled per drip
  let resizeQueued = false;

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
    // Sleek, detailed invader ship/craft (appealing neon silhouette)
    const g = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x123243, emissive: colorHex, emissiveIntensity: 0.38, metalness: 0.58, roughness: 0.22 });
    const accentMat = new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.7, metalness: 0.3, roughness: 0.22 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x08131a, emissive: 0x020709, roughness: 0.8, metalness: 0.1 });
    const canopyMat = new THREE.MeshPhysicalMaterial({ color: 0xdffcff, emissive: colorHex, emissiveIntensity: 0.55, metalness: 0.0, roughness: 0.04, transparent: true, opacity: 0.78, transmission: 0.05 });
    const glowMat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.95 });

    // main saucer hull
    const saucer = new THREE.Mesh(new THREE.SphereGeometry(0.5, 22, 16), hullMat);
    saucer.scale.set(1.5, 0.42, 1.18);
    g.add(saucer);

    // underglow disc
    const under = new THREE.Mesh(new THREE.CircleGeometry(0.48, 24), new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
    under.rotation.x = Math.PI / 2;
    under.position.set(0, -0.2, 0);
    g.add(under);

    // upper dome/cockpit
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.25, 18, 14, 0, Math.PI * 2, 0, Math.PI / 2), canopyMat);
    dome.position.set(0, 0.1, 0.08);
    dome.scale.set(1.18, 1.0, 1.18);
    g.add(dome);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    core.position.set(0, 0.06, 0.22);
    g.add(core);

    // lower fuselage pod
    const pod = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.24, 6, 12), hullMat);
    pod.rotation.x = Math.PI / 2;
    pod.position.set(0, -0.17, 0.04);
    g.add(pod);

    // wings
    const wingGeo = new THREE.BoxGeometry(0.66, 0.055, 0.36);
    const wL = new THREE.Mesh(wingGeo, accentMat); wL.position.set(-0.7, -0.02, -0.02); wL.rotation.z = 0.24; wL.rotation.y = 0.2; g.add(wL);
    const wR = new THREE.Mesh(wingGeo, accentMat); wR.position.set(0.7, -0.02, -0.02); wR.rotation.z = -0.24; wR.rotation.y = -0.2; g.add(wR);
    const wingTipMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    const wingTipL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), wingTipMat); wingTipL.position.set(-1.02, 0.07, -0.04); g.add(wingTipL);
    const wingTipR = wingTipL.clone(); wingTipR.position.x = 1.02; g.add(wingTipR);

    // tail fins
    const finGeo = new THREE.BoxGeometry(0.045, 0.26, 0.22);
    const finMat = new THREE.MeshStandardMaterial({ color: 0x163d4d, emissive: colorHex, emissiveIntensity: 0.35, metalness: 0.4, roughness: 0.3 });
    const finL = new THREE.Mesh(finGeo, finMat); finL.position.set(-0.15, 0.18, -0.4); finL.rotation.z = 0.28; g.add(finL);
    const finR = finL.clone(); finR.position.set(0.15, 0.18, -0.4); finR.rotation.z = -0.28; g.add(finR);

    // engine ring / thrusters
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.03, 10, 28), glowMat);
    ring.rotation.x = Math.PI / 2; ring.position.set(0, -0.2, -0.2); g.add(ring);
    const thruster = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.17, 12), accentMat);
    thruster.rotation.x = -Math.PI / 2; thruster.position.set(0, -0.22, -0.38); g.add(thruster);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
    flame.rotation.x = -Math.PI / 2; flame.position.set(0, -0.22, -0.49); g.add(flame);

    // front sensor / eyes integrated as ship lights
    for (const sx of [-0.18, 0.18]) {
      const socket = new THREE.Mesh(new THREE.SphereGeometry(0.058, 10, 8), darkMat);
      socket.position.set(sx, 0.0, 0.54); socket.scale.set(1, 1, 0.55); g.add(socket);
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      light.position.set(sx, 0.01, 0.575); g.add(light);
      const glow = new THREE.Mesh(new THREE.CircleGeometry(0.07, 12), new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
      glow.position.set(sx, 0.01, 0.585); g.add(glow);
    }

    // trim bars
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.028, 0.035), glowMat);
    bar.position.set(0, -0.045, 0.48); g.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.55), new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.45 }));
    bar2.position.set(0, 0.17, -0.03); g.add(bar2);

    // outline for crisp style
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.SphereGeometry(0.5, 14, 10)), new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity: 0.22 }));
    edges.scale.copy(saucer.scale);
    g.add(edges);

    g.userData.kind = 'alien';
    g.userData.variant = idx % 5;
    return g;
  }

  function makeHealthPickup() {
    const g = new THREE.Group();
    const cyan = new THREE.MeshStandardMaterial({ color: 0x69ffe1, emissive: 0x2affd8, emissiveIntensity: 1.1, metalness: 0.25, roughness: 0.25 });
    const white = new THREE.MeshStandardMaterial({ color: 0xeaffff, emissive: 0x9dfff0, emissiveIntensity: 0.6, metalness: 0.1, roughness: 0.3 });
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.55, 4), cyan);
    body.rotation.x = Math.PI; body.rotation.y = Math.PI / 4; g.add(body);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 0.18), cyan); wing.position.y = -0.05; g.add(wing);
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), white); cockpit.position.set(0, 0.08, 0.08); g.add(cockpit);
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 0.14, 10), new THREE.MeshBasicMaterial({ color: 0x7bffe5 })); engine.position.y = -0.28; g.add(engine);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.025, 8, 24), new THREE.MeshBasicMaterial({ color: 0x69ffe1, transparent: true, opacity: 0.8 })); halo.rotation.x = Math.PI / 2; g.add(halo);
    g.scale.setScalar(1.05);
    return g;
  }

  function makeAmmoPickup() {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e2a33, emissive: 0x0b141c, metalness: 0.7, roughness: 0.28 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xffd36b, emissive: 0xffa020, emissiveIntensity: 1.15, metalness: 0.4, roughness: 0.25 });
    const glow = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    const trim = new THREE.MeshBasicMaterial({ color: 0xffc85a, transparent: true, opacity: 0.9 });

    const caseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.44, 0.24), bodyMat);
    g.add(caseMesh);
    const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.36, 0.44, 0.24)), new THREE.LineBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.5 }));
    g.add(frame);

    for (let i = 0; i < 3; i++) {
      const cellMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.32, 12), gold);
      cellMesh.position.set(-0.095 + i * 0.095, 0.0, 0.125);
      g.add(cellMesh);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), glow);
      tip.position.set(-0.095 + i * 0.095, 0.17, 0.125);
      g.add(tip);
    }

    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.07, 0.26), gold);
    cap.position.y = 0.23; g.add(cap);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.06, 0.26), gold);
    base.position.y = -0.23; g.add(base);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.028, 8, 30), trim);
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.0; g.add(ring);

    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe08a, emissiveIntensity: 1.2, metalness: 0.2, roughness: 0.1 }));
    core.position.set(0, 0.34, 0); g.add(core);

    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.02), new THREE.MeshBasicMaterial({ color: 0x101820 }));
    plate.position.set(0, 0.02, 0.131); g.add(plate);
    for (let i = 0; i < 3; i++) {
      const ind = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.025, 0.01), glow);
      ind.position.set(0, 0.06 - i * 0.05, 0.145); g.add(ind);
    }

    g.scale.setScalar(1.1);
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
          pickups.push({ mesh: m, type: 'health', amount: 35, baseY: 1.1, alive: true });
          addLight(p.x, 1.2, p.z, 0x2affd8, 0.5, 5);
        } else if (t === 4) {
          const m = makeAmmoPickup();
          m.position.set(p.x, 1.0, p.z);
          scene.add(m);
          pickups.push({ mesh: m, type: 'ammo', amount: 18, baseY: 1.0, alive: true });
          addLight(p.x, 1.1, p.z, 0xffb020, 0.45, 5);
        }
      }
    }
  }

  const exitCell = { x: 12, z: 12 };
  const exitPos = worldOf(exitCell.x, exitCell.z);
  const exitGroup = new THREE.Group();
  const exitFrameMat = new THREE.MeshStandardMaterial({ color: 0x1c2e38, emissive: 0x102028, metalness: 0.5, roughness: 0.4 });
  const exitFrame = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.0, 0.35), exitFrameMat);
  exitFrame.position.y = 1.5;
  exitGroup.add(exitFrame);
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.35), new THREE.MeshBasicMaterial({ color: 0x33151b, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  inner.position.set(0, 1.45, 0.19);
  exitGroup.add(inner);
  const inner2 = inner.clone(); inner2.position.z = -0.19; exitGroup.add(inner2);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.07, 12, 48), new THREE.MeshBasicMaterial({ color: 0xff6b5f, transparent: true, opacity: 0.95 }));
  rim.position.set(0, 1.5, 0.22);
  exitGroup.add(rim);
  const rim2 = rim.clone(); rim2.position.z = -0.22; exitGroup.add(rim2);
  const topLightMesh = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: 0xff6b5f }));
  topLightMesh.position.set(0, 2.78, 0.2); exitGroup.add(topLightMesh);
  const sideA = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.4, 0.08), new THREE.MeshBasicMaterial({ color: 0xff6b5f, transparent: true, opacity: 0.8 }));
  sideA.position.set(-1.05, 1.35, 0.2); exitGroup.add(sideA);
  const sideB = sideA.clone(); sideB.position.x = 1.05; exitGroup.add(sideB);
  exitGroup.position.set(exitPos.x, 0, exitPos.z);
  scene.add(exitGroup);

  const pad = new THREE.Mesh(new THREE.RingGeometry(0.7, 1.05, 40), new THREE.MeshBasicMaterial({ color: 0xff6b5f, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
  pad.rotation.x = -Math.PI / 2; pad.position.set(exitPos.x, 0.03, exitPos.z);
  scene.add(pad);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 0.2, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0xff6b5f, transparent: true, opacity: 0.18, side: THREE.DoubleSide }));
  beam.position.set(exitPos.x, 1.2, exitPos.z);
  scene.add(beam);

  const exitLight = new THREE.PointLight(0xff5a4a, 0.9, 9, 2);
  exitLight.position.set(exitPos.x, 1.8, exitPos.z);
  scene.add(exitLight);
  const exitState = { active: false, mesh: inner, mesh2: inner2, rim, rim2, topLightMesh, sideA, sideB, pad, beam, light: exitLight };

  const alienColors = [0xff65b5, 0xffad5c, 0xffe36e, 0x79ffd0, 0x75caff];
  function spawnEnemy(x, z, idx) {
    const p = worldOf(x, z);
    const color = alienColors[idx % alienColors.length];
    const group = makeAlien(color, idx);
    group.position.set(p.x, 1.3, p.z);
    scene.add(group);
    const light = new THREE.PointLight(color, 0.75, 7, 2);
    light.position.copy(group.position);
    scene.add(light);
    enemies.push({ group, light, hp: 60, alive: true, cooldown: Math.random() * 1.2, t: Math.random() * 10, base: p, phase: Math.random() * Math.PI * 2, radius: 0.58 });
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

  function updateExitVisual() {
    const active = enemies.every(e => !e.alive);
    exitState.active = active;
    const color = active ? 0x58ff9a : 0xff6b5f;
    const portal = active ? 0x1aff88 : 0x33151b;
    exitState.mesh.material.color.setHex(portal);
    exitState.mesh2.material.color.setHex(portal);
    exitState.mesh.material.opacity = active ? 0.5 : 0.85;
    exitState.mesh2.material.opacity = active ? 0.5 : 0.85;
    for (const m of [exitState.rim, exitState.rim2, exitState.topLightMesh, exitState.sideA, exitState.sideB, exitState.pad, exitState.beam]) m.material.color.setHex(color);
    exitState.light.color.setHex(color);
    exitState.light.intensity = active ? 1.6 : 0.7;
    exitState.beam.material.opacity = active ? 0.28 : 0.12;
    exitState.pad.material.opacity = active ? 0.55 : 0.25;
  }

  function syncHud() {
    const left = enemies.filter(e => e.alive).length;
    hudHealth.textContent = String(Math.max(0, Math.round(state.health)));
    hudTargets.textContent = String(left);
    hudAmmo.textContent = String(state.ammo);
    hudReserve.textContent = String(state.reserve);
    healthBar.style.width = `${Math.max(0, Math.min(100, state.health))}%`;
    const ph = panelHealth(), pa = panelAmmo(), pt = panelTargets();
    if (ph) ph.textContent = String(Math.max(0, Math.round(state.health)));
    if (pa) pa.textContent = `${state.ammo}/${state.reserve}`;
    if (pt) pt.textContent = String(left);
    updateExitVisual();
    if (objectiveEl && !state.reloading && !state.won && !state.over) {
      objectiveEl.textContent = left > 0
        ? `Objectif : éliminez ${left} alien${left > 1 ? 's' : ''} pour activer la sortie.`
        : 'Sortie activée : rejoignez la porte verte (bas-droite sur la carte) pour extraire.';
    }
  }

  function resize() {
    const w = host.clientWidth || 900, h = host.clientHeight || 560;
    if (w < 2 || h < 2) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => resize());
    ro.observe(host);
  } else {
    window.addEventListener('resize', resize);
  }
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
  function clearSlimes() {
    for (const s of slimeSplats) { scene.remove(s.mesh); s.mesh.material?.dispose?.(); }
    slimeSplats.length = 0;
    for (const d of slimeDrips) { scene.remove(d.mesh); d.mesh.material?.dispose?.(); }
    slimeDrips.length = 0;
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
    clearSlimes();
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

  function stickSlime(pos, normal, scale = 1) {
    if (slimeSplats.length >= LIMITS.splats) {
      const old = slimeSplats.shift();
      if (old) { scene.remove(old.mesh); old.mesh.material?.dispose?.(); }
    }
    const r = 0.22 * scale + Math.random() * 0.1 * scale;
    const mat = new THREE.MeshStandardMaterial({ color: 0x6dff4a, emissive: 0x39ff14, emissiveIntensity: 0.9, transparent: true, opacity: 0.92, roughness: 0.25, metalness: 0.05 });
    const m = new THREE.Mesh(sharedSplatGeo, mat);
    m.position.copy(pos).addScaledVector(normal, 0.03);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal.clone().normalize());
    m.quaternion.copy(q);
    m.scale.set(r * 1.25, r * 0.45, r * 1.25);
    scene.add(m);
    slimeSplats.push({ mesh: m, life: 9 + Math.random() * 5, wobble: Math.random() * Math.PI * 2, baseX: m.scale.x, baseY: m.scale.y, baseZ: m.scale.z });
    // little droplets
    for (let i = 0; i < 2; i++) {
      if (slimeDrips.length >= LIMITS.drips) {
        const od = slimeDrips.shift();
        if (od) { scene.remove(od.mesh); od.mesh.material?.dispose?.(); }
      }
      const dr = 0.045 + Math.random() * 0.035;
      const dm = new THREE.Mesh(sharedDripGeo, new THREE.MeshBasicMaterial({ color: 0x7cff5a, transparent: true, opacity: 0.9 }));
      dm.scale.setScalar(dr);
      dm.position.copy(m.position).add(new THREE.Vector3((Math.random()-0.5)*0.16, (Math.random()-0.2)*0.1, (Math.random()-0.5)*0.16));
      scene.add(dm);
      slimeDrips.push({ mesh: dm, vel: normal.clone().multiplyScalar(0.15).add(new THREE.Vector3((Math.random()-0.5)*0.5, -0.15 - Math.random()*0.35, (Math.random()-0.5)*0.5)), life: 0.5 + Math.random()*0.4, gravity: 2.5, stick: false, maxLife: 0.9 });
    }
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
    const mesh = new THREE.Mesh(sharedBulletGeo, sharedBulletMat);
    mesh.position.copy(pos);
    scene.add(mesh);
    const vel = dir.multiplyScalar(22);
    bullets.push({ mesh, vel, life: 2.6, radius: 0.14 });
    if (state.ammo === 0 && state.reserve > 0) reload();
  }
  window.addEventListener('mousedown', (e) => { if (e.button === 0) shoot(); });

  const flashLight = new THREE.PointLight(0x8ffff0, 0, 6, 2);
  flashLight.position.set(0.2, -0.15, -0.6);
  camera.add(flashLight);
  scene.add(camera);
  let flashT = 0;
  function muzzleFlash() { flashT = 0.06; flashLight.intensity = 2.2; }

  function spawnSparks(pos, color, n = 6) {
    for (let i = 0; i < n; i++) {
      if (sparks.length >= LIMITS.sparks) {
        const old = sparks.shift();
        if (old) { scene.remove(old.m); old.m.material?.dispose?.(); }
      }
      const m = new THREE.Mesh(sharedSparkGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }));
      m.position.copy(pos);
      const v = new THREE.Vector3((Math.random() - 0.5) * 4, (Math.random() - 0.2) * 4, (Math.random() - 0.5) * 4);
      scene.add(m);
      sparks.push({ m, v, life: 0.35 + Math.random() * 0.25, max: 0.6 });
    }
  }

  function spawnSlimeBlood(pos, baseColor = 0x6dff4a) {
    // explosion burst + bleeding slime
    for (let i = 0; i < 10; i++) {
      if (slimeDrips.length >= LIMITS.drips) {
        const od = slimeDrips.shift();
        if (od) { scene.remove(od.mesh); od.mesh.material?.dispose?.(); }
      }
      const r = 0.05 + Math.random() * 0.07;
      const m = new THREE.Mesh(sharedDripGeo, new THREE.MeshStandardMaterial({ color: baseColor, emissive: 0x39ff14, emissiveIntensity: 0.8, transparent: true, opacity: 0.95, roughness: 0.3 }));
      m.scale.setScalar(r);
      m.position.copy(pos).add(new THREE.Vector3((Math.random()-0.5)*0.25, (Math.random()-0.5)*0.25, (Math.random()-0.5)*0.25));
      scene.add(m);
      const v = new THREE.Vector3((Math.random() - 0.5) * 4.5, Math.random() * 3.2 + 0.4, (Math.random() - 0.5) * 4.5);
      slimeDrips.push({ mesh: m, vel: v, life: 1.0 + Math.random() * 1.1, maxLife: 2.1, gravity: 5.5, stick: true, wobble: Math.random()*6 });
    }
    spawnSparks(pos, 0xbaff7a, 5);
  }

  function killEnemy(e) {
    e.alive = false; e.group.visible = false; e.light.visible = false;
    spawnSlimeBlood(e.group.position.clone(), 0x6dff4a);
    syncHud();
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
    setOverlay(true, '<em>Extraction réussie</em>', 'Vous avez rejoint la porte d\'extraction. Niveau terminé.', 'Rejouer', `Santé restante : ${Math.max(0, Math.round(state.health))}`);
  }
  function lose() {
    state.over = true; state.running = false; document.exitPointerLock?.();
    setOverlay(true, 'Mission <em>échouée</em>', 'Vous avez été neutralisé par les drones du secteur.', 'Réessayer', `Aliens restants : ${enemies.filter(e => e.alive).length}`);
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

  function drawMinimap() {
    const w = minimap.width, h = minimap.height;
    const cs = Math.min((w - 8) / map[0].length, (h - 8) / map.length);
    const ox = (w - cs * map[0].length) / 2;
    const oy = (h - cs * map.length) / 2;
    mmCtx.clearRect(0, 0, w, h);
    mmCtx.fillStyle = 'rgba(6,16,22,0.98)';
    mmCtx.fillRect(0, 0, w, h);

    for (let z = 0; z < map.length; z++) {
      for (let x = 0; x < map[0].length; x++) {
        const px = ox + x * cs, py = oy + z * cs;
        if (map[z][x] === 1) {
          mmCtx.fillStyle = '#274657';
          mmCtx.fillRect(px, py, cs, cs);
          mmCtx.strokeStyle = 'rgba(80,170,200,0.18)';
          mmCtx.strokeRect(px + 0.5, py + 0.5, cs - 1, cs - 1);
        } else {
          mmCtx.fillStyle = '#0b1821';
          mmCtx.fillRect(px, py, cs, cs);
        }
      }
    }

    const ex = ox + exitCell.x * cs + cs / 2, ey = oy + exitCell.z * cs + cs / 2;
    mmCtx.fillStyle = exitState.active ? '#58ff9a' : '#ff6b5f';
    mmCtx.beginPath();
    mmCtx.arc(ex, ey, Math.max(3.5, cs * 0.32), 0, Math.PI * 2);
    mmCtx.fill();
    if (exitState.active) {
      mmCtx.strokeStyle = 'rgba(88,255,154,0.7)';
      mmCtx.lineWidth = 2;
      mmCtx.beginPath(); mmCtx.arc(ex, ey, Math.max(5, cs * 0.45), 0, Math.PI * 2); mmCtx.stroke();
    }

    for (const p of pickups) {
      if (!p.alive) continue;
      const gx = ox + (p.mesh.position.x / cell - 0.5) * cs + cs / 2;
      const gz = oy + (p.mesh.position.z / cell - 0.5) * cs + cs / 2;
      mmCtx.fillStyle = p.type === 'ammo' ? '#ffd36b' : '#69ffe1';
      mmCtx.beginPath();
      mmCtx.arc(gx, gz, Math.max(2.2, cs * 0.18), 0, Math.PI * 2);
      mmCtx.fill();
    }

    for (const e of enemies) {
      if (!e.alive) continue;
      const gx = ox + (e.group.position.x / cell - 0.5) * cs + cs / 2;
      const gz = oy + (e.group.position.z / cell - 0.5) * cs + cs / 2;
      mmCtx.fillStyle = '#ff4f78';
      mmCtx.beginPath();
      mmCtx.arc(gx, gz, Math.max(2.5, cs * 0.22), 0, Math.PI * 2);
      mmCtx.fill();
      mmCtx.strokeStyle = 'rgba(255,180,200,0.7)';
      mmCtx.lineWidth = 1;
      mmCtx.stroke();
    }

    const px = ox + (camera.position.x / cell - 0.5) * cs + cs / 2;
    const py = oy + (camera.position.z / cell - 0.5) * cs + cs / 2;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const ang = Math.atan2(dir.x, dir.z);
    mmCtx.save();
    mmCtx.translate(px, py);
    mmCtx.rotate(ang);
    mmCtx.fillStyle = 'rgba(105,255,225,0.18)';
    mmCtx.beginPath(); mmCtx.moveTo(0, 0); mmCtx.lineTo(-5, -10); mmCtx.lineTo(5, -10); mmCtx.closePath(); mmCtx.fill();
    mmCtx.fillStyle = '#69ffe1';
    mmCtx.beginPath(); mmCtx.moveTo(0, -6); mmCtx.lineTo(4.5, 4.5); mmCtx.lineTo(-4.5, 4.5); mmCtx.closePath(); mmCtx.fill();
    mmCtx.restore();
  }

  const clock = new THREE.Clock();
  function tick() {
    requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.05);
    state.time += dt;

    if (flashT > 0) { flashT -= dt; if (flashT <= 0) flashLight.intensity = 0; }
    if (state.damageT > 0) { state.damageT -= dt; if (state.damageT <= 0) damageFlash.style.opacity = '0'; }

    const pulse = 1 + 0.08 * Math.sin(state.time * (exitState.active ? 4 : 1.5));
    exitState.rim.rotation.z += dt * (exitState.active ? 1.8 : 0.4);
    exitState.rim2.rotation.z -= dt * (exitState.active ? 1.8 : 0.4);
    exitState.pad.scale.setScalar(pulse);
    exitState.beam.scale.set(1, 0.8 + 0.5 * Math.sin(state.time * 3), 1);

    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.life -= dt;
      s.m.position.addScaledVector(s.v, dt);
      s.v.y -= 5 * dt;
      s.m.material.opacity = Math.max(0, s.life / (s.max || 0.6));
      s.m.material.transparent = true;
      if (s.life <= 0) { scene.remove(s.m); s.m.material.dispose(); sparks.splice(i, 1); }
    }

    for (let i = slimeDrips.length - 1; i >= 0; i--) {
      const d = slimeDrips[i];
      d.life -= dt;
      d.vel.y -= (d.gravity || 4) * dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      if (d.mesh.position.y <= 0.04) {
        d.mesh.position.y = 0.04;
        if (d.stick && Math.random() < 0.35) {
          stickSlime(d.mesh.position.clone(), new THREE.Vector3(0, 1, 0), 0.65);
          scene.remove(d.mesh); d.mesh.material.dispose(); slimeDrips.splice(i, 1); continue;
        } else {
          d.vel.y *= -0.15; d.vel.x *= 0.5; d.vel.z *= 0.5;
        }
      }
      const maxLife = d.maxLife || 1.8;
      d.mesh.material.opacity = Math.max(0, Math.min(0.95, d.life / maxLife + 0.15));
      if (d.life <= 0) { scene.remove(d.mesh); d.mesh.material.dispose(); slimeDrips.splice(i, 1); }
    }

    for (let i = slimeSplats.length - 1; i >= 0; i--) {
      const s = slimeSplats[i];
      s.life -= dt;
      s.wobble += dt * 1.5;
      const w = 1 + Math.sin(s.wobble) * 0.03;
      const bx = s.baseX || s.mesh.scale.x, by = s.baseY || s.mesh.scale.y, bz = s.baseZ || s.mesh.scale.z;
      s.mesh.scale.set(bx * w, by, bz / w);
      if (s.life < 3) s.mesh.material.opacity = Math.max(0, (s.life / 3) * 0.92);
      if (s.life <= 0) { scene.remove(s.mesh); s.mesh.material.dispose(); slimeSplats.splice(i, 1); }
    }

    const simActive = state.running && !state.over && !state.won;

    if (simActive) {
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
        const prev = b.mesh.position.clone();
        b.mesh.position.addScaledVector(b.vel, dt);

        let stuck = false, normal = new THREE.Vector3(0, 1, 0);
        let hitPos = b.mesh.position.clone();
        if (b.mesh.position.y <= b.radius) {
          hitPos.set(b.mesh.position.x, b.radius, b.mesh.position.z); normal.set(0, 1, 0); stuck = true;
        } else if (b.mesh.position.y >= 3.2 - b.radius) {
          hitPos.set(b.mesh.position.x, 3.2 - b.radius, b.mesh.position.z); normal.set(0, -1, 0); stuck = true;
        }
        if (!stuck && isWallAt(b.mesh.position.x, prev.z)) {
          hitPos.set(b.mesh.position.x, b.mesh.position.y, prev.z); normal.set(Math.sign(prev.x - b.mesh.position.x) || 1, 0, 0); stuck = true;
        }
        if (!stuck && isWallAt(prev.x, b.mesh.position.z)) {
          hitPos.set(prev.x, b.mesh.position.y, b.mesh.position.z); normal.set(0, 0, Math.sign(prev.z - b.mesh.position.z) || 1); stuck = true;
        }
        if (!stuck && isWallAt(b.mesh.position.x, b.mesh.position.z)) {
          hitPos.copy(prev); normal.set(Math.sign(prev.x - b.mesh.position.x) || 0, 0, Math.sign(prev.z - b.mesh.position.z) || 1); if (normal.lengthSq() === 0) normal.set(0,1,0); normal.normalize(); stuck = true;
        }

        let hit = false;
        for (const e of enemies) {
          if (!e.alive) continue;
          const dx = b.mesh.position.x - e.group.position.x;
          const dy = b.mesh.position.y - e.group.position.y;
          const dz = b.mesh.position.z - e.group.position.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist < b.radius + e.radius) {
            e.hp -= 34;
            spawnSparks(b.mesh.position.clone(), 0x9aff5c, 5);
            if (e.hp <= 0) killEnemy(e);
            hit = true;
            break;
          }
        }

        if (stuck) {
          stickSlime(hitPos, normal, 1);
          scene.remove(b.mesh);
          bullets.splice(i, 1);
        } else if (hit || b.life <= 0) {
          if (hit) stickSlime(b.mesh.position.clone(), new THREE.Vector3(0, 1, 0), 0.55);
          scene.remove(b.mesh);
          bullets.splice(i, 1);
        }
      }

      if (state.reloading) {
        state.reloadT -= dt;
        if (state.reloadT <= 0) {
          const need = 24 - state.ammo; const take = Math.min(need, state.reserve);
          state.ammo += take; state.reserve -= take; state.reloading = false; msgEl.textContent = '';
          syncHud();
        }
      }

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
            if (Math.random() < 0.55) { damagePlayer(8 + Math.random() * 6); spawnSparks(playerPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, -0.2, (Math.random() - 0.5) * 0.5)), 0xff5577, 4); }
          }
        } else {
          const ox = Math.sin(e.t * 0.7 + e.phase) * 0.4;
          const oz = Math.cos(e.t * 0.9 + e.phase) * 0.4;
          e.group.position.x += (e.base.x + ox - e.group.position.x) * dt * 0.8;
          e.group.position.z += (e.base.z + oz - e.group.position.z) * dt * 0.8;
          e.group.rotation.y += dt * 0.6;
        }
      }

      if (exitState.active) {
        const dx = camera.position.x - exitPos.x;
        const dz = camera.position.z - exitPos.z;
        if (dx * dx + dz * dz < 1.7 * 1.7) win();
      }
    }

    drawMinimap();
    renderer.render(scene, camera);
  }

  syncHud();
  requestAnimationFrame(tick);
})();
