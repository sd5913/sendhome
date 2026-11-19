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
export const overlaps = (a,b) => a.x < b.x+b.width-1e-7 && a.x+a.width > b.x+1e-7 && a.y < b.y+b.height-1e-7 && a.y+a.height > b.y+1e-7;
const across = (a,b) => a.x < b.x+b.width && a.x+a.width > b.x;
export function createState() {
  return { fish: SPECS.map((s,id) => ({ ...s, id, x:s.spawnX, y:16*TILE-s.height, vx:0, vy:0, grounded:true, support:'起点平台', arrived:false })), selected:0, elapsed:0, paused:false, completed:false, completedLevels:0, falls:0, message:'先用 A / D 移动，按 W 或空格跳跃。三条鱼都要抵达右侧检查点。' };
}
// Contact graph is rebuilt from geometry, so walking off or jumping detaches immediately.
function contacts(fish, detached = null) {
  const parents = new Map();
  for (const rider of fish) {
    if (rider === detached || rider.vy < 0) continue;
    const below = fish.filter(base => base !== rider && across(rider, base) &&
      Math.abs(rider.y + rider.height - base.y) < 0.1);
    below.sort((a,b) => Math.min(rider.x+rider.width,b.x+b.width)-Math.max(rider.x,b.x) -
      (Math.min(rider.x+rider.width,a.x+a.width)-Math.max(rider.x,a.x)));
    if (below[0]) parents.set(rider, below[0]);
  }
  return parents;
}
function passengers(base, parents) {
  const group = [base];
  for (let i=0; i<group.length; i++) {
    for (const [rider, support] of parents) if (support === group[i] && !group.includes(rider)) group.push(rider);
  }
  return group;
}
export function loadInfo(state, fish) {
  const load = passengers(fish, contacts(state.fish)).slice(1).reduce((sum,f)=>sum+f.weight,0);
  return { load, multiplier: fish.weight/(fish.weight+load) };
}
// Sweep the whole carried group by a common displacement. A rider hitting a wall
// or ceiling stops the carrier too, rather than being pushed into solid geometry.
function sweep(group, obstacles, axis, delta) {
  let allowed=delta;
  const size=axis==='x'?'width':'height';
  for(const body of group) {
    if(axis==='x') allowed=delta>0 ? Math.min(allowed,LEVEL.width-body.x-body.width) : Math.max(allowed,-body.x);
    for(const p of obstacles) {
      const cross=axis==='x' ? body.y<p.y+p.height-0.001 && body.y+body.height>p.y+0.001 : across(body,p);
      if(!cross) continue;
      if(delta>0 && body[axis]+body[size]<=p[axis]+0.001)
        allowed=Math.min(allowed,Math.max(0,p[axis]-body[axis]-body[size]));
      if(delta<0 && body[axis]>=p[axis]+p[size]-0.001)
        allowed=Math.max(allowed,Math.min(0,p[axis]+p[size]-body[axis]));
    }
  }
  for(const body of group) body[axis]+=allowed;
  return allowed;
}
export function step(state, input, dt) {
  if (state.paused || state.completed) return;
  state.elapsed += dt;
  const active=state.fish[state.selected];
  const jumping=!!input.jump && active.grounded;
  let parents=contacts(state.fish,jumping?active:null);
  const moving=passengers(active,parents);
  const load=moving.slice(1).reduce((sum,f)=>sum+f.weight,0);
  for(const f of state.fish) f.vx=0;
  active.vx=(input.axis||0)*active.speed*PHYSICS.speed*active.weight/(active.weight+load);
  const dx=sweep(moving,[...LEVEL.platforms,...state.fish.filter(f=>!moving.includes(f))],'x',active.vx*dt);
  for(const f of moving) f.vx=dx/dt;
  if(jumping) {active.vy=-PHYSICS.jump;active.grounded=false;}
  parents=contacts(state.fish,jumping?active:null);
  const roots=state.fish.filter(f=>!parents.has(f)).sort((a,b)=>b.y+b.height-a.y-a.height);
  for(const root of roots) {
    const group=passengers(root,parents);
    const obstacles=[...LEVEL.platforms,...state.fish.filter(f=>!group.includes(f)).map(f=>({...f,label:f.name}))];
    root.vy=Math.min(950,root.vy+PHYSICS.gravity*dt);
    const desired=root.vy*dt;
    const moved=sweep(group,obstacles,'y',desired);
    root.grounded=false;root.support='空中';
    if(Math.abs(moved-desired)>0.00001) {
      if(desired>0) {
        root.grounded=true;
        const land=obstacles.find(p=>across(root,p) && Math.abs(root.y+root.height-p.y)<0.1);
        root.support=land?.label || '平台';
      }
      root.vy=0;
    }
    for(const rider of group.slice(1)) {
      rider.vy=0;rider.grounded=true;rider.support=parents.get(rider).name;
    }
  }
  for(const fish of state.fish) {
    if(fish.y>LEVEL.height+TILE) {
      // Search free space at the start so respawning cannot overlap a teammate.
      let spawn={...fish,x:fish.spawnX,y:16*TILE-fish.height};
      for(let row=0;row<8 && [...LEVEL.platforms,...state.fish.filter(f=>f!==fish)].some(p=>overlaps(spawn,p));row++) {
        let found=false;
        for(let col=2;col+fish.width/TILE<=12;col++) {
          const candidate={...fish,x:col*TILE,y:16*TILE-fish.height-row*TILE};
          if(![...LEVEL.platforms,...state.fish.filter(f=>f!==fish)].some(p=>overlaps(candidate,p))) {spawn=candidate;found=true;break;}
        }
        if(found) break;
      }
      Object.assign(fish,{x:spawn.x,y:spawn.y,vx:0,vy:0,grounded:false,support:'空中'});
      state.falls++;state.message=`${fish.name} 已回到起点。`;
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
