import {PATTERNS,frontiers,neighbor} from './map.mjs';
import {recordPattern} from './rules.mjs';
import {applyItem,itemTargets} from './items.mjs';

function routeValue(g,edge){
  const p=g.rooms[edge.to].pattern;
  const task=recordPattern(g.history,p);
  const openSides=[0,1,2,3].filter(d=>{const id=neighbor(edge.to,d);return id!==null&&g.rooms[id].state==='covered';}).length;
  const knownRisk=g.revealed&&p===g.pattern;
  return (task.task?4:0)+(g.excluded.has(p)?0.7:0)+openSides*0.45-(knownRisk?1.45:0);
}
function useHelpfulItem(g){
  const e=g.encounter;
  for(const h of g.heroes)for(const item of h.hand){
    const opts=itemTargets(g,h.id,item);if(!opts.length)continue;
    const fx=item.effect;
    let idx=-1;
    if(g.phase==='check'){
      if(['heal1','heal2'].includes(fx))idx=opts.findIndex(o=>o.arg===e.bearer&&g.buyer.soul<=2);
      if(fx==='healAll'&&e.party.some(i=>g.heroes[i].soul<=2))idx=0;
      if(['reverse','reverseGuard','forceNormal','boost','boost2','boostGuard','battleBoost','crown'].includes(fx)&&g.mode()<0)idx=0;
      if(['guard','guard2','coffin'].includes(fx)&&g.buyer.soul<=2&&e.card.failure.some(f=>f.effect==='loseSoul'))idx=0;
    }
    if(g.phase==='rolled'&&g.value()<e.card.dc){
      if(['plus1','plus2','twenty','floor10'].includes(fx)){
        idx=opts.findIndex(({arg})=>{
          const value=e.dice[arg], change=fx==='twenty'?20:fx==='floor10'?Math.max(10,value):Math.min(20,value+(fx==='plus2'?2:1));
          const copy=e.dice.map((d,i)=>i===arg?change:d);
          return (e.mode>0?Math.max(...copy):e.mode<0?Math.min(...copy):copy[0])>=e.card.dc;
        });
      }else if(fx==='reroll'){
        idx=e.mode<0&&e.dice.filter(d=>d<e.card.dc).length>1?-1:e.dice.indexOf(Math.min(...e.dice));
      }
    }
    if(g.phase==='damage'&&fx==='substitute'&&g.heroes[e.damage.target].soul<=e.damage.amount)idx=opts.findIndex(o=>g.heroes[o.arg].soul>e.damage.amount);
    if(idx>=0){applyItem(g,h.id,item.uid,idx);return true;}
  }
  return false;
}
export function aiStep(g,strategy='dynamic'){
  const e=g.encounter;
  if(g.side==='party'&&['check','rolled','damage'].includes(g.phase)&&useHelpfulItem(g))return;
  switch(g.phase){
    case 'city':{
      if(g.canUpgrade){g.upgrade();break;}
      const scores=PATTERNS.map(pattern=>({pattern,score:g.heroes.reduce((sum,h)=>sum+g.targets(h.id).filter(f=>g.rooms[f.to].pattern===pattern).reduce((total,f)=>total+1+(recordPattern(g.history,pattern).task?3:0),0),0)}));
      scores.sort((a,b)=>b.score-a.score);
      const favored=g.heroes.filter(h=>h.soul).map(h=>h.specialty);
      const picks=g.hand.map((c,i)=>({i,score:c.failure.reduce((sum,fx)=>sum+({loseSoul:2,orientRoom:0.65,discardItem:1}[fx.effect]??0)*fx.amount,0)-favored.filter(a=>a===c.attribute).length*0.5-(c.success.some(f=>f.effect==='fragment')?0.5:0)}))
        .sort((a,b)=>b.score-a.score).slice(0,g.need).map(p=>p.i);
      g.prepare(scores[0].pattern,picks);break;
    }
    case 'action':{
      const h=g.actor,targets=g.slots.some(Boolean)?g.targets().sort((a,b)=>routeValue(g,b)-routeValue(g,a)):[];
      if(!targets.length){
        const moves=g.travelTargets();
        if(!h.soul){const destination=moves.find(p=>g.heroes.some(a=>a.soul&&a.pos===p));if(destination!==undefined)g.travel(destination);else g.wait();break;}
        const dest=moves.map(p=>({p,value:frontiers(g.rooms,p,g.canBreach).reduce((v,f)=>Math.max(v,routeValue(g,f)),0)})).sort((a,b)=>b.value-a.value)[0];
        if(dest&&dest.value>0)g.travel(dest.p);else g.wait();break;
      }
      const group=(strategy==='cautious'||(strategy==='dynamic'&&h.soul<=2))?g.partyOptions():[h.id];
      const bearer=group.reduce((a,b)=>g.heroes[a].soul>=g.heroes[b].soul?a:b);
      g.explore(targets[0].to,group,bearer);break;
    }
    case 'door':{
      const order=g.slots.flatMap((s,i)=>s?[{i,v:['I','II','III'].indexOf(s.card.tier)*0.3+(s.open?(s.card.attribute===g.buyer.specialty?-1:0):0)}]:[]).sort((a,b)=>a.v-b.v);
      g.reveal(order[0].i);break;
    }
    case 'revealed':g.continueEncounter();break;
    case 'monster':g.startCheck();break;
    case 'trade':g.acceptTrade(g.paymentOptions().some(p=>g.recipients(p.key).length)&&(g.buyer.soul>1||!e.card.failure.some(f=>f.effect==='loseSoul')));break;
    case 'check':g.roll();break;
    case 'rolled':g.confirm();break;
    case 'damage':g.damage();break;
    case 'goods':if(g.paymentOptions().some(p=>g.recipients(p.key).length))g.purchase(0);else g.leaveTrade();break;
    case 'choice':g.select(0);break;
    case 'orient':{
      const ranks=e.orientations.map((o,i)=>({i,value:o.viable.reduce((v,d)=>{
        const to=neighbor(e.to,d);return v+(to!==null&&g.rooms[to].state==='covered'?1+(recordPattern(g.history,g.rooms[to].pattern).task?2:0):0);
      },0)}));
      ranks.sort((a,b)=>e.orientCity?a.value-b.value:b.value-a.value);
      g.orient(ranks[0].i);break;
    }
    default:throw new Error(`自动对手没有处理 ${g.phase}`);
  }
}
