import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createState,step,loadInfo,overlaps,validateLevel,PHYSICS} from './engine.mjs';
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
  const floor=s.level.platforms[0];b.x=250;b.y=floor.y-b.height;a.x=260;a.y=b.y-a.height;c.x=72;c.y=floor.y-c.height;
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
test('invalid door links are rejected at level load',()=>{
 const l=read('mechanics-test');l.doors[0].plateId='missing';assert.throws(()=>createState(l),/Missing plate/);
});
test('deployment packages exactly one engine and app for every level',()=>{
 const dir=mkdtempSync(join(tmpdir(),'sendhome-shared-'));
 const output=join(dir,'site');const result=spawnSync('python3',['scripts/build_site.py',output],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 const files=readdirSync(join(output,'game'));assert.equal(files.filter(f=>/^engine\..*\.mjs$/.test(f)).length,1);assert.equal(files.filter(f=>/^app\..*\.mjs$/.test(f)).length,1);
 assert.deepEqual(readdirSync(join(output,'level-1')),['index.html']);assert.deepEqual(readdirSync(join(output,'game-whitebox')),['index.html']);
 const html=readFileSync(join(output,'game/index.html'),'utf8');assert.match(html,/app\.[0-9a-f]+\.mjs/);
 const app=readFileSync(join(output,'game',files.find(f=>f.startsWith('app.'))),'utf8');assert.match(app,/engine\.[0-9a-f]+\.mjs/);
});
