import { readFile,writeFile,readdir } from 'node:fs/promises';
export async function prepare(){
 let symbols='';
 for(const file of await readdir('app/src/ui/assets')){
  if(!/^imgIcon[A-Za-z]+\.svg$/.test(file))continue;
  const name=file.slice(7,-4).replace(/[A-Z]/g,(c,i)=>(i?'-':'')+c.toLowerCase());
  const svg=await readFile(`app/src/ui/assets/${file}`,'utf8');const box=svg.match(/viewBox="([^"]+)"/)?.[1]||'0 0 24 24';
  // Export Figma icons as the sprite specified by DESIGN.md. Keep vector geometry.
  const inner=svg.replace(/^.*?<svg[^>]*>/s,'').replace(/<\/svg>\s*$/,'').replace(/#F4F4F5|#f4f4f5|#A1A1AA|#a1a1aa|#6B6B74|#6b6b74|#3D5AFE|#3d5afe|white|black/g,'currentColor');
  symbols+=`<symbol id="icon-${name}" viewBox="${box}">${inner}</symbol>`;
 }
 // The music file glyph uses the existing lyrics icon from the design.
 const lyrics=symbols.match(/<symbol id="icon-lyrics".*?<\/symbol>/s)?.[0]||'';symbols+=lyrics.replace('icon-lyrics','icon-music');
 await writeFile('app/src/ui/icons.svg',`<svg xmlns="http://www.w3.org/2000/svg">${symbols}</svg>`);
}
if(process.argv[1]?.endsWith('prepare.mjs'))await prepare();
