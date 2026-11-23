import { signal } from '@preact/signals';
import { createStore,get,set } from 'idb-keyval';
import { api } from '@backend';
import { emptyLibrary,type Album,type Track,type Library,type LibraryDelta } from '../api/types';
import { beginBusy } from '../ui/busy';
import {offlineMode} from './downloads';
import { user,authStatus,loadSession } from './session';
export { user } from './session';
const cache=createStore(`wh-library-${api.demo?'demo':'http'}`,'library');
export const library=signal<Library>(emptyLibrary()),busy=signal(true),notice=signal('');
export const undoAction=signal<string|null>(null);
let rev=0,syncing:Promise<void>|null=null,syncEpoch=0,timer:ReturnType<typeof setTimeout>;
export function toast(message:string){undoAction.value=null;notice.value=message;clearTimeout(timer);timer=setTimeout(()=>{notice.value='';undoAction.value=null;},6500);}
export function offerUndo(message:string,changeId:string|null){toast(message);undoAction.value=changeId;}
export function clearLibrary(){syncEpoch++;syncing=null;rev=0;library.value=emptyLibrary();undoAction.value=null;}
export function insertUpload(track:Track,album:Album){if(track.owner_id!==user.value?.id)return;const replace=<T extends {id:string}>(rows:T[],row:T)=>[...rows.filter(item=>item.id!==row.id),row];library.value={...library.value,tracks:replace(library.value.tracks,track),albums:replace(library.value.albums,album)};}
export async function sync(){if(!user.value)return;if(syncing)return syncing;const epoch=syncEpoch,userId=user.value.id;const operation=(async()=>{const finish=beginBusy();try{
 let more=true;while(more){const delta=await api.request<LibraryDelta>(`/api/library?since=${rev}`),next={...library.value};
  if(epoch!==syncEpoch||user.value?.id!==userId)return;
  for(const key of Object.keys(next) as (keyof Library)[]){const map=new Map((next[key] as unknown as Record<string,unknown>[]).map(r=>[String(r.id||`${r.user_id||r.playlist_id}:${r.track_id}`),r]));
   for(const r of delta.items[key] as unknown as Record<string,unknown>[]) {const k=String(r.id||`${r.user_id||r.playlist_id}:${r.track_id}`);if(r.deleted)map.delete(k);else map.set(k,r);}
   (next[key] as unknown[])=Array.from(map.values());
  }
  for(const key of ['tracks','albums','playlists'] as const)next[key]=next[key].filter(r=>!delta.hidden[key].includes(r.id)) as never;
  const hidden=[...delta.hidden.tracks,...delta.items.tracks.filter(row=>row.deleted).map(row=>row.id)];if(hidden.length){dispatchEvent(new CustomEvent('wh-purge-tracks',{detail:hidden}));navigator.serviceWorker?.controller?.postMessage({type:'PURGE_TRACKS',ids:hidden});next.playlistItems=next.playlistItems.filter(row=>!hidden.includes(row.track_id));next.likes=next.likes.filter(row=>!hidden.includes(row.track_id));next.moments=next.moments.filter(row=>!hidden.includes(row.track_id));}
  const removedPlaylists=new Set([...delta.hidden.playlists,...delta.items.playlists.filter(row=>row.deleted).map(row=>row.id)]);if(removedPlaylists.size)next.playlistItems=next.playlistItems.filter(row=>!removedPlaylists.has(row.playlist_id));
  if(!delta.more){const usedArtists=new Set([...next.tracks,...next.albums].map(row=>row.artist_id));next.artists=next.artists.filter(row=>usedArtists.has(row.id));}
  library.value=next;rev=delta.rev;more=delta.more;
 }if(epoch===syncEpoch&&user.value?.id===userId)await set(`user:${userId}`,{rev,library:library.value},cache);
 }finally{finish();}})();syncing=operation;operation.finally(()=>{if(syncing===operation)syncing=null;}).catch(()=>{});return operation;}
export async function bootLibrary(){
 busy.value=true;const finishBusy=beginBusy();clearLibrary();
 try{if(!await loadSession())return;const saved=await get<{rev:number;library:Library}>(`user:${user.value!.id}`,cache);if(saved){library.value=saved.library;rev=saved.rev;}try{await sync();}catch(error){if(!offlineMode.value)throw error;}}finally{busy.value=false;finishBusy();}
}
setInterval(()=>{if(authStatus.value==='signedIn'&&document.visibilityState==='visible')sync().catch(()=>{});},30000);
addEventListener('focus',()=>{if(authStatus.value==='signedIn')sync().catch(()=>{});});

addEventListener('wh-media-forbidden',event=>{const detail=(event as CustomEvent<{id:string;status:number}>).detail,id=detail.id,data=library.value;dispatchEvent(new CustomEvent('wh-purge-tracks',{detail:[id]}));toast(detail.status===403?'A track is no longer shared.':'A track is no longer available.');library.value={...data,tracks:data.tracks.filter(row=>row.id!==id),playlistItems:data.playlistItems.filter(row=>row.track_id!==id),likes:data.likes.filter(row=>row.track_id!==id),moments:data.moments.filter(row=>row.track_id!==id)};navigator.serviceWorker?.controller?.postMessage({type:'PURGE_TRACKS',ids:[id]});void sync().catch(()=>{});});
