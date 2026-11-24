import { spawn } from 'node:child_process';
import { mkdtemp,mkdir,writeFile,readFile,appendFile,rm } from 'node:fs/promises';
import { resolve,relative,sep } from 'node:path';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import { userInfo } from 'node:os';
import { phpCommand } from './php.mjs';
const backend=process.argv[2];if(!['php','worker'].includes(backend))throw new Error('Choose php or worker.');
const deployment=JSON.parse(await readFile('app/dist/deployment.json','utf8'));if(deployment.backend!=='http')throw new Error('Run npm run build before testing a production backend.');
const work=resolve('.work');await mkdir(work,{recursive:true});const temporary=await mkdtemp(resolve(work,`contract-${backend}-`));
async function freePort(){const listener=createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));return port;}
const port=await freePort(),apache=backend==='php'&&process.env.TEST_APACHE_OFFLOAD==='1';
if(apache&&process.platform!=='linux')throw new Error('The Apache offload integration runs on Linux with apache2 and mod_xsendfile installed.');
const base=`http://127.0.0.1:${port}${deployment.base.replace(/\/$/,'')}`,secret=randomBytes(32).toString('hex'),children=[];let output='';
function launch(binary,args,options={}){const child=spawn(binary,args,{windowsHide:true,env:process.env,...options});children.push(child);if(child.stdout)child.stdout.on('data',data=>output=(output+data).slice(-20000));if(child.stderr)child.stderr.on('data',data=>output=(output+data).slice(-20000));return child;}
const completed=child=>new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error(`Process exited ${code}`)));});
let server;
try{
 if(backend==='php'){
  const {binary,args}=phpCommand(),phpPort=apache?await freePort():port;
  if(apache){await mkdir(resolve(temporary,'media'));await writeFile(resolve(temporary,'config.php'),`<?php\ndefine('APP_SECRET', '${secret}');\ndefine('MEDIA_OFFLOAD', 'x-sendfile');\n`);}
  server=launch(binary,[...args,'-S',`127.0.0.1:${phpPort}`,'-t','server-php/public','server-php/public/router.php'],{env:{...process.env,WAVEHAUS_DATA_DIR:temporary,WAVEHAUS_DEV:'1'}});
  if(apache){
   await mkdir(resolve(temporary,'run'));await mkdir(resolve(temporary,'public'));const account=userInfo(),config=resolve(temporary,'httpd.conf');
   await writeFile(config,`ServerRoot "${temporary}"\nDefaultRuntimeDir "${temporary}/run"\nPidFile "${temporary}/httpd.pid"\nServerName 127.0.0.1\nListen 127.0.0.1:${port}\nUser #${account.uid}\nGroup #${account.gid}\nLoadModule mpm_event_module /usr/lib/apache2/modules/mod_mpm_event.so\nLoadModule authz_core_module /usr/lib/apache2/modules/mod_authz_core.so\nLoadModule proxy_module /usr/lib/apache2/modules/mod_proxy.so\nLoadModule proxy_http_module /usr/lib/apache2/modules/mod_proxy_http.so\nLoadModule xsendfile_module /usr/lib/apache2/modules/mod_xsendfile.so\nErrorLog "${temporary}/apache-error.log"\nLogLevel warn\nDocumentRoot "${temporary}/public"\nProxyRequests Off\nProxyPreserveHost On\nProxyPass / http://127.0.0.1:${phpPort}/\nProxyPassReverse / http://127.0.0.1:${phpPort}/\nXSendFile On\nXSendFilePath "${temporary}/media"\n`);
   server=launch('/usr/sbin/apache2',['-f',config,'-DFOREGROUND']);
  }
 }
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
 if(process.argv.includes('--management')){
  await completed(launch(process.execPath,['node_modules/@playwright/test/cli.js','test','tests/e2e/library-management-server.spec.ts','--output',`test-results/library-${backend}-${Date.now()}`,...process.argv.slice(3).filter(arg=>arg!=='--management')],{stdio:'inherit',env:{...process.env,AUTH_BASE_URL:base}}));
  console.log(`${backend} library management passed.`);
 }else{
 await completed(launch(process.execPath,['node_modules/vitest/vitest.mjs','run','--config','vitest.api.config.ts',...process.argv.slice(3)],{stdio:'inherit',env:{...process.env,API_BASE_URL:base,TEST_BACKEND:backend}}));
 await completed(launch(process.execPath,['node_modules/@playwright/test/cli.js','test','tests/e2e/auth-server.spec.ts','tests/e2e/upload-server.spec.ts','--output',`test-results/contract-${backend}-${Date.now()}`],{stdio:'inherit',env:{...process.env,AUTH_BASE_URL:base}}));
 if(backend==='php')await appendFile(resolve(temporary,'config.php'),`\ndefine('RESET_OWNER', '${secret}');\n`);
 const reset=()=>fetch(base+'/api/setup/reset',{method:'POST',headers:{'X-Wavehaus':'1','Content-Type':'application/json'},body:JSON.stringify({resetString:secret,newPassword:'Owner reset fixture passphrase!'})});
 const resets=await Promise.all([reset(),reset()]),statuses=resets.map(r=>r.status).sort().join(',');if(statuses!=='200,404')throw new Error('Owner reset must succeed exactly once; received '+statuses);const resetBody=await resets.find(r=>r.status===200).json();if(resetBody.recoveryCodes.length!==10)throw new Error('Owner reset must issue ten new codes.');console.log('One-use owner reset passed, including competing requests.');
 console.log(`${backend} API contract passed.`);
 }
}catch(error){if(apache)output+='\n'+await readFile(resolve(temporary,'apache-error.log'),'utf8').catch(()=>'');console.error(output.replaceAll(secret,'[redacted]'));throw error;}
finally{
 for(const child of children)if(child.exitCode===null)child.kill();
 await Promise.all(children.filter(c=>c.exitCode===null&&c.signalCode===null).map(c=>new Promise(r=>{const timer=setTimeout(r,5000);c.once('exit',()=>{clearTimeout(timer);r();});})));
 const resolved=resolve(temporary);if(!relative(work,resolved).startsWith('..')&&resolved.startsWith(work+sep))await rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:500});
}
