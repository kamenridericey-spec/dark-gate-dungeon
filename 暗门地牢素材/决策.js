globalThis.dungeonDecision = {
 rankHand(hand,types,level){
  const score=card=>types.filter(type=>type===card.prefer).length*2+card.dc/8+Number(card.kind==='战斗');
  const indices=hand.map((_,i)=>i);
  return level==='casual'?indices.sort(()=>0):indices.sort((a,b)=>score(hand[b])-score(hand[a]));
 },
 route(routes,rooms,heroes,alive,level){
  const ordered=[...routes].sort((a,b)=>Number(rooms[b].name==='宝藏')-Number(rooms[a].name==='宝藏'));
  const room=level==='casual'?routes[0]:ordered[0];
  const bearer=level==='casual'?alive[0]:alive.reduce((a,b)=>heroes[a].soul>=heroes[b].soul?a:b);
  return {room,bearer};
 }
};
