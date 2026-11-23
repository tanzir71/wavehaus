import { effect,signal } from '@preact/signals';
import { createStore,get,set,del,keys } from 'idb-keyval';
import { api } from '@backend';
import { ApiError,json,type Album,type Track,type Visibility } from '../api/types';
import { config,user,accountSettings } from '../library/session';
import { insertUpload,library,sync } from '../library/store';
import { beginBusy } from '../ui/busy';
import { peaksFromChannels } from '../demo/music';
import { artwork } from './artwork';
import { sidecars } from './files';
import type { Analysis,PickedFile } from './types';
export interface UploadItem {id:string;name:string;size:number;status:string;progress:number;part?:number;parts?:number;analysis?:Analysis;track?:Track;album?:Album;error?:string;retryable?:boolean}
export const uploads=signal<UploadItem[]>([]),uploadBusy=signal(false),keepAwake=signal(localStorage.getItem('wh-upload-awake')!=='false');
const pending=createStore(`wh-pending-uploads-${api.demo?'demo':'http'}`,'files'),running=new Map<string,AbortController>();
const scope=()=>`${import.meta.env.BASE_URL}:${user.value?.id}:`,hex=(buffer:ArrayBuffer)=>Array.from(new Uint8Array(buffer),b=>b.toString(16).padStart(2,'0')).join('');
const update=(id:string,values:Partial<UploadItem>)=>{uploads.value=uploads.value.map(item=>item.id===id?{...item,...values}:item);};
interface Job {file:File;path:string;owner:string;visibility:Visibility;uploadId?:string;hash?:string;quickHash?:string;analysis?:Analysis;sidePicture?:Blob;lyrics?:string;track?:Track;album?:Album;duplicate?:boolean;force?:boolean}
let wake:WakeLockSentinel|null=null,wakeRequest=false,paused=false,enqueuing=0,account:string|null=null,decodeQueue=Promise.resolve();
const aborted=()=>new DOMException('Upload paused.','AbortError');
const delay=(ms:number,signal:AbortSignal)=>new Promise<void>((resolve,reject)=>{signal.throwIfAborted();const abort=()=>{clearTimeout(timer);reject(aborted());},timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);signal.addEventListener('abort',abort,{once:true});});
async function retry<T>(operation:()=>Promise<T>,signal:AbortSignal){for(let attempt=0;;attempt++){signal.throwIfAborted();try{return await operation();}catch(error){if(signal.aborted)throw aborted();const transient=!(error instanceof ApiError)||[408,429,500,502,503,504].includes(error.status)||error.code==='upload_busy';if(!transient||attempt>=4)throw error;await delay(Math.min(30000,Math.max(500*2**attempt,((error as ApiError).retryAfter||0)*1000)),signal);}}}
async function maintainWake(){
 const needed=keepAwake.value&&uploadBusy.value&&document.visibilityState==='visible';
 if(!needed){await wake?.release().catch(()=>{});wake=null;return;}
 if(wake&&!wake.released||wakeRequest||!navigator.wakeLock)return;wakeRequest=true;
 try{const acquired=await navigator.wakeLock.request('screen');if(!keepAwake.value||!uploadBusy.value){await acquired.release();return;}wake=acquired;acquired.addEventListener('release',()=>{if(wake===acquired)wake=null;});}catch{/* Uploads resume even if the OS denies a wake lock. */}finally{wakeRequest=false;}
}
effect(()=>{localStorage.setItem('wh-upload-awake',String(keepAwake.value));void maintainWake();});
addEventListener('visibilitychange',()=>{void maintainWake();});
effect(()=>{const next=user.value?.id||null;if(account!==next){account=next;for(const controller of running.values())controller.abort();uploads.value=[];paused=false;}});
export async function intake(input:(File|PickedFile)[],visibility:Visibility='private'){
 const owner=user.value?.id;if(!owner)throw new Error('Sign in before adding music.');
 if(user.value?.role==='listener')throw new Error('Ask the server owner for upload access.');
 if(visibility==='public'&&accountSettings.value.upload_visibility_locked===true)throw new Error('New uploads are locked to Private on this server.');
 const picked=input.map(item=>item instanceof File?{file:item,path:item.webkitRelativePath||item.name}:item),audio=picked.filter(item=>/\.(mp3|flac|m4a|alac|opus|ogg|wav|aiff?)$/i.test(item.file.name));
 const finishBusy=beginBusy();enqueuing++;paused=false;processQueue();try{
 for(const item of picked){
  if(user.value?.id!==owner)return;
  const id=scope()+crypto.randomUUID(),supported=audio.includes(item),isSidecar=/\.(lrc|png|jpe?g|webp)$/i.test(item.file.name);
  if(!supported){if(!isSidecar)uploads.value=[...uploads.value,{id,name:item.file.name,size:item.file.size,status:'Skipped: not audio',progress:0}];continue;}
  if(config.value&&item.file.size>config.value.maxFileBytes){uploads.value=[...uploads.value,{id,name:item.file.name,size:item.file.size,status:'Skipped: too large',progress:0,error:`The server accepts files up to ${Math.floor(config.value.maxFileBytes/1024**2)} MB.`}];continue;}
  const attached=sidecars(item,picked),job:Job={...item,owner,visibility,sidePicture:attached.picture,lyrics:attached.lyrics?(await attached.lyrics.text()).slice(0,200000):undefined};
  uploads.value=[...uploads.value,{id,name:item.file.name,size:item.file.size,status:'Saving resume copy',progress:0}];
  try{await set(id,job,pending);}catch(error){update(id,{status:'Failed',error:'Could not save a resume copy. Free browser storage, then choose this file again.'});throw error;}
  if(user.value?.id!==owner)return;update(id,{status:paused?'Paused':'Queued',retryable:paused});processQueue();
 }
 }finally{enqueuing--;finishBusy();processQueue();}
}
export async function resumePending(){const owner=user.value?.id;if(!owner)return;for(const key of await keys(pending)){if(typeof key!=='string'||!key.startsWith(scope()))continue;const job=await get<Job>(key,pending);if(job&&job.owner===owner&&!uploads.value.some(item=>item.id===key))uploads.value=[...uploads.value,{id:key,name:job.file.name,size:job.file.size,status:job.duplicate&&!job.force?'Already in library — skipped':'Queued',progress:0,analysis:job.analysis}];}paused=false;processQueue();}
export async function uploadAnyway(id:string){const job=await get<Job>(id,pending);if(!job||job.owner!==user.value?.id)return;job.force=true;await set(id,job,pending);update(id,{status:'Queued',error:undefined});paused=false;processQueue();}
export function pauseUploads(){paused=true;for(const controller of running.values())controller.abort();for(const item of uploads.value)if(item.status==='Queued')update(item.id,{status:'Paused',retryable:true});}
export function retryUpload(id?:string){paused=false;for(const item of uploads.value)if((!id||item.id===id)&&item.retryable)update(item.id,{status:'Queued',error:undefined,retryable:false});processQueue();}
export async function cancelUpload(id:string){const job=await get<Job>(id,pending);running.get(id)?.abort();await del(id,pending);update(id,{status:'Cancelled',retryable:false,error:undefined});if(job?.uploadId&&!job.track)await api.request(`/api/uploads/${job.uploadId}`,{method:'DELETE'}).catch(()=>{});}
function processQueue(){
 if(!paused&&user.value)for(const item of uploads.value){if(running.size>=3)break;if(item.status!=='Queued'||running.has(item.id))continue;const controller=new AbortController();running.set(item.id,controller);void run(item.id,controller.signal).finally(()=>{running.delete(item.id);processQueue();});}
 uploadBusy.value=running.size>0||enqueuing>0;void maintainWake();
}
function analyse<T>(file:File,path:string,signal:AbortSignal,quickOnly=false,onProgress?:(progress:number)=>void){return new Promise<T>((resolve,reject)=>{
 const worker=new Worker(new URL('./analyse.worker.ts',import.meta.url),{type:'module'}),close=()=>{worker.terminate();signal.removeEventListener('abort',abort);},abort=()=>{close();reject(aborted());};
 worker.onmessage=event=>{if('progress'in event.data){onProgress?.(event.data.progress);return;}close();if(event.data.ok)resolve(event.data.result);else reject(new ApiError(event.data.error.code||'analysis',event.data.error.message,event.data.error.status||400));};worker.onerror=()=>{close();reject(new Error('Could not load the upload tools. Connect once, then retry.'));};signal.addEventListener('abort',abort,{once:true});if(signal.aborted){abort();return;}worker.postMessage({file,path,quickOnly});
 });}
