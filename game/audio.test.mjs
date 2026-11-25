import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createState,step} from './engine.mjs';
import {GameAudio,audioSnapshot,soundEvents} from './audio.mjs';
const fresh=()=>createState(JSON.parse(readFileSync(new URL('../levels/level-1.json',import.meta.url))));
test('jump and landing play once at actual physics transitions',()=>{
 const s=fresh();let before=audioSnapshot(s);step(s,{jump:true},1/120);assert.deepEqual(soundEvents(before,s),['jump']);
 let lands=0;for(let i=0;i<140;i++){before=audioSnapshot(s);step(s,{},1/120);lands+=soundEvents(before,s).filter(x=>x==='land').length;}
 assert.equal(lands,1);
 assert.deepEqual(soundEvents(audioSnapshot(s),s),[]);
});
test('one-shot effects, completion priority and paused suppression',()=>{
 const s=fresh();s.keys=[{collected:false}];s.plates=[{on:false}];s.doors=[{open:false,broken:false}];
 let before=audioSnapshot(s);s.keys[0].collected=true;s.plates[0].on=true;s.doors[0].open=true;
 assert.deepEqual(soundEvents(before,s),['key','plate','door']);assert.deepEqual(soundEvents(audioSnapshot(s),s),[]);
 before=audioSnapshot(s);s.completed=true;assert.deepEqual(soundEvents(before,s),['complete']);assert.deepEqual(soundEvents(audioSnapshot(s),s),[]);
 before={...before,paused:true};assert.deepEqual(soundEvents(before,s),[]);
});
test('audio remains safe without browser audio or storage APIs',()=>{
 const audio=new GameAudio();assert.doesNotThrow(()=>{audio.unlock();audio.play('jump');audio.silence();audio.toggle();audio.play('complete');});assert.equal(audio.muted,true);
});
