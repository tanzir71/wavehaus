import {describe,it,expect} from 'vitest';
import {organise,titleCase,stripJunk,organiseBatch,groupOrganised} from '../../app/src/upload/organise';
import {organiseCases} from '../fixtures/organise-cases';

describe('the independently labelled organise fixture library',()=>{
 it('contains at least sixty cases',()=>expect(organiseCases.length).toBeGreaterThanOrEqual(60));
 for(const [name,filename,path,tags,expected] of organiseCases)it(name,()=>expect(organise(filename,path,tags)).toMatchObject(expected));
});
describe('batch organisation',()=>{
 const songs=(artists=['One','Two','Three','Four'])=>artists.map((artist,i)=>({id:String(i),filename:`${i+1} - Song.flac`,path:`Compilation/${i+1} - Song.flac`,tags:{title:'Song '+i,artist,album:'Collected'}}));
 it('recognises compilations without overwriting individual track artists',()=>{
  const batch=organiseBatch(songs());expect(batch.groups).toHaveLength(1);expect(batch.groups[0].artistName).toBe('Various Artists');expect(batch.items.map(i=>i.metadata.artist)).toEqual(['One','Two','Three','Four']);
  expect(organiseBatch(songs(['One','Two','Three'])).groups).toHaveLength(3);
 });
 it('preserves an explicit album artist and keeps separate artist folders separate',()=>{
  expect(organiseBatch(songs().map(s=>({...s,tags:{...s.tags,albumartist:'The Collective'}}))).groups[0].artistName).toBe('The Collective');
  expect(organiseBatch(songs().map(s=>({...s,path:s.tags.artist+'/'+s.path}))).groups).toHaveLength(4);
 });
 it('merges normalised album identities only for the same uploader',()=>{
  const input=[{id:'1',filename:'Song.flac',tags:{artist:'HALDEN',album:'glass   rooms'}},{id:'2',filename:'Another.flac',tags:{artist:'Halden',album:'Glass Rooms'}}];
  const albums=[{id:'other',owner_id:'other',title:'Glass Rooms',artist_name:'Halden'},{id:'mine',owner_id:'me',title:'GLASS ROOMS',artist_name:'halden'}];
  const batch=organiseBatch(input,{existingAlbums:albums,ownerId:'me'});expect(batch.groups).toHaveLength(1);expect(batch.groups[0].existingAlbumId).toBe('mine');
  expect(organiseBatch(input,{existingAlbums:albums,ownerId:'new'}).groups[0].existingAlbumId).toBeUndefined();
  expect(organiseBatch(input,{existingAlbums:albums,ownerId:'me',rules:{mergeExisting:false}}).groups[0].existingAlbumId).toBeUndefined();
 });
 it('numbers missing tracks deterministically per disc without consuming supplied numbers',()=>{
  const input=[{id:'a',filename:'10 Zeta.flac'},{id:'b',filename:'2 Beta.flac'},{id:'c',filename:'Alpha.flac',tags:{track:{no:1}}},{id:'d',filename:'Intro.flac',tags:{disk:{no:2}}}].map(item=>({...item,path:'Artist/Album/'+item.filename}));
  // The first two numbers are real filename numbers, so only Intro is assigned.
  const numbered=organiseBatch(input);expect(numbered.items.map(i=>i.metadata.trackNo)).toEqual([10,2,1,1]);
  const missing=input.map(i=>({...i,filename:i.filename.replace(/^\d+ /,''),path:'Artist/Album/'+i.filename.replace(/^\d+ /,'')}));
  const forwards=organiseBatch(missing).items.map(i=>[i.id,i.metadata.trackNo]);const reverse=organiseBatch([...missing].reverse()).items.map(i=>[i.id,i.metadata.trackNo]);expect(new Map(forwards as [string,number][])).toEqual(new Map(reverse as [string,number][]));
  expect(organiseBatch(missing,{rules:{numberTracks:false}}).items.find(i=>i.id==='a')!.metadata.trackNo).toBeUndefined();
 });
 it('retains the weakest identity confidence and does not mutate worker results',()=>{
  const input=songs(['Artist','Artist']);input[1].tags.title='';const initial=organiseBatch(input).items,copy=structuredClone(initial),groups=groupOrganised(initial).groups;
  expect(groups[0].confidence).toBe('low');expect(initial).toEqual(copy);
 });
 it('honours independent rules and keeps recording dates deterministic',()=>{
  const value=organise('01 - guess [HQ].mp3','Folder/Album/01 - guess [HQ].mp3',{title:'TAG',artist:'Tag Artist',album:'Tag Album'},{rules:{tags:false,titleCase:false}});expect(value).toMatchObject({title:'guess',artist:'Folder',album:'Album'});
  expect(organise('01 - guess [HQ].mp3',undefined,{}, {rules:{stripJunk:false}}).title).toBe('guess [HQ]');
  expect(organise('01 - guess.mp3',undefined,{}, {rules:{filenames:false}})).toMatchObject({title:'01 - Guess',trackNo:undefined});
  expect(organise('song.mp3','Artist/Album/song.mp3',{}, {rules:{folders:false}}).album).toBe('Unsorted');
  const modified=Date.UTC(2022,3,1);expect(organise('Recording 12.m4a',undefined,{}, {lastModified:modified})).toMatchObject({album:'Recordings',year:2022,recordedAt:modified});
  expect(organise('Recording 12 2025-99-99.m4a',undefined,{}, {lastModified:modified}).year).toBe(2022);
  expect(organise('Recording 12.m4a',undefined,{}, {rules:{recordings:false}}).album).toBe('Unsorted');
  expect(organiseBatch(songs(),{rules:{variousArtists:false}}).groups).toHaveLength(4);
  expect(organiseBatch(songs(['Artist','Artist']),{rules:{groupAlbums:false}}).groups).toHaveLength(2);
 });
 it('cleans names without removing remix or featuring information',()=>{
  expect(stripJunk('  Song feat. Guest (Live Remix) [HQ].mp3.mp3')).toBe('Song feat. Guest (Live Remix)');expect(titleCase('DJ MC EP LP UK USA part iv')).toBe('DJ MC EP LP UK USA part iv');
 });
});
