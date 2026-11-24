// Run before and after the density pass against the same Pages build/Chromium.
// Baselines are local artifacts, not platform-dependent snapshots in CI.
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const capture = process.argv.includes('--baseline');
const root = resolve('.work/density');
const base = process.env.DENSITY_URL || 'http://127.0.0.1:54173/wavehaus/app/';
const browser = await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || undefined,args:['--disable-gpu']});
const results = [];
try {
  for (const viewport of [{width:412,height:915},{width:900,height:1100},{width:1440,height:900}]) {
    const dir = `${root}/${viewport.width}`;
    await mkdir(dir, {recursive:true});
    const context = await browser.newContext({viewport, deviceScaleFactor:1});
    const page = await context.newPage();
    if(process.env.DENSITY_ENTRY_FILE){
      const html=await readFile(process.env.DENSITY_ENTRY_FILE,'utf8');
      await page.route(base,route=>route.fulfill({status:200,contentType:'text/html',body:html}));
    }
    // Freeze dates, UUIDs and device hints so independently seeded libraries match.
    await page.addInitScript(() => {
      Date.now = () => 1795521600000;
      let id = 0;
      crypto.randomUUID = () => `00000000-0000-4000-8000-${String(++id).padStart(12,'0')}`;
      let random=123456789;
      crypto.getRandomValues = array => {
        const bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);
        for(let i=0;i<bytes.length;i++){random^=random<<13;random^=random>>>17;random^=random<<5;bytes[i]=random&255;}
        return array;
      };
      localStorage.setItem('wh-bg-dismissed', String(Date.now()));
    });
    await page.goto(base);
    await page.getByRole('heading',{name:/Good evening/}).waitFor({timeout:120000});
    await page.locator('.album-card').first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    const navigate=async url=>page.evaluate(url=>{
      history.pushState({},'',url);dispatchEvent(new PopStateEvent('popstate'));scrollTo(0,0);
    },url);
    const album = await page.locator('.fresh-card a').first().getAttribute('href');
    const routes = [['home',base],['album',new URL(album,base).href],['upload',base+'upload'],['bulk',base+'bulk-edit'],['access',base+'settings/access'],['assistants',base+'settings/assistants'],['now',base+'now-playing']];
    for (const [name,url] of routes) {
      console.log(`Capturing ${viewport.width} ${name}`);
      if(name==='bulk'){
        await navigate(new URL(album,base).href);
        const select=page.locator('.track-select input').first();
        await select.waitFor({state:'attached',timeout:120000});
        // Mobile normally enters selection through a long press; retain its layout.
        await select.evaluate(el=>el.click());
      }
      await navigate(url);
      await page.locator(name==='home'?'.resume-card':name==='album'?'.track-row':name==='upload'?'.drop-zone':name==='bulk'?'.bulk-panel':name==='access'?'.access-modes':name==='assistants'?'.assistant-methods':'.now-playing').first().waitFor({timeout:120000});
      await page.evaluate(() => document.fonts.ready);
      if(name==='access') await page.locator('.member-info').first().waitFor();
      // Let generated cover images and recommendation-worker output settle.
      await page.evaluate(async () => {
        for (const img of document.images) img.loading='eager';
        await Promise.all([...document.images].map(img => img.decode().catch(()=>{})));
      });
      const targets = viewport.width<1100 ? [['page',page]] : name==='home' ? [['player',page.locator('.player')],['resume',page.locator('.resume-card')]] : name==='now' ? [['now',page.locator('.now-playing')]] : [];
      await page.screenshot({path:`${dir}/${name}-${capture?'before':'after'}.png`,fullPage:true,animations:'disabled'});
      for (const [part,target] of targets) {
        // The sidebar gives Home more width; compare its unchanged internals at v1 width.
        if (viewport.width>=1100 && (part==='resume'||part==='now')) await target.evaluate((el,part) => {
          Object.assign(el.style,{position:'absolute',top:'0',left:'0',zIndex:'100',margin:'0',width:part==='resume'?'1096px':'520px'});
        },part);
        const bytes = await target.screenshot({animations:'disabled',...(part==='page'?{fullPage:true}:{style:'.sidebar,.topbar,.demo-banner,.selection-bar{visibility:hidden!important} main>*:not(.resume-card):not(.now-playing){visibility:hidden!important} .now-playing{background:var(--wh-bg-base)} body:has(.now-playing) .player{visibility:hidden!important}'})});
        const path = `${dir}/${name}-${part}`;
        if (capture) await writeFile(path+'-v1.png',bytes);
        else {
          await writeFile(path+'-v1.1.png',bytes);
          const before = await sharp(await readFile(path+'-v1.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
          const after = await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
          const identical = before.info.width===after.info.width && before.info.height===after.info.height && before.data.equals(after.data);
          results.push({viewport:viewport.width,name,part,identical});
          console.log(`${identical?'PASS':'FAIL'} ${viewport.width} ${name} ${part}`);
        }
      }
    }
    await context.close();
  }
} finally { await browser.close(); }
if (!capture) {
  await writeFile(root+'/results.json',JSON.stringify(results,null,2)+'\n');
  if (results.some(row=>!row.identical)) process.exitCode=1;
}
