import { artInput,artRequestLimit } from '../../../shared/art-input';
import { ApiError } from '../api/types';
import { id } from '../library/ids';
import { deleteBlob,idbFile,putBlob } from '../../public/runtime/media.js';
import { mutate,readState } from './store';
export async function demoArtwork(request:Request,path:string){
 const match=path.match(/^\/api\/albums\/([0-9A-HJKMNP-TV-Z]{26})\/art$/);if(!match||request.method!=='PUT')return null;
 const state=(await readState())!,album=state.albums.find(a=>a.id===match[1]&&!a.deleted);if(!album)throw new ApiError('not_found','Album not found.',404);if(album.owner_id!==state.user.id)throw new ApiError('forbidden','Choose an album that belongs to you.',403);
 const size=Number(request.headers.get('Content-Length')||0);if(size>artRequestLimit)throw new ApiError('invalid_art','Choose artwork under 5 MB per image.',413);
 const {files,source}=await artInput(await request.formData()),key=`art-${album.id}-${id()}`;
 try{for(const file of files)await putBlob(`${key}-${file.filename}`,file.blob.slice(0,file.blob.size,file.mime));await mutate(s=>{const row=s.albums.find(a=>a.id===album.id&&!a.deleted&&a.owner_id===s.user.id);if(!row)throw new ApiError('forbidden','Choose an album that belongs to you.',403);const before={...row};row.art_key=key;row.art_source=source;row.rev=++s.rev;s.changes.unshift({id:id(),user_id:s.user.id,actor:'web',session_label:'This browser · demo',summary:`Updated artwork for ${row.title}`,ops:[{table:'albums',id:row.id,before,after:{...row}}],created_at:Date.now(),undone_at:null});});await idbFile(`art-manifest-${album.id}`,{key});}
 catch(error){await Promise.all(files.map(file=>deleteBlob(`${key}-${file.filename}`)));throw error;}
 return Response.json({artSource:source});
}
