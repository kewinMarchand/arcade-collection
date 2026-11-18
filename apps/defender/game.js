import {intercepted,crossesShield} from './game-logic.js';

const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d'),$=s=>document.querySelector(s),scoreEl=$('#score'),bestEl=$('#best'),livesEl=$('#lives'),statusEl=$('#status');
const W=800,H=520,cx=W/2,cy=H/2,SHIELD_RADIUS=108,CORE_RADIUS=44,PHOTON_RADIUS=8,SHIELD_HALF_ARC=.95;
let state='ready',angle=-Math.PI/2,shots=[],score=0,bonus=0,lives=3,best=Number(localStorage.getItem('pulseDefenderBest'))||0,last=0,elapsed=0,spawn=.8,sparks=[],flashes=[],popups=[];

bestEl.textContent=best;

function blockEffect(a){
  flashes.push({a,life:.42});
  const x=cx+Math.cos(a)*SHIELD_RADIUS,y=cy+Math.sin(a)*SHIELD_RADIUS;
  for(let k=0;k<14;k++){
    const ang=a+Math.PI+(Math.random()-.5)*2.2,sp=50+Math.random()*160;
    sparks.push({x,y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,life:.3+Math.random()*.35,color:Math.random()<.5?'#baffeb':'#69ffe1',s:2+Math.random()*2.5});
  }
  popups.push({a,life:.9});
}

function start(){
  state='playing';
  angle=-Math.PI/2;
  shots=[];
  score=0;
  bonus=0;
  lives=3;
  elapsed=0;
  spawn=.7;
  scoreEl.textContent='0';
  livesEl.textContent=lives;
  statusEl.textContent='Défense';
}

function pause(){
  if(state==='playing'){state='paused';statusEl.textContent='Pause';}
  else if(state==='paused'){state='playing';last=performance.now();statusEl.textContent='Défense';}
  else if(state==='ready') start();
}

function update(dt){
  for(const s of sparks){s.x+=s.vx*dt;s.y+=s.vy*dt;s.vx*=.97;s.vy*=.97;s.life-=dt}
  for(let i=sparks.length-1;i>=0;i--)if(sparks[i].life<=0)sparks.splice(i,1);
  for(let i=flashes.length-1;i>=0;i--)if((flashes[i].life-=dt)<=0)flashes.splice(i,1);
  for(let i=popups.length-1;i>=0;i--)if((popups[i].life-=dt)<=0)popups.splice(i,1);
  if(state!=='playing') return;

  elapsed += dt;
  spawn -= dt;

  if(spawn <= 0){
    shots.push({a: Math.random()*Math.PI*2, r: 270, speed: 90 + Math.min(140, elapsed*2)});
    spawn = Math.max(.38, 1.05 - elapsed*.007);
  }

  for(let i=shots.length-1;i>=0;i--){
    const p=shots[i];
    const previous=p.r;
    p.r -= p.speed * dt;

    const crossed = crossesShield(previous, p.r, SHIELD_RADIUS, PHOTON_RADIUS);
    if(crossed && intercepted(p.a, angle, SHIELD_HALF_ARC)){
      bonus += 25;
      blockEffect(p.a);
      shots.splice(i,1);
      continue;
    }

    if(crossed && !intercepted(p.a, angle, SHIELD_HALF_ARC)){
      lives--;
      livesEl.textContent=lives;
      shots.splice(i,1);
      if(lives <= 0){ state='over'; statusEl.textContent='Noyau perdu'; }
      continue;
    }

    if(p.r <= CORE_RADIUS + PHOTON_RADIUS){
      lives--;
      livesEl.textContent=lives;
      shots.splice(i,1);
      if(lives <= 0){ state='over'; statusEl.textContent='Noyau perdu'; }
    }
  }

  score = Math.floor(elapsed*4) + bonus;
  scoreEl.textContent = score;
  if(score > best){
    best = score;
    bestEl.textContent = best;
    localStorage.setItem('pulseDefenderBest', String(best));
  }
}

function aimAtPointer(e){
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) * W / r.width - cx;
  const y = (e.clientY - r.top) * H / r.height - cy;
  if(Math.hypot(x, y) > 36) angle = Math.atan2(y, x);
}

