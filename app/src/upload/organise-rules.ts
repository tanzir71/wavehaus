import {defaultRules,type RuleSettings} from '../../../shared/library-rules';
export {defaultRules,type RuleSettings} from '../../../shared/library-rules';
export type Confidence = 'high'|'medium'|'low';
export type FieldSource = 'tags'|'folder'|'filename'|'inferred'|'default';
type Field = 'title'|'artist'|'albumArtist'|'album'|'trackNo'|'discNo'|'year'|'genre';
export interface Organised {
 title:string; artist:string; albumArtist:string; album:string; year?:number; genre:string;
 trackNo?:number; discNo:number; organiseSource:'tags'|'folder'|'filename';
 fieldSources:Partial<Record<Field,FieldSource>>;
 fieldConfidence:Partial<Record<Field,Confidence>>;
 confidence:Confidence; explicitAlbumArtist:boolean; recordedAt?:number;
}
export interface OrganiseOptions {rules?:Partial<RuleSettings>;lastModified?:number}
export interface OrganiseInput {id:string;filename:string;path?:string;tags?:Record<string,unknown>;lastModified?:number}
export interface ExistingAlbum {id:string;owner_id:string;title:string;artist_name:string;deleted?:number;visibility?:'private'|'public';sync_visibility?:number}
export interface OrganisedItem {id:string;filename:string;path:string;metadata:Organised}
export interface AlbumGroup {
 key:string;title:string;artistName:string;year?:number;items:OrganisedItem[];
 confidence:Confidence;source:'tags'|'folder'|'filename';existingAlbumId?:string;
}
const extensions=/\.(?:mp3|wav|flac|m4a|alac|ogg|opus|aiff?)(?:\.(?:mp3|wav|flac|m4a|alac|ogg|opus|aiff?))*$/i;
export const normaliseName=(value:string)=>value.trim().replace(/\s+/g,' ').toLowerCase();
export function stripJunk(value:string){
 return value.replace(extensions,'')
  .replace(/\[(?:official|lyric|audio|video|hq|hd|320|flac|mp3|free download)[^\]]*\]/gi,'')
  .replace(/\((?:official\s*)?(?:music\s*)?(?:video|audio|lyrics?)\)/gi,'')
  .replace(/\s+-\s+Copy(?=\s|$)|\s*\(\d+\)(?=\s*$)|www\.[\w.-]+\.com/gi,'')
  .replace(/_/g,' ').replace(/\s+/g,' ').trim();
}
export function titleCase(value:string){
 if(value!==value.toLowerCase()&&value!==value.toUpperCase())return value;
 const roman=/^(?=[ivxlcdm]+$)m{0,3}(?:cm|cd|d?c{0,3})(?:xc|xl|l?x{0,3})(?:ix|iv|v?i{0,3})$/i;
 return value.replace(/[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu,word=>
  /^(?:dj|mc|ep|lp|uk|usa)$/i.test(word)||roman.test(word)?word.toUpperCase():word[0].toUpperCase()+word.slice(1).toLowerCase());
}
function text(value:unknown){return typeof value==='string'?value.trim().replace(/\s+/g,' '):'';}
function useful(value:string){return value&&!/^(?:unknown(?: artist| album| title)?|untitled|track\s*\d+|audio\s*\d+|www\.[\w.-]+\.com)$/i.test(value);}
function positive(value:unknown,max=9999){const n=typeof value==='number'?value:typeof value==='string'&&/^\d+$/.test(value)?Number(value):NaN;return Number.isSafeInteger(n)&&n>0&&n<=max?n:undefined;}
function tagNumber(value:unknown,max=9999){return positive(value&&typeof value==='object'?(value as {no?:unknown}).no:value,max);}
function foldersOf(path:string){
 const folders=path.replace(/\\/g,'/').split('/').filter(Boolean).slice(0,-1);
 const disc=folders.at(-1)?.match(/^(?:CD|Disc)[\s._-]*(\d{1,2})(?:\s+of\s+\d+)?$/i);
 if(disc)folders.pop();return {folders,disc:positive(disc?.[1],999)};
}
function recordingDate(filename:string,lastModified?:number){
 const date=filename.match(/(?:^|\D)(\d{4})[-_.]?(\d{2})[-_.]?(\d{2})(?:\D|$)/);
 if(date){const year=Number(date[1]),month=Number(date[2]),day=Number(date[3]),at=Date.UTC(year,month-1,day),d=new Date(at);if(year>=1900&&year<=2999&&d.getUTCFullYear()===year&&d.getUTCMonth()===month-1&&d.getUTCDate()===day)return at;}
 return lastModified&&Number.isFinite(lastModified)&&lastModified>0?lastModified:undefined;
}
const confidenceOf=(source:FieldSource):Confidence=>source==='tags'?'high':source==='folder'||source==='inferred'?'medium':'low';
const rank:Record<Confidence,number>={high:2,medium:1,low:0};
const lowest=(values:Confidence[])=>values.reduce((a,b)=>rank[a]<rank[b]?a:b,'high');

/** Pure metadata guesses. Technical audio tags are kept separately by the worker. */
export function organise(filename:string,path=filename,tags:Record<string,unknown>={},options:OrganiseOptions={}):Organised {
 const rules={...defaultRules,...options.rules},clean=(value:string)=>rules.titleCase?titleCase(rules.stripJunk?stripJunk(value):text(value)):rules.stripJunk?stripJunk(value):text(value);
 const fromTag=(name:string)=>{if(!rules.tags)return '';const value=text(tags[name]);return useful(value)?clean(value):'';};
 const fileBase=filename.replace(extensions,''),filenameText=rules.stripJunk?stripJunk(fileBase):text(fileBase);
 const {folders,disc:folderDisc}=rules.folders?foldersOf(path):{folders:[] as string[],disc:undefined};
 let guessedTitle=filenameText,guessedArtist='',guessedTrack:number|undefined,guessedDisc:number|undefined;
 let match:RegExpExecArray|null;
 if(rules.filenames){
  // A compact disc/track number needs a bare space; "101 - Intro" is track 101.
  if((match=/^([1-9])(\d{2})\s+([^\s-].*)$/.exec(filenameText))&&Number(match[2])>0){guessedDisc=Number(match[1]);guessedTrack=Number(match[2]);guessedTitle=match[3];}
  else if((match=/^(\d{1,3})[\s._-]+(.+?)\s+-\s+(.+)$/.exec(filenameText))){guessedTrack=positive(match[1]);guessedArtist=match[2];guessedTitle=match[3];}
  else if((match=/^(.+?)\s+-\s+(\d{1,3})\s+-\s+(.+)$/.exec(filenameText))){guessedArtist=match[1];guessedTrack=positive(match[2]);guessedTitle=match[3];}
  else if((match=/^(\d{1,3})[\s._-]+(.+)$/.exec(filenameText))){guessedTrack=positive(match[1]);guessedTitle=match[2];}
  else if((match=/^(.+?)\s+-\s+(.+)$/.exec(filenameText))){guessedArtist=match[1];guessedTitle=match[2];}
 }
 let folderAlbum=folders.at(-1)||'',folderArtist=folders.at(-2)||'',folderYear:number|undefined;
 const folderPattern=folderAlbum.match(/^(.+?)\s+-\s+(.+?)(?:\s*\((\d{4})\))?$/);
 if(folderPattern&&(!folderArtist||normaliseName(folderPattern[1])===normaliseName(folderArtist))){folderArtist=folderPattern[1];folderAlbum=folderPattern[2];folderYear=positive(folderPattern[3],2999);}
 else{const year=folderAlbum.match(/^(.*?)\s*\((\d{4})\)$/);if(year){folderAlbum=year[1];folderYear=positive(year[2],2999);}}
 const fieldSources:Organised['fieldSources']={},fieldConfidence:Organised['fieldConfidence']={};
 function choose(field:Field,choices:[string,FieldSource][],fallback:string){
  const selected=choices.find(([value])=>!!value)||[fallback,'default'] as [string,FieldSource];fieldSources[field]=selected[1];fieldConfidence[field]=confidenceOf(selected[1]);return clean(selected[0])||fallback;
 }
 const title=choose('title',[[fromTag('title'),'tags'],[rules.filenames?guessedTitle:fileBase,'filename']],clean(fileBase)||'Untitled');
 const artist=choose('artist',[[fromTag('artist'),'tags'],[folderArtist,'folder'],[guessedArtist,'filename']],'Unknown artist');
 const explicitAlbumArtist=!!fromTag('albumartist'),albumArtist=choose('albumArtist',[[fromTag('albumartist'),'tags']],'');
 if(!explicitAlbumArtist){fieldSources.albumArtist=fieldSources.artist;fieldConfidence.albumArtist=fieldConfidence.artist;}
 let album=choose('album',[[fromTag('album'),'tags'],[folderAlbum,'folder']],artist==='Unknown artist'?'Unsorted':`Singles · ${artist}`);
 const isRecording=rules.recordings&&/^(?:Recording\s*\d+|PTT[-_]|AUD[-_])/i.test(filename),recordedAt=isRecording?recordingDate(filename,options.lastModified):undefined;
 if(isRecording){album='Recordings';fieldSources.album='inferred';fieldConfidence.album='medium';}
 const taggedYear=rules.tags?positive(tags.year,2999)||positive(text(tags.date).slice(0,4),2999):undefined;
 const year=taggedYear||folderYear||(recordedAt===undefined?undefined:new Date(recordedAt).getUTCFullYear());
 if(year){fieldSources.year=taggedYear?'tags':folderYear?'folder':'inferred';fieldConfidence.year=confidenceOf(fieldSources.year);}
 const taggedTrack=rules.tags?tagNumber(tags.track):undefined,taggedDisc=rules.tags?tagNumber(tags.disk,999):undefined;
 const trackNo=taggedTrack||guessedTrack,discNo=taggedDisc||folderDisc||guessedDisc||1;
 if(trackNo){fieldSources.trackNo=taggedTrack?'tags':'filename';fieldConfidence.trackNo=confidenceOf(fieldSources.trackNo);}
 fieldSources.discNo=taggedDisc?'tags':folderDisc?'folder':guessedDisc?'filename':'default';fieldConfidence.discNo=confidenceOf(fieldSources.discNo);
 const genre=rules.tags?(Array.isArray(tags.genre)?tags.genre.filter(x=>typeof x==='string').join(', '):text(tags.genre)):'';
 if(genre){fieldSources.genre='tags';fieldConfidence.genre='high';}
 const sources=[fieldSources.title!,fieldSources.artist!,fieldSources.album!],confidence=lowest(['title','artist','album'].map(field=>fieldConfidence[field as Field]!));
 return {title,artist,albumArtist:albumArtist||artist,album,year,genre,trackNo,discNo,fieldSources,fieldConfidence,confidence,explicitAlbumArtist,recordedAt,organiseSource:sources.every(s=>s==='tags')?'tags':sources.includes('folder')?'folder':'filename'};
}

/** Reconciles the whole drop, including analyses that finished in parallel. */
export function groupOrganised(input:OrganisedItem[],options:{rules?:Partial<RuleSettings>;existingAlbums?:ExistingAlbum[];ownerId?:string}={}) {
 const rules={...defaultRules,...options.rules};
 const items=input.map(item=>({...item,metadata:{...item.metadata,fieldSources:{...item.metadata.fieldSources},fieldConfidence:{...item.metadata.fieldConfidence}}}));
 if(rules.groupAlbums&&rules.variousArtists){
  const candidates=new Map<string,OrganisedItem[]>();
  for(const item of items){const folder=foldersOf(item.path).folders.join('/'),key=normaliseName(folder)+'\x1f'+normaliseName(item.metadata.album);const group=candidates.get(key)||[];group.push(item);candidates.set(key,group);}
  for(const group of candidates.values())if(group.every(item=>!item.metadata.explicitAlbumArtist)&&new Set(group.map(item=>normaliseName(item.metadata.artist))).size>3){
   for(const item of group){item.metadata.albumArtist='Various Artists';item.metadata.fieldSources.albumArtist='inferred';item.metadata.fieldConfidence.albumArtist='medium';}
  }
 }
 const groups=new Map<string,AlbumGroup>();
 for(const item of items){
  const m=item.metadata,key=normaliseName(m.albumArtist)+'\x1f'+normaliseName(m.album)+(rules.groupAlbums?'':'\x1f'+item.id);
  let group=groups.get(key);if(!group){const existing=rules.mergeExisting&&rules.groupAlbums&&options.ownerId?options.existingAlbums?.find(a=>!a.deleted&&a.owner_id===options.ownerId&&normaliseName(a.title)===normaliseName(m.album)&&normaliseName(a.artist_name)===normaliseName(m.albumArtist)):undefined;
   group={key,title:m.album,artistName:m.albumArtist,year:m.year,items:[],confidence:m.confidence,source:m.organiseSource,existingAlbumId:existing?.id};groups.set(key,group);
  }group.items.push(item);group.confidence=lowest([group.confidence,m.confidence]);if(m.organiseSource!=='tags')group.source=m.organiseSource;
 }
 if(rules.numberTracks)for(const group of groups.values()){
  const used=new Map<number,Set<number>>();for(const item of group.items){const m=item.metadata;if(m.trackNo){const numbers=used.get(m.discNo)||new Set<number>();numbers.add(m.trackNo);used.set(m.discNo,numbers);}}
  const sorted=[...group.items].sort((a,b)=>a.path.localeCompare(b.path,undefined,{numeric:true})||a.id.localeCompare(b.id));
  for(const item of sorted){const m=item.metadata;if(m.trackNo)continue;const numbers=used.get(m.discNo)||new Set<number>();let next=1;while(numbers.has(next))next++;m.trackNo=next;numbers.add(next);used.set(m.discNo,numbers);m.fieldSources.trackNo='inferred';m.fieldConfidence.trackNo='medium';}
 }
 return {items,groups:[...groups.values()]};
}
export function organiseBatch(input:OrganiseInput[],options:Parameters<typeof groupOrganised>[1]={}){
 return groupOrganised(input.map(item=>({...item,path:item.path||item.filename,metadata:organise(item.filename,item.path||item.filename,item.tags,{rules:options.rules,lastModified:item.lastModified})})),options);
}
