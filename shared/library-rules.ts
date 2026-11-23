import {UploadError} from './upload-input';
export const defaultRules={tags:true,folders:true,filenames:true,stripJunk:true,titleCase:true,groupAlbums:true,variousArtists:true,mergeExisting:true,numberTracks:true,recordings:true};
export type RuleSettings=typeof defaultRules;
export function libraryRules(value:unknown):Partial<RuleSettings>{if(!value||typeof value!=='object'||Array.isArray(value))throw new UploadError('validation','Library rules must be an object.');for(const[key,flag]of Object.entries(value))if(!Object.hasOwn(defaultRules,key)||typeof flag!=='boolean')throw new UploadError('validation','Use known library rules with true or false.');return value as Partial<RuleSettings>;}
