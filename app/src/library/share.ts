const key=`wh-pending-share:${import.meta.env.BASE_URL}`;
export function captureSharedIntake(){const shared=new URLSearchParams(location.search).get('shared');if(shared&&/^shared-[a-f0-9-]{36}$/.test(shared))sessionStorage.setItem(key,shared);}
export function pendingShare(){const shared=sessionStorage.getItem(key);return shared&&/^shared-[a-f0-9-]{36}$/.test(shared)?shared:null;}
export function finishShare(shared:string){if(sessionStorage.getItem(key)===shared)sessionStorage.removeItem(key);}
