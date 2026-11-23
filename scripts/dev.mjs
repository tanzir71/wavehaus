import { spawn } from 'node:child_process';
import { mkdir,writeFile,access } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { phpCommand } from './php.mjs';
const worker=process.argv[2]==='worker',children=[];
function run(binary,args,env={}){const child=spawn(binary,args,{stdio:'inherit',windowsHide:true,env:{...process.env,...env}});children.push(child);child.on('error',error=>{console.error(error.message);process.exitCode=1;});return child;}
const done=child=>new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error(`Process exited ${code}`)));});
await done(run(process.execPath,['scripts/build.mjs'],{APP_BASE:'/'}));
if(worker){
 try{await access('server-worker/node_modules/wrangler/bin/wrangler.js');}catch{throw new Error('Run npm ci --prefix server-worker before npm run dev:worker.');}
 try{await access('server-worker/.dev.vars');}catch{await writeFile('server-worker/.dev.vars',`APP_SECRET=${randomBytes(32).toString('hex')}\n`,{flag:'wx'});}
 const wrangler='server-worker/node_modules/wrangler/bin/wrangler.js';
 await done(run(process.execPath,[wrangler,'d1','migrations','apply','wavehaus','--local','--config','server-worker/wrangler.toml','--persist-to','.data/worker','--force']));
 run(process.execPath,[wrangler,'dev','--local','--config','server-worker/wrangler.toml','--persist-to','.data/worker','--port','8080']);
}else {const {binary,args}=phpCommand();await mkdir('.data/php',{recursive:true});run(binary,[...args,'-S','127.0.0.1:8080','-t','server-php/public','server-php/public/router.php'],{WAVEHAUS_DATA_DIR:resolve('.data/php'),WAVEHAUS_DEV:'1'});}
run(process.execPath,['node_modules/vite/bin/vite.js','--config','app/vite.config.ts','--host','127.0.0.1']);
for(const event of ['SIGINT','SIGTERM','exit'])process.on(event,()=>children.forEach(child=>{if(child.exitCode===null)child.kill();}));
