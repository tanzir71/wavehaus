import { spawn } from 'node:child_process';
// BASE_URL is a Vite built-in. Preserve the caller's HTTP target before Vite
// starts, otherwise Vitest substitutes '/' and silently selects the demo.
const child=spawn(process.execPath,['node_modules/vitest/vitest.mjs','run','--config','vitest.api.config.ts'],{stdio:'inherit',windowsHide:true,env:{...process.env,API_BASE_URL:process.env.BASE_URL||process.env.API_BASE_URL||''}});
child.on('exit',code=>{process.exitCode=code??1;});child.on('error',error=>{console.error(error);process.exitCode=1;});
