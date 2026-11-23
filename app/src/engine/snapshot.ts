import type { PlayerSnapshot } from '../../../shared/playback-input';

// The full queue stays on this device. A bounded cloud window keeps requests
// small and makes pagehide keepalive useful even for a very large library.
export function cloudSnapshot(value:PlayerSnapshot,max=2000):PlayerSnapshot {
 if(value.queue.length<=max&&(!value.sections||value.sections.context.length<=max&&value.sections.remaining.length<=max&&value.sections.manual.length<=max))return value;
 const sections=value.sections;
 if(!sections){const start=Math.max(0,value.index-100);return {...value,queue:value.queue.slice(start,start+max),index:value.index-start};}
 const history=sections.history.slice(-Math.min(100,max-1)),current=sections.current;let budget=max-history.length-(current?1:0);
 const manual=sections.manual.slice(0,budget);budget-=manual.length;const remaining=sections.remaining.slice(0,budget);budget-=remaining.length;
 const automatic=sections.autoplay&&sections.repeat==='off'?sections.automatic.slice(0,budget):[];
 const contextIds=new Set([...history.filter(entry=>entry.source==='context').map(entry=>entry.id),...(current?[current]:[]),...remaining]),context=sections.context.filter(id=>contextIds.has(id)).slice(0,max);
 const queue=[...history.map(entry=>entry.id),...(current?[current]:[]),...manual,...remaining,...automatic];
 return {...value,queue,index:current?history.length:0,sections:{...sections,history,context,manual,remaining,automatic,smart:(sections.smart||[]).filter(id=>remaining.includes(id))}};
}
