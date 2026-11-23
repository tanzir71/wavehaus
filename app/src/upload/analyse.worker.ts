import { parseBlob } from 'music-metadata';
import { hashBlob } from '../../../shared/sha256';
import { sniffAudio } from '../../../shared/upload-input';
import { organise } from './organise';
import type { Analysis } from './types';
const hex=(value:ArrayBuffer)=>Array.from(new Uint8Array(value),b=>b.toString(16).padStart(2,'0')).join('');
self.onmessage=async(event:MessageEvent<{file:File;path:string;quickOnly?:boolean}>)=>{
 try{
  const {file,path,quickOnly}=event.data,mime=sniffAudio(new Uint8Array(await file.slice(0,32).arrayBuffer()),file.name);
  if(quickOnly){const quick=hex(await crypto.subtle.digest('SHA-256',await new Blob([file.slice(0,1024**2),file.slice(Math.max(0,file.size-1024**2)),new TextEncoder().encode(String(file.size))]).arrayBuffer()));self.postMessage({ok:true,result:quick});return;}
  let parsed:Awaited<ReturnType<typeof parseBlob>>|undefined,warning:string|undefined;
  try{parsed=await parseBlob(file,{duration:true,skipCovers:false});}catch{warning='Tags could not be read; used the folder and filename.';}
  const fields=organise(file.name,path,(parsed?.common||{}) as unknown as Record<string,unknown>),format=parsed?.format,common=parsed?.common,picture=common?.picture?.[0];
  const analysis:Analysis={hash:await hashBlob(file,read=>self.postMessage({progress:read/file.size})),mime,metadata:{...fields,durationMs:Math.round((format?.duration||0)*1000),codec:format?.codec,container:format?.container,sampleRate:format?.sampleRate,bitrate:format?.bitrate===undefined?undefined:Math.round(format.bitrate),bitDepth:format?.bitsPerSample,channels:format?.numberOfChannels,bpm:common?.bpm,replaygainTrackDb:common?.replaygain_track_gain?.dB,replaygainAlbumDb:common?.replaygain_album_gain?.dB,originalPath:path,lyrics:common?.lyrics?.[0]?.text},album:{title:fields.album,artistName:fields.albumArtist,year:fields.year,folderPath:path.split('/').slice(0,-1).join('/')},picture:picture&&picture.data.byteLength<=20*1024**2?new Blob([picture.data as BlobPart],{type:picture.format}):undefined,warning};
  self.postMessage({ok:true,result:analysis});
 }catch(error){self.postMessage({ok:false,error:{message:(error as Error).message,code:(error as {code?:string}).code,status:(error as {status?:number}).status}});}
};
