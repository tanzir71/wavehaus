export function byteRange(header:string|null,size:number){
 let start=0,end=size-1,status=200;
 if(header){const match=/^bytes=(\d*)-(\d*)$/.exec(header);if(!match||!match[1]&&!match[2])return {status:416,start:0,end:0,length:0,contentRange:`bytes */${size}`};
  if(!match[1])start=Math.max(0,size-Number(match[2]));else{start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=size)return {status:416,start:0,end:0,length:0,contentRange:`bytes */${size}`};status=206;
 }
 return {status,start,end,length:Math.max(0,end-start+1),contentRange:status===206?`bytes ${start}-${end}/${size}`:null};
}
