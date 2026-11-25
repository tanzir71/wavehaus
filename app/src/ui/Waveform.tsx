import { useEffect,useRef,useState } from 'preact/hooks';
import { time } from '../library/ids';
import { layoutSegments,segmentAtX,timeAtX,xAtTime,type WaveSegment } from '../engine/wave-layout';
import {touchMotion,type TouchMotion} from './touch-intent';
export type WaveVariant='Hero'|'Now'|'Scrubber'|'Wide'|'Mini'|'Row'|'Strip';
interface Props {onMoment?:(ms:number)=>void;loop?:{a:number;b:number}|null;onLoopChange?:(a:number,b:number)=>void;peaks?:string|null;position?:number;duration?:number;onSeek?:(ms:number)=>void;variant?:WaveVariant;label?:string;playing?:boolean;livePosition?:()=>number;segments?:WaveSegment[];moments?:{id:string;at_ms:number;label:string}[]}
const peakCache=new Map<string,Uint8Array>();
function decode(value?:string|null){if(!value)return null;const cached=peakCache.get(value);if(cached)return cached;try{const bytes=Uint8Array.from(atob(value),c=>c.charCodeAt(0));if(!bytes.length)return null;if(peakCache.size>=64)peakCache.delete(peakCache.keys().next().value!);peakCache.set(value,bytes);return bytes;}catch{return null;}}
export function Waveform({peaks,position=0,duration=0,onSeek,variant='Scrubber',label='Playback position',playing=false,livePosition,segments,moments=[],onMoment,loop,onLoopChange}:Props){
 const canvas=useRef<HTMLCanvasElement>(null),container=useRef<HTMLDivElement>(null),drag=useRef(false),lastSeek=useRef(0),drawRef=useRef<()=>void>(()=>{}),hoverX=useRef<number|null>(null),latest=useRef({position,duration,onSeek,playing,livePosition,segments});
 latest.current={position,duration,onSeek,playing,livePosition,segments};
 const hold=useRef<{timer?:ReturnType<typeof setTimeout>;clientX:number;clientY:number;long:boolean;id:number|null;touch:boolean;intent:TouchMotion}>({clientX:0,clientY:0,long:false,id:null,touch:false,intent:'tap'});useEffect(()=>()=>clearTimeout(hold.current.timer),[]);
 const [bubble,setBubble]=useState<{fraction:number;at:number;title?:string}|null>(null);
 useEffect(()=>{
  const el=canvas.current!,wrap=container.current!,ctx=el.getContext('2d');if(!ctx)return;
  let visible=false,frame=0,geometryDirty=true,width=0,height=0,dpr=1;
  let layout=layoutSegments([],0),bars:{x:number;y:number;h:number;mirror:number;w:number}[]=[];
  const large=variant==='Hero'||variant==='Now',reflection=variant!=='Row'&&variant!=='Strip';
  const styles=getComputedStyle(wrap),colour=(name:string)=>styles.getPropertyValue(name).trim();
  const palette={unplayed:colour('--wh-wave-unplayed'),played:colour('--wh-wave-played'),reflection:colour('--wh-wave-reflection'),playedReflection:colour('--wh-wave-played-reflection'),hover:colour('--wh-wave-hover')};
  function geometry(){
   const rect=wrap.getBoundingClientRect();width=rect.width;height=rect.height;dpr=devicePixelRatio||1;if(!width||!height)return;
   const responsive=getComputedStyle(wrap),bar=parseFloat(responsive.getPropertyValue('--wh-wave-bar-width'))||(large?3:2),gap=parseFloat(responsive.getPropertyValue('--wh-wave-bar-gap'))||(large?2:1);
   const pixelWidth=Math.round(width*dpr),pixelHeight=Math.round(height*dpr);if(el.width!==pixelWidth||el.height!==pixelHeight){el.width=pixelWidth;el.height=pixelHeight;}
   const pieces=segments?.length?segments:[{id:'track',title:'',durationMs:duration,peaks}];layout=layoutSegments(pieces,width);bars=[];const baseline=height*.7;
   for(const piece of layout){const values=decode(piece.peaks);if(!values){bars.push({x:piece.x,y:baseline-2,w:piece.width,h:2,mirror:0});continue;}
    const count=Math.max(1,Math.floor(piece.width/(bar+gap)));for(let i=0;i<count;i++){const from=Math.floor(i*values.length/count),to=Math.max(from+1,Math.floor((i+1)*values.length/count));let value=0;for(let j=from;j<to;j++)value=Math.max(value,values[j]||0);const h=Math.max(2,value/255*Math.max(2,baseline-2));bars.push({x:piece.x+i*(bar+gap),y:baseline-h,w:Math.min(bar,piece.width-i*(bar+gap)),h,mirror:reflection?Math.min(height-baseline-1,h*(large?.3:.25)):0});}
   }geometryDirty=false;
  }
  function pass(played:boolean){
   ctx!.fillStyle=played?palette.played:palette.unplayed;ctx!.beginPath();for(const b of bars){if(b.w<=0)continue;if(large&&typeof ctx!.roundRect==='function')ctx!.roundRect(b.x,b.y,b.w,b.h,1);else ctx!.rect(b.x,b.y,b.w,b.h);}ctx!.fill();
   if(reflection){ctx!.fillStyle=played?palette.playedReflection:palette.reflection;ctx!.beginPath();for(const b of bars)if(b.mirror>0&&b.w>0)ctx!.rect(b.x,height*.7+1,b.w,b.mirror);ctx!.fill();}
  }
  function draw(){
   if(geometryDirty)geometry();if(!width||!height)return;ctx!.setTransform(dpr,0,0,dpr,0,0);ctx!.clearRect(0,0,width,height);pass(false);
   const value=latest.current,at=value.playing&&value.livePosition?value.livePosition():value.position;
   ctx!.save();ctx!.beginPath();ctx!.rect(0,0,xAtTime(layout,at),height);ctx!.clip();pass(true);ctx!.restore();
   if(hoverX.current!==null){ctx!.save();ctx!.beginPath();ctx!.rect(0,0,hoverX.current*width,height);ctx!.clip();ctx!.fillStyle=palette.hover;ctx!.beginPath();for(const b of bars)ctx!.rect(b.x,b.y,b.w,b.h);ctx!.fill();ctx!.restore();}
  }
  function schedule(){cancelAnimationFrame(frame);if(visible&&!document.hidden&&latest.current.playing){draw();frame=requestAnimationFrame(schedule);}else draw();}
  drawRef.current=schedule;const resize=new ResizeObserver(()=>{geometryDirty=true;schedule();});resize.observe(wrap);
  const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;schedule();});intersection.observe(wrap);
  document.addEventListener('visibilitychange',schedule);draw();
  return()=>{cancelAnimationFrame(frame);resize.disconnect();intersection.disconnect();document.removeEventListener('visibilitychange',schedule);drawRef.current=()=>{};};
 },[peaks,duration,variant,segments]);
 useEffect(()=>{drawRef.current();},[position,playing]);
 function pointer(x:number,seek:boolean){const rect=container.current!.getBoundingClientRect(),fraction=Math.max(0,Math.min(1,(x-rect.left)/(rect.width||1))),pieces=latest.current.segments?.length?latest.current.segments:[{id:'track',title:'',durationMs:duration,peaks}],layout=layoutSegments(pieces,rect.width),at=timeAtX(layout,fraction*rect.width);hoverX.current=fraction;setBubble({fraction,at,title:segments?.length?segmentAtX(layout,fraction*rect.width)?.title:undefined});if(seek)onSeek?.(at);drawRef.current();return at;}
 const interactive=!!onSeek;
 return <div ref={container} class={`waveform wave-${variant.toLowerCase()}`}>
  {loop&&<span class="wave-loop-region" style={{left:(loop.a/(duration||1)*100)+'%',width:((loop.b-loop.a)/(duration||1)*100)+'%'}}/>}
  <div class="wave-hit" role={interactive?duration>0?'slider':'button':'img'} aria-label={label} aria-orientation={interactive&&duration>0?'horizontal':undefined} aria-valuemin={interactive&&duration>0?0:undefined} aria-valuemax={interactive&&duration>0?Math.round(duration/1000):undefined} aria-valuenow={interactive&&duration>0?Math.round(Math.max(0,Math.min(duration,position))/1000):undefined} aria-valuetext={interactive&&duration>0?`${time(position)} of ${time(duration)}`:undefined} tabIndex={interactive?0:undefined}
   onPointerDown={e=>{if(!onSeek||e.button!==0||!e.isPrimary)return;clearTimeout(hold.current.timer);const touch=e.pointerType!=='mouse';drag.current=true;if(!touch)e.currentTarget.setPointerCapture(e.pointerId);lastSeek.current=performance.now();const at=pointer(e.clientX,!touch&&!onMoment);hold.current={clientX:e.clientX,clientY:e.clientY,long:false,id:e.pointerId,touch,intent:touch?'tap':'scrub',timer:onMoment?setTimeout(()=>{hold.current.long=true;navigator.vibrate?.(8);onMoment(at);},500):undefined};}}
   onPointerMove={e=>{const active=hold.current;if(drag.current&&active.id===e.pointerId){const motion=touchMotion(active,e);if(motion!=='tap')clearTimeout(active.timer);if(active.touch&&active.intent==='tap'&&motion!=='tap'){active.intent=motion;if(motion==='scrub')e.currentTarget.setPointerCapture(e.pointerId);}if(active.intent==='scroll'){drag.current=false;hoverX.current=null;setBubble(null);drawRef.current();return;}if(active.long)return;const commit=(!active.touch||active.intent==='scrub')&&performance.now()-lastSeek.current>=50;if(commit)lastSeek.current=performance.now();pointer(e.clientX,commit);}else if(e.pointerType==='mouse')pointer(e.clientX,false);}}
   onPointerUp={e=>{const active=hold.current;if(active.id!==e.pointerId)return;clearTimeout(active.timer);if(drag.current&&!active.long&&active.intent!=='scroll'&&(!active.touch||active.intent==='scrub'||touchMotion(active,e)!=='scroll'))pointer(e.clientX,true);active.id=null;drag.current=false;hoverX.current=null;setBubble(null);drawRef.current();}}
   onPointerCancel={()=>{clearTimeout(hold.current.timer);hold.current.id=null;drag.current=false;hoverX.current=null;setBubble(null);drawRef.current();}}
   onPointerLeave={()=>{if(!drag.current){hoverX.current=null;setBubble(null);drawRef.current();}}}
   onKeyDown={e=>{if(!onSeek)return;if(!duration&&['Enter',' '].includes(e.key)){e.preventDefault();onSeek(0);return;}const delta=e.shiftKey?30000:5000;if(['ArrowRight','ArrowLeft','Home','End'].includes(e.key)){e.preventDefault();onSeek(Math.max(0,Math.min(duration,e.key==='Home'?0:e.key==='End'?duration:position+(e.key==='ArrowRight'?delta:-delta))));}}}><canvas ref={canvas} aria-hidden="true"/></div>
  {bubble&&<span class="wave-tooltip" aria-hidden="true" style={{left:`${Math.max(.08,Math.min(.92,bubble.fraction))*100}%`}}>{bubble.title&&<strong>{bubble.title} · </strong>}{time(bubble.at)}</span>}
  {loop&&(['a','b'] as const).map(edge=><button key={edge} class="wave-loop-handle" aria-label={'Loop '+edge.toUpperCase()+' at '+time(loop[edge])} style={{left:(loop[edge]/(duration||1)*100)+'%'}} onPointerDown={event=>event.currentTarget.setPointerCapture(event.pointerId)} onPointerMove={event=>{if(!event.currentTarget.hasPointerCapture(event.pointerId))return;const rect=container.current!.getBoundingClientRect(),at=Math.max(0,Math.min(duration,(event.clientX-rect.left)/rect.width*duration));onLoopChange?.(edge==='a'?Math.min(loop.b-100,at):loop.a,edge==='b'?Math.max(loop.a+100,at):loop.b);}} onKeyDown={event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();const at=Math.max(0,Math.min(duration,loop[edge]+(event.key==='ArrowRight'?1:-1)*(event.shiftKey?5000:1000)));onLoopChange?.(edge==='a'?Math.min(loop.b-100,at):loop.a,edge==='b'?Math.max(loop.a+100,at):loop.b);}}}>{edge.toUpperCase()}</button>)}
  {moments.map(moment=><button key={moment.id} class="wave-moment" aria-label={`${moment.label||'Moment'} at ${time(moment.at_ms)}`} title={`${moment.label||'Moment'} · ${time(moment.at_ms)}`} style={{left:`${Math.max(0,Math.min(1,moment.at_ms/(duration||1)))*100}%`}} onClick={()=>onSeek?.(moment.at_ms)}><span aria-hidden="true">◆</span></button>)}
 </div>;
}
