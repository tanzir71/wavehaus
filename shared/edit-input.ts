import {UploadError,text,number} from './upload-input';
export const editableFields=['title','artist','albumArtist','album','year','genre','trackNo','discNo'] as const;
export type EditField=typeof editableFields[number];
export type MetadataPatch=Partial<Record<EditField,string|number|null>>;
const reject=(message:string):never=>{throw new UploadError('validation',message);};
const object=(value:unknown,label:string):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value))reject(`${label} must be an object.`);return value as Record<string,unknown>;};
export function rowIds(value:unknown,label='Track IDs',max=2000){
 if(!Array.isArray(value)||!value.length||value.length>max||value.some(id=>typeof id!=='string'||!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(id)))reject(`${label} must contain 1–${max} valid IDs.`);
 return [...new Set(value as string[])];
}
export function metadataPatch(value:unknown):MetadataPatch {
 const input=object(value,'Fields'),result:MetadataPatch={};
 for(const [key,value] of Object.entries(input)){
  if(!editableFields.includes(key as EditField))reject(`Cannot edit ${key} here. Visibility has its own control.`);
  const field=key as EditField;
  if(['year','trackNo','discNo'].includes(field))result[field]=number(value,field,field==='year'?2999:field==='discNo'?999:9999,true,1);
  else result[field]=text(value,field,field==='artist'||field==='albumArtist'?200:500,['title','artist','album'].includes(field));
 }return result;
}
function flag(input:Record<string,unknown>,key:string){if(input[key]!==undefined&&typeof input[key]!=='boolean')reject(`${key} must be true or false.`);return input[key]===true;}
export function editInput(input:Record<string,unknown>){
 const ids=rowIds(input.ids),set=input.set===undefined?{}:metadataPatch(input.set),perId:Record<string,MetadataPatch>=Object.create(null),expectedRevs:Record<string,number>=Object.create(null),expectedAlbumRevs:Record<string,number>=Object.create(null);
 if(input.perId!==undefined)for(const[id,patch]of Object.entries(object(input.perId,'Per-track fields'))){if(!ids.includes(id))reject('Per-track fields must belong to the selected tracks.');perId[id]=metadataPatch(patch);}
 if(!Object.keys(set).length&&!Object.values(perId).some(patch=>Object.keys(patch).length))reject('Choose at least one field to change.');
 if(input.expectedRevs!==undefined)for(const[id,value]of Object.entries(object(input.expectedRevs,'Expected revisions'))){if(!ids.includes(id)||!Number.isSafeInteger(value)||Number(value)<0)reject('Expected revisions must match selected tracks.');expectedRevs[id]=Number(value);}
 if(input.expectedAlbumRevs!==undefined){const revisions=object(input.expectedAlbumRevs,'Expected album revisions');if(Object.keys(revisions).length>4000)reject('Choose fewer albums.');for(const[id,value]of Object.entries(revisions)){if(!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(id)||!Number.isSafeInteger(value)||Number(value)<0)reject('Expected album revisions are invalid.');expectedAlbumRevs[id]=Number(value);}}
 return {ids,set,perId,expectedRevs,expectedAlbumRevs,dryRun:flag(input,'dryRun'),publishConfirmed:flag(input,'publishConfirmed')};
}
export function albumPatchInput(input:Record<string,unknown>){
 const allowed=['title','artistName','year'];if(Object.keys(input).some(key=>!allowed.includes(key)))reject('Album metadata supports title, artistName and year.');
 if(!Object.keys(input).length)reject('Choose at least one album field.');
 const result:Record<string,string|number|null>={};for(const[key,value]of Object.entries(input))result[key]=key==='year'?number(value,'Year',2999,true,1):text(value,key,key==='artistName'?200:500,true);return result;
}
