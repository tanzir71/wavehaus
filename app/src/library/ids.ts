const alphabet='0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function id(){let time=Date.now(),result='';for(let i=0;i<10;i++){result=alphabet[time%32]+result;time=Math.floor(time/32);}for(const b of crypto.getRandomValues(new Uint8Array(16)))result+=alphabet[b&31];return result;}
export function hash(s:string){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
export const tint=(artist:string,album:string)=>hash(`${artist.toLowerCase()}|${album.toLowerCase()}`)%6;
export const time=(ms:number)=>`${Math.floor(Math.max(0,ms)/60000)}:${Math.floor(Math.max(0,ms)/1000%60).toString().padStart(2,'0')}`;
