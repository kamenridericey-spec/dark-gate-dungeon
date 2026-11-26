import {blockedDoor,neighbor} from './map.mjs?p=3';

export function taskHint(history,patterns){
  if(history.length<2)return {needed:[],label:history.length?'再成功开一间房':'成功开房就记纹样'};
  if(history[0]===history[1])return {needed:[history[0]],label:'共鸣 · 下一次成功要同纹'};
  return {needed:patterns.filter(p=>!history.includes(p)),label:'巡礼 · 下一次成功要新纹样'};
}
export function roomRotation(game,angle){
  const e=game.encounter;
  const doors=game.rooms[e.to].shape.map(d=>(d+angle)%4).sort();
  const legal=doors.includes(e.entry);
  const index=legal?e.orientations.findIndex(option=>option.doors.join()===doors.join()):-1;
  return {doors,index,legal:index>=0};
}
export function doorState(game,id,dir,entry){
  if(dir===entry)return 'linked';
  const to=neighbor(id,dir);
  if(blockedDoor(game.rooms,id,dir))return 'wall';
  return game.rooms[to].state==='covered'?'unopened':'linked';
}
export function rotationDifference(options){
  return new Set(options.map(o=>o.viable.join())).size>1;
}
export const monsterMark=id=>{
  const kind=Number(id.split('-').at(-1))%4;
  return [
    'M6 37l24-21 24 21-9 10H15zm13-3h3m16 0h3M30 16v-7',
    'M8 30Q30 9 52 30Q30 51 8 30Zm22-8v16m-6-8h12',
    'M13 47V21l9 5 8-12 8 12 9-5v26zm8-11h3m12 0h3m-16 6h14',
    'M15 45l-4-21 11 3-3-14 11 8 11-8-3 14 11-3-4 21zm7-8h3m10 0h3'
  ][kind];
};
