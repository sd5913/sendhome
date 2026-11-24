import { TILE, SPECS, createState, step, loadInfo, fishAt } from './engine.mjs?v=shared-1';
async function start() {
  const catalogResponse=await fetch('../levels/index.json',{cache:'no-cache'});
  if(!catalogResponse.ok)throw Error('无法读取关卡目录');
  const catalog=await catalogResponse.json();
  const id=new URLSearchParams(location.search).get('level')||catalog[0].id;
  if(!catalog.some(entry=>entry.id===id))throw Error('找不到这个关卡');
  const response=await fetch(`../levels/${encodeURIComponent(id)}.json`,{cache:'no-cache'});
  if(!response.ok)throw Error('无法读取关卡数据');
  const LEVEL=await response.json();
  createState(LEVEL); // Validate before mounting the shared UI.
  // Art is optional: if a sprite cannot load the game keeps the whitebox look.
  const art={fish:{},bg:{},door:null};
  const loadImage=src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('无法读取美术资源 '+src));img.src=src;});
  try{
    const [far,mid,near,door]=await Promise.all(['far','mid','near','door_open'].map(name=>loadImage(`art/${name==='door_open'?'door_open':'bg_'+name}.png`)));
    art.bg={far,mid,near};art.door=door;
    for(const id of ['A','B','C'])for(const action of ['idle','run','jump'])art.fish[`${id}/${action}`]=await loadImage(`art/fish_${id}_${action}.png`);
  }catch(error){console.warn(error.message,'— 使用白模绘制');}
  document.title='送小鱼回家 · '+LEVEL.title;
  document.getElementById('title').textContent=LEVEL.title;
  document.getElementById('subtitle').textContent=LEVEL.subtitle;
  document.getElementById('level-help').textContent=LEVEL.help;
  const picker=document.getElementById('level-picker');
  for(const entry of catalog){const option=document.createElement('option');option.value=entry.id;option.textContent=entry.title;option.selected=entry.id===id;picker.append(option);}
  picker.onchange=()=>{location.search='?level='+encodeURIComponent(picker.value);};
