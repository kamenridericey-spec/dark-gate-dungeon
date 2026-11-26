import {Game} from './engine.mjs?p=5';
import {aiStep} from './ai.mjs?p=5';
export function allocations(players,guardOwner){
  const list=players.map(p=>[[p.id,2]]);
  for(let i=0;i<players.length;i++)for(let j=i+1;j<players.length;j++)list.push([[players[i].id,1],[players[j].id,1]]);
  return list.map(parts=>({parts,canUseGuard:parts.some(([id])=>id===guardOwner)}));
}
export class PilotGame extends Game{
  constructor(data,seed){super(data,seed);this.pilot={split:0,solo:0,group:0,divided:0,aoe:0,knockouts:0,lateChecks:0};}
  resolve(done){
    const e=this.encounter,fx=e.queue[0];
    if(!this.winner&&fx?.effect==='loseSoul'&&fx.target==='splitExplorers'){
      e.queue.shift();
      const players=e.party.map(id=>this.heroes[id]).filter(h=>h.soul>0);
      if(!players.length)return this.resolve(done);
      this.pilot.split++;this.pilot[players.length===1?'solo':'group']++;
      const options=allocations(players,e.bearer).map(choice=>({...choice,label:choice.parts.map(([id,n])=>this.heroes[id].name+'失 '+n+' 魂').join('、')}));
      const lock=i=>{
        const {parts}=options[i];
        if(parts.length>1)this.pilot.divided++;
        e.damage={area:true,target:e.bearer,targets:parts.map(([id])=>id),parts,amount:2,resume:()=>this.resolve(done)};
        this.phase='damage';
        this.note('分摊 2 魂 · '+options[i].label);
      };
      if(options.length===1)lock(0);
      else this.choose('分摊 2 魂','party',options,lock);
      return;
    }
    if(fx?.effect==='loseSoul'&&['explorers','livingParty'].includes(fx.target))this.pilot.aoe++;
    super.resolve(done);
  }
  damage(){
    const e=this.encounter,d=e.damage;
    if(!d?.parts){
      const before=this.heroes.filter(h=>h.soul).length;
      super.damage();
      this.pilot.knockouts+=before-this.heroes.filter(h=>h.soul).length;
      return;
    }
    this.assert(this.phase==='damage','没有待结算伤害');
    for(const [id,amount] of d.parts){
      const h=this.heroes[id],before=h.soul,blocked=id===e.bearer?Math.min(e.guard,amount):0;
      e.guard-=blocked;
      h.soul=Math.max(0,h.soul-amount+blocked);
      if(!h.soul&&e.coffin&&id===e.bearer){h.soul=1;e.coffin=false;}
      if(before&&!h.soul)this.pilot.knockouts++;
      this.note(h.name+' 魂 '+before+' → '+h.soul+(blocked?'（护住 '+blocked+'）':'')+'。');
    }
    this.attach();
    if(this.heroes.every(h=>!h.soul)){this.end('城主','全员失魂');return;}
    e.damage=null;d.resume();
  }
}

function allocationScore(g,choice){
  return choice.parts.reduce((total,[id,amount])=>{
    const h=g.heroes[id],remaining=h.soul-Math.max(0,amount-(id===g.encounter.bearer?g.encounter.guard:0));
    return total+(remaining<=0?12:remaining===1?2:0)+Math.min(h.soul,Math.max(0,h.soul-remaining));
  },0);
}
export function pilotStep(g,policy,cityStyle){
  if(g.phase==='choice'&&g.pending.title==='分摊 2 魂'){
    const order=g.pending.options.map((o,i)=>({i,s:allocationScore(g,o)})).sort((a,b)=>a.s-b.s);
    g.select(order[0].i);return;
  }
  if(g.phase==='action'&&policy==='pair'){
    const explore=g.explore;
    g.explore=function(to,ids,bearer){
      // Pair stress profile. Based only on visible party membership and souls.
      if(ids.length===1){
        const partner=g.partyOptions().filter(id=>id!==g.turn).sort((a,b)=>g.heroes[b].soul-g.heroes[a].soul)[0];
        if(partner!==undefined)ids=[...ids,partner];
      }
      return explore.call(g,to,ids,bearer);
    };
    try{aiStep(g,'dynamic',cityStyle);}finally{delete g.explore;}
    return;
  }
  aiStep(g,policy==='solo'?'aggressive':'dynamic',cityStyle);
}
