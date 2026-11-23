import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {resolve,relative,sep} from 'node:path';
import {createServer} from 'node:net';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {phpCommand} from './php.mjs';
const backend=process.argv[2]||'worker';if(!['php','worker'].includes(backend))throw new Error('Choose php or worker.');
const work=resolve('.work');await mkdir(work,{recursive:true});const temporary=await mkdtemp(resolve(work,'journal-integration-')),config=resolve(temporary,'wrangler.toml'),persist=resolve(temporary,'state'),wrangler=resolve('server-worker/node_modules/wrangler/bin/wrangler.js');
const listener=createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));const base=`http://127.0.0.1:${port}`;
const children=[];let output='';
function launch(args,binary=process.execPath,env=process.env){const child=spawn(binary,args,{windowsHide:true,env});children.push(child);for(const stream of [child.stdout,child.stderr])stream.on('data',data=>output=(output+data).slice(-16000));return child;}
const complete=child=>new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error(`Journal test command exited ${code}`)));});
const command=args=>complete(launch([wrangler,...args,'--config',config,'--persist-to',persist]));
const path=value=>JSON.stringify(resolve(value).replaceAll('\\','/')),id=n=>'01J'+'0'.repeat(19)+String(n).padStart(4,'0'),owner=id(9000),artist=id(9001),album=id(9002),other=id(9003),now=Date.now();
const request=async(path,body)=>{if(path==='/undo'){path='/api/changes/undo';body={ids:body.changeIds};}const response=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};};
const state=async()=>await (await fetch(base+'/state')).json();
try{
 if(backend==='worker'){await writeFile(config,`name = "wavehaus-journal-test"\nmain = ${path('tests/worker/journal-probe.ts')}\ncompatibility_date = "2026-11-01"\n[[d1_databases]]\nbinding = "DB"\ndatabase_name = "wavehaus"\ndatabase_id = "00000000-0000-0000-0000-000000000000"\nmigrations_dir = ${path('migrations')}\n`);await command(['d1','migrations','apply','wavehaus','--local','--force']);}
 const sql=[`INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES('${owner}','journal_owner','Journal owner','test-only','owner',${now}),('${other}','journal_other','Other uploader','test-only','uploader',${now});`,`INSERT INTO artists(id,name,sort_name,tint,rev,name_key) VALUES('${artist}','Artist','Artist',0,1,'artist');`,`INSERT INTO albums(id,owner_id,title,artist_id,tint,created_at,rev,merge_key) VALUES('${album}','${owner}','Album','${artist}',0,${now},2,'fixture');`];
 for(let i=0;i<500;i++){const hash=createHash('sha256').update('journal-track-'+i).digest('hex');sql.push(`INSERT INTO tracks(id,owner_id,album_id,artist_id,title,artist_name,album_title,duration_ms,storage_key,size_bytes,sha256,quick_hash,original_name,mime,added_at,updated_at,rev) VALUES('${id(i)}','${owner}','${album}','${artist}','Song ${i}','Artist','Album',1000,'media/${owner}/${hash}.wav',44,'${hash}','${hash}','song.wav','audio/wav',${now},${now},${i+3});`);}
 sql.push('UPDATE revs SET n=502 WHERE id=1;');const seed=resolve(temporary,'seed.sql');await writeFile(seed,sql.join('\n'));let server;
 if(backend==='worker'){await command(['d1','execute','wavehaus','--local','--file',seed,'--json']);server=launch([wrangler,'dev','--local','--config',config,'--persist-to',persist,'--ip','127.0.0.1','--port',String(port)]);}
 else{const{binary,args}=phpCommand(),env={...process.env,JOURNAL_TEST_DATABASE:resolve(temporary,'test.sqlite')};await complete(launch([...args,'tests/php/journal-probe.php',seed],binary,env));server=launch([...args,'-S',`127.0.0.1:${port}`,'-t','tests/php','tests/php/journal-probe.php'],binary,env);}
 let ready=false;const deadline=Date.now()+45000;
 while(Date.now()<deadline){if(server.exitCode!==null)throw new Error('Journal test Worker stopped.');try{if((await fetch(base+'/_ready')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert(ready,'Journal test Worker must start.');
 const before=await state(),ops=before.tracks.map((row,i)=>({table:'tracks',id:row.id,before:{id:row.id,rev:row.rev,title:row.title},after:{id:row.id,rev:row.rev,title:'Renamed '+i}}));
 const edit=await request('/apply',{summary:'Renamed 500 tracks',ops});assert.equal(edit.status,200,JSON.stringify(edit.body));assert.equal(edit.body.updated,500);
 let after=await state();assert.equal(after.changes.length,1);assert.equal(after.operationCount,500);assert.equal(after.guardCount,0);assert.equal(new Set(after.tracks.map(row=>row.rev)).size,500);assert(after.tracks.every((row,i)=>row.title==='Renamed '+i));
 const append=await request('/apply',{appendTo:edit.body.changeId,summary:'Generated artwork',ops:[{table:'albums',id:album,before:{id:album,rev:2,art_key:null},after:{id:album,rev:2,art_key:'new-art'}}]});assert.equal(append.status,200,JSON.stringify(append.body));after=await state();assert.equal(after.changes.length,1);assert.equal(after.operationCount,501);assert.equal(after.albums[0].art_key,'new-art');
 const undo=await request('/undo',{changeIds:[edit.body.changeId]});assert.equal(undo.status,200,JSON.stringify(undo.body));after=await state();assert.deepEqual(after.tracks.map(row=>row.title),before.tracks.map(row=>row.title));assert.equal(after.albums[0].art_key,null);assert.equal(after.changes.length,2);assert(after.changes.some(change=>change.id===edit.body.changeId&&change.undone_at));assert.equal(after.guardCount,0);
 const stale=await request('/apply',{summary:'Stale edit',ops:[ops[0]]});assert.equal(stale.status,409);assert.equal((await state()).changes.length,2);
 const current=after.tracks[0],bad={table:'tracks',id:current.id,before:{id:current.id,rev:current.rev,album_id:current.album_id},after:{id:current.id,rev:current.rev,album_id:id(9999)}};
 const failed=await request('/apply',{summary:'Must roll back',ops:[bad]});assert.equal(failed.status,500);assert.deepEqual(await state(),after);
 const concurrent=await Promise.all(['First','Second'].map(title=>request('/apply',{summary:title,ops:[{table:'tracks',id:current.id,before:{id:current.id,rev:current.rev,title:current.title},after:{id:current.id,rev:current.rev,title}}]})));assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);
 after=await state();assert.equal(after.guardCount,0);const protectedRow=after.tracks[1];const denied=await request('/apply',{actor:other,summary:'Forbidden ownership',ops:[{table:'tracks',id:protectedRow.id,before:{id:protectedRow.id,rev:protectedRow.rev,title:protectedRow.title},after:{id:protectedRow.id,rev:protectedRow.rev,title:'Not allowed'}}]});assert.equal(denied.status,409);assert.deepEqual(await state(),after);
 for(const [mode,rowId] of [['metadata',id(498)],['created',id(499)]]){
  const legacy=await request('/legacy',{mode,rowId});assert.equal(legacy.status,200,JSON.stringify(legacy.body));assert(legacy.body.loadedFields.every(fields=>!fields.includes('lyrics')&&!fields.includes('peaks')));assert(!JSON.stringify(legacy.body.snapshots).includes('lyrics'));assert(!JSON.stringify(legacy.body.snapshots).includes('peaks'));
  const undone=await request('/undo',{changeIds:[legacy.body.changeId]});assert.equal(undone.status,200,JSON.stringify(undone.body));const actual=(await state()).tracks.find(row=>row.id===rowId);assert.equal(mode==='created'?actual.deleted:actual.title,mode==='created'?1:'Song 498');
 }
 after=await state();const first=after.tracks[0],second=after.tracks[1],newArtist=id(8887),newAlbum=id(8888);
 const created=await request('/apply',{summary:'Created an album',ops:[
  {table:'tracks',id:first.id,before:{id:first.id,rev:first.rev,album_id:first.album_id,artist_id:first.artist_id},after:{id:first.id,rev:first.rev,album_id:newAlbum,artist_id:newArtist}},
  {table:'albums',id:newAlbum,before:null,after:{id:newAlbum,rev:0,owner_id:owner,title:'New album',artist_id:newArtist,tint:0,visibility:'private',created_at:Date.now(),deleted:0,merge_key:'new-fixture'}},
  {table:'artists',id:newArtist,before:null,after:{id:newArtist,rev:0,name:'New artist',sort_name:'New artist',tint:0,deleted:0,name_key:'new-artist'}},
 ]});assert.equal(created.status,200,JSON.stringify(created.body));
 const addedLater=await request('/apply',{summary:'Moved another track',ops:[{table:'tracks',id:second.id,before:{id:second.id,rev:second.rev,album_id:second.album_id},after:{id:second.id,rev:second.rev,album_id:newAlbum}}]});assert.equal(addedLater.status,200,JSON.stringify(addedLater.body));
 const protectedAlbum=await request('/undo',{changeIds:[created.body.changeId]});assert.equal(protectedAlbum.status,409,'An outside child must prevent album removal.');
 const undoBoth=await request('/undo',{changeIds:[created.body.changeId,addedLater.body.changeId]});assert.equal(undoBoth.status,200,JSON.stringify(undoBoth.body));after=await state();assert.equal(after.tracks[0].album_id,album);assert.equal(after.tracks[1].album_id,album);assert.equal(after.albums.find(row=>row.id===newAlbum).deleted,1);assert.equal(after.guardCount,0);
 await request('/same-time',{});const activityIds=[];let cursor=null;do{const response=await fetch(base+'/api/changes?limit=1'+(cursor?'&cursor='+encodeURIComponent(cursor):''));assert.equal(response.status,200);const page=await response.json();activityIds.push(...page.items.map(item=>item.id));cursor=page.nextCursor;}while(cursor);assert.equal(new Set(activityIds).size,after.changes.length);assert.equal(activityIds.length,after.changes.length);
 console.log(`${backend==='worker'?'Actual Worker/D1':'Native PHP/SQLite'}: 500-track journal/undo, appended artwork, stale/ownership guards, concurrent winner, SQL rollback, compact legacy journals, public undo/reference guards and same-time activity pagination passed.`);
}catch(error){console.error(output);throw error;}finally{
 for(const child of children)if(child.exitCode===null)child.kill();await Promise.all(children.filter(child=>child.exitCode===null&&child.signalCode===null).map(child=>new Promise(r=>{const timer=setTimeout(r,5000);child.once('exit',()=>{clearTimeout(timer);r();});})));
 const target=resolve(temporary);if(target.startsWith(work+sep)&&!relative(work,target).startsWith('..'))await rm(target,{recursive:true,force:true,maxRetries:5,retryDelay:500});
}
