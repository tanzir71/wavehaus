import {UploadError} from './upload-input';
export type JournalTable='tracks'|'albums'|'artists'|'playlists'|'playlist_items';
export const reversibleOperation=(op:JournalOp)=>op.table!=='artists'||!op.before||Object.keys(op.after).some(key=>key!=='id'&&key!=='rev');
export type JournalRow=Record<string,unknown>&{id:string;rev:number};
export interface JournalOp {table:JournalTable;id:string;before:JournalRow|null;after:JournalRow}
export interface JournalChange {id:string;created_at:number;undone_at:number|null;undoable?:number;ops:JournalOp[]}
export interface RowGuard {table:JournalTable;id:string;rev:number}
export interface CountGuard {table:'tracks'|'albums'|'playlist_items';column:'album_id'|'artist_id'|'playlist_id';id:string;count:number}
export interface JournalWrite {summary:string;ops:JournalOp[];guards?:RowGuard[];counts?:CountGuard[];appendTo?:string;undoIds?:string[];undoable?:boolean}
export const journalColumns:Record<JournalTable,readonly string[]>={
 tracks:['owner_id','album_id','artist_id','title','artist_name','album_artist','album_title','track_no','disc_no','year','genre','bpm','duration_ms','codec','container','bitrate','sample_rate','bit_depth','channels','replaygain_track_db','replaygain_album_db','has_lyrics','lyrics','lyrics_synced','peaks','storage_key','size_bytes','sha256','quick_hash','original_name','original_path','mime','visibility','organise_source','added_at','deleted'],
 albums:['owner_id','title','artist_id','artist_name','year','art_source','art_key','tint','visibility','sync_visibility','folder_path','created_at','deleted','merge_key','identity_key'],
 artists:['name','sort_name','tint','deleted','name_key'],
 playlists:['owner_id','name','description','kind','rules','cover_key','visibility','sync_visibility','created_at','updated_at','deleted'],
 playlist_items:['owner_id','playlist_id','track_id','position','added_at','deleted'],
};
export const rowKey=(table:JournalTable,id:string)=>table+':'+id;
export class JournalConflict extends UploadError {
 constructor(public conflicts:{table:JournalTable;id:string}[]){super('conflict','Some rows changed after this action. Your library has not been changed.',409);}
}
/** Store changed fields, not copies of unmodified lyrics and waveform data. */
export function journalOp(table:JournalTable,before:JournalRow|null,after:JournalRow):JournalOp|null {
 const previous:JournalRow|null=before?{id:before.id,rev:before.rev}:null,next:JournalRow={id:after.id,rev:after.rev};let changed=false;
 for(const column of journalColumns[table]){
  if(!(column in after))continue;if(before&&Object.is(before[column],after[column]))continue;
  next[column]=after[column];if(previous)previous[column]=before![column]??null;changed=true;
 }
 return changed?{table,id:after.id,before:previous,after:next}:null;
}
/** Compact a full snapshot written by older releases before loading its rows. */
export function compactLegacyOp(op:JournalOp):JournalOp {
 if(!op.before)return {table:op.table,id:op.id,before:null,after:{id:op.id,rev:op.after.rev}};
 return journalOp(op.table,op.before,op.after)||{table:op.table,id:op.id,before:{id:op.id,rev:op.before.rev},after:{id:op.id,rev:op.after.rev}};
}
/**
 * Simulate the complete reverse first. Several actions can touch the same row;
 * its virtual revision walks back through their snapshots before any write.
 * The adapter must recheck guards atomically and allocate fresh revisions.
 */
export function undoPlan(changes:JournalChange[],current:Map<string,JournalRow>,now=Date.now()){
 if(!changes.length)throw new UploadError('validation','Choose an action to undo.');
 if(changes.length>2000||changes.reduce((n,c)=>n+c.ops.length,0)>10000)throw new UploadError('too_large','Undo fewer actions at once.',413);
 if(changes.some(change=>change.undone_at!==null))throw new UploadError('already_undone','An action in this batch was already undone.',409);
 if(changes.some(change=>change.created_at<now-30*86400000))throw new UploadError('undo_expired','Undo is available for 30 days.',409);
 if(changes.some(change=>!change.ops.length))throw new UploadError('not_undoable','This action cannot be undone.');
 if(changes.some(change=>change.undoable===0))throw new UploadError('not_undoable','This action cannot be undone.');
 const virtual=new Map([...current].map(([key,row])=>[key,{...row}])),touched=new Map<string,{table:JournalTable;id:string}>(),conflicts=new Map<string,{table:JournalTable;id:string}>();
 const latest=(change:JournalChange)=>change.ops.reduce((rev,op)=>Math.max(rev,op.after.rev),0);
 const ordered=[...changes].sort((a,b)=>latest(b)-latest(a)||b.created_at-a.created_at||b.id.localeCompare(a.id));
 // An artwork operation can be appended to an earlier metadata action after
 // another action touched its track. Global revisions preserve that ordering.
 const operations=changes.flatMap(change=>change.ops.map((op,index)=>({op,index}))).sort((a,b)=>b.op.after.rev-a.op.after.rev||b.index-a.index);
 for(const {op}of operations){
  if(!Object.hasOwn(journalColumns,op.table))throw new UploadError('not_undoable','This action uses an unsupported record type.');
  const key=rowKey(op.table,op.id),row=virtual.get(key);touched.set(key,{table:op.table,id:op.id});
  if(!row||row.rev!==op.after.rev){conflicts.set(key,{table:op.table,id:op.id});continue;}
  if(op.before){for(const column of journalColumns[op.table])if(column in op.before)row[column]=op.before[column];row.rev=op.before.rev;}
  else{row.deleted=1;row.rev=0;}
 }
 if(conflicts.size)throw new JournalConflict([...conflicts.values()]);
 const ops:JournalOp[]=[],guards:({table:JournalTable}&JournalRow)[]=[];
 for(const[key,record]of touched){const before=current.get(key)!,after=virtual.get(key)!;guards.push({table:record.table,...before});const op=journalOp(record.table,before,after);if(op)ops.push(op);else if(record.table==='playlists')ops.push({table:'playlists',id:before.id,before:{id:before.id,rev:before.rev},after:{id:before.id,rev:before.rev}});}
 return {ops,guards,changeIds:ordered.map(change=>change.id),virtual};
}
