import { mkdir,mkdtemp,copyFile,writeFile,rm } from 'node:fs/promises';
import { resolve,relative,sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const work=resolve('.work');await mkdir(work,{recursive:true});const temporary=await mkdtemp(resolve(work,'d1-migration-compare-')),m1=resolve(temporary,'m1');await mkdir(m1);
const wrangler=resolve('server-worker/node_modules/wrangler/bin/wrangler.js'),config=resolve(temporary,'wrangler.toml');
function command(args){const result=spawnSync(process.execPath,[wrangler,...args,'--config',config],{encoding:'utf8',windowsHide:true,env:{...process.env,WRANGLER_SEND_METRICS:'false'}});if(result.status!==0)throw new Error(result.stderr||result.stdout);return result.stdout;}
async function configure(directory){await writeFile(config,`name = "wavehaus-migration-check"\ncompatibility_date = "2026-11-01"\n[[d1_databases]]\nbinding = "DB"\ndatabase_name = "wavehaus"\ndatabase_id = "00000000-0000-0000-0000-000000000000"\nmigrations_dir = ${JSON.stringify(directory.replaceAll('\\','/'))}\n`);}
const tableFilter="m.type='table' AND m.name NOT GLOB 'sqlite_*' AND m.name NOT GLOB '_cf_*' AND m.name<>'d1_migrations'";
try{
 for(const file of ['0001_init.sql','0002_defaults.sql'])await copyFile(resolve('migrations',file),resolve(m1,file));let fresh;
 for(const upgrade of [false,true]){
  const persist=resolve(temporary,String(upgrade)),apply=()=>command(['d1','migrations','apply','wavehaus','--local','--persist-to',persist,'--force']),sql=source=>JSON.parse(command(['d1','execute','wavehaus','--local','--persist-to',persist,'--command',source,'--json']))[0].results;
  if(upgrade){await configure(m1);apply();command(['d1','execute','wavehaus','--local','--persist-to',persist,'--file',resolve('tests/fixtures/migrations-m1.sql'),'--json']);}
  await configure(resolve('migrations'));apply();apply();
  const columns=sql(`SELECT m.name AS table_name,p.* FROM sqlite_master m JOIN pragma_table_info(m.name) p WHERE ${tableFilter} ORDER BY m.name,p.cid`),foreignKeys=sql(`SELECT m.name AS table_name,p.* FROM sqlite_master m JOIN pragma_foreign_key_list(m.name) p WHERE ${tableFilter} ORDER BY m.name,p.id,p.seq`),shape={columns,foreignKeys};
  if(!fresh)fresh=shape;assert.deepEqual(shape,fresh);assert(!columns.some(c=>['showcase','showcase_stats'].includes(c.table_name)||c.name==='allow_homepage'));assert.equal(sql('SELECT COUNT(*) AS n FROM schema_migrations')[0].n,5);assert.deepEqual(sql('PRAGMA foreign_key_check'),[]);assert.equal(sql("SELECT COUNT(*) AS n FROM settings WHERE key='homepage'")[0].n,0);
  if(upgrade){assert.equal(sql('SELECT title FROM tracks')[0].title,'Preserved track');assert.equal(sql('SELECT title FROM albums')[0].title,'Preserved album');assert.equal(sql("SELECT value FROM settings WHERE key='server_name'")[0].value,'"Preserved settings"');}
 }
 console.log('Local D1 fresh and M1-upgraded schemas match; data and foreign keys survive, removed visitor tables stay absent, and repeated migration is idempotent.');
}finally{if(resolve(temporary).startsWith(work+sep)&&!relative(work,temporary).startsWith('..'))await rm(temporary,{recursive:true,force:true,maxRetries:5,retryDelay:500});}
