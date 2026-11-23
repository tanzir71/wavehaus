import {metadataPlan,metadataTrackColumns,type MetadataRepository,type AlbumIdentity} from '../../shared/edit-plan';
import {editInput} from '../../shared/edit-input';
import {deleteInput,deletePlan} from '../../shared/delete-plan';
import {journalColumns,type JournalRow} from '../../shared/journal';
import {normalized} from '../../shared/upload-input';
import {all} from './db';
import {body,fail,json} from './http';
import {ulid,sha} from './crypto';
import {writeJournal} from './journal';
import type {Auth,Env} from './types';
const encoder=new TextEncoder(),display=(row:JournalRow)=>String(row.artist_name||row.dictionary_artist_name||'Unknown artist');
export function metadataRepository(env:Env):MetadataRepository{
 let bytes=0;const budget=(rows:JournalRow[])=>{for(const row of rows){bytes+=encoder.encode(JSON.stringify(row)).byteLength;if(bytes>16*1024**2)fail('too_large','Choose fewer tracks for this edit.',413);}return rows;};
 const albumColumns=['id','rev',...journalColumns.albums].map(column=>'a."'+column+'"').join(',');
 const albums=(condition:string,parameters:unknown[])=>all<JournalRow>(env.DB,`SELECT ${albumColumns},ar.name AS dictionary_artist_name FROM albums a LEFT JOIN artists ar ON ar.id=a.artist_id WHERE a.deleted=0 AND ${condition}`,...parameters);
 return {
  tracks:async ids=>ids.length?budget(await all<JournalRow>(env.DB,`SELECT ${metadataTrackColumns.map(column=>'"'+column+'"').join(',')} FROM tracks WHERE id IN(SELECT value FROM json_each(?)) AND deleted=0`,JSON.stringify(ids))):[],
  albums:async ids=>ids.length?budget(await albums('a.id IN(SELECT value FROM json_each(?))',[JSON.stringify(ids)])):[],
  targets:async identities=>{
   if(!identities.length)return [];
   const found=await albums(`EXISTS(SELECT 1 FROM json_each(?) w WHERE a.owner_id=json_extract(w.value,'$.ownerId') AND (COALESCE(a.identity_key,a.merge_key)=json_extract(w.value,'$.key') OR(a.identity_key IS NULL AND a.merge_key IS NULL)))`,[JSON.stringify(identities)]),wanted=new Map(identities.map(item=>[item.ownerId+'\x1f'+normalized(item.artistName)+'\x1f'+normalized(item.title),item.key]));
   return budget(found.flatMap(row=>{const key=wanted.get(String(row.owner_id)+'\x1f'+normalized(display(row))+'\x1f'+normalized(String(row.title)));return key?[{...row,identity_key:key}]:[];}));
  },
  artists:async keys=>{
   if(!keys.length)return [];const wanted=new Set(keys),found=await all<JournalRow>(env.DB,'SELECT id,rev,name,sort_name,tint,name_key,deleted FROM artists WHERE deleted=0 AND (name_key IN(SELECT value FROM json_each(?)) OR name_key IS NULL)',JSON.stringify(keys));return budget(found.filter(row=>wanted.has(String(row.name_key||normalized(String(row.name))))));
  },
  counts:async ids=>new Map(ids.length?(await all<{id:string;n:number}>(env.DB,'SELECT album_id AS id,COUNT(*) AS n FROM tracks WHERE deleted=0 AND album_id IN(SELECT value FROM json_each(?)) GROUP BY album_id',JSON.stringify(ids))).map(row=>[row.id,row.n]):[]),
 };
}
export async function metadataRoutes(request:Request,env:Env,auth:Auth,path:string):Promise<Response|null>{
 if(path!=='/api/tracks'||!['PATCH','DELETE'].includes(request.method))return null;
 if(request.method==='DELETE'){const plan=await deletePlan(deleteInput(await body(request)),metadataRepository(env),{userId:auth.user.id,role:auth.user.role,id:ulid,hash:sha});return json({...await writeJournal(env,auth,plan.write),updated:plan.updated,generatedAlbumIds:plan.generatedAlbumIds});}
 const input=editInput(await body(request)),plan=await metadataPlan(input,metadataRepository(env),{userId:auth.user.id,role:auth.user.role,id:ulid,hash:sha});
 const impact={updated:plan.updated,albumsUpdated:plan.albumsUpdated,published:plan.published,madePrivate:plan.madePrivate};
 if(input.dryRun){if(encoder.encode(JSON.stringify(plan.preview)).byteLength>8*1024**2)fail('too_large','Preview fewer tracks at once.',413);return json({dryRun:true,changeId:null,...impact,preview:plan.preview,albumRevs:plan.albumRevs});}
 const result=await writeJournal(env,auth,plan.write);return json({...result,...impact,albumIds:plan.albumIds,generatedAlbumIds:plan.generatedAlbumIds});
}
