import { signal } from '@preact/signals';
import { createStore,get,set } from 'idb-keyval';
import { api } from '@backend';
import { emptyLibrary,type Library,type LibraryDelta,type User } from '../api/types';
const cache=createStore(`wh-library-${api.demo?'demo':'http'}`,'library');
export const library=signal<Library>(emptyLibrary()),user=signal<User|null>(null),busy=signal(true),notice=signal('');
let rev=0,syncing:Promise<void>|null=null,timer:ReturnType<typeof setTimeout>;
export function toast(message:string){notice.value=message;clearTimeout(timer);timer=setTimeout(()=>{notice.value='';},6500);}
export async function sync(){if(syncing)return syncing;syncing=(async()=>{
 let more=true;while(more){const delta=await api.request<LibraryDelta>(`/api/library?since=${rev}`),next={...library.value};
  for(const key of Object.keys(next) as (keyof Library)[]){const map=new Map((next[key] as unknown as Record<string,unknown>[]).map(r=>[String(r.id||`${r.user_id||r.playlist_id}:${r.track_id}`),r]));
   for(const r of delta.items[key] as unknown as Record<string,unknown>[]) {const k=String(r.id||`${r.user_id||r.playlist_id}:${r.track_id}`);if(r.deleted)map.delete(k);else map.set(k,r);}
   (next[key] as unknown[])=Array.from(map.values());
  }
  for(const key of ['tracks','albums','playlists'] as const)next[key]=next[key].filter(r=>!delta.hidden[key].includes(r.id)) as never;
  const hidden=delta.hidden.tracks;if(hidden.length)navigator.serviceWorker?.controller?.postMessage({type:'PURGE_TRACKS',ids:hidden});
  library.value=next;rev=delta.rev;more=delta.more;
 }await set('snapshot',{rev,library:library.value},cache);
 })().finally(()=>{syncing=null;});return syncing;}
export async function bootLibrary(){
 try{const saved=await get<{rev:number;library:Library}>('snapshot',cache);if(saved){library.value=saved.library;rev=saved.rev;}const me=await api.request<{user:User}>('/api/auth/me');user.value=me.user;await sync();}finally{busy.value=false;document.body.dataset.busy='false';}
 setInterval(()=>{if(document.visibilityState==='visible')sync().catch(()=>{});},60000);
 addEventListener('focus',()=>sync().catch(()=>{}));
}
