import type {Track,Album} from '../api/types';
import {downloadTracks,removeDownloads,downloadedTrackIds,downloadJobs} from '../library/downloads';
import {toast} from '../library/store';
import {Icon} from './Icon';
export function DownloadButton({tracks,albums=[]}:{tracks:Track[];albums?:Album[]}){const ids=tracks.map(t=>t.id),complete=!!ids.length&&ids.every(id=>downloadedTrackIds.value.has(id)),working=ids.some(id=>['queued','downloading'].includes(downloadJobs.value[id]?.state)),failed=ids.some(id=>downloadJobs.value[id]?.state==='error');return <button class="button" disabled={!ids.length||working} aria-pressed={complete} onClick={()=>{if(complete)void removeDownloads(ids).catch(error=>toast(error.message));else try{downloadTracks(tracks,albums);}catch(error){toast((error as Error).message);}}}><Icon name="download" size={16}/>{working?'Downloading…':complete?'Remove downloads':failed?'Retry download':'Download'}</button>;}
