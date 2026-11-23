import { signal } from '@preact/signals';
import { api } from '@backend';
import { ApiError,type User } from '../api/types';
export const user=signal<User|null>(null),authStatus=signal<'loading'|'setup'|'signedOut'|'signedIn'>('loading'),recoveryCodesLeft=signal(10);
export interface Config {serverName:string;registrationMode:string;maxChunkBytes:number;maxFileBytes:number;features:Record<string,boolean>;hashIterations?:number;securityWarning?:string|null}
export const config=signal<Config|null>(null);
export const accountSettings=signal<Record<string,unknown>>({});
export async function loadSession(){
 const health=await api.request<{needsSetup:boolean}>('/api/health');config.value=await api.request<Config>('/api/config');
 if(health.needsSetup){user.value=null;authStatus.value='setup';return false;}
 try{const me=await api.request<{user:User;recoveryCodesLeft?:number;settings?:Record<string,unknown>}>('/api/auth/me');user.value=me.user;accountSettings.value=me.settings||{};recoveryCodesLeft.value=me.recoveryCodesLeft??10;authStatus.value='signedIn';return true;}
 catch(error){if(error instanceof ApiError&&error.status===401){user.value=null;authStatus.value='signedOut';return false;}throw error;}
}
