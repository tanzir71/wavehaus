import {rowIds} from './edit-input';
import {JournalConflict,type JournalWrite,type CountGuard} from './journal';
import {UploadError} from './upload-input';
import type {MetadataRepository,EditContext} from './edit-plan';
export function deleteInput(raw:Record<string,unknown>){
 const ids=rowIds(raw.ids),expectedRevs:Record<string,number>={};if(raw.expectedRevs!==undefined){const values=raw.expectedRevs;if(!values||typeof values!=='object'||Array.isArray(values))throw new UploadError('validation','Expected revisions must be an object.');for(const[id,rev]of Object.entries(values)){if(!ids.includes(id)||!Number.isSafeInteger(rev)||Number(rev)<0)throw new UploadError('validation','Expected revisions must match selected tracks.');expectedRevs[id]=Number(rev);}}
 return {ids,expectedRevs};
}
export async function deletePlan(input:ReturnType<typeof deleteInput>,repo:MetadataRepository,context:EditContext){
 if(context.role==='listener')throw new UploadError('forbidden','Your account cannot delete library tracks.',403);
 const tracks=await repo.tracks(input.ids);if(tracks.length!==input.ids.length)throw new UploadError('not_found','A selected track was not found.',404);
 if(!['owner','admin'].includes(context.role)&&tracks.some(row=>row.owner_id!==context.userId))throw new UploadError('forbidden','Choose tracks that belong to you.',403);
 const stale=tracks.filter(row=>Object.hasOwn(input.expectedRevs,row.id)&&input.expectedRevs[row.id]!==row.rev);if(stale.length)throw new JournalConflict(stale.map(row=>({table:'tracks',id:row.id})));
 const ids=[...new Set(tracks.map(row=>String(row.album_id)))],albums=await repo.albums(ids),totals=await repo.counts(ids),counts:CountGuard[]=[],write:JournalWrite={summary:`Deleted ${tracks.length} tracks`,ops:tracks.map(row=>({table:'tracks',id:row.id,before:{id:row.id,rev:row.rev,deleted:0},after:{id:row.id,rev:row.rev,deleted:1}}))},generatedAlbumIds:string[]=[];
 for(const album of albums){const selected=tracks.filter(row=>row.album_id===album.id).length;if(selected===totals.get(album.id)){counts.push({table:'tracks',column:'album_id',id:album.id,count:selected});write.ops.push({table:'albums',id:album.id,before:{id:album.id,rev:album.rev,deleted:0},after:{id:album.id,rev:album.rev,deleted:1}});}else if(album.art_source==='generated')generatedAlbumIds.push(album.id);}
 write.counts=counts;return {write,updated:tracks.length,generatedAlbumIds};
}
