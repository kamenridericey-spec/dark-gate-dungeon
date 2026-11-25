import {PATTERNS,frontiers,neighbor} from './map.mjs?v=091';
import {recordPattern} from './rules.mjs?v=091';
import {applyItem,itemTargets} from './items.mjs?v=091';

function patternRisk(g,p){
  if(g.excluded.has(p))return 0;
  if(g.revealed)return Number(p===g.pattern);
  return 1/(PATTERNS.length-g.excluded.size);
}
function routeValue(g,edge,hero=g.actor){
  const p=g.rooms[edge.to].pattern, task=recordPattern(g.history,p);
  const unexplored=[0,1,2,3].map(d=>neighbor(edge.to,d)).filter(id=>id!==null&&g.rooms[id].state==='covered');
  const occupied=g.heroes.filter(other=>other.id!==hero.id&&other.soul&&g.targets(other.id).some(target=>target.to===edge.to)).length;
  return 2+(task.task?(g.fragments===4?6:3.2):0)+unexplored.length*0.7+
    new Set(unexplored.map(id=>g.rooms[id].pattern)).size*0.45-
    patternRisk(g,p)*(hero.soul<=2?2.3:1.5)-occupied*0.2;
}
function knownSlotScore(g,h,slot,pattern){
  const risk=patternRisk(g,pattern);
  const rank=['I','II','III'].indexOf(slot.card.tier);
  if(!slot.open)return 0.15-rank*0.38;
  const {card}=slot,match=h.specialty===card.attribute;
  const burden=card.failure.reduce((n,fx)=>n+(fx.effect==='loseSoul'?(h.soul<=fx.amount?4:1.2)*fx.amount:fx.effect==='orientRoom'?0.5:fx.effect==='discardItem'?Math.min(h.hand.length,fx.amount)*0.45:0),0);
  const fragment=card.success.some(f=>f.effect==='fragment')?1.6:card.kind==='战斗'?0.55:0;
  const offer=card.offer;
  const canPay=!offer||(offer.cost.kind==='item'?h.hand.length>0:h.soul>offer.cost.amount);
  return (match?1.1:0)-burden*(0.45+(match?-0.15:0.15)+risk*0.25)+fragment*(g.fragments===4?1.7:1)+(offer&&canPay&&h.specialty==='魅力'?0.35:0)-(canPay?0:1.25);
}
function bestAssignment(g,ids,pattern){
  const slots=g.slots.flatMap((slot,i)=>slot?[{slot,i}]:[]);
  return ids.flatMap(id=>slots.map(({slot,i})=>({id,i,score:knownSlotScore(g,g.heroes[id],slot,pattern)+(g.heroes[id].soul-2)*0.18}))).sort((a,b)=>b.score-a.score)[0];
}
function itemValue(card){
  return ({insight:4,replaceEncounter:3.6,sprint:3.5,reverse:3.2,forceNormal:3.2,reverseGuard:3.2,substitute:3,heal2:2.7,reroll:2.6,heal1:2.1,healAll:2.4,transform:2.4,guard:1.5,guard2:1.8,peek:0.5})[card?.effect]??2;
}
function useBeforeEncounter(g){
  const e=g.encounter,hero=g.actor;
  const ids=e?.party??[hero.id];
  for(const id of ids)for(const card of g.heroes[id].hand){
    const options=itemTargets(g,id,card);
    if(!options.length)continue;
    if(card.effect==='insight'&&g.slots.filter(s=>s&&!s.open).length>1&&
       (g.fragments>=3||ids.some(i=>g.heroes[i].soul<=2)||g.round===1)){
      const unknown=options.map((o,i)=>({i,rank:['I','II','III'].indexOf(g.slots[o.arg].card.tier)})).sort((a,b)=>a.rank-b.rank)[0];
      applyItem(g,id,card.uid,unknown.i);return true;
    }
    if(card.effect==='replaceEncounter'&&g.phase==='revealed'&&e.card.kind!=='交易'&&g.mode()<0&&
       (e.card.failure.some(f=>f.effect==='loseSoul'&&f.amount>=g.buyer.soul)||g.fragments===4)){
      applyItem(g,id,card.uid,0);return true;
    }
    if(card.effect==='transform'&&g.phase==='action'&&g.slots.filter(Boolean).length>0&&g.slots.filter(Boolean).every(s=>s.open)){
      const target=g.targets(id).sort((a,b)=>routeValue(g,b)-routeValue(g,a))[0];
      if(!target)continue;
      const pattern=g.rooms[target.to].pattern, current=bestAssignment(g,[id],pattern).score;
      const plans=options.map((o,i)=>({i,score:Math.max(...g.slots.filter(Boolean).map(slot=>knownSlotScore(g,{...hero,specialty:o.arg},slot,pattern)))+(hero.soul-2)*0.18})).sort((a,b)=>b.score-a.score);
      if(plans[0].score>current+0.85){applyItem(g,id,card.uid,plans[0].i);return true;}
    }
    if(card.effect==='sprint'&&g.phase==='action'&&g.slots.some(Boolean)&&!g.targets(id).length){
      const positions=options.map((o,i)=>({i,score:Math.max(0,...frontiers(g.rooms,o.arg,g.canBreach).map(f=>routeValue(g,f,hero)))})).sort((a,b)=>b.score-a.score);
      if(positions[0].score>0){applyItem(g,id,card.uid,positions[0].i);return true;}
    }
  }
  return false;
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
      const risk=e.card.failure.filter(f=>f.effect==='loseSoul').reduce((n,f)=>n+f.amount,0);
      if(['guard','guard2'].includes(fx)&&g.buyer.soul<=2&&risk>e.guard)idx=0;
      if(fx==='coffin'&&!e.coffin&&risk-e.guard>=g.buyer.soul)idx=0;
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
  if(g.side==='party'&&['action','door','revealed'].includes(g.phase)&&useBeforeEncounter(g))return;
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
      const target=targets[0],pattern=g.rooms[target.to].pattern;
      const eligible=g.partyOptions();
      const solo=bestAssignment(g,[h.id],pattern);
      const groupChoice=bestAssignment(g,eligible,pattern);
      const recruit=groupChoice?.id===h.id?null:groupChoice?.id;
      const group=strategy==='cautious'?eligible:[h.id];
      if(strategy==='dynamic'&&recruit!==null&&recruit!==undefined&&groupChoice.score-solo.score>0.55&&
         (h.soul<=2||!g.targets(recruit).some(edge=>edge.to!==target.to)))group.push(recruit);
      if(strategy==='dynamic'&&group.length===1&&h.soul===1){
        const support=eligible.find(i=>i!==h.id&&g.heroes[i].hand.some(c=>['heal1','heal2','healAll','substitute','guard2'].includes(c.effect)));
        if(support!==undefined)group.push(support);
      }
      g.explore(target.to,group,bestAssignment(g,group,pattern).id);break;
    }
    case 'door':{
      const choice=bestAssignment(g,e.party,g.rooms[e.to].pattern);
      if(choice.id!==e.bearer)g.bearer(choice.id);
      g.reveal(choice.i);break;
    }
    case 'revealed':g.continueEncounter();break;
    case 'monster':g.startCheck();break;
    case 'trade':g.acceptTrade(g.paymentOptions().some(p=>g.recipients(p.key).length)&&(g.buyer.soul>1||!e.card.failure.some(f=>f.effect==='loseSoul')));break;
    case 'check':g.roll();break;
    case 'rolled':g.confirm();break;
    case 'damage':g.damage();break;
    case 'goods':{
      const best=e.goods.map((card,i)=>({i,value:itemValue(card)})).sort((a,b)=>b.value-a.value)[0];
      const costs=g.paymentOptions().filter(p=>g.recipients(p.key).length);
      const bestCost=Math.min(...costs.map(p=>p.card?itemValue(p.card):g.buyer.soul<=2?2.4:1.4));
      if(best&&costs.length&&(best.value>=bestCost||e.success&&recordPattern(g.history,g.rooms[e.to].pattern).task))g.purchase(best.i);
      else g.leaveTrade();
      break;
    }
    case 'choice':{
      const p=g.pending;
      const canRank=['选择付款物','选择弃置物品'].includes(p.title);
      const index=canRank?p.options.map((choice,i)=>({i,v:itemValue(choice.card)})).sort((a,b)=>a.v-b.v)[0].i:0;
      g.select(index);break;
    }
    case 'orient':{
      const ranks=e.orientations.map((o,i)=>({i,value:o.viable.reduce((v,d)=>{
        const to=neighbor(e.to,d); return v+(to!==null&&g.rooms[to].state==='covered'?routeValue(g,{to},g.buyer):0);
      },0)}));
      ranks.sort((a,b)=>e.orientCity?a.value-b.value:b.value-a.value);
      g.orient(ranks[0].i);break;
    }
    default:throw new Error(`自动对手没有处理 ${g.phase}`);
  }
}
