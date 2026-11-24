import {momentRoutes} from './moments';
import { admin,authRoutes,currentAuth,iterations } from './auth';
import { one,settings } from './db';
import { body,fail,json } from './http';
import { saveSettings } from './settings';
import type { Env } from './types';
import { libraryRoutes } from './library';
import { uploadsRoutes } from './uploads';
import { artworkRoutes } from './art';
import { playbackRoutes } from './playback';
import { journalRoutes } from './journal-routes';
import { metadataRoutes } from './metadata';
import {visibilityRoutes} from './visibility';
import {readApi} from './read-api';
import {tokenRoutes} from './tokens';
import {accessRoutes,registrationRoutes} from './access';
import {playlistRoutes} from './playlists';
import {publicReadPath} from '../../shared/public-read';
import {guestAuth} from './guest';
export const VERSION='1.0.0',SCHEMA=10;
export async function apiRoute(request:Request,env:Env,path=new URL(request.url).pathname):Promise<Response>{
 const url=new URL(request.url),method=request.method;
 if(path==='/api/health'&&method==='GET')return json({ok:true,version:VERSION,schema:SCHEMA,backend:'worker',needsSetup:!await one(env.DB,'SELECT id FROM users LIMIT 1')});
 if(path==='/api/config'&&method==='GET'){const cfg=await settings(env.DB),hashIterations=iterations(env);return json({serverName:cfg.server_name,registrationMode:cfg.registration_mode,maxChunkBytes:8*1024**2,maxFileBytes:cfg.max_file_bytes,powDifficulty:cfg.pow_difficulty,hashIterations,securityWarning:hashIterations<100000?'Password hashing is below the recommended 100,000 iterations.':null,features:{demo:false,uploads:true}});}
 const registration=await registrationRoutes(request,env,path);if(registration)return registration;
 const result=await authRoutes(request,env,path);if(result)return result;
 const auth=await currentAuth(request,env,false)||(method==='GET'&&publicReadPath(path)?guestAuth():(await currentAuth(request,env))!);
 const read=await readApi(request,env,auth,path);if(read)return read;
 const tokens=await tokenRoutes(request,env,auth,path);if(tokens)return tokens;
 const access=await accessRoutes(request,env,auth,path);if(access)return access;
 const journal=await journalRoutes(request,env,auth,path);if(journal)return journal;
 const metadata=await metadataRoutes(request,env,auth,path);if(metadata)return metadata;
 const visibility=await visibilityRoutes(request,env,auth,path);if(visibility)return visibility;
 const playlists=await playlistRoutes(request,env,auth,path);if(playlists)return playlists;
 const uploaded=await uploadsRoutes(request,env,auth,path);if(uploaded)return uploaded;
 const artwork=await artworkRoutes(request,env,auth,path);if(artwork)return artwork;
 const library=await libraryRoutes(request,env,auth,path);if(library)return library;
 const moments=await momentRoutes(request,env,auth,path);if(moments)return moments;
 const playback=await playbackRoutes(request,env,auth,path);if(playback)return playback;
 if(path==='/api/admin/settings'){admin(auth);if(method==='GET')return json(await settings(env.DB));if(method==='PATCH'){await env.DB.batch(saveSettings(env,await body(request)));return json(await settings(env.DB));}}
 fail('not_found','This endpoint is not available in this release.',404);
}
