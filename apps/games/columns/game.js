import { mountGameFrame } from '../../../packages/ui/src/gameFrame.js';

const shell = mountGameFrame({
  mount: document.getElementById('shell-mount'),
  config: {
    title: 'Neon Columns',
    subtitle: 'Aligne les gemmes · Fais grimper le score',
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
          title.textContent = 'Score';
          const score = document.createElement('p');
          score.className = 'neon-panel__value';
          score.id = 'score';
          score.textContent = '0';
          const status = document.createElement('p');
          status.className = 'neon-panel__text';
          status.id = 'status';
          status.textContent = 'Prêt';
          panel.append(title, score, status);
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
          actions.className = 'actions';
          const pauseBtn = document.createElement('button');
          pauseBtn.id = 'pause';
          pauseBtn.type = 'button';
          pauseBtn.textContent = 'Pause';
          const restartBtn = document.createElement('button');
          restartBtn.id = 'restart';
          restartBtn.type = 'button';
          restartBtn.textContent = 'Recommencer';
          const newGameBtn = document.createElement('button');
          newGameBtn.id = 'new-game';
          newGameBtn.type = 'button';
          newGameBtn.className = 'primary';
          newGameBtn.textContent = 'Nouvelle partie';
          actions.append(pauseBtn, restartBtn, newGameBtn);
          panel.append(title, actions);
          const help = document.createElement('p');
          help.className = 'help';
          help.textContent = '← → déplacer · ↓ descendre · ↑ / X pivoter · Espace : chute · P : pause';
          panel.appendChild(help);
          return panel;
        },
      },
    ],
    screen: {
      mount: (el) => {
        const canvas = document.createElement('canvas');
        canvas.id = 'game';
        canvas.width = 480;
        canvas.height = 650;
        canvas.setAttribute('aria-label', 'Plateau Neon Columns');
        el.appendChild(canvas);
      },
    },
  },
});

const canvas = shell.screen.querySelector('canvas');
const ctx = canvas.getContext('2d');
const $=s=>document.querySelector(s);
const COLS=8,ROWS=12,CELL=40,W=canvas.width,H=canvas.height,colors=['#ff648f','#61ffe0','#ffd36b','#b58aff','#8bffbd'];let board,piece,score=0,state='ready',timer=0,last=0;
const empty=()=>Array.from({length:ROWS},()=>Array(COLS).fill(-1));function newPiece(){return{col:3,row:0,gems:Array.from({length:3},()=>Math.floor(Math.random()*colors.length))}}function reset(){board=empty();piece=newPiece();score=0;state='ready';timer=0;$('#score').textContent=0;$('#status').textContent='Prêt';draw()}function start(){reset();state='playing';$('#status').textContent='En jeu'}function pause(){if(state==='playing'){state='paused';$('#status').textContent='Pause'}else if(state==='paused'){state='playing';last=performance.now()}else if(state==='ready')start()}
function can(col,row,gems=piece.gems){return col>=0&&col<COLS&&gems.every((_,i)=>row+i<ROWS&&(row+i<0||board[row+i][col]===-1))}function move(dx){if(state==='playing'&&can(piece.col+dx,piece.row))piece.col+=dx}function rotate(){const g=piece.gems;piece.gems=[g[2],g[0],g[1]]}function drop(){if(state!=='playing')return;while(can(piece.col,piece.row+1))piece.row++;lock()}
function lock(){piece.gems.forEach((c,i)=>{if(piece.row+i>=0)board[piece.row+i][piece.col]=c});piece=newPiece();if(!can(piece.col,piece.row)){state='over';$('#status').textContent='Terminé';return}resolve();timer=0}
function resolve(){let found=true;while(found){found=false;const remove=new Set();for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){const c=board[y][x];if(c<0)continue;for(const[dx,dy]of[[1,0],[0,1],[1,1],[1,-1]]){const cells=[[x,y]];for(let n=1;n<3;n++){const nx=x+dx*n,ny=y+dy*n;if(nx<0||nx>=COLS||ny<0||ny>=ROWS||board[ny][nx]!==c)break;cells.push([nx,ny])}if(cells.length===3)cells.forEach(([a,b])=>remove.add(`${a},${b}`))}}if(remove.size){found=true;remove.forEach(key=>{const[x,y]=key.split(',').map(Number);board[y][x]=-1});score+=remove.size*10;for(let x=0;x<COLS;x++){const stack=board.map(row=>row[x]).filter(v=>v>=0);for(let y=ROWS-1;y>=0;y--)board[y][x]=stack.pop()??-1}}}$('#score').textContent=score}
function update(dt){if(state!=='playing')return;timer+=dt;if(timer>.65){timer=0;if(can(piece.col,piece.row+1))piece.row++;else lock()}}
function draw(){ctx.clearRect(0,0,W,H);ctx.fillStyle='#061713';ctx.fillRect(0,0,W,H);for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){const px=(W-COLS*CELL)/2+x*CELL,py=H-ROWS*CELL+y*CELL;ctx.fillStyle='#ffffff08';ctx.fillRect(px+1,py+1,CELL-2,CELL-2);if(board&&board[y][x]>=0){ctx.fillStyle=colors[board[y][x]];ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=10;ctx.beginPath();ctx.arc(px+CELL/2,py+CELL/2,CELL*.34,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0}}if(piece&&state!=='over'){for(let i=0;i<3;i++){const y=piece.row+i;if(y<ROWS){const px=(W-COLS*CELL)/2+piece.col*CELL,py=H-ROWS*CELL+y*CELL;ctx.fillStyle=colors[piece.gems[i]];ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=12;ctx.beginPath();ctx.arc(px+CELL/2,py+CELL/2,CELL*.34,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0}}}if(state!=='playing'){ctx.fillStyle='#04100ddd';ctx.fillRect(0,0,W,H);ctx.textAlign='center';ctx.fillStyle='#69ffe1';ctx.font='800 28px system-ui';ctx.fillText(state==='ready'?'NEON COLUMNS':state==='paused'?'PAUSE':'PARTIE TERMINÉE',W/2,H/2);ctx.fillStyle='#edfffa';ctx.font='14px system-ui';ctx.fillText(state==='ready'?'Entrée ou Nouvelle partie pour jouer':'Recommencer pour rejouer',W/2,H/2+30)}}
function frame(t){const dt=Math.min((t-last)/1000||0,.04);last=t;update(dt);draw();requestAnimationFrame(frame)}window.addEventListener('keydown',e=>{const map={ArrowLeft:()=>move(-1),ArrowRight:()=>move(1),ArrowDown:()=>{if(can(piece.col,piece.row+1))piece.row++},ArrowUp:rotate,x:rotate,X:rotate,' ':drop,Enter:()=>{if(state==='ready')start()},p:pause,P:pause};if(map[e.key]){e.preventDefault();map[e.key]()}});$('#pause').onclick=pause;$('#restart').onclick=start;$('#new-game').onclick=start;canvas.addEventListener('pointerdown',()=>{if(state==='over')start()});reset();requestAnimationFrame(frame);
