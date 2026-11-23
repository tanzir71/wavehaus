import {journalColumns,JournalConflict,compactLegacyOp,undoPlan,type JournalRow,type JournalOp,type JournalChange,type JournalTable,type JournalWrite} from '../../../shared/journal';
import {rowIds} from '../../../shared/edit-input';
import {ApiError} from '../api/types';
import {id} from '../library/ids';
import {demoSignedIn} from './auth';
import {mutate,readState,type DemoState} from './store';
type Change=JournalChange&{user_id:string;summary:string;actor:string;session_label:string;journalOps?:JournalOp[]};
const encoder=new TextEncoder(),tables:JournalTable[]=['artists','albums','tracks'];
const rows=(state:DemoState,table:JournalTable)=>state[table] as unknown as JournalRow[];
function signedIn(state:DemoState){if(!demoSignedIn(state))throw new ApiError('unauthenticated','Sign in to continue.',401);}
const conflict=(table:JournalTable,id:string):never=>{throw new JournalConflict([{table,id}]);};
function ownParent(state:DemoState,parent:Change|undefined,now:number){if(!parent||parent.user_id!==state.user.id||parent.undone_at!==null||parent.undoable===0||parent.created_at<now-30*86400000)throw new JournalConflict([]);return parent;}

/** Called only inside the demo's account-checked IndexedDB write lock. */
export function demoWriteJournal(state:DemoState,plan:JournalWrite){
 signedIn(state);if(state.user.role==='listener')throw new ApiError('forbidden','Your account cannot edit library metadata.',403);
 if(plan.ops.length>10000||(plan.undoIds?.length||0)>2000)throw new ApiError('too_large','Choose fewer records at once.',413);
 if(!plan.ops.length&&!plan.undoIds?.length)return {changeId:plan.appendTo||null,updated:0};
 if(new Set(plan.ops.map(op=>op.table+':'+op.id)).size!==plan.ops.length)throw new Error('Consolidate record operations before committing.');
 const now=Date.now(),admin=['owner','admin'].includes(state.user.role),guards=plan.guards||plan.ops.flatMap(op=>op.before?[{table:op.table,id:op.id,rev:op.before.rev}]:[]);
 for(const guard of guards){const row=rows(state,guard.table).find(row=>row.id===guard.id);if(!row||row.rev!==guard.rev||guard.table!=='artists'&&!admin&&row.owner_id!==state.user.id)conflict(guard.table,guard.id);}
 for(const guard of plan.counts||[])if(rows(state,guard.table).filter(row=>!row.deleted&&row[guard.column]===guard.id).length!==guard.count)throw new JournalConflict([]);
 for(const op of plan.ops)if(!op.before){if(rows(state,op.table).some(row=>row.id===op.id))conflict(op.table,op.id);if(op.table!=='artists'&&!admin&&op.after.owner_id!==state.user.id)throw new ApiError('forbidden','Choose records that belong to you.',403);}
 const changes=state.changes as unknown as Change[];for(const changeId of plan.undoIds||[])ownParent(state,changes.find(change=>change.id===changeId),now);
 const parent=plan.appendTo?ownParent(state,changes.find(change=>change.id===plan.appendTo),now):null;
 if((parent?.ops.length||0)+(parent?.journalOps?.length||0)+plan.ops.length>10000)throw new ApiError('too_large','This action has too much undo data.',413);
 if(encoder.encode(JSON.stringify([...(parent?.ops||[]),...(parent?.journalOps||[]),...plan.ops])).byteLength>16*1024**2)throw new ApiError('too_large','This edit needs too much undo data. Choose fewer rows.',413);
 const created=new Map(tables.map(table=>[table,new Set(plan.ops.filter(op=>op.table===table&&!op.before).map(op=>op.id))]));
 for(const op of plan.ops)for(const[column,target]of [['album_id','albums'],['artist_id','artists']] as const)if(Object.hasOwn(op.after,column)&&op.after[column]!==null&&!rows(state,target).some(row=>row.id===op.after[column])&&!created.get(target)!.has(String(op.after[column])))throw new Error('Invalid record reference.');
 const changeId=parent?.id||id(),entry:Change=parent||{id:changeId,user_id:state.user.id,actor:'web',session_label:'This browser · demo',summary:plan.summary,ops:[],journalOps:[],created_at:now,undone_at:null,undoable:plan.undoable===false?0:1},base=state.rev;
 state.rev+=plan.ops.length;
 for(const table of tables)for(const[ index,op]of plan.ops.entries())if(op.table===table){
  const patch=Object.fromEntries(journalColumns[table].filter(column=>Object.hasOwn(op.after,column)).map(column=>[column,op.after[column]])),revision=base+index+1;
  if(op.before){const row=rows(state,table).find(row=>row.id===op.id)!,becamePrivate=table!=='artists'&&row.visibility==='public'&&patch.visibility==='private';Object.assign(row,patch,{rev:revision},table==='tracks'?{updated_at:now}:{},becamePrivate?{hidden_rev:revision}:{});}
  else rows(state,table).push({...(table==='albums'?{art_source:'generated',art_key:null,visibility:'private',sync_visibility:1,year:null,folder_path:null}:{}),deleted:0,...patch,id:op.id,rev:revision});
 }
 entry.journalOps||=[];entry.journalOps.push(...plan.ops.map((op,index)=>({...op,before:op.before?{...op.before}:null,after:{...op.after,rev:base+index+1}})));
 if(!parent)changes.unshift(entry);for(const changeId of plan.undoIds||[])changes.find(change=>change.id===changeId)!.undone_at=now;
 return {changeId,updated:plan.ops.filter(op=>op.table==='tracks').length};
}
export async function demoJournal(request:Request,path:string):Promise<Response|null>{
 if(path==='/api/changes'&&request.method==='GET'){
  const state=(await readState())!;signedIn(state);const query=new URL(request.url).searchParams,raw=query.get('limit')??'50',limit=Number(raw);if(!/^[1-9]\d{0,2}$/.test(raw)||limit>100)throw new ApiError('validation','Use an activity page size from 1 to 100.',400);
  const cursor=query.get('cursor'),match=cursor?.match(/^(\d{1,16})(?:\.([0-9A-HJKMNP-TV-Z]{26}))?$/);if(cursor&&(!match||!Number.isSafeInteger(Number(match[1]))))throw new ApiError('validation','Invalid activity cursor.',400);
  const at=match?Number(match[1]):Number.MAX_SAFE_INTEGER,key=match?.[2]||'Z'.repeat(26),changes=(state.changes as unknown as Change[]).filter(change=>change.user_id===state.user.id&&(change.created_at<at||change.created_at===at&&change.id<key)).sort((a,b)=>b.created_at-a.created_at||b.id.localeCompare(a.id)),items=[];let bytes=0;
  for(const change of changes){bytes+=encoder.encode(JSON.stringify(change.ops||[])).byteLength+2048;if(items.length>=limit||items.length&&bytes>8*1024**2)break;const{journalOps,...item}=change,operationCount=(change.ops||[]).length+(journalOps||[]).length;items.push({...item,operationCount,undoAvailable:state.user.role!=='listener'&&change.undone_at===null&&change.undoable!==0&&operationCount>0&&change.created_at>=Date.now()-30*86400000});}
  const last=items.at(-1);return Response.json({items,nextCursor:items.length<changes.length&&last?`${last.created_at}.${last.id}`:null});
 }
 const single=path.match(/^\/api\/changes\/([0-9A-HJKMNP-TV-Z]{26})\/undo$/);if(request.method!=='POST'||!single&&path!=='/api/changes/undo')return null;
 const ids=single?[single[1]]:rowIds((await request.json()).ids,'Action IDs');
 return mutate(state=>{
  signedIn(state);const stored=state.changes as unknown as Change[],selected=ids.map(id=>stored.find(change=>change.id===id&&change.user_id===state.user.id));if(selected.some(change=>!change))throw new ApiError('not_found','An action was not found in your activity.',404);
  const changes=selected.map(change=>({...change!,ops:[...(change!.ops||[]).map(compactLegacyOp),...(change!.journalOps||[])]})),current=new Map<string,JournalRow>();
  for(const change of changes)for(const op of change.ops){const row=rows(state,op.table).find(row=>row.id===op.id);if(row)current.set(op.table+':'+op.id,{...row});}
  const admin=['owner','admin'].includes(state.user.role);if(!admin&&[...current].some(([key,row])=>!key.startsWith('artists:')&&row.owner_id!==state.user.id))throw new ApiError('forbidden','You can only undo changes to your own library.',403);
  const plan=undoPlan(changes,current),counts:JournalWrite['counts']=[];
  for(const op of plan.ops){const row=plan.virtual.get(op.table+':'+op.id)!;if(op.table!=='artists'&&row.owner_id!==state.user.id&&row.visibility==='public'&&(current.get(op.table+':'+op.id)!.visibility!=='public'||current.get(op.table+':'+op.id)!.deleted===1))throw new ApiError('forbidden','Admins cannot publish another member’s music.',403);
   if(op.after.deleted!==1||op.before?.deleted===1||op.table==='tracks')continue;
   for(const[table,column]of(op.table==='albums'?[['tracks','album_id']]:[['tracks','artist_id'],['albums','artist_id']]) as ['tracks'|'albums','album_id'|'artist_id'][]){
    const live=rows(state,table).filter(row=>!row.deleted&&row[column]===op.id);counts.push({table,column,id:op.id,count:live.length});
    if(live.some(row=>{const final=plan.virtual.get(table+':'+row.id)||row;return !final.deleted&&final[column]===op.id;})||[...plan.virtual].some(([key,final])=>key.startsWith(table+':')&&!final.deleted&&final[column]===op.id))conflict(op.table,op.id);
   }
  }
  return Response.json({...demoWriteJournal(state,{summary:ids.length===1?'Undid a library change':`Undid ${ids.length} library changes`,ops:plan.ops,guards:plan.guards,counts,undoIds:plan.changeIds,undoable:false}),undone:ids});
 });
}
