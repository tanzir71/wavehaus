import {visibilityInput,visibilityPlan} from '../../../shared/visibility-plan';
import type {JournalRow} from '../../../shared/journal';
import {ApiError} from '../api/types';
import {mutate,readState,type DemoState} from './store';
import {demoSignedIn} from './auth';
import {demoWriteJournal} from './journal';
export async function demoVisibility(request:Request,path:string){
 if(path!=='/api/visibility'||request.method!=='POST')return null;const input=visibilityInput(await request.json()),apply=async(state:DemoState)=>{if(!demoSignedIn(state))throw new ApiError('unauthenticated','Sign in to continue.',401);const rows=(values:unknown[])=>values as JournalRow[],plan=await visibilityPlan(input,{tracks:async ids=>rows(state.tracks.filter(row=>!row.deleted&&ids.includes(row.id))),albums:async ids=>rows(state.albums.filter(row=>!row.deleted&&ids.includes(row.id))),albumTracks:async ids=>rows(state.tracks.filter(row=>!row.deleted&&ids.includes(row.album_id))),artists:async ids=>rows(state.artists.filter(row=>!row.deleted&&ids.includes(row.id))),alsoIn:async ids=>({publicPlaylists:new Set(state.playlistItems.filter(item=>!item.deleted&&ids.includes(item.track_id)&&state.playlists.some(row=>row.id===item.playlist_id&&!row.deleted&&row.visibility==='public')).map(item=>item.playlist_id)).size,publicAlbums:new Set(state.tracks.filter(track=>ids.includes(track.id)&&state.albums.some(album=>album.id===track.album_id&&!album.deleted&&album.visibility==='public')).map(track=>track.album_id)).size})},state.user);const{write,...impact}=plan;return Response.json({...impact,...input.dryRun?{dryRun:true,changeId:null}:demoWriteJournal(state,write)});};return input.dryRun?apply((await readState())!):mutate(apply);
}
