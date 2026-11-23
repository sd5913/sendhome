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
function render(){
  ctx.fillStyle='#fcfcf7';ctx.fillRect(0,0,canvas.width,canvas.height);
  const active=state.fish[state.selected];
  cameraX=Math.max(0,Math.min(LEVEL.width-canvas.width,active.x+active.width/2-canvas.width*0.42));
  cameraY=Math.max(0,Math.min(LEVEL.height-canvas.height,active.y+active.height/2-canvas.height*0.5));
  ctx.save();ctx.translate(-cameraX,-cameraY);
  ctx.strokeStyle='#e1e6de';ctx.lineWidth=1;ctx.beginPath();
  for(let x=0;x<=LEVEL.width;x+=TILE){ctx.moveTo(x,0);ctx.lineTo(x,LEVEL.height);}
  for(let y=0;y<=LEVEL.height;y+=TILE){ctx.moveTo(0,y);ctx.lineTo(LEVEL.width,y);}
  ctx.stroke();
  for(const label of LEVEL.labels||[])text(label.text,label.x,label.y,16);
  for(const p of LEVEL.platforms){ctx.fillStyle='#d4e1d4';ctx.fillRect(p.x,p.y,p.width,p.height);ctx.strokeStyle='#425e57';ctx.lineWidth=2;ctx.strokeRect(p.x,p.y,p.width,p.height);ctx.fillStyle='#749b80';ctx.fillRect(p.x,p.y,p.width,4);}
  for(const p of state.plates){ctx.fillStyle=p.on?'#62a57b':'#e4b24d';ctx.fillRect(p.x,p.y,p.width,p.height);text(`${p.weight} / ${p.threshold}`,p.x,p.y-8,13);}
  for(const b of state.boxes){ctx.fillStyle='#bd9b71';ctx.fillRect(b.x,b.y,b.width,b.height);ctx.strokeStyle='#765c3a';ctx.strokeRect(b.x,b.y,b.width,b.height);text('箱子',b.x,b.y-8,13);}
  for(const d of state.doors){if(d.open)continue;ctx.fillStyle=d.type==='break'?'#bf7560':'#6c8b93';ctx.fillRect(d.x,d.y,d.width,d.height);text(d.type==='plate'?'压板门':d.type==='key'?'钥匙门':'撞击门',d.x,d.y-12,13);}
  for(const k of state.keys){if(k.collected)continue;ctx.fillStyle='#e8b92f';ctx.fillRect(k.x,k.y,k.width,k.height);text('钥匙',k.x,k.y-8,13);}
  const g=LEVEL.goal;ctx.fillStyle='#de79591c';ctx.fillRect(g.x,g.y,g.width,g.height);ctx.strokeStyle='#cd6853';ctx.setLineDash([6,5]);ctx.strokeRect(g.x,g.y,g.width,g.height);ctx.setLineDash([]);ctx.fillStyle='#db8363';ctx.fillRect(g.x,g.y+g.height-8,g.width,8);
  text(`CHECK POINT  ${state.fish.filter(f=>f.arrived).length}/3`,g.x+g.width/2,g.y-12,14,'#ad563e','center');
  for(const f of state.fish){
    ctx.fillStyle=f.color;ctx.fillRect(f.x,f.y,f.width,f.height);ctx.lineWidth=f.id===state.selected?3:1.5;ctx.strokeStyle=f.id===state.selected?'#233f47':'#6c8070';ctx.strokeRect(f.x,f.y,f.width,f.height);
    ctx.fillStyle='white';ctx.fillRect(f.x+f.width-22,f.y+10,7,8);ctx.fillRect(f.x+f.width-11,f.y+10,7,8);
    ctx.fillStyle='#29474a';ctx.fillRect(f.x+f.width-19,f.y+12,3,4);ctx.fillRect(f.x+f.width-8,f.y+12,3,4);
    text(f.name+(f.arrived?' ✓':''),f.x+f.width/2,f.y-12,14,'#35524c','center');
    if(f.id===state.selected){text('▼',f.x+f.width/2,f.y-34,14,'#287d72','center');}
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
