import {ROLES} from './rules.mjs?v=093';

const windows = {
  action:'行动前',door:'开门前',revealed:'遭遇揭晓后',
  check:'检定前',rolled:'检定后',damage:'受伤前',
};
const samePlace = (a,b)=>a.pos===b.pos;
export function itemTargets(g,id,item){
  const h=g.heroes[id],e=g.encounter,win=windows[g.phase],fx=item.effect;
  const allowed=item.windows??({掷前:['检定前'],掷后:['检定后'],准备:['行动前','开门前']}[item.timing]??[]);
  if(!win||!h.soul||g.winner||!allowed.includes(win))return [];
  if(e?!e.party.includes(id)&&!(h.state==='explored'&&samePlace(h,g.buyer)):id!==g.turn)return [];
  if(fx==='sprint')return g.reachable(h.pos).filter(p=>p!==h.pos).map(p=>({arg:p,label:`房间 ${p+1}`}));
  if(fx==='insight')return g.slots.flatMap((s,i)=>s&&!s.open?[{arg:i,label:`翻明 ${s.card.tier} 级埋牌`}]:[]);
  if(fx==='peek')return g.goods.length?[{label:'查看堆顶'}]:[];
  if(fx==='transform')return ROLES.filter(r=>r!==h.specialty).map(r=>({arg:r,label:r}));
  if(fx==='replaceEncounter')return !e.replaced&&(g.events.length||g.eventDiscard.length)?[{label:'另抽一张'}]:[];
  if(fx==='substitute'){
    if(e.damage?.area)return [];
    if(g.phase==='check'&&e.card.offer)return [];
    return e.party.flatMap(i=>g.heroes[i].soul&&i!==(e.damage?.target??e.bearer)?[{arg:i,label:g.heroes[i].name}]:[]);
  }
  if(['heal1','heal2','healAll'].includes(fx)){
    const others=g.heroes.filter(a=>samePlace(a,h)&&a.soul<a.max);
    return fx==='healAll'?(others.length?[{label:'治疗同房队员'}]:[]):others.map(a=>({arg:a.id,label:a.name}));
  }
  if(['reroll','plus1','plus2','twenty','floor10'].includes(fx))return e.dice.map((d,i)=>({arg:i,label:`骰子 ${i+1} · ${d}`}));
  if(fx==='battleBoost'&&e.card.kind!=='战斗')return [];
  if(fx==='forceNormal'&&e.normal)return [];
  if(['guard','guard2','boostGuard','reverseGuard','coffin','battleBoost','boost','boost2','reverse','forceNormal','crown'].includes(fx))return [{label:'使用'}];
  return [];
}
export function applyItem(g,id,uid,index){
  const h=g.heroes[id],item=h.hand.find(i=>i.uid===uid),e=g.encounter;
  const choice=item&&itemTargets(g,id,item)[index];g.assert(choice,'该道具当前不能使用');
  const arg=choice.arg;
  switch(item.effect){
    case 'sprint':{const from=h.pos;g.move(id,arg);g.attach();g.note(`${h.name} 疾跑 ${from+1} → ${arg+1}`);break;}
    case 'insight':g.slots[arg].open=true;g.note(`洞察翻明 ${g.slots[arg].card.name}。`);break;
    case 'peek':g.note(`物资堆顶：${g.goods[0].name}。`);break;
    case 'transform':h.specialty=arg;break;
    case 'replaceEncounter':{
      const fresh=g.drawEvents(1)[0];g.eventDiscard.push(e.card);e.card=fresh;e.replaced=true;
      g.note(`逆天改命：新遭遇为 ${fresh.name}。`);break;
    }
    case 'substitute':if(g.phase==='damage')e.damage.target=arg;else g.bearer(arg);break;
    case 'heal1':case 'heal2':g.heal(arg,item.effect==='heal2'?2:1);break;
    case 'healAll':for(const a of g.heroes.filter(a=>samePlace(a,h)))g.heal(a.id,1);break;
    case 'reroll':e.dice[arg]=1+Math.floor(g.random()*20);break;
    case 'plus1':case 'plus2':e.dice[arg]=Math.min(20,e.dice[arg]+(item.effect==='plus2'?2:1));break;
    case 'twenty':e.dice[arg]=20;break;
    case 'floor10':e.dice[arg]=Math.max(10,e.dice[arg]);break;
    case 'coffin':e.coffin=true;break;
    case 'guard':e.guard++;break;
    case 'guard2':e.guard+=2;break;
    case 'boostGuard':e.guard++;e.delta++;break;
    case 'reverseGuard':e.guard++;e.delta-=2*g.strength();break;
    case 'battleBoost':case 'boost':e.delta++;break;
    case 'boost2':e.delta+=2;break;
    case 'reverse':e.delta-=2*g.strength();break;
    case 'forceNormal':e.normal=true;break;
    case 'crown':e.delta+=Math.max(0,1-g.strength());break;
    default:throw new Error('未知道具效果');
  }
  h.hand.splice(h.hand.indexOf(item),1);g.discard(item);g.metrics.items++;
  g.metrics.itemEffects[item.effect]=(g.metrics.itemEffects[item.effect]??0)+1;
  g.note(`${h.name} 使用「${item.name}」。`);
}
