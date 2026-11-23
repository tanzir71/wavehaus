import { createStore,get,set } from 'idb-keyval';
import type { Api } from '../api/types';
import { json } from '../api/types';
import { playerInput,type PlayerSnapshot } from '../../../shared/playback-input';
import { cloudSnapshot } from './snapshot';

export interface PlayerPersistence {configure(userId:string|null):void;read():Promise<PlayerSnapshot|null>;write(snapshot:PlayerSnapshot,remote?:boolean,pagehide?:boolean):void;flush():void;dispose():void}
export class PlaybackPersistence implements PlayerPersistence {
 private store;
 private key:string|null=null;
 private legacyKey:string|null=null;
 private epoch=0;
 private writes=0;
 private pending:PlayerSnapshot|null=null;
 private request:AbortController|null=null;
 private lastWrite=0;
 private warned=false;
 private online=()=>this.flush();
 constructor(private api:Api,private base:string,private onStorageError:()=>void=()=>{}){this.store=createStore(`wh-playback-${api.demo?'demo':'http'}`,'state');addEventListener('online',this.online);}
 configure(userId:string|null){this.epoch++;this.request?.abort();this.request=null;this.pending=null;this.key=userId?`${this.base}:${userId}`:null;this.legacyKey=userId?`wh-player-${this.api.demo?'demo':'http'}:${userId}`:null;this.warned=false;this.lastWrite=0;}
 private clean(value:unknown){try{return value&&typeof value==='object'?playerInput(value as Record<string,unknown>,50000):null;}catch{return null;}}
 async read(){
  if(!this.key)return null;const key=this.key,epoch=this.epoch,writes=this.writes;
  const [local,legacy,remote]=await Promise.all([get(key,this.store).catch(()=>null),get(this.legacyKey!).catch(()=>null),this.api.request('/api/player-state').catch(()=>null)]);
  if(epoch!==this.epoch||writes!==this.writes)return null;const snapshots=[local,legacy,remote].map(value=>this.clean(value)).filter((value):value is PlayerSnapshot=>!!value).sort((a,b)=>b.updatedAt-a.updatedAt),latest=snapshots[0]||null;
  if(latest){this.lastWrite=latest.updatedAt;void set(key,latest,this.store).catch(()=>this.storageError());}
  return latest;
 }
 write(snapshot:PlayerSnapshot,remote=false,pagehide=false){
  if(!this.key)return;this.writes++;const key=this.key,updatedAt=Math.max(snapshot.updatedAt,this.lastWrite+1);this.lastWrite=updatedAt;const local={...snapshot,updatedAt};
  void set(key,local,this.store).catch(()=>this.storageError());
  if(!remote)return;this.pending=cloudSnapshot(local);
  if(pagehide){
   const value=this.pending,init=json(value,'PUT');
   // Keepalive has a small shared body budget. Larger snapshots remain local
   // and are sent by normal requests; the server rejects older timestamps.
   if(new TextEncoder().encode(String(init.body)).byteLength<48*1024)void this.api.request('/api/player-state',{...init,keepalive:true}).catch(()=>{});
   return;
  }
  this.flush();
 }
 flush(){
  if(!this.key||!this.pending||this.request)return;
  const epoch=this.epoch,controller=new AbortController();this.request=controller;
  void(async()=>{while(this.pending&&epoch===this.epoch){const value=this.pending;try{await this.api.request('/api/player-state',{...json(value,'PUT'),signal:controller.signal});if(this.pending===value)this.pending=null;}catch{break;}}})().finally(()=>{if(this.request===controller)this.request=null;});
 }
 private storageError(){if(!this.warned){this.warned=true;this.onStorageError();}}
 dispose(){this.request?.abort();removeEventListener('online',this.online);}
}
