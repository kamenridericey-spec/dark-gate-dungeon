import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../src/engine.mjs';
import {aiStep} from '../src/ai.mjs';
import {applyItem} from '../src/items.mjs';
import {neighbor,connected,opposite,orientations} from '../src/map.mjs';
import {recordPattern} from '../src/rules.mjs';

const data=Object.fromEntries(['encounters','items','monsters'].map(k=>[k,JSON.parse(readFileSync(new URL('../data/'+k+'.json',import.meta.url)))]));
const fresh=()=>new Game(data,42);
function setup(g,id,hero=0,patternMatches=false,party=[hero]){
  g.hand[0]=data.encounters.find(c=>c.id===id);
  g.prepare(patternMatches?g.rooms[g.targets(hero)[0].to].pattern:'条纹',[0,1,2]);g.turn=hero;
  g.explore(g.targets()[0].to,party,hero);g.reveal(0);g.continueEncounter();return g.encounter;
}
function complete(g,v){g.roll();g.encounter.dice.fill(v);g.confirm();}
function finish(g){let n=0;while(['choice','orient','damage'].includes(g.phase)&&n++<20){if(g.phase==='choice')g.select(0);else if(g.phase==='damage')g.damage();else g.orient(0);}assert.ok(n<20);}

test('6×6 with interior four-door entrance and visible textures',()=>{
  for(let i=1;i<=120;i++){
    const g=new Game(data,i);
    assert.equal(g.rooms.length,36);assert.equal(g.targets().length,4);
    assert.ok(new Set(g.targets().map(e=>g.rooms[e.to].pattern)).size>=2);
  }
});
test('zero rooms used preserves all slots without drawing gratuitous cards',()=>{
  const g=fresh();g.prepare('条纹',[0,1,2]);const slots=g.slots.slice();
  for(let i=0;i<3;i++)g.wait();
  assert.equal(g.round,2);assert.deepEqual(g.slots,slots);assert.equal(g.hand.length,3);
  assert.equal(g.metrics.income.round,1);
});
test('upgrade unlocks encounter/goods/monsters and draws exactly one',()=>{
  const g=fresh();g.hand.pop();g.citySoul=5;g.upgrade();
  assert.equal(g.level,2);assert.equal(g.monsters.II.length,4);assert.equal(g.hand.length,6);assert.equal(g.hand.at(-1).tier,'II');
  assert.ok(g.logs.some(l=>l.text.includes('12张遭遇')));
  const full=fresh();full.citySoul=5;full.upgrade();assert.equal(full.phase,'choice');full.select(6);assert.equal(full.hand.length,6);
});
test('exploration connects only entry before resolving, failure can let city set exit',()=>{
  const g=fresh();const e=setup(g,'D-I-06',0,true);
  const room=g.rooms[e.to];assert.equal(room.state,'pending');
  assert.deepEqual(room.doors,[e.entry]);assert.ok(connected(g.rooms,e.to,e.entry));
  room.shape=[0,1,2];complete(g,1);
  if(g.phase==='orient'){assert.equal(g.side,'city');g.orient(0);}
  assert.equal(room.state,'open');assert.ok(connected(g.rooms,e.to,e.entry));assert.deepEqual(g.history,[]);
});
test('shared task window switches route and triggers both patterns',()=>{
  assert.deepEqual(recordPattern(['A','A'],'B'),{history:['A','B'],task:null});
  assert.deepEqual(recordPattern(['A','B'],'A'),{history:['B','A'],task:null});
  assert.deepEqual(recordPattern(['A','A'],'A'),{history:[],task:'共鸣'});
  assert.deepEqual(recordPattern(['A','B'],'C'),{history:[],task:'巡礼'});
});
test('I and II monsters pay no fragments, and old battles keep their own tier at III',()=>{
  for(const rank of ['I','II'])assert.ok(data.monsters[rank].every(m=>m.reward.effect==='monsterLoot'));
  assert.ok(data.encounters.filter(c=>c.tier==='I').every(c=>c.success.every(e=>e.effect!=='fragment')));
  const g=fresh();g.level=3;g.unlock(3);const e=setup(g,'D-I-01');
  assert.ok(g.data.monsters.I.some(m=>m.id===e.monster.id));
  assert.equal(e.monster.reward.effect,'monsterLoot');
});
test('III monster grants one reward and stops immediately on fifth fragment',()=>{
  const g=fresh();g.level=3;g.unlock(3);g.fragments=4;
  g.monsters.III.unshift(data.monsters.III.find(m=>m.reward.effect==='fragment'));
  const e=setup(g,'D-III-01');
  assert.equal(e.monster.reward.effect,'fragment');g.startCheck();complete(g,20);
  assert.equal(g.winner,'冒险者');assert.equal(g.rooms[e.to].state,'pending');assert.deepEqual(g.metrics.income,{round:0,advantage:0,trade:0});
});
test('four trade display counts; refusal spends the encounter but never draws',()=>{
  for(const [hero,good,count] of [[0,true,2],[0,false,1],[2,true,3],[2,false,2]]){
    const g=fresh();const e=setup(g,'D-I-09',hero);const before=g.goods.length;
    assert.equal(e.goods.length,0);assert.equal(g.goods.length,before);g.acceptTrade(true);complete(g,good?20:1);
    assert.equal(e.goods.length,count);assert.equal(g.phase,'goods');
    g.purchase(0);finish(g);assert.equal(g.metrics.income.trade,1);assert.equal(g.history.length,good?1:0);
  }
  const g=fresh();setup(g,'D-I-09');const before=g.goods.length;g.acceptTrade(false);finish(g);
  assert.equal(g.goods.length,before);assert.equal(g.metrics.checks,0);assert.equal(g.metrics.income.trade,0);
});
test('failure discards before purchase and spending an old item frees capacity',()=>{
  const g=fresh();g.heroes[0].hand=[g.unique(data.items.cards[0]),g.unique(data.items.cards[1])];
  setup(g,'D-II-11',0,true);g.acceptTrade(true);complete(g,1);
  assert.equal(g.phase,'choice');g.select(0);assert.equal(g.heroes[0].hand.length,1);g.purchase(0);finish(g);
  assert.equal(g.heroes[0].hand.length,1);assert.equal(g.metrics.income.trade,1);assert.equal(g.metrics.income.advantage,1);assert.deepEqual(g.history,[]);
  const h=fresh();h.heroes[0].hand=[h.unique(data.items.cards[0]),h.unique(data.items.cards[1])];setup(h,'D-I-10');h.acceptTrade(true);complete(h,20);h.purchase(0);finish(h);
  assert.equal(h.heroes[0].hand.length,2);assert.equal(h.metrics.income.trade,1);
});
test('repeat city stance income and a normalizing item suppresses only own encounter',()=>{
  const g=fresh();const norm=g.unique(data.items.cards.find(c=>c.effect==='forceNormal'));g.heroes[0].hand=[norm];
  setup(g,'D-I-06',0,true);assert.equal(g.mode(),-1);applyItem(g,0,norm.uid,0);assert.equal(g.mode(),0);
  complete(g,20);finish(g);assert.equal(g.metrics.income.advantage,0);
  const h=fresh();
  h.hand[0]=data.encounters.find(c=>c.id==='D-I-06');
  h.hand[1]=h.hand[0];
  const first=h.targets(0)[0], pattern=h.rooms[first.to].pattern;
  const second=h.targets(1).find(e=>e.to!==first.to);
  h.rooms[second.to].pattern=pattern;
  h.heroes[1].specialty='体魄';
  h.prepare(pattern,[0,1,2]);
  for(const [edge,id] of [[first,0],[second,1]]){
    h.explore(edge.to,[id],id);h.reveal(id);h.continueEncounter();assert.equal(h.mode(),-1);
    complete(h,20);finish(h);
  }
  assert.equal(h.round,1);assert.equal(h.metrics.income.advantage,2);

});
test('team spends all explorers and only bearer provides matching specialty',()=>{
  const g=fresh();setup(g,'D-I-06',0,true,[0,1]);assert.equal(g.mode(),-1);complete(g,20);finish(g);
  assert.equal(g.turn,2);assert.equal(g.heroes[1].state,'explored');assert.equal(g.history.length,1);
});
test('last normal frontier prevents breaching, sealed frontier supports reversible entry',()=>{
  const g=fresh();g.prepare('条纹',[0,1,2]);assert.equal(g.canBreach,false);g.rooms[g.start].doors=[];
  assert.equal(g.canBreach,true);const edge=g.targets()[0];g.explore(edge.to,[0],0);g.reveal(0);
  assert.equal(g.metrics.breaches,1);assert.ok(g.rooms[edge.to].doors.includes(opposite(edge.d)));assert.ok(connected(g.rooms,g.start,edge.d));
});
test('seeded opponents finish games in all three strategies without stuck phases',()=>{
  for(const strategy of ['aggressive','cautious','dynamic']){
    for(let i=1;i<=12;i++){
      const g=new Game(data,i);
      let n=0;
      while(!g.winner&&n++<1600)aiStep(g,strategy);
      assert.ok(g.winner,`${strategy} seed ${i}`);
      assert.ok(g.rooms.some(r=>!r.pattern&&neighbor(r.id,0)!==null));
    }
  }
});

