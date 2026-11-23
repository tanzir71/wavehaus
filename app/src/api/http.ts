import { ApiError, type Api } from './types';
const root=import.meta.env.BASE_URL.replace(/\/$/,'');
export const api:Api={
 demo:false,
 async request<T>(path:string,init:RequestInit={}){const headers=new Headers(init.headers);if(init.method&&!['GET','HEAD'].includes(init.method))headers.set('X-Wavehaus','1');const response=await fetch(root+path,{...init,headers,credentials:'same-origin'});if(!response.ok){const {error}=await response.json().catch(()=>({error:{code:'network',message:'The server could not complete this request.'}}));if(error.code==='unauthenticated')dispatchEvent(new Event('wh-unauthenticated'));throw new ApiError(error.code,error.message,response.status,error.retryAfter);}return response.status===204?undefined as T:response.json();},
 mediaUrl:t=>`${root}/media/${encodeURIComponent(t.id)}`,
 artUrl:(a,size=600)=>`${root}/art/${encodeURIComponent(a.id)}/${a.art_source==='generated'?'generated-512.png':`${size}.webp`}?v=${a.rev}`
};
