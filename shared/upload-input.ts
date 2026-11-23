export class UploadError extends Error {constructor(public code:string,message:string,public status=400){super(message);}}
function reject(code:string,message:string,status=400):never {throw new UploadError(code,message,status);}
export const audioExtensions=['mp3','flac','m4a','alac','opus','ogg','wav','aif','aiff'];
export const extension=(name:string)=>name.split('.').at(-1)?.toLowerCase()||'';
export function uploadInput(input:Record<string,unknown>,maxBytes:number){
 const filename=input.filename;if(typeof filename!=='string'||!filename.trim()||[...filename].length>500||/[\\/\x00-\x1f]/.test(filename))reject('invalid_filename','Choose a file with a valid name.');
 if(!audioExtensions.includes(extension(filename)))reject('unsupported','This file type is not supported audio.',415);
 if(!Number.isSafeInteger(input.size)||Number(input.size)<12||Number(input.size)>maxBytes)reject('too_large',`Choose an audio file up to ${Math.floor(maxBytes/1024**2)} MB.`,413);
 if(typeof input.sha256!=='string'||!/^[a-f0-9]{64}$/.test(input.sha256))reject('invalid_hash','A SHA-256 hash is required.');
 return {filename,size:Number(input.size),sha256:input.sha256};
}
export function sniffAudio(header:Uint8Array,filename:string){
 const text=(offset:number,length:number)=>String.fromCharCode(...header.subarray(offset,offset+length));const ext=extension(filename);
 if(ext==='mp3'&&(text(0,3)==='ID3'||header[0]===255&&(header[1]&224)===224&&(header[1]&6)!==0))return 'audio/mpeg';
 if(ext==='flac'&&text(0,4)==='fLaC')return 'audio/flac';
 if(['m4a','alac'].includes(ext)&&text(4,4)==='ftyp')return 'audio/mp4';
 if(['ogg','opus'].includes(ext)&&text(0,4)==='OggS')return 'audio/ogg';
 if(ext==='wav'&&text(0,4)==='RIFF'&&text(8,4)==='WAVE')return 'audio/wav';
 if(['aif','aiff'].includes(ext)&&text(0,4)==='FORM'&&['AIFF','AIFC'].includes(text(8,4)))return 'audio/aiff';
 reject('unsupported','The file contents do not match a supported audio format.',415);
}
export function text(value:unknown,label:string,max=500,required=false){if(value===undefined||value===null||value===''){if(required)reject('validation',`${label} is required.`);return null;}if(typeof value!=='string'||[...value].length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value))reject('validation',`${label} is invalid.`);const result=value.trim();if(required&&!result)reject('validation',`${label} is required.`);return result||null;}
export function number(value:unknown,label:string,max:number,integer=true,min=0){if(value===undefined||value===null||value==='')return null;if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||integer&&!Number.isSafeInteger(value))reject('validation',`${label} is invalid.`);return value;}
export function relativePath(value:unknown){const path=text(value,'Folder path',1500);if(path&&(/^[\\/]|^[a-z]:|\\|(?:^|\/)\.\.(?:\/|$)/i.test(path)))reject('validation','Use a relative folder path.');return path;}
export function peaksInput(value:unknown){if(value===null||value===undefined||value==='')return null;if(typeof value!=='string'||value.length!==1336||!/^[A-Za-z0-9+/]{1334}==$/.test(value))reject('invalid_peaks','Waveforms need exactly 1000 peak values.');try{if(atob(value).length!==1000)reject('invalid_peaks','Waveforms need exactly 1000 peak values.');}catch{reject('invalid_peaks','Waveforms need exactly 1000 peak values.');}return value;}
export function completionInput(input:Record<string,unknown>){
 if(!input.metadata||typeof input.metadata!=='object'||Array.isArray(input.metadata)||!input.album||typeof input.album!=='object'||Array.isArray(input.album))reject('validation','Track metadata and album are required.');
 const m=input.metadata as Record<string,unknown>,a=input.album as Record<string,unknown>,artist=text(m.artist,'Artist',200,true)!,albumArtist=text(m.albumArtist,'Album artist',200)||artist;
 const visibility=input.visibility??'private';if(typeof visibility!=='string'||!['private','public'].includes(visibility))reject('validation','Choose Private or Public.');
 const source=m.organiseSource??'filename';if(typeof source!=='string'||!['tags','folder','filename','manual','assistant'].includes(source))reject('validation','Invalid metadata source.');
 const metadata={title:text(m.title,'Title',500,true)!,artist,albumArtist,album:text(a.title,'Album title',500,true)!,trackNo:number(m.trackNo,'Track number',9999),discNo:number(m.discNo,'Disc number',999),year:number(m.year,'Year',2999,true,1),genre:text(m.genre,'Genre',500),bpm:number(m.bpm,'BPM',1000,false),durationMs:number(m.durationMs,'Duration',7*86400000)??0,codec:text(m.codec,'Codec',100),container:text(m.container,'Container',100),bitrate:number(m.bitrate,'Bitrate',100000000),sampleRate:number(m.sampleRate,'Sample rate',768000),bitDepth:number(m.bitDepth,'Bit depth',64),channels:number(m.channels,'Channel count',64),replaygainTrackDb:number(m.replaygainTrackDb,'Track gain',120,false,-120),replaygainAlbumDb:number(m.replaygainAlbumDb,'Album gain',120,false,-120),lyrics:text(m.lyrics,'Lyrics',200000),lyricsSynced:m.lyricsSynced===true,quickHash:text(m.quickHash,'Quick hash',64),originalPath:relativePath(m.originalPath),organiseSource:String(source)};
 if(metadata.quickHash&&!/^[a-f0-9]{64}$/.test(metadata.quickHash))reject('invalid_hash','Invalid quick hash.');
 const existingAlbumId=text(a.existingAlbumId,'Album ID',26);if(existingAlbumId&&!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(existingAlbumId))reject('validation','Invalid album ID.');
 return {metadata,album:{title:metadata.album,artistName:text(a.artistName,'Album artist',200)||albumArtist,year:number(a.year??m.year,'Year',2999,true,1),folderPath:relativePath(a.folderPath),existingAlbumId},peaks:peaksInput(input.peaks),visibility:visibility as 'private'|'public'};
}
export const normalized=(value:string)=>value.toLowerCase().trim().replace(/\s+/g,' ');
export function coverHash(value:string){let hash=2166136261;for(const byte of new TextEncoder().encode(value)){hash^=byte;hash=Math.imul(hash,16777619);}return hash>>>0;}
