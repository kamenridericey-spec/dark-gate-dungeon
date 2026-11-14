import fs from 'node:fs';import {fileURLToPath} from 'node:url';import {Game,THEMES} from '../src/engine.mjs';import {data} from './helpers.mjs';
export function simulate(strategy,seed){const g=new Game(data,{seed});let steps=0;const samples=[];
 const value=c=>c.fragment?100:({twenty:10,healAll:9,heal2:8,sprint:7,forceNormal:6,guard2:6,junk:0}[c.effect]??5);
 const choose=()=>{const p=g.pending;let i=0;
  if(p.title.startsWith('选择收获')){i=p.options.findIndex(o=>o.value>=0&&g.rewards);const fragments=p.options.findIndex(o=>o.label==='地牢碎片');if(fragments>=0)i=fragments;}
  if(p.title.startsWith('素材'))i=g.heroes[g.encounter.bearer].soul>g.encounter.monster.cost?1:0;
  if(p.title.startsWith('选择恢复')||p.title.startsWith('恢复房失败'))i=p.options.map((o,i)=>({i,n:g.heroes[o.value].max-g.heroes[o.value].soul})).sort((a,b)=>b.n-a.n)[0].i;
  if(p.title.startsWith('承担者选择弃'))i=p.options.map((o,i)=>({i,n:value(g.heroes[g.encounter.bearer][o.value.z].find(c=>c.uid===o.value.uid))})).sort((a,b)=>a.n-b.n)[0].i;
  if(p.title.startsWith('城主手牌'))i=p.options.map((o,i)=>({i,n:g.cityHand[o.value].dc})).sort((a,b)=>a.n-b.n)[0].i;
  if(p.title.startsWith('容量不足')){i=p.options.findIndex(o=>o.value.id!==undefined);if(i<0)i=p.options.findIndex(o=>o.value.drop!==undefined);}
  g.select(Math.max(0,i));
 };
 const useSmart=()=>{
  for(const h of g.heroes)if(h.soul>0)for(const c of [...h.hand,...h.equipment]){
   if(!g.canUse(h.id,c))continue;const e=g.encounter;if(!e)continue;
   let args={target:e.bearer};let use=false;
   if(['heal1','heal2','healAll'].includes(c.effect)){use=g.heroes[e.bearer].soul<g.heroes[e.bearer].max;}
   else if(['guard','guard2','coffin'].includes(c.effect)){use=e.card.kind==='战斗'&&g.heroes[e.bearer].soul<=2;}
   else if(['boost','boost2','boostGuard','crown'].includes(c.effect)){use=g.phase==='check'&&g.preview()<1;}
   else if(['reverse','reverseGuard'].includes(c.effect)){use=g.phase==='check'&&g.preview()<0;}
   else if(c.effect==='battleBoost'){use=g.phase==='check'&&e.card.kind==='战斗'&&g.preview()<1;}
   else if(c.effect==='forceNormal'){use=g.phase==='check'&&g.preview()<0;}
   else if(['reroll','plus1','plus2','floor10','twenty'].includes(c.effect)){use=g.phase==='rolled'&&g.final()<e.card.dc;args.die=e.mode>0?e.dice.indexOf(Math.max(...e.dice)):e.dice.indexOf(Math.min(...e.dice));}
   else if(c.effect==='insight'){const slot=g.slots.findIndex(s=>s&&!s.open);if(slot>=0&&g.phase==='door'){args.slot=slot;use=true;}}
   else if(c.effect==='replaceEncounter'){use=g.phase==='revealed'&&e.card.dc>=16&&!e.replaced;}
   else if(c.effect==='changeTheme'){use=g.phase==='door'&&g.rooms[e.to].type==='奇遇'&&g.citySoul>=2;args.theme='破坏仪式';}
   if(use)g.use(h.id,c.uid,args);
  }
 };
 while(!g.winner&&steps++<3000){
  if(g.pending){choose();continue;}
  if(['door','revealed','check','rolled'].includes(g.phase))useSmart();
  switch(g.phase){
   case 'city':{samples.push({round:g.round,level:g.level,citySoul:g.citySoul,hand:g.cityHand.length,rooms:g.metrics.rooms});if(g.canUpgrade())g.upgrade();if(g.winner)break;
    const types=g.heroes.filter(h=>h.soul>0).flatMap(h=>g.targets(h.id).map(id=>g.rooms[id].type));
    const indices=g.cityHand.map((c,i)=>({i,score:c.dc/8+types.filter(t=>t===c.prefer).length+Number(c.kind==='战斗')})).sort((a,b)=>b.score-a.score).slice(0,g.slots.filter(s=>!s).length).map(x=>x.i);
    const theme=THEMES.filter(t=>t!==g.previousTheme)[Math.floor(g.random()*2)];g.prepare(theme,indices);break;}
   case 'action':{const h=g.heroes[g.turn];if(h.soul===0){if(h.carriedBy!==null){g.wait();break;}const options=g.rooms[h.pos].links.filter(i=>g.visited.has(i));if(options.length)g.travel(h.id,options[0]);else g.wait();break;}
    // Rearrange only when sharing a location; routing never reads hidden encounter faces.
    if(strategy==='dynamic'&&h.forced===null&&(h.soul<=2||g.level>=2)){const friend=g.heroes.find(x=>x.id>h.id&&x.soul>0&&x.state==='ready'&&x.pos!==h.pos&&g.reachable(h.pos).includes(x.pos)&&g.targets(x.id).length);if(friend){g.travel(h.id,friend.pos);break;}}
    let party=[h.id];const allies=g.heroes.filter(x=>x.id!==h.id&&x.pos===h.pos&&x.soul>0&&x.state!=='explored');
    if(strategy==='cautious')party.push(...allies.map(x=>x.id));
    if(strategy==='dynamic'&&(h.soul<=2||g.level>=2))party.push(...allies.map(x=>x.id));
    let targets=g.targets(h.id);
    if(!targets.length){const dest=g.reachable(h.pos).filter(p=>g.rooms[p].links.some(n=>!g.visited.has(n)));if(dest.length){g.travel(h.id,dest[0]);}else{g.wait();}break;}
    const injured=party.some(i=>g.heroes[i].soul<g.heroes[i].max);
    targets.sort((a,b)=>{const score=id=>g.rooms[id].type==='恢复'&&injured?5:g.rooms[id].type==='宝藏'?4:g.rooms[id].type==='奇遇'?2:0;return score(b)-score(a);});
    const bearer=party.reduce((a,b)=>g.heroes[b].soul>g.heroes[a].soul?b:a);g.explore(targets[0],party,bearer);break;}
   case 'door':{const slots=g.slots.map((s,i)=>s?{i,score:s.open?s.card.dc:10+s.card.tier}:null).filter(Boolean).sort((a,b)=>a.score-b.score);g.reveal(slots[0].i);break;}
   case 'revealed':g.continueEncounter();break;
   case 'trade':{const e=g.encounter;const junk=e.party.flatMap(id=>['hand','equipment'].flatMap(zone=>g.heroes[id][zone].map(c=>({id,zone,c})))).sort((a,b)=>value(a.c)-value(b.c))[0];
    if(junk&&value(junk.c)<=4)g.acceptTrade({kind:'card',owner:junk.id,zone:junk.zone,uid:junk.c.uid});else if(g.heroes[e.bearer].soul>=2)g.acceptTrade({kind:'soul'});else g.acceptTrade(null);break;}
   case 'check':g.roll();break;
   case 'rolled':g.confirm();break;
   case 'damage':g.applyDamage();break;
   case 'choice':throw Error('pending not handled');
   default:throw Error('未处理阶段'+g.phase);
  }
 }
 if(!g.winner)throw Error('步数上限：'+strategy+seed);
 return {strategy,seed,winner:g.winner,rounds:g.round,rooms:g.metrics.rooms,metrics:g.metrics,upgradeHistory:g.metrics.upgrades,samples,log:g.log};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){fs.mkdirSync(new URL('../reports/',import.meta.url),{recursive:true});const runs=[];for(const strategy of ['aggressive','cautious','dynamic'])for(let i=0;i<20;i++){const r=simulate(strategy,2026111400+i);runs.push(r);console.log(strategy,i+1,r.winner,'轮',r.rounds,'房',r.rooms);}
 fs.writeFileSync(new URL('../reports/simulations.json',import.meta.url),JSON.stringify(runs,null,2));
 const avg=(rs,f)=>+(rs.reduce((a,r)=>a+f(r),0)/rs.length).toFixed(2);const summary=['aggressive','cautious','dynamic'].map(s=>{const rs=runs.filter(r=>r.strategy===s);return {strategy:s,games:rs.length,partyWins:rs.filter(r=>r.winner==='冒险者碎片').length,cityLevelWins:rs.filter(r=>r.winner==='城主升IV').length,cityDeathWins:rs.filter(r=>r.winner==='城主全员失魂').length,rounds:avg(rs,r=>r.rounds),rooms:avg(rs,r=>r.rooms),deaths:avg(rs,r=>r.metrics.deaths),revivals:avg(rs,r=>r.metrics.revivals),groupFrequency:avg(rs,r=>r.metrics.groupSizes.filter(n=>n>1).length/Math.max(1,r.metrics.rooms)),soulLoss:avg(rs,r=>r.metrics.soulLoss),healing:avg(rs,r=>r.metrics.healing),items:avg(rs,r=>Object.values(r.metrics.items).reduce((a,b)=>a+b,0)),itemUseRate:avg(rs,r=>Object.values(r.metrics.items).reduce((a,b)=>a+b,0)/Math.max(1,r.metrics.itemsReceived)),bearers:[0,1,2].map(i=>avg(rs,r=>r.metrics.bearers[i])),monsters:[1,2,3].map(i=>avg(rs,r=>r.metrics.monsterEncounters[i])),themeValue:rs.reduce((a,r)=>{for(const [k,v] of Object.entries(r.metrics.themeValue))a[k]=(a[k]??0)+v;return a;},{}),income:Object.fromEntries(['round','battle','advantage','trade'].map(k=>[k,avg(rs,r=>r.metrics.income[k])])),upgrades:Object.fromEntries([2,3,4].map(l=>{const got=rs.flatMap(r=>r.upgradeHistory.filter(x=>x.level===l));return [l,{games:got.length,meanRound:got.length?+(got.reduce((a,x)=>a+x.round,0)/got.length).toFixed(2):null}]})),themes:rs.reduce((a,r)=>{for(const [k,n] of Object.entries(r.metrics.themes))a[k]=(a[k]??0)+n;return a;},{})};});fs.writeFileSync(new URL('../reports/summary.json',import.meta.url),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));}
