import { demoUploads } from './uploads';
import { demoArtwork } from './art';
import { UploadError } from '../../../shared/upload-input';
import { ApiError,emptyLibrary,type Api,type Album,type Library,type Track } from '../api/types';
import { id,tint } from '../library/ids';
import { getArt,getBlob,rangeResponse } from '../../public/runtime/media.js';
import { mutate,readState,type DemoState } from './store';
import { seed } from './seed';
import { demoAuth,ensureAuth,demoSignedIn } from './auth';
export { seed };
const response=(data:unknown,status=200)=>new Response(status===204?null:JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const fail=(code:string,message:string,status=400)=>{throw new ApiError(code,message,status);};
const log=(s:DemoState,summary:string,ops:unknown[]=[])=>{const changeId=id();s.changes.unshift({id:changeId,user_id:s.user.id,actor:'web',session_label:'This browser · demo',summary,ops,created_at:Date.now(),undone_at:null});return changeId;};
const allowedMetadata=['title','artist','albumArtist','album','year','genre','trackNo','discNo','lyrics'];
const columns:Record<string,string>={artist:'artist_name',albumArtist:'album_artist',album:'album_title',trackNo:'track_no',discNo:'disc_no'};
export async function demoFetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response>{
 const request=input instanceof Request?input:new Request(new URL(String(input),location.origin),init);const url=new URL(request.url),path=url.pathname.replace(/^.*?(\/(?:api|demo-media|media|demo-art|art)\/)/,'$1'),method=request.method;
 try{
 await seed();await ensureAuth();
 if(path.startsWith('/demo-media/')||path.startsWith('/media/')){const state=(await readState())!;if(!demoSignedIn(state))fail('unauthenticated','Sign in to continue.',401);const track=state.tracks.find(t=>t.id===path.split('/')[2]&&!t.deleted),blob=track?await getBlob(`audio-${track.id}`):null;return blob&&track?rangeResponse(blob,request,track.mime,`"${track.sha256}"`):response({error:{code:'not_found',message:'Track not found'}},404);}
 if(!['GET','HEAD'].includes(method)&&request.headers.get('X-Wavehaus')!=='1')return response({error:{code:'csrf',message:'Missing X-Wavehaus header.'}},403);
 const body=()=>request.json();const s=(await readState())!;
 if(path==='/api/health')return response({ok:true,version:'0.2.0',schema:4,backend:'demo',needsSetup:false});
 if(path==='/api/config')return response({serverName:s.settings.server_name,registrationMode:s.settings.registration_mode,maxChunkBytes:8*1024*1024,maxFileBytes:2*1024**3,powDifficulty:18,features:{demo:true,uploads:true}});
 const authentication=await demoAuth(request,path);if(authentication)return authentication;
 if(!demoSignedIn(s))fail('unauthenticated','Sign in to continue.',401);
 const artwork=path.match(/^\/(?:art|demo-art)\/([0-9A-HJKMNP-TV-Z]{26})\/(96\.webp|600\.webp|generated-512\.png)$/);if(artwork&&['GET','HEAD'].includes(method)){const blob=await getArt(artwork[1],artwork[2]);return blob?new Response(method==='HEAD'?null:blob,{headers:{'Content-Type':blob.type,'Content-Length':String(blob.size),'Cache-Control':'private, max-age=31536000, immutable'}}):response({error:{code:'not_found',message:'Artwork has not arrived yet.'}},404);}
 if(path==='/api/library'){
  const since=Number(url.searchParams.get('since')||0);if(!Number.isSafeInteger(since)||since<0)fail('invalid_cursor','Invalid library cursor.');
  const limit=Math.min(2000,Math.max(1,Number(url.searchParams.get('limit')||2000)));const items=emptyLibrary();
  const rows=Object.entries(items).flatMap(([key])=>s[key as keyof Library].filter(row=>row.rev>since).map(row=>({key,row}))).sort((a,b)=>a.row.rev-b.row.rev);const page=rows.slice(0,limit);
  for(const {key,row} of page)(items[key as keyof Library] as unknown[]).push(row);
  return response({rev:page.length&&page.length<rows.length?page.at(-1)!.row.rev:s.rev,items,hidden:{tracks:[],albums:[],playlists:[]},more:page.length<rows.length});
 }
 if(path==='/api/player-state')return method==='GET'?response(s.playerState):response(await mutate(async s=>{s.playerState=await body();return s.playerState;}));
 const uploadResponse=await demoUploads(request,path);if(uploadResponse)return uploadResponse;
 const artResponse=await demoArtwork(request,path);if(artResponse)return artResponse;
 if(path==='/api/tracks'&&['PATCH','DELETE'].includes(method))return response(await mutate(async s=>{const b=await body();const tracks=s.tracks.filter(t=>b.ids.includes(t.id)&&!t.deleted);const ops=[];for(const t of tracks){const before={...t};if(method==='DELETE')t.deleted=1;else{const values={...b.set,...b.perId?.[t.id]};for(const [key,value] of Object.entries(values))if(allowedMetadata.includes(key))(t as unknown as Record<string,unknown>)[columns[key]||key]=value;}t.rev=++s.rev;t.updated_at=Date.now();ops.push({table:'tracks',id:t.id,before,after:{...t}});}return {updated:tracks.length,changeId:log(s,`${method==='DELETE'?'Deleted':'Updated'} ${tracks.length} tracks`,ops)};}));
 const like=path.match(/^\/api\/likes\/([^/]+)$/);if(like&&['PUT','DELETE'].includes(method))return response(await mutate(s=>{if(!s.tracks.some(t=>t.id===like[1]&&!t.deleted))fail('not_found','Track not found.',404);let row=s.likes.find(l=>l.track_id===like[1]);if(!row){row={user_id:s.user.id,track_id:like[1],liked_at:Date.now(),rev:0,deleted:0};s.likes.push(row);}row.rev=++s.rev;row.deleted=method==='DELETE'?1:0;return {ok:true};}));
 if(path==='/api/plays'&&method==='POST'){await mutate(async s=>{s.plays.push(...(await body()).plays);});return response({ok:true});}
 if(path==='/api/changes')return response({items:s.changes.slice(0,Number(url.searchParams.get('limit')||50)),nextCursor:null});
 if(path==='/api/admin/settings')return method==='GET'?response(s.settings):response(await mutate(async s=>{Object.assign(s.settings,await body());return s.settings;}));
 if(path==='/api/sessions')return response({items:[{id:'demo',device_label:'This browser · demo',last_seen_at:Date.now(),current:true}],nextCursor:null});
 if(path==='/api/playlists'&&method==='GET')return response({items:s.playlists.filter(p=>!p.deleted),nextCursor:null});
 return response({error:{code:'not_found',message:'This endpoint is not available in this release.'}},404);
 }catch(error){if(error instanceof DOMException&&error.name==='AbortError')throw error;const e=error instanceof ApiError||error instanceof UploadError?error:new ApiError('internal',error instanceof Error?error.message:'Something went wrong.',500);return response({error:{code:e.code,message:e.message,retryAfter:e instanceof ApiError?e.retryAfter:undefined}},e.status);}
}
export const api:Api={demo:true,async request<T>(path:string,init:RequestInit={}){const headers=new Headers(init.headers);if(init.method&&!['GET','HEAD'].includes(init.method))headers.set('X-Wavehaus','1');const res=await demoFetch(path,{...init,headers});if(!res.ok){const {error}=await res.json();throw new ApiError(error.code,error.message,res.status);}return res.status===204?undefined as T:res.json();},mediaUrl:t=>`${import.meta.env.BASE_URL}demo-media/${t.id}`,artUrl:(a,size=600)=>`${import.meta.env.BASE_URL}demo-art/${a.id}/${a.art_source==='generated'?'generated-512.png':`${size}.webp`}?v=${a.rev}`};
