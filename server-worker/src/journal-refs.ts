import {JournalConflict,type JournalOp,type JournalRow} from '../../shared/journal';
import {stmt} from './db';
import type {Env} from './types';
import type {CountGuard} from './journal';

/** A created album/artist cannot be removed after someone added new children. */
export async function undoReferenceGuards(env:Env,ops:JournalOp[],virtual:Map<string,JournalRow>){
 const deletingAlbums=ops.filter(op=>op.table==='albums'&&op.after.deleted===1&&op.before?.deleted!==1).map(op=>op.id),deletingArtists=ops.filter(op=>op.table==='artists'&&op.after.deleted===1&&op.before?.deleted!==1).map(op=>op.id);
 const tracks=[...virtual].filter(([key])=>key.startsWith('tracks:')).map(([,row])=>row),albums=[...virtual].filter(([key])=>key.startsWith('albums:')).map(([,row])=>row);
 const conflicts=new Map<string,{table:'albums'|'artists';id:string}>();
 for(const id of deletingAlbums)if(tracks.some(row=>!row.deleted&&row.album_id===id))conflicts.set('albums:'+id,{table:'albums',id});
 for(const id of deletingArtists)if(tracks.some(row=>!row.deleted&&row.artist_id===id)||albums.some(row=>!row.deleted&&row.artist_id===id))conflicts.set('artists:'+id,{table:'artists',id});
 const definitions:[CountGuard['table'],CountGuard['column'],string[],string[],'albums'|'artists'][]=[['tracks','album_id',deletingAlbums,tracks.map(row=>row.id),'albums'],['tracks','artist_id',deletingArtists,tracks.map(row=>row.id),'artists'],['albums','artist_id',deletingArtists,albums.map(row=>row.id),'artists']];
 const selected=definitions.filter(([, ,ids])=>ids.length),queries=selected.map(([table,column,ids,affected])=>stmt(env.DB,`SELECT ${column} AS target_id,COUNT(*) AS n,SUM(CASE WHEN id NOT IN(SELECT value FROM json_each(?)) THEN 1 ELSE 0 END) AS outside_count FROM ${table} WHERE deleted=0 AND ${column} IN(SELECT value FROM json_each(?)) GROUP BY ${column}`,JSON.stringify(affected),JSON.stringify(ids)));
 const guards:CountGuard[]=[];if(queries.length){const results=await env.DB.batch(queries);
  for(let i=0;i<results.length;i++){const[table,column,ids,,target]=selected[i],counts=new Map((results[i].results||[]).map(row=>[String(row.target_id),row]));
   for(const id of ids){const row=counts.get(id);guards.push({table,column,id,count:Number(row?.n||0)});if(Number(row?.outside_count)>0)conflicts.set(target+':'+id,{table:target,id});}
  }
 }
 if(conflicts.size)throw new JournalConflict([...conflicts.values()]);return guards;
}
