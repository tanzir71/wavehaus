import {selectedTracks,clearSelection,openEditor} from './selection';
import {route} from './router';
import {Icon} from './Icon';
import {library} from '../library/store';
import {user} from '../library/session';
import '../routes/edit.css';
export function SelectionBar(){const count=selectedTracks.value.length,tracks=library.value.tracks.filter(track=>selectedTracks.value.includes(track.id)),own=tracks.every(track=>track.owner_id===user.value?.id),editable=user.value?.role!=='listener'&&(own||['owner','admin'].includes(user.value?.role||''));if(!count||route.value==='/bulk-edit')return null;return <div class="selection-bar" role="toolbar" aria-label="Selected tracks"><button class="icon-button" aria-label="Clear selection" onClick={clearSelection}><Icon name="x" size={18}/></button><strong>{count} selected</strong>{[['Edit','edit'],['Rename','rename'],['Artwork','artwork'],['Visibility','visibility'],['Add to playlist','playlist'],['Delete','delete']].map(([label,mode])=><button class="button" disabled={mode==='playlist'?false:['artwork','visibility','delete'].includes(mode)?!own:!editable} onClick={()=>openEditor(mode)}>{label}</button>)}</div>;}
