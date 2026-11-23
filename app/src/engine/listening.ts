import { createStore,setMany,delMany,type UseStore } from 'idb-keyval';
import type { Api } from '../api/types';
import { json } from '../api/types';
import { playsInput,type PlayInput } from '../../../shared/playback-input';
export type ListeningEvent=PlayInput&{id:string};
export interface ListeningHistory {configure(userId:string|null):void;record(play:ListeningEvent):void;recent(since:number):Promise<ListeningEvent[]>;flush(pagehide?:boolean):void;dispose():void}
export class PlaybackListening implements ListeningHistory {
 private store:UseStore;
 private scope:string|null=null;
 private userId:string|null=null;
 private epoch=0;
 private controller:AbortController|null=null;
 private online=()=>this.flush();
 constructor(private api:Api,private base:string){this.store=createStore(`wh-listening-${api.demo?'demo':'http'}`,'events');addEventListener('online',this.online);}
 configure(userId:string|null){this.epoch++;this.controller?.abort();this.controller=null;this.userId=userId;this.scope=userId?`${this.base}:${userId}:`:null;}
 private historyKey(scope:string,play:ListeningEvent){return `${scope}history:${String(play.startedAt).padStart(16,'0')}:${play.id}`;}
 record(play:ListeningEvent){
  if(!this.scope)return;const scope=this.scope,epoch=this.epoch;
  void setMany([[`${scope}pending:${play.id}`,play],[this.historyKey(scope,play),play]],this.store).then(()=>{if(epoch===this.epoch)this.flush();}).catch(()=>{});
 }
 private async scan(prefix:string,limit:number,reverse=false,from=''){
  return this.store('readonly',store=>new Promise<{key:IDBValidKey;value:ListeningEvent}[]>((resolve,reject)=>{
   const rows:{key:IDBValidKey;value:ListeningEvent}[]=[],request=store.openCursor(IDBKeyRange.bound(prefix+from,prefix+'\uffff'),reverse?'prev':'next');
   request.onerror=()=>reject(request.error);request.onsuccess=()=>{const cursor=request.result;if(!cursor||rows.length>=limit){resolve(rows);return;}rows.push({key:cursor.key,value:cursor.value as ListeningEvent});cursor.continue();};
  }));
 }
 async recent(since:number){
  if(!this.scope)return [];const scope=this.scope,epoch=this.epoch,userId=this.userId;let cursor:string|null=null,pages=0;
  try{do{
   const page:{items:Record<string,unknown>[];nextCursor:string|null}=await this.api.request(`/api/plays?limit=500${cursor?'&cursor='+encodeURIComponent(cursor):''}`);if(epoch!==this.epoch)return [];
   const rows:ListeningEvent[]=[];for(const row of page.items){if(row.user_id!==userId)continue;try{const play=playsInput({plays:[{id:row.id,trackId:row.track_id,startedAt:row.started_at,msPlayed:row.ms_played,completed:!!row.completed,skipped:!!row.skipped,context:row.context,deviceLabel:row.device_label} ]})[0];rows.push(play as ListeningEvent);}catch{/* Ignore malformed old history. */}}
   if(rows.length)await setMany(rows.map(play=>[this.historyKey(scope,play),play]),this.store);
   cursor=page.nextCursor;if(page.items.length&&Number(page.items.at(-1)!.started_at)<since)break;
  }while(cursor&&++pages<10);}catch{/* Listening remains local while the server is unavailable. */}
  if(epoch!==this.epoch)return [];return (await this.scan(scope+'history:',5000,true,String(since).padStart(16,'0'))).map(row=>row.value);
 }
 flush(pagehide=false){
  if(!this.scope||this.controller)return;const scope=this.scope,epoch=this.epoch,controller=new AbortController();this.controller=controller;
  void(async()=>{while(epoch===this.epoch){let rows=await this.scan(scope+'pending:',100);if(!rows.length||epoch!==this.epoch)break;
   if(pagehide){const selected:typeof rows=[],encoder=new TextEncoder();let size=12;for(const row of rows){const bytes=encoder.encode(JSON.stringify(row.value)).byteLength+(selected.length?1:0);if(size+bytes>=12*1024)break;selected.push(row);size+=bytes;}rows=selected;if(!rows.length)break;}
   const init=json({plays:rows.map(row=>row.value)});try{
    await this.api.request('/api/plays',{...init,signal:controller.signal,keepalive:pagehide});
    if(epoch!==this.epoch)break;await delMany(rows.map(row=>row.key),this.store);if(pagehide)break;
   }catch{break;}}})().catch(()=>{}).finally(()=>{if(this.controller===controller)this.controller=null;});
 }
 dispose(){this.controller?.abort();removeEventListener('online',this.online);}
}
