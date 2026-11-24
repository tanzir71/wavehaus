export class ApiError extends Error {constructor(public code:string,message:string,public status=400,public retryAfter?:number){super(message);}}
export function fail(code:string,message:string,status=400,retryAfter?:number):never{throw new ApiError(code,message,status,retryAfter);}
export async function body(request:Request):Promise<Record<string,unknown>>{if(!request.headers.get('Content-Type')?.includes('application/json'))fail('json_required','Use JSON for this request.',415);const raw=new TextDecoder().decode(await readLimited(request,1048576));try{const value=JSON.parse(raw||'{}');if(!value||typeof value!=='object'||Array.isArray(value))throw Error();return value;}catch{fail('invalid_json','Use a JSON object.');}}
export async function readLimited(request:Request,max:number){
 const declared=request.headers.get('Content-Length');if(declared!==null&&Number(declared)>max)fail('too_large','Request is too large.',413);
 if(!request.body)return new Uint8Array();const reader=request.body.getReader(),parts:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();fail('too_large','Request is too large.',413);}parts.push(value);}}finally{reader.releaseLock();}
 const result=new Uint8Array(size);let offset=0;for(const part of parts){result.set(part,offset);offset+=part.byteLength;}return result;
}
export const json=(data:unknown,status=200,headers?:HeadersInit)=>{const out=new Headers(headers);out.set('Cache-Control','no-store');return Response.json(data,{status,headers:out});};
import {APP_BASE} from './deployment';
export const sessionCookieName=APP_BASE==='/'?'__Host-wh_session':'__Secure-wh_session';
export const cookieValue=(request:Request,name:string)=>request.headers.get('Cookie')?.split(';').map(part=>part.trim()).find(part=>part.startsWith(name+'='))?.slice(name.length+1);
export const cookie=(raw:string,clear=false)=>`${sessionCookieName}=${raw}; Path=${APP_BASE}; HttpOnly; Secure; SameSite=Lax; Max-Age=${clear?0:180*86400}`;
export const withCookie=(data:unknown,raw:string,status=200)=>json(data,status,{'Set-Cookie':cookie(raw)});
