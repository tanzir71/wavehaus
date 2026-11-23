import { useEffect,useState } from 'preact/hooks';
import { authStatus } from '../library/session';
import { toast } from '../library/store';
import { navigate } from './router';
import { Icon } from './Icon';
import './file-drop.css';
export function FileDrop(){const [over,setOver]=useState(false);useEffect(()=>{let depth=0;const files=(event:DragEvent)=>Array.from(event.dataTransfer?.types||[]).includes('Files');
 const enter=(event:DragEvent)=>{if(authStatus.value!=='signedIn'||!files(event))return;event.preventDefault();depth++;setOver(true);},leave=(event:DragEvent)=>{if(!files(event))return;if(--depth<=0){depth=0;setOver(false);}},drag=(event:DragEvent)=>{if(authStatus.value==='signedIn'&&files(event))event.preventDefault();},drop=(event:DragEvent)=>{if(authStatus.value!=='signedIn'||!files(event)||!event.dataTransfer)return;event.preventDefault();depth=0;setOver(false);
  // Entry handles must be captured during this event, before a dynamic import.
  const transfer=event.dataTransfer,items=Array.from(transfer.items).map(item=>item.webkitGetAsEntry?.()).filter(Boolean),fallback=Array.from(transfer.files);
  void Promise.all([import('../upload/files'),import('../upload/pipeline')]).then(async([files,pipeline])=>{const proxy={items:items.map(entry=>({kind:'file',webkitGetAsEntry:()=>entry})),files:fallback} as unknown as DataTransfer;const picked=await files.droppedFiles(proxy);await pipeline.intake(picked);navigate('/upload');}).catch(error=>toast(error.message));};
 addEventListener('dragenter',enter);addEventListener('dragleave',leave);addEventListener('dragover',drag);addEventListener('drop',drop);return()=>{removeEventListener('dragenter',enter);removeEventListener('dragleave',leave);removeEventListener('dragover',drag);removeEventListener('drop',drop);};},[]);return over?<div class="global-drop" role="status"><Icon name="upload" size={56}/><h2>Drop to add to your library</h2><p>Folder structure stays with your music.</p></div>:null;}
