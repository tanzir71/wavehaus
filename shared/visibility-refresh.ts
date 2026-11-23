import type {JournalRow,JournalWrite,JournalTable} from './journal';
export function refreshTargets(plan:JournalWrite){const ids=(table:string)=>plan.ops.filter(op=>op.table===table&&(op.after.visibility==='public'||op.after.deleted===0)).map(op=>op.id);return {trackIds:ids('tracks'),albumIds:ids('albums'),playlistIds:ids('playlists')};}
/** Revision-only relationship refreshes never become user-editable undo data. */
export function visibilityRefresh(plan:JournalWrite,artists:JournalRow[],items:JournalRow[]){
 const targets=refreshTargets(plan),guards=plan.guards||plan.ops.flatMap(op=>op.before?[{table:op.table,id:op.id,rev:op.before.rev}]:[]),next:JournalWrite={...plan,ops:[...plan.ops],guards:[...guards],counts:[...(plan.counts||[])]},seen=new Set(plan.ops.map(op=>op.table+':'+op.id));
 const touch=(table:JournalTable,row:JournalRow)=>{const key=table+':'+row.id;if(seen.has(key))return;seen.add(key);next.ops.push({table,id:row.id,before:{id:row.id,rev:row.rev},after:{id:row.id,rev:row.rev},system:true});next.guards!.push({table,id:row.id,rev:row.rev,system:true});};
 for(const row of artists)touch('artists',row);for(const row of items)touch('playlist_items',row);
 for(const id of targets.trackIds)next.counts!.push({table:'playlist_items',column:'track_id',id,count:items.filter(item=>item.track_id===id).length});for(const id of targets.playlistIds)if(!next.counts!.some(guard=>guard.table==='playlist_items'&&guard.column==='playlist_id'&&guard.id===id))next.counts!.push({table:'playlist_items',column:'playlist_id',id,count:items.filter(item=>item.playlist_id===id).length});return next;
}
