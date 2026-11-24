import {demoSignedIn} from './auth';
import {playlistPlan,type PlaylistAction} from '../../../shared/playlist-plan';
import type {JournalRow} from '../../../shared/journal';
import {ApiError} from '../api/types';
import {readState,mutate} from './store';
import {id} from '../library/ids';
import {demoWriteJournal} from './journal';
export async function demoPlaylists(request:Request,path:string){
 const match=path.match(/^\/api\/playlists(?:\/([0-9A-HJKMNP-TV-Z]{26})(?:\/items(?:\/([0-9A-HJKMNP-TV-Z]{26}))?)?)?$/);if(!match)return null;const method=request.method,pid=match[1],itemsPath=path.includes('/items');
 if(method==='GET'){const state=(await readState())!;if(!pid)return Response.json({items:state.playlists.filter(row=>!row.deleted&&(demoSignedIn(state)&&row.owner_id===state.user.id||row.visibility==='public')),nextCursor:null});const playlist=state.playlists.find(row=>row.id===pid&&!row.deleted);if(!playlist)throw new ApiError('not_found','Playlist not found.',404);if((!demoSignedIn(state)||playlist.owner_id!==state.user.id)&&playlist.visibility!=='public')throw new ApiError('forbidden','This playlist is private.',403);const visible=new Set(state.tracks.filter(row=>!row.deleted&&(demoSignedIn(state)&&row.owner_id===state.user.id||row.visibility==='public')).map(row=>row.id)),items=state.playlistItems.filter(row=>row.playlist_id===pid&&!row.deleted&&visible.has(row.track_id)).sort((a,b)=>a.position-b.position);return Response.json(itemsPath?{items,nextCursor:null}:{playlist,items});}
 const action:PlaylistAction|undefined=!pid&&method==='POST'?'create':pid&&!itemsPath&&method==='PATCH'?'edit':pid&&!itemsPath&&method==='DELETE'?'delete':pid&&itemsPath&&method==='POST'?'add':pid&&itemsPath&&method==='PATCH'?'reorder':pid&&itemsPath&&method==='DELETE'?'remove':undefined;if(!action)return null;const raw=request.body?await request.json():{};if(match[2])raw.trackId=match[2];
 return mutate(async state=>{const rows=(value:unknown)=>value as JournalRow[],plan=await playlistPlan(action,pid,raw,{playlist:async id=>state.playlists.find(row=>row.id===id) as unknown as JournalRow|undefined,items:async id=>rows(state.playlistItems.filter(row=>row.playlist_id===id)),tracks:async ids=>rows(state.tracks.filter(row=>!row.deleted&&ids.includes(row.id)))},state.user,id),result=demoWriteJournal(state,plan.write);return Response.json({...result,playlistId:plan.playlistId,updated:plan.updated},{status:action==='create'?201:200});});
}
