import {readOffline,saveOfflineSession,clearDownloads,offlineMode} from './downloads';
import { signal } from '@preact/signals';
import { api } from '@backend';
import { ApiError,json,type User } from '../api/types';
export const user=signal<User|null>(null),authStatus=signal<'loading'|'setup'|'signedOut'|'signedIn'>('loading'),recoveryCodesLeft=signal(10);
export interface Config {serverName:string;registrationMode:string;maxChunkBytes:number;maxFileBytes:number;features:Record<string,boolean>;hashIterations?:number;securityWarning?:string|null}
export const config=signal<Config|null>(null);
export const accountSettings=signal<Record<string,unknown>>({});
export async function loadSession(){
 try{
 const logoutKey='wh-pending-logout:'+import.meta.env.BASE_URL;if(localStorage.getItem(logoutKey)){try{await api.request('/api/auth/logout',json({}));localStorage.removeItem(logoutKey);}catch(error){if(error instanceof ApiError&&error.status===401)localStorage.removeItem(logoutKey);else{user.value=null;authStatus.value='signedOut';return false;}}}
 const health=await api.request<{needsSetup:boolean}>('/api/health');config.value=await api.request<Config>('/api/config');
 if(health.needsSetup){user.value=null;authStatus.value='setup';return false;}
 try{const me=await api.request<{user:User;recoveryCodesLeft?:number;settings?:Record<string,unknown>;session?:{expires_at:number}}>('/api/auth/me');user.value=me.user;accountSettings.value=me.settings||{};recoveryCodesLeft.value=me.recoveryCodesLeft??10;authStatus.value='signedIn';offlineMode.value=false;await saveOfflineSession(me.user,config.value,accountSettings.value,me.session?.expires_at||Date.now()+86400000);return true;}
 catch(error){if(error instanceof ApiError&&error.status===401){user.value=null;accountSettings.value={};authStatus.value='signedOut';await clearDownloads(true);return false;}throw error;}
 }catch(error){if(error instanceof TypeError||!navigator.onLine){const saved=await readOffline();if(saved&&saved.expiresAt>Date.now()){user.value=saved.user;config.value=saved.config as Config;accountSettings.value=saved.settings;authStatus.value='signedIn';offlineMode.value=true;return true;}}throw error;}
}
