import {bearerAuth} from './tokens';
import { APP_BASE } from './deployment';
import { all,one,run,stmt,settings } from './db';
import { codes,passwordHash,passwordVerify,randomToken,recoveryHash,sha,timingEqual,ulid } from './crypto';
import { body,cookie,fail,json,withCookie,cookieValue,sessionCookieName } from './http';
import { checkLock,clearLock,failedLogin,ip,rate } from './ratelimit';
import type { Auth,Env,Session,Statement,User } from './types';

// Mirror of the owner's Tack PHP credential flow. D1 uses conditional statements
// in atomic batches, rather than an interactive BEGIN IMMEDIATE transaction.
const refresh=new WeakMap<Request,string>(),authCache=new WeakMap<Request,Promise<Auth|null>>();
export const refreshedCookie=(request:Request)=>refresh.get(request);
export const publicUser=(row:User)=>{const {password_hash:_,...user}=row;return user;};
export function username(value:unknown,register=false){if(typeof value!=='string')fail('validation','Enter a username and password.');const name=value.trim().toLowerCase();if(!/^[a-z0-9_.-]{3,32}$/.test(name))fail('validation','Use a username of 3–32 letters, numbers, dots, dashes, or underscores.');if(register&&['admin','owner','root','api','setup','wavehaus','support','system'].includes(name))fail('validation','Choose another username. That name is reserved.');return name;}
export function password(value:unknown){if(typeof value!=='string'||[...value].length<10||new TextEncoder().encode(value).length>72)fail('validation','Use a password or passphrase of at least 10 characters, up to 72 UTF-8 bytes.');return value;}
export function device(value:unknown){if(typeof value!=='string'||!value.trim()||[...value].length>100)fail('validation','Name this device before signing in.');return value.trim();}
export function iterations(env:Env){const value=Number(env.PBKDF2_ITERATIONS||100000);if(!Number.isInteger(value)||value<1000||value>100000)fail('configuration','PBKDF2_ITERATIONS must be between 1000 and 100000.',503);return value;}
export function admin(auth:Auth){if(!['owner','admin'].includes(auth.user.role))fail('forbidden','Only an owner or admin can change server settings.',403);}
export async function currentAuth(request:Request,env:Env,required=true):Promise<Auth|null>{
 let pending=authCache.get(request);if(!pending){pending=(async()=>{const bearer=await bearerAuth(request,env);if(bearer)return bearer;const raw=cookieValue(request,sessionCookieName)||(APP_BASE!=='/'?cookieValue(request,'__Host-wh_session'):undefined);if(!raw||raw.length>255)return null;const session=await one<Session>(env.DB,'SELECT id,user_id,device_label,created_at,last_seen_at,expires_at FROM sessions WHERE token_hash=? AND expires_at>?',await sha(raw),Date.now());if(!session)return null;const user=await one<User>(env.DB,"SELECT * FROM users WHERE id=? AND status='active'",session.user_id);if(!user)return null;const now=Date.now();if(APP_BASE!=='/'&&!cookieValue(request,sessionCookieName))refresh.set(request,raw);if(session.last_seen_at<now-600000){await run(env.DB,'UPDATE sessions SET last_seen_at=?,expires_at=? WHERE id=? AND last_seen_at<?',now,now+180*86400000,session.id,now-600000);refresh.set(request,raw);}return {user:publicUser(user),session};})();authCache.set(request,pending);}const result=await pending;if(required&&!result)fail('unauthenticated','Sign in to continue.',401);return result;
}
export async function makeSession(request:Request,env:Env,userId:string,label:string,condition='1',params:unknown[]=[]){const raw=randomToken(),id=ulid(),now=Date.now();return {raw,id,statement:stmt(env.DB,`INSERT INTO sessions(id,user_id,token_hash,device_label,user_agent,created_at,last_seen_at,expires_at) SELECT ?,id,?,?,?,?,?,? FROM users WHERE id=? AND status='active' AND (${condition})`,id,await sha(raw),label,(request.headers.get('User-Agent')||'').slice(0,500),now,now,now+180*86400000,userId,...params)};}
export const insertCodes=(env:Env,userId:string,list:Awaited<ReturnType<typeof codes>>,condition='1',params:unknown[]=[]):Statement[]=>list.map(c=>stmt(env.DB,`INSERT INTO recovery_codes(id,user_id,code_hash) SELECT ?,id,? FROM users WHERE id=? AND (${condition})`,c.id,c.hash,userId,...params));
export async function authRoutes(request:Request,env:Env,path:string):Promise<Response|null>{
 const method=request.method;
 if(path==='/api/setup'&&method==='POST'){
  if(await one(env.DB,'SELECT id FROM users LIMIT 1'))fail('not_found','Not found.',404);
  const input=await body(request),name=username(input.username,true),pw=password(input.password),server=String(input.serverName||'Wavehaus').trim(),label=device(input.deviceLabel||'Setup device');if(!server||[...server].length>100)fail('validation','Use a server name of 1–100 characters.');
  const userId=ulid(),hash=await passwordHash(pw,iterations(env)),list=await codes(),session=await makeSession(request,env,userId,label);
  const result=await env.DB.batch([stmt(env.DB,"INSERT INTO users(id,username,display_name,password_hash,role,created_at) SELECT ?,?,?,?,'owner',? WHERE NOT EXISTS(SELECT 1 FROM users)",userId,name,name,hash,Date.now()),...insertCodes(env,userId,list),stmt(env.DB,"UPDATE settings SET value=?,updated_at=? WHERE key='server_name' AND EXISTS(SELECT 1 FROM users WHERE id=?)",JSON.stringify(server),Date.now(),userId),session.statement]);
  if(!result[0].meta.changes)fail('not_found','Not found.',404);const user=(await one<User>(env.DB,'SELECT * FROM users WHERE id=?',userId))!;return withCookie({user:publicUser(user),recoveryCodes:list.map(c=>c.code)},session.raw,201);
 }
 if(path==='/api/auth/login'&&method==='POST'){
  const input=await body(request),name=username(input.username),pw=String(input.password||''),label=device(input.deviceLabel),address=ip(request);await rate(env,'login-ip',30,900,address);await checkLock(env,name,address);
  const user=await one<User>(env.DB,'SELECT * FROM users WHERE username=?',name);if(!user||user.status!=='active'||!await passwordVerify(pw,user.password_hash)){await failedLogin(env,name,address);fail('invalid_credentials','Username or password is incorrect.',401);}
  const configured=iterations(env),old=user.password_hash,rehash=Number(old.split('$')[2])!==configured,newHash=rehash?await passwordHash(pw,configured):old;
  const session=await makeSession(request,env,user.id,label,'password_hash=?',[newHash]),statements=[];if(rehash)statements.push(stmt(env.DB,'UPDATE users SET password_hash=? WHERE id=? AND password_hash=?',newHash,user.id,old));statements.push(session.statement);const result=await env.DB.batch(statements);if(!result.at(-1)!.meta.changes)fail('invalid_credentials','Your session changed. Reload and try again.',401);await clearLock(env,name,address);return withCookie({user:publicUser(user)},session.raw);
 }
 if(path==='/api/auth/recover'&&method==='POST'){
  const input=await body(request),name=username(input.username),pw=password(input.newPassword),address=ip(request);await rate(env,'recover',5,900,`${address}:${name}`);
  const user=await one<User>(env.DB,"SELECT * FROM users WHERE username=? AND status='active'",name);if(!user)fail('invalid_recovery','The recovery details are incorrect.',401);
  const codeHash=await recoveryHash(input.recoveryCode),claim=ulid(),newHash=await passwordHash(pw,iterations(env));const condition='EXISTS(SELECT 1 FROM recovery_codes WHERE user_id=users.id AND claim_id=?)';
  const session=await makeSession(request,env,user.id,device(input.deviceLabel||'Recovered device'),condition,[claim]);
  const result=await env.DB.batch([
   stmt(env.DB,'UPDATE recovery_codes SET used_at=?,claim_id=? WHERE user_id=? AND code_hash=? AND used_at IS NULL',Date.now(),claim,user.id,codeHash),
   stmt(env.DB,`UPDATE users SET password_hash=? WHERE id=? AND ${condition}`,newHash,user.id,claim),
   stmt(env.DB,'DELETE FROM sessions WHERE user_id=? AND EXISTS(SELECT 1 FROM recovery_codes WHERE user_id=? AND claim_id=?)',user.id,user.id,claim),
   stmt(env.DB,'DELETE FROM pairing_codes WHERE user_id=? AND EXISTS(SELECT 1 FROM recovery_codes WHERE user_id=? AND claim_id=?)',user.id,user.id,claim),session.statement]);
  if(!result[0].meta.changes)fail('invalid_recovery','The recovery details are incorrect.',401);await clearLock(env,name,address);return withCookie({user:publicUser(user)},session.raw);
 }
 if(path==='/api/auth/pair/claim'&&method==='POST'){
  const input=await body(request),label=device(input.deviceLabel);await rate(env,'pair-claim',10,900,ip(request));const secret=typeof input.secret==='string',raw=String(secret?input.secret:input.code||'');if(secret?!/^[A-Za-z0-9_-]{22}$/.test(raw):!/^\d{6}$/.test(raw))fail('invalid_pair','That pairing code is unavailable or expired.',401);
  const field=secret?'secret_hash':'code_hash',hash=await sha(raw);if(!secret)await rate(env,'pair-code',5,300,hash);const pair=await one<{id:string;user_id:string}>(env.DB,`SELECT p.id,p.user_id FROM pairing_codes p JOIN users u ON u.id=p.user_id WHERE p.${field}=? AND p.used_at IS NULL AND p.expires_at>? AND p.attempts<5 AND u.status='active' ORDER BY p.expires_at DESC LIMIT 1`,hash,Date.now());if(!pair)fail('invalid_pair','That pairing code is unavailable or expired.',401);
  const claim=ulid(),session=await makeSession(request,env,pair.user_id,label,'EXISTS(SELECT 1 FROM pairing_codes WHERE id=? AND claim_id=?)',[pair.id,claim]);const result=await env.DB.batch([stmt(env.DB,'UPDATE pairing_codes SET used_at=?,claim_id=?,attempts=attempts+1 WHERE id=? AND used_at IS NULL AND expires_at>? AND attempts<5',Date.now(),claim,pair.id,Date.now()),session.statement]);if(!result[0].meta.changes||!result[1].meta.changes)fail('invalid_pair','That pairing code is unavailable or expired.',401);const user=(await one<User>(env.DB,'SELECT * FROM users WHERE id=?',pair.user_id))!;return withCookie({user:publicUser(user)},session.raw);
 }
 if(path==='/api/setup/reset'&&method==='POST'){
  if(!env.RESET_OWNER)fail('not_found','Not found.',404);const input=await body(request);await rate(env,'owner-reset',5,900,ip(request));if(!timingEqual(env.RESET_OWNER,String(input.resetString||'')))fail('invalid_recovery','The recovery details are incorrect.',401);const pw=password(input.newPassword),owner=await one<User>(env.DB,"SELECT * FROM users WHERE role='owner'");if(!owner)fail('not_found','Not found.',404);
  const usedKey='reset-used:'+await sha(env.RESET_OWNER),newHash=await passwordHash(pw,iterations(env)),list=await codes(),random=crypto.getRandomValues(new Uint32Array(2)),claimNumber=random[0]*2**21+(random[1]>>>11);
  const condition='EXISTS(SELECT 1 FROM rate_limits WHERE key=? AND count=?)',session=await makeSession(request,env,owner.id,'Owner reset',condition,[usedKey,claimNumber]);
  const result=await env.DB.batch([
   stmt(env.DB,'INSERT OR IGNORE INTO rate_limits(key,window_start,count) VALUES(?,?,?)',usedKey,Date.now(),claimNumber),
   stmt(env.DB,`UPDATE users SET password_hash=? WHERE id=? AND ${condition}`,newHash,owner.id,usedKey,claimNumber),
   ...['sessions','pairing_codes','recovery_codes'].map(table=>stmt(env.DB,`DELETE FROM ${table} WHERE user_id=? AND ${condition}`,owner.id,usedKey,claimNumber)),
   ...insertCodes(env,owner.id,list,condition,[usedKey,claimNumber]),session.statement]);
  if(!result[0].meta.changes)fail('not_found','Remove RESET_OWNER and use a new reset string for another reset.',404);return withCookie({recoveryCodes:list.map(c=>c.code),removeResetFlag:true},session.raw);
 }
 const auth=await currentAuth(request,env,false);
 if(path==='/api/auth/me'&&method==='GET'){if(!auth)fail('unauthenticated','Sign in to continue.',401);const cfg=await settings(env.DB),left=await one<{n:number}>(env.DB,'SELECT COUNT(*) AS n FROM recovery_codes WHERE user_id=? AND used_at IS NULL',auth.user.id);return json({user:auth.user,session:auth.session,settings:Object.fromEntries(['server_name','registration_mode','default_visibility','members_can_upload','library_rules','upload_visibility_locked'].map(k=>[k,cfg[k]])),recoveryCodesLeft:left!.n});}
 if(!auth)return null;
 if(path==='/api/auth/logout'&&method==='POST'){await run(env.DB,'DELETE FROM sessions WHERE id=?',auth.session.id);return json({ok:true},200,{'Set-Cookie':cookie('',true)});}
 if(path==='/api/sessions'&&method==='GET'){const rows=await all<Session>(env.DB,'SELECT id,device_label,user_agent,created_at,last_seen_at,expires_at FROM sessions WHERE user_id=? AND expires_at>? ORDER BY last_seen_at DESC',auth.user.id,Date.now());return json({items:rows.map(s=>({...s,current:s.id===auth.session.id})),nextCursor:null});}
 const revoke=path.match(/^\/api\/sessions\/([^/]+)$/);if(revoke&&method==='DELETE'){await run(env.DB,'DELETE FROM sessions WHERE id=? AND user_id=?',revoke[1],auth.user.id);return json({ok:true},200,revoke[1]===auth.session.id?{'Set-Cookie':cookie('',true)}:undefined);}
 if(path==='/api/auth/sessions/revoke-others'&&method==='POST'){await run(env.DB,'DELETE FROM sessions WHERE user_id=? AND id<>?',auth.user.id,auth.session.id);return json({ok:true});}
 if(path==='/api/auth/pair'&&method==='POST'){
  await rate(env,'pair-create',10,900,auth.user.id);const secret=randomToken(16),expiresAt=Date.now()+300000;
  for(let attempt=0;attempt<10;attempt++){const code=String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0'),hash=await sha(code);const result=await run(env.DB,'INSERT INTO pairing_codes(id,user_id,code_hash,secret_hash,expires_at) SELECT ?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM pairing_codes WHERE code_hash=? AND used_at IS NULL AND expires_at>?)',ulid(),auth.user.id,hash,await sha(secret),expiresAt,hash,Date.now());if(result.meta.changes)return json({code,qrUrl:`${new URL(request.url).origin}${APP_BASE}pair#${secret}`,expiresAt});}
  fail('busy','Please try creating a code again.',503);
 }
 if((path==='/api/auth/recovery-codes'||path==='/api/auth/password')&&method==='POST'){
  const input=await body(request);await rate(env,'sensitive-auth',5,900,`${auth.user.id}:${ip(request)}`);const user=await one<User>(env.DB,'SELECT * FROM users WHERE id=?',auth.user.id);if(!user||!await passwordVerify(String(input.password||''),user.password_hash))fail('invalid_credentials','Username or password is incorrect.',401);
  if(path.endsWith('/recovery-codes')){const list=await codes();const condition='password_hash=?';const result=await env.DB.batch([stmt(env.DB,'DELETE FROM recovery_codes WHERE user_id=? AND EXISTS(SELECT 1 FROM users WHERE id=? AND password_hash=?)',user.id,user.id,user.password_hash),...insertCodes(env,user.id,list,condition,[user.password_hash])]);if(!result.at(-1)!.meta.changes)fail('invalid_credentials','Your session changed. Reload and try again.',401);return json({recoveryCodes:list.map(c=>c.code)});}
  const newHash=await passwordHash(password(input.newPassword),iterations(env));const result=await env.DB.batch([stmt(env.DB,'UPDATE users SET password_hash=? WHERE id=? AND password_hash=?',newHash,user.id,user.password_hash),stmt(env.DB,'DELETE FROM sessions WHERE user_id=? AND id<>? AND EXISTS(SELECT 1 FROM users WHERE id=? AND password_hash=?)',user.id,auth.session.id,user.id,newHash),stmt(env.DB,'DELETE FROM pairing_codes WHERE user_id=? AND EXISTS(SELECT 1 FROM users WHERE id=? AND password_hash=?)',user.id,user.id,newHash)]);if(!result[0].meta.changes)fail('invalid_credentials','Your session changed. Reload and try again.',401);return json({ok:true});
 }
 return null;
}
