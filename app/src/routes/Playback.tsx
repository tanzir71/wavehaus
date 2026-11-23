import { useRef,useState } from 'preact/hooks';
import * as player from '../engine/player';
import type { QueueEntry } from '../engine/queue';
import { library } from '../library/store';
import { time } from '../library/ids';
import { href } from '../ui/router';
import { Cover } from '../ui/Cover';
import { Icon } from '../ui/Icon';
import { Dialog } from '../ui/Dialog';
import { PlayButton,LikeButton } from '../ui/Player';
import { ShuffleButton,RepeatButton,SleepTimer } from '../ui/PlaybackControls';
import { Waveform } from '../ui/Waveform';

export function NowPlaying(){
 const track=player.current.value,context=player.queueSections.value,[options,setOptions]=useState(false),[lyrics,setLyrics]=useState(false);
 if(!track)return <section class="empty"><h1>Nothing playing yet.</h1><p>Choose an album or add a track to your queue.</p><a class="button" href={href('/library')}>Your library</a></section>;
 const album=library.value.albums.find(a=>a.id===track.album_id),duration=player.durationMs.value||track.duration_ms,kind=context.type.split(':')[0],moments=library.value.moments.filter(m=>m.track_id===track.id&&!m.deleted);
 return <div class="now-playing"><header><a href={href('/')} class="icon-button" aria-label="Close Now Playing"><Icon name="chevron-down"/></a><div><p class="eyebrow">Playing from {['album','playlist','search'].includes(kind)?kind:'your library'}</p><strong>{context.label}</strong></div><button class="icon-button" aria-label="Track options" aria-haspopup="dialog" onClick={()=>setOptions(true)}><Icon name="more"/></button></header>
  <Cover album={album} title={track.album_title} artist={track.artist_name} size={300}/><div class="now-track"><div><h1>{track.title}</h1><p>{track.artist_name}</p></div><LikeButton id={track.id}/></div>
  <div class="format-tags"><span>{track.container||track.codec||'Original audio'}</span>{track.sample_rate&&<span>{Math.round(track.sample_rate/1000)} kHz</span>}<span><Icon name={track.visibility==='public'?'globe':'lock'} size={12}/>{track.visibility==='public'?'Public':'Private'}</span></div>
  <Waveform variant="Now" peaks={track.peaks} duration={duration} position={player.positionMs.value} playing={player.state.value==='playing'} livePosition={()=>player.audio.currentTime*1000} onSeek={player.seek} moments={moments}/>
  <div class="times"><span>{time(player.positionMs.value)}</span><span>−{time(duration-player.positionMs.value)}</span></div>
  <div class="now-controls"><ShuffleButton/><button class="icon-button" aria-label="Previous track" onClick={player.prev}><Icon name="prev" size={30}/></button><PlayButton size="l"/><button class="icon-button" aria-label="Next track" onClick={()=>player.next()}><Icon name="next" size={30}/></button><RepeatButton/></div>
  <div class="now-bottom"><button class="button" disabled={!track.lyrics} onClick={()=>setLyrics(true)}><Icon name="lyrics" size={16}/> Lyrics</button><SleepTimer text/><a class="button" href={href('/queue')}><span>Queue</span><Icon name="queue" size={16}/></a></div>
  {options&&<Dialog title="Track options" onClose={()=>setOptions(false)}><p>{track.title} · {track.artist_name}</p><div class="dialog-actions"><button class="button" onClick={()=>{player.enqueue(track);setOptions(false);}}>Add to queue</button>{album&&<a class="button" href={href(`/album/${album.id}`)} onClick={()=>setOptions(false)}>Open album</a>}</div></Dialog>}
  {lyrics&&<Dialog title="Lyrics" onClose={()=>setLyrics(false)}><pre class="lyrics-text">{track.lyrics}</pre></Dialog>}
 </div>;
}

