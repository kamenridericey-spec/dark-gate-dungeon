export const VERSION='0.9.3-pressure.2';
export const ROLES=['体魄','心智','魅力'];
export const COSTS=[5,6,7,8];
export const CITY_SOUL_LIMIT=8;
export const CITY_WIN_LEVEL=COSTS.length+1;
export const WIN_FRAGMENTS=5;
export const TASK_REWARD=1;
export const MAX_SOUL=[4,3,3];
export const CAPACITY=[2,3,2];
export const tier=level=>['I','II','III','IV','V'][level-1];
export const stanceName=mode=>mode<0?'城主优势':mode>0?'冒险者优势':'均势';
export function recordPattern(history,pattern){
  const next=[...history,pattern];
  if(next.length<3) return {history:next,task:null};
  const different=new Set(next).size;
  if(different===1||different===3) return {history:[],task:different===1?'共鸣':'巡礼'};
  return {history:next.slice(-2),task:null};
}
