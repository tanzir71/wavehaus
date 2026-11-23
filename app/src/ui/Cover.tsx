import { useState } from 'preact/hooks';
import { api } from '@backend';
import type { Album } from '../api/types';
import { coverSvg } from '../library/covers';
export function Cover({album,size=148,title,artist}:{album?:Album;size?:number;title?:string;artist?:string}){const [failed,setFailed]=useState(''),src=album?api.artUrl(album,size<=96?96:600):'';if(src&&failed!==src)return <img class="cover" width={size} height={size} src={src} alt="" loading="lazy" onError={()=>setFailed(src)}/>;const svg=coverSvg(title||album?.title||'Your music',artist||album?.artist_name||'Wavehaus',size).replace(/^<svg[^>]*>|<\/svg>$/g,'');return <svg class="cover" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" dangerouslySetInnerHTML={{__html:svg}}/>;}
