import { test,expect } from '@playwright/test';
import { resolve } from 'node:path';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { largeFlac } from '../../scripts/large-flac.mjs';
const base=process.env.AUTH_BASE_URL;
test.skip(!base,'Runs against the disposable PHP/Worker store.');
async function signIn(page:import('@playwright/test').Page,label:string){await page.goto(base+'/');await page.getByLabel('Username',{exact:true}).fill('contract_tester');await page.getByLabel('Password',{exact:true}).fill('Final contract passphrase 2026!');await page.getByLabel('Device name',{exact:true}).fill(label);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('heading',{name:/Make room|Good evening/})).toBeVisible();}
test('real browser parses tags, folder artwork and lyrics, then another device syncs the private result',async({page,browser},info)=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await signIn(page,'Upload UI '+info.project.name);
 const second=await browser.newContext(),other=await second.newPage();await signIn(other,'Library sync '+info.project.name);const started=Date.now();
 await page.goto(base+'/upload');const input=page.getByTestId('upload-files'),dir='tests/fixtures/library/Fixture Artist/Tagged Album/';
 // Each project uses a different fixture so concurrent tests don't skip it.
 const filename=info.project.name==='android'?'01 - Glass Tone.flac':'02 - Glass Tone.wav';
 await input.setInputFiles([resolve(dir+filename),resolve(dir+'cover.png'),...info.project.name==='android'?[resolve(dir+'01 - Glass Tone.lrc')]:[]]);
 const item=page.getByTestId('upload-item').filter({hasText:filename});await expect(item.getByRole('status')).toHaveText(/^Done/,{timeout:120000});
 await page.getByRole('link',{name:`Open album for ${filename}`}).click();await expect(page.getByRole('heading',{name:'Tagged Album'})).toBeVisible();await expect(page.getByText('Private',{exact:true}).first()).toBeVisible();
 await other.evaluate(()=>dispatchEvent(new Event('focus')));await expect(other.getByText('Tagged Album',{exact:true}).first()).toBeVisible({timeout:60000});expect(Date.now()-started).toBeLessThan(60000);
 const result=await page.evaluate(async base=>{const data=await (await fetch(base+'/api/library?since=0')).json();return {tracks:data.items.tracks,albums:data.items.albums};},base!);const track=result.tracks.find((t:any)=>t.original_name===filename);expect(track).toMatchObject({title:'Glass Tone',artist_name:'Fixture Artist',visibility:'private'});if(info.project.name==='android')expect(track.lyrics).toContain('[00:01.00]');expect(result.albums.find((a:any)=>a.id===track.album_id).art_source).toBe('folder');
 await page.screenshot({path:info.outputPath('server-upload-album.png'),fullPage:true});expect(errors).toEqual([]);await second.close();
});
test('300 MB FLAC upload survives a throttled reload without resending confirmed chunks',async({page,browser},info)=>{
 test.skip(info.project.name!=='android'||process.env.RUN_LARGE_UPLOAD!=='1','Large-file acceptance is opt-in, Android viewport only.');test.setTimeout(600000);
 const fixture=await largeFlac();await signIn(page,'Large upload');await page.goto(base+'/upload');const cdp=await page.context().newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:40,downloadThroughput:20*1024**2,uploadThroughput:2*1024**2});
 const firstPart=page.waitForResponse(response=>/\/api\/uploads\/[^/]+\/parts\/\d+$/.test(new URL(response.url()).pathname)&&response.status()===200,{timeout:120000});await page.getByTestId('upload-files').setInputFiles(fixture);const received=await firstPart,uploadId=received.url().match(/uploads\/([^/]+)/)![1];
 const before=await page.evaluate(async({base,uploadId})=>(await fetch(`${base}/api/uploads/${uploadId}`)).json(),{base:base!,uploadId});expect(before.partsReceived.length).toBeGreaterThan(0);const resumed=page.waitForResponse(response=>new URL(response.url()).pathname.endsWith(`/api/uploads/${uploadId}`)&&response.request().method()==='GET');
 const sentAfterReload:number[]=[];await page.reload();page.on('request',request=>{const match=request.url().match(/\/parts\/(\d+)$/);if(match)sentAfterReload.push(Number(match[1]));});const resume=await (await resumed).json();expect(resume.partsReceived.length).toBeGreaterThanOrEqual(before.partsReceived.length);
 await expect(page.getByTestId('upload-item').getByRole('status')).toHaveText(/^Done/,{timeout:420000});for(const n of before.partsReceived)expect(sentAfterReload).not.toContain(n);
 const second=await browser.newContext(),other=await second.newPage();await signIn(other,'Large sync device');const library=await other.evaluate(async base=>(await (await fetch(base+'/api/library?since=0')).json()).items,base!);const tracks=library.tracks.filter((track:any)=>track.original_name==='300MB-original-tone.flac');expect(tracks).toHaveLength(1);const hash=createHash('sha256');for await(const chunk of createReadStream(fixture))hash.update(chunk);expect(tracks[0]).toMatchObject({size_bytes:300*1024**2,sha256:hash.digest('hex'),visibility:'private',peaks:null});
 await page.screenshot({path:info.outputPath('large-upload-resumed.png'),fullPage:true});await second.close();
});
