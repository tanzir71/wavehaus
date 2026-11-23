// Shared by the demo, service worker and contract tests. Never decode media here.
function database(){return new Promise((resolve,reject)=>{const request=indexedDB.open('wh-media-v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('files');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
export async function idbFile(key,blob){const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('files',blob===undefined?'readonly':'readwrite');const store=tx.objectStore('files');const req=blob===undefined?store.get(key):store.put(blob,key);let value;req.onsuccess=()=>{value=req.result;};tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);});}finally{db.close();}}
export async function putBlob(key,blob){
 if(!/^[a-zA-Z0-9_.-]+$/.test(key))throw new Error('Invalid storage key');
 try{const dir=await navigator.storage.getDirectory();const f=await dir.getFileHandle(key,{create:true});const stream=await f.createWritable();await stream.write(blob);await stream.close();await idbFile(`mime-${key}`,blob.type);return;}catch{/* Private mode / older browser: IndexedDB fallback. */}
 await idbFile(key,blob);
}
export async function getBlob(key){
 if(!/^[a-zA-Z0-9_.-]+$/.test(key))return undefined;
 try{const dir=await navigator.storage.getDirectory();const f=await dir.getFileHandle(key);const file=await f.getFile();const mime=await idbFile(`mime-${key}`);return mime?file.slice(0,file.size,mime):file;}catch{return await idbFile(key);}
}
export async function deleteBlob(key){
 if(!/^[a-zA-Z0-9_.-]+$/.test(key))throw new Error('Invalid storage key');
 try{await (await navigator.storage.getDirectory()).removeEntry(key);}catch{}
 const db=await database();try{await new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite'),store=tx.objectStore('files');store.delete(key);store.delete(`mime-${key}`);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}finally{db.close();}
}
/** @param {string | null | undefined} [key] */
export async function getArt(albumId,filename,key){
 if(!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(albumId)||!['96.webp','600.webp','generated-512.png'].includes(filename))return undefined;
 // Explicit keys come from the authorised album row. Undo can therefore switch
 // back to an older immutable cover without rewriting a second manifest DB.
 const manifest=key===undefined?await idbFile(`art-manifest-${albumId}`):key?{key}:null;
 if(manifest){const blob=await getBlob(`${manifest.key}-${filename}`);if(blob)return blob;if(filename==='96.webp')return getBlob(`${manifest.key}-600.webp`);return undefined;}
 return getBlob(`art-${albumId}`);
}
export function rangeResponse(blob,request,mime=blob.type||'application/octet-stream',etag){
 const size=blob.size,headers=new Headers({'Content-Type':mime,'Accept-Ranges':'bytes','Cache-Control':'private, no-store','Vary':'Cookie'});
 if(etag){headers.set('ETag',etag);if(request.headers.get('If-None-Match')===etag&&!request.headers.has('Range'))return new Response(null,{status:304,headers});}
 const range=!etag||!request.headers.has('If-Range')||request.headers.get('If-Range')===etag?request.headers.get('Range'):null; let start=0,end=size-1,status=200;
 if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);
   if(!match||(!match[1]&&!match[2])){headers.set('Content-Range',`bytes */${size}`);headers.set('Content-Length','0');return new Response(null,{status:416,headers});}
   if(!match[1]){start=Math.max(0,size-Number(match[2]));}else{start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}
   if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=size){headers.set('Content-Range',`bytes */${size}`);headers.set('Content-Length','0');return new Response(null,{status:416,headers});}
   status=206;headers.set('Content-Range',`bytes ${start}-${end}/${size}`);
 }
 headers.set('Content-Length',String(Math.max(0,end-start+1)));
 return new Response(request.method==='HEAD'?null:blob.slice(start,end+1,mime),{status,headers});
}
