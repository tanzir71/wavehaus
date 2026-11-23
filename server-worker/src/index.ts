import { apiRoute,SCHEMA } from './router';
import { currentAuth,refreshedCookie } from './auth';
import { one } from './db';
import { ApiError,cookie,fail,json } from './http';
import type { Env } from './types';
const security={
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Permissions-Policy':'camera=(self)',
 'Content-Security-Policy':"default-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; style-src 'self'; font-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
};
export default {async fetch(request:Request,env:Env):Promise<Response>{
 let response:Response;
 try{
  const url=new URL(request.url),path=url.pathname;
  if(path.startsWith('/api/')||path.startsWith('/media/')||path.startsWith('/art/')){
   let schema;try{schema=await one<{version:number}>(env.DB,'SELECT COALESCE(MAX(version),0) AS version FROM schema_migrations');}catch{fail('migrations_pending','Apply the D1 migrations before opening Wavehaus.',503);}
   if(!schema||schema.version!==SCHEMA)fail('migrations_pending','Apply the matching D1 migrations before deploying this release.',503);
   if(!env.APP_SECRET||new TextEncoder().encode(env.APP_SECRET).length<32)fail('configuration','Set APP_SECRET with wrangler secret put APP_SECRET (at least 32 random bytes).',503);
   if(!['GET','HEAD'].includes(request.method)&&request.headers.get('X-Wavehaus')!=='1')fail('csrf','Missing X-Wavehaus header.',403);
   if(path.startsWith('/api/'))response=await apiRoute(request,env);
   else{await currentAuth(request,env);fail('not_found','This media endpoint arrives with library uploads.',404);}
  }else if(path==='/')response=Response.redirect(new URL('/app/',url),302);
  else if(/^\/(?:setup(?:\/reset)?|pair|join(?:\/[^/]+)?)$/.test(path))response=Response.redirect(new URL('/app'+path,url),302);
  else if(path.startsWith('/app/')){
   const asset=new URL(request.url);asset.pathname=path.slice(4);response=await env.ASSETS.fetch(new Request(asset,request));
   if(response.status===404&&!/\/[^/]+\.[^/]+$/.test(path)){asset.pathname='/index.html';response=await env.ASSETS.fetch(new Request(asset,request));}
  }else response=json({error:{code:'not_found',message:'Not found.'}},404);
 }catch(error){if(error instanceof ApiError)response=json({error:{code:error.code,message:error.message,...(error.retryAfter?{retryAfter:error.retryAfter}:{})}},error.status,error.retryAfter?{'Retry-After':String(error.retryAfter)}:undefined);else{console.error('Wavehaus request failed',error instanceof Error?error.name:'Error');response=json({error:{code:'internal',message:'The server could not complete this request. Check its error log.'}},500);}}
 const headers=new Headers(response.headers);for(const [key,value]of Object.entries(security))headers.set(key,value);const raw=refreshedCookie(request);if(raw&&!headers.has('Set-Cookie'))headers.set('Set-Cookie',cookie(raw));if(new URL(request.url).pathname.startsWith('/api/'))headers.set('Cache-Control','no-store');return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}};
