import { TILE, LEVEL, SPECS, createState, step, loadInfo } from './engine.mjs?v=20261119-carry-1';
const canvas=document.getElementById('game'), ctx=canvas.getContext('2d');
let state=createState(), last=0, accumulator=0, jump=false, resetStart=null;
const keys=new Set(), touch={left:false,right:false};
const list=document.getElementById('fish-list');
list.innerHTML=SPECS.map((s,i)=>`<button class="fish" data-fish="${i}" aria-pressed="${i===0}"><span class="swatch" style="background:${s.color}"></span><span>${i+1} · ${s.name}<br><span class="meta">${s.width/TILE}×${s.height/TILE} 格 · 重 ${s.weight} · 速 ${s.speed}</span></span></button>`).join('');
function select(i){state.selected=i;jump=false;}
function reset(){state=createState();keys.clear();touch.left=touch.right=false;jump=false;resetStart=null;accumulator=0;}
list.querySelectorAll('button').forEach(b=>b.onclick=()=>select(Number(b.dataset.fish)));
document.getElementById('reset').onclick=reset;
document.getElementById('pause').onclick=()=>{state.paused=!state.paused;jump=false;};
const controls=['KeyA','KeyD','KeyW','ArrowLeft','ArrowRight','ArrowUp','Space','Tab','Escape','KeyR','Digit1','Digit2','Digit3'];
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
window.addEventListener('blur',()=>{keys.clear();touch.left=touch.right=false;jump=false;resetStart=null;state.paused=true;});
for(const b of document.querySelectorAll('[data-hold]')){
  b.onpointerdown=e=>{e.preventDefault();touch[b.dataset.hold]=true;b.setPointerCapture(e.pointerId);};
  for(const name of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(name,()=>touch[b.dataset.hold]=false);
}
document.getElementById('jump').onpointerdown=e=>{e.preventDefault();if(!state.paused)jump=true;};
function text(s,x,y,size=16,color='#536b70',align='left'){ctx.fillStyle=color;ctx.font=`${size}px system-ui`;ctx.textAlign=align;ctx.fillText(s,x,y);}
function render(){
  ctx.fillStyle='#fcfcf7';ctx.fillRect(0,0,LEVEL.width,LEVEL.height);
  ctx.strokeStyle='#e1e6de';ctx.lineWidth=1;ctx.beginPath();
  for(let x=0;x<=LEVEL.width;x+=TILE){ctx.moveTo(x,0);ctx.lineTo(x,LEVEL.height);}
  for(let y=0;y<=LEVEL.height;y+=TILE){ctx.moveTo(0,y);ctx.lineTo(LEVEL.width,y);}
  ctx.stroke();
  text('LV 1',2*TILE,3*TILE,36,'#365951');text('移动 → 跳跃 → 全员集合',2*TILE,4*TILE,18);
  text('01  起点',2*TILE,13*TILE,16);text('02  跳上第一跳台',12*TILE,11*TILE,16);text('03  再向上跳',19*TILE,10*TILE,16);text('04  一起回家',27*TILE,8*TILE,16);
  for(const p of LEVEL.platforms){ctx.fillStyle='#d4e1d4';ctx.fillRect(p.x,p.y,p.width,p.height);ctx.strokeStyle='#425e57';ctx.lineWidth=2;ctx.strokeRect(p.x,p.y,p.width,p.height);ctx.fillStyle='#749b80';ctx.fillRect(p.x,p.y,p.width,4);}
  text('落下后向左返回台阶，回到起点再试 ←',14*TILE,20.8*TILE,15);
  const g=LEVEL.goal;ctx.fillStyle='#de79591c';ctx.fillRect(g.x,g.y,g.width,g.height);ctx.strokeStyle='#cd6853';ctx.setLineDash([6,5]);ctx.strokeRect(g.x,g.y,g.width,g.height);ctx.setLineDash([]);ctx.fillStyle='#db8363';ctx.fillRect(g.x,g.y+g.height-8,g.width,8);
  text(`CHECK POINT  ${state.fish.filter(f=>f.arrived).length}/3`,g.x+g.width/2,g.y-12,14,'#ad563e','center');
  for(const f of state.fish){
    ctx.fillStyle=f.color;ctx.fillRect(f.x,f.y,f.width,f.height);ctx.lineWidth=f.id===state.selected?3:1.5;ctx.strokeStyle=f.id===state.selected?'#233f47':'#6c8070';ctx.strokeRect(f.x,f.y,f.width,f.height);
    ctx.fillStyle='white';ctx.fillRect(f.x+f.width-22,f.y+10,7,8);ctx.fillRect(f.x+f.width-11,f.y+10,7,8);
    ctx.fillStyle='#29474a';ctx.fillRect(f.x+f.width-19,f.y+12,3,4);ctx.fillRect(f.x+f.width-8,f.y+12,3,4);
    text(f.name+(f.arrived?' ✓':''),f.x+f.width/2,f.y-12,14,'#35524c','center');
    if(f.id===state.selected){text('▼',f.x+f.width/2,f.y-34,14,'#287d72','center');}
  }
  if(state.paused||state.completed){ctx.fillStyle='#183c43cc';ctx.fillRect(0,0,LEVEL.width,LEVEL.height);text(state.completed?'关卡 1 完成':'已暂停',LEVEL.width/2,LEVEL.height/2-15,36,'white','center');text(state.completed?`三位伙伴已集合 · 用时 ${state.elapsed.toFixed(1)} 秒`:'按 Esc 或点击继续',LEVEL.width/2,LEVEL.height/2+32,20,'white','center');}
  document.getElementById('count').textContent=`${state.fish.filter(f=>f.arrived).length} / 3`;
  document.getElementById('time').textContent=`${state.elapsed.toFixed(1)} s`;
  document.getElementById('support').textContent=state.fish[state.selected].support;
  const carried=loadInfo(state,state.fish[state.selected]);
  document.getElementById('load').textContent=`${carried.load}`;
  document.getElementById('speed').textContent=`${Math.round(carried.multiplier*100)}%`;
  document.getElementById('levels').textContent=`${state.completedLevels} / 5`;
  const message=document.getElementById('message');if(message.textContent!==state.message)message.textContent=state.message;
  document.getElementById('pause').textContent=state.paused?'继续':'暂停';
  list.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===state.selected)));
}
function frame(t){
  const dt=last?Math.min((t-last)/1000,0.1):0;last=t;
  if(resetStart!==null && t-resetStart>=700)reset();
  accumulator+=dt;
  while(accumulator>=1/120){step(state,{axis:Number(keys.has('KeyD')||keys.has('ArrowRight')||touch.right)-Number(keys.has('KeyA')||keys.has('ArrowLeft')||touch.left),jump},1/120);jump=false;accumulator-=1/120;}
  render();requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
