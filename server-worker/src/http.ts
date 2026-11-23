export class ApiError extends Error {constructor(public code:string,message:string,public status=400,public retryAfter?:number){super(message);}}
export function fail(code:string,message:string,status=400,retryAfter?:number):never{throw new ApiError(code,message,status,retryAfter);}
export async function body(request:Request):Promise<Record<string,unknown>>{if(!request.headers.get('Content-Type')?.includes('application/json'))fail('json_required','Use JSON for this request.',415);const raw=await request.text();if(raw.length>1048576)fail('too_large','Request is too large.',413);try{const value=JSON.parse(raw||'{}');if(!value||typeof value!=='object'||Array.isArray(value))throw Error();return value;}catch{fail('invalid_json','Use a JSON object.');}}
export const json=(data:unknown,status=200,headers?:HeadersInit)=>Response.json(data,{status,headers});
export const cookie=(raw:string,clear=false)=>`__Host-wh_session=${raw}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${clear?0:180*86400}`;
export const withCookie=(data:unknown,raw:string,status=200)=>json(data,status,{'Set-Cookie':cookie(raw)});
