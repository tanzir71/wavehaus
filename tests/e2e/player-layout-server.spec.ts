import {test,expect,type APIRequestContext,type Page} from '@playwright/test';
import {createHash} from 'node:crypto';
import {wav} from '../../scripts/make-chime.mjs';

const base=process.env.AUTH_BASE_URL!,username='player_layout_owner',password='Player layout fixture passphrase 2026!';
test.skip(!base,'Runs against a disposable PHP store.');
test.describe.configure({mode:'serial'});
let shared:{track:{id:string;title:string};album:{id:string}},privateSong:typeof shared;
async function request(client:APIRequestContext,path:string,data:unknown){const response=await client.post(base+path,{headers:{'X-Wavehaus':'1'},data});expect(response.ok(),await response.text()).toBe(true);return response.json();}
async function login(client:APIRequestContext){await request(client,'/api/auth/login',{username,password,deviceLabel:'Player layout browser'});}
async function upload(client:APIRequestContext,title:string,visibility='public'){
 const frequency=.06+createHash('sha256').update(title).digest().readUInt32LE()/2**32*.04,bytes=Buffer.from(wav(Float32Array.from({length:16000*12},(_,i)=>.03*Math.sin(i*frequency)))),start=await request(client,'/api/uploads',{filename:title+'.wav',size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
 const part=await client.put(`${base}/api/uploads/${start.uploadId}/parts/1`,{headers:{'X-Wavehaus':'1','Content-Type':'application/octet-stream'},data:bytes});expect(part.ok()).toBe(true);
 return request(client,`/api/uploads/${start.uploadId}/complete`,{metadata:{title,artist:'Layout artist',durationMs:12000},album:{title,artistName:'Layout artist'},visibility});
}
async function home(page:Page){await page.goto(base+'/');await expect(page.locator('.app-shell')).toBeVisible();await page.evaluate(()=>document.fonts.ready);}
async function play(page:Page,song=shared){await page.goto(base+'/album/'+song.album.id);await page.getByRole('button',{name:'Play '+song.track.title,exact:true}).first().click();await expect.poll(()=>page.locator('#wavehaus-audio').evaluate((audio:HTMLAudioElement)=>audio.currentTime)).toBeGreaterThan(.1);}
async function pausedAtFive(page:Page){await page.locator('#wavehaus-audio').evaluate((audio:HTMLAudioElement)=>audio.pause());const slider=page.locator('.player .wave-hit');await slider.focus();await slider.press('Home');await slider.press('ArrowRight');await expect(slider).toHaveAttribute('aria-valuenow','5');}
async function trueEnd(page:Page){
 const scroller=page.locator('.app-body');await scroller.evaluate(element=>element.scrollTo(0,element.scrollHeight));
 const geometry=await scroller.evaluate(element=>({end:element.scrollHeight-element.clientHeight-element.scrollTop,last:element.querySelector('main')!.getBoundingClientRect().bottom,bottom:element.getBoundingClientRect().bottom}));expect(geometry.end).toBeLessThan(1);expect(geometry.last).toBeLessThanOrEqual(geometry.bottom+.5);
}

test.beforeAll(async({request:client},info)=>{
 const health=await(await client.get(base+'/api/health')).json();if(health.needsSetup)await request(client,'/api/setup',{username,password,deviceLabel:'Disposable fixture',serverName:'Player layout fixture'});else await login(client);
 const suffix=info.project.name+' '+Date.now();shared=await upload(client,'Resume fixture '+suffix);await upload(client,'Another public track '+suffix);privateSong=await upload(client,'Private fixture '+suffix,'private');
});

for(const viewport of [{width:1440,height:900},{width:1920,height:1080}])test(`fresh desktop ${viewport.width}×${viewport.height} has no reserved player row`,async({page},info)=>{
 test.skip(info.project.name!=='desktop','Desktop geometry.');await page.setViewportSize(viewport);await home(page);await expect(page.locator('.player')).toHaveCount(0);
 const geometry=await page.locator('.sidebar').evaluate(element=>({bottom:element.getBoundingClientRect().bottom,card:element.querySelector('.storage-card')!.getBoundingClientRect().bottom,padding:parseFloat(getComputedStyle(element).paddingBottom),viewport:innerHeight}));expect(geometry.bottom).toBe(geometry.viewport);expect(geometry.card).toBe(geometry.viewport-geometry.padding);
 expect(await page.locator('.app-body').evaluate(element=>element.getBoundingClientRect().bottom)).toBe(viewport.height);await trueEnd(page);
 if(viewport.width===1920){await page.locator('.app-body').evaluate(element=>element.scrollTo(0,0));await page.screenshot({path:info.outputPath('fresh-player-after-1920x1080.png')});}
});

test('guest playback opens the row without moving content; reload restores paused without fetching audio',async({page},info)=>{
 const media:string[]=[];page.on('request',request=>{if(/\/media\//.test(request.url()))media.push(request.url());});await home(page);await expect(page.locator('.player')).toHaveCount(0);
 await page.goto(base+'/album/'+shared.album.id);const trigger=page.locator('.collection-heading .play-button'),before=await trigger.boundingBox();
 await trigger.click();await expect.poll(()=>page.locator('#wavehaus-audio').evaluate((audio:HTMLAudioElement)=>audio.currentTime)).toBeGreaterThan(.1);await expect(page.locator('.player')).toBeVisible();const after=await trigger.boundingBox();expect(after!.x).toBeCloseTo(before!.x,0);expect(after!.y).toBeCloseTo(before!.y,0);
 if(info.project.name==='desktop'){expect(await page.locator('.player').evaluate(element=>getComputedStyle(element).animationName)).toBe('player-reveal');expect(await page.locator('.sidebar').evaluate(element=>element.getBoundingClientRect().bottom)).toBe((await page.locator('.player').boundingBox())!.y);}
 else{const bar=await page.locator('.player').boundingBox(),nav=await page.locator('.bottom-nav').boundingBox();expect(bar!.y+bar!.height).toBeLessThanOrEqual(nav!.y);}
 await pausedAtFive(page);await trueEnd(page);media.length=0;await page.reload();await expect(page.locator('.player-detail strong')).toHaveText(shared.track.title);await expect(page.locator('.player .wave-hit')).toHaveAttribute('aria-valuenow','5');
 await expect(page.locator('.player').getByRole('button',{name:'Play music',exact:true}).filter({visible:true})).toBeVisible();expect(await page.locator('#wavehaus-audio').evaluate((audio:HTMLAudioElement)=>({paused:audio.paused,preload:audio.preload}))).toEqual({paused:true,preload:'none'});await page.waitForTimeout(1000);expect(media).toEqual([]);
 await page.locator('.player').getByRole('button',{name:'Play music',exact:true}).filter({visible:true}).click();await expect.poll(()=>page.locator('#wavehaus-audio').evaluate((audio:HTMLAudioElement)=>audio.currentTime)).toBeGreaterThan(5);
});

test('a new signed-in browser restores the server position without loading audio',async({page,browser})=>{
 await login(page.request);await home(page);await play(page);await pausedAtFive(page);await page.reload();await expect(page.locator('.player .wave-hit')).toHaveAttribute('aria-valuenow','5');await expect.poll(async()=>Number((await(await page.request.get(base+'/api/player-state')).json()).positionMs)).toBe(5000);
 const second=await browser.newContext();try{await login(second.request);const fresh=await second.newPage(),media:string[]=[];fresh.on('request',request=>{if(/\/media\//.test(request.url()))media.push(request.url());});await home(fresh);await expect(fresh.locator('.player-detail strong')).toHaveText(shared.track.title);await expect(fresh.locator('.player .wave-hit')).toHaveAttribute('aria-valuenow','5');await fresh.waitForTimeout(1000);expect(media).toEqual([]);expect(await fresh.locator('#wavehaus-audio').evaluate((audio:HTMLAudioElement)=>audio.paused)).toBe(true);}finally{await second.close();}
});

test('sign-out never resumes the private track from the account snapshot',async({page})=>{
 await login(page.request);await home(page);await play(page,privateSong);await page.locator('#wavehaus-audio').evaluate((audio:HTMLAudioElement)=>audio.pause());await page.goto(base+'/');await page.getByRole('button',{name:'Open account menu',exact:true}).filter({visible:true}).first().click();await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.locator('.player')).toHaveCount(0);await page.reload();await expect(page.locator('.app-shell')).toBeVisible();await expect(page.locator('.player')).toHaveCount(0);
});

test('a hidden mobile player reserves only the tab bar and respects reduced motion when started',async({page},info)=>{
 test.skip(info.project.name!=='android','Mobile geometry.');await page.emulateMedia({reducedMotion:'reduce'});await home(page);await expect(page.locator('.player')).toHaveCount(0);const nav=await page.locator('.bottom-nav').boundingBox();expect(await page.locator('.app-body').evaluate(element=>element.getBoundingClientRect().bottom)).toBe(nav!.y);await play(page);expect(await page.locator('.player').evaluate(element=>getComputedStyle(element).animationName)).toBe('none');await trueEnd(page);
});

test('the final track and player row remain paused when the queue ends',async({page})=>{
 await home(page);await play(page);await page.locator('.player-detail').click();await page.locator('.now-bottom').getByRole('link',{name:'Queue',exact:true}).click();const autoplay=page.getByRole('switch',{name:'Autoplay',exact:true});if(await autoplay.getAttribute('aria-checked')==='true')await autoplay.click();
 await page.getByRole('link',{name:'Close queue',exact:true}).click();await page.getByRole('link',{name:'Close Now Playing',exact:true}).click();await page.locator('#wavehaus-audio').evaluate((audio:HTMLAudioElement)=>{audio.currentTime=audio.duration-.2;});await expect.poll(()=>page.locator('#wavehaus-audio').evaluate((audio:HTMLAudioElement)=>audio.ended&&audio.paused)).toBe(true);await expect(page.locator('.player-detail strong')).toHaveText(shared.track.title);await expect(page.locator('.player').getByRole('button',{name:'Play music',exact:true}).filter({visible:true})).toBeVisible();await trueEnd(page);
});

test('an inaccessible guest resume track does not fall back to another public song',async({page,request:owner})=>{
 await home(page);await play(page);await pausedAtFive(page);await login(owner);await request(owner,'/api/visibility',{targets:[{type:'track',id:shared.track.id}],visibility:'private'});const media:string[]=[];page.on('request',request=>{if(/\/media\//.test(request.url()))media.push(request.url());});await page.reload();await expect(page.locator('.app-shell')).toBeVisible();await expect(page.locator('.player')).toHaveCount(0);await page.waitForTimeout(500);expect(media).toEqual([]);await trueEnd(page);
});
