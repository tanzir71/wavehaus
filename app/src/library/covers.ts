import { hash,tint } from './ids';
export const coverTints=['#1B2142','#0F2A2C','#2A1C33','#1A2A20','#1C2733','#232326'];
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
export function coverSvg(title:string,artist:string,size=600,peaks?:string|null){
 const small=size<96,count=small?11:24,seed=hash(`${artist.toLowerCase()}|${title.toLowerCase()}`);let n=seed;
 const samples=peaks?Uint8Array.from(atob(peaks),c=>c.charCodeAt(0)):null;
 // Figma's nominal bar widths exceed the square at 24 bars; fit the mark within 84%.
 const step=size*.84/count,w=step*.67;let bars='';
 for(let i=0;i<count;i++){n=(Math.imul(n,1664525)+1013904223)>>>0;const level=samples?Math.max(...samples.slice(Math.floor(i*samples.length/count),Math.ceil((i+1)*samples.length/count)))/255:.12+(n/4294967296)*.88;const h=Math.max(2,level*size*(small?.56:.46));bars+=`<rect x="${size*.08+i*step}" y="${size*.46-h/2}" width="${w}" height="${h}" rx="${size/600}"/>`;}
 const line=title.length>21?[title.slice(0,21),title.slice(21,40)+(title.length>40?'…':'')]:[title];
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="${coverTints[tint(artist,title)]}"/><g fill="white" opacity=".26">${bars}</g>${small?'':`<text x="${size*.08}" y="${size*(line.length===2?.73:.82)}" fill="#f4f4f5" font-family="Geist,Arial,sans-serif" font-weight="600" font-size="${size*.075}">${line.map((s,i)=>`<tspan x="${size*.08}" dy="${i?size*.085:0}">${esc(s)}</tspan>`).join('')}</text><text x="${size*.08}" y="${size*.91}" fill="white" fill-opacity=".55" font-family="Geist Mono,monospace" font-size="${size*.045}">${esc(artist.slice(0,27))}</text>`}</svg>`;
}
export const coverData=(title:string,artist:string,size=600,peaks?:string|null)=>`data:image/svg+xml,${encodeURIComponent(coverSvg(title,artist,size,peaks))}`;
export async function coverCanvas(title:string,artist:string,size=512,peaks?:string|null){
 // Drawing text directly keeps the self-hosted fonts in raster exports. An SVG
 // loaded as an Image cannot reliably load the document's font faces.
 await Promise.all([document.fonts.load('600 38px Geist'),document.fonts.load('500 23px "Geist Mono"')]);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d')!,small=size<96,count=small?11:24,seed=hash(`${artist.toLowerCase()}|${title.toLowerCase()}`),samples=peaks?Uint8Array.from(atob(peaks),c=>c.charCodeAt(0)):null,step=size*.84/count,w=step*.67;
 ctx.fillStyle=coverTints[tint(artist,title)];ctx.fillRect(0,0,size,size);ctx.fillStyle='rgba(255,255,255,.26)';let n=seed;
 for(let i=0;i<count;i++){n=(Math.imul(n,1664525)+1013904223)>>>0;const level=samples?Math.max(...samples.slice(Math.floor(i*samples.length/count),Math.ceil((i+1)*samples.length/count)))/255:.12+n/4294967296*.88,h=Math.max(2,level*size*(small?.56:.46));ctx.beginPath();ctx.roundRect(size*.08+i*step,size*.46-h/2,w,h,size/600);ctx.fill();}
 if(!small){const line=title.length>21?[title.slice(0,21),title.slice(21,40)+(title.length>40?'…':'')]:[title];ctx.fillStyle='#f4f4f5';ctx.font=`600 ${size*.075}px Geist`;for(const [i,text]of line.entries())ctx.fillText(text,size*.08,size*((line.length===2?.73:.82)+i*.085),size*.84);ctx.font=`500 ${size*.045}px "Geist Mono"`;ctx.fillStyle='rgba(255,255,255,.55)';ctx.fillText(artist.length>27?artist.slice(0,26)+'…':artist,size*.08,size*.91,size*.84);}
 return canvas;
}
export async function coverPng(title:string,artist:string,peaks?:string|null){const canvas=await coverCanvas(title,artist,512,peaks);return new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Artwork could not be generated')),'image/png'));}
