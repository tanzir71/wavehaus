import { defineConfig } from 'vite';
export default defineConfig(({ mode }) => ({
  root: 'app',
  base: process.env.APP_BASE || '/',
  define: { 'import.meta.env.VITE_BACKEND': JSON.stringify(process.env.VITE_BACKEND || (mode === 'demo' ? 'demo' : 'http')) },
  resolve: { alias: { '@backend': new URL(mode === 'demo' || process.env.VITE_BACKEND === 'demo' ? './src/demo/index.ts' : './src/api/http.ts', import.meta.url).pathname.replace(/^\/(\w:)/, '$1') } },
  server: { proxy: Object.fromEntries(['/api', '/media', '/art'].map(p => [p, 'http://127.0.0.1:8080'])) },
  build: { target: 'es2022', cssCodeSplit: true, reportCompressedSize: true }
}));
