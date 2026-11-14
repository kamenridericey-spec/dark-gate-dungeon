const shapes=[
 {name:'长廊',cells:[[0,0],[1,0],[2,0],[3,0]],doors:[[3,0],[2,1]]},
 {name:'方庭',cells:[[0,0],[1,0],[0,1],[1,1]],doors:[[1,0],[3,1]]},
 {name:'山形',cells:[[0,0],[1,0],[2,0],[1,1]],doors:[[2,0],[3,1]]},
 {name:'折廊',cells:[[0,0],[1,0],[1,1],[2,1]],doors:[[3,0],[2,1]]},
 {name:'曲庭',cells:[[0,0],[1,0],[2,0],[2,1]],doors:[[2,0],[3,1]]}
];
export const directions=[[1,0],[0,1],[-1,0],[0,-1]];
export function setupMap(g){g.tileSupply=Array.from({length:60},(_,i)=>({...shapes[i%5],id:i,types:Array.from({length:4},(_,j)=>['宝藏','恢复','奇遇','宝藏'][(i+j)%4])}));const rooms=[{id:0,x:0,y:0,type:'入口',tile:-1,links:[],exits:[]}];g.rooms=rooms;for(let d=0;d<4;d++){const door={dir:d,state:'open'};rooms[0].exits.push(door);addRegion(g,0,door,d);}return rooms;}
function addRegion(g,id,exit,preferred){const source=g.rooms[id],[dx,dy]=directions[exit.dir];let found;const candidates=[];
 for(const tile of g.tileSupply)for(let rot=0;rot<4;rot++){
  const cells=tile.cells.map(([f,t])=>{for(let k=0;k<rot;k++)[f,t]=[-t,f];return [source.x+dx+f*dx-t*dy,source.y+dy+f*dy+t*dx];});
  if(!cells.every(([x,y])=>!g.rooms.some(r=>r.x===x&&r.y===y)))continue;
  const all=[...g.rooms,...cells.map(([x,y])=>({x,y}))],area=(Math.max(...all.map(r=>r.x))-Math.min(...all.map(r=>r.x))+1)*(Math.max(...all.map(r=>r.y))-Math.min(...all.map(r=>r.y))+1);
  const contact=cells.reduce((n,[x,y])=>n+g.rooms.filter(r=>Math.abs(r.x-x)+Math.abs(r.y-y)===1).length,0);
  const preference=preferred===undefined?0:(tile.id%5===preferred?10000:0);
  candidates.push({tile,cells,rot,score:preference-area+contact*3});
 }
 candidates.sort((a,b)=>b.score-a.score);found=candidates[0]; if(!found){exit.state='dead';return false;}const {tile,cells,rot}=found,first=g.rooms.length;g.tileSupply.splice(g.tileSupply.indexOf(tile),1);
 for(let i=0;i<4;i++)g.rooms.push({id:first+i,x:cells[i][0],y:cells[i][1],type:tile.types[i],tile:tile.id,shape:tile.name,links:[],exits:[]});
 const link=(a,b)=>{if(!g.rooms[a].links.includes(b))g.rooms[a].links.push(b);if(!g.rooms[b].links.includes(a))g.rooms[b].links.push(a);};link(id,first);
 for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)if(Math.abs(cells[i][0]-cells[j][0])+Math.abs(cells[i][1]-cells[j][1])===1)link(first+i,first+j);
 for(const [i,dir] of tile.doors)g.rooms[first+i].exits.push({dir:(dir+exit.dir+rot)%4,state:'open'});
 // A door on either side of two touching regions creates a reciprocal passage.
 for(const r of g.rooms.slice(first))for(let dir=0;dir<4;dir++){
  const [dx,dy]=directions[dir],other=g.rooms.find(n=>n.x===r.x+dx&&n.y===r.y+dy&&n.tile!==r.tile);if(!other)continue;
  const forward=r.exits.find(e=>e.dir===dir),back=other.exits.find(e=>e.dir===(dir+2)%4);
  if(forward||back){link(r.id,other.id);if(forward)forward.state='linked';if(back)back.state='linked';}
 }
 exit.state='linked';return true;
}
export function expandMap(g,roomId){const room=g.rooms[roomId];for(const exit of room.exits??[])if(exit.state==='open'){const count=g.rooms.length;if(addRegion(g,roomId,exit))g.note('打开外门，接入四房间区域「'+g.rooms[count].shape+'」。');else g.note('外门暂无法拼接，保留为局部死路。');}}
