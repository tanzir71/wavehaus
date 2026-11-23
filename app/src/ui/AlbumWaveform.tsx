import { useMemo } from 'preact/hooks';
import type { Track } from '../api/types';
import * as player from '../engine/player';
import { Waveform } from './Waveform';
export function AlbumWaveform({tracks,title,context}:{tracks:Track[];title:string;context:{label:string;type:string}}){
 const structure=useMemo(()=>{let duration=0;const offsets:number[]=[],indices=new Map<string,number>();const segments=tracks.map((t,index)=>{offsets.push(duration);indices.set(t.id,index);duration+=t.duration_ms;return {id:t.id,title:t.title,durationMs:t.duration_ms,peaks:t.peaks};});return {segments,offsets,indices,duration};},[tracks]);
 const index=structure.indices.get(player.current.value?.id||'')??-1,duration=structure.duration,offset=index<0?0:structure.offsets[index],position=index<0?0:offset+player.positionMs.value;
 const playing=index>=0&&player.state.value==='playing';
 const at=(ms:number)=>{let start=0;for(let i=0;i<tracks.length;i++){const t=tracks[i];if(ms<start+t.duration_ms||i===tracks.length-1){if(player.current.peek()?.id===t.id&&player.queueSections.peek().type===context.type)player.seek(ms-start);else player.load(tracks,i,context,ms-start);return;}start+=t.duration_ms;}};
 return <Waveform variant="Hero" segments={structure.segments} duration={duration} position={position} playing={playing} livePosition={()=>index<0?0:offset+player.audio.currentTime*1000} onSeek={at} label={`${title} album waveform`}/>;
}
