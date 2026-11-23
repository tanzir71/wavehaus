import { getBlob, idbFile, rangeResponse } from './runtime/media.js';
const version='__BUILD_VERSION__', shell='__SHELL_FILES__';
const scope=new URL(self.registration.scope).pathname;
const shellCache=`wh-shell-${scope}-${version}`;
async function demoSignedIn(){return new Promise(resolve=>{const open=indexedDB.open('wh-demo-v1');open.onupgradeneeded=()=>{open.transaction.abort();resolve(false);};open.onerror=()=>resolve(false);open.onsuccess=()=>{const db=open.result;if(!db.objectStoreNames.contains('state')){db.close();resolve(false);return;}const get=db.transaction('state').objectStore('state').get('database');get.onsuccess=()=>{const auth=get.result?.auth;resolve(!!auth?.sessions.some(s=>s.id===auth.currentSession&&s.expires_at>Date.now()));db.close();};get.onerror=()=>{db.close();resolve(false);};};});}
self.addEventListener('install',event=>{event.waitUntil(caches.open(shellCache).then(c=>c.addAll(Array.isArray(shell)?shell:['./','./manifest.webmanifest'])));});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith(`wh-shell-${scope}-`)&&key!==shellCache)await caches.delete(key);await self.clients.claim();})());});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();if(event.data?.type==='PURGE_TRACKS')event.waitUntil((async()=>{const cache=await caches.open('wh-audio-v1');for(const id of event.data.ids)await cache.delete(new URL(`media/${id}`,self.registration.scope).href);})());});
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);if(url.origin!==location.origin)return;
 const relative=url.pathname.startsWith(scope)?url.pathname.slice(scope.length):'';
 if(relative==='share-target'&&req.method==='POST'){event.respondWith((async()=>{const form=await req.formData();const files=form.getAll('audio').filter(f=>f instanceof File);const key=`shared-${crypto.randomUUID()}`;await idbFile(key,files);return Response.redirect(new URL(`upload?shared=${key}`,self.registration.scope),303);})());return;}
 if(relative.startsWith('demo-media/')){event.respondWith((async()=>{if(!await demoSignedIn())return new Response(null,{status:401});const id=relative.slice(11);const blob=await getBlob(`audio-${id}`);return blob?rangeResponse(blob,req):new Response('Media missing',{status:404});})());return;}
 if(relative.startsWith('demo-art/')){event.respondWith((async()=>{if(!await demoSignedIn())return new Response(null,{status:401});const id=relative.slice(9).split('/')[0];const blob=await getBlob(`art-${id}`);return blob?new Response(blob,{headers:{'Content-Type':blob.type||'image/png'}}):new Response(null,{status:404});})());return;}
 if(url.pathname.includes('/api/'))return; // Sessions and API data are never cached.
 if(url.pathname.includes('/media/')){event.respondWith((async()=>{const cached=await (await caches.open('wh-audio-v1')).match(new Request(url.origin+url.pathname));return cached?rangeResponse(await cached.blob(),req,cached.headers.get('Content-Type')||undefined):fetch(req);})());return;}
 if(req.method!=='GET')return;
 if(req.mode==='navigate'&&url.pathname.startsWith(scope)){event.respondWith(fetch(req).catch(()=>caches.match(new URL('./',self.registration.scope))).then(r=>r||new Response('Offline',{status:503})));return;}
 if(url.pathname.startsWith(scope))event.respondWith(caches.match(req).then(r=>r||fetch(req).then(async response=>{if(response.ok&&['script','style','font'].includes(req.destination)){const cache=await caches.open(shellCache);await cache.put(req,response.clone());}return response;})));
});
