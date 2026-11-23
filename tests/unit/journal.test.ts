import {describe,it,expect} from 'vitest';
import {journalOp,compactLegacyOp,undoPlan,JournalConflict,type JournalRow,type JournalChange} from '../../shared/journal';
const now=1700000000000,row=(rev:number,title='Before')=>({id:'track',rev,title,owner_id:'owner',album_id:'album',deleted:0,lyrics:'x'.repeat(200000),peaks:'y'.repeat(1336)});
const change=(id:string,before:JournalRow,after:JournalRow,at=now):JournalChange=>({id,created_at:at,undone_at:null,ops:[journalOp('tracks',before,after)!]});
describe('the batch undo journal',()=>{
 it('stores only changed metadata and revisions, excluding unchanged large fields',()=>{
  const before=row(1),after=row(2,'After'),op=journalOp('tracks',before,after)!;expect(op.before).toEqual({id:'track',rev:1,title:'Before'});expect(op.after).toEqual({id:'track',rev:2,title:'After'});expect(JSON.stringify(op).length).toBeLessThan(200);
 });
 it('restores exact edited data while leaving the current snapshots untouched',()=>{
  const before=row(1),after=row(2,'After'),current=new Map([['tracks:track',after]]),plan=undoPlan([change('one',before,after)],current,now);
  expect(plan.virtual.get('tracks:track')).toEqual(before);expect(current.get('tracks:track')).toEqual(after);expect(plan.ops[0].after.title).toBe('Before');expect(plan.guards[0].rev).toBe(2);
 });
 it('walks revision chains across both batches and appended artwork operations',()=>{
  const first=row(1),second=row(2,'Second'),third=row(3,'Third');const actions=[change('one',first,second,now-1),change('two',second,third,now)];
  const plan=undoPlan(actions,new Map([['tracks:track',third]]),now);expect(plan.ops).toHaveLength(1);expect(plan.virtual.get('tracks:track')).toEqual(first);
  const album1={id:'album',rev:1,title:'Old',art_key:'old'},album2={...album1,rev:2,title:'New'},album3={...album2,rev:3,art_key:'new'};
  const albumPlan=undoPlan([{id:'edit',created_at:now,undone_at:null,ops:[journalOp('albums',album1,album2)!,journalOp('albums',album2,album3)!]}],new Map([['albums:album',album3]]),now);expect(albumPlan.virtual.get('albums:album')).toEqual(album1);
 });
 it('rejects a whole batch after any later change',()=>{
  const before=row(1),after=row(2,'After');expect(()=>undoPlan([change('one',before,after)],new Map([['tracks:track',row(3,'Someone edited this')]]),now)).toThrow(JournalConflict);
  try{undoPlan([change('one',before,after)],new Map(),now);}catch(error){expect((error as JournalConflict).conflicts).toEqual([{table:'tracks',id:'track'}]);}
 });
 it('uses global revisions for same-millisecond edits and interleaved appended operations',()=>{
  const a=row(1),b=row(2,'Second'),c=row(3,'Third'),albumBefore={id:'album',rev:1,title:'Album',art_key:'old'},albumAfter={...albumBefore,rev:4,art_key:'new'};
  const first=change('z-older',a,b),second=change('a-newer',b,c);first.ops.push(journalOp('albums',albumBefore,albumAfter)!);
  const plan=undoPlan([first,second],new Map([['tracks:track',c],['albums:album',albumAfter]]),now);expect(plan.virtual.get('tracks:track')).toEqual(a);expect(plan.virtual.get('albums:album')).toEqual(albumBefore);
 });
 it('turns newly imported rows into tombstones and compacts old upload snapshots',()=>{
  const created=row(2),legacy=compactLegacyOp({table:'tracks',id:'track',before:null,after:created});expect(legacy.after).toEqual({id:'track',rev:2});
  const plan=undoPlan([{id:'upload',created_at:now,undone_at:null,ops:[legacy]}],new Map([['tracks:track',created]]),now);expect(plan.virtual.get('tracks:track')!.deleted).toBe(1);expect(plan.ops[0].after.deleted).toBe(1);
 });
 it('refuses expired or previously undone actions',()=>{
  const action=change('one',row(1),row(2));expect(()=>undoPlan([{...action,created_at:now-31*86400000}],new Map(),now)).toThrow('30 days');expect(()=>undoPlan([{...action,undone_at:now}],new Map(),now)).toThrow('already undone');
  expect(()=>undoPlan([{...action,undoable:0}],new Map(),now)).toThrow('cannot be undone');
 });
 it('reverses five hundred metadata changes as a single bounded plan',()=>{
  const before=Array.from({length:500},(_,i)=>({...row(i+1),id:String(i),lyrics:''})),after=before.map((r,i)=>({...r,title:'Renamed '+i,rev:1000+i}));
  const action={id:'bulk',created_at:now,undone_at:null,ops:before.map((r,i)=>journalOp('tracks',r,after[i])!)};
  const result=undoPlan([action],new Map(after.map(r=>['tracks:'+r.id,r])),now);expect(result.ops).toHaveLength(500);expect(result.changeIds).toEqual(['bulk']);expect([...result.virtual.values()].map(r=>r.title)).toEqual(before.map(r=>r.title));
 });
});
