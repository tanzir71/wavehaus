import { signal } from '@preact/signals';
import { createStore,get,set,del,keys } from 'idb-keyval';
import { api } from '@backend';
import { json,type Album,type Track } from '../api/types';
import { organise } from './organise';
import { peaksFromChannels } from '../demo/music';
import { coverPng } from '../library/covers';
import { sync } from '../library/store';
export interface UploadItem { id:string;name:string;status:string;progress:number;track?:Track;album?:Album;error?:string }
export const uploads=signal<UploadItem[]>([]),uploadBusy=signal(false);
const pending=createStore('wh-pending-uploads','files');
const hex=(buf:ArrayBuffer)=>Array.from(new Uint8Array(buf),b=>b.toString(16).padStart(2,'0')).join('');
const hashBlob=async(blob:Blob)=>hex(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()));
const update=(id:string,values:Partial<UploadItem>)=>{uploads.value=uploads.value.map(x=>x.id===id?{...x,...values}:x);};
interface Job { file:File;visibility:'private'|'public';uploadId?:string;hash?:string }
export async function intake(files:File[],visibility:'private'|'public'='private'){
 for(const file of files){const id=crypto.randomUUID();await set(id,{file,visibility} satisfies Job,pending);uploads.value=[...uploads.value,{id,name:file.name,status:'Queued',progress:0}];}await processQueue();
}
export async function resumePending(){for(const key of await keys(pending)){const job=await get<Job>(key,pending);if(job&&!uploads.value.some(i=>i.id===key))uploads.value=[...uploads.value,{id:String(key),name:job.file.name,status:'Queued',progress:0}];}await processQueue();}
async function processQueue(){if(uploadBusy.value)return;uploadBusy.value=true;document.body.dataset.busy='true';try{for(const item of uploads.value.filter(i=>i.status==='Queued'))await run(item.id);}finally{uploadBusy.value=false;document.body.dataset.busy='false';}}
async function run(id:string){const job=(await get<Job>(id,pending))!,file=job.file;try{
 if(!/\.(mp3|flac|m4a|alac|opus|ogg|wav|aiff?)$/i.test(file.name)){update(id,{status:'Skipped: not audio'});await del(id,pending);return;}
 update(id,{status:'Analysing'});const size=new TextEncoder().encode(String(file.size)),quick=await hashBlob(new Blob([file.slice(0,1024**2),file.slice(Math.max(0,file.size-1024**2)),size]));
 const check=await api.request<{duplicates:string[]}>('/api/uploads/check',json({items:[{quickHash:quick,size:file.size}]}));if(check.duplicates.includes(quick)){update(id,{status:'Duplicate — skipped'});await del(id,pending);return;}
 const {parseBlob}=await import('music-metadata');const parsed=await parseBlob(file,{duration:true,skipCovers:false});const fields=organise(file.name,file.webkitRelativePath||file.name,parsed.common as unknown as Record<string,unknown>);let peaks:string|null=null;
 const nav=navigator as Navigator&{deviceMemory?:number;connection?:{saveData?:boolean}};
 if(file.size<=80*1024**2&&(nav.deviceMemory||4)>=4&&!nav.connection?.saveData){try{const context=new OfflineAudioContext(1,1,16000);const audio=await context.decodeAudioData(await file.arrayBuffer());peaks=peaksFromChannels(Array.from({length:audio.numberOfChannels},(_,i)=>audio.getChannelData(i)));}catch{/* The browser can still stream formats it cannot decode for peaks. */}}
 const digest=job.hash||await hashBlob(file);const start=job.uploadId?{uploadId:job.uploadId,...await api.request<{chunkBytes?:number;partsReceived:number[]}>(`/api/uploads/${job.uploadId}`)}:await api.request<{uploadId:string;chunkBytes:number;partsReceived:number[]}>('/api/uploads',json({filename:file.name,size:file.size,sha256:digest,mime:file.type||`audio/${file.name.split('.').pop()}`}));job.hash=digest;job.uploadId=start.uploadId;await set(id,job,pending);
 const chunkBytes=start.chunkBytes||8*1024**2,count=Math.ceil(file.size/chunkBytes);let done=start.partsReceived.length;
 for(let n=1;n<=count;n++){if(start.partsReceived.includes(n))continue;update(id,{status:`Uploading ${Math.round(done/count*100)}%`,progress:done/count});let error:unknown;for(let attempt=0;attempt<5;attempt++){try{await api.request(`/api/uploads/${start.uploadId}/parts/${n}`,{method:'PUT',body:file.slice((n-1)*chunkBytes,n*chunkBytes)});error=null;break;}catch(e){error=e;await new Promise(r=>setTimeout(r,Math.min(8000,500*2**attempt)));}}if(error)throw error;done++;}
 const result=await api.request<{track:Track;album:Album}>(`/api/uploads/${start.uploadId}/complete`,json({metadata:{...fields,durationMs:Math.round((parsed.format.duration||0)*1000),codec:parsed.format.codec,container:parsed.format.container,sampleRate:parsed.format.sampleRate,bitrate:parsed.format.bitrate,channels:parsed.format.numberOfChannels,quickHash:quick,originalPath:file.webkitRelativePath||file.name,lyrics:parsed.common.lyrics?.[0]?.text},album:{title:fields.album,artistName:fields.albumArtist,year:fields.year,folderPath:(file.webkitRelativePath||'').split('/').slice(0,-1).join('/')},peaks,visibility:job.visibility}));
 const form=new FormData();form.set('generated512',await coverPng(result.album.title,result.album.artist_name,peaks),'generated-512.png');await api.request(`/api/albums/${result.album.id}/art`,{method:'PUT',body:form});await sync();update(id,{status:'Done',progress:1,...result});await del(id,pending);
 }catch(error){const message=(error as Error).message;update(id,{status:message.includes('Already')?'Duplicate — skipped':'Failed',error:message});if(message.includes('Already'))await del(id,pending);}}
