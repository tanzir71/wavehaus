import { UploadError,text } from './upload-input';
import type { SavedQueue,QueueSource } from '../app/src/engine/queue';
export type PlayerSnapshot={queue:string[];index:number;positionMs:number;shuffle:boolean;repeat:'off'|'all'|'one';autoplay:boolean;updatedAt:number;sections?:SavedQueue};
export type PlayInput={id?:string;trackId:string;startedAt:number;msPlayed:number;completed:boolean;skipped:boolean;context:string|null;deviceLabel:string|null};
const ulid=/^[0-9A-HJKMNP-TV-Z]{26}$/;
function invalid(message:string):never{throw new UploadError('validation',message);}
function integer(value:unknown,label:string,max:number,min=0){if(!Number.isSafeInteger(value)||Number(value)<min||Number(value)>max)invalid(`${label} is invalid.`);return Number(value);}
function boolean(value:unknown,label:string,fallback=false){if(value===undefined)return fallback;if(typeof value!=='boolean')invalid(`${label} must be on or off.`);return value;}
function ids(value:unknown,label:string,max=2000){if(!Array.isArray(value)||value.length>max||value.some(id=>typeof id!=='string'||!ulid.test(id)))invalid(`${label} must contain up to ${max} track IDs.`);return value as string[];}
function source(value:unknown):QueueSource{if(!['context','queue','autoplay'].includes(String(value)))invalid('Invalid queue source.');return value as QueueSource;}
export function playerInput(input:Record<string,unknown>,maxIds=2000):PlayerSnapshot{
 const queue=ids(input.queue,'Queue',maxIds),index=integer(input.index,'Queue position',Math.max(0,queue.length-1)),positionMs=integer(input.positionMs,'Playback position',7*86400000),updatedAt=integer(input.updatedAt,'Playback timestamp',Number.MAX_SAFE_INTEGER),repeat=input.repeat;
 if(!['off','all','one'].includes(String(repeat)))invalid('Choose a repeat mode.');
 const result:PlayerSnapshot={queue,index,positionMs,updatedAt,repeat:repeat as PlayerSnapshot['repeat'],shuffle:boolean(input.shuffle,'Shuffle'),autoplay:boolean(input.autoplay,'Autoplay',true)};
 if(input.sections!==undefined){
  const raw=input.sections;if(!raw||typeof raw!=='object'||Array.isArray(raw))invalid('Invalid saved queue.');const s=raw as Record<string,unknown>;
  const context=ids(s.context,'Context',maxIds),remaining=ids(s.remaining,'Remaining context',maxIds),manual=ids(s.manual,'User queue',maxIds),automatic=ids(s.automatic,'Autoplay',100);
  if(context.length+manual.length+automatic.length>maxIds*2)invalid('This queue is too large to save.');if(s.current!==null&&(typeof s.current!=='string'||!ulid.test(s.current)))invalid('Invalid current track.');
  if(!Array.isArray(s.history)||s.history.length>100)invalid('Invalid queue history.');
  const history=s.history.map(entry=>{if(!entry||typeof entry!=='object'||typeof entry.id!=='string'||!ulid.test(entry.id))invalid('Invalid queue history.');return {id:entry.id as string,source:source(entry.source)};});
  result.sections={context,remaining,manual,automatic,history,current:s.current as string|null,currentSource:source(s.currentSource),contextLabel:text(s.contextLabel,'Context name',200)||'Your library',contextType:text(s.contextType,'Playback context',512)||'library',shuffle:result.shuffle,repeat:result.repeat,autoplay:result.autoplay};
 }
 return result;
}
export function playsInput(input:Record<string,unknown>,now=Date.now()):PlayInput[]{
 if(!Array.isArray(input.plays)||input.plays.length>100)invalid('Send up to 100 plays at a time.');
 return input.plays.map(raw=>{if(!raw||typeof raw!=='object'||Array.isArray(raw))invalid('Invalid play.');const p=raw as Record<string,unknown>;if(typeof p.trackId!=='string'||!ulid.test(p.trackId))invalid('Invalid played track.');if(p.id!==undefined&&(typeof p.id!=='string'||!ulid.test(p.id)))invalid('Invalid play ID.');
  const completed=boolean(p.completed,'Completed'),skipped=boolean(p.skipped,'Skipped');if(completed&&skipped)invalid('A completed play cannot also be skipped.');
  return {id:p.id as string|undefined,trackId:p.trackId,startedAt:integer(p.startedAt,'Play timestamp',now+300000),msPlayed:integer(p.msPlayed,'Listening time',7*86400000),completed,skipped,context:text(p.context,'Playback context',512),deviceLabel:text(p.deviceLabel,'Device name',100)};
 });
}
