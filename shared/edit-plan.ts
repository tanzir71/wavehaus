import {editInput,type MetadataPatch} from './edit-input';
import {journalOp,JournalConflict,type JournalOp,type JournalRow,type JournalWrite,type RowGuard,type CountGuard} from './journal';
import {UploadError,normalized,coverHash} from './upload-input';
export const metadataTrackColumns=['id','rev','deleted','owner_id','album_id','artist_id','title','artist_name','album_artist','album_title','track_no','disc_no','year','genre','visibility','organise_source'] as const;
export interface AlbumIdentity {ownerId:string;key:string;artistName:string;title:string}
export interface MetadataRepository {
 tracks(ids:string[]):Promise<JournalRow[]>;
 albums(ids:string[]):Promise<JournalRow[]>;
 targets(identities:AlbumIdentity[]):Promise<JournalRow[]>;
 artists(keys:string[]):Promise<JournalRow[]>;
 counts(ids:string[]):Promise<Map<string,number>>;
}
export interface EditContext {userId:string;role:string;id():string;hash(value:string):Promise<string>;now?:number}
const columns:Record<string,string>={title:'title',artist:'artist_name',albumArtist:'album_artist',album:'album_title',year:'year',genre:'genre',trackNo:'track_no',discNo:'disc_no'};
const name=(value:unknown,fallback='')=>typeof value==='string'&&value?value:fallback;
const albumArtist=(album:JournalRow|undefined,fallback:string)=>name(album?.artist_name,name(album?.dictionary_artist_name,fallback));
const tint=(artist:string,album:string)=>coverHash(artist.toLowerCase()+'|'+album.toLowerCase())%6;
const unique=(values:string[])=>[...new Set(values)];
interface Prepared {before:JournalRow;after:JournalRow;patch:MetadataPatch;source?:JournalRow;artist:string;albumArtist:string;title:string;key:string;alias:string;identityChanged:boolean}

