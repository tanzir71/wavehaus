import {test,expect,type Page,type Locator} from '@playwright/test';

async function touch(page:Page,target:Locator,dx:number,dy:number){
 await target.evaluate(element=>element.scrollIntoView({block:'center'}));const box=await target.boundingBox();expect(box).not.toBeNull();
 const x=box!.x+box!.width*.3,y=box!.y+box!.height/2,session=await page.context().newCDPSession(page);
 const point=(x:number,y:number)=>[{x,y,id:1,radiusX:1,radiusY:1,force:1}];
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:point(x,y)});
 for(let step=1;step<=8;step++){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:point(x+dx*step/8,y+dy*step/8)});await page.waitForTimeout(16);}
 await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await session.detach();
}
async function pausedHome(page:Page){
 await page.goto('app/');await expect(page.getByRole('heading',{name:/Good evening/})).toBeVisible();
 await page.getByRole('button',{name:'Play Afterglow (Live)',exact:true}).first().click();
 await expect.poll(()=>page.locator('#wavehaus-audio').evaluate((a:HTMLAudioElement)=>a.currentTime)).toBeGreaterThan(.1);
 await page.locator('#wavehaus-audio').evaluate((a:HTMLAudioElement)=>a.pause());
}
test('vertical swipes over listening waveforms scroll without switching or starting music',async({page},info)=>{
 test.skip(info.project.name!=='android','Real touch input is covered by the Android project.');await pausedHome(page);
 for(const dy of [-140,140]){
  // Choose a wave with room to scroll in the tested direction.
  const waveform=page.locator(dy<0?'.resume-card .wave-hit':'.fresh-card .wave-hit').first();
  await waveform.evaluate(element=>element.scrollIntoView({block:'center'}));const before=await page.locator('#wavehaus-audio').evaluate((a:HTMLAudioElement)=>({src:a.src,time:a.currentTime})),scroll=await page.locator('.app-body').evaluate(element=>element.scrollTop);
  await touch(page,waveform,2,dy);
  expect(await page.locator('#wavehaus-audio').evaluate((a:HTMLAudioElement)=>({src:a.src,time:a.currentTime,paused:a.paused}))).toEqual({...before,paused:true});
  await expect.poll(()=>page.locator('.app-body').evaluate(element=>element.scrollTop)).not.toBe(scroll);
 }
});
test('a touch tap waits for release; horizontal scrubbing and keyboard seeking still work',async({page},info)=>{
 test.skip(info.project.name!=='android','Real touch input is covered by the Android project.');await pausedHome(page);
 const waveform=page.locator('.fresh-card .wave-hit').first();await waveform.evaluate(element=>element.scrollIntoView({block:'center'}));const box=await waveform.boundingBox(),session=await page.context().newCDPSession(page);
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box!.x+box!.width*.4,y:box!.y+box!.height/2,id:1}]});
 expect(await page.locator('#wavehaus-audio').evaluate((a:HTMLAudioElement)=>a.paused)).toBe(true);
 await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await session.detach();
 await expect.poll(()=>page.locator('#wavehaus-audio').evaluate((a:HTMLAudioElement)=>!a.paused&&a.currentTime>1)).toBe(true);
 await page.locator('.player-detail').click();await page.locator('#wavehaus-audio').evaluate((a:HTMLAudioElement)=>a.pause());
 const current=page.locator('.now-playing .wave-hit[role=slider]'),duration=await page.locator('#wavehaus-audio').evaluate((a:HTMLAudioElement)=>a.duration);
 await touch(page,current,(await current.boundingBox())!.width*.4,1);
 await expect.poll(()=>page.locator('#wavehaus-audio').evaluate((a:HTMLAudioElement)=>a.currentTime)).toBeGreaterThan(duration*.6);
 await current.focus();await current.press('Home');await current.press('ArrowRight');await expect(current).toHaveAttribute('aria-valuenow','5');
 const before=await page.locator('#wavehaus-audio').evaluate((a:HTMLAudioElement)=>a.currentTime),rect=await current.boundingBox(),hold=await page.context().newCDPSession(page);
 await hold.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rect!.x+rect!.width*.4,y:rect!.y+rect!.height/2,id:1}]});
 await expect(page.getByRole('dialog',{name:'Save moment',exact:true})).toBeVisible({timeout:3000});await hold.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await hold.detach();
 expect(await page.locator('#wavehaus-audio').evaluate((a:HTMLAudioElement)=>a.currentTime)).toBe(before);
});
test('scrolling song rows does not activate them and a deliberate tap still plays',async({page},info)=>{
 test.skip(info.project.name!=='android','Real touch input is covered by the Android project.');await pausedHome(page);
 await page.locator('a[href*="/album/"]').filter({hasText:'Glass Rooms'}).first().click();const name=page.locator('.track-name').first();
 const before=await page.locator('#wavehaus-audio').evaluate((a:HTMLAudioElement)=>a.src);await touch(page,name,1,-120);
 expect(await page.locator('#wavehaus-audio').evaluate((a:HTMLAudioElement)=>a.src)).toBe(before);expect(await page.locator('#wavehaus-audio').evaluate((a:HTMLAudioElement)=>a.paused)).toBe(true);
 await name.scrollIntoViewIfNeeded();await name.tap();await expect.poll(()=>page.locator('#wavehaus-audio').evaluate((a:HTMLAudioElement)=>!a.paused)).toBe(true);
});
test('mouse pressing a waveform still seeks immediately',async({page},info)=>{
 test.skip(info.project.name!=='desktop','Mouse behavior is covered by the desktop project.');await pausedHome(page);const waveform=page.locator('.fresh-card .wave-hit').first();await waveform.scrollIntoViewIfNeeded();const box=await waveform.boundingBox();await page.mouse.move(box!.x+box!.width*.5,box!.y+box!.height/2);await page.mouse.down();
 await expect.poll(()=>page.locator('#wavehaus-audio').evaluate((a:HTMLAudioElement)=>!a.paused)).toBe(true);await page.mouse.up();
});
