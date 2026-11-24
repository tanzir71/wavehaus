

import {publicReadPath} from '../../../shared/public-read';
import { demoPlayback } from './playback';
import { UploadError } from '../../../shared/upload-input';
import { JournalConflict } from '../../../shared/journal';
import { ApiError,emptyLibrary,type Api,type Album,type Library,type Track } from '../api/types';

import { getArt,getBlob,rangeResponse } from '../../public/runtime/media.js';
import { currentDemoToken,setDemoToken,mutate,readState,type DemoState } from './store';
import { seed } from './seed';
import { demoAuth,ensureAuth,demoSignedIn } from './auth';
export { seed };
const response=(data:unknown,status=200)=>new Response(status===204?null:JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
function fail(code:string,message:string,status=400):never {throw new ApiError(code,message,status);}
async function demoFetchCore(input:RequestInfo|URL,init?:RequestInit):Promise<Response>{
 const request=input instanceof Request?input:new Request(new URL(String(input),location.origin),init);const url=new URL(request.url),path=url.pathname.replace(/^.*?(\/(?:api|demo-media|media|demo-art|art)\/)/,'$1'),method=request.method;
 try{
 await seed();await ensureAuth();
 if(path.startsWith('/demo-media/')||path.startsWith('/media/')){const state=(await readState())!;const uid=demoSignedIn(state)?state.user.id:'';const track=state.tracks.find(t=>t.id===path.split('/')[2]&&!t.deleted);if(track&&track.owner_id!==uid&&track.visibility!=='public')fail('forbidden','This track is private.',403);const blob=track?await getBlob(`audio-${track.id}`):null;return blob&&track?rangeResponse(blob,request,track.mime,`"${track.sha256}"`):response({error:{code:'not_found',message:'Track not found'}},404);}
 if(!['GET','HEAD'].includes(method)&&request.headers.get('X-Wavehaus')!=='1'&&!currentDemoToken())return response({error:{code:'csrf',message:'Missing X-Wavehaus header.'}},403);
 const body=()=>request.json();const s=(await readState())!;
 if(path==='/api/health')return response({ok:true,version:'1.0.0',schema:10,backend:'demo',needsSetup:false});
 if(path==='/api/config')return response({serverName:s.settings.server_name,registrationMode:s.settings.registration_mode,maxChunkBytes:8*1024*1024,maxFileBytes:2*1024**3,powDifficulty:18,features:{demo:true,uploads:true}});
 if(['/api/auth/challenge','/api/auth/register','/api/auth/request-access'].includes(path)||path.startsWith('/api/admin/')||path.startsWith('/api/invites')){const{demoAccess}=await import('./access');const result=await demoAccess(request,path);if(result)return result;}
 if(path.startsWith('/api/tokens')){const{demoTokens}=await import('./tokens');const result=await demoTokens(request,path);if(result)return result;}
 const authentication=await demoAuth(request,path);if(authentication)return authentication;
 const uid=demoSignedIn(s)?s.user.id:'';if(!uid&&!(method==='GET'&&publicReadPath(path))&&!(['GET','HEAD'].includes(method)&&/^\/(?:art|demo-art)\//.test(path)))fail('unauthenticated','Sign in to continue.',401);
 if(request.method==='GET'&&(['/api/search','/api/tracks','/api/albums'].includes(path)||/^\/api\/albums\/[0-9A-HJKMNP-TV-Z]{26}$/.test(path))){const{demoReadApi}=await import('./read-api');const result=await demoReadApi(request,path);if(result)return result;}
 if(path.startsWith('/api/changes')){const {demoJournal}=await import('./journal');const result=await demoJournal(request,path);if(result)return result;}
 if(path==='/api/tracks'&&['PATCH','DELETE'].includes(method)){const{demoEdits}=await import('./edits');return (await demoEdits(request,path))!;}
 if(path.startsWith('/api/albums/')&&(method==='PATCH'||path==='/api/albums/merge'&&method==='POST')){const{demoEdits}=await import('./edits');const result=await demoEdits(request,path);if(result)return result;}
 if(path==='/api/visibility'){const{demoVisibility}=await import('./visibility');const result=await demoVisibility(request,path);if(result)return result;}
 if(path.startsWith('/api/playlists')){const{demoPlaylists}=await import('./playlists');const result=await demoPlaylists(request,path);if(result)return result;}
 const artwork=path.match(/^\/(?:art|demo-art)\/([0-9A-HJKMNP-TV-Z]{26})\/(96\.webp|600\.webp|generated-512\.png)$/);if(artwork&&['GET','HEAD'].includes(method)){const album=s.albums.find(a=>a.id===artwork[1]&&!a.deleted);if(!album)fail('not_found','Album not found.',404);if(album.owner_id!==uid&&album.visibility!=='public'&&!s.tracks.some(track=>!track.deleted&&track.album_id===album.id&&track.visibility==='public'))fail('forbidden','This album is private.',403);const blob=await getArt(artwork[1],artwork[2],album.art_key??null);return blob?new Response(method==='HEAD'?null:blob,{headers:{'Content-Type':blob.type,'Content-Length':String(blob.size),'Cache-Control':'private, max-age=31536000, immutable'}}):response({error:{code:'not_found',message:'Artwork has not arrived yet.'}},404);}
 if(path==='/api/library'){
  const since=Number(url.searchParams.get('since')||0);if(!Number.isSafeInteger(since)||since<0)fail('invalid_cursor','Invalid library cursor.');
  const limit=Number(url.searchParams.get('limit')||2000);if(!Number.isInteger(limit)||limit<1||limit>2000)fail('validation','Use a library page size from 1 to 2000.');const items=emptyLibrary(),hidden:{tracks:string[];albums:string[];playlists:string[]}={tracks:[],albums:[],playlists:[]};
  const visible=(row:{owner_id:string;visibility:string})=>row.owner_id===uid||row.visibility==='public'||s.albums.includes(row as Album)&&s.tracks.some(track=>!track.deleted&&track.album_id===(row as Album).id&&track.visibility==='public'),trackIds=new Set(s.tracks.filter(visible).map(row=>row.id)),playlistIds=new Set(s.playlists.filter(visible).map(row=>row.id)),artistIds=new Set([...s.tracks.filter(visible),...s.albums.filter(visible)].map(row=>row.artist_id));
  const readable=(key:string,row:any)=>['tracks','albums','playlists'].includes(key)?visible(row):key==='artists'?artistIds.has(row.id):key==='playlistItems'?playlistIds.has(row.playlist_id)&&trackIds.has(row.track_id):row.user_id===uid&&trackIds.has(row.track_id);
  const rows=Object.entries(items).flatMap(([key])=>s[key as keyof Library].filter(row=>row.rev>since&&readable(key,row)).map(row=>({key,row}))) as {key:string;row:{rev:number;id?:string}}[];
  for(const key of ['tracks','albums','playlists'] as const)for(const row of s[key])if(row.owner_id!==uid&&row.visibility==='private'&&(row.hidden_rev||0)>since)rows.push({key:'hidden:'+key,row:{id:row.id,rev:row.hidden_rev!}});
  rows.sort((a,b)=>a.row.rev-b.row.rev);const page=rows.slice(0,limit);
  for(const {key,row} of page)if(key.startsWith('hidden:'))hidden[key.slice(7) as keyof typeof hidden].push(row.id!);else(items[key as keyof Library] as unknown[]).push(row);
  return response({rev:page.length&&page.length<rows.length?page.at(-1)!.row.rev:s.rev,items,hidden,more:page.length<rows.length});
 }
 if(path.startsWith('/api/moments')){const {demoMoments}=await import('./moments');const result=await demoMoments(request,path);if(result)return result;}
 const playback=await demoPlayback(request,path);if(playback)return playback;
 if(path.startsWith('/api/uploads')){const {demoUploads}=await import('./uploads');const result=await demoUploads(request,path);if(result)return result;}
 if(path.startsWith('/api/albums/')&&path.endsWith('/art')){const {demoArtwork}=await import('./art');const result=await demoArtwork(request,path);if(result)return result;}
 const like=path.match(/^\/api\/likes\/([^/]+)$/);if(like&&['PUT','DELETE'].includes(method))return response(await mutate(s=>{if(!s.tracks.some(t=>t.id===like[1]&&!t.deleted&&(t.owner_id===s.user.id||t.visibility==='public')))fail('not_found','Track not found.',404);let row=s.likes.find(l=>l.track_id===like[1]&&l.user_id===s.user.id);if(!row){row={user_id:s.user.id,track_id:like[1],liked_at:Date.now(),rev:0,deleted:0};s.likes.push(row);}row.rev=++s.rev;row.deleted=method==='DELETE'?1:0;return {ok:true};}));

 if(path==='/api/sessions')return response({items:[{id:'demo',device_label:'This browser · demo',last_seen_at:Date.now(),current:true}],nextCursor:null});
 if(path==='/api/playlists'&&method==='GET')return response({items:s.playlists.filter(p=>!p.deleted),nextCursor:null});
 return response({error:{code:'not_found',message:'This endpoint is not available in this release.'}},404);
 }catch(error){if(error instanceof DOMException&&error.name==='AbortError')throw error;const e=error instanceof ApiError||error instanceof UploadError?error:new ApiError('internal',error instanceof Error?error.message:'Something went wrong.',500);return response({error:{code:e.code,message:e.message,retryAfter:e instanceof ApiError?e.retryAfter:undefined,...(e instanceof JournalConflict?{conflicts:e.conflicts}:{})}},e.status);}
}
let requestSerial=Promise.resolve();
export function demoFetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response>{const operation=async()=>{const request=input instanceof Request?input:new Request(new URL(String(input),location.origin),init);try{if(request.headers.get('Authorization')?.startsWith('Bearer ')){await seed();await ensureAuth();const path=new URL(request.url).pathname.replace(/^.*?(\/(?:api|demo-media|media|demo-art|art)\/)/,'$1'),{authenticateDemoToken}=await import('./tokens');setDemoToken(await authenticateDemoToken(request,path));}return await demoFetchCore(request);}catch(error){const item=error instanceof ApiError||error instanceof UploadError?error:new ApiError('internal','The demo could not complete this request.',500);return response({error:{code:item.code,message:item.message}},item.status);}finally{setDemoToken(null);}};const next=requestSerial.then(operation,operation);requestSerial=next.then(()=>{},()=>{});return next;}
export const api:Api={demo:true,async request<T>(path:string,init:RequestInit={}){const headers=new Headers(init.headers);if(init.method&&!['GET','HEAD'].includes(init.method))headers.set('X-Wavehaus','1');const res=await demoFetch(path,{...init,headers});if(!res.ok){const {error}=await res.json();throw new ApiError(error.code,error.message,res.status,error.retryAfter,error.conflicts);}return res.status===204?undefined as T:res.json();},mediaUrl:t=>`${import.meta.env.BASE_URL}demo-media/${t.id}`,artUrl:(a,size=600)=>`${import.meta.env.BASE_URL}demo-art/${a.id}/${a.art_source==='generated'?'generated-512.png':`${size}.webp`}?v=${a.rev}`};
