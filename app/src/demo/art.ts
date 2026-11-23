import { artInput,artRequestLimit } from '../../../shared/art-input';
import { ApiError } from '../api/types';
import { id } from '../library/ids';
import { deleteBlob,putBlob } from '../../public/runtime/media.js';
import { artEditInput } from '../../../shared/art-edit';
import { JournalConflict } from '../../../shared/journal';
import { demoWriteJournal } from './journal';
import { demoSignedIn } from './auth';
import { mutate,readState } from './store';
export async function demoArtwork(request:Request,path:string){
 const match=path.match(/^\/api\/albums\/([0-9A-HJKMNP-TV-Z]{26})\/art$/);if((!match&&path!=='/api/albums/art')||request.method!=='PUT')return null;
 const state=(await readState())!;if(!demoSignedIn(state))throw new ApiError('unauthenticated','Sign in to continue.',401);if(state.user.role==='listener')throw new ApiError('forbidden','Your account cannot edit artwork.',403);
 const size=Number(request.headers.get('Content-Length')||0);if(size>artRequestLimit)throw new ApiError('invalid_art','Choose artwork under 5 MB per image.',413);
 const form=await request.formData(),{ids,expectedRevs,appendTo}=artEditInput(form,match?.[1]),before=ids.map(id=>state.albums.find(a=>a.id===id&&!a.deleted));if(before.some(row=>!row))throw new ApiError('not_found','An album was not found.',404);if(before.some(row=>row!.owner_id!==state.user.id))throw new ApiError('forbidden','Choose albums that belong to you.',403);
 const stale=before.filter(row=>Object.hasOwn(expectedRevs,row!.id)&&row!.rev!==expectedRevs[row!.id]);if(stale.length)throw new JournalConflict(stale.map(row=>({table:'albums',id:row!.id})));
 const {files,source}=await artInput(form),key=`art-${ids[0]}-${id()}`;let result;
 try{for(const file of files)await putBlob(`${key}-${file.filename}`,file.blob.slice(0,file.blob.size,file.mime));result=await mutate(s=>{if(s.user.id!==state.user.id)throw new ApiError('unauthenticated','Sign in to continue.',401);return demoWriteJournal(s,{summary:`Updated artwork for ${ids.length===1?before[0]!.title:ids.length+' albums'}`,appendTo,ops:before.map(row=>({table:'albums',id:row!.id,before:{id:row!.id,rev:row!.rev,art_key:row!.art_key??null,art_source:row!.art_source},after:{id:row!.id,rev:row!.rev,art_key:key,art_source:source}}))});});}
 catch(error){await Promise.all(files.map(file=>deleteBlob(`${key}-${file.filename}`)));throw error;}
 return Response.json({...result,artSource:source,albumIds:ids});
}
