import { open,readFile,mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
// Legal FLAC PADDING metadata retains a tiny original audio stream while
// exercising 300 MB file handling. The large artifact stays in ignored .work.
export async function largeFlac(){
 const path=resolve('.work/300MB-original-tone.flac');await mkdir(resolve('.work'),{recursive:true});
 const original=await readFile('tests/fixtures/library/Fixture Artist/Tagged Album/01 - Glass Tone.flac');let offset=4,last=0;
 while(offset<original.length){last=offset;const size=original.readUIntBE(offset+1,3);offset+=4+size;if(original[last]&128)break;}
 const metadata=Buffer.from(original.subarray(0,offset));metadata[last]&=127;let remaining=300*1024**2-original.length;
 const file=await open(path,'w');try{await file.write(metadata);while(remaining){const length=Math.min(0xffffff,remaining-4),final=remaining===length+4,header=Buffer.alloc(4);header[0]=1|(final?128:0);header.writeUIntBE(length,1,3);await file.write(header);await file.write(Buffer.alloc(length));remaining-=length+4;}await file.write(original.subarray(offset));}finally{await file.close();}return path;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename))console.log(await largeFlac());
