
import { mountGameFrame } from '../../../packages/ui/src/gameFrame.js';

    (() => {
      const shell = mountGameFrame({
        mount: document.getElementById('shell-mount'),
        config: {
          title: 'Neon Invaders',
          subtitle: 'Défendez la base · Secteur 07',
          renderHeader: () => {
            const options = document.createElement('div');
            options.className = 'game-options';
            options.setAttribute('aria-label', 'Options de jeu');
            const difficulty = document.createElement('label');
            difficulty.className = 'option';
            difficulty.textContent = 'Difficulté';
            const select = document.createElement('select');
            select.id = 'difficulty';
            select.setAttribute('aria-label', 'Difficulté');
            select.innerHTML = '<option value="chill">Chill</option><option value="arcade" selected>Arcade</option><option value="chaos">Chaos ✦</option>';
            difficulty.appendChild(select);
            const powerups = document.createElement('label');
            powerups.className = 'option';
            const powerupsInput = document.createElement('input');
            powerupsInput.id = 'powerups';
            powerupsInput.className = 'toggle';
            powerupsInput.type = 'checkbox';
            powerupsInput.checked = true;
            powerups.textContent = 'Bonus surprises';
            powerups.appendChild(powerupsInput);
            const sound = document.createElement('label');
            sound.className = 'option';
            const soundInput = document.createElement('input');
            soundInput.id = 'sound';
            soundInput.className = 'toggle';
            soundInput.type = 'checkbox';
            sound.textContent = 'Sons rétro';
            sound.appendChild(soundInput);
            options.append(difficulty, powerups, sound);
            return options;
          },
          panels: [
            {
              side: 'left',
              id: 'briefing',
              render: () => {
                const panel = document.createElement('div');
                panel.className = 'neon-panel';
                panel.dataset.testid = 'game-panel-left';
                const title = document.createElement('h2');
                title.className = 'neon-panel__title';
                title.textContent = 'Briefing';
                const p = document.createElement('p');
                p.className = 'neon-panel__text';
                p.textContent = 'Défendez la base contre la flotte. Options de partie dans le header.';
                panel.append(title, p);
                return panel;
              },
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
                const li = (text) => {
                  const l = document.createElement('li');
                  l.className = 'neon-panel__text';
                  l.textContent = text;
                  ul.appendChild(l);
                };
                li('ESPACE : tir');
                li('A / D ou ← → : déplacement');
                li('Tactile : boutons ◀ ▶ ▪ tir');
                panel.append(title, ul);

                const controls = document.createElement('div');
                controls.className = 'controls';
                controls.setAttribute('aria-label', 'Commandes');
                const control = (keys, text) => {
                  const span = document.createElement('span');
                  span.className = 'control';
                  for (const k of keys) {
                    const kbd = document.createElement('kbd');
                    kbd.textContent = k;
                    span.appendChild(kbd);
                  }
                  const t = document.createElement('span');
                  t.textContent = text;
                  span.appendChild(t);
                  controls.appendChild(span);
                };
                control([' ', 'ESPACE'], 'Tir');
                control(['A', 'D'], 'Déplacement');
                panel.appendChild(controls);

                const touch = document.createElement('div');
                touch.className = 'touch-controls';
                touch.setAttribute('aria-label', 'Commandes tactiles');
                for (const action of ['left', 'fire', 'right']) {
                  const button = document.createElement('button');
                  button.type = 'button';
                  button.dataset.action = action;
                  button.setAttribute('aria-label', action === 'fire' ? 'TIR ✦' : action === 'left' ? 'Aller à gauche' : 'Aller à droite');
                  button.textContent = action === 'fire' ? 'TIR ✦' : action === 'left' ? '◀' : '▶';
                  touch.appendChild(button);
                }
                panel.appendChild(touch);
                return panel;
              },
            },
          ],
          screen: {
            mount: (el) => {
              const canvas = document.createElement('canvas');
              canvas.id = 'gameCanvas';
              canvas.width = 900;
              canvas.height = 600;
              canvas.setAttribute('aria-label', 'Jeu Neon Invaders');
              el.appendChild(canvas);
            },
          },
          footer: () => {
            const wrap = document.createElement('div');
            wrap.className = 'game-footer';
            const below = document.createElement('div');
            below.className = 'below';
            const controls = document.createElement('div');
            controls.className = 'controls';
            controls.setAttribute('aria-label', 'Commandes');
            const control = (keys, text) => {
              const span = document.createElement('span');
              span.className = 'control';
              for (const k of keys) {
                const kbd = document.createElement('kbd');
                kbd.textContent = k;
                span.appendChild(kbd);
              }
              const t = document.createElement('span');
              t.textContent = text;
              span.appendChild(t);
              controls.appendChild(span);
            };
            control([' ', 'ESPACE'], 'Tir');
            control(['A', 'D'], 'Déplacement');
            below.appendChild(controls);
            const startButton = document.createElement('button');
            startButton.id = 'startButton';
            startButton.type = 'button';
            startButton.textContent = 'Lancer la partie';
            below.appendChild(startButton);
            const hint = document.createElement('p');
            hint.className = 'hint';
            hint.textContent = 'Bonus : ⚡ tir rapide · ✚ bouclier · ★ points — attrapez-les avec votre capsule !';
            below.appendChild(hint);
            wrap.appendChild(below);
            return wrap;
          },
        },
      });

      const canvas = shell.screen.querySelector('canvas');
      const ctx = canvas.getContext('2d');
      const startButton = document.getElementById('startButton');
      const difficultyInput = document.getElementById('difficulty');
      const powerupsInput = document.getElementById('powerups');
      const soundInput = document.getElementById('sound');
      const W = canvas.width, H = canvas.height, groundY = 555;
      const keys = new Set();
      const alienColors = ['#ff65b5', '#ffad5c', '#ffe36e', '#79ffd0', '#75caff'];
      const modes = { chill: { speed: 20, fire: 1.55 }, arcade: { speed: 29, fire: 1.12 }, chaos: { speed: 42, fire: .72 } };
      let state = 'ready', score = 0, lives = 3, lastTime = 0, elapsed = 0;
      let player, aliens = [], playerBullets = [], enemyBullets = [], stars = [], particles = [], powerups = [];
      let fleetDirection = 1, enemyFireTimer = 1.2, shake = 0, screenFlash = 0, banner = '', bannerTimer = 0;
      let audioContext;

      const randomBetween = (min, max) => min + Math.random() * (max - min);
      function tone(freq = 440, duration = .07, type = 'square', volume = .035) {
        if (!soundInput.checked) return;
        try {
          audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
          if (audioContext.state === 'suspended') audioContext.resume();
          const osc = audioContext.createOscillator(), gain = audioContext.createGain();
          osc.type = type; osc.frequency.setValueAtTime(freq, audioContext.currentTime);
          gain.gain.setValueAtTime(volume, audioContext.currentTime);
          gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
          osc.connect(gain); gain.connect(audioContext.destination); osc.start(); osc.stop(audioContext.currentTime + duration);
        } catch (_) { /* Audio is optional; the game remains playable without it. */ }
      }

      function initStars() {
        stars = Array.from({ length: 170 }, () => ({ x: Math.random() * W, y: Math.random() * H,
          size: Math.random() < .13 ? 2 : 1, speed: 7 + Math.random() * 38,
          alpha: .2 + Math.random() * .75, phase: Math.random() * Math.PI * 2 }));
      }
      function resetPlayer() {
        player = { x: W / 2, y: 520, w: 44, h: 26, speed: 360, cooldown: 0, invulnerable: 0, shield: 0, rapid: 0 };
      }
      function resetFleet() {
        aliens = [];
        for (let row = 0; row < 5; row++) for (let col = 0; col < 10; col++)
          aliens.push({ x: 120 + col * 62, y: 90 + row * 45, w: 32, h: 26, row, phase: (row + col) * .65 });
        fleetDirection = 1; enemyFireTimer = 1.1;
      }
      function resetGame() {
        score = 0; lives = 3; elapsed = 0; shake = 0; screenFlash = 0; banner = '';
        resetPlayer(); resetFleet(); playerBullets = []; enemyBullets = []; particles = []; powerups = [];
      }
      function startGame() {
        resetGame(); state = 'playing'; startButton.textContent = 'Recommencer';
        tone(660, .12, 'triangle');
      }
      function shootPlayer() {
        if (player.cooldown > 0) return;
        playerBullets.push({ x: player.x, y: player.y - 20, speed: 570 });
        player.cooldown = player.rapid > 0 ? .105 : .23;
        tone(player.rapid > 0 ? 720 : 540, .045, 'square', .018);
      }
      function burst(x, y, color, count = 14) {
        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2, speed = 35 + Math.random() * 180;
          particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            life: .35 + Math.random() * .6, maxLife: .95, size: 2 + Math.random() * 4, color,
            spin: Math.random() * 8, square: Math.random() < .35 });
        }
      }
      function loseLife() {
        if (state !== 'playing' || player.invulnerable > 0) return;
        if (player.shield > 0) {
          player.shield = 0; player.invulnerable = .75; burst(player.x, player.y, '#7effe2', 20);
          banner = 'BOUCLIER ACTIVÉ !'; bannerTimer = 1.1; tone(300, .2, 'sawtooth'); return;
        }
        lives--; player.invulnerable = 1.5; shake = 12; screenFlash = .2;
        burst(player.x, player.y, '#7df6ff', 24); tone(120, .25, 'sawtooth', .045);
        if (lives <= 0) { lives = 0; state = 'gameover'; }
      }
      function dropPowerup(x, y) {
        if (!powerupsInput.checked || Math.random() > .2) return;
        const type = ['rapid', 'shield', 'bonus'][Math.floor(Math.random() * 3)];
        powerups.push({ x, y, type, speed: 95, phase: Math.random() * 6 });
      }
      function intersects(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

      function update(dt) {
        elapsed += dt;
        for (const star of stars) { star.y += star.speed * dt; if (star.y > H) { star.y = 0; star.x = Math.random() * W; } }
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .985; p.vy *= .985; p.life -= dt;
          if (p.life <= 0) particles.splice(i, 1);
        }
        shake = Math.max(0, shake - 30 * dt); screenFlash = Math.max(0, screenFlash - dt);
        bannerTimer = Math.max(0, bannerTimer - dt);
        if (state !== 'playing') return;

        if (keys.has('a') || keys.has('arrowleft') || keys.has('touchleft')) player.x -= player.speed * dt;
        if (keys.has('d') || keys.has('arrowright') || keys.has('touchright')) player.x += player.speed * dt;
        player.x = Math.max(32, Math.min(W - 32, player.x));
        player.cooldown = Math.max(0, player.cooldown - dt);
        player.invulnerable = Math.max(0, player.invulnerable - dt);
        player.shield = Math.max(0, player.shield - dt);
        player.rapid = Math.max(0, player.rapid - dt);
        if (keys.has(' ') || keys.has('touchfire')) shootPlayer();

        for (let i = playerBullets.length - 1; i >= 0; i--) {
          playerBullets[i].y -= playerBullets[i].speed * dt;
          if (playerBullets[i].y < -20) playerBullets.splice(i, 1);
        }
        for (let i = enemyBullets.length - 1; i >= 0; i--) {
          enemyBullets[i].y += enemyBullets[i].speed * dt;
          if (enemyBullets[i].y > H + 20) enemyBullets.splice(i, 1);
        }
        for (let i = powerups.length - 1; i >= 0; i--) {
          const p = powerups[i]; p.y += p.speed * dt; p.phase += dt * 5;
          if (p.y > H + 20) powerups.splice(i, 1);
        }

        const mode = modes[difficultyInput.value] || modes.arcade;
        const alienSpeed = mode.speed + (50 - aliens.length) * .75;
        const hitEdge = aliens.some(a => a.x + alienSpeed * fleetDirection * dt <= 20 || a.x + a.w + alienSpeed * fleetDirection * dt >= W - 20);
        if (hitEdge) {
          fleetDirection *= -1;
          for (const alien of aliens) alien.y += 17;
        } else {
          for (const alien of aliens) alien.x += alienSpeed * fleetDirection * dt;
        }

        enemyFireTimer -= dt;
        if (enemyFireTimer <= 0 && aliens.length) {
          const columns = new Map();
          for (const alien of aliens) {
            const col = Math.round((alien.x - 120) / 62);
            if (!columns.has(col) || alien.y > columns.get(col).y) columns.set(col, alien);
          }
          const shooters = [...columns.values()], shooter = shooters[Math.floor(Math.random() * shooters.length)];
          enemyBullets.push({ x: shooter.x + shooter.w / 2, y: shooter.y + shooter.h, speed: difficultyInput.value === 'chaos' ? 280 : 230 });
          enemyFireTimer = Math.max(.32, mode.fire - (50 - aliens.length) * .009) + Math.random() * .35;
        }

        const playerBox = { x: player.x - player.w / 2, y: player.y - player.h / 2, w: player.w, h: player.h };
        for (let i = enemyBullets.length - 1; i >= 0; i--) {
          const b = enemyBullets[i];
          if (intersects(playerBox, { x: b.x - 3, y: b.y, w: 6, h: 15 })) { enemyBullets.splice(i, 1); loseLife(); break; }
        }
        for (const alien of aliens) if (intersects(playerBox, alien)) { loseLife(); break; }
        for (let i = aliens.length - 1; i >= 0; i--) {
          if (aliens[i].y + aliens[i].h >= groundY) {
            burst(aliens[i].x + 16, groundY, alienColors[aliens[i].row], 18);
            aliens.splice(i, 1); loseLife();
          }
        }
        for (let i = playerBullets.length - 1; i >= 0; i--) {
          const b = playerBullets[i];
          const hitIndex = aliens.findIndex(a => intersects({ x: b.x - 2, y: b.y - 8, w: 4, h: 18 }, a));
          if (hitIndex !== -1) {
            const alien = aliens[hitIndex], x = alien.x + alien.w / 2, y = alien.y + alien.h / 2;
            burst(x, y, alienColors[alien.row], 15); dropPowerup(x, y);
            aliens.splice(hitIndex, 1); playerBullets.splice(i, 1); score += 10; tone(180 + alien.row * 70, .09, 'triangle', .025);
          }
        }
        for (let i = powerups.length - 1; i >= 0; i--) {
          const p = powerups[i];
          if (!intersects(playerBox, { x: p.x - 12, y: p.y - 12, w: 24, h: 24 })) continue;
          if (p.type === 'rapid') { player.rapid = 8; banner = 'TIR TURBO !'; }
          else if (p.type === 'shield') { player.shield = 8; banner = 'BOUCLIER !'; }
          else { score += 100; banner = '+100 BONUS !'; }
          bannerTimer = 1.4; burst(p.x, p.y, '#b7ff66', 16); tone(880, .13, 'sine'); powerups.splice(i, 1);
        }
        if (aliens.length === 0) { state = 'won'; tone(660, .2, 'triangle'); }
      }

      function drawBackground() {
        const bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#0c211d'); bg.addColorStop(.52, '#071713'); bg.addColorStop(1, '#06100f');
        ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
        const nebula = (x, y, r, color) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color); g.addColorStop(1, 'transparent'); ctx.fillStyle = g; ctx.fillRect(x-r, y-r, r*2, r*2); };
        nebula(180 + Math.sin(elapsed * .17) * 55, 205, 260, '#00e0a51c');
        nebula(740, 330 + Math.cos(elapsed * .13) * 34, 230, '#24b99b20');
        ctx.save(); ctx.strokeStyle = '#9bfff008'; ctx.lineWidth = 1;
        for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 45); ctx.lineTo(x, groundY); ctx.stroke(); }
        for (let y = 55; y < groundY; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
        ctx.restore();
        for (const s of stars) {
          ctx.globalAlpha = s.alpha * (.7 + Math.sin(elapsed * 2 + s.phase) * .3);
          ctx.fillStyle = s.size > 1 ? '#baffeb' : '#f2fffc'; ctx.fillRect(s.x, s.y, s.size, s.size);
          if (s.size > 1) { ctx.globalAlpha *= .3; ctx.fillRect(s.x - 3, s.y, 7, 1); }
        }
        ctx.globalAlpha = 1;
        // Occasional shooting star streaks
        const cometPhase = (elapsed * .16) % 1;
        if (cometPhase < .075) {
          const x = ((elapsed * 205) % (W + 180)) - 100, y = 72 + Math.sin(elapsed * 2) * 100;
          const g = ctx.createLinearGradient(x - 70, y - 25, x, y);
          g.addColorStop(0, 'transparent'); g.addColorStop(1, '#cfffff'); ctx.strokeStyle = g; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x - 70, y - 25); ctx.lineTo(x, y); ctx.stroke();
        }
      }
      function drawGround() {
        const g = ctx.createLinearGradient(0, groundY - 5, 0, groundY + 10);
        g.addColorStop(0, '#8affdd'); g.addColorStop(.18, '#2ebd9c'); g.addColorStop(1, '#12382a00');
        ctx.save(); ctx.shadowColor = '#59f2be'; ctx.shadowBlur = 20; ctx.fillStyle = g; ctx.fillRect(0, groundY - 2, W, 8); ctx.restore();
        ctx.fillStyle = '#69f8c7'; const offset = (elapsed * 38) % 28;
        for (let x = -offset; x < W; x += 28) ctx.fillRect(x, groundY + 9, 10, 2);
      }
      function drawPlayer() {
        if (player.invulnerable > 0 && Math.floor(performance.now() / 90) % 2 === 0) return;
        const flame = 5 + Math.sin(elapsed * 27) * 3;
        ctx.save(); ctx.translate(player.x, player.y);
        // Animated engine flame
        const exhaust = ctx.createLinearGradient(0, 8, 0, 28 + flame);
        exhaust.addColorStop(0, '#fff3a0'); exhaust.addColorStop(.4, '#73ffe2cc'); exhaust.addColorStop(1, '#00b99800');
        ctx.fillStyle = exhaust;
        ctx.beginPath(); ctx.moveTo(-11, 8); ctx.lineTo(-8, 24 + flame); ctx.lineTo(-2, 10); ctx.fill();
        ctx.beginPath(); ctx.moveTo(11, 8); ctx.lineTo(8, 24 + flame); ctx.lineTo(2, 10); ctx.fill();
        ctx.shadowColor = '#61ffe0'; ctx.shadowBlur = 25;
        const body = ctx.createLinearGradient(0, -17, 0, 16);
        body.addColorStop(0, '#ffffff'); body.addColorStop(.32, '#caffed'); body.addColorStop(.72, '#48e2c3'); body.addColorStop(1, '#137d6d');
        ctx.fillStyle = body; ctx.beginPath(); ctx.roundRect(-22, -14, 44, 28, 14); ctx.fill();
        ctx.fillStyle = '#237d73'; ctx.beginPath(); ctx.ellipse(0, -1, 10, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#c2fff1'; ctx.beginPath(); ctx.ellipse(0, -3, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#faffc4'; ctx.fillRect(-18, -4, 3, 7); ctx.fillRect(15, -4, 3, 7);
        ctx.strokeStyle = '#ffffffa8'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.roundRect(-20, -12, 40, 23, 12); ctx.stroke();
        if (player.shield > 0) {
          const pulse = 1 + Math.sin(elapsed * 9) * .07;
          ctx.strokeStyle = `rgba(116,255,225,${.6 + Math.sin(elapsed * 7) * .2})`; ctx.lineWidth = 3; ctx.shadowColor = '#5dffe0'; ctx.shadowBlur = 25;
          ctx.beginPath(); ctx.ellipse(0, 0, 32 * pulse, 25 * pulse, 0, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
      }
      function drawAlien(alien) {
        const color = alienColors[alien.row], bob = Math.sin(elapsed * 5 + alien.phase) * 2, step = Math.sin(elapsed * 10 + alien.phase) * 2;
        ctx.save(); ctx.translate(alien.x + alien.w / 2, alien.y + alien.h / 2 + bob);
        ctx.shadowColor = color; ctx.shadowBlur = 17; ctx.fillStyle = color;
        ctx.beginPath(); ctx.moveTo(-16,-5); ctx.lineTo(-12,-12); ctx.lineTo(-6,-14); ctx.lineTo(6,-14); ctx.lineTo(12,-10); ctx.lineTo(16,-3); ctx.lineTo(13,7); ctx.lineTo(9,8); ctx.lineTo(7,13+step); ctx.lineTo(2,9); ctx.lineTo(-2,9); ctx.lineTo(-7,13-step); ctx.lineTo(-9,7); ctx.lineTo(-14,6); ctx.closePath(); ctx.fill();
        ctx.fillRect(-20,-5,5,9); ctx.fillRect(15,-5,5,9); ctx.shadowBlur = 0; ctx.fillStyle = '#10201c';
        ctx.beginPath(); ctx.ellipse(-6,-2,3,4,-.15,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.ellipse(6,-2,3,4,.15,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillRect(-7,-4,1,1); ctx.fillRect(5,-4,1,1); ctx.globalAlpha = .5; ctx.fillRect(-8,-11,7,2);
        ctx.restore();
      }
      function drawBullets() {
        for (const b of playerBullets) {
          ctx.save(); ctx.shadowColor = '#8ffaff'; ctx.shadowBlur = 18;
          const g = ctx.createLinearGradient(b.x,b.y-10,b.x,b.y+10); g.addColorStop(0,'#fff'); g.addColorStop(.45,'#aaffef'); g.addColorStop(1,'#37bfff00');
          ctx.fillStyle = g; ctx.fillRect(b.x-3,b.y-10,6,20); ctx.restore();
        }
        for (const b of enemyBullets) {
          ctx.save(); ctx.shadowColor = '#ff547d'; ctx.shadowBlur = 16; ctx.fillStyle = '#ff6b85'; ctx.beginPath();
          ctx.moveTo(b.x,b.y+15); ctx.lineTo(b.x-4,b.y+4); ctx.quadraticCurveTo(b.x,b.y-2,b.x+4,b.y+4); ctx.closePath(); ctx.fill(); ctx.restore();
        }
      }
      function drawPowerups() {
        for (const p of powerups) {
          const icon = p.type === 'rapid' ? '⚡' : p.type === 'shield' ? '✚' : '★';
          const color = p.type === 'rapid' ? '#ffe36e' : p.type === 'shield' ? '#78ffe3' : '#b8ff68';
          ctx.save(); ctx.translate(p.x, p.y + Math.sin(p.phase) * 4); ctx.rotate(Math.sin(p.phase * .5) * .12);
          ctx.shadowColor = color; ctx.shadowBlur = 20; ctx.fillStyle = '#10241e'; ctx.strokeStyle = color; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.roundRect(-13,-13,26,26,8); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
          ctx.fillStyle = color; ctx.font = 'bold 17px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(icon,0,1); ctx.restore();
        }
      }
      function drawParticles() {
        for (const p of particles) {
          ctx.globalAlpha = Math.max(0,p.life/p.maxLife); ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 11;
          if (p.square) { ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(elapsed*p.spin); ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size); ctx.restore(); }
          else { ctx.beginPath(); ctx.arc(p.x,p.y,p.size*(p.life/p.maxLife),0,Math.PI*2); ctx.fill(); }
        }
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      }
      function drawHUD() {
        ctx.save(); ctx.fillStyle = '#06211bdc'; ctx.strokeStyle = '#8affdf45'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(16,14,190,43,9); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.roundRect(W-174,14,158,43,9); ctx.fill(); ctx.stroke();
        ctx.textAlign = 'left'; ctx.fillStyle = '#8db6aa'; ctx.font = '700 10px ui-sans-serif,system-ui'; ctx.fillText('SCORE',29,31);
        ctx.fillStyle = '#eafff8'; ctx.font = '800 18px ui-sans-serif,system-ui'; ctx.fillText(String(score).padStart(4,'0'),29,49);
        ctx.textAlign = 'right'; ctx.fillStyle = '#8db6aa'; ctx.font = '700 10px ui-sans-serif,system-ui'; ctx.fillText('VIES',W-29,31);
        for (let i=0;i<3;i++) { const x=W-42-i*27; ctx.fillStyle=i<lives?'#ff709d':'#34415c'; ctx.shadowColor=i<lives?'#ff5486':'transparent'; ctx.shadowBlur=i<lives?9:0; ctx.beginPath(); ctx.moveTo(x,49); ctx.bezierCurveTo(x-15,40,x-9,32,x,39); ctx.bezierCurveTo(x+9,32,x+15,40,x,49); ctx.fill(); }
        if (player.rapid > 0 || player.shield > 0) {
          ctx.textAlign='center'; ctx.font='bold 12px ui-sans-serif,system-ui'; ctx.fillStyle='#b9ffdf';
          ctx.fillText(`${player.rapid>0?'⚡ '+player.rapid.toFixed(0)+'s':''}${player.rapid>0&&player.shield>0?'   ':''}${player.shield>0?'✚ '+player.shield.toFixed(0)+'s':''}`, W/2, 34);
        }
        ctx.restore();
      }
      function drawOverlay(title, subtitle, color) {
        const shade=ctx.createLinearGradient(0,0,0,H); shade.addColorStop(0,'#04100dbb'); shade.addColorStop(1,'#030b09e8'); ctx.fillStyle=shade; ctx.fillRect(0,0,W,H);
        ctx.textAlign='center'; ctx.save(); ctx.shadowColor=color; ctx.shadowBlur=28; ctx.fillStyle=color; ctx.font='900 48px ui-sans-serif,system-ui'; ctx.fillText(title,W/2,H/2-25); ctx.restore();
        ctx.fillStyle='#e8fff7'; ctx.font='500 19px ui-sans-serif,system-ui'; ctx.fillText(subtitle,W/2,H/2+17);
        ctx.fillStyle='#a5c9bd'; ctx.font='500 14px ui-sans-serif,system-ui'; ctx.fillText('Appuie sur ESPACE ou utilise le bouton',W/2,H/2+55);
        ctx.fillStyle=color; ctx.globalAlpha=.7; ctx.fillRect(W/2-84,H/2+76,168,1); ctx.globalAlpha=1;
      }
      function draw() {
        ctx.clearRect(0,0,W,H); ctx.save();
        if (shake > 0) ctx.translate(randomBetween(-shake,shake), randomBetween(-shake,shake));
        drawBackground(); drawGround(); for (const alien of aliens) drawAlien(alien);
        drawBullets(); drawPowerups(); drawParticles(); drawPlayer(); drawHUD();
        if (state==='ready') drawOverlay('NEON INVADERS','La flotte approche…','#69ffe1');
        else if (state==='gameover') drawOverlay('MISSION ÉCHOUÉE',`Score final : ${score}`,'#ff719c');
        else if (state==='won') drawOverlay('SECTEUR SÉCURISÉ',`Score final : ${score}`,'#78ffd0');
        if (bannerTimer > 0 && state === 'playing') {
          ctx.globalAlpha = Math.min(1,bannerTimer*2); ctx.textAlign='center'; ctx.font='900 22px ui-sans-serif,system-ui'; ctx.fillStyle='#d9ff76'; ctx.shadowColor='#d9ff76'; ctx.shadowBlur=18; ctx.fillText(banner,W/2,102); ctx.shadowBlur=0; ctx.globalAlpha=1;
        }
        if (screenFlash > 0) { ctx.globalAlpha=screenFlash*1.5; ctx.fillStyle='#b8fff0'; ctx.fillRect(0,0,W,H); ctx.globalAlpha=1; }
        ctx.restore();
      }
      function loop(timestamp) { const dt=Math.min((timestamp-lastTime)/1000||0,.04); lastTime=timestamp; update(dt); draw(); requestAnimationFrame(loop); }

      window.addEventListener('keydown', event => {
        const key=event.key.toLowerCase(); if ([' ','arrowleft','arrowright'].includes(key)) event.preventDefault();
        keys.add(key); if (key===' ' && state!=='playing') startGame();
      });
      window.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
      window.addEventListener('blur', () => keys.clear());
      startButton.addEventListener('click', startGame);
      canvas.addEventListener('pointerdown', () => { if (state !== 'playing') startGame(); });
      document.querySelectorAll('.touch-controls button').forEach(button => {
        const action=button.dataset.action, key=`touch${action}`;
        const down=e=>{ e.preventDefault(); keys.add(key); if (state!=='playing') startGame(); };
        const up=e=>{ e.preventDefault(); keys.delete(key); };
        button.addEventListener('pointerdown',down); button.addEventListener('pointerup',up);
        button.addEventListener('pointerleave',up); button.addEventListener('pointercancel',up);
      });
      initStars(); resetGame(); requestAnimationFrame(loop);
    })();
  