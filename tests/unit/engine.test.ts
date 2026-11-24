import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Track } from '../../app/src/api/types';
import { AudioEngine } from '../../app/src/engine/controller';
import type { ListeningEvent } from '../../app/src/engine/listening';
import type { PlayerSnapshot } from '../../shared/playback-input';

class FakeAudio extends EventTarget {
 paused=true;ended=false;seeking=false;readyState=0;duration=NaN;currentTime=0;playbackRate=1;volume=1;preload='';error:{code:number}|null=null;
 buffered={length:0,end:()=>0};calls:string[]=[];pending:Promise<void>|null=null;private source='';
 get src(){return this.source;}set src(value:string){this.source=value;this.calls.push('src:'+value);this.currentTime=0;this.readyState=0;this.duration=NaN;this.ended=false;this.error=null;}
 play(){this.calls.push('play');this.paused=false;this.ended=false;this.dispatchEvent(new Event('play'));if(!this.pending)this.dispatchEvent(new Event('playing'));return this.pending||Promise.resolve();}
 pause(){const was=this.paused;this.paused=true;if(!was)this.dispatchEvent(new Event('pause'));}
 removeAttribute(){this.source='';}load(){this.calls.push('load');this.readyState=0;this.duration=NaN;this.currentTime=0;}
 metadata(seconds=10){this.duration=seconds;this.readyState=1;this.dispatchEvent(new Event('loadedmetadata'));}
 progress(seconds:number){this.currentTime=seconds;this.dispatchEvent(new Event('timeupdate'));}
 end(){this.currentTime=this.duration;this.ended=true;this.paused=true;this.dispatchEvent(new Event('ended'));}
 fail(code:number){this.error={code};this.dispatchEvent(new Event('error'));}
}
const track=(n:number)=>({id:`01J000000000000000000000${String(n).padStart(2,'0')}`,title:'Track '+n,artist_name:'Artist '+n,album_title:'Album',album_id:'album',duration_ms:10000,deleted:0} as Track);
function fixture(){
 vi.useFakeTimers();vi.setSystemTime(1700000000000);const audio=new FakeAudio(),plays:ListeningEvent[]=[],saved:PlayerSnapshot[]=[],order:string[]=[];
 let read=async():Promise<PlayerSnapshot|null>=>null;
 const engine=new AudioEngine({audio:audio as unknown as HTMLAudioElement,url:t=>'/media/'+t.id,id:()=>track(9).id,now:Date.now,clock:Date.now,changed:()=>{},
 media:{prepare:()=>{},track:()=>order.push('metadata'),state:()=>{},position:()=>{}},
 persistence:{configure:()=>{},read:()=>read(),write:s=>{saved.push(s);order.push('persist');},flush:()=>{},dispose:()=>{}},
 listening:{configure:()=>{},record:p=>{plays.push(p);order.push('record');},recent:async()=>[],flush:()=>{},dispose:()=>{}}});
 engine.setAutoplay(false);return{engine,audio,plays,saved,order,setRead:(r:typeof read)=>{read=r;}};
}
const engines:AudioEngine[]=[];afterEach(()=>{for(const e of engines.splice(0))e.dispose();vi.useRealTimers();});
function setup(){const f=fixture();engines.push(f.engine);return f;}

