import { spawn } from 'node:child_process';
import { mkdtemp,mkdir,writeFile,readFile,appendFile,rm } from 'node:fs/promises';
import { resolve,relative,sep } from 'node:path';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import { phpCommand } from './php.mjs';
const backend=process.argv[2];if(!['php','worker'].includes(backend))throw new Error('Choose php or worker.');
const deployment=JSON.parse(await readFile('app/dist/deployment.json','utf8'));if(deployment.backend!=='http')throw new Error('Run npm run build before testing a production backend.');
const work=resolve('.work');await mkdir(work,{recursive:true});const temporary=await mkdtemp(resolve(work,`contract-${backend}-`));
const listener=createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));
const base=`http://127.0.0.1:${port}${deployment.base.replace(/\/$/,'')}`,secret=randomBytes(32).toString('hex'),children=[];let output='';
function launch(binary,args,options={}){const child=spawn(binary,args,{windowsHide:true,env:process.env,...options});children.push(child);if(child.stdout)child.stdout.on('data',data=>output=(output+data).slice(-20000));if(child.stderr)child.stderr.on('data',data=>output=(output+data).slice(-20000));return child;}
const completed=child=>new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error(`Process exited ${code}`)));});
let server;
try{
 if(backend==='php'){const {binary,args}=phpCommand();server=launch(binary,[...args,'-S',`127.0.0.1:${port}`,'-t','server-php/public','server-php/public/router.php'],{env:{...process.env,WAVEHAUS_DATA_DIR:temporary,WAVEHAUS_DEV:'1'}});}
 else {
  const config=resolve(temporary,'wrangler.toml'),path=s=>JSON.stringify(resolve(s).replaceAll('\\','/'));
  await writeFile(config,`name = "wavehaus-contract"\nmain = ${path('server-worker/src/index.ts')}\ncompatibility_date = "2026-11-01"\nassets = { directory = ${path('app/dist')}, binding = "ASSETS", html_handling = "none", not_found_handling = "none", run_worker_first = true }\n[[d1_databases]]\nbinding = "DB"\ndatabase_name = "wavehaus"\ndatabase_id = "00000000-0000-0000-0000-000000000000"\nmigrations_dir = ${path('migrations')}\n[[r2_buckets]]\nbinding = "MEDIA"\nbucket_name = "wavehaus-contract-media"\n`);
  await writeFile(resolve(temporary,'.dev.vars'),`APP_SECRET=${secret}\nRESET_OWNER=${secret}\n`);
  const wrangler=resolve('server-worker/node_modules/wrangler/bin/wrangler.js'),persist=resolve(temporary,'state');
  await completed(launch(process.execPath,[wrangler,'d1','migrations','apply','wavehaus','--local','--config',config,'--persist-to',persist,'--force']));
  server=launch(process.execPath,[wrangler,'dev','--local','--config',config,'--persist-to',persist,'--port',String(port)]);
 }
 const deadline=Date.now()+45000;let ready=false;while(Date.now()<deadline){if(server.exitCode!==null)throw new Error('Backend stopped before becoming ready.');try{const response=await fetch(base+'/api/health');if(response.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}if(!ready)throw new Error('Backend did not become ready.');
 console.log(`Testing ${backend} against a disposable local store.`);
 await completed(launch(process.execPath,['node_modules/vitest/vitest.mjs','run','--config','vitest.api.config.ts',...process.argv.slice(3)],{stdio:'inherit',env:{...process.env,API_BASE_URL:base,TEST_BACKEND:backend}}));
 await completed(launch(process.execPath,['node_modules/@playwright/test/cli.js','test','tests/e2e/auth-server.spec.ts','tests/e2e/upload-server.spec.ts'],{stdio:'inherit',env:{...process.env,AUTH_BASE_URL:base}}));
 if(backend==='php')await appendFile(resolve(temporary,'config.php'),`\ndefine('RESET_OWNER', '${secret}');\n`);
 const reset=()=>fetch(base+'/api/setup/reset',{method:'POST',headers:{'X-Wavehaus':'1','Content-Type':'application/json'},body:JSON.stringify({resetString:secret,newPassword:'Owner reset fixture passphrase!'})});
 const resets=await Promise.all([reset(),reset()]),statuses=resets.map(r=>r.status).sort().join(',');if(statuses!=='200,404')throw new Error('Owner reset must succeed exactly once; received '+statuses);const resetBody=await resets.find(r=>r.status===200).json();if(resetBody.recoveryCodes.length!==10)throw new Error('Owner reset must issue ten new codes.');console.log('One-use owner reset passed, including competing requests.');
 console.log(`${backend} API contract passed.`);
}catch(error){console.error(output.replaceAll(secret,'[redacted]'));throw error;}
finally{
 for(const child of children)if(child.exitCode===null)child.kill();
 await Promise.all(children.filter(c=>c.exitCode===null&&c.signalCode===null).map(c=>new Promise(r=>{const timer=setTimeout(r,5000);c.once('exit',()=>{clearTimeout(timer);r();});})));
 const resolved=resolve(temporary);if(!relative(work,resolved).startsWith('..')&&resolved.startsWith(work+sep))await rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:500});
}
