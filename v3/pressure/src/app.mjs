import {PilotGame as Game,pilotStep as aiStep} from './split-game.mjs?p=4';
import {applyItem,itemTargets} from './items.mjs?p=4';
import {PATTERNS,connected,blockedDoor,neighbor,DIRS} from './map.mjs?p=4';
import {taskHint,roomRotation,doorState,rotationDifference,monsterMark} from './table-ui.mjs?p=4';
import {diceMarkup,animateDice} from './dice.mjs?p=4';
import {COSTS,ROLES,VERSION,stanceName,TASK_REWARD,CITY_SOUL_LIMIT,CITY_WIN_LEVEL,tier} from './rules.mjs?p=4';

import {patternLabels,stamp,describeEffect,highlightItem,timingText,offerPrice,outcome,offerTerms,patternBonus,keyword} from './table-copy-ui.mjs';

const $=id=>document.getElementById(id);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=(glyph,title)=>`<span class="ico" title="${escape(title)}" aria-label="${escape(title)}" role="img">${glyph}</span>`;
const badge=(text,title)=>`<span class="badge" title="${escape(title)}">${text}</span>`;
const glyph={战斗:'⚔',考验:'◇',交易:'⇄',体魄:'▲',心智:'◈',魅力:'✧'};
const patternName=p=>patternLabels[PATTERNS.indexOf(p)]??'入口';
const pattern=p=>stamp(PATTERNS.indexOf(p));
const localize=text=>text.replace(/条纹|方格|点阵/g,patternName);
const button=(label,act,value='',style='',disabled=false,tip='')=>`<button class="${style}" data-act="${act}" data-v="${escape(value)}"${disabled?' disabled':''}${tip?` title="${escape(tip)}" aria-label="${escape(tip)}"`:''}>${label}</button>`;
const mapItem=card=>['sprint','magicDoor'].includes(card?.effect);
let actionKey='', game, data, human='party', hidden=false, cover='', tool=null, selected=new Set(), dest=null, cityPicks=new Set(), cityPattern=null, timer=null, aiRun=0, feedback=null, aiRecords=[], aiDice=null, diceBusy=false, skipFeedback=false, orientationDraft=null, animateTile=false, observedMonster=null;
const showMenu=()=>modal('暗门地牢',`<div class="start-picks">${button(icon('▲','冒险者')+'<strong>冒险者</strong><small>带三人进地牢，找齐 5 枚碎片</small>','choose-side','party',human==='party'?'picked':'')}${button(icon('♜','城主')+'<strong>城主</strong><small>布机关、埋牌，把迷宫升到 V 级</small>','choose-side','city',human==='city'?'picked':'')}</div>`,button('开始对局','start','','primary'),false,'挑一边坐下，另一边由电脑接手');
function modal(title,body,buttons='',fold=true,kicker=''){
  return `<div class="scrim"><section class="modal" role="dialog" aria-modal="true" aria-label="${escape(title)}">${fold?button('⌄','hide','','fold',false,'收起，查看地图'):''}${kicker?`<div class="kicker">${escape(kicker)}</div>`:''}<h1>${escape(title)}</h1>${body}${buttons?`<div class="modal-actions">${buttons}</div>`:''}</section></div>`;
}
function encounterCard(c,{act='',value='',back=false,chosen=false,charm=0}={}){
  const attrs=act?`data-act="${act}" data-v="${value}" role="button" tabindex="0"`:'';
  if(back)return `<article class="card back interactive" ${attrs} aria-label="${c.tier}级未揭晓遭遇" title="${c.tier} 级遭遇"><span>遭遇</span><strong>${c.tier}</strong></article>`;
  const scene=escape(c.scene);
  return `<article class="card encounter-face ${act?'interactive':''} ${chosen?'picked':''}" ${attrs}><small>${c.tier} 级</small><h2>${escape(c.name)}</h2>
    <div class="card-type">${icon(glyph[c.kind],c.kind)} ${c.kind} · ${badge(icon(glyph[c.attribute],c.attribute)+' '+c.attribute,`专长是${c.attribute}的人出手，冒险者多一个优势。`)}${badge(c.dc+'+',`掷出 ${c.dc} 或更高就成功。`)}</div>
    <p class="card-scene">${scene}</p><div class="card-result">${outcome(c,'success',charm)}${outcome(c,'failure',charm)}
    ${c.offer?offerTerms(c.offer):''}${patternBonus(c,pattern)}</div></article>`;
}
function itemCard(c,act='',value='',disabled=false){
  return `<article class="card item-card ${act&&!disabled?'interactive':''}" ${act&&!disabled?`data-act="${act}" data-v="${value}" role="button" tabindex="0"`:''}>
  <small>${c.monster?'战利品':'物品'}</small><h2>${escape(c.name)}</h2><div class="card-type">${icon(c.monster?'✶':'▣',c.monster?'怪物掉落的物品':'普通物品')}</div>
  <p>${highlightItem(c.text,escape)}</p><footer>${escape(timingText(c))}</footer></article>`;
}
const monsterArt=monster=>'<svg viewBox="0 0 60 60" aria-hidden="true"><path d="'+monsterMark(monster.id)+'"/></svg>';
function monsterPacket(card,monster,compact=false){
  if(!monster)return '';
  const reward=monster.reward,item=data.items.loot[reward.lootRef];
  if(compact===true)return '<div class="monster-brief">'+monsterArt(monster)+' <strong>'+escape(monster.name)+'</strong> · '+card.tier+' 级 · '+escape(item?item.name:'碎片 '+reward.amount)+'</div>';
  const portrait='<article class="card monster-portrait"><small>'+card.tier+' 级怪物</small><h2>'+escape(monster.name)+'</h2><div class="monster-sigil">'+monsterArt(monster)+'</div><p class="card-scene">'+escape(monster.scene)+'</p><div class="outcome good"><span>打赢拿</span>'+(item?badge(escape(item.name),'右边是战利品牌。'):describeEffect(reward))+'</div></article>';
  return '<div class="monster-docket">'+(compact==='observed'?'':encounterCard(card))+portrait+(item?itemCard({...item,monster:true}):'')+'</div>';
}
const cardRow=content=>`<div class="cards">${content}</div>`;
function upgradeLabel(g){
  const cost=COSTS[g.level-1];
  if(g.mustUpgrade)return `先升级迷宫 · ${cost} 魂`;
  if(g.canUpgrade)return `↑ 升级迷宫 · ${cost} 魂`;
  return `升级迷宫 · ${g.citySoul}/${cost} 魂`;
}
const upgradeTip=()=>`城主最多持有 ${CITY_SOUL_LIMIT} 魂。准备阶段每轮可升一级，升 ${tier(CITY_WIN_LEVEL)} 即获胜。首次够魂升 II 或 III 可以延后一轮。`;
function drawObjectives(g){
  const hint=taskHint(g.history,PATTERNS);
  const crystals=Array.from({length:5},(_,i)=>'<span class="crystal '+(i<g.fragments?'filled':'')+'" aria-hidden="true">◆</span>').join('');
  const marks=[0,1].map(i=>g.history[i]?pattern(g.history[i]):'<span class="swatch empty-mark" aria-label="未记录">·</span>').join('');
  const next=hint.needed.map(p=>'<span class="last-mark">'+pattern(p)+'</span>').join('');
  const last=g.lastTask;
  $('objective-rack').innerHTML=
    '<div class="fragment-bank" title="集齐五枚碎片获胜"><div class="objective-title">冒险者碎片 <strong>'+g.fragments+'/5</strong></div><div class="crystals">'+crystals+'</div></div>'+
    '<div class="task-track" title="成功开房后记下纹样，交易还要成交。集齐三个同纹是共鸣，三个不同纹是巡礼。各得 1 枚碎片。">'+
    '<div class="objective-title"><span class="map-meter" title="已进入房间数，不计入口">探索 '+g.metrics.rooms+'/35</span>共鸣 / 巡礼'+(last?' <span class="task-note">· 第 '+last.round+' 轮完成'+last.name+'</span>':'')+'</div>'+
    '<div class="history-line">'+marks+(next?'<span class="task-progress">→ '+next+' <b>◆ +1</b></span>':'<span class="swatch empty-mark" aria-label="待记录">·</span>')+
    '<span class="task-note">'+hint.label+'</span></div></div>';
}
function updateBoard(){
  const g=game;
  $('table').classList.toggle('pre-game',!g);
  $('objective-rack').hidden=!g;
  if(!g){for(const key of ['city','heroes','map','controls','signal','objective-rack'])$(key).innerHTML='';return;}
  $('city').innerHTML=`<div class="panel"><div class="section-title">${icon('♜','城主')} 城主 <span>${tier(g.level)}</span></div>
    <div class="stats">${badge(icon('♥','城主魂')+' '+g.citySoul+'/'+(COSTS[g.level-1]??'—'),'城主当前魂／下次升级费用；最多持有 '+CITY_SOUL_LIMIT+' 魂')}
    ${badge(icon('◷','大轮')+' '+g.round,'现在是第几轮')}</div>
    ${human==='city'&&g.level<CITY_WIN_LEVEL?button(upgradeLabel(g),'upgrade','','upgrade-action '+(g.canUpgrade?'primary':''),!g.canUpgrade,upgradeTip(g)):''}
    <div class="stats">${badge(`${g.level-1}/${COSTS.length} 次升级`,'依次支付 '+COSTS.join('／')+' 魂升阶；升 V 即胜')}</div>
    <div class="ward"><h3>本轮机关</h3><span>${g.pattern&&(g.revealed||human==='city'||g.excluded.size===2)?pattern(g.pattern)+' '+patternName(g.pattern):'未揭晓'}</span></div>
    ${human==='party'&&g.excluded.size?`<div class="ward excluded"><h3>已排除</h3><span>${[...g.excluded].map(pattern).join('')}</span></div>`:''}
    <h3>牌堆</h3><div class="pile-list">
    ${button('遭遇牌堆 <b>'+g.events.length+'</b>','inspect','events','pile',false,'公共遭遇抽堆。抽空后才洗回公开弃牌。')}
    ${button('桌上的埋牌 <b>'+g.slots.filter(Boolean).length+'</b>','inspect','slots','pile',false,'查看剩余埋牌。冒险者只看可公开的信息。')}
    ${button('遭遇弃牌 <b>'+g.eventDiscard.length+'</b>','inspect','discard','pile',false,'查看公开弃掉的遭遇牌。')}
    ${human==='city'?button('城主手牌 <b>'+g.hand.length+'</b>','inspect','hand','pile',false,'查看自己的城主手牌。'):badge('城主手牌 '+g.hand.length,'冒险者只能知道城主持牌数量。')}
    ${badge('物资牌堆 '+g.goods.length,'普通物资剩余张数。')}${badge('物资弃牌 '+g.goodsDiscard.length,'已公开弃置的普通物资。')}</div></div>
    `;
  drawObjectives(g);
  $('signal').textContent=localize(g.logs.at(-1)?.text??'');
  updateMap();
  $('heroes').innerHTML=g.heroes.map(h=>`<section class="panel hero ${h.id===g.turn&&g.side==='party'?'active':''}">
    <div class="section-title">${icon(glyph[h.specialty],h.specialty)} ${h.name} <span title="${h.state==='ready'?'待行动':h.state==='moved'?'已赶路':'已探索'}">${{ready:'○',moved:'↗',explored:'✓'}[h.state]}</span></div>
    <div class="stats">${badge(`${icon('♥','魂')}${h.soul}/${h.max}`,'个人生命与上限')}${badge(`${icon('▣','物品容量')}${h.hand.length}/${h.capacity}`,'当前持牌／上限')}</div>
    <div class="hand">${h.hand.map(item=>human==='city'?'<span class="mini-back" title="冒险者手牌"></span>':button(escape(item.name),'item',h.id+':'+item.uid,itemTargets(g,h.id,item).length?'ready':'' )).join('')}</div>
    ${h.carried!==null?`<small>${g.heroes[h.carried].name} 携带</small>`:''}</section>`).join('');
}
function updateMap(){
  const g=game, e=g.encounter;
  const turning=g.phase==='orient'&&g.side===human&&!feedback;
  if(turning&&orientationDraft?.encounter!==e)orientationDraft={encounter:e,angle:e.orientations[0].rotation};
  if(!turning)orientationDraft=null;
  const draft=turning?roomRotation(g,orientationDraft.angle):null;
  const needed=taskHint(g.history,PATTERNS).needed;
  const recent=g.lastOrientation&&g.logs.length-g.lastOrientation.logSize<=3?g.lastOrientation:null;
  const canAct=human==='party'&&g.phase==='action';
  const explore=canAct&&g.slots.some(Boolean)?g.targets():[];
  const travel=canAct?g.travelTargets():[];
  const moving=cover==='mapTool'&&mapItem(tool?.card)?new Set(tool.options.map(o=>o.arg)):null;
  $('map').innerHTML=g.rooms.map(r=>{
    const step=explore.find(t=>t.to===r.id);
    const accessible=moving?moving.has(r.id):step||travel.includes(r.id);
    const status=r.state==='covered'?'未开门':r.state==='pending'?'等着转向':r.id===g.start?'入口':'已开门';
    const isTurn=turning&&e.to===r.id;
    const doors=[...(isTurn?draft.doors:r.doors),...(r.breachDoors??[])].map(d=>{
      const to=neighbor(r.id,d);
      const color=isTurn?doorState(g,r.id,d,e.entry):connected(g.rooms,r.id,d)?'linked':to!==null&&g.rooms[to].state==='covered'?'unopened':'wall';
      return `<i class="door d${d} ${color} ${r.breachDoors?.includes(d)?'breached':''}" title="${r.breachDoors?.includes(d)?'破墙通道':color==='linked'?'已连通':color==='unopened'?'通往未探索房':'门对面是墙或边界'}" aria-hidden="true"></i>`;
    }).join('');
    const magicDoors=r.state==='covered'?'':(r.magicDoors??[]).map(d=>{
      const to=neighbor(r.id,d);
      if(g.rooms[to].state!=='covered'&&r.id>to)return '';
      return '<span class="magic-door d'+d+'" role="img" aria-label="魔法门" title="魔法门 · '+(r.id+1)+' 号房与 '+(to+1)+' 号房"></span>';
    }).join('');
    const tokens=g.heroes.filter(h=>h.pos===r.id).map(h=>{
      const eligible=canAct&&g.partyOptions().includes(h.id)&&h.id!==g.turn;
      return `<button class="token t${h.id} ${selected.has(h.id)&&canAct?'picked':''}" data-act="${eligible?'team':'token'}" data-v="${moving?r.id:h.id}" title="${escape(h.name+' · '+(eligible?'加入或退出这次行动':h.specialty))}" aria-label="${escape(h.name)}">${h.soul?glyph[h.specialty]:'†'}</button>`;
    }).join('');
    return `<div class="room ${r.state} ${r.pattern?'pattern p'+PATTERNS.indexOf(r.pattern):'entrance'} ${accessible?'reachable':''} ${dest===r.id?'selected':''} ${e?.to===r.id?'current-room':''} ${isTurn?'rotating-focus':''} ${isTurn&&!draft.legal?'rotation-invalid':''} ${recent?.to===r.id?'recent-turn':''} ${r.state==='covered'&&needed.includes(r.pattern)?'task-target':''}">
    <span class="tile-face ${isTurn&&animateTile?'tile-turn':''}">${doors}</span>${magicDoors}
    <button class="room-button" data-act="${isTurn?'rotate-preview':'room'}" data-v="${r.id}" title="${escape(`${status}${r.pattern?' · '+patternName(r.pattern):''}${step?.breach?' · 可破墙':''}`)}" aria-label="${escape(`房间 ${r.id+1} ${status} ${r.pattern?patternName(r.pattern):''}`)}">${r.id===g.start?'⌂':pattern(r.pattern)}</button><div class="tokens">${tokens}</div>
    ${step?.breach?'<span class="breach" title="全队没有其他可达新门">↗</span>':''}</div>`;
  }).join('');
  const h=g.actor;
  let controls='';
  if(cover==='mapTool'){
    const magic=tool.card.effect==='magicDoor';
    controls=button('取消','close')+badge(icon(magic?'◌':'↗',tool.card.name)+' '+(magic?'点隔壁的高亮房，放一枚门标记':'点想去的高亮房'),'使用道具不花行动');
  }
  else if(turning){
    const boardOption=rotationDifference(e.orientations);
    controls='<div class="turn-tools"><strong>'+(e.orientCity?'城主':'冒险者')+'旋转 · 房 '+(e.to+1)+'</strong>'+
      button('↻ 转 90°','rotate-preview','','',false,'在原房间顺时针旋转 90 度')+
      button('确认方向','orient',draft.index,'primary',!draft.legal)+
      '<small>'+(!draft.legal?'来路未接通，继续旋转':!boardOption?'两个方向都通往同样的地方':'来路必须保持接通')+'</small></div>'+
      '<div class="route-legend"><span>房 '+(e.from+1)+' → 房 '+(e.to+1)+'</span><span class="gold">━ 已连接</span><span class="cyan">━ 通往未开的房</span><span class="gray">━ 墙或边界</span></div>';
    animateTile=false;
  }
  else if(feedback)controls=button('查看对方行动结果','show','','primary');
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
    `<div class="stance-side"><span>${icon('♜','城主')} 城主</span><small title="猜中房间纹样，城主就多一个优势。">${pattern(g.rooms[e.to].pattern)} ${e.hit?'踩中机关':'没踩中机关'}</small></div>`,
    `<div class="stance-center"><strong>${stanceName(mode)}</strong><small>${mode<0?'掷两颗，取小':mode>0?'掷两颗，取大':'掷一颗'}</small>${diceMarkup(diceBusy?e.dice?.map(()=>'?'):e.dice,e.dice&&!diceBusy?g.value():undefined,diceBusy)}</div>`,
    `<div class="stance-side"><span>${icon(glyph[g.buyer.specialty],g.buyer.specialty)} ${g.buyer.name}</span><small>${g.buyer.specialty} / ${e.card.attribute} · ${affinity?'对上了':'没对上'}</small></div>`
  ];
  return `<div class="stance">${lines.join('')}</div>${e.normal?('<p class="hint">'+keyword('single')+'</p>'):e.delta?`<p class="hint">物品改变优势 ${e.delta>0?'+':''}${e.delta}</p>`:''}`;
}
function scene(){
  const g=game,e=g?.encounter;
  if(cover==='rules')return modal('先看这几条',`<div class="rules-copy">
    <p><strong>开门</strong>　点相邻的暗房，选谁出手，再翻一张埋牌。处理完牌上的结果就能转地砖，记得接上来路。${keyword('rotate')}</p>
    <p><strong>走路和组队</strong>　每人轮到时可开一扇门，或沿通路赶到另一间已开的房。同房、这轮还没开过门的队友可以同行，由一人出手。</p>
    <p><strong>掷骰</strong>　房间纹样被押中，城主多一个优势。出手的人专长对上，冒险者多一个优势。冒险者占优掷两颗取大，城主占优取小，打平掷一颗。</p>
    <p><strong>买东西</strong>　先看价格，再决定要不要掷骰。成功看 2 件，失败看 1 件，魅力额外看 1 件。最多买 1 件，买了才付钱。掷骰的失败后果照常发生。</p>
    <p><strong>找碎片</strong>　成功开房后记下纹样，交易还得买到东西。三次同纹是共鸣，三次各不相同是巡礼，各得 1 枚碎片。遭遇和任务同场给碎片时，两边都拿。</p>
    <p><strong>城主拿魂</strong>　每轮结束拿 1 魂。城主在掷骰时占优，或冒险者真的买了货，结算时各再拿 1 魂。最多留 8 魂。</p>
    <p><strong>谁先赢</strong>　冒险者集齐 5 枚碎片就赢。城主可在自己回合付魂升级，费用依次是 ${COSTS.join('、')} 魂。升 V、冒险者全倒下，或所有房间都开过，城主获胜。</p>
  </div>`,button('返回','close','','primary'),false);
  if(cover==='journal')return modal('对局记录',`<div class="journal">${g?.logs.slice().reverse().map(l=>`<p><small>${l.round}</small>${escape(localize(l.text))}</p>`).join('')??''}</div>`,button('导出记录','export')+button('返回','close','','primary'),false);
  if(cover==='reset')return modal('返回开局？','<p class="hint">本局进度将结束，可以先导出记录。</p>',button('继续本局','close')+button('返回开局','reset','','primary'),false);
  if(cover==='mapTool')return '';
  if(cover.startsWith('inspect')){
    const key=cover.split(':')[1];let body='';
    if(key==='slots')body=cardRow(g.slots.map(s=>s?encounterCard(s.card,{back:human==='party'&&!s.open}):'').join(''));
    if(key==='hand')body=cardRow(g.hand.map(c=>encounterCard(c)).join(''));
    if(key==='discard')body=cardRow(g.eventDiscard.slice().reverse().map(c=>encounterCard(c)).join(''));
    if(key==='events')body=`<p class="hint">遭遇抽堆剩 ${g.events.length} 张。抽空后才回洗公开弃牌。</p>`;
    return modal({slots:'桌上的埋牌',discard:'公开遭遇弃牌',events:'公共遭遇堆',hand:'城主手牌'}[key],body||'<p class="hint">暂无牌</p>',button('返回','close','','primary'),false);
  }
  if(tool){
    const {card,id,options}=tool;
    return modal(card.name,cardRow(itemCard(card))+`<p class="hint">${g.heroes[id].name} · ${options.length?'选好目标就能用':'现在用不了，看看牌底的时机。'}</p>`,
      (mapItem(card)&&options.length?button('在地图选择','map-item','','primary'):options.map((opt,i)=>button(escape(opt.label),'use-item',i,'primary')).join(''))+button('返回','close'),false);
  }
  if(!g)return showMenu();
  if(feedback&&!hidden){
    const dice=feedback.dice;
    return modal('刚才发生了什么',`${feedback.monster?monsterPacket(feedback.monster.card,feedback.monster.monster,'observed'):''}${dice?`<div class="observed-dice">${badge(stanceName(dice.mode),'这次用的骰法')}${dice.revealed?diceMarkup(dice.values,dice.chosen):''}</div>`:''}<div class="feedback-list">${feedback.lines.map(text=>`<p>${escape(localize(text))}</p>`).join('')}</div>`,button('继续','feedback-next','','primary')+button('本局跳过结果弹窗','feedback-skip'));
  }
  if(g.winner)return modal(g.winner+'获胜',`<p class="hint">${escape(g.reason)} · 第 ${g.round} 轮</p>`,button('导出记录','export')+button('新对局','reset','','primary'),false);
  if(hidden||g.side!==human)return '';
  if(g.phase==='city'){
    const count=Math.min(g.need,g.hand.length);
    const patterns=`<div class="pattern-choice">${PATTERNS.map(p=>button(pattern(p)+' '+patternName(p),'pattern',p,cityPattern===p?'picked':'')).join('')}</div>`;
    return modal('布置地牢',`<div class="city-upgrade">${button(upgradeLabel(g),'upgrade','',g.canUpgrade?'primary':'',!g.canUpgrade)}</div>`+patterns+'<div class="city-hand">'+cardRow(g.hand.map((c,i)=>encounterCard(c,{act:'city-pick',value:i,chosen:cityPicks.has(i)})).join(''))+'</div>',
      button(`埋牌 ${cityPicks.size}/${count}`,'deploy','','primary',!cityPattern||cityPicks.size!==count||g.mustUpgrade),true,'选一个纹样设机关，再挑牌填满空位');
  }
  if(g.phase==='door'){
    const choices=`<div class="bearers">${e.party.map(i=>button(icon(glyph[g.heroes[i].specialty],g.heroes[i].specialty)+' '+g.heroes[i].name,'bearer',i,e.bearer===i?'picked':'')).join('')}</div>`;
    return modal('开门前',choices+cardRow(g.slots.map((s,i)=>s?encounterCard(s.card,{act:'reveal',value:i,back:!s.open}):'').join(''))+toolBar(),'',
      true,patternName(g.rooms[e.to].pattern)+' · 选谁出手，再翻一张牌');
  }
  if(g.phase==='revealed')return modal({战斗:'门后有动静！',考验:'想办法过去',交易:'有人做生意'}[e.card.kind],cardRow(encounterCard(e.card))+toolBar(),button(e.card.kind==='战斗'?'看看是什么怪物':'继续','continue','','primary'));
  if(g.phase==='monster')return modal('怪物来了！',monsterPacket(e.card,e.monster),button('迎战','monster','','primary'));
  if(g.phase==='trade'){
    const o=e.card.offer,bonus=g.buyer.specialty==='魅力'?o.charmExtraReveal:0;
    return modal('先问问价',cardRow(encounterCard(e.card,{charm:bonus}))+(bonus?'<p class="hint">魅力出手，多看 1 件。</p>':'')+
      '<p class="hint">掷骰后就会结算牌上的结果，最后可以不买。</p>',button('直接走','trade','no')+button('掷骰看货','trade','yes','primary'));
  }
  if(g.phase==='check'||g.phase==='rolled')return modal(e.card.kind+'检定',monsterPacket(e.card,e.monster,true)+stancePanel()+toolBar(),
    g.phase==='check'?button('掷骰','roll','','primary'):button(` ${diceBusy?'掷骰中…':('取 '+g.value()+' · '+(g.value()>=e.card.dc?'成功':'失败'))}`,'resolve','','primary',diceBusy),true,e.card.name+' · 掷到 '+e.card.dc+' 就过关');
  if(g.phase==='damage'&&e.damage.parts){
    const costs=e.damage.parts.map(([id,amount])=>badge(escape(g.heroes[id].name)+' −'+amount+' 魂','确认分配前的原始损失')).join('');
    return modal('一起扛这一下',`<div class="offer-line">${costs}</div>`+toolBar(),button('确认掉魂','damage','','primary'));
  }
  if(g.phase==='damage')return modal('要掉魂了！',`<div class="damage">${e.damage.area?e.damage.targets.map(id=>g.heroes[id].name).join('、')+' 各':g.heroes[e.damage.target].name} ${icon('−♥','这一击会掉多少魂')}${e.damage.amount}</div>`+toolBar(),button('确认掉魂','damage','','primary'));
  if(g.phase==='goods'){
    const possible=g.paymentOptions().some(p=>g.recipients(p.key).length);
    return modal('选择货物',`<div class="offer-line">${offerPrice(e.card.offer)}<span>挑 1 件，或直接走。</span></div>`+
      cardRow(e.goods.map((c,i)=>itemCard(c,'buy',i,!possible)).join(''))+(!possible?'<p class="hint">付不起，或同行的包都满了。</p>':''),button('不购买','leave','','primary'),true,e.success?'掷骰成功':'掷骰失败，照样能买');
  }
  if(g.phase==='choice'){
    const p=g.pending;
    return modal(({选择弃置物品:'扔掉哪件物品？',选择付款物:'拿哪件东西换？',选择接收者:'谁来拿？'})[p.title]??p.title,`<div class="choice-list">${p.options.map((o,i)=>button(escape(o.label),'choice',i)).join('')}</div>`);
  }
  if(g.phase==='orient')return '';
  return '';
}
function render(){
  if(game?.phase==='action'){
    const key=game.round+':'+game.turn;
    if(key!==actionKey){actionKey=key;selected=new Set([game.turn]);dest=null;}
  }
  updateBoard();$('overlay').innerHTML=scene();
  if(document.getElementById('game-tooltip'))clearTip();
}
function schedule(){
  clearTimeout(timer);
  if(!game||game.winner||game.side===human||cover||tool||feedback)return;
  timer=setTimeout(()=>{
    try{
      aiRun++;if(aiRun>170)throw new Error('自动对手连续操作超过上限');
      const g=game,phase=g.phase,round=g.round,turn=g.turn,e=g.encounter,before=g.logs.length;
      const observe=human==='city'&&g.side==='party';
      if(observe&&phase==='rolled')aiDice={values:[...e.dice],chosen:g.value(),mode:e.mode};
      aiStep(g);
      g.trace.push({round,phase,actor:'ai'});
      if(observe){
        if(g.phase==='monster'&&g.encounter.monster)observedMonster={card:g.encounter.card,monster:g.encounter.monster};
        aiRecords.push(...g.logs.slice(before).map(l=>l.text));
        const stops=turn!==g.turn||round!==g.round||g.winner||g.side==='city'||(e&&!g.encounter);
        if(stops){
          if(aiRecords.length&&!skipFeedback){
            feedback={lines:aiRecords,dice:aiDice,monster:observedMonster};hidden=false;
          }
          aiRecords=[];aiDice=null;observedMonster=null;
        }
      }
      render();
      if(feedback?.dice&&!feedback.dice.revealed){
        const current=feedback;
        current.dice.revealed=true;
        const holder=document.querySelector('.observed-dice');
        if(holder){
          holder.insertAdjacentHTML('beforeend',diceMarkup(current.dice.values.map(()=>'?'),undefined,true));
          animateDice(holder.querySelector('.dice'),current.dice.values,()=>{if(feedback===current&&!hidden&&holder.isConnected)holder.querySelector('.dice').outerHTML=diceMarkup(current.dice.values,current.dice.chosen);},620);
        }
      }
      schedule();
    }catch(error){toast(error.message);}
  },game.phase==='city'?260:90);
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
  link.href=url;link.download='暗门地牢_V093_生存压力_记录.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function handle(action,value){
  if(action==='choose-side'){human=value;render();return;}
  if(action==='start'){observedMonster=null;orientationDraft=null;game=new Game(data);actionKey='';feedback=null;aiRecords=[];aiDice=null;skipFeedback=false;selected=new Set([0]);aiRun=0;render();schedule();return;}
  if(action==='reset'){observedMonster=null;orientationDraft=null;clearTimeout(timer);game=null;feedback=null;aiRecords=[];aiDice=null;diceBusy=false;tool=null;cover='';hidden=false;selected.clear();cityPicks.clear();cityPattern=null;dest=null;render();return;}
  if(action==='export'){exportLog();return;}
  if(action==='inspect'){cover='inspect:'+value;render();schedule();return;}
  if(action==='close'){tool=null;cover='';render();schedule();return;}
  if(action==='hide'||action==='show'){hidden=action==='hide';render();return;}
  if(action==='feedback-next'||action==='feedback-skip'){
    if(action==='feedback-skip')skipFeedback=true;
    feedback=null;hidden=false;aiRun=0;render();schedule();return;
  }
  if(action==='item'&&game&&human==='party'&&!diceBusy){
    const [id,uid]=value.split(':').map(Number),card=game.heroes[id].hand.find(c=>c.uid===uid);
    if(!card)return;
    const options=game.side===human?itemTargets(game,id,card):[];
    tool={id,card,options};render();schedule();return;
  }
  if(!game||game.side!==human||game.winner||feedback||diceBusy)return;
  const before=game.phase,index=Number(value);
  aiRun=0;
  if(cover==='mapTool'&&['room','team','token'].includes(action)){
    const found=tool.options.findIndex(o=>o.arg===index);
    if(found<0){toast('请选择高亮的房间');return;}
    applyItem(game,tool.id,tool.card.uid,found);game.trace.push({action:'use-item',item:tool.card.name,target:index});
    cover='';tool=null;dest=null;selected=new Set([game.turn]);after(before);return;
  }
  if(action==='rotate-preview'&&game.phase==='orient'&&orientationDraft){
    orientationDraft.angle=(orientationDraft.angle+1)%4;animateTile=true;render();return;
  }
  if(action==='room'&&game.phase==='action'){dest=index;render();return;}
  if(action==='token')return;
  if(action==='team'&&game.phase==='action'){
    if(selected.has(index))selected.delete(index);else selected.add(index);render();return;
  }
  if(action==='pattern'){cityPattern=value;render();return;}
  if(action==='city-pick'){if(cityPicks.has(index))cityPicks.delete(index);else cityPicks.add(index);render();return;}
  if(action==='map-item'&&mapItem(tool?.card)&&tool.options.length){cover='mapTool';render();return;}
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
  actions[action]();game.trace.push(context);
  if(action==='roll'){
    diceBusy=true;const rollingGame=game;after(before);
    const values=[...game.encounter.dice];
    animateDice(document.querySelector('.stance .dice'),values,()=>{
      if(rollingGame===game){diceBusy=false;render();}
    });
    return;
  }
  after(before);
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

const tooltip=document.createElement('div');
tooltip.className='floating-tip';
tooltip.id='game-tooltip';
tooltip.setAttribute('role','tooltip');
document.body.appendChild(tooltip);
function clearTip(){tooltip.hidden=true;tooltip.textContent='';}
function showTip(target,x,y){
  const labelled=target.closest?.('[title]');
  if(!labelled)return;
  const message=labelled.getAttribute('title');
  if(!message)return;
  tooltip.textContent=message;tooltip.hidden=false;
  const rect=tooltip.getBoundingClientRect();
  tooltip.style.left=Math.max(8,Math.min(x+12,innerWidth-rect.width-8))+'px';
  tooltip.style.top=Math.max(8,y+rect.height+16>innerHeight?y-rect.height-10:y+14)+'px';
}
clearTip();
document.addEventListener('pointerover',e=>{clearTip();showTip(e.target,e.clientX,e.clientY);});
document.addEventListener('pointerout',clearTip);
document.addEventListener('focusin',e=>{const r=e.target.getBoundingClientRect();showTip(e.target,r.left,r.bottom);});
document.addEventListener('focusout',clearTip);
window.addEventListener('scroll',clearTip,true);
