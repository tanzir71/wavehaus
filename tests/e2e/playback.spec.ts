import { test,expect } from '@playwright/test';
import { wav } from '../../scripts/make-chime.mjs';
import { resolve } from 'node:path';

test('an unsupported codec skips to the next manually queued track',async({page})=>{
 await page.goto('app/upload');await expect(page.getByRole('heading',{name:'Upload',exact:true})).toBeVisible({timeout:120000});
 test.skip(await page.locator('audio').evaluate((a:HTMLAudioElement)=>a.canPlayType('audio/mp4; codecs="alac"')!==''),'This browser advertises ALAC playback; the unsupported-format case does not apply.');
 await page.getByTestId('upload-files').setInputFiles([resolve('tests/fixtures/library/Fixture Artist/Tagged Album/06 - Glass Tone ALAC.m4a'),resolve('tests/fixtures/library/Fixture Artist/Tagged Album/02 - Glass Tone.wav')]);await expect(page.getByRole('status').filter({hasText:/^Done/})).toHaveCount(2);await page.getByRole('link',{name:'Open album for 06 - Glass Tone ALAC.m4a',exact:true}).click();
 await page.getByRole('button',{name:'Add Glass Tone ALAC to queue',exact:true}).click();await page.getByRole('button',{name:'Add Glass Tone to queue',exact:true}).click();await page.getByRole('link',{name:/Now playing/}).click();await page.getByRole('button',{name:'Next track',exact:true}).click();await expect(page.getByRole('heading',{name:'Glass Tone',exact:true})).toBeVisible();await expect.poll(()=>page.locator('audio').evaluate((a:HTMLAudioElement)=>a.currentTime)).toBeGreaterThan(.1);
});

test('album context, a reordered manual queue, paused restore and end-of-track sleep',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('app/');await expect(page.getByRole('heading',{name:/Good evening/})).toBeVisible({timeout:120000});
 await page.locator('a[href*="/album/"]').filter({hasText:'Glass Rooms'}).first().click();await expect(page.getByRole('heading',{name:'Glass Rooms',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Play Glass Rooms',exact:true}).click();await expect.poll(()=>page.locator('audio').evaluate((a:HTMLAudioElement)=>a.currentTime)).toBeGreaterThan(.2);
 await page.getByRole('button',{name:'Add Afterglow (Live) to queue'}).click();await page.getByRole('button',{name:'Add Still Here to queue'}).click();
 const player=page.getByRole('complementary',{name:'Music player'});await player.getByRole('button',{name:/Pause/}).filter({visible:true}).first().click();const slider=player.getByRole('slider',{name:'Playback position'});await slider.focus();await slider.press('ArrowRight');
 const position=await slider.getAttribute('aria-valuenow');expect(Number(position)).toBeGreaterThanOrEqual(5);
 await page.goto('app/queue');await page.getByRole('button',{name:'Edit',exact:true}).click();await page.getByRole('button',{name:'Move Still Here up'}).click();await expect(page.locator('.queue-list').first().locator('.queue-track strong')).toHaveText(['Still Here','Afterglow (Live)']);
 const mediaRequests:string[]=[];page.on('request',r=>{if(/\/demo-media\//.test(r.url()))mediaRequests.push(r.url());});await page.reload();await expect(page.getByRole('heading',{name:'Queue',exact:true})).toBeVisible();await expect(page.locator('.queue-list').first().locator('.queue-track strong')).toHaveText(['Still Here','Afterglow (Live)']);await expect(page.getByRole('heading',{name:'Next from: Glass Rooms'})).toBeVisible();
 const restored=page.locator('.queue-current').getByRole('slider',{name:'Playback position'});await expect(restored).toHaveAttribute('aria-valuenow',position!);
 // Verify the idle five-second save does not replace the pending restored seek.
 await page.waitForTimeout(5500);await expect(restored).toHaveAttribute('aria-valuenow',position!);expect(mediaRequests).toEqual([]);expect(await page.locator('audio').evaluate((a:HTMLAudioElement)=>a.paused)).toBe(true);
 const controls=page.locator('.queue-controls');await controls.getByRole('button',{name:'Repeat: off'}).click();await controls.getByRole('button',{name:'Repeat: all'}).click();await controls.getByRole('button',{name:'Sleep timer',exact:true}).click();await page.getByRole('button',{name:'End of track',exact:true}).click();
 await page.locator('.queue-current').getByRole('button',{name:'Play music'}).click();await page.locator('audio').evaluate((a:HTMLAudioElement)=>{a.playbackRate=16;});await expect.poll(()=>page.locator('audio').evaluate((a:HTMLAudioElement)=>a.ended&&a.paused),{timeout:15000}).toBe(true);
 await expect(page.locator('.queue-current strong')).toHaveText('Glass Rooms');await expect(page.locator('.queue-list').first().locator('.queue-track strong')).toHaveText(['Still Here','Afterglow (Live)']);await page.screenshot({path:info.outputPath('restored-queue.png'),fullPage:true});expect(errors).toEqual([]);
});

test('twenty original tracks advance on the same element with a prepared next URL',async({page},info)=>{
 test.setTimeout(120000);await page.goto('app/upload');await expect(page.getByRole('heading',{name:'Upload',exact:true})).toBeVisible({timeout:120000});
 const files=Array.from({length:20},(_,i)=>{const samples=new Float32Array(16000);for(let j=0;j<samples.length;j++)samples[j]=Math.sin(j*2*Math.PI*(220+i*7)/16000)*.01;return {name:`${String(i+1).padStart(2,'0')} - Advance Artist - Step ${String(i+1).padStart(2,'0')}.wav`,mimeType:'audio/wav',buffer:wav(samples)};});await page.getByTestId('upload-files').setInputFiles(files);await expect(page.getByRole('status').filter({hasText:/^Done/})).toHaveCount(20,{timeout:90000});await page.getByRole('link',{name:`Open album for ${files[0].name}`,exact:true}).click();
 await page.evaluate(()=>{
  const a=document.querySelector('audio')!,probe={sources:[] as string[],gaps:[] as number[],ended:0};(window as Window&{playbackProbe?:typeof probe}).playbackProbe=probe;
  a.addEventListener('ended',()=>{probe.ended=performance.now();},{capture:true});a.addEventListener('playing',()=>{if(probe.ended){probe.gaps.push(performance.now()-probe.ended);probe.ended=0;}probe.sources.push(a.src);if(probe.sources.length>=20)a.pause();});a.playbackRate=16;
 });await page.getByRole('button',{name:'Play Step 01',exact:true}).first().click();
 await expect.poll(()=>page.evaluate(()=>(window as Window&{playbackProbe?:{sources:string[]}}).playbackProbe?.sources.length),{timeout:45000}).toBe(20);
 const probe=await page.evaluate(()=>(window as Window&{playbackProbe?:{sources:string[];gaps:number[]}}).playbackProbe!);expect(new Set(probe.sources).size).toBe(20);expect(probe.gaps).toHaveLength(19);expect(Math.max(...probe.gaps)).toBeLessThan(300);expect(await page.locator('audio').count()).toBe(1);
 await info.attach('twenty-track-advance',{body:JSON.stringify({viewport:info.project.name,maxGapMs:Math.max(...probe.gaps),gaps:probe.gaps},null,2),contentType:'application/json'});
});
