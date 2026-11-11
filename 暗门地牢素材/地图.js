// 每种印刷板型三张，共 15 张。坐标与外门固定，可随板块旋转。
globalThis.dungeonTiles = [
 {name:'直线',cells:[[0,0],[1,0],[2,0],[3,0]],doors:[[3,0],[2,1]]},
 {name:'方形',cells:[[0,0],[1,0],[0,1],[1,1]],doors:[[1,0],[3,1]]},
 {name:'山形',cells:[[0,0],[1,0],[2,0],[1,1]],doors:[[2,0],[3,1]]},
 {name:'闪电',cells:[[0,0],[1,0],[1,1],[2,1]],doors:[[3,0],[2,1]]},
 {name:'L形',cells:[[0,0],[1,0],[2,0],[2,1]],doors:[[2,0],[3,1]]}
].flatMap((tile,type)=>Array.from({length:3},(_,copy)=>({...tile,id:type+'-'+copy,rooms:['宝藏','恢复','奇遇','宝藏'].map((_,i,types)=>types[(i+type+copy)%types.length])})));
