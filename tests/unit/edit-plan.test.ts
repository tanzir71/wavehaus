import {describe,it,expect} from 'vitest';
import {metadataPlan,type MetadataRepository} from '../../shared/edit-plan';
import {editInput} from '../../shared/edit-input';
import type {JournalRow} from '../../shared/journal';
const id=(n:number)=>'01J'+'0'.repeat(19)+String(n).padStart(4,'0'),key=(artist:string,title:string)=>artist.toLowerCase()+'\x1f'+title.toLowerCase();
function fixture(n=3){
 const owner=id(9000),artist:JournalRow={id:id(9001),rev:1,name:'Artist',name_key:'artist',sort_name:'Artist',tint:0,deleted:0},album:JournalRow={id:id(9002),rev:2,owner_id:owner,title:'Album',artist_id:artist.id,artist_name:'Artist',identity_key:key('Artist','Album'),merge_key:key('Artist','Album'),visibility:'private',sync_visibility:1,year:2024,art_source:'generated',art_key:'original-art',tint:0,created_at:1,deleted:0},tracks:JournalRow[]=Array.from({length:n},(_,i)=>({id:id(i),rev:i+3,owner_id:owner,title:'Song '+i,artist_id:artist.id,artist_name:'Artist',album_id:album.id,album_artist:'Artist',album_title:'Album',track_no:i+1,disc_no:1,year:2024,genre:null,visibility:'private',organise_source:'tags',deleted:0})),albums=[album],artists=[artist];let next=7000;
 const repo:MetadataRepository={tracks:async ids=>tracks.filter(row=>ids.includes(row.id)),albums:async ids=>albums.filter(row=>ids.includes(row.id)),targets:async pairs=>albums.filter(row=>pairs.some(pair=>pair.ownerId===row.owner_id&&pair.key===row.identity_key)),artists:async keys=>artists.filter(row=>keys.includes(String(row.name_key))),counts:async ids=>new Map(ids.map(id=>[id,tracks.filter(row=>row.album_id===id&&!row.deleted).length]))};
 return {owner,artist,album,tracks,albums,artists,repo,context:{userId:owner,role:'owner',id:()=>id(next++),hash:async(value:string)=>value,now:1700000000000}};
}
describe('bulk metadata decisions',()=>{
 it('plans one five-hundred-title update without touching the source album or audio',async()=>{
  const f=fixture(500),before=structuredClone(f.tracks),perId=Object.fromEntries(f.tracks.map((row,i)=>[row.id,{title:'Renamed '+i}]));const plan=await metadataPlan(editInput({ids:f.tracks.map(row=>row.id),perId}),f.repo,f.context);
  expect(plan.updated).toBe(500);expect(plan.write.ops).toHaveLength(500);expect(plan.write.summary).toBe('Renamed 500 tracks');expect(plan.write.ops.every(op=>op.table==='tracks'&&!('storage_key'in op.after))).toBe(true);expect(plan.generatedAlbumIds).toEqual([]);expect(f.tracks).toEqual(before);
 });
 it('does not log unchanged values',async()=>{
  const f=fixture();const plan=await metadataPlan(editInput({ids:[f.tracks[0].id],set:{title:'Song 0'}}),f.repo,f.context);expect(plan.write.ops).toEqual([]);expect(plan.updated).toBe(0);
 });
 it('keeps a nullable stored album artist distinct from its dictionary display fallback',async()=>{
  const f=fixture();f.album.artist_name=null;f.album.dictionary_artist_name='Artist';f.tracks[0].album_artist=null;const plan=await metadataPlan(editInput({ids:[f.tracks[0].id],set:{title:'Changed'}}),f.repo,f.context);expect(plan.preview[0].after.album_id).toBe(f.album.id);expect(plan.write.ops.some(op=>op.table==='albums')).toBe(false);
 });
 it('renames a whole album in place and preserves mixed visibility',async()=>{
  const f=fixture();f.album.visibility='public';f.tracks[0].visibility='public';const plan=await metadataPlan(editInput({ids:f.tracks.map(row=>row.id),set:{album:'New title',albumArtist:'Mira',year:2025}}),f.repo,f.context),album=plan.write.ops.find(op=>op.table==='albums')!;
  expect(album.id).toBe(f.album.id);expect(album.before).not.toBeNull();expect(album.after).toMatchObject({title:'New title',artist_name:'Mira',year:2025});expect(plan.preview.map(row=>row.after.visibility)).toEqual(['public','private','private']);expect(plan.published).toBe(0);expect(plan.generatedAlbumIds).toEqual([f.album.id]);expect(plan.write.counts).toContainEqual({table:'tracks',column:'album_id',id:f.album.id,count:3});
 });
 it('splits a subset into a private album while keeping the source',async()=>{
  const f=fixture();f.tracks[0].visibility='public';const plan=await metadataPlan(editInput({ids:[f.tracks[0].id],set:{album:'Split'}}),f.repo,f.context),created=plan.write.ops.find(op=>op.table==='albums')!;
  expect(created.before).toBeNull();expect(created.after).toMatchObject({title:'Split',owner_id:f.owner,visibility:'private',art_key:'original-art'});expect(plan.madePrivate).toBe(1);expect(plan.write.ops.some(op=>op.id===f.album.id&&op.after.deleted===1)).toBe(false);expect(plan.generatedAlbumIds).toContain(f.album.id);expect(plan.generatedAlbumIds).toContain(created.id);
 });
 it('merges into the existing uploader-owned album and confirms any publication',async()=>{
  const f=fixture(),target={...f.album,id:id(8000),rev:20,title:'Target',identity_key:key('Artist','Target'),merge_key:key('Artist','Target'),visibility:'public'};f.albums.push(target);
  const payload={ids:f.tracks.map(row=>row.id),set:{album:'Target'}};await expect(metadataPlan(editInput(payload),f.repo,f.context)).rejects.toMatchObject({code:'publish_confirmation_required'});
  const preview=await metadataPlan(editInput({...payload,dryRun:true}),f.repo,f.context);expect(preview.published).toBe(3);
  const plan=await metadataPlan(editInput({...payload,publishConfirmed:true}),f.repo,f.context);expect(plan.preview.every(row=>row.after.album_id===target.id&&row.after.visibility==='public')).toBe(true);expect(plan.write.ops.find(op=>op.id===f.album.id)!.after.deleted).toBe(1);expect(plan.write.ops.some(op=>op.table==='albums'&&op.before===null)).toBe(false);
 });
 it('honours an album with visibility sync disabled',async()=>{
  const f=fixture();f.albums.push({...f.album,id:id(8000),rev:20,title:'Target',identity_key:key('Artist','Target'),visibility:'public',sync_visibility:0});const plan=await metadataPlan(editInput({ids:[f.tracks[0].id],set:{album:'Target'}}),f.repo,f.context);expect(plan.published).toBe(0);expect(plan.preview[0].after.visibility).toBe('private');
 });
 it('combines two fully selected source albums without creating duplicate targets',async()=>{
  const f=fixture(2),other={...f.album,id:id(8000),title:'Other',rev:10,identity_key:key('Artist','Other'),merge_key:key('Artist','Other'),created_at:2};f.albums.push(other);f.tracks[1].album_id=other.id;f.tracks[1].album_title='Other';const plan=await metadataPlan(editInput({ids:f.tracks.map(row=>row.id),set:{album:'Together'}}),f.repo,f.context);expect(new Set(plan.preview.map(row=>row.after.album_id)).size).toBe(1);expect(plan.write.ops.filter(op=>op.table==='albums'&&op.after.deleted!==1)).toHaveLength(1);
 });
 it('keeps a deliberately separate album separate for unrelated edits',async()=>{
  const f=fixture();f.album.merge_key='salted-import-key';f.albums.push({...f.album,id:id(8000),rev:20,merge_key:key('Artist','Album')});const plan=await metadataPlan(editInput({ids:[f.tracks[0].id],set:{genre:'Ambient'}}),f.repo,f.context);expect(plan.preview[0].after.album_id).toBe(f.album.id);expect(plan.write.ops.filter(op=>op.table==='albums')).toEqual([]);
 });
 it('allows an album display-name case fix without changing the global artist',async()=>{
  const f=fixture();const plan=await metadataPlan(editInput({ids:f.tracks.map(row=>row.id),set:{albumArtist:'ARTIST'}}),f.repo,f.context);expect(plan.write.ops.find(op=>op.table==='albums')!.after.artist_name).toBe('ARTIST');expect(plan.write.ops.some(op=>op.table==='artists')).toBe(false);
 });
 it('checks roles, ownership and stale revisions before planning a write',async()=>{
  const f=fixture(),input=editInput({ids:[f.tracks[0].id],set:{title:'New'}});await expect(metadataPlan(input,f.repo,{...f.context,role:'listener'})).rejects.toMatchObject({status:403});await expect(metadataPlan(input,f.repo,{...f.context,userId:id(5555),role:'uploader'})).rejects.toMatchObject({status:403});await expect(metadataPlan(editInput({...input,expectedRevs:{[f.tracks[0].id]:999}}),f.repo,f.context)).rejects.toMatchObject({code:'conflict'});
 });
 it('never lets an admin publish another uploader’s tracks through a move',async()=>{
  const f=fixture();f.albums.push({...f.album,id:id(8000),rev:20,title:'Target',identity_key:key('Artist','Target'),visibility:'public'});await expect(metadataPlan(editInput({ids:[f.tracks[0].id],set:{album:'Target'},publishConfirmed:true}),f.repo,{...f.context,userId:id(5555),role:'admin'})).rejects.toMatchObject({status:403});
 });
 it('rejects a target album that changed after the impact preview',async()=>{
  const f=fixture(),target={...f.album,id:id(8000),rev:20,title:'Target',identity_key:key('Artist','Target'),visibility:'public'};f.albums.push(target);await expect(metadataPlan(editInput({ids:[f.tracks[0].id],set:{album:'Target'},publishConfirmed:true,expectedAlbumRevs:{[target.id]:19}}),f.repo,f.context)).rejects.toMatchObject({code:'conflict',conflicts:[{table:'albums',id:target.id}]});
 });
});
