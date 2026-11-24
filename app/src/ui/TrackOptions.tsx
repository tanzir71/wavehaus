import {DownloadButton} from './DownloadButton';
import {library} from '../library/store';
import {useState} from 'preact/hooks';
import {api} from '@backend';
import {json,type Track} from '../api/types';
import {Dialog} from './Dialog';
import PlaylistDialog from './PlaylistDialog';
import {startRadio} from '../library/recommendations';
import {toast,sync,offerUndo} from '../library/store';
import {selectTracks,openEditor} from './selection';
import {VisibilityChip} from './Visibility';
import {user} from '../library/session';
import * as player from '../engine/player';
export default function TrackOptions({track,onClose}:{track:Track;onClose():void}){const[playlist,setPlaylist]=useState(false);if(playlist)return <PlaylistDialog trackIds={[track.id]} onClose={onClose}/>;return <Dialog title="Track options" onClose={onClose}><p>{track.title} · {track.artist_name}</p><div class="dialog-actions"><DownloadButton tracks={[track]} albums={library.value.albums}/>{track.owner_id===user.value?.id&&user.value?.role!=='listener'&&<VisibilityChip targets={[{type:'track',id:track.id}]} title={track.title} label={track.visibility==='public'?'Public':'Private'}/>}{track.owner_id!==user.value?.id&&['owner','admin'].includes(user.value?.role||'')&&<button class="button" onClick={async()=>{try{const result=await api.request<{changeId:string}>('/api/visibility',json({targets:[{type:'track',id:track.id}],visibility:'private'}));await sync();toast('Made private by an admin.');onClose();}catch(error){toast((error as Error).message);}}}>Admin takedown · Make private</button>}<button class="button" onClick={()=>{player.enqueue(track);onClose();}}>Add to queue</button>{user.value&&<button class="button" onClick={()=>setPlaylist(true)}>Add to playlist</button>}<button class="button" onClick={()=>{void startRadio(track.id).catch(error=>toast(error.message));onClose();}}>Start radio</button>{track.owner_id===user.value?.id&&user.value?.role!=='listener'&&<button class="button" onClick={()=>{selectTracks([track]);openEditor();onClose();}}>Edit track</button>}{track.owner_id===user.value?.id&&user.value?.role!=='listener'&&<><button class="button" onClick={()=>{selectTracks([track]);openEditor('merge');onClose();}}>Move to album</button><button class="button" onClick={()=>{selectTracks([track]);openEditor('delete');onClose();}}>Delete track</button></>}</div></Dialog>;}
