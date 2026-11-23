import { id,tint } from '../library/ids';
import { coverPng } from '../library/covers';
import { putBlob } from '../../public/runtime/media.js';
import { freshState,readState,writeState } from './store';
import { generateMusic } from './music';
export async function seed(){
 const run=async()=>{if(await readState())return;const state=freshState(),now=Date.now();
 const records=[{title:'Glass Rooms',artist:'Halden',genre:'Ambient',tracks:['Afterglow (Live)','Glass Rooms','The Quiet Between','Still Here']},{title:'Neon Harbour',artist:'Mira Okafor',genre:'Electronic',tracks:['First Light','Night Ferry','Blue Hour','Neon Harbour']},{title:'Low Tide Recordings',artist:'Nils Arden',genre:'Instrumental',tracks:['Low Tide','Driftwood','Open Water','Home Again']}];
 for(const [a,record] of records.entries()){
  const artistId=id(),albumId=id();state.artists.push({id:artistId,name:record.artist,sort_name:record.artist,tint:tint(record.artist,record.title),rev:++state.rev,deleted:0});
  const album={id:albumId,owner_id:state.user.id,title:record.title,artist_id:artistId,artist_name:record.artist,year:2026,tint:tint(record.artist,record.title),art_source:'generated',visibility:'private' as const,sync_visibility:1,folder_path:`${record.artist}/${record.title}`,created_at:now-a*3600000,rev:++state.rev,deleted:0};state.albums.push(album);
  for(const [n,title] of record.tracks.entries()){
   const trackId=id(),seconds=32+n*3;const {blob,peaks}=await generateMusic(a*4+n,seconds);await putBlob(`audio-${trackId}`,blob);
   state.tracks.push({id:trackId,owner_id:state.user.id,album_id:albumId,artist_id:artistId,title,artist_name:record.artist,album_artist:record.artist,album_title:record.title,track_no:n+1,disc_no:1,year:2026,genre:record.genre,duration_ms:seconds*1000,codec:'PCM',container:'WAV',mime:'audio/wav',sample_rate:16000,bitrate:256000,peaks,storage_key:`audio-${trackId}`,size_bytes:blob.size,sha256:`generated-${trackId}`,quick_hash:`generated-${trackId}`,original_name:`${String(n+1).padStart(2,'0')} - ${title}.wav`,original_path:`${record.artist}/${record.title}/${title}.wav`,visibility:'private',organise_source:'tags',added_at:now-a*3600000,updated_at:now,rev:++state.rev,deleted:0});
   state.user.used_bytes+=blob.size;
  }
  await putBlob(`art-${albumId}`,await coverPng(record.title,record.artist,state.tracks.at(-1)!.peaks));
 }
 const playlistId=id();state.playlists.push({id:playlistId,owner_id:state.user.id,name:'Late-night drive',description:'A little space to slow down.',visibility:'private',sync_visibility:0,created_at:now,updated_at:now,rev:++state.rev,deleted:0});
 for(const [i,t] of state.tracks.filter((_,i)=>i%2===0).entries())state.playlistItems.push({playlist_id:playlistId,track_id:t.id,position:i+1,added_at:now,rev:++state.rev,deleted:0});
 for(const t of state.tracks.filter((_,i)=>i%3===0))state.likes.push({user_id:state.user.id,track_id:t.id,liked_at:now,rev:++state.rev,deleted:0});
 for(const [i,label] of ['The drop','A little room to breathe'].entries())state.moments.push({id:id(),user_id:state.user.id,track_id:state.tracks[0].id,at_ms:(i+1)*9000,label,created_at:now,rev:++state.rev,deleted:0});
 state.playerState={queue:state.tracks.slice(0,4).map(t=>t.id),index:0,positionMs:9000,shuffle:false,repeat:'off',autoplay:true,updatedAt:now};await writeState(state);
 };
 if(navigator.locks)await navigator.locks.request('wh-demo-seed',run);else await run();
}
