import {signal} from '@preact/signals';
export const updateAvailable=signal(false);
let registration:ServiceWorkerRegistration|null=null;
export function trackUpdates(reg:ServiceWorkerRegistration){registration=reg;const changed=()=>{updateAvailable.value=!!reg.waiting;};changed();reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed')changed();});});}
export async function checkUpdate(){registration||=await navigator.serviceWorker?.getRegistration(import.meta.env.BASE_URL)||null;await registration?.update();updateAvailable.value=!!registration?.waiting;return updateAvailable.peek();}
export function applyUpdate(){if(!registration?.waiting){location.reload();return;}navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});registration.waiting.postMessage({type:'SKIP_WAITING'});}
