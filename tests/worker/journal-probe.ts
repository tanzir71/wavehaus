// Disposable integration entry point. This file is never a production Worker
// entry point and is not included in either release archive.
import {writeJournal,type JournalWrite} from '../../server-worker/src/journal';
import {readJournalChanges,readJournalRows} from '../../server-worker/src/journal-read';
import {all,one,run,stmt} from '../../server-worker/src/db';
import {ulid} from '../../server-worker/src/crypto';
import type {Env,Auth,User} from '../../server-worker/src/types';
import {undoPlan,type JournalRow} from '../../shared/journal';
import {UploadError} from '../../shared/upload-input';
const owner='01J'+'0'.repeat(19)+'9000';
async function state(env:Env){return {
 tracks:await all<JournalRow>(env.DB,'SELECT id,owner_id,album_id,title,rev,deleted FROM tracks ORDER BY id'),
 albums:await all<JournalRow>(env.DB,'SELECT id,owner_id,title,art_key,rev,deleted FROM albums ORDER BY id'),
 changes:await all(env.DB,'SELECT id,summary,undoable,undone_at FROM changes ORDER BY created_at,id'),
 guardCount:(await one<{n:number}>(env.DB,'SELECT COUNT(*) AS n FROM mutation_guards'))!.n,
 operationCount:(await one<{n:number}>(env.DB,'SELECT COUNT(*) AS n FROM change_ops'))!.n,
 revision:(await one<{n:number}>(env.DB,'SELECT n FROM revs WHERE id=1'))!.n,
};}
export default {async fetch(request:Request,env:Env){try{
 const path=new URL(request.url).pathname;if(path==='/_ready')return Response.json({ok:true});if(path==='/state')return Response.json(await state(env));
 const input=await request.json() as JournalWrite&{changeIds:string[];actor?:string;rowId?:string;mode?:string};
 const user=await one<User>(env.DB,'SELECT * FROM users WHERE id=?',input.actor||owner);if(!user)return new Response(null,{status:401});
 const auth={user,session:{device_label:'Journal integration'}} as Auth;
 if(path==='/apply')return Response.json(await writeJournal(env,auth,input));
 if(path==='/legacy'){
  await run(env.DB,'UPDATE tracks SET lyrics=?,peaks=? WHERE id=?','Line\n'.repeat(30000),btoa('\0'.repeat(1000)),input.rowId);
  const before=await one<JournalRow>(env.DB,'SELECT * FROM tracks WHERE id=?',input.rowId);if(!before)throw new Error('Missing fixture row.');
  await env.DB.batch([stmt(env.DB,'UPDATE revs SET n=n+1 WHERE id=1'),stmt(env.DB,'UPDATE tracks SET title=?,rev=(SELECT n FROM revs WHERE id=1) WHERE id=?',input.mode==='metadata'?'Legacy after':before.title,input.rowId)]);
  const after=await one<JournalRow>(env.DB,'SELECT * FROM tracks WHERE id=?',input.rowId),changeId=ulid();
  await run(env.DB,"INSERT INTO changes(id,user_id,actor,session_label,summary,ops,created_at) VALUES(?,?,'web','Legacy test','Legacy operation',?,?)",changeId,user.id,JSON.stringify([{table:'tracks',id:input.rowId,before:input.mode==='metadata'?before:null,after}]),Date.now());
  const changes=await readJournalChanges(env,auth,[changeId]),rows=await readJournalRows(env,changes.flatMap(change=>change.ops));
  return Response.json({changeId,loadedFields:[...rows.values()].map(row=>Object.keys(row)),snapshots:changes[0].ops});
 }
 if(path==='/undo'){
  const records=await readJournalChanges(env,auth,input.changeIds),map=await readJournalRows(env,records.flatMap(change=>change.ops)),plan=undoPlan(records,map);
  return Response.json(await writeJournal(env,auth,{summary:'Undid integration edit',ops:plan.ops,guards:plan.guards,undoIds:plan.changeIds,undoable:false}));
 }
 return new Response(null,{status:404});
 }catch(error){return Response.json({error:{code:error instanceof UploadError?error.code:'internal',message:error instanceof Error?error.message:'Failure'}},{status:error instanceof UploadError?error.status:500});}
}};
