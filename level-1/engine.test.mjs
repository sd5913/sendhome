import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,step,LEVEL,TILE,PHYSICS,overlaps,loadInfo} from './engine.mjs';
const dt=1/120;
function tick(s,n,input={}) {for(let i=0;i<n;i++)step(s,input,dt);}
test('GDD fish dimensions, weights and relative speeds',()=>{
 const s=createState();assert.deepEqual(s.fish.map(f=>[f.width/TILE,f.height/TILE,f.weight,f.speed]),[[1,1,1,2],[2,1,2,1.5],[2,2,4,1]]);
});
function walkTo(s,x) {
 const f=s.fish[s.selected];
 for(let i=0;i<2400 && !s.completed && Math.abs(f.x-x)>0.01;i++)step(s,{axis:Math.max(-1,Math.min(1,(x-f.x)/(f.speed*PHYSICS.speed*dt)))},dt);
 assert.ok(s.completed || Math.abs(f.x-x)<=0.01,`walk blocked: ${f.name} at ${f.x}, target ${x}`);
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
  if(id<2) walkTo(s,id===0 ? 30*TILE : 28*TILE);
  else {
   walkTo(s,26*TILE);
   step(s,{jump:true},dt);
   for(let i=0;i<160 && !s.completed;i++)step(s,{axis:f.x<28*TILE?1:0},dt);
  }
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

function stack() {
 const s=createState(),[a,b,c]=s.fish;
 b.x=250;b.y=16*TILE-b.height;
 a.x=260;a.y=b.y-a.height;a.vy=0;
 c.x=100;c.y=16*TILE-c.height;
 tick(s,1);return s;
}
function noOverlap(s) {
 for(let i=0;i<s.fish.length;i++)for(let j=i+1;j<s.fish.length;j++)assert.equal(overlaps(s.fish[i],s.fish[j]),false,`overlap ${i},${j}`);
}
test('fish sides block motion without interpenetration',()=>{
 const s=createState(),[a,b]=s.fish;s.selected=0;
 a.x=b.x+b.width+10;tick(s,120,{axis:-1});
 assert.ok(a.x>=b.x+b.width);noOverlap(s);
});
test('carrier moves rider exactly and slows according to carried weight',()=>{
 const s=stack(),[a,b]=s.fish;s.selected=1;
 const xA=a.x,xB=b.x;
 tick(s,30,{axis:1});
 assert.ok(Math.abs((a.x-xA)-(b.x-xB))<0.001);
 assert.ok(Math.abs(b.x-xB-45)<0.001); // 270 * 2/(2+1) * 0.25s
 assert.equal(a.support,b.name);assert.equal(loadInfo(s,b).load,1);noOverlap(s);
});
test('three-fish stack uses recursive load and moves together',()=>{
 const s=createState(),[a,b,c]=s.fish;
 c.x=200;b.x=210;b.y=c.y-b.height;a.x=220;a.y=b.y-a.height;
 tick(s,1);s.selected=2;const before=s.fish.map(f=>f.x);
 tick(s,30,{axis:1});
 const displacement=180*4/7*0.25;
 s.fish.forEach((f,i)=>assert.ok(Math.abs(f.x-before[i]-displacement)<0.001));
 assert.equal(loadInfo(s,c).load,3);noOverlap(s);
});
test('rider jumping detaches and removes carrier load',()=>{
 const s=stack(),[a,b]=s.fish;s.selected=0;step(s,{jump:true},dt);
 assert.ok(a.y+a.height<b.y);assert.equal(loadInfo(s,b).load,0);
 const x=a.x;s.selected=1;tick(s,10,{axis:1});assert.equal(a.x,x);noOverlap(s);
});
test('walking off a carrier starts falling',()=>{
 const s=stack(),[a,b]=s.fish;s.selected=0;tick(s,36,{axis:1});
 assert.ok(a.x>=b.x+b.width);assert.ok(a.y+a.height>b.y);assert.equal(loadInfo(s,b).load,0);noOverlap(s);
});
test('carrier jump lifts the rider and fish heads collide from below',()=>{
 const s=stack(),[a,b]=s.fish;s.selected=1;
 step(s,{jump:true},dt);assert.ok(Math.abs(a.y+a.height-b.y)<0.001);noOverlap(s);
 const t=createState(),[top,bottom,other]=t.fish;
 top.x=300;top.y=400;top.grounded=false;bottom.x=300;bottom.y=440;bottom.vy=-300;bottom.grounded=false;other.x=100;
 step(t,{},dt);noOverlap(t);assert.ok(bottom.y>=top.y+top.height-0.01);
});
test('rider collision against a platform stops the whole carried group',()=>{
 const s=stack(),[a,b]=s.fish;s.selected=1;
 const p=LEVEL.platforms[5];b.x=p.x-b.width-10;b.y=p.y+p.height;
 a.x=b.x+20;a.y=b.y-a.height;
 tick(s,30,{axis:1});noOverlap(s);
 for(const f of s.fish)for(const p of LEVEL.platforms)assert.equal(overlaps(f,p),false);
});
