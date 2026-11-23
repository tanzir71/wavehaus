import {playlistPlan,type PlaylistAction} from '../../shared/playlist-plan';
import {rowIds} from '../../shared/edit-input';
import type {JournalRow} from '../../shared/journal';
import {all,one} from './db';
import {body,fail,json} from './http';
import {ulid} from './crypto';
import {writeJournal} from './journal';
import type {Auth,Env} from './types';
export async function playlistRoutes(request:Request,env:Env,auth:Auth,path:string){
 const match=path.match(/^\/api\/playlists(?:\/([0-9A-HJKMNP-TV-Z]{26})(?:\/items(?:\/([0-9A-HJKMNP-TV-Z]{26}))?)?)?$/);if(!match)return null;const method=request.method,pid=match[1],itemsPath=path.includes('/items'),uid=auth.user.id;
 if(method==='GET'){
  if(!pid){const playlists=await all<JournalRow>(env.DB,"SELECT * FROM playlists WHERE deleted=0 AND(owner_id=? OR visibility='public') ORDER BY updated_at DESC LIMIT 2000",uid);return json({items:playlists,nextCursor:null});}
  const playlist=await one<JournalRow>(env.DB,'SELECT * FROM playlists WHERE id=? AND deleted=0',pid);if(!playlist)fail('not_found','Playlist not found.',404);if(playlist.owner_id!==uid&&playlist.visibility!=='public')fail('forbidden','This playlist is private.',403);
  const items=await all<JournalRow>(env.DB,"SELECT i.* FROM playlist_items i JOIN tracks t ON t.id=i.track_id WHERE i.playlist_id=? AND i.deleted=0 AND t.deleted=0 AND(t.owner_id=? OR t.visibility='public') ORDER BY i.position,i.id",pid,uid);return json(itemsPath?{items,nextCursor:null}:{playlist,items});
 }
 const action:PlaylistAction|undefined=!pid&&method==='POST'?'create':pid&&!itemsPath&&method==='PATCH'?'edit':pid&&!itemsPath&&method==='DELETE'?'delete':pid&&itemsPath&&method==='POST'?'add':pid&&itemsPath&&method==='PATCH'?'reorder':pid&&itemsPath&&method==='DELETE'?'remove':undefined;if(!action)return null;
 let input:Record<string,unknown>={};if(request.body)input=await body(request);if(match[2])input.trackId=match[2];
 const plan=await playlistPlan(action,pid,input,{playlist:async id=>(await one<JournalRow>(env.DB,'SELECT * FROM playlists WHERE id=?',id))||undefined,items:id=>all<JournalRow>(env.DB,'SELECT id,rev,owner_id,playlist_id,track_id,position,added_at,deleted FROM playlist_items WHERE playlist_id=?',id),tracks:ids=>all<JournalRow>(env.DB,'SELECT id,rev,owner_id,visibility,deleted FROM tracks WHERE deleted=0 AND id IN(SELECT value FROM json_each(?))',JSON.stringify(ids))},auth.user,ulid),result=await writeJournal(env,auth,plan.write);return json({...result,playlistId:plan.playlistId,updated:plan.updated},action==='create'?201:200);
}