describe('the permanent audio engine',()=>{
 it.each([false,true])('prepares guest autoplay before the first song ends (after sign-out: %s)',async signedOut=>{
  const{engine,audio}=setup();if(signedOut)engine.configure(null);engine.setCatalog([track(1),track(2)]);engine.setAutoplay(true);engine.start([track(1)]);await Promise.resolve();
  expect(engine.queue.upcoming.map(entry=>entry.track.id)).toEqual([track(2).id]);audio.metadata();audio.calls=[];audio.end();expect(audio.calls.slice(0,2)).toEqual(['src:/media/'+track(2).id,'play']);expect(engine.state).toBe('playing');
 });
 it('prepares a signed-in next song even if the recommendation worker never answers',async()=>{
  const{engine,audio}=setup();engine.configure('owner');engine.setCatalog([track(1),track(2)]);engine.setRecommendationSource(()=>new Promise(()=>{}));engine.setAutoplay(true);engine.start([track(1)]);await Promise.resolve();await Promise.resolve();
  expect(engine.queue.upcoming.map(entry=>entry.track.id)).toEqual([track(2).id]);audio.metadata();audio.end();expect(engine.current?.id).toBe(track(2).id);expect(engine.state).toBe('playing');
 });
 it('assigns the resolved source and plays synchronously before logging an ended track',async()=>{
  const{engine,audio,plays,order}=setup();engine.start([track(1),track(2)]);audio.metadata();for(let i=1;i<=9;i++){vi.advanceTimersByTime(1000);audio.progress(i);}audio.calls=[];order.length=0;audio.end();
  expect(audio.calls.slice(0,2)).toEqual(['src:/media/'+track(2).id,'play']);expect(engine.current?.id).toBe(track(2).id);expect(plays).toHaveLength(0);await Promise.resolve();expect(plays[0].completed).toBe(true);expect(order.indexOf('record')).toBeGreaterThan(order.indexOf('metadata'));
 });
 it('restores paused without loading media and retains the saved seek across idle persistence',async()=>{
  const{engine,audio,setRead,saved}=setup();engine.setCatalog([track(1)]);setRead(async()=>({queue:[track(1).id],index:0,positionMs:4500,shuffle:false,repeat:'off',autoplay:false,updatedAt:1}));await engine.restore();
  expect(audio.calls).toEqual(['src:/media/'+track(1).id]);expect(audio.preload).toBe('none');vi.advanceTimersByTime(10000);expect(engine.positionMs).toBe(4500);expect(saved.at(-1)?.positionMs).toBe(4500);
  engine.resume();audio.metadata();expect(audio.currentTime).toBe(4.5);expect(engine.state).toBe('playing');
 });
 it('ignores a slow restore after the listener has already chosen music',async()=>{
  const{engine,setRead}=setup();engine.setCatalog([track(1),track(2)]);let resolve!:(v:PlayerSnapshot)=>void;setRead(()=>new Promise(r=>{resolve=r;}));const restoring=engine.restore();engine.start([track(2)]);resolve({queue:[track(1).id],index:0,positionMs:7000,shuffle:false,repeat:'off',autoplay:false,updatedAt:1});await restoring;expect(engine.current?.id).toBe(track(2).id);
 });
 it('stops an end-of-track sleep before repeat-one or queue advance',()=>{
  const{engine,audio}=setup();engine.start([track(1),track(2)]);audio.metadata();engine.setRepeat('one');engine.sleep('endOfTrack');audio.calls=[];audio.end();expect(audio.calls).toEqual([]);expect(engine.current?.id).toBe(track(1).id);expect(engine.state).toBe('paused');expect(engine.sleepTrack).toBe(null);
 });
 it('uses exponential recovery without resetting the budget on a transient playing event',()=>{
  const{engine,audio}=setup();engine.start([track(1)]);audio.metadata();audio.progress(3);audio.calls=[];
  for(const delay of [1000,2000,4000,8000]){audio.fail(2);vi.advanceTimersByTime(delay-1);const before=audio.calls.length;vi.advanceTimersByTime(1);expect(audio.calls.length).toBe(before+3);audio.metadata();expect(audio.currentTime).toBe(3);}
  audio.fail(2);vi.advanceTimersByTime(10000);expect(audio.calls.filter(c=>c==='play')).toHaveLength(4);expect(engine.state).toBe('error');engine.online();expect(audio.calls.filter(c=>c==='play')).toHaveLength(5);
 });
 it('does not resume an external pause when the network comes online',()=>{
  const{engine,audio}=setup();engine.start([track(1)]);audio.pause();expect(engine.interrupted).toBe(true);audio.calls=[];engine.online();vi.advanceTimersByTime(30000);expect(audio.calls).toEqual([]);expect(engine.state).toBe('paused');
 });
 it('reopens an interrupted stream immediately at its saved position on explicit Play',()=>{
  const{engine,audio}=setup();engine.start([track(1)]);audio.metadata();audio.progress(4.5);audio.pause();audio.calls=[];
  engine.resume();expect(audio.calls).toEqual(['src:/media/'+track(1).id,'load','play']);audio.metadata();expect(audio.currentTime).toBe(4.5);expect(engine.state).toBe('playing');
 });
 it('retains the seek through repeated failures before metadata loads',()=>{
  const{engine,audio}=setup();engine.start([track(1)]);audio.metadata();audio.progress(4.5);audio.pending=new Promise(()=>{});
  audio.fail(2);vi.advanceTimersByTime(1000);audio.fail(2);vi.advanceTimersByTime(2000);audio.pending=null;audio.metadata();expect(audio.currentTime).toBe(4.5);
 });
 it('bounds a hanging play request even when the browser emits no waiting event',()=>{
  const{engine,audio}=setup();audio.pending=new Promise(()=>{});engine.start([track(1)]);audio.calls=[];vi.advanceTimersByTime(9000);
  expect(audio.calls).toContain('load');expect(audio.calls).toContain('play');engine.pause();audio.calls=[];vi.advanceTimersByTime(60000);expect(audio.calls).toEqual([]);
 });
 it('detects a silent transport stall after a playing event',()=>{
  const{engine,audio}=setup();engine.start([track(1)]);audio.metadata();audio.progress(2);audio.calls=[];vi.advanceTimersByTime(11000);expect(audio.calls).toContain('load');
 });
 it('reconciles a suspended browser without autoplay and honours the next Play gesture',()=>{
  const{engine,audio}=setup();engine.start([track(1)]);audio.metadata();audio.progress(3);audio.paused=true;audio.calls=[];
  engine.foreground();expect(engine.state).toBe('paused');expect(engine.interrupted).toBe(true);expect(audio.calls).toEqual([]);engine.resume();expect(audio.calls).toContain('load');audio.metadata();expect(audio.currentTime).toBe(3);
 });
 it('does not treat an intentional pause as an interruption or resume it on foreground',()=>{
  const{engine,audio}=setup();engine.start([track(1)]);engine.pause();expect(engine.interrupted).toBe(false);audio.calls=[];engine.foreground();vi.advanceTimersByTime(30000);expect(audio.calls).toEqual([]);
 });
 it('ignores rejection from a superseded same-track Play request',async()=>{
  const{engine,audio}=setup();let reject!:(e:Error)=>void;audio.pending=new Promise((_,r)=>{reject=r;});engine.start([track(1)]);audio.pending=null;engine.resume();reject(Object.assign(new Error('old request'),{name:'NotAllowedError'}));await Promise.resolve();expect(engine.state).toBe('playing');expect(engine.error).toBe('');
 });
 it('does not count seek jumps as listening or mark unsupported formats as negative feedback',async()=>{
  const{engine,audio,plays}=setup();engine.start([track(1),track(2)]);audio.metadata(100);vi.advanceTimersByTime(2000);audio.progress(2);engine.seek(90000);vi.advanceTimersByTime(1000);audio.progress(91);audio.fail(4);await Promise.resolve();expect(plays[0].msPlayed).toBe(3000);expect(plays[0].skipped).toBe(false);expect(engine.unsupported.has(track(1).id)).toBe(true);expect(engine.current?.id).toBe(track(2).id);
 });
 it('cannot spin forever when every track is unsupported and repeat-all is enabled',()=>{
  const{engine,audio}=setup();engine.setRepeat('all');engine.start([track(1),track(2)]);audio.fail(4);audio.fail(4);expect(engine.state).toBe('error');expect(audio.calls.filter(c=>c==='play')).toHaveLength(2);
 });
 it('ignores rejection from an older play request',async()=>{
  const{engine,audio}=setup();let reject!:(e:Error)=>void;audio.pending=new Promise((_,r)=>{reject=r;});engine.start([track(1)]);audio.pending=null;engine.start([track(2)]);reject(Object.assign(new Error('policy'),{name:'NotAllowedError'}));await Promise.resolve();expect(engine.state).toBe('playing');expect(engine.error).toBe('');
 });
 it('fades the chosen volume then pauses at the sleep deadline',()=>{
  const{engine,audio}=setup();engine.start([track(1)]);engine.setVolume(.8);engine.sleep(.25);vi.advanceTimersByTime(10000);expect(audio.volume).toBeCloseTo(.4,1);vi.advanceTimersByTime(5000);expect(engine.state).toBe('paused');expect(audio.volume).toBe(.8);expect(engine.sleepUntil).toBe(null);
 });
});
