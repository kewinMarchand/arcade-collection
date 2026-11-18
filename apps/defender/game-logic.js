export const angleDifference=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export const intercepted=(projectileAngle,shieldAngle,halfArc=.95)=>Math.abs(angleDifference(projectileAngle,shieldAngle))<=halfArc;
export const crossesShield=(previousRadius,currentRadius,shieldRadius=108,projectileRadius=8)=>{
  const prevEdge=previousRadius-projectileRadius;
  const currEdge=currentRadius-projectileRadius;
  return prevEdge>shieldRadius && currEdge<=shieldRadius;
};
