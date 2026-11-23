import {describe,it,expect} from 'vitest';
import {editInput,metadataPatch,rowIds,albumPatchInput} from '../../shared/edit-input';
const id=(n:number)=>'01J'+'0'.repeat(19)+String(n).padStart(4,'0');
describe('bulk metadata requests',()=>{
 it('accepts a five-hundred-track rename in one validated payload',()=>{
  const ids=Array.from({length:500},(_,i)=>id(i)),perId=Object.fromEntries(ids.map((id,i)=>[id,{title:'Song '+(i+1)}]));
  const parsed=editInput({ids,perId,expectedRevs:{[ids[0]]:42}});expect(parsed.ids).toHaveLength(500);expect(Object.keys(parsed.perId)).toHaveLength(500);expect(parsed.expectedRevs[ids[0]]).toBe(42);
 });
 it('deduplicates IDs and distinguishes untouched fields from explicit clears',()=>{
  expect(editInput({ids:[id(1),id(1)],set:{genre:null,year:null}})).toMatchObject({ids:[id(1)],set:{genre:null,year:null},perId:{}});
  expect(metadataPatch({albumArtist:null,trackNo:null})).toEqual({albumArtist:null,trackNo:null});
 });
 it('rejects attempts to edit ownership, bytes, revisions or visibility',()=>{
  for(const field of ['owner_id','album_id','storage_key','sha256','rev','deleted','visibility','__proto__'])expect(()=>metadataPatch(JSON.parse(`{"${field}":"public"}`))).toThrow();
 });
 it('bounds editable values and per-track keys before any data is changed',()=>{
  for(const patch of [{title:''},{artist:null},{artist:'x'.repeat(201)},{trackNo:0},{discNo:1000},{year:3000},{title:'bad\u0000title'},{genre:[]},{year:'2026'}])expect(()=>metadataPatch(patch)).toThrow();
  for(const request of [{ids:[],set:{title:'A'}},{ids:[id(1)],perId:{[id(2)]:{title:'A'}}},{ids:[id(1)],set:{}},{ids:[id(1)],set:{title:'A'},expectedRevs:{[id(2)]:1}},{ids:[id(1)],set:{title:'A'},dryRun:'yes'}])expect(()=>editInput(request)).toThrow();
  expect(()=>rowIds(['not-an-id'])).toThrow();expect(()=>rowIds(Array(2001).fill(id(1)))).toThrow();
 });
 it('validates album identity changes without accepting privacy fields',()=>{
  expect(albumPatchInput({title:'Shore',artistName:'Halden',year:null})).toEqual({title:'Shore',artistName:'Halden',year:null});expect(()=>albumPatchInput({visibility:'public'})).toThrow();
 });
});
