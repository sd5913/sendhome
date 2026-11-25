// Original procedural effects; no recordings, external libraries or network audio.
const effects={
  jump:[[230,490,.13,'sine']], land:[[140,65,.09,'triangle']],
  switch:[[440,620,.07,'sine']], key:[[660,880,.1,'sine'],[880,1320,.16,'sine',.1]],
  plate:[[190,300,.12,'triangle']], door:[[160,440,.18,'triangle']],
  break:[[180,45,.2,'sawtooth']], fall:[[300,90,.25,'sine']],
  complete:[[523,523,.14,'sine'],[659,659,.14,'sine',.14],[784,784,.14,'sine',.28],[1047,1047,.35,'sine',.42]]
};
export function soundEvents(before,after){
  if(!before||before===after||before.paused||before.completed)return [];
  const events=[];
  if(after.completed)return ['complete'];
  if(after.falls>before.falls)events.push('fall');
  for(let i=0;i<after.fish.length;i++){
    const a=after.fish[i],b=before.fish[i];
    if(b.grounded&&!a.grounded&&a.vy<0)events.push('jump');
    if(!b.grounded&&a.grounded&&b.vy>80)events.push('land');
  }
  if(after.keys.some((k,i)=>k.collected&&!before.keys[i]?.collected))events.push('key');
  if(after.plates.some((p,i)=>p.on&&!before.plates[i]?.on))events.push('plate');
  if(after.doors.some((d,i)=>d.broken&&!before.doors[i]?.broken))events.push('break');
  else if(after.doors.some((d,i)=>d.open&&!before.doors[i]?.open))events.push('door');
  return [...new Set(events)];
}
export function audioSnapshot(s){return {fish:s.fish.map(f=>({grounded:f.grounded,vy:f.vy})),keys:s.keys.map(k=>({collected:k.collected})),plates:s.plates.map(p=>({on:p.on})),doors:s.doors.map(d=>({open:d.open,broken:d.broken})),falls:s.falls,paused:s.paused,completed:s.completed};}
export class GameAudio{
  constructor(){this.context=null;this.master=null;this.voices=0;this.muted=false;try{this.muted=localStorage.getItem('sendhome-muted')==='true';}catch{}}
  unlock(){
    try{
      const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;
      if(!Audio)return;
      if(!this.context){this.context=new Audio();this.master=this.context.createGain();this.master.connect(this.context.destination);}
      this.master.gain.value=this.muted?0:.16;
      if(this.context.state==='suspended')this.context.resume().catch(()=>{});
    }catch{/* Unsupported or blocked audio must never stop gameplay. */}
  }
  toggle(){this.muted=!this.muted;this.unlock();try{localStorage.setItem('sendhome-muted',String(this.muted));}catch{}return this.muted;}
  silence(){if(this.master)this.master.gain.value=0;}
  play(name){
    if(this.muted||!this.context||this.context.state!=='running'||!effects[name])return;
    for(const [start,end,duration,type,delay=0] of effects[name]){
      if(this.voices>=24)break;
      const ctx=this.context,t=ctx.currentTime+delay,osc=ctx.createOscillator(),gain=ctx.createGain();
      osc.type=type;osc.frequency.setValueAtTime(start,t);osc.frequency.exponentialRampToValueAtTime(end,t+duration);
      gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.3,t+.008);gain.gain.exponentialRampToValueAtTime(.001,t+duration);
      osc.connect(gain);gain.connect(this.master);this.voices++;
      osc.onended=()=>{osc.disconnect();gain.disconnect();this.voices--;};osc.start(t);osc.stop(t+duration+.015);
    }
  }
}
