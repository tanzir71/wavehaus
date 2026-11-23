import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname,join } from 'node:path';
export function phpCommand(){
 const probe=spawnSync('php',['-r','echo json_encode([PHP_BINARY,get_loaded_extensions()]);'],{encoding:'utf8',windowsHide:true});
 if(probe.status!==0)throw new Error('Install PHP 8.1+ and add php to PATH. Enable pdo_sqlite, mbstring, openssl and fileinfo.');
 const [binary,extensions]=JSON.parse(probe.stdout),args=['-d','opcache.enable_cli=0'];
 if(process.platform==='win32'){const dir=join(dirname(binary),'ext');args.push('-d',`extension_dir=${dir}`);for(const name of ['pdo_sqlite','mbstring','openssl','fileinfo'])if(!extensions.includes(name)&&existsSync(join(dir,`php_${name}.dll`)))args.push('-d',`extension=${name}`);}
 return {binary,args};
}
