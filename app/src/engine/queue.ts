import type { Track } from '../api/types';

export type RepeatMode='off'|'all'|'one';
export type QueueSource='context'|'queue'|'autoplay';
export interface QueueEntry {key:string;track:Track;source:QueueSource;reason?:string}
export interface SavedQueue {context:string[];remaining:string[];manual:string[];automatic:string[];history:{id:string;source:QueueSource}[];current:string|null;currentSource:QueueSource;contextLabel:string;contextType:string;shuffle:boolean;repeat:RepeatMode;autoplay:boolean}

export function seededRandom(seed:number){let n=seed>>>0;return()=>{n+=0x6d2b79f5;let t=n;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
export function shuffleTracks<T extends {artist_name:string}>(tracks:T[],seed:number,previousArtist=''){
 const random=seededRandom(seed),pool=[...tracks];for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
 type Group={artist:string;tracks:T[];rank:number};const groups=new Map<string,Group>(),heap:Group[]=[],result:T[]=[];let previous=previousArtist;
 for(const [rank,track]of pool.entries()){let group=groups.get(track.artist_name);if(!group){group={artist:track.artist_name,tracks:[],rank};groups.set(track.artist_name,group);}group.tracks.push(track);}
 const higher=(a:Group,b:Group)=>a.tracks.length>b.tracks.length||a.tracks.length===b.tracks.length&&a.rank<b.rank;
 const push=(group:Group)=>{heap.push(group);let at=heap.length-1;while(at){const parent=(at-1)>>1;if(!higher(heap[at],heap[parent]))break;[heap[at],heap[parent]]=[heap[parent],heap[at]];at=parent;}};
 const pop=()=>{const top=heap[0],last=heap.pop()!;if(heap.length){heap[0]=last;let at=0;while(true){const left=at*2+1,right=left+1;let next=at;if(left<heap.length&&higher(heap[left],heap[next]))next=left;if(right<heap.length&&higher(heap[right],heap[next]))next=right;if(next===at)break;[heap[at],heap[next]]=[heap[next],heap[at]];at=next;}}return top;};
 for(const group of groups.values())push(group);
 while(heap.length){let group=pop();if(group.artist===previous&&heap.length){const alternative=pop();push(group);group=alternative;}const track=group.tracks.pop()!;result.push(track);previous=group.artist;if(group.tracks.length)push(group);}
 return result;
}

// Pure queue state: manual additions play first, followed by the remaining
// context and prepared autoplay. No URL resolution, I/O, timers or UI imports.
export class PlaybackQueue {
 current:QueueEntry|null=null;
 history:QueueEntry[]=[];
 manual:QueueEntry[]=[];
 remaining:QueueEntry[]=[];
 automatic:QueueEntry[]=[];
 canonical:Track[]=[];
 contextLabel='Your library';
 contextType='library';
 shuffle=false;
 repeat:RepeatMode='off';
 autoplay=true;
 private serial=0;
 private seed=0;
 private entry(track:Track,source:QueueSource,reason?:string):QueueEntry{return {key:`${source}-${++this.serial}`,track,source,reason};}
 start(tracks:Track[],index=0,label='Your library',type='library',seed=0){
  if(!tracks.length)return null;this.canonical=[...tracks];this.seed=seed;this.contextLabel=label;this.contextType=type;this.history=[];this.manual=[];this.automatic=[];
  const at=Math.max(0,Math.min(tracks.length-1,index));this.current=this.entry(tracks[at],'context');
  this.remaining=tracks.slice(at+1).map(track=>this.entry(track,'context'));
  if(this.shuffle){const rest=tracks.filter((_,i)=>i!==at);this.remaining=shuffleTracks(rest,seed,tracks[at].artist_name).map(track=>this.entry(track,'context'));}
  return this.current;
 }
 get upcoming(){return [...this.manual,...this.remaining,...(this.repeat==='off'&&this.autoplay?this.automatic:[])];}
 get timeline(){return [...this.history,...(this.current?[this.current]:[]),...this.upcoming];}
 add(tracks:Track[]){this.manual.push(...tracks.map(track=>this.entry(track,'queue')));}
 addAutomatic(tracks:Track[],reason:string){this.automatic.push(...tracks.map(track=>this.entry(track,'autoplay',reason)));}
 remove(key:string){this.manual=this.manual.filter(entry=>entry.key!==key);this.remaining=this.remaining.filter(entry=>entry.key!==key);this.automatic=this.automatic.filter(entry=>entry.key!==key);}
 reorder(key:string,to:number){const from=this.manual.findIndex(entry=>entry.key===key);if(from<0)return;const [entry]=this.manual.splice(from,1);this.manual.splice(Math.max(0,Math.min(this.manual.length,to)),0,entry);}
 clearManual(){this.manual=[];}
 setShuffle(enabled:boolean){
  if(this.shuffle===enabled)return;this.shuffle=enabled;if(!this.current)return;
  if(enabled)this.remaining=shuffleTracks(this.remaining.map(entry=>entry.track),++this.seed,this.current.track.artist_name).map(track=>this.entry(track,'context'));
  else{const pool=[...this.remaining],ordered:QueueEntry[]=[];for(const track of this.canonical){const at=pool.findIndex(entry=>entry.track.id===track.id);if(at>=0)ordered.push(...pool.splice(at,1));}this.remaining=[...ordered,...pool];}
 }
 advance(reason:'ended'|'manual'|'unsupported'='ended'){
  if(this.current&&reason==='ended'&&this.repeat==='one')return this.current;
  const previous=this.current;
  let next=this.manual.shift()||this.remaining.shift();
  if(!next&&this.repeat==='all'&&this.canonical.length){const tracks=this.shuffle?shuffleTracks(this.canonical,++this.seed,previous?.track.artist_name):this.canonical;this.remaining=tracks.map(track=>this.entry(track,'context'));next=this.remaining.shift();}
  if(!next&&this.repeat==='off'&&this.autoplay)next=this.automatic.shift();
  if(!next)return null;
  if(previous)this.history=[...this.history,previous].slice(-100);this.current=next;return next;
 }
 previous(){
  const previous=this.history.pop();if(!previous)return this.current;const current=this.current;
  if(current){if(current.source==='queue')this.manual.unshift(current);else if(current.source==='autoplay')this.automatic.unshift(current);else this.remaining.unshift(current);}
  this.current=previous;return previous;
 }
 jump(key:string){
  if(this.current?.key===key)return this.current;
  const target=this.upcoming.find(entry=>entry.key===key);if(!target)return null;
  // Selecting a queued item consumes the earlier upcoming entries, matching
  // playback order rather than silently replaying them on the next advance.
  let next:QueueEntry|null;do{next=this.advance('manual');}while(next&&next.key!==key);return next;
 }
 refresh(catalog:Map<string,Track>){
  const visible=(entries:QueueEntry[])=>entries.flatMap(entry=>{const track=catalog.get(entry.track.id);return track?[{...entry,track}]:[];});
  this.history=visible(this.history);this.manual=visible(this.manual);this.remaining=visible(this.remaining);this.automatic=visible(this.automatic);this.canonical=this.canonical.flatMap(track=>catalog.get(track.id)||[]);
  if(this.current){const track=catalog.get(this.current.track.id);if(track)this.current={...this.current,track};else this.current=null;}
 }
 save():SavedQueue{return {context:this.canonical.map(track=>track.id),remaining:this.remaining.map(entry=>entry.track.id),manual:this.manual.map(entry=>entry.track.id),automatic:this.automatic.map(entry=>entry.track.id),history:this.history.map(entry=>({id:entry.track.id,source:entry.source})),current:this.current?.track.id||null,currentSource:this.current?.source||'context',contextLabel:this.contextLabel,contextType:this.contextType,shuffle:this.shuffle,repeat:this.repeat,autoplay:this.autoplay};}
 restore(saved:SavedQueue,catalog:Map<string,Track>){
  const tracks=(ids:string[])=>ids.flatMap(id=>catalog.get(id)||[]),entries=(ids:string[],source:QueueSource)=>tracks(ids).map(track=>this.entry(track,source));
  this.canonical=tracks(saved.context);this.remaining=entries(saved.remaining,'context');this.manual=entries(saved.manual,'queue');this.automatic=entries(saved.automatic,'autoplay');this.history=saved.history.flatMap(entry=>{const track=catalog.get(entry.id);return track?[this.entry(track,entry.source)]:[];}).slice(-100);this.contextLabel=saved.contextLabel;this.contextType=saved.contextType;this.shuffle=saved.shuffle;this.repeat=saved.repeat;this.autoplay=saved.autoplay;
  const current=saved.current?catalog.get(saved.current):null;this.current=current?this.entry(current,saved.currentSource):null;
  if(!this.current)this.current=this.manual.shift()||this.remaining.shift()||this.automatic.shift()||null;return this.current;
 }
}
