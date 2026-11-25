import {readFileSync} from 'node:fs';
import {Game} from '../src/engine.mjs';
import {aiStep} from '../src/ai.mjs';
import {COSTS,CITY_SOUL_LIMIT,MIN_TIER_III_ROUNDS,taskReward} from '../src/rules.mjs';
const data=Object.fromEntries(['encounters','items','monsters'].map(key=>[key,JSON.parse(readFileSync(new URL('../data/'+key+'.json',import.meta.url)))]));
const base=Number(process.argv[2]??1001);
const count=Number(process.argv[3]??100);
const games=[];
for(let i=0;i<count;i++){
  const seed=base+i*173;
  const strategy=i%10<5?'dynamic':i%10<8?'aggressive':'cautious';
  const city=i%2?'denial':'pressure';
  const g=new Game(data,seed);let steps=0;
  while(!g.winner&&steps++<2000)aiStep(g,strategy,city);
  if(!g.winner)throw new Error(`seed ${seed} 未终局，阶段 ${g.phase}`);
  games.push({seed,strategy,city,winner:g.winner,reason:g.reason,round:g.round,fragments:g.fragments,level:g.level,metrics:g.metrics});
}
const mean=(rows,fn)=>Number((rows.reduce((sum,g)=>sum+fn(g),0)/rows.length).toFixed(2));
function summarize(rows){
  const cityWins=rows.filter(g=>g.winner==='城主');
  const rounds=rows.map(g=>g.round).sort((a,b)=>a-b);
  const used=Object.create(null);
  for(const game of rows)for(const [k,v] of Object.entries(game.metrics.itemEffects??{}))used[k]=(used[k]??0)+v;
  const result={
    count:rows.length,cityWins:cityWins.length,partyWins:rows.length-cityWins.length,meanRounds:mean(rows,g=>g.round),
    medianRound:(rounds[Math.floor((rows.length-1)/2)]+rounds[Math.floor(rows.length/2)])/2,minRound:rounds[0],maxRound:rounds.at(-1),
    quickestPartyWin:Math.min(...rows.filter(g=>g.winner==='冒险者').map(g=>g.round)),
    partyWinBy4:rows.filter(g=>g.winner==='冒险者'&&g.round<=4).length,
    endings:Object.fromEntries([...new Set(rows.map(g=>g.reason))].map(reason=>[reason,rows.filter(g=>g.reason===reason).length])),
    reachedIII:rows.filter(g=>g.metrics.thirdTierRound).length,
    itemsUsed:rows.reduce((sum,g)=>sum+g.metrics.items,0),gamesUsingItems:rows.filter(g=>g.metrics.items>0).length,
    itemEffects:used, avgRooms:mean(rows,g=>g.metrics.rooms),avgTaskFragments:mean(rows,g=>g.metrics.task),
    avgEncounterFragments:mean(rows,g=>g.metrics.cardFragments),avgFinalFragments:mean(rows,g=>g.fragments),
  };
  if(!Number.isFinite(result.quickestPartyWin))result.quickestPartyWin=null;
  return result;
}
const summary=summarize(games);
const groups=Object.fromEntries(['aggressive','dynamic','cautious'].map(name=>[name,summarize(games.filter(g=>g.strategy===name))]));
console.log(JSON.stringify({configuration:{costs:COSTS,citySoulLimit:CITY_SOUL_LIMIT,minTierIIIRounds:MIN_TIER_III_ROUNDS,taskRewards:[taskReward(1),taskReward(3)],dc:Object.fromEntries(['I','II','III'].map(k=>[k,data.encounters.find(c=>c.tier===k).dc]))},base,summary,groups,games},null,2));
