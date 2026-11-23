import { mkdir,mkdtemp,copyFile,rm } from 'node:fs/promises';
import { resolve,relative,sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { phpCommand } from './php.mjs';
const work=resolve('.work');await mkdir(work,{recursive:true});const temporary=await mkdtemp(resolve(work,'migration-compare-')),m1=resolve(temporary,'m1');await mkdir(m1);
try{
 for(const file of ['0001_init.sql','0002_defaults.sql'])await copyFile(resolve('migrations',file),resolve(m1,file));
 const {binary,args}=phpCommand();let fresh;
 for(const [upgrade,legacy]of [[false,false],[true,false],[false,true],[true,true]]){
  const result=spawnSync(binary,[...args,'tests/package/migrations.php'],{windowsHide:true,encoding:'utf8',input:JSON.stringify({directory:resolve(temporary,`${upgrade}-${legacy}`),upgrade,legacy,m1,latest:resolve('migrations')})});
  if(result.status!==0)throw new Error(result.stderr);const value=JSON.parse(result.stdout);if(!fresh)fresh=value.shape;assert.deepEqual(value.shape,fresh);assert.equal(value.migrations,6);assert.equal(value.fkEnabled,1);assert.deepEqual(value.foreignKeys,[]);assert.equal(value.homepageSettings,0);assert(!value.shape.showcase&&!value.shape.showcase_stats);assert(!value.shape.albums.columns.some(column=>column.name==='allow_homepage'));
  if(upgrade){assert.equal(value.track.title,'Preserved track');assert.equal(value.album.title,'Preserved album');assert.equal(value.track.album_id,value.album.id);assert.equal(value.track.visibility,'private');assert.equal(value.setting,'"Preserved settings"');}
 }
 console.log('Fresh and M1-upgraded schemas match. Album/track/settings data and foreign keys survive native DROP COLUMN and the old-SQLite rebuild; repeated migration is idempotent.');
}finally{if(resolve(temporary).startsWith(work+sep)&&!relative(work,temporary).startsWith('..'))await rm(temporary,{recursive:true,force:true,maxRetries:5,retryDelay:500});}
