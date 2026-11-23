import { ApiError,emptyLibrary,type Api,type Album,type Library,type Track } from '../api/types';
import { id,tint } from '../library/ids';
import { getBlob,putBlob,rangeResponse } from '../../public/runtime/media.js';
import { mutate,readState,type DemoState } from './store';
import { seed } from './seed';
import { demoAuth,ensureAuth,demoSignedIn } from './auth';
export { seed };
const response=(data:unknown,status=200)=>new Response(status===204?null:JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8'}});
const fail=(code:string,message:string,status=400)=>{throw new ApiError(code,message,status);};
const log=(s:DemoState,summary:string,ops:unknown[]=[])=>{const changeId=id();s.changes.unshift({id:changeId,user_id:s.user.id,actor:'web',session_label:'This browser · demo',summary,ops,created_at:Date.now(),undone_at:null});return changeId;};
const allowedMetadata=['title','artist','albumArtist','album','year','genre','trackNo','discNo','lyrics'];
const columns:Record<string,string>={artist:'artist_name',albumArtist:'album_artist',album:'album_title',trackNo:'track_no',discNo:'disc_no'};
export async function demoFetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response>{
 const request=input instanceof Request?input:new Request(new URL(String(input),location.origin),init);const url=new URL(request.url),path=url.pathname.replace(/^.*?(\/api\/|\/demo-media\/)/,'$1'),method=request.method;
 try{
 await seed();await ensureAuth();
 if(path.startsWith('/demo-media/')){if(!demoSignedIn((await readState())!))fail('unauthenticated','Sign in to continue.',401);const blob=await getBlob(`audio-${path.split('/')[2]}`);return blob?rangeResponse(blob,request):response({error:{code:'not_found',message:'Track not found'}},404);}
 if(!['GET','HEAD'].includes(method)&&request.headers.get('X-Wavehaus')!=='1')return response({error:{code:'csrf',message:'Missing X-Wavehaus header.'}},403);
 const body=()=>request.json();const s=(await readState())!;
 if(path==='/api/health')return response({ok:true,version:'0.1.0',schema:2,backend:'demo',needsSetup:false});
 if(path==='/api/config')return response({serverName:s.settings.server_name,registrationMode:s.settings.registration_mode,maxChunkBytes:8*1024*1024,maxFileBytes:2*1024**3,powDifficulty:18,features:{demo:true,uploads:true}});
 const authentication=await demoAuth(request,path);if(authentication)return authentication;
 if(!demoSignedIn(s))fail('unauthenticated','Sign in to continue.',401);
 if(path==='/api/library'){
  const since=Number(url.searchParams.get('since')||0);if(!Number.isSafeInteger(since)||since<0)fail('invalid_cursor','Invalid library cursor.');
  const limit=Math.min(2000,Math.max(1,Number(url.searchParams.get('limit')||2000)));const items=emptyLibrary();
  const rows=Object.entries(items).flatMap(([key])=>s[key as keyof Library].filter(row=>row.rev>since).map(row=>({key,row}))).sort((a,b)=>a.row.rev-b.row.rev);const page=rows.slice(0,limit);
  for(const {key,row} of page)(items[key as keyof Library] as unknown[]).push(row);
  return response({rev:page.length&&page.length<rows.length?page.at(-1)!.row.rev:s.rev,items,hidden:{tracks:[],albums:[],playlists:[]},more:page.length<rows.length});
 }
 if(path==='/api/player-state')return method==='GET'?response(s.playerState):response(await mutate(async s=>{s.playerState=await body();return s.playerState;}));
 if(path==='/api/uploads/check'){const b=await body();return response({duplicates:s.tracks.filter(t=>!t.deleted&&b.items.some((i:{quickHash:string;size:number})=>i.quickHash===t.quick_hash&&i.size===t.size_bytes)).map(t=>t.quick_hash),quotaLeft:null});}
 if(path==='/api/uploads'&&method==='POST')return response(await mutate(async s=>{const b=await body();if(!Number.isSafeInteger(b.size)||b.size<=0||b.size>2*1024**3)fail('too_large','Choose an audio file under 2 GB.',413);if(!/^[a-f0-9]{64}$/.test(b.sha256))fail('invalid_hash','A SHA-256 hash is required.');const existing=Object.values(s.uploads).find(u=>u.sha256===b.sha256&&u.status==='open');if(existing)return {uploadId:existing.id,chunkBytes:existing.chunkBytes,partsReceived:existing.partsReceived};const uploadId=id();s.uploads[uploadId]={id:uploadId,filename:b.filename,size:b.size,sha256:b.sha256,mime:b.mime,chunkBytes:8*1024*1024,partsReceived:[],status:'open'};return {uploadId,chunkBytes:8*1024*1024,partsReceived:[]};}),201);
 const upload=path.match(/^\/api\/uploads\/([^/]+)(?:\/parts\/(\d+)|\/(complete))?$/);
 if(upload){const [,uid,part,complete]=upload;const u=s.uploads[uid];if(!u)fail('not_found','Upload not found.',404);
  if(method==='GET')return response({partsReceived:u.partsReceived,status:u.status});
  if(method==='DELETE')return response(await mutate(s=>{s.uploads[uid].status='aborted';return {ok:true};}));
  if(u.status!=='open')fail('upload_closed','This upload is no longer open.',409);
  if(part&&method==='PUT'){const blob=await request.blob(),n=Number(part),expected=Math.min(u.chunkBytes,u.size-(n-1)*u.chunkBytes);if(n<1||expected<=0||blob.size!==expected)fail('invalid_part','Part size or number is invalid.');await putBlob(`part-${uid}-${n}`,blob);await mutate(s=>{if(!s.uploads[uid].partsReceived.includes(n))s.uploads[uid].partsReceived.push(n);});return response({received:n});}
  if(complete&&method==='POST'){
   const b=await body();const count=Math.ceil(u.size/u.chunkBytes);if(u.partsReceived.length!==count)fail('incomplete','Some upload parts are missing.',409);const parts=[];for(let n=1;n<=count;n++){const blob=await getBlob(`part-${uid}-${n}`);if(!blob)fail('incomplete','An upload part is missing.',409);parts.push(blob!);}const blob=new Blob(parts,{type:u.mime});
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');if(digest!==u.sha256)fail('hash_mismatch','The uploaded file failed its integrity check.',409);
   const header=new Uint8Array(await blob.slice(0,12).arrayBuffer());const magic=new TextDecoder('latin1').decode(header);if(!/^(RIFF|ID3|fLaC|OggS|FORM)/.test(magic)&&magic.slice(4,8)!=='ftyp'&&!(header[0]===255&&(header[1]&224)===224))fail('unsupported','This file is not supported audio.',415);
   const trackId=id();await putBlob(`audio-${trackId}`,blob);
   return response(await mutate(s=>{
    if(s.tracks.some(t=>!t.deleted&&t.sha256===digest))fail('duplicate','Already in your library.',409);
    const m=b.metadata||{},a=b.album||{},now=Date.now(),artistName=String(m.artist||'Unknown artist');let artist=s.artists.find(a=>a.name.toLowerCase()===artistName.toLowerCase());if(!artist){artist={id:id(),name:artistName,sort_name:artistName,tint:tint(artistName,a.title||'Unsorted'),rev:++s.rev,deleted:0};s.artists.push(artist);}
    let album=s.albums.find(x=>!x.deleted&&x.owner_id===s.user.id&&((a.existingAlbumId&&x.id===a.existingAlbumId)||(x.title.toLowerCase()===String(a.title).toLowerCase()&&x.artist_name.toLowerCase()===String(a.artistName||artistName).toLowerCase())));
    if(!album){album={id:id(),owner_id:s.user.id,title:a.title||'Unsorted',artist_id:artist.id,artist_name:a.artistName||artistName,year:a.year,tint:tint(artistName,a.title||'Unsorted'),art_source:'generated',visibility:b.visibility==='public'?'public':'private',sync_visibility:1,folder_path:a.folderPath,created_at:now,rev:++s.rev,deleted:0};s.albums.push(album);}
    const track:Track={id:trackId,owner_id:s.user.id,album_id:album.id,artist_id:artist.id,title:String(m.title||u.filename),artist_name:artistName,album_artist:m.albumArtist,album_title:album.title,track_no:m.trackNo,disc_no:m.discNo,year:m.year,genre:m.genre,duration_ms:Number(m.durationMs)||0,codec:m.codec||'Unknown',container:m.container||u.filename.split('.').pop()?.toUpperCase()||'',mime:u.mime,peaks:b.peaks||null,storage_key:`audio-${trackId}`,size_bytes:blob.size,sha256:digest,quick_hash:m.quickHash||digest,original_name:u.filename,original_path:m.originalPath||u.filename,visibility:album.sync_visibility?album.visibility:(b.visibility==='public'?'public':'private'),organise_source:m.organiseSource||'filename',lyrics:m.lyrics,added_at:now,updated_at:now,rev:++s.rev,deleted:0};s.tracks.push(track);s.user.used_bytes+=blob.size;s.uploads[uid].status='complete';const changeId=log(s,`Imported ${track.title}`,[{table:'tracks',id:trackId,before:null,after:track}]);return {track,album,changeId};}),201);
  }
 }
 if(path==='/api/tracks'&&['PATCH','DELETE'].includes(method))return response(await mutate(async s=>{const b=await body();const tracks=s.tracks.filter(t=>b.ids.includes(t.id)&&!t.deleted);const ops=[];for(const t of tracks){const before={...t};if(method==='DELETE')t.deleted=1;else{const values={...b.set,...b.perId?.[t.id]};for(const [key,value] of Object.entries(values))if(allowedMetadata.includes(key))(t as unknown as Record<string,unknown>)[columns[key]||key]=value;}t.rev=++s.rev;t.updated_at=Date.now();ops.push({table:'tracks',id:t.id,before,after:{...t}});}return {updated:tracks.length,changeId:log(s,`${method==='DELETE'?'Deleted':'Updated'} ${tracks.length} tracks`,ops)};}));
 const art=path.match(/^\/api\/albums\/([^/]+)\/art$/);if(art&&method==='PUT'){const form=await request.formData();const blob=form.get('generated512')||form.get('art600');if(!(blob instanceof Blob)||blob.size>5*1024**2)fail('invalid_art','Choose an image under 5 MB.');await putBlob(`art-${art[1]}`,blob as Blob);return response(await mutate(s=>{const a=s.albums.find(a=>a.id===art[1]);if(!a)fail('not_found','Album not found.',404);a!.art_source=form.has('generated512')?'generated':'uploaded';a!.rev=++s.rev;return {artSource:a!.art_source};}));}
 const like=path.match(/^\/api\/likes\/([^/]+)$/);if(like&&['PUT','DELETE'].includes(method))return response(await mutate(s=>{if(!s.tracks.some(t=>t.id===like[1]&&!t.deleted))fail('not_found','Track not found.',404);let row=s.likes.find(l=>l.track_id===like[1]);if(!row){row={user_id:s.user.id,track_id:like[1],liked_at:Date.now(),rev:0,deleted:0};s.likes.push(row);}row.rev=++s.rev;row.deleted=method==='DELETE'?1:0;return {ok:true};}));
 if(path==='/api/plays'&&method==='POST'){await mutate(async s=>{s.plays.push(...(await body()).plays);});return response({ok:true});}
 if(path==='/api/changes')return response({items:s.changes.slice(0,Number(url.searchParams.get('limit')||50)),nextCursor:null});
 if(path==='/api/admin/settings')return method==='GET'?response(s.settings):response(await mutate(async s=>{Object.assign(s.settings,await body());return s.settings;}));
 if(path==='/api/sessions')return response({items:[{id:'demo',device_label:'This browser · demo',last_seen_at:Date.now(),current:true}],nextCursor:null});
 if(path==='/api/playlists'&&method==='GET')return response({items:s.playlists.filter(p=>!p.deleted),nextCursor:null});
 return response({error:{code:'not_implemented',message:'This feature arrives in a later milestone.'}},501);
 }catch(error){const e=error instanceof ApiError?error:new ApiError('internal',error instanceof Error?error.message:'Something went wrong.',500);return response({error:{code:e.code,message:e.message,retryAfter:e.retryAfter}},e.status);}
}
export const api:Api={demo:true,async request<T>(path:string,init:RequestInit={}){const headers=new Headers(init.headers);if(init.method&&!['GET','HEAD'].includes(init.method))headers.set('X-Wavehaus','1');const res=await demoFetch(path,{...init,headers});if(!res.ok){const {error}=await res.json();throw new ApiError(error.code,error.message,res.status);}return res.status===204?undefined as T:res.json();},mediaUrl:t=>`${import.meta.env.BASE_URL}demo-media/${t.id}`,artUrl:a=>`${import.meta.env.BASE_URL}demo-art/${a.id}/generated-512.png?v=${a.rev}`};
