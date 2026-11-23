import {albumPatchInput,rowIds} from './edit-input';
import {UploadError} from './upload-input';
import type {JournalRow,CountGuard} from './journal';
export async function albumMutation(raw:Record<string,unknown>,albumId:string|undefined,repo:{albums(ids:string[]):Promise<JournalRow[]>;albumTracks(ids:string[]):Promise<JournalRow[]>}){
 const controls=['dryRun','publishConfirmed','expectedRevs','expectedAlbumRevs'],allowed=albumId?['title','artistName','year',...controls]:['intoId','fromIds',...controls];if(Object.keys(raw).some(key=>!allowed.includes(key)))throw new UploadError('validation','Unknown album field.');
 const intoId=albumId?undefined:rowIds([raw.intoId],'Target album ID')[0],sourceIds=albumId?[albumId]:rowIds(raw.fromIds,'Source album IDs').filter(id=>id!==intoId);if(!sourceIds.length)throw new UploadError('validation','Choose another album to merge.');
 const wanted=[...new Set([...sourceIds,...intoId?[intoId]:[]])],albums=await repo.albums(wanted);if(albums.length!==wanted.length)throw new UploadError('not_found','An album was not found.',404);
 const tracks=await repo.albumTracks(sourceIds);if(!tracks.length)throw new UploadError('not_found','This album has no live tracks.',404);if(tracks.length>2000)throw new UploadError('too_large','Edit up to 2000 tracks at once.',413);
 const target=albums.find(row=>row.id===intoId),patch=albumId?albumPatchInput(Object.fromEntries(Object.entries(raw).filter(([key])=>!controls.includes(key)))):null,set=patch?Object.fromEntries(Object.entries(patch).map(([key,value])=>[key==='title'?'album':key==='artistName'?'albumArtist':key,value])):{album:String(target!.title),albumArtist:String(target!.artist_name||target!.dictionary_artist_name||'Unknown artist')};
 const counts:CountGuard[]=sourceIds.map(id=>({table:'tracks',column:'album_id',id,count:tracks.filter(row=>row.album_id===id).length}));return {raw:{...Object.fromEntries(controls.filter(key=>raw[key]!==undefined).map(key=>[key,raw[key]])),ids:tracks.map(row=>row.id),set,...intoId?{targetAlbumId:intoId}:{}},counts,summary:intoId?`Merged ${sourceIds.length} albums into ${target!.title}`:undefined};
}
