import type { Track } from '../api/types';
import type { PlayerSnapshot } from '../../../shared/playback-input';
import { PlaybackQueue, shuffleTracks, type QueueEntry, type RepeatMode } from './queue';
import type { PlayerPersistence } from './persistence';
import type { ListeningEvent, ListeningHistory } from './listening';

export type PlaybackState = 'paused' | 'loading' | 'playing' | 'error';
export interface MediaBridge {
 prepare():void;
 track(track:Track|null):void;
 state(state:PlaybackState):void;
 position(durationMs:number,positionMs:number,rate:number):void;
}
export interface EngineOptions {
 audio:HTMLAudioElement;
 media:MediaBridge;
 persistence:PlayerPersistence;
 listening:ListeningHistory;
 url(track:Track):string;
 id():string;
 changed():void;
 now?:()=>number;
 clock?:()=>number;
 ios?:boolean;
 deviceLabel?:string;
 warm?:(url:string|null)=>void;
 unavailable?:(track:Track)=>Promise<boolean>;
}
interface Session {id:string;track:Track;startedAt:number;listened:number;context:string;lastTime:number;lastClock:number}

// All playback work stays outside UI components. In particular, ended never
// waits for storage, metadata, recommendation computation or a network request.
export class AudioEngine {
 private recommendationSource?: (seed:Track,n:number,excluded:string[],lastArtists:string[])=>Promise<Track[]>;
 private recommendationsPending=false;
 setRecommendationSource(source:(seed:Track,n:number,excluded:string[],lastArtists:string[])=>Promise<Track[]>){this.recommendationSource=source;this.prepareNext();}
 recentPlayedIds(){return [...this.recent].filter(([,at])=>at>this.now()-7200000).map(([id])=>id);}
 readonly queue=new PlaybackQueue();
 readonly unsupported=new Set<string>();
 queueRevision=0;
 state:PlaybackState='paused';
 positionMs=0;
 bufferedMs=0;
 error='';
 interrupted=false;
 volume=1;
 sleepUntil:number|null=null;
 sleepTrack:string|null=null;
 loop:{a:number;b:number}|null=null;
 private catalog=new Map<string,Track>();
 private urls=new Map<string,string>();
 private codecSupport=new Map<string,CanPlayTypeResult>();
 private wanted=false;
 private generation=0;
 private epoch=0;
 private retries=0;
 private retryProgress=0;
 private recovery:ReturnType<typeof setTimeout>|undefined;
 private stall:ReturnType<typeof setTimeout>|undefined;
 private sleeper:ReturnType<typeof setTimeout>|undefined;
 private interval:ReturnType<typeof setInterval>;
 private pendingSeek:number|null=null;
 private session:Session|null=null;
 private ownerId:string|null=null;
 private recent=new Map<string,number>();
 private historyReady=false;
 private refillPending=false;
 private events=new AbortController();
 private temporary=false;
 private now:()=>number;
 private clock:()=>number;
 constructor(private options:EngineOptions){
  this.now=options.now||Date.now;this.clock=options.clock||(()=>performance.now());
  const audio=options.audio;audio.preload='none';
  const listen=(name:string,handler:()=>void)=>audio.addEventListener(name,handler,{signal:this.events.signal});
  listen('ended',()=>this.ended());
  listen('loadedmetadata',()=>{this.applySeek();this.publishPosition();this.changed();});
  listen('durationchange',()=>{this.applySeek();this.publishPosition();});
  listen('timeupdate',()=>this.tick());
  listen('progress',()=>{this.readBuffered();this.changed();});
  listen('seeking',()=>this.anchor());
  listen('seeked',()=>{this.positionMs=audio.currentTime*1000;this.anchor();this.publishPosition();this.persist(false);this.changed();});
  listen('ratechange',()=>{this.anchor();this.publishPosition();});
  listen('play',()=>{if(!audio.paused){this.wanted=true;this.interrupted=false;this.state='loading';this.ensureSession();this.anchor();this.publishPosition();this.changed();}});
  listen('playing',()=>{if(this.wanted&&!audio.paused){this.state='playing';this.error='';this.clearStall();this.ensureSession();this.anchor();this.changed();}});
  listen('pause',()=>{if(!audio.paused||audio.ended)return;this.account();this.wanted=false;this.interrupted=this.state==='playing'||this.state==='loading';this.state='paused';this.cancelRecovery();this.persist(true);this.publishPosition();this.changed();});
  listen('waiting',()=>this.watchStall());listen('stalled',()=>this.watchStall());
  listen('error',()=>this.failed());
  this.interval=setInterval(()=>{if(!this.queue.current)return;this.tick();this.publishPosition();this.persist(false);},5000);
 }
 get current(){return this.queue.current?.track||null;}
 get durationMs(){const d=this.options.audio.duration;return Number.isFinite(d)&&d>0?d*1000:this.current?.duration_ms||0;}
 private changed(){this.options.media.state(this.state);this.options.changed();}
 private publishPosition(){this.options.media.position(this.durationMs,this.positionMs,this.options.audio.playbackRate);}
 private readBuffered(){const a=this.options.audio;try{this.bufferedMs=a.buffered.length?a.buffered.end(a.buffered.length-1)*1000:0;}catch{this.bufferedMs=0;}}
 configure(userId:string|null){
  this.clear();this.epoch++;this.ownerId=userId;this.recommendationsPending=false;this.options.persistence.configure(userId);this.options.listening.configure(userId);this.historyReady=false;this.recent.clear();
  if(userId){this.options.listening.flush();const epoch=this.epoch;void this.options.listening.recent(this.now()-7200000).then(rows=>{if(epoch!==this.epoch)return;for(const row of rows)this.recent.set(row.trackId,Math.max(this.recent.get(row.trackId)||0,row.startedAt));this.historyReady=true;this.prepareNext();}).catch(()=>{if(epoch===this.epoch){this.historyReady=true;this.prepareNext();}});}
 }
 setCatalog(tracks:Track[]){
  const previous=this.current;this.catalog=new Map(tracks.filter(t=>!t.deleted).map(t=>[t.id,t]));this.urls=new Map([...this.catalog.values()].map(t=>[t.id,this.options.url(t)]));
  if(!this.temporary){this.queue.refresh(this.catalog);if(previous&&!this.current){const playing=this.wanted;this.finish('unavailable');const next=this.queue.advance('unsupported');if(next)this.select(next,0,playing);else{this.pause();this.options.audio.removeAttribute('src');this.options.audio.load();this.positionMs=0;this.options.media.track(null);}this.error=previous.owner_id!==this.ownerId?'A track is no longer shared.':'A track is no longer available.';}else if(this.current)this.options.media.track(this.current);}
  this.queueRevision++;this.prepareNext();this.changed();
 }
 async restore(){
  const epoch=this.epoch,generation=this.generation,saved=await this.options.persistence.read();
  if(!saved||epoch!==this.epoch||generation!==this.generation)return;
  this.queue.shuffle=saved.shuffle;this.queue.repeat=saved.repeat;this.queue.autoplay=saved.autoplay;
  if(saved.sections)this.queue.restore(saved.sections,this.catalog);
  else{const tracks=saved.queue.flatMap(id=>this.catalog.get(id)||[]),id=saved.queue[saved.index],index=Math.max(0,tracks.findIndex(t=>t.id===id));this.queue.start(tracks,index);}
  const savedCurrent=saved.sections?.current||saved.queue[saved.index];
  if(this.queue.current)this.select(this.queue.current,this.current?.id===savedCurrent?saved.positionMs:0,false);this.prepareNext();
 }
 start(tracks:Track[],index=0,label='Your library',type='library',positionMs=0){
  if(!tracks.length)return;this.finish('manual');this.temporary=type==='test';
  for(const track of tracks){this.catalog.set(track.id,track);this.urls.set(track.id,this.options.url(track));}
  const entry=this.queue.start(tracks,index,label,type,this.now());if(entry){this.unsupported.delete(entry.track.id);this.select(entry,positionMs,true);}
 }
 endTemporary(saved:PlayerSnapshot){
  if(!this.temporary)return;this.pause();this.temporary=false;this.queue.shuffle=saved.shuffle;this.queue.repeat=saved.repeat;this.queue.autoplay=saved.autoplay;
  if(saved.sections)this.queue.restore(saved.sections,this.catalog);else{const tracks=saved.queue.flatMap(id=>this.catalog.get(id)||[]);if(tracks.length)this.queue.start(tracks,Math.min(saved.index,tracks.length-1));else{this.queue.current=null;this.queue.history=[];this.queue.manual=[];this.queue.remaining=[];this.queue.automatic=[];this.queue.canonical=[];}}
  if(this.queue.current)this.select(this.queue.current,saved.positionMs,false);else{this.options.audio.removeAttribute('src');this.options.audio.load();this.options.media.track(null);this.positionMs=0;this.state='paused';}
  this.queueRevision++;this.prepareNext();this.persist(false);this.changed();
 }
 resume(){
  if(!this.current)return;this.options.media.prepare();this.wanted=true;this.interrupted=false;this.error='';this.retries=0;this.cancelRecovery();
  if(this.options.audio.ended)this.seek(0);this.ensureSession();this.state='loading';this.attempt();this.prepareNext();this.changed();
 }
 pause(){
  this.account();this.wanted=false;this.interrupted=false;this.generation++;this.cancelRecovery();this.options.warm?.(null);this.options.audio.pause();this.state='paused';this.persist(true);this.publishPosition();this.changed();
 }
 stop(){this.pause();this.seek(0);this.persist(true);}
 seek(ms:number,fast=false){
  if(!this.current||!Number.isFinite(ms))return;this.account();const duration=this.durationMs,next=Math.max(0,duration?Math.min(duration,ms):ms);this.positionMs=next;
  const a=this.options.audio;if(a.readyState>=1){try{if(fast&&typeof a.fastSeek==='function')a.fastSeek(next/1000);else a.currentTime=next/1000;this.pendingSeek=null;}catch{this.pendingSeek=next;}}else this.pendingSeek=next;
  this.anchor();this.publishPosition();this.persist(false);this.changed();
 }
 next(reason:'manual'|'ended'|'unsupported'='manual'){
  const previous=this.queue.current;this.finish(reason);let entry:QueueEntry|null=null;
  const limit=this.queue.canonical.length+this.queue.upcoming.length+1;
  for(let n=0;n<limit;n++){entry=this.queue.advance(reason);if(!entry||!this.unsupported.has(entry.track.id))break;entry=null;}
  if(!entry){this.wanted=false;this.cancelRecovery();this.options.audio.pause();this.state=reason==='unsupported'?'error':'paused';this.persist(true);this.changed();return;}
  if(reason==='manual'&&this.sleepTrack===previous?.key)this.sleep(null);
  this.select(entry,0,true,entry.key===previous?.key);
 }
 previous(){
  if(this.positionMs>3000){this.seek(0);return;}this.finish('manual');const previous=this.queue.previous();if(previous)this.select(previous,0,true);
 }
 jump(key:string){const entry=this.queue.jump(key);if(!entry)return;this.finish('manual');this.select(entry,0,true);}
 enqueue(tracks:Track[]){for(const t of tracks){this.catalog.set(t.id,t);this.urls.set(t.id,this.options.url(t));}this.queue.add(tracks);this.queueChanged();}
 remove(key:string){this.queue.remove(key);this.queueChanged();}
 reorder(key:string,to:number){this.queue.reorder(key,to);this.queueChanged();}
 clearManual(){this.queue.clearManual();this.queueChanged();}
 setSmartShuffle(enabled:boolean){this.queue.smartShuffle=enabled;if(!enabled)this.queue.removeSmart();this.queueChanged();}
 setShuffle(enabled:boolean){this.queue.setShuffle(enabled);this.queueChanged();}
 setRepeat(mode:RepeatMode){this.queue.repeat=mode;this.queueChanged();}
 setAutoplay(enabled:boolean){this.queue.autoplay=enabled;this.queueChanged();}
 private queueChanged(){this.queueRevision++;this.persist(true);this.prepareNext();this.changed();}
 private select(entry:QueueEntry,at:number,play:boolean,reuse=false){
  this.generation++;this.queueRevision++;this.cancelRecovery();this.pendingSeek=Math.max(0,at);this.positionMs=Math.max(0,at);this.bufferedMs=0;this.retries=0;this.retryProgress=0;this.error='';this.interrupted=false;this.loop=null;
  const a=this.options.audio;this.wanted=play;this.state=play?'loading':'paused';a.preload=play?'auto':'none';
  if(play)this.options.media.prepare();
  // The URL is already resolved. Do not insert an await, storage request or
  // metadata lookup between assigning this source and calling play().
  if(!reuse)a.src=this.urls.get(entry.track.id)!;
  else{a.currentTime=0;this.pendingSeek=null;}
  if(play){this.ensureSession();this.attempt();}
  this.options.media.track(entry.track);this.publishPosition();this.persist(true);this.prepareNext();this.changed();
 }
 private attempt(){
  const generation=this.generation;this.wanted=true;
  try{void this.options.audio.play().catch(error=>{if(generation!==this.generation||!this.wanted)return;if(error.name==='AbortError')return;if(error.name==='NotSupportedError'){this.unsupportedCurrent();return;}this.wanted=false;this.state='paused';this.error=error.name==='NotAllowedError'?'Tap Play to start listening.':'Playback could not start. Try again.';this.changed();});}catch{this.wanted=false;this.state='error';this.error='Playback could not start. Try again.';this.changed();}
 }
 private applySeek(){
  if(this.pendingSeek===null||this.options.audio.readyState<1)return;const d=this.durationMs,at=Math.max(0,d?Math.min(d,this.pendingSeek):this.pendingSeek);try{this.options.audio.currentTime=at/1000;this.positionMs=at;this.pendingSeek=null;this.anchor();}catch{/* Seek again when metadata becomes available. */}
 }
 private ended(){
  if(this.loop){this.seek(this.loop.a);this.resume();return;}
  this.account();this.positionMs=this.durationMs;
  if(this.sleepTrack===this.queue.current?.key||this.sleepUntil!==null&&this.now()>=this.sleepUntil){this.finish('ended');this.pause();this.sleep(null);return;}
  if(this.temporary){this.finish('ended');this.pause();return;}
  this.next('ended');
 }
 private tick(){
  this.account();const a=this.options.audio;if(this.pendingSeek===null)this.positionMs=a.currentTime*1000;this.readBuffered();
  if(this.loop&&this.positionMs>=this.loop.b)this.seek(this.loop.a);
  if(this.sleepUntil!==null){if(this.now()>=this.sleepUntil)this.expireSleep();else this.fade();}
  this.changed();
 }
 setLoop(aMs:number,bMs:number|null){const duration=this.durationMs;this.loop=bMs!==null&&Number.isFinite(aMs)&&Number.isFinite(bMs)&&aMs>=0&&bMs>aMs&&(!duration||bMs<=duration)?{a:aMs,b:bMs}:null;this.changed();}
 private watchStall(){if(!this.wanted||this.options.audio.ended||this.stall||this.recovery)return;this.state='loading';this.changed();this.stall=setTimeout(()=>{this.stall=undefined;if(this.wanted)this.recover();},8000);}
 private clearStall(){clearTimeout(this.stall);this.stall=undefined;}
 private cancelRecovery(){this.clearStall();clearTimeout(this.recovery);this.recovery=undefined;}
 private failed(){if(!this.wanted)return;const code=this.options.audio.error?.code;if(!code)return;const track=this.current,generation=this.generation;if(track&&this.options.unavailable){void this.options.unavailable(track).then(unavailable=>{if(unavailable&&generation===this.generation)this.setCatalog([...this.catalog.values()].filter(row=>row.id!==track.id));}).catch(()=>{});}if(code===2)this.recover();else if(code===3||code===4)this.unsupportedCurrent();else{this.wanted=false;this.state='error';this.error='Playback stopped. Tap Play to try again.';this.changed();}}
 private unsupportedCurrent(){
  const track=this.current;if(!track)return;this.unsupported.add(track.id);this.queueRevision++;this.error=`${track.title} can’t play on this device.`;this.next('unsupported');
 }
 private recover(immediate=false){
  if(!this.wanted||!this.current)return;this.cancelRecovery();this.account();const at=this.options.audio.currentTime*1000,url=this.urls.get(this.current.id)!,generation=this.generation;
  if(!immediate&&this.retries>=4){this.state='error';this.error='Playback stopped. Check your connection, then tap Play.';this.changed();return;}
  const delay=immediate?0:1000*2**this.retries++;this.retryProgress=0;this.state='loading';this.changed();
  const retry=()=>{this.recovery=undefined;if(generation!==this.generation||!this.wanted)return;this.pendingSeek=at;this.options.audio.src=url;this.attempt();};
  if(immediate)retry();else this.recovery=setTimeout(retry,delay);
 }
 online(){this.options.persistence.flush();this.options.listening.flush();if(this.wanted&&this.state!=='playing'){this.retries=0;this.recover(true);}}
 private ensureSession(){
  if(this.session||!this.current||this.temporary)return;this.session={id:this.options.id(),track:this.current,startedAt:this.now(),listened:0,context:this.queue.contextType,lastTime:this.options.audio.currentTime,lastClock:this.clock()};
 }
 private anchor(){if(this.session){this.session.lastTime=this.options.audio.currentTime;this.session.lastClock=this.clock();}}
 private account(){
  const s=this.session;if(!s)return;const a=this.options.audio,clock=this.clock(),media=Math.max(0,(a.currentTime-s.lastTime)*1000),wall=Math.max(0,clock-s.lastClock)*a.playbackRate;
  const heard=!a.seeking&&this.wanted?Math.min(media,wall+50):0;s.listened+=heard;
  if(heard>0){this.recent.set(s.track.id,this.now());this.retryProgress+=heard;if(this.retryProgress>=1000){this.retries=0;this.clearStall();}}
  s.lastTime=a.currentTime;s.lastClock=clock;
 }
 private finish(reason:string,defer=true){
  this.account();const session=this.session;this.session=null;if(!session||session.listened<1)return;
  const msPlayed=Math.round(session.listened),duration=session.track.duration_ms||this.durationMs,completed=duration>0&&msPlayed>=duration*.8,threshold=duration>0&&duration<60000?duration*.5:30000;
  const play:ListeningEvent={id:session.id,trackId:session.track.id,startedAt:session.startedAt,msPlayed,completed,skipped:!completed&&reason==='manual'&&msPlayed<threshold,context:session.context,deviceLabel:this.options.deviceLabel||null};
  // Source selection and play run before this queued I/O, even on ended.
  if(!defer)this.options.listening.record(play);
  else{const epoch=this.epoch;queueMicrotask(()=>{if(epoch===this.epoch)this.options.listening.record(play);});}
 }
 private prepareNext(){
  if(this.refillPending)return;this.refillPending=true;const epoch=this.epoch;
  queueMicrotask(()=>{this.refillPending=false;if(epoch!==this.epoch||!this.current||this.temporary)return;
   const smart=this.queue.smartShuffle&&!this.queue.remaining.some(entry=>entry.reason==='Smart shuffle')&&this.queue.remaining.filter(entry=>entry.source==='context').length>=5;
   if(this.historyReady&&(smart||this.queue.autoplay&&this.queue.repeat==='off'&&this.queue.automatic.length<=3)&&!this.recommendationsPending){
    const seed=this.current,excluded=new Set([...this.queue.timeline.map(entry=>entry.track.id),...this.unsupported,...this.recentPlayedIds()]),wanted=smart?Math.min(20,Math.floor(this.queue.remaining.length/5)):10-this.queue.automatic.length;
    const apply=(tracks:Track[])=>{if(epoch!==this.epoch||this.temporary||this.current?.id!==seed.id)return;const blocked=new Set([...this.queue.timeline.map(entry=>entry.track.id),...this.unsupported,...this.recentPlayedIds()]),next=tracks.filter(track=>this.catalog.has(track.id)&&!blocked.has(track.id)).slice(0,wanted);if(!next.length)return;if(smart){if(!this.queue.smartShuffle)return;this.queue.injectSmart(next);}else{if(!this.queue.autoplay||this.queue.repeat!=='off')return;this.queue.addAutomatic(next,'Because you played '+seed.artist_name);}this.queueRevision++;this.persist(false);this.changed();};
    if(this.recommendationSource){this.recommendationsPending=true;void this.recommendationSource(seed,wanted,[...excluded],this.queue.history.slice(-2).map(entry=>entry.track.artist_name)).then(apply).catch(()=>{}).finally(()=>{if(epoch===this.epoch)this.recommendationsPending=false;});}
    else apply(shuffleTracks([...this.catalog.values()].filter(track=>!excluded.has(track.id)),this.now()>>>0,seed.artist_name));
   }
   if(this.options.warm){
    const next=this.queue.upcoming[0]?.track;
    // Probe this device once per format before spending bandwidth on a warm
    // request. A negative hint never blocks an explicit playback attempt.
    const mime=next?next.codec?.toLowerCase().includes('alac')?'audio/mp4; codecs="alac"':next.codec?.toLowerCase().includes('opus')?'audio/ogg; codecs="opus"':next.mime:'';
    if(mime&&!this.codecSupport.has(mime))this.codecSupport.set(mime,this.options.audio.canPlayType(mime));
    this.options.warm(this.wanted&&next&&(!mime||this.codecSupport.get(mime))?this.urls.get(next.id)||null:null);
   }
  });
 }
 snapshot():PlayerSnapshot{const timeline=this.queue.timeline;return {queue:timeline.map(e=>e.track.id),index:Math.max(0,timeline.findIndex(e=>e.key===this.queue.current?.key)),positionMs:Math.max(0,Math.round(this.positionMs)),shuffle:this.queue.shuffle,repeat:this.queue.repeat,autoplay:this.queue.autoplay,updatedAt:this.now(),sections:this.queue.save()};}
 private persist(remote:boolean,pagehide=false){if(!this.temporary&&this.current)this.options.persistence.write(this.snapshot(),remote,pagehide);}
 pagehide(){this.account();this.persist(true,true);this.finish('pagehide',false);this.options.listening.flush(true);}
 setVolume(value:number){if(!Number.isFinite(value))return;this.volume=Math.max(0,Math.min(1,value));this.fade();this.changed();}
 private fade(){if(this.options.ios)return;const factor=this.sleepUntil===null?1:Math.max(0,Math.min(1,(this.sleepUntil-this.now())/10000));try{this.options.audio.volume=this.volume*factor;}catch{/* iOS and restricted devices can have read-only volume. */}}
 sleep(minutes:number|'endOfTrack'|null){
  clearTimeout(this.sleeper);this.sleepUntil=null;this.sleepTrack=null;
  if(minutes==='endOfTrack')this.sleepTrack=this.queue.current?.key||null;
  else if(minutes!==null&&Number.isFinite(minutes)&&minutes>0&&minutes<=1440){this.sleepUntil=this.now()+minutes*60000;this.scheduleSleep();}
  this.fade();this.changed();
 }
 private scheduleSleep(){if(this.sleepUntil===null)return;const left=this.sleepUntil-this.now();if(left<=0){this.expireSleep();return;}this.fade();this.sleeper=setTimeout(()=>this.scheduleSleep(),left>10000?left-10000:Math.min(250,left));}
 private expireSleep(){this.pause();this.sleep(null);}
 clear(){
  this.persist(true);this.finish('signout',false);this.wanted=false;this.generation++;this.cancelRecovery();this.sleep(null);this.options.warm?.(null);
  const a=this.options.audio;a.pause();a.removeAttribute('src');a.load();a.preload='none';this.queue.current=null;this.queue.history=[];this.queue.manual=[];this.queue.remaining=[];this.queue.automatic=[];this.queue.canonical=[];this.queue.smartShuffle=false;this.queueRevision++;this.positionMs=0;this.bufferedMs=0;this.pendingSeek=null;this.state='paused';this.error='';this.interrupted=false;this.temporary=false;this.loop=null;this.options.media.track(null);this.changed();
 }
 dispose(){this.events.abort();clearInterval(this.interval);this.cancelRecovery();clearTimeout(this.sleeper);this.options.warm?.(null);this.options.persistence.dispose();this.options.listening.dispose();}
}
