import { artInput,artRequestLimit } from '../../shared/art-input';
import { ulid } from './crypto';
import { all } from './db';
import { artEditInput } from '../../shared/art-edit';
import { JournalConflict,type JournalRow } from '../../shared/journal';
import { writeJournal } from './journal';
import { fail,json,readLimited } from './http';
import type { Auth,Env } from './types';
export async function artworkRoutes(request:Request,env:Env,auth:Auth,path:string){
 const match=path.match(/^\/api\/albums\/([0-9A-HJKMNP-TV-Z]{26})\/art$/);if((!match&&path!=='/api/albums/art')||request.method!=='PUT')return null;
 if(auth.user.role==='listener')fail('forbidden','Your account cannot edit artwork.',403);
 let form:FormData;try{const bytes=await readLimited(request,artRequestLimit);form=await new Request(request.url,{method:'PUT',headers:{'Content-Type':request.headers.get('Content-Type')||''},body:bytes}).formData();}catch(error){if(error instanceof Error&&'status'in error)throw error;fail('invalid_art','Use multipart artwork.');}
 const {ids,expectedRevs,appendTo}=artEditInput(form,match?.[1]),before=await all<JournalRow>(env.DB,'SELECT id,rev,owner_id,title,art_key,art_source FROM albums WHERE deleted=0 AND id IN(SELECT value FROM json_each(?))',JSON.stringify(ids));
 if(before.length!==ids.length)fail('not_found','An album was not found.',404);if(before.some(row=>row.owner_id!==auth.user.id))fail('forbidden','Choose albums that belong to you.',403);
 const stale=before.filter(row=>Object.hasOwn(expectedRevs,row.id)&&row.rev!==expectedRevs[row.id]);if(stale.length)throw new JournalConflict(stale.map(row=>({table:'albums',id:row.id})));
 const {files,source}=await artInput(form),key=`art/${auth.user.id}/${ids[0]}/${ulid()}`;let result;
 try{
  for(const file of files)await env.MEDIA.put(`${key}/${file.filename}`,await file.blob.arrayBuffer(),{httpMetadata:{contentType:file.mime}});
  result=await writeJournal(env,auth,{summary:`Updated artwork for ${ids.length===1?before[0].title:ids.length+' albums'}`,appendTo,ops:before.map(row=>({table:'albums',id:row.id,before:{id:row.id,rev:row.rev,art_key:row.art_key,art_source:row.art_source},after:{id:row.id,rev:row.rev,art_key:key,art_source:source}}))});
 }catch(error){await env.MEDIA.delete(files.map(file=>`${key}/${file.filename}`));throw error;}
 return json({...result,artSource:source,albumIds:ids});
}
