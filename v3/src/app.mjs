import {Game} from './engine.mjs';
import {aiStep} from './ai.mjs';
import {applyItem,itemTargets} from './items.mjs';
import {PATTERNS,connected,neighbor,DIRS} from './map.mjs';
import {COSTS,ROLES,VERSION,stanceName} from './rules.mjs';

const $=id=>document.getElementById(id);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=(glyph,title)=>`<span class="ico" title="${escape(title)}" aria-label="${escape(title)}" role="img">${glyph}</span>`;
const badge=(text,title)=>`<span class="badge" title="${escape(title)}">${text}</span>`;
const glyph={战斗:'⚔',考验:'◇',交易:'⇄',体魄:'▲',心智:'◈',魅力:'✧'};
const pattern=p=>`<span class="pattern swatch p${PATTERNS.indexOf(p)}" title="${p??'入口'}" aria-label="${p??'入口'}" role="img"></span>`;
const button=(label,act,value='',style='',disabled=false,tip='')=>`<button class="${style}" data-act="${act}" data-v="${escape(value)}"${disabled?' disabled':''}${tip?` title="${escape(tip)}" aria-label="${escape(tip)}"`:''}>${label}</button>`;
const effects={
  fragment:['◆','全队获得碎片'],drawItem:['▣','抽取普通物资'],heal:['✚','恢复魂'],loseSoul:['−♥','失去魂'],
  discardItem:['⊘','承担者自选弃置物品'],orientRoom:['♜↻','结算后由城主定向'],monsterReward:['✶','领取怪物牌印出的唯一奖励'],
  completeOffer:['⇄','可按价格购买一件'],none:['—','无额外损失']
};
function describeEffect(effect){
  const tuple=effects[effect.effect]??['?','未知效果'];
  const name=effect.effect==='heal'&&effect.target==='explorers'?'本次每名探索者各恢复魂':tuple[1];
  const showAmount=!['orientRoom','monsterReward','completeOffer','none'].includes(effect.effect);
  return badge(`${icon(tuple[0],name)}${showAmount?`<b>${effect.amount}</b>`:''}`,`${name}${showAmount?' ×'+effect.amount:''}`);
}
const effectsRow=(list)=>list?.map(describeEffect).join('')||badge('—','无额外效果');
const price=offer=>offer.cost.kind==='soul'?`${icon('♥','支付一魂')} 1`:`${icon('▣','交付一件持有物')} 1`;
let actionKey='', game, data, human='party', hidden=false, cover='', tool=null, selected=new Set(), dest=null, cityPicks=new Set(), cityPattern=null, timer=null, aiRun=0;
const showMenu=()=>modal('暗门地牢',`<div class="start-picks">${button(icon('▲','冒险者')+'<strong>冒险者</strong><small>带三名角色探索</small>','choose-side','party',human==='party'?'picked':'')}${button(icon('♜','城主')+'<strong>城主</strong><small>部署遭遇与机关</small>','choose-side','city',human==='city'?'picked':'')}</div>`,button('开始对局','start','','primary'),false,'选择座位，另一方自动行动');
function modal(title,body,buttons='',fold=true,kicker=''){
  return `<div class="scrim"><section class="modal" role="dialog" aria-modal="true" aria-label="${escape(title)}">${fold?button('⌄','hide','','fold',false,'收起，查看地图'):''}${kicker?`<div class="kicker">${escape(kicker)}</div>`:''}<h1>${escape(title)}</h1>${body}${buttons?`<div class="modal-actions">${buttons}</div>`:''}</section></div>`;
}
function encounterCard(c,{act='',value='',back=false,chosen=false}={}){
  const attrs=act?`data-act="${act}" data-v="${value}" role="button" tabindex="0"`:'';
  if(back)return `<article class="card back interactive" ${attrs} aria-label="${c.tier}级未揭晓遭遇" title="${c.tier} 级遭遇"><span>遭遇</span><strong>${c.tier}</strong></article>`;
  const cond=c.patternEffect,offer=c.offer;
  const aff=cond?`<div class="affinity">${pattern(c.preferredPattern)}<span>${{success:'成功',failure:'失败',afterTrade:'成交后'}[cond.when]}</span>${effectsRow(cond.effects)}</div>`:'';
  const trade=(result)=>offer?`<span class="badge" title="${result==='success'?'成功':'失败'}展示候选数；魅力额外一张">${offer.revealByResult[result]} → 1</span>`:'';
  return `<article class="card ${act?'interactive':''} ${chosen?'picked':''}" ${attrs}><small>${c.tier}</small><h2>${escape(c.name)}</h2>
    <div class="card-type">${icon(glyph[c.kind],c.kind)} ${c.kind}</div>
    <div class="badges">${badge(icon(glyph[c.attribute],c.attribute)+' '+c.attribute,`${c.attribute}专长匹配给一项优势来源`)}${badge('DC '+c.dc,'最低成功骰值')}</div>
    <p>${escape(c.scene)}</p><div class="outcome good"><span>成功</span>${trade('success')}${effectsRow(c.success)}</div>
    <div class="outcome bad"><span>失败</span>${trade('failure')}${effectsRow(c.failure)}</div>
    ${offer?`<div class="affinity"><span>价格</span>${price(offer)}${offer.afterTrade.length?`<span>成交后</span>${effectsRow(offer.afterTrade)}`:''}</div>`:''}${aff}</article>`;
}
function itemCard(c,act='',value='',disabled=false){
  return `<article class="card item-card ${act&&!disabled?'interactive':''}" ${act&&!disabled?`data-act="${act}" data-v="${value}" role="button" tabindex="0"`:''}>
  <small>${c.monster?'素材':'物资'}</small><h2>${escape(c.name)}</h2><div class="card-type">${icon(c.monster?'✶':'▣',c.monster?'怪物素材':'普通物资')}</div>
  <p>${escape(c.text)}</p><footer>${escape((c.windows??[c.timing]).join(' · '))}</footer></article>`;
}
const cardRow=content=>`<div class="cards">${content}</div>`;
function updateBoard(){
  const g=game;
  $('table').classList.toggle('pre-game',!g);
  if(!g)return;
  $('city').innerHTML=`<div class="panel"><div class="section-title">${icon('♜','城主')} 城主 <span>${['I','II','III','IV'][g.level-1]}</span></div>
    <div class="stats">${badge(icon('♥','城主魂')+' '+g.citySoul+'/'+(COSTS[g.level-1]??'—'),'城主当前魂／下次升级费用')}
    ${badge(icon('◷','大轮')+' '+g.round,'当前大轮')}</div>
    <h3>机关</h3><div class="stats">${g.pattern&&(g.revealed||human==='city'||g.excluded.size===2)?pattern(g.pattern):badge('◌','本轮机关隐藏')}
    ${[...g.excluded].map(p=>`<span class="excluded" title="${p}本轮未触发">${pattern(p)}</span>`).join('')}</div>
    <h3>牌堆</h3><div class="stats">${button('▣ '+g.events.length,'inspect','events','chip',false,'公共遭遇抽堆剩 '+g.events.length+' 张')}
    ${button('▧ '+g.slots.filter(Boolean).length,'inspect','slots','chip',false,'查看桌面埋牌')}
    ${button('◇ '+g.eventDiscard.length,'inspect','discard','chip',false,'查看公开遭遇弃牌')}
    ${badge('▱ '+g.hand.length,'城主手牌数量')}${badge('▢ '+g.goods.length,'普通物资堆剩余')}${badge('♧ '+g.goodsDiscard.length,'普通物资弃牌')}</div></div>
    <div class="panel objectives"><div class="section-title">${icon('◆','冒险者碎片')} 碎片 <span>${g.fragments}/5</span></div>
    <div class="progress" title="冒险者收集五枚碎片获胜">${Array.from({length:5},(_,i)=>`<i class="${i<g.fragments?'filled':''}"></i>`).join('')}</div>
    <h3>共鸣 / 巡礼</h3><div class="stats" title="最近两次有效探索。第三次同纹或三纹各异可得一枚碎片。">${[0,1].map(i=>g.history[i]?pattern(g.history[i]):badge('–','空位')).join('')}${badge('＋','下一次成功探索写入任务')}</div></div>`;
  $('signal').textContent=g.logs.at(-1)?.text??'';
  updateMap();
  $('heroes').innerHTML=g.heroes.map(h=>`<section class="panel hero ${h.id===g.turn&&g.side==='party'?'active':''}">
    <div class="section-title">${icon(glyph[h.specialty],h.specialty)} ${h.name} <span title="${h.state==='ready'?'待行动':h.state==='moved'?'已赶路':'已探索'}">${{ready:'○',moved:'↗',explored:'✓'}[h.state]}</span></div>
    <div class="stats">${badge(`${icon('♥','魂')}${h.soul}/${h.max}`,'个人生命与上限')}${badge(`${icon('▣','物品容量')}${h.hand.length}/${h.capacity}`,'当前持牌／上限')}</div>
    <div class="hand">${h.hand.map(item=>human==='city'?'<span class="mini-back" title="冒险者手牌"></span>':button(escape(item.name),'item',h.id+':'+item.uid,itemTargets(g,h.id,item).length?'ready':'' )).join('')}</div>
    ${h.carried!==null?`<small>${g.heroes[h.carried].name} 携带</small>`:''}</section>`).join('');
}
function updateMap(){
  const g=game, e=g.encounter;
  const canAct=human==='party'&&g.phase==='action';
  const explore=canAct&&g.slots.some(Boolean)?g.targets():[];
  const travel=canAct?g.travelTargets():[];
  const moving=tool?.card.effect==='sprint'?new Set(tool.options.map(o=>o.arg)):null;
  $('map').innerHTML=g.rooms.map(r=>{
    const step=explore.find(t=>t.to===r.id);
    const accessible=moving?moving.has(r.id):step||travel.includes(r.id);
    const status=r.state==='covered'?'未探索':r.state==='pending'?'待定向':r.id===g.start?'入口':'已探索';
    const doors=r.doors.map(d=>{
      const to=neighbor(r.id,d);
      const color=connected(g.rooms,r.id,d)?'linked':to!==null&&g.rooms[to].state==='covered'?'unopened':'wall';
      return `<i class="door d${d} ${color}" title="${color==='linked'?'已连通':color==='unopened'?'通往未探索房':'墙面封闭'}" aria-hidden="true"></i>`;
    }).join('');
    const tokens=g.heroes.filter(h=>h.pos===r.id).map(h=>{
      const eligible=canAct&&g.partyOptions().includes(h.id)&&h.id!==g.turn;
      return `<button class="token t${h.id} ${selected.has(h.id)&&canAct?'picked':''}" data-act="${eligible?'team':'token'}" data-v="${moving?r.id:h.id}" title="${escape(h.name+' · '+(eligible?'选入或移出探索小队':h.specialty))}" aria-label="${escape(h.name)}">${h.soul?glyph[h.specialty]:'†'}</button>`;
    }).join('');
    return `<div class="room ${r.state} ${r.pattern?'pattern p'+PATTERNS.indexOf(r.pattern):'entrance'} ${accessible?'reachable':''} ${dest===r.id?'selected':''} ${e?.to===r.id?'current-room':''}">
    <button class="room-button" data-act="room" data-v="${r.id}" title="${escape(`${status}${r.pattern?' · '+r.pattern:''}${step?.breach?' · 可破墙':''}`)}" aria-label="${escape(`房间 ${r.id+1} ${status} ${r.pattern??''}`)}">${r.id===g.start?'⌂':''}</button>${doors}<div class="tokens">${tokens}</div>
    ${step?.breach?'<span class="breach" title="全队没有其他可达新门">↗</span>':''}</div>`;
  }).join('');
  const h=g.actor;
  let controls='';
  if(cover==='mapTool')controls=button('取消','close')+badge(icon('↗','疾跑')+' 选择高亮房间','疾跑不耗行动');
  else if(canAct){
    const next=explore.find(s=>s.to===dest);
    controls=`<span class="turn">${icon(glyph[h.specialty],h.specialty)} ${h.name}</span>`+
      (next?button(next.breach?'破墙探索':`探索 · ${selected.size}人`,'explore','','primary'):travel.includes(dest)?button('赶路','travel','','primary'):'')+
      button('结束行动','wait','', 'quiet')+(dest===null?'<small>点房间选路，点同行棋子组队</small>':'');
  }else if(hidden&&!g.winner)controls=button('展开当前操作','show','','primary');
  else if(g.side!==human&&!g.winner)controls='<span class="turn">对方行动中</span>';
  $('controls').innerHTML=controls;
}
function toolBar(){
  if(human!=='party'||game.side!=='party')return '';
  const ready=game.heroes.flatMap(h=>h.hand.filter(c=>itemTargets(game,h.id,c).length).map(c=>button(escape(c.name),'item',h.id+':'+c.uid,'chip ready',false,h.name+' · '+c.name)));
  return ready.length?`<div class="tool-bar">${icon('▣','当前可用的道具')}${ready.join('')}</div>`:'';
}
function stancePanel(){
  const g=game,e=g.encounter,mode=e.mode??g.mode(),affinity=g.buyer.specialty===e.card.attribute;
  const lines=[
    `<div class="stance-side"><span>${icon('♜','城主')} 城主</span><small title="房间纹样命中城主暗押时增加一个优势来源">${pattern(g.rooms[e.to].pattern)} ${e.hit?'机关命中':'机关未命中'}</small></div>`,
    `<div class="stance-center"><strong>${stanceName(mode)}</strong><small>${mode<0?'两骰取低':mode>0?'两骰取高':'单骰'}</small><div class="dice">${e.dice?.map(d=>`<b class="${d===g.value()?'take':''}">${d}</b>`).join('')??'<b>?</b>'}</div></div>`,
    `<div class="stance-side"><span>${icon(glyph[g.buyer.specialty],g.buyer.specialty)} ${g.buyer.name}</span><small>${g.buyer.specialty} / ${e.card.attribute} · ${affinity?'匹配':'不匹配'}</small></div>`
  ];
  return `<div class="stance">${lines.join('')}</div>${e.normal?'<p class="hint">道具锁定均势</p>':e.delta?`<p class="hint">道具修正 ${e.delta>0?'+':''}${e.delta}</p>`:''}`;
}
function scene(){
  const g=game,e=g?.encounter;
  if(cover==='rules')return modal('桌边速览',`<div class="rules-copy"><p><strong>探索</strong>　点相邻盖房，然后选埋牌。遭遇结算后翻地砖，按来路定向。</p><p><strong>共鸣 / 巡礼</strong>　记最近两次有效成功。三种相同或各异得一片，其他情况保留最近两个。</p><p><strong>骰法</strong>　花纹命中给城主一项优势；专长匹配给承担者一项。城主优势取低，冒险者优势取高。</p><p><strong>交易</strong>　先看报价。成功翻两件，失败翻一件，魅力多一件。实际买到才记成交魂。</p><p><strong>终局</strong>　冒险者五片胜。城主升 IV、全员失魂或地图探索耗尽时城主胜。</p></div>`,button('返回','close','','primary'),false);
  if(cover==='journal')return modal('对局记录',`<div class="journal">${g?.logs.slice().reverse().map(l=>`<p><small>${l.round}</small>${escape(l.text)}</p>`).join('')??''}</div>`,button('导出记录','export')+button('返回','close','','primary'),false);
  if(cover==='reset')return modal('返回开局？','<p class="hint">本局进度将结束，可以先导出记录。</p>',button('继续本局','close')+button('返回开局','reset','','primary'),false);
  if(cover==='mapTool')return '';
  if(cover.startsWith('inspect')){
    const key=cover.split(':')[1];let body='';
    if(key==='slots')body=cardRow(g.slots.map(s=>s?encounterCard(s.card,{back:human==='party'&&!s.open}):'').join(''));
    if(key==='discard')body=cardRow(g.eventDiscard.slice().reverse().map(c=>encounterCard(c)).join(''));
    if(key==='events')body=`<p class="hint">遭遇抽堆剩 ${g.events.length} 张。抽空后才回洗公开弃牌。</p>`;
    return modal({slots:'桌面埋牌',discard:'公开遭遇弃牌',events:'公共遭遇堆'}[key],body||'<p class="hint">暂无牌</p>',button('返回','close','','primary'),false);
  }
  if(tool){
    const {card,id,options}=tool;
    return modal(card.name,cardRow(itemCard(card))+`<p class="hint">${g.heroes[id].name} · ${options.length?'选择目标或确认使用':'当前没有合法使用窗口或目标'}</p>`,
      options.map((opt,i)=>button(escape(opt.label),'use-item',i,'primary')).join('')+button('返回','close'),false);
  }
  if(!g)return showMenu();
  if(g.winner)return modal(g.winner+'获胜',`<p class="hint">${escape(g.reason)} · 第 ${g.round} 轮</p>`,button('导出记录','export')+button('新对局','reset','','primary'),false);
  if(hidden||g.side!==human)return '';
  if(g.phase==='city'){
    const count=Math.min(g.need,g.hand.length);
    const patterns=`<div class="pattern-choice">${PATTERNS.map(p=>button(pattern(p)+' '+p,'pattern',p,cityPattern===p?'picked':'')).join('')}</div>`;
    return modal('布置地牢',patterns+cardRow(g.hand.map((c,i)=>encounterCard(c,{act:'city-pick',value:i,chosen:cityPicks.has(i)})).join('')),
      button('升级 · '+COSTS[g.level-1]+'魂','upgrade','', '',!g.canUpgrade)+button(`部署 ${cityPicks.size}/${count}`,'deploy','','primary',!cityPattern||cityPicks.size!==count),true,'暗押一种纹样 · 城主选择全部埋牌');
  }
  if(g.phase==='door'){
    const choices=`<div class="bearers">${e.party.map(i=>button(icon(glyph[g.heroes[i].specialty],g.heroes[i].specialty)+' '+g.heroes[i].name,'bearer',i,e.bearer===i?'picked':'')).join('')}</div>`;
    return modal('开门前',choices+cardRow(g.slots.map((s,i)=>s?encounterCard(s.card,{act:'reveal',value:i,back:!s.open}):'').join(''))+toolBar(),'',
      true,g.rooms[e.to].pattern+' · 确认承担者并选一张遭遇');
  }
  if(g.phase==='revealed')return modal('遭遇揭晓',cardRow(encounterCard(e.card))+toolBar(),button('继续','continue','','primary'));
  if(g.phase==='monster'){
    const r=e.monster.reward,item=data.items.loot[r.lootRef];
    const monster=`<article class="card monster"><small>${e.card.tier} 级怪物</small><h2>${escape(e.monster.name)}</h2><div class="card-type">${icon('✶','怪物')}</div><div class="outcome good"><span>成功</span>${r.effect==='fragment'?describeEffect(r):badge(icon('▣','取得右侧配对素材'),'获得配对素材')}</div></article>`;
    return modal('怪物',cardRow(monster+(item?itemCard({...item,monster:true}):'')),button('准备检定','monster','','primary'));
  }
  if(g.phase==='trade'){
    const o=e.card.offer,bonus=g.buyer.specialty==='魅力'?o.charmExtraReveal:0;
    return modal('商人报价',cardRow(encounterCard(e.card))+`<div class="offer-line">${badge(price(o),'成交才付款')}${badge(`成功 ${o.revealByResult.success+bonus} → 1`,'成功后货物候选与购买上限')}${badge(`失败 ${o.revealByResult.failure+bonus} → 1`,'失败后货物候选；另执行牌上罚则')}</div>`,button('离开','trade','no')+button('接受检定','trade','yes','primary'));
  }
  if(g.phase==='check'||g.phase==='rolled')return modal(e.card.kind+'检定',stancePanel()+toolBar(),
    g.phase==='check'?button('掷骰','roll','','primary'):button(`取 ${g.value()} · ${g.value()>=e.card.dc?'成功':'失败'}`,'resolve','','primary'),true,e.card.name+' · DC'+e.card.dc);
  if(g.phase==='damage')return modal('即将失魂',`<div class="damage">${g.heroes[e.damage.target].name} ${icon('−♥','待执行的失魂')}${e.damage.amount}</div>`+toolBar(),button('承受伤害','damage','','primary'));
  if(g.phase==='goods'){
    const possible=g.paymentOptions().some(p=>g.recipients(p.key).length);
    return modal('选择货物',`<div class="offer-line">${badge(price(e.card.offer),'选择购买时才支付')}${badge(e.charm?'✧ 魅力':'普通报价',e.charm?'多展示一件':'按检定结果展示货物')}</div>`+
      cardRow(e.goods.map((c,i)=>itemCard(c,'buy',i,!possible)).join(''))+(!possible?'<p class="hint">没有合法付款或接收位置</p>':''),button('不购买','leave','','primary'),true,e.success?'检定成功':'检定失败 · 仍可购买');
  }
  if(g.phase==='choice'){
    const p=g.pending;
    return modal(p.title,`<div class="choice-list">${p.options.map((o,i)=>button(escape(o.label),'choice',i)).join('')}</div>`);
  }
  if(g.phase==='orient'){
    const room=g.rooms[e.to];
    return modal('决定出口',`<div class="rotations">${e.orientations.map((o,i)=>button(`<span class="room preview pattern p${PATTERNS.indexOf(room.pattern)}">${o.viable.map(d=>`<i class="door d${d} ${d===e.entry?'linked':'unopened'}" title="${['北','东','南','西'][d]}${d===e.entry?' · 来路':' · 出口'}"></i>`).join('')}</span>`,'orient',i,'',false,`${o.rotation*90}度，出口 ${o.viable.map(d=>['北','东','南','西'][d]).join('、')}`)).join('')}</div>`,
      '',true,e.orientCity?'遭遇失败 · 城主定向':'遭遇完毕 · 保留来路');
  }
  return '';
}
function render(){
  if(game?.phase==='action'){
    const key=game.round+':'+game.turn;
    if(key!==actionKey){actionKey=key;selected=new Set([game.turn]);dest=null;}
  }
  updateBoard();$('overlay').innerHTML=scene();
}
function schedule(){
  clearTimeout(timer);
  if(!game||game.winner||game.side===human||cover)return;
  timer=setTimeout(()=>{
    try{aiRun++;if(aiRun>170)throw new Error('自动对手连续操作超过上限');
      const phase=game.phase;aiStep(game);game.trace.push({round:game.round,phase,actor:'ai'});render();schedule();}
    catch(error){toast(error.message);}
  },game.phase==='city'?280:100);
}
function toast(text){
  $('toast').textContent=text;$('toast').classList.add('visible');
  clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.remove('visible'),3200);
}
function after(before){
  if(game.phase!=='action'||before!==game.phase||!selected.has(game.turn)){selected=new Set([game.turn]);dest=null;}
  if(before==='city'&&game.phase!=='city'){cityPicks.clear();cityPattern=null;}
  if(game.phase!==before)hidden=false;
  render();schedule();
}
function exportLog(){
  if(!game)return;
  const blob=new Blob([JSON.stringify({version:VERSION,seed:game.seed,seat:human,log:game.logs,trace:game.trace,metrics:game.metrics,winner:game.winner},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='暗门地牢_V090_记录.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function handle(action,value){
  if(action==='choose-side'){human=value;render();return;}
  if(action==='start'){game=new Game(data);actionKey='';selected=new Set([0]);aiRun=0;render();schedule();return;}
  if(action==='reset'){clearTimeout(timer);game=null;tool=null;cover='';hidden=false;selected.clear();cityPicks.clear();cityPattern=null;dest=null;render();return;}
  if(action==='export'){exportLog();return;}
  if(action==='inspect'){cover='inspect:'+value;render();schedule();return;}
  if(action==='close'){tool=null;cover='';render();schedule();return;}
  if(action==='hide'||action==='show'){hidden=action==='hide';render();return;}
  if(!game||game.side!==human||game.winner)return;
  const before=game.phase,index=Number(value);
  aiRun=0;
  if(cover==='mapTool'&&['room','team','token'].includes(action)){
    const found=tool.options.findIndex(o=>o.arg===index);
    if(found<0){toast('请选择高亮的已探索房间');return;}
    applyItem(game,tool.id,tool.card.uid,found);game.trace.push({action:'use-item',item:tool.card.name,target:index});
    cover='';tool=null;dest=null;selected=new Set([game.turn]);after(before);return;
  }
  if(action==='room'&&game.phase==='action'){dest=index;render();return;}
  if(action==='token')return;
  if(action==='team'&&game.phase==='action'){
    if(selected.has(index))selected.delete(index);else selected.add(index);render();return;
  }
  if(action==='pattern'){cityPattern=value;render();return;}
  if(action==='city-pick'){if(cityPicks.has(index))cityPicks.delete(index);else cityPicks.add(index);render();return;}
  if(action==='item'){
    const [id,uid]=value.split(':').map(Number),card=game.heroes[id].hand.find(c=>c.uid===uid);
    const options=itemTargets(game,id,card);tool={id,card,options};
    if(card.effect==='sprint'&&options.length)cover='mapTool';
    render();return;
  }
  const actions={
    upgrade:()=>game.upgrade(),deploy:()=>game.prepare(cityPattern,[...cityPicks]),bearer:()=>game.bearer(index),
    explore:()=>game.explore(dest,[...selected],game.turn),travel:()=>game.travel(dest),wait:()=>game.wait(),
    reveal:()=>game.reveal(index),continue:()=>game.continueEncounter(),monster:()=>game.startCheck(),
    trade:()=>game.acceptTrade(value==='yes'),roll:()=>game.roll(),resolve:()=>game.confirm(),damage:()=>game.damage(),
    buy:()=>game.purchase(index),leave:()=>game.leaveTrade(),choice:()=>game.select(index),orient:()=>game.orient(index),
    'use-item':()=>{applyItem(game,tool.id,tool.card.uid,index);tool=null;}
  };
  if(!actions[action])return;
  const context={action,value,round:game.round,actor:game.turn,phase:before,room:dest??game.encounter?.to,selected:[...selected]};
  if(action==='deploy'){context.pattern=cityPattern;context.cards=[...cityPicks].map(i=>game.hand[i]?.id);}
  if(action==='use-item'){context.item=tool.card.name;context.target=tool.options[index]?.arg;}
  actions[action]();game.trace.push(context);after(before);
}
document.addEventListener('click',event=>{
  const element=event.target.closest('[data-act]');
  if(!element||element.disabled)return;
  try{handle(element.dataset.act,element.dataset.v);}catch(error){toast(error.message);}
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&(cover||tool))handle('close','');
  else if(event.key==='Escape'&&game&&!game.winner)handle(hidden?'show':'hide','');
  else if((event.key==='Enter'||event.key===' ')&&event.target.matches('article[role="button"]')){event.preventDefault();event.target.click();}
});
$('rules-button').onclick=()=>{cover='rules';render();schedule();};
$('journal-button').onclick=()=>{if(game){cover='journal';render();schedule();}};
$('reset-button').onclick=()=>{if(game){cover='reset';render();schedule();}};
try{
  const load=async name=>{
    const response=await fetch(`./data/${name}.json`,{cache:'no-cache'});
    if(!response.ok)throw new Error('卡牌数据加载失败');
    return response.json();
  };
  const [encounters,monsters,items]=await Promise.all(['encounters','monsters','items'].map(load));
  data={encounters,monsters,items};render();
}catch(error){$('overlay').innerHTML=modal('暂时无法开局',`<p>${escape(error.message)}</p>`,'',false);}
