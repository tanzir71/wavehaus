import {journalColumns,type JournalChange,type JournalOp,type JournalRow,type JournalTable} from '../../shared/journal';
import {stmt,all} from './db';
import {fail} from './http';
import type {Auth,Env,Statement} from './types';
const tables=Object.keys(journalColumns) as JournalTable[],encoder=new TextEncoder();
const groups=<T>(rows:T[])=>Array.from({length:Math.ceil(rows.length/40)},(_,i)=>rows.slice(i*40,(i+1)*40));
const permitted=(key:string)=>tables.map(table=>`(json_extract(j.value,'$.table')='${table}' AND ${key} IN(${journalColumns[table].map(column=>`'${column}'`).join(',')}))`).join(' OR ');
function legacySnapshot(side:'before'|'after'){
 const other=side==='before'?'after':'before',changed=`(${permitted('k.key')}) AND k.value IS NOT json_extract(j.value,'$.${other}.'||k.key)`;
 const filter=side==='after'?`k.key IN('id','rev') OR (json_type(j.value,'$.before')<>'null' AND ${changed})`:`k.key IN('id','rev') OR (${changed})`;
 const compact=`(SELECT json_group_object(k.key,k.value) FROM json_each(j.value,'$.${side}') k WHERE ${filter})`;
 return side==='before'?`CASE WHEN json_extract(j.value,'$.before') IS NULL THEN NULL ELSE ${compact} END`:compact;
}

/** Read old and new journals without returning unmodified lyrics from D1. */
export async function readJournalChanges(env:Env,auth:Auth,ids:string[]){
 if(!ids.length)return [];
 const parents=await all<Omit<JournalChange,'ops'>>(env.DB,'SELECT id,created_at,undone_at,undoable FROM changes WHERE user_id=? AND id IN(SELECT value FROM json_each(?))',auth.user.id,JSON.stringify(ids));
 if(parents.length!==ids.length)fail('not_found','An action was not found in your activity.',404);
 const changes=new Map(parents.map(parent=>[parent.id,{...parent,ops:[] as JournalOp[]}]))
 const selected=JSON.stringify(ids),before=legacySnapshot('before'),after=legacySnapshot('after');
 const costs=await all<{bytes:number;n:number}>(env.DB,`SELECT COALESCE(SUM(bytes),0) AS bytes,COUNT(*) AS n FROM(SELECT COALESCE(length(CAST(${before} AS BLOB)),0)+COALESCE(length(CAST(${after} AS BLOB)),0) AS bytes FROM changes c,json_each(c.ops) j WHERE c.user_id=? AND c.id IN(SELECT value FROM json_each(?)) UNION ALL SELECT COALESCE(length(CAST(o.before_json AS BLOB)),0)+length(CAST(o.after_json AS BLOB)) FROM change_ops o JOIN changes c ON c.id=o.change_id WHERE c.user_id=? AND c.id IN(SELECT value FROM json_each(?)))`,auth.user.id,selected,auth.user.id,selected);
 if(costs[0].bytes>16*1024**2||costs[0].n>10000)fail('too_large','Undo fewer actions at once.',413);
 const queries:Statement[]=[];
 for(const group of groups(ids)){
  const selected=JSON.stringify(group);
  queries.push(stmt(env.DB,`SELECT c.id AS change_id,json_extract(j.value,'$.table') AS table_name,json_extract(j.value,'$.id') AS row_id,${legacySnapshot('before')} AS before_json,${legacySnapshot('after')} AS after_json FROM changes c,json_each(c.ops) j WHERE c.user_id=? AND c.id IN(SELECT value FROM json_each(?))`,auth.user.id,selected));
  queries.push(stmt(env.DB,'SELECT o.change_id,o.table_name,o.row_id,o.before_json,o.after_json FROM change_ops o JOIN changes c ON c.id=o.change_id WHERE c.user_id=? AND c.id IN(SELECT value FROM json_each(?)) ORDER BY o.position',auth.user.id,selected));
 }
 let bytes=0,count=0;for(const result of await env.DB.batch(queries))for(const raw of result.results||[]){
  bytes+=encoder.encode(String(raw.before_json||'')+String(raw.after_json||'')).byteLength;if(bytes>16*1024**2||++count>10000)fail('too_large','Undo fewer actions at once.',413);
  const table=String(raw.table_name) as JournalTable;if(!Object.hasOwn(journalColumns,table))fail('not_undoable','This action uses an unsupported record type.');
  const id=String(raw.row_id),before=raw.before_json===null?null:JSON.parse(String(raw.before_json)),after=JSON.parse(String(raw.after_json));
  if(!after||after.id!==id||!Number.isSafeInteger(after.rev)||before&&(!Number.isSafeInteger(before.rev)||before.id!==id))fail('not_undoable','This saved action is incomplete.');
  changes.get(String(raw.change_id))!.ops.push({table,id,before,after});
 }return [...changes.values()];
}

/** Fetch only fields involved in the action, plus ownership and references. */
export async function readJournalRows(env:Env,ops:JournalOp[]){
 const queries:Statement[]=[],queryTables:JournalTable[]=[],costQueries:Statement[]=[];
 for(const table of tables){
  const selected=ops.filter(op=>op.table===table);if(!selected.length)continue;
  const columns=new Set(['id','rev','deleted',...(table==='artists'?[]:['owner_id','visibility']),...(table==='tracks'?['album_id','artist_id']:table==='albums'?['artist_id']:[])]);
  for(const op of selected)for(const column of [...Object.keys(op.before||{}),...Object.keys(op.after)])if(journalColumns[table].includes(column))columns.add(column);
  const fields=[...columns];let rowJson=`json_object(${fields.slice(0,16).map(column=>`'${column}',"${column}"`).join(',')})`;
  for(let start=16;start<fields.length;start+=15)rowJson=`json_set(${rowJson},${fields.slice(start,start+15).map(column=>`'$.${column}',"${column}"`).join(',')})`;
  costQueries.push(stmt(env.DB,`SELECT COALESCE(SUM(length(CAST(${rowJson} AS BLOB))),0) AS bytes FROM ${table} WHERE id IN(SELECT value FROM json_each(?))`,JSON.stringify([...new Set(selected.map(op=>op.id))])));
  for(const ids of groups([...new Set(selected.map(op=>op.id))])){queries.push(stmt(env.DB,`SELECT ${[...columns].map(column=>'"'+column+'"').join(',')} FROM ${table} WHERE id IN(SELECT value FROM json_each(?))`,JSON.stringify(ids)));queryTables.push(table);}
 }
 if(!queries.length)return new Map<string,JournalRow>();
 const costs=await env.DB.batch(costQueries);if(costs.reduce((bytes,result)=>bytes+Number(result.results?.[0]?.bytes||0),0)>16*1024**2)fail('too_large','Undo fewer actions at once.',413);
 const current=new Map<string,JournalRow>();let bytes=0;const results=await env.DB.batch(queries);
 for(let i=0;i<results.length;i++)for(const raw of results[i].results||[]){bytes+=encoder.encode(JSON.stringify(raw)).byteLength;if(bytes>16*1024**2)fail('too_large','Undo fewer actions at once.',413);const row=raw as JournalRow;current.set(queryTables[i]+':'+row.id,row);}
 return current;
}
