import type { PickedFile } from './types';
interface Entry {isFile:boolean;isDirectory:boolean;name:string;file(callback:(file:File)=>void,error:(reason:unknown)=>void):void;createReader():{readEntries(callback:(entries:Entry[])=>void,error:(reason:unknown)=>void):void}}
export async function droppedFiles(transfer:DataTransfer){
 const result:PickedFile[]=[];
 async function visit(entry:Entry,parent=''){
  const path=parent+entry.name;if(result.length>=10000)throw new Error('Choose up to 10,000 files at a time.');
  if(entry.isFile){const file=await new Promise<File>((resolve,reject)=>entry.file(resolve,reject));result.push({file,path});}
  else if(entry.isDirectory){const reader=entry.createReader();while(true){const entries=await new Promise<Entry[]>((resolve,reject)=>reader.readEntries(resolve,reject));if(!entries.length)break;for(const child of entries)await visit(child,path+'/');}}
 }
 // Capture entry handles synchronously before the drop event's data store closes.
 const entries=Array.from(transfer.items).filter(item=>item.kind==='file').map(item=>(item as unknown as {webkitGetAsEntry():Entry|null}).webkitGetAsEntry?.());
 const fallback=Array.from(transfer.files);if(entries.some(Boolean)){for(const entry of entries)if(entry)await visit(entry);}else for(const file of fallback)result.push({file,path:file.webkitRelativePath||file.name});return result;
}
const folder=(path:string)=>path.split('/').slice(0,-1).join('/').toLowerCase();
export function sidecars(audio:PickedFile,all:PickedFile[]){
 const same=all.filter(item=>folder(item.path)===folder(audio.path)),images=same.filter(item=>/\.(jpg|jpeg|png|webp)$/i.test(item.file.name)&&item.file.size<=20*1024**2);
 const priority=['cover','folder','front','album'];images.sort((a,b)=>{const score=(name:string)=>{const n=priority.indexOf(name.replace(/\.[^.]+$/,'').toLowerCase());return n<0?99:n;};return score(a.file.name)-score(b.file.name);});
 const first=images[0],name=first?.file.name.replace(/\.[^.]+$/,'').toLowerCase(),picture=first&&(priority.includes(name)||images.length===1)?first.file:undefined;
 const lyrics=same.find(item=>item.file.name.toLowerCase()===audio.file.name.replace(/\.[^.]+$/,'').toLowerCase()+'.lrc'&&item.file.size<=800000)?.file;
 return {picture,lyrics};
}
