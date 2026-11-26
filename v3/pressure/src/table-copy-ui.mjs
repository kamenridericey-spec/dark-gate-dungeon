import {terms} from './glossary.mjs';

export const patternLabels=['圆','三角','叉'];
export const patternMarks=['○','△','×'];
const stampPaths=[
  '<circle cx="24" cy="24" r="18"/>',
  '<path d="M24 5.5 43 39.5H5Z"/>',
  '<path d="m6.5 6.5 35 35m0-35-35 35"/>',
];
export function stamp(index){
  if(index<0)return '';
  const label=patternLabels[index];
  return '<span class="pattern swatch p'+index+'" title="'+label+'" aria-label="'+label+'" role="img">'+
    '<svg viewBox="0 0 48 48" aria-hidden="true">'+stampPaths[index]+'</svg>'+
    '<span class="stamp-text" aria-hidden="true">'+patternMarks[index]+'</span></span>';
}

export function keyword(key,amount){
  const [mark,label,tone,tip]=terms[key];
  return '<span class="keyword '+tone+'" title="'+tip+'"><span class="term-icon" aria-hidden="true">'+mark+
    '</span> <span>'+label+'</span>'+(amount?'<b>'+amount+'</b>':'')+'</span>';
}
const effectTerm={
  fragment:'fragment',drawItem:'draw',heal:'heal',loseSoul:'damage',discardItem:'discard',
  orientRoom:'rotate',monsterReward:'drop',
};
const targetTerm={
  'heal:explorers':'groupHeal','loseSoul:explorers':'groupDamage','loseSoul:livingParty':'partyDamage','loseSoul:splitExplorers':'split',
};
const valueless=new Set(['orientRoom','monsterReward']);
export function describeEffect(effect){
  const key=targetTerm[effect.effect+':'+effect.target]??effectTerm[effect.effect];
  return key?keyword(key,valueless.has(effect.effect)?null:effect.amount):'';
}
const itemKeywords=['guard','heal','reroll','reverse','single','reveal'];
const keyByLabel=Object.fromEntries(itemKeywords.map(key=>[terms[key][1],key]));
const keywordMatch=new RegExp(Object.keys(keyByLabel).join('|'),'g');
export function highlightItem(text,escape){
  return escape(text).replace(keywordMatch,label=>keyword(keyByLabel[label]));
}
const timingLabels={'行动前':'行动前','开门前':'开门前','遭遇揭晓后':'开门后','检定前':'掷骰前','检定后':'掷骰后','受伤前':'受伤前','掷前':'掷骰前','掷后':'掷骰后','准备':'行动前 / 开门前'};
export const timingText=card=>(card.windows??[card.timing]).map(w=>timingLabels[w]??w).join(' · ');

export const prices={soul:'1 魂',item:'交 1 件物品'};
const resultNames={success:'成功',failure:'失败',afterTrade:'成交'};
const badge=(label,tip)=>'<span class="badge" title="'+tip+'">'+label+'</span>';
export const offerPrice=offer=>badge(prices[offer.cost.kind],offer.cost.kind==='soul'?'成交才付 1 魂，付款后须至少剩 1 魂。':'成交时交给店主 1 件自己的物品。');
export const offerChoice=(offer,result,extra=0)=>badge('看 '+(offer.revealByResult[result]+extra)+' 件','掷骰后翻开这么多件货。魅力角色多看 1 件。');
export const effectsRow=list=>list?.map(describeEffect).join('')||'';
export function outcome(card,result,extra=0){
  const trading=card.offer?offerChoice(card.offer,result,extra):'';
  const effects=effectsRow(card[result]);
  return '<div class="outcome '+(result==='success'?'good':'bad')+'"><span>'+resultNames[result]+'</span>'+
    (trading+effects||'<span class="no-effect">无额外损失</span>')+'</div>';
}
export function offerTerms(offer){
  return '<div class="affinity trade-terms">'+offerPrice(offer)+'<span title="最多买一件，也可以直接走。">最多买 1 件</span>'+
    (offer.afterTrade.length?'<span>成交后</span>'+effectsRow(offer.afterTrade):'')+'</div>';
}
export function patternBonus(card,pattern){
  const rule=card.patternEffect;
  return rule?'<div class="affinity" title="踩上这个纹样，且满足旁边的结果时，才结算这项效果。">'+pattern(card.preferredPattern)+'<span>'+resultNames[rule.when]+'时</span>'+effectsRow(rule.effects)+'</div>':'';
}