async function peaks(file:File,analysis:Analysis,signal:AbortSignal){
 const nav=navigator as Navigator&{deviceMemory?:number;connection?:{saveData?:boolean}},estimated=analysis.metadata.durationMs/1000*(analysis.metadata.sampleRate||48000)*(analysis.metadata.channels||2)*4;
 if(file.size>80*1024**2||(nav.deviceMemory??4)<4||nav.connection?.saveData||estimated>128*1024**2)return null;
 let result:string|null=null;const work=decodeQueue.then(async()=>{signal.throwIfAborted();try{const context=new OfflineAudioContext(1,1,16000),audio=await context.decodeAudioData(await file.arrayBuffer());signal.throwIfAborted();result=peaksFromChannels(Array.from({length:audio.numberOfChannels},(_,i)=>audio.getChannelData(i)));}catch(error){if(signal.aborted)throw error;}});decodeQueue=work.catch(()=>{});await work;return result;
}
async function run(id:string,signal:AbortSignal){
 const finishBusy=beginBusy();let job:Job|undefined;
 const persist=async()=>{signal.throwIfAborted();if(!job||user.value?.id!==job.owner)throw aborted();await set(id,job,pending);};
 try{
  job=await get<Job>(id,pending);if(!job||job.owner!==user.value?.id)throw aborted();const file=job.file;
  if(!job.analysis){
   update(id,{status:'Checking file'});job.quickHash=job.quickHash||await analyse<string>(file,job.path,signal,true);
   const check=await retry(()=>api.request<{duplicates:string[]}>('/api/uploads/check',{...json({items:[{quickHash:job!.quickHash,size:file.size}]}),signal}),signal);
   if(!job.force&&check.duplicates.includes(job.quickHash)){job.duplicate=true;await persist();update(id,{status:'Already in library — skipped',progress:1});return;}
   update(id,{status:'Reading tags'});job.analysis=await analyse<Analysis>(file,job.path,signal,false,progress=>update(id,{status:`Hashing ${Math.round(progress*100)}%`}));job.hash=job.analysis.hash;job.analysis.metadata.quickHash=job.quickHash;
   if(job.lyrics){job.analysis.metadata.lyrics=job.lyrics;job.analysis.metadata.lyricsSynced=/\[\d{1,3}:\d{2}(?:[.:]\d+)?\]/.test(job.lyrics);}
   update(id,{status:'Drawing waveform',analysis:job.analysis});job.analysis.peaks=await peaks(file,job.analysis,signal);await persist();
  }
  const analysis=job.analysis;update(id,{analysis});
  if(!job.track){
   type Start={uploadId:string;chunkBytes:number;partsReceived:number[];status?:string};let start:Start;
   try{start=job.uploadId?{uploadId:job.uploadId,...await retry(()=>api.request<Omit<Start,'uploadId'>>(`/api/uploads/${job!.uploadId}`,{signal}),signal)}:await retry(()=>api.request<Start>('/api/uploads',{...json({filename:file.name,size:file.size,sha256:analysis.hash,mime:analysis.mime}),signal}),signal);}catch(error){if(error instanceof ApiError&&['not_found','upload_closed'].includes(error.code)){job.uploadId=undefined;await persist();}throw error;}
   if(start.status==='aborted'){job.uploadId=undefined;await persist();throw new ApiError('upload_closed','This upload was cancelled. Retry to start again.',409);}
   job.uploadId=start.uploadId;await persist();const count=Math.ceil(file.size/start.chunkBytes),received=new Set(start.partsReceived);let next=1;
   const progress=()=>{const done=Array.from(received).reduce((sum,n)=>sum+Math.min(start.chunkBytes,file.size-(n-1)*start.chunkBytes),0);update(id,{status:'Uploading',progress:done/file.size,part:received.size,parts:count});};progress();
   if(start.status!=='complete'){
    let failure:unknown;const parts=await Promise.allSettled([0,1].map(async()=>{try{while(next<=count&&!failure){const n=next++;if(received.has(n))continue;signal.throwIfAborted();const blob=file.slice((n-1)*start.chunkBytes,n*start.chunkBytes),partHash=hex(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()));await retry(()=>api.request(`/api/uploads/${start.uploadId}/parts/${n}`,{method:'PUT',headers:{'Content-Type':'application/octet-stream','X-Wavehaus-Part-SHA256':partHash},body:blob,signal}),signal);received.add(n);progress();}}catch(error){failure=error;throw error;}}));
    const failed=parts.find(result=>result.status==='rejected');if(failed?.status==='rejected')throw failed.reason;
   }
   update(id,{status:'Verifying upload'});const result=await retry(()=>api.request<{track:Track;album:Album}>(`/api/uploads/${start.uploadId}/complete`,{...json({metadata:analysis.metadata,album:analysis.album,peaks:analysis.peaks??null,visibility:job!.visibility}),signal}),signal);job.track=result.track;job.album=result.album;await persist();insertUpload(result.track,result.album);update(id,result);
  }
  const album=job.album!;const current=library.value.albums.find(a=>a.id===album.id)||album;
  // Existing real covers win over later tracks with no artwork.
  if(!current.art_key||current.art_source==='generated'){
   update(id,{status:'Saving artwork'});const picture=analysis.picture||job.sidePicture,form=await artwork(album.title,album.artist_name,analysis.peaks??null,picture,analysis.picture?'embedded':'folder');
   await retry(()=>api.request(`/api/albums/${album.id}/art`,{method:'PUT',body:form,signal}),signal);
  }
  await sync();update(id,{status:'Done',progress:1,track:job.track,album:job.album,error:undefined,retryable:false});await del(id,pending);
 }catch(error){if(uploads.value.find(item=>item.id===id)?.status==='Cancelled')return;const stopped=signal.aborted||error instanceof DOMException&&error.name==='AbortError';update(id,{status:stopped?'Paused':'Failed',error:stopped?undefined:(error as Error).message,retryable:true});}
 finally{finishBusy();}
}
