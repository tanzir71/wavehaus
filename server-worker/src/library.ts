import { peaksInput } from '../../shared/upload-input';
import { all,one,run,stmt } from './db';
import { body,fail,json } from './http';
import type { Auth,Env } from './types';
export type WireRow=Record<string,unknown>&{id:string;rev:number;deleted:number};
export const albumRow=(env:Env,id:string)=>one<WireRow>(env.DB,'SELECT a.*,COALESCE(a.artist_name,ar.name) AS artist_name FROM albums a LEFT JOIN artists ar ON ar.id=a.artist_id WHERE a.id=?',id);
export const trackRow=(env:Env,id:string)=>one<WireRow>(env.DB,'SELECT * FROM tracks WHERE id=?',id);
export async function readableTrack(env:Env,auth:Auth,id:string){const track=await one<WireRow>(env.DB,'SELECT * FROM tracks WHERE id=? AND deleted=0',id);if(!track)fail('not_found','Track not found.',404);if(track.owner_id!==auth.user.id&&track.visibility!=='public')fail('forbidden','This track is private.',403);return track;}
function integer(value:string|null,fallback:number,max=Number.MAX_SAFE_INTEGER){if(value===null)return fallback;if(!/^(?:0|[1-9]\d*)$/.test(value))fail('validation','Use a valid integer cursor or page size.');const number=Number(value);if(!Number.isSafeInteger(number)||number>max)fail('validation','Use a valid integer cursor or page size.');return number;}
export async function libraryRoutes(request:Request,env:Env,auth:Auth,path:string):Promise<Response|null>{
 const method=request.method,url=new URL(request.url),uid=auth.user.id;
 if(path==='/api/library'&&method==='GET'){
  let since:number;try{since=integer(url.searchParams.get('since'),0);}catch{fail('invalid_cursor','Invalid library cursor.');}const limit=integer(url.searchParams.get('limit'),2000,2000);if(limit<1)fail('validation','Use a library page size from 1 to 2000.');
  const revision=(await one<{n:number}>(env.DB,'SELECT n FROM revs WHERE id=1'))!.n,budget=6*1024**2;
  // D1 buffers a result set before returning it. A native SQL window bounds
  // lyric-heavy track pages before they cross the Worker's 128 MB heap limit.
  const trackCost="2048+length(CAST(COALESCE(t.lyrics,'') AS BLOB))+length(CAST(COALESCE(t.peaks,'') AS BLOB))+4*(length(t.title)+length(t.artist_name)+length(COALESCE(t.album_artist,''))+length(COALESCE(t.album_title,''))+length(COALESCE(t.genre,''))+length(t.original_name)+length(COALESCE(t.original_path,'')))";
  const queries:[string,string,unknown[]][]=[
   ['tracks',`WITH limited AS(SELECT t.*,SUM(${trackCost}) OVER(ORDER BY t.rev) AS _wh_bytes FROM tracks t WHERE t.rev>? AND t.rev<=? AND (t.owner_id=? OR t.visibility='public') ORDER BY t.rev LIMIT ?) SELECT * FROM limited WHERE _wh_bytes<=? OR rev=(SELECT MIN(rev) FROM limited WHERE _wh_bytes>?) ORDER BY rev`,[since,revision,uid,limit+1,budget,budget]],
   ['albums',"SELECT a.*,COALESCE(a.artist_name,ar.name) AS artist_name FROM albums a LEFT JOIN artists ar ON ar.id=a.artist_id WHERE a.rev>? AND a.rev<=? AND (a.owner_id=? OR a.visibility='public' OR EXISTS(SELECT 1 FROM tracks shared WHERE shared.album_id=a.id AND shared.visibility='public' AND shared.deleted=0)) ORDER BY a.rev LIMIT ?",[since,revision,uid,limit+1]],
   ['artists',"SELECT ar.* FROM artists ar WHERE ar.rev>? AND ar.rev<=? AND (EXISTS(SELECT 1 FROM tracks t WHERE t.artist_id=ar.id AND (t.owner_id=? OR t.visibility='public')) OR EXISTS(SELECT 1 FROM albums a WHERE a.artist_id=ar.id AND (a.owner_id=? OR a.visibility='public' OR EXISTS(SELECT 1 FROM tracks shared WHERE shared.album_id=a.id AND shared.visibility='public' AND shared.deleted=0)))) ORDER BY ar.rev LIMIT ?",[since,revision,uid,uid,limit+1]],
   ['playlists',"SELECT p.* FROM playlists p WHERE p.rev>? AND p.rev<=? AND (p.owner_id=? OR p.visibility='public') ORDER BY p.rev LIMIT ?",[since,revision,uid,limit+1]],
   ['playlistItems',"SELECT i.* FROM playlist_items i JOIN playlists p ON p.id=i.playlist_id JOIN tracks t ON t.id=i.track_id WHERE i.rev>? AND i.rev<=? AND (p.owner_id=? OR p.visibility='public') AND (t.owner_id=? OR t.visibility='public') ORDER BY i.rev LIMIT ?",[since,revision,uid,uid,limit+1]],
   ['likes',"SELECT l.* FROM likes l JOIN tracks t ON t.id=l.track_id WHERE l.rev>? AND l.rev<=? AND l.user_id=? AND (t.owner_id=? OR t.visibility='public') ORDER BY l.rev LIMIT ?",[since,revision,uid,uid,limit+1]],
   ['moments',"SELECT m.* FROM moments m JOIN tracks t ON t.id=m.track_id WHERE m.rev>? AND m.rev<=? AND m.user_id=? AND (t.owner_id=? OR t.visibility='public') ORDER BY m.rev LIMIT ?",[since,revision,uid,uid,limit+1]]
  ];
  const items:Record<string,WireRow[]>=Object.fromEntries(queries.map(([key])=>[key,[]])),hidden:Record<string,string[]>={tracks:[],albums:[],playlists:[]};
  for(const table of ['tracks','albums','playlists'])queries.push(['hidden:'+table,`SELECT id,hidden_rev AS rev FROM ${table} WHERE hidden_rev>? AND hidden_rev<=? AND visibility='private' AND owner_id<>? ORDER BY hidden_rev LIMIT ?`,[since,revision,uid,limit+1]]);
  let cutoff=Infinity;const rows=(await Promise.all(queries.map(async([key,sql,args])=>(await all<WireRow>(env.DB,sql,...args)).flatMap(row=>{if(key==='tracks'&&Number(row._wh_bytes)>budget){cutoff=Math.min(cutoff,row.rev);return [];}delete row._wh_bytes;return [{key,row}];})))).flat().filter(entry=>entry.row.rev<cutoff).sort((a,b)=>a.row.rev-b.row.rev);
  let bytes=0,count=0,last=since;
  for(const {key,row}of rows){const length=new TextEncoder().encode(JSON.stringify(row)).byteLength;if(count>=limit||count&&bytes+length>8*1024**2)break;if(key.startsWith('hidden:'))hidden[key.slice(7)].push(row.id);else items[key].push(row);bytes+=length;count++;last=row.rev;}
  const more=count<rows.length||cutoff!==Infinity;return json({rev:more?last:revision,items,hidden,more});
 }
 const peak=path.match(/^\/api\/tracks\/([0-9A-HJKMNP-TV-Z]{26})\/peaks$/);
 if(peak&&method==='POST'){
  const track=await readableTrack(env,auth,peak[1]),peaks=peaksInput((await body(request)).peaks);if(peaks===null)fail('invalid_peaks','Waveforms need exactly 1000 peak values.');await env.DB.batch([stmt(env.DB,'UPDATE revs SET n=n+1 WHERE id=1'),stmt(env.DB,'UPDATE tracks SET peaks=?,updated_at=?,rev=(SELECT n FROM revs WHERE id=1) WHERE id=? AND peaks IS NULL',peaks,Date.now(),track.id)]);return json({ok:true});
 }
 const like=path.match(/^\/api\/likes\/([0-9A-HJKMNP-TV-Z]{26})$/);
 if(like&&['PUT','DELETE'].includes(method)){await readableTrack(env,auth,like[1]);await env.DB.batch([stmt(env.DB,'UPDATE revs SET n=n+1 WHERE id=1'),stmt(env.DB,'INSERT INTO likes(user_id,track_id,liked_at,rev,deleted) VALUES(?,?,?,(SELECT n FROM revs WHERE id=1),?) ON CONFLICT(user_id,track_id) DO UPDATE SET liked_at=excluded.liked_at,rev=excluded.rev,deleted=excluded.deleted',uid,like[1],Date.now(),method==='DELETE'?1:0)]);return json({ok:true});}
 if(path==='/api/changes'&&method==='GET'){
  const limit=integer(url.searchParams.get('limit'),50,100);if(limit<1)fail('validation','Use an activity page size from 1 to 100.');const cursor=integer(url.searchParams.get('cursor'),Number.MAX_SAFE_INTEGER),rows=await all<Record<string,unknown>>(env.DB,'SELECT * FROM changes WHERE user_id=? AND created_at<? ORDER BY created_at DESC LIMIT ?',uid,cursor,limit+1),more=rows.length>limit,items=rows.slice(0,limit).map(row=>({...row,ops:JSON.parse(String(row.ops))} as Record<string,unknown>));return json({items,nextCursor:more?String(items.at(-1)!.created_at):null});
 }
 return null;
}
