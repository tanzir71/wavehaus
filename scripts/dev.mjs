import { spawn } from 'node:child_process';
const worker = process.argv[2] === 'worker';
const children = [];
const run = (cmd, args, env = {}) => { const c = spawn(cmd, args, { stdio:'inherit', shell:process.platform === 'win32', env:{...process.env,...env} }); children.push(c); c.on('exit', code => { if (code) process.exitCode = code; }); return c; };
run(worker ? 'npx' : 'php', worker ? ['wrangler','dev','--config','server-worker/wrangler.toml','--port','8080'] : ['-S','127.0.0.1:8080','-t','server-php/public','server-php/public/index.php'], { WAVEHAUS_DATA_DIR: new URL('../.data', import.meta.url).pathname.replace(/^\/(\w:)/,'$1') });
run('npx',['vite','--config','app/vite.config.ts','--host','127.0.0.1']);
for(const event of ['SIGINT','SIGTERM','exit']) process.on(event,()=>children.forEach(c=>c.kill()));
