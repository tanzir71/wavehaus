import {editInput} from '../../../shared/edit-input';
import {deleteInput,deletePlan} from '../../../shared/delete-plan';
import {albumMutation} from '../../../shared/album-input';
import {metadataPlan,metadataTrackColumns,type MetadataRepository} from '../../../shared/edit-plan';
import {journalColumns,type JournalRow} from '../../../shared/journal';
import {normalized} from '../../../shared/upload-input';
import {sha} from '../../../shared/auth-crypto';
import {ApiError} from '../api/types';
import {id} from '../library/ids';
import {readState,mutate,type DemoState} from './store';
import {demoSignedIn} from './auth';
import {demoWriteJournal} from './journal';
const project=(row:Record<string,unknown>,columns:readonly string[])=>Object.fromEntries(columns.map(column=>[column,row[column]??null])) as JournalRow;
function repository(state:DemoState):MetadataRepository{
 const albums=():JournalRow[]=>state.albums.filter(album=>!album.deleted).map(album=>({...project(album as unknown as Record<string,unknown>,['id','rev',...journalColumns.albums]),dictionary_artist_name:state.artists.find(artist=>artist.id===album.artist_id)?.name}));
 return {
  tracks:async ids=>state.tracks.filter(track=>ids.includes(track.id)&&!track.deleted).map(track=>project(track as unknown as Record<string,unknown>,metadataTrackColumns)),
  albums:async ids=>albums().filter(album=>ids.includes(album.id)),
  targets:async identities=>{
   const wanted=new Map(identities.map(item=>[item.ownerId+'\x1f'+normalized(item.artistName)+'\x1f'+normalized(item.title),item.key]));
   return albums().flatMap(album=>{const key=wanted.get(String(album.owner_id)+'\x1f'+normalized(String(album.artist_name||album.dictionary_artist_name||'Unknown artist'))+'\x1f'+normalized(String(album.title)));return key&&(!(album.identity_key||album.merge_key)||(album.identity_key||album.merge_key)===key)?[{...album,identity_key:key}]:[];});
  },
  artists:async keys=>state.artists.filter(artist=>!artist.deleted&&keys.includes(normalized(artist.name))).map(artist=>({...artist,name_key:normalized(artist.name)} as unknown as JournalRow)),
  counts:async ids=>{const wanted=new Set(ids),counts=new Map<string,number>();for(const track of state.tracks)if(!track.deleted&&wanted.has(track.album_id))counts.set(track.album_id,(counts.get(track.album_id)||0)+1);return counts;},
 };
}
export async function demoEdits(request:Request,path:string):Promise<Response|null>{
 const album=path.match(/^\/api\/albums\/([0-9A-HJKMNP-TV-Z]{26})$/),merging=path==='/api/albums/merge'&&request.method==='POST';if(!(path==='/api/tracks'&&['PATCH','DELETE'].includes(request.method))&&!(album&&request.method==='PATCH')&&!merging)return null;
 if(request.method==='DELETE'){const input=deleteInput(await request.json());return mutate(async state=>{if(!demoSignedIn(state))throw new ApiError('unauthenticated','Sign in to continue.',401);const plan=await deletePlan(input,repository(state),{userId:state.user.id,role:state.user.role,id,hash:sha});return Response.json({...demoWriteJournal(state,plan.write),updated:plan.updated,generatedAlbumIds:plan.generatedAlbumIds});});}
 const raw=await request.json();let dryRun=false;if(raw.dryRun!==undefined&&typeof raw.dryRun!=='boolean')throw new ApiError('validation','dryRun must be true or false.',400);dryRun=raw.dryRun===true;
 const apply=async(state:DemoState)=>{
  if(!demoSignedIn(state))throw new ApiError('unauthenticated','Sign in to continue.',401);
  const repo=repository(state),mutation=album||merging?await albumMutation(raw,album?.[1],{albums:repo.albums,albumTracks:async ids=>state.tracks.filter(row=>!row.deleted&&ids.includes(row.album_id)).map(row=>({id:row.id,rev:row.rev,album_id:row.album_id}))}):null,input=editInput(mutation?.raw||raw),plan=await metadataPlan(input,repo,{userId:state.user.id,role:state.user.role,id,hash:sha}),impact={updated:plan.updated,albumsUpdated:plan.albumsUpdated,published:plan.published,madePrivate:plan.madePrivate};if(mutation){plan.write.counts=[...plan.write.counts||[],...mutation.counts];if(mutation.summary)plan.write.summary=mutation.summary;}
  if(input.dryRun){if(new TextEncoder().encode(JSON.stringify(plan.preview)).byteLength>8*1024**2)throw new ApiError('too_large','Preview fewer tracks at once.',413);return Response.json({dryRun:true,changeId:null,...impact,preview:plan.preview,albumRevs:plan.albumRevs});}
  return Response.json({...demoWriteJournal(state,plan.write),...impact,albumIds:plan.albumIds,generatedAlbumIds:plan.generatedAlbumIds});
 };
 return dryRun?apply((await readState())!):mutate(apply);
}
