export interface TouchPoint {clientX:number;clientY:number}
export type TouchMotion='tap'|'scrub'|'scroll';

export function touchMotion(start:TouchPoint,point:TouchPoint):TouchMotion{
 const x=Math.abs(point.clientX-start.clientX),y=Math.abs(point.clientY-start.clientY);
 if(Math.hypot(x,y)<=10)return 'tap';
 return x>y*1.5?'scrub':'scroll';
}

/** Ignore a compatibility click following a touch drag, without cancelling
 * native scrolling, pointer focus, mouse clicks or keyboard activation. */
export function installScrollClickGuard(root:Document,now=Date.now){
 let touch:({id:number;active:boolean;moved:boolean;until:number}&TouchPoint)|null=null;
 const down=(event:PointerEvent)=>{
  if(event.pointerType!=='touch'){touch=null;return;}
  if(event.isPrimary===false){if(touch)touch.moved=true;return;}
  touch={id:event.pointerId,clientX:event.clientX,clientY:event.clientY,active:true,moved:false,until:Infinity};
 };
 const move=(event:PointerEvent)=>{if(touch?.active&&touch.id===event.pointerId&&touchMotion(touch,event)!=='tap')touch.moved=true;};
 const end=(event:PointerEvent)=>{if(touch?.id!==event.pointerId)return;move(event);touch.active=false;touch.until=now()+750;if(event.type==='pointercancel')touch.moved=true;};
 const click=(event:MouseEvent)=>{if(event.detail>0&&touch?.moved&&now()<=touch.until){event.preventDefault();event.stopImmediatePropagation();}};
 const passive={capture:true,passive:true},capture={capture:true};
 root.addEventListener('pointerdown',down,passive);root.addEventListener('pointermove',move,passive);root.addEventListener('pointerup',end,passive);root.addEventListener('pointercancel',end,passive);root.addEventListener('click',click,capture);
 return()=>{root.removeEventListener('pointerdown',down,passive);root.removeEventListener('pointermove',move,passive);root.removeEventListener('pointerup',end,passive);root.removeEventListener('pointercancel',end,passive);root.removeEventListener('click',click,capture);};
}
