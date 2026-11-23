import { batch, signal } from '@preact/signals';
import { api } from '@backend';
import type { Album, Track } from '../api/types';
import { id } from '../library/ids';
import { AudioEngine, type PlaybackState } from './controller';
import { PlaybackPersistence } from './persistence';
import { PlaybackListening } from './listening';
import { NativeMediaSession } from './media-session';
import { platform } from './brave';
import type { QueueEntry, RepeatMode } from './queue';

// One persistent playback element. Route changes and HMR never replace it.
export const audio = (document.getElementById('wavehaus-audio') as HTMLAudioElement | null) || document.createElement('audio');
audio.id='wavehaus-audio';audio.hidden=true;audio.preload='none';audio.setAttribute('playsinline','');if(!audio.isConnected)document.body.append(audio);
export const state=signal<PlaybackState>('paused'),current=signal<Track|null>(null),positionMs=signal(0),durationMs=signal(0),bufferedMs=signal(0),queue=signal<Track[]>([]),queueIndex=signal(0),repeat=signal<RepeatMode>('off'),shuffle=signal(false),smartShuffle=signal(false),autoplay=signal(true),engineError=signal(''),interrupted=signal(false),volume=signal(1),unsupportedTracks=signal(new Set<string>()),sleepState=signal<{until:number|null;track:string|null}>({until:null,track:null});
export const queueSections=signal<{current:QueueEntry|null;manual:QueueEntry[];context:QueueEntry[];automatic:QueueEntry[];label:string;type:string}>({current:null,manual:[],context:[],automatic:[],label:'Your library',type:'library'});
const media=new NativeMediaSession(api,import.meta.env.BASE_URL);
const persistence=new PlaybackPersistence(api,import.meta.env.BASE_URL,()=>{engineError.value='Playback is working, but this browser could not save your position.';});
const listening=new PlaybackListening(api,import.meta.env.BASE_URL);
let queueRevision=-1,warmUrl:string|null=null,warmRequest:AbortController|null=null;
function warm(url:string|null){
 if(url===warmUrl)return;warmRequest?.abort();warmRequest=null;warmUrl=null;
 const connection=(navigator as Navigator&{connection?:{saveData?:boolean}}).connection;
 if(!url||!navigator.onLine||connection?.saveData)return;
 warmUrl=url;const controller=new AbortController();warmRequest=controller;
 void fetch(url,{headers:{Range:'bytes=0-65535'},credentials:'same-origin',cache:'no-store',signal:controller.signal}).then(async response=>{if(response.status===206)await response.arrayBuffer();else await response.body?.cancel();}).catch(()=>{}).finally(()=>{if(warmRequest===controller)warmRequest=null;});
}
function resolvedUrl(track:Track){const url=new URL(track.id==='background-test'?`${import.meta.env.BASE_URL}chime-test.wav`:api.mediaUrl(track),location.href);if(url.origin!==location.origin)throw new Error('Playback requires a same-origin media URL.');return url.href;}
const engine=new AudioEngine({audio,media,persistence,listening,url:resolvedUrl,id,warm,ios:platform()==='ios',deviceLabel:platform()==='android'?'Android':platform()==='ios'?'iPhone / iPad':'Desktop',changed:publish});
function publish(){batch(()=>{
 state.value=engine.state;current.value=engine.current;positionMs.value=engine.positionMs;durationMs.value=engine.durationMs;bufferedMs.value=engine.bufferedMs;engineError.value=engine.error;interrupted.value=engine.interrupted;volume.value=engine.volume;
 const sleep=sleepState.peek();if(sleep.until!==engine.sleepUntil||sleep.track!==engine.sleepTrack)sleepState.value={until:engine.sleepUntil,track:engine.sleepTrack};
 if(queueRevision!==engine.queueRevision){queueRevision=engine.queueRevision;const q=engine.queue,timeline=q.timeline;queue.value=timeline.map(e=>e.track);queueIndex.value=Math.max(0,timeline.findIndex(e=>e.key===q.current?.key));repeat.value=q.repeat;shuffle.value=q.shuffle;smartShuffle.value=q.smartShuffle;autoplay.value=q.autoplay;unsupportedTracks.value=new Set(engine.unsupported);queueSections.value={current:q.current,manual:[...q.manual],context:[...q.remaining],automatic:[...q.automatic],label:q.contextLabel,type:q.contextType};}
});}
export function configureUser(userId:string){engine.configure(userId);}
export function clearPlayer(){engine.configure(null);}
export function updateLibrary(tracks:Track[],albums:Album[]){media.setAlbums(albums);engine.setCatalog(tracks);}
export async function restore(tracks:Track[]){engine.setCatalog(tracks);await engine.restore();}
export function load(tracks:Track[],index=0,context={label:tracks[0]?.album_title||'Your library',type:'library'},at=0){engine.start(tracks,index,context.label,context.type,at);}
export function play(tracks?:Track[]|Track,at=0){if(!tracks){engine.resume();return;}if(Array.isArray(tracks))load(tracks,0,{label:tracks[0]?.album_title||'Your library',type:'library'},at);else if(tracks.id===current.peek()?.id){if(at)engine.seek(at);engine.resume();}else engine.start([tracks],0,tracks.album_title||'Your library',tracks.id==='background-test'?'test':'library',at);}
export const resume=()=>engine.resume();
export const pause=()=>engine.pause();
export const stop=()=>engine.stop();
export const toggle=()=>state.peek()==='playing'||state.peek()==='loading'?pause():resume();
export const seek=(ms:number,fast=false)=>engine.seek(ms,fast);
export const next=(manual=true)=>engine.next(manual?'manual':'ended');
export const prev=()=>engine.previous();
export const enqueue=(tracks:Track|Track[])=>engine.enqueue(Array.isArray(tracks)?tracks:[tracks]);
export const jump=(key:string)=>engine.jump(key);
export const removeQueued=(key:string)=>engine.remove(key);
export const reorderQueued=(key:string,to:number)=>engine.reorder(key,to);
export const clearQueue=()=>engine.clearManual();
export const setShuffle=(value:boolean)=>engine.setShuffle(value);
export const setSmartShuffle=(value:boolean)=>engine.setSmartShuffle(value);
export const setRepeat=(value:RepeatMode)=>engine.setRepeat(value);
export const setAutoplay=(value:boolean)=>engine.setAutoplay(value);
export const setLoop=(aMs:number,bMs:number|null)=>engine.setLoop(aMs,bMs);
export const sleep=(minutes:number|'endOfTrack'|null)=>engine.sleep(minutes);
export const setVolume=(value:number)=>engine.setVolume(value);
export const playbackSnapshot=()=>engine.snapshot();
export const endTemporary=(saved:ReturnType<typeof engine.snapshot>)=>engine.endTemporary(saved);
export const listeningHistory=(since=0)=>listening.recent(since);
export const setRecommendationSource=(source:(seed:Track,n:number,excluded:string[],lastArtists:string[])=>Promise<Track[]>)=>engine.setRecommendationSource(source);
export const recentPlayedIds=()=>engine.recentPlayedIds();
const removeHandlers=media.handlers({play:resume,pause,stop,previoustrack:prev,nexttrack:()=>next(),seekto:d=>{if(d.seekTime!==undefined)seek(d.seekTime*1000,!!d.fastSeek);},seekbackward:d=>seek(positionMs.peek()-(d.seekOffset||10)*1000),seekforward:d=>seek(positionMs.peek()+(d.seekOffset||10)*1000)});
const online=()=>engine.online(),pagehide=()=>engine.pagehide();addEventListener('online',online);addEventListener('pagehide',pagehide);
if(import.meta.hot)import.meta.hot.dispose(()=>{removeHandlers();removeEventListener('online',online);removeEventListener('pagehide',pagehide);engine.dispose();});
