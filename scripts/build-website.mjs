import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: { out: { type: 'string' } } });
if (!values.out) throw new Error('Pass --out <empty staging directory>.');
const base = '/wavehaus/app/';
const result = spawnSync(process.execPath, ['scripts/build.mjs'], { stdio: 'inherit', windowsHide: true, env: { ...process.env, APP_BASE: base } });
if (result.status !== 0) throw new Error('Wavehaus website build failed.');
const destination = path.resolve(values.out, 'wavehaus/app');
mkdirSync(destination, { recursive: true });
for (const [source, target] of [['server-php/public', ''], ['server-php/lib', 'lib'], ['migrations', 'migrations'], ['app/dist', 'app']]) {
  cpSync(source, path.join(destination, target), { recursive: true });
}
writeFileSync(path.join(destination, '.htaccess'), readFileSync('server-php/public/.htaccess', 'utf8').replace('RewriteEngine On', `RewriteEngine On\nRewriteBase ${base}`));
writeFileSync(path.join(destination, 'VERSION'), JSON.parse(readFileSync('package.json', 'utf8')).version + '\n');
cpSync('LICENSE', path.join(destination, 'LICENSE'));
console.log(`Built website payload at ${destination}; APP_BASE=${base}`);
