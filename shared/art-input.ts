import { UploadError } from './upload-input';
export const artLimit=5*1024**2,artRequestLimit=3*artLimit+65536;
function reject(message:string,status=400):never{throw new UploadError('invalid_art',message,status);}
export function artMime(bytes:Uint8Array,generated:boolean){
 const ascii=(at:number,len:number)=>String.fromCharCode(...bytes.subarray(at,at+len));
 if(generated){if(bytes.length>=24&&bytes[0]===137&&ascii(1,7)==='PNG\r\n\x1a\n'&&ascii(12,4)==='IHDR')return 'image/png';}
 else if(bytes.length>=16&&ascii(0,4)==='RIFF'&&ascii(8,4)==='WEBP'&&['VP8 ','VP8L','VP8X'].includes(ascii(12,4)))return 'image/webp';
 return reject(generated?'Generated covers must be PNG images.':'Upload resized WebP covers.',415);
}
export async function artInput(form:FormData){
 const original=form.get('original');if(original!==null){if(!(original instanceof Blob)||original.size<24||original.size>artLimit)reject('Choose artwork under 5 MB per image.',413);if(['art600','art96','generated512'].some(name=>form.has(name)))reject('Send original artwork on its own.');const bytes=new Uint8Array(await original.slice(0,32).arrayBuffer()),ascii=(at:number,len:number)=>String.fromCharCode(...bytes.subarray(at,at+len)),mime=bytes[0]===137&&ascii(1,7)==='PNG\r\n\x1a\n'?'image/png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':ascii(0,4)==='RIFF'&&ascii(8,4)==='WEBP'?'image/webp':reject('Use PNG, JPEG or WebP artwork.',415);return {files:[{name:'art600',filename:'600.webp',blob:original,mime},{name:'art96',filename:'96.webp',blob:original,mime}],source:'uploaded'};}

 const names=['art600','art96','generated512'] as const,files=[];
 for(const name of names){const file=form.get(name);if(file===null)continue;if(!(file instanceof Blob)||file.size<24||file.size>artLimit)reject('Choose artwork under 5 MB per image.',413);const mime=artMime(new Uint8Array(await file.slice(0,32).arrayBuffer()),name==='generated512');files.push({name,filename:name==='generated512'?'generated-512.png':name==='art600'?'600.webp':'96.webp',blob:file,mime});}
 if(!files.length||form.has('art600')!==form.has('art96'))reject('Send both 600 and 96 pixel covers, or a generated PNG.');
 const source=form.get('source')??(form.has('generated512')?'generated':'uploaded');if(typeof source!=='string'||!['embedded','folder','uploaded','generated'].includes(source))reject('Choose a valid artwork source.');
 if(source==='generated'&&!form.has('generated512'))reject('Generated covers need a PNG for lock-screen artwork.');
 return {files,source};
}
