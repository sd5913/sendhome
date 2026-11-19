import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,step,LEVEL,TILE,PHYSICS} from './engine.mjs';
const dt=1/120;
function tick(s,n,input={}) {for(let i=0;i<n;i++)step(s,input,dt);}
test('GDD fish dimensions, weights and relative speeds',()=>{
 const s=createState();assert.deepEqual(s.fish.map(f=>[f.width/TILE,f.height/TILE,f.weight,f.speed]),[[1,1,1,2],[2,1,2,1.5],[2,2,4,1]]);
});
function walkTo(s,x) {
 const f=s.fish[s.selected];
 for(let i=0;i<2400 && !s.completed && Math.abs(f.x-x)>3;i++)step(s,{axis:Math.sign(x-f.x)},dt);
 assert.ok(s.completed || Math.abs(f.x-x)<=3,`walk blocked: ${f.name} at ${f.x}, target ${x}`);
}
function jumpTo(s,p,delay=0) {
 const f=s.fish[s.selected];
 step(s,{jump:true},dt);
 tick(s,delay);
 for(let i=0;i<240 && !(f.grounded && f.support===p.label);i++)step(s,{axis:1},dt);
 assert.equal(f.support,p.label,`${f.name} failed landing on ${p.label} at ${f.x},${f.y}`);
}
test('all three fish traverse both raised platforms and gather with the weaker jump',()=>{
 const s=createState(), first=LEVEL.platforms[5], second=LEVEL.platforms[6], final=LEVEL.platforms[7];
 for(const id of [0,1,2]){
  s.selected=id;const f=s.fish[id];
  walkTo(s,first.x-f.width-5);
  jumpTo(s,first,36);
  walkTo(s,first.x+first.width-f.width-3);
  jumpTo(s,second);
  walkTo(s,second.x+second.width-f.width-3);
  jumpTo(s,final);
  walkTo(s,id===0 ? 29.75*TILE : 28.25*TILE);
  tick(s,120);
  assert.equal(f.arrived,true,`${f.name} missing checkpoint`);
 }
 assert.equal(s.completed,true);assert.equal(s.completedLevels,1);assert.equal(s.falls,0);
 tick(s,30);assert.equal(s.completedLevels,1);
});
test('jump apex is reduced while clearing the three-tile first rise',()=>{
 const s=createState(),f=s.fish[0], start=f.y;
 step(s,{jump:true},dt);let apex=f.y;
 for(let i=0;i<100;i++){step(s,{},dt);apex=Math.min(apex,f.y);}
 assert.ok(start-apex>3*TILE);assert.ok(start-apex<3.4*TILE);
 assert.ok(PHYSICS.jump<650);
});
test('checkpoint occupancy is live and one fish cannot complete level',()=>{
 const s=createState(),f=s.fish[0];f.x=LEVEL.goal.x;f.y=LEVEL.goal.y+LEVEL.goal.height-f.height;
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
