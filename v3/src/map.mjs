export const SIZE = 6;
export const PATTERNS = ['条纹', '方格', '点阵'];
export const DIRS = [0, 1, 2, 3];
export const opposite = direction => (direction + 2) % 4;
export function neighbor(id, direction) {
  const x = id % SIZE + [0, 1, 0, -1][direction];
  const y = Math.floor(id / SIZE) + [-1, 0, 1, 0][direction];
  return x >= 0 && y >= 0 && x < SIZE && y < SIZE ? y * SIZE + x : null;
}
export function createMap(shuffle) {
  const inside = Array.from({length: 36}, (_, id) => id).filter(id => DIRS.every(d => neighbor(id,d) !== null));
  const start = shuffle(inside)[0];
  const patterns = shuffle(PATTERNS);
  const pool = shuffle(patterns.flatMap((p,i) => Array(i===2?11:12).fill(p)));
  const doors = shuffle([[3,[0]],[5,[0,2]],[15,[0,1]],[12,[0,1,2]]].flatMap(([n,d]) => Array(n).fill(d)));
  const rooms = Array.from({length: 36}, (_,id) => id===start
    ? {id,pattern:null,doors:[...DIRS],shape:[...DIRS],state:'open'}
    : {id,pattern:pool.pop(),shape:doors.pop(),doors:[],state:'covered'});
  const adjacent = DIRS.map(d=>rooms[neighbor(start,d)]);
  if(adjacent.every(r=>r.pattern===adjacent[0].pattern)){
    const alternate=rooms.find(r=>r.pattern && r.pattern!==adjacent[0].pattern && !adjacent.includes(r));
    [adjacent[0].pattern,alternate.pattern]=[alternate.pattern,adjacent[0].pattern];
  }
  return {rooms,start};
}
export function connected(rooms,id,d){
  const to=neighbor(id,d);
  return to!==null && rooms[id].doors.includes(d) && rooms[to].doors.includes(opposite(d));
}
export function reachable(rooms,id){
  const found=new Set([id]), queue=[id];
  for(const current of queue) for(const d of DIRS){
    const to=neighbor(current,d);
    if(connected(rooms,current,d)&&!found.has(to)){found.add(to);queue.push(to);}
  }
  return [...found];
}
export function frontiers(rooms,id,breach=false){
  return DIRS.flatMap(d=>{
    const to=neighbor(id,d);
    return to!==null && rooms[to].state==='covered' && (breach || rooms[id].doors.includes(d))
      ? [{to,d,breach:!rooms[id].doors.includes(d)}]:[];
  });
}
export function orientations(rooms,id,entry){
  const choices = new Map();
  for(const rotation of DIRS){
    const doors=rooms[id].shape.map(d=>(d+rotation)%4).sort();
    if(!doors.includes(entry)) continue;
    const viable=doors.filter(d=>{
      const to=neighbor(id,d);
      return d===entry || (to!==null && (rooms[to].state==='covered' || rooms[to].doors.includes(opposite(d))));
    });
    if(!choices.has(viable.join())) choices.set(viable.join(),{rotation,doors,viable});
  }
  return [...choices.values()];
}
