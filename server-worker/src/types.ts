export interface Statement { bind(...values:unknown[]):Statement; first<T=Record<string,unknown>>():Promise<T|null>; all<T=Record<string,unknown>>():Promise<{results:T[]}>; run():Promise<Result> }
export interface Result { success:boolean; meta:{changes:number}; results?:Record<string,unknown>[] }
export interface Database { prepare(sql:string):Statement; batch(statements:Statement[]):Promise<Result[]> }
export interface ObjectInfo {key:string;size:number;httpEtag:string;httpMetadata?:{contentType?:string};writeHttpMetadata(headers:Headers):void}
export interface ObjectBody extends ObjectInfo {body:ReadableStream<Uint8Array>;arrayBuffer():Promise<ArrayBuffer>}
export interface UploadedPart {partNumber:number;etag:string}
export interface MultipartUpload {key:string;uploadId:string;uploadPart(partNumber:number,value:Uint8Array|ReadableStream<Uint8Array>):Promise<UploadedPart>;complete(parts:UploadedPart[]):Promise<ObjectInfo>;abort():Promise<void>}
export interface Bucket {createMultipartUpload(key:string,options?:{httpMetadata?:{contentType:string}}):Promise<MultipartUpload>;resumeMultipartUpload(key:string,uploadId:string):MultipartUpload;head(key:string):Promise<ObjectInfo|null>;get(key:string,options?:{range?:{offset:number;length:number}}):Promise<ObjectBody|null>;put(key:string,value:Uint8Array|ArrayBuffer|ReadableStream<Uint8Array>,options?:{httpMetadata?:{contentType:string};sha256?:string}):Promise<ObjectInfo>;delete(key:string|string[]):Promise<void>}
export interface Env { DB:Database; MEDIA:Bucket; ASSETS:{fetch(request:Request):Promise<Response>}; APP_SECRET:string; RESET_OWNER?:string; PBKDF2_ITERATIONS?:string }
export type User={id:string;username:string;display_name:string;password_hash:string;role:string;status:string;used_bytes:number;quota_bytes:number|null;invites_left:number;created_at:number};
export type Session={id:string;user_id:string;device_label:string;created_at:number;last_seen_at:number;expires_at:number};
export type Auth={user:Omit<User,'password_hash'>;session:Session;token?:{id:string;name:string;scopes:string[]}};
export type Settings=Record<string,unknown>;
