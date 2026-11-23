import {UploadError} from './upload-input';
import {libraryRules} from './library-rules';
export function settingsInput(values:Record<string,unknown>){const allowed=['server_name','registration_mode','default_role','members_can_upload','default_visibility','upload_visibility_locked','member_quota_bytes','invites_per_member','referrals_need_approval','pow_difficulty','max_file_bytes','trusted_proxy','library_rules'];for(const[key,value]of Object.entries(values)){
 if(!allowed.includes(key))throw new UploadError('invalid_setting','Unknown setting: '+key);
 if(key==='server_name'&&(typeof value!=='string'||!value.trim()||[...value].length>100))throw new UploadError('validation','Use a server name of 1–100 characters.');
 const choices:Record<string,unknown[]>={registration_mode:['closed','invite','request','open'],default_role:['listener','uploader'],default_visibility:['private'],trusted_proxy:['','cloudflare']};if(choices[key]&&!choices[key].includes(value))throw new UploadError('invalid_setting','Choose a valid '+key.replaceAll('_',' ')+'.');
 if(['members_can_upload','upload_visibility_locked','referrals_need_approval'].includes(key)&&typeof value!=='boolean')throw new UploadError('validation','Use true or false for '+key+'.');
 const ranges:Record<string,[number,number]>={member_quota_bytes:[0,Number.MAX_SAFE_INTEGER],invites_per_member:[0,10000],pow_difficulty:[12,24],max_file_bytes:[1,2*1024**3]};if(ranges[key]&&!(key==='member_quota_bytes'&&value===null)){const[min,max]=ranges[key];if(!Number.isSafeInteger(value)||Number(value)<min||Number(value)>max)throw new UploadError('validation','Use a valid '+key.replaceAll('_',' ')+'.');}if(key==='library_rules')libraryRules(value);
 }return values;}
