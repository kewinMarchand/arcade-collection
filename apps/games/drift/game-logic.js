export const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
export const nextLane=(lane,direction)=>clamp(lane+direction,0,4);
