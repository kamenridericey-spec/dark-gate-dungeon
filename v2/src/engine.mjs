export const THEMES=['破坏仪式','遗物回收','空间裂隙'];
export class Game{
 constructor(data,{seed=1,roles=['体魄','心智','魅力']}={}){
  this.data=structuredClone(data);this.seed=seed>>>0;this.uid=0;this.round=1;this.level=1;this.citySoul=0;this.fragments=0;this.phase='city';this.window='轮初';this.turn=0;this.log=[];this.winner=null;this.theme=null;this.previousTheme=null;this.rift=null;this.pending=null;this.encounter=null;this.cityHand=[];this.slots=[null,null,null];this.eventDiscard=[];this.rewardDiscard=[];this.monsterDiscard={1:[],2:[],3:[]};this.metrics={rooms:0,groupSizes:[],deaths:0,revivals:0,upgrades:[],income:{round:0,battle:0,advantage:0,trade:0},items:{},themes:{},healing:0,soulLoss:0,itemsReceived:0,bearers:[0,0,0],monsterEncounters:{1:0,2:0,3:0},themeValue:{citySoulDelta:0,recovered:0,riftCreated:0,riftUsed:0,riftReplaced:0,riftFailed:0}};
  this.heroes=roles.map((role,i)=>({id:i,name:['阿栎','苔丝','灰羽'][i],role,specialty:role,soul:role==='体魄'?4:3,max:role==='体魄'?4:3,pos:0,state:'ready',carriedBy:null,forced:null,hand:[],equipment:[]}));
  this.rooms=this.makeMap();this.visited=new Set([0]);this.events=this.shuffle(this.data.encounters.filter(c=>c.tier===1));this.rewards=[];this.monsters={1:this.shuffle(this.data.monsters[1]),2:[],3:[]};
  const ordinary=this.shuffle(this.data.cards.filter(c=>c.tier===1).map(c=>this.card(c)));
  for(const h of this.heroes)if(h.role==='心智'){const i=ordinary.findIndex(c=>!c.equipment);if(i>=0)h.hand.push(ordinary.splice(i,1)[0]);}
  this.metrics.itemsReceived=this.heroes.reduce((n,h)=>n+h.hand.length,0);this.rewards=this.shuffle([...ordinary,...Array.from({length:4},()=>this.card({name:'地牢碎片',fragment:true,tier:1,text:'成功领取，进度加一。'}))]);
  this.cityHand=this.drawEvents(6);this.note('V0.8.2 开局：城主摸六张，自选部署三张。');
 }
 card(c){return {...structuredClone(c),uid:++this.uid};}
 random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
 shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
 note(text,kind='info'){this.log.push({round:this.round,turn:this.turn,kind,text});}
 assert(ok,message){if(!ok)throw Error(message);}
 makeMap(){
  const r=[{id:0,x:-1,y:0,type:'入口',tile:-1,links:[1]}];
  for(let y=0;y<8;y++)for(let x=0;x<8;x++){const id=1+y*8+x;r.push({id,x,y,type:['宝藏','恢复','奇遇'][(x+2*y+Math.floor(x/2))%3],tile:Math.floor(x/2)+4*Math.floor(y/2),links:[]});}
  const connect=(a,b)=>{if(!r[a].links.includes(b))r[a].links.push(b);if(!r[b].links.includes(a))r[b].links.push(a);};connect(0,1);connect(0,9);connect(0,17);
  // 16 four-cell modules: all internal doors; alternating boundary doors create forks and joining loops.
  for(let y=0;y<8;y++)for(let x=0;x<8;x++){let id=1+y*8+x;if(x<7&&(x%2===0||y%2===0))connect(id,id+1);if(y<7&&(y%2===0||x%2===1))connect(id,id+8);}
  return r;
 }
 reachable(from){const seen=new Set([from]),q=[from];for(const p of q)for(const n of this.rooms[p].links)if(this.visited.has(n)&&!seen.has(n)){seen.add(n);q.push(n);}return [...seen];}
 targets(id){const h=this.heroes[id];if(h.forced!==null&&!this.visited.has(h.forced))return [h.forced];return this.rooms[h.pos].links.filter(n=>!this.visited.has(n)).concat(this.rift&&this.rift.from===h.pos&&!this.visited.has(this.rift.to)?[this.rift.to]:[]);}
 drawEvents(n){const out=[];for(let i=0;i<n;i++){if(!this.events.length&&this.eventDiscard.length){this.events=this.shuffle(this.eventDiscard);this.eventDiscard=[];this.note('公开遭遇弃牌洗回。');}if(this.events.length)out.push(this.events.shift());}return out;}
 drawRewards(n){const out=[];for(let i=0;i<n;i++){if(!this.rewards.length&&this.rewardDiscard.length){this.rewards=this.shuffle(this.rewardDiscard);this.rewardDiscard=[];this.note('普通收获弃牌洗回。');}if(this.rewards.length)out.push(this.rewards.shift());}return out;}
 discardCard(c){if(c&&!c.fragment)this.rewardDiscard.push(c);}
 prepare(theme,deploy){
  this.assert(this.phase==='city'&&THEMES.includes(theme),'不在城主准备／主题无效');this.assert(theme!==this.previousTheme,'不能连续主动选择同主题');
  const empty=this.slots.map((s,i)=>s?null:i).filter(i=>i!==null);this.assert(deploy.length===empty.length&&new Set(deploy).size===deploy.length&&deploy.every(i=>this.cityHand[i]),'须选择不同手牌补满三个位置');
  empty.forEach((p,i)=>this.slots[p]={card:this.cityHand[deploy[i]],open:false});for(const i of [...deploy].sort((a,b)=>b-a))this.cityHand.splice(i,1);
  this.theme=theme;this.previousTheme=theme;this.note('城主选择'+theme+'，补满三个固定位置。');
  const done=()=>{this.phase='action';this.window='行动前';this.turn=0;this.advanceTurn();};
  this.trimCity(done);
 }
 trimCity(next){if(this.cityHand.length<=5)return next();this.choose('城主手牌超过五张，选择公开弃置',this.cityHand.map((c,i)=>({label:c.name,value:i})),i=>{this.eventDiscard.push(this.cityHand.splice(i,1)[0]);this.trimCity(next);});}
 canUpgrade(){return this.phase==='city'&&!this.upgraded&&this.level<4&&this.citySoul>=[5,7,12][this.level-1];}
 upgrade(){this.assert(this.canUpgrade(),'无法升级');const cost=[5,7,12][this.level-1];this.citySoul-=cost;this.level++;this.upgraded=true;this.metrics.upgrades.push({level:this.level,round:this.round});this.note('城主支付'+cost+'魂，升至'+this.level+'级。');if(this.level===4){this.end('城主升IV');return;}
  this.events=this.shuffle([...this.events,...this.data.encounters.filter(c=>c.tier===this.level)]);this.rewards=this.shuffle([...this.rewards,...this.data.cards.filter(c=>c.tier===this.level).map(c=>this.card(c)),...Array.from({length:2},()=>this.card({name:'地牢碎片',fragment:true,tier:this.level}))]);this.monsters[this.level]=this.shuffle(this.data.monsters[this.level]);const drawn=this.drawEvents(1);this.cityHand.push(...drawn);this.note('升级额外摸'+drawn.length+'张。');
 }
 advanceTurn(){if(this.winner)return;while(this.turn<3&&this.heroes[this.turn].state==='explored')this.turn++;if(this.turn>=3){this.income('round',1);this.round++;this.turn=0;this.upgraded=false;for(const h of this.heroes){h.state='ready';h.specialty=h.role;}this.cityHand.push(...this.drawEvents(3));this.phase='city';this.window='轮初';this.note('新大轮，城主常规摸三张。');return;}
  this.phase='action';this.window='行动前';const h=this.heroes[this.turn];if(h.forced!==null&&this.visited.has(h.forced))h.forced=null;if(h.forced!==null&&h.soul>0&&h.state==='ready')this.explore(h.forced,[h.id],h.id);
 }
 endAction(){this.turn++;this.advanceTurn();}
 travel(id,to){this.assert(this.phase==='action'&&id===this.turn,'不是该玩家主动操作');const h=this.heroes[id];this.assert(h.state==='ready','没有行动资格');this.assert(h.forced===null,'下次操作必须探索强制目标');const reach=this.reachable(h.pos);this.assert(this.visited.has(to)&&reach.includes(to),'赶路只沿合法已探索连接');if(h.soul===0){this.assert(h.carriedBy===null&&this.rooms[h.pos].links.includes(to),'失魂独行者每轮只能移动一格');}
  this.move(id,to);h.state='moved';this.note(h.name+'赶路至房'+to);this.attachLost();this.endAction();
 }
 wait(){this.assert(this.phase==='action','不是行动时机');this.assert(this.heroes[this.turn].forced===null,'必须探索强制目标');this.heroes[this.turn].state='moved';this.note('原地待命，无资源收益。');this.endAction();}
 move(id,to){this.heroes[id].pos=to;for(const h of this.heroes)if(h.carriedBy===id)h.pos=to;}
 attachLost(){for(const h of this.heroes){if(h.soul>0){h.carriedBy=null;continue;}const carrier=this.heroes[h.carriedBy];if(carrier?.soul>0&&carrier.pos===h.pos)continue;h.carriedBy=null;const candidates=this.heroes.filter(x=>x.soul>0&&x.pos===h.pos);if(candidates.length>=1){h.carriedBy=candidates[0].id;this.note(h.name+'由'+candidates[0].name+'携带。');}}}
 setCarrier(id,carrier){const h=this.heroes[id],c=this.heroes[carrier];this.assert(h.soul===0&&c.soul>0&&h.pos===c.pos&&id!==carrier,'携带关系无效');h.carriedBy=carrier;}
 explore(to,party=[this.turn],bearer=this.turn){
  this.assert(this.phase==='action','不是探索时机');const actor=this.heroes[this.turn];this.assert(actor.soul>0&&actor.state==='ready','不能发起探索');this.assert(this.targets(actor.id).includes(to),'目的地不合法／必须强制探索');
  this.assert(new Set(party).size===party.length&&party.includes(this.turn)&&party.includes(bearer),'小队或承担者无效');for(const id of party){const h=this.heroes[id];this.assert(h&&h.soul>0&&h.pos===actor.pos&&h.state!=='explored','队员不在场或已经探索');this.assert(h.forced===null||h.forced===to||this.visited.has(h.forced),'队员有其他强制探索承诺');}
  this.encounter={to,party:[...party],bearer,actor:this.turn,card:null,monster:null,goods:[],payment:null,mode:null,dice:[],guard:0,coffin:false,delta:0,forceNormal:false,consumed:[],usedEffects:[],income:[],replaced:false};this.phase='door';this.window='开门前';
 }
 setParty(party,bearer){this.assert(this.phase==='door','只能开门前调整小队');const e=this.encounter,actor=this.heroes[e.actor];this.assert(new Set(party).size===party.length&&party.includes(actor.id)&&party.includes(bearer),'小队无效');for(const id of party){const h=this.heroes[id];this.assert(h&&h.soul>0&&h.pos===actor.pos&&h.state!=='explored'&&(h.forced===null||h.forced===e.to||this.visited.has(h.forced)),'队员不合格');}e.party=[...party];e.bearer=bearer;}
 reveal(slot){this.assert(this.phase==='door'&&this.slots[slot],'必须选择未使用位置');const e=this.encounter;if(this.rift?.from===this.heroes[e.actor].pos&&this.rift.to===e.to)this.metrics.themeValue.riftUsed++;e.card=this.slots[slot].card;this.slots[slot]=null;for(const id of e.party){this.move(id,e.to);this.heroes[id].state='explored';this.heroes[id].forced=null;}this.visited.add(e.to);for(const h of this.heroes)if(h.forced===e.to)h.forced=null;if(this.rift?.to===e.to){if(this.rift.from===this.heroes[e.actor].pos)this.metrics.themeValue.riftUsed++;this.rift=null;}this.metrics.bearers[e.bearer]++;this.metrics.rooms++;this.metrics.groupSizes.push(e.party.length);this.note('小队'+e.party.join('/')+'进入'+this.rooms[e.to].type+'，翻开'+e.card.name);this.phase='revealed';this.window='遭遇揭晓后';}
 continueEncounter(){this.assert(this.phase==='revealed','不是揭晓后');const e=this.encounter;if(e.card.kind==='战斗'){const t=e.card.tier;if(!this.monsters[t].length){this.monsters[t]=this.shuffle(this.monsterDiscard[t]);this.monsterDiscard[t]=[];}e.monster=this.monsters[t].shift()??null;if(e.monster)this.metrics.monsterEncounters[t]++;}
  if(e.card.kind==='交易'){e.goods=this.drawRewards(this.heroes[e.bearer].role==='魅力'?3:2);this.phase='trade';this.window='交易决定';this.note('先展示货物：'+(e.goods.map(c=>c.name).join('、')||'无货'));}else{this.phase='check';this.window='检定前';}
 }
 acceptTrade(payment){this.assert(this.phase==='trade','不是交易');const e=this.encounter,h=this.heroes[e.bearer];if(payment===null||!e.goods.length){this.rewards.push(...this.shuffle(e.goods));e.goods=[];this.note('拒绝交易或无货：无支付、检定和房间收益。');this.finishRoom();return;}
  if(payment.kind==='soul'){this.assert(h.soul>0,'无魂支付');e.payment={kind:'soul',owner:h.id};}else{const owner=this.heroes[payment.owner],zone=payment.zone??'hand',c=owner?.[zone]?.find(c=>c.uid===payment.uid);this.assert(e.party.includes(payment.owner)&&c,'付款物必须来自本次队员');e.payment={kind:'card',owner:payment.owner,zone,uid:c.uid};}this.phase='check';this.window='检定前';this.note('接受交易，锁定付款。');
 }
 rawStrength(){const e=this.encounter;const shared=e.party.some(i=>this.heroes[i].specialty===e.card.attribute)?1:0;const pref=e.card.prefer===this.rooms[e.to].type?1:0;const m=e.monster;const pressure=m?.pressure&&(!m.matchOnly||this.heroes[e.bearer].specialty===e.card.attribute)?m.pressure:0;return shared-pref-pressure+e.delta;}
 preview(){return this.encounter.forceNormal?0:Math.sign(this.rawStrength());}
 roll(){this.assert(this.phase==='check','不是检定前');const e=this.encounter;e.mode=this.preview();e.dice=Array.from({length:e.mode?2:1},()=>1+Math.floor(this.random()*20));this.phase='rolled';this.window='检定后';this.note('掷骰'+e.dice.join('/')+'，'+['劣势','均势','优势'][e.mode+1]);}
 final(){const e=this.encounter;return e.mode>0?Math.max(...e.dice):e.mode<0?Math.min(...e.dice):e.dice[0];}
 heal(id,n,reason){const h=this.heroes[id],before=h.soul;h.soul=Math.min(h.max,h.soul+n);this.metrics.healing+=h.soul-before;if(before===0&&h.soul>0){h.carriedBy=null;this.metrics.revivals++;}this.note(h.name+' '+reason+' 魂'+before+'→'+h.soul+'（实际恢复'+(h.soul-before)+'）');}
 lose(id,n,reason,{protectedLoss=false}={}){const h=this.heroes[id],e=this.encounter;let amount=n;if(protectedLoss&&e&&id===e.bearer){const block=Math.min(e.guard,amount);e.guard-=block;amount-=block;}const before=h.soul;h.soul=Math.max(0,h.soul-amount);if(e?.coffin&&h.soul===0&&before>0&&id===e.bearer){h.soul=1;e.coffin=false;this.note('保魂触发');}this.metrics.soulLoss+=before-h.soul;if(before>0&&h.soul===0)this.metrics.deaths++;this.note(h.name+' '+reason+' 魂'+before+'→'+h.soul);this.attachLost();this.checkEnd();}
 checkEnd(){if(this.fragments>=4)this.end('冒险者碎片');else if(this.heroes.every(h=>h.soul===0))this.end('城主全员失魂');return !!this.winner;}
 end(winner){this.winner=winner;this.phase='end';this.window='终局';this.pending=null;this.note('终局：'+winner);}
 income(kind,n){if(this.winner)return;const before=this.citySoul;this.citySoul+=n;this.metrics.income[kind]+=n;this.note('城主'+({round:'大轮结束',battle:'战斗失败',advantage:'最终净优势',trade:'实际成交'}[kind]??kind)+'收入 魂'+before+'→'+this.citySoul);}
 choose(title,options,apply){this.assert(options.length>0,'没有合法选项');this.phase='choice';this.window='结算选择';this.pending={title,options,apply};}
 select(index){this.assert(this.pending&&this.pending.options[index],'选择无效');const p=this.pending;this.pending=null;p.apply(p.options[index].value);}
 sequence(tasks,done){const step=()=>{if(this.winner)return;if(!tasks.length){done?.();return;}tasks.shift()(step);};step();}
 confirm(){this.assert(this.phase==='rolled','不是结果确认');const e=this.encounter;e.final=this.final();e.success=e.final>=e.card.dc;this.note('最终'+e.final+'／DC'+e.card.dc+'，'+(e.success?'成功':'失败'));this.phase='resolving';this.window='结算中';
  if(e.card.kind==='战斗'&&!e.success)e.income.push('battle');if(e.mode<0)e.income.push('advantage');
  const tasks=[];
  if(e.card.kind==='交易'){
   tasks.push(next=>{if(e.final!==20){if(e.payment.kind==='soul')this.lose(e.payment.owner,1,'交易支付');else this.removeItem(e.payment.owner,e.payment.zone,e.payment.uid,'交易支付');}else this.note('最终取用20，免除付款。');if(!this.winner)next();});
   tasks.push(next=>{e.income.push('trade');this.chooseReward(e.goods,e.success,next,{randomFailure:true});e.goods=[];});
  }else{
   if(!e.success){let loss=e.card.kind==='战斗'?1:0;const m=e.card.text?.match(/失魂\s*(\d)/);if(e.card.kind!=='战斗'&&m)loss+=+m[1];loss+=e.monster?.loss??0;if(loss)tasks.push(next=>{this.lose(e.bearer,loss,'遭遇失败',{protectedLoss:true});if(!this.winner)next();});const drops=Number(e.card.text?.match(/弃置\s*(\d)/)?.[1]??0)+(e.monster?.drop??0);if(drops)tasks.push(next=>this.dropItems(e.bearer,drops,next));}
   if(e.success&&e.monster){tasks.push(next=>{const m=e.monster;if(this.heroes.some(h=>[...h.hand,...h.equipment].some(c=>c.monsterId===m.id)))return next();const receive=()=>{if(!this.winner&&this.heroes[e.bearer].soul>0)this.receive(this.card({...m.loot,monsterId:m.id,tier:e.card.tier}),next);else next();};if(m.cost)this.choose('素材'+m.loot.name+'：是否支付'+m.cost+'魂领取？',[{label:'放弃，不支付',value:false},{label:'支付并领取',value:true}],yes=>{if(!yes)return next();this.lose(e.bearer,m.cost,'素材领取代价',{protectedLoss:true});if(!this.winner)receive();});else receive();});}
  }
  if(e.success&&/恢复/.test(e.card.text??'')){const n=Number(e.card.text.match(/恢复\s*(\d)/)?.[1]??1);tasks.push(next=>{if(e.card.text.includes('一人恢复')){const ids=this.heroes.filter(h=>h.pos===e.to).map(h=>h.id);this.choose('选择遭遇恢复对象',ids.map(i=>({label:this.heroes[i].name,value:i})),i=>{this.heal(i,n,'遭遇治疗');next();});}else{this.heal(e.bearer,n,'遭遇治疗');next();}});}
  tasks.push(next=>this.roomEffect(next));this.sequence(tasks,()=>this.finishRoom());
 }
 removeItem(owner,zone,uid,reason){const h=this.heroes[owner],i=h[zone].findIndex(c=>c.uid===uid);this.assert(i>=0,'物品不存在');const [c]=h[zone].splice(i,1);this.discardCard(c);if(this.encounter)this.encounter.consumed.push(c.uid);this.note(h.name+reason+'「'+c.name+'」');return c;}
 dropItems(owner,n,next){const h=this.heroes[owner],opts=['hand','equipment'].flatMap(z=>h[z].map(c=>({label:c.name,value:{z,uid:c.uid}})));if(!n||!opts.length){if(n)this.note('无持有物可弃');return next();}this.choose('承担者选择弃一件',opts,p=>{this.removeItem(owner,p.z,p.uid,'弃置');this.dropItems(owner,n-1,next);});}
 receive(card,next){const e=this.encounter,owner=e.bearer,h=this.heroes[owner],zone=card.equipment?'equipment':'hand',limit=card.equipment?2:h.role==='心智'?3:2;
  if(h[zone].length<limit){h[zone].push(card);this.metrics.itemsReceived++;this.note(h.name+'取得'+card.name);return next();}
  const ids=e.party.filter(i=>i!==owner&&this.heroes[i].pos===e.to&&this.heroes[i][zone].length<(zone==='equipment'?2:this.heroes[i].role==='心智'?3:2));
  this.choose('容量不足：分给同行、先弃旧再领或放弃',[...ids.map(i=>({label:'交给'+this.heroes[i].name,value:{id:i}})),...h[zone].map(c=>({label:'弃'+c.name+'再领取',value:{drop:c.uid}})),{label:'放弃新物品',value:{skip:true}}],p=>{if(p.skip)this.discardCard(card);else if(p.id!==undefined){this.heroes[p.id][zone].push(card);this.metrics.itemsReceived++;this.note('仅分配给本次同行'+this.heroes[p.id].name);}else{this.removeItem(owner,zone,p.drop,'容量替换');h[zone].push(card);this.metrics.itemsReceived++;}next();});
 }
 chooseReward(cards,success,next,{randomFailure=false}={}){if(!cards.length)return next();const take=i=>{const c=cards[i];this.rewards.push(...this.shuffle(cards.filter((_,j)=>j!==i)));if(!c)return next();if(c.fragment){if(success){this.fragments++;this.encounter.gotFragment=true;this.note('碎片'+this.fragments+'/4');if(this.checkEnd())return;}else{this.rewards.push(c);this.note('失败选中碎片，沉底且不补');}return next();}this.receive(c,next);};
  if(!success&&randomFailure)return take(Math.floor(this.random()*cards.length));const options=cards.flatMap((c,i)=>c.fragment&&!success?[]:[{label:c.name,value:i}]);options.push({label:'不领取',value:-1});this.choose('选择收获',options,take);
 }
 roomEffect(next){const e=this.encounter,room=this.rooms[e.to];if(this.winner)return;
  if(room.type==='恢复'){const ids=this.heroes.filter(h=>h.pos===e.to).map(h=>h.id);if(e.success){for(const i of ids)this.heal(i,1,'恢复房');next();}else this.choose('恢复房失败：指定房内一人',ids.map(i=>({label:this.heroes[i].name,value:i})),i=>{this.heal(i,1,'恢复房');next();});}
  else if(room.type==='宝藏'){if(e.gotFragment)return next();this.chooseReward(this.drawRewards(e.success?2:1),e.success,next);}
  else if(room.type==='奇遇'){const key=this.theme+(e.success?'成功':'失败');this.metrics.themes[key]=(this.metrics.themes[key]??0)+1;
   if(this.theme==='破坏仪式'){const before=this.citySoul;this.citySoul=e.success?Math.max(0,this.citySoul-1):this.citySoul+1;this.metrics.themeValue.citySoulDelta+=this.citySoul-before;this.note('破坏仪式 城主魂'+before+'→'+this.citySoul);next();}
   else if(this.theme==='遗物回收'){if(!e.success)return this.dropItems(e.bearer,1,next);const valid=this.rewardDiscard.filter(c=>!c.fragment&&!c.monsterId&&!e.consumed.includes(c.uid));if(!valid.length){this.note('无合法普通弃牌可回收');return next();}this.choose('回收普通弃牌',valid.map(c=>({label:c.name,value:c.uid})),uid=>{const i=this.rewardDiscard.findIndex(c=>c.uid===uid);this.metrics.themeValue.recovered++;this.receive(this.rewardDiscard.splice(i,1)[0],next);});}
   else if(e.success){const targets=this.rooms.filter(r=>!this.visited.has(r.id)&&r.id!==e.to);if(!targets.length){this.note('无合法裂隙目标');return next();}this.choose('建立裂隙：替换旧通道',targets.map(r=>({label:'房'+r.id+' '+r.type,value:r.id})),id=>{if(this.rift)this.metrics.themeValue.riftReplaced++;this.rift={from:e.to,to:id};this.metrics.themeValue.riftCreated++;this.note('裂隙 '+e.to+'→'+id);next();});}
   else{this.metrics.themeValue.riftFailed++;this.move(e.bearer,0);this.note('裂隙失败：承担者返回入口');next();}
  }else next();
 }
 finishRoom(){const e=this.encounter;if(this.winner)return;if(e.card)this.eventDiscard.push(e.card);if(e.monster)this.monsterDiscard[e.card.tier].push(e.monster);for(const kind of e.income)this.income(kind,1);this.attachLost();this.encounter=null;this.endAction();}
 getItem(owner,uid){for(const zone of ['hand','equipment']){const c=this.heroes[owner]?.[zone].find(c=>c.uid===uid);if(c)return {card:c,zone};}throw Error('道具不存在');}
 canUse(owner,card){if(this.winner||this.heroes[owner].soul<=0)return false;const windows=card.windows??({'掷前':['检定前'],'掷后':['检定后'],'准备':['行动前','开门前']})[card.timing]??[];const free=['行动前','开门前','检定前','检定后','房间结束'];if(!windows.includes(this.window)&&!(windows.includes('自由时机')&&free.includes(this.window)))return false;const p=this.encounter?.payment;if(p?.kind==='card'&&p.uid===card.uid)return false;
  const strategic=['insight','sprint','transform','translocate','changeTheme'].includes(card.effect);return strategic||!!(this.encounter&&(this.encounter.party.includes(owner)||this.heroes[owner].pos===(this.phase==='door'?this.heroes[this.turn].pos:this.encounter.to)));
 }
 use(owner,uid,args={}){const {card:c,zone}=this.getItem(owner,uid);this.assert(this.canUse(owner,c),'道具时机／资格／付款锁定不允许');const e=this.encounter;const target=args.target??owner;
  switch(c.effect){
   case 'insight':this.assert(this.slots[args.slot],'没有未用遭遇');this.slots[args.slot].open=true;break;
   case 'sprint':{const h=this.heroes[target];this.assert(h&&this.visited.has(args.to)&&this.reachable(h.pos).includes(args.to),'疾跑目的地不可达');this.move(target,args.to);break;}
   case 'translocate':{this.assert(this.rooms[args.to]?.type==='奇遇'&&!this.visited.has(args.to),'目标必须已展示未探索奇遇房');const ids=args.targets??[target];this.assert(new Set(ids).size===ids.length&&ids.length>0&&ids.every(i=>this.heroes[i]&&this.heroes[i].soul>0),'目标无效');for(const i of ids){this.move(i,args.to);this.heroes[i].forced=args.to;}break;}
   case 'changeTheme':this.assert(THEMES.includes(args.theme),'主题无效');this.theme=args.theme;break;
   case 'transform':this.assert(['体魄','心智','魅力'].includes(args.role)&&this.heroes[target]?.pos===this.heroes[owner].pos,'变形目标／专长无效');this.heroes[target].specialty=args.role;break;
   case 'substitute':this.assert(e&&e.party.includes(target)&&this.heroes[target].soul>0,'替身必须合法同行');e.bearer=target;break;
   case 'forceNormal':this.assert(e,'无当前检定');e.forceNormal=true;break;
   case 'replaceEncounter':{this.assert(e&&!e.replaced,'本场已替换');const fresh=this.drawEvents(1)[0];this.assert(fresh,'无其他遭遇可抽');this.eventDiscard.push(e.card);e.card=fresh;e.replaced=true;this.note('逆天改命替换为'+fresh.name);break;}
   case 'heal1':case 'heal2':case 'healAll':{this.assert(this.heroes[target]?.pos===this.heroes[owner].pos,'治疗默认同房');const ids=c.effect==='healAll'?this.heroes.filter(h=>h.pos===this.heroes[owner].pos).map(h=>h.id):[target];for(const i of ids)this.heal(i,c.effect==='heal2'?2:1,'道具治疗');break;}
   case 'peek':this.note('收获顶牌：'+(this.rewards[0]?.name??'无牌'));break;
   case 'guard':e.guard++;break;case 'guard2':e.guard+=2;break;case 'coffin':e.coffin=true;break;
   case 'boost':e.delta++;break;case 'battleBoost':this.assert(e.card.kind==='战斗','仅战斗');e.delta++;break;case 'tradeBoost':this.assert(e.card.kind==='交易','仅交易');e.delta++;break;case 'boost2':e.delta+=2;break;
   case 'boostGuard':e.delta++;e.guard++;break;
   case 'reverse':case 'reverseGuard':e.delta-=2*this.rawStrength();if(c.effect==='reverseGuard')e.guard++;break;
   case 'crown':e.delta+=Math.max(0,1-this.rawStrength());break;
   case 'reroll':case 'plus1':case 'plus2':case 'floor10':case 'twenty':{const i=args.die??0;this.assert(e.dice[i]!==undefined,'骰子无效');e.dice[i]=c.effect==='reroll'?1+Math.floor(this.random()*20):c.effect==='twenty'?20:c.effect==='floor10'?Math.max(10,e.dice[i]):Math.min(20,e.dice[i]+(c.effect==='plus2'?2:1));break;}
   default:throw Error('道具效果未支持：'+c.effect);
  }
  this.metrics.items[c.name]=(this.metrics.items[c.name]??0)+1;this.removeItem(owner,zone,uid,'使用');this.attachLost();if(this.phase==='action'){const h=this.heroes[this.turn];if(h.soul>0&&h.state==='ready'&&h.forced!==null&&!this.visited.has(h.forced))this.explore(h.forced,[h.id],h.id);}return true;
 }
}
