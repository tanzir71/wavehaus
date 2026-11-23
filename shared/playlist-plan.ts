import {rowIds} from './edit-input';
import {text,UploadError} from './upload-input';
import {journalOp,JournalConflict,type JournalRow,type JournalWrite} from './journal';
export type PlaylistAction='create'|'edit'|'delete'|'add'|'reorder'|'remove';
export interface PlaylistRepository {playlist(id:string):Promise<JournalRow|undefined>;items(id:string):Promise<JournalRow[]>;tracks(ids:string[]):Promise<JournalRow[]>}
export function playlistFields(raw:Record<string,unknown>,creating=false){
 const allowed=['name','description','kind','rules','expectedRev'];if(Object.keys(raw).some(key=>!allowed.includes(key)))throw new UploadError('validation','Playlist visibility has its own control.');const result:Record<string,unknown>={};
 if(creating||Object.hasOwn(raw,'name'))result.name=text(raw.name,'Playlist name',200,true);if(creating||Object.hasOwn(raw,'description'))result.description=text(raw.description,'Description',2000);
 if(Object.hasOwn(raw,'kind')){if(!['manual','smart'].includes(String(raw.kind)))throw new UploadError('validation','Choose a manual or smart playlist.');result.kind=raw.kind;}
 if(Object.hasOwn(raw,'rules')){if(raw.rules!==null&&(!raw.rules||typeof raw.rules!=='object'||Array.isArray(raw.rules)))throw new UploadError('validation','Use an object for smart playlist rules.');const rules=raw.rules===null?null:JSON.stringify(raw.rules);if(rules&&new TextEncoder().encode(rules).byteLength>65536)throw new UploadError('too_large','Use fewer smart playlist rules.',413);result.rules=rules;}return result;
}
function position(value:unknown){if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>2**40)throw new UploadError('validation','Use a valid playlist position.');return value;}
export async function playlistPlan(action:PlaylistAction,pid:string|undefined,raw:Record<string,unknown>,repo:PlaylistRepository,actor:{id:string},nextId:()=>string,now=Date.now()){
 const write:JournalWrite={summary:'Updated playlist',ops:[]};
 if(action==='add'&&raw.changeId!==undefined)write.appendTo=rowIds([raw.changeId],'Action ID')[0];
 if(action==='create'){const fields=playlistFields(raw,true),row:JournalRow={id:nextId(),rev:0,owner_id:actor.id,name:fields.name,description:fields.description,kind:'manual',rules:null,cover_key:null,visibility:'private',sync_visibility:0,created_at:now,updated_at:now,deleted:0,...fields};write.summary=`Created playlist ${row.name}`;write.ops.push({table:'playlists',id:row.id,before:null,after:row});return {write,playlistId:row.id,updated:1};}
 const playlist=await repo.playlist(pid!);if(!playlist||playlist.deleted)throw new UploadError('not_found','Playlist not found.',404);if(playlist.owner_id!==actor.id)throw new UploadError('forbidden','Choose a playlist that belongs to you.',403);
 if(raw.expectedRev!==undefined&&(!Number.isSafeInteger(raw.expectedRev)||raw.expectedRev!==playlist.rev))throw new JournalConflict([{table:'playlists',id:playlist.id}]);
 if(action==='edit'){const op=journalOp('playlists',playlist,{...playlist,...playlistFields(raw)});if(op)write.ops.push(op);write.summary=`Updated playlist ${playlist.name}`;return {write,playlistId:playlist.id,updated:op?1:0};}
 const items=await repo.items(playlist.id),live=items.filter(row=>!row.deleted).sort((a,b)=>Number(a.position)-Number(b.position)||a.id.localeCompare(b.id));let updated=0;
 if(action==='delete'){write.summary=`Deleted playlist ${playlist.name}`;write.ops.push({table:'playlists',id:playlist.id,before:{id:playlist.id,rev:playlist.rev,deleted:0},after:{id:playlist.id,rev:playlist.rev,deleted:1}});for(const row of live)write.ops.push({table:'playlist_items',id:row.id,before:{id:row.id,rev:row.rev,deleted:0},after:{id:row.id,rev:row.rev,deleted:1}});return {write,playlistId:playlist.id,updated:live.length};}
 if(action==='add'){
  const ids=rowIds(raw.trackIds),tracks=await repo.tracks(ids);if(tracks.length!==ids.length)throw new UploadError('not_found','A selected track was not found.',404);if(tracks.some(row=>row.owner_id!==actor.id&&row.visibility!=='public'))throw new UploadError('forbidden','A selected track is no longer shared.',403);
  const adding=ids.filter(id=>!live.some(row=>row.track_id===id)),after=raw.afterPosition===undefined?(live.length?Number(live.at(-1)!.position):0):position(raw.afterPosition),next=live.find(row=>Number(row.position)>after),step=next?(Number(next.position)-after)/(adding.length+1):1;
  if(adding.length&&step<Number.EPSILON*Math.max(1,Math.abs(after)))throw new UploadError('conflict','Reorder this playlist before inserting more tracks here.',409);
  adding.forEach((trackId,index)=>{const previous=items.find(row=>row.track_id===trackId),row:JournalRow={id:playlist.id+':'+trackId,rev:previous?.rev||0,owner_id:actor.id,playlist_id:playlist.id,track_id:trackId,position:after+step*(index+1),added_at:now,deleted:0},op=journalOp('playlist_items',previous||null,row);if(op){write.ops.push(op);updated++;}});write.summary=`Added ${updated} tracks to playlist ${playlist.name}`;
 }else if(action==='remove'){const ids=rowIds(raw.trackIds??[raw.trackId]);for(const row of live.filter(row=>ids.includes(String(row.track_id)))){write.ops.push({table:'playlist_items',id:row.id,before:{id:row.id,rev:row.rev,deleted:0},after:{id:row.id,rev:row.rev,deleted:1}});updated++;}write.summary=`Removed ${updated} tracks from playlist ${playlist.name}`;
 }else{
  const ordered=raw.trackIds===undefined?null:rowIds(raw.trackIds),moves=ordered?ordered.map((trackId,index)=>({trackId,position:index+1})):[{trackId:rowIds([raw.trackId])[0],position:position(raw.position)}];
  for(const move of moves){const row=live.find(row=>row.track_id===move.trackId);if(!row)throw new UploadError('not_found','This track is not in the playlist.',404);const op=journalOp('playlist_items',row,{...row,position:move.position});if(op){write.ops.push(op);updated++;}}write.summary=`Reordered playlist ${playlist.name}`;
 }
 if(write.ops.length)write.ops.unshift({table:'playlists',id:playlist.id,before:{id:playlist.id,rev:playlist.rev},after:{id:playlist.id,rev:playlist.rev}});return {write,playlistId:playlist.id,updated};
}