function draw(){
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#061713';
  ctx.fillRect(0,0,W,H);

  for(const r of [76, SHIELD_RADIUS, 260]){
    ctx.beginPath();
    ctx.arc(cx,cy,r,0,Math.PI*2);
    ctx.strokeStyle = r === SHIELD_RADIUS ? '#69ffe144' : '#69ffe122';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.fillStyle='#ff648f';
  ctx.shadowColor='#ff648f';
  ctx.shadowBlur=22;
  ctx.beginPath();
  ctx.arc(cx,cy,CORE_RADIUS,0,Math.PI*2);
  ctx.fill();
  ctx.shadowBlur=0;

  ctx.fillStyle='#fff';
  ctx.textAlign='center';
  ctx.font='bold 13px system-ui';
  ctx.fillText('NOYAU', cx, cy + 5);

  for(const p of shots){
    ctx.fillStyle='#ffd36b';
    ctx.shadowColor='#ffd36b';
    ctx.shadowBlur=14;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(p.a)*p.r, cy + Math.sin(p.a)*p.r, PHOTON_RADIUS, 0, Math.PI*2);
    ctx.fill();
  }

  ctx.shadowBlur=0;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.strokeStyle='#69ffe1';
  ctx.shadowColor='#69ffe1';
  ctx.shadowBlur=25;
  ctx.lineWidth=20;
  ctx.lineCap='round';
  ctx.beginPath();
  ctx.arc(0,0,SHIELD_RADIUS,-SHIELD_HALF_ARC,SHIELD_HALF_ARC);
  ctx.stroke();
  ctx.restore();
  ctx.shadowBlur=0;

  for(const f of flashes){
    const k=f.life/.42;
    ctx.save();
    ctx.translate(cx,cy);
    ctx.rotate(f.a);
    ctx.strokeStyle=`rgba(234,255,250,${k})`;
    ctx.shadowColor='#baffeb';
    ctx.shadowBlur=30;
    ctx.lineWidth=24;
    ctx.lineCap='round';
    ctx.beginPath();
    ctx.arc(0,0,SHIELD_RADIUS,-.32,.32);
    ctx.stroke();
    ctx.strokeStyle=`rgba(105,255,225,${k*.55})`;
    ctx.lineWidth=2;
    ctx.shadowBlur=0;
    ctx.beginPath();
    ctx.arc(0,0,SHIELD_RADIUS+(1-k)*46,0,Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }
  for(const s of sparks){
    ctx.globalAlpha=Math.min(1,s.life*2.4);
    ctx.fillStyle=s.color;
    ctx.fillRect(s.x,s.y,s.s,s.s);
  }
  ctx.globalAlpha=1;
  for(const p of popups){
    const d=SHIELD_RADIUS+30+(0.9-p.life)*55;
    ctx.globalAlpha=Math.min(1,p.life*1.6);
    ctx.fillStyle='#d9ff76';
    ctx.shadowColor='#d9ff76';
    ctx.shadowBlur=12;
    ctx.font='800 15px system-ui';
    ctx.textAlign='center';
    ctx.fillText('+25',cx+Math.cos(p.a)*d,cy+Math.sin(p.a)*d);
  }
  ctx.shadowBlur=0;
  ctx.globalAlpha=1;

  if(state !== 'playing'){
    ctx.fillStyle='#04100ddc';
    ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#69ffe1';
    ctx.font='800 32px system-ui';
    ctx.textAlign='center';
    ctx.fillText(state === 'ready' ? 'Neon Defender' : state === 'paused' ? 'PAUSE' : 'NOYAU PERDU', cx, cy);
    ctx.fillStyle='#edfffa';
    ctx.font='16px system-ui';
    ctx.fillText(state === 'ready' ? 'Espace ou Nouvelle partie pour jouer' : state === 'paused' ? 'Clique sur Pause pour reprendre' : 'Recommencer pour retenter', cx, cy + 34);
  }
}

function frame(t){
  const dt = Math.min((t - last) / 1000 || 0, .04);
  last = t;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if(['arrowleft','arrowright',' '].includes(k)) e.preventDefault();
  if(k === 'arrowleft' || k === 'a') angle -= .12;
  if(k === 'arrowright' || k === 'd') angle += .12;
  if(k === ' ' && state !== 'playing') start();
  if(k === 'p') pause();
});

canvas.addEventListener('pointermove', aimAtPointer);
canvas.addEventListener('pointerdown', e => {
  aimAtPointer(e);
  if(state === 'over') start();
  if(state === 'ready') start();
});

$('#pause').onclick = pause;
$('#restart').onclick = start;
$('#new-game').onclick = start;

last = performance.now();
requestAnimationFrame(frame);
