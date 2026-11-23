import { apiRoute,SCHEMA } from './router';
import { currentAuth,refreshedCookie } from './auth';
import { one } from './db';
import { ApiError,cookie,fail,json } from './http';
import type { Env } from './types';
import { APP_BASE,relativePath } from './deployment';
import { UploadError } from '../../shared/upload-input';
import { serveMedia } from './media';
const security={
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Permissions-Policy':'camera=(self)',
 'Content-Security-Policy':"default-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; style-src 'self'; font-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
};
export default {async fetch(request:Request,env:Env):Promise<Response>{
 let response:Response;
 try{
  const url=new URL(request.url),path=relativePath(url.pathname);
  if(path===null)fail('not_found','Not found.',404);
  if(APP_BASE!=='/'&&url.pathname===APP_BASE.slice(0,-1)){url.pathname=APP_BASE;response=Response.redirect(url,308);}
  else if(path.startsWith('/api/')||path.startsWith('/media/')||path.startsWith('/art/')){
   let schema;try{schema=await one<{version:number}>(env.DB,'SELECT COALESCE(MAX(version),0) AS version FROM schema_migrations');}catch{fail('migrations_pending','Apply the D1 migrations before opening Wavehaus.',503);}
   if(!schema||schema.version!==SCHEMA)fail('migrations_pending','Apply the matching D1 migrations before deploying this release.',503);
   if(!env.APP_SECRET||new TextEncoder().encode(env.APP_SECRET).length<32)fail('configuration','Set APP_SECRET with wrangler secret put APP_SECRET (at least 32 random bytes).',503);
   if(!['GET','HEAD'].includes(request.method)&&request.headers.get('X-Wavehaus')!=='1')fail('csrf','Missing X-Wavehaus header.',403);
   if(path.startsWith('/api/'))response=await apiRoute(request,env,path);
   else response=await serveMedia(request,env,(await currentAuth(request,env))!,path);
  }else if(path==='/app'||path==='/app/')response=Response.redirect(new URL(APP_BASE,url),302);
  else if(['GET','HEAD'].includes(request.method)){
   const asset=new URL(request.url);asset.pathname=path;response=await env.ASSETS.fetch(new Request(asset,request));
   if(response.status===404&&!/\/[^/]+\.[^/]+$/.test(path)){asset.pathname='/index.html';response=await env.ASSETS.fetch(new Request(asset,request));}
  }else response=json({error:{code:'not_found',message:'Not found.'}},404);
 }catch(error){if(error instanceof ApiError||error instanceof UploadError){const retry=error instanceof ApiError?error.retryAfter:undefined;response=json({error:{code:error.code,message:error.message,...(retry?{retryAfter:retry}:{})}},error.status,retry?{'Retry-After':String(retry)}:undefined);}else{console.error('Wavehaus request failed',error instanceof Error?error.name:'Error');response=json({error:{code:'internal',message:'The server could not complete this request. Check its error log.'}},500);}}
 const headers=new Headers(response.headers);for(const [key,value]of Object.entries(security))headers.set(key,value);const raw=refreshedCookie(request);if(raw&&!headers.has('Set-Cookie'))headers.set('Set-Cookie',cookie(raw));if(new URL(request.url).pathname.startsWith('/api/'))headers.set('Cache-Control','no-store');return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}};