test('a corner-facing wall keeps its printed door and remains a distinct rotation',()=>{
  const g=fresh(), id=0, entry=1;
  const room=g.rooms[id];
  room.shape=[0,1,2];room.state='pending';
  const options=orientations(g.rooms,id,entry);
  assert.equal(options.length,3);
  assert.ok(options.every(o=>o.doors.length===3&&o.doors.includes(entry)));
  assert.ok(options.some(o=>o.viable.length<o.doors.length));
});
test('an AI scout consumes insight and assigns the revealed check to a matching teammate',()=>{
  const g=fresh();
  g.hand[0]=data.encounters.find(c=>c.id==='D-I-06');
  g.prepare('条纹',[0,1,2]);
  const actor=g.heroes[0],insight=g.unique(data.items.cards.find(c=>c.effect==='insight'));
  actor.hand=[insight]; g.heroes[1].soul=2;
  const edge=g.targets()[0];g.explore(edge.to,[0,1],0);
  aiStep(g);
  assert.equal(g.metrics.items,1);assert.ok(g.slots[0].open);
  aiStep(g);
  assert.equal(g.encounter.bearer,1);
  assert.equal(g.encounter.card.attribute,'心智');
});
test('breaching does not change a printed door layout',()=>{
  const g=fresh();g.prepare('条纹',[0,1,2]);g.rooms[g.start].doors=[];
  const edge=g.targets()[0];g.explore(edge.to,[0],0);g.reveal(0);
  assert.deepEqual(g.rooms[g.start].doors,[]);
  assert.deepEqual(g.rooms[g.start].breachDoors,[edge.d]);
  assert.ok(connected(g.rooms,g.start,edge.d));
});

