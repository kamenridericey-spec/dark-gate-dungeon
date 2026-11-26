import {createMap,frontiers,reachable,orientations,opposite,PATTERNS,hasDoor} from './map.mjs?v=093';
import {VERSION,ROLES,COSTS,MAX_SOUL,CAPACITY,WIN_FRAGMENTS,tier,recordPattern,stanceName,TASK_REWARD,CITY_SOUL_LIMIT,CITY_WIN_LEVEL} from './rules.mjs?v=093';

export class Game {
  constructor(data,seed=Date.now()){
    this.data=structuredClone(data); this.seed=seed>>>0; this.randomState=this.seed; this.serial=0;
    const map=createMap(list=>this.shuffle(list));
    this.rooms=map.rooms; this.start=map.start;
    this.heroes=['阿栎','苔丝','灰羽'].map((name,id)=>({id,name,role:ROLES[id],specialty:ROLES[id],soul:MAX_SOUL[id],max:MAX_SOUL[id],capacity:CAPACITY[id],pos:this.start,state:'ready',hand:[],carried:null}));
    this.level=1; this.round=1; this.citySoul=0; this.fragments=0; this.history=[]; this.turn=0;
    this.events=[]; this.eventDiscard=[]; this.goods=[]; this.goodsDiscard=[]; this.monsters={}; this.monsterDiscard={I:[],II:[],III:[],IV:[]};
    this.pattern=null; this.revealed=false; this.excluded=new Set();
    this.hand=[]; this.slots=[null,null,null]; this.logs=[]; this.trace=[]; this.encounter=null;
    this.metrics={firstFragmentRound:null,firstUpgradeRound:null,thirdTierRound:null,itemEffects:{},rooms:0,checks:0,success:0,breaches:0,task:0,cardFragments:0,cityTurns:0,rotations:0,cityRotations:0,meaningfulCityRotations:0,trades:0,items:0,tradeOffers:0,tradeAccepted:0,group:0,income:{round:0,advantage:0,trade:0}};
    this.unlock(1); this.hand=this.drawEvents(6);
    const startingItem=this.drawGoods(1)[0];
    if(startingItem) this.heroes[1].hand.push(startingItem);
    this.phase='city'; this.note('入口已打开。城主布置第一轮。');
  }
  random(){this.randomState=(Math.imul(this.randomState,1664525)+1013904223)>>>0;return this.randomState/4294967296;}
  shuffle(list){const result=[...list];for(let i=result.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
  unique(card){return {...structuredClone(card),uid:++this.serial};}
  assert(ok,message){if(!ok)throw new Error(message);}
  note(text){this.logs.push({round:this.round,turn:this.turn,text});}
  unlock(level){
    const key=tier(level), encounters=this.data.encounters.filter(c=>c.tier===key), goods=this.data.items.cards.filter(c=>c.tier===level), monsters=this.data.monsters[key];
    this.events=this.shuffle([...this.events,...encounters]); this.goods=this.shuffle([...this.goods,...goods.map(c=>this.unique(c))]);
    this.monsters[key]=this.shuffle(monsters);
    if(level>1)this.note(`${key}级解锁：${encounters.length}张遭遇（DC${encounters[0].dc}）、${goods.length}张普通物资、${monsters.length}只怪物。${level===3?'解锁怪物碎片。':''}`);
  }
  draw(stack,discard,n,label){
    const cards=[];
    while(cards.length<n){
      if(!stack.length&&discard.length){stack.push(...this.shuffle(discard.splice(0)));this.note(`${label}抽堆耗尽，回洗公开弃牌。`);}
      if(!stack.length)break;
      cards.push(stack.shift());
    }
    return cards;
  }
  drawEvents(n){return this.draw(this.events,this.eventDiscard,n,'遭遇');}
  drawGoods(n){return this.draw(this.goods,this.goodsDiscard,n,'物资');}
  drawMonster(key){return this.draw(this.monsters[key],this.monsterDiscard[key],1,`${key}级怪物`)[0];}
  get actor(){return this.heroes[this.turn];}
  get buyer(){return this.heroes[this.encounter.bearer];}
  get need(){return this.slots.filter(s=>!s).length;}
  get canUpgrade(){return this.phase==='city'&&!this.upgraded&&this.level<CITY_WIN_LEVEL&&this.citySoul>=COSTS[this.level-1];}
  get mustUpgrade(){return this.canUpgrade&&this.level<3&&this.upgradeDue===this.level;}
  upgrade(){
    this.assert(this.canUpgrade,'当前不能升级');
    this.citySoul-=COSTS[this.level-1];this.upgraded=true;this.upgradeDue=null;this.level++;
    if(this.level===2)this.metrics.firstUpgradeRound=this.round;
    if(this.level===3)this.metrics.thirdTierRound=this.round;
    this.note(`城主升至${tier(this.level)}级。`);
    if(this.level===CITY_WIN_LEVEL){this.end('城主',`升至 ${tier(CITY_WIN_LEVEL)} 级`);return;}
    this.unlock(this.level);
    const newTierIndex=this.events.findIndex(card=>card.tier===tier(this.level));
    const extra=newTierIndex<0?undefined:this.events.splice(newTierIndex,1)[0];
    if(!extra)return;
    this.hand.push(extra); this.note('升级额外摸 1 张新等级遭遇。');
    if(this.hand.length>6)this.choose('升级换牌','city',this.hand.map(c=>({label:c.name,card:c})),i=>{
      this.events.push(this.hand.splice(i,1)[0]); this.phase='city';
    });
  }
  prepare(pattern,indices){
    this.assert(this.phase==='city'&&PATTERNS.includes(pattern),'请选择机关纹样');
    this.assert(!this.mustUpgrade,'上轮已延后开门，本轮须先升级迷宫');
    const amount=Math.min(this.need,this.hand.length);
    this.assert(indices.length===amount&&new Set(indices).size===amount&&indices.every(i=>this.hand[i]),'请选择足量且不同的遭遇');
    if(this.level<3&&this.canUpgrade){this.upgradeDue=this.level;this.note('本轮已延后升级，下个城主回合须解锁新等级。');}
    for(const i of indices)this.slots[this.slots.indexOf(null)]={card:this.hand[i],open:false};
    this.hand=this.hand.filter((_,i)=>!indices.includes(i));
    this.pattern=pattern;this.revealed=false;this.excluded=new Set();this.metrics.cityTurns++;
    this.phase='action';this.turn=0;this.note('城主已布置遭遇，机关已暗置。');
  }
  income(kind){
    const source={round:'大轮结束',advantage:'城主优势',trade:'实际成交'}[kind];
    if(this.citySoul>=CITY_SOUL_LIMIT){this.note(`城主魂已满 · ${source}`);return;}
    this.citySoul++;this.metrics.income[kind]++;
    this.note(`城主 +1 魂 · ${source}`);
  }
  nextTurn(){
    if(this.winner)return;
    this.turn++;
    while(this.turn<3&&this.actor.state==='explored')this.turn++;
    if(this.turn<3){this.phase='action';return;}
    this.income('round');this.round++;this.turn=0;this.upgraded=false;
    for(const h of this.heroes){h.state='ready';h.specialty=h.role;}
    const n=Math.min(this.need,Math.max(0,5-this.hand.length));
    const cards=this.drawEvents(n);this.hand.push(...cards);
    this.note(`第 ${this.round} 轮，城主常规摸 ${cards.length} 张。`);
    this.phase='city';
  }
  reachable(id){return reachable(this.rooms,id);}
  get canBreach(){
    const living=this.heroes.filter(h=>h.soul>0);
    const accessible=new Set(living.flatMap(h=>this.reachable(h.pos)));
    return ![...accessible].some(id=>frontiers(this.rooms,id).length)&&this.rooms.some(r=>r.state==='covered');
  }
  targets(id=this.turn){const h=this.heroes[id];return h?.soul>0?frontiers(this.rooms,h.pos,this.canBreach):[];}
  partyOptions(){return this.heroes.filter(h=>h.soul>0&&h.state!=='explored'&&h.pos===this.actor.pos).map(h=>h.id);}
  travelTargets(){
    const h=this.actor;
    if(!h||h.carried!==null)return [];
    return this.reachable(h.pos).filter(id=>id!==h.pos&&(h.soul>0||Math.abs(id%6-h.pos%6)+Math.abs(Math.floor(id/6)-Math.floor(h.pos/6))===1));
  }
  move(id,to){this.heroes[id].pos=to;for(const h of this.heroes)if(h.carried===id)h.pos=to;}
  attach(){
    for(const h of this.heroes){
      if(h.soul>0){h.carried=null;continue;}
      if(h.carried!==null&&this.heroes[h.carried].soul>0&&this.heroes[h.carried].pos===h.pos)continue;
      h.carried=this.heroes.find(a=>a.soul>0&&a.pos===h.pos)?.id??null;
    }
  }
  travel(to){this.assert(this.phase==='action'&&this.travelTargets().includes(to),'目的地不可赶路');const from=this.actor.pos;this.move(this.turn,to);this.actor.state='moved';this.attach();this.note(`${this.actor.name} 赶路 ${from+1} → ${to+1}`);this.nextTurn();}
  wait(){this.assert(this.phase==='action','当前不能结束行动');this.actor.state='moved';this.note(`${this.actor.name} 结束行动。`);this.nextTurn();}
  explore(to,ids,bearer){
    const edge=this.targets().find(x=>x.to===to);
    this.assert(this.phase==='action'&&edge&&this.slots.some(Boolean)&&ids.includes(this.turn)&&ids.includes(bearer)&&new Set(ids).size===ids.length&&ids.every(id=>this.partyOptions().includes(id)),'请选择合法房间、队员和承担者');
    this.encounter={to,from:this.actor.pos,party:[...ids],bearer,actor:this.turn,entry:opposite(edge.d),card:null,monster:null,delta:0,guard:0,coffin:false,normal:false,orientCity:false,traded:false,paid:false,queue:[],goods:[],hit:false};
    this.phase='door';
  }
  bearer(id){
    this.assert((this.phase==='door'||(this.phase==='check'&&this.encounter.card.kind!=='交易'))&&this.encounter.party.includes(id)&&this.heroes[id].soul>0,'无法更换承担者');
    this.encounter.bearer=id;
  }
  reveal(slot){
    this.assert(this.phase==='door'&&this.slots[slot],'没有可揭开的遭遇');
    const e=this.encounter,room=this.rooms[e.to],direction=opposite(e.entry);
    if(!hasDoor(this.rooms[e.from],direction)){(this.rooms[e.from].breachDoors??=[]).push(direction);this.metrics.breaches++;this.note('全队无可达新门，本场破墙进入。');}
    room.state='pending';room.doors=[e.entry];
    for(const id of e.party){this.move(id,e.to);this.heroes[id].state='explored';}
    this.attach();e.hit=room.pattern===this.pattern;
    if(e.hit){this.revealed=true;this.note(`命中 ${room.pattern} 机关。`);}else{this.excluded.add(room.pattern);this.note(`${room.pattern} 未触发机关。`);}
    e.card=this.slots[slot].card;this.slots[slot]=null;this.metrics.rooms++;if(e.party.length>1)this.metrics.group++;
    this.note(`${e.party.map(i=>this.heroes[i].name).join('、')} 进入 ${e.to+1}：${e.card.name}`);
    this.phase='revealed';
  }
  continueEncounter(){
    this.assert(this.phase==='revealed','尚未揭晓');
    const e=this.encounter;
    if(e.card.kind==='战斗'){e.monster=this.drawMonster(e.card.monsterDraw.tier);this.assert(e.monster,'怪物堆无可用牌');this.note(`遭遇怪物：${e.monster.name}`);this.phase='monster';}
    else if(e.card.kind==='交易'){
      this.metrics.tradeOffers++;
      if(!this.goods.length&&!this.goodsDiscard.length){this.note('物资不足，交易结束。');this.finishCheck();}
      else this.phase='trade';
    }else this.phase='check';
  }
  startCheck(){this.assert(this.phase==='monster','尚未准备检定');this.phase='check';}
  acceptTrade(yes){
    this.assert(this.phase==='trade','没有报价');
    if(yes){this.metrics.tradeAccepted++;this.phase='check';return;}
    this.note('拒绝报价。');this.finishCheck();
  }
  strength(){const e=this.encounter;return Number(this.buyer.specialty===e.card.attribute)-Number(e.hit)+e.delta;}
  mode(){return this.encounter.normal?0:Math.sign(this.strength());}
  roll(){
    this.assert(this.phase==='check','当前不可掷骰');
    const e=this.encounter;e.mode=this.mode();e.roller=e.bearer;e.charm=this.buyer.specialty==='魅力';
    e.dice=Array.from({length:e.mode?2:1},()=>1+Math.floor(this.random()*20));
    this.note(`${stanceName(e.mode)}，掷出 ${e.dice.join('／')}。`);this.phase='rolled';
  }
  value(){const {mode,dice}=this.encounter;return mode>0?Math.max(...dice):mode<0?Math.min(...dice):dice[0];}
  confirm(){
    this.assert(this.phase==='rolled','尚未掷骰');
    const e=this.encounter;e.success=this.value()>=e.card.dc;this.metrics.checks++;if(e.success)this.metrics.success++;
    this.note(`取 ${this.value()} / DC${e.card.dc} · ${e.success?'成功':'失败'}`);
    const outcome=e.success?'success':'failure';
    if(e.card.offer){
      const offer=e.card.offer;
      e.goods=this.drawGoods(offer.revealByResult[outcome]+(e.charm?offer.charmExtraReveal:0));
    }
    e.queue=[...e.card[outcome],...this.patternEffects(outcome)];
    this.resolve(()=>e.card.offer?this.openGoods():this.finishCheck());
  }
  patternEffects(trigger){
    const e=this.encounter;
    return e.card.patternEffect?.when===trigger&&e.card.preferredPattern===this.rooms[e.to].pattern?e.card.patternEffect.effects:[];
  }
  choose(title,side,options,apply){
    this.assert(options.length,'没有可用选项');
    this.pending={title,side,options,apply};this.phase='choice';
  }
  select(index){
    this.assert(this.phase==='choice'&&this.pending?.options[index],'无效选项');
    const p=this.pending;this.pending=null;p.apply(index);
  }
  resolve(done){
    const e=this.encounter;
    if(this.winner)return;
    const fx=e.queue.shift();if(!fx){done();return;}
    const again=(next=done)=>this.resolve(next);
    const h=this.buyer;
    switch(fx.effect){
      case 'completeOffer':case 'none':again();break;
      case 'orientRoom':e.orientCity=true;again();break;
      case 'fragment':this.addFragment(fx.amount,'遭遇');again();break;
      case 'heal':for(const id of fx.target==='explorers'?e.party:[h.id])this.heal(id,fx.amount);again();break;
      case 'loseSoul':
        {
          const area=fx.target==='explorers'||fx.target==='livingParty';
          const targets=area?this.heroes.filter(ally=>ally.soul&&(fx.target==='livingParty'||e.party.includes(ally.id))).map(ally=>ally.id):[h.id];
          if(!targets.length){again();break;}
          e.damage={target:h.id,targets,area,amount:fx.amount,resume:()=>again()};
          this.phase='damage';
          this.note(area?`${targets.map(id=>this.heroes[id].name).join('、')} 各即将失去 ${fx.amount} 魂。`:`${h.name} 即将失去 ${fx.amount} 魂。`);
          break;
        }
      case 'discardItem':
        if(!h.hand.length){this.note(`${h.name} 无物可弃。`);again();break;}
        this.choose('选择弃置物品','party',h.hand.map(item=>({label:item.name,card:item})),i=>{
          const [item]=h.hand.splice(i,1);this.discard(item);this.note(`${h.name} 弃置 ${item.name}。`);
          if(fx.amount>1)e.queue.unshift({...fx,amount:fx.amount-1});again();
        });break;
      case 'drawItem':this.awardMany(this.drawGoods(fx.amount),h.id,()=>again());break;
      case 'monsterReward':{
        const reward=e.monster.reward;
        if(reward.effect==='fragment'){this.addFragment(reward.amount,e.monster.name);again();break;}
        const item=this.data.items.loot[reward.lootRef];
        if(item&&!this.heroes.some(a=>a.hand.some(c=>c.id===item.id)))this.receive(this.unique({...item,monster:true}),h.id,()=>again());
        else{this.note('配对素材已被持有。');again();}break;
      }
      default:throw new Error(`未知效果：${fx.effect}`);
    }
  }
  damage(){
    const e=this.encounter;this.assert(this.phase==='damage'&&e.damage,'没有待结算伤害');
    const {target,targets,area,amount,resume}=e.damage;
    for(const id of area?targets:[target]){
      const protectedTarget=!area||id===e.bearer;
      const blocked=protectedTarget?Math.min(amount,e.guard):0;
      e.guard-=blocked;
      const h=this.heroes[id],before=h.soul;
      h.soul=Math.max(0,h.soul-amount+blocked);
      if(!h.soul&&e.coffin&&before>0&&protectedTarget){h.soul=1;e.coffin=false;}
      this.note(`${h.name} 魂 ${before} → ${h.soul}${blocked?`（护住 ${blocked}）`:''}。`);
    }
    this.attach();if(this.heroes.every(a=>!a.soul)){this.end('城主','全员失魂');return;}
    e.damage=null;resume();
  }
  heal(id,amount){const h=this.heroes[id],before=h.soul;h.soul=Math.min(h.max,h.soul+amount);this.attach();this.note(`${h.name} 回魂 ${before} → ${h.soul}。`);}
  discard(item){if(!item.monster)this.goodsDiscard.push(item);}
  awardMany(items,id,done){const item=items.shift();if(!item){done();return;}this.receive(item,id,()=>this.awardMany(items,id,done));}
  give(item,id){this.heroes[id].hand.push(item);this.note(`${this.heroes[id].name} 获得 ${item.name}。`);}
  receive(item,id,done){
    const h=this.heroes[id];if(h.hand.length<h.capacity){this.give(item,id);done();return;}
    const options=this.encounter.party.filter(i=>i!==id&&this.heroes[i].soul>0&&this.heroes[i].hand.length<this.heroes[i].capacity)
      .map(i=>({label:`交给 ${this.heroes[i].name}`,to:i}));
    options.push(...h.hand.map((c,i)=>({label:`弃置 ${c.name}`,card:c,replace:i})),{label:`放弃 ${item.name}`});
    this.choose(`领取 ${item.name}`,'party',options,index=>{
      const option=options[index];
      if(option.to!==undefined)this.give(item,option.to);
      else if(option.replace!==undefined){this.discard(h.hand.splice(option.replace,1)[0]);this.give(item,id);}
      else this.discard(item);
      done();
    });
  }
  openGoods(){
    if(!this.encounter.goods.length||!this.buyer.soul){this.leaveTrade();return;}
    this.phase='goods';
  }
  paymentOptions(){
    const h=this.buyer,cost=this.encounter.card.offer.cost;
    return cost.kind==='soul'?(h.soul>cost.amount?[{key:'soul',label:`支付 ${cost.amount} 魂`}]:[])
      :h.hand.map(c=>({key:String(c.uid),label:`交付 ${c.name}`,card:c}));
  }
  recipients(payment){
    return this.encounter.party.filter(id=>{
      const h=this.heroes[id];
      return h.soul>0&&(h.hand.length<h.capacity||(id===this.buyer.id&&payment!=='soul'));
    });
  }
  leaveTrade(){
    this.goods.push(...this.encounter.goods.splice(0));this.note('未成交。');this.finishCheck();
  }
  purchase(index){
    this.assert(this.phase==='goods'&&this.encounter.goods[index],'请选择已公开的货物');
    const e=this.encounter,options=this.paymentOptions().filter(p=>this.recipients(p.key).length);
    this.assert(options.length,'没有合法的付款和接收位置');
    const item=e.goods[index];
    const complete=(p,id)=>{
      const h=this.buyer;
      if(p.key==='soul'){const before=h.soul;h.soul-=e.card.offer.cost.amount;this.note(`交易付款 · ${h.name} 魂 ${before} → ${h.soul}。`);}
      else{const old=h.hand.splice(h.hand.findIndex(c=>String(c.uid)===p.key),1)[0];this.discard(old);this.note(`交易付款 · 交付 ${old.name}。`);}
      e.goods.splice(index,1);this.goods.push(...e.goods.splice(0));this.give(item,id);e.traded=true;this.metrics.trades++;
      e.queue=[...e.card.offer.afterTrade,...this.patternEffects('afterTrade')];this.resolve(()=>this.finishCheck());
    };
    const selectPayment=i=>{const p=options[i],ids=this.recipients(p.key);if(ids.length===1)complete(p,ids[0]);
      else this.choose('选择接收者','party',ids.map(id=>({label:this.heroes[id].name})),i=>complete(p,ids[i]));};
    if(options.length===1)selectPayment(0);else this.choose('选择付款物','party',options,selectPayment);
  }
  addFragment(n,source){
    if(this.winner)return;
    if(!this.fragments)this.metrics.firstFragmentRound=this.round;
    n=Math.min(n,1,WIN_FRAGMENTS-this.fragments);
    this.fragments+=n;if(source==='共鸣'||source==='巡礼')this.metrics.task+=n;else this.metrics.cardFragments+=n;
    this.note(`+${n} 碎片 · ${source}（${this.fragments}/${WIN_FRAGMENTS}）`);
    if(this.fragments>=WIN_FRAGMENTS)this.end('冒险者','集齐五枚碎片');
  }
  finishCheck(){
    if(this.winner)return;
    const e=this.encounter;
    if(e.success&&(!e.card.offer||e.traded)){
      const next=recordPattern(this.history,this.rooms[e.to].pattern);
      this.history=next.history;
      this.note(`任务记录：${this.history.join(' · ')||'清空'}。`);
      if(next.task)this.addFragment(TASK_REWARD,next.task);
    }
    if(this.winner)return;
    if(e.mode===-1)this.income('advantage');if(e.traded)this.income('trade');
    e.orientations=orientations(this.rooms,e.to,e.entry);this.assert(e.orientations.length,'来路无法接通');
    this.phase='orient';if(e.orientations.length===1)this.orient(0);
  }
  orient(index){
    const e=this.encounter;
    this.assert(this.phase==='orient'&&e.orientations[index],'选一个保留来路的朝向');
    const chosen=e.orientations[index];const room=this.rooms[e.to];
    this.assert(chosen.doors.length===room.shape.length,'旋转必须保留地砖门数');
    room.state='open';room.doors=chosen.doors;
    this.note(`${e.orientCity?'城主':this.heroes[e.actor].name} 为房间 ${e.to+1} 定向（${chosen.rotation*90}°）。`);
    this.metrics.rotations++;if(e.orientCity){this.metrics.cityRotations++;if(new Set(e.orientations.map(o=>o.viable.join())).size>1)this.metrics.meaningfulCityRotations++;}
    this.eventDiscard.push(e.card);if(e.monster)this.monsterDiscard[e.card.tier].push(e.monster);
    this.encounter=null;
    if(this.rooms.every(r=>r.state==='open'))this.end('城主','迷宫已全部探索');
    else this.nextTurn();
  }
  end(side,reason){this.winner=side;this.reason=reason;this.phase='end';this.pending=null;this.note(`${side}胜利 · ${reason}`);}
  get side(){return this.phase==='city'||(this.phase==='orient'&&this.encounter.orientCity)||this.pending?.side==='city'?'city':'party';}
}
