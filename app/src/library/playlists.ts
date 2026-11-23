import {api} from '@backend';
import {json} from '../api/types';
import {library,sync,offerUndo} from './store';
import {user} from './session';
import {beginBusy} from '../ui/busy';
interface Result {playlistId:string;changeId:string|null;updated:number}
export async function playlistRequest(path:string,method:string,body:Record<string,unknown>,message:string){const owner=user.value?.id,finish=beginBusy();try{const result=await api.request<Result>(path,json(body,method));if(user.value?.id!==owner)throw new Error('The account changed.');await sync();offerUndo(message,result.changeId);return result;}finally{finish();}}
export const createPlaylist=(name:string,description='')=>playlistRequest('/api/playlists','POST',{name,description},'Playlist created.');
export const updatePlaylist=(id:string,fields:Record<string,unknown>)=>playlistRequest('/api/playlists/'+id,'PATCH',{...fields,expectedRev:library.value.playlists.find(row=>row.id===id)?.rev},'Playlist updated.');
export const deletePlaylist=(id:string)=>playlistRequest('/api/playlists/'+id,'DELETE',{expectedRev:library.value.playlists.find(row=>row.id===id)?.rev},'Playlist deleted.');
export const addToPlaylist=(id:string,trackIds:string[],changeId?:string)=>playlistRequest('/api/playlists/'+id+'/items','POST',{trackIds,changeId,expectedRev:library.value.playlists.find(row=>row.id===id)?.rev},`${trackIds.length} tracks added to playlist.`);
export const removeFromPlaylist=(id:string,trackId:string)=>playlistRequest('/api/playlists/'+id+'/items','DELETE',{trackId,expectedRev:library.value.playlists.find(row=>row.id===id)?.rev},'Track removed from playlist.');
export async function movePlaylistTrack(id:string,trackId:string,direction:-1|1){const rows=library.value.playlistItems.filter(row=>row.playlist_id===id).sort((a,b)=>a.position-b.position),from=rows.findIndex(row=>row.track_id===trackId),to=from+direction;if(from<0||to<0||to>=rows.length)return;const target=rows[to],before=rows[to-1],after=rows[to+1],position=direction===-1?(before?(before.position+target.position)/2:target.position-1):(after?(target.position+after.position)/2:target.position+1);return playlistRequest('/api/playlists/'+id+'/items','PATCH',{trackId,position,expectedRev:library.value.playlists.find(row=>row.id===id)?.rev},'Playlist reordered.');}
