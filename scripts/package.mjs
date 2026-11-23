import { readFile,readdir,mkdir,stat,writeFile } from 'node:fs/promises';
import { resolve,relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { deflateRawSync } from 'node:zlib';
const build=spawnSync(process.execPath,['scripts/build.mjs'],{stdio:'inherit',windowsHide:true});if(build.status!==0)throw new Error('Production build failed.');
const {version}=JSON.parse(await readFile('package.json','utf8'));
const table=Array.from({length:256},(_,n)=>{for(let bit=0;bit<8;bit++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=table[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
async function files(root,prefix=''){const entries=[];for(const name of (await readdir(root)).sort()){const path=resolve(root,name);if((await stat(path)).isDirectory())entries.push(...await files(path,prefix+name+'/'));else entries.push({name:prefix+name,data:await readFile(path)});}return entries;}
async function zip(name,entries){
 const locals=[],directory=[];let offset=0;
 for(const entry of entries){if(/(?:^|\/)(?:config\.php|\.dev\.vars|\.env[^/]*|node_modules|data|backups)(?:\/|$)|\.sqlite(?:-|$)/.test(entry.name))throw new Error('Private data cannot be packaged.');if(entry.name.includes('..')||entry.name.startsWith('/'))throw new Error('Invalid archive path.');
  const filename=Buffer.from(entry.name),raw=Buffer.isBuffer(entry.data)?entry.data:Buffer.from(entry.data),compressed=deflateRawSync(raw),crc=crc32(raw),local=Buffer.alloc(30),central=Buffer.alloc(46);
  local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);local.writeUInt16LE(8,8);local.writeUInt16LE(33,12);local.writeUInt32LE(crc,14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(raw.length,22);local.writeUInt16LE(filename.length,26);
  central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);local.copy(central,8,6,28);central.writeUInt32LE(offset,42);locals.push(local,filename,compressed);directory.push(central,filename);offset+=local.length+filename.length+compressed.length;
 }
 const central=Buffer.concat(directory),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(central.length,12);end.writeUInt32LE(offset,16);const bytes=Buffer.concat([...locals,central,end]);await writeFile(resolve('dist',name),bytes);console.log(`${name}: ${(bytes.length/1024**2).toFixed(2)} MB, ${entries.length} files`);
}
await mkdir('dist',{recursive:true});
const app=await files('app/dist','app/'),migrations=await files('migrations','migrations/');
await zip(`wavehaus-shared-hosting-v${version}.zip`,[
 ...await files('server-php/public'),...await files('server-php/lib','lib/'),...migrations,...app,
 {name:'VERSION',data:version},{name:'README.txt',data:await readFile('server-php/README.md')},{name:'LICENSE',data:await readFile('LICENSE')}
]);
const worker=await files('server-worker/src','server-worker/src/');
for(const name of ['package.json','package-lock.json','wrangler.toml','tsconfig.json'])worker.push({name:'server-worker/'+name,data:await readFile('server-worker/'+name)});
await zip(`wavehaus-worker-v${version}.zip`,[...worker,...await files('shared','shared/'),...migrations,...app.map(f=>({...f,name:'app/dist/'+f.name.slice(4)})),{name:'README.md',data:await readFile('server-worker/README.md')},{name:'LICENSE',data:await readFile('LICENSE')},{name:'VERSION',data:version}]);
