import {THEMES} from './engine.mjs?v=083';
export function isCityDecision(g){return g.phase==='city'||!!g.pending?.title.startsWith('城主');}
export function aiStep(g){
 if(g.winner)return false;
 const e=g.encounter;
 if(e&&['check','rolled','damage'].includes(g.phase))for(const h of g.heroes)for(const c of [...h.hand,...h.equipment]){if(!g.canUse(h.id,c))continue;let args={target:e.bearer},use=false;
 if(g.phase==='check'){if(['heal1','heal2','healAll'].includes(c.effect))use=g.heroes[e.bearer].soul<g.heroes[e.bearer].max;else if(['guard','guard2','coffin'].includes(c.effect))use=e.card.kind==='战斗'&&g.heroes[e.bearer].soul<=2;else if(['boost','boostGuard','crown','boost2'].includes(c.effect))use=g.preview()<1;else if(['reverse','reverseGuard','forceNormal'].includes(c.effect))use=g.preview()<0;else if(c.effect==='battleBoost')use=e.card.kind==='战斗'&&g.preview()<1;}
 if(g.phase==='rolled'&&['reroll','plus1','plus2','floor10','twenty'].includes(c.effect)&&g.final()<e.card.dc){use=true;args.die=e.mode>0?e.dice.indexOf(Math.max(...e.dice)):e.dice.indexOf(Math.min(...e.dice));}
 if(g.phase==='damage'&&c.effect==='substitute'){const ally=e.party.find(i=>g.heroes[i].soul>g.heroes[e.bearer].soul);if(ally!==undefined){use=true;args.target=ally;}}
 if(use){g.use(h.id,c.uid,args);return true;}}
 if(g.pending){let i=0;if(g.pending.title.startsWith('选择收获')){const f=g.pending.options.findIndex(x=>x.label==='地牢碎片');i=f<0?0:f;}if(g.pending.title.startsWith('素材'))i=g.heroes[g.encounter.bearer].soul>g.encounter.monster.cost?1:0;
 if(g.pending.title.startsWith('容量不足')){i=g.pending.options.findIndex(x=>x.value.id!==undefined);if(i<0)i=0;}g.select(i);return true;}
 switch(g.phase){
 case 'city':{if(g.canUpgrade()){g.upgrade();return true;}const types=g.heroes.filter(h=>h.soul>0).flatMap(h=>g.targets(h.id).map(id=>g.rooms[id].type));const indices=g.cityHand.map((c,i)=>({i,v:c.dc/8+types.filter(t=>t===c.prefer).length})).sort((a,b)=>b.v-a.v).slice(0,g.slots.filter(x=>!x).length).map(x=>x.i);const theme=THEMES.filter(t=>t!==g.previousTheme).map(t=>({t,v:t==='破坏仪式'?(g.citySoul===0?3:0.5):t==='遗物回收'?(g.rewardDiscard.length<2?2.7:0.8):1+g.heroes.reduce((n,h)=>n+Math.abs(g.rooms[h.pos].x)+Math.abs(g.rooms[h.pos].y),0)/12})).sort((a,b)=>b.v-a.v)[0].t;g.prepare(theme,indices);return true;}
 case 'action':{const h=g.heroes[g.turn];if(!h.soul){if(h.carriedBy===null){const n=g.rooms[h.pos].links.find(i=>g.visited.has(i));if(n!==undefined){g.travel(h.id,n);return true;}}g.wait();return true;}
 const targets=g.targets(h.id).sort((a,b)=>{const s=i=>g.rooms[i].type==='恢复'&&h.soul<h.max?5:g.rooms[i].type==='宝藏'?4:1;return s(b)-s(a);});if(!targets.length){const dest=g.reachable(h.pos).find(p=>g.rooms[p].links.some(n=>!g.visited.has(n)));if(dest!==undefined)g.travel(h.id,dest);else g.wait();return true;}
 const party=[h.id,...g.heroes.filter(x=>x.id!==h.id&&x.pos===h.pos&&x.soul>0&&x.state!=='explored'&&(h.soul<=2||g.level>=2)).map(x=>x.id)];g.explore(targets[0],party,party.reduce((a,b)=>g.heroes[b].soul>g.heroes[a].soul?b:a));return true;}
 case 'door':{const slots=g.slots.map((s,i)=>s?{i,n:s.open?s.card.dc:s.card.tier*4+6}:null).filter(Boolean).sort((a,b)=>a.n-b.n);g.reveal(slots[0].i);return true;}
 case 'revealed':g.continueEncounter();return true;
 case 'trade':g.acceptTrade(g.heroes[g.encounter.bearer].soul>=2?{kind:'soul'}:null);return true;
 case 'check':g.roll();return true;
 case 'rolled':g.confirm();return true;
 case 'damage':g.applyDamage();return true;
 default:return false;
 }
}
