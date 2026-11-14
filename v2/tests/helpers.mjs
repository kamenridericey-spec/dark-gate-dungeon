import fs from 'node:fs';import {Game,THEMES} from '../src/engine.mjs';
export const data={...JSON.parse(fs.readFileSync(new URL('../data/encounters.json',import.meta.url))),cards:JSON.parse(fs.readFileSync(new URL('../data/cards.json',import.meta.url)))};
export const make=(seed=1)=>new Game(data,{seed});
export function start(g){g.prepare(THEMES.find(t=>t!==g.previousTheme),g.slots.flatMap((c,i)=>c?[]:[i]).map((_,i)=>i));while(g.pending)g.select(0);return g;}
export function open(g,{kind='考验',type='宝藏',dc=8,party=[g.turn],bearer=g.turn,slot=0}={}){const to=g.targets(g.turn)[0];g.rooms[to].type=type;g.slots[slot]={card:{id:'fixture',name:'定向测试遭遇',kind,tier:1,attribute:'心智',prefer:'奇遇',dc,text:''},open:false};g.explore(to,party,bearer);g.reveal(slot);g.continueEncounter();return g;}
export function resolve(g,dice=[20]){if(g.phase==='check'){g.roll();g.encounter.dice=dice;}g.confirm();let n=0;while((g.pending||g.phase==='damage')&&n++<30){if(g.phase==='damage')g.applyDamage();else g.select(0);}if(n>=30)throw Error('选择循环');}
export function give(g,id,effect){let card=g.data.cards.find(c=>c.effect===effect);if(!card)throw Error(effect);const c=g.card(card);g.heroes[id].hand.push(c);return c;}
