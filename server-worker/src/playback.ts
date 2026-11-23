import { playerInput,playsInput } from '../../shared/playback-input';
import { all,one,stmt } from './db';
import { ulid } from './crypto';
import { body,fail,json } from './http';
import type { Auth,Env } from './types';
export async function playbackRoutes(request:Request,env:Env,auth:Auth,path:string){
 const uid=auth.user.id,method=request.method;
 if(path==='/api/player-state'){
  if(method==='GET'){const row=await one<{state:string}>(env.DB,'SELECT state FROM player_state WHERE user_id=?',uid);return json(row?JSON.parse(row.state):null);}
  if(method==='PUT'){const value=playerInput(await body(request));await stmt(env.DB,"INSERT INTO player_state(user_id,state,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET state=excluded.state,updated_at=excluded.updated_at WHERE COALESCE(json_extract(player_state.state,'$.updatedAt'),0)<=?",uid,JSON.stringify(value),Date.now(),value.updatedAt).run();return json(JSON.parse((await one<{state:string}>(env.DB,'SELECT state FROM player_state WHERE user_id=?',uid))!.state));}
 }
 if(path!=='/api/plays')return null;
 if(method==='POST'){
  const plays=playsInput(await body(request));if(!plays.length)return json({ok:true,recorded:0});
  const result=await env.DB.batch(plays.map(p=>stmt(env.DB,"INSERT OR IGNORE INTO plays(id,user_id,track_id,started_at,ms_played,completed,skipped,context,device_label) SELECT ?,?,?,?,?,?,?,?,? FROM tracks WHERE id=? AND deleted=0 AND (owner_id=? OR visibility='public')",p.id||ulid(),uid,p.trackId,p.startedAt,p.msPlayed,p.completed?1:0,p.skipped?1:0,p.context,p.deviceLabel,p.trackId,uid)));
  return json({ok:true,recorded:result.reduce((sum,result)=>sum+result.meta.changes,0)});
 }
 if(method==='GET'){
  const url=new URL(request.url),limit=Number(url.searchParams.get('limit')||100);if(!Number.isSafeInteger(limit)||limit<1||limit>500)fail('validation','Use a history page size from 1 to 500.');
  let at=Number.MAX_SAFE_INTEGER,id='ZZZZZZZZZZZZZZZZZZZZZZZZZZ';const cursor=url.searchParams.get('cursor');if(cursor){const parts=/^(\d+)\.([0-9A-HJKMNP-TV-Z]{26})$/.exec(cursor);if(!parts||!Number.isSafeInteger(Number(parts[1])))fail('validation','Invalid play history cursor.');at=Number(parts[1]);id=parts[2];}
  const rows=await all<Record<string,unknown>>(env.DB,'SELECT * FROM plays WHERE user_id=? AND (started_at<? OR (started_at=? AND id<?)) ORDER BY started_at DESC,id DESC LIMIT ?',uid,at,at,id,limit+1),items=rows.slice(0,limit),last=items.at(-1);return json({items,nextCursor:rows.length>limit?`${last!.started_at}.${last!.id}`:null});
 }
 return null;
}
