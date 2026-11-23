import {selectedTracks,clearSelection,openEditor} from './selection';
import {route} from './router';
import {Icon} from './Icon';
import '../routes/edit.css';
export function SelectionBar(){const count=selectedTracks.value.length;if(!count||route.value==='/bulk-edit')return null;return <div class="selection-bar" role="toolbar" aria-label="Selected tracks"><button class="icon-button" aria-label="Clear selection" onClick={clearSelection}><Icon name="x" size={18}/></button><strong>{count} selected</strong>{[['Edit','edit'],['Rename','rename'],['Artwork','artwork'],['Visibility','visibility'],['Delete','delete']].map(([label,mode])=><button class="button" onClick={()=>openEditor(mode)}>{label}</button>)}</div>;}
