import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
const root=resolve(process.env.SERVE_DIR || 'site'); const port=Number(process.env.PORT || 4173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.avif':'image/avif','.woff2':'font/woff2','.wav':'audio/wav','.xml':'application/xml','.txt':'text/plain'};
createServer(async(req,res)=>{ try {
  let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  // Simulate the project Pages mount, including real fallback behavior.
  if(path.startsWith('/wavehaus/'))path=path.slice('/wavehaus'.length);
  let file=resolve(root,'.'+path); if(!file.startsWith(root+sep)&&file!==root){res.writeHead(403).end();return;}
  try { if((await stat(file)).isDirectory())file=resolve(file,'index.html'); } catch { file=resolve(root,'404.html'); }
  let bytes=await readFile(file);const headers={'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-cache','Vary':'Accept-Encoding'};
  if(/html|css|javascript|json|svg|xml/.test(headers['Content-Type'])&&req.headers['accept-encoding']?.includes('gzip')){bytes=gzipSync(bytes);headers['Content-Encoding']='gzip';}
  res.writeHead(200,headers);res.end(bytes);
}catch{res.writeHead(404).end('Not found');}}).listen(port,'127.0.0.1',()=>console.log(`Wavehaus preview http://127.0.0.1:${port}/wavehaus/`));
