// Shared state for the page and service worker. No cookies or API tokens are stored.
export async function offlineState(scope,value){
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('wh-offline-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('state');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 try{return await new Promise((resolve,reject)=>{const tx=db.transaction('state',value===undefined?'readonly':'readwrite'),store=tx.objectStore('state'),r=value===undefined?store.get(scope):value===null?store.delete(scope):store.put(value,scope);let result;r.onsuccess=()=>{result=r.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);});}finally{db.close();}
}
export const audioCache='wh-audio-v1';
