import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createState,step,loadInfo,overlaps,validateLevel,PHYSICS,fishAt} from './engine.mjs';
const read=name=>JSON.parse(readFileSync(new URL('../levels/'+name+'.json',import.meta.url)));
const tick=(s,n,input={})=>{for(let i=0;i<n;i++)step(s,input,1/120);};
const fresh=()=>createState(read('mechanics-test'));
test('all catalog levels validate and do not share mutable mechanism state',()=>{
 for(const {id} of read('index')){
  const level=read(id);validateLevel(level);
  const a=createState(level),b=createState(level);a.fish[0].x+=40;assert.notEqual(a.fish[0].x,b.fish[0].x);
  if(a.boxes.length){a.boxes[0].x+=40;assert.notEqual(a.boxes[0].x,b.boxes[0].x);}
 }
});
test('movement, jumping, carrier load and contacts are identical in every map',()=>{
 for(const {id} of read('index')){
  const s=createState(read(id)),[a,b,c]=s.fish;
  const floor=s.level.platforms[0];b.x=floor.x+120;b.y=floor.y-b.height;a.x=b.x+10;a.y=b.y-a.height;c.x=floor.x;c.y=floor.y-c.height;
  s.selected=1;tick(s,1);const before=b.x;tick(s,30,{axis:1});
  assert.ok(Math.abs(b.x-before-45)<0.001);assert.equal(loadInfo(s,b).load,1);assert.equal(overlaps(a,b),false);
  s.selected=0;step(s,{jump:true},1/120);assert.equal(loadInfo(s,b).load,0);assert.ok(a.vy<0);
 }
});
test('weak fish cannot push boxes, strong fish can, closed doors stop boxes',()=>{
 for(const [id,canPush] of [[0,false],[1,true]]){
  const s=fresh(),f=s.fish[id],box=s.boxes[0];s.selected=id;
  f.x=box.x-f.width;const x=box.x;tick(s,12,{axis:1});
  assert.equal(box.x>x,canPush);assert.equal(overlaps(f,box),false);
 }
 const s=fresh(),b=s.boxes[0],d=s.doors[0],f=s.fish[1];s.selected=1;
 b.x=d.x-b.width;f.x=b.x-f.width;tick(s,30,{axis:1});assert.ok(b.x+b.width<=d.x);assert.equal(overlaps(f,b),false);
});
test('pressure plates count the full stack and close after weight leaves',()=>{
 const s=fresh(),[a,b,c]=s.fish,p=s.plates[0];
 b.x=p.x;b.y=p.surfaceY-b.height;a.x=p.x;a.y=b.y-a.height;
 c.x=120;c.y=p.surfaceY-c.height;tick(s,1);assert.equal(p.weight,3);assert.equal(p.on,false);
 c.x=p.x;c.y=a.y-c.height;tick(s,1);assert.equal(p.weight,7);assert.equal(s.doors[0].open,true);
 for(const f of s.fish)f.x-=300;tick(s,1);assert.equal(s.doors[0].open,false);
});
test('key collection opens linked door and only a fast dash breaks a break door',()=>{
 const s=fresh(),a=s.fish[0];a.x=s.keys[0].x;tick(s,1);assert.equal(s.keys[0].collected,true);assert.equal(s.doors[1].open,true);
 const d=s.doors[2];a.x=d.x-a.width;tick(s,1,{axis:1});assert.equal(d.broken,false);
 tick(s,1,{axis:1,dash:true});assert.equal(d.broken,true);assert.equal(d.open,true);
});
test('respawn uses arbitrary level data rather than LV1 coordinates',()=>{
 const l=read('level-1');l.width=1800;l.platforms=[{x:0,y:300,width:1800,height:36}];l.spawns=[{x:100,y:264},{x:200,y:264},{x:300,y:228}];
 const s=createState(l);s.fish[0].y=l.height+40;tick(s,1);assert.equal(s.fish[0].y,264);assert.equal(s.fish[0].x,100);
});
test('level 2 key opens the ground door and the room fish stays locked in',()=>{
 const s=createState(read('level-2'));
 const door2=s.doors.find(d=>d.id==='door2'),door1=s.doors.find(d=>d.id==='door1');
 assert.equal(door2.open,false);assert.equal(door1.open,false);
 s.fish[0].x=s.keys[0].x;tick(s,1);
 assert.equal(s.keys[0].collected,true);assert.equal(door2.open,true);
 s.selected=2;const roomFish=s.fish[2],start=roomFish.x;
 tick(s,120,{axis:1});
 assert.ok(roomFish.x<720,`room fish escaped a closed door at ${roomFish.x}`);
 assert.ok(roomFish.x>=start);
});
test('level 2 plate needs weight 3, so A alone cannot open the room door',()=>{
 const s=createState(read('level-2')),[a,b]=s.fish,plate=s.plates[0],door1=s.doors.find(d=>d.id==='door1');
 a.x=plate.x;a.y=540;tick(s,1);
 assert.equal(plate.weight,1);assert.equal(door1.open,false);
 b.x=plate.x;b.y=540;tick(s,1);
 assert.equal(plate.weight,3);assert.equal(plate.on,true);assert.equal(door1.open,true);
 a.x-=200;tick(s,1);
 assert.equal(door1.open,false);
});
test('level 2 room fish leaves once the plate opens its door',()=>{
 const s=createState(read('level-2')),[a,b,c]=s.fish,plate=s.plates[0];
 a.x=plate.x;a.y=540;b.x=plate.x;b.y=540;tick(s,1);
 s.selected=2;
 tick(s,240,{axis:1});
 assert.ok(c.x>790,`room fish stuck at ${c.x}`);
 assert.ok(Math.abs(c.y+c.height-576)<1,`room fish did not reach the ground: ${c.y+c.height}`);
});
test('level 2 pillar is a three-tile step a single fish can clear',()=>{
 const s=createState(read('level-2')),pillar=s.level.platforms.find(p=>p.label==='柱子');
 assert.equal(pillar.height,108);
 const f=s.fish[0];s.selected=0;f.x=300;f.y=540;
 for(let i=0;i<240;i++)step(s,{axis:1,jump:i===0},1/120);
 assert.ok(f.x>pillar.x+pillar.width,`stuck before the pillar at ${f.x}`);
 assert.ok(Math.abs(f.y+f.height-576)<1);
});
test('invalid door links are rejected at level load',()=>{
 const l=read('mechanics-test');l.doors[0].plateId='missing';assert.throws(()=>createState(l),/Missing plate/);
});
test('clicking a fish returns its index and empty space returns none',()=>{
 const s=createState(read('mechanics-test'));
 s.fish[0].x=100;s.fish[0].y=200;
 s.fish[1].x=300;s.fish[1].y=200;
 assert.equal(fishAt(s.fish,110,210),0);
 assert.equal(fishAt(s.fish,300,200),1);
 assert.equal(fishAt(s.fish,299,200),-1);
 assert.equal(fishAt(s.fish,0,0),-1);
});
test('a heavier fish shoves a lighter one without overlapping it',()=>{
 const s=fresh(),[a,b]=s.fish,floor=s.level.platforms[0];
 s.boxes[0].x=2500;
 b.x=300;b.y=floor.y-b.height;
 a.x=300+b.width;a.y=floor.y-a.height;
 s.selected=1;
 const b0=b.x,a0=a.x;tick(s,30,{axis:1});
 // B pushes slower than its free 270 px/s: 270 * 2/(2+1) * 0.25s = 45 px.
 assert.ok(Math.abs(b.x-b0-45)<0.001,`B moved ${b.x-b0}`);
 assert.ok(Math.abs(a.x-a0-45)<0.001,`A moved ${a.x-a0}`);
 assert.equal(overlaps(a,b),false);
});
test('a fish cannot shove one at least as heavy as itself',()=>{
 const s=fresh(),[a,,c]=s.fish,floor=s.level.platforms[0];
 s.boxes[0].x=2500;
 a.x=300;a.y=floor.y-a.height;
 c.x=300+a.width;c.y=floor.y-c.height;
 s.selected=0;
 const c0=c.x;tick(s,60,{axis:1});
 assert.equal(c.x,c0);assert.ok(a.x+a.width<=c.x+0.001);
});
test('carried weight cuts shove speed and shove ability',()=>{
 const floor=fresh().level.platforms[0];
 // C alone shoves B: 180 * 2/3 * 0.25s = 30 px.
 const s=fresh(),[a,b,c]=s.fish;
 s.boxes[0].x=2500;
 c.x=300;c.y=floor.y-c.height;b.x=300+c.width;b.y=floor.y-b.height;a.x=100;a.y=floor.y-a.height;
 s.selected=2;const b0=b.x;tick(s,30,{axis:1});
 assert.ok(Math.abs(b.x-b0-30)<0.001,`C+0 moved ${b.x-b0}`);
 // C carrying A is slower and shoves less far.
 const t=fresh(),[ta,tb,tc]=t.fish;
 t.boxes[0].x=2500;
 tc.x=300;tc.y=floor.y-tc.height;ta.x=310;ta.y=tc.y-ta.height;tb.x=300+tc.width;tb.y=floor.y-tb.height;
 t.selected=2;tick(t,1);const tb0=tb.x;tick(t,30,{axis:1});
 assert.ok(tb.x-tb0>0 && tb.x-tb0<30,`loaded C moved ${tb.x-tb0}`);
 assert.equal(overlaps(ta,tb),false);
 // B carrying A cannot shove C.
 const u=fresh(),[ua,ub,uc]=u.fish;
 u.boxes[0].x=2500;
 ub.x=300;ub.y=floor.y-ub.height;ua.x=310;ua.y=ub.y-ua.height;uc.x=300+ub.width;uc.y=floor.y-uc.height;
 u.selected=1;tick(u,1);const uc0=uc.x;tick(u,60,{axis:1});
 assert.equal(uc.x,uc0);assert.equal(overlaps(ua,uc),false);
});
test('jump height drops sharply when carrying a heavier rider',()=>{
 const floor=fresh().level.platforms[0];
 const apexOf=setup=>{
  const s=fresh();s.boxes[0].x=2500;setup(s);tick(s,1);
  const f=s.fish[s.selected],start=f.y;
  step(s,{jump:true},1/120);let apex=f.y;
  for(let i=0;i<200;i++){step(s,{},1/120);apex=Math.min(apex,f.y);}
  return start-apex;
 };
 // Unloaded B: 600^2 / (2*1500) = 120 px.
 const free=apexOf(s=>{s.selected=1;const b=s.fish[1];b.x=300;b.y=floor.y-b.height;});
 assert.ok(free>115 && free<125,`free apex ${free}`);
 // B carrying A: 400^2 / 3000 = 53.3 px.
 const loaded=apexOf(s=>{s.selected=1;const [a,b]=s.fish;b.x=300;b.y=floor.y-b.height;a.x=310;a.y=b.y-a.height;});
 assert.ok(loaded>50 && loaded<57,`B+A apex ${loaded}`);
 // A carrying C (four times heavier): 120^2 / 3000 = 4.8 px, almost no lift.
 const crushed=apexOf(s=>{s.selected=0;const [a,,c]=s.fish;a.x=300;a.y=floor.y-a.height;c.x=a.x;c.y=a.y-c.height;});
 assert.ok(crushed>0 && crushed<10,`A+C apex ${crushed}`);
});
test('deployment packages exactly one engine and app for every level',()=>{
 const dir=mkdtempSync(join(tmpdir(),'sendhome-shared-'));
 const output=join(dir,'site');const result=spawnSync('python3',['scripts/build_site.py',output],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 const files=readdirSync(join(output,'game'));assert.equal(files.filter(f=>/^engine\..*\.mjs$/.test(f)).length,1);assert.equal(files.filter(f=>/^app\..*\.mjs$/.test(f)).length,1);
 assert.deepEqual(readdirSync(join(output,'level-1')),['index.html']);assert.deepEqual(readdirSync(join(output,'game-whitebox')),['index.html']);
 const html=readFileSync(join(output,'game/index.html'),'utf8');assert.match(html,/app\.[0-9a-f]+\.mjs/);
 const app=readFileSync(join(output,'game',files.find(f=>f.startsWith('app.'))),'utf8');assert.match(app,/engine\.[0-9a-f]+\.mjs/);
 const art=readdirSync(join(output,'game','art'));
 assert.equal(art.filter(f=>/^fish_[ABC]_(idle|run|jump)\.png$/.test(f)).length,9);
 assert.deepEqual(art.filter(f=>/^bg_/.test(f)).sort(),['bg_far.png','bg_mid.png','bg_near.png']);
 assert.match(app,/art\/fish_/);
});
