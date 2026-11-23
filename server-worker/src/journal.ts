import {journalColumns,JournalConflict,type JournalTable,type JournalWrite,type CountGuard} from '../../shared/journal';
import {ulid} from './crypto';
import {stmt} from './db';
import {fail} from './http';
import type {Auth,Env,Statement} from './types';
export type {RowGuard,CountGuard,JournalWrite} from '../../shared/journal';
const tables:JournalTable[]=['artists','albums','tracks'];
const encoder=new TextEncoder();
function chunks<T>(rows:T[]){
 const groups:T[][]=[];let group:T[]=[],size=2;
 for(const row of rows){const bytes=encoder.encode(JSON.stringify(row)).byteLength+1;if(bytes>1000000)fail('too_large','This edit is too large. Choose fewer rows.',413);
  if(group.length&&(group.length>=40||size+bytes>1000000)){groups.push(group);group=[];size=2;}group.push(row);size+=bytes;
 }if(group.length)groups.push(group);return groups;
}
const quote=(name:string)=>'"'+name+'"'; // Names only come from journalColumns.

/** Every write, including its journal, is conditional on one atomic gate. */
export async function writeJournal(env:Env,auth:Auth,plan:JournalWrite){
 if(auth.user.role==='listener')fail('forbidden','Your account cannot edit library metadata.',403);
 if(plan.ops.length>10000||(plan.undoIds?.length||0)>2000)fail('too_large','Choose fewer records at once.',413);
 let journalBytes=0;for(const op of plan.ops){journalBytes+=encoder.encode(JSON.stringify(op)).byteLength;if(journalBytes>16*1024**2)fail('too_large','This edit needs too much undo data. Choose fewer rows.',413);}
 if(!plan.ops.length&&!plan.undoIds?.length)return {changeId:plan.appendTo||null,updated:0};
 if(new Set(plan.ops.map(op=>op.table+':'+op.id)).size!==plan.ops.length)throw new Error('Consolidate repeated record operations before committing.');
 const now=Date.now(),gate=ulid(),changeId=plan.appendTo||ulid(),guardExists='EXISTS(SELECT 1 FROM mutation_guards WHERE id=?)';
 const guards=plan.guards||plan.ops.flatMap(op=>op.before?[{table:op.table,id:op.id,rev:op.before.rev}]:[]);
 const conditions=["u.id=? AND u.status='active' AND u.role IN ('owner','admin','uploader')"],parameters:unknown[]=[auth.user.id];
 for(const table of tables){
  const expected=guards.filter(row=>row.table===table).map(({id,rev})=>({id,rev}));
  if(expected.length){
   conditions.push(`NOT EXISTS(SELECT 1 FROM json_each(?) g LEFT JOIN ${table} r ON r.id=json_extract(g.value,'$.id') WHERE r.id IS NULL OR r.rev<>json_extract(g.value,'$.rev')${table==='artists'?'':" OR (r.owner_id<>u.id AND u.role NOT IN ('owner','admin'))"})`);parameters.push(JSON.stringify(expected));
  }
  const created=plan.ops.filter(op=>op.table===table&&!op.before);
  if(created.length){
   if(table!=='artists'&&!['owner','admin'].includes(auth.user.role)&&created.some(op=>op.after.owner_id!==auth.user.id))fail('forbidden','Choose records that belong to you.',403);
   conditions.push(`NOT EXISTS(SELECT 1 FROM ${table} r JOIN json_each(?) g ON r.id=g.value)`);parameters.push(JSON.stringify(created.map(op=>op.id)));
  }
 }
 const countGroups=new Map<string,CountGuard[]>();for(const guard of plan.counts||[]){
  if(!['tracks','albums'].includes(guard.table)||!['album_id','artist_id'].includes(guard.column)||guard.table==='albums'&&guard.column!=='artist_id')throw new Error('Invalid reference guard.');
  const key=guard.table+':'+guard.column,group=countGroups.get(key)||[];group.push(guard);countGroups.set(key,group);
 }
 for(const group of countGroups.values()){const first=group[0];conditions.push(`NOT EXISTS(SELECT 1 FROM json_each(?) g WHERE (SELECT COUNT(*) FROM ${first.table} r WHERE r.${first.column}=json_extract(g.value,'$.id') AND r.deleted=0)<>json_extract(g.value,'$.count'))`);parameters.push(JSON.stringify(group.map(({id,count})=>({id,count}))));}
 if(plan.appendTo){conditions.push('EXISTS(SELECT 1 FROM changes WHERE id=? AND user_id=u.id AND undone_at IS NULL AND undoable=1 AND created_at>=?)');parameters.push(plan.appendTo,now-30*86400000);}
 if(plan.undoIds?.length){conditions.push('(SELECT COUNT(*) FROM changes WHERE id IN(SELECT value FROM json_each(?)) AND user_id=u.id AND undone_at IS NULL AND undoable=1 AND created_at>=?)=?');parameters.push(JSON.stringify(plan.undoIds),now-30*86400000,plan.undoIds.length);}
 const statements:Statement[]=[stmt(env.DB,`INSERT INTO mutation_guards(id) SELECT ? FROM users u WHERE ${conditions.join(' AND ')}`,gate,...parameters)];
 if(!plan.appendTo)statements.push(stmt(env.DB,`INSERT INTO changes(id,user_id,actor,session_label,summary,ops,created_at,undoable) SELECT ?,?,'web',?,?,'[]',?,? WHERE ${guardExists}`,changeId,auth.user.id,auth.session.device_label,plan.summary,now,plan.undoable===false?0:1,gate));
 statements.push(stmt(env.DB,`UPDATE revs SET n=n+? WHERE id=1 AND ${guardExists}`,plan.ops.length,gate));
 const revision=(index:string)=>`(SELECT n FROM revs WHERE id=1)-${plan.ops.length}+${index}+1`;
 for(const table of tables){
  const indexed=plan.ops.map((op,index)=>({...op,index})).filter(op=>op.table===table);
  for(const creating of [true,false])for(const group of chunks(indexed.filter(op=>!op.before===creating))){
   const allowed=journalColumns[table],columns=allowed.filter(column=>group.some(op=>Object.hasOwn(op.after,column)));
   const payload=group.map(op=>({id:op.id,index:op.index,patch:Object.fromEntries(columns.filter(column=>Object.hasOwn(op.after,column)).map(column=>[column,op.after[column]]))}));
   if(creating){
    // Creation planners provide the same required fields for every new row in
    // a table. Nullable fields may still be omitted and use SQLite defaults.
    for(const column of columns)if(group.some(op=>!Object.hasOwn(op.after,column)))throw new Error('New records must provide a consistent field set.');
    const names=['id',...columns,'rev'],values=["json_extract(j.value,'$.id')",...columns.map(column=>`json_extract(j.value,'$.patch.${column}')`),revision("json_extract(j.value,'$.index')")];
    statements.push(stmt(env.DB,`INSERT INTO ${table}(${names.map(quote).join(',')}) SELECT ${values.join(',')} FROM json_each(?) j WHERE ${guardExists}`,JSON.stringify(payload),gate));
   }else{
    const setters=columns.map(column=>`${quote(column)}=CASE WHEN json_type(j.value,'$.patch.${column}') IS NOT NULL THEN json_extract(j.value,'$.patch.${column}') ELSE r.${quote(column)} END`);
    setters.push('rev='+revision("json_extract(j.value,'$.index')"));if(table==='tracks')setters.push('updated_at='+now);
    statements.push(stmt(env.DB,`UPDATE ${table} AS r SET ${setters.join(',')} FROM json_each(?) j WHERE r.id=json_extract(j.value,'$.id') AND ${guardExists}`,JSON.stringify(payload),gate));
   }
  }
 }
 for(const group of chunks(plan.ops.map((op,index)=>({...op,index})))){
  const payload=JSON.stringify(group.map(op=>({table:op.table,id:op.id,index:op.index,before:op.before,after:op.after})));
  if(new TextEncoder().encode(payload).byteLength>1500000)fail('too_large','This edit is too large. Choose fewer rows.',413);
  const rev=revision("json_extract(j.value,'$.index')");
  statements.push(stmt(env.DB,`INSERT INTO change_ops(change_id,position,table_name,row_id,before_json,after_json) SELECT ?,${rev},json_extract(j.value,'$.table'),json_extract(j.value,'$.id'),json_extract(j.value,'$.before'),json_set(json_extract(j.value,'$.after'),'$.rev',${rev}) FROM json_each(?) j WHERE ${guardExists}`,changeId,payload,gate));
 }
 if(plan.undoIds?.length)statements.push(stmt(env.DB,`UPDATE changes SET undone_at=? WHERE id IN(SELECT value FROM json_each(?)) AND user_id=? AND ${guardExists}`,now,JSON.stringify(plan.undoIds),auth.user.id,gate));
 statements.push(stmt(env.DB,'DELETE FROM mutation_guards WHERE id=?',gate));
 let result;try{result=await env.DB.batch(statements);}catch(error){if(/UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE/.test(error instanceof Error?error.message:''))throw new JournalConflict(guards.map(({table,id})=>({table,id})));throw error;}
 if(!result[0].meta.changes)throw new JournalConflict(guards.map(({table,id})=>({table,id})));
 return {changeId,updated:plan.ops.filter(op=>op.table==='tracks').length};
}
