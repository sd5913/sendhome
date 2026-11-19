import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,step,LEVEL,TILE} from './engine.mjs';
const dt=1/120;
function tick(s,n,input={}) {for(let i=0;i<n;i++)step(s,input,dt);}
test('GDD fish dimensions, weights and relative speeds',()=>{
 const s=createState();assert.deepEqual(s.fish.map(f=>[f.width/TILE,f.height/TILE,f.weight,f.speed]),[[1,1,1,2],[2,1,2,1.5],[2,2,4,1]]);
});
test('all three fish can traverse the blueprint and gather without dash',()=>{
 const s=createState();
 for(const id of [0,1,2]){
  s.selected=id;const f=s.fish[id];
  const target=id===0 ? 28*TILE : 26*TILE;
  for(let i=0;i<4800 && !f.arrived;i++)step(s,{axis:f.x<target?1:0,jump:f.grounded && f.x<23*TILE},dt);
  assert.equal(f.arrived,true,`${f.name} unreachable at ${f.x},${f.y}`);
 }
 assert.equal(s.completed,true);assert.equal(s.completedLevels,1);assert.equal(s.falls,0);
 tick(s,30);assert.equal(s.completedLevels,1);
});
test('checkpoint occupancy is live and one fish cannot complete level',()=>{
 const s=createState(),f=s.fish[0];f.x=LEVEL.goal.x;f.y=16*TILE-f.height;
 tick(s,1);assert.equal(f.arrived,true);assert.equal(s.completed,false);
 tick(s,120,{axis:-1});assert.equal(f.arrived,false);
});
test('falling respawns safely and pause freezes simulation',()=>{
 const s=createState(),f=s.fish[0];f.y=LEVEL.height+TILE+1;tick(s,1);
 assert.equal(s.falls,1);assert.equal(f.x,f.spawnX);assert.equal(f.y,16*TILE-f.height);
 s.paused=true;const before=JSON.stringify(s);tick(s,60,{axis:1,jump:true});assert.equal(JSON.stringify(s),before);
});
test('terrain sides and undersides are solid',()=>{
 const s=createState(),f=s.fish[0];const middle=LEVEL.platforms[5];
 f.x=middle.x+30;f.y=middle.y+middle.height+2;f.vy=-650;f.grounded=false;
 tick(s,2);assert.ok(f.y>=middle.y+middle.height);assert.ok(f.vy>=0);
 f.x=middle.x-f.width-1;f.y=middle.y+4;f.vy=0;tick(s,1,{axis:1});assert.ok(f.x+f.width<=middle.x);
});
