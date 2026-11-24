import {expect,it} from 'vitest';
import {touchMotion,installScrollClickGuard} from '../../app/src/ui/touch-intent';

it.each([[0,0,'tap'],[6,6,'tap'],[30,2,'scrub'],[-30,-2,'scrub'],[2,30,'scroll'],[-2,-30,'scroll'],[12,12,'scroll']])('distinguishes touch intent at %s/%s',(clientX,clientY,intent)=>{
 expect(touchMotion({clientX:0,clientY:0},{clientX:Number(clientX),clientY:Number(clientY)})).toBe(intent);
});
function fixture(){const root=new EventTarget();let now=0;const dispose=installScrollClickGuard(root as unknown as Document,()=>now);return{dispose,advance:()=>now+=1000,send:(type:string,props:Record<string,unknown>={})=>{const event=new Event(type,{cancelable:true});Object.assign(event,{pointerId:1,pointerType:'touch',isPrimary:true,clientX:0,clientY:0,...props});root.dispatchEvent(event);return event;}};}
it('rejects a click following a touch pan, while the next intentional tap is accepted',()=>{
 const f=fixture();f.send('pointerdown');f.send('pointermove',{clientY:40});f.send('pointerup',{clientY:40});expect(f.send('click',{detail:1}).defaultPrevented).toBe(true);
 f.send('pointerdown');f.send('pointerup');expect(f.send('click',{detail:1}).defaultPrevented).toBe(false);f.dispose();
});
it('preserves keyboard activation, later mouse clicks and clicks after the compatibility window',()=>{
 const f=fixture();f.send('pointerdown');f.send('pointercancel');expect(f.send('click',{detail:0}).defaultPrevented).toBe(false);f.advance();expect(f.send('click',{detail:1}).defaultPrevented).toBe(false);
 f.send('pointerdown');f.send('pointercancel');f.send('pointerdown',{pointerType:'mouse'});expect(f.send('click',{detail:1}).defaultPrevented).toBe(false);f.dispose();
});
it('does not leave global click suppression installed after disposal',()=>{
 const f=fixture();f.send('pointerdown');f.send('pointercancel');f.dispose();expect(f.send('click',{detail:1}).defaultPrevented).toBe(false);
});
