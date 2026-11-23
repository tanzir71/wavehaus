let count=0;document.body.dataset.busy='false';
export function beginBusy(){count++;document.body.dataset.busy='true';let finished=false;return()=>{if(finished)return;finished=true;count=Math.max(0,count-1);document.body.dataset.busy=String(count>0);};}
