import {signal,effect} from '@preact/signals';
import {user} from '../library/session';
import type {Track} from '../api/types';
import {navigate} from './router';
export const selectedTracks=signal<string[]>([]),selectionMode=signal(false);
let anchor:string|null=null;
let account:string|null|undefined;effect(()=>{const next=user.value?.id||null;if(account!==undefined&&account!==next){selectedTracks.value=[];selectionMode.value=false;anchor=null;}account=next;});
const remember=()=>{if(user.value)sessionStorage.setItem('wh-selection:'+user.value.id,JSON.stringify(selectedTracks.value));};
const editable=(track:Track)=>user.value?.role!=='listener'&&(track.owner_id===user.value?.id||['owner','admin'].includes(user.value?.role||''));
export function selectTracks(tracks:Track[]){selectedTracks.value=tracks.filter(row=>user.value?.role!=='listener'&&(row.owner_id===user.value?.id||['owner','admin'].includes(user.value?.role||''))).map(row=>row.id);selectionMode.value=true;remember();}
export function clearSelection(){selectedTracks.value=[];selectionMode.value=false;anchor=null;remember();}
export function restoreSelection(){if(selectedTracks.value.length||!user.value)return;try{const ids=JSON.parse(sessionStorage.getItem('wh-selection:'+user.value.id)||'[]');if(Array.isArray(ids))selectedTracks.value=ids.filter(id=>typeof id==='string');}catch{/* A missing selection starts empty. */}}
export function toggleTrack(track:Track,tracks:Track[]=[],range=false){if(!editable(track))return;const next=new Set(selectedTracks.value);if(range&&anchor){const a=tracks.findIndex(row=>row.id===anchor),b=tracks.findIndex(row=>row.id===track.id);if(a>=0&&b>=0)for(const row of tracks.slice(Math.min(a,b),Math.max(a,b)+1).filter(editable))next.add(row.id);else next.add(track.id);}else if(next.has(track.id))next.delete(track.id);else next.add(track.id);selectedTracks.value=[...next];selectionMode.value=true;anchor=track.id;remember();}
export function selectionKeys(event:KeyboardEvent,tracks:Track[]){if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='a'&&!['INPUT','TEXTAREA'].includes((event.target as Element).tagName)){event.preventDefault();selectTracks(tracks);}}
export function openEditor(mode='edit'){navigate('/bulk-edit?mode='+mode);}
