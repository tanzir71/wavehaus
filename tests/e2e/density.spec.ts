import {expect,test,type Locator} from '@playwright/test';

async function size(locator:Locator,width:number|undefined,height:number){
  const box=await locator.boundingBox();
  expect(box).not.toBeNull();
  if(width!==undefined)expect(box!.width).toBeCloseTo(width,0);
  expect(box!.height).toBeCloseTo(height,0);
}

test('desktop density starts at 1100 and keeps listening controls spacious',async({page},info)=>{
  test.skip(info.project.name!=='desktop','Desktop breakpoint checks.');
  await page.goto('app/');
  await expect(page.getByRole('heading',{name:/Good evening/})).toBeVisible({timeout:120000});
  for(const width of [1100,1280,1440]){
    await page.setViewportSize({width,height:900});
    await size(page.locator('.sidebar'),232,812);
    await size(page.locator('.sidebar nav a').first(),undefined,32);
    await size(page.locator('.upload-button'),undefined,32);
    await size(page.locator('.top-search'),320,36);
    await size(page.locator('.topbar-history .icon-button').first(),28,28);
    await size(page.locator('.player'),width,88);
    await size(page.locator('.resume-card .play-button'),48,48);
    await size(page.locator('.resume-card .wave-hero'),undefined,108);
    await size(page.locator('.quick-tiles>a').first(),undefined,48);
    expect(await page.locator('.quick-tiles').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(4);
    expect(await page.locator('.mix-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(6);
    await expect(page.locator('.home-heading h1')).toHaveCSS('font-size','28px');
    await expect(page.locator('.section-heading h2').first()).toHaveCSS('font-size','20px');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`home-${width}.png`),fullPage:true});
  }
  await page.setViewportSize({width:1100,height:900});
  await page.locator('.fresh-card a').first().click();
  await expect(page.locator('.collection-heading')).toBeVisible();
  await size(page.locator('.collection-heading>.cover'),220,220);
  await size(page.locator('.collection-heading .play-button'),48,48);
  await size(page.locator('.track-row').first(),undefined,44);
  await size(page.locator('.track-art').first(),32,32);
  await expect(page.locator('.track-row .icon-button').first()).toHaveCSS('height','28px');
  await page.locator('.track-select input').first().check();
  await page.goto('app/bulk-edit');
  await expect(page.locator('.bulk-panel')).toBeVisible();
  expect((await page.locator('.bulk-panel').boundingBox())!.width).toBe(340);
  await size(page.locator('.bulk-preview li').first(),undefined,42);
  await size(page.locator('.bulk-table-header'),undefined,30);
  await size(page.locator('.edit-fields input').first(),undefined,32);
  for(const section of ['access','assistants']){
    await page.goto('app/settings/'+section);
    await expect(page.locator(section==='access'?'.access-modes':'.assistant-methods')).toBeVisible();
    expect((await page.locator('.settings-nav').boundingBox())!.width).toBe(210);
    await size(page.locator('.settings-nav>a').first(),210,34);
    if(section==='assistants'){
      const cards=await page.locator('.assistant-methods>article').all();
      const heights=await Promise.all(cards.map(async card=>(await card.boundingBox())!.height));
      expect(heights[0]).toBe(heights[1]);
      const prompt=page.locator('.assistant-prompt');
      expect(await prompt.evaluate(el=>el.scrollHeight<=el.clientHeight)).toBe(true);
      await prompt.locator('p').evaluate(el=>{el.textContent=Array(12).fill(el.textContent).join(' ');});
      expect(await prompt.evaluate(el=>el.scrollHeight<=el.clientHeight)).toBe(true);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.goto('app/upload');
  await expect(page.locator('.drop-zone')).toHaveCSS('padding','24px');
  await expect(page.locator('.drop-zone h2')).toHaveCSS('font-size','15px');
  await page.getByTestId('upload-files').focus();
  await expect(page.getByTestId('upload-files')).toBeFocused();
});

test('mobile and tablet keep v1 chrome and touch controls',async({page},info)=>{
  await page.goto('app/');
  await expect(page.getByRole('heading',{name:/Good evening/})).toBeVisible({timeout:120000});
  if(info.project.name==='android'){
    await expect(page.locator('.sidebar')).toBeHidden();
    await size(page.locator('.resume-card .wave-hero'),undefined,61);
    await expect(page.locator('.home-heading h1')).toHaveCSS('font-size','28px');
  }else{
    await page.setViewportSize({width:900,height:1100});
    await size(page.locator('.sidebar'),72,1012);
    await size(page.locator('.sidebar nav a').first(),48,48);
    await expect(page.locator('.home-heading h1')).toHaveCSS('font-size','40px');
    await size(page.locator('.topbar'),undefined,76);
    await size(page.locator('.resume-card .wave-hero'),undefined,108);
    await size(page.locator('.player'),900,88);
  }
  await page.screenshot({path:info.outputPath('unchanged-layout.png'),fullPage:true});
});
