export const nextCell=(cell,dir)=>({x:cell.x+(dir==='left'?-1:dir==='right'?1:0),y:cell.y+(dir==='up'?-1:dir==='down'?1:0)});
export const hitsWall=(cell,cols,rows)=>cell.x<0||cell.y<0||cell.x>=cols||cell.y>=rows;
export const hitsSelf=(snake,cell,growing)=>{const body=growing?snake:snake.slice(0,-1);return body.some(s=>s.x===cell.x&&s.y===cell.y)};
export const opposite=(a,b)=>(a==='left'&&b==='right')||(a==='right'&&b==='left')||(a==='up'&&b==='down')||(a==='down'&&b==='up');
export const freeCell=(occupied,cols,rows)=>{const taken=new Set(occupied.map(c=>c.x+','+c.y));const free=[];for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)if(!taken.has(x+','+y))free.push({x,y});return free.length?free[Math.floor(Math.random()*free.length)]:null};
