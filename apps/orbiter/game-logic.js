export const safeLanding=({vy,vx,tilt})=>Math.abs(vy)<30&&Math.abs(vx)<24&&Math.abs(tilt)<.25;
export const padBonus=width=>width>=100?2:width>=70?3:4;
export const groundAt=(terrain,x)=>{
  const i=Math.max(0,Math.min(terrain.length-2,Math.floor(x/40)));
  const a=terrain[i],b=terrain[i+1];
  const k=Math.max(0,Math.min(1,(x-a.x)/((b.x-a.x)||1)));
  return a.y+(b.y-a.y)*k;
};
