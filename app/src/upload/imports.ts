import {signal,effect} from '@preact/signals';
import {createStore,get,set,keys} from 'idb-keyval';
import {api} from '@backend';
import {json,type Track} from '../api/types';
import {user,accountSettings} from '../library/session';
import {library,sync,toast} from '../library/store';
import {regenerateCovers,type EditResult} from '../library/edits';
import {beginBusy} from '../ui/busy';
import {defaultRules,groupOrganised,type RuleSettings,type Organised,type ExistingAlbum} from './organise';
import type {Analysis} from './types';
import type {MetadataPatch} from '../../../shared/edit-input';
import {sha} from '../../../shared/auth-crypto';
export interface ImportEntry {id:string;filename:string;path:string;size:number;status:string;metadata?:Organised;overrides?:MetadataPatch;peaks?:string|null;trackId?:string;albumId?:string;changeIds:string[];error?:string}
export interface ImportBatch {id:string;owner:string;createdAt:number;rules:RuleSettings;existing:ExistingAlbum[];entries:ImportEntry[];accepted:boolean;settled:boolean;settling:boolean;undone:boolean;changeIds:string[];error?:string}
export const imports=signal<ImportBatch[]>([]),currentImport=signal<string|null>(null);
const store=createStore(`wh-imports-${api.demo?'demo':'http'}`,'history'),prefix=(owner:string)=>import.meta.env.BASE_URL+':'+owner+':',key=(batch:Pick<ImportBatch,'owner'|'id'>)=>prefix(batch.owner)+batch.id;
let serial=Promise.resolve(),account:string|null|undefined;const settling=new Set<string>();
effect(()=>{const next=user.value?.id||null;if(account!==undefined&&account!==next){imports.value=[];currentImport.value=null;}account=next;});
const show=(batch:ImportBatch)=>{if(user.value?.id===batch.owner)imports.value=[batch,...imports.value.filter(row=>row.id!==batch.id)].sort((a,b)=>b.createdAt-a.createdAt);};
export async function loadImports(){const owner=user.value?.id;if(!owner)return;const batches=[];for(const name of await keys(store)){if(typeof name!=='string'||!name.startsWith(prefix(owner)))continue;const batch=await get<ImportBatch>(name,store);if(batch?.owner===owner)batches.push(batch);}if(user.value?.id!==owner)return;imports.value=batches.sort((a,b)=>b.createdAt-a.createdAt);currentImport.value||=imports.value[0]?.id||null;}
async function changeBatch<T>(batchId:string,fn:(batch:ImportBatch)=>T|Promise<T>):Promise<T>{
 const owner=user.value?.id;if(!owner)throw new Error('Sign in to review this import.');
 const operation=async()=>{const batch=await get<ImportBatch>(prefix(owner)+batchId,store);if(!batch||batch.owner!==owner||user.value?.id!==owner)throw new Error('This import is not available for this account.');const result=await fn(batch);if(user.value?.id!==owner)throw new Error('The account changed.');await set(key(batch),batch,store);show(batch);return result;};
 const locked=()=>navigator.locks?navigator.locks.request('wh-import-history:'+prefix(owner)+batchId,operation):operation();const next=serial.then(locked);serial=next.then(()=>{},()=>{});return next;
}
export async function createImport(entries:Omit<ImportEntry,'changeIds'>[]){
 const owner=user.value?.id;if(!owner)throw new Error('Sign in before importing music.');const batch:ImportBatch={id:crypto.randomUUID(),owner,createdAt:Date.now(),rules:{...defaultRules,...accountSettings.value.library_rules as Partial<RuleSettings>},existing:library.value.albums.filter(row=>row.owner_id===owner).map(({id,owner_id,title,artist_name,visibility,sync_visibility})=>({id,owner_id,title,artist_name,visibility,sync_visibility})),entries:entries.map(entry=>({...entry,changeIds:[]})),accepted:false,settled:false,settling:false,undone:false,changeIds:[]};
 await set(key(batch),batch,store);show(batch);if(user.value?.id===owner)currentImport.value=batch.id;return batch.id;
}
function organised(metadata:Analysis['metadata']):Organised {const {title,artist,albumArtist,album,year,genre,trackNo,discNo,organiseSource,fieldSources,fieldConfidence,confidence,explicitAlbumArtist,recordedAt}=metadata;return {title,artist,albumArtist,album,year,genre,trackNo,discNo,organiseSource,fieldSources,fieldConfidence,confidence,explicitAlbumArtist,recordedAt};}
export function importGroups(batch:ImportBatch){return groupOrganised(batch.entries.filter(entry=>entry.metadata).map(entry=>{const m=entry.metadata!,p=entry.overrides||{},metadata={...m,...p,artist:String(p.artist??m.artist),title:String(p.title??m.title),album:String(p.album??m.album),albumArtist:String(p.albumArtist??(Object.hasOwn(p,'albumArtist')?p.artist??m.artist:m.albumArtist)),genre:String(p.genre??''),year:Object.hasOwn(p,'year')?p.year??undefined:m.year,trackNo:Object.hasOwn(p,'trackNo')?p.trackNo??undefined:m.trackNo,discNo:Number(p.discNo??m.discNo),explicitAlbumArtist:Object.hasOwn(p,'albumArtist')||m.explicitAlbumArtist} as Organised;if(!Object.hasOwn(p,'genre'))metadata.genre=m.genre;return {id:entry.id,filename:entry.filename,path:entry.path,metadata};}),{rules:batch.rules,existingAlbums:batch.existing,ownerId:batch.owner});}
export async function updateImportFields(batchId:string,ids:string[],patch:MetadataPatch){await changeBatch(batchId,batch=>{for(const entry of batch.entries)if(ids.includes(entry.id))entry.overrides={...entry.overrides,...patch};batch.settled=false;});await settleImport(batchId);}
export async function rememberImportFields(body:Record<string,unknown>){const ids=body.ids as string[]|undefined;if(!ids?.length)return;for(const batch of imports.value.filter(batch=>!batch.undone&&batch.entries.some(entry=>entry.trackId&&ids.includes(entry.trackId))))await changeBatch(batch.id,batch=>{for(const entry of batch.entries)if(entry.trackId&&ids.includes(entry.trackId)){const perId=body.perId as Record<string,MetadataPatch>|undefined;entry.overrides={...entry.overrides,...body.set as MetadataPatch,...perId?.[entry.trackId]};}});}
export async function recoverImports(){for(const batch of imports.value)if(!batch.undone&&batch.entries.every(terminal)&&(!batch.settled||batch.settling)){await changeBatch(batch.id,row=>{row.settling=false;row.settled=false;});await settleImport(batch.id);}}
export async function recordImportAnalysis(batchId:string,entryId:string,analysis:Analysis){await changeBatch(batchId,batch=>{const entry=batch.entries.find(entry=>entry.id===entryId);if(entry){entry.metadata??=organised(analysis.metadata);entry.peaks=analysis.peaks??null;}});}
export async function prepareImportFile(batchId:string,entryId:string,analysis:Analysis){
 const batch=await get<ImportBatch>(prefix(user.value!.id)+batchId,store);if(!batch||batch.owner!==user.value?.id)throw new Error('This import is not available.');const grouped=importGroups(batch),item=grouped.items.find(item=>item.id===entryId),group=grouped.groups.find(group=>group.items.some(item=>item.id===entryId));if(!item||!group)return analysis;
 const album={...analysis.album,title:group.title,artistName:group.artistName,year:group.year,existingAlbumId:group.existingAlbumId};if(!batch.rules.mergeExisting||!batch.rules.groupAlbums)album.importKey=await sha(batch.id+'\x1f'+group.key);
 return {...analysis,metadata:{...analysis.metadata,...item.metadata},album};
}
export async function recordImportStatus(batchId:string,entryId:string,patch:Partial<Pick<ImportEntry,'status'|'trackId'|'albumId'|'error'>>,changeId?:string|null){await changeBatch(batchId,batch=>{const entry=batch.entries.find(entry=>entry.id===entryId);if(!entry)return;Object.assign(entry,patch);if(!terminal(entry))batch.settled=false;if(changeId&&!entry.changeIds.includes(changeId))entry.changeIds.push(changeId);});}
const terminal=(entry:ImportEntry)=>['Done','Cancelled'].includes(entry.status)||/skipped/i.test(entry.status);
export function canUndoImport(batch:ImportBatch){return !batch.undone&&!batch.settling&&batch.settled&&batch.entries.every(terminal)&&new Set([...batch.changeIds,...batch.entries.flatMap(entry=>entry.changeIds)]).size>0;}
export async function acceptImport(batchId:string){await changeBatch(batchId,batch=>{batch.accepted=true;});}
export async function settleImport(batchId:string){
 if(settling.has(batchId))return;settling.add(batchId);const owner=user.value?.id;let started=false;const finish=beginBusy();
 try{
  const batch=await get<ImportBatch>(prefix(owner||'')+batchId,store);if(!batch||batch.owner!==owner||batch.undone||batch.settled||!batch.entries.every(terminal))return;
  await changeBatch(batchId,batch=>{batch.settling=true;batch.error=undefined;});started=true;await sync();if(user.value?.id!==owner)return;
  const grouped=importGroups(batch),perId:Record<string,MetadataPatch>={},expectedRevs:Record<string,number>={};
  for(const item of grouped.items){const entry=batch.entries.find(entry=>entry.id===item.id),track=entry?.trackId?library.value.tracks.find(track=>track.id===entry.trackId):undefined;if(!track||!entry?.changeIds.length||track.owner_id!==owner)continue;const patch:MetadataPatch={},map:Record<string,keyof Track>={title:'title',artist:'artist_name',albumArtist:'album_artist',album:'album_title',year:'year',genre:'genre',trackNo:'track_no',discNo:'disc_no'};
   for(const[field,column]of Object.entries(map)){const value=(item.metadata as unknown as Record<string,unknown>)[field]??null;if((track[column]??null)!==value)patch[field as keyof MetadataPatch]=value as string|number|null;}if(Object.keys(patch).length){perId[track.id]=patch;expectedRevs[track.id]=track.rev;}
  }
  let parent=batch.changeIds.at(-1)||batch.entries.flatMap(entry=>entry.changeIds)[0];const ids=Object.keys(perId);for(let at=0;at<ids.length;at+=2000){const group=ids.slice(at,at+2000),result=await api.request<EditResult>('/api/tracks',json({ids:group,mergeExisting:batch.rules.mergeExisting&&batch.rules.groupAlbums,perId:Object.fromEntries(group.map(id=>[id,perId[id]])),expectedRevs:Object.fromEntries(group.map(id=>[id,expectedRevs[id]]))},'PATCH'));
   await changeBatch(batchId,batch=>{if(result.changeId&&!batch.changeIds.includes(result.changeId))batch.changeIds.push(result.changeId);});if(result.changeId)parent=result.changeId;
  }
  await sync();const imported=new Set(batch.entries.filter(entry=>entry.changeIds.length).map(entry=>entry.trackId)),albumIds=[...new Set(library.value.tracks.filter(track=>imported.has(track.id)).map(track=>track.album_id))];if(parent)await regenerateCovers({changeId:parent,updated:0,generatedAlbumIds:albumIds},owner);
  await sync();await changeBatch(batchId,batch=>{batch.settled=true;batch.settling=false;batch.error=undefined;});
 }catch(error){if(started&&user.value?.id===owner)await changeBatch(batchId,batch=>{batch.settling=false;batch.settled=true;batch.error=(error as Error).message;});}
 finally{settling.delete(batchId);finish();}
}
export async function undoImport(batchId:string){
 const owner=user.value?.id,finish=beginBusy();try{const batch=await get<ImportBatch>(prefix(owner||'')+batchId,store);if(!batch||batch.owner!==owner||!canUndoImport(batch))throw new Error('Wait for this import to finish before undoing it.');const ids=[...new Set([...batch.changeIds,...batch.entries.flatMap(entry=>entry.changeIds)])];if(ids.length>2000)throw new Error('Undo up to 2000 actions at once from Activity.');await api.request('/api/changes/undo',json({ids}));await changeBatch(batchId,batch=>{batch.undone=true;});await sync();toast('Import undone. Original audio is retained during the Undo period.');}finally{finish();}
}
