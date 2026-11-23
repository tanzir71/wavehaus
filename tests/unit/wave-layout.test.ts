import { expect,it } from 'vitest';
import { layoutSegments,timeAtX,xAtTime } from '../../app/src/engine/wave-layout';
it('weights album waveforms by duration while retaining the four-pixel gaps',()=>{
 const layout=layoutSegments([{id:'a',title:'Intro',durationMs:10000},{id:'b',title:'Main',durationMs:30000}],404);
 expect(layout.map(s=>[s.x,s.width,s.startMs])).toEqual([[0,100,0],[104,300,10000]]);
 expect(timeAtX(layout,254)).toBe(25000);expect(xAtTime(layout,25000)).toBe(254);expect(timeAtX(layout,102)).toBe(10000);
});
it('clamps positions and allocates drawable space for unknown durations and very large albums',()=>{
 const layout=layoutSegments(Array.from({length:500},(_,i)=>({id:String(i),title:'Unknown',durationMs:0})),200);
 expect(layout.every(s=>s.width>0)).toBe(true);expect(layout.at(-1)!.x+layout.at(-1)!.width).toBeCloseTo(200);expect(timeAtX(layout,-20)).toBe(0);expect(timeAtX([],10)).toBe(0);
});
