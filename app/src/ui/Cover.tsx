import { useState } from 'preact/hooks';
import { api } from '@backend';
import type { Album } from '../api/types';
import { coverData } from '../library/covers';
export function Cover({album,size=148,title,artist}:{album?:Album;size?:number;title?:string;artist?:string}){const [failed,setFailed]=useState(false);return <img class="cover" width={size} height={size} src={album&&!failed?api.artUrl(album):coverData(title||album?.title||'Your music',artist||album?.artist_name||'Wavehaus',size)} alt="" loading="lazy" onError={()=>setFailed(true)}/>;}
