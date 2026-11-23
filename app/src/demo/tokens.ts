import {ApiError} from '../api/types';
import {authorizeToken,tokenInput} from '../../../shared/token-policy';
import {randomToken,sha} from '../../../shared/auth-crypto';
import {id} from '../library/ids';
import {demoSignedIn} from './auth';
import {currentDemoToken,mutate,readState,type DemoTokenIdentity} from './store';
export interface DemoApiToken {id:string;user_id:string;name:string;token_hash:string;prefix:string;scopes:string[];created_at:number;last_used_at:number|null;expires_at:number;revoked_at:number|null;rateAt?:number;rateCount?:number}
export async function authenticateDemoToken(request:Request,path:string):Promise<DemoTokenIdentity|null>{
 const header=request.headers.get('Authorization');if(!header?.startsWith('Bearer '))return null;const raw=header.slice(7);if(!/^wh_live_[A-Za-z0-9_-]{43}$/.test(raw))throw new ApiError('unauthenticated','This API token is unavailable or expired.',401);const hash=await sha(raw);return mutate(state=>{const row=state.apiTokens?.find(row=>row.token_hash===hash&&row.revoked_at===null&&row.expires_at>Date.now()),account=row&&state.accounts?.find(account=>account.user.id===row.user_id&&account.user.status!=='disabled');if(!row||!account)throw new ApiError('unauthenticated','This API token is unavailable or expired.',401);authorizeToken(request.method,path,row.scopes,account.user.role);if(!row.rateAt||row.rateAt<Date.now()-60000){row.rateAt=Date.now();row.rateCount=0;}row.rateCount=(row.rateCount||0)+1;if(row.rateCount>600)throw new ApiError('rate_limited','Too many token requests. Try again in a minute.',429,60);row.last_used_at=Date.now();return {id:row.id,userId:row.user_id,name:row.name,scopes:row.scopes};});
}
export async function demoTokens(request:Request,path:string){
 if(path!=='/api/tokens'&&!/^\/api\/tokens\/[0-9A-HJKMNP-TV-Z]{26}$/.test(path))return null;if(currentDemoToken())throw new ApiError('forbidden','Use a signed-in browser to manage API tokens.',403);const state=(await readState())!;if(!demoSignedIn(state))throw new ApiError('unauthenticated','Sign in to continue.',401);
 if(path==='/api/tokens'&&request.method==='GET')return Response.json({items:(state.apiTokens||[]).filter(row=>row.user_id===state.user.id).map(({token_hash,user_id,rateAt,rateCount,...row})=>row),nextCursor:null});
 if(path==='/api/tokens'&&request.method==='POST'){const input=tokenInput(await request.json(),state.user.role),raw='wh_live_'+randomToken(),row:DemoApiToken={id:id(),user_id:state.user.id,name:input.name,token_hash:await sha(raw),prefix:raw.slice(0,16),scopes:input.scopes,created_at:Date.now(),expires_at:input.expiresAt,last_used_at:null,revoked_at:null};await mutate(state=>{if(!demoSignedIn(state)||state.user.id!==row.user_id)throw new ApiError('unauthenticated','Sign in to continue.',401);state.apiTokens||=[];state.apiTokens.push(row);});const{token_hash,user_id,...publicRow}=row;return Response.json({...publicRow,token:raw},{status:201});}
 if(path!=='/api/tokens'&&request.method==='DELETE')return mutate(state=>{const row=state.apiTokens?.find(row=>row.id===path.split('/').at(-1)&&row.user_id===state.user.id);if(row)row.revoked_at=Date.now();return Response.json({ok:true});});return null;
}
