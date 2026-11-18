export const indexOf=(x,y,width)=>y*width+x;
export function neighbors(x,y,width,height){const out=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if((dx||dy)&&nx>=0&&nx<width&&ny>=0&&ny<height)out.push([nx,ny])}return out}
export function countAdjacent(mines,x,y,width,height){return neighbors(x,y,width,height).filter(([nx,ny])=>mines.has(indexOf(nx,ny,width))).length}
