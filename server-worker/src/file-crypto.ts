import { fail } from './http';
import type { Bucket } from './types';
export { readLimited } from './http';
type Digest=WritableStream<Uint8Array>&{digest:Promise<ArrayBuffer>};
const hex=(buffer:ArrayBuffer)=>Array.from(new Uint8Array(buffer),byte=>byte.toString(16).padStart(2,'0')).join('');
export async function nativeStreamHash(body:ReadableStream<Uint8Array>){
 // Workers' native streaming extension retains no upload bytes. Browser-side
 // hashing uses shared/sha256 in a worker because browsers lack this extension.
 // https://developers.cloudflare.com/workers/runtime-apis/web-crypto/
 const stream=new (crypto as Crypto&{DigestStream:new(algorithm:string)=>Digest}).DigestStream('SHA-256');
 const [,digest]=await Promise.all([body.pipeTo(stream),stream.digest]);return hex(digest);
}
export async function verifyObject(bucket:Bucket,key:string,expectedSize:number,expectedHash:string){
 const length=Math.min(1024**2,expectedSize),[whole,first,last]=await Promise.all([bucket.get(key),bucket.get(key,{range:{offset:0,length}}),bucket.get(key,{range:{offset:Math.max(0,expectedSize-length),length}})]);
 if(!whole||!first||!last)fail('storage','An uploaded object is missing.',503);
 if(whole.size!==expectedSize){await Promise.allSettled([whole.body.cancel(),first.body.cancel(),last.body.cancel()]);fail('hash_mismatch','The uploaded file failed its integrity check.',409);}
 const [digest,head,tail]=await Promise.all([nativeStreamHash(whole.body),first.arrayBuffer(),last.arrayBuffer()]);
 if(digest!==expectedHash)fail('hash_mismatch','The uploaded file failed its integrity check.',409);
 const size=new TextEncoder().encode(String(expectedSize)),quickBytes=new Uint8Array(head.byteLength+tail.byteLength+size.length);quickBytes.set(new Uint8Array(head));quickBytes.set(new Uint8Array(tail),head.byteLength);quickBytes.set(size,head.byteLength+tail.byteLength);
 return {header:new Uint8Array(head).subarray(0,32),quickHash:hex(await crypto.subtle.digest('SHA-256',quickBytes))};
}
