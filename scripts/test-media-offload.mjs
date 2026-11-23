import { spawn } from 'node:child_process';
import { phpCommand } from './php.mjs';
const {binary,args}=phpCommand();
const child=spawn(binary,[...args,'tests/php/media-offload.php'],{stdio:'inherit',windowsHide:true});
child.once('error',error=>{console.error(error.message);process.exitCode=1;});
child.once('exit',code=>{process.exitCode=code??1;});