test('late tasks pay two fragments and retain a five-fragment display cap',()=>{
  const g=fresh();g.level=3;g.unlock(3);g.fragments=3;
  const e=setup(g,'D-I-06');const pattern=g.rooms[e.to].pattern;
  g.history=[pattern,pattern];complete(g,20);finish(g);
  assert.equal(g.metrics.task,2);assert.equal(g.fragments,5);assert.equal(g.winner,'冒险者');
  const early=fresh();const opening=setup(early,'D-I-06');const p=early.rooms[opening.to].pattern;
  early.history=[p,p];complete(early,20);finish(early);assert.equal(early.fragments,1);
});
test('city eight-soul cap and eight full rounds at III gate the final upgrade',()=>{
  const g=fresh();g.level=3;g.metrics.thirdTierRound=2;g.round=9;g.citySoul=7;
  g.income('round');g.income('trade');g.income('advantage');
  assert.equal(g.citySoul,8);assert.equal(g.tierIIIWait,1);assert.equal(g.canUpgrade,false);
  g.round=10;assert.equal(g.canUpgrade,true);g.upgrade();assert.equal(g.winner,'城主');
});
test('a skipped II or III upgrade locks the next deployment until upgrade',()=>{
  const g=fresh();g.citySoul=5;g.prepare('条纹',[0,1,2]);
  for(let i=0;i<3;i++)g.wait();
  assert.ok(g.mustUpgrade);assert.throws(()=>g.prepare('条纹',[]),/须先升级/);
  g.upgrade();assert.equal(g.level,2);assert.equal(g.mustUpgrade,false);g.prepare('条纹',[]);
});
test('encounter DC values depend on their card tier',()=>{
  for(const [key,dc] of Object.entries({I:8,II:10,III:12})){
    const cards=data.encounters.filter(c=>c.tier===key);
    assert.equal(cards.length,12); assert.ok(cards.every(c=>c.dc===dc));
  }
});
