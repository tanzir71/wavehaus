import { writeFile } from 'node:fs/promises';
// Original PCM audio. WAV avoids a build-time encoder or an external service.
export function wav(samples,rate=16000){
 const bytes=Buffer.alloc(44+samples.length*2); bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(rate,24);bytes.writeUInt32LE(rate*2,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(samples.length*2,40);for(let i=0;i<samples.length;i++)bytes.writeInt16LE(Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),44+i*2);return bytes;
}
export async function makeChime(){const rate=16000,a=new Float32Array(rate*45);for(let i=0;i<a.length;i++){const t=i/rate;const env=Math.min(1,t,45-t);a[i]=0.035*Math.sin(t*2*Math.PI*220)*env;if(t>30)a[i]+=0.12*Math.sin(2*Math.PI*880*t)*Math.exp(-(t-30)*1.5);}await writeFile('app/public/chime-test.wav',wav(a));}
if(process.argv[1]?.endsWith('make-chime.mjs'))await makeChime();
