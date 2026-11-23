export const TILE = 36;
export const SPECS = [
  { name: '鱼 A', width: TILE, height: TILE, weight: 1, speed: 2, color: '#edc446' },
  { name: '鱼 B', width: 2*TILE, height: TILE, weight: 2, speed: 1.5, color: '#e88b56' },
  { name: '鱼 C', width: 2*TILE, height: 2*TILE, weight: 4, speed: 1, color: '#92b86b' }
];
export const PHYSICS = { gravity: 1500, jump: 600, speed: 180 };
// Topmost painted fish under a world-space point; -1 when none is hit.
// Fish are drawn in array order, so the last matching one is what the player sees.
export function fishAt(fish,x,y){for(let i=fish.length-1;i>=0;i--){const f=fish[i];if(x>=f.x&&x<=f.x+f.width&&y>=f.y&&y<=f.y+f.height)return i;}return -1;}
export const overlaps = (a,b) => a.x < b.x+b.width-1e-7 && a.x+a.width > b.x+1e-7 && a.y < b.y+b.height-1e-7 && a.y+a.height > b.y+1e-7;
const across = (a,b) => a.x < b.x+b.width && a.x+a.width > b.x;
export function validateLevel(level) {
  if(!level || !Number.isFinite(level.width) || !Number.isFinite(level.height) || level.width<=0 || level.height<=0) throw Error('Invalid level dimensions');
  if(!Array.isArray(level.spawns) || level.spawns.length!==SPECS.length) throw Error('Three spawn points required');
  const rects=[...(level.platforms||[]),level.goal,...(level.boxes||[]),...(level.plates||[]),...(level.keys||[]),...(level.doors||[])];
  if(rects.some(p=>!p || !['x','y','width','height'].every(k=>Number.isFinite(p[k])) || p.width<=0 || p.height<=0)) throw Error('Invalid level rectangle');
  if(level.spawns.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y))) throw Error('Invalid spawn');
  for(const d of level.doors||[]) {
    if(!['plate','key','break'].includes(d.type)) throw Error('Unknown door type');
    if(d.type==='plate' && !(level.plates||[]).some(p=>p.id===d.plateId)) throw Error('Missing plate reference');
    if(d.type==='key' && !(level.keys||[]).some(k=>k.id===d.keyId)) throw Error('Missing key reference');
  }
}
export function createState(level) {
  validateLevel(level);
  const copy=value=>JSON.parse(JSON.stringify(value||[]));
  return {level,fish:SPECS.map((s,id)=>({...s,id,...level.spawns[id],spawnX:level.spawns[id].x,spawnY:level.spawns[id].y,vx:0,vy:0,grounded:true,support:'平台',arrived:false})),
    boxes:copy(level.boxes).map(b=>({...b,vy:0,label:'箱子'})),plates:copy(level.plates).map(p=>({...p,weight:0,on:false})),keys:copy(level.keys).map(k=>({...k,collected:false})),doors:copy(level.doors).map(d=>({...d,open:false,broken:false})),
    selected:0,elapsed:0,paused:false,completed:false,completedLevels:0,falls:0,message:level.help};
}
function solids(state) {return [...state.level.platforms,...state.doors.filter(d=>!d.open).map(d=>({...d,label:'门'}))];}
function mechanisms(state) {
  const parents=contacts(state.fish);
  for(const p of state.plates) {
    const bases=state.fish.filter(f=>Math.abs(f.y+f.height-p.surfaceY)<0.1 && across(f,p));
    const weighed=new Set(bases.flatMap(f=>passengers(f,parents)));
    p.weight=[...weighed].reduce((n,f)=>n+f.weight,0)+state.boxes.filter(b=>Math.abs(b.y+b.height-p.surfaceY)<0.1&&across(b,p)).reduce((n,b)=>n+b.weight,0);
    p.on=p.weight>=p.threshold;
  }
  for(const k of state.keys) if(!k.collected && state.fish.some(f=>overlaps(f,k)))k.collected=true;
  for(const d of state.doors) {
    const unlocked=d.type==='plate'?state.plates.find(p=>p.id===d.plateId)?.on:d.type==='key'?state.keys.find(k=>k.id===d.keyId)?.collected:d.broken;
    d.open=!!unlocked || (d.open && [...state.fish,...state.boxes].some(f=>overlaps(f,d)));
  }
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
function sweep(group, obstacles, axis, delta, level) {
  let allowed=delta;
  const size=axis==='x'?'width':'height';
  for(const body of group) {
    if(axis==='x') allowed=delta>0 ? Math.min(allowed,level.width-body.x-body.width) : Math.max(allowed,-body.x);
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
  const LEVEL=state.level;
  state.elapsed += dt;
  mechanisms(state);
  const active=state.fish[state.selected];
  const jumping=!!input.jump && active.grounded;
  const dash=input.dash?2:1;
  let parents=contacts(state.fish,jumping?active:null);
  const moving=passengers(active,parents);
  const load=moving.slice(1).reduce((sum,f)=>sum+f.weight,0);
  for(const f of state.fish) f.vx=0;
  active.vx=(input.axis||0)*active.speed*PHYSICS.speed*dash*active.weight/(active.weight+load);
  const desiredX=active.vx*dt;
  for(const door of state.doors) if(door.type==='break' && !door.broken && input.dash && Math.abs(active.vx)>=(door.breakSpeed||500) && moving.some(f=>overlaps({...f,x:f.x+desiredX},door))) {door.broken=true;door.open=true;}
  for(const box of state.boxes) {
    if(active.weight<=box.force || !moving.some(f=>overlaps({...f,x:f.x+desiredX},box)))continue;
    const riders=state.fish.filter(f=>!moving.includes(f) && Math.abs(f.y+f.height-box.y)<0.1 && across(f,box));
    const group=[box,...new Set(riders.flatMap(f=>passengers(f,parents)))];
    sweep(group,[...solids(state),...state.boxes.filter(b=>b!==box),...state.fish.filter(f=>!group.includes(f)&&!moving.includes(f))],'x',desiredX,LEVEL);
  }
  const dx=sweep(moving,[...solids(state),...state.boxes,...state.fish.filter(f=>!moving.includes(f))],'x',desiredX,LEVEL);
  for(const f of moving) f.vx=dx/dt;
  if(jumping) {active.vy=-PHYSICS.jump;active.grounded=false;}
  parents=contacts(state.fish,jumping?active:null);
  const roots=state.fish.filter(f=>!parents.has(f)).sort((a,b)=>b.y+b.height-a.y-a.height);
  for(const root of roots) {
    const group=passengers(root,parents);
    const obstacles=[...solids(state),...state.boxes,...state.fish.filter(f=>!group.includes(f)).map(f=>({...f,label:f.name}))];
    root.vy=Math.min(950,root.vy+PHYSICS.gravity*dt);
    const desired=root.vy*dt;
    const moved=sweep(group,obstacles,'y',desired,LEVEL);
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
  for(const box of state.boxes) {
    box.vy=Math.min(950,box.vy+PHYSICS.gravity*dt);
    const dy=sweep([box],[...solids(state),...state.fish,...state.boxes.filter(b=>b!==box)],'y',box.vy*dt,LEVEL);
    if(Math.abs(dy-box.vy*dt)>0.00001)box.vy=0;
  }
  for(const fish of state.fish) {
    if(fish.y>LEVEL.height+TILE) {
      const spawn={...fish,x:fish.spawnX,y:fish.spawnY};
      while([...solids(state),...state.boxes,...state.fish.filter(f=>f!==fish)].some(p=>overlaps(spawn,p)) && spawn.y>-fish.height)spawn.y-=TILE;
      Object.assign(fish,{x:spawn.x,y:spawn.y,vx:0,vy:0,grounded:false,support:'出生点'});
      state.falls++;
    }
  }
  mechanisms(state);
  for(const fish of state.fish) {
    fish.arrived=overlaps(fish,LEVEL.goal) && fish.grounded;
  }
  if(state.fish.every(f=>f.arrived)) {
    state.completed=true; state.completedLevels=1;
    state.message=LEVEL.title+'完成！三条鱼已在检查点集合。';
  }
}
