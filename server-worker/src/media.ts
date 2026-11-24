import { byteRange } from '../../shared/byte-range';
import { one } from './db';
import { fail } from './http';
import { albumRow,readableTrack } from './library';
import type { Auth,Env } from './types';
export async function serveMedia(request:Request,env:Env,auth:Auth,path:string){
 if(!['GET','HEAD'].includes(request.method))fail('not_found','Not found.',404);
 const track=path.match(/^\/media\/([0-9A-HJKMNP-TV-Z]{26})$/);
 if(track){
  const row=await readableTrack(env,auth,track[1]),key=String(row.storage_key),etag=`"${row.sha256}"`,head=await env.MEDIA.head(key);if(!head)fail('not_found','Audio file not found.',404);
  const headers=new Headers({'Content-Type':String(row.mime),'Accept-Ranges':'bytes','Cache-Control':'private, no-store','Vary':'Cookie, Authorization','ETag':etag});
  if(request.headers.get('If-None-Match')===etag&&!request.headers.has('Range'))return new Response(null,{status:304,headers});
  const range=byteRange(!request.headers.has('If-Range')||request.headers.get('If-Range')===etag?request.headers.get('Range'):null,head.size);headers.set('Content-Length',String(range.length));if(range.contentRange)headers.set('Content-Range',range.contentRange);
  if(range.status===416||request.method==='HEAD')return new Response(null,{status:range.status,headers});
  const object=await env.MEDIA.get(key,range.status===206?{range:{offset:range.start,length:range.length}}:undefined);if(!object)fail('not_found','Audio file not found.',404);return new Response(object.body,{status:range.status,headers});
 }
 const art=path.match(/^\/art\/([0-9A-HJKMNP-TV-Z]{26})\/(96\.webp|600\.webp|generated-512\.png)$/);
 if(art){const album=await albumRow(env,art[1]);if(!album||album.deleted)fail('not_found','Album not found.',404);if(album.owner_id!==auth.user.id&&album.visibility!=='public'&&!await one(env.DB,"SELECT id FROM tracks WHERE album_id=? AND visibility='public' AND deleted=0 LIMIT 1",album.id))fail('forbidden','This artwork is private.',403);if(!album.art_key)fail('not_found','Artwork has not arrived yet.',404);
  let object=await env.MEDIA.get(String(album.art_key)+'/'+art[2]);if(!object&&art[2]==='96.webp')object=await env.MEDIA.get(String(album.art_key)+'/600.webp');if(!object)fail('not_found','Artwork has not arrived yet.',404);
  const headers=new Headers({'Content-Type':object.httpMetadata?.contentType||'image/png','Content-Length':String(object.size),'Cache-Control':'private, max-age=31536000, immutable','Vary':'Cookie, Authorization','ETag':object.httpEtag});return new Response(request.method==='HEAD'?null:object.body,{headers});
 }
 fail('not_found','Not found.',404);
}
