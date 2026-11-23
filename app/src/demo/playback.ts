import { playerInput,playsInput } from '../../../shared/playback-input';
import { ApiError } from '../api/types';
import { id } from '../library/ids';
import { demoSignedIn } from './auth';
import { mutate,readState } from './store';
type PlayRow={id:string;user_id:string;track_id:string;started_at:number;ms_played:number;completed:number;skipped:number;context:string|null;device_label:string|null};
const json=(data:unknown)=>Response.json(data,{headers:{'Cache-Control':'no-store'}});
export async function demoPlayback(request:Request,path:string){
 const method=request.method;
 if(path==='/api/player-state'){
  if(method==='GET')return json((await readState())!.playerState);
  if(method==='PUT'){const value=playerInput(await request.json());await mutate(s=>{if(!demoSignedIn(s))throw new ApiError('unauthenticated','Sign in to continue.',401);s.playerState=value;});return json(value);}
 }
 if(path!=='/api/plays')return null;
 if(method==='POST'){
  const plays=playsInput(await request.json()),recorded=await mutate(s=>{if(!demoSignedIn(s))throw new ApiError('unauthenticated','Sign in to continue.',401);let count=0;const existing=new Set((s.plays as PlayRow[]).map(row=>row.id));for(const p of plays){const eventId=p.id||id();if(existing.has(eventId)||!s.tracks.some(t=>t.id===p.trackId&&!t.deleted&&(t.owner_id===s.user.id||t.visibility==='public')))continue;existing.add(eventId);s.plays.push({id:eventId,user_id:s.user.id,track_id:p.trackId,started_at:p.startedAt,ms_played:p.msPlayed,completed:p.completed?1:0,skipped:p.skipped?1:0,context:p.context,device_label:p.deviceLabel} satisfies PlayRow);count++;}return count;});return json({ok:true,recorded});
 }
 if(method==='GET'){
  const url=new URL(request.url),limit=Number(url.searchParams.get('limit')||100);if(!Number.isSafeInteger(limit)||limit<1||limit>500)throw new ApiError('validation','Use a history page size from 1 to 500.',400);
  let at=Number.MAX_SAFE_INTEGER,eventId='ZZZZZZZZZZZZZZZZZZZZZZZZZZ';const cursor=url.searchParams.get('cursor');if(cursor){const match=/^(\d+)\.([0-9A-HJKMNP-TV-Z]{26})$/.exec(cursor);if(!match||!Number.isSafeInteger(Number(match[1])))throw new ApiError('validation','Invalid play history cursor.',400);at=Number(match[1]);eventId=match[2];}
  const s=(await readState())!,rows=(s.plays as PlayRow[]).filter(row=>row.user_id===s.user.id&&(row.started_at<at||row.started_at===at&&row.id<eventId)).sort((a,b)=>b.started_at-a.started_at||b.id.localeCompare(a.id)),items=rows.slice(0,limit),last=items.at(-1);return json({items,nextCursor:rows.length>limit?`${last!.started_at}.${last!.id}`:null});
 }
 return null;
}
