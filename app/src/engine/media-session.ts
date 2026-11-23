import type { Album, Api, Track } from '../api/types';
import type { MediaBridge, PlaybackState } from './controller';

export class NativeMediaSession implements MediaBridge {
 private albums=new Map<string,Album>();
 private current:Track|null=null;
 private generation=0;
 private artwork=new Map<string,{ready:boolean;at:number}>();
 constructor(private api:Api,private base:string){}
 setAlbums(albums:Album[]){this.albums=new Map(albums.map(a=>[a.id,a]));if(this.current)this.track(this.current);}
 prepare(){if('audioSession'in navigator)try{(navigator as Navigator&{audioSession:{type:string}}).audioSession.type='playback';}catch{/* Older Safari. */}}
 track(track:Track|null){
  this.current=track;const generation=++this.generation;if(!('mediaSession'in navigator))return;
  if(!track){navigator.mediaSession.metadata=null;navigator.mediaSession.playbackState='none';try{navigator.mediaSession.setPositionState();}catch{}return;}
  const album=this.albums.get(track.album_id),absolute=(url:string)=>new URL(url,location.href).href;
  if(typeof MediaMetadata==='undefined')return;
  const candidates:MediaImage[]=album?album.art_source==='generated'?[{src:absolute(this.api.artUrl(album,600)),sizes:'512x512',type:'image/png'}]:[600,96].map(size=>({src:absolute(this.api.artUrl(album,size)),sizes:`${size}x${size}`,type:'image/webp'})):[];
  const fallback:MediaImage={src:absolute(`${this.base}icons/icon-512.png`),sizes:'512x512',type:'image/png'};
  const apply=()=>{if(generation!==this.generation)return;const available=candidates.filter(item=>this.artwork.get(item.src)?.ready);navigator.mediaSession.metadata=new MediaMetadata({title:track.title,artist:track.artist_name,album:track.album_title,artwork:available.length?available:[fallback]});};
  apply();
  // Never hand the OS only a not-yet-uploaded cover URL. Show the precached
  // brand mark until a real/generated album image has decoded successfully.
  for(const item of candidates){const cached=this.artwork.get(item.src);if(cached&&(cached.ready||Date.now()-cached.at<10000))continue;
   if(this.artwork.size>=128)this.artwork.delete(this.artwork.keys().next().value!);
   this.artwork.set(item.src,{ready:false,at:Date.now()});const image=new Image();image.onload=()=>{this.artwork.set(item.src,{ready:true,at:Date.now()});if(this.current)this.track(this.current);};image.onerror=()=>{this.artwork.set(item.src,{ready:false,at:Date.now()});};image.src=item.src;
  }
 }
 state(state:PlaybackState){if('mediaSession'in navigator&&this.current)navigator.mediaSession.playbackState=state==='playing'?'playing':'paused';}
 position(durationMs:number,positionMs:number,rate:number){
  if(!('mediaSession'in navigator)||!Number.isFinite(durationMs)||durationMs<=0)return;
  try{navigator.mediaSession.setPositionState({duration:durationMs/1000,position:Math.max(0,Math.min(durationMs,positionMs))/1000,playbackRate:Math.max(.01,rate)});}catch{/* Position state is optional on older browsers. */}
 }
 handlers(actions:Partial<Record<MediaSessionAction,MediaSessionActionHandler>>){
  if(!('mediaSession'in navigator))return()=>{};
  const supported:MediaSessionAction[]=[];for(const[action,handler]of Object.entries(actions))try{navigator.mediaSession.setActionHandler(action as MediaSessionAction,handler!);supported.push(action as MediaSessionAction);}catch{/* Unsupported OS action. */}
  return()=>{for(const action of supported)try{navigator.mediaSession.setActionHandler(action,null);}catch{}};
 }
}
