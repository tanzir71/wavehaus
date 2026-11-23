export function encodeWav(samples:Float32Array,rate:number){const bytes=new ArrayBuffer(44+samples.length*2),view=new DataView(bytes);const str=(at:number,s:string)=>{for(let i=0;i<s.length;i++)view.setUint8(at+i,s.charCodeAt(i));};str(0,'RIFF');view.setUint32(4,bytes.byteLength-8,true);str(8,'WAVEfmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,samples.length*2,true);for(let i=0;i<samples.length;i++)view.setInt16(44+i*2,Math.max(-1,Math.min(1,samples[i]))*32767,true);return new Blob([bytes],{type:'audio/wav'});}
export function peaksFromChannels(channels:Float32Array[]){const peaks=new Uint8Array(1000);let max=0;const values=new Float32Array(1000);for(let b=0;b<1000;b++){let p=0;for(const channel of channels){const start=Math.floor(b*channel.length/1000),end=Math.ceil((b+1)*channel.length/1000);for(let i=start;i<end;i++)p=Math.max(p,Math.abs(channel[i]||0));}values[b]=Math.sqrt(p);max=Math.max(max,values[b]);}for(let i=0;i<1000;i++)peaks[i]=Math.round(values[i]/(max||1)*255);return btoa(String.fromCharCode(...peaks));}
export async function generateMusic(seed:number,duration=36){const rate=16000;let samples:Float32Array;
 if(typeof OfflineAudioContext!=='undefined'){
  const context=new OfflineAudioContext(1,rate*duration,rate),gain=context.createGain();gain.gain.value=.07;gain.connect(context.destination);
  for(let t=0;t<duration;t+=.125)gain.gain.linearRampToValueAtTime(.012+.06*(.5+.5*Math.sin(t*1.7+seed))*(.65+.35*Math.sin(t*3.1)),t);
  const roots=[130.8128,146.8324,164.8138];const root=roots[seed%3];
  for(const ratio of [1,1.25,1.5]){const osc=context.createOscillator();osc.type='sine';osc.frequency.value=root*ratio;osc.connect(gain);osc.start();osc.stop(duration);}
  for(let t=0;t<duration;t+=.5){const osc=context.createOscillator(),env=context.createGain();osc.frequency.value=root*[1,1.5,2,2.5,3,2][Math.floor(t*2+seed)%6];env.gain.setValueAtTime(0,t);env.gain.linearRampToValueAtTime(.09,t+.015);env.gain.exponentialRampToValueAtTime(.001,t+.44);osc.connect(env);env.connect(context.destination);osc.start(t);osc.stop(t+.48);}
  samples=(await context.startRendering()).getChannelData(0);
 }else{samples=new Float32Array(rate*duration);for(let i=0;i<samples.length;i++)samples[i]=Math.sin(2*Math.PI*(130+seed*7)*i/rate)*.12;}
 const fade=rate*.3;for(let i=0;i<fade;i++){samples[i]*=i/fade;samples[samples.length-1-i]*=i/fade;}
 return {blob:encodeWav(samples,rate),peaks:peaksFromChannels([samples])};
}
