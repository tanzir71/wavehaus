import {authorizeToken,tokenInput} from '../../shared/token-policy';
import {publicUser} from './auth';
import {randomToken,sha,ulid} from './crypto';
import {all,one,run,stmt} from './db';
import {body,fail,json} from './http';
import {rate} from './ratelimit';
import {relativePath} from './deployment';
import type {Auth,Env,User} from './types';
export async function bearerAuth(request:Request,env:Env):Promise<Auth|null>{
 const header=request.headers.get('Authorization');if(!header?.startsWith('Bearer '))return null;const raw=header.slice(7);if(!/^wh_live_[A-Za-z0-9_-]{43}$/.test(raw))fail('unauthenticated','This API token is unavailable or expired.',401);
 const token=await one<{id:string;user_id:string;name:string;scopes:string;created_at:number;last_used_at:number|null;expires_at:number|null}>(env.DB,'SELECT id,user_id,name,scopes,created_at,last_used_at,expires_at FROM api_tokens WHERE token_hash=? AND revoked_at IS NULL AND(expires_at IS NULL OR expires_at>?)',await sha(raw),Date.now());if(!token)fail('unauthenticated','This API token is unavailable or expired.',401);const user=await one<User>(env.DB,"SELECT * FROM users WHERE id=? AND status='active'",token.user_id);if(!user)fail('unauthenticated','This API token is unavailable or expired.',401);await rate(env,'api-token',600,60,token.id);const scopes=JSON.parse(token.scopes) as string[];authorizeToken(request.method,relativePath(new URL(request.url).pathname)||'/',scopes,user.role);if(!token.last_used_at||token.last_used_at<Date.now()-600000)await run(env.DB,'UPDATE api_tokens SET last_used_at=? WHERE id=?',Date.now(),token.id);return {user:publicUser(user),session:{id:token.id,user_id:user.id,device_label:token.name,created_at:token.created_at,last_seen_at:Date.now(),expires_at:token.expires_at||Number.MAX_SAFE_INTEGER},token:{id:token.id,name:token.name,scopes}};
}
export async function tokenRoutes(request:Request,env:Env,auth:Auth,path:string){
 if(path!=='/api/tokens'&&!/^\/api\/tokens\/[0-9A-HJKMNP-TV-Z]{26}$/.test(path))return null;if(auth.token)fail('forbidden','Use a signed-in browser to manage API tokens.',403);const method=request.method;
 if(path==='/api/tokens'&&method==='GET'){const rows=await all<Record<string,unknown>>(env.DB,'SELECT id,name,prefix,scopes,created_at,last_used_at,expires_at,revoked_at FROM api_tokens WHERE user_id=? ORDER BY created_at DESC LIMIT 2000',auth.user.id);return json({items:rows.map(row=>({...row,scopes:JSON.parse(String(row.scopes))})),nextCursor:null});}
 if(path==='/api/tokens'&&method==='POST'){const input=tokenInput(await body(request),auth.user.role),raw='wh_live_'+randomToken(),id=ulid(),prefix=raw.slice(0,16),now=Date.now();await run(env.DB,'INSERT INTO api_tokens(id,user_id,name,token_hash,prefix,scopes,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)',id,auth.user.id,input.name,await sha(raw),prefix,JSON.stringify(input.scopes),now,input.expiresAt);return json({id,name:input.name,prefix,token:raw,scopes:input.scopes,created_at:now,expires_at:input.expiresAt},201);}
 if(path!=='/api/tokens'&&method==='DELETE'){await run(env.DB,'UPDATE api_tokens SET revoked_at=? WHERE id=? AND user_id=? AND revoked_at IS NULL',Date.now(),path.split('/').at(-1),auth.user.id);return json({ok:true});}return null;
}