/** Metadata decisions shared by the Worker and browser demo; no UI or bytes. */
export async function metadataPlan(input:ReturnType<typeof editInput>,repo:MetadataRepository,context:EditContext){
 if(context.role==='listener')throw new UploadError('forbidden','Your account cannot edit library metadata.',403);
 const loaded=await repo.tracks(input.ids),byId=new Map(loaded.map(row=>[row.id,row]));if(input.ids.some(id=>!byId.has(id)||byId.get(id)!.deleted))throw new UploadError('not_found','A selected track was not found.',404);
 const admin=['owner','admin'].includes(context.role);if(!admin&&loaded.some(row=>row.owner_id!==context.userId))throw new UploadError('forbidden','Choose tracks that belong to you.',403);
 const stale=loaded.filter(row=>Object.hasOwn(input.expectedRevs,row.id)&&input.expectedRevs[row.id]!==row.rev);if(stale.length)throw new JournalConflict(stale.map(row=>({table:'tracks',id:row.id})));
 const sourceIds=unique(loaded.map(row=>name(row.album_id)).filter(Boolean)),sourceAlbums=new Map((await repo.albums(sourceIds)).filter(row=>!row.deleted).map(row=>[row.id,row])),counts=await repo.counts(sourceIds),prepared:Prepared[]=[],hashes=new Map<string,Promise<string>>();
 const forced=input.targetAlbumId?(await repo.albums([input.targetAlbumId])).find(row=>!row.deleted):undefined;if(input.targetAlbumId&&!forced)throw new UploadError('not_found','Target album not found.',404);if(forced&&loaded.some(row=>row.owner_id!==forced.owner_id))throw new UploadError('forbidden','Merge albums belonging to the same uploader.',403);
 const identity=(artist:string,title:string)=>{const value=normalized(artist)+'\x1f'+normalized(title);let key=hashes.get(value);if(!key){key=context.hash(value);hashes.set(value,key);}return key;};
 for(const id of input.ids){
  const before=byId.get(id)!,source=sourceAlbums.get(name(before.album_id)),patch={...input.set,...input.perId[id]},after={...before};
  if(source&&source.owner_id!==before.owner_id)throw new UploadError('conflict','Track and album ownership do not match.',409);
  for(const[field,value]of Object.entries(patch))after[columns[field]]=value;
  if(forced){after.album_title=forced.title;after.album_artist=albumArtist(forced,name(after.artist_name,'Unknown artist'));}
  const artist=name(after.artist_name,'Unknown artist');if(Object.hasOwn(patch,'albumArtist')&&patch.albumArtist===null)after.album_artist=artist;
  const sourceArtist=albumArtist(source,name(before.album_artist,name(before.artist_name,'Unknown artist'))),groupArtist=name(after.album_artist,sourceArtist),title=name(after.album_title,name(source?.title,'Unsorted')),key=await identity(groupArtist,title);
  const identityChanged=!source||!!forced&&forced.id!==source.id||normalized(title)!==normalized(name(source.title))||normalized(groupArtist)!==normalized(sourceArtist);
  prepared.push({before,after,patch,source,artist,albumArtist:groupArtist,title,key,identityChanged,alias:identityChanged?(forced?'forced:'+forced.id:name(before.owner_id)+':'+key):'source:'+source!.id});
 }
 const sourceGroups=new Map<string,Prepared[]>(),targetGroups=new Map<string,Prepared[]>();for(const item of prepared){const map=item.identityChanged?targetGroups:sourceGroups,group=map.get(item.alias)||[];group.push(item);map.set(item.alias,group);}
 const requested=[...targetGroups.values()].map(group=>({ownerId:name(group[0].before.owner_id),key:group[0].key,artistName:group[0].albumArtist,title:group[0].title}));
 const storageKeys=new Map<string,string>();if(!input.mergeExisting)for(const[alias,group]of targetGroups)storageKeys.set(alias,await context.hash('import\x1f'+group[0].key+'\x1f'+context.id()));
 const existingTargets=new Map<string,JournalRow>();for(const row of (input.mergeExisting?await repo.targets(requested):[]).filter(row=>!row.deleted).sort((a,b)=>Number(a.created_at)-Number(b.created_at)||a.id.localeCompare(b.id))){const key=name(row.owner_id)+':'+name(row.identity_key,name(row.merge_key));if(!existingTargets.has(key))existingTargets.set(key,row);}
 if(forced)existingTargets.set('forced:'+forced.id,forced);
 if(!input.mergeExisting)for(const group of [...sourceGroups.values()].sort((a,b)=>Number(a[0].source!.created_at)-Number(b[0].source!.created_at)||a[0].source!.id.localeCompare(b[0].source!.id))){const first=group[0],source=first.source!,selected=prepared.filter(item=>item.before.album_id===source.id);if(selected.length===counts.get(source.id)&&group.length===selected.length){const alias=name(source.owner_id)+':'+first.key;if(!existingTargets.has(alias))existingTargets.set(alias,source);}}
 const relatedAlbums=new Map([...sourceAlbums.values(),...existingTargets.values()].map(row=>[row.id,row])),albumRevs=Object.fromEntries([...relatedAlbums.values()].map(row=>[row.id,row.rev]));
 for(const[id,rev]of Object.entries(input.expectedAlbumRevs)){const row=relatedAlbums.get(id);if(!row)throw new UploadError('validation','Expected album revisions must belong to these tracks or their target albums.');if(row.rev!==rev)throw new JournalConflict([{table:'albums',id}]);}
 const artistNames=unique(prepared.flatMap(item=>[item.artist,item.albumArtist])),artistRows=new Map((await repo.artists(artistNames.map(normalized))).filter(row=>!row.deleted).map(row=>[name(row.name_key,normalized(name(row.name))),row])),newArtists=new Map<string,JournalRow>(),newArtistIds=new Set<string>(),touchedArtists=new Map<string,JournalRow>(),albumAfter=new Map<string,JournalRow>(),targets=new Map<string,JournalRow>(),guards=new Map<string,RowGuard>(),countGuards=new Map<string,CountGuard>();
 const guard=(table:RowGuard['table'],row:JournalRow)=>guards.set(table+':'+row.id,{table,id:row.id,rev:row.rev});
 for(const row of loaded)guard('tracks',row);for(const row of sourceAlbums.values())guard('albums',row);
 function artistFor(display:string,album:string){const key=normalized(display);let row=artistRows.get(key)||newArtists.get(key);if(!row){row={id:context.id(),rev:0,name:display,sort_name:display,name_key:key,tint:tint(display,album),deleted:0};newArtists.set(key,row);newArtistIds.add(row.id);}else if(artistRows.has(key))guard('artists',row);return row;}
 const touchArtist=(row:JournalRow)=>{if(!newArtistIds.has(row.id))touchedArtists.set(row.id,row);};
 const explicitYear=(group:Prepared[])=>group.every(item=>Object.hasOwn(item.patch,'year'))&&group.every(item=>item.after.year===group[0].after.year);
 const allSourceSelected=(source:JournalRow)=>prepared.filter(item=>item.before.album_id===source.id).length===counts.get(source.id);
 function renameSource(source:JournalRow,group:Prepared[],identityChange:boolean){
  const first=group[0],after={...source};
  if(identityChange){const artist=artistFor(first.albumArtist,first.title);Object.assign(after,{title:first.title,artist_id:artist.id,artist_name:first.albumArtist,merge_key:storageKeys.get(first.alias)||first.key,identity_key:first.key,tint:tint(first.albumArtist,first.title)});if(source.artist_id!==artist.id)touchArtist(artist);}
  else if(allSourceSelected(source)&&group.every(item=>item.title===first.title&&item.albumArtist===first.albumArtist)&&group.some(item=>Object.hasOwn(item.patch,'album')||Object.hasOwn(item.patch,'albumArtist'))){after.title=first.title;after.artist_name=first.albumArtist;}
  if(allSourceSelected(source)&&explicitYear(group))after.year=first.after.year;
  albumAfter.set(source.id,after);targets.set(group[0].alias,after);
  if(journalOp('albums',source,after))countGuards.set(source.id,{table:'tracks',column:'album_id',id:source.id,count:counts.get(source.id)||0});return after;
 }
 for(const group of sourceGroups.values())renameSource(group[0].source!,group,false);
 for(const[alias,group]of targetGroups){
  const first=group[0],existing=existingTargets.get(alias);if(existing){guard('albums',existing);targets.set(alias,albumAfter.get(existing.id)||existing);continue;}
  const candidates=unique(group.map(item=>item.source?.id||'').filter(Boolean)).map(id=>sourceAlbums.get(id)!).filter(source=>allSourceSelected(source)&&prepared.filter(item=>item.before.album_id===source.id).every(item=>item.alias===alias)).sort((a,b)=>Number(a.created_at)-Number(b.created_at)||a.id.localeCompare(b.id));
  if(candidates.length){const after=renameSource(candidates[0],group,true);targets.set(alias,after);continue;}
  const artist=artistFor(first.albumArtist,first.title),sources=unique(group.map(item=>item.source?.id||'')),copied=sources.length===1?first.source:undefined;
  const row:JournalRow={id:context.id(),rev:0,owner_id:first.before.owner_id,title:first.title,artist_id:artist.id,artist_name:first.albumArtist,year:group.every(item=>item.after.year===first.after.year)?first.after.year??null:null,art_source:copied?.art_source||'generated',art_key:copied?.art_key||null,tint:tint(first.albumArtist,first.title),visibility:input.preserveVisibility&&group.every(item=>item.before.visibility==='public')?'public':'private',sync_visibility:1,folder_path:copied?.folder_path??null,created_at:context.now??Date.now(),deleted:0,merge_key:storageKeys.get(first.alias)||first.key,identity_key:first.key};
  touchArtist(artist);albumAfter.set(row.id,row);targets.set(alias,row);
 }
 const trackOps:JournalOp[]=[],delta=new Map<string,number>(),membershipChanged=new Set<string>();let published=0,madePrivate=0;
 for(const item of prepared){const target=targets.get(item.alias)!,artist=artistFor(item.artist,item.title),after=item.after;after.artist_id=artist.id;if(item.before.artist_id!==artist.id)touchArtist(artist);
  after.album_id=target.id;after.album_title=target.title;if(item.before.album_id!==target.id){after.album_artist=albumArtist(target,item.albumArtist);if(target.sync_visibility&&!input.preserveVisibility)after.visibility=target.visibility;delta.set(name(item.before.album_id),(delta.get(name(item.before.album_id))||0)-1);delta.set(target.id,(delta.get(target.id)||0)+1);membershipChanged.add(name(item.before.album_id));membershipChanged.add(target.id);}
  const becamePublic=item.before.visibility!=='public'&&after.visibility==='public';if(becamePublic&&item.before.owner_id!==context.userId)throw new UploadError('forbidden','Admins cannot publish another member’s music.',403);if(becamePublic)published++;if(item.before.visibility==='public'&&after.visibility==='private')madePrivate++;
  if(Object.keys(after).some(key=>!['id','rev','organise_source'].includes(key)&&!Object.is(after[key],item.before[key])))after.organise_source='manual';
  const op=journalOp('tracks',item.before,after);if(op)trackOps.push(op);
 }
 for(const[id,source]of sourceAlbums){const remaining=(counts.get(id)||0)+(delta.get(id)||0);if(remaining===0&&(delta.get(id)||0)<0){albumAfter.set(id,{...(albumAfter.get(id)||source),deleted:1});countGuards.set(id,{table:'tracks',column:'album_id',id,count:counts.get(id)||0});}}
 if(published&&!input.dryRun&&!input.publishConfirmed)throw new UploadError('publish_confirmation_required',`This move makes ${published} tracks public. Review the impact first.`,409);
 const artistOps:JournalOp[]=[...newArtists.values()].map(row=>({table:'artists',id:row.id,before:null,after:row}));for(const row of touchedArtists.values())artistOps.push({table:'artists',id:row.id,before:{id:row.id,rev:row.rev},after:{id:row.id,rev:row.rev}});
 const albumOps=[...albumAfter.values()].flatMap(row=>journalOp('albums',sourceAlbums.get(row.id)||null,row)||[]),ops=[...artistOps,...albumOps,...trackOps];
 const renamed=trackOps.length>0&&trackOps.every(op=>Object.keys(op.after).every(key=>['id','rev','title','organise_source'].includes(key))&&Object.hasOwn(op.after,'title'));
 const write:JournalWrite={summary:`${renamed?'Renamed':'Updated'} ${trackOps.length} tracks`,ops,guards:[...guards.values()],counts:[...countGuards.values()]};
 const possibleGenerated=new Set([...membershipChanged,...albumOps.filter(op=>!op.before||Object.hasOwn(op.after,'title')||Object.hasOwn(op.after,'artist_name')).map(op=>op.id)]),finalAlbums=new Map([...existingTargets.values(),...sourceAlbums.values(),...albumAfter.values()].map(row=>[row.id,row]));
 return {write,updated:trackOps.length,albumsUpdated:albumOps.length,published,madePrivate,albumRevs,generatedAlbumIds:[...possibleGenerated].filter(id=>{const row=finalAlbums.get(id);return row&&!row.deleted&&row.art_source==='generated';}),albumIds:unique(prepared.map(item=>String(item.after.album_id))),preview:prepared.map(item=>({id:item.before.id,after:item.after}))};
}
