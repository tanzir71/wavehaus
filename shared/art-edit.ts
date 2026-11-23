import {rowIds} from './edit-input';
import {UploadError} from './upload-input';
export function artEditInput(form:FormData,single?:string){
 const parse=(field:string)=>{const raw=form.get(field);if(raw===null)return undefined;if(typeof raw!=='string')throw new UploadError('validation',field+' must be text.');try{return JSON.parse(raw);}catch{throw new UploadError('validation','Invalid '+field+'.');}};
 const ids=single?[single]:rowIds(parse('albumIds'),'Album IDs'),expectedRevs:Record<string,number>={},raw=parse('expectedRevs');
 if(raw!==undefined){if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new UploadError('validation','Expected revisions must be an object.');for(const[id,rev]of Object.entries(raw)){if(!ids.includes(id)||!Number.isSafeInteger(rev)||Number(rev)<0)throw new UploadError('validation','Expected revisions must belong to the selected albums.');expectedRevs[id]=Number(rev);}}
 const appendTo=form.get('changeId');if(appendTo!==null&&(typeof appendTo!=='string'||!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(appendTo)))throw new UploadError('validation','Invalid action ID.');
 return {ids,expectedRevs,appendTo:appendTo||undefined};
}
