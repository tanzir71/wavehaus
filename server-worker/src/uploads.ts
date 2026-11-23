import { body,fail,json } from './http';
import { one,settings } from './db';
import { completeUpload } from './upload-complete';
import { abortUpload,getUpload,putPart,quotaLeft,requireUpload,result,startUpload } from './upload-store';
import type { Auth,Env } from './types';
export async function uploadsRoutes(request:Request,env:Env,auth:Auth,path:string):Promise<Response|null>{
 if(!path.startsWith('/api/uploads'))return null;requireUpload(auth,await settings(env.DB));const method=request.method;
 if(path==='/api/uploads/check'&&method==='POST'){
  const input=await body(request);if(!Array.isArray(input.items)||input.items.length>1000)fail('validation','Check up to 1000 files at a time.');const duplicates=new Set<string>();
  for(const item of input.items){if(!item||typeof item.quickHash!=='string'||!/^[a-f0-9]{64}$/.test(item.quickHash)||!Number.isSafeInteger(item.size)||item.size<1)fail('validation','Invalid duplicate-check item.');if(await one(env.DB,'SELECT id FROM tracks WHERE owner_id=? AND quick_hash=? AND size_bytes=? AND deleted=0',auth.user.id,item.quickHash,item.size))duplicates.add(item.quickHash);}
  return json({duplicates:[...duplicates],quotaLeft:await quotaLeft(env,auth.user.id)});
 }
 if(path==='/api/uploads'&&method==='POST')return json(await startUpload(env,auth,await body(request)),201);
 const match=path.match(/^\/api\/uploads\/([0-9A-HJKMNP-TV-Z]{26})(?:\/parts\/(\d+)|\/(complete))?$/);if(!match)return null;const upload=await getUpload(env,auth,match[1]);
 if(method==='GET'&&!match[2]&&!match[3])return json(await result(env,upload));
 if(method==='DELETE'&&!match[2]&&!match[3])return json(await abortUpload(env,auth,upload));
 if(method==='PUT'&&match[2])return json(await putPart(env,auth,upload,Number(match[2]),request));
 if(method==='POST'&&match[3])return json(await completeUpload(env,auth,upload,await body(request)));
 return null;
}
