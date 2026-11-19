// Level geometry uses the GDD square grid. Coordinates increase downwards.
export const TILE = 36;
export const LEVEL = {
  width: 32 * TILE, height: 22 * TILE,
  platforms: [
    { x: 2, y: 16, w: 11, h: 1, label: '起点平台' },
    { x: 13, y: 16, w: 1, h: 3, label: '下行阶梯' },
    { x: 14, y: 17, w: 2, h: 2, label: '下行阶梯' },
    { x: 16, y: 18, w: 2, h: 1, label: '下行阶梯' },
    { x: 13, y: 19, w: 16, h: 1, label: '下层回落平台' },
    { x: 12, y: 13, w: 4, h: 1, label: '第一跳台' },
    { x: 19, y: 12, w: 4, h: 1, label: '第二跳台' },
    { x: 26, y: 13, w: 5, h: 1, label: '终点平台' }
  ].map(p => ({ x: p.x*TILE, y: p.y*TILE, width: p.w*TILE, height: p.h*TILE, label: p.label })),
  goal: { x: 28*TILE, y: 10*TILE, width: 3*TILE, height: 3*TILE }
};
export const SPECS = [
  { name: '鱼 A', width: TILE, height: TILE, weight: 1, speed: 2, color: '#edc446', spawnX: 9*TILE },
  { name: '鱼 B', width: 2*TILE, height: TILE, weight: 2, speed: 1.5, color: '#e88b56', spawnX: 6*TILE },
  { name: '鱼 C', width: 2*TILE, height: 2*TILE, weight: 4, speed: 1, color: '#92b86b', spawnX: 3*TILE }
];
export const PHYSICS = { gravity: 1500, jump: 600, speed: 180 };
export const overlaps = (a,b) => a.x < b.x+b.width && a.x+a.width > b.x && a.y < b.y+b.height && a.y+a.height > b.y;
const across = (a,b) => a.x < b.x+b.width && a.x+a.width > b.x;
export function createState() {
  return { fish: SPECS.map((s,id) => ({ ...s, id, x:s.spawnX, y:16*TILE-s.height, vx:0, vy:0, grounded:true, support:'起点平台', arrived:false })), selected:0, elapsed:0, paused:false, completed:false, completedLevels:0, falls:0, message:'先用 A / D 移动，按 W 或空格跳跃。三条鱼都要抵达右侧检查点。' };
}
export function step(state, input, dt) {
  if (state.paused || state.completed) return;
  // Fixed 120 Hz simulation in the client keeps contacts stable on slow frames.
  state.elapsed += dt;
  for (const fish of state.fish) {
    const active = fish.id === state.selected;
    fish.vx = active ? (input.axis || 0)*fish.speed*PHYSICS.speed : 0;
    if (active && input.jump && fish.grounded) { fish.vy=-PHYSICS.jump; fish.grounded=false; }
    const dx=fish.vx*dt;
    fish.x=Math.max(0,Math.min(LEVEL.width-fish.width,fish.x+dx));
    for (const p of LEVEL.platforms) {
      if (!overlaps(fish,p)) continue;
      if (dx>0) fish.x=p.x-fish.width;
      if (dx<0) fish.x=p.x+p.width;
    }
    const oldY=fish.y;
    fish.vy=Math.min(950,fish.vy+PHYSICS.gravity*dt);
    fish.y+=fish.vy*dt;
    fish.grounded=false; fish.support='空中';
    if (fish.vy>=0) {
      const surfaces=[...LEVEL.platforms,...state.fish.filter(f=>f!==fish).map(f=>({...f,label:f.name}))];
      const land=surfaces.filter(p=>across(fish,p) && oldY+fish.height<=p.y+0.01 && fish.y+fish.height>=p.y).sort((a,b)=>a.y-b.y)[0];
      if (land) { fish.y=land.y-fish.height; fish.vy=0; fish.grounded=true; fish.support=land.label; }
    } else {
      const ceiling=LEVEL.platforms.filter(p=>across(fish,p) && oldY>=p.y+p.height-0.01 && fish.y<p.y+p.height).sort((a,b)=>b.y+b.height-a.y-a.height)[0];
      if(ceiling) { fish.y=ceiling.y+ceiling.height; fish.vy=0; }
    }
    if(fish.y>LEVEL.height+TILE) {
      fish.x=fish.spawnX; fish.y=16*TILE-fish.height; fish.vx=fish.vy=0; fish.grounded=true; fish.support='起点平台';
      state.falls++; state.message=`${fish.name} 已回到起点。可沿下方平台返回左侧台阶，再从起点跳上第一跳台。`;
    }
  }
  for(const fish of state.fish) {
    fish.arrived=fish.x>=LEVEL.goal.x && fish.x+fish.width<=LEVEL.goal.x+LEVEL.goal.width && fish.y>=LEVEL.goal.y && fish.y+fish.height<=LEVEL.goal.y+LEVEL.goal.height+0.1 && fish.grounded;
  }
  if(state.fish.every(f=>f.arrived)) {
    state.completed=true; state.completedLevels=1;
    state.message='关卡 1 完成！三条鱼已在检查点集合。';
  }
}
