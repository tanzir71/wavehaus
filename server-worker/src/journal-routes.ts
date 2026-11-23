import {undoPlan} from '../../shared/journal';
import {rowIds} from '../../shared/edit-input';
import {all} from './db';
import {body,fail,json} from './http';
import {readJournalChanges,readJournalRows} from './journal-read';
import {undoReferenceGuards} from './journal-refs';
import {writeJournal} from './journal';
import type {Auth,Env} from './types';

async function activity(request:Request,env:Env,auth:Auth){
 const query=new URL(request.url).searchParams,raw=query.get('limit')??'50',limit=Number(raw);if(!/^[1-9]\d{0,2}$/.test(raw)||limit>100)fail('validation','Use an activity page size from 1 to 100.');
 const cursor=query.get('cursor'),match=cursor?.match(/^(\d{1,16})(?:\.([0-9A-HJKMNP-TV-Z]{26}))?$/);if(cursor&&(!match||!Number.isSafeInteger(Number(match[1]))))fail('validation','Invalid activity cursor.');
 const at=match?Number(match[1]):Number.MAX_SAFE_INTEGER,id=match?.[2]||'Z'.repeat(26),budget=8*1024**2;
 const rows=await all<Record<string,unknown>>(env.DB,`WITH limited AS(SELECT c.id,c.user_id,c.actor,c.session_label,c.token_name,c.summary,c.ops,c.created_at,c.undone_at,c.undoable,json_array_length(c.ops)+(SELECT COUNT(*) FROM change_ops o WHERE o.change_id=c.id) AS operation_count,SUM(2048+length(CAST(c.ops AS BLOB))) OVER(ORDER BY c.created_at DESC,c.id DESC) AS _wh_bytes FROM changes c WHERE c.user_id=? AND (c.created_at<? OR(c.created_at=? AND c.id<?)) ORDER BY c.created_at DESC,c.id DESC LIMIT ?) SELECT * FROM limited WHERE _wh_bytes<=? OR id=(SELECT id FROM limited WHERE _wh_bytes>? ORDER BY created_at DESC,id DESC LIMIT 1) ORDER BY created_at DESC,id DESC`,auth.user.id,at,at,id,limit+1,budget,budget);
 const items:Record<string,unknown>[]=[];for(const row of rows){if(items.length>=limit||items.length&&Number(row._wh_bytes)>budget)break;
  const {_wh_bytes,operation_count,...item}=row;items.push({...item,ops:JSON.parse(String(row.ops)),operationCount:Number(operation_count),undoAvailable:row.undone_at===null&&row.undoable===1&&Number(operation_count)>0&&Number(row.created_at)>=Date.now()-30*86400000});
 }
 const last=items.at(-1);return json({items,nextCursor:items.length<rows.length&&last?`${last.created_at}.${last.id}`:null});
}
export async function journalRoutes(request:Request,env:Env,auth:Auth,path:string):Promise<Response|null>{
 if(path==='/api/changes'&&request.method==='GET')return activity(request,env,auth);
 const single=path.match(/^\/api\/changes\/([0-9A-HJKMNP-TV-Z]{26})\/undo$/),batch=path==='/api/changes/undo';
 if(request.method!=='POST'||!single&&!batch)return null;

 const ids=single?[single[1]]:rowIds((await body(request)).ids,'Action IDs'),changes=await readJournalChanges(env,auth,ids),current=await readJournalRows(env,changes.flatMap(change=>change.ops));
 const admin=['owner','admin'].includes(auth.user.role);
 if(!admin&&[...current].some(([key,row])=>!key.startsWith('artists:')&&row.owner_id!==auth.user.id))fail('forbidden','You can only undo changes to your own library.',403);
 const plan=undoPlan(changes,current);
 if(plan.ops.some(op=>op.table!=='artists'&&current.get(op.table+':'+op.id)!.owner_id!==auth.user.id&&plan.virtual.get(op.table+':'+op.id)!.visibility==='public'&&(current.get(op.table+':'+op.id)!.visibility!=='public'||current.get(op.table+':'+op.id)!.deleted===1)))fail('forbidden','Admins cannot publish another member’s music.',403);
 const counts=await undoReferenceGuards(env,plan.ops,plan.virtual),result=await writeJournal(env,auth,{summary:ids.length===1?'Undid a library change':`Undid ${ids.length} library changes`,ops:plan.ops,guards:plan.guards,counts,undoIds:plan.changeIds,undoable:false});
 return json({...result,undone:ids});
}
