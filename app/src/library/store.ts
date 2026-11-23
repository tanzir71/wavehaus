import { signal } from '@preact/signals';
import { createStore,get,set } from 'idb-keyval';
import { api } from '@backend';
import { emptyLibrary,type Library,type LibraryDelta } from '../api/types';
import { user,authStatus,loadSession } from './session';
export { user } from './session';
const cache=createStore(`wh-library-${api.demo?'demo':'http'}`,'library');
export const library=signal<Library>(emptyLibrary()),busy=signal(true),notice=signal('');
let rev=0,syncing:Promise<void>|null=null,syncEpoch=0,timer:ReturnType<typeof setTimeout>;
export function toast(message:string){notice.value=message;clearTimeout(timer);timer=setTimeout(()=>{notice.value='';},6500);}
export function clearLibrary(){syncEpoch++;syncing=null;rev=0;library.value=emptyLibrary();}
export async function sync(){if(!user.value)return;if(syncing)return syncing;const epoch=syncEpoch,userId=user.value.id;const operation=(async()=>{
 let more=true;while(more){const delta=await api.request<LibraryDelta>(`/api/library?since=${rev}`),next={...library.value};
  if(epoch!==syncEpoch||user.value?.id!==userId)return;
  for(const key of Object.keys(next) as (keyof Library)[]){const map=new Map((next[key] as unknown as Record<string,unknown>[]).map(r=>[String(r.id||`${r.user_id||r.playlist_id}:${r.track_id}`),r]));
   for(const r of delta.items[key] as unknown as Record<string,unknown>[]) {const k=String(r.id||`${r.user_id||r.playlist_id}:${r.track_id}`);if(r.deleted)map.delete(k);else map.set(k,r);}
   (next[key] as unknown[])=Array.from(map.values());
  }
  for(const key of ['tracks','albums','playlists'] as const)next[key]=next[key].filter(r=>!delta.hidden[key].includes(r.id)) as never;
  const hidden=delta.hidden.tracks;if(hidden.length)navigator.serviceWorker?.controller?.postMessage({type:'PURGE_TRACKS',ids:hidden});
  library.value=next;rev=delta.rev;more=delta.more;
 }if(epoch===syncEpoch&&user.value?.id===userId)await set(`user:${userId}`,{rev,library:library.value},cache);
 })();syncing=operation;operation.finally(()=>{if(syncing===operation)syncing=null;}).catch(()=>{});return operation;}
export async function bootLibrary(){
 busy.value=true;document.body.dataset.busy='true';clearLibrary();
 try{if(!await loadSession())return;const saved=await get<{rev:number;library:Library}>(`user:${user.value!.id}`,cache);if(saved){library.value=saved.library;rev=saved.rev;}await sync();}finally{busy.value=false;document.body.dataset.busy='false';}
}
setInterval(()=>{if(authStatus.value==='signedIn'&&document.visibilityState==='visible')sync().catch(()=>{});},60000);
addEventListener('focus',()=>{if(authStatus.value==='signedIn')sync().catch(()=>{});});
