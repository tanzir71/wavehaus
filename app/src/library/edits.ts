import {api} from '@backend';
import {json,type Track} from '../api/types';
import {library,sync,offerUndo,toast} from './store';
import {user} from './session';
import {artwork} from '../upload/artwork';
import {beginBusy} from '../ui/busy';
export interface EditResult {changeId:string|null;updated:number;generatedAlbumIds?:string[];albumIds?:string[];published?:number;madePrivate?:number}
const sameAccount=(owner:string)=>{if(user.value?.id!==owner)throw new Error('The account changed. Open this action from Activity.');};
function albumPeaks(tracks:Track[]){
 const values=tracks.map(track=>track.peaks?atob(track.peaks):'').filter(Boolean);if(!values.length)return null;const length=values.reduce((sum,value)=>sum+value.length,0),samples=new Uint8Array(1000);let offset=0;
 for(const value of values){for(let i=0;i<value.length;i++){const bucket=Math.min(999,Math.floor((offset+i)*1000/length));samples[bucket]=Math.max(samples[bucket],value.charCodeAt(i));}offset+=value.length;}return btoa(String.fromCharCode(...samples));
}
export async function regenerateCovers(result:EditResult,owner=user.value?.id){
 if(!owner||!result.changeId||!result.generatedAlbumIds?.length)return;await sync();sameAccount(owner);
 for(const id of result.generatedAlbumIds){sameAccount(owner);const album=library.value.albums.find(row=>row.id===id);if(!album||album.art_source!=='generated'||album.owner_id!==owner)continue;
  const tracks=library.value.tracks.filter(row=>row.album_id===id).sort((a,b)=>(a.disc_no||1)-(b.disc_no||1)||(a.track_no||0)-(b.track_no||0)||a.id.localeCompare(b.id)),form=await artwork(album.title,album.artist_name,albumPeaks(tracks));sameAccount(owner);form.set('changeId',result.changeId);form.set('expectedRevs',JSON.stringify({[id]:album.rev}));
  await api.request(`/api/albums/${id}/art`,{method:'PUT',body:form});await sync();
 }
}
export async function editTracks(body:Record<string,unknown>,method='PATCH'){
 const owner=user.value?.id;if(!owner)throw new Error('Sign in to edit your music.');const finish=beginBusy();
 try{const result=await api.request<EditResult>('/api/tracks',json(body,method));sameAccount(owner);let coverWarning='';try{await regenerateCovers(result,owner);}catch{coverWarning=' Cover update needs a retry.';}await sync();sameAccount(owner);if(method==='PATCH')await import('../upload/imports').then(module=>module.rememberImportFields(body));offerUndo(`${result.updated} tracks ${method==='DELETE'?'deleted':'updated'}.${coverWarning}`,result.changeId);return result;}finally{finish();}
}
export async function undoChange(changeId:string,skipConflicts=false){const owner=user.value?.id,finish=beginBusy();try{const result=await api.request<{partial?:boolean;skipped?:unknown[]}>(`/api/changes/${changeId}/undo`,json({skipConflicts}));if(owner)sameAccount(owner);await sync();toast(result.partial?'Available rows undone · '+(result.skipped?.length||0)+' rows kept.':'Change undone.');return result;}finally{finish();}}
export async function applyArtwork(albumIds:string[],picture:Blob,changeId?:string){
 const owner=user.value?.id;if(!owner)throw new Error('Sign in to edit artwork.');if(picture.size>20*1024**2)throw new Error('Choose an image under 20 MB.');const bitmap=await createImageBitmap(picture);bitmap.close();const albums=albumIds.map(id=>library.value.albums.find(row=>row.id===id)).filter(row=>!!row);if(albums.length!==albumIds.length||albums.some(row=>row.owner_id!==owner))throw new Error('Choose albums that belong to you.');const finish=beginBusy();
 try{const form=await artwork(albums[0].title,albums[0].artist_name,null,picture,'uploaded');sameAccount(owner);form.set('albumIds',JSON.stringify(albumIds));if(changeId)form.set('changeId',changeId);form.set('expectedRevs',JSON.stringify(Object.fromEntries(albums.map(row=>[row.id,row.rev]))));const result=await api.request<EditResult>('/api/albums/art',{method:'PUT',body:form});await sync();sameAccount(owner);offerUndo(`Artwork updated for ${albumIds.length} albums.`,result.changeId);return result;}finally{finish();}
}
