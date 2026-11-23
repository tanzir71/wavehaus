import { build } from 'vite';
import { mkdir,cp,writeFile,readFile,readdir,stat,rm } from 'node:fs/promises';
import { resolve,relative } from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { makeChime } from './make-chime.mjs';
import {buildTools} from './build-tools.mjs';
import { prepare } from './prepare.mjs';
import { buildLanding } from '../landing/build.mjs';
const pages=process.argv[2]==='pages';
await prepare();await makeChime();await buildTools();
const appBase=pages?'/wavehaus/app/':process.env.APP_BASE||'/';
if(!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(appBase))throw new Error('APP_BASE must be / or a path such as /music/ (including its trailing slash).');
process.env.APP_BASE=appBase;process.env.VITE_BACKEND=pages?'demo':'http';
await build({configFile:resolve('app/vite.config.ts'),mode:pages?'demo':'production'});
await writeFile('app/dist/deployment.json',JSON.stringify({base:appBase,backend:process.env.VITE_BACKEND})+'\n');
async function files(dir){const result=[];for(const name of await readdir(dir)){const path=resolve(dir,name);if((await stat(path)).isDirectory())result.push(...await files(path));else result.push(path);}return result;}
const appFiles=await files('app/dist');const html=await readFile('app/dist/index.html','utf8');
const entryAssets=[...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(m=>m[1]);
// Precache the shell, not the lazy Upload route and metadata parsers.
const shell=appFiles.filter(f=>!relative('app/dist',f).startsWith('assets')&&!f.endsWith('sw.js')&&!f.endsWith('.wav')).map(f=>process.env.APP_BASE+relative('app/dist',f).replaceAll('\\','/')).concat(entryAssets);
const digest=createHash('sha256').update(await readFile('app/dist/index.html')).digest('hex').slice(0,12);
await writeFile('app/dist/sw.js',(await readFile('app/dist/sw.js','utf8')).replace("'__BUILD_VERSION__'",JSON.stringify(digest)).replace("'__SHELL_FILES__'",JSON.stringify([...shell,process.env.APP_BASE])));
// The site-wide Pages 404 must route app deep links; GitHub does not select nested 404s.
await writeFile('app/dist/404.html',await readFile('app/dist/index.html'));
const initialScripts=[...new Set(entryAssets.filter(asset=>asset.endsWith('.js')))];const bytes=(await Promise.all(initialScripts.map(async asset=>gzipSync(await readFile(resolve('app/dist',asset.replace(process.env.APP_BASE,'')))).length))).reduce((a,b)=>a+b,0);if(bytes>90*1024)throw new Error(`Initial JavaScript exceeds 90 KB gzip: ${bytes}`);console.log(`Initial JavaScript including static imports: ${(bytes/1024).toFixed(1)} KB gzip`);
await buildLanding(pages?'/wavehaus/':'/');
if(pages){await mkdir('site',{recursive:true});await cp('landing/dist','site',{recursive:true});await cp('app/dist','site/app',{recursive:true});
 const fallback=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Wavehaus</title></head><body><p>Opening Wavehaus…</p><script>if(location.pathname.startsWith('/wavehaus/app/')){sessionStorage.setItem('wh-route',location.pathname+location.search);location.replace('/wavehaus/app/?restore=1')}else{location.replace('/wavehaus/')}</script></body></html>`;await writeFile('site/404.html',fallback);
}