const canvas=document.getElementById('game'), ctx=canvas.getContext('2d');
canvas.width=Math.min(1152,LEVEL.width);canvas.height=Math.min(792,LEVEL.height);
let state=createState(LEVEL), last=0, accumulator=0, jump=false, resetStart=null;
let cameraX=0, cameraY=0;
const keys=new Set(), touch={left:false,right:false,dash:false};
const list=document.getElementById('fish-list');
list.innerHTML=SPECS.map((s,i)=>`<button class="fish" data-fish="${i}" aria-pressed="${i===0}"><span class="swatch" style="background:${s.color}"></span><span>${i+1} · ${s.name}<br><span class="meta">${s.width/TILE}×${s.height/TILE} 格 · 重 ${s.weight} · 速 ${s.speed}</span></span></button>`).join('');
function select(i){state.selected=i;jump=false;}
function reset(){state=createState(LEVEL);keys.clear();touch.left=touch.right=touch.dash=false;jump=false;resetStart=null;accumulator=0;}
list.querySelectorAll('button').forEach(b=>b.onclick=()=>select(Number(b.dataset.fish)));
document.getElementById('reset').onclick=reset;
document.getElementById('pause').onclick=()=>{state.paused=!state.paused;jump=false;};
const controls=['KeyA','KeyD','KeyW','ArrowLeft','ArrowRight','ArrowUp','Space','Tab','Escape','KeyR','Digit1','Digit2','Digit3','ShiftLeft','ShiftRight'];
window.addEventListener('keydown',e=>{
  if(!controls.includes(e.code))return;
  // Keep native activation and focus navigation when an HTML button has focus.
  if(e.target.closest?.('button') && ['Space','Tab'].includes(e.code))return;
  e.preventDefault();const fresh=!keys.has(e.code);keys.add(e.code);
  if(!fresh)return;
  if(['KeyW','ArrowUp','Space'].includes(e.code) && !state.paused)jump=true;
  if(e.code.startsWith('Digit'))select(Number(e.code.slice(-1))-1);
  if(e.code==='Tab')select((state.selected+1)%3);
  if(e.code==='Escape'){state.paused=!state.paused;jump=false;}
  if(e.code==='KeyR')resetStart=performance.now();
});
window.addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='KeyR')resetStart=null;});
window.addEventListener('blur',()=>{keys.clear();touch.left=touch.right=touch.dash=false;jump=false;resetStart=null;state.paused=true;});
for(const b of document.querySelectorAll('[data-hold]')){
  b.onpointerdown=e=>{e.preventDefault();touch[b.dataset.hold]=true;b.setPointerCapture(e.pointerId);};
  for(const name of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(name,()=>touch[b.dataset.hold]=false);
}
document.getElementById('jump').onpointerdown=e=>{e.preventDefault();if(!state.paused)jump=true;};
// Click a fish on the canvas to take control of it (1/2/3 and Tab still work).
canvas.addEventListener('pointerdown',e=>{
  if(e.button!==undefined && e.button!==0)return;
  const rect=canvas.getBoundingClientRect();
  if(!rect.width||!rect.height)return;
  const x=(e.clientX-rect.left)*canvas.width/rect.width+cameraX;
  const y=(e.clientY-rect.top)*canvas.height/rect.height+cameraY;
  const id=fishAt(state.fish,x,y);
  if(id<0)return;
  e.preventDefault();select(id);canvas.focus({preventScroll:true});
});
function text(s,x,y,size=16,color='#536b70',align='left'){ctx.fillStyle=color;ctx.font=`${size}px system-ui`;ctx.textAlign=align;ctx.fillText(s,x,y);}
  function drawBand(img,parallax,y,height){
    if(!img)return;
    const width=height*img.width/img.height;
    for(let x=-((cameraX*parallax)%width);x<canvas.width;x+=width)ctx.drawImage(img,x,y,width,height);
  }
function render(){
  const active=state.fish[state.selected];
  cameraX=Math.max(0,Math.min(LEVEL.width-canvas.width,active.x+active.width/2-canvas.width*0.42));
  cameraY=Math.max(0,Math.min(LEVEL.height-canvas.height,active.y+active.height/2-canvas.height*0.5));
  const sky=ctx.createLinearGradient(0,0,0,canvas.height);
  sky.addColorStop(0,'#d9f4fb');sky.addColorStop(0.55,'#a3def1');sky.addColorStop(1,'#74c3e2');
  ctx.fillStyle=sky;ctx.fillRect(0,0,canvas.width,canvas.height);
  drawBand(art.bg.far,0.15,canvas.height*0.03,canvas.height*0.17);
  drawBand(art.bg.mid,0.35,canvas.height*0.21,canvas.height*0.19);
  drawBand(art.bg.near,0.6,canvas.height*0.79,canvas.height*0.21);
  ctx.save();ctx.translate(-cameraX,-cameraY);
  for(const label of LEVEL.labels||[])text(label.text,label.x,label.y,16,'#2d5a6b');
  for(const p of LEVEL.platforms){
    ctx.fillStyle='#4d6f9f';
    if(p.height>60){const rock=ctx.createLinearGradient(0,p.y,0,p.y+p.height);rock.addColorStop(0,'#4d6f9f');rock.addColorStop(1,'#2b4468');ctx.fillStyle=rock;}
    ctx.beginPath();ctx.roundRect(p.x,p.y,p.width,p.height,6);ctx.fill();
    ctx.fillStyle='#7cc04a';ctx.beginPath();ctx.roundRect(p.x,p.y,p.width,Math.min(9,p.height),5);ctx.fill();
    ctx.strokeStyle='#2f4a6f';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(p.x,p.y,p.width,p.height,6);ctx.stroke();
  }
  for(const p of state.plates){ctx.fillStyle=p.on?'#62a57b':'#e4b24d';ctx.fillRect(p.x,p.y,p.width,p.height);text(`${p.weight} / ${p.threshold}`,p.x,p.y-8,13,'#2d5a6b');}
  for(const b of state.boxes){ctx.fillStyle='#bd9b71';ctx.fillRect(b.x,b.y,b.width,b.height);ctx.strokeStyle='#765c3a';ctx.strokeRect(b.x,b.y,b.width,b.height);text('箱子',b.x,b.y-8,13,'#2d5a6b');}
  for(const d of state.doors){if(d.open)continue;ctx.fillStyle=d.type==='break'?'#bf7560':'#6c8b93';ctx.fillRect(d.x,d.y,d.width,d.height);text(d.type==='plate'?'压板门':d.type==='key'?'钥匙门':'撞击门',d.x,d.y-12,13,'#2d5a6b');}
  for(const k of state.keys){if(k.collected)continue;ctx.fillStyle='#e8b92f';ctx.fillRect(k.x,k.y,k.width,k.height);text('钥匙',k.x,k.y-8,13,'#2d5a6b');}
  const g=LEVEL.goal;
  ctx.save();ctx.globalAlpha=0.4;ctx.strokeStyle='#cd6853';ctx.setLineDash([6,5]);ctx.strokeRect(g.x,g.y,g.width,g.height);ctx.restore();
  if(art.door){const dh=g.height*1.1,dw=dh*art.door.width/art.door.height;ctx.drawImage(art.door,g.x+(g.width-dw)/2,g.y+g.height-dh,dw,dh);}
  else{ctx.fillStyle='#db8363';ctx.fillRect(g.x,g.y+g.height-8,g.width,8);}
  text(`集合点 ${state.fish.filter(f=>f.arrived).length}/3`,g.x+g.width/2,g.y-12,14,'#1f4c5c','center');
  for(const f of state.fish){
    if(Math.abs(f.vx)>1)f.facing=f.vx<0?-1:1;
    const action=f.grounded?(Math.abs(f.vx)>1?'run':'idle'):'jump';
    const strip=art.fish[`${'ABC'[f.id]}/${action}`];
    const cx=f.x+f.width/2;
    ctx.save();ctx.globalAlpha=0.16;ctx.fillStyle='#123a4a';ctx.beginPath();ctx.ellipse(cx,f.y+f.height-2,f.width*0.46,5,0,0,Math.PI*2);ctx.fill();ctx.restore();
    let spriteTop=f.y;
    if(strip){
      const fw=strip.width/5,fh=strip.height;
      const frame=action==='jump'?(f.vy<-250?0:f.vy<0?1:f.vy<250?2:3):Math.floor(state.elapsed*(action==='run'?12:5)+f.id*1.7)%5;
      let dh=f.height*1.2,dw=dh*fw/fh;
      if(f.id===1){dw=f.width*1.02;dh=dw*fh/fw;} // B's art is wide and squat
      else if(dw>f.width*1.3){dw=f.width*1.3;dh=dw*fh/fw;}
      spriteTop=f.y+f.height-dh;
      ctx.save();ctx.translate(cx,0);if(f.facing<0)ctx.scale(-1,1);
      ctx.drawImage(strip,frame*fw,0,fw,fh,-dw/2,spriteTop,dw,dh);
      ctx.restore();
    }else{
      ctx.fillStyle=f.color;ctx.fillRect(f.x,f.y,f.width,f.height);ctx.strokeStyle='#6c8070';ctx.lineWidth=1.5;ctx.strokeRect(f.x,f.y,f.width,f.height);
    }
    if(f.id===state.selected){ctx.strokeStyle='#ffd75e';ctx.lineWidth=3;ctx.beginPath();ctx.roundRect(f.x-4,spriteTop-4,f.width+8,f.height+8,7);ctx.stroke();text('▼',cx,spriteTop-10,14,'#8a6100','center');}
    text(f.name+(f.arrived?' ✓':''),cx,spriteTop-26,13,'#123a4a','center');
  }
  ctx.restore();
  if(state.paused||state.completed){ctx.fillStyle='#183c43cc';ctx.fillRect(0,0,canvas.width,canvas.height);text(state.completed?'全员集合，关卡完成':'已暂停',canvas.width/2,canvas.height/2-15,36,'white','center');text(state.completed?`三位伙伴已集合 · 用时 ${state.elapsed.toFixed(1)} 秒`:'按 Esc 或点击继续',canvas.width/2,canvas.height/2+32,20,'white','center');}
  document.getElementById('count').textContent=`${state.fish.filter(f=>f.arrived).length} / 3`;
  document.getElementById('time').textContent=`${state.elapsed.toFixed(1)} s`;
  document.getElementById('support').textContent=state.fish[state.selected].support;
  const carried=loadInfo(state,state.fish[state.selected]);
  document.getElementById('load').textContent=`${carried.load}`;
  document.getElementById('speed').textContent=`${Math.round(carried.multiplier*100)}%`;
  document.getElementById('levels').textContent=`${state.completedLevels}`;
  const message=document.getElementById('message');if(message.textContent!==state.message)message.textContent=state.message;
  document.getElementById('pause').textContent=state.paused?'继续':'暂停';
  list.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===state.selected)));
}
function frame(t){
  const dt=last?Math.min((t-last)/1000,0.1):0;last=t;
  if(resetStart!==null && t-resetStart>=700)reset();
  accumulator+=dt;
  while(accumulator>=1/120){step(state,{axis:Number(keys.has('KeyD')||keys.has('ArrowRight')||touch.right)-Number(keys.has('KeyA')||keys.has('ArrowLeft')||touch.left),jump,dash:keys.has('ShiftLeft')||keys.has('ShiftRight')||touch.dash},1/120);jump=false;accumulator-=1/120;}
  render();requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

}
start().catch(error=>{document.getElementById('message').textContent='加载失败：'+error.message;});
