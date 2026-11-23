import { it,expect } from 'vitest';
import { playerInput,playsInput } from '../../shared/playback-input';
import { PlaybackQueue } from '../../app/src/engine/queue';
import type { Track } from '../../app/src/api/types';
const id='01J00000000000000000000001';
it('accepts the actual queue model snapshot with a repeated manual track',()=>{const q=new PlaybackQueue(),track={id,title:'Fixture',artist_name:'Artist'} as Track;q.start([track]);q.add([track]);const snapshot={queue:[id,id],index:0,positionMs:1000,shuffle:false,repeat:'off',autoplay:true,updatedAt:Date.now(),sections:q.save()};expect(playerInput(snapshot)).toEqual(snapshot);});
it('bounds an entire play batch before callers can perform any writes',()=>{const play={id,trackId:id,startedAt:1000,msPlayed:900,completed:true,skipped:false};expect(playsInput({plays:[play]},1000)[0]).toMatchObject(play);expect(()=>playsInput({plays:[play,{...play,msPlayed:-1}]},1000)).toThrow('Listening time');expect(()=>playsInput({plays:new Array(101).fill(play)},1000)).toThrow('100');expect(()=>playsInput({plays:[{...play,skipped:true}]},1000)).toThrow('also be skipped');});
