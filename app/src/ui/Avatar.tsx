import { useState } from 'preact/hooks';
import { api } from '@backend';
import { user } from '../library/session';
import { toast } from '../library/store';
import { href } from './router';
import { finishSignOut } from './sessionActions';
export function Avatar(){const [open,setOpen]=useState(false),[working,setWorking]=useState(false);const signOut=async()=>{setWorking(true);try{await api.request('/api/auth/logout',{method:'POST'});await finishSignOut();setOpen(false);}catch(e){toast((e as Error).message);}finally{setWorking(false);}};return <div class="avatar-menu"><button class="avatar" aria-label="Open account menu" aria-expanded={open} onClick={()=>setOpen(!open)}>{user.value?.display_name.slice(0,1).toUpperCase()||'W'}</button>{open&&<nav aria-label="Account"><a href={href('/settings')} onClick={()=>setOpen(false)}>Settings</a><a href={href('/settings/devices')} onClick={()=>setOpen(false)}>Devices</a><a href={href('/background-play')} onClick={()=>setOpen(false)}>Background play</a><button onClick={signOut} disabled={working}>{working?'Signing out…':'Sign out'}</button></nav>}</div>;}
