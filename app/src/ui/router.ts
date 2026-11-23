import { signal } from '@preact/signals';
const base=import.meta.env.BASE_URL;
if(new URLSearchParams(location.search).get('restore')==='1'){
 const saved=sessionStorage.getItem('wh-route');sessionStorage.removeItem('wh-route');
 if(saved?.startsWith(base)&&!saved.startsWith('//'))history.replaceState(null,'',saved);
}
export const route=signal(location.pathname.slice(base.length-1)||'/');
export const href=(path:string)=>base+path.replace(/^\//,'');
export function navigate(path:string){history.pushState(null,'',href(path));route.value=path.split('?')[0];window.scrollTo(0,0);document.querySelector('main')?.focus({preventScroll:true});}
addEventListener('popstate',()=>{route.value=location.pathname.slice(base.length-1)||'/';});
addEventListener('click',e=>{const a=(e.target as Element).closest('a');if(!a||a.target||a.hasAttribute('download')||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button)return;const url=new URL(a.href);if(url.origin===location.origin&&url.pathname.startsWith(base)&&!url.hash){e.preventDefault();navigate(url.pathname.slice(base.length-1)+url.search);}});