function QueueRow({entry,index,manual,editing,onOptions,onDrag}:{entry:QueueEntry;index:number;manual:boolean;editing:boolean;onOptions:(entry:QueueEntry)=>void;onDrag:(key:string,to:number)=>void}){
 const album=library.value.albums.find(a=>a.id===entry.track.album_id),count=player.queueSections.value.manual.length,touch=useRef(false);
 return <li class="queue-row" data-queue-key={entry.key} data-queue-index={manual?index:undefined} draggable={manual} onDragStart={e=>{e.dataTransfer?.setData('text/plain',entry.key);if(e.dataTransfer)e.dataTransfer.effectAllowed='move';}} onDragOver={e=>{if(manual)e.preventDefault();}} onDrop={e=>{if(!manual)return;e.preventDefault();const key=e.dataTransfer?.getData('text/plain');if(key)onDrag(key,index);}}>
  <Cover album={album} size={48}/><button class="queue-track" onClick={()=>player.jump(entry.key)}><span class="sr-only">Play </span><strong>{entry.track.title}</strong><small>{entry.track.artist_name} · {time(entry.track.duration_ms)}</small></button>
  {editing?<div class="queue-edit-actions">{manual&&<><button class="icon-button" aria-label={`Move ${entry.track.title} up`} disabled={index===0} onClick={()=>onDrag(entry.key,index-1)}>↑</button><button class="icon-button" aria-label={`Move ${entry.track.title} down`} disabled={index===count-1} onClick={()=>onDrag(entry.key,index+1)}>↓</button></>}<button class="icon-button" aria-label={`Remove ${entry.track.title} from queue`} onClick={()=>player.removeQueued(entry.key)}><Icon name="x" size={18}/></button></div>:<button class="icon-button" aria-label={`Queue options for ${entry.track.title}`} onClick={()=>onOptions(entry)}><Icon name="more" size={20}/></button>}
  {manual&&!editing&&<button class="queue-grip icon-button" aria-label={`Reorder ${entry.track.title}`} title="Drag to reorder; open Queue options for keyboard controls" onClick={()=>onOptions(entry)} onPointerDown={e=>{if(e.pointerType==='mouse')return;touch.current=true;e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(!touch.current)return;const target=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-queue-index]'),to=Number(target?.dataset.queueIndex);if(target&&Number.isInteger(to)&&to!==index)onDrag(entry.key,to);}} onPointerUp={()=>{touch.current=false;}} onPointerCancel={()=>{touch.current=false;}}><span aria-hidden="true">⠿</span></button>}
 </li>;
}

function QueueCurrent(){
 const track=player.current.value;if(!track)return <p>Choose an album or add a song to start listening.</p>;
 const duration=player.durationMs.value||track.duration_ms;
 return <div class="queue-current"><div><Cover album={library.value.albums.find(a=>a.id===track.album_id)} size={48}/><a href={href('/now-playing')}><strong>{track.title}</strong><small>{track.artist_name} · {time(player.positionMs.value)} / {time(duration)}</small></a><PlayButton size="s"/></div><div class="queue-current-wave"><span>{time(player.positionMs.value)}</span><Waveform variant="Mini" peaks={track.peaks} duration={duration} position={player.positionMs.value} onSeek={player.seek} playing={player.state.value==='playing'} livePosition={()=>player.audio.currentTime*1000}/><span>{time(duration)}</span></div></div>;
}
export function Queue(){
 const sections=player.queueSections.value,[editing,setEditing]=useState(false),[selected,setSelected]=useState<QueueEntry|null>(null),[clear,setClear]=useState(false);
 const renderRows=(entries:QueueEntry[],manual=false)=><ul class="queue-list">{entries.map((entry,index)=><QueueRow key={entry.key} entry={entry} index={index} manual={manual} editing={editing} onOptions={setSelected} onDrag={player.reorderQueued}/>)}</ul>;
 const selectedIndex=sections.manual.findIndex(e=>e.key===selected?.key);
 return <div class="queue-page"><header class="queue-heading"><a class="icon-button" href={href('/now-playing')} aria-label="Close queue"><Icon name="chevron-down"/></a><h1>Queue</h1><button class="text-button" aria-pressed={editing} onClick={()=>setEditing(!editing)}>{editing?'Done':'Edit'}</button></header>
  <section><h2>Now playing</h2><QueueCurrent/></section>
  <section><div class="section-heading"><div><h2>Next in queue</h2><p class="eyebrow">Added by you · Drag to reorder</p></div>{!!sections.manual.length&&<button class="text-button" onClick={()=>setClear(true)}>Clear</button>}</div>{sections.manual.length?renderRows(sections.manual,true):<p class="muted">Add songs with the + button beside a track.</p>}</section>
  {!!sections.context.length&&<section><h2>Next from: {sections.label}</h2>{renderRows(sections.context)}</section>}
  <section class="autoplay-panel"><div class="autoplay-heading"><Icon name="sparkles"/><div><h2>Autoplay</h2><p>Keep going with tracks from your library when the queue ends.</p></div><button class="switch" role="switch" aria-label="Autoplay" aria-checked={player.autoplay.value} onClick={()=>player.setAutoplay(!player.autoplay.peek())}><span/></button></div><p class="eyebrow">On your device · No external services</p>{player.autoplay.value?(player.repeat.value!=='off'?<p class="muted">Autoplay resumes when repeat is off.</p>:sections.automatic.length?renderRows(sections.automatic):<p class="muted">No more unplayed tracks are available right now.</p>):<p class="muted">Playback stops when the queue ends.</p>}</section>
  <div class="queue-controls"><ShuffleButton text/><RepeatButton text/><SleepTimer text/></div>
  {clear&&<Dialog title="Clear your queue?" onClose={()=>setClear(false)}><p>Remove the songs you added next. Your current track and {sections.label} keep playing.</p><div class="dialog-actions"><button class="button" onClick={()=>setClear(false)}>Keep queue</button><button class="button primary" onClick={()=>{player.clearQueue();setClear(false);}}>Clear queue</button></div></Dialog>}
  {selected&&<Dialog title="Queue options" onClose={()=>setSelected(null)}><p>{selected.track.title}</p><div class="dialog-actions">{selectedIndex>=0&&<><button class="button" disabled={selectedIndex===0} onClick={()=>{player.reorderQueued(selected.key,selectedIndex-1);}}>Move up</button><button class="button" disabled={selectedIndex===sections.manual.length-1} onClick={()=>{player.reorderQueued(selected.key,selectedIndex+1);}}>Move down</button></>}<button class="button" onClick={()=>{player.removeQueued(selected.key);setSelected(null);}}>Remove from queue</button></div></Dialog>}
 </div>;
}
