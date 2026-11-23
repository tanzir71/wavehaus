import { useEffect,useState } from 'preact/hooks';
import * as player from '../engine/player';
import { Dialog } from './Dialog';
import { Icon } from './Icon';

export function ShuffleButton({text=false}:{text?:boolean}){return <button class={`${text?'button':'icon-button'} ${player.shuffle.value?'active':''}`} aria-label="Shuffle" aria-pressed={player.shuffle.value} onClick={()=>player.setShuffle(!player.shuffle.peek())}><Icon name="shuffle" size={text?16:24}/>{text&&'Shuffle'}</button>;}
export function RepeatButton({text=false}:{text?:boolean}){const mode=player.repeat.value;return <button class={`${text?'button':'icon-button'} repeat-button ${mode!=='off'?'active':''}`} aria-label={`Repeat: ${mode}`} aria-pressed={mode!=='off'} onClick={()=>player.setRepeat(mode==='off'?'all':mode==='all'?'one':'off')}><Icon name="repeat" size={text?16:24}/>{mode==='one'&&<span class="repeat-one" aria-hidden="true">1</span>}{text&&`Repeat ${mode}`}</button>;}
export function SleepTimer({text=false}:{text?:boolean}){
 const [open,setOpen]=useState(false),[now,setNow]=useState(Date.now()),sleep=player.sleepState.value;
 useEffect(()=>{if(sleep.until===null)return;setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[sleep.until]);
 const active=sleep.until!==null||sleep.track!==null,label=sleep.track?'End of track':sleep.until?`${Math.max(1,Math.ceil((sleep.until-now)/60000))} min`:null;
 return <><button class={`${text?'button':'icon-button'} ${active?'active':''}`} aria-label={active?`Sleep timer: ${label}`:'Sleep timer'} aria-haspopup="dialog" onClick={()=>setOpen(true)}><Icon name="moon" size={text?16:24}/>{text&&(label?`Sleep · ${label}`:'Sleep timer')}</button>{open&&<Dialog title="Sleep timer" onClose={()=>setOpen(false)}><p>Stop playing after a set time, or when this track ends.</p><div class="sleep-options">{[5,15,30,45,60].map(minutes=><button key={minutes} class="button" onClick={()=>{player.sleep(minutes);setOpen(false);}}>{minutes} minutes</button>)}<button class="button" disabled={!player.current.value} onClick={()=>{player.sleep('endOfTrack');setOpen(false);}}>End of track</button></div>{active&&<button class="button light" onClick={()=>{player.sleep(null);setOpen(false);}}>Cancel sleep timer</button>}</Dialog>}</>;
}

export function SmartShuffleButton({text=false}:{text?:boolean}){return <button class={`${text?'button':'icon-button'} ${player.smartShuffle.value?'active':''}`} aria-label="Smart shuffle" aria-pressed={player.smartShuffle.value} onClick={()=>player.setSmartShuffle(!player.smartShuffle.peek())}><Icon name="sparkles" size={text?16:24}/>{text&&'Smart shuffle'}</button>;}
