// QR Model 2, version 6 / level L. Two 68-byte blocks, 18 ECC bytes each.
// Kept local so pairing never sends a secret to an image/QR service.
function multiply(a:number,b:number){let out=0;for(let n=0;n<8;n++){if(b&1)out^=a;b>>>=1;a<<=1;if(a&256)a^=0x11d;}return out;}
function ecc(data:number[]){let polynomial=[1],alpha=1;for(let n=0;n<18;n++){const next=new Array(polynomial.length+1).fill(0);for(let j=0;j<polynomial.length;j++){next[j]^=polynomial[j];next[j+1]^=multiply(polynomial[j],alpha);}polynomial=next;alpha=multiply(alpha,2);}const work=[...data,...new Array(18).fill(0)];for(let n=0;n<data.length;n++){const factor=work[n];for(let j=0;j<polynomial.length;j++)work[n+j]^=multiply(polynomial[j],factor);}return work.slice(data.length);}
export function qrMatrix(value:string){
 const input=new TextEncoder().encode(value);if(input.length>134)throw new Error('This address is too long for the pairing QR. Use the six-digit code.');
 const bits:number[]=[];const append=(n:number,count:number)=>{for(let i=count-1;i>=0;i--)bits.push(n>>>i&1);};append(4,4);append(input.length,8);for(const byte of input)append(byte,8);append(0,Math.min(4,1088-bits.length));while(bits.length%8)bits.push(0);const data=[];for(let n=0;n<bits.length;n+=8)data.push(bits.slice(n,n+8).reduce((a,b)=>a*2+b,0));for(let n=0;data.length<136;n++)data.push(n%2?0x11:0xec);
 const blocks=[data.slice(0,68),data.slice(68)],checks=blocks.map(ecc),words=[];for(let n=0;n<68;n++)for(const b of blocks)words.push(b[n]);for(let n=0;n<18;n++)for(const b of checks)words.push(b[n]);
 const size=41,matrix=Array.from({length:size},()=>new Array<boolean>(size).fill(false)),fixed=Array.from({length:size},()=>new Array<boolean>(size).fill(false));
 const set=(r:number,c:number,dark:boolean)=>{if(r>=0&&r<size&&c>=0&&c<size){matrix[r][c]=dark;fixed[r][c]=true;}};
 for(const [r,c] of [[3,3],[3,size-4],[size-4,3]])for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const distance=Math.max(Math.abs(dx),Math.abs(dy));set(r+dy,c+dx,distance!==2&&distance!==4);}
 for(let n=0;n<size;n++){if(!fixed[6][n])set(6,n,n%2===0);if(!fixed[n][6])set(n,6,n%2===0);}
 for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)set(34+dy,34+dx,Math.max(Math.abs(dx),Math.abs(dy))!==1);
 const formatData=8;let rem=formatData<<10;for(let n=14;n>=10;n--)if(rem>>>n&1)rem^=0x537<<(n-10);const format=((formatData<<10)|rem)^0x5412,bit=(n:number)=>!!(format>>>n&1);
 for(let n=0;n<=5;n++)set(n,8,bit(n));set(7,8,bit(6));set(8,8,bit(7));set(8,7,bit(8));for(let n=9;n<15;n++)set(8,14-n,bit(n));for(let n=0;n<8;n++)set(8,size-1-n,bit(n));for(let n=8;n<15;n++)set(size-15+n,8,bit(n));set(size-8,8,true);
 let at=0;for(let right=size-1;right>=1;right-=2){if(right===6)right=5;for(let vertical=0;vertical<size;vertical++){const row=((right+1)&2)===0?size-1-vertical:vertical;for(let j=0;j<2;j++){const col=right-j;if(fixed[row][col])continue;const dark=at<words.length*8?!!(words[at>>>3]>>>(7-(at&7))&1):false;matrix[row][col]=dark!==((row+col)%2===0);at++;}}}
 if(at!==1383)throw new Error('QR geometry is invalid.');return matrix;
}
