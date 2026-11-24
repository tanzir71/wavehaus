import {test,expect,type APIRequestContext,type Page} from '@playwright/test';
import {createHash} from 'node:crypto';
import {wav} from '../../scripts/make-chime.mjs';
const base=process.env.AUTH_BASE_URL!;
const username='library_owner',password='Library management regression 2026!';
test.skip(!base,'Runs against a disposable PHP/Worker store.');
test.describe.configure({mode:'serial'});
async function request(client:APIRequestContext,path:string,data?:unknown,method='POST'){
 const response=await client.fetch(base+path,{method,headers:{'X-Wavehaus':'1'},...data===undefined?{}:{data}});
 expect(response.ok(),`${method} ${path}: ${await response.text()}`).toBeTruthy();return response.json();
}
async function login(page:Page){await page.goto(base+'/sign-in');await page.getByLabel('Username',{exact:true}).fill(username);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.locator('.app-body')).toBeVisible();}
function audio(seed:number){return Buffer.from(wav(Float32Array.from({length:16000*4},(_,i)=>.08*Math.sin(i*(.08+seed*.01)))));}
async function upload(client:APIRequestContext,title:string,visibility='private'){
 const bytes=audio(Math.random()),start=await request(client,'/api/uploads',{filename:title+'.wav',size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
 const part=await client.put(`${base}/api/uploads/${start.uploadId}/parts/1`,{headers:{'X-Wavehaus':'1','Content-Type':'application/octet-stream'},data:bytes});expect(part.ok()).toBeTruthy();
 return request(client,`/api/uploads/${start.uploadId}/complete`,{metadata:{title,artist:'Test artist',durationMs:4000},album:{title,artistName:'Test artist'},visibility});
}
test.beforeAll(async({request:client})=>{const health=await(await client.get(base+'/api/health')).json();if(health.needsSetup)await request(client,'/api/setup',{username,password,deviceLabel:'Regression owner',serverName:'Regression library'});});
test('deletes an uploaded album through the visible bulk editor and can undo it',async({page})=>{
 await login(page);const added=await upload(page.request,'Delete fixture');await page.goto(base+'/album/'+added.album.id);await page.getByRole('button',{name:'Edit tracks',exact:true}).click();
 // An artwork choice must not trigger a second mutation after deletion.
 await page.getByTestId('art-file').setInputFiles('tests/fixtures/library/Fixture Artist/Tagged Album/cover.png');await page.getByRole('button',{name:'Delete',exact:true}).click();await page.getByTestId('bulk-apply').click();await expect(page).toHaveURL(base+'/library');
 const delta=await request(page.request,'/api/library?since=0',undefined,'GET');expect(delta.items.tracks.find((track:any)=>track.id===added.track.id).deleted).toBe(1);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(async()=>{const data=await request(page.request,'/api/library?since=0',undefined,'GET');return data.items.tracks.find((track:any)=>track.id===added.track.id)?.deleted;}).toBe(0);
});
test('guests browse and play public music while private and account data stay protected',async({page,browser})=>{
 await login(page);const shared=await upload(page.request,'Public listening fixture','public'),privateSong=await upload(page.request,'Secret listening fixture');
 const guest=await browser.newContext(),visitor=await guest.newPage();await visitor.goto(base+'/');await expect(visitor.locator('.app-body')).toBeVisible();await expect(visitor.getByRole('link',{name:'Sign in',exact:true}).first()).toBeVisible();
 const data=await request(guest.request,'/api/library?since=0',undefined,'GET');expect(data.items.tracks.some((track:any)=>track.id===shared.track.id)).toBe(true);expect(data.items.tracks.some((track:any)=>track.id===privateSong.track.id)).toBe(false);expect(data.items.likes).toEqual([]);expect(data.items.moments).toEqual([]);
 for(const path of ['/api/auth/me','/api/changes','/api/player-state','/api/admin/settings'])expect((await guest.request.get(base+path)).status()).toBe(401);
 expect((await guest.request.patch(base+'/api/tracks',{headers:{'X-Wavehaus':'1'},data:{ids:[shared.track.id],set:{title:'Forbidden'}}})).status()).toBe(401);
 expect((await guest.request.get(base+'/media/'+privateSong.track.id)).status()).toBe(403);expect((await guest.request.get(base+'/media/'+shared.track.id,{headers:{Range:'bytes=0-31'}})).status()).toBe(206);
 await visitor.goto(base+'/album/'+shared.album.id);await visitor.getByRole('button',{name:'Play Public listening fixture',exact:true}).first().click();await expect.poll(()=>visitor.locator('#wavehaus-audio').evaluate((audio:HTMLAudioElement)=>audio.currentTime)).toBeGreaterThan(.1);
 await request(page.request,'/api/visibility',{targets:[{type:'track',id:shared.track.id}],visibility:'private'});await visitor.evaluate(()=>dispatchEvent(new Event('focus')));await expect(visitor.getByTestId('track-row-'+shared.track.id)).toHaveCount(0);expect((await guest.request.get(base+'/media/'+shared.track.id)).status()).toBe(403);
 await guest.close();
});
test('guest autoplay advances across a simulated background lifecycle and mobile controls keep their spacing',async({page,browser},info)=>{
 await login(page);const first=await upload(page.request,'Background first '+info.project.name,'public');await upload(page.request,'Background next '+info.project.name,'public');
 const guest=await browser.newContext({viewport:{width:390,height:844},isMobile:info.project.name==='android',hasTouch:info.project.name==='android',userAgent:await page.evaluate(()=>navigator.userAgent)}),visitor=await guest.newPage();
 try{
  await visitor.goto(base+'/');
  for(const width of [360,390,412]){
   await visitor.setViewportSize({width,height:844});const signIn=visitor.locator('.home-greeting').getByRole('link',{name:'Sign in',exact:true});await expect(signIn).toBeVisible();
   expect(await signIn.evaluate(element=>{const range=document.createRange();range.selectNodeContents(element);return range.getClientRects().length;})).toBe(1);
   expect(await visitor.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await visitor.setViewportSize({width:390,height:844});await visitor.screenshot({path:info.outputPath('guest-sign-in.png')});
  await visitor.goto(base+'/album/'+first.album.id);await visitor.locator('#wavehaus-audio').evaluate((a:HTMLAudioElement)=>{a.playbackRate=.25;});
  await visitor.getByRole('button',{name:'Play '+first.track.title,exact:true}).first().click();await expect.poll(()=>visitor.locator('#wavehaus-audio').evaluate((a:HTMLAudioElement)=>a.currentTime)).toBeGreaterThan(.1);
  await visitor.locator('.player-detail').click();await expect(visitor.locator('.now-playing h1')).toHaveText(first.track.title);
  const bottom=visitor.locator('.now-bottom'),extras=visitor.locator('.listening-extras');await expect(extras).toBeVisible();
  const bottomBox=await bottom.boundingBox(),extraBox=await extras.boundingBox();expect(extraBox!.y-(bottomBox!.y+bottomBox!.height)).toBeGreaterThanOrEqual(16);
  await bottom.scrollIntoViewIfNeeded();await visitor.screenshot({path:info.outputPath('now-playing-actions.png')});
  const nativePreload=info.project.name==='android';
  if(nativePreload)await expect.poll(()=>visitor.locator('#wavehaus-preload').evaluate((a:HTMLAudioElement)=>a.readyState),{timeout:10000}).toBeGreaterThanOrEqual(3);
  await visitor.locator('#wavehaus-audio').evaluate((a:HTMLAudioElement)=>{(window as Window&{originalAudios?:HTMLAudioElement[]}).originalAudios=Array.from(document.querySelectorAll('audio'));a.currentTime=a.duration-.5;a.playbackRate=1;});
  const original=await visitor.locator('#wavehaus-audio').getAttribute('src');
  // A prepared native stream must start even if the server/network disappears
  // at the boundary. A discarded warm fetch cannot satisfy this check.
  if(nativePreload)await guest.setOffline(true);
  // Headless Chromium keeps every tab visible. Exercise the app's hidden-page
  // path explicitly; real Android/Brave screen-lock acceptance is separate.
  await visitor.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
  await expect.poll(()=>visitor.locator('#wavehaus-audio').getAttribute('src'),{timeout:10000}).not.toBe(original);
  await expect.poll(()=>visitor.locator('#wavehaus-audio').evaluate((a:HTMLAudioElement)=>!a.paused&&a.currentTime>.1)).toBe(true);
  expect(await visitor.evaluate(()=>{const original=(window as Window&{originalAudios?:HTMLAudioElement[]}).originalAudios!;return original.length===document.querySelectorAll('audio').length&&original.every(a=>a.isConnected);})).toBe(true);
  if(nativePreload){expect(await visitor.locator('audio').count()).toBe(2);expect(await visitor.locator('#wavehaus-preload').getAttribute('src')).toBeNull();const title=await visitor.locator('.now-playing h1').textContent();const refreshed=visitor.waitForResponse(response=>response.url().includes('/api/library?'));await guest.setOffline(false);await refreshed;await expect(visitor.locator('.now-playing h1')).toHaveText(title!);}
  await visitor.evaluate(()=>{Reflect.deleteProperty(document,'hidden');Reflect.deleteProperty(document,'visibilityState');document.dispatchEvent(new Event('visibilitychange'));});
  await visitor.locator('#wavehaus-audio').evaluate((a:HTMLAudioElement)=>{a.playbackRate=.25;a.pause();});
  const at=await visitor.locator('#wavehaus-audio').evaluate((a:HTMLAudioElement)=>a.currentTime);await visitor.evaluate(()=>document.dispatchEvent(new Event('resume')));
  expect(await visitor.locator('#wavehaus-audio').evaluate((a:HTMLAudioElement)=>a.paused)).toBe(true);
  await visitor.locator('.now-controls').getByRole('button',{name:'Play music',exact:true}).click();
  await expect.poll(()=>visitor.locator('#wavehaus-audio').evaluate((a:HTMLAudioElement)=>a.currentTime),{timeout:10000}).toBeGreaterThan(at+.1);
  expect(await visitor.locator('#wavehaus-audio').count()).toBe(1);
 }finally{await guest.close();}
});

test('upload album choices override guesses, retain public visibility and can be revised',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await login(page);await page.goto(base+'/upload');
 await page.getByRole('combobox',{name:'Album assignment',exact:true}).first().selectOption('new');await page.getByRole('textbox',{name:'Custom album title',exact:true}).first().fill('My album '+info.project.name);await page.getByRole('textbox',{name:'Custom album artist',exact:true}).first().fill('Various Artists');
 await page.getByRole('group',{name:'New upload visibility'}).getByRole('button',{name:'Public',exact:true}).click();await page.getByRole('button',{name:'Use Public for new uploads',exact:true}).click();
 const suffix=info.project.name;await page.getByTestId('upload-files').setInputFiles([{name:`First Artist - First ${suffix}.wav`,mimeType:'audio/wav',buffer:audio(info.project.name==='android'?12:22)},{name:`Second Artist - Second ${suffix}.wav`,mimeType:'audio/wav',buffer:audio(info.project.name==='android'?13:23)}]);
 await expect(page.getByText(/Added to your library/).first()).toBeVisible({timeout:60000});let data=await request(page.request,'/api/library?since=0',undefined,'GET');let tracks=data.items.tracks.filter((track:any)=>!track.deleted&&track.original_name.endsWith(suffix+'.wav'));expect(tracks).toHaveLength(2);expect(new Set(tracks.map((track:any)=>track.album_id)).size).toBe(1);expect(tracks.every((track:any)=>track.album_title==='My album '+suffix&&track.visibility==='public')).toBe(true);
 const originalAlbum=tracks[0].album_id;expect(data.items.albums.find((album:any)=>album.id===originalAlbum).visibility).toBe('public');
 // Review stays editable after upload, including combining the whole batch.
 const review=page.locator('.import-review');await review.getByRole('combobox',{name:'Album assignment',exact:true}).selectOption('new');await review.getByRole('textbox',{name:'Custom album title',exact:true}).fill('My revised album '+suffix);await review.getByRole('textbox',{name:'Custom album artist',exact:true}).fill('My collection');await review.getByRole('button',{name:'Apply album choice',exact:true}).click();
 await expect(review).toHaveAttribute('data-busy','false');data=await request(page.request,'/api/library?since=0',undefined,'GET');tracks=data.items.tracks.filter((track:any)=>!track.deleted&&track.original_name.endsWith(suffix+'.wav'));expect(tracks.every((track:any)=>track.album_title==='My revised album '+suffix&&track.visibility==='public')).toBe(true);expect(new Set(tracks.map((track:any)=>track.album_id)).size).toBe(1);
 await page.reload();await expect(page.getByText(/Added to your library/).first()).toBeVisible();expect(errors).toEqual([]);await page.screenshot({path:info.outputPath('album-review.png'),fullPage:true});
});
test('moves one song into another album and honors an explicit public upload into a private album',async({page},info)=>{
 await login(page);const from=await upload(page.request,'Move source'),target=await upload(page.request,'Move target','public');await page.goto(base+'/album/'+from.album.id);await page.getByRole('button',{name:'Options for Move source',exact:true}).click();await page.getByRole('button',{name:'Move to album',exact:true}).click();await page.getByRole('combobox',{name:'Target album',exact:true}).selectOption(target.album.id);await page.getByTestId('bulk-apply').click();await page.getByTestId('confirm-public-move').click();await expect(page).toHaveURL(base+'/library');
 let data=await request(page.request,'/api/library?since=0',undefined,'GET');expect(data.items.tracks.find((track:any)=>track.id===from.track.id)).toMatchObject({album_id:target.album.id,visibility:'public'});
 const privateAlbum=await upload(page.request,'Private destination '+info.project.name);await page.goto(base+'/upload');await page.getByRole('combobox',{name:'Album assignment',exact:true}).first().selectOption('existing');await page.getByRole('combobox',{name:'Destination album',exact:true}).first().selectOption(privateAlbum.album.id);await page.getByRole('group',{name:'New upload visibility'}).getByRole('button',{name:'Public',exact:true}).click();await page.getByRole('button',{name:'Use Public for new uploads',exact:true}).click();await page.getByTestId('upload-files').setInputFiles({name:'Explicitly shared '+info.project.name+'.wav',mimeType:'audio/wav',buffer:audio(info.project.name==='android'?14:24)});await expect(page.getByText(/Added to your library/).first()).toBeVisible({timeout:60000});
 data=await request(page.request,'/api/library?since=0',undefined,'GET');const added=data.items.tracks.find((track:any)=>track.original_name==='Explicitly shared '+info.project.name+'.wav'&&!track.deleted);expect(added).toMatchObject({album_id:privateAlbum.album.id,visibility:'public'});
 const guest=await page.context().browser()!.newContext();expect((await guest.request.get(base+'/api/albums/'+privateAlbum.album.id)).status()).toBe(200);const publicAlbum=await(await guest.request.get(base+'/api/albums/'+privateAlbum.album.id)).json();expect(publicAlbum.tracks.map((track:any)=>track.id)).toEqual([added.id]);await guest.close();
 // With no explicit override, an existing public album keeps new songs public.
 await page.goto(base+'/upload');await page.getByRole('combobox',{name:'Album assignment',exact:true}).first().selectOption('existing');await page.getByRole('combobox',{name:'Destination album',exact:true}).first().selectOption(target.album.id);await expect(page.getByRole('button',{name:'Album default',exact:true})).toHaveAttribute('aria-pressed','true');
 const inheritedName='Inherited '+info.project.name+'.wav';await page.getByTestId('upload-files').setInputFiles({name:inheritedName,mimeType:'audio/wav',buffer:audio(info.project.name==='android'?31:41)});await expect(page.getByText(/Added to your library/).first()).toBeVisible({timeout:60000});data=await request(page.request,'/api/library?since=0',undefined,'GET');expect(data.items.tracks.find((track:any)=>track.original_name===inheritedName&&!track.deleted)).toMatchObject({album_id:target.album.id,visibility:'public'});
});
