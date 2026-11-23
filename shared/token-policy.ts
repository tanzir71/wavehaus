import {UploadError,text} from './upload-input';
export type TokenScope='read'|'upload'|'organise'|'admin';
export const roleScopes=(role:string):TokenScope[]=>role==='listener'?['read']:['owner','admin'].includes(role)?['read','upload','organise','admin']:['read','upload','organise'];
export function tokenInput(raw:Record<string,unknown>,role:string,now=Date.now()){
 const name=text(raw.name,'Token name',100,true),allowed=roleScopes(role);if(!Array.isArray(raw.scopes)||!raw.scopes.length||raw.scopes.length>4||raw.scopes.some(value=>!allowed.includes(value)))throw new UploadError('forbidden','Choose scopes allowed by your account role.',403);const scopes=[...new Set(raw.scopes)] as TokenScope[],days=raw.expiresDays??30;if(!Number.isSafeInteger(days)||Number(days)<1||Number(days)>365)throw new UploadError('validation','Choose an expiry from 1 to 365 days.');return {name:name!,scopes,expiresAt:now+Number(days)*86400000};
}
export function requiredScope(method:string,path:string):TokenScope|null{
 if(path==='/api/auth/me'&&method==='GET')return 'read';
 if(/^\/api\/(?:auth(?:\/|$)|setup(?:\/|$)|sessions(?:\/|$)|tokens(?:\/|$))/.test(path))return null;
 if(path.startsWith('/api/admin/')||path.startsWith('/api/invites'))return 'admin';
 if(['GET','HEAD'].includes(method))return 'read';
 if(path.startsWith('/api/uploads')||/^\/api\/tracks\/[^/]+\/peaks$/.test(path))return 'upload';
 return 'organise';
}
export function authorizeToken(method:string,path:string,scopes:string[],role:string){const required=requiredScope(method,path);if(!required||!scopes.includes(required)||!roleScopes(role).includes(required))throw new UploadError('insufficient_scope',required?`This token needs the ${required} scope.`:'Use a signed-in browser for account security settings.',403);}
