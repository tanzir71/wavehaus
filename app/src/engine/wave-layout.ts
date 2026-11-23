export interface WaveSegment {id:string;title:string;durationMs:number;peaks?:string|null}
export interface SegmentLayout extends WaveSegment {x:number;width:number;startMs:number}
export function layoutSegments(segments:WaveSegment[],width:number,gap=4):SegmentLayout[]{
 const spacing=segments.length>1?Math.min(gap,width/(segments.length*2)):0,total=segments.reduce((n,s)=>n+Math.max(1,s.durationMs),0),available=Math.max(0,width-spacing*Math.max(0,segments.length-1));
 let x=0,startMs=0;return segments.map(s=>{const size=available*Math.max(1,s.durationMs)/(total||1),result={...s,x,width:size,startMs};x+=size+spacing;startMs+=s.durationMs;return result;});
}
export function segmentAtX(segments:SegmentLayout[],x:number){return segments.find(s=>x<=s.x+s.width)||segments.at(-1);}
export function timeAtX(segments:SegmentLayout[],x:number){const s=segmentAtX(segments,x);return s?s.startMs+Math.max(0,Math.min(1,(x-s.x)/(s.width||1)))*s.durationMs:0;}
export function xAtTime(segments:SegmentLayout[],ms:number){const s=segments.find(s=>ms<s.startMs+s.durationMs)||segments.at(-1);return s?s.x+Math.max(0,Math.min(1,(ms-s.startMs)/(s.durationMs||1)))*s.width:0;}
