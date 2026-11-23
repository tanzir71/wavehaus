import { coverCanvas } from '../library/covers';
export async function canvasBlob(canvas:HTMLCanvasElement,type='image/webp'){return new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not resize this artwork.')),type,.82));}
export async function artwork(title:string,artist:string,peaks:string|null,picture?:Blob,source='generated'){
 const form=new FormData();let bitmap:ImageBitmap|undefined;
 try{
  if(picture){try{bitmap=await createImageBitmap(picture);}catch{/* Invalid embedded art falls back to a generated cover. */}}
  for(const size of [600,96]){
   let canvas:HTMLCanvasElement;
   if(bitmap){canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d')!,side=Math.min(bitmap.width,bitmap.height);ctx.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,size,size);}
   else canvas=await coverCanvas(title,artist,size,peaks);
   form.set(`art${size}`,await canvasBlob(canvas),`${size}.webp`);
  }
  if(!bitmap)form.set('generated512',await canvasBlob(await coverCanvas(title,artist,512,peaks),'image/png'),'generated-512.png');
  form.set('source',bitmap?source:'generated');return form;
 }finally{bitmap?.close();}
}
