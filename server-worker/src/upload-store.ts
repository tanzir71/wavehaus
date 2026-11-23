import { uploadInput } from '../../shared/upload-input';
import { all,one,run,stmt,settings } from './db';
import { hmac,sha,ulid } from './crypto';
import { fail } from './http';
import { nativeStreamHash,readLimited } from './file-crypto';
import type { Auth,Env } from './types';

export type Upload={id:string;user_id:string;filename:string;size_bytes:number;sha256:string;chunk_bytes:number;backend_ref:string;status:'open'|'complete'|'aborted';created_at:number;expires_at:number;completed_track_id:string|null;completed_change_id:string|null};
export type Part={part_no:number;size_bytes:number;sha256:string;etag:string|null};
const CHUNK=8*1024**2;
export const mediaKey=(upload:Upload)=>`media/${upload.user_id}/${upload.sha256}`;
export const assemblyKey=(upload:Pick<Upload,'user_id'|'id'>)=>`tmp/${upload.user_id}/${upload.id}/assembled`;
export const partKey=(upload:Upload,part:Pick<Part,'part_no'|'sha256'>)=>`tmp/${upload.user_id}/${upload.id}/${part.part_no}-${part.sha256}`;
export function requireUpload(auth:Auth,cfg:Record<string,unknown>){if(!['owner','admin'].includes(auth.user.role)&&!(auth.user.role==='uploader'&&cfg.members_can_upload===true))fail('forbidden','Your account cannot upload music.',403);}
export async function getUpload(env:Env,auth:Auth,id:string){if(!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(id))fail('not_found','Upload not found.',404);const upload=await one<Upload>(env.DB,'SELECT * FROM uploads WHERE id=? AND user_id=?',id,auth.user.id);if(!upload)fail('not_found','Upload not found.',404);return upload;}
export const parts=(env:Env,id:string)=>all<Part>(env.DB,'SELECT part_no,size_bytes,sha256,etag FROM upload_parts WHERE upload_id=? ORDER BY part_no',id);
export async function result(env:Env,upload:Upload){return {uploadId:upload.id,chunkBytes:upload.chunk_bytes,partsReceived:(await parts(env,upload.id)).map(p=>p.part_no),status:upload.status,trackId:upload.completed_track_id};}
export async function quotaLeft(env:Env,id:string){const user=await one<{quota_bytes:number|null;used_bytes:number}>(env.DB,'SELECT quota_bytes,used_bytes FROM users WHERE id=?',id);return user!.quota_bytes===null?null:Math.max(0,user!.quota_bytes-user!.used_bytes);}
export async function startUpload(env:Env,auth:Auth,input:Record<string,unknown>){
 const cfg=await settings(env.DB);requireUpload(auth,cfg);const data=uploadInput(input,Number(cfg.max_file_bytes)),uid=auth.user.id,clock=Date.now();
 await run(env.DB,"UPDATE uploads SET status='aborted' WHERE user_id=? AND status='open' AND expires_at<?",uid,clock);
 const find=()=>one<Upload>(env.DB,"SELECT u.* FROM uploads u LEFT JOIN tracks t ON t.id=u.completed_track_id WHERE u.user_id=? AND u.sha256=? AND (u.status='open' OR u.status='complete' AND t.deleted=0) ORDER BY u.created_at DESC LIMIT 1",uid,data.sha256);
 const existing=await find();if(existing)return result(env,existing);
 const id=ulid(),multipart=await env.MEDIA.createMultipartUpload(assemblyKey({id,user_id:uid})),rateKey=await hmac(env.APP_SECRET,`upload-bytes:${uid}`),window=clock-3600000,owner=auth.user.role==='owner';
 try{
  const statements=[stmt(env.DB,`INSERT OR IGNORE INTO uploads(id,user_id,filename,size_bytes,sha256,chunk_bytes,backend_ref,created_at,expires_at) SELECT ?,id,?,?,?,?,?,?,? FROM users WHERE id=? AND status='active' AND (quota_bytes IS NULL OR used_bytes+?+COALESCE((SELECT SUM(size_bytes) FROM uploads WHERE user_id=? AND status='open' AND expires_at>?),0)<=quota_bytes) AND NOT EXISTS(SELECT 1 FROM uploads WHERE user_id=? AND sha256=? AND status='open') AND (? OR NOT EXISTS(SELECT 1 FROM rate_limits WHERE key=? AND window_start>? AND count+?>?))`,id,data.filename,data.size,data.sha256,CHUNK,multipart.uploadId,clock,clock+7*86400000,uid,data.size,uid,clock,uid,data.sha256,owner?1:0,rateKey,window,data.size,5*1024**3)];
  if(!owner)statements.push(stmt(env.DB,'INSERT INTO rate_limits(key,window_start,count) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM uploads WHERE id=?) ON CONFLICT(key) DO UPDATE SET window_start=CASE WHEN window_start<? THEN excluded.window_start ELSE window_start END,count=CASE WHEN window_start<? THEN excluded.count ELSE count+excluded.count END',rateKey,clock,data.size,id,window,window));
  const inserted=await env.DB.batch(statements);
  if(!inserted[0].meta.changes){await multipart.abort();const winner=await find();if(winner)return result(env,winner);const bucket=await one<{window_start:number;count:number}>(env.DB,'SELECT window_start,count FROM rate_limits WHERE key=?',rateKey);if(!owner&&bucket&&bucket.window_start>window&&bucket.count+data.size>5*1024**3){const retry=Math.max(1,Math.ceil((bucket.window_start+3600000-clock)/1000));fail('rate_limited',`Upload limit reached. Try again in ${Math.ceil(retry/60)} minutes.`,429,retry);}fail('quota','There is not enough space in your account.',413);}
  return result(env,(await one<Upload>(env.DB,'SELECT * FROM uploads WHERE id=?',id))!);
 }catch(error){await multipart.abort().catch(()=>{});throw error;}
}
async function hashExpected(body:ReadableStream<Uint8Array>,size:number){let received=0;const counter=new TransformStream<Uint8Array,Uint8Array>({transform(chunk,controller){received+=chunk.byteLength;if(received>size)fail('invalid_part','Part size or number is invalid.');controller.enqueue(chunk);}});const hash=await nativeStreamHash(body.pipeThrough(counter));if(received!==size)fail('invalid_part','Part size or number is invalid.');return hash;}
export async function putPart(env:Env,auth:Auth,upload:Upload,n:number,request:Request){
 if(upload.status!=='open'||upload.expires_at<Date.now())fail('upload_closed','This upload is no longer open.',409);
 const expected=Math.min(upload.chunk_bytes,upload.size_bytes-(n-1)*upload.chunk_bytes);if(!Number.isSafeInteger(n)||n<1||expected<=0||!request.body)fail('invalid_part','Part size or number is invalid.');
 const declared=request.headers.get('Content-Length');if(declared!==null&&Number(declared)!==expected)fail('invalid_part','Part size or number is invalid.');
 const old=await one<Part>(env.DB,'SELECT part_no,size_bytes,sha256,etag FROM upload_parts WHERE upload_id=? AND part_no=?',upload.id,n);
 if(old){const hash=await hashExpected(request.body,expected);if(hash!==old.sha256)fail('part_conflict','This part differs from the stored part. Restart this upload.',409);return {received:n};}
 const supplied=request.headers.get('X-Wavehaus-Part-SHA256');if(supplied&&!/^[a-f0-9]{64}$/.test(supplied))fail('invalid_hash','Invalid part hash.');
 let payload:Uint8Array|ReadableStream<Uint8Array>,hash:string;
 if(supplied&&declared!==null){hash=supplied;payload=request.body;}else{const bytes=await readLimited(request,expected);if(bytes.byteLength!==expected)fail('invalid_part','Part size or number is invalid.');hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(supplied&&supplied!==hash)fail('hash_mismatch','The uploaded part failed its integrity check.',409);payload=bytes;}
 const part={part_no:n,size_bytes:expected,sha256:hash,etag:null},key=partKey(upload,part);
 // Stage by the actual digest. A racing PUT with different bytes cannot replace
 // the accepted part; complete assembles these immutable objects using R2 MPU.
 let object;try{object=await env.MEDIA.put(key,payload,{sha256:hash,httpMetadata:{contentType:'application/octet-stream'}});}catch(error){if(error instanceof Error&&/checksum|digest|hash/i.test(error.message))fail('hash_mismatch','The uploaded part failed its integrity check.',409);fail('storage','Could not store this part. Try again.',503);}
 if(object.size!==expected){await env.MEDIA.delete(key);fail('invalid_part','Part size or number is invalid.');}
 const inserted=await run(env.DB,"INSERT OR IGNORE INTO upload_parts(upload_id,part_no,size_bytes,sha256,etag) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM uploads WHERE id=? AND user_id=? AND status='open')",upload.id,n,expected,hash,object.httpEtag,upload.id,auth.user.id);
 if(!inserted.meta.changes){const accepted=await one<Part>(env.DB,'SELECT * FROM upload_parts WHERE upload_id=? AND part_no=?',upload.id,n);if(accepted?.sha256!==hash)await env.MEDIA.delete(key);if(!accepted)fail('upload_closed','This upload is no longer open.',409);if(accepted.sha256!==hash)fail('part_conflict','This part differs from the stored part. Restart this upload.',409);}
 return {received:n};
}
export async function withUploadLease<T>(env:Env,upload:Upload,operation:(claim:string,renew:()=>Promise<void>)=>Promise<T>){
 const claim=ulid(),now=Date.now(),acquired=await run(env.DB,'INSERT INTO upload_claims(upload_id,claim_id,expires_at) VALUES(?,?,?) ON CONFLICT(upload_id) DO UPDATE SET claim_id=excluded.claim_id,expires_at=excluded.expires_at,quota_reserved=0 WHERE expires_at<?',upload.id,claim,now+120000,now);
 if(!acquired.meta.changes)fail('upload_busy','This upload is finishing. Try again shortly.',409,5);
 let lastRenew=now;
 // A heartbeat per part would exceed D1 Free's per-invocation query budget on
 // a large file. Keep the two-minute lease alive at most every 30 seconds.
 const renew=async()=>{const clock=Date.now();if(clock-lastRenew<30000)return;const renewed=await run(env.DB,'UPDATE upload_claims SET expires_at=? WHERE upload_id=? AND claim_id=?',clock+120000,upload.id,claim);if(!renewed.meta.changes)fail('upload_busy','Another request resumed this upload. Try again.',409,5);lastRenew=clock;};
 try{return await operation(claim,renew);}finally{await run(env.DB,'DELETE FROM upload_claims WHERE upload_id=? AND claim_id=?',upload.id,claim);}
}
export async function clearParts(env:Env,upload:Upload){const list=await parts(env,upload.id);await env.MEDIA.delete([...list.map(part=>partKey(upload,part)),assemblyKey(upload)]);await run(env.DB,'DELETE FROM upload_parts WHERE upload_id=?',upload.id);}
export async function abortUpload(env:Env,auth:Auth,upload:Upload){return withUploadLease(env,upload,async()=>{const current=await getUpload(env,auth,upload.id);if(current.status==='complete')fail('upload_closed','This upload is already in the library.',409);await run(env.DB,"UPDATE uploads SET status='aborted' WHERE id=?",upload.id);await env.MEDIA.resumeMultipartUpload(assemblyKey(upload),upload.backend_ref).abort().catch(()=>{});await clearParts(env,upload);return {ok:true};});}
