import { admin,authRoutes,currentAuth,iterations } from './auth';
import { one,run,settings } from './db';
import { body,fail,json } from './http';
import { saveSettings } from './settings';
import type { Env } from './types';
export const VERSION='0.1.0',SCHEMA=2;
export async function apiRoute(request:Request,env:Env):Promise<Response>{
 const url=new URL(request.url),path=url.pathname,method=request.method;
 if(path==='/api/health'&&method==='GET')return json({ok:true,version:VERSION,schema:SCHEMA,backend:'worker',needsSetup:!await one(env.DB,'SELECT id FROM users LIMIT 1')});
 if(path==='/api/config'&&method==='GET'){const cfg=await settings(env.DB),hashIterations=iterations(env);return json({serverName:cfg.server_name,registrationMode:cfg.registration_mode,maxChunkBytes:8*1024**2,maxFileBytes:cfg.max_file_bytes,powDifficulty:cfg.pow_difficulty,hashIterations,securityWarning:hashIterations<100000?'Password hashing is below the recommended 100,000 iterations.':null,features:{demo:false,uploads:false,homepage:false}});}
 const result=await authRoutes(request,env,path);if(result)return result;
 const auth=(await currentAuth(request,env))!;
 if(path==='/api/admin/settings'){admin(auth);if(method==='GET')return json(await settings(env.DB));if(method==='PATCH'){await env.DB.batch(saveSettings(env,await body(request)));return json(await settings(env.DB));}}
 if(path==='/api/library'&&method==='GET'){const since=Number(url.searchParams.get('since')||0);if(!Number.isSafeInteger(since)||since<0)fail('invalid_cursor','Invalid library cursor.');const rev=await one<{n:number}>(env.DB,'SELECT n FROM revs WHERE id=1');return json({rev:rev!.n,items:{tracks:[],albums:[],artists:[],playlists:[],playlistItems:[],likes:[],moments:[]},hidden:{tracks:[],albums:[],playlists:[]},more:false});}
 if(path==='/api/player-state'){if(method==='GET'){const row=await one<{state:string}>(env.DB,'SELECT state FROM player_state WHERE user_id=?',auth.user.id);return json(row?JSON.parse(row.state):null);}if(method==='PUT'){const value=await body(request);await run(env.DB,'INSERT INTO player_state(user_id,state,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET state=excluded.state,updated_at=excluded.updated_at',auth.user.id,JSON.stringify(value),Date.now());return json(value);}}
 if(path==='/api/changes'&&method==='GET')return json({items:[],nextCursor:null});
 fail('not_found','This endpoint is not available in this release.',404);
}
