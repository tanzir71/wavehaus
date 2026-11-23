import { hashBlob } from '../../../shared/sha256';
import { sniffAudio } from '../../../shared/upload-input';
self.onmessage=async(event:MessageEvent<{blob:Blob;filename:string}>)=>{
 try{const {blob,filename}=event.data,header=new Uint8Array(await blob.slice(0,32).arrayBuffer()),mime=sniffAudio(header,filename),sha256=await hashBlob(blob),size=new TextEncoder().encode(String(blob.size)),quick=await crypto.subtle.digest('SHA-256',await new Blob([blob.slice(0,1024**2),blob.slice(Math.max(0,blob.size-1024**2)),size]).arrayBuffer());self.postMessage({ok:true,mime,sha256,quickHash:Array.from(new Uint8Array(quick),b=>b.toString(16).padStart(2,'0')).join('')});}
 catch(error){self.postMessage({ok:false,error:{code:(error as {code?:string}).code||'hash_mismatch',message:(error as Error).message,status:(error as {status?:number}).status||409}});}
};
