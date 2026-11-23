import {useState} from 'preact/hooks';
import type {Track} from '../api/types';
import {Dialog} from './Dialog';
import PlaylistDialog from './PlaylistDialog';
import {startRadio} from '../library/recommendations';
import {toast} from '../library/store';
import {selectTracks,openEditor} from './selection';
import {user} from '../library/session';
import * as player from '../engine/player';
export default function TrackOptions({track,onClose}:{track:Track;onClose():void}){const[playlist,setPlaylist]=useState(false);if(playlist)return <PlaylistDialog trackIds={[track.id]} onClose={onClose}/>;return <Dialog title="Track options" onClose={onClose}><p>{track.title} · {track.artist_name}</p><div class="dialog-actions"><button class="button" onClick={()=>{player.enqueue(track);onClose();}}>Add to queue</button><button class="button" onClick={()=>setPlaylist(true)}>Add to playlist</button><button class="button" onClick={()=>{void startRadio(track.id).catch(error=>toast(error.message));onClose();}}>Start radio</button>{track.owner_id===user.value?.id&&user.value?.role!=='listener'&&<button class="button" onClick={()=>{selectTracks([track]);openEditor();onClose();}}>Edit track</button>}</div></Dialog>;}
