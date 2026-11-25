import {readFileSync} from 'node:fs';
import {Game} from '../src/engine.mjs';
import {aiStep} from '../src/ai.mjs';
const data=Object.fromEntries(['encounters','items','monsters'].map(key=>[key,JSON.parse(readFileSync(new URL('../data/'+key+'.json',import.meta.url)))]));
for(const style of ['aggressive','cautious','dynamic']){
  const totals={party:0,city:0,rounds:0,rooms:0,breaches:0,tradeOffers:0,tradeAccepted:0,trades:0,meaningfulCityRotations:0,task:0,cardFragments:0,ends:{},fourth:0};
  for(let seed=1;seed<=20;seed++){
    const g=new Game(data,seed);let turns=0;
    while(!g.winner&&turns++<1800)aiStep(g,style);
    if(!g.winner)throw Error(`未结束：${style} ${seed}`);
    totals[g.winner==='冒险者'?'party':'city']++;
    totals.rounds+=g.round;totals.fourth+=Number(g.fragments>=4);
    totals.ends[g.reason]=(totals.ends[g.reason]??0)+1;
    for(const key of ['rooms','breaches','tradeOffers','tradeAccepted','trades','meaningfulCityRotations','task','cardFragments'])totals[key]+=g.metrics[key];
  }
  console.log(JSON.stringify({style,games:20,...totals,roundMean:totals.rounds/20,roomMean:totals.rooms/20}));
}
