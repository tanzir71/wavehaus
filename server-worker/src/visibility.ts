import {visibilityInput,visibilityPlan} from '../../shared/visibility-plan';
import type {JournalRow} from '../../shared/journal';
import {metadataRepository} from './metadata';
import {all,one} from './db';
import {body,json} from './http';
import {writeJournal} from './journal';
import type {Auth,Env} from './types';
export async function visibilityRoutes(request:Request,env:Env,auth:Auth,path:string){
 if(path!=='/api/visibility'||request.method!=='POST')return null;const input=visibilityInput(await body(request)),metadata=metadataRepository(env),plan=await visibilityPlan(input,{tracks:metadata.tracks,albums:metadata.albums,albumTracks:async ids=>ids.length?all<JournalRow>(env.DB,'SELECT id,rev,owner_id,album_id,artist_id,visibility,deleted FROM tracks WHERE deleted=0 AND album_id IN(SELECT value FROM json_each(?)) LIMIT 10001',JSON.stringify(ids)):[],artists:async ids=>ids.length?all<JournalRow>(env.DB,'SELECT id,rev FROM artists WHERE deleted=0 AND id IN(SELECT value FROM json_each(?))',JSON.stringify(ids)):[],alsoIn:async ids=>{if(!ids.length)return {publicPlaylists:0,publicAlbums:0};const value=JSON.stringify(ids),row=await one<{publicPlaylists:number;publicAlbums:number}>(env.DB,"SELECT (SELECT COUNT(DISTINCT i.playlist_id) FROM playlist_items i JOIN playlists p ON p.id=i.playlist_id WHERE i.deleted=0 AND p.deleted=0 AND p.visibility='public' AND i.track_id IN(SELECT value FROM json_each(?))) AS publicPlaylists,(SELECT COUNT(DISTINCT a.id) FROM albums a JOIN tracks t ON t.album_id=a.id WHERE a.deleted=0 AND a.visibility='public' AND t.id IN(SELECT value FROM json_each(?))) AS publicAlbums",value,value);return row!;}},auth.user);
 const{write,...impact}=plan;return json({...impact,...input.dryRun?{dryRun:true,changeId:null}:await writeJournal(env,auth,write)});
}
