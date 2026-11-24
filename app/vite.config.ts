import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import { defineConfig } from 'vite';
let buildId='local';try{buildId=execFileSync('git',['rev-parse','--short=7','HEAD'],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','ignore']}).trim();}catch{/* Source archives may not include Git metadata. */}
export default defineConfig(({ mode }) => ({
  root: 'app',
  base: process.env.APP_BASE || '/',
  define: { 'import.meta.env.VITE_VERSION': JSON.stringify(JSON.parse(readFileSync('package.json','utf8')).version), 'import.meta.env.VITE_BUILD_ID':JSON.stringify(buildId), 'import.meta.env.VITE_BACKEND': JSON.stringify(process.env.VITE_BACKEND || (mode === 'demo' ? 'demo' : 'http')) },
  resolve: { alias: { '@backend': new URL(mode === 'demo' || process.env.VITE_BACKEND === 'demo' ? './src/demo/index.ts' : './src/api/http.ts', import.meta.url).pathname.replace(/^\/(\w:)/, '$1') } },
  server: { proxy: Object.fromEntries(['/api', '/media', '/art'].map(p => [p, 'http://127.0.0.1:8080'])) },
  build: { target: 'es2022', manifest:true, cssCodeSplit: true, reportCompressedSize: true }
}));
