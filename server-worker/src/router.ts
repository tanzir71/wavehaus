import { admin,authRoutes,currentAuth,iterations } from './auth';
import { one,run,settings } from './db';
import { body,fail,json } from './http';
import { saveSettings } from './settings';
import type { Env } from './types';
import { libraryRoutes } from './library';
import { uploadsRoutes } from './uploads';
import { artworkRoutes } from './art';
export const VERSION='0.2.1',SCHEMA=4;
export async function apiRoute(request:Request,env:Env,path=new URL(request.url).pathname):Promise<Response>{
 const url=new URL(request.url),method=request.method;
 if(path==='/api/health'&&method==='GET')return json({ok:true,version:VERSION,schema:SCHEMA,backend:'worker',needsSetup:!await one(env.DB,'SELECT id FROM users LIMIT 1')});
 if(path==='/api/config'&&method==='GET'){const cfg=await settings(env.DB),hashIterations=iterations(env);return json({serverName:cfg.server_name,registrationMode:cfg.registration_mode,maxChunkBytes:8*1024**2,maxFileBytes:cfg.max_file_bytes,powDifficulty:cfg.pow_difficulty,hashIterations,securityWarning:hashIterations<100000?'Password hashing is below the recommended 100,000 iterations.':null,features:{demo:false,uploads:true}});}
 const result=await authRoutes(request,env,path);if(result)return result;
 const auth=(await currentAuth(request,env))!;
 const uploaded=await uploadsRoutes(request,env,auth,path);if(uploaded)return uploaded;
 const artwork=await artworkRoutes(request,env,auth,path);if(artwork)return artwork;
 const library=await libraryRoutes(request,env,auth,path);if(library)return library;
 if(path==='/api/admin/settings'){admin(auth);if(method==='GET')return json(await settings(env.DB));if(method==='PATCH'){await env.DB.batch(saveSettings(env,await body(request)));return json(await settings(env.DB));}}
 if(path==='/api/player-state'){if(method==='GET'){const row=await one<{state:string}>(env.DB,'SELECT state FROM player_state WHERE user_id=?',auth.user.id);return json(row?JSON.parse(row.state):null);}if(method==='PUT'){const value=await body(request);await run(env.DB,'INSERT INTO player_state(user_id,state,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET state=excluded.state,updated_at=excluded.updated_at',auth.user.id,JSON.stringify(value),Date.now());return json(value);}}
 fail('not_found','This endpoint is not available in this release.',404);
}
