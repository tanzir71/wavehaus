import { it,expect } from 'vitest';
import { PlaybackQueue } from '../../app/src/engine/queue';
import { cloudSnapshot } from '../../app/src/engine/snapshot';
import { playerInput } from '../../shared/playback-input';
import type { Track } from '../../app/src/api/types';
const track=(n:number)=>({id:'01J'+String(n).padStart(23,'0'),artist_name:'Artist '+n} as Track);
it('keeps the full local queue while cloud snapshots retain the current track and manual order',()=>{
 const tracks=Array.from({length:5000},(_,i)=>track(i)),q=new PlaybackQueue();q.start(tracks,120);q.add([track(9001),track(9002)]);const full={queue:q.timeline.map(e=>e.track.id),index:q.history.length,positionMs:12345,shuffle:false,repeat:'off' as const,autoplay:true,updatedAt:1000,sections:q.save()},remote=cloudSnapshot(full);
 expect(full.sections.context).toHaveLength(5000);expect(remote.queue).toHaveLength(2000);expect(remote.queue[remote.index]).toBe(tracks[120].id);expect(remote.sections!.manual).toEqual([track(9001).id,track(9002).id]);expect(()=>playerInput(remote)).not.toThrow();
});
