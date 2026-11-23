import { artInput,artRequestLimit } from '../../shared/art-input';
import { ulid } from './crypto';
import { stmt } from './db';
import { fail,json,readLimited } from './http';
import { albumRow } from './library';
import type { Auth,Env } from './types';
export async function artworkRoutes(request:Request,env:Env,auth:Auth,path:string){
 const match=path.match(/^\/api\/albums\/([0-9A-HJKMNP-TV-Z]{26})\/art$/);if(!match||request.method!=='PUT')return null;
 const before=await albumRow(env,match[1]);if(!before||before.deleted)fail('not_found','Album not found.',404);if(before.owner_id!==auth.user.id)fail('forbidden','Choose an album that belongs to you.',403);
 let form:FormData;try{const bytes=await readLimited(request,artRequestLimit);form=await new Request(request.url,{method:'PUT',headers:{'Content-Type':request.headers.get('Content-Type')||''},body:bytes}).formData();}catch(error){if(error instanceof Error&&'status'in error)throw error;fail('invalid_art','Use multipart artwork.');}
 const {files,source}=await artInput(form),key=`art/${auth.user.id}/${before.id}/${ulid()}`,changeId=ulid(),now=Date.now();
 try{
  for(const file of files)await env.MEDIA.put(`${key}/${file.filename}`,await file.blob.arrayBuffer(),{httpMetadata:{contentType:file.mime}});
  const columns=['id','owner_id','title','artist_id','year','art_source','art_key','tint','visibility','sync_visibility','folder_path','created_at','rev','deleted','merge_key'];
  const row=`json_object(${columns.map(column=>`'${column}',a.${column}`).join(',')})`;
  await env.DB.batch([stmt(env.DB,'UPDATE revs SET n=n+1 WHERE id=1'),stmt(env.DB,'UPDATE albums SET art_source=?,art_key=?,rev=(SELECT n FROM revs WHERE id=1) WHERE id=? AND owner_id=? AND deleted=0',source,key,before.id,auth.user.id),stmt(env.DB,`INSERT INTO changes(id,user_id,actor,session_label,summary,ops,created_at) SELECT ?,?,'web',?,?,json_array(json_object('table','albums','id',a.id,'before',json(?),'after',${row})),? FROM albums a WHERE a.id=? AND a.art_key=?`,changeId,auth.user.id,auth.session.device_label,`Updated artwork for ${before.title}`,JSON.stringify(before),now,before.id,key)]);
  if((await albumRow(env,before.id))?.art_key!==key)fail('conflict','This album changed while uploading artwork. Try again.',409);
 }catch(error){await env.MEDIA.delete(files.map(file=>`${key}/${file.filename}`));throw error;}
 return json({artSource:source});
}
