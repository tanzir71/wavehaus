import {test,expect,type Page} from '@playwright/test';

async function openPlayer(page:Page,dismissHint=true){
 await page.goto('app/');
 await expect(page.getByRole('heading',{name:/Good evening/})).toBeVisible();
 await page.getByRole('button',{name:'Play Afterglow (Live)',exact:true}).first().click();
 await expect.poll(()=>page.locator('#wavehaus-audio').evaluate((audio:HTMLAudioElement)=>audio.currentTime)).toBeGreaterThan(.1);
 await page.locator('#wavehaus-audio').evaluate((audio:HTMLAudioElement)=>audio.pause());
 await page.locator('.player-detail').click();
 await expect(page.locator('.now-playing h1')).toHaveText('Afterglow (Live)');
 await page.evaluate(()=>document.fonts.ready);
 if(dismissHint){await expect(page.getByRole('button',{name:'Dismiss background play hint'})).toBeVisible();await page.getByRole('button',{name:'Dismiss background play hint'}).click();}
}

async function expectDockInView(page:Page){
 expect(await page.evaluate(()=>scrollY)).toBe(0);
 const geometry=await page.locator('.now-stage').evaluate(stage=>{
  const rect=(selector:string)=>{const box=stage.querySelector(selector)!.getBoundingClientRect();return {x:box.x,y:box.y,width:box.width,height:box.height,bottom:box.bottom,right:box.right};};
  return {viewport:{width:innerWidth,height:innerHeight},stageBottom:stage.getBoundingClientRect().bottom,dock:rect('.now-dock'),art:rect('.now-art>.cover'),artSlot:rect('.now-art'),controls:rect('.now-controls'),bottom:rect('.now-bottom'),wave:rect('.waveform'),buttons:[...stage.querySelectorAll('.now-controls button,.now-bottom button,.now-bottom a')].map(button=>{const box=button.getBoundingClientRect();return {top:box.top,bottom:box.bottom,left:box.left,right:box.right};})};
 });
 expect(geometry.stageBottom).toBeLessThanOrEqual(geometry.viewport.height+.5);
 expect(geometry.dock.bottom).toBeLessThanOrEqual(geometry.viewport.height-15);
 expect(geometry.art.width).toBeCloseTo(geometry.art.height,0);
 expect(geometry.art.width).toBeGreaterThan(0);
 expect(geometry.art.width).toBeLessThanOrEqual(geometry.artSlot.width+.5);
 expect(geometry.art.height).toBeLessThanOrEqual(geometry.artSlot.height+.5);
 expect(geometry.art.bottom).toBeLessThanOrEqual(geometry.dock.y+.5);
 for(const button of geometry.buttons){expect(button.top).toBeGreaterThanOrEqual(0);expect(button.bottom).toBeLessThanOrEqual(geometry.viewport.height-15);expect(button.left).toBeGreaterThanOrEqual(0);expect(button.right).toBeLessThanOrEqual(geometry.viewport.width);}
 return geometry;
}

// Browser content excludes Android's status and system navigation bars.
for(const target of [{name:'Galaxy S 384×832, three-button navigation',width:384,height:748,wave:61},{name:'compact 360×740, three-button navigation',width:360,height:656,wave:61},{name:'tall 412×915, gesture navigation',width:412,height:855,wave:131},{name:'Galaxy S with browser toolbar',width:384,height:640,wave:61}]){
 test(`${target.name}: transport and utility controls fit without scrolling`,async({page},info)=>{
  test.skip(info.project.name!=='android','Mobile fold regression.');
  await page.setViewportSize({width:target.width,height:target.height});
  await openPlayer(page);
  const geometry=await expectDockInView(page);expect(geometry.wave.height).toBe(target.wave);
  await page.screenshot({path:info.outputPath('now-playing-fold.png')});
  await page.locator('.now-bottom').getByRole('button',{name:'Sleep timer',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Sleep timer',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'30 minutes',exact:true}).click();
  await expect(page.locator('.now-bottom').getByRole('button',{name:'Sleep timer: 30 min'})).toBeVisible();
  await expectDockInView(page);
  await page.locator('.now-bottom').getByRole('link',{name:'Queue',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Queue',exact:true})).toBeVisible();
 });
}

test('height changes, a visible setup hint and an active loop keep the dock in view',async({page},info)=>{
 test.skip(info.project.name!=='android','Mobile fold regression.');
 await page.setViewportSize({width:412,height:855});await openPlayer(page,false);
 await expect(page.getByRole('complementary',{name:'Background play setup'})).toBeVisible();
 await page.locator('.listening-extras').getByRole('button',{name:'Set A',exact:true}).click();
 const slider=page.locator('.now-progress .wave-hit');await slider.focus();await slider.press('ArrowRight');
 await page.locator('.listening-extras').getByRole('button',{name:'Set B',exact:true}).click();
 await page.evaluate(()=>scrollTo(0,0));
 await expect(page.locator('.now-loop-status')).toContainText('Loop A–B');
 for(const viewport of [{width:384,height:748},{width:360,height:656},{width:412,height:855}]){await page.setViewportSize(viewport);await expectDockInView(page);}
 await page.getByRole('button',{name:'Dismiss background play hint'}).click();
 const withArt=await expectDockInView(page);expect(withArt.wave.height).toBe(131);
 await page.screenshot({path:info.outputPath('now-playing-loop.png')});
 await slider.focus();await slider.press('Home');await slider.press('ArrowRight');await expect(slider).toHaveAttribute('aria-valuenow','5');
 await expect(slider).toBeFocused();
});
